import { buildBlockRequest, getBlockList, parseBlockList, setBlocked } from '../endpoints/macfilter';
import type { MacFilterExRaw } from '../types';

// Fake devices only (AGENTS.md §9). Shapes follow the router's own answers.
const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('../client', () => ({
  routerClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body: unknown, options: unknown) => mockPost(path, body, options),
  },
}));

const TV = '00:00:5E:00:53:01';
const TABLET = '00:00:5E:00:53:02';

const off: MacFilterExRaw = {
  enable: '0',
  wifimacfilterstatus: '2',
  Ssids: { Ssid: [{ Index: '0', wifimacblacklist: '', wifimacwhitelist: '' }, { Index: '1', wifimacblacklist: '' }] },
};
const blocking = (list: Record<string, string>): MacFilterExRaw => ({
  enable: '1',
  wifimacfilterstatus: '2',
  Ssids: { Ssid: [{ Index: '0', wifimacblacklist: list, wifimacwhitelist: '' }] },
});
const tvBlocked = blocking({ WifiMacFilterMac0: TV, wifihostname0: 'TV' });

function respond(raw: MacFilterExRaw, max: string | Error = '10') {
  mockGet.mockImplementation(async (path: string) => {
    if (path === '/api/wlan/multi-macfilter-settings-ex') return raw;
    if (max instanceof Error) throw max;
    return { wifimaxmacfilternum: max };
  });
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset().mockResolvedValue('OK');
});

describe('parseBlockList', () => {
  it('reads an empty, switched-off filter', () => {
    expect(parseBlockList(off, 10)).toEqual({ mode: 'off', blocked: [], max: 10 });
  });

  it('reads blocked devices and normalises MACs', () => {
    const raw = blocking({ WifiMacFilterMac0: '00:00:5e:00:53:01', wifihostname0: 'TV', WifiMacFilterMac1: '', wifihostname1: '' });
    expect(parseBlockList(raw, 10)).toEqual({ mode: 'block', blocked: [{ mac: TV, name: 'TV' }], max: 10 });
  });

  it('keeps a list that is not enforced, and recognises allow-list mode', () => {
    expect(parseBlockList({ ...tvBlocked, enable: '0' }, 10)).toMatchObject({ mode: 'off', blocked: [{ mac: TV }] });
    expect(parseBlockList({ ...tvBlocked, wifimacfilterstatus: '1' }, 10).mode).toBe('allow');
  });

  it('survives a missing Ssids block', () => {
    expect(parseBlockList({ enable: '0', Ssids: '' }, 10).blocked).toEqual([]);
  });
});

describe('buildBlockRequest (same logic as the router page)', () => {
  it('first block: turns the block list on with the device in slot 0', () => {
    expect(buildBlockRequest(off, 10, TV, 'TV', true)).toEqual({
      result: 'ok',
      entry: { WifiMacFilterMac0: TV, wifihostname0: 'TV', WifiMacFilterStatus: '2', Index: 0 },
    });
  });

  it('adds to the first empty slot and keeps the others', () => {
    const { entry } = buildBlockRequest(tvBlocked, 10, TABLET, 'Tablet', true);
    expect(entry).toEqual({
      WifiMacFilterMac0: TV,
      wifihostname0: 'TV',
      WifiMacFilterMac1: TABLET,
      wifihostname1: 'Tablet',
      WifiMacFilterStatus: '2',
      Index: 0,
    });
  });

  it('unblock clears the slot and leaves block mode on', () => {
    expect(buildBlockRequest(tvBlocked, 10, TV, '', false).entry).toEqual({
      WifiMacFilterMac0: '',
      wifihostname0: '',
      WifiMacFilterStatus: '2',
      Index: 0,
    });
  });

  it('does not add a device twice', () => {
    const { entry } = buildBlockRequest(tvBlocked, 10, TV.toLowerCase(), 'TV', true);
    expect(Object.keys(entry ?? {}).filter((k) => k.startsWith('WifiMacFilterMac'))).toEqual(['WifiMacFilterMac0']);
  });

  it('unblocking while the filter is off keeps it off', () => {
    expect(buildBlockRequest({ ...tvBlocked, enable: '0' }, 10, TV, '', false).entry?.WifiMacFilterStatus).toBe('0');
  });

  it('refuses when the list is full or the router uses an allow list', () => {
    const full: Record<string, string> = {};
    for (let i = 0; i < 2; i++) {
      full[`WifiMacFilterMac${i}`] = `00:00:5E:00:53:1${i}`;
      full[`wifihostname${i}`] = `d${i}`;
    }
    expect(buildBlockRequest(blocking(full), 2, TV, 'TV', true)).toEqual({ result: 'full' });
    expect(buildBlockRequest({ ...tvBlocked, wifimacfilterstatus: '1' }, 10, TABLET, 'x', true)).toEqual({
      result: 'allow_list',
    });
  });
});

describe('getBlockList / setBlocked', () => {
  it('uses the router slot count, and 10 when it is not reported', async () => {
    respond(off, '32');
    expect((await getBlockList()).max).toBe(32);
    respond(off, new Error('no feature switch'));
    expect((await getBlockList()).max).toBe(10);
  });

  it('posts the list to multi-macfilter-settings, never auto-retried', async () => {
    respond(tvBlocked);
    await expect(setBlocked({ mac: TABLET, name: 'Tablet', block: true })).resolves.toBe('ok');
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [path, body, options] = mockPost.mock.calls[0] as [string, { Ssids: { Ssid: object[] } }, object];
    expect(path).toBe('/api/wlan/multi-macfilter-settings');
    expect(body.Ssids.Ssid).toHaveLength(1);
    expect(body.Ssids.Ssid[0]).toMatchObject({ WifiMacFilterMac1: TABLET, WifiMacFilterStatus: '2' });
    expect(options).toEqual({ retryBadToken: false });
  });

  it('sends nothing when it cannot be done', async () => {
    respond({ ...tvBlocked, wifimacfilterstatus: '1' });
    await expect(setBlocked({ mac: TABLET, name: '', block: true })).resolves.toBe('allow_list');
    await expect(setBlocked({ mac: 'not-a-mac', name: '', block: true })).rejects.toThrow();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
