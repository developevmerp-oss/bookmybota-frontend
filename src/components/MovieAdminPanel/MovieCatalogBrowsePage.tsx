"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Film } from "lucide-react";
import { useGetPartnerMovieCatalogQuery } from "@/services/api";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import { resolveMediaUrl } from "@/lib/mediaUrl";

const STATUS_LABEL: Record<string, string> = {
  coming_soon: "Coming soon",
  now_showing: "Now showing",
};

export default function MovieCatalogBrowsePage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const queryArg = useMemo(
    () => ({
      page,
      limit,
      ...(q.trim() ? { q: q.trim() } : {}),
    }),
    [q, page, limit]
  );
  const { data, isLoading, isFetching } = useGetPartnerMovieCatalogQuery(queryArg);
  const movies = data?.items ?? [];

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Film size={20} className="text-fuchsia-400" /> Movie catalog
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Titles managed by Super Admin. You will schedule showtimes against these films in the next
          phase.
        </p>
      </div>

      <SearchInput
        className="w-full sm:max-w-sm"
        value={q}
        onChange={(value) => {
          setQ(value);
          setPage(1);
        }}
        placeholder="Search movies"
      />

      {isLoading ? (
        <p className="text-zinc-400">Loading catalog…</p>
      ) : movies.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/10 p-10 text-center text-zinc-500">
          No active movies in the catalog yet. Ask Super Admin to add titles.
        </div>
      ) : (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${isFetching ? "opacity-70" : ""}`}>
          {movies.map((movie) => (
            <article
              key={movie.id}
              className="glass-panel rounded-2xl border border-white/10 overflow-hidden"
            >
              <div className="aspect-[2/3] bg-zinc-900">
                {movie.poster_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveMediaUrl(movie.poster_url)} alt={movie.title} className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="p-4 space-y-1">
                <p className="text-white font-semibold">{movie.title}</p>
                <p className="text-xs text-zinc-500">
                  {[STATUS_LABEL[movie.status] || movie.status, movie.certificate, movie.duration_minutes ? `${movie.duration_minutes} min` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-xs text-zinc-400 line-clamp-2">
                  {(movie.languages || []).join(", ") || "—"}
                </p>
                <div className="pt-2 border-t border-white/5">
                  <Link
                    href={`/movie/showtimes?movie_id=${movie.id}`}
                    className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-300 text-xs font-bold transition-colors"
                  >
                    Schedule Show
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

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
        disabled={isFetching}
        onPageChange={setPage}
        onLimitChange={(next) => {
          setLimit(next);
          setPage(1);
        }}
      />
    </div>
  );
}
