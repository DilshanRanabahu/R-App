import { redact } from '../redact';

describe('redact', () => {
  it('removes session, token and personal XML values', () => {
    const input =
      '<response><SesInfo>abc</SesInfo><TokInfo>def</TokInfo><Imei>356789012345678</Imei>' +
      '<SerialNumber>SN123</SerialNumber><Content>secret sms</Content><Rat>7</Rat></response>';
    const out = redact(input);
    expect(out).not.toMatch(/abc|def|356789012345678|SN123|secret sms/);
    expect(out).toContain('<Rat>7</Rat>');
  });

  it('removes cookies, tokens, MACs and phone numbers in free text', () => {
    const out = redact(
      'Cookie SessionID=XYZ; __RequestVerificationToken: TOK mac AA:BB:CC:00:11:22 call +94770000000',
    );
    expect(out).not.toMatch(/XYZ|TOK\b|AA:BB|94770000000/);
  });

  it('removes admin / Wi-Fi passwords, Wi-Fi name and key-exchange values', () => {
    const out = redact(
      '<request><username>admin</username><currentpassword>old-fake</currentpassword>' +
        '<newpassword>new-fake</newpassword><WifiSsid>Fake-Net</WifiSsid><WifiWpapsk>k1</WifiWpapsk>' +
        '<MixWifiWpapsk>k2</MixWifiWpapsk><WifiWepKey1>k3</WifiWepKey1><WifiRadiusKey>k4</WifiRadiusKey>' +
        '<nonce>n1</nonce><pwd>p1</pwd><hash>h1</hash><WifiEnable>1</WifiEnable></request>',
    );
    expect(out).not.toMatch(/old-fake|new-fake|Fake-Net|>k[1-4]<|>n1<|>p1<|>h1</);
    expect(out).toContain('<username>admin</username>');
    expect(out).toContain('<WifiEnable>1</WifiEnable>');
  });
});
