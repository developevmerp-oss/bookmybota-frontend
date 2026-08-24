"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import { ListChecks, Plus, Trash2, Tags, FileText } from "lucide-react";
import {
  useGetBusinessTypesQuery,
  useGetAdminEventGenresQuery,
  useCreateAdminEventGenreMutation,
  useUpdateAdminEventGenreMutation,
  useDeleteAdminEventGenreMutation,
  useGetAdminEventDocumentsQuery,
  useCreateAdminEventDocumentMutation,
  useUpdateAdminEventDocumentMutation,
  useDeleteAdminEventDocumentMutation,
  useGetAdminEventTermsQuery,
  useCreateAdminEventTermMutation,
  useUpdateAdminEventTermMutation,
  useDeleteAdminEventTermMutation,
  type EventDocumentMaster,
  type EventGenreMaster,
  type EventTermsMaster,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import {
  adminEventDocumentCreateSchema,
  adminEventGenreCreateSchema,
  adminEventTermCreateSchema,
  type AdminEventDocumentCreateValues,
  type AdminEventGenreCreateValues,
  type AdminEventTermCreateValues,
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
        active
          ? "bg-green-500/30 border-green-500/50"
          : "bg-zinc-700/50 border-zinc-600"
      }`}
      title={active ? "Active — visible to organizers" : "Inactive — hidden from organizers"}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          active ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function AdminEventMastersPage() {
  const [tab, setTab] = useState<"genres" | "documents" | "terms">("genres");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const eventCategories = useMemo(
    () => businessTypes.filter((t) => t.module_key === "event" && t.parent_type_id),
    [businessTypes]
  );

  const genreQueryArg = useMemo(
    () => ({
      page,
      limit,
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(categoryFilter ? { category_type_id: Number(categoryFilter) } : {}),
    }),
    [categoryFilter, q, page, limit]
  );

  const {
    data: genresData,
    isLoading: genresLoading,
    isFetching: genresFetching,
    isError: genresError,
    error: genresErrorData,
    refetch: refetchGenres,
  } = useGetAdminEventGenresQuery(genreQueryArg);
  const genres = genresData?.items ?? [];

  const [createGenre, { isLoading: creatingGenre }] = useCreateAdminEventGenreMutation();
  const [updateGenre] = useUpdateAdminEventGenreMutation();
  const [deleteGenre] = useDeleteAdminEventGenreMutation();

  const {
    data: documentsData,
    isLoading: docsLoading,
    isFetching: docsFetching,
    isError: docsError,
    error: docsErrorData,
    refetch: refetchDocs,
  } = useGetAdminEventDocumentsQuery({
    page,
    limit,
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const documents = documentsData?.items ?? [];

  const [createDocument, { isLoading: creatingDoc }] = useCreateAdminEventDocumentMutation();
  const [updateDocument] = useUpdateAdminEventDocumentMutation();
  const [deleteDocument] = useDeleteAdminEventDocumentMutation();

  const {
    data: termsData,
    isLoading: termsLoading,
    isFetching: termsFetching,
    isError: termsError,
    error: termsErrorData,
    refetch: refetchTerms,
  } = useGetAdminEventTermsQuery({
    page,
    limit,
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const terms = termsData?.items ?? [];
  const [createTerm, { isLoading: creatingTerm }] = useCreateAdminEventTermMutation();
  const [updateTerm] = useUpdateAdminEventTermMutation();
  const [deleteTerm] = useDeleteAdminEventTermMutation();
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    body: string;
    run: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const genreForm = useForm<AdminEventGenreCreateValues>({
    resolver: yupResolver(adminEventGenreCreateSchema),
    defaultValues: { category_type_id: "", name: "" },
    mode: "onSubmit",
  });

  const docForm = useForm<AdminEventDocumentCreateValues>({
    resolver: yupResolver(adminEventDocumentCreateSchema),
    defaultValues: {
      name: "",
      description: "",
      category_type_id: "",
      is_required: false,
      importance_level: 3,
    },
    mode: "onSubmit",
  });

  const termForm = useForm<AdminEventTermCreateValues>({
    resolver: yupResolver(adminEventTermCreateSchema),
    defaultValues: { text: "" },
    mode: "onSubmit",
  });

  const onCreateGenre = async (values: AdminEventGenreCreateValues) => {
    try {
      const created = await createGenre({
        category_type_id: Number(values.category_type_id),
        name: values.name.trim(),
        is_active: true,
      }).unwrap();
      toast.success(
        (created as { message?: string }).message ||
          `Genre "${created.name}" added successfully`
      );
      genreForm.reset({ category_type_id: values.category_type_id, name: "" });
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to add genre"));
    }
  };

  const onCreateDocument = async (values: AdminEventDocumentCreateValues) => {
    try {
      const created = await createDocument({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        category_type_id: values.category_type_id
          ? Number(values.category_type_id)
          : null,
        is_required: values.is_required ?? false,
        importance_level: values.importance_level ?? 3,
        is_active: true,
      }).unwrap();
      toast.success(
        (created as { message?: string }).message ||
          `Document "${created.name}" added successfully`
      );
      docForm.reset({
        name: "",
        description: "",
        category_type_id: values.category_type_id ?? "",
        is_required: false,
        importance_level: 3,
      });
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to add document"));
    }
  };

  const toggleGenreActive = async (genre: EventGenreMaster) => {
    const next = !genre.is_active;
    try {
      await updateGenre({
        id: genre.id,
        body: { is_active: next },
      }).unwrap();
      toast.success(
        next
          ? `"${genre.name}" is now active — organizers can see it`
          : `"${genre.name}" is inactive — hidden from organizers`
      );
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to update genre status"));
    }
  };

  const toggleDocRequired = async (doc: EventDocumentMaster) => {
    try {
      await updateDocument({
        id: doc.id,
        body: { is_required: !doc.is_required },
      }).unwrap();
      toast.success(
        doc.is_required ? `"${doc.name}" is now optional` : `"${doc.name}" is now required`
      );
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to update document"));
    }
  };

  const toggleDocActive = async (doc: EventDocumentMaster) => {
    const next = !doc.is_active;
    try {
      await updateDocument({
        id: doc.id,
        body: { is_active: next },
      }).unwrap();
      toast.success(
        next
          ? `"${doc.name}" is active — organizers can see it`
          : `"${doc.name}" is inactive — hidden from organizers`
      );
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to update document status"));
    }
  };

  const onAddTerm = async (values: AdminEventTermCreateValues) => {
    try {
      const created = await createTerm({
        text: values.text.trim(),
        is_active: true,
      }).unwrap();
      toast.success(
        (created as { message?: string }).message ||
          "Terms & conditions point added"
      );
      termForm.reset({ text: "" });
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to add T&C point"));
    }
  };

  const toggleTermActive = async (term: EventTermsMaster) => {
    const next = !term.is_active;
    try {
      await updateTerm({ id: term.id, body: { is_active: next } }).unwrap();
      toast.success(
        next
          ? "T&C point is active — organizers can select it"
          : "T&C point is inactive — hidden from organizers"
      );
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to update T&C status"));
    }
  };

  const genreListLoading = genresLoading && genres.length === 0;
  const docListLoading = docsLoading && documents.length === 0;

  return (
    <div className="w-full space-y-6">
      <div className="admin-list-toolbar">
        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search this list"
        />
      </div>

      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => {
            setTab("genres");
            setPage(1);
          }}
          className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            tab === "genres"
              ? "border-rose-500 text-rose-400"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Tags size={16} /> Genre Master
        </button>
        <button
          onClick={() => {
            setTab("documents");
            setPage(1);
          }}
          className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            tab === "documents"
              ? "border-rose-500 text-rose-400"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <ListChecks size={16} /> Document Master
        </button>
        <button
          onClick={() => {
            setTab("terms");
            setPage(1);
          }}
          className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            tab === "terms"
              ? "border-rose-500 text-rose-400"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <FileText size={16} /> Customer Event T&C
        </button>
      </div>

      {tab === "genres" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="glass-panel p-6 border border-white/5 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus size={18} className="text-rose-500" /> Add genre
            </h3>
            <form onSubmit={genreForm.handleSubmit(onCreateGenre)} noValidate className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Category</label>
                <select {...genreForm.register("category_type_id")} className="input-field w-full">
                  <option value="">Select Comedy / Music / Concert</option>
                  {eventCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {genreForm.formState.errors.category_type_id && (
                  <p className="mt-1.5 text-xs text-rose-400 font-medium">
                    {genreForm.formState.errors.category_type_id.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Genre name</label>
                <input
                  {...genreForm.register("name")}
                  placeholder="e.g. Stand-up Comedy"
                  className="input-field w-full"
                />
                {genreForm.formState.errors.name && (
                  <p className="mt-1.5 text-xs text-rose-400 font-medium">
                    {genreForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <p className="text-xs text-zinc-500">New genres are active by default.</p>
              <button type="submit" disabled={creatingGenre} className="btn-primary w-full disabled:opacity-50">
                {creatingGenre ? "Adding..." : "Add genre"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 glass-panel border border-white/5 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-zinc-400">Filter by category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  className="input-field text-sm py-2 w-auto min-w-[160px]"
                >
                  <option value="">All categories</option>
                  {eventCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-xs text-zinc-500">
                {genres.length} genre{genres.length !== 1 ? "s" : ""}
                {genresFetching && !genreListLoading ? " · refreshing…" : ""}
              </span>
            </div>

            {genreListLoading ? (
              <AdminListShimmer rows={6} columns={4} showTabs={false} showToolbar={false} />
            ) : genresError ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-rose-400">{extractApiError(genresErrorData, "Failed to load genres")}</p>
                <button onClick={() => refetchGenres()} className="text-sm text-zinc-400 hover:text-white underline">
                  Retry
                </button>
              </div>
            ) : genres.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">No genres yet. Add one using the form.</div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900/50 text-zinc-400 border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Genre</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {genres.map((g) => (
                    <tr
                      key={g.id}
                      className={`text-zinc-300 ${!g.is_active ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3">{g.category_name || "—"}</td>
                      <td className="px-4 py-3 font-medium text-white">{g.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ActiveToggle active={g.is_active} onToggle={() => toggleGenreActive(g)} />
                          <span className={`text-xs ${g.is_active ? "text-green-400" : "text-zinc-500"}`}>
                            {g.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() =>
                            setPendingConfirm({
                              title: "Delete genre?",
                              body: `Delete genre "${g.name}"?`,
                              run: async () => {
                                await deleteGenre(g.id).unwrap();
                                toast.success(`Genre "${g.name}" deleted`);
                              },
                            })
                          }
                          className="text-zinc-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
            <div className="admin-list-footer">
              <Pagination
                meta={
                  genresData?.meta ?? {
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
                disabled={genresFetching}
              />
            </div>
          </div>
        </div>
      )}

      {tab === "documents" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="glass-panel p-6 border border-white/5 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus size={18} className="text-rose-500" /> Add document type
            </h3>
            <form onSubmit={docForm.handleSubmit(onCreateDocument)} noValidate className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Document name</label>
                <input
                  {...docForm.register("name")}
                  placeholder="Venue Booking Agreement"
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
                  placeholder="What organizers should upload..."
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Applies to category</label>
                <select {...docForm.register("category_type_id")} className="input-field w-full">
                  <option value="">All event categories</option>
                  {eventCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} only
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">Priority (1–5)</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    {...docForm.register("importance_level", { valueAsNumber: true })}
                    className="input-field w-full"
                  />
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm text-zinc-300 cursor-pointer">
                  <input type="checkbox" {...docForm.register("is_required")} className="rounded" />
                  Required on submit
                </label>
              </div>
              <p className="text-xs text-zinc-500">New document types are active by default.</p>
              <button type="submit" disabled={creatingDoc} className="btn-primary w-full disabled:opacity-50">
                {creatingDoc ? "Adding..." : "Add document type"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 glass-panel border border-white/5 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <span className="text-sm text-zinc-400">All document types</span>
              <span className="text-xs text-zinc-500">
                {documents.length} item{documents.length !== 1 ? "s" : ""}
                {docsFetching && !docListLoading ? " · refreshing…" : ""}
              </span>
            </div>

            {docListLoading ? (
              <AdminListShimmer rows={6} columns={4} showTabs={false} showToolbar={false} />
            ) : docsError ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-rose-400">{extractApiError(docsErrorData, "Failed to load documents")}</p>
                <button onClick={() => refetchDocs()} className="text-sm text-zinc-400 hover:text-white underline">
                  Retry
                </button>
              </div>
            ) : documents.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">No document types yet.</div>
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
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">
                          {doc.category_name ? `${doc.category_name} only` : "All event categories"}
                        </p>
                        {doc.description && (
                          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{doc.description}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <div className="flex items-center gap-2 mr-2">
                          <ActiveToggle active={doc.is_active} onToggle={() => toggleDocActive(doc)} />
                          <span className={`text-xs ${doc.is_active ? "text-green-400" : "text-zinc-500"}`}>
                            {doc.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleDocRequired(doc)}
                          className="text-xs px-2 py-1 rounded border border-white/10 text-zinc-400 hover:text-white"
                        >
                          {doc.is_required ? "Make optional" : "Make required"}
                        </button>
                        <button
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
                disabled={docsFetching}
              />
            </div>
          </div>
        </div>
      )}

      {tab === "terms" && (
        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
            <h3 className="text-white font-bold mb-1">Add customer event T&C</h3>
            <p className="text-zinc-500 text-sm mb-4">
              Super admin master points. Event organizers can tick these on their event. Custom points they type themselves are stored only on that event — never here.
            </p>
            <form
              onSubmit={termForm.handleSubmit(onAddTerm)}
              noValidate
              className="space-y-2"
            >
              <div className="flex gap-3">
                <input
                  {...termForm.register("text")}
                  placeholder="e.g. Tickets are non-refundable after purchase"
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white"
                />
                <button
                  type="submit"
                  disabled={creatingTerm}
                  className="px-5 py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl font-semibold flex items-center gap-2"
                >
                  <Plus size={16} /> Add
                </button>
              </div>
              {termForm.formState.errors.text && (
                <p className="text-xs text-rose-400 font-medium">
                  {termForm.formState.errors.text.message}
                </p>
              )}
            </form>
          </div>

          <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white font-bold">Master T&C points</h3>
              <button type="button" onClick={() => refetchTerms()} className="text-xs text-zinc-400 hover:text-white">
                Refresh
              </button>
            </div>
            {termsError ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-rose-400">{extractApiError(termsErrorData, "Could not load T&C master")}</p>
                <button type="button" onClick={() => refetchTerms()} className="text-sm text-rose-300 underline">
                  Retry
                </button>
              </div>
            ) : termsLoading && terms.length === 0 ? (
              <AdminListShimmer rows={6} columns={3} showTabs={false} showToolbar={false} />
            ) : terms.length === 0 ? (
              <p className="p-8 text-zinc-500 text-center">No T&C points yet. Add the first one above.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {termsFetching && terms.length > 0 && (
                  <p className="px-6 py-2 text-xs text-zinc-500">Refreshing…</p>
                )}
                {terms.map((term) => (
                  <div key={term.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <p className="text-white text-sm leading-relaxed">{term.text}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <ActiveToggle active={term.is_active} onToggle={() => toggleTermActive(term)} />
                      <span className={`text-xs ${term.is_active ? "text-green-400" : "text-zinc-500"}`}>
                        {term.is_active ? "Active" : "Inactive"}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingConfirm({
                            title: "Delete T&C point?",
                            body: "Delete this T&C point from the master list?",
                            run: async () => {
                              await deleteTerm(term.id).unwrap();
                              toast.success("T&C point deleted");
                            },
                          })
                        }
                        className="text-zinc-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="admin-list-footer">
              <Pagination
                meta={
                  termsData?.meta ?? {
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
                disabled={termsFetching}
              />
            </div>
          </div>
        </div>
      )}
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
