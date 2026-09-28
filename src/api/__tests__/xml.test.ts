import { isRouterError } from '../errors';
import { buildRequest, escapeXml, parseResponse, toArray } from '../xml';

describe('escapeXml', () => {
  it('escapes all five XML special characters', () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;',
    );
  });
});

describe('buildRequest', () => {
  it('builds nested elements and repeats arrays', () => {
    expect(buildRequest({ Index: [1, 2], Box: { Name: 'a' }, Skip: undefined })).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><request><Index>1</Index><Index>2</Index><Box><Name>a</Name></Box></request>',
    );
  });

  it('escapes user input so it cannot inject elements', () => {
    const xml = buildRequest({ Content: '</Content><Phone>123</Phone>' });
    expect(xml).toContain('<Content>&lt;/Content&gt;&lt;Phone&gt;123&lt;/Phone&gt;</Content>');
    expect(xml.match(/<Phone>/g)).toBeNull();
  });

  it('rejects invalid tag names', () => {
    expect(() => buildRequest({ 'bad tag': 'x' })).toThrow();
  });
});

describe('parseResponse', () => {
  it('returns the response content as strings', () => {
    const r = parseResponse<{ Rat: string; FullName: string }>(
      '<?xml version="1.0" encoding="UTF-8"?><response><Rat>7</Rat><FullName>A &amp; B</FullName></response>',
    );
    expect(r).toEqual({ Rat: '7', FullName: 'A & B' });
  });

  it('maps <error> codes to typed errors', () => {
    try {
      parseResponse('<?xml version="1.0"?><error><code>100003</code><message/></error>');
      fail('should throw');
    } catch (e) {
      expect(isRouterError(e, 'login_required')).toBe(true);
    }
  });

  it('treats OK responses as plain strings', () => {
    expect(parseResponse('<?xml version="1.0"?><response>OK</response>')).toBe('OK');
  });

  it('rejects DOCTYPE / entity declarations', () => {
    const evil =
      '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x "boom">]><response><a>&x;</a></response>';
    expect(() => parseResponse(evil)).toThrow();
  });

  it('rejects oversized and non-HiLink bodies', () => {
    expect(() => parseResponse('<response>' + 'a'.repeat(1_000_001) + '</response>')).toThrow();
    expect(() => parseResponse('<html><body>hi</body></html>')).toThrow();
  });
});

describe('toArray', () => {
  it('normalizes single, multiple and empty values', () => {
    expect(toArray(undefined)).toEqual([]);
    expect(toArray('')).toEqual([]);
    expect(toArray({ a: 1 })).toEqual([{ a: 1 }]);
    expect(toArray([1, 2])).toEqual([1, 2]);
  });
});
