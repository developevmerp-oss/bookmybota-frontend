"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent,
} from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Star,
  ThumbsUp,
  Ticket,
} from "lucide-react";
import { FaChevronDown, FaSlidersH } from "react-icons/fa";
import {
  api,
  useGetPublicMoviesQuery,
  useGetPublicMovieFiltersQuery,
  type Movie,
} from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useAppDispatch } from "@/lib/hooks";
import {
  formatMovieCardMeta,
  formatMovieCardTitle,
  isMoviePromoted,
  parseLanguageList,
} from "@/lib/movieDisplay";
import {
  SHOWCASE_NOW_SHOWING_MOVIE_CARDS,
  SHOWCASE_UPCOMING_MOVIE_CARDS,
  type ShowcaseMovieCard,
} from "@/data/showcaseMovieCards";
import { getEmbedVideoUrl } from "@/components/MovieLandingPage/MovieTrailerModal";
import "./MovieLandingPage.css";
import "@/components/LandingPage/RecommendedMoviesRail.css";

const FORMATS = ["2D", "3D", "4DX", "IMAX 2D"] as const;
const MOVIES_VISIBLE = 6;
const CONTAINER = "container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0";
const EMPTY_MOVIES: Movie[] = [];
const EMPTY_HERO_EXTRAS: Record<string, string> = {};

type MovieFilterModalTab = "language" | "genre" | "format";

const MOVIE_FILTER_MODAL_TABS: Array<{ id: MovieFilterModalTab; label: string }> = [
  { id: "language", label: "Language" },
  { id: "genre", label: "Genre" },
  { id: "format", label: "Format" },
];

function ChipButton({
  label,
  active,
  onClick,
  icon,
  trailing,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  icon?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 shrink-0 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium border cursor-pointer transition-colors whitespace-nowrap ${
        active
          ? "bg-[#EDE7F6] border-[#7C3AED] text-slate-900"
          : "bg-white border-slate-300 text-slate-800 hover:border-slate-400"
      }`}
    >
      {icon}
      {label}
      {trailing}
    </button>
  );
}

function SelectionMark({ selected, multi }: { selected: boolean; multi?: boolean }) {
  if (multi) {
    return (
      <span
        className={`flex size-4 shrink-0 items-center justify-center rounded-[3px] border ${
          selected ? "border-[#7C3AED] bg-[#7C3AED] text-white" : "border-slate-700 bg-white"
        }`}
      >
        {selected ? (
          <svg viewBox="0 0 12 12" className="size-2.5" aria-hidden>
            <path
              d="M2.5 6.2 4.8 8.5 9.5 3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
    );
  }
  return (
    <span
      className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
        selected ? "border-[#7C3AED] bg-[#7C3AED]" : "border-slate-700"
      }`}
    >
      {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
    </span>
  );
}

type MovieCardData = {
  id: string;
  title: string;
  poster: string;
  certification?: string;
  languages: string[];
  genres: string[];
  formats?: string[];
  rating?: string;
  votes?: string;
  likes?: string;
  promoted?: boolean;
  comingSoon?: boolean;
  href?: string;
};

type ViewAllKey = "now-showing" | "coming-soon" | "top-rated" | null;

type MovieHeroSlide = {
  id: string;
  href: string;
  title: string;
  poster: string;
  blurImage: string;
  metaLine: string;
  about: string;
  genres: string[];
  trailerUrl: string;
  ctaLabel: string;
  comingSoon: boolean;
  statusLabel: string;
};

/** "U | Biography, Devotional +1 more" — same style as movie detail / 2nd reference. */
function formatMovieBannerMeta(movie: Movie): string {
  const cert = movie.certificate?.trim() || "";
  const genres = (movie.genres || []).map((g) => String(g).trim()).filter(Boolean);
  let genrePart = "";
  if (genres.length === 1) genrePart = genres[0];
  else if (genres.length === 2) genrePart = genres.join(", ");
  else if (genres.length > 2) {
    genrePart = `${genres.slice(0, 2).join(", ")} +${genres.length - 2} more`;
  }
  return [cert, genrePart].filter(Boolean).join(" | ");
}

function primaryMovieTrailerUrl(movie: Movie): string {
  const fromList = Array.isArray(movie.trailers)
    ? movie.trailers.map((t) => String(t?.trailer_url || "").trim()).find(Boolean)
    : "";
  return fromList || String(movie.trailer_url || "").trim();
}

function mapCatalogMovieToCard(movie: Movie): MovieCardData {
  return {
    id: movie.id,
    title: formatMovieCardTitle(movie.title, movie.release_date),
    poster: resolveMediaUrl(movie.poster_url),
    certification: movie.certificate?.trim() || undefined,
    languages: parseLanguageList(movie.languages),
    genres: movie.genres || [],
    formats: movie.formats || [],
    comingSoon: movie.status === "coming_soon",
    promoted: isMoviePromoted(movie.is_promoted),
    href: `/movies/${movie.slug || movie.id}`,
  };
}

function mapShowcaseMovieToCard(movie: ShowcaseMovieCard): MovieCardData {
  return {
    id: movie.id,
    title: formatMovieCardTitle(movie.title, movie.year),
    poster: movie.poster,
    certification: movie.certification,
    languages: parseLanguageList(movie.language),
    genres: [],
    comingSoon: movie.comingSoon,
    promoted: Boolean(movie.promoted),
    href: movie.href,
  };
}

