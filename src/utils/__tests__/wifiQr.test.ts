import { qrSecurityType, wifiQrPayload } from '../wifiQr';

// Fake network names and keys only.
describe('wifiQrPayload', () => {
  it('builds a WPA payload', () => {
    expect(wifiQrPayload('Home-Net', 'fake-key-123', 'WPA2-PSK', false)).toBe(
      'WIFI:T:WPA;S:Home-Net;P:fake-key-123;;',
    );
  });

  it('escapes reserved characters', () => {
    expect(wifiQrPayload('A;B,C', 'p:a"s\\s', 'WPA2-PSK', false)).toBe(
      'WIFI:T:WPA;S:A\\;B\\,C;P:p\\:a\\"s\\\\s;;',
    );
  });

  it('marks hidden networks and open networks', () => {
    expect(wifiQrPayload('Hidden', 'k', 'WPA2-PSK', true)).toBe('WIFI:T:WPA;S:Hidden;P:k;H:true;;');
    expect(wifiQrPayload('Guest', 'ignored', 'OPEN', false)).toBe('WIFI:T:nopass;S:Guest;;');
  });
});

describe('qrSecurityType', () => {
  it('maps router auth modes', () => {
    expect(qrSecurityType('WPA2-PSK')).toBe('WPA');
    expect(qrSecurityType('WPA/WPA2-PSK')).toBe('WPA');
    expect(qrSecurityType('OPEN')).toBe('nopass');
    expect(qrSecurityType('SHARE')).toBe('WEP');
  });
});
