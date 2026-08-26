"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Share2,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import {
  MOVIE_CATALOG,
  type MovieDetailData,
  type MovieOfferItem,
  type MoviePerson,
  type MovieReviewItem,
} from "@/components/MovieLandingPage/movieCatalog";

const BRAND = "#6900AA";

function SectionShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`py-6 sm:py-8 ${className}`}>
      <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">{children}</div>
    </section>
  );
}

function HScroll({
  children,
  arrowTopClass = "top-1/2 -translate-y-1/2",
}: {
  children: React.ReactNode;
  /** Override vertical position when cards have text below (e.g. posters). */
  arrowTopClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const updateScroll = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setCanScroll({ left: false, right: false });
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    const canOverflow = maxScroll > 2;
    setCanScroll({
      left: canOverflow && el.scrollLeft > 2,
      right: canOverflow && el.scrollLeft < maxScroll - 2,
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    updateScroll();
    const t = window.setTimeout(updateScroll, 150);
    el.addEventListener("scroll", updateScroll, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateScroll) : null;
    ro?.observe(el);
    window.addEventListener("resize", updateScroll);
    return () => {
      window.clearTimeout(t);
      el.removeEventListener("scroll", updateScroll);
      ro?.disconnect();
      window.removeEventListener("resize", updateScroll);
    };
  }, [updateScroll]);

  const scrollBy = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.75, 360), behavior: "smooth" });
  };

  const btnClass =
    "absolute z-20 hidden md:flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.18)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.22)] hover:bg-[#F7E9FF] transition-shadow cursor-pointer";

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-1"
      >
        {children}
      </div>
      {canScroll.left && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className={`${btnClass} left-0 -translate-x-1/2 ${arrowTopClass}`}
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>
      )}
      {canScroll.right && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className={`${btnClass} right-0 translate-x-1/2 ${arrowTopClass}`}
        >
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

function AboutSection({ text }: { text: string }) {
  return (
    <SectionShell>
      <h2 className="text-xl sm:text-2xl font-bold text-[#111111] mb-3 sm:mb-4">About the movie</h2>
      <p className="text-sm sm:text-base text-slate-600 leading-relaxed whitespace-pre-wrap max-w-4xl">
        {text}
      </p>
    </SectionShell>
  );
}

function OffersSection({ offers }: { offers: MovieOfferItem[] }) {
  if (!offers.length) return null;
  return (
    <SectionShell className="pt-0 sm:pt-2">
      <h2 className="text-lg sm:text-xl font-bold text-[#111111] mb-3 sm:mb-4">Top offers for you</h2>
      <HScroll>
        {offers.map((offer) => (
          <button
            key={offer.id}
            type="button"
            onClick={() => toast.message(offer.title)}
            className="shrink-0 w-[min(100%,20rem)] sm:w-[22rem] text-left rounded-xl border border-dashed border-slate-300 bg-[#FFF8E8] px-3.5 py-3 sm:px-4 sm:py-3.5 cursor-pointer hover:bg-[#FFF3D6] transition-colors"
          >
            <span className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#F84464]/40 bg-white">
                <Check size={14} className="text-[#F84464]" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm sm:text-[15px] font-bold text-[#111111] leading-snug">
                  {offer.title}
                </span>
                <span className="block mt-0.5 text-xs sm:text-sm text-slate-500">
                  {offer.subtitle || "Tap to view details"}
                </span>
              </span>
            </span>
          </button>
        ))}
      </HScroll>
    </SectionShell>
  );
}

function CastSection({ cast }: { cast: MoviePerson[] }) {
  if (!cast.length) return null;
  return (
    <SectionShell className="pt-0 sm:pt-2">
      <h2 className="text-xl sm:text-2xl font-bold text-[#111111] mb-3 sm:mb-4">Cast</h2>
      <HScroll arrowTopClass="top-[5rem] sm:top-[5.65rem] -translate-y-1/2">
        {cast.map((person) => (
          <article key={`${person.name}-${person.role}`} className="shrink-0 w-[7.5rem] sm:w-[8.5rem]">
            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-200">
              <img src={person.image} alt={person.name} className="h-full w-full object-cover" />
            </div>
            <p className="mt-2 text-sm font-bold text-[#111111] leading-snug line-clamp-1">
              {person.name}
            </p>
            {person.role && (
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 line-clamp-1">{person.role}</p>
            )}
          </article>
        ))}
      </HScroll>
    </SectionShell>
  );
}

function CrewSection({ crew }: { crew: MoviePerson[] }) {
  if (!crew.length) return null;
  return (
    <SectionShell className="pt-0 sm:pt-2">
      <h2 className="text-xl sm:text-2xl font-bold text-[#111111] mb-3 sm:mb-4">Crew</h2>
      <HScroll arrowTopClass="top-[2.75rem] sm:top-[3.125rem] -translate-y-1/2">
        {crew.map((person) => (
          <article
            key={`${person.name}-${person.role}`}
            className="shrink-0 w-[6.5rem] sm:w-[7.25rem] text-center"
          >
            <div className="mx-auto h-[5.5rem] w-[5.5rem] sm:h-[6.25rem] sm:w-[6.25rem] rounded-full overflow-hidden bg-slate-200 ring-1 ring-slate-200">
              <img src={person.image} alt={person.name} className="h-full w-full object-cover" />
            </div>
            <p className="mt-2 text-sm font-bold text-[#111111] leading-snug line-clamp-2">
              {person.name}
            </p>
            {person.role && (
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 line-clamp-1">{person.role}</p>
            )}
          </article>
        ))}
      </HScroll>
    </SectionShell>
  );
}

function ReviewsSection({
  reviews,
  tags,
  countLabel,
}: {
  reviews: MovieReviewItem[];
  tags: Array<{ tag: string; count: number }>;
  countLabel: string;
}) {
  if (!reviews.length) return null;
  return (
    <SectionShell className="pt-0 sm:pt-2">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-xl sm:text-2xl font-bold text-[#111111]">Top reviews</h2>
        <button
          type="button"
          className="text-sm font-semibold cursor-pointer shrink-0"
          style={{ color: BRAND }}
          onClick={() => toast.message("All reviews coming soon")}
        >
          {countLabel} ›
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-3">Summary of {countLabel.replace(/reviews?/i, "reviews")}.</p>

      {tags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-1">
          {tags.map((t) => (
            <span
              key={t.tag}
              className="shrink-0 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs sm:text-sm text-slate-700"
            >
              <span className="font-medium">{t.tag}</span>
              <span className="ml-1.5 text-slate-400">{t.count}</span>
            </span>
          ))}
        </div>
      )}

      <HScroll>
        {reviews.map((review) => (
          <article
            key={review.id}
            className="shrink-0 w-[min(100%,18rem)] sm:w-[20rem] rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4"
          >
            <div className="flex items-center gap-2 mb-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                {review.userName.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-sm font-semibold text-[#111111]">{review.userName}</span>
              <span className="ml-auto inline-flex items-center gap-1 text-sm font-bold text-[#111111]">
                <Star size={13} className="text-[#F84464]" fill="currentColor" />
                {review.rating}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mb-1.5">{review.text}</p>
            {review.tags && review.tags.length > 0 && (
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-3">
                {review.tags.join(" ")}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <ThumbsUp size={13} /> {review.likes ?? 0}
              </span>
              <span className="inline-flex items-center gap-1">
                <ThumbsDown size={13} /> 0
              </span>
              <span className="ml-auto">{review.timeAgo}</span>
              <button
                type="button"
                aria-label="Share review"
                className="cursor-pointer hover:text-slate-700"
                onClick={() => toast.message("Share coming soon")}
              >
                <Share2 size={13} />
              </button>
            </div>
          </article>
        ))}
      </HScroll>
    </SectionShell>
  );
}

function YouMightAlsoLike({ currentId }: { currentId: string }) {
  const list = MOVIE_CATALOG.filter((m) => m.id !== currentId).slice(0, 8);
  if (!list.length) return null;
  return (
    <SectionShell className="pt-0 sm:pt-2 pb-10 sm:pb-14">
      <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-[#111111]">You might also like</h2>
        <Link
          href="/movies"
          className="text-sm font-semibold shrink-0"
          style={{ color: BRAND }}
        >
          View All ›
        </Link>
      </div>
      <HScroll arrowTopClass="top-[6.4rem] sm:top-[7.1rem] -translate-y-1/2">
        {list.map((m) => (
          <Link key={m.id} href={`/movies/${m.id}`} className="group shrink-0 w-[8.5rem] sm:w-[9.5rem]">
            <div className="aspect-[2/3] rounded-lg overflow-hidden bg-slate-200 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
              <img
                src={m.poster}
                alt={m.title}
                className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
            </div>
            {(m.rating || m.likes) && (
              <div className="mt-2 flex items-center gap-1 text-xs text-slate-700">
                {m.likes ? (
                  <>
                    <ThumbsUp size={12} className="text-[#22C55E]" fill="currentColor" />
                    <span className="truncate">{m.likes}</span>
                  </>
                ) : (
                  <>
                    <Star size={12} className="text-[#F84464]" fill="currentColor" />
                    <span className="font-semibold shrink-0">{m.rating?.replace("/10", "")}</span>
                    {m.votes && <span className="text-slate-500 truncate">{m.votes}</span>}
                  </>
                )}
              </div>
            )}
            <p className="mt-1 text-sm font-semibold text-[#111111] line-clamp-2 leading-snug group-hover:text-[#F84464] transition-colors">
              {m.title}
            </p>
          </Link>
        ))}
      </HScroll>
    </SectionShell>
  );
}

export default function MovieDetailSections({ movie }: { movie: MovieDetailData }) {
  const about =
    movie.synopsis ||
    `${movie.title} is now showing. Check formats, languages, and book your tickets on BookMyBota.`;

  return (
    <div className="bg-white">
      <AboutSection text={about} />
      <OffersSection offers={movie.offers || []} />
      <CastSection cast={movie.cast || []} />
      <CrewSection crew={movie.crew || []} />
      <ReviewsSection
        reviews={movie.reviews || []}
        tags={movie.reviewTags || []}
        countLabel={movie.reviewsCountLabel || "reviews"}
      />
      <YouMightAlsoLike currentId={movie.id} />
    </div>
  );
}
