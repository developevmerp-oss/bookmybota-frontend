"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Loader2, MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateEventReviewMutation,
  useGetPublicEventReviewsQuery,
  type EventReview,
} from "@/services/api";
import { extractApiError, extractApiSuccessMessage } from "@/lib/apiErrors";
import { formatDate } from "@/lib/dateFormat";
import { readSessionForRole } from "@/lib/authStorage";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import {
  eventReviewFormSchema,
  type EventReviewFormValues,
} from "@/lib/eventReviewFormSchema";

const BRAND = "#6900AA";

type Props = {
  eventId: string;
  eventRating?: number | string | null;
  reviewsCount?: number | null;
};

function formatRating(value: number) {
  return Number(value || 0).toFixed(1);
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

/** Dining-style half-star display (supports 3.5, 4.5, etc.) */
function StarsDisplay({ value, size = 14 }: { value: number; size?: number }) {
  const rating = Number(value) || 0;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${formatRating(rating)} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const full = rating >= star;
        const half = !full && rating >= star - 0.5;
        return (
          <span key={star} className="relative inline-flex" style={{ width: size, height: size }}>
            <Star size={size} className="text-slate-200" />
            {full && (
              <Star size={size} className="absolute inset-0 fill-amber-400 text-amber-400" />
            )}
            {half && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
                <Star size={size} className="fill-amber-400 text-amber-400" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Dining-style interactive half-star input */
function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <div
          key={star}
          className="relative cursor-pointer"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const isHalf = x < rect.width / 2;
            onChange(isHalf ? star - 0.5 : star);
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const isHalf = x < rect.width / 2;
            onChange(isHalf ? star - 0.5 : star);
          }}
        >
          <Star
            size={26}
            strokeWidth={1.5}
            className={`${
              value >= star ? "fill-amber-400 text-amber-400" : "text-slate-300 fill-slate-100"
            } transition-colors`}
          />
          {value === star - 0.5 && (
            <div className="absolute top-0 left-0 overflow-hidden w-[50%] h-full pointer-events-none">
              <Star size={26} strokeWidth={1.5} className="fill-amber-400 text-amber-400" />
            </div>
          )}
        </div>
      ))}
      <span className="ml-2 text-[1rem] sm:text-[1.0625rem] font-bold text-slate-600 w-12">
        {formatRating(value)}
      </span>
    </div>
  );
}

