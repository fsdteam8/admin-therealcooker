"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Landmark, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { apiError } from "@/lib/utils";
import { createBank, getBanks, updateBank } from "@/lib/banks";
import type { BankRecord } from "@/lib/banks";
import { getAdminIdentity, hasPermission } from "@/lib/operations";

function BankEditor({ bank, onClose }: { bank: BankRecord | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(bank?.name || "");
  const [order, setOrder] = useState(bank?.sortOrder || 0);
  const [logo, setLogo] = useState<File | null>(null);
  const [active, setActive] = useState(bank?.isActive ?? true);
  const save = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("sortOrder", String(order));
      form.append("isActive", String(active));
      if (logo) form.append("logo", logo);
      return bank ? updateBank(bank._id, form) : createBank(form);
    },
    onSuccess: () => { toast.success(bank ? "Bank updated" : "Bank created"); void queryClient.invalidateQueries({ queryKey: ["banks"] }); onClose(); },
    onError: error => toast.error(apiError(error)),
  });
  return <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
    <form onSubmit={event => { event.preventDefault(); save.mutate(); }} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" aria-label={bank ? "Edit bank" : "Add bank"}>
      <h2 className="text-xl font-bold text-slate-900">{bank ? "Edit bank" : "Add bank"}</h2>
      <p className="mt-1 text-sm text-slate-500">The active catalog is shown in the mobile bank picker.</p>
      <label className="mt-5 block text-sm font-semibold text-slate-700">Bank name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="e.g. First National Bank" /></label>
      <label className="mt-5 block text-sm font-semibold text-slate-700">Logo image {bank ? "(optional replacement)" : "(required)"}<input type="file" accept="image/png,image/jpeg,image/webp" required={!bank} onChange={event => setLogo(event.target.files?.[0] || null)} className="mt-2 block w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
      {logo ? <p className="mt-3 text-xs text-slate-600">Selected: {logo.name}</p> : bank?.logo.url && <div className="mt-3 flex h-24 items-center justify-center rounded-lg bg-slate-50 p-2"><img src={bank.logo.url} alt={bank.name} className="max-h-full max-w-full object-contain"/></div>}
      <div className="mt-5 flex items-end gap-5"><label className="block flex-1 text-sm font-semibold text-slate-700">Display order<input type="number" min={0} max={9999} value={order} onChange={event => setOrder(Number(event.target.value))} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"/></label><label className="flex items-center gap-2 pb-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)}/>Active</label></div>
      <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={save.isPending || !name.trim() || (!bank && !logo)} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{save.isPending ? "Saving..." : "Save bank"}</button></div>
    </form>
  </div>;
}

export default function BanksPage() {
  const [editing, setEditing] = useState<BankRecord | null | undefined>();
  const identity = useQuery({ queryKey: ["admin-identity"], queryFn: getAdminIdentity });
  const canRead = hasPermission(identity.data, "banks:read");
  const canWrite = hasPermission(identity.data, "banks:write");
  const banks = useQuery({ queryKey: ["banks"], queryFn: getBanks, enabled: canRead });
  const queryClient = useQueryClient();
  const status = useMutation({ mutationFn: (bank: BankRecord) => { const form = new FormData(); form.append("isActive", String(!bank.isActive)); return updateBank(bank._id, form); }, onSuccess: () => { toast.success("Bank status updated"); void queryClient.invalidateQueries({ queryKey: ["banks"] }); }, onError: error => toast.error(apiError(error)) });
  return <div className="space-y-6"><PageTitle action={canWrite && <button onClick={() => setEditing(null)} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={18}/>Add bank</button>}>Bank catalog</PageTitle>
    <p className="max-w-3xl text-sm leading-6 text-slate-600">Upload bank names and logos here. Active banks appear in the mobile app. Deactivating a bank hides it from new selections while preserving existing account records.</p>
    {identity.isLoading || banks.isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({length: 6}, (_, index) => <Skeleton key={index} className="h-52 rounded-2xl"/>)}</div> : !canRead ? <p role="alert" className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">Your admin role cannot view the bank catalog.</p> : banks.isError ? <p role="alert" className="rounded-xl bg-rose-50 p-5 text-sm text-rose-800">{apiError(banks.error)}</p> : banks.data?.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{banks.data.map(bank => <article key={bank._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex h-28 items-center justify-center rounded-xl bg-slate-50 p-3"><img src={bank.logo.url} alt={bank.name + " logo"} className="max-h-full max-w-full object-contain"/></div><div className="mt-4 flex items-start justify-between gap-2"><div><h2 className="font-bold text-slate-900">{bank.name}</h2><p className="mt-1 text-xs text-slate-500">Order {bank.sortOrder}</p></div><span className={"rounded-full px-2 py-1 text-xs font-semibold " + (bank.isActive ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500")}>{bank.isActive ? "Active" : "Hidden"}</span></div>{canWrite && <div className="mt-5 flex gap-3 border-t pt-4"><button onClick={() => setEditing(bank)} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700"><Pencil size={15}/>Edit</button><button disabled={status.isPending} onClick={() => status.mutate(bank)} className="text-sm font-semibold text-slate-600 disabled:opacity-40">{bank.isActive ? "Deactivate" : "Activate"}</button></div>}</article>)}</div> : <div className="rounded-2xl border border-dashed bg-white p-12 text-center text-slate-500"><ImagePlus className="mx-auto mb-3"/><p>No banks uploaded yet.</p>{canWrite && <button onClick={() => setEditing(null)} className="mt-4 font-semibold text-teal-700">Add the first bank</button>}</div>}
    {editing !== undefined && <BankEditor key={editing?._id || "new"} bank={editing} onClose={() => setEditing(undefined)}/>}
    <div className="flex items-center gap-2 text-xs text-slate-500"><Landmark size={15}/>Bank names and logos are catalog data. A bank entry does not establish a live banking connection.</div>
  </div>;
}
