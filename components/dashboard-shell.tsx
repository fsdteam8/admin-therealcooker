"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Bell, ChartColumn, ChartLine, FileDown, CreditCard, Database, FileText, FolderOpen, GraduationCap, IdCard, Landmark, LayoutGrid, Link2, Lock, LogOut, Menu, MessageSquareText, Newspaper, RefreshCw, ScrollText, ShieldAlert, TriangleAlert, UserCog, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutSession } from "@/lib/client-auth";
import { getDashboardStatus, type DashboardStatus } from "@/lib/operations";
import { cn } from "@/lib/utils";
import { useAdminAccess } from "@/components/admin-access";

type IconType = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
interface NavItem { href: string; label: string; icon: IconType; permission?: string; badge?: (status: DashboardStatus) => number }

function SosIcon({ className }: { className?: string }) {
  return <span aria-hidden className={cn("inline-flex w-[18px] justify-center text-[9px] font-extrabold tracking-tight", className)}>SOS</span>;
}

const groups: { title: string; items: NavItem[] }[] = [
  { title: "Operations", items: [
    { href: "/dashboard", label: "Overview", icon: LayoutGrid },
    // Incidents are the unresolved Critical SOS and Elevated Guardian Panic events; Panic events is their full history.
    { href: "/alerts?group=panic&status=unresolved", label: "Incidents", icon: ShieldAlert, permission: "alerts:read", badge: status => status.incidents.active },
    { href: "/alerts?group=panic", label: "Panic events", icon: SosIcon, permission: "alerts:read" },
    { href: "/alerts", label: "Alerts", icon: Bell, permission: "alerts:read" },
    { href: "/cases", label: "Cases", icon: FolderOpen, permission: "cases:read" },
  ] },
  { title: "Users", items: [
    { href: "/users", label: "All users", icon: Users, permission: "users:read" },
    { href: "/users?kyc=pending", label: "KYC queue", icon: IdCard, permission: "users:read", badge: status => status.kycPending },
    { href: "/guardians", label: "Pairings", icon: Link2, permission: "users:read" },
    { href: "/accounts", label: "Linked accounts", icon: CreditCard, permission: "accounts:read" },
  ] },
  { title: "Tools", items: [
    { href: "/verification", label: "Verifier DB", icon: Database, permission: "verification:read" },
    { href: "/verification/feedback", label: "Feedback & votes", icon: MessageSquareText, permission: "verification:read", badge: status => status.feedbackReview },
    { href: "/learning", label: "Learning tool", icon: GraduationCap, permission: "learning:read" },
    { href: "/banks", label: "Bank catalog", icon: Landmark },
    { href: "/news", label: "News feed", icon: Newspaper, permission: "content:read" },
    { href: "/terms", label: "Terms & conditions", icon: FileText, permission: "content:read" },
  ] },
  { title: "Reports", items: [
    { href: "/analytics", label: "Analytics", icon: ChartLine, permission: "overview:read" },
    { href: "/analytics?export=1", label: "Export", icon: FileDown, permission: "overview:read" },
    { href: "/operations", label: "Operational records", icon: ChartColumn },
    { href: "/events", label: "Operational events", icon: ScrollText, permission: "events:read" },
    { href: "/health", label: "Platform health", icon: Activity, permission: "health:read" },
    { href: "/audit", label: "Audit log", icon: Lock, permission: "audit:read" },
    { href: "/staff", label: "Admin permissions", icon: UserCog, permission: "staff:write" },
  ] },
];
const names: Record<string, string> = { dashboard: "Executive overview", analytics: "Analytics", operations: "Operational records", users: "All users", banks: "Bank catalog", learning: "Learning tool", verification: "Verifier DB", news: "News feed", terms: "Terms & conditions", profile: "Profile", guardians: "Pairings", subscriptions: "Subscriptions", alerts: "Alerts", cases: "Cases", accounts: "Linked accounts", events: "Operational events", audit: "Audit log", health: "Platform health", staff: "Admin permissions" };
const permissionMap: Record<string, string> = { analytics: "overview:read", users: "users:read", learning: "learning:read", verification: "verification:read", news: "content:read", terms: "content:read", guardians: "users:read", subscriptions: "billing:read", alerts: "alerts:read", cases: "cases:read", accounts: "accounts:read", events: "events:read", audit: "audit:read", health: "health:read", staff: "staff:write" };

