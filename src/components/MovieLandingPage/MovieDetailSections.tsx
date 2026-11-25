"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Link2,
  RefreshCcw,
  Ticket,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useGetRelatedPublicMoviesQuery, type Movie } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import {
  formatMovieCardMeta,
  formatMovieCardTitle,
  isMoviePromoted,
  parseLanguageList,
} from "@/lib/movieDisplay";
import {
  movieDetailPath,
  type MovieDetailData,
  type MovieOfferItem,
  type MoviePerson,
} from "@/components/MovieLandingPage/movieCatalog";
import MovieReviewsSection from "@/components/MovieLandingPage/MovieReviewsSection";
import AdaptiveCardRow from "@/components/LandingPage/AdaptiveCardRow";
import { MovieNotifyCard } from "@/components/LandingPage/MovieNotifyCard";
import type { MustWatchMovieCard } from "@/components/LandingPage/useMustWatchMoviesCatalog";
import "@/components/LandingPage/RecommendedMoviesRail.css";

const BRAND = "#6900AA";

const OFFER_TONES = [
  { card: "bg-orange-50/70", icon: "bg-[#F84464] text-white", Icon: Link2 },
  { card: "bg-violet-50/70", icon: "bg-[#6900AA] text-white", Icon: Ticket },
  { card: "bg-sky-50/70", icon: "bg-orange-400 text-white", Icon: RefreshCcw },
] as const;

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
    <section className={`py-3.5 sm:py-5 lg:py-6 ${muted ? "bg-slate-50" : "bg-white"} ${className}`}>
      <div className="bmb-section-container">{children}</div>
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
    <div className="flex items-center justify-between gap-3 mb-2.5 sm:mb-3.5">
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

function useHorizontalScroll(itemCount: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false, overflow: false });

  const updateScroll = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setCanScroll({ left: false, right: false, overflow: false });
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    const canOverflow = maxScroll > 2;
    setCanScroll({
      overflow: canOverflow,
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
  }, [updateScroll, itemCount]);

  const scrollBy = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.75, 360), behavior: "smooth" });
  };

  return { ref, canScroll, scrollBy };
}

const HEADER_ARROW_CLASS =
  "inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-[#F7E9FF] transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-white";

