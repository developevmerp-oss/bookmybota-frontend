"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ListChecks, Plus, Trash2, Tags } from "lucide-react";
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
  type EventDocumentMaster,
  type EventGenreMaster,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";

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
  const [tab, setTab] = useState<"genres" | "documents">("genres");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const eventCategories = useMemo(
    () => businessTypes.filter((t) => t.module_key === "event" && t.parent_type_id),
    [businessTypes]
  );

  const genreQueryArg = useMemo(
    () => (categoryFilter ? { category_type_id: Number(categoryFilter) } : {}),
    [categoryFilter]
  );

  const {
    data: genres = [],
    isLoading: genresLoading,
    isFetching: genresFetching,
    isError: genresError,
    error: genresErrorData,
    refetch: refetchGenres,
  } = useGetAdminEventGenresQuery(genreQueryArg);

  const [createGenre, { isLoading: creatingGenre }] = useCreateAdminEventGenreMutation();
  const [updateGenre] = useUpdateAdminEventGenreMutation();
  const [deleteGenre] = useDeleteAdminEventGenreMutation();

  const {
    data: documents = [],
    isLoading: docsLoading,
    isFetching: docsFetching,
    isError: docsError,
    error: docsErrorData,
    refetch: refetchDocs,
  } = useGetAdminEventDocumentsQuery({});

  const [createDocument, { isLoading: creatingDoc }] = useCreateAdminEventDocumentMutation();
  const [updateDocument] = useUpdateAdminEventDocumentMutation();
  const [deleteDocument] = useDeleteAdminEventDocumentMutation();

  const [newGenre, setNewGenre] = useState({ category_type_id: "", name: "" });
  const [newDoc, setNewDoc] = useState({
    name: "",
    description: "",
    category_type_id: "",
    is_required: false,
    importance_level: 3,
  });

  const handleCreateGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGenre.category_type_id || !newGenre.name.trim()) {
      toast.error("Category and genre name are required");
      return;
    }
    try {
      const created = await createGenre({
        category_type_id: Number(newGenre.category_type_id),
        name: newGenre.name.trim(),
        is_active: true,
      }).unwrap();
      toast.success(`Genre "${created.name}" added successfully`);
      setNewGenre({ category_type_id: newGenre.category_type_id, name: "" });
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to add genre"));
    }
  };

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.name.trim()) {
      toast.error("Document name is required");
      return;
    }
    try {
      const created = await createDocument({
        name: newDoc.name.trim(),
        description: newDoc.description.trim() || undefined,
        category_type_id: newDoc.category_type_id ? Number(newDoc.category_type_id) : null,
        is_required: newDoc.is_required,
        importance_level: newDoc.importance_level,
        is_active: true,
      }).unwrap();
      toast.success(`Document "${created.name}" added successfully`);
      setNewDoc({
        name: "",
        description: "",
        category_type_id: "",
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

  const genreListLoading = genresLoading && genres.length === 0;
  const docListLoading = docsLoading && documents.length === 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <span className="bg-rose-500/20 text-rose-500 p-2 rounded-xl">
            <ListChecks size={28} />
          </span>
          Event Masters
        </h1>
        <p className="text-zinc-400 mt-2">
          Manage category-linked genres and required event documents. Only <strong className="text-green-400/90">active</strong> items appear in the event organizer form.
        </p>
      </div>

      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setTab("genres")}
          className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            tab === "genres"
              ? "border-rose-500 text-rose-400"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <Tags size={16} /> Genre Master
        </button>
        <button
          onClick={() => setTab("documents")}
          className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            tab === "documents"
              ? "border-rose-500 text-rose-400"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <ListChecks size={16} /> Document Master
        </button>
      </div>

      {tab === "genres" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="glass-panel p-6 border border-white/5 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus size={18} className="text-rose-500" /> Add genre
            </h3>
            <form onSubmit={handleCreateGenre} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Category</label>
                <select
                  value={newGenre.category_type_id}
                  onChange={(e) => setNewGenre((p) => ({ ...p, category_type_id: e.target.value }))}
                  className="input-field w-full"
                  required
                >
                  <option value="">Select Comedy / Music / Concert</option>
                  {eventCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Genre name</label>
                <input
                  value={newGenre.name}
                  onChange={(e) => setNewGenre((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Stand-up Comedy"
                  className="input-field w-full"
                  required
                />
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
                  onChange={(e) => setCategoryFilter(e.target.value)}
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
              <div className="p-8 text-center text-zinc-500">Loading genres...</div>
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
                          onClick={async () => {
                            if (!confirm(`Delete genre "${g.name}"?`)) return;
                            try {
                              await deleteGenre(g.id).unwrap();
                              toast.success(`Genre "${g.name}" deleted`);
                            } catch (err: unknown) {
                              toast.error(extractApiError(err, "Delete failed"));
                            }
                          }}
                          className="text-zinc-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "documents" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="glass-panel p-6 border border-white/5 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus size={18} className="text-rose-500" /> Add document type
            </h3>
            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Document name</label>
                <input
                  value={newDoc.name}
                  onChange={(e) => setNewDoc((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Venue Booking Agreement"
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
                  placeholder="What organizers should upload..."
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Applies to category</label>
                <select
                  value={newDoc.category_type_id}
                  onChange={(e) => setNewDoc((p) => ({ ...p, category_type_id: e.target.value }))}
                  className="input-field w-full"
                >
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
                    value={newDoc.importance_level}
                    onChange={(e) =>
                      setNewDoc((p) => ({ ...p, importance_level: Number(e.target.value) }))
                    }
                    className="input-field w-full"
                  />
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newDoc.is_required}
                    onChange={(e) => setNewDoc((p) => ({ ...p, is_required: e.target.checked }))}
                    className="rounded"
                  />
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
              <div className="p-8 text-center text-zinc-500">Loading documents...</div>
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
                            <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
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
                          onClick={async () => {
                            if (!confirm(`Delete "${doc.name}"?`)) return;
                            try {
                              await deleteDocument(doc.id).unwrap();
                              toast.success(`"${doc.name}" deleted`);
                            } catch (err: unknown) {
                              toast.error(extractApiError(err, "Delete failed"));
                            }
                          }}
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
          </div>
        </div>
      )}
    </div>
  );
}
