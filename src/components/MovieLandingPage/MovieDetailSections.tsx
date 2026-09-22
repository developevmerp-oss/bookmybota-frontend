"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
    <div className="flex items-center gap-2 shrink-0">
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
    "absolute z-20 top-1/2 -translate-y-1/2 hidden md:flex size-9 items-center justify-center rounded-full bg-white text-slate-900 shadow-md hover:shadow-lg hover:bg-[#F7E9FF] transition-shadow cursor-pointer";

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
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 lg:p-8">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#111111] mb-4 sm:mb-5">
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
                className={`text-left rounded-2xl ${tone.card} px-4 py-3.5 sm:px-5 sm:py-4 ${
                  isLast ? "lg:translate-x-8" : ""
                }`}
              >
                <span className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}
                  >
                    <Icon className="size-4 sm:size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
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
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
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
                  </span>
                </span>
              </div>
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
      <HeaderCarouselSection title="Cast" muted itemCount={cast.length}>
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

function RelatedMovieCard({ movie }: { movie: Movie }) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const languages = parseLanguageList(movie.languages);
  const multiLang = languages.length > 1;
  const certification = movie.certificate?.trim() || undefined;
  const title = formatMovieCardTitle(movie.title, movie.release_date);
  const poster = resolveMediaUrl(movie.poster_url);
  const promoted = isMoviePromoted(movie.is_promoted);
  const comingSoon = movie.status === "coming_soon";
  const summaryMeta = formatMovieCardMeta(certification, languages);
  const fullMeta = [certification, languages.join(", ")].filter(Boolean).join(" | ");
  const href = movieDetailPath({ id: movie.id, slug: movie.slug });

  return (
    <div className="movies-rail-slot">
      <article className="group flex h-full flex-col overflow-hidden rounded-[10px] bg-white border border-[#E5E5E5]">
        <Link href={href} className="relative shrink-0 overflow-hidden bg-[#111111] block">
          <div className="movies-rail-poster">
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt={title}
                className="movies-rail-poster-img"
                loading="lazy"
              />
            ) : (
              <div className="movies-rail-poster-img bg-slate-200" />
            )}
          </div>
          {promoted ? (
            <span className="movies-rail-badge movies-rail-badge--promoted">Promoted</span>
          ) : null}
          {comingSoon && !promoted ? (
            <span className="movies-rail-badge movies-rail-badge--soon">Coming Soon</span>
          ) : null}
        </Link>

        <div className="movies-rail-meta shrink-0 px-3 pt-2.5 pb-3">
          <Link href={href}>
            <h3 className="movies-rail-title text-[13px] sm:text-[14px] font-bold text-[#111111] line-clamp-2 leading-snug group-hover:text-[#6900AA] transition-colors">
              {title}
            </h3>
          </Link>

          {/* Desktop: summary with language count; hover reveals full language list */}
          <p className="movies-rail-subtitle mt-0.5 text-[11px] sm:text-[12px] text-[#6B7280] leading-snug line-clamp-1 max-md:hidden group-hover:hidden">
            {summaryMeta || "\u00A0"}
          </p>
          <p className="movies-rail-subtitle mt-0.5 text-[11px] sm:text-[12px] text-[#6B7280] leading-snug max-md:hidden hidden group-hover:block">
            {fullMeta || "\u00A0"}
          </p>

          {/* Mobile: collapsed summary; tap expands to full languages */}
          <div className="md:hidden">
            <p
              className={`movies-rail-subtitle mt-0.5 text-[11px] text-[#6B7280] leading-snug ${
                mobileExpanded && multiLang ? "" : "line-clamp-1"
              }`}
            >
              {(mobileExpanded && multiLang ? fullMeta : summaryMeta) || "\u00A0"}
            </p>
            {multiLang ? (
              <button
                type="button"
                className="mt-1 text-[10px] font-semibold text-[#6900AA] cursor-pointer"
                aria-expanded={mobileExpanded}
                onClick={() => setMobileExpanded((open) => !open)}
              >
                {mobileExpanded ? "Show less" : `+${languages.length - 1} more languages`}
              </button>
            ) : null}
          </div>
        </div>
      </article>
    </div>
  );
}

function YouMightAlsoLike({ idOrSlug, currentId }: { idOrSlug: string; currentId: string }) {
  const { data: related = [], isLoading } = useGetRelatedPublicMoviesQuery(
    { idOrSlug, limit: 8 },
    { skip: !idOrSlug }
  );

  const list = related.filter((m) => m.id !== currentId);
  if (isLoading || !list.length) return null;

  return (
    <SectionShell className="pb-12 sm:pb-16">
      <SectionHeading title="You might also like" action={<ViewAllButton label="View all" href="/movies" />} />
      <HScroll
        trackClassName="movies-rail"
        trackStyle={{ ["--movies-visible" as string]: 6 } as CSSProperties}
      >
        {list.map((m) => (
          <RelatedMovieCard key={m.id} movie={m} />
        ))}
      </HScroll>
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
