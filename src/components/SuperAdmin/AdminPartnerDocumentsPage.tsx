"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Plus, Trash2 } from "lucide-react";
import {
  useGetAdminPartnerDocumentsQuery,
  useCreateAdminPartnerDocumentMutation,
  useUpdateAdminPartnerDocumentMutation,
  useDeleteAdminPartnerDocumentMutation,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";

function ActiveToggle({
  active,
  onToggle,
  disabled,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
        active ? "bg-green-500/30 border-green-500/50" : "bg-zinc-700/50 border-zinc-600"
      }`}
      title={active ? "Active — shown on onboarding forms" : "Inactive — hidden from onboarding"}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          active ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

const MODULE_LABEL: Record<string, string> = {
  both: "Dining + Event",
  dining: "Dining only",
  event: "Event only",
};

export default function AdminPartnerDocumentsPage() {
  const [moduleFilter, setModuleFilter] = useState<"" | "dining" | "event" | "both">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const queryArg = {
    page,
    limit: PAGE_SIZE,
    ...(moduleFilter ? { module: moduleFilter } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
  };

  const {
    data: documentsData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetAdminPartnerDocumentsQuery(queryArg);
  const documents = documentsData?.items ?? [];

  const [createDocument, { isLoading: creating }] = useCreateAdminPartnerDocumentMutation();
  const [updateDocument] = useUpdateAdminPartnerDocumentMutation();
  const [deleteDocument] = useDeleteAdminPartnerDocumentMutation();
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    body: string;
    run: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [newDoc, setNewDoc] = useState({
    name: "",
    description: "",
    module: "both" as "dining" | "event" | "both",
    is_required: false,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.name.trim()) {
      toast.error("Document name is required");
      return;
    }
    try {
      const created = await createDocument({
        name: newDoc.name.trim(),
        description: newDoc.description.trim() || undefined,
        module: newDoc.module,
        is_required: newDoc.is_required,
        is_active: true,
      }).unwrap();
      toast.success(`"${created.name}" added — it now appears on partner onboarding`);
      setNewDoc({ name: "", description: "", module: newDoc.module, is_required: false });
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to add document type"));
    }
  };

  const listLoading = isLoading && documents.length === 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <span className="bg-rose-500/20 text-rose-500 p-2 rounded-xl">
            <FileText size={28} />
          </span>
          Partner Document Master
        </h1>
        <p className="text-zinc-400 mt-2">
          Document types shown on <strong className="text-white">/business</strong> and Super Admin
          dining/event onboarding. Active items appear immediately after you add them.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass-panel p-6 border border-white/5 rounded-2xl">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Plus size={18} className="text-rose-500" /> Add document type
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">
                Document name <span className="text-rose-500">*</span>
              </label>
              <input
                value={newDoc.name}
                onChange={(e) => setNewDoc((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Fire Safety Certificate"
                className="input-field w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Description / examples</label>
              <textarea
                rows={3}
                value={newDoc.description}
                onChange={(e) => setNewDoc((p) => ({ ...p, description: e.target.value }))}
                className="input-field w-full resize-y min-h-[80px]"
                placeholder="What partners should upload..."
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Applies to</label>
              <select
                value={newDoc.module}
                onChange={(e) =>
                  setNewDoc((p) => ({
                    ...p,
                    module: e.target.value as "dining" | "event" | "both",
                  }))
                }
                className="input-field w-full"
              >
                <option value="both">Dining + Event</option>
                <option value="dining">Dining only</option>
                <option value="event">Event only</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={newDoc.is_required}
                onChange={(e) => setNewDoc((p) => ({ ...p, is_required: e.target.checked }))}
                className="rounded"
              />
              Required on onboarding
            </label>
            <p className="text-xs text-zinc-500">New types are active and show on partner forms immediately.</p>
            <button type="submit" disabled={creating} className="btn-primary w-full disabled:opacity-50">
              {creating ? "Adding..." : "Add document type"}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 glass-panel border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-zinc-400">Filter:</span>
              <select
                value={moduleFilter}
                onChange={(e) => {
                  setModuleFilter(e.target.value as "" | "dining" | "event" | "both");
                  setPage(1);
                }}
                className="input-field text-sm py-2 w-auto min-w-[160px]"
              >
                <option value="">All modules</option>
                <option value="both">Dining + Event</option>
                <option value="dining">Dining only</option>
                <option value="event">Event only</option>
              </select>
              <SearchInput
                value={q}
                onChange={(value) => {
                  setQ(value);
                  setPage(1);
                }}
                placeholder="Search documents"
              />
            </div>
            <span className="text-xs text-zinc-500">
              {documents.length} type{documents.length !== 1 ? "s" : ""}
              {isFetching && !listLoading ? " · refreshing…" : ""}
            </span>
          </div>

          {listLoading ? (
            <div className="p-8 text-center text-zinc-500">Loading document types...</div>
          ) : isError ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-rose-400">{extractApiError(error, "Failed to load documents")}</p>
              <button onClick={() => refetch()} className="text-sm text-zinc-400 hover:text-white underline">
                Retry
              </button>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">No document types yet. Add one using the form.</div>
          ) : (
            <div className="divide-y divide-white/5 max-h-[70vh] overflow-y-auto">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className={`p-4 hover:bg-white/[0.02] ${!doc.is_active ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white">{doc.name}</span>
                        {doc.is_required && (
                          <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            Required
                          </span>
                        )}
                        <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/10">
                          {MODULE_LABEL[doc.module] || doc.module}
                        </span>
                      </div>
                      {doc.description && (
                        <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{doc.description}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="flex items-center gap-2 mr-2">
                        <ActiveToggle
                          active={!!doc.is_active}
                          onToggle={async () => {
                            const next = !doc.is_active;
                            try {
                              await updateDocument({
                                id: doc.id,
                                body: { is_active: next },
                              }).unwrap();
                              toast.success(
                                next
                                  ? `"${doc.name}" is active — shown on onboarding`
                                  : `"${doc.name}" is inactive — hidden from forms`
                              );
                            } catch (err: unknown) {
                              toast.error(extractApiError(err, "Failed to update status"));
                            }
                          }}
                        />
                        <span className={`text-xs ${doc.is_active ? "text-green-400" : "text-zinc-500"}`}>
                          {doc.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await updateDocument({
                              id: doc.id,
                              body: { is_required: !doc.is_required },
                            }).unwrap();
                            toast.success(
                              doc.is_required
                                ? `"${doc.name}" is now optional`
                                : `"${doc.name}" is now required`
                            );
                          } catch (err: unknown) {
                            toast.error(extractApiError(err, "Failed to update document"));
                          }
                        }}
                        className="text-xs px-2 py-1 rounded border border-white/10 text-zinc-400 hover:text-white"
                      >
                        {doc.is_required ? "Make optional" : "Make required"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingConfirm({
                            title: "Delete document type?",
                            body: `Delete "${doc.name}"?`,
                            run: async () => {
                              await deleteDocument(doc.id).unwrap();
                              toast.success(`"${doc.name}" deleted`);
                            },
                          })
                        }
                        className="text-zinc-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {documentsData?.meta && <Pagination meta={documentsData.meta} onPageChange={setPage} />}
        </div>
      </div>
      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title || ""}
        body={pendingConfirm?.body || ""}
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setPendingConfirm(null)}
        onConfirm={async () => {
          if (!pendingConfirm) return;
          setConfirmBusy(true);
          try {
            await pendingConfirm.run();
            setPendingConfirm(null);
          } catch (err: unknown) {
            toast.error(extractApiError(err, "Delete failed"));
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}
