import { api } from "@/lib/api";
import type { ApiResponse, Pagination } from "@/lib/api";

export interface CountRow { label: string; count: number }
export interface Overview {
  days: 7 | 30 | 90;
  generatedAt: string;
  trackingStartedAt: string | null;
  timezone: string;
  users: {
    total: number; emailVerified: number; emailVerifiedPercent: number;
    kycVerified: number; kycVerifiedPercent: number;
    newToday: number; new7: number; new30: number;
    dau: number; wau: number; mau: number;
    profiles: { ages: CountRow[]; ageUnknown: number; professions: CountRow[]; countries: CountRow[]; accountCounts: { label: string; users: number }[] };
  };
  accounts: { active: number; bankLinkedUsers: number; bankLinkedPercent: number; banks: { bank: string; users: number; accounts: number }[] };
  alerts: { today: number; last7: number; last30: number; risk: { _id: string; count: number }[]; falsePositive: number; reviewed: number; falsePositiveRate: number; averageResponseMs: number | null; responseSampleCount: number };
  panics: { today: number; open: number; byType: CountRow[] };
  cases: { open: number; resolved: number };
  protectiveActions: number;
  verification: { usage: { _id: string; count: number }[]; sources: { _id: string; count: number }[] };
  learning: { started: number; completed: number; incomplete: number; averageDurationMs: number | null; additionalQuestionUsers: number; popular: { _id: string; title: string; users: number; attempts: number }[]; attempts: number };
  availability: { service: string; samples: number; percent: number; lastCheckedAt: string }[];
  trends: { date: string; newUsers: number; activeUsers: number; alerts: number; panics: number; protective: number; resolvedCases: number; confirmed: number }[];
}

export interface HealthReport {
  generatedAt: string;
  services: { service: string; samples: number; uptime: number; available: boolean; checkedAt: string; latencyMs: number }[];
  trends: { service: string; date: string; uptime: number }[];
  measurement: string;
}

export interface AdminIdentity { id: string; adminRole: string; permissions: string[] }
export interface OperationalList<T> { items: T[]; pagination: Pagination }
export interface OperationalUser { _id: string; name?: string; email?: string; userId?: string }
export interface AlertItem { _id: string; title: string; type: string; severity: string; status: string; verdict: string; source: string; createdAt: string; firstActionAt?: string; resolvedAt?: string; resolution?: string; user?: OperationalUser }
export interface CaseItem { _id: string; title: string; severity: string; status: string; createdAt: string; resolvedAt?: string; resolution?: string; user?: OperationalUser; assignedTo?: OperationalUser }
export interface AccountItem { _id: string; bankName: string; accountType: string; nickname: string; isLocked: boolean; lockedReason?: string; createdAt: string; user?: OperationalUser }
export interface EventItem { _id: string; kind: string; tool?: string; source?: string; outcome?: string; occurredAt: string; user?: OperationalUser }

export const getOperationalOverview = (days: 7 | 30 | 90) => api.get<ApiResponse<Overview>>( "/admin/dashboard/overview", { params: { days } }).then(response => response.data.data);
export const getHealthReport = (days: 7 | 30 | 90) => api.get<ApiResponse<HealthReport>>("/admin/health", { params: { days } }).then(response => response.data.data);
export const getAdminIdentity = () => api.get<ApiResponse<AdminIdentity>>("/admin/me").then(response => response.data.data);
export const getOperationalList = <T>(section: "alerts" | "cases" | "accounts" | "events", params: Record<string, string | number | undefined>) => api.get<ApiResponse<OperationalList<T>>>(`/admin/${section}`, { params }).then(response => response.data.data);
export const updateAlert = (id: string, payload: { status: string; verdict: string; reason: string; resolution?: string }) => api.patch<ApiResponse<AlertItem>>(`/admin/alerts/${id}`, payload).then(response => response.data.data);
export const updateCase = (id: string, payload: { status: string; reason: string; resolution?: string; note?: string }) => api.patch<ApiResponse<CaseItem>>(`/admin/cases/${id}`, payload).then(response => response.data.data);

export const hasPermission = (identity: AdminIdentity | undefined, permission: string) => Boolean(identity?.permissions.includes("*") || identity?.permissions.includes(permission));