function buildHeroSlides(movies: Movie[]): MovieHeroSlide[] {
  const withArt = movies.filter((m) => m.poster_url || m.banner_url);
  const promotedNow = withArt.filter(
    (m) => m.status === "now_showing" && isMoviePromoted(m.is_promoted)
  );
  const nowShowing = withArt.filter((m) => m.status === "now_showing");
  const pool = (promotedNow.length ? promotedNow : nowShowing.length ? nowShowing : withArt).slice(
    0,
    8
  );

  return pool.map((movie) => {
    const poster =
      resolveMediaUrl(movie.poster_url) || resolveMediaUrl(movie.banner_url) || "";
    const blurImage = resolveMediaUrl(movie.banner_url) || poster;
    const genres = (movie.genres || []).map((g) => String(g).trim()).filter(Boolean);
    return {
      id: movie.id,
      href: `/movies/${movie.slug || movie.id}`,
      title: movie.title,
      poster,
      blurImage,
      metaLine: formatMovieBannerMeta(movie),
      about: String(movie.description || "").trim(),
      genres,
      trailerUrl: primaryMovieTrailerUrl(movie),
      ctaLabel: movie.status === "coming_soon" ? "Coming Soon" : "Book tickets",
      comingSoon: movie.status === "coming_soon",
      statusLabel: movie.status === "coming_soon" ? "Coming soon" : "Now showing",
    };
  });
}

function ratingValue(rating?: string) {
  if (!rating) return 0;
  const n = Number.parseFloat(rating);
  return Number.isFinite(n) ? n : 0;
}

