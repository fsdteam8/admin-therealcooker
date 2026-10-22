import { api } from "@/lib/api";
import type { ApiResponse, Pagination } from "@/lib/api";

export interface HealthReport {
  generatedAt: string;
  services: { service: string; samples: number; uptime: number; available: boolean; checkedAt: string; latencyMs: number }[];
  trends: { service: string; date: string; uptime: number }[];
  measurement: string;
}

export interface DashboardStatus {
  // Unresolved incidents: Critical SOS activations and Elevated Guardian Panic requests.
  incidents: { active: number; criticalSos: number; elevatedGuardianPanic: number };
  kycPending: number;
  systems: { operational: boolean | null; degraded: string[]; checkedAt: string | null };
}

export type ServiceState = "monitored" | "collecting" | "not_configured";
export interface ServiceStatus {
  service: string; label: string; state: ServiceState; method?: string; detail?: string; percent: number | null;
  samples?: number; lastCheckedAt?: string; healthyNow?: boolean; lastFailureAt?: string | null; lastError?: string | null;
  since?: string; minutes?: number; expectedMinutes?: number;
  traffic?: { attempts: number; accepted: number; failed: number; serviceErrors: number; lastSuccessAt: string | null; lastFailureAt: string | null; lastError: string | null } | null;
}
export type SearchType = "phone" | "account" | "email" | "website";
export type SearchOutcome = "verified" | "fraudulent" | "not_found";
export interface SearchStats { total: number; numbers: number; byType: Record<SearchType, number>; byOutcome: Record<SearchOutcome, number>; flagRate: number | null; share: Record<SearchOutcome, number | null> }
export interface GuardianAlertStats { total: number; fromSos: number; fromGuardianPanic: number; push: { trackedSince: string | null; attempts: number; accepted: number; failed: number; noDevice: number } }
// Counted per user per module: completed once the quiz is submitted, otherwise not completed.
export interface LearningOverview { opened: number; completed: number; notCompleted: number; completionRate: number | null; mostPopular: { title: string | null; completions: number; opens: number } | null; openTrackingSince: string | null }
export interface IncidentActivity { total: number; criticalSos: number; elevatedGuardianPanic: number; resolved: number; averageResolutionMs: number | null; averageFirstActionMs: number | null }

// Percentages and averages are null when there is nothing to measure, which is distinct from a real zero.
export interface ExecutiveDashboard {
  generatedAt: string;
  timezone: string;
  periods: Record<"week" | "month", { start: string; label: string }>;
  status: DashboardStatus;
  snapshot: { totalUsers: number; newThisWeek: number; activeToday: number; activeThisMonth: number; verifiedUsers: number; verifiedPercent: number | null; linkedAccountUsers: number; linkedAccountPercent: number | null };
  security: { fraudAlerts: { today: number; week: number; month: number } };
  panics: { criticalSosToday: number; guardianPanicsToday: number; resolvedToday: number; open: number; guardianAlertsToday: GuardianAlertStats };
  feed: { id: string; type: string; classification: string; title: string; status: string; createdAt: string; userId: string | null; bankName: string | null; lockedAccounts: number | null; locationShared: boolean | null }[] | null;
  services: ServiceStatus[];
  verifier: SearchStats;
  learning: LearningOverview;
  trend: { date: string; activeUsers: number; alerts: number; panics: number }[];
  kyc: { pending: number; verified: number; rejected: number; recent: { id: string; name: string | null; userId: string | null; status: string; submittedAt: string | null }[] | null };
  banks: { connectedUsers: number; rows: { bank: string; users: number; percent: number | null }[] };
}

export interface ServerSample {
  checkedAt: string;
  host: { cpuPercent: number | null; cores: number; loadAverage: number | null; memoryTotal: number; memoryFree: number; uptimeSeconds: number };
  container: { memoryLimit: number; memoryUsage: number } | null;
  process: { cpuPercent: number | null; rss: number; heapUsed: number; uptimeSeconds: number };
  disk: { total: number; free: number } | null;
  gpus: { name: string; utilizationPercent: number; memoryUsed: number; memoryTotal: number }[] | null;
}
export interface DatabaseStats {
  provider: string; database: string; version: string | null;
  replicaSet: { name: string; members: number | null; writablePrimary: boolean } | null;
  dataSize: number; storageSize: number; indexSize: number; objects: number; collections: number;
  filesystem: { used: number; total: number } | null;
  connections: { current: number; available: number | null } | null;
  memory: { residentBytes: number } | null; memoryUnavailableReason: string | null; cpuUnavailableReason: string;
  checkedAt: string;
}
export interface Infrastructure {
  generatedAt: string;
  server: { environment: string; platform: string; arch: string; cores: number; nodeVersion: string; latest: ServerSample | null; trackingSince: string | null;
    series: { at: string; cpuPercent: number | null; memoryPercent: number | null; processCpuPercent: number | null }[];
    gpu: { status: "available" | "not_available" | "unknown"; gpus: { name: string; utilizationPercent: number; memoryUsed: number; memoryTotal: number }[] } };
  database: DatabaseStats | null;
  databaseError: string | null;
}

