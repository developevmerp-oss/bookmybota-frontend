"use client";

import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateEventReviewMutation,
  useGetPublicEventReviewsQuery,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatDate } from "@/lib/dateFormat";

type Props = {
  eventId: string;
  eventRating?: number | string | null;
  reviewsCount?: number | null;
};

export default function EventReviewsSection({ eventId, eventRating, reviewsCount }: Props) {
  const { data: reviews = [], isLoading } = useGetPublicEventReviewsQuery(eventId);
  const [createReview, { isLoading: submitting }] = useCreateEventReviewMutation();

  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [hover, setHover] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !text.trim()) {
      toast.error("Name and review are required.");
      return;
    }
    try {
      await createReview({
        eventId,
        user_name: name.trim(),
        rating,
        text: text.trim(),
      }).unwrap();
      toast.success("Thank you for your review!");
      setText("");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to submit review"));
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-lg font-bold text-slate-900">Reviews</h2>
        {Number(reviewsCount) > 0 && (
          <p className="text-sm text-slate-600 flex items-center gap-1">
            <Star size={16} className="fill-amber-400 text-amber-400" />
            {Number(eventRating || 0).toFixed(1)} · {reviewsCount} review
            {Number(reviewsCount) === 1 ? "" : "s"}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
        <p className="text-sm font-semibold text-slate-800">Write a review</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          required
        />
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(star)}
              className="p-0.5"
            >
              <Star
                size={22}
                className={
                  star <= (hover || rating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-slate-300"
                }
              />
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Share your experience..."
          rows={3}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none"
          required
        />
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          Submit review
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-slate-500">No reviews yet. Be the first to review!</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-800">{r.user_name}</p>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={14}
                      className={
                        s <= Math.round(Number(r.rating))
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-200"
                      }
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{formatDate(r.created_at)}</p>
              <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{r.text}</p>
              {r.replies && r.replies.length > 0 && (
                <div className="mt-3 ml-3 pl-3 border-l-2 border-violet-200 space-y-2">
                  {r.replies.map((reply) => (
                    <div key={reply.id}>
                      <p className="text-xs font-semibold text-violet-700">{reply.user_name}</p>
                      <p className="text-sm text-slate-600">{reply.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