function HeaderScrollArrows({
  canScroll,
  onScrollLeft,
  onScrollRight,
}: {
  canScroll: { left: boolean; right: boolean; overflow: boolean };
  onScrollLeft: () => void;
  onScrollRight: () => void;
}) {
  if (!canScroll.overflow) return null;
  return (
    <div className="hidden lg:flex items-center gap-2 shrink-0">
      <button
        type="button"
        aria-label="Scroll left"
        onClick={onScrollLeft}
        disabled={!canScroll.left}
        className={HEADER_ARROW_CLASS}
      >
        <ChevronLeft className="size-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label="Scroll right"
        onClick={onScrollRight}
        disabled={!canScroll.right}
        className={HEADER_ARROW_CLASS}
      >
        <ChevronRight className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

function HScroll({
  children,
  trackClassName = "flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-1",
  trackStyle,
}: {
  children: ReactNode;
  trackClassName?: string;
  trackStyle?: CSSProperties;
}) {
  const childCount = Array.isArray(children) ? children.length : 1;
  const { ref, canScroll, scrollBy } = useHorizontalScroll(childCount);

  const btnClass =
    "absolute z-20 top-1/2 -translate-y-1/2 hidden lg:flex size-9 items-center justify-center rounded-full bg-white text-slate-900 shadow-md hover:shadow-lg hover:bg-[#F7E9FF] transition-shadow cursor-pointer";

  return (
    <div className="relative">
      <div ref={ref} className={trackClassName} style={trackStyle}>
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

function HeaderCarouselSection({
  title,
  muted = false,
  itemCount,
  children,
}: {
  title: string;
  muted?: boolean;
  itemCount: number;
  children: React.ReactNode;
}) {
  const { ref, canScroll, scrollBy } = useHorizontalScroll(itemCount);

  return (
    <SectionShell muted={muted}>
      <SectionHeading
        title={title}
        action={
          <HeaderScrollArrows
            canScroll={canScroll}
            onScrollLeft={() => scrollBy(-1)}
            onScrollRight={() => scrollBy(1)}
          />
        }
      />
      <div
        ref={ref}
        className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-1"
      >
        {children}
      </div>
    </SectionShell>
  );
}

function OffersSection({ offers }: { offers: MovieOfferItem[] }) {
  if (!offers.length) return null;

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied ${code}. Use it at checkout.`);
    } catch {
      toast.message(`Use code ${code} at checkout`);
    }
  };

  return (
    <SectionShell>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 lg:p-6 shadow-xs">
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-[#111111] mb-3 sm:mb-4">
          Top offers for you
        </h2>
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:w-4/5">
          {offers.map((offer, i) => {
            const tone = OFFER_TONES[i % OFFER_TONES.length];
            const Icon = tone.Icon;
            const isLast = i === offers.length - 1;
            const code = offer.promo_code?.trim();
            return (
              <div
                key={offer.id}
                className={`text-left rounded-xl sm:rounded-2xl ${tone.card} p-3.5 sm:p-4 border border-black/5 ${
                  isLast ? "lg:translate-x-6" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-xl shadow-xs ${tone.icon}`}
                  >
                    <Icon className="size-4 sm:size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm sm:text-base font-bold text-[#111111] leading-snug">
                      {offer.title}
                    </span>
                    {(offer.description || offer.subtitle) && (
                      <span className="block mt-0.5 text-xs sm:text-sm text-slate-600">
                        {offer.description || offer.subtitle}
                      </span>
                    )}
                    {code ? (
                      <button
                        type="button"
                        onClick={() => copyCode(code)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer shadow-xs active:scale-95 transition-all"
                      >
                        <span className="font-mono">{code}</span>
                        <Copy className="size-3.5" style={{ color: BRAND }} />
                      </button>
                    ) : null}
                    <span
                      className="mt-2 block text-xs sm:text-sm font-semibold"
                      style={{ color: BRAND }}
                    >
                      Use code at checkout
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <img
          src="/images/movies/offers-popcorn.png"
          alt=""
          aria-hidden
          className="hidden lg:block pointer-events-none absolute -right-6 bottom-0 top-6 w-[360px] object-contain object-right"
        />
      </div>
    </SectionShell>
  );
}

function AboutSection({ text }: { text: string }) {
  return (
    <SectionShell>
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#111111] mb-2 sm:mb-2.5">
        About
      </h2>
      <p className="text-sm sm:text-base text-slate-600 leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    </SectionShell>
  );
}

function PersonMemberModal({
  open,
  kind,
  person,
  onClose,
}: {
  open: boolean;
  kind: "Cast" | "Crew";
  person: MoviePerson | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !person) return null;

  const isCast = kind === "Cast";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6 bg-black/55"
      role="dialog"
      aria-modal="true"
      aria-label={`${kind} member`}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[20rem] sm:max-w-[22rem] rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 sm:pt-5">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.14em] text-[#6900AA]">
            {kind}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center px-5 sm:px-6 pb-6 pt-3 text-center">
          <div
            className={`overflow-hidden bg-slate-200 ${
              isCast
                ? "w-36 h-36 sm:w-40 sm:h-40 rounded-xl"
                : "w-32 h-32 sm:w-36 sm:h-36 rounded-full ring-1 ring-slate-200"
            }`}
          >
            <img
              src={person.image}
              alt={person.name}
              className="h-full w-full object-cover"
            />
          </div>
          <h3 className="mt-4 text-lg sm:text-xl font-bold text-[#111111] leading-snug">
            {person.name}
          </h3>
          {person.role ? (
            <p className="mt-1.5 text-sm sm:text-base text-slate-500 leading-snug">
              {person.role}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CastSection({ cast }: { cast: MoviePerson[] }) {
  const [selected, setSelected] = useState<MoviePerson | null>(null);

  if (!cast.length) return null;
  return (
    <>
      <HeaderCarouselSection title="Cast" itemCount={cast.length}>
        {cast.map((person) => (
          <button
            key={`${person.name}-${person.role}`}
            type="button"
            onClick={() => setSelected(person)}
            className="shrink-0 w-1/3 sm:w-1/4 md:w-1/5 lg:w-1/6 text-left cursor-pointer group"
            aria-label={`View cast member ${person.name}`}
          >
            <div className="aspect-square rounded-xl overflow-hidden bg-slate-200">
              <img
                src={person.image}
                alt={person.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <p className="mt-2 text-sm sm:text-base font-bold text-[#111111] leading-snug line-clamp-1">
              {person.name}
            </p>
            {person.role && (
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 line-clamp-1">{person.role}</p>
            )}
          </button>
        ))}
      </HeaderCarouselSection>
      <PersonMemberModal
        open={Boolean(selected)}
        kind="Cast"
        person={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function CrewSection({ crew }: { crew: MoviePerson[] }) {
  const [selected, setSelected] = useState<MoviePerson | null>(null);

  if (!crew.length) return null;
  return (
    <>
      <HeaderCarouselSection title="Crew" itemCount={crew.length}>
        {crew.map((person) => (
          <button
            key={`${person.name}-${person.role}`}
            type="button"
            onClick={() => setSelected(person)}
            className="shrink-0 w-1/4 sm:w-1/5 md:w-1/6 text-center cursor-pointer group"
            aria-label={`View crew member ${person.name}`}
          >
            <div className="mx-auto w-4/5 aspect-square rounded-full overflow-hidden bg-slate-200 ring-1 ring-slate-200">
              <img
                src={person.image}
                alt={person.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <p className="mt-2 text-sm sm:text-base font-bold text-[#111111] leading-snug line-clamp-2">
              {person.name}
            </p>
            {person.role && (
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500 line-clamp-1">{person.role}</p>
            )}
          </button>
        ))}
      </HeaderCarouselSection>
      <PersonMemberModal
        open={Boolean(selected)}
        kind="Crew"
        person={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function toMustWatchMovie(m: Movie): MustWatchMovieCard {
  const ratingNum = m.rating != null ? Number(m.rating) : NaN;
  const reviewsCount = Number(m.reviews_count) || 0;
  const languages = parseLanguageList(m.languages);
  const genres = Array.isArray(m.genres)
    ? m.genres
    : typeof m.genres === "string"
      ? (m.genres as string).split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  return {
    id: String(m.id),
    title: m.title,
    displayTitle: formatMovieCardTitle(m.title, m.release_date),
    poster: resolveMediaUrl(m.poster_url),
    certification: m.certificate?.trim() || undefined,
    languages,
    genres,
    formats: [],
    rating: Number.isFinite(ratingNum) && ratingNum > 0 ? ratingNum : null,
    reviewsCount,
    comingSoon: m.status === "coming_soon",
    promoted: isMoviePromoted(m.is_promoted),
    href: movieDetailPath({ id: m.id, slug: m.slug }),
    fromPrice: null,
  };
}

function YouMightAlsoLike({ idOrSlug, currentId }: { idOrSlug: string; currentId: string }) {
  const { data: related = [], isLoading } = useGetRelatedPublicMoviesQuery(
    { idOrSlug, limit: 8 },
    { skip: !idOrSlug }
  );

  const list = useMemo(() => related.filter((m) => m.id !== currentId), [related, currentId]);
  if (isLoading || !list.length) return null;

  return (
    <SectionShell className="pb-3 sm:pb-4 lg:pb-6">
      <SectionHeading title="You might also like" action={<ViewAllButton label="View all" href="/movies" />} />
      <AdaptiveCardRow minVisible={4} className="adaptive-card-row--four">
        {list.map((m) => (
          <MovieNotifyCard key={m.id} movie={toMustWatchMovie(m)} />
        ))}
      </AdaptiveCardRow>
    </SectionShell>
  );
}

export default function MovieDetailSections({
  movie,
  idOrSlug,
}: {
  movie: MovieDetailData;
  idOrSlug: string;
}) {
  const about =
    movie.synopsis ||
    `${movie.title} is now showing. Check formats, languages, and book your tickets on BookMyBota.`;

  return (
    <div className="bg-white">
      <OffersSection offers={movie.offers || []} />
      <AboutSection text={about} />
      <CastSection cast={movie.cast || []} />
      <CrewSection crew={movie.crew || []} />
      <MovieReviewsSection
        movieId={movie.id}
        movieRating={movie.rating}
        reviewsCount={
          movie.reviewsCountLabel
            ? Number.parseInt(movie.reviewsCountLabel, 10) || undefined
            : undefined
        }
      />
      <YouMightAlsoLike idOrSlug={idOrSlug} currentId={movie.id} />
    </div>
  );
}
