"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { createPortal } from "react-dom";
import { ChevronRight, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateMovieReviewMutation,
  useGetPublicMovieReviewsQuery,
  type MovieReview,
} from "@/services/api";
import { extractApiError, extractApiSuccessMessage } from "@/lib/apiErrors";
import { readSessionForRole } from "@/lib/authStorage";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import {
  movieReviewFormSchema,
  type MovieReviewFormValues,
} from "@/lib/movieReviewFormSchema";
import CustomerReviewCard from "@/components/Shared/CustomerReviewCard";
import { lockBodyScroll } from "@/lib/lockBodyScroll";

const BRAND = "#6900AA";

const REVIEW_ACCENTS = [
  "#6900AA",
  "#F84464",
  "#0EA5E9",
  "#F59E0B",
  "#10B981",
  "#EC4899",
] as const;

type Props = {
  movieId: string;
  movieRating?: number | string | null;
  reviewsCount?: number | null;
};

function formatRatingOutOf5(value: number) {
  return `${Number(value || 0).toFixed(1)}/5`;
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} Minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} Hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} Day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} Month${months === 1 ? "" : "s"} ago`;
}

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
            onChange(x < rect.width / 2 ? star - 0.5 : star);
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            onChange(x < rect.width / 2 ? star - 0.5 : star);
          }}
        >
          <Star
            size={22}
            strokeWidth={1.5}
            className={
              value >= star ? "fill-amber-400 text-amber-400" : "text-slate-300 fill-slate-100"
            }
          />
          {value === star - 0.5 && (
            <div className="absolute top-0 left-0 overflow-hidden w-[50%] h-full pointer-events-none">
              <Star size={22} strokeWidth={1.5} className="fill-amber-400 text-amber-400" />
            </div>
          )}
        </div>
      ))}
      <span className="ml-2 text-sm font-bold text-slate-600">{formatRatingOutOf5(value)}</span>
    </div>
  );
}

function openCustomerLogin() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("open_customer_login"));
  }
}

export default function MovieReviewsSection({
  movieId,
  movieRating,
  reviewsCount,
}: Props) {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const authToken = useAppSelector((s) => s.auth.token);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    const onAuth = () => dispatch(loadFromStorage());
    window.addEventListener("auth_changed", onAuth);
    return () => window.removeEventListener("auth_changed", onAuth);
  }, [dispatch]);

  const customerSession =
    authUser?.role === "customer" && authToken
      ? { user: authUser, token: authToken }
      : readSessionForRole("customer");
  const loggedInName = String(customerSession?.user?.name || "").trim();
  const isLoggedIn = Boolean(customerSession?.token && customerSession?.user?.role === "customer");

  const { data, isLoading } = useGetPublicMovieReviewsQuery(movieId, { skip: !movieId });
  const reviews = data?.items ?? [];
  const meta = data?.meta;
  const [createReview, { isLoading: submitting }] = useCreateMovieReviewMutation();
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!reviewsModalOpen) return;
    const unlock = lockBodyScroll();
    return unlock;
  }, [reviewsModalOpen]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<MovieReviewFormValues>({
    resolver: yupResolver(movieReviewFormSchema),
    defaultValues: { user_name: loggedInName, rating: 5, text: "" },
    mode: "onBlur",
  });

  const prevLoggedInNameRef = useRef("");
  useEffect(() => {
    if (!loggedInName) {
      prevLoggedInNameRef.current = "";
      return;
    }
    const current = (getValues("user_name") || "").trim();
    if (!current || current === prevLoggedInNameRef.current) {
      setValue("user_name", loggedInName, { shouldValidate: true, shouldDirty: false });
    }
    prevLoggedInNameRef.current = loggedInName;
  }, [loggedInName, setValue, getValues]);

  const displayCount = reviews.length > 0 ? reviews.length : Number(reviewsCount) || 0;
  const countLabel =
    displayCount > 0
      ? `${displayCount} review${displayCount === 1 ? "" : "s"}`
      : "reviews";

  const avgFromList = useMemo(() => {
    if (!reviews.length) return Number(movieRating) || 0;
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    return sum / reviews.length;
  }, [reviews, movieRating]);

  const canReview = Boolean(meta?.can_review);
  const showWriteForm = isLoggedIn && canReview;

  const onSubmit = handleSubmit(async (values) => {
    if (!isLoggedIn) {
      openCustomerLogin();
      toast.info("Please log in to submit a review.");
      return;
    }
    try {
      const res = await createReview({
        movieId,
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
    <section className="py-8 sm:py-10 bg-white border-t border-slate-100">
      <div className="bmb-section-container">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#111111]">
            Top reviews
          </h2>
          {displayCount > 0 ? (
            <button
              type="button"
              onClick={() => setReviewsModalOpen(true)}
              className="inline-flex items-center gap-0.5 text-sm sm:text-base font-semibold shrink-0 cursor-pointer hover:opacity-80"
              style={{ color: BRAND }}
            >
              View Review
              <ChevronRight className="size-4" />
            </button>
          ) : null}
        </div>
        <p className="text-sm sm:text-base text-slate-500 mb-4 sm:mb-5">
          {displayCount > 0
            ? `Summary of ${countLabel}${avgFromList > 0 ? ` · ${avgFromList.toFixed(1)}/5` : ""}.`
            : "Be the first to rate this movie after your show ends on BookMyBota."}
        </p>

        <div className="mb-5 sm:mb-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
          {!isLoggedIn ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm sm:text-base text-slate-600">
                Log in to rate this movie after your show ends.
              </p>
              <button
                type="button"
                onClick={openCustomerLogin}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-white cursor-pointer hover:opacity-95"
                style={{ backgroundColor: BRAND }}
              >
                Log in to review
              </button>
            </div>
          ) : meta?.already_reviewed ? (
            <p className="text-sm sm:text-base text-slate-600">
              Thanks — you have already reviewed this movie.
            </p>
          ) : !meta?.has_booking ? (
            <p className="text-sm sm:text-base text-slate-600">
              Book tickets for this movie on BookMyBota to leave a review.
            </p>
          ) : !meta?.show_ended ? (
            <p className="text-sm sm:text-base text-slate-600">
              You can review this movie after your show ends.
            </p>
          ) : showWriteForm ? (
            <form onSubmit={onSubmit} noValidate className="space-y-3">
              <p className="text-sm sm:text-base font-bold text-[#111111]">Write a review</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    {...register("user_name")}
                    placeholder="Your name"
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 ${
                      errors.user_name
                        ? "border-red-400 focus:ring-red-200"
                        : "border-slate-200 focus:border-[#6900AA] focus:ring-[#6900AA]/20"
                    }`}
                  />
                  {errors.user_name && (
                    <p className="mt-1 text-xs font-semibold text-red-600">
                      {errors.user_name.message}
                    </p>
                  )}
                </div>
                <div className="flex items-center">
                  <Controller
                    name="rating"
                    control={control}
                    render={({ field }) => (
                      <StarRatingInput value={Number(field.value) || 5} onChange={field.onChange} />
                    )}
                  />
                </div>
              </div>
              <textarea
                {...register("text")}
                placeholder="Share what you liked about the film..."
                rows={3}
                className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 resize-y focus:outline-none focus:ring-2 ${
                  errors.text
                    ? "border-red-400 focus:ring-red-200"
                    : "border-slate-200 focus:border-[#6900AA] focus:ring-[#6900AA]/20"
                }`}
              />
              {errors.text && (
                <p className="text-xs font-semibold text-red-600">{errors.text.message}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: BRAND }}
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Submit review
              </button>
            </form>
          ) : null}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" aria-busy="true" aria-label="Loading reviews">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : reviews.length === 0 ? null : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {reviews.map((review: MovieReview, index: number) => {
              const name = review.user_name || "Guest";
              const ratingNum = Number(review.rating) || 0;
              const booked = Boolean(review.booked_on_platform);
              const accent = REVIEW_ACCENTS[index % REVIEW_ACCENTS.length];
              return (
                <CustomerReviewCard
                  key={review.id}
                  name={name}
                  rating={ratingNum}
                  text={review.text}
                  timeLabel={timeAgo(review.created_at)}
                  bookedOnPlatform={booked}
                  accentColor={accent}
                  className="rounded-xl p-4 sm:p-5"
                />
              );
            })}
          </div>
        )}
      </div>

      {typeof document !== "undefined" &&
        reviewsModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="movie-reviews-modal-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/45 cursor-pointer"
              aria-label="Close reviews"
              onClick={() => {
                setReviewsModalOpen(false);
                setExpandedReviewId(null);
              }}
            />
            <div className="relative w-full sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 shrink-0">
                <h2
                  id="movie-reviews-modal-title"
                  className="text-lg font-bold text-[#111111]"
                >
                  Reviews and Rating
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setReviewsModalOpen(false);
                    setExpandedReviewId(null);
                  }}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
              <div
                data-scroll-lock-container
                className="overflow-y-auto flex-1 px-5 sm:px-6 py-2 pr-6 sm:pr-7 overscroll-contain"
              >
                {reviews.map((review: MovieReview) => {
                  const name = review.user_name || "Guest";
                  const ratingNum = Number(review.rating) || 0;
                  const text = (review.text || "").trim();
                  const timeLabel = timeAgo(review.created_at);
                  const expanded = expandedReviewId === String(review.id);
                  const needsMore = text.length > 180;
                  return (
                    <article
                      key={review.id}
                      className="py-4 border-b border-slate-100 last:border-b-0"
                    >
                      <div className="flex items-start gap-2.5 pr-1">
                        <span className="inline-flex size-9 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 shrink-0">
                          {name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#111111] truncate leading-snug">
                              {name}
                            </p>
                            {timeLabel ? (
                              <p className="mt-0.5 text-xs text-slate-400 leading-snug">
                                {timeLabel}
                              </p>
                            ) : null}
                          </div>
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-md bg-[#1B7A3D] px-2.5 py-1 text-xs font-bold text-white leading-none mt-0.5">
                            <Star size={10} className="fill-white text-white" />
                            {Math.round(ratingNum)}
                          </span>
                        </div>
                      </div>
                      {text ? (
                        <div className="mt-2.5 relative pl-0">
                          <p
                            className={`text-sm text-[#111111] leading-relaxed whitespace-pre-wrap ${
                              expanded || !needsMore ? "" : "line-clamp-4"
                            }`}
                          >
                            {text}
                          </p>
                          {needsMore && !expanded ? (
                            <button
                              type="button"
                              onClick={() => setExpandedReviewId(String(review.id))}
                              className="absolute bottom-0 right-0 pl-8 bg-gradient-to-l from-white via-white to-transparent text-sm font-semibold cursor-pointer"
                              style={{ color: BRAND }}
                            >
                              Read More
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
