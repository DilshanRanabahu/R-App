import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

/** This phone's address on the Wi-Fi, used to mark "This phone" in device lists. */
export function usePhoneIp(): string | null {
  const [ip, setIp] = useState<string | null>(null);
  useEffect(() => {
    Network.getIpAddressAsync()
      .then(setIp)
      .catch(() => setIp(null));
  }, []);
  return ip;
}
