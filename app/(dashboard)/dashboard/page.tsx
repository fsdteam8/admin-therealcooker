"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, CircleAlert, Clock3, Database, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTitle } from "@/components/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { apiError, formatDate } from "@/lib/utils";
import { getAdminIdentity, getHealthReport, getOperationalList, getOperationalOverview, hasPermission } from "@/lib/operations";
import type { AlertItem, CaseItem } from "@/lib/operations";

type Days = 7 | 30 | 90;
const number = (value?: number) => new Intl.NumberFormat("en").format(value ?? 0);
const duration = (value?: number | null) => value == null ? "Not recorded" : value < 60000 ? Math.round(value / 1000) + " sec" : Math.round(value / 60000) + " min";
const severityColor: Record<string, string> = { critical: "text-rose-700", high: "text-amber-700", elevated: "text-sky-700" };

function Panel({ title, note, action, children }: { title: string; note?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">{title}</h2>{note && <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>}</div>
      {action}
    </div>
    {children}
  </section>;
}

function Metric({ label, value, detail, href, icon: Icon, urgent }: { label: string; value: string | number; detail: string; href?: string; icon: typeof Users; urgent?: boolean }) {
  const body = <div className={"h-full rounded-2xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm transition hover:shadow-md " + (urgent ? "border-l-rose-500" : "border-l-teal-600")}>
    <div className="flex items-start justify-between gap-2"><span className="text-sm font-semibold text-slate-600">{label}</span><Icon size={20} className="shrink-0 text-slate-400" /></div>
    <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{value}</p>
    <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    {href && <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-700">View records <ArrowRight size={13}/></span>}
  </div>;
  return href ? <Link href={href} className="block h-full focus-visible:rounded-2xl focus-visible:outline-2 focus-visible:outline-teal-600">{body}</Link> : body;
}

function Bars({ rows, keyName = "count", empty = "No records available" }: { rows: { label: string; count?: number; users?: number }[]; keyName?: "count" | "users"; empty?: string }) {
  const visible = rows.filter(row => (row[keyName] ?? 0) > 0);
  if (!visible.length) return <p className="py-8 text-center text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...visible.map(row => row[keyName] ?? 0));
  return <div className="space-y-3">{visible.map((row, index) =>
    <div key={row.label + index} className="grid grid-cols-[100px_1fr_36px] items-center gap-2 text-xs sm:grid-cols-[130px_1fr_44px]">
      <span className="truncate font-medium text-slate-700" title={row.label}>{row.label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{ width: Math.max(4, (row[keyName] ?? 0) / max * 100) + "%" }}/></div>
      <span className="text-right tabular-nums text-slate-600">{number(row[keyName])}</span>
    </div>)}</div>;
}

function TrendAxis() {
  return <><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tickFormatter={(date: string) => date.slice(5)} tick={{ fontSize: 11 }}/><YAxis allowDecimals={false} tick={{ fontSize: 11 }}/><Tooltip/><Legend/></>;
}

export default function DashboardPage() {
  const [days, setDays] = useState<Days>(30);
  const identity = useQuery({ queryKey: ["admin-identity"], queryFn: getAdminIdentity, staleTime: 300000 });
  const overview = useQuery({ queryKey: ["operational-overview", days], queryFn: () => getOperationalOverview(days), refetchInterval: 60000 });
  const canAlerts = hasPermission(identity.data, "alerts:read");
  const canCases = hasPermission(identity.data, "cases:read");
  const health = useQuery({ queryKey: ["operational-health", days], queryFn: () => getHealthReport(days), enabled: hasPermission(identity.data, "health:read"), refetchInterval: 60000 });
  const alerts = useQuery({ queryKey: ["dashboard-alerts"], queryFn: () => getOperationalList<AlertItem>("alerts", { page: 1, limit: 5, status: "unresolved" }), enabled: canAlerts, refetchInterval: 60000 });
  const cases = useQuery({ queryKey: ["dashboard-cases"], queryFn: () => getOperationalList<CaseItem>("cases", { page: 1, limit: 5, status: "unresolved" }), enabled: canCases, refetchInterval: 60000 });
  const s = overview.data;
  const highRisk = s?.alerts.risk.filter(row => row._id === "critical" || row._id === "high").reduce((sum, row) => sum + row.count, 0) ?? 0;
  const bankRows = s?.accounts.banks.map(row => ({ label: row.bank || "Unspecified", users: row.users })) ?? [];
  const usage = s?.verification.usage.map(row => ({ label: row._id === "phone" ? "Phone" : row._id, count: row.count })) ?? [];
  const sources = s?.verification.sources.map(row => ({ label: row._id, count: row.count })) ?? [];
  const healthTrends = Object.values((health.data?.trends ?? []).reduce<Record<string, Record<string, string | number>>>((daysByDate, row) => {
    (daysByDate[row.date] ??= { date: row.date })[row.service] = row.uptime;
    return daysByDate;
  }, {})).sort((left, right) => String(left.date).localeCompare(String(right.date)));
  const healthColors = ["#0f766e", "#b88727", "#be123c", "#2563eb", "#7c3aed"];

  return <div className="space-y-6">
    <PageTitle action={<div className="flex items-center gap-2">
      <div className="flex rounded-xl border border-slate-200 bg-white p-1" aria-label="Reporting period">{([7,30,90] as Days[]).map(value =>
        <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)} className={"rounded-lg px-3 py-2 text-sm font-semibold " + (days === value ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100")}>{value} days</button>)}</div>
      <button type="button" title="Refresh dashboard" aria-label="Refresh dashboard" onClick={() => { void overview.refetch(); void health.refetch(); void alerts.refetch(); void cases.refetch(); }} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"><RefreshCw size={18}/></button>
    </div>}>Operations overview</PageTitle>

    <div className="rounded-2xl bg-slate-900 p-5 text-white sm:flex sm:items-center sm:justify-between sm:p-6">
      <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-teal-300">MoneyKee control centre</p><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">Prioritise incidents, understand platform usage, and inspect the records behind each measure.</p></div>
      <div className="mt-4 text-xs text-slate-300 sm:mt-0 sm:text-right">{s ? <>Updated {new Date(s.generatedAt).toLocaleString()}<br/>Reporting timezone: {s.timezone}</> : "Loading snapshot..."}</div>
    </div>
    {overview.isError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">Operational data could not load: {apiError(overview.error)} <button onClick={() => void overview.refetch()} className="font-semibold underline">Retry</button></div>}
    {overview.isLoading && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-36 rounded-2xl"/>)}</div>}

    {s && <>
      <section><h2 className="mb-3 text-xs font-bold uppercase tracking-[.12em] text-slate-500">Needs attention</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="High + critical alerts" value={number(highRisk)} detail="Unresolved security alerts" urgent icon={ShieldAlert} href={canAlerts ? "/operations?tab=alerts&status=unresolved" : undefined}/>
        <Metric label="Open panic alerts" value={number(s.panics.open)} detail={number(s.panics.today) + " activations today"} urgent icon={CircleAlert} href={canAlerts ? "/operations?tab=alerts&status=unresolved&group=panic" : undefined}/>
        <Metric label="Open cases" value={number(s.cases.open)} detail={number(s.cases.resolved) + " resolved in the selected period"} urgent icon={Database} href={canCases ? "/operations?tab=cases&status=unresolved" : undefined}/>
        <Metric label="First response" value={duration(s.alerts.averageResponseMs)} detail={"Average of " + number(s.alerts.responseSampleCount) + " acted-on alerts"} icon={Clock3} href={canAlerts ? "/operations?tab=alerts" : undefined}/>
      </div></section>
      <section><h2 className="mb-3 text-xs font-bold uppercase tracking-[.12em] text-slate-500">People and accounts</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Metric label="Registered users" value={number(s.users.total)} detail={"+" + number(s.users.newToday) + " today · +" + number(s.users.new7) + " / 7d · +" + number(s.users.new30) + " / 30d"} icon={Users} href={hasPermission(identity.data, "users:read") ? "/users" : undefined}/>
        <Metric label="Active users" value={number(s.users.dau)} detail={"DAU · " + number(s.users.wau) + " WAU · " + number(s.users.mau) + " MAU"} icon={Activity}/>
        <Metric label="KYC verified" value={s.users.kycVerifiedPercent + "%"} detail={number(s.users.kycVerified) + " people · email verified " + s.users.emailVerifiedPercent + "%"} icon={Users}/>
        <Metric label="Users with bank entries" value={number(s.accounts.bankLinkedUsers)} detail={s.accounts.bankLinkedPercent + "% · manually linked records"} icon={Database} href={hasPermission(identity.data, "accounts:read") ? "/operations?tab=accounts" : undefined}/>
        <Metric label="Active account records" value={number(s.accounts.active)} detail="App records marked active, including wallets" icon={Database} href={hasPermission(identity.data, "accounts:read") ? "/operations?tab=accounts" : undefined}/>
        <Metric label="Protective actions" value={number(s.protectiveActions)} detail={"Recorded in " + days + " days"} icon={ShieldAlert} href={hasPermission(identity.data, "events:read") ? "/operations?tab=events&kind=protective_action" : undefined}/>
      </div></section>
      <section className="grid gap-5 2xl:grid-cols-2">
        <Panel title="User growth and activity" note="Daily new registrations and distinct active users, in UTC."><div className="h-72"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={s.trends}><defs><linearGradient id="userFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f766e" stopOpacity={.25}/><stop offset="100%" stopColor="#0f766e" stopOpacity={0}/></linearGradient></defs><TrendAxis/><Area name="Active users" type="monotone" dataKey="activeUsers" stroke="#0f766e" fill="url(#userFill)" strokeWidth={2}/><Line name="New users" type="monotone" dataKey="newUsers" stroke="#c58d2f" strokeWidth={2} dot={false}/></ComposedChart></ResponsiveContainer></div></Panel>
        <Panel title="Security events" note="Alerts generated, confirmed incidents, and panic activations per day." action={canAlerts ? <Link href="/operations?tab=alerts" className="text-sm font-semibold text-teal-700">Explore alerts →</Link> : undefined}><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={s.trends}><TrendAxis/><Bar name="Alerts" dataKey="alerts" fill="#e66b69"/><Bar name="Confirmed" dataKey="confirmed" fill="#9f1239"/><Bar name="Panics" dataKey="panics" fill="#d4a64a"/></BarChart></ResponsiveContainer></div></Panel>
        <Panel title="Response and resolution" note="Recorded protective actions and cases resolved each day." action={canCases ? <Link href="/operations?tab=cases" className="text-sm font-semibold text-teal-700">Explore cases →</Link> : undefined}><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={s.trends}><TrendAxis/><Line name="Protective actions" type="monotone" dataKey="protective" stroke="#0f766e" strokeWidth={2} dot={false}/><Line name="Cases resolved" type="monotone" dataKey="resolvedCases" stroke="#b88727" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div></Panel>
        <Panel title="Alert severity and review" note={number(s.alerts.today) + " alerts today · " + number(s.alerts.last7) + " in 7 days · " + number(s.alerts.last30) + " in 30 days"}><div className="grid grid-cols-3 gap-3">{["critical","high","elevated"].map(level => <div key={level} className="rounded-xl bg-slate-50 p-4 text-center"><div className={"text-3xl font-bold " + severityColor[level]}>{number(s.alerts.risk.find(row => row._id === level)?.count)}</div><div className="mt-2 text-sm capitalize text-slate-600">{level}</div></div>)}</div><p className="mt-5 border-t pt-4 text-sm text-slate-600">False positives: <strong>{number(s.alerts.falsePositive)}</strong> of {number(s.alerts.reviewed)} reviewed ({s.alerts.falsePositiveRate}%).</p><div className="mt-4 border-t pt-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Panic activations by type</p><Bars rows={s.panics.byType.map(row => ({ label: row.label.replaceAll("_", " "), count: row.count }))} empty="No recorded panic activations"/></div></Panel>
      </section>
      <section className="grid gap-5 2xl:grid-cols-3">
        <Panel title="Users by bank" note="Distinct users with active, manually linked bank records."><Bars rows={bankRows.slice(0,10)} keyName="users"/></Panel>
        <Panel title="Verify tool usage" note={"Lookups in the selected " + days + "-day period."}><Bars rows={usage}/><div className="mt-5 border-t pt-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Data source</p><Bars rows={sources}/></div></Panel>
        <Panel title="User profile coverage" note="Aggregated optional profile details."><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Age groups</p><Bars rows={s.users.profiles.ages}/><p className="mt-2 text-xs text-slate-500">Age unavailable for {number(s.users.profiles.ageUnknown)} users.</p><div className="mt-5 border-t pt-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Active accounts per user</p><Bars rows={s.users.profiles.accountCounts} keyName="users"/></div></Panel>
      </section>
      <section className="grid gap-5 2xl:grid-cols-2"><Panel title="Professions" note="Top values entered in user profiles."><Bars rows={s.users.profiles.professions}/></Panel><Panel title="Geography" note="Top countries entered in user profiles."><Bars rows={s.users.profiles.countries}/></Panel></section>
      <section className="grid gap-5 2xl:grid-cols-2">
        <Panel title="Learning quizzes" note="All-time quiz opens and submissions; lesson reading is not yet tracked." action={hasPermission(identity.data, "learning:read") ? <Link href="/learning" className="text-sm font-semibold text-teal-700">Open learning →</Link> : undefined}><div className="grid grid-cols-3 gap-3 text-center">{[{ label: "Started", value: s.learning.started }, { label: "Submitted", value: s.learning.completed }, { label: "Incomplete", value: s.learning.incomplete }].map(row => <div key={row.label} className="rounded-xl bg-teal-50 p-4"><div className="text-2xl font-bold text-teal-800">{number(row.value)}</div><div className="mt-1 text-xs text-slate-600">{row.label}</div></div>)}</div><p className="mt-5 text-sm text-slate-600">Average quiz time: <strong>{duration(s.learning.averageDurationMs)}</strong> · Repeat quiz users: <strong>{number(s.learning.additionalQuestionUsers)}</strong> · Attempts this period: <strong>{number(s.learning.attempts)}</strong></p><div className="mt-5 border-t pt-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Most attempted lessons</p><Bars rows={s.learning.popular.map(row => ({ label: row.title || "Untitled", count: row.users }))} empty="No quiz attempts in this period"/></div></Panel>
        <Panel title="Service health samples" note="Checks observed while the backend runs; not an external uptime guarantee." action={hasPermission(identity.data, "health:read") ? <Link href="/operations?tab=health" className="text-sm font-semibold text-teal-700">Health details →</Link> : undefined}>{health.isLoading ? <Skeleton className="h-56"/> : health.isError ? <p className="text-sm text-rose-700">{apiError(health.error)}</p> : health.data?.services.length ? <><div className="space-y-3">{health.data.services.map(service => <div key={service.service} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"><span className="font-medium capitalize">{service.service}</span><span className="text-right"><b className={service.available ? "text-teal-700" : "text-rose-700"}>{service.uptime}% healthy</b><small className="block text-slate-500">{number(service.samples)} samples · last {formatDate(service.checkedAt)}</small></span></div>)}</div><div className="mt-5 h-40"><ResponsiveContainer width="100%" height="100%"><LineChart data={healthTrends}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tickFormatter={(date: string) => date.slice(5)} tick={{ fontSize: 11 }}/><YAxis domain={[0,100]} tick={{ fontSize: 11 }}/><Tooltip/><Legend/>{health.data.services.map((service, index) => <Line key={service.service} name={service.service} dataKey={service.service} stroke={healthColors[index % healthColors.length]} strokeWidth={2} connectNulls dot={false}/>)}</LineChart></ResponsiveContainer></div></> : <p className="py-10 text-center text-sm text-slate-500">No health samples available.</p>}</Panel>
      </section>
      {(canAlerts || canCases) && <section className="grid gap-5 2xl:grid-cols-2">
        {canAlerts && <Panel title="Unresolved alerts" note="Most recent records requiring review." action={<Link href="/operations?tab=alerts&status=unresolved" className="text-sm font-semibold text-teal-700">See all →</Link>}>{alerts.isLoading ? <Skeleton className="h-40"/> : alerts.isError ? <p className="text-sm text-rose-700">{apiError(alerts.error)}</p> : alerts.data?.items.length ? <div className="divide-y">{alerts.data.items.map(alert => <Link key={alert._id} href="/operations?tab=alerts&status=unresolved" className="flex items-center justify-between gap-4 py-3 text-sm hover:text-teal-700"><span className="min-w-0"><strong className="block truncate">{alert.title}</strong><small className="text-slate-500">{alert.type.replaceAll("_"," ")} · {formatDate(alert.createdAt)}</small></span><span className="rounded-full bg-rose-50 px-2 py-1 text-xs capitalize text-rose-700">{alert.severity}</span></Link>)}</div> : <p className="py-8 text-center text-sm text-slate-500">No unresolved alerts.</p>}</Panel>}
        {canCases && <Panel title="Open cases" note="Current support and security workload." action={<Link href="/operations?tab=cases&status=unresolved" className="text-sm font-semibold text-teal-700">See all →</Link>}>{cases.isLoading ? <Skeleton className="h-40"/> : cases.isError ? <p className="text-sm text-rose-700">{apiError(cases.error)}</p> : cases.data?.items.length ? <div className="divide-y">{cases.data.items.map(item => <Link key={item._id} href="/operations?tab=cases&status=unresolved" className="flex items-center justify-between gap-4 py-3 text-sm hover:text-teal-700"><span className="min-w-0"><strong className="block truncate">{item.title}</strong><small className="text-slate-500">{item.user?.name || "No user linked"} · {formatDate(item.createdAt)}</small></span><span className="rounded-full bg-amber-50 px-2 py-1 text-xs capitalize text-amber-700">{item.status.replaceAll("_"," ")}</span></Link>)}</div> : <p className="py-8 text-center text-sm text-slate-500">No open cases.</p>}</Panel>}
      </section>}
      <p className="pb-4 text-xs leading-5 text-slate-500">Tracking began {s.trackingStartedAt ? formatDate(s.trackingStartedAt) : "when operational events were recorded"}. Earlier activity may be incomplete. Bank entries are user-entered and do not prove a live connection. Alert Security and Lock All Accounts are not yet sent by the mobile app.</p>
    </>}
  </div>;
}
