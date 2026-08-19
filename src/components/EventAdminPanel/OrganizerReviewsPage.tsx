"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Star } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateEventReviewReplyMutation,
  useGetOrganizerEventReviewsQuery,
  useGetOrganizerEventsQuery,
} from "@/services/api";
import { formatDate } from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";

export default function OrganizerReviewsPage() {
  const [eventFilter, setEventFilter] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data: eventsData } = useGetOrganizerEventsQuery();
  const events = eventsData?.items ?? [];
  const { data: reviewsData, isLoading } = useGetOrganizerEventReviewsQuery({
    page,
    limit: PAGE_SIZE,
    ...(eventFilter ? { event_id: eventFilter } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const reviews = reviewsData?.items ?? [];
  const [createReply, { isLoading: replying }] = useCreateEventReviewReplyMutation();
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const handleReply = async (e: React.FormEvent, reviewId: number) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    try {
      await createReply({
        reviewId,
        user_name: "Event Organizer",
        text: replyText.trim(),
      }).unwrap();
      toast.success("Reply posted.");
      setReplyingTo(null);
      setReplyText("");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to post reply"));
    }
  };

  const avg =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length).toFixed(1)
      : "0.0";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="portal-heading text-2xl font-bold flex items-center gap-2">
          <Star className="text-violet-500" /> Customer Reviews
        </h2>
        <p className="portal-muted text-sm mt-1">
          Reviews from customers who attended your events.
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-4 items-end">
        <div className="min-w-[200px] flex-1">
          <label className="portal-label text-xs font-bold uppercase tracking-wider mb-1.5 block">
            Filter by event
          </label>
          <select
            value={eventFilter}
            onChange={(e) => {
              setEventFilter(e.target.value);
              setPage(1);
            }}
            className="portal-select"
          >
            <option value="">All events</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>
        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search reviewer, text, event"
        />
        <div className="text-center px-4">
          <p className="text-3xl font-black portal-heading">{avg}</p>
          <p className="text-xs portal-muted">{reviewsData?.meta?.total ?? reviews.length} reviews</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 portal-muted">
          <Loader2 className="animate-spin inline mr-2" size={18} /> Loading...
        </div>
      ) : reviews.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center portal-muted">
          No customer reviews yet.
        </div>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="glass-panel rounded-2xl p-5">
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold portal-heading">{r.user_name}</p>
                  <p className="text-xs portal-muted">
                    {r.event_name} · {formatDate(r.created_at)}
                  </p>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={14}
                      className={
                        s <= Math.round(Number(r.rating))
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-300"
                      }
                    />
                  ))}
                </div>
              </div>
              <p className="text-sm portal-muted whitespace-pre-wrap">{r.text}</p>

              {r.replies?.map((reply) => (
                <div
                  key={reply.id}
                  className="mt-3 ml-3 pl-3 border-l-2 border-violet-300 text-sm"
                >
                  <p className="font-semibold text-violet-700">{reply.user_name}</p>
                  <p className="portal-muted">{reply.text}</p>
                </div>
              ))}

              {replyingTo === r.id ? (
                <form onSubmit={(e) => handleReply(e, r.id)} className="mt-4 space-y-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={2}
                    className="input-field w-full text-sm"
                    placeholder="Write a public reply..."
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={replying}
                      className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold"
                    >
                      Post reply
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setReplyingTo(r.id)}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-violet-600 font-semibold"
                >
                  <MessageCircle size={14} /> Reply
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {reviewsData?.meta && <Pagination meta={reviewsData.meta} onPageChange={setPage} />}
    </div>
  );
}
