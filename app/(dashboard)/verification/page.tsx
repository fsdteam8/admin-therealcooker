"use client";

import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Download,
  FileSpreadsheet,
  Globe,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/page-title";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createVerification,
  deleteVerification,
  getVerifications,
  updateVerification,
  uploadVerificationCSV,
} from "@/lib/api";
import type {
  VerificationList,
  VerificationRecord,
  VerificationStatus,
} from "@/lib/api";
import { apiError } from "@/lib/utils";

export default function VerificationPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<VerificationRecord | null | undefined>(
    undefined
  );
  const [csvModalOpen, setCsvModalOpen] = useState(false);

  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["verifications", page, search],
    queryFn: () => getVerifications(page, 10, search),
    placeholderData: (p) => p,
  });

  const records = query.data?.verifications || [];
  const pagination = query.data?.pagination;

  const saveMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id?: string;
      data: Partial<VerificationRecord>;
    }) => (id ? updateVerification(id, data) : createVerification(data)),
    onSuccess: (r) => {
      toast.success(r.message || "Saved successfully");
      setEditing(undefined);
      qc.invalidateQueries({ queryKey: ["verifications"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVerification,
    onSuccess: (r) => {
      toast.success(r.message || "Deleted successfully");
      qc.invalidateQueries({ queryKey: ["verifications"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: VerificationStatus }) =>
      updateVerification(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["verifications"] });
      const previous = qc.getQueriesData<VerificationList>({
        queryKey: ["verifications"],
      });
      qc.setQueriesData<VerificationList>(
        { queryKey: ["verifications"] },
        (current) =>
          current
            ? {
                ...current,
                verifications: current.verifications.map((record) =>
                  record._id === id ? { ...record, status } : record
                ),
              }
            : current
      );
      return { previous };
    },
    onSuccess: (_response, { status }) => {
      toast.success(
        `Status updated to ${status === "verified" ? "Verified" : "Fraudulent"}`
      );
    },
    onError: (error, _variables, context) => {
      context?.previous.forEach(([queryKey, data]) => {
        qc.setQueryData(queryKey, data);
      });
      toast.error(apiError(error));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["verifications"] });
    },
  });

  // Function to download a ready-to-use sample CSV file
  const downloadSampleCSV = () => {
    const csvContent =
      "email,phone,account,website,status\n" +
      "john.doe@example.com,+1234567890,ACC-88219,https://example.com,verified\n" +
      "sarah.connor@test.com,+9876543210,ACC-99432,https://mywebsite.org,fraudulent\n" +
      "alex.smith@company.io,+1122334455,ACC-44120,https://company.io,\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "verification_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.info("Sample CSV downloaded");
  };

  return (
    <>
      <PageTitle
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search email, phone, acc..."
                className="border-slate-200 pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadSampleCSV}
              title="Download sample template CSV"
            >
              <Download size={16} />
              Sample CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCsvModalOpen(true)}
            >
              <Upload size={16} />
              Upload CSV
            </Button>
            <Button size="sm" onClick={() => setEditing(null)}>
              <Plus size={16} />
              Add new
            </Button>
          </div>
        }
      >
        Verification
      </PageTitle>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Phone</th>
              <th className="px-6 py-4">Account</th>
              <th className="px-6 py-4">Website</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {query.isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="p-4">
                    <Skeleton className="h-10 w-full rounded-md" />
                  </td>
                </tr>
              ))
            ) : records.length ? (
              records.map((r) => {
                const status = canonicalStatus(r.status);
                const isUpdatingStatus =
                  statusMutation.isPending &&
                  statusMutation.variables?.id === r._id;
                return (
                  <tr
                    key={r._id}
                    className="transition hover:bg-slate-50/50"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <Mail size={15} className="text-slate-400" />
                        <span>{r.email || "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center gap-2">
                        <Phone size={15} className="text-slate-400" />
                        <span>{r.phone || "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {r.account ? (
                        <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-800">
                          {r.account}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {r.website ? (
                        <a
                          href={
                            r.website.startsWith("http")
                              ? r.website
                              : `https://${r.website}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[#a48734] hover:underline"
                        >
                          <Globe size={14} />
                          <span className="max-w-[200px] truncate">
                            {r.website}
                          </span>
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                          status === "verified"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        {status === "verified" ? (
                          <BadgeCheck size={14} />
                        ) : (
                          <ShieldAlert size={14} />
                        )}
                        <select
                          aria-label={`Status for ${recordLabel(r)}`}
                          value={status}
                          disabled={isUpdatingStatus}
                          onChange={(event) =>
                            statusMutation.mutate({
                              id: r._id,
                              status: event.target
                                .value as VerificationStatus,
                            })
                          }
                          className="cursor-pointer bg-transparent pr-1 capitalize outline-none disabled:cursor-wait disabled:opacity-60"
                        >
                          <option value="verified">Verified</option>
                          <option value="fraudulent">Fraudulent</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-slate-500 hover:text-slate-900"
                          onClick={() => setEditing(r)}
                          title="Edit record"
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                          disabled={deleteMutation.isPending}
                          onClick={() =>
                            confirm("Delete this verification record?") &&
                            deleteMutation.mutate(r._id)
                          }
                          title="Delete record"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="p-14 text-center text-slate-500"
                >
                  <div className="flex flex-col items-center justify-center">
                    <UserCheck className="size-12 text-slate-300" />
                    <h4 className="mt-3 text-base font-semibold text-slate-700">
                      No verification records found
                    </h4>
                    <p className="mt-1 text-xs text-slate-400">
                      Upload a CSV file or add verification records manually.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPage={setPage}
        />
      )}

      {/* Add / Edit Record Modal */}
      {editing !== undefined && (
        <RecordModal
          item={editing}
          loading={saveMutation.isPending}
          close={() => setEditing(undefined)}
          submit={(data) =>
            saveMutation.mutate({
              id: editing?._id,
              data,
            })
          }
        />
      )}

      {/* CSV Upload Modal */}
      {csvModalOpen && (
        <CSVUploadModal
          close={() => setCsvModalOpen(false)}
          onSuccess={() => {
            setCsvModalOpen(false);
            qc.invalidateQueries({ queryKey: ["verifications"] });
          }}
          downloadSample={downloadSampleCSV}
        />
      )}
    </>
  );
}

// Single Record Modal
function RecordModal({
  item,
  loading,
  close,
  submit,
}: {
  item: VerificationRecord | null;
  loading: boolean;
  close: () => void;
  submit: (data: Partial<VerificationRecord>) => void;
}) {
  const [email, setEmail] = useState(item?.email || "");
  const [phone, setPhone] = useState(item?.phone || "");
  const [account, setAccount] = useState(item?.account || "");
  const [website, setWebsite] = useState(item?.website || "");
  const [status, setStatus] = useState<VerificationStatus>(
    canonicalStatus(item?.status)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email && !phone && !account && !website) {
      toast.error("Please provide at least one detail");
      return;
    }
    submit({ email, phone, account, website, status });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg overflow-hidden rounded-xl bg-white p-6 shadow-xl sm:p-8"
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-5 top-5 text-slate-400 hover:text-slate-700"
        >
          <X size={20} />
        </button>

        <h3 className="text-xl font-bold text-slate-800">
          {item ? "Edit" : "Add"} Verification Record
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Enter the verification details for this user or account
        </p>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Email Address
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. user@example.com"
              className="mt-1.5 border-slate-300"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Phone Number
            <Input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +1 234 567 890"
              className="mt-1.5 border-slate-300"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Account Number / ID
            <Input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="e.g. ACC-109283"
              className="mt-1.5 border-slate-300"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Website URL
            <Input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="e.g. https://example.com"
              className="mt-1.5 border-slate-300"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Status <span className="font-normal text-slate-400">(optional)</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as VerificationStatus)
              }
              className="mt-1.5 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#a48734] focus:ring-2 focus:ring-[#a48734]/20"
            >
              <option value="verified">Verified</option>
              <option value="fraudulent">Fraudulent</option>
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-400">
              Defaults to Verified when unchanged.
            </span>
          </label>
        </div>

        <div className="mt-7 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-[110px] rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            disabled={loading}
            className="h-11 min-w-[140px] whitespace-nowrap rounded-lg bg-[#a48734] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8d732a] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:opacity-100"
          >
            {loading ? "Saving…" : "Save Record"}
          </Button>
        </div>
      </form>
    </div>
  );
}

// CSV Upload Modal
function CSVUploadModal({
  close,
  onSuccess,
  downloadSample,
}: {
  close: () => void;
  onSuccess: () => void;
  downloadSample: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (f: File) => uploadVerificationCSV(f),
    onSuccess: (res) => {
      toast.success(res.message || "CSV uploaded and imported successfully");
      onSuccess();
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.name.endsWith(".csv")) {
      setFile(dropped);
    } else {
      toast.error("Please drop a valid .csv file");
    }
  };

  const handleUpload = () => {
    if (!file) {
      toast.error("Please select a CSV file first");
      return;
    }
    uploadMutation.mutate(file);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl sm:p-8">
        <button
          type="button"
          onClick={close}
          className="absolute right-5 top-5 text-slate-400 hover:text-slate-700"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-[#f7f0df] text-[#a48734]">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Upload CSV File</h3>
            <p className="text-xs text-slate-500">
              Bulk import verification records from a CSV spreadsheet
            </p>
          </div>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="mt-6 flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#caa85a]/50 bg-[#faf7f0] p-6 text-center transition hover:border-[#caa85a] hover:bg-[#f6f0df]"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) setFile(selected);
            }}
          />

          {file ? (
            <div className="flex flex-col items-center">
              <FileSpreadsheet className="size-12 text-[#a48734]" />
              <b className="mt-2 text-sm text-slate-800">{file.name}</b>
              <small className="text-xs text-slate-500">
                {(file.size / 1024).toFixed(1)} KB • Click or drag to replace
              </small>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="size-10 text-[#a48734]" />
              <span className="mt-2 text-sm font-semibold text-slate-800">
                Click to browse or drag & drop CSV here
              </span>
              <span className="mt-1 text-xs text-slate-400">
                File must be in .csv format
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Expected CSV Columns:</span>
            <button
              type="button"
              onClick={downloadSample}
              className="inline-flex items-center gap-1 font-semibold text-[#a48734] hover:underline"
            >
              <Download size={13} />
              Download Template
            </button>
          </div>
          <code className="mt-1.5 block rounded bg-white p-1.5 font-mono text-[11px] text-slate-700 border">
            email, phone, account, website, status (optional)
          </code>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            Status accepts <b>verified</b> or <b>fraudulent</b>. Missing or empty
            values default to verified.
          </p>
        </div>

        <div className="mt-7 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          <Button
            type="button"
            variant="outline"
            className="h-11 min-w-[110px] rounded-lg border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            onClick={close}
          >
            Cancel
          </Button>
          <Button
            disabled={!file || uploadMutation.isPending}
            className="h-11 min-w-[170px] whitespace-nowrap rounded-lg bg-[#a48734] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#8d732a] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:opacity-100 disabled:shadow-none"
            onClick={handleUpload}
          >
            {uploadMutation.isPending ? (
              "Importing…"
            ) : (
              <>
                <Upload size={16} />
                <span>Upload & Import</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function canonicalStatus(status?: string): VerificationStatus {
  return status?.toLowerCase() === "fraud" ||
    status?.toLowerCase() === "fraudulent"
    ? "fraudulent"
    : "verified";
}

function recordLabel(record: VerificationRecord) {
  return (
    record.email || record.phone || record.account || record.website || "record"
  );
}
