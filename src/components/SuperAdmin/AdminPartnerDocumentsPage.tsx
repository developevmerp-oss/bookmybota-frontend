"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  useGetAdminPartnerDocumentsQuery,
  useCreateAdminPartnerDocumentMutation,
  useUpdateAdminPartnerDocumentMutation,
  useDeleteAdminPartnerDocumentMutation,
  useGetAdminPartnerOnboardingTermsQuery,
  useCreateAdminPartnerOnboardingTermMutation,
  useUpdateAdminPartnerOnboardingTermMutation,
  useDeleteAdminPartnerOnboardingTermMutation,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import {
  adminPartnerDocumentCreateSchema,
  adminPartnerTermCreateSchema,
  type AdminPartnerDocumentCreateValues,
  type AdminPartnerTermCreateValues,
} from "@/lib/adminFormSchemas";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
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
  both: "All modules",
  dining: "Dining only",
  event: "Event only",
  venue: "Venue only",
};

export default function AdminPartnerDocumentsPage() {
  const [moduleFilter, setModuleFilter] = useState<"" | "dining" | "event" | "venue" | "artist" | "both">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const queryArg = {
    page,
    limit,
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
  const { data: terms = [] } = useGetAdminPartnerOnboardingTermsQuery(moduleFilter ? { module: moduleFilter } : undefined);
  const [createTerm, { isLoading: creatingTerm }] = useCreateAdminPartnerOnboardingTermMutation();
  const [updateTerm] = useUpdateAdminPartnerOnboardingTermMutation();
  const [deleteTerm] = useDeleteAdminPartnerOnboardingTermMutation();
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    body: string;
    confirmLabel?: string;
    danger?: boolean;
    variant?: "danger" | "success" | "warning";
    run: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const docForm = useForm<AdminPartnerDocumentCreateValues>({
    resolver: yupResolver(adminPartnerDocumentCreateSchema),
    defaultValues: {
      name: "",
      description: "",
      module: "both",
      is_required: false,
    },
    mode: "onSubmit",
  });

  const termForm = useForm<AdminPartnerTermCreateValues>({
    resolver: yupResolver(adminPartnerTermCreateSchema),
    defaultValues: { text: "", module: "both" },
    mode: "onSubmit",
  });

  const onCreateDocument = async (values: AdminPartnerDocumentCreateValues) => {
    try {
      const created = await createDocument({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        module: values.module,
        is_required: values.is_required,
        is_active: true,
      }).unwrap();
      toast.success(
        (created as { message?: string }).message ||
          `"${created.name}" added — it now appears on partner onboarding`
      );
      docForm.reset({
        name: "",
        description: "",
        module: values.module,
        is_required: false,
      });
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to add document type"));
    }
  };

  const onCreateTerm = async (values: AdminPartnerTermCreateValues) => {
    try {
      const created = await createTerm({
        text: values.text.trim(),
        module: values.module,
        is_active: true,
      }).unwrap();
      toast.success(
        (created as { message?: string }).message || "Onboarding term added"
      );
      termForm.reset({ text: "", module: values.module });
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to add onboarding term"));
    }
  };

  const listLoading = isLoading && documents.length === 0;

  return (
    <div className="w-full space-y-6">
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="glass-panel p-6 border border-white/5 rounded-2xl">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Plus size={18} className="text-rose-500" /> Add document type
          </h3>
          <form onSubmit={docForm.handleSubmit(onCreateDocument)} noValidate className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">
                Document name <span className="text-rose-500">*</span>
              </label>
              <input
                {...docForm.register("name")}
                placeholder="e.g. Fire Safety Certificate"
                className="input-field w-full"
              />
              {docForm.formState.errors.name && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">
                  {docForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Description / examples</label>
              <textarea
                rows={3}
                {...docForm.register("description")}
                className="input-field w-full resize-y min-h-[80px]"
                placeholder="What partners should upload..."
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">Applies to</label>
              <select {...docForm.register("module")} className="input-field w-full">
                <option value="both">All modules</option>
                <option value="dining">Dining only</option>
                <option value="event">Event only</option>
                <option value="venue">Venue only</option>
                <option value="artist">Artist only</option>
              </select>
              {docForm.formState.errors.module && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">
                  {docForm.formState.errors.module.message}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
              <input type="checkbox" {...docForm.register("is_required")} className="rounded" />
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
                  setModuleFilter(e.target.value as "" | "dining" | "event" | "venue" | "artist" | "both");
                  setPage(1);
                }}
                className="input-field text-sm py-2 w-auto min-w-[160px]"
              >
                <option value="">All modules</option>
                <option value="both">All modules</option>
                <option value="dining">Dining only</option>
                <option value="event">Event only</option>
                <option value="venue">Venue only</option>
                <option value="artist">Artist only</option>
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
            <AdminListShimmer rows={6} columns={4} showTabs={false} showToolbar={false} />
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
                          <span className="text-[0.625rem] uppercase px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            Required
                          </span>
                        )}
                        <span className="text-[0.625rem] uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-white/10">
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
                          onToggle={() => {
                            const next = !doc.is_active;
                            setPendingConfirm({
                              title: next ? "Enable document?" : "Disable document?",
                              body: next
                                ? `Enable "${doc.name}"? It will be shown on onboarding.`
                                : `Disable "${doc.name}"? It will be hidden from forms until you enable it again.`,
                              confirmLabel: next ? "Enable" : "Disable",
                              danger: false,
                              variant: next ? "success" : "warning",
                              run: async () => {
                                await updateDocument({
                                  id: doc.id,
                                  body: { is_active: next },
                                }).unwrap();
                                toast.success(
                                  next
                                    ? `"${doc.name}" is active — shown on onboarding`
                                    : `"${doc.name}" is inactive — hidden from forms`
                                );
                              },
                            });
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
          <div className="admin-list-footer">
            <Pagination
              meta={
                documentsData?.meta ?? {
                  page,
                  limit,
                  total: 0,
                  total_pages: 0,
                  has_prev: false,
                  has_next: false,
                }
              }
              onPageChange={setPage}
              onLimitChange={(next) => {
                setLimit(next);
                setPage(1);
              }}
              disabled={isFetching}
            />
          </div>
        </div>
      </div>

      <div className="glass-panel border border-white/5 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Onboarding Terms Master (Popup Content)</h3>
        <p className="text-zinc-400 text-sm mb-4">
          These terms are shown in the registration popup before partner submission.
        </p>
        <form
          onSubmit={termForm.handleSubmit(onCreateTerm)}
          noValidate
          className="grid md:grid-cols-[1fr_180px_auto] gap-3 mb-4"
        >
          <div>
            <input
              {...termForm.register("text")}
              placeholder="e.g. I confirm all uploaded documents are valid."
              className="input-field w-full"
            />
            {termForm.formState.errors.text && (
              <p className="mt-1.5 text-xs text-rose-400 font-medium">
                {termForm.formState.errors.text.message}
              </p>
            )}
          </div>
          <select {...termForm.register("module")} className="input-field">
            <option value="both">All modules</option>
            <option value="dining">Dining only</option>
            <option value="event">Event only</option>
            <option value="venue">Venue only</option>
            <option value="artist">Artist only</option>
          </select>
          <button type="submit" disabled={creatingTerm} className="btn-primary disabled:opacity-50">
            Add term
          </button>
        </form>

        <div className="space-y-2">
          {terms.map((term) => (
            <div key={term.id} className="p-3 rounded-xl border border-white/10 bg-black/10 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-zinc-100">{term.text}</p>
                <p className="text-xs text-zinc-500 mt-1">{MODULE_LABEL[term.module] || term.module}</p>
              </div>
              <div className="flex items-center gap-2">
                <ActiveToggle
                  active={!!term.is_active}
                  onToggle={() => {
                    const next = !term.is_active;
                    const preview =
                      term.text.length > 60 ? `${term.text.slice(0, 60)}…` : term.text;
                    setPendingConfirm({
                      title: next ? "Enable term?" : "Disable term?",
                      body: next
                        ? `Enable "${preview}"? It will be shown on onboarding.`
                        : `Disable "${preview}"? It will be hidden until you enable it again.`,
                      confirmLabel: next ? "Enable" : "Disable",
                      danger: false,
                      variant: next ? "success" : "warning",
                      run: async () => {
                        await updateTerm({
                          id: term.id,
                          body: { is_active: next },
                        }).unwrap();
                        toast.success(
                          next
                            ? "Term is active — shown on onboarding"
                            : "Term is inactive — hidden from onboarding"
                        );
                      },
                    });
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await deleteTerm(term.id).unwrap();
                      toast.success("Term deleted");
                    } catch (err: unknown) {
                      toast.error(extractApiError(err, "Failed to delete term"));
                    }
                  }}
                  className="text-zinc-500 hover:text-rose-400 p-1"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          {terms.length === 0 && <p className="text-sm text-zinc-500">No onboarding terms yet.</p>}
        </div>
      </div>
      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title || ""}
        body={pendingConfirm?.body || ""}
        confirmLabel={pendingConfirm?.confirmLabel || "Delete"}
        danger={pendingConfirm?.danger ?? true}
        variant={pendingConfirm?.variant}
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setPendingConfirm(null)}
        onConfirm={async () => {
          if (!pendingConfirm) return;
          setConfirmBusy(true);
          try {
            await pendingConfirm.run();
            setPendingConfirm(null);
          } catch (err: unknown) {
            toast.error(extractApiError(err, "Action failed"));
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}
