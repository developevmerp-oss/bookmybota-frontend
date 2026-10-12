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
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Search,
  SlidersHorizontal,
  Ticket,
  X,
} from "lucide-react";
import {
  api,
  useGetPublicMoviesQuery,
  useGetPublicMovieFiltersQuery,
  type Movie,
} from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useAppDispatch } from "@/lib/hooks";
import {
  parseCsvParam,
  sameStringList,
  setOrDeleteCsvParam,
  setOrDeleteParam,
  stableSearchParamsString,
} from "@/lib/filterUrlSync";
import { hasCityFilter, preferCityOrAll, shouldShowShowcaseCards } from "@/components/LandingPage/homeUtils";
import CitySectionEmptyNotice from "@/components/LandingPage/CitySectionEmptyNotice";
import CategoryPromoBanners from "@/components/LandingPage/CategoryPromoBanners";
import ListingPromoSlider, {
  useListingPromoCampaigns,
} from "@/components/LandingPage/ListingPromoSlider";
import { MovieGridShimmer } from "@/components/Shared/Shimmer";
import {
  formatMovieCardTitle,
  isMoviePromoted,
  parseLanguageList,
} from "@/lib/movieDisplay";
import {
  SHOWCASE_NOW_SHOWING_MOVIE_CARDS,
  SHOWCASE_UPCOMING_MOVIE_CARDS,
  type ShowcaseMovieCard,
} from "@/data/showcaseMovieCards";
import SafeCoverImage, { MovieImageFallback } from "@/components/Shared/SafeCoverImage";
import { getEmbedVideoUrl } from "@/components/MovieLandingPage/MovieTrailerModal";
import { MovieNotifyCard } from "@/components/LandingPage/MovieNotifyCard";
import type { MustWatchMovieCard } from "@/components/LandingPage/useMustWatchMoviesCatalog";
import { useStickyHeaderOffset } from "@/lib/useStickyHeaderOffset";
import "./MovieLandingPage.css";
import "@/components/DinningLandingPage/DiningHomePage.css";
import "@/components/DinningLandingPage/DiningSearchPopup.css";

const FORMATS = ["2D", "3D", "4DX", "IMAX 2D"] as const;
const CONTAINER = "bmb-section-container";
const EMPTY_MOVIES: Movie[] = [];
const EMPTY_HERO_EXTRAS: Record<string, string> = {};
const MOVIE_RECENT_SEARCHES_KEY = "movie_recent_searches";
const MOVIE_MAX_RECENT_SEARCHES = 6;

function readMovieRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MOVIE_RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function writeMovieRecentSearches(items: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      MOVIE_RECENT_SEARCHES_KEY,
      JSON.stringify(items.slice(0, MOVIE_MAX_RECENT_SEARCHES))
    );
  } catch {
    /* ignore */
  }
}

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
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] sm:text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
        active
          ? "bg-slate-100 border-slate-400 text-slate-800"
          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
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
        className={`w-5 h-5 rounded-[4px] border flex items-center justify-center shrink-0 ${
          selected ? "border-[#6900AA] bg-[#6900AA]" : "border-slate-300 bg-white"
        }`}
      >
        {selected ? <Check size={13} strokeWidth={3} className="text-white" /> : null}
      </span>
    );
  }
  return (
    <span
      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
        selected ? "border-[#6900AA]" : "border-slate-300"
      }`}
    >
      {selected ? <span className="w-2.5 h-2.5 rounded-full bg-[#6900AA]" /> : null}
    </span>
  );
}

function FilterOptionRow({
  label,
  selected,
  multi,
  onSelect,
}: {
  label: string;
  selected: boolean;
  multi?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full min-w-0 flex items-center justify-between gap-2 py-3 text-left cursor-pointer"
    >
      <span className={`text-base truncate ${selected ? "font-semibold text-slate-800" : "text-slate-600"}`}>
        {label}
      </span>
      <SelectionMark selected={selected} multi={multi} />
    </button>
  );
}

function MoviesEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  variant = "filters",
  dimmed,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "filters" | "generic";
  dimmed?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[#EDE4F5] bg-gradient-to-b from-[#FBF7FF] via-white to-white px-5 py-11 sm:px-8 sm:py-14 text-center ${
        dimmed ? "opacity-70" : ""
      }`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,_rgba(105,0,170,0.10),_transparent_68%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        {variant === "filters" ? (
          <div className="mb-5 w-[180px] sm:w-[220px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/movies/no-filter-results.png?v=4"
              alt="No movies found"
              className="mx-auto h-auto w-full object-contain select-none"
              draggable={false}
            />
          </div>
        ) : (
          <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-[#F3E8FF] text-[#6900AA] ring-1 ring-[#E8D5F8]">
            <Clapperboard className="size-9" strokeWidth={1.75} aria-hidden />
          </div>
        )}
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">{title}</h3>
        <p className="mt-1.5 text-sm text-slate-500 leading-relaxed max-w-sm">{description}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-full bg-[#6900AA] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#57008E]"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
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
  promoted?: boolean;
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
  const ratingNum = Number(movie.rating);
  const reviewsCount = Number(movie.reviews_count) || 0;
  const hasRating = Number.isFinite(ratingNum) && ratingNum > 0 && reviewsCount > 0;
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
    rating: hasRating ? ratingNum.toFixed(1) : undefined,
    votes: hasRating
      ? `${reviewsCount} review${reviewsCount === 1 ? "" : "s"}`
      : undefined,
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
  const promoted = withArt.filter((m) => isMoviePromoted(m.is_promoted));
  const promotedNow = promoted.filter((m) => m.status === "now_showing");
  const nowShowing = withArt.filter((m) => m.status === "now_showing");
  const pool = (
    promotedNow.length
      ? promotedNow
      : promoted.length
        ? promoted
        : nowShowing.length
          ? nowShowing
          : withArt
  ).slice(0, 8);

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
      promoted: isMoviePromoted(movie.is_promoted),
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
        <SafeCoverImage
          src={slide.poster}
          alt={slide.title}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            playTrailer && embedUrl ? "opacity-0" : "opacity-100"
          }`}
          fallbackClassName="absolute inset-0 flex items-center justify-center bg-[#F3F4F6] text-slate-300"
          fallback={<MovieImageFallback size={40} />}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#F3F4F6] text-slate-300">
          <Clapperboard size={40} strokeWidth={1.4} />
        </div>
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

function toLandingMovieCard(movie: MovieCardData): MustWatchMovieCard {
  const ratingNum = movie.rating != null ? Number(movie.rating) : NaN;
  const reviewsCount = movie.votes
    ? Number(String(movie.votes).replace(/[^\d]/g, "")) || 0
    : 0;
  return {
    id: movie.id,
    title: movie.title,
    displayTitle: movie.title,
    poster: movie.poster,
    certification: movie.certification,
    languages: movie.languages,
    genres: movie.genres,
    formats: movie.formats || [],
    rating: Number.isFinite(ratingNum) && ratingNum > 0 ? ratingNum : null,
    reviewsCount,
    comingSoon: movie.comingSoon,
    promoted: movie.promoted,
    href: movie.href || `/movies/${movie.id}`,
    fromPrice: null,
  };
}

/** Same card UI as home landing Notify Movies section. */
function MovieCard({ movie }: { movie: MovieCardData }) {
  return <MovieNotifyCard movie={toLandingMovieCard(movie)} />;
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
  // Same grid as Only in Theatres so card width/height match exactly.
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="inline-flex items-center gap-0.5 text-sm sm:text-base font-semibold text-[#6900AA] hover:text-[#57008E] cursor-pointer shrink-0"
        >
          See All
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:gap-x-4 md:gap-y-6 lg:grid-cols-5">
        {movies.map((movie) => (
          <div key={movie.id} className="min-w-0">
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>
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
      <div className="bmb-section-container">
        <h2 className="mb-3 text-lg sm:text-xl md:text-2xl font-semibold text-slate-900 tracking-tight sm:mb-4">
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
  const router = useRouter();
  const pathname = usePathname() || "/movies";
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const mobilePromoTrackRef = useRef<HTMLDivElement>(null);
  const moviesListingRef = useRef<HTMLElement>(null);
  const filtersStickySentinelRef = useRef<HTMLDivElement>(null);
  const [city, setCity] = useState(() => {
    const cityParam = searchParams.get("city");
    if (cityParam) return cityParam === "All Cities" ? "" : cityParam;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("selected_city");
      return stored && stored !== "All Cities" ? stored : "";
    }
    return "";
  });
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("language") || searchParams.get("languages"))
  );
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("genre") || searchParams.get("genres"))
  );
  const [selectedFormats, setSelectedFormats] = useState<string[]>(() =>
    parseCsvParam(searchParams.get("format") || searchParams.get("formats"))
  );
  const [titleSearch, setTitleSearch] = useState(() => searchParams.get("q") || "");
  const [showMovieSearchPopup, setShowMovieSearchPopup] = useState(false);
  const [movieSearchDraft, setMovieSearchDraft] = useState("");
  const [movieRecentSearches, setMovieRecentSearches] = useState<string[]>([]);
  const movieSearchInputRef = useRef<HTMLInputElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterModalTab, setFilterModalTab] = useState<MovieFilterModalTab>("language");
  const [draftLanguages, setDraftLanguages] = useState<string[]>([]);
  const [draftGenres, setDraftGenres] = useState<string[]>([]);
  const [draftFormats, setDraftFormats] = useState<string[]>([]);
  const headerOffset = useStickyHeaderOffset();
  const [isFiltersStuck, setIsFiltersStuck] = useState(false);
  const [viewAll, setViewAll] = useState<ViewAllKey>(null);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [heroSlideTransition, setHeroSlideTransition] = useState(true);
  const [mobilePromoIndex, setMobilePromoIndex] = useState(0);
  const [promoDesktopAutoplay, setPromoDesktopAutoplay] = useState(false);
  const [heroAboutById, setHeroAboutById] = useState<Record<string, string>>({});
  const [heroTrailerById, setHeroTrailerById] = useState<Record<string, string>>({});

  const scrollToMoviesListing = useCallback(() => {
    window.setTimeout(() => {
      moviesListingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const openFiltersModal = useCallback((tab: MovieFilterModalTab = "language") => {
    setDraftLanguages([...selectedLanguages]);
    setDraftGenres([...selectedGenres]);
    setDraftFormats([...selectedFormats]);
    setFilterModalTab(tab);
    setFiltersOpen(true);
  }, [selectedLanguages, selectedGenres, selectedFormats]);

  const applyFiltersAndClose = useCallback(() => {
    setSelectedLanguages(draftLanguages);
    setSelectedGenres(draftGenres);
    setSelectedFormats(draftFormats);
    setFiltersOpen(false);
    scrollToMoviesListing();
  }, [draftLanguages, draftGenres, draftFormats, scrollToMoviesListing]);

  const resetDraftFilters = useCallback(() => {
    setDraftLanguages([]);
    setDraftGenres([]);
    setDraftFormats([]);
  }, []);

  useEffect(() => {
    const sentinel = filtersStickySentinelRef.current;
    if (!sentinel) {
      setIsFiltersStuck(false);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const next = !entry.isIntersecting;
        setIsFiltersStuck((prev) => (prev === next ? prev : next));
      },
      {
        root: null,
        threshold: 0,
        rootMargin: `-${Math.max(headerOffset, 1)}px 0px 0px 0px`,
      }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [headerOffset]);

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

  useEffect(() => {
    const languagesFromUrl = parseCsvParam(
      searchParams.get("language") || searchParams.get("languages")
    );
    const genresFromUrl = parseCsvParam(searchParams.get("genre") || searchParams.get("genres"));
    const formatsFromUrl = parseCsvParam(
      searchParams.get("format") || searchParams.get("formats")
    );
    const qFromUrl = searchParams.get("q") || "";
    const cityParam = searchParams.get("city");

    setSelectedLanguages((prev) =>
      sameStringList(prev, languagesFromUrl) ? prev : languagesFromUrl
    );
    setSelectedGenres((prev) => (sameStringList(prev, genresFromUrl) ? prev : genresFromUrl));
    setSelectedFormats((prev) => (sameStringList(prev, formatsFromUrl) ? prev : formatsFromUrl));
    setTitleSearch((prev) => (prev === qFromUrl ? prev : qFromUrl));

    if (cityParam) {
      const nextCity = cityParam === "All Cities" ? "" : cityParam;
      setCity((prev) => (prev === nextCity ? prev : nextCity));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParamsKey drives URL hydration
  }, [searchParamsKey]);

  useEffect(() => {
    const params = new URLSearchParams();
    setOrDeleteCsvParam(params, "language", selectedLanguages);
    setOrDeleteCsvParam(params, "genre", selectedGenres);
    setOrDeleteCsvParam(params, "format", selectedFormats);
    setOrDeleteParam(params, "q", titleSearch);
    setOrDeleteParam(params, "city", city);
    if (stableSearchParamsString(params) === stableSearchParamsString(searchParams)) return;
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit searchParams so inbound URL nav is not overwritten by stale state
  }, [selectedLanguages, selectedGenres, selectedFormats, titleSearch, city, pathname, router]);

  const hasCity = hasCityFilter(city);
  const { hasCampaigns: hasMoviePromoCampaigns } = useListingPromoCampaigns("MOVIES", city);

  const titleSearchTrimmed = titleSearch.trim();

  const moviesQueryArg = useMemo(
    () => ({
      page: 1,
      limit: 100,
      ...(hasCity ? { city } : {}),
      ...(selectedLanguages.length ? { language: selectedLanguages.join(",") } : {}),
      ...(selectedGenres.length ? { genre: selectedGenres.join(",") } : {}),
      ...(selectedFormats.length ? { format: selectedFormats.join(",") } : {}),
      ...(titleSearchTrimmed ? { q: titleSearchTrimmed } : {}),
    }),
    [city, hasCity, selectedLanguages, selectedGenres, selectedFormats, titleSearchTrimmed]
  );

  const unscopedMoviesQueryArg = useMemo(
    () => ({
      page: 1,
      limit: 100,
      ...(selectedLanguages.length ? { language: selectedLanguages.join(",") } : {}),
      ...(selectedGenres.length ? { genre: selectedGenres.join(",") } : {}),
      ...(selectedFormats.length ? { format: selectedFormats.join(",") } : {}),
      ...(titleSearchTrimmed ? { q: titleSearchTrimmed } : {}),
    }),
    [selectedLanguages, selectedGenres, selectedFormats, titleSearchTrimmed]
  );

  const filtersQueryArg = useMemo(() => (hasCity ? { city } : undefined), [city, hasCity]);

  const {
    data: cityMoviesData,
    isLoading: cityMoviesLoading,
    isFetching: cityMoviesFetching,
  } = useGetPublicMoviesQuery(moviesQueryArg);
  const {
    data: allMoviesData,
    isLoading: allMoviesLoading,
    isFetching: allMoviesFetching,
  } = useGetPublicMoviesQuery(unscopedMoviesQueryArg, { skip: !hasCity });

  const cityMovieItems = cityMoviesData?.items ?? EMPTY_MOVIES;
  const allMovieItems = allMoviesData?.items ?? EMPTY_MOVIES;
  const usingMoviesFallback = hasCity && cityMovieItems.length === 0;
  const moviesData = usingMoviesFallback ? allMoviesData : cityMoviesData;
  const catalogMovies = preferCityOrAll(cityMovieItems, allMovieItems, hasCity);
  const isLoading =
    cityMoviesLoading || (hasCity && cityMovieItems.length === 0 && allMoviesLoading);
  const isFetching =
    cityMoviesFetching || (usingMoviesFallback && allMoviesFetching);
  const { data: filterOptions } = useGetPublicMovieFiltersQuery(filtersQueryArg);
  const hasCinemasInCity = moviesData?.meta?.has_cinemas_in_city;
  const noCinemasInCity =
    Boolean(hasCity && hasCinemasInCity === false) && catalogMovies.length === 0;

  /** City-strict promoted movies — used only inside ListingPromoSlider when campaigns exist as link context. */
  const moviesById = useMemo(() => {
    const map = new Map<string, Movie>();
    for (const m of catalogMovies) map.set(String(m.id), m);
    for (const m of cityMovieItems) map.set(String(m.id), m);
    return map;
  }, [catalogMovies, cityMovieItems]);

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

  const nowShowingSource = useMemo(
    () => catalogMovies.filter((movie) => movie.status === "now_showing").map(mapCatalogMovieToCard),
    [catalogMovies]
  );

  const comingSoonSource = useMemo(
    () => catalogMovies.filter((movie) => movie.status === "coming_soon").map(mapCatalogMovieToCard),
    [catalogMovies]
  );

  const hasActiveFilters =
    selectedLanguages.length > 0 ||
    selectedGenres.length > 0 ||
    selectedFormats.length > 0 ||
    Boolean(titleSearchTrimmed);

  // City → global (preferCityOrAll) → showcase when both empty (even with city selected)
  const useStaticMovies = shouldShowShowcaseCards(
    !isLoading &&
      !hasActiveFilters &&
      nowShowingSource.length === 0 &&
      comingSoonSource.length === 0
  );

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

  const toggleDraftValue = (
    values: string[],
    setValues: (next: string[]) => void,
    value: string
  ) => {
    setValues(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };

  const clearAll = () => {
    setSelectedLanguages([]);
    setSelectedGenres([]);
    setSelectedFormats([]);
    setTitleSearch("");
  };

  const openMovieSearchPopup = () => {
    setFiltersOpen(false);
    setShowMovieSearchPopup(true);
  };

  const closeMovieSearchPopup = () => {
    setShowMovieSearchPopup(false);
  };

  const commitMovieSearch = (raw: string) => {
    const next = raw.trim();
    setTitleSearch(next);
    scrollToMoviesListing();
    if (next) {
      const updated = [
        next,
        ...readMovieRecentSearches().filter((item) => item.toLowerCase() !== next.toLowerCase()),
      ];
      writeMovieRecentSearches(updated);
      setMovieRecentSearches(updated.slice(0, MOVIE_MAX_RECENT_SEARCHES));
    }
    closeMovieSearchPopup();
  };

  const removeMovieRecentSearch = (term: string) => {
    const updated = readMovieRecentSearches().filter(
      (item) => item.toLowerCase() !== term.toLowerCase()
    );
    writeMovieRecentSearches(updated);
    setMovieRecentSearches(updated);
  };

  useEffect(() => {
    if (!showMovieSearchPopup) return;
    setMovieSearchDraft(titleSearch);
    setMovieRecentSearches(readMovieRecentSearches());
    const focusTimer = window.setTimeout(() => movieSearchInputRef.current?.focus(), 50);
    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarGap > 0) {
      document.body.style.paddingRight = `${scrollbarGap}px`;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMovieSearchPopup();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMovieSearchPopup]);

  const selectedMovieFilterChips = useMemo(
    () => [
      ...selectedLanguages.map((lang) => ({
        key: `lang-${lang}`,
        label: lang,
        onClear: () => {
          toggleLanguage(lang);
          scrollToMoviesListing();
        },
      })),
      ...selectedGenres.map((genre) => ({
        key: `genre-${genre}`,
        label: genre,
        onClear: () => {
          toggleGenre(genre);
          scrollToMoviesListing();
        },
      })),
      ...selectedFormats.map((format) => ({
        key: `format-${format}`,
        label: format,
        onClear: () => {
          toggleFormat(format);
          scrollToMoviesListing();
        },
      })),
    ],
    // toggle helpers are stable inline setters; listing scroll is memoized
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedLanguages, selectedGenres, selectedFormats, scrollToMoviesListing]
  );

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

  const districtFilterModalBody = (
    <div className="flex flex-col sm:flex-row min-h-0 flex-1 overflow-hidden">
      <div className="sm:w-[34%] bg-slate-100 border-b sm:border-b-0 sm:border-r border-slate-200 overflow-x-auto sm:overflow-y-auto shrink-0 sm:h-full">
        <div className="flex sm:flex-col">
          {MOVIE_FILTER_MODAL_TABS.map((tab) => {
            const active = filterModalTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterModalTab(tab.id)}
                className={`relative shrink-0 text-left px-4 py-3.5 text-base whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? "font-semibold text-slate-900 bg-white"
                    : "font-medium text-slate-600 bg-transparent hover:bg-slate-50/80"
                }`}
              >
                {active ? (
                  <span className="absolute left-0 top-0 bottom-0 w-[3px] hidden sm:block bg-[#6900AA]" />
                ) : null}
                <span className="block">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4 min-h-0 h-full bg-white">
        {filterModalTab === "language" ? (
          <div>
            <p className="text-lg font-bold text-slate-900 mb-2">Language</p>
            <div className="grid grid-cols-2 gap-x-4">
              {languageOptions.map((lang) => (
                <FilterOptionRow
                  key={lang}
                  label={lang}
                  selected={draftLanguages.includes(lang)}
                  multi
                  onSelect={() => toggleDraftValue(draftLanguages, setDraftLanguages, lang)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {filterModalTab === "genre" ? (
          <div>
            <p className="text-lg font-bold text-slate-900 mb-2">Genre</p>
            <div className="grid grid-cols-2 gap-x-4">
              {genreOptions.map((genre) => (
                <FilterOptionRow
                  key={genre}
                  label={genre}
                  selected={draftGenres.includes(genre)}
                  multi
                  onSelect={() => toggleDraftValue(draftGenres, setDraftGenres, genre)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {filterModalTab === "format" ? (
          <div>
            <p className="text-lg font-bold text-slate-900 mb-2">Format</p>
            <div className="grid grid-cols-2 gap-x-4">
              {formatOptions.map((format) => (
                <FilterOptionRow
                  key={format}
                  label={format}
                  selected={draftFormats.includes(format)}
                  multi
                  onSelect={() => toggleDraftValue(draftFormats, setDraftFormats, format)}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Top promo — same marketing + city logic / banner UI as dining & landing */}
      <ListingPromoSlider category="MOVIES" city={city} moviesById={moviesById} />
      <CategoryPromoBanners
        category="MOVIES"
        city={city || ""}
        className="bmb-section-container pt-3"
      />

      {/* District / native spotlight hero — disabled (Dining parity). Restore: remove `false &&`. */}
      {false && (
        !hasMoviePromoCampaigns && activeHeroSlide ? (
        <>
          {/* Mobile + tablet — featured cards (centered active + side peeks) */}
          <section className="lg:hidden bg-white pt-3 pb-5 sm:pt-4 sm:pb-6 md:pt-5 md:pb-8">
            <div className="mb-3 px-4 sm:px-5 md:px-6 md:mb-4">
              <h2 className="text-lg font-extrabold text-[#111111] sm:text-xl">
                {heroSlides.some((s) => s.promoted) ? "Promoted movies" : "In the Spotlight"}
              </h2>
            </div>
            <div
              ref={mobilePromoTrackRef}
              className={`flex snap-x snap-mandatory items-center overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                heroSlides.length > 1
                  ? "gap-3 md:gap-4 px-[max(0.75rem,calc((100%-min(72vw,18.5rem))/2))] md:px-[max(1.25rem,calc((100%-min(46vw,21rem))/2))]"
                  : "justify-center px-4 sm:px-5 md:px-6"
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
                      <SafeCoverImage
                        src={slide.blurImage}
                        alt=""
                        className="absolute inset-0 h-full w-full scale-150 object-cover blur-[15px] opacity-80"
                        fallbackClassName="absolute inset-0 flex items-center justify-center bg-[#F3F4F6] text-slate-300"
                        fallback={<MovieImageFallback size={48} />}
                        loading="eager"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#F3F4F6] text-slate-300">
                        <Clapperboard size={48} strokeWidth={1.4} />
                      </div>
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
                        {slide.promoted ? (
                          <p className="mt-2 inline-flex items-center rounded-md bg-[#6900AA]/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-[#6900AA]">
                            Promoted
                          </p>
                        ) : null}
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
                          <SafeCoverImage
                            src={slide.poster}
                            alt={slide.title}
                            className="max-h-full w-auto max-w-[190px] rounded-2xl object-contain drop-shadow-[0_18px_40px_rgba(15,23,42,0.35)] sm:max-w-[235px] md:max-w-[270px] lg:max-w-[300px]"
                            fallbackClassName="flex aspect-[2/3] h-full items-center justify-center rounded-2xl bg-[#F3F4F6] text-slate-300"
                            fallback={<MovieImageFallback size={40} />}
                            loading="eager"
                          />
                        ) : (
                          <div className="flex aspect-[2/3] h-full items-center justify-center rounded-2xl bg-[#F3F4F6] text-slate-300">
                            <Clapperboard size={40} strokeWidth={1.4} />
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
      ) : null
      )}

      <MovieReleasesGrid title="Coming to the Screen" movies={comingSoonMovies} />

      <section
        ref={moviesListingRef}
        id="movies-listing"
        className="bg-white pt-6 sm:pt-8 pb-12 sm:pb-16"
        style={{ scrollMarginTop: headerOffset + 8 }}
      >
        <div className={CONTAINER}>
          <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-slate-900 tracking-tight">
                Only in Theatres
              </h2>
              {hasCity && !isLoading && cityMovieItems.length === 0 ? (
                <CitySectionEmptyNotice message="No movies available in your city yet." />
              ) : null}
            </div>
            <Link
              href={cinemasHref}
              className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[#6900AA] hover:text-[#57008E]"
            >
              <Ticket className="size-4" />
              Browse by Cinemas
            </Link>
          </div>
        </div>

        <div ref={filtersStickySentinelRef} className="h-px w-full" aria-hidden />
        <section className="sticky z-30 w-full bg-transparent" style={{ top: headerOffset }}>
          <div className={`dining-filters-sticky w-full ${isFiltersStuck ? "is-stuck" : ""}`}>
            <div className={`${CONTAINER} pt-4 pb-1`}>
              <div className="mb-2">
                <div className="flex items-center gap-2 sm:gap-3 pb-1 -mx-1 px-1">
                  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-hide">
                    <button
                      type="button"
                      onClick={() => openFiltersModal("language")}
                      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] sm:text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        selectedMovieFilterChips.length > 0 || filtersOpen
                          ? "bg-slate-100 border-slate-400 text-slate-800"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {selectedMovieFilterChips.length > 0 ? (
                        <span className="w-4 h-4 rounded-full text-[0.7rem] font-bold text-white flex items-center justify-center bg-[#6900AA]">
                          {selectedMovieFilterChips.length}
                        </span>
                      ) : null}
                      Filter
                      <SlidersHorizontal size={14} className="text-slate-500" />
                    </button>

                    {selectedMovieFilterChips.map((chip) => (
                      <span
                        key={chip.key}
                        className="shrink-0 inline-flex items-center gap-1.5 bg-[#f7e9ff] border border-[#e3bcff] text-[#6900AA] rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap"
                      >
                        {chip.label}
                        <button
                          type="button"
                          onClick={chip.onClear}
                          className="hover:bg-[#efd7ff] rounded-full p-0.5 transition-colors cursor-pointer"
                          aria-label={`Remove ${chip.label}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}

                    {quickOutsideChips
                      .filter((chip) => {
                        if (chip.type === "language") {
                          return !selectedLanguages.includes(chip.value);
                        }
                        if (chip.type === "genre") {
                          return !selectedGenres.includes(chip.value);
                        }
                        return !selectedFormats.includes(chip.value);
                      })
                      .map((chip) => (
                        <ChipButton
                          key={`${chip.type}-chip-${chip.value}`}
                          label={chip.value}
                          active={false}
                          onClick={() => {
                            if (chip.type === "language") toggleLanguage(chip.value);
                            else if (chip.type === "genre") toggleGenre(chip.value);
                            else toggleFormat(chip.value);
                            scrollToMoviesListing();
                          }}
                        />
                      ))}

                    {hasActiveFilters ? (
                      <button
                        type="button"
                        onClick={() => {
                          clearAll();
                          scrollToMoviesListing();
                        }}
                        className="shrink-0 text-xs font-bold px-2 py-1.5 text-[#6900AA] transition-colors cursor-pointer hover:underline whitespace-nowrap"
                      >
                        Clear All
                      </button>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={openMovieSearchPopup}
                    className="dining-search-trigger shrink-0 inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white text-slate-700 cursor-pointer"
                    aria-label="Search movies"
                  >
                    <Search size={18} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {showMovieSearchPopup &&
          typeof document !== "undefined" &&
          createPortal(
            <div className="dining-search-popup fixed inset-0 z-[220] flex items-start justify-center px-4 pt-[min(18vh,140px)]">
              <button
                type="button"
                aria-label="Close search"
                className="dining-search-popup__backdrop absolute inset-0 bg-slate-900/35 backdrop-blur-[2px]"
                onClick={closeMovieSearchPopup}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Search movies"
                className="dining-search-popup__panel relative w-full max-w-[560px] bg-white rounded-2xl shadow-[0_18px_50px_rgba(15,23,42,0.18)] overflow-hidden"
              >
                <div className="flex items-center gap-3 px-5 sm:px-6 py-4 sm:py-[1.15rem]">
                  <Search size={20} strokeWidth={1.75} className="text-slate-500 shrink-0" />
                  <input
                    ref={movieSearchInputRef}
                    type="text"
                    value={movieSearchDraft}
                    onChange={(e) => {
                      const next = e.target.value;
                      setMovieSearchDraft(next);
                      setTitleSearch(next);
                      scrollToMoviesListing();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitMovieSearch(movieSearchDraft);
                      }
                    }}
                    placeholder="What are you looking for?"
                    className="flex-1 min-w-0 bg-transparent text-[15px] sm:text-base text-slate-800 placeholder:text-slate-400 outline-none"
                    aria-label="Search movies by title"
                  />
                  {movieSearchDraft ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMovieSearchDraft("");
                        setTitleSearch("");
                        scrollToMoviesListing();
                        movieSearchInputRef.current?.focus();
                      }}
                      className="shrink-0 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>

                <div className="dining-search-popup__results border-t border-slate-100">
                  <div className="px-5 sm:px-6 pt-4 pb-5">
                    <p className="text-[15px] font-bold text-slate-900 mb-1">Recent Searches</p>
                    {movieRecentSearches.length === 0 ? (
                      <p className="py-3 text-sm text-slate-400">No recent searches yet</p>
                    ) : (
                      <ul className="divide-y divide-slate-50">
                        {movieRecentSearches.map((term) => (
                          <li key={term} className="flex items-center gap-3 py-3">
                            <button
                              type="button"
                              onClick={() => commitMovieSearch(term)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer group"
                            >
                              <Search
                                size={16}
                                strokeWidth={1.75}
                                className="text-slate-400 shrink-0 group-hover:text-slate-500"
                              />
                              <span className="truncate text-[15px] text-slate-500 group-hover:text-slate-700">
                                {term}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeMovieRecentSearch(term)}
                              className="shrink-0 p-1 rounded-full text-slate-300 hover:text-slate-500 hover:bg-slate-100 cursor-pointer"
                              aria-label={`Remove ${term}`}
                            >
                              <X size={14} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

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
              <h3 className="mb-4 text-lg sm:text-xl md:text-2xl font-semibold text-slate-900 tracking-tight sm:mb-5">
                {viewAllTitle}
              </h3>
              {viewAllMovies.length === 0 ? (
                <MoviesEmptyState
                  title="No movies match these filters"
                  description="Try clearing filters or choosing another language."
                  actionLabel={hasActiveFilters ? "Clear filters" : undefined}
                  onAction={hasActiveFilters ? clearAll : undefined}
                  variant={hasActiveFilters ? "filters" : "generic"}
                />
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
                <MovieGridShimmer count={10} />
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
                <MoviesEmptyState
                  title={
                    hasActiveFilters ? "No movies match these filters" : "No movies available yet"
                  }
                  description={
                    hasActiveFilters
                      ? "Try clearing filters or choosing another language."
                      : "Check back soon for the latest titles in cinemas."
                  }
                  actionLabel={hasActiveFilters ? "Clear filters" : undefined}
                  onAction={hasActiveFilters ? clearAll : undefined}
                  variant={hasActiveFilters ? "filters" : "generic"}
                  dimmed={isFetching}
                />
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
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 cursor-pointer bg-black/40"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="relative w-full sm:w-[min(92vw,720px)] h-[min(88vh,540px)] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Filter</h3>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 cursor-pointer"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            {districtFilterModalBody}
            <div className="flex items-center justify-end gap-6 px-5 py-3.5 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={resetDraftFilters}
                className="text-base font-bold text-[#6900AA] cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={applyFiltersAndClose}
                className="text-base font-bold text-[#6900AA] cursor-pointer"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
