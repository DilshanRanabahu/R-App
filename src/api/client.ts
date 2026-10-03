import { RouterError, isRouterError } from './errors';
import { isPrivateIPv4 } from './validate';
import { MAX_RESPONSE_BYTES, buildRequest, parseResponse, type XmlObject } from './xml';

export const DEFAULT_ROUTER_HOST = '192.168.8.1';
const TIMEOUT_MS = 8000;

type BodyBuilder = XmlObject | ((token: string) => XmlObject | Promise<XmlObject>);

export interface PostOptions {
  /** Value escaping for the XML body (default: the 5 XML entities). */
  escape?: (value: string) => string;
  /** RSA-encrypt the XML body; it is then sent with the web UI's ";enc" content type. */
  encrypt?: (xml: string) => string | Promise<string>;
  /** Retry once with a fresh token on a bad-token error (default true). */
  retryBadToken?: boolean;
  /**
   * Content-Type suffix the router reads, e.g. "enp" = "some fields are RSA-encrypted"
   * (Wi-Fi settings). Ignored when `encrypt` is set, which always sends ";enc".
   */
  typeSuffix?: string;
  /** Longer wait for slow router actions (e.g. re-registering on a band). Default 8 s. */
  timeoutMs?: number;
}

/**
 * True if a response URL is plain HTTP on the router host, port 80. An empty URL
 * (the platform didn't report one) is accepted: nothing was redirected.
 */
export function isFromHost(url: string, host: string): boolean {
  if (!url) return true;
  const m = /^http:\/\/([^/:?#]+)(?::(\d+))?(?:[/?#]|$)/i.exec(url);
  return !!m && m[1]?.toLowerCase() === host.toLowerCase() && (m[2] === undefined || m[2] === '80');
}

const FORM_TYPE = 'application/x-www-form-urlencoded; charset=UTF-8';
const ENCRYPTED_TYPE = `${FORM_TYPE};enc`;

interface RawResponse {
  text: string;
  headers: Headers;
}

/**
 * The only code that talks to the router (AGENTS.md §6). Owns the SessionID cookie
 * and the CSRF token list; neither is exposed outside this class.
 */
export class RouterClient {
  private host = DEFAULT_ROUTER_HOST;
  private sessionId: string | null = null;
  private tokens: string[] = [];
  private postQueue: Promise<unknown> = Promise.resolve();

  constructor(host: string = DEFAULT_ROUTER_HOST) {
    this.setHost(host);
  }

  get routerHost(): string {
    return this.host;
  }

  get hasSession(): boolean {
    return this.sessionId !== null;
  }

  setHost(host: string): void {
    if (!isPrivateIPv4(host)) throw new RouterError('invalid_address');
    this.host = host;
    this.clearSession();
  }

  clearSession(): void {
    this.sessionId = null;
    this.tokens = [];
  }

  /** Start a fresh session (new cookie + token), e.g. right before login. */
  async newSession(): Promise<void> {
    this.clearSession();
    await this.fetchSessionAndToken();
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.send(path, 'GET');
    return parseResponse<T>(res.text);
  }

  /**
   * POSTs are serialized so each one consumes its own token. `body` can be a
   * function of the token (login hashes the password with it). A bad-token error
   * is retried once with a fresh token.
   */
  post<T = unknown>(path: string, body: BodyBuilder, options: PostOptions = {}): Promise<T> {
    const run = () => this.doPost<T>(path, body, options, options.retryBadToken ?? true);
    const result = this.postQueue.then(run, run);
    this.postQueue = result.catch(() => undefined);
    return result;
  }

  private async doPost<T>(path: string, body: BodyBuilder, options: PostOptions, retry: boolean): Promise<T> {
    const token = await this.nextToken();
    const xmlBody = typeof body === 'function' ? await body(token) : body;
    const xml = buildRequest(xmlBody, options.escape);
    const payload = options.encrypt ? await options.encrypt(xml) : xml;
    const type = options.encrypt
      ? ENCRYPTED_TYPE
      : options.typeSuffix
        ? `${FORM_TYPE};${options.typeSuffix}`
        : FORM_TYPE;
    const res = await this.send(path, 'POST', payload, token, type, options.timeoutMs);
    try {
      return parseResponse<T>(res.text);
    } catch (e) {
      if (retry && isRouterError(e, 'bad_token')) {
        this.tokens = [];
        return this.doPost<T>(path, body, options, false);
      }
      throw e;
    }
  }

  private async nextToken(): Promise<string> {
    if (this.tokens.length === 0) await this.fetchSessionAndToken();
    const token = this.tokens.shift();
    if (!token) throw new RouterError('bad_token');
    return token;
  }

  private async fetchSessionAndToken(): Promise<void> {
    const res = await this.send('/api/webserver/SesTokInfo', 'GET');
    const data = parseResponse<{ SesInfo?: string; TokInfo?: string }>(res.text);
    if (!data?.TokInfo) throw new RouterError('invalid_response');
    // SesInfo equals the Set-Cookie SessionID on this firmware; keep an existing
    // (possibly logged-in) session unless the router issued a new cookie.
    if (!this.sessionId && data.SesInfo) this.sessionId = data.SesInfo;
    this.tokens = [data.TokInfo];
  }

  private captureHeaders(headers: Headers): void {
    const cookie = headers.get('set-cookie');
    const match = cookie ? /SessionID=([^;,\s]+)/.exec(cookie) : null;
    if (match?.[1]) this.sessionId = match[1];

    // After login the router hands out a batch of tokens; otherwise one per response.
    const one = headers.get('__RequestVerificationTokenone');
    const two = headers.get('__RequestVerificationTokentwo');
    const single = headers.get('__RequestVerificationToken');
    if (one) {
      this.tokens = [one, two].filter((t): t is string => !!t);
    } else if (single) {
      this.tokens = single.split('#').filter(Boolean);
    }
  }

  private async send(
    path: string,
    method: 'GET' | 'POST',
    body?: string,
    token?: string,
    contentType: string = FORM_TYPE,
    timeoutMs: number = TIMEOUT_MS,
  ): Promise<RawResponse> {
    const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
    if (this.sessionId) headers.Cookie = `SessionID=${this.sessionId}`;
    if (token) headers.__RequestVerificationToken = token;
    if (body) headers['Content-Type'] = contentType;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`http://${this.host}${path}`, {
        method,
        headers,
        body,
        // 'omit' disables React Native's native cookie jar so this class is the
        // single owner of the session (and logout really forgets it).
        credentials: 'omit',
        signal: controller.signal,
      });
      // React Native follows redirects by itself and can't be told not to. An answer that
      // ended up anywhere but the router (a look-alike router redirecting elsewhere) is
      // rejected before its cookies, tokens or body are used (AGENTS.md §8.5).
      if (!isFromHost(res.url, this.host)) throw new RouterError('invalid_response');
      // Don't even download oversized answers; xml.ts checks the size again.
      if (Number(res.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
        controller.abort();
        throw new RouterError('invalid_response');
      }
      this.captureHeaders(res.headers);
      return { text: await res.text(), headers: res.headers };
    } catch (e) {
      if (e instanceof RouterError) throw e;
      throw new RouterError(controller.signal.aborted ? 'timeout' : 'unreachable');
    } finally {
      clearTimeout(timer);
    }
  }
}

export const routerClient = new RouterClient();