/** Mobile / tablet spotlight card — poster with overlay; trailer autoplays after 2s when active. */
function MoviePromoFeatureCard({
  slide,
  active = false,
}: {
  slide: MovieHeroSlide;
  active?: boolean;
}) {
  const [playTrailer, setPlayTrailer] = useState(false);
  const embedUrl = useMemo(() => {
    if (!slide.trailerUrl) return "";
    const base = getEmbedVideoUrl(slide.trailerUrl);
    if (!base) return "";
    const joiner = base.includes("?") ? "&" : "?";
    return base.includes("mute=") ? base : `${base}${joiner}mute=1`;
  }, [slide.trailerUrl]);

  useEffect(() => {
    setPlayTrailer(false);
    if (!active || !embedUrl) return;
    const t = window.setTimeout(() => setPlayTrailer(true), 2000);
    return () => window.clearTimeout(t);
  }, [active, slide.id, embedUrl]);

  return (
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black origin-center transition-transform duration-300 ease-out ${
        active ? "scale-100" : "scale-[0.92]"
      }`}
    >
      {slide.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.poster}
          alt={slide.title}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            playTrailer && embedUrl ? "opacity-0" : "opacity-100"
          }`}
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900" />
      )}

      {playTrailer && embedUrl ? (
        <iframe
          key={`${slide.id}-trailer`}
          title={`${slide.title} trailer`}
          src={embedUrl}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : null}

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10"
        aria-hidden
      />

      <div className="absolute inset-x-0 bottom-0 z-10 p-3.5 text-center sm:p-4">
        <h3 className="text-lg font-extrabold leading-snug text-white line-clamp-2 sm:text-xl">
          {slide.title}
        </h3>
        {slide.genres.length > 0 ? (
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {slide.genres.slice(0, 2).map((genre) => (
              <span
                key={genre}
                className="rounded-full border border-white/70 px-2.5 py-0.5 text-[11px] font-medium text-white sm:text-xs"
              >
                {genre}
              </span>
            ))}
          </div>
        ) : slide.metaLine ? (
          <p className="mt-1.5 text-xs font-medium text-white/85 line-clamp-1">{slide.metaLine}</p>
        ) : null}
        {slide.comingSoon ? (
          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center justify-center rounded-xl bg-white/90 px-5 py-2.5 text-sm font-bold text-slate-900">
              {slide.ctaLabel}
            </span>
          </div>
        ) : (
          <div className="mt-3 flex justify-center">
            <Link
              href={slide.href}
              className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900 hover:bg-white/95"
              onClick={(e) => e.stopPropagation()}
            >
              {slide.ctaLabel}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function MovieCard({ movie }: { movie: MovieCardData }) {
  const meta = formatMovieCardMeta(movie.certification, movie.languages);

  const inner = (
    <article className="flex h-full flex-col overflow-hidden rounded-[10px] bg-white border border-[#E5E5E5]">
      <div className="relative shrink-0 overflow-hidden bg-[#111111]">
        <div className="movie-listing-poster">
          {movie.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={movie.poster}
              alt={movie.title}
              className="movie-listing-poster-img"
              loading="lazy"
            />
          ) : (
            <div className="movie-listing-poster-img bg-slate-200" />
          )}
        </div>

        {movie.promoted && (
          <span className="movie-listing-badge movie-listing-badge--promoted">Promoted</span>
        )}
        {movie.comingSoon && !movie.promoted && (
          <span className="movie-listing-badge movie-listing-badge--soon">Coming Soon</span>
        )}

        {(movie.likes || movie.rating) && (
          <div className="absolute inset-x-0 bottom-0 z-[2] flex items-center gap-1.5 bg-black/45 backdrop-blur-[2px] px-2 py-1 text-white">
            {movie.likes ? (
              <>
                <ThumbsUp className="size-3 shrink-0 text-[#22C55E]" fill="currentColor" />
                <span className="text-[10px] font-medium truncate">{movie.likes}</span>
              </>
            ) : (
              <>
                <Star className="size-3 shrink-0 text-[#EF4444]" fill="currentColor" />
                <span className="text-[10px] font-semibold shrink-0">{movie.rating}</span>
                {movie.votes && (
                  <span className="text-[10px] text-white/90 truncate">{movie.votes}</span>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <div className="movie-listing-meta shrink-0 px-3 pt-2.5 pb-3">
        <h3 className="movie-listing-title text-[13px] sm:text-[14px] font-bold text-[#111111] leading-snug line-clamp-2 group-hover:text-[#6900AA] transition-colors">
          {movie.title}
        </h3>
        <p className="movie-listing-subtitle mt-0.5 text-[11px] sm:text-[12px] text-[#6B7280] line-clamp-1 leading-snug">
          {meta || "\u00A0"}
        </p>
      </div>
    </article>
  );

  const href = movie.href || `/movies/${movie.id}`;

  return (
    <Link href={href} className="group block h-full w-full min-w-0">
      {inner}
    </Link>
  );
}

function HScroll({ children }: { children: ReactNode }) {
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
    "absolute z-20 top-1/3 -translate-y-1/2 hidden md:flex size-9 items-center justify-center rounded-full bg-white text-slate-900 shadow-md hover:bg-[#F7E9FF] cursor-pointer";

  return (
    <div className="relative">
      <div
        ref={ref}
        className="movies-rail movie-page-rail"
        style={{ ["--movies-visible" as string]: MOVIES_VISIBLE }}
      >
        {children}
      </div>
      {canScroll.left && (
        <button type="button" aria-label="Scroll left" onClick={() => scrollBy(-1)} className={`${btnClass} -left-1 lg:-left-2`}>
          <ChevronLeft className="size-4" />
        </button>
      )}
      {canScroll.right && (
        <button type="button" aria-label="Scroll right" onClick={() => scrollBy(1)} className={`${btnClass} -right-1 lg:-right-2`}>
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}

function OfferShapeCard({
  href,
  title,
  subtitle,
  cta,
  tone,
}: {
  href: string;
  title: string;
  subtitle: string;
  cta: string;
  tone: "peach" | "mint";
}) {
  const isPeach = tone === "peach";
  return (
    <Link
      href={href}
      className={`rounded-2xl p-5 sm:p-6 min-h-40 flex flex-col items-start justify-between ${
        isPeach ? "bg-orange-100 text-orange-950" : "bg-sky-100 text-sky-950"
      }`}
    >
      <div>
        <p className="text-lg sm:text-xl font-bold leading-snug">{title}</p>
        <p className={`mt-1 text-sm sm:text-base ${isPeach ? "text-orange-900/70" : "text-sky-900/70"}`}>
          {subtitle}
        </p>
      </div>
      <span
        className={`mt-4 inline-flex w-fit items-center rounded-lg bg-white px-3 py-1.5 text-sm font-semibold ${
          isPeach ? "text-orange-700" : "text-sky-700"
        }`}
      >
        {cta}
      </span>
    </Link>
  );
}

function MovieRail({
  title,
  movies,
  onSeeAll,
}: {
  title: string;
  movies: MovieCardData[];
  onSeeAll: () => void;
}) {
  if (!movies.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900">{title}</h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="inline-flex items-center gap-0.5 text-sm sm:text-base font-semibold text-[#6900AA] hover:text-[#57008E] cursor-pointer shrink-0"
        >
          See All
          <ChevronRight className="size-4" />
        </button>
      </div>
      <HScroll>
        {movies.map((movie) => (
          <div key={movie.id} className="movies-rail-slot">
            <MovieCard movie={movie} />
          </div>
        ))}
      </HScroll>
    </div>
  );
}

function MovieReleasesGrid({
  title,
  movies,
}: {
  title: string;
  movies: MovieCardData[];
}) {
  const pageSize = 4;
  const showPager = movies.length > pageSize;
  const pageCount = Math.max(1, Math.ceil(movies.length / pageSize));
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  if (!movies.length) return null;

  const visibleMovies = showPager
    ? movies.slice(page * pageSize, page * pageSize + pageSize)
    : movies;

  return (
    <section className="bg-white pt-6 sm:pt-8 pb-2">
      <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">
        <h2 className="mb-3 text-lg font-extrabold text-slate-900 sm:mb-4 sm:text-xl md:text-2xl">
          {title}
        </h2>
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:gap-x-4 md:gap-y-6 lg:grid-cols-5">
          {visibleMovies.map((movie) => (
            <div key={movie.id} className="min-w-0">
              <MovieCard movie={movie} />
            </div>
          ))}
        </div>
        {showPager ? (
          <div className="mt-5 flex items-center justify-center gap-3 sm:mt-6">
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Upcoming movies pages">
              {Array.from({ length: pageCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  role="tab"
                  aria-label={`Page ${index + 1}`}
                  aria-selected={index === page}
                  onClick={() => setPage(index)}
                  className={`size-1.5 rounded-full transition-colors cursor-pointer ${
                    index === page ? "bg-slate-900" : "bg-slate-300"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next upcoming movies"
              onClick={() => setPage((current) => (current + 1) % pageCount)}
              className="flex size-8 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-800 cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function MovieLandingPage() {
  const dispatch = useAppDispatch();
  const mobilePromoTrackRef = useRef<HTMLDivElement>(null);
  const moviesListingRef = useRef<HTMLElement>(null);
  const [city, setCity] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterModalTab, setFilterModalTab] = useState<MovieFilterModalTab>("language");
  const [headerOffset, setHeaderOffset] = useState(112);
  const [viewAll, setViewAll] = useState<ViewAllKey>(null);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [heroSlideTransition, setHeroSlideTransition] = useState(true);
  const [mobilePromoIndex, setMobilePromoIndex] = useState(0);
  const [promoDesktopAutoplay, setPromoDesktopAutoplay] = useState(false);
  const [heroAboutById, setHeroAboutById] = useState<Record<string, string>>({});
  const [heroTrailerById, setHeroTrailerById] = useState<Record<string, string>>({});

  useEffect(() => {
    const measure = () => {
      const header = document.querySelector("header.sticky");
      const h = header instanceof HTMLElement ? header.getBoundingClientRect().height : 112;
      setHeaderOffset(Math.max(64, Math.round(h)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const scrollToMoviesListing = useCallback(() => {
    window.setTimeout(() => {
      moviesListingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const applyFiltersAndClose = useCallback(() => {
    setFiltersOpen(false);
    scrollToMoviesListing();
  }, [scrollToMoviesListing]);

  const moviesQueryArg = useMemo(
    () => ({
      page: 1,
      limit: 100,
      ...(city ? { city } : {}),
      ...(selectedLanguages.length ? { language: selectedLanguages.join(",") } : {}),
      ...(selectedGenres.length ? { genre: selectedGenres.join(",") } : {}),
      ...(selectedFormats.length ? { format: selectedFormats.join(",") } : {}),
    }),
    [city, selectedLanguages, selectedGenres, selectedFormats]
  );

  const filtersQueryArg = useMemo(() => (city ? { city } : undefined), [city]);

  const { data: moviesData, isLoading, isFetching } = useGetPublicMoviesQuery(moviesQueryArg);
  const { data: filterOptions } = useGetPublicMovieFiltersQuery(filtersQueryArg);
  const catalogMovies = moviesData?.items ?? EMPTY_MOVIES;
  const hasCinemasInCity = moviesData?.meta?.has_cinemas_in_city;
  const noCinemasInCity = Boolean(city && hasCinemasInCity === false);

  const heroSlideKey = useMemo(
    () => buildHeroSlides(catalogMovies).map((slide) => slide.id).join("|"),
    [catalogMovies]
  );

  const heroSlides = useMemo(
    () =>
      buildHeroSlides(catalogMovies).map((slide) => ({
        ...slide,
        about: heroAboutById[slide.id] || slide.about,
        trailerUrl: heroTrailerById[slide.id] || slide.trailerUrl,
      })),
    [catalogMovies, heroAboutById, heroTrailerById]
  );
  const promoLoopSlides = useMemo(
    () => [...heroSlides, ...(heroSlides.length > 1 ? [heroSlides[0]] : [])],
    [heroSlides]
  );
  const activeHeroDot = heroSlides.length ? heroSlideIndex % heroSlides.length : 0;
  const activeHeroSlide = heroSlides[activeHeroDot] ?? null;

  // List API omits description/trailers — load from existing public movie detail endpoint
  useEffect(() => {
    const baseSlides = buildHeroSlides(catalogMovies);
    if (baseSlides.length === 0) {
      setHeroAboutById((prev) => (Object.keys(prev).length === 0 ? prev : EMPTY_HERO_EXTRAS));
      setHeroTrailerById((prev) => (Object.keys(prev).length === 0 ? prev : EMPTY_HERO_EXTRAS));
      return;
    }
    let cancelled = false;
    (async () => {
      const nextAbout: Record<string, string> = {};
      const nextTrailer: Record<string, string> = {};
      await Promise.all(
        baseSlides.map(async (slide) => {
          try {
            const movie = await dispatch(
              api.endpoints.getPublicMovie.initiate(slide.id, { forceRefetch: false })
            ).unwrap();
            const about = String(movie.description || "").trim();
            if (about) nextAbout[slide.id] = about;
            const trailer = primaryMovieTrailerUrl(movie);
            if (trailer) nextTrailer[slide.id] = trailer;
          } catch {
            // keep empty extras
          }
        })
      );
      if (!cancelled) {
        setHeroAboutById(nextAbout);
        setHeroTrailerById(nextTrailer);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogMovies, dispatch]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setPromoDesktopAutoplay(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setHeroSlideTransition(false);
    setHeroSlideIndex(0);
    setMobilePromoIndex(0);
    const t = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setHeroSlideTransition(true));
    });
    return () => window.cancelAnimationFrame(t);
  }, [heroSlideKey]);

  useEffect(() => {
    if (!promoDesktopAutoplay || heroSlides.length <= 1) return;
    const t = window.setInterval(() => setHeroSlideIndex((i) => i + 1), 4500);
    return () => window.clearInterval(t);
  }, [promoDesktopAutoplay, heroSlides.length, heroSlideIndex]);

  const syncMobilePromoIndex = useCallback(() => {
    const el = mobilePromoTrackRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>("[data-promo-card]");
    if (!cards.length) return;
    const centerX = el.getBoundingClientRect().left + el.clientWidth / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    cards.forEach((card, i) => {
      const r = card.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      const dist = Math.abs(mid - centerX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setMobilePromoIndex(best);
  }, []);

  const centerMobilePromoCard = useCallback(
    (index = 0, behavior: ScrollBehavior = "auto") => {
      const el = mobilePromoTrackRef.current;
      if (!el) return;
      const cards = el.querySelectorAll<HTMLElement>("[data-promo-card]");
      const card = cards[index];
      if (!card) return;
      const left = card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2;
      el.scrollTo({ left: Math.max(0, left), behavior });
      setMobilePromoIndex(index);
    },
    []
  );

  useEffect(() => {
    if (heroSlides.length < 2) return;
    const frame = window.requestAnimationFrame(() => {
      centerMobilePromoCard(0, "auto");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [heroSlideKey, heroSlides.length, centerMobilePromoCard]);

  const goNextPromo = () => setHeroSlideIndex((i) => i + 1);
  const goPrevPromo = () => {
    if (heroSlides.length <= 1) return;
    if (heroSlideIndex === 0) {
      setHeroSlideTransition(false);
      setHeroSlideIndex(heroSlides.length);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setHeroSlideTransition(true);
          setHeroSlideIndex(heroSlides.length - 1);
        });
      });
      return;
    }
    setHeroSlideIndex((i) => i - 1);
  };
  const onPromoTrackTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.propertyName !== "transform") return;
    if (heroSlides.length <= 1) return;
    if (heroSlideIndex < heroSlides.length) return;
    setHeroSlideTransition(false);
    setHeroSlideIndex(0);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setHeroSlideTransition(true));
    });
  };

  useEffect(() => {
    const applyCity = () => {
      const stored = localStorage.getItem("selected_city");
      setCity(stored && stored !== "All Cities" ? stored : "");
    };
    applyCity();
    window.addEventListener("selected_city_changed", applyCity);
    window.addEventListener("storage", applyCity);
    return () => {
      window.removeEventListener("selected_city_changed", applyCity);
      window.removeEventListener("storage", applyCity);
    };
  }, []);

  const languageOptions = useMemo(() => filterOptions?.languages ?? [], [filterOptions]);

  const genreOptions = useMemo(() => filterOptions?.genres ?? [], [filterOptions]);

  const formatOptions = useMemo(() => {
    const fromApi = filterOptions?.formats ?? [];
    if (fromApi.length > 0) return fromApi;
    return [...FORMATS];
  }, [filterOptions]);

  const quickOutsideChips = useMemo(() => {
    const resolve = (pool: string[], label: string) => {
      const match = pool.find((item) => item.toLowerCase() === label.toLowerCase());
      return match || label;
    };

    return [
      { type: "language" as const, value: resolve(languageOptions, "Amharic") },
      { type: "language" as const, value: resolve(languageOptions, "English") },
      { type: "genre" as const, value: resolve(genreOptions, "Action") },
      { type: "genre" as const, value: resolve(genreOptions, "Drama") },
      { type: "format" as const, value: resolve(formatOptions, "2D") },
      { type: "format" as const, value: resolve(formatOptions, "3D") },
    ];
  }, [languageOptions, genreOptions, formatOptions]);

  const quickOutsideKeys = useMemo(
    () => new Set(quickOutsideChips.map((chip) => `${chip.type}:${chip.value}`)),
    [quickOutsideChips]
  );

  const nowShowingSource = useMemo(
    () => catalogMovies.filter((movie) => movie.status === "now_showing").map(mapCatalogMovieToCard),
    [catalogMovies]
  );

  const comingSoonSource = useMemo(
    () => catalogMovies.filter((movie) => movie.status === "coming_soon").map(mapCatalogMovieToCard),
    [catalogMovies]
  );

  const hasActiveFilters =
    selectedLanguages.length > 0 || selectedGenres.length > 0 || selectedFormats.length > 0;

  const useStaticMovies =
    !isLoading &&
    !hasActiveFilters &&
    nowShowingSource.length === 0 &&
    comingSoonSource.length === 0;

  const movies = useStaticMovies
    ? SHOWCASE_NOW_SHOWING_MOVIE_CARDS.map(mapShowcaseMovieToCard)
    : nowShowingSource;
  const comingSoonMovies = useStaticMovies
    ? SHOWCASE_UPCOMING_MOVIE_CARDS.map(mapShowcaseMovieToCard)
    : comingSoonSource;

  const topRatedMovies = useMemo(() => {
    return [...movies]
      .filter((m) => ratingValue(m.rating) > 0)
      .sort((a, b) => ratingValue(b.rating) - ratingValue(a.rating));
  }, [movies]);

  const headingCity = city || "Ethiopia";
  const cinemasHref = city
    ? `/movies/cinemas?city=${encodeURIComponent(city)}`
    : "/movies/cinemas";

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const toggleFormat = (format: string) => {
    setSelectedFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    );
  };

  const clearAll = () => {
    setSelectedLanguages([]);
    setSelectedGenres([]);
    setSelectedFormats([]);
  };

  const openViewAll = (key: Exclude<ViewAllKey, null>) => {
    setViewAll(key);
    scrollToMoviesListing();
  };

  const viewAllTitle =
    viewAll === "now-showing"
      ? "Only in Theatres"
      : viewAll === "coming-soon"
        ? "Upcoming Movies"
        : viewAll === "top-rated"
          ? "Top Rated Movies"
          : "";

  const viewAllMovies =
    viewAll === "now-showing"
      ? movies
      : viewAll === "coming-soon"
        ? comingSoonMovies
        : viewAll === "top-rated"
          ? topRatedMovies
          : [];

  const tabHasSelection = (tab: MovieFilterModalTab) => {
    if (tab === "language") return selectedLanguages.length > 0;
    if (tab === "genre") return selectedGenres.length > 0;
    if (tab === "format") return selectedFormats.length > 0;
    return false;
  };

  const districtFilterModalBody = (
    <div className="flex min-h-[280px] overflow-hidden rounded-xl bg-[#F3F3F3]">
      <div className="w-[34%] sm:w-[38%] shrink-0 bg-white py-2">
        {MOVIE_FILTER_MODAL_TABS.map((tab) => {
          const active = filterModalTab === tab.id;
          const hasValue = tabHasSelection(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterModalTab(tab.id)}
              className={`flex w-full items-center justify-between px-3 sm:px-4 py-3 text-left text-sm cursor-pointer transition-colors ${
                active
                  ? "bg-[#EDE9FE] font-semibold text-[#5B21B6]"
                  : hasValue
                    ? "font-semibold text-[#6900AA] hover:bg-slate-50"
                    : "font-medium text-slate-800 hover:bg-slate-50"
              }`}
            >
              <span>{tab.label}</span>
              {hasValue ? <span className="size-1.5 rounded-full bg-[#6900AA]" /> : null}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {filterModalTab === "language" ? (
          <div className="space-y-1">
            {languageOptions.map((lang) => {
              const selected = selectedLanguages.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-slate-800 cursor-pointer hover:bg-white/70"
                >
                  <SelectionMark selected={selected} multi />
                  {lang}
                </button>
              );
            })}
          </div>
        ) : null}

        {filterModalTab === "genre" ? (
          <div className="space-y-1">
            {genreOptions.map((genre) => {
              const selected = selectedGenres.includes(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-slate-800 cursor-pointer hover:bg-white/70"
                >
                  <SelectionMark selected={selected} multi />
                  {genre}
                </button>
              );
            })}
          </div>
        ) : null}

        {filterModalTab === "format" ? (
          <div className="space-y-1">
            {formatOptions.map((format) => {
              const selected = selectedFormats.includes(format);
              return (
                <button
                  key={format}
                  type="button"
                  onClick={() => toggleFormat(format)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-slate-800 cursor-pointer hover:bg-white/70"
                >
                  <SelectionMark selected={selected} multi />
                  {format}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {activeHeroSlide ? (
        <>
          {/* Mobile + tablet — featured cards (centered active + side peeks) */}
          <section className="lg:hidden bg-white pt-3 pb-5 sm:pt-4 sm:pb-6 md:pt-5 md:pb-8">
            <div className="mb-3 px-5 sm:px-8 md:mb-4">
              <h2 className="text-lg font-extrabold text-[#111111] sm:text-xl">In the Spotlight</h2>
            </div>
            <div
              ref={mobilePromoTrackRef}
              className={`flex snap-x snap-mandatory items-center overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                heroSlides.length > 1
                  ? "gap-3 md:gap-4 px-[max(0.75rem,calc((100%-min(72vw,18.5rem))/2))] md:px-[max(1.25rem,calc((100%-min(46vw,21rem))/2))]"
                  : "justify-center px-5 sm:px-8"
              }`}
              onScroll={heroSlides.length > 1 ? syncMobilePromoIndex : undefined}
            >
              {heroSlides.map((slide, slideIdx) => (
                <div
                  key={slide.id}
                  data-promo-card
                  className={`shrink-0 snap-center ${
                    heroSlides.length > 1
                      ? "w-[min(72vw,18.5rem)] md:w-[min(46vw,21rem)]"
                      : "w-[min(78vw,20rem)] md:w-[min(52vw,21.25rem)]"
                  }`}
                >
                  <MoviePromoFeatureCard
                    slide={slide}
                    active={heroSlides.length <= 1 || slideIdx === mobilePromoIndex}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Desktop — District-style blur banner (same layout as events) */}
          <section className="relative hidden w-full overflow-hidden bg-white lg:block">
            {heroSlides.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous promo"
                  onClick={goPrevPromo}
                  className="absolute left-2 top-1/2 z-20 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center text-slate-800 hover:opacity-70 xl:left-6 2xl:left-12 sm:size-10"
                >
                  <ChevronLeft className="size-5" strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  aria-label="Next promo"
                  onClick={goNextPromo}
                  className="absolute right-2 top-1/2 z-20 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center text-slate-800 hover:opacity-70 xl:right-6 2xl:right-12 sm:size-10"
                >
                  <ChevronRight className="size-5" strokeWidth={2.25} />
                </button>
              </>
            ) : null}

            <div
              className={`flex will-change-transform ${
                heroSlideTransition ? "transition-transform duration-700 ease-out" : ""
              }`}
              style={{ transform: `translateX(-${heroSlideIndex * 100}%)` }}
              onTransitionEnd={onPromoTrackTransitionEnd}
            >
              {promoLoopSlides.map((slide, slideIdx) => (
                <div
                  key={slideIdx === heroSlides.length ? `${slide.id}-loop` : slide.id}
                  className="relative w-full shrink-0 grow-0 basis-full"
                >
                  <div className="absolute inset-0 overflow-hidden" aria-hidden>
                    {slide.blurImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={slide.blurImage}
                        alt=""
                        className="absolute inset-0 h-full w-full scale-150 object-cover blur-[15px] opacity-80"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-slate-200" />
                    )}
                    <div className="absolute inset-0 bg-white/55" />
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(to top, #ffffff 0%, rgba(255,255,255,0.85) 28%, rgba(255,255,255,0.35) 55%, rgba(255,255,255,0.15) 75%, transparent 100%)",
                      }}
                    />
                  </div>

                  <div
                    className={`relative ${CONTAINER} py-8 sm:py-10 lg:py-12 lg:px-16 xl:px-14 2xl:px-12 ${
                      heroSlides.length > 1 ? "pb-14 sm:pb-16" : ""
                    }`}
                  >
                    <div className="flex flex-col-reverse items-center gap-6 md:flex-row md:items-center md:gap-10 lg:gap-14">
                      <div className="min-w-0 flex-1 text-slate-900">
                        <h1 className="line-clamp-3 text-xl font-extrabold leading-tight sm:text-2xl md:text-3xl lg:text-4xl">
                          {slide.title}
                        </h1>
                        {slide.metaLine ? (
                          <p className="mt-2 text-sm font-medium text-slate-600 sm:text-base md:text-lg">
                            {slide.metaLine}
                          </p>
                        ) : null}
                        {slide.about ? (
                          <p className="mt-3 line-clamp-4 text-sm font-medium leading-relaxed text-slate-700 sm:text-base md:text-lg">
                            {slide.about}
                          </p>
                        ) : null}
                        <div className="mt-4 sm:mt-5">
                          {slide.comingSoon ? (
                            <span className="inline-flex items-center justify-center rounded-2xl bg-[#131316]/80 px-5 py-2 text-sm font-bold text-[#fff8da] sm:px-8 sm:py-4 sm:text-base md:px-10 md:py-5">
                              {slide.ctaLabel}
                            </span>
                          ) : (
                            <Link
                              href={slide.href}
                              className="inline-flex items-center justify-center rounded-2xl bg-[#131316] px-5 py-2 text-sm font-bold text-[#fff8da] transition-colors hover:bg-zinc-900 sm:px-8 sm:py-4 sm:text-base md:px-10 md:py-5"
                            >
                              {slide.ctaLabel}
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="mx-auto flex h-[280px] shrink-0 items-center justify-center sm:h-[340px] md:mx-0 md:h-[380px] lg:h-[420px]">
                        {slide.poster ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={slide.poster}
                            alt={slide.title}
                            className="max-h-full w-auto max-w-[190px] rounded-2xl object-contain drop-shadow-[0_18px_40px_rgba(15,23,42,0.35)] sm:max-w-[235px] md:max-w-[270px] lg:max-w-[300px]"
                          />
                        ) : (
                          <div className="flex aspect-[2/3] h-full items-center justify-center rounded-2xl bg-slate-200 px-4 text-center text-sm font-medium text-slate-500">
                            {slide.title}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {heroSlides.length > 1 ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center gap-1.5">
                {heroSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    aria-label={`Show ${slide.title}`}
                    onClick={() => setHeroSlideIndex(index)}
                    className={`pointer-events-auto h-1.5 rounded-full transition-all cursor-pointer ${
                      index === activeHeroDot ? "w-6 bg-slate-900" : "w-1.5 bg-slate-400/50"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      <MovieReleasesGrid title="Coming to the Screen" movies={comingSoonMovies} />

      <section
        ref={moviesListingRef}
        id="movies-listing"
        className="bg-white pt-6 sm:pt-8 pb-12 sm:pb-16"
        style={{ scrollMarginTop: headerOffset + 8 }}
      >
        <div className={CONTAINER}>
          <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl md:text-2xl lg:text-3xl">
              Only in Theatres
            </h2>
            <Link
              href={cinemasHref}
              className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#6900AA] hover:text-[#57008E]"
            >
              <Ticket className="size-4" />
              Browse by Cinemas
            </Link>
          </div>
        </div>

        <div
          className="sticky z-40 w-full border-b border-slate-100 bg-white/95 backdrop-blur-sm shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
          style={{ top: headerOffset }}
        >
          <div
            className={`${CONTAINER} flex gap-2 overflow-x-auto py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
          >
            <ChipButton
              label={hasActiveFilters ? "Filters · On" : "Filters"}
              active={filtersOpen || hasActiveFilters}
              onClick={() => {
                setFilterModalTab("language");
                setFiltersOpen(true);
              }}
              icon={<FaSlidersH size={12} />}
              trailing={<FaChevronDown size={10} className="opacity-60" />}
            />
            {quickOutsideChips.map((chip) => (
              <ChipButton
                key={`${chip.type}-chip-${chip.value}`}
                label={chip.value}
                active={
                  chip.type === "language"
                    ? selectedLanguages.includes(chip.value)
                    : chip.type === "genre"
                      ? selectedGenres.includes(chip.value)
                      : selectedFormats.includes(chip.value)
                }
                onClick={() => {
                  if (chip.type === "language") toggleLanguage(chip.value);
                  else if (chip.type === "genre") toggleGenre(chip.value);
                  else toggleFormat(chip.value);
                  scrollToMoviesListing();
                }}
              />
            ))}
            {selectedLanguages
              .filter((lang) => !quickOutsideKeys.has(`language:${lang}`))
              .map((lang) => (
                <ChipButton
                  key={`lang-selected-${lang}`}
                  label={lang}
                  active
                  onClick={() => {
                    toggleLanguage(lang);
                    scrollToMoviesListing();
                  }}
                />
              ))}
            {selectedFormats
              .filter((format) => !quickOutsideKeys.has(`format:${format}`))
              .map((format) => (
                <ChipButton
                  key={`format-selected-${format}`}
                  label={format}
                  active
                  onClick={() => {
                    toggleFormat(format);
                    scrollToMoviesListing();
                  }}
                />
              ))}
            {selectedGenres
              .filter((genre) => !quickOutsideKeys.has(`genre:${genre}`))
              .map((genre) => (
                <ChipButton
                  key={`genre-chip-${genre}`}
                  label={genre}
                  active
                  onClick={() => {
                    toggleGenre(genre);
                    scrollToMoviesListing();
                  }}
                />
              ))}
          </div>
        </div>

        <div className={`${CONTAINER} pt-5`}>
          {viewAll ? (
            <div>
              <button
                type="button"
                onClick={() => setViewAll(null)}
                className="mb-4 inline-flex cursor-pointer items-center gap-1 text-sm font-semibold text-[#6900AA] hover:text-[#57008E] sm:text-base"
              >
                <ChevronLeft className="size-4" />
                Back
              </button>
              <h3 className="mb-4 text-lg font-extrabold text-slate-900 sm:mb-5 sm:text-xl md:text-2xl">
                {viewAllTitle}
              </h3>
              {viewAllMovies.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-800">No movies match these filters</p>
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="mt-4 cursor-pointer text-sm font-semibold text-[#6900AA] underline"
                    >
                      Clear filters
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:gap-x-4 md:gap-y-6 lg:grid-cols-5">
                  {viewAllMovies.map((movie) => (
                    <div key={movie.id} className="min-w-0">
                      <MovieCard movie={movie} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8 sm:space-y-10">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
                  <Loader2 className="size-8 animate-spin text-[#6900AA]" />
                  <p className="text-sm font-medium sm:text-base">Loading movies...</p>
                </div>
              ) : noCinemasInCity && !useStaticMovies ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-800">No cinemas in {headingCity} yet</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Try another city or browse cinemas near you.
                  </p>
                  <Link
                    href={cinemasHref}
                    className="mt-4 inline-flex text-sm font-semibold text-[#6900AA] hover:text-[#57008E]"
                  >
                    Browse by Cinemas
                  </Link>
                </div>
              ) : movies.length === 0 ? (
                <div
                  className={`rounded-xl border border-slate-200 bg-slate-50 px-4 py-10 text-center ${
                    isFetching ? "opacity-70" : ""
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {hasActiveFilters ? "No movies match these filters" : "No movies available yet"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {hasActiveFilters
                      ? "Try clearing filters or choosing another language."
                      : "Check back soon for the latest titles in cinemas."}
                  </p>
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="mt-4 cursor-pointer text-sm font-semibold text-[#6900AA] underline"
                    >
                      Clear filters
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className={isFetching ? "opacity-70 transition-opacity" : ""}>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:gap-x-4 md:gap-y-6 lg:grid-cols-5">
                    {movies.map((movie) => (
                      <div key={movie.id} className="min-w-0">
                        <MovieCard movie={movie} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div id="coming-soon" className="scroll-mt-28" />

              <MovieRail
                title="Top Rated Movies"
                movies={topRatedMovies}
                onSeeAll={() => openViewAll("top-rated")}
              />
            </div>
          )}
        </div>
      </section>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 cursor-pointer bg-black/40"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="relative z-10 flex max-h-[88vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl">
            <div className="px-4 pb-3 pt-4">
              <h3 className="text-lg font-bold text-slate-900">Filter by</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-3">{districtFilterModalBody}</div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={clearAll}
                className="cursor-pointer text-sm font-medium text-slate-800 underline underline-offset-2"
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={applyFiltersAndClose}
                className="cursor-pointer rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-900"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
