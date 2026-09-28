// Raw HiLink responses: every leaf is a string (parseTagValue is off).

export interface BasicInformationRaw {
  devicename?: string;
  productfamily?: string;
  classify?: string;
}

export interface LoginStateRaw {
  State?: string; // 0 = logged in, -1 = logged out
  password_type?: string;
  lockstatus?: string;
  remainwaittime?: string;
  firstlogin?: string;
  rsapadingtype?: string;
  username?: string;
}

export interface TrafficStatisticsRaw {
  CurrentConnectTime?: string;
  CurrentUpload?: string;
  CurrentDownload?: string;
  CurrentDownloadRate?: string;
  CurrentUploadRate?: string;
  TotalUpload?: string;
  TotalDownload?: string;
  TotalConnectTime?: string;
}

export interface CurrentPlmnRaw {
  State?: string;
  FullName?: string;
  ShortName?: string;
  Numeric?: string;
  Rat?: string;
}

export interface ConvergedStatusRaw {
  SimState?: string;
}

export interface MonitoringStatusRaw {
  ConnectionStatus?: string;
  SignalIcon?: string;
  CurrentNetworkType?: string;
  CurrentWifiUser?: string;
  WanIPAddress?: string;
}

export interface SignalRaw {
  rsrp?: string;
  rsrq?: string;
  sinr?: string;
  rssi?: string;
  pci?: string;
  cell_id?: string;
  band?: string;
}

export interface HostRaw {
  MacAddress?: string;
  IpAddress?: string;
  HostName?: string;
  AssociatedTime?: string;
}

export interface HostListRaw {
  Hosts?: { Host?: HostRaw | HostRaw[] } | '';
}

/** lan/HostInfo: all clients, Wi-Fi and Ethernet. Field names vary by firmware. */
export interface LanHostRaw extends HostRaw {
  ActualName?: string;
  InterfaceType?: string; // "Ethernet" | "Wireless" | ...
  Active?: string; // "1" = connected now
}

export interface LanHostInfoRaw {
  Hosts?: { Host?: LanHostRaw | LanHostRaw[] } | '';
}

export interface DeviceInformationRaw {
  DeviceName?: string;
  SerialNumber?: string;
  MacAddress1?: string;
}

export interface PublicKeyRaw {
  encpubkeyn?: string;
  encpubkeye?: string;
}

// Parsed models used by the app.

export interface LoginState {
  loggedIn: boolean;
  passwordType: string;
  locked: boolean;
  waitSeconds: number;
  firstLogin: boolean;
}

export interface TrafficStats {
  connectSeconds: number;
  sessionUpload: number;
  sessionDownload: number;
  downloadRate: number; // bytes per second
  uploadRate: number; // bytes per second
  totalUpload: number;
  totalDownload: number;
}

export type NetworkGeneration = '4G' | '3G' | '2G' | 'Unknown';

export interface Operator {
  name: string;
  generation: NetworkGeneration;
}

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'unknown';

export interface RouterStatus {
  connection: ConnectionState;
  wifiUsers: number;
}

export interface Signal {
  rsrp: number | null;
  rsrq: number | null;
  sinr: number | null;
  rssi: number | null;
  pci: string;
  cellId: string;
  band: string;
}

export type HostConnection = 'wifi' | 'cable' | 'unknown';

export interface Host {
  mac: string;
  ip: string;
  name: string;
  connectedSeconds: number;
  connection: HostConnection;
}
