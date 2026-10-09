"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Database, HeartPulse, ListChecks, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/page-title";
import { Pagination } from "@/components/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { apiError, formatDate } from "@/lib/utils";
import { getAdminIdentity, getHealthReport, getOperationalList, hasPermission, updateAlert, updateCase } from "@/lib/operations";
import type { AlertItem, CaseItem, AccountItem, EventItem } from "@/lib/operations";

type Tab = "alerts" | "cases" | "accounts" | "events" | "health";
type Item = AlertItem | CaseItem | AccountItem | EventItem;
const tabs: { id: Tab; label: string; permission: string; icon: typeof ShieldAlert }[] = [
  { id: "alerts", label: "Alerts", permission: "alerts:read", icon: ShieldAlert },
  { id: "cases", label: "Cases", permission: "cases:read", icon: ListChecks },
  { id: "accounts", label: "Linked accounts", permission: "accounts:read", icon: Database },
  { id: "events", label: "Events", permission: "events:read", icon: AlertTriangle },
  { id: "health", label: "Service health", permission: "health:read", icon: HeartPulse },
];
const label = (value?: string) => (value || "—").replaceAll("_", " ");
const userName = (item: { user?: { name?: string; userId?: string } }) => item.user?.name || item.user?.userId || "Not linked";

