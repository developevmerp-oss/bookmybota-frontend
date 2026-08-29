"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Link2,
  RefreshCcw,
  Share2,
  Star,
  ThumbsDown,
  ThumbsUp,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import {
  MOVIE_CATALOG,
  movieDetailPath,
  type MovieDetailData,
  type MovieOfferItem,
  type MoviePerson,
  type MovieReviewItem,
} from "@/components/MovieLandingPage/movieCatalog";

const BRAND = "#6900AA";

const OFFER_TONES = [
  { card: "bg-orange-50/70", icon: "bg-[#F84464] text-white", Icon: Link2 },
  { card: "bg-violet-50/70", icon: "bg-[#6900AA] text-white", Icon: Ticket },
  { card: "bg-sky-50/70", icon: "bg-orange-400 text-white", Icon: RefreshCcw },
] as const;

const REVIEW_ACCENTS = ["border-l-[#6900AA]", "border-l-amber-500", "border-l-emerald-500"];

function SectionShell({
  children,
  className = "",
  muted = false,
}: {
  children: React.ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <section className={`py-8 sm:py-10 lg:py-12 ${muted ? "bg-slate-50" : "bg-white"} ${className}`}>
      <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">{children}</div>
    </section>
  );
}

function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#111111]">{title}</h2>
      {action}
    </div>
  );
}

