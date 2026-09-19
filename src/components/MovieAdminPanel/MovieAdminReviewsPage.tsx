"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Star } from "lucide-react";
import { useGetCinemaMovieReviewsQuery } from "@/services/api";
import { formatDate } from "@/lib/dateFormat";

export default function MovieAdminReviewsPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const { data, isLoading, isFetching } = useGetCinemaMovieReviewsQuery({
    q: search || undefined,
    limit: 50,
  });

  const reviews = data?.items ?? [];

  return (
    <div className="w-full max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageSquare size={20} className="text-fuchsia-400" />
          Movie Reviews
        </h2>
        <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
          Customer reviews for movies you are screening. Read-only — customers submit reviews on the
          public movie detail page.
        </p>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by movie, reviewer, or text…"
          className="flex-1 min-w-[200px] rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/40"
        />
        <button
          type="submit"
          className="rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white cursor-pointer"
        >
          Search
        </button>
      </form>

      <div className="glass-panel rounded-2xl border border-white/10 p-5 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400 gap-2">
            <Loader2 className="animate-spin" size={22} />
            Loading reviews…
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-500 mb-4">
              <MessageSquare size={26} />
            </div>
            <h3 className="text-lg font-bold portal-heading">No reviews yet</h3>
            <p className="text-sm portal-muted mt-2 max-w-md mx-auto">
              Reviews will appear here once customers rate movies you show.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {isFetching && (
              <p className="text-xs text-zinc-500 mb-2">Updating…</p>
            )}
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{review.movie_title || "Movie"}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      {review.user_name}
                      <span className="text-slate-400"> · {formatDate(review.created_at)}</span>
                    </p>
                    {review.text && (
                      <p className="text-sm text-slate-500 mt-2 leading-relaxed whitespace-pre-wrap">
                        {review.text}
                      </p>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-1.5 shrink-0 rounded-lg bg-fuchsia-50 px-2.5 py-1.5 text-sm font-bold text-fuchsia-800">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    {Number(review.rating).toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