function ReviewDialog({ item, kind, onClose }: { item: AlertItem | CaseItem; kind: "alerts" | "cases"; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(item.status);
  const [verdict, setVerdict] = useState("verdict" in item ? item.verdict : "unreviewed");
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState(item.resolution || "");
  const mutation = useMutation<AlertItem | CaseItem, Error, void>({
    mutationFn: () => kind === "alerts"
      ? updateAlert(item._id, { status, verdict, reason: reason.trim(), resolution: status === "resolved" ? resolution.trim() : undefined })
      : updateCase(item._id, { status, reason: reason.trim(), resolution: status === "resolved" ? resolution.trim() : undefined }),
    onSuccess: () => {
      toast.success("Review saved");
      void queryClient.invalidateQueries({ queryKey: ["operations-list"] });
      void queryClient.invalidateQueries({ queryKey: ["operational-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-cases"] });
      onClose();
    },
    onError: error => toast.error(apiError(error)),
  });
  const canSave = reason.trim().length > 0 && (status !== "resolved" || resolution.trim().length > 0);
  return <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Review record" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-teal-700">{kind === "alerts" ? "Security alert" : "Support case"}</p><h2 className="mt-2 text-xl font-bold">{item.title}</h2></div><button type="button" onClick={onClose} aria-label="Close review" className="text-2xl text-slate-400">×</button></div>
      <p className="mt-2 text-sm text-slate-500">{userName(item)} · Created {formatDate(item.createdAt)}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Status<select value={status} onChange={event => setStatus(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="open">Open</option>{kind === "alerts" ? <option value="acknowledged">Acknowledged</option> : <option value="in_progress">In progress</option>}<option value="resolved">Resolved</option></select></label>
        {kind === "alerts" && <label className="text-sm font-medium text-slate-700">Verdict<select value={verdict} onChange={event => setVerdict(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="unreviewed">Unreviewed</option><option value="confirmed">Confirmed</option><option value="false_positive">False positive</option></select></label>}
      </div>
      <label className="mt-4 block text-sm font-medium text-slate-700">Reason for this action<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Record what you checked and why" /></label>
      {status === "resolved" && <label className="mt-4 block text-sm font-medium text-slate-700">How was it resolved?<textarea value={resolution} onChange={event => setResolution(event.target.value)} maxLength={2000} rows={3} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Describe the outcome" /></label>}
      <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" disabled={!canSave || mutation.isPending} onClick={() => mutation.mutate()} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{mutation.isPending ? "Saving..." : "Save review"}</button></div>
    </section>
  </div>;
}

function OperationsContent() {
  const router = useRouter();
  const search = useSearchParams();
  const rawTab = search.get("tab");
  const tab: Tab = tabs.some(row => row.id === rawTab) ? rawTab as Tab : "alerts";
  const status = search.get("status") || "";
  const group = search.get("group") || "";
  const severity = search.get("severity") || "";
  const kind = search.get("kind") || "";
  const page = Math.max(1, Number(search.get("page")) || 1);
  const [review, setReview] = useState<AlertItem | CaseItem | null>(null);
  const identity = useQuery({ queryKey: ["admin-identity"], queryFn: getAdminIdentity, staleTime: 300000 });
  const permitted = hasPermission(identity.data, tabs.find(row => row.id === tab)?.permission || "none");
  const list = useQuery({
    queryKey: ["operations-list", tab, page, status, group, severity, kind],
    queryFn: () => getOperationalList<Item>(tab as Exclude<Tab, "health">, { page, limit: 12, status: status || undefined, group: group || undefined, severity: severity || undefined, kind: kind || undefined }),
    enabled: Boolean(identity.data) && permitted && tab !== "health",
  });
  const health = useQuery({ queryKey: ["operations-health"], queryFn: () => getHealthReport(30), enabled: Boolean(identity.data) && permitted && tab === "health" });
  const canWrite = hasPermission(identity.data, tab === "alerts" ? "alerts:write" : "cases:write");
  const change = (values: Record<string, string>) => {
    const params = new URLSearchParams(search.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in values)) params.delete("page");
    router.push("/operations?" + params.toString());
  };

  return <div>
    <PageTitle>Operational records</PageTitle>
    <p className="mb-6 max-w-3xl text-sm leading-6 text-slate-600">Inspect the events behind dashboard metrics. Alerts and cases can be reviewed by authorised operators; every change requires a reason and is audited.</p>
    {identity.isLoading ? <Skeleton className="h-12 w-full"/> : <nav aria-label="Operational sections" className="mb-5 flex flex-wrap gap-2">{tabs.filter(row => hasPermission(identity.data, row.permission)).map(row => <button type="button" key={row.id} onClick={() => change({ tab: row.id, status: "", group: "", severity: "", kind: "" })} className={"inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold " + (tab === row.id ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}><row.icon size={17}/>{row.label}</button>)}</nav>}
    {identity.isError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">Unable to check access: {apiError(identity.error)}</div>}
    {identity.data && !permitted && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Your admin role cannot view this section. Select an available tab above.</div>}
    {permitted && tab !== "health" && <>
      <div className="mb-4 flex flex-wrap gap-3">
        {(tab === "alerts" || tab === "cases") && <label className="text-sm text-slate-600">Status<select aria-label="Filter status" value={status} onChange={event => change({ status: event.target.value })} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">All</option><option value="unresolved">Unresolved</option><option value="resolved">Resolved</option></select></label>}
        {tab === "alerts" && <><label className="text-sm text-slate-600">Severity<select aria-label="Filter severity" value={severity} onChange={event => change({ severity: event.target.value })} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">All</option><option value="critical">Critical</option><option value="high">High</option><option value="elevated">Elevated</option></select></label><label className="text-sm text-slate-600">Type<select aria-label="Filter alert type" value={group} onChange={event => change({ group: event.target.value })} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">All</option><option value="panic">Panic alerts</option></select></label></>}
        {tab === "events" && <label className="text-sm text-slate-600">Event<select aria-label="Filter event kind" value={kind} onChange={event => change({ kind: event.target.value })} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">All</option><option value="panic">Panic</option><option value="protective_action">Protective action</option><option value="verification_lookup">Verification lookup</option><option value="learning_completed">Quiz submitted</option></select></label>}
        <button type="button" onClick={() => void list.refetch()} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Refresh</button>
      </div>
      {list.isError ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">Could not load records: {apiError(list.error)}</div> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Record</th><th className="px-5 py-4">User / source</th><th className="px-5 py-4">State / outcome</th><th className="px-5 py-4">Date</th><th className="px-5 py-4">Details</th></tr></thead>
          <tbody>{list.isLoading ? Array.from({ length: 6 }, (_, index) => <tr key={index}><td colSpan={5} className="p-4"><Skeleton className="h-10"/></td></tr>) : list.data?.items.length ? list.data.items.map(raw => {
            const alert = tab === "alerts" ? raw as AlertItem : null;
            const supportCase = tab === "cases" ? raw as CaseItem : null;
            const account = tab === "accounts" ? raw as AccountItem : null;
            const event = tab === "events" ? raw as EventItem : null;
            return <tr key={raw._id} className="border-b align-top last:border-0">
              <td className="px-5 py-4 font-semibold text-slate-900">{alert?.title || supportCase?.title || account?.bankName || label(event?.kind)}<small className="mt-1 block font-normal text-slate-500">{alert ? label(alert.type) : supportCase ? label(supportCase.severity) : account ? label(account.accountType) : label(event?.tool)}</small></td>
              <td className="px-5 py-4 text-slate-600">{event ? event.source || "—" : userName(raw as AlertItem | CaseItem | AccountItem)}</td>
              <td className="px-5 py-4 capitalize text-slate-700">{alert ? label(alert.status) + " · " + label(alert.verdict) : supportCase ? label(supportCase.status) : account ? account.isLocked ? "Locked" : "Active" : label(event?.outcome)}</td>
              <td className="px-5 py-4 text-slate-500">{formatDate(event ? event.occurredAt : (raw as AlertItem | CaseItem | AccountItem).createdAt)}</td>
              <td className="px-5 py-4 text-slate-600">{alert || supportCase ? <>{(alert || supportCase)?.resolution && <p className="mb-2 max-w-xs">{(alert || supportCase)?.resolution}</p>}{canWrite && <button type="button" onClick={() => setReview((alert || supportCase) as AlertItem | CaseItem)} className="font-semibold text-teal-700 underline">Review</button>}</> : account ? account.isLocked ? account.lockedReason || "Restricted" : "—" : "—"}</td>
            </tr>;
          }) : <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">No records match these filters.</td></tr>}</tbody></table>
      </div>}
      {list.data && <Pagination page={list.data.pagination.page} totalPages={list.data.pagination.totalPages} total={list.data.pagination.total} limit={list.data.pagination.limit} onPage={value => change({ page: String(value) })}/>}
    </>}
    {permitted && tab === "health" && <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold">Monitored services</h2><p className="mt-1 text-sm text-slate-500">In-process samples cannot observe backend downtime. Use an external monitor for measured uptime.</p>{health.isLoading ? <Skeleton className="mt-5 h-40"/> : health.isError ? <p className="mt-5 text-rose-700">{apiError(health.error)}</p> : health.data?.services.length ? <div className="mt-5 grid gap-4 md:grid-cols-2">{health.data.services.map(service => <div key={service.service} className="rounded-xl border p-5"><div className="flex items-center justify-between"><strong className="capitalize">{service.service}</strong>{service.available ? <CheckCircle2 className="text-teal-700"/> : <AlertTriangle className="text-rose-700"/>}</div><p className="mt-3 text-3xl font-bold">{service.uptime}%</p><p className="mt-1 text-xs text-slate-500">Healthy samples · {service.samples} checks · last {formatDate(service.checkedAt)}</p></div>)}</div> : <p className="mt-5 text-slate-500">No samples in the past 30 days.</p>}</div>}
    {review && <ReviewDialog key={review._id} item={review} kind={tab === "alerts" ? "alerts" : "cases"} onClose={() => setReview(null)}/>}
  </div>;
}

export default function OperationsPage() {
  return <Suspense fallback={<Skeleton className="h-64 rounded-2xl"/>}><OperationsContent/></Suspense>;
}
