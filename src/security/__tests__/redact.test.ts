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
      'Cookie SessionID=XYZ; __RequestVerificationToken: TOK mac 7E:42:AE:06:19:D3 call +94771234567',
    );
    expect(out).not.toMatch(/XYZ|TOK\b|7E:42|94771234567/);
  });
});
