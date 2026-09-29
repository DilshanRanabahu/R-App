import { routerClient } from '../client';
import type {
  ConnectionState,
  ConvergedStatusRaw,
  DataPlan,
  MonitoringStatusRaw,
  MonthStatisticsRaw,
  MonthUsage,
  RouterStatus,
  StartDateRaw,
  TrafficStatisticsRaw,
  TrafficStats,
} from '../types';
import { toByteLimit, toLocalDate, toNumber } from './parse';

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

// Both readable without login on the B312-926 (verified 2026-09-29).
export async function getMonthUsage(): Promise<MonthUsage> {
  const r = await routerClient.get<MonthStatisticsRaw>('/api/monitoring/month_statistics');
  return {
    download: toNumber(r.CurrentMonthDownload),
    upload: toNumber(r.CurrentMonthUpload),
    today: toNumber(r.CurrentDayUsed),
    lastCleared: toLocalDate(r.MonthLastClearTime),
  };
}

export async function getDataPlan(): Promise<DataPlan> {
  const r = await routerClient.get<StartDateRaw>('/api/monitoring/start_date');
  const day = toNumber(r.StartDay, 1);
  const limit = toByteLimit(r.DataLimit);
  return {
    startDay: day >= 1 && day <= 31 ? day : 1,
    limitBytes: r.SetMonthData === '1' && limit > 0 ? limit : null,
  };
}
