"use client";

import { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  useGetReviewsQuery,
  useCreateReviewReplyMutation,
  useGetBusinessPublicQuery,
} from "@/services/api";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { FaStar, FaStarHalfAlt, FaRegStar, FaReply, FaComment } from "react-icons/fa";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/dateFormat";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import { extractApiError } from "@/lib/apiErrors";
import {
  diningReviewReplySchema,
  emptyDiningReviewReplyValues,
  type DiningReviewReplyValues,
} from "@/lib/diningPartnerFormSchemas";

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";

const BAR_COLORS: Record<number, string> = {
  5: "bg-emerald-500",
  4: "bg-sky-500",
  3: "bg-amber-400",
  2: "bg-orange-500",
  1: "bg-rose-500",
};

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

function RatingStars({
  rating,
  size = 14,
  fillClass = "text-amber-400",
}: {
  rating: number;
  size?: number;
  fillClass?: string;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        if (rating >= star) {
          return <FaStar key={star} size={size} className={fillClass} />;
        }
        if (rating >= star - 0.5) {
          return <FaStarHalfAlt key={star} size={size} className={fillClass} />;
        }
        return <FaRegStar key={star} size={size} className="text-slate-300" />;
      })}
    </div>
  );
}

export default function BusinessReviewsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id || "";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<"ALL" | "5" | "4" | "3" | "2" | "1">("ALL");

  const { data: profile } = useGetBusinessPublicQuery(bizId, { skip: !bizId });
  const { data: statsData } = useGetReviewsQuery(bizId, { skip: !bizId });
  const { data: reviewsData, isLoading } = useGetReviewsQuery(
    { bizId, page, limit: PAGE_SIZE, ...(q.trim() ? { q: q.trim() } : {}) },
    { skip: !bizId }
  );
  const reviews = reviewsData?.items ?? [];
  const statsReviews = statsData?.items ?? [];
  const [createReply, { isLoading: postingReply }] = useCreateReviewReplyMutation();

  const [replyingTo, setReplyingTo] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DiningReviewReplyValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(diningReviewReplySchema) as any,
    defaultValues: emptyDiningReviewReplyValues(),
    mode: "onSubmit",
  });

  const startReply = (reviewId: number) => {
    setReplyingTo(reviewId);
    reset(emptyDiningReviewReplyValues());
  };

  const cancelReply = () => {
    setReplyingTo(null);
    reset(emptyDiningReviewReplyValues());
  };

  const onReplySubmit = handleSubmit(async (values) => {
    if (replyingTo == null) return;

    try {
      const res = await createReply({
        reviewId: replyingTo,
        businessId: bizId,
        user_name: profile?.name || "Business Owner",
        user_type: "owner",
        text: values.text.trim(),
      }).unwrap();

      cancelReply();
      toast.success(res.message || "Reply posted successfully.");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to post reply."));
    }
  });

  const totalReviews = statsReviews.length;
  const averageRating =
    totalReviews > 0
      ? (
          statsReviews.reduce((acc: number, r: any) => acc + Number(r.rating), 0) / totalReviews
        ).toFixed(1)
      : "0.0";

  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  statsReviews.forEach((r: any) => {
    const rounded = Math.round(Number(r.rating));
    if (rounded >= 1 && rounded <= 5) {
      ratingCounts[rounded as keyof typeof ratingCounts]++;
    }
  });

  const filteredReviews = useMemo(() => {
    if (ratingFilter === "ALL") return reviews;
    const target = Number(ratingFilter);
    return reviews.filter((r: any) => Math.round(Number(r.rating)) === target);
  }, [reviews, ratingFilter]);

  if (!user || isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-slate-400">
        <Loader2 className="animate-spin text-[#e11d48] mr-2" /> Loading reviews...
      </div>
    );
  }

  return (
    <div className="-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8 animate-fadeIn">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Customer Reviews</h2>
            <p className="text-sm text-slate-500 mt-1">
              Manage your reputation. Reply to customer reviews publicly as the venue owner.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center w-full lg:w-auto">
            <SearchInput
              value={q}
              onChange={(value) => {
                setQ(value);
                setPage(1);
              }}
              placeholder="Search reviewer or review text..."
              className="w-full sm:w-64"
            />
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value as typeof ratingFilter)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:border-rose-400 cursor-pointer"
            >
              <option value="ALL">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>

        {statsReviews.length === 0 && reviews.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm flex flex-col items-center">
            <AlertCircle className="text-slate-400 mb-4 h-10 w-10" />
            <h3 className="text-slate-700 font-bold mb-1">No Reviews Yet</h3>
            <p className="text-slate-400 text-sm">
              When customers leave reviews, they will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: Summary + Recent */}
            <div className="lg:col-span-1 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sticky top-24">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                  <FaStar className="text-amber-400" size={16} />
                  <h3 className="font-semibold text-slate-700 text-sm">
                    Total Reviews ({totalReviews} Reviews)
                  </h3>
                </div>

                <div className="flex items-start gap-6 pt-5">
                  <div className="shrink-0">
                    <p className="text-4xl font-extrabold text-slate-900 tabular-nums leading-none">
                      {averageRating}
                    </p>
                    <div className="mt-2">
                      <RatingStars rating={Number(averageRating)} size={14} />
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 min-w-0 pt-0.5">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = ratingCounts[star as keyof typeof ratingCounts];
                      const pct = totalReviews ? (count / totalReviews) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400 font-medium w-3 tabular-nums">
                            {star}
                          </span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${BAR_COLORS[star]}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-slate-400 w-6 text-right tabular-nums">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>

            {/* Right: All Reviews */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                  <h3 className="font-bold text-slate-900">
                    All Reviews ({reviewsData?.meta?.total ?? filteredReviews.length})
                  </h3>
                </div>

                {filteredReviews.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 text-sm">
                    No reviews match this filter.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredReviews.map((rev: any) => (
                      <div key={rev.id} className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-[#f43f5e] to-orange-400 flex items-center justify-center text-white-keep font-bold text-sm shadow-sm">
                            {String(rev.user_name || "?").charAt(0).toUpperCase()}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-1">
                              <h4 className="font-bold text-slate-900 text-sm truncate">
                                {rev.user_name}
                              </h4>
                              <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                                {formatDate(rev.created_at)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 mb-3">
                              <RatingStars
                                rating={Number(rev.rating)}
                                size={12}
                              />
                              <span className="text-xs font-semibold text-slate-400">
                                {Number(rev.rating).toFixed(1)}
                              </span>
                            </div>

                            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                              {rev.text}
                            </p>

                            {rev.replies && rev.replies.length > 0 && (
                              <div className="mt-3 space-y-2 pl-2 sm:pl-4 border-l-2 border-slate-100">
                                {rev.replies.map((reply: any) => {
                                  const isOwner = reply.user_type === "owner";
                                  return (
                                    <div
                                      key={reply.id}
                                      className={`rounded-xl px-3.5 py-3 text-sm ${
                                        isOwner
                                          ? "bg-rose-50 border border-rose-100"
                                          : "bg-slate-50 border border-slate-100"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2 mb-1.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span
                                            className={`font-bold truncate ${
                                              isOwner ? "text-[#e11d48]" : "text-slate-700"
                                            }`}
                                          >
                                            {reply.user_name}
                                          </span>
                                          {isOwner && (
                                            <span className="text-[9px] bg-[#e11d48] text-white-keep px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider shrink-0">
                                              Venue Owner
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-[10px] text-slate-400 shrink-0">
                                          {formatDate(reply.created_at)}
                                        </span>
                                      </div>
                                      <p className="text-slate-600">{reply.text}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="mt-3">
                              {replyingTo === rev.id ? (
                                <form
                                  onSubmit={onReplySubmit}
                                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                                  noValidate
                                >
                                  <h5 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <FaComment size={13} className="text-[#e11d48]" />
                                    Replying as{" "}
                                    <span className="text-[#e11d48]">
                                      {profile?.name || "Venue Owner"}
                                    </span>
                                  </h5>
                                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                                    Your reply <RequiredMark />
                                  </label>
                                  <textarea
                                    autoFocus
                                    placeholder="Write a professional response to this customer..."
                                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 min-h-[80px]"
                                    {...register("text")}
                                  />
                                  {errors.text && (
                                    <p className={fieldErrorClass}>{errors.text.message}</p>
                                  )}
                                  <div className="flex justify-end gap-2 mt-3">
                                    <button
                                      type="button"
                                      onClick={cancelReply}
                                      className="h-9 px-4 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={postingReply}
                                      className="h-9 px-4 rounded-lg text-xs font-semibold text-white bg-[#e11d48] hover:bg-[#be123c] disabled:opacity-60 transition-colors"
                                    >
                                      {postingReply ? "Posting..." : "Post Reply"}
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startReply(rev.id)}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#e11d48] transition-colors"
                                >
                                  <FaReply size={12} />
                                  {rev.replies && rev.replies.length > 0
                                    ? "Add another reply"
                                    : "Reply"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {reviewsData?.meta && (
                  <div className="px-4 py-3 border-t border-slate-100">
                    <Pagination
                      meta={reviewsData.meta}
                      onPageChange={setPage}
                      className="!border-0 !shadow-none !bg-transparent !px-0 !py-0"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
