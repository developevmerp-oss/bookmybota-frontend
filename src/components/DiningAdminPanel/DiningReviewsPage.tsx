"use client";

import { useState, useEffect } from 'react';
import { useGetReviewsQuery, useCreateReviewReplyMutation, useGetBusinessPublicQuery } from '@/services/api';
import { useAppSelector, useAppDispatch } from '@/lib/hooks';
import { loadFromStorage } from '@/features/auth/authSlice';
import { Star, StarHalf, MessageCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/dateFormat';
import SearchInput from '@/components/Shared/SearchInput';
import Pagination from '@/components/Shared/Pagination';
import { PAGE_SIZE } from '@/lib/pagination';

export default function BusinessReviewsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id || "";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data: profile } = useGetBusinessPublicQuery(bizId, { skip: !bizId });
  const { data: statsData } = useGetReviewsQuery(bizId, { skip: !bizId });
  const { data: reviewsData, isLoading } = useGetReviewsQuery(
    { bizId, page, limit: PAGE_SIZE, ...(q.trim() ? { q: q.trim() } : {}) },
    { skip: !bizId }
  );
  const reviews = reviewsData?.items ?? [];
  const statsReviews = statsData?.items ?? [];
  const [createReply] = useCreateReviewReplyMutation();

  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const handleReplySubmit = async (e: React.FormEvent, reviewId: number) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    try {
      await createReply({
        reviewId,
        businessId: bizId,
        user_name: profile?.name || "Business Owner",
        user_type: "owner",
        text: replyText
      }).unwrap();
      
      setReplyingTo(null);
      setReplyText("");
      toast.success("Reply posted successfully.");
    } catch (err) {
      console.error("Failed to post reply:", err);
      toast.error("Failed to post reply.");
    }
  };

  if (!user || isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-slate-400">
        <Loader2 className="animate-spin text-rose-500 mr-2" /> Loading reviews...
      </div>
    );
  }

  const totalReviews = statsReviews.length;
  const averageRating = totalReviews > 0 
    ? (statsReviews.reduce((acc: number, r: any) => acc + Number(r.rating), 0) / totalReviews).toFixed(1)
    : "0.0";
  
  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  statsReviews.forEach((r: any) => {
    const rounded = Math.round(Number(r.rating));
    if (rounded >= 1 && rounded <= 5) {
      ratingCounts[rounded as keyof typeof ratingCounts]++;
    }
  });

  return (
    <div className="max-w-7xl mx-auto animate-fadeIn">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Star className="text-rose-500" /> Customer Reviews
        </h2>
        <p className="text-zinc-400">
          Manage your reputation. Reply to customer reviews publicly as the venue owner.
        </p>
        <div className="mt-4">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search reviewer or review text"
          />
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="glass-panel p-10 rounded-2xl border border-white/5 text-center flex flex-col items-center">
          <AlertCircle className="text-zinc-500 mb-4 h-10 w-10" />
          <h3 className="text-zinc-300 font-bold mb-1">No Reviews Yet</h3>
          <p className="text-zinc-500 text-sm">When customers leave reviews, they will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Summary Stats */}
          <div className="lg:col-span-1">
            <div className="glass-panel p-6 rounded-2xl border border-white/5 sticky top-24">
              <h3 className="font-bold text-white mb-6 text-lg">Review Summary</h3>
              
              <div className="flex items-center gap-5 mb-8">
                <div className="text-5xl font-extrabold text-white">{averageRating}</div>
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const ratingVal = Number(averageRating);
                      if (ratingVal >= star) {
                        return <Star key={star} size={16} className="fill-rose-500 text-rose-500" />;
                      } else if (ratingVal >= star - 0.5) {
                        return <StarHalf key={star} size={16} className="fill-rose-500 text-rose-500" />;
                      } else {
                        return <Star key={star} size={16} className="text-zinc-300 dark:text-zinc-700" />;
                      }
                    })}
                  </div>
                  <div className="text-xs font-medium text-zinc-400">Based on {totalReviews} reviews</div>
                </div>
              </div>

              <div className="space-y-3">
                {[5, 4, 3, 2, 1].map(star => (
                  <div key={star} className="flex items-center gap-3 text-xs">
                    <span className="text-zinc-300 font-bold w-12">{star} Stars</span>
                    <div className="flex-1 h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500 rounded-full transition-all duration-1000"
                        style={{ width: `${totalReviews ? (ratingCounts[star as keyof typeof ratingCounts] / totalReviews) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-zinc-500 w-6 text-right font-medium">
                      {ratingCounts[star as keyof typeof ratingCounts]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Review Feed */}
          <div className="lg:col-span-2 space-y-6">
            {reviews.map((rev: any) => (
            <div key={rev.id} className="glass-panel p-6 rounded-2xl border border-white/5 shadow-sm hover:shadow-md transition-shadow relative">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-rose-500 to-orange-400 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                  {rev.user_name.charAt(0).toUpperCase()}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-white text-base truncate pr-2">
                      {rev.user_name}
                    </h4>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold whitespace-nowrap shrink-0">
                      {formatDate(rev.created_at)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const ratingVal = Number(rev.rating);
                        if (ratingVal >= star) {
                          return <Star key={star} size={12} className="fill-rose-500 text-rose-500" />;
                        } else if (ratingVal >= star - 0.5) {
                          return <StarHalf key={star} size={12} className="fill-rose-500 text-rose-500" />;
                        } else {
                          return <Star key={star} size={12} className="text-zinc-300 dark:text-zinc-700" />;
                        }
                      })}
                    </div>
                    <span className="text-xs font-bold text-zinc-400">{rev.rating}</span>
                  </div>
                  
                  <p className="text-zinc-300 leading-relaxed text-sm bg-zinc-900/50 p-4 rounded-xl border border-white/5">
                    {rev.text}
                  </p>

                  {/* Threaded Replies */}
                  {rev.replies && rev.replies.length > 0 && (
                    <div className="mt-4 space-y-3 relative before:absolute before:inset-y-0 before:left-6 before:w-px before:bg-white/10 ml-2">
                      {rev.replies.map((reply: any) => (
                        <div key={reply.id} className="relative flex gap-4 pl-12">
                          {/* Connecting branch line */}
                          <div className="absolute left-6 top-5 w-6 h-px bg-white/10"></div>
                          
                          <div className={`flex-1 p-4 rounded-2xl text-sm ${reply.user_type === 'owner' ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-zinc-900/50 border border-white/5'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`font-bold ${reply.user_type === 'owner' ? 'text-rose-400' : 'text-zinc-300'}`}>
                                  {reply.user_name}
                                </span>
                                {reply.user_type === 'owner' && (
                                  <span className="text-[9px] bg-rose-600/20 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                                    Venue Owner
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-500">
                                {formatDate(reply.created_at)}
                              </span>
                            </div>
                            <p className={reply.user_type === 'owner' ? 'text-rose-900 dark:text-rose-100/80' : 'text-zinc-400'}>
                              {reply.text}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Form / Button */}
                  <div className="mt-4 ml-2">
                    {replyingTo === rev.id ? (
                      <div className="relative flex gap-4 pl-12">
                        {/* Connecting branch line */}
                        <div className="absolute left-6 top-5 w-6 h-px bg-white/10"></div>
                        
                        <form onSubmit={(e) => handleReplySubmit(e, rev.id)} className="flex-1 bg-zinc-900/50 p-4 rounded-2xl border border-white/10 shadow-inner">
                          <h5 className="text-white font-bold mb-3 flex items-center gap-2 text-sm">
                            <MessageCircle size={14} className="text-rose-400"/> 
                            Replying as <span className="text-rose-400">{profile?.name || "Venue Owner"}</span>
                          </h5>
                          <textarea
                            required
                            autoFocus
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a professional response to this customer..."
                            className="input-field w-full bg-zinc-900/50 border border-white/5 rounded-xl p-3 text-sm text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none min-h-[80px] transition-all"
                          />
                          <div className="flex justify-end gap-2 mt-3">
                            <button
                              type="button"
                              onClick={() => setReplyingTo(null)}
                              className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="btn-primary text-xs py-2 px-5 shadow-md hover:shadow-rose-500/20"
                            >
                              Post Reply
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setReplyingTo(rev.id);
                          setReplyText("");
                        }}
                        className="mt-2 ml-14 text-zinc-400 hover:text-rose-400 text-xs font-bold flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
                      >
                        <MessageCircle size={14} /> 
                        {rev.replies && rev.replies.length > 0 ? "Add another reply" : "Write a reply"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
      {reviewsData?.meta && <Pagination meta={reviewsData.meta} onPageChange={setPage} />}
    </div>
  );
}
