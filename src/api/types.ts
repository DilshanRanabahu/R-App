// Raw HiLink responses: every leaf is a string (parseTagValue is off).

export interface BasicInformationRaw {
  devicename?: string;
  spreadname_en?: string; // marketing name, e.g. "HUAWEI 4G Router 2s"
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

export interface MonthStatisticsRaw {
  CurrentMonthDownload?: string;
  CurrentMonthUpload?: string;
  MonthDuration?: string;
  MonthLastClearTime?: string; // YYYY-MM-DD
  CurrentDayUsed?: string;
  CurrentDayDuration?: string;
}

export interface StartDateRaw {
  StartDay?: string;
  DataLimit?: string; // "60GB", "500MB", "0MB"
  MonthThreshold?: string;
  SetMonthData?: string; // 1 = plan enabled
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
  SoftwareVersion?: string;
  uptime?: string; // seconds since the router started
}

/** The only parts of device/information the UI keeps (no IMEI/IMSI/serial/MAC). */
export interface RouterDetails {
  firmware: string | null;
  uptimeSeconds: number | null;
}

export interface PublicKeyRaw {
  encpubkeyn?: string;
  encpubkeye?: string;
}

/** One entry of wlan/multi-basic-settings (all strings; many more fields exist). */
export interface WifiSsidRaw {
  Index?: string;
  ID?: string; // e.g. InternetGatewayDevice.X_Config.Wifi.Radio.1.Ssid.1.
  WifiSsid?: string;
  WifiEnable?: string;
  WifiBroadcast?: string; // 0 = visible, 1 = hidden
  WifiAuthmode?: string; // WPA2-PSK, OPEN, ...
  wifiisguestnetwork?: string;
  WifiWpapsk?: string; // only filled in the decrypted user/pwd reply
  [key: string]: string | undefined;
}

export interface WifiBasicRaw {
  Ssids?: { Ssid?: WifiSsidRaw | WifiSsidRaw[] } | '';
}

export interface SecretReplyRaw {
  pwd?: string;
  hash?: string;
  iter?: string;
}

// Parsed models used by the app.

export interface LoginState {
  loggedIn: boolean;
  passwordType: string;
  locked: boolean;
  waitSeconds: number;
  firstLogin: boolean;
  /** RSA padding the router expects for encrypted requests (rsapadingtype 1 = OAEP). */
  rsaPadding: 'oaep' | 'pkcs1';
}

export interface MonthUsage {
  download: number; // bytes this month
  upload: number;
  today: number; // bytes today
  /** Local date the router last reset its counters, or null. */
  lastCleared: Date | null;
}

export interface DataPlan {
  /** Day of month the usage resets (1–31). */
  startDay: number;
  /** Monthly allowance in bytes, or null when no plan is set on the router. */
  limitBytes: number | null;
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

/** The main (non-guest) Wi-Fi network. */
export interface WifiNetwork {
  ssid: string;
  enabled: boolean;
  hidden: boolean;
  security: string; // WifiAuthmode, e.g. WPA2-PSK
}