// The most specific item whose path and query parameters all match the current URL.
function useActiveItem(items: NavItem[]) {
  const path = usePathname();
  const params = useSearchParams();
  let best: { item: NavItem; score: number } | null = null;
  for (const item of items) {
    const url = new URL(item.href, "http://admin.local");
    if (url.pathname !== path || [...url.searchParams].some(([key, value]) => params.get(key) !== value)) continue;
    const score = [...url.searchParams].length;
    if (!best || score > best.score) best = { item, score };
  }
  return best?.item;
}

function Navigation({ visibleGroups, status, onNavigate }: { visibleGroups: typeof groups; status?: DashboardStatus; onNavigate: () => void }) {
  const active = useActiveItem(visibleGroups.flatMap(group => group.items));
  return <>{visibleGroups.map(group => <div key={group.title} className="mt-5 first:mt-3">
    <p className="px-6 pb-2 text-[12px] font-medium uppercase tracking-[.08em] text-[#77776f]">{group.title}</p>
    {group.items.map(item => {
      const Icon = item.icon; const count = status && item.badge ? item.badge(status) : 0; const isActive = active === item;
      return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={isActive ? "page" : undefined}
        className={cn("flex h-11 items-center gap-3 border-r-[3px] px-6 text-[15px] text-[#3b3b36] transition hover:bg-[#f2f1ec]", isActive ? "border-[#1d5fa7] bg-[#d9e8fa] font-medium text-[#1d5fa7] hover:bg-[#d9e8fa]" : "border-transparent")}>
        <Icon size={19} strokeWidth={1.75} className="shrink-0" /><span className="truncate">{item.label}</span>
        {count > 0 && <span className="ml-auto min-w-6 rounded-full bg-[#f9d9d9] px-2 py-0.5 text-center text-xs font-semibold text-[#a12b2b]">{count > 99 ? "99+" : count}</span>}
      </Link>;
    })}
  </div>)}</>;
}

function PageHeading({ fallback, items }: { fallback: string; items: NavItem[] }) {
  const active = useActiveItem(items);
  const path = usePathname();
  // Other pages render their own <h1>; only the dashboard uses the header as its page title.
  const Heading = path === "/dashboard" ? "h1" : "p";
  return <Heading className="truncate text-xl font-semibold text-[#1a1a17] sm:text-[26px]">{path === "/dashboard" ? names.dashboard : active?.label || fallback}</Heading>;
}

