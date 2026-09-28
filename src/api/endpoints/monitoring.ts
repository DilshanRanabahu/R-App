import { routerClient } from '../client';
import type {
  ConnectionState,
  ConvergedStatusRaw,
  MonitoringStatusRaw,
  RouterStatus,
  TrafficStatisticsRaw,
  TrafficStats,
} from '../types';
import { toNumber } from './parse';

export async function getTrafficStatistics(): Promise<TrafficStats> {
  const r = await routerClient.get<TrafficStatisticsRaw>('/api/monitoring/traffic-statistics');
  return {
    connectSeconds: toNumber(r.CurrentConnectTime),
    sessionUpload: toNumber(r.CurrentUpload),
    sessionDownload: toNumber(r.CurrentDownload),
    downloadRate: toNumber(r.CurrentDownloadRate),
    uploadRate: toNumber(r.CurrentUploadRate),
    totalUpload: toNumber(r.TotalUpload),
    totalDownload: toNumber(r.TotalDownload),
  };
}

const CONNECTION: Record<string, ConnectionState> = {
  '900': 'connecting',
  '901': 'connected',
  '902': 'disconnected',
  '903': 'disconnected',
};

export async function getStatus(): Promise<RouterStatus> {
  const r = await routerClient.get<MonitoringStatusRaw>('/api/monitoring/status');
  return {
    connection: CONNECTION[r.ConnectionStatus ?? ''] ?? 'unknown',
    wifiUsers: toNumber(r.CurrentWifiUser),
  };
}

// 257 = SIM ready on HiLink firmware.
export async function getSimReady(): Promise<boolean> {
  const r = await routerClient.get<ConvergedStatusRaw>('/api/monitoring/converged-status');
  return r.SimState === '257';
}
