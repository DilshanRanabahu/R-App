import { RouterClient, isFromHost } from '../client';
import { isRouterError } from '../errors';

// Fake values only; no real session data in fixtures (AGENTS.md §9).
const XML = '<?xml version="1.0" encoding="UTF-8"?>';
const sesTok = (ses: string, tok: string) =>
  `${XML}<response><SesInfo>${ses}</SesInfo><TokInfo>${tok}</TokInfo></response>`;

interface Call {
  url: string;
  init: RequestInit;
}

function mockFetch(responses: { body: string; headers?: Record<string, string>; url?: string }[]) {
  const calls: Call[] = [];
  global.fetch = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    const res = new Response(next.body, { headers: next.headers });
    // Where the request finally landed (after redirects), as the platform reports it.
    if (next.url !== undefined) Object.defineProperty(res, 'url', { value: next.url });
    return res;
  }) as unknown as typeof fetch;
  return calls;
}

const header = (c: Call | undefined, name: string) =>
  (c?.init.headers as Record<string, string>)[name];

describe('isFromHost', () => {
  it('accepts only plain HTTP on the router host, port 80', () => {
    expect(isFromHost('', '192.168.8.1')).toBe(true);
    expect(isFromHost('http://192.168.8.1/api/x', '192.168.8.1')).toBe(true);
    expect(isFromHost('http://192.168.8.1:80/html/index.html', '192.168.8.1')).toBe(true);
    expect(isFromHost('http://192.168.8.1', '192.168.8.1')).toBe(true);
    expect(isFromHost('https://192.168.8.1/api/x', '192.168.8.1')).toBe(false);
    expect(isFromHost('http://192.168.8.1:8080/api/x', '192.168.8.1')).toBe(false);
    expect(isFromHost('http://192.168.8.10/api/x', '192.168.8.1')).toBe(false);
    expect(isFromHost('http://192.168.8.1.evil.example/x', '192.168.8.1')).toBe(false);
    expect(isFromHost('http://evil.example/?h=192.168.8.1', '192.168.8.1')).toBe(false);
  });
});

