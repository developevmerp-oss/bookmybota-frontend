"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Archive, Film, Pencil, Plus } from "lucide-react";
import {
  useCreateAdminMovieMutation,
  useDeleteAdminMovieMutation,
  useGetAdminMoviesQuery,
  useUpdateAdminMovieMutation,
  useUploadImageMutation,
  type Movie,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { PAGE_SIZE } from "@/lib/pagination";

const STATUS_OPTIONS: Movie["status"][] = ["draft", "coming_soon", "now_showing", "archived"];

const STATUS_LABEL: Record<Movie["status"], string> = {
  draft: "Draft",
  coming_soon: "Coming soon",
  now_showing: "Now showing",
  archived: "Archived",
};

const emptyForm = {
  title: "",
  description: "",
  poster_url: "",
  banner_url: "",
  trailer_url: "",
  duration_minutes: "",
  certificate: "",
  release_date: "",
  languages: "",
  genres: "",
  cast_text: "",
  director: "",
  status: "draft" as Movie["status"],
};

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function joinCsv(value?: string[] | null): string {
  return Array.isArray(value) ? value.join(", ") : "";
}

export default function AdminMoviesPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [editing, setEditing] = useState<Movie | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Movie | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const queryArg = useMemo(
    () => ({
      page,
      limit,
      ...(q.trim() ? { q: q.trim() } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    [q, page, limit, statusFilter]
  );

  const { data, isLoading, isFetching } = useGetAdminMoviesQuery(queryArg);
  const movies = data?.items ?? [];
  const [createMovie] = useCreateAdminMovieMutation();
  const [updateMovie] = useUpdateAdminMovieMutation();
  const [deleteMovie] = useDeleteAdminMovieMutation();
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (movie: Movie) => {
    setEditing(movie);
    setForm({
      title: movie.title || "",
      description: movie.description || "",
      poster_url: movie.poster_url || "",
      banner_url: movie.banner_url || "",
      trailer_url: movie.trailer_url || "",
      duration_minutes: movie.duration_minutes != null ? String(movie.duration_minutes) : "",
      certificate: movie.certificate || "",
      release_date: movie.release_date ? String(movie.release_date).slice(0, 10) : "",
      languages: joinCsv(movie.languages),
      genres: joinCsv(movie.genres),
      cast_text: movie.cast_text || "",
      director: movie.director || "",
      status: movie.status || "draft",
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setBusy(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      poster_url: form.poster_url.trim() || null,
      banner_url: form.banner_url.trim() || null,
      trailer_url: form.trailer_url.trim() || null,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      certificate: form.certificate.trim() || null,
      release_date: form.release_date || null,
      languages: splitCsv(form.languages),
      genres: splitCsv(form.genres),
      cast_text: form.cast_text.trim() || null,
      director: form.director.trim() || null,
      status: form.status,
    };
    try {
      if (editing) {
        await updateMovie({ id: editing.id, body: payload }).unwrap();
        toast.success("Movie updated");
      } else {
        await createMovie(payload).unwrap();
        toast.success("Movie created");
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save movie"));
    } finally {
      setBusy(false);
    }
  };

  const runArchive = async () => {
    if (!archiveTarget) return;
    setArchiveBusy(true);
    try {
      await deleteMovie(archiveTarget.id).unwrap();
      toast.success("Movie archived");
      setArchiveTarget(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to archive"));
    } finally {
      setArchiveBusy(false);
    }
  };

  return (
    <div className="w-full space-y-6" data-admin-page="movies">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Film size={20} className="text-rose-500" /> Movies
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Platform movie catalog. Cinema partners will pick from this list when scheduling shows.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
          <Plus size={16} /> Add movie
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          className="w-full sm:max-w-sm"
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search title, director, cast"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="input-field sm:w-48"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <AdminListShimmer rows={6} columns={5} showToolbar={false} />
      ) : movies.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-slate-500">
          No movies yet. Add the first title to the catalog.
        </div>
      ) : (
        <div className={`rounded-2xl border border-slate-200 bg-white overflow-hidden ${isFetching ? "opacity-70" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Movie</th>
                  <th className="px-4 py-3 font-semibold">Runtime</th>
                  <th className="px-4 py-3 font-semibold">Release</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movies.map((movie) => (
                  <tr key={movie.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {movie.poster_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={movie.poster_url}
                            alt=""
                            className="w-10 h-14 rounded object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-14 rounded bg-slate-100 border border-slate-200 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{movie.title}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {[movie.certificate, (movie.languages || []).join(" / "), (movie.genres || []).slice(0, 2).join(", ")]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {movie.duration_minutes ? `${movie.duration_minutes} min` : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {movie.release_date ? String(movie.release_date).slice(0, 10) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {STATUS_LABEL[movie.status] || movie.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(movie)}
                          className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        {movie.status !== "archived" && (
                          <button
                            type="button"
                            onClick={() => setArchiveTarget(movie)}
                            className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50"
                            title="Archive"
                          >
                            <Archive size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="admin-list-footer">
        <Pagination
          meta={
            data?.meta ?? {
              page,
              limit,
              total: 0,
              total_pages: 0,
              has_prev: false,
              has_next: false,
            }
          }
          disabled={isFetching || busy}
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-zinc-950 z-10">
              <h3 className="text-white font-semibold">{editing ? "Edit movie" : "Add movie"}</h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="portal-label">Title *</label>
                <input
                  className="input-field"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="portal-label">Status</label>
                <select
                  className="input-field"
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.value as Movie["status"] }))
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="portal-label">Certificate</label>
                <input
                  className="input-field"
                  placeholder="UA / U / A"
                  value={form.certificate}
                  onChange={(e) => setForm((prev) => ({ ...prev, certificate: e.target.value }))}
                />
              </div>
              <div>
                <label className="portal-label">Duration (minutes)</label>
                <input
                  className="input-field"
                  type="number"
                  min={1}
                  value={form.duration_minutes}
                  onChange={(e) => setForm((prev) => ({ ...prev, duration_minutes: e.target.value }))}
                />
              </div>
              <div>
                <label className="portal-label">Release date</label>
                <input
                  className="input-field"
                  type="date"
                  value={form.release_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, release_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="portal-label">Languages (comma-separated)</label>
                <input
                  className="input-field"
                  placeholder="English, Hindi"
                  value={form.languages}
                  onChange={(e) => setForm((prev) => ({ ...prev, languages: e.target.value }))}
                />
              </div>
              <div>
                <label className="portal-label">Genres (comma-separated)</label>
                <input
                  className="input-field"
                  placeholder="Action, Sci-Fi"
                  value={form.genres}
                  onChange={(e) => setForm((prev) => ({ ...prev, genres: e.target.value }))}
                />
              </div>
              <div>
                <label className="portal-label">Director</label>
                <input
                  className="input-field"
                  value={form.director}
                  onChange={(e) => setForm((prev) => ({ ...prev, director: e.target.value }))}
                />
              </div>
              <div>
                <label className="portal-label">Trailer URL</label>
                <input
                  className="input-field"
                  value={form.trailer_url}
                  onChange={(e) => setForm((prev) => ({ ...prev, trailer_url: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="portal-label">Cast</label>
                <textarea
                  className="input-field min-h-[72px]"
                  value={form.cast_text}
                  onChange={(e) => setForm((prev) => ({ ...prev, cast_text: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className="portal-label">Description</label>
                <textarea
                  className="input-field min-h-[96px]"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div>
                <label className="portal-label">Poster</label>
                <CroppedImageField
                  value={form.poster_url}
                  aspect={2 / 3}
                  previewClassName="w-full h-48 rounded-xl border border-white/10"
                  emptyClassName="flex flex-col items-center justify-center w-full h-48 border-2 border-zinc-700 border-dashed rounded-xl bg-zinc-900/50"
                  emptyLabel="Add poster"
                  onRemove={() => setForm((prev) => ({ ...prev, poster_url: "" }))}
                  onCroppedFile={async (file) => {
                    try {
                      const fd = new FormData();
                      fd.append("image", file);
                      const res = await uploadImage(fd).unwrap();
                      if (!res.url) return;
                      setForm((prev) => ({ ...prev, poster_url: res.url }));
                    } catch (err) {
                      toast.error(extractApiError(err, "Poster upload failed"));
                    }
                  }}
                />
              </div>
              <div>
                <label className="portal-label">Banner</label>
                <CroppedImageField
                  value={form.banner_url}
                  aspect={16 / 9}
                  previewClassName="w-full h-40 rounded-xl border border-white/10"
                  emptyClassName="flex flex-col items-center justify-center w-full h-40 border-2 border-zinc-700 border-dashed rounded-xl bg-zinc-900/50"
                  emptyLabel="Add banner"
                  onRemove={() => setForm((prev) => ({ ...prev, banner_url: "" }))}
                  onCroppedFile={async (file) => {
                    try {
                      const fd = new FormData();
                      fd.append("image", file);
                      const res = await uploadImage(fd).unwrap();
                      if (!res.url) return;
                      setForm((prev) => ({ ...prev, banner_url: res.url }));
                    } catch (err) {
                      toast.error(extractApiError(err, "Banner upload failed"));
                    }
                  }}
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-2 sticky bottom-0 bg-zinc-950">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={save} disabled={busy || uploading} className="btn-primary">
                {busy ? "Saving…" : editing ? "Save changes" : "Create movie"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        title="Archive movie?"
        body={
          archiveTarget
            ? `Archive "${archiveTarget.title}"? Partners will no longer see it in the active catalog.`
            : ""
        }
        confirmLabel="Archive"
        danger
        busy={archiveBusy}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={runArchive}
      />

      <p className="text-xs text-zinc-500">
        Need a cinema layout built? Open{" "}
        <Link href="/admin/venue-layouts" className="text-rose-500 hover:underline">
          Venue Layouts
        </Link>{" "}
        (same builder — used for cinema screens for now).
      </p>
    </div>
  );
}