function ViewAllButton({
  label,
  onClick,
  href,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "inline-flex items-center gap-0.5 text-sm sm:text-base font-semibold shrink-0 hover:opacity-80";
  if (href) {
    return (
      <Link href={href} className={className} style={{ color: BRAND }}>
        {label}
        <ChevronRight className="size-4" />
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={`${className} cursor-pointer`}
      style={{ color: BRAND }}
      onClick={onClick}
    >
      {label}
      <ChevronRight className="size-4" />
    </button>
  );
}

function HScroll({ children }: { children: React.ReactNode }) {
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
    "absolute z-20 top-1/2 -translate-y-1/2 hidden md:flex size-9 items-center justify-center rounded-full bg-white text-slate-900 shadow-md hover:shadow-lg hover:bg-[#F7E9FF] transition-shadow cursor-pointer";

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
          className={`${btnClass} left-0 -translate-x-1/2`}
        >
          <ChevronLeft className="size-4" strokeWidth={1.75} />
        </button>
      )}
      {canScroll.right && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className={`${btnClass} right-0 translate-x-1/2`}
        >
          <ChevronRight className="size-4" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

function OffersSection({ offers }: { offers: MovieOfferItem[] }) {
  if (!offers.length) return null;
  return (
    <SectionShell>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 lg:p-8">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#111111] mb-4 sm:mb-5">
          Top offers for you
        </h2>
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:w-4/5">
          {offers.map((offer, i) => {
            const tone = OFFER_TONES[i % OFFER_TONES.length];
            const Icon = tone.Icon;
            const isLast = i === offers.length - 1;
            return (
              <button
                key={offer.id}
                type="button"
                onClick={() => toast.message(offer.title)}
                className={`text-left rounded-2xl ${tone.card} px-4 py-3.5 sm:px-5 sm:py-4 cursor-pointer hover:brightness-[0.98] ${
                  isLast ? "lg:translate-x-8" : ""
                }`}
              >
                <span className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}
                  >
                    <Icon className="size-4 sm:size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm sm:text-base font-bold text-[#111111] leading-snug">
                      {offer.title}
                    </span>
                    <span className="block mt-0.5 text-xs sm:text-sm text-slate-600">
                      {offer.subtitle || "Tap to view details"}
                    </span>
                    <span
                      className="mt-2 inline-flex items-center gap-0.5 text-xs sm:text-sm font-semibold"
                      style={{ color: BRAND }}
                    >
                      View details
                      <ChevronRight className="size-3.5" />
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <img
          src="/images/movies/offers-popcorn.png"
          alt=""
          aria-hidden
          className="pointer-events-none mx-auto mt-4 w-2/3 sm:w-1/2 lg:z-0 lg:m-0 lg:absolute lg:-right-8 lg:bottom-0 lg:top-7 lg:w-[400px] lg:object-contain lg:object-right"
        />
      </div>
    </SectionShell>
  );
}

function AboutSection({ text }: { text: string }) {
  return (
    <SectionShell>
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#111111] mb-3 sm:mb-4">
        About the movie
      </h2>
      <p className="text-sm sm:text-base text-slate-600 leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    </SectionShell>
  );
}

function CastSection({ cast }: { cast: MoviePerson[] }) {
  if (!cast.length) return null;
  return (
    <SectionShell muted>
      <SectionHeading
        title="Cast"
        action={
          <ViewAllButton
            label="View all"
            onClick={() => toast.message("Full cast coming soon")}
          />
        }
      />
      <HScroll>
        {cast.map((person) => (
          <article
            key={`${person.name}-${person.role}`}
            className="shrink-0 w-1/3 sm:w-1/4 md:w-1/5 lg:w-1/6"
          >
            <div className="aspect-square rounded-xl overflow-hidden bg-slate-200">
              <img src={person.image} alt={person.name} className="h-full w-full object-cover" />
            </div>
            <p className="mt-2 text-sm sm:text-base font-bold text-[#111111] leading-snug line-clamp-1">
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
    <SectionShell>
      <SectionHeading
        title="Crew"
        action={
          <ViewAllButton
            label="View all"
            onClick={() => toast.message("Full crew coming soon")}
          />
        }
      />
      <HScroll>
        {crew.map((person) => (
          <article
            key={`${person.name}-${person.role}`}
            className="shrink-0 w-1/4 sm:w-1/5 md:w-1/6 text-center"
          >
            <div className="mx-auto w-4/5 aspect-square rounded-full overflow-hidden bg-slate-200 ring-1 ring-slate-200">
              <img src={person.image} alt={person.name} className="h-full w-full object-cover" />
            </div>
            <p className="mt-2 text-sm sm:text-base font-bold text-[#111111] leading-snug line-clamp-2">
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
  const summaryLabel = /reviews?/i.test(countLabel)
    ? countLabel.replace(/reviews?/i, "reviews")
    : `${countLabel} reviews`;
  return (
    <SectionShell>
      <div className="flex items-start justify-between gap-3 mb-4 sm:mb-5">
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#111111]">Top reviews</h2>
          <p className="mt-1 text-sm sm:text-base text-slate-500">Summary of {summaryLabel}.</p>
        </div>
        <ViewAllButton
          label={countLabel}
          onClick={() => toast.message("All reviews coming soon")}
        />
      </div>

      {tags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-3 sm:mb-4">
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {reviews.map((review, i) => {
          const booked = /booked on bookmybota/i.test(review.text);
          const body = booked ? null : review.text;
          return (
            <article
              key={review.id}
              className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-4 sm:p-5 shadow-sm ${REVIEW_ACCENTS[i % REVIEW_ACCENTS.length]}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex size-8 sm:size-9 items-center justify-center rounded-full bg-[#F7E9FF] text-xs sm:text-sm font-bold text-[#6900AA]">
                  {review.userName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 text-sm sm:text-base font-semibold text-[#111111] truncate">
                  {review.userName}
                </span>
                <span className="inline-flex items-center gap-1 text-sm sm:text-base font-bold text-[#111111] shrink-0">
                  <Star className="size-3.5 text-[#F84464]" fill="currentColor" />
                  {review.rating}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mb-2">
                {booked ? review.text : "Booked on BookMyBota"}
              </p>
              {body && (
                <p className="text-xs sm:text-sm text-slate-600 mb-2 leading-relaxed">{body}</p>
              )}
              {review.tags && review.tags.length > 0 && (
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-4">
                  {review.tags.join(" ")}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="size-3.5" /> {review.likes ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ThumbsDown className="size-3.5" /> 0
                </span>
                <span className="ml-auto">{review.timeAgo}</span>
                <button
                  type="button"
                  aria-label="Share review"
                  className="cursor-pointer hover:text-slate-600"
                  onClick={() => toast.message("Share coming soon")}
                >
                  <Share2 className="size-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}

function YouMightAlsoLike({ currentId }: { currentId: string }) {
  const list = MOVIE_CATALOG.filter((m) => m.id !== currentId).slice(0, 8);
  if (!list.length) return null;
  return (
    <SectionShell className="pb-12 sm:pb-16">
      <SectionHeading title="You might also like" action={<ViewAllButton label="View all" href="/movies" />} />
      <HScroll>
        {list.map((m) => (
          <Link
            key={m.id}
            href={movieDetailPath(m)}
            className="group shrink-0 w-1/3 sm:w-1/4 md:w-1/5 lg:w-1/6"
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-slate-200">
              <img
                src={m.poster}
                alt={m.title}
                className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
              {(m.rating || m.likes) && (
                <div className="absolute inset-x-0 bottom-0 z-[2] flex items-center gap-1.5 bg-black/45 backdrop-blur-[2px] px-2 py-1.5 text-white">
                  {m.likes ? (
                    <>
                      <ThumbsUp className="size-3 shrink-0 text-[#22C55E]" fill="currentColor" />
                      <span className="text-xs font-medium truncate">{m.likes}</span>
                    </>
                  ) : (
                    <>
                      <Star className="size-3 shrink-0 text-[#EF4444]" fill="currentColor" />
                      <span className="text-xs font-semibold shrink-0">{m.rating}</span>
                      {m.votes && (
                        <span className="text-xs text-white/90 truncate">{m.votes}</span>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
            <h3 className="mt-2 text-sm font-bold text-[#111111] leading-snug line-clamp-2 group-hover:text-[#6900AA] transition-colors">
              {m.title}
            </h3>
            {m.certification && (
              <p className="mt-0.5 text-xs text-slate-500">{m.certification}</p>
            )}
            {m.languages.length > 0 && (
              <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{m.languages.join(", ")}</p>
            )}
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
      <OffersSection offers={movie.offers || []} />
      <AboutSection text={about} />
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