describe('RouterClient', () => {
  it('refuses non-private router addresses', () => {
    expect(() => new RouterClient('8.8.8.8')).toThrow();
    expect(() => new RouterClient('evil.com')).toThrow();
  });

  it('GETs without cookies from the native jar', async () => {
    const calls = mockFetch([{ body: `${XML}<response><Rat>7</Rat></response>` }]);
    const client = new RouterClient();
    await expect(client.get('/api/net/current-plmn')).resolves.toEqual({ Rat: '7' });
    expect(calls[0]?.url).toBe('http://192.168.8.1/api/net/current-plmn');
    expect(calls[0]?.init.credentials).toBe('omit');
  });

  it('fetches a token + session before POST and sends both', async () => {
    const calls = mockFetch([
      { body: sesTok('SES1', 'TOK1') },
      { body: `${XML}<response>OK</response>` },
    ]);
    const client = new RouterClient();
    await client.post('/api/x', { A: 1 });
    expect(header(calls[1], '__RequestVerificationToken')).toBe('TOK1');
    expect(header(calls[1], 'Cookie')).toBe('SessionID=SES1');
    expect(calls[1]?.init.body).toContain('<A>1</A>');
  });

  it('rotates tokens and adopts new session cookies from headers', async () => {
    const calls = mockFetch([
      { body: sesTok('SES1', 'TOK1') },
      {
        body: `${XML}<response>OK</response>`,
        headers: {
          'Set-Cookie': 'SessionID=SES2; path=/; HttpOnly;',
          __RequestVerificationTokenone: 'TOK2',
          __RequestVerificationTokentwo: 'TOK3',
        },
      },
      { body: `${XML}<response>OK</response>` },
      { body: `${XML}<response>OK</response>` },
    ]);
    const client = new RouterClient();
    await client.post('/api/user/login', { A: 1 });
    await client.post('/api/a', { A: 1 });
    await client.post('/api/b', { A: 1 });
    expect(header(calls[2], '__RequestVerificationToken')).toBe('TOK2');
    expect(header(calls[2], 'Cookie')).toBe('SessionID=SES2');
    expect(header(calls[3], '__RequestVerificationToken')).toBe('TOK3');
  });

  it('serializes concurrent POSTs so each uses its own token', async () => {
    const calls = mockFetch([
      { body: sesTok('S', 'T1') },
      { body: `${XML}<response>OK</response>`, headers: { __RequestVerificationToken: 'T2' } },
      { body: `${XML}<response>OK</response>`, headers: { __RequestVerificationToken: 'T3' } },
    ]);
    const client = new RouterClient();
    await Promise.all([client.post('/api/a', {}), client.post('/api/b', {})]);
    expect(header(calls[1], '__RequestVerificationToken')).toBe('T1');
    expect(header(calls[2], '__RequestVerificationToken')).toBe('T2');
  });

  it('retries a bad-token error exactly once, rebuilding the body', async () => {
    mockFetch([
      { body: sesTok('S', 'T1') },
      { body: `${XML}<error><code>125002</code></error>` },
      { body: sesTok('S', 'T2') },
      { body: `${XML}<error><code>125002</code></error>` },
    ]);
    const builder = jest.fn((token: string) => ({ Token: token }));
    const client = new RouterClient();
    await expect(client.post('/api/x', builder)).rejects.toMatchObject({ kind: 'bad_token' });
    expect(builder.mock.calls.map((c) => c[0])).toEqual(['T1', 'T2']);
  });

  it('does not retry wrong-password errors', async () => {
    const calls = mockFetch([
      { body: sesTok('S', 'T1') },
      { body: `${XML}<error><code>108006</code></error>` },
    ]);
    const client = new RouterClient();
    await expect(client.post('/api/user/login', {})).rejects.toMatchObject({
      kind: 'wrong_password',
    });
    expect(calls).toHaveLength(2);
  });

  it('maps network failures to unreachable', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    const err = await new RouterClient().get('/api/x').catch((e: unknown) => e);
    expect(isRouterError(err, 'unreachable')).toBe(true);
  });

  it('clearSession forgets cookie and tokens', async () => {
    const calls = mockFetch([
      { body: sesTok('S1', 'T1') },
      { body: `${XML}<response>OK</response>` },
      { body: `${XML}<response>OK</response>` },
    ]);
    const client = new RouterClient();
    await client.post('/api/a', {});
    client.clearSession();
    await client.get('/api/b');
    expect(header(calls[2], 'Cookie')).toBeUndefined();
  });

  it('rejects answers that were redirected away from the router, and ignores their cookies', async () => {
    const calls = mockFetch([
      {
        body: sesTok('EVIL', 'EVILTOK'),
        headers: { 'Set-Cookie': 'SessionID=EVIL2;' },
        url: 'https://evil.example/api/webserver/SesTokInfo',
      },
      { body: sesTok('S1', 'T1') },
      { body: `${XML}<response>OK</response>` },
    ]);
    const client = new RouterClient();
    const err = await client.get('/api/webserver/SesTokInfo').catch((e: unknown) => e);
    expect(isRouterError(err, 'invalid_response')).toBe(true);
    await client.post('/api/x', {});
    expect(header(calls[2], 'Cookie')).toBe('SessionID=S1');
  });

  it('accepts answers from the router itself', async () => {
    mockFetch([{ body: `${XML}<response><A>1</A></response>`, url: 'http://192.168.8.1/api/a' }]);
    await expect(new RouterClient().get('/api/a')).resolves.toEqual({ A: '1' });
  });

  it('refuses oversized answers before reading them', async () => {
    mockFetch([{ body: `${XML}<response>OK</response>`, headers: { 'Content-Length': '2000000' } }]);
    const err = await new RouterClient().get('/api/x').catch((e: unknown) => e);
    expect(isRouterError(err, 'invalid_response')).toBe(true);
  });

  it('sends encrypted bodies with the web UI content type', async () => {
    const calls = mockFetch([
      { body: sesTok('SES1', 'TOK1') },
      { body: `${XML}<response>OK</response>` },
    ]);
    const client = new RouterClient();
    await client.post('/api/x', { A: 'a&b' }, { encrypt: (xml) => `ENC(${xml})` });
    expect(header(calls[1], 'Content-Type')).toBe('application/x-www-form-urlencoded; charset=UTF-8;enc');
    expect(calls[1]?.init.body).toBe(`ENC(${XML}<request><A>a&amp;b</A></request>)`);
  });

  it('does not retry a bad token when asked not to', async () => {
    const calls = mockFetch([
      { body: sesTok('SES1', 'TOK1') },
      { body: `${XML}<error><code>125002</code></error>` },
    ]);
    const client = new RouterClient();
    const err = await client.post('/api/x', { A: 1 }, { retryBadToken: false }).catch((e: unknown) => e);
    expect(isRouterError(err, 'bad_token')).toBe(true);
    expect(calls).toHaveLength(2);
  });
});
