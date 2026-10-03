import { getHosts } from '../endpoints/wlan';
import { RouterError } from '../errors';

// Fake devices only (AGENTS.md §9).
const mockGet = jest.fn();
jest.mock('../client', () => ({ routerClient: { get: (path: string) => mockGet(path) } }));

const wifiPhone = { MacAddress: 'aa:aa:aa:aa:aa:01', IpAddress: '192.168.8.100', HostName: 'phone', AssociatedTime: '60' };
const lanPhone = { ...wifiPhone, HostName: 'phone', InterfaceType: 'Wireless', Active: '1' };
const lanLaptop = { MacAddress: 'aa:aa:aa:aa:aa:02', IpAddress: '192.168.8.102', HostName: 'laptop', InterfaceType: 'Ethernet', Active: '1' };
const lanGone = { MacAddress: 'aa:aa:aa:aa:aa:03', IpAddress: '192.168.8.103', HostName: 'old', Active: '0' };

function respond(wifi: object[], lan: object[] | Error) {
  mockGet.mockImplementation(async (path: string) => {
    if (path === '/api/wlan/host-list') return { Hosts: { Host: wifi } };
    if (lan instanceof Error) throw lan;
    return { Hosts: { Host: lan } };
  });
}

describe('getHosts', () => {
  it('includes cable devices from lan/HostInfo, merged by MAC', async () => {
    respond([wifiPhone], [lanPhone, lanLaptop, lanGone]);
    const hosts = (await getHosts()).filter((h) => h.active);
    expect(hosts.map((h) => [h.name, h.connection])).toEqual([
      ['phone', 'wifi'],
      ['laptop', 'cable'],
    ]);
  });

  it('keeps devices that have left, marked as not active', async () => {
    respond([wifiPhone], [lanPhone, lanGone]);
    const gone = (await getHosts()).find((h) => h.name === 'old');
    // Not in the Wi-Fi list any more, but that doesn't make it a cable device.
    expect(gone).toMatchObject({ active: false, connection: 'unknown', mac: 'AA:AA:AA:AA:AA:03' });
  });

  it('reads the Wi-Fi band, address type and the router\'s "this is you" mark', async () => {
    respond(
      [{ ...wifiPhone, Frequency: '2.4GHz' }],
      [{ ...lanPhone, AddressSource: 'DHCP', isLocalDevice: '1' }, { ...lanLaptop, AddressSource: 'Static', isLocalDevice: '0' }],
    );
    const [phone, laptop] = await getHosts();
    expect(phone).toMatchObject({ band: '2.4 GHz', addressSource: 'automatic', self: true });
    expect(laptop).toMatchObject({ addressSource: 'fixed' });
    expect(laptop?.self).toBeUndefined();
    expect(laptop?.band).toBeUndefined();
  });

  it('treats unknown-type LAN-only devices as cable', async () => {
    respond([wifiPhone], [{ ...lanLaptop, InterfaceType: undefined }]);
    const laptop = (await getHosts()).find((h) => h.name === 'laptop');
    expect(laptop?.connection).toBe('cable');
  });

  it('falls back to Wi-Fi only when lan/HostInfo is not supported', async () => {
    respond([wifiPhone], new RouterError('not_supported', '100002'));
    expect((await getHosts()).map((h) => h.name)).toEqual(['phone']);
  });

  it('still fails on login errors', async () => {
    respond([wifiPhone], new RouterError('login_required', '100003'));
    await expect(getHosts()).rejects.toMatchObject({ kind: 'login_required' });
  });
});