export type ReportPeriod = "week" | "month";
export interface PeriodInfo { period: ReportPeriod; label: string; startDate: string; lastDate: string; start: string; end: string; through: string; isCurrent: boolean }
export interface UserActivity { active: number; new: number; kycSubmitted: number; kycCompleted: number; accountsLinked: { bank: number; wallet: number } }
export interface AlertQuality { reviewed: number; falsePositive: number; rate: number | null; averageResponseMs: number | null; responded: number }
export interface AnalyticsReport {
  generatedAt: string; timezone: string; period: PeriodInfo; previous: PeriodInfo;
  incidents: { activeNow: DashboardStatus["incidents"]; period: IncidentActivity; previous: IncidentActivity };
  guardianAlerts: { period: GuardianAlertStats; previous: GuardianAlertStats };
  alerts: { fraud: { period: number; previous: number; byType: { type: string; count: number }[]; bySeverity: { severity: string; count: number }[] }; quality: { period: AlertQuality; previous: AlertQuality } };
  searches: { period: SearchStats; previous: SearchStats };
  users: { period: UserActivity; previous: UserActivity };
  learning: LearningOverview;
  daily: { date: string; activeUsers: number; newUsers: number; incidents: number; fraudAlerts: number; searches: number }[];
  services: ServiceStatus[];
  server: { environment: string; platform: string; arch: string; cores: number; gpuStatus: string; period: { samples: number; since: string | null; averageCpuPercent?: number | null; peakCpuPercent?: number | null; averageMemoryPercent?: number | null; peakMemoryPercent?: number | null; averageProcessRss?: number | null } };
  database: DatabaseStats | null;
  limitations: string[];
}

export interface AdminIdentity { id: string; adminRole: string; permissions: string[] }
export interface OperationalList<T> { items: T[]; pagination: Pagination }
export interface OperationalUser { _id: string; name?: string; email?: string; userId?: string }
export interface AlertItem { _id: string; title: string; type: string; severity: string; status: string; verdict: string; source: string; createdAt: string; firstActionAt?: string; resolvedAt?: string; resolution?: string; user?: OperationalUser }
export interface CaseItem { _id: string; title: string; severity: string; status: string; createdAt: string; resolvedAt?: string; resolution?: string; user?: OperationalUser; assignedTo?: OperationalUser }
export interface AccountItem { _id: string; bankName: string; accountType: string; nickname: string; isLocked: boolean; lockedReason?: string; createdAt: string; user?: OperationalUser }
export interface EventItem { _id: string; kind: string; tool?: string; source?: string; outcome?: string; occurredAt: string; user?: OperationalUser }

export const getDashboardStatus = () => api.get<ApiResponse<DashboardStatus>>("/admin/dashboard/status").then(response => response.data.data);
export const getExecutiveDashboard = () => api.get<ApiResponse<ExecutiveDashboard>>("/admin/dashboard/executive").then(response => response.data.data);
export const getInfrastructure = () => api.get<ApiResponse<Infrastructure>>("/admin/health/infrastructure").then(response => response.data.data);
export const getAnalyticsReport = (period: ReportPeriod, date?: string) => api.get<ApiResponse<AnalyticsReport>>("/admin/analytics/report", { params: { period, date } }).then(response => response.data.data);
// Downloads the server-rendered PDF of the same report and saves it under the server's file name.
export async function downloadAnalyticsPdf(period: ReportPeriod, date?: string) {
  const response = await api.get<Blob>("/admin/analytics/report.pdf", { params: { period, date }, responseType: "blob", timeout: 60000 });
  const name = /filename="([^"]+)"/.exec(String(response.headers["content-disposition"] || ""))?.[1] || `moneykee-analytics-${period}.pdf`;
  const url = URL.createObjectURL(response.data);
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return name;
}
export const getHealthReport = (days: 7 | 30 | 90) => api.get<ApiResponse<HealthReport>>("/admin/health", { params: { days } }).then(response => response.data.data);
export const getAdminIdentity = () => api.get<ApiResponse<AdminIdentity>>("/admin/me").then(response => response.data.data);
export const getOperationalList = <T>(section: "alerts" | "cases" | "accounts" | "events", params: Record<string, string | number | undefined>) => api.get<ApiResponse<OperationalList<T>>>(`/admin/${section}`, { params }).then(response => response.data.data);
export const updateAlert = (id: string, payload: { status: string; verdict: string; reason: string; resolution?: string }) => api.patch<ApiResponse<AlertItem>>(`/admin/alerts/${id}`, payload).then(response => response.data.data);
export const updateCase = (id: string, payload: { status: string; reason: string; resolution?: string; note?: string }) => api.patch<ApiResponse<CaseItem>>(`/admin/cases/${id}`, payload).then(response => response.data.data);

export const hasPermission = (identity: AdminIdentity | undefined, permission: string) => Boolean(identity?.permissions.includes("*") || identity?.permissions.includes(permission));
