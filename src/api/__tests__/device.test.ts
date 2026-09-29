import { getRouterDetails } from '../endpoints/device';
import { decodeCharRefs } from '../endpoints/parse';

// Fake identifiers only (AGENTS.md §9).
const mockGet = jest.fn();
jest.mock('../client', () => ({ routerClient: { get: (path: string) => mockGet(path) } }));

describe('getRouterDetails', () => {
  it('keeps only firmware and uptime, never identifiers', async () => {
    mockGet.mockResolvedValueOnce({
      DeviceName: 'B312-926',
      SerialNumber: 'FAKESERIAL000',
      Imei: '000000000000000',
      Imsi: '000000000000000',
      MacAddress1: 'AA:AA:AA:AA:AA:01',
      SoftwareVersion: '10.0.0.1&#40;H100SP1C00&#41;',
      uptime: '259200',
    });
    const details = await getRouterDetails();
    expect(details).toEqual({ firmware: '10.0.0.1(H100SP1C00)', uptimeSeconds: 259200 });
    expect(JSON.stringify(details)).not.toMatch(/FAKESERIAL|000000000000000|AA:AA/);
    expect(mockGet).toHaveBeenCalledWith('/api/device/information');
  });

  it('returns nulls when the router leaves the fields out', async () => {
    mockGet.mockResolvedValueOnce({ DeviceName: 'B312-926' });
    expect(await getRouterDetails()).toEqual({ firmware: null, uptimeSeconds: null });
  });
});

describe('decodeCharRefs', () => {
  it('decodes decimal and hex references', () => {
    expect(decodeCharRefs('11.0.1.1&#40;H197&#41;')).toBe('11.0.1.1(H197)');
    expect(decodeCharRefs('a&#x2d;b')).toBe('a-b');
  });

  it('leaves control characters, named entities and plain text alone', () => {
    expect(decodeCharRefs('x&#0;y&#10;z&#x7f;')).toBe('x&#0;y&#10;z&#x7f;');
    expect(decodeCharRefs('&lt;b&gt; &amp;')).toBe('&lt;b&gt; &amp;');
    expect(decodeCharRefs('&#55357;')).toBe('&#55357;');
    expect(decodeCharRefs('plain')).toBe('plain');
  });
});
