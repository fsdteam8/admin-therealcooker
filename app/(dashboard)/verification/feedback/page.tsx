"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Landmark, Mail, Phone, Search } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminAccess } from "@/components/admin-access";
import { card, dateTime, muted, Note, number, StatCard, timeAgo } from "@/components/dashboard-ui";
import { getFeedbackDetail, getFeedbackList, reviewFeedback, type FeedbackAction, type FeedbackCounts, type FeedbackDetail, type FeedbackItem, type FeedbackVerdict, type SearchType } from "@/lib/operations";
import { apiError, cn } from "@/lib/utils";

const verdicts: { key: FeedbackVerdict; label: string; short: string; color: string; text: string }[] = [
  { key: "legitimate", label: "Legitimate", short: "legit", color: "#2f7d1f", text: "text-[#1f6b1f]" },
  { key: "suspicious", label: "Suspicious", short: "suspicious", color: "#d93636", text: "text-[#b42318]" },
  { key: "not_sure", label: "Not sure", short: "not sure", color: "#c9c7bf", text: "text-[#6f6f68]" },
];
const types: { key: SearchType; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { key: "phone", label: "Phone number", icon: Phone }, { key: "email", label: "Email address", icon: Mail },
  { key: "account", label: "Account number", icon: Landmark }, { key: "website", label: "Website", icon: Globe },
];
const typeOf = (key: SearchType) => types.find(type => type.key === key) || types[0];
const share = (count: number, total: number) => total ? Math.round(count / total * 100) : 0;
const adminName = (admin: unknown) => typeof admin === "object" && admin ? (admin as { name?: string; email?: string }).name || (admin as { email?: string }).email || "an admin" : "an admin";

// One status per record: awaiting review, still collecting, or the verdict now in the verifier.
function statusOf(item: FeedbackItem) {
  if (item.status === "needs_review") return { label: "Awaiting review", className: "bg-[#f8e5b8] text-[#7a4b00]" };
  if (item.status === "collecting") return { label: "Collecting votes", className: "bg-[#eceae4] text-[#55554e]" };
  return item.resolution?.verdict === "suspicious"
    ? { label: "Not verified · scam", className: "bg-[#f9d9d9] text-[#a12b2b]" }
    : { label: "Verified", className: "bg-[#dcefd8] text-[#1f6b1f]" };
}
const verdictName = (verdict?: string) => verdict === "suspicious" ? "Not verified (scam)" : verdict === "legitimate" ? "Verified" : "—";
function decisionNote(item: FeedbackItem) {
  const r = item.resolution;
  if (!r) return item.status === "needs_review" ? "No verdict yet. The votes have no clear winner." : "No verdict yet. Waiting for a clear lead.";
  return `${verdictName(r.verdict)} in the verifier, decided by ${r.by === "admin" ? adminName(r.admin) : "community votes"} on ${dateTime(r.at)}${item.status === "needs_review" ? ". Newer votes are unclear, so it needs review." : "."}`;
}
function leader(counts: FeedbackCounts, outcome: FeedbackItem["outcome"]) {
  if (outcome === "none") return { text: "No votes yet", className: muted };
  if (outcome === "tie") return { text: "Tied for the lead", className: "text-[#7a4b00]" };
  const verdict = verdicts.find(item => item.key === outcome)!;
  return { text: `Most voted ${verdict.label.toLowerCase()} (${share(counts[outcome], counts.total)}%)`, className: verdict.text };
}

function VoteBar({ counts }: { counts: FeedbackCounts }) {
  return <div className="flex h-2 overflow-hidden rounded-full bg-[#f0efea]" role="img" aria-label={verdicts.map(v => `${counts[v.key]} ${v.label}`).join(", ")}>
    {verdicts.map(v => counts[v.key] ? <span key={v.key} style={{ width: `${share(counts[v.key], counts.total)}%`, background: v.color }} className="border-r border-white last:border-r-0" /> : null)}
  </div>;
}

function Legend() {
  return <div className={cn("flex flex-wrap gap-4 border-b border-[#ecebe6] bg-[#fafaf7] px-5 py-2.5 text-[13px]", muted)}>
    {verdicts.map(v => <span key={v.key} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: v.color }} />{v.label}</span>)}
  </div>;
}

