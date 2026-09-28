import {
  isPrivateIPv4,
  normalizeMac,
  validateMac,
  validateNewAdminPassword,
  validatePhoneNumber,
  validateSmsText,
  validateSsid,
  validateUssd,
  validateWifiKey,
} from '../validate';

describe('isPrivateIPv4', () => {
  it.each(['192.168.8.1', '10.0.0.1', '172.16.0.1', '172.31.255.254'])('accepts %s', (ip) => {
    expect(isPrivateIPv4(ip)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '172.32.0.1',
    '192.169.0.1',
    '192.168.8.256',
    '192.168.08.1',
    'router.local',
    'http://192.168.8.1',
    '192.168.8.1:8080',
    '192.168.8.1.evil.com',
    '',
  ])('rejects %s', (ip) => {
    expect(isPrivateIPv4(ip)).toBe(false);
  });
});

describe('validators', () => {
  it('SSID: 1–32 bytes, no control characters', () => {
    expect(validateSsid('Home WiFi')).toBeNull();
    expect(validateSsid('')).not.toBeNull();
    expect(validateSsid('a'.repeat(33))).not.toBeNull();
    expect(validateSsid('é'.repeat(17))).not.toBeNull(); // 34 bytes
    expect(validateSsid('bad\nname')).not.toBeNull();
  });

  it('Wi-Fi key: 8–63 printable ASCII', () => {
    expect(validateWifiKey('abcd1234')).toBeNull();
    expect(validateWifiKey('short')).not.toBeNull();
    expect(validateWifiKey('a'.repeat(64))).not.toBeNull();
    expect(validateWifiKey('pässwörd1')).not.toBeNull();
  });

  it('phone numbers', () => {
    expect(validatePhoneNumber('+94771234567')).toBeNull();
    expect(validatePhoneNumber('0771234567')).toBeNull();
    expect(validatePhoneNumber('077-123')).not.toBeNull();
    expect(validatePhoneNumber('<script>')).not.toBeNull();
  });

  it('USSD codes', () => {
    expect(validateUssd('*#456#')).toBeNull();
    expect(validateUssd('#123#')).toBeNull();
    expect(validateUssd('123')).not.toBeNull();
    expect(validateUssd('*12a#')).not.toBeNull();
  });

  it('SMS text', () => {
    expect(validateSmsText('hello')).toBeNull();
    expect(validateSmsText('   ')).not.toBeNull();
    expect(validateSmsText('a'.repeat(460))).not.toBeNull();
  });

  it('MAC addresses', () => {
    expect(normalizeMac('aa-bb-cc-dd-ee-ff')).toBe('AA:BB:CC:DD:EE:FF');
    expect(validateMac('aa:bb:cc:dd:ee:ff')).toBeNull();
    expect(validateMac('aa:bb:cc')).not.toBeNull();
  });

  it('new admin password', () => {
    expect(validateNewAdminPassword('newpassword1', 'old')).toBeNull();
    expect(validateNewAdminPassword('short', 'old')).not.toBeNull();
    expect(validateNewAdminPassword('samepassword', 'samepassword')).not.toBeNull();
  });
});