function SystemStatus({ status, canSeeIncidents }: { status?: DashboardStatus; canSeeIncidents: boolean }) {
  if (!status) return null;
  const { operational, degraded } = status.systems;
  const incidents = status.incidents.active;
  const pill = <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium", incidents ? "bg-[#f9d9d9] text-[#a12b2b]" : "bg-[#eceae4] text-[#55554e]")}>
    {incidents > 0 && <TriangleAlert size={15} />}{incidents ? `${incidents} active incident${incidents === 1 ? "" : "s"}` : "No active incidents"}
  </span>;
  return <div className="hidden items-center gap-4 md:flex">
    <span className={cn("flex items-center gap-2 text-sm font-medium", operational === true ? "text-[#1f7a1f]" : operational === false ? "text-[#a15c00]" : "text-[#77776f]")} title={status.systems.checkedAt ? `Last checked ${new Date(status.systems.checkedAt).toLocaleTimeString()}` : "No recent health samples"}>
      <span className={cn("size-2.5 rounded-full", operational === true ? "bg-[#2e8b2e]" : operational === false ? "bg-[#d98a00]" : "bg-[#b5b4ac]")} />
      {operational === true ? "All systems operational" : operational === false ? `Degraded: ${degraded.join(", ")}` : "Status unknown"}
    </span>
    {canSeeIncidents ? <Link href="/alerts?group=panic&status=unresolved">{pill}</Link> : pill}
  </div>;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const access = useAdminAccess();
  const path = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const fetching = useIsFetching();
  const { data, status: sessionStatus } = useSession();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const key = path.split("/")[1] || "dashboard";
  const status = useQuery({ queryKey: ["dashboard-status"], queryFn: getDashboardStatus, enabled: access.can("overview:read"), refetchInterval: 60_000 });
  const visibleGroups = groups.map(group => ({ ...group, items: group.items.filter(item => !item.permission || access.can(item.permission)) })).filter(group => group.items.length);
  const pageAllowed = !permissionMap[key] || access.can(permissionMap[key]);
  const initials = (data?.user?.name || data?.user?.email || "A").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("");

  useEffect(() => {
    if (sessionStatus === "unauthenticated" || data?.error) {
      void logoutSession().catch(() => { router.replace("/login"); });
    }
  }, [sessionStatus, data?.error, router]);

  async function confirmSignOut() {
    setLoggingOut(true);
    try { await logoutSession(); }
    catch { setLoggingOut(false); toast.error("Unable to log out. Please try again."); }
  }

  return <div className="min-h-screen bg-[#f6f6f3] text-[#1a1a17]" style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
    <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-[#e4e2dc] bg-white transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
      <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-4 top-6 text-[#55554e] lg:hidden"><X /></button>
      <Link href="/dashboard" className="flex items-center gap-3 border-b border-[#e4e2dc] px-6 py-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#f5a524] text-[15px] font-bold text-[#3b2a00]">MK</span>
        <span><span className="block text-lg font-semibold leading-tight">MoneyKee</span><span className="block text-[13px] text-[#77776f]">Admin control centre</span></span>
      </Link>
      <nav className="min-h-0 flex-1 overflow-y-auto pb-4">
        <Suspense fallback={null}><Navigation visibleGroups={visibleGroups} status={status.data} onNavigate={() => setOpen(false)} /></Suspense>
      </nav>
      <Dialog.Root open={confirmLogout} onOpenChange={value => { if (!loggingOut) setConfirmLogout(value); }}>
        <Dialog.Trigger asChild><button className="flex h-12 items-center gap-3 border-t border-[#e4e2dc] px-6 text-left text-[15px] text-[#3b3b36] hover:bg-[#f2f1ec]"><LogOut size={19} strokeWidth={1.75} />Log out</button></Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/60" />
          <Dialog.Content onOpenAutoFocus={event => { event.preventDefault(); document.getElementById("cancel-logout")?.focus(); }} className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
            <Dialog.Title className="text-xl font-semibold text-slate-800">Log out?</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-slate-600">Are you sure you want to log out of your account?</Dialog.Description>
            <div className="mt-6 flex justify-end gap-3">
              <Dialog.Close asChild><Button id="cancel-logout" variant="outline" disabled={loggingOut}>No</Button></Dialog.Close>
              <Button onClick={confirmSignOut} disabled={loggingOut}>{loggingOut ? "Logging out…" : "Yes"}</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </aside>
    {open && <button aria-label="Close menu" className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
    <div className="lg:pl-[264px]">
      <header className="sticky top-0 z-30 flex h-[76px] items-center gap-4 border-b border-[#e4e2dc] bg-white px-4 sm:px-8">
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="lg:hidden"><Menu /></button>
        <Suspense fallback={<p className="truncate text-xl font-semibold sm:text-[26px]">{names[key]}</p>}><PageHeading fallback={names[key] || "Admin"} items={visibleGroups.flatMap(group => group.items)} /></Suspense>
        <div className="ml-auto flex items-center gap-3">
          <SystemStatus status={status.data} canSeeIncidents={access.can("alerts:read")} />
          <button type="button" onClick={() => void queryClient.invalidateQueries()} disabled={fetching > 0} className="flex h-10 items-center gap-2 rounded-xl border border-[#d8d6cf] bg-white px-3 text-sm font-medium hover:bg-[#f6f6f3] disabled:opacity-70 sm:px-4" aria-label="Refresh data">
            <RefreshCw size={16} className={cn(fetching > 0 && "animate-spin")} /><span className="hidden sm:inline">Refresh</span>
          </button>
          <Link href="/profile" title={access.data?.adminRole} className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-[#d9e8fa] text-sm font-semibold text-[#1d5fa7]">
            {data?.user?.image ? <img src={data.user.image} alt={data.user.name || "Admin"} className="size-full object-cover" /> : initials}
          </Link>
        </div>
      </header>
      <main className="min-h-[calc(100vh-76px)] p-4 sm:p-6 lg:p-8">{access.isLoading ? <p>Loading permissions...</p> : access.isError ? <p role="alert">Unable to load admin permissions. Please refresh.</p> : pageAllowed ? children : <p role="alert">Your admin role does not permit access to this page.</p>}</main>
    </div>
  </div>;
}