function ReviewCard({ review }: { review: EventReview }) {
  const [expanded, setExpanded] = useState(false);
  const name = review.user_name || "Guest";
  const rating = Number(review.rating) || 0;
  const fullText = String(review.text || "").trim();
  const REVIEW_PREVIEW_LEN = 140;
  const isLong = fullText.length > REVIEW_PREVIEW_LEN;
  const preview =
    !isLong || expanded
      ? fullText
      : `${fullText.slice(0, REVIEW_PREVIEW_LEN).replace(/\s+\S*$/, "").trim()}…`;

  return (
    <article className="rounded-xl border border-slate-100 bg-white p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[0.875rem] font-bold text-white"
          style={{ backgroundColor: BRAND }}
          aria-hidden
        >
          {initialsFromName(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <div className="min-w-0">
              <p className="font-bold text-[#1A1A1A] text-[1rem] sm:text-[1.0625rem] lg:text-[1.125rem] truncate">{name}</p>
              <p className="mt-0.5 text-[0.875rem] sm:text-[1rem] text-slate-400">{formatDate(review.created_at)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StarsDisplay value={rating} size={15} />
              <span className="inline-flex items-center gap-1 rounded-md bg-[#FBF6FF] border border-[#E3BCFF] px-1.5 py-0.5 text-[0.875rem] sm:text-[1rem] font-bold text-[#1A1A1A]">
                {formatRating(rating)}
                <Star size={10} className="fill-amber-400 text-amber-400" />
              </span>
            </div>
          </div>
          {fullText && (
            <p className="mt-2.5 text-[1rem] sm:text-[1.0625rem] lg:text-[1.125rem] leading-7 sm:leading-[1.7] text-slate-600 whitespace-pre-wrap">
              {preview}
              {isLong && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="font-semibold cursor-pointer hover:underline"
                    style={{ color: BRAND }}
                  >
                    {expanded ? "Read Less" : "Read More"}
                  </button>
                </>
              )}
            </p>
          )}

          {review.replies && review.replies.length > 0 && (
            <div className="mt-3 space-y-2 border-l-2 pl-3" style={{ borderColor: "#E3BCFF" }}>
              {review.replies.map((reply) => (
                <div key={reply.id} className="rounded-lg bg-[#FBF6FF] px-3 py-2.5">
                  <p className="text-[0.875rem] sm:text-[1rem] font-bold" style={{ color: BRAND }}>
                    {reply.user_name || "Organizer"} · Reply
                  </p>
                  <p className="mt-1 text-[1rem] sm:text-[1.0625rem] leading-6 sm:leading-7 text-slate-600 whitespace-pre-wrap">
                    {reply.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function EventReviewsSection({ eventId, eventRating, reviewsCount }: Props) {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const authToken = useAppSelector((s) => s.auth.token);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const customerSession =
    authUser?.role === "customer" && authToken
      ? { user: authUser, token: authToken }
      : readSessionForRole("customer");
  const loggedInName = String(customerSession?.user?.name || "").trim();

  const { data: reviews = [], isLoading, isError, isFetching } = useGetPublicEventReviewsQuery(eventId);
  const [createReview, { isLoading: submitting }] = useCreateEventReviewMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<EventReviewFormValues>({
    resolver: yupResolver(eventReviewFormSchema),
    defaultValues: {
      user_name: loggedInName,
      rating: 5,
      text: "",
    },
    mode: "onBlur",
  });

  const prevLoggedInNameRef = useRef("");

  useEffect(() => {
    const onAuth = () => {
      dispatch(loadFromStorage());
    };
    window.addEventListener("auth_changed", onAuth);
    return () => window.removeEventListener("auth_changed", onAuth);
  }, [dispatch]);

  useEffect(() => {
    if (!loggedInName) {
      prevLoggedInNameRef.current = "";
      return;
    }
    const current = (getValues("user_name") || "").trim();
    // Prefill when empty, or when still matching the previous account name (user hasn't customized).
    if (!current || current === prevLoggedInNameRef.current) {
      setValue("user_name", loggedInName, { shouldValidate: true, shouldDirty: false });
    }
    prevLoggedInNameRef.current = loggedInName;
  }, [loggedInName, setValue, getValues]);

  const liveCount = reviews.length;
  const displayCount = liveCount > 0 ? liveCount : Number(reviewsCount) || 0;
  const avgRating = useMemo(() => {
    if (liveCount > 0) {
      const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
      return sum / liveCount;
    }
    return Number(eventRating) || 0;
  }, [reviews, liveCount, eventRating]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const res = await createReview({
        eventId,
        user_name: values.user_name.trim(),
        rating: values.rating,
        text: values.text.trim(),
      }).unwrap();
      toast.success(extractApiSuccessMessage(res, "Thank you for your review!"));
      reset({
        user_name: loggedInName || values.user_name.trim(),
        rating: 5,
        text: "",
      });
    } catch (err) {
      toast.error(extractApiError(err, "Failed to submit review. Please try again."));
    }
  });

  return (
    <section className="mt-1">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4 sm:mb-5">
        <div>
          <h2 className="text-[1.25rem] sm:text-[1.375rem] lg:text-[1.5rem] font-bold text-[#1A1A1A]">
            Reviews
          </h2>
          <p className="mt-1 text-[1rem] sm:text-[1.0625rem] text-[#6B6B6B]">
            See what other customers thought about this event.
          </p>
        </div>
        {displayCount > 0 && (
          <div className="flex items-center gap-2 rounded-full bg-[#FBF6FF] border border-[#E3BCFF] px-3.5 py-1.5">
            <Star size={16} className="fill-amber-400 text-amber-400" />
            <span className="text-[1rem] sm:text-[1.0625rem] font-bold text-[#1A1A1A]">{formatRating(avgRating)}</span>
            <span className="text-[0.875rem] sm:text-[1rem] text-slate-500">
              · {displayCount} review{displayCount === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="mb-6 sm:mb-8 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 space-y-4"
      >
        <p className="text-[1rem] sm:text-[1.0625rem] lg:text-[1.125rem] font-bold text-[#1A1A1A]">Write a review</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-[0.875rem] font-semibold uppercase tracking-wide text-slate-500">
              Your name
            </label>
            <input
              {...register("user_name")}
              placeholder="e.g. Priya Sharma"
              className={`w-full rounded-xl border bg-white px-3.5 py-3 text-[1rem] sm:text-[1.0625rem] font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                errors.user_name
                  ? "border-red-400 focus:ring-red-200"
                  : "border-slate-200 focus:border-[#6900AA] focus:ring-[#6900AA]/20"
              }`}
            />
            {errors.user_name && (
              <p className="mt-1.5 text-[0.875rem] sm:text-[1rem] font-semibold text-red-600">{errors.user_name.message}</p>
            )}
            {loggedInName && (
              <p className="mt-1.5 text-[0.875rem] font-medium text-slate-400">
                Pre-filled from your account — you can edit it
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-[0.875rem] font-semibold uppercase tracking-wide text-slate-500">
              Your rating
            </label>
            <Controller
              name="rating"
              control={control}
              render={({ field }) => (
                <div className="flex h-[46px] items-center">
                  <StarRatingInput value={Number(field.value) || 5} onChange={field.onChange} />
                </div>
              )}
            />
            {errors.rating && (
              <p className="mt-1.5 text-[0.875rem] sm:text-[1rem] font-semibold text-red-600">{errors.rating.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[0.875rem] font-semibold uppercase tracking-wide text-slate-500">
            Your experience
          </label>
          <textarea
            {...register("text")}
            placeholder="Share what you liked about the show, venue, or artists..."
            rows={4}
            className={`w-full rounded-xl border bg-white px-3.5 py-3 text-[1rem] sm:text-[1.0625rem] font-medium text-slate-800 placeholder:text-slate-400 resize-y min-h-[104px] focus:outline-none focus:ring-2 ${
              errors.text
                ? "border-red-400 focus:ring-red-200"
                : "border-slate-200 focus:border-[#6900AA] focus:ring-[#6900AA]/20"
            }`}
          />
          {errors.text && (
            <p className="mt-1.5 text-[0.875rem] sm:text-[1rem] font-semibold text-red-600">{errors.text.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[1.125rem] sm:text-[1.25rem] font-bold text-white disabled:opacity-50 cursor-pointer hover:opacity-95"
          style={{ backgroundColor: BRAND }}
        >
          {submitting && <Loader2 size={15} className="animate-spin" />}
          Submit review
        </button>
      </form>

      <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
        <h3 className="text-[1.125rem] sm:text-[1.25rem] font-bold text-[#1A1A1A]">Customer reviews</h3>
        {isFetching && !isLoading && (
          <span className="text-[0.875rem] font-medium text-slate-400">Updating…</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-[1rem] sm:text-[1.0625rem] text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading reviews…
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-6 text-[1rem] sm:text-[1.0625rem] text-red-700">
          Could not load reviews. Please refresh the page.
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
          <MessageSquare size={28} className="text-slate-300" />
          <p className="text-[1rem] sm:text-[1.0625rem] font-semibold text-slate-600">No reviews yet</p>
          <p className="text-[0.875rem] sm:text-[1rem] text-slate-500">Be the first to share your experience.</p>
        </div>
      ) : (
        <div className="relative rounded-xl border border-slate-200 bg-slate-50/40">
          <ul
            className="max-h-[420px] sm:max-h-[480px] lg:max-h-[520px] overflow-y-auto overscroll-contain space-y-3 sm:space-y-3.5 p-3 sm:p-4 scroll-smooth [scrollbar-width:thin]"
          >
            {reviews.map((review) => (
              <li key={review.id}>
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
          {reviews.length > 3 && (
            <p className="px-3 sm:px-4 py-2 text-[0.875rem] sm:text-[1rem] font-medium text-slate-400 border-t border-slate-100 bg-white/80 rounded-b-xl">
              Scroll to see more reviews
            </p>
          )}
        </div>
      )}
    </section>
  );
}
