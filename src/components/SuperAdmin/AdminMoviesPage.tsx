"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Archive, Film, Pencil, Plus } from "lucide-react";
import {
  useDeleteAdminMovieMutation,
  useGetAdminMoviesQuery,
  useUpdateAdminMovieMutation,
  type Movie,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { resolveMediaUrl } from "@/lib/mediaUrl";
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

function isPublicCatalogStatus(status: Movie["status"]) {
  return status === "now_showing" || status === "coming_soon";
}

export default function AdminMoviesPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [archiveTarget, setArchiveTarget] = useState<Movie | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const activatedIdsRef = useRef<Set<string>>(new Set());

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
  const [deleteMovie] = useDeleteAdminMovieMutation();
  const [updateMovie] = useUpdateAdminMovieMutation();

  // Existing titles can be "Now showing" in admin but still inactive for public/partner
  // catalog (e.g. after archive → restore). Activate them via the existing update API.
  useEffect(() => {
    const needsActivate = movies.filter(
      (m) =>
        isPublicCatalogStatus(m.status) &&
        m.is_active === false &&
        !activatedIdsRef.current.has(m.id)
    );
    if (needsActivate.length === 0) return;

    let cancelled = false;
    (async () => {
      let activated = 0;
      for (const movie of needsActivate) {
        if (cancelled) break;
        activatedIdsRef.current.add(movie.id);
        try {
          await updateMovie({ id: movie.id, body: { is_active: true } }).unwrap();
          activated += 1;
        } catch {
          activatedIdsRef.current.delete(movie.id);
        }
      }
      if (!cancelled && activated > 0) {
        toast.success(
          activated === 1
            ? "1 movie is now visible on the public catalog"
            : `${activated} movies are now visible on the public catalog`
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [movies, updateMovie]);

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
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Film size={20} className="text-rose-500" /> Movies
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Platform movie catalog. Cinema partners will pick from this list when scheduling shows.
          </p>
        </div>
        <Link href="/admin/movies/new" className="btn-primary inline-flex items-center justify-center gap-2">
          <Plus size={16} /> Add movie
        </Link>
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
          No movies yet.{" "}
          <Link href="/admin/movies/new" className="text-rose-600 font-semibold hover:underline">
            Add the first title
          </Link>
          .
        </div>
      ) : (
        <div
          className={`rounded-2xl border border-slate-200 bg-white overflow-hidden ${isFetching ? "opacity-70" : ""}`}
        >
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
                            src={resolveMediaUrl(movie.poster_url)}
                            alt=""
                            className="w-10 h-14 rounded object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-14 rounded bg-slate-100 border border-slate-200 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <Link
                            href={`/admin/movies/${movie.id}/edit`}
                            className="font-semibold text-slate-900 hover:text-rose-600 truncate block"
                          >
                            {movie.title}
                          </Link>
                          <p className="text-xs text-slate-500 truncate">
                            {[
                              movie.certificate,
                              (movie.languages || []).join(" / "),
                              (movie.genres || []).slice(0, 2).join(", "),
                            ]
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
                        <Link
                          href={`/admin/movies/${movie.id}/edit`}
                          className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </Link>
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
          disabled={isFetching || archiveBusy}
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
      </div>

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

      <p className="text-xs text-slate-500">
        Need a cinema layout built? Open{" "}
        <Link href="/admin/venue-layouts" className="text-rose-600 hover:underline">
          Venue Layouts
        </Link>{" "}
        (same builder — used for cinema screens for now).
      </p>
    </div>
  );
}