function FeedbackTable({ items, selected, onSelect }: { items: FeedbackItem[]; selected?: string; onSelect: (id: string) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-[15px]">
    <thead><tr className={cn("border-b border-[#ecebe6] text-[13px]", muted)}><th className="px-4 py-3 font-normal">Contact</th><th className="px-3 py-3 font-normal">Votes</th><th className="px-3 py-3 font-normal">Community votes</th><th className="px-4 py-3 font-normal">Status</th></tr></thead>
    <tbody className="divide-y divide-[#ecebe6]">{items.map(item => {
      const type = typeOf(item.type), Icon = type.icon, status = statusOf(item), active = item._id === selected;
      return <tr key={item._id} onClick={() => onSelect(item._id)} aria-selected={active} className={cn("cursor-pointer transition hover:bg-[#fafaf7]", active && "bg-[#fbf6e9] shadow-[inset_3px_0_0_#caa85a] hover:bg-[#fbf6e9]")}>
        <td className="px-4 py-3"><div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#f5eedb] text-[#8a6a2b]"><Icon size={17} strokeWidth={1.75} /></span>
          <button type="button" className="min-w-0 text-left" onClick={() => onSelect(item._id)}><span className="block max-w-[200px] truncate font-semibold">{item.displayValue || item.value}</span><span className={cn("block text-[13px] leading-snug", muted)} title={`First vote ${item.firstVoteAt ? dateTime(item.firstVoteAt) : "—"} · last vote ${item.lastVoteAt ? dateTime(item.lastVoteAt) : "—"}`}>{type.label} · last vote {item.lastVoteAt ? timeAgo(item.lastVoteAt) : "—"}</span></button>
        </div></td>
        <td className="px-3 py-3 tabular-nums">{number(item.counts.total)}</td>
        <td className="px-3 py-3"><div className="w-32 2xl:w-40"><VoteBar counts={item.counts} /></div>
          <p className={cn("mt-1 text-[13px] leading-snug", muted)}>{verdicts.map(v => <span key={v.key} className="mr-2 inline-block"><b className={v.text}>{item.counts[v.key]}</b> {v.short}</span>)}</p></td>
        <td className="px-4 py-3"><span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-medium", status.className)}>{status.label}</span>
          {item.resolution && <p className={cn("mt-1 text-[12px]", muted)}>by {item.resolution.by === "admin" ? "admin" : "community"}</p>}</td>
      </tr>;
    })}</tbody>
  </table></div>;
}

const historyLabel: Record<FeedbackDetail["history"][number]["action"], string> = {
  community_verdict: "Community verdict applied", review_required: "Flagged for review", admin_verified: "Marked as verified",
  admin_flagged: "Marked as not verified (scam)", keep_collecting: "Kept collecting votes",
};

function ReviewPanel({ id, canDecide }: { id: string; canDecide: boolean }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const query = useQuery({ queryKey: ["verification-feedback-detail", id], queryFn: () => getFeedbackDetail(id), refetchInterval: 60_000 });
  const decide = useMutation({
    mutationFn: (action: FeedbackAction) => reviewFeedback(id, { action, reason: reason.trim() || undefined }),
    onSuccess: response => {
      toast.success(response.message); setReason("");
      for (const key of ["verification-feedback", "verification-feedback-detail", "dashboard-status", "verifications"]) void qc.invalidateQueries({ queryKey: [key] });
    },
    onError: error => toast.error(apiError(error)),
  });
  const d = query.data;
  if (query.isLoading) return <Skeleton className="h-[520px] rounded-2xl" />;
  if (!d) return <div className={cn(card, "p-5")}><Note>This record could not load: {apiError(query.error)}</Note></div>;
  const lead = leader(d.counts, d.outcome), adminDecided = d.resolution?.by === "admin";
  const final = (action: FeedbackAction) => {
    if (!reason.trim()) { toast.error("Give a short reason for this decision"); return; }
    decide.mutate(action);
  };
  return <section className={cn(card, "p-5 sm:p-6")} aria-label="Selected contact">
    <p className={cn("text-[12px] font-medium uppercase tracking-[.08em]", muted)}>{typeOf(d.type).label}</p>
    <h2 className="mt-1 break-all text-[21px] font-semibold leading-tight">{d.displayValue || d.value}</h2>
    <p className={cn("mt-1 text-[14px]", muted)}>First vote {d.firstVoteAt ? dateTime(d.firstVoteAt) : "—"} · last vote {d.lastVoteAt ? dateTime(d.lastVoteAt) : "—"}</p>

    <div className="mt-4 rounded-xl border border-[#e4e2dc] bg-[#fafaf7] p-4">
      <p className={cn("text-[14px]", muted)}>Total votes</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2"><span className="text-[30px] font-semibold leading-tight tabular-nums">{number(d.counts.total)}</span><span className={cn("text-[14px] font-medium", lead.className)}>{lead.text}</span></p>
    </div>
    <div className="mt-4 space-y-3">{verdicts.map(v => <div key={v.key}>
      <div className="flex items-center justify-between text-[15px]"><span className="font-medium">{v.label}</span><span className="tabular-nums">{number(d.counts[v.key])} vote{d.counts[v.key] === 1 ? "" : "s"} · {share(d.counts[v.key], d.counts.total)}%</span></div>
      <div className="mt-1.5 h-2 rounded-full bg-[#f0efea]"><div className="h-full rounded-full" style={{ width: `${share(d.counts[v.key], d.counts.total)}%`, background: v.color }} /></div>
    </div>)}</div>

    <div className="mt-5 border-t border-[#ecebe6] pt-4">
      <p className="text-[15px] font-semibold">Current status</p>
      <p className="mt-1"><span className={cn("rounded-full px-2.5 py-1 text-[13px] font-medium", statusOf(d).className)}>{statusOf(d).label}</span></p>
      <p className={cn("mt-2 text-[14px] leading-snug", muted)}>{decisionNote(d)}</p>
      {d.resolution?.reason && <p className="mt-1 text-[14px] leading-snug">&ldquo;{d.resolution.reason}&rdquo;</p>}
    </div>

    <div className="mt-5 border-t border-[#ecebe6] pt-4">
      <p className="text-[15px] font-semibold">Admin decision</p>
      <p className={cn("mt-0.5 text-[13px] leading-snug", muted)}>Sets what users see the next time this contact is checked. Later votes are still counted but never change an admin decision.</p>
      {canDecide ? <>
        <label className="mt-3 block text-[13px] font-medium" htmlFor="decision-reason">Reason <span className={muted}>(required to verify or flag)</span></label>
        <textarea id="decision-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} rows={2} placeholder="e.g. Confirmed with the bank" className="mt-1 w-full resize-y rounded-lg border border-[#d8d6cf] px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-[#caa85a]/30" />
        <div className="mt-3 grid gap-2">
          <button type="button" disabled={decide.isPending} onClick={() => final("verify")} className="h-11 rounded-lg border border-[#b9dcb1] bg-[#e3f3df] text-[15px] font-semibold text-[#1f6b1f] transition hover:bg-[#d5ecd0] disabled:opacity-50">Mark as verified</button>
          <button type="button" disabled={decide.isPending} onClick={() => final("flag")} className="h-11 rounded-lg bg-[#b42318] text-[15px] font-semibold text-white transition hover:bg-[#9b1d14] disabled:opacity-50">Mark as not verified (scam)</button>
          <button type="button" disabled={decide.isPending || adminDecided} onClick={() => decide.mutate("collect")} title={adminDecided ? "An admin has decided this contact; mark it verified or not verified to change that" : undefined} className="h-11 rounded-lg border border-[#d8d6cf] bg-white text-[15px] font-semibold text-[#3b3b36] transition hover:bg-[#f6f6f3] disabled:opacity-50">Keep collecting votes</button>
        </div>
      </> : <Note>Your admin role can view feedback but not decide on it.</Note>}
    </div>

    {d.history.length > 0 && <div className="mt-5 border-t border-[#ecebe6] pt-4">
      <p className="text-[15px] font-semibold">Decision history</p>
      <ol className="mt-2 space-y-2.5">{d.history.map((entry, index) => <li key={index} className="text-[14px] leading-snug">
        <p><b className="font-medium">{historyLabel[entry.action]}</b> <span className={muted}>· {entry.by === "admin" ? adminName(entry.admin) : "community"} · {dateTime(entry.at)}</span></p>
        <p className={cn("text-[13px]", muted)}>At {entry.counts.legitimate} legit · {entry.counts.suspicious} suspicious · {entry.counts.not_sure} not sure{entry.reason ? ` — “${entry.reason}”` : ""}</p>
      </li>)}</ol>
    </div>}

    <div className="mt-5 border-t border-[#ecebe6] pt-4">
      <p className="text-[15px] font-semibold">Votes <span className={cn("font-normal", muted)}>· voters stay anonymous</span></p>
      <ul className="mt-2 max-h-56 divide-y divide-[#ecebe6] overflow-y-auto text-[14px]">{d.votes.map(vote => {
        const v = verdicts.find(item => item.key === vote.verdict)!;
        return <li key={vote.id} className="flex items-center justify-between gap-3 py-1.5"><span className="flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: v.color }} />{v.label}</span><span className={muted}>{dateTime(vote.createdAt)}</span></li>;
      })}</ul>
      {d.counts.total > d.votes.length && <p className={cn("mt-1 text-[13px]", muted)}>Showing the latest {d.votes.length} of {number(d.counts.total)} votes.</p>}
    </div>
  </section>;
}

const statusFilters = [{ key: "", label: "All statuses" }, { key: "needs_review", label: "Awaiting review" }, { key: "collecting", label: "Collecting votes" }, { key: "resolved", label: "Resolved" }];

export default function FeedbackVotesPage() {
  const access = useAdminAccess();
  const [type, setType] = useState<SearchType | "">("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
  const query = useQuery({ queryKey: ["verification-feedback", type, status, search, page], queryFn: () => getFeedbackList({ type: type || undefined, status: status || undefined, search: search.trim() || undefined, page, limit: 10 }), placeholderData: keepPreviousData, refetchInterval: 60_000 });
  const d = query.data, items = d?.items || [];
  // Open the first record awaiting review, or the first record, until the admin picks one.
  const current = items.some(item => item._id === selected) ? selected : (items.find(item => item.status === "needs_review") || items[0])?._id;
  const filter = (apply: () => void) => { apply(); setPage(1); };

  return <div className="space-y-6">
    <div>
      <p className={cn("text-[14px]", muted)}>Verification</p>
      <h1 className="text-2xl font-bold sm:text-3xl">Feedback &amp; votes</h1>
      <p className={cn("mt-1 text-[15px]", muted)}>Community votes on contacts that returned &ldquo;No record found&rdquo; in the Verify check.</p>
    </div>

    {query.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}</div>
      : d ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contacts with votes" value={number(d.summary.contacts)} detail="all time" />
        <StatCard label="Votes this week" value={number(d.summary.votesThisWeek)} detail={d.summary.weekLabel} />
        <StatCard label="Awaiting review" value={number(d.summary.awaitingReview)} detail={d.summary.awaitingReview ? "Not sure leads or the votes are tied" : "Nothing to review"} tone={d.summary.awaitingReview ? "warning" : undefined} />
        <StatCard label="Marked as scam (30 days)" value={number(d.summary.markedScam)} detail="by votes or an admin" />
      </div> : null}
    {query.isError && <div role="alert" className="rounded-2xl border border-[#e9a7ac] bg-[#f9d8da] p-4 text-sm text-[#8f1d24]">Feedback could not load: {apiError(query.error)} <button onClick={() => void query.refetch()} className="font-semibold underline">Retry</button></div>}

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className={cn(card, "min-w-0")}>
        <div className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap rounded-xl border border-[#e4e2dc] p-1" role="tablist" aria-label="Contact type">
            {[{ key: "" as const, label: "All" }, ...types.map(item => ({ key: item.key, label: item.label.split(" ")[0] }))].map(item =>
              <button key={item.key} role="tab" aria-selected={type === item.key} onClick={() => filter(() => setType(item.key))} className={cn("h-9 rounded-lg px-3.5 text-[14px] font-medium transition", type === item.key ? "bg-[#1a1a17] text-white" : "text-[#3b3b36] hover:bg-[#f2f1ec]")}>{item.label}</button>)}
          </div>
          <select aria-label="Status" value={status} onChange={event => filter(() => setStatus(event.target.value))} className="h-11 rounded-xl border border-[#e4e2dc] bg-white px-3 text-[14px]">
            {statusFilters.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
          <label className="relative min-w-[200px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8a83]" />
            <input value={search} onChange={event => filter(() => setSearch(event.target.value))} placeholder="Search number, email, account or website" aria-label="Search contacts" className="h-11 w-full rounded-xl border border-[#e4e2dc] pl-9 pr-3 text-[14px] outline-none focus:ring-2 focus:ring-[#caa85a]/30" />
          </label>
        </div>
        <Legend />
        {query.isLoading ? <div className="space-y-2 p-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-14" />)}</div>
          : !items.length ? <Note>{type || status || search ? "No contacts match these filters." : "No community feedback yet. Contacts appear here once app users vote on a number, email, account or website the Verify check didn't find."}</Note>
          : <FeedbackTable items={items} selected={current} onSelect={setSelected} />}
        {d && d.pagination.total > d.pagination.limit && <div className="px-5 pb-5"><Pagination page={d.pagination.page} totalPages={d.pagination.totalPages} total={d.pagination.total} limit={d.pagination.limit} onPage={setPage} /></div>}
      </section>
      {current ? <ReviewPanel key={current} id={current} canDecide={access.can("verification:write")} /> : !query.isLoading && <div className={cn(card, "p-5")}><Note>Select a contact to see its votes.</Note></div>}
    </div>
    {d && <p className={cn("pb-2 text-xs leading-5", muted)}>A contact becomes Verified or Not verified when Legitimate or Suspicious has more votes than each other option{d.minimumVotes > 1 ? ` and at least ${d.minimumVotes} votes are in` : ""}. Ties and contacts where Not sure leads wait for an admin. Refreshes every minute.</p>}
  </div>;
}
