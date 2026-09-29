// Wi-Fi QR payload (the "WIFI:" format phone cameras understand).

/** Backslash-escape the characters the WIFI: format reserves. */
function escapeField(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

/** Map the router's auth mode to the QR "T:" type. */
export function qrSecurityType(authMode: string): 'WPA' | 'WEP' | 'nopass' {
  const mode = authMode.toUpperCase();
  if (mode === 'OPEN' || mode === '') return 'nopass';
  if (mode.includes('WEP') || mode === 'SHARE') return 'WEP';
  return 'WPA'; // WPA-PSK, WPA2-PSK, WPA/WPA2-PSK, WPA3-SAE, ...
}

export function wifiQrPayload(ssid: string, password: string, authMode: string, hidden: boolean): string {
  const type = qrSecurityType(authMode);
  const pass = type === 'nopass' ? '' : `P:${escapeField(password)};`;
  return `WIFI:T:${type};S:${escapeField(ssid)};${pass}${hidden ? 'H:true;' : ''};`;
}
