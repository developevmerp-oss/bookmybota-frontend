"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Star,
  ThumbsUp,
  Ticket,
} from "lucide-react";
import { FaMapMarkerAlt } from "react-icons/fa";
import "swiper/css";
import "swiper/css/pagination";
import {
  useGetPublicMoviesQuery,
  useGetPublicMovieFiltersQuery,
  type Movie,
} from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import {
  SHOWCASE_NOW_SHOWING_MOVIE_CARDS,
  SHOWCASE_UPCOMING_MOVIE_CARDS,
  type ShowcaseMovieCard,
} from "@/data/showcaseMovieCards";
import "./MovieLandingPage.css";

const PAGE_BG = "#f6f7f8";
const BRAND = "#6900AA";
const FORMATS = ["2D", "3D", "4DX", "IMAX 2D"] as const;

type MovieCardData = {
  id: string;
  title: string;
  poster: string;
  certification?: string;
  language?: string;
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

/** Static promo banners when no catalog banners are available yet. */
const FALLBACK_HERO_SLIDES = [
  {
    id: "toxic",
    href: "/movies/toxic-a-fairy-tale-for-grown-ups",
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1600&h=800&fit=crop&q=80",
    poster: "/images/movies/toxic-poster.png",
    eyebrow: "ROCKING STAR YASH",
    title: "TOXIC",
    tagline: "A FAIRY TALE FOR GROWN-UPS",
    promoTitle: "Intensity like never before!",
    promoSub: "Witness it in cinemas.",
    accent: "#9B1C1C",
    panel: "#0A0A0A",
  },
  {
    id: "now-showing",
    href: "#movies-listing",
    image:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600&h=800&fit=crop&q=80",
    poster:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&h=750&fit=crop&q=80",
    eyebrow: "NOW SHOWING",
    title: "ON SCREEN",
    tagline: "Book tickets for the latest movies near you",
    promoTitle: "Your next favourite film awaits",
    promoSub: "Explore showtimes across Ethiopia.",
    accent: BRAND,
    panel: "#1A0A2E",
  },
  {
    id: "weekend",
    href: "#movies-listing",
    image:
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1600&h=800&fit=crop&q=80",
    poster:
      "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500&h=750&fit=crop&q=80",
    eyebrow: "WEEKEND PICKS",
    title: "POPCORN",
    tagline: "Big screens. Bigger moments.",
    promoTitle: "Make it a movie night",
    promoSub: "Grab seats before they sell out.",
    accent: "#1D4ED8",
    panel: "#020617",
  },
] as const;

type HeroSlide = {
  id: string;
  href: string;
  image: string;
  poster?: string;
  eyebrow: string;
  title: string;
  tagline: string;
  promoTitle: string;
  promoSub: string;
  accent: string;
  panel: string;
};

function mapCatalogMovieToCard(movie: Movie): MovieCardData {
  return {
    id: movie.id,
    title: movie.title,
    poster: resolveMediaUrl(movie.poster_url),
    certification: movie.certificate?.trim() || undefined,
    language: (movie.languages || []).join(", ") || undefined,
    genres: movie.genres || [],
    formats: movie.formats || [],
    comingSoon: movie.status === "coming_soon",
    href: `/movies/${movie.slug || movie.id}`,
  };
}

function mapShowcaseMovieToCard(movie: ShowcaseMovieCard): MovieCardData {
  return {
    id: movie.id,
    title: movie.title,
    poster: movie.poster,
    certification: movie.certification,
    language: movie.language,
    genres: [],
    comingSoon: movie.comingSoon,
    href: movie.href,
  };
}

function buildHeroSlides(movies: Movie[]): HeroSlide[] {
  const featured = movies
    .filter((movie) => movie.status === "now_showing" && (movie.banner_url || movie.poster_url))
    .slice(0, 3);
  if (featured.length === 0) return [...FALLBACK_HERO_SLIDES];

  return featured.map((movie) => ({
    id: movie.id,
    href: `/movies/${movie.slug || movie.id}`,
    image: resolveMediaUrl(movie.banner_url) || resolveMediaUrl(movie.poster_url),
    poster: resolveMediaUrl(movie.poster_url) || undefined,
    eyebrow: "NOW SHOWING",
    title: movie.title.toUpperCase(),
    tagline: (movie.genres || []).slice(0, 3).join(" · ") || "Book tickets in cinemas near you",
    promoTitle: movie.director ? `Directed by ${movie.director}` : "Now in cinemas",
    promoSub: movie.duration_minutes ? `${movie.duration_minutes} min` : "Grab your seats today.",
    accent: BRAND,
    panel: "#1A0A2E",
  }));
}

function ratingValue(rating?: string) {
  if (!rating) return 0;
  const n = Number.parseFloat(rating);
  return Number.isFinite(n) ? n : 0;
}

function HeroBannerCard({ slide }: { slide: HeroSlide }) {
  return (
    <Link href={slide.href} className="relative block overflow-hidden min-h-48 sm:min-h-56 lg:min-h-80">
      <img
        src={slide.image}
        alt={slide.title}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </Link>
  );
}

function MovieCard({ movie }: { movie: MovieCardData }) {
  const inner = (
    <>
      <div className="relative rounded-xl overflow-hidden bg-slate-200 transition-transform duration-300 group-hover:-translate-y-1">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl">
          {movie.poster ? (
            <img
              src={movie.poster}
              alt={movie.title}
              className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-slate-200" />
          )}

          {movie.promoted && (
            <span className="absolute top-2 right-2 z-[2] rounded-md bg-white/70 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-red-600">
              PROMOTED
            </span>
          )}
          {movie.comingSoon && !movie.promoted && (
            <span className="absolute top-2 right-2 z-[2] rounded-md bg-white/70 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-green-600">
              Coming Soon
            </span>
          )}

          {(movie.likes || movie.rating) && (
            <div className="absolute inset-x-0 bottom-0 z-[2] flex items-center gap-1.5 bg-black/45 backdrop-blur-[2px] px-2 py-1.5 text-white">
              {movie.likes ? (
                <>
                  <ThumbsUp className="size-3 shrink-0 text-[#22C55E]" fill="currentColor" />
                  <span className="text-xs font-medium truncate">{movie.likes}</span>
                </>
              ) : (
                <>
                  <Star className="size-3 shrink-0 text-[#EF4444]" fill="currentColor" />
                  <span className="text-xs font-semibold shrink-0">{movie.rating}</span>
                  {movie.votes && (
                    <span className="text-xs text-white/90 truncate">{movie.votes}</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <h3 className="mt-2 text-sm sm:text-base font-bold text-[#111111] leading-snug line-clamp-2 group-hover:text-[#6900AA] transition-colors">
        {movie.title}
      </h3>
      {movie.certification && (
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500">{movie.certification}</p>
      )}
      {movie.language && (
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 line-clamp-1">{movie.language}</p>
      )}
    </>
  );

  const href = movie.href || `/movies/${movie.id}`;

  return (
    <Link href={href} className="group block w-full min-w-0">
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
      <div ref={ref} className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-1">
        {children}
      </div>
      {canScroll.left && (
        <button type="button" aria-label="Scroll left" onClick={() => scrollBy(-1)} className={`${btnClass} left-0`}>
          <ChevronLeft className="size-4" />
        </button>
      )}
      {canScroll.right && (
        <button type="button" aria-label="Scroll right" onClick={() => scrollBy(1)} className={`${btnClass} right-0`}>
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
          <div key={movie.id} className="shrink-0 w-1/2 sm:w-1/3 lg:w-1/4">
            <MovieCard movie={movie} />
          </div>
        ))}
      </HScroll>
    </div>
  );
}

function FilterSection({
  title,
  open,
  onToggle,
  onClear,
  children,
  last = false,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={last ? undefined : "border-b border-slate-100"}>
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer text-left"
        >
          <ChevronDown
            className={`size-3.5 shrink-0 transition-transform ${
              open ? "rotate-180 text-[#6900AA]" : "text-slate-400"
            }`}
          />
          <span className={`text-sm font-semibold ${open ? "text-[#6900AA]" : "text-slate-800"}`}>
            {title}
          </span>
        </button>
        <button type="button" onClick={onClear} className="text-xs sm:text-sm text-slate-400 hover:text-slate-600 cursor-pointer">
          Clear
        </button>
      </div>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export default function MovieLandingPage() {
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [city, setCity] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [openFilters, setOpenFilters] = useState({
    languages: true,
    genres: false,
    formats: false,
  });
  const [viewAll, setViewAll] = useState<ViewAllKey>(null);

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
  const catalogMovies = moviesData?.items ?? [];
  const hasCinemasInCity = moviesData?.meta?.has_cinemas_in_city;
  const noCinemasInCity = Boolean(city && hasCinemasInCity === false);

  const heroSlides = useMemo(() => buildHeroSlides(catalogMovies), [catalogMovies]);

  const [heroNav, setHeroNav] = useState({
    prev: false,
    next: heroSlides.length > 1,
  });

  useEffect(() => {
    setHeroNav((prev) => ({
      ...prev,
      next: heroSlides.length > 1,
    }));
  }, [heroSlides.length]);

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
    !noCinemasInCity &&
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
    document.getElementById("movies-listing")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const bindSwiperNav = (swiper: SwiperType) => {
    const nav = swiper.params?.navigation;
    if (!nav || typeof nav === "boolean") return;
    nav.prevEl = prevRef.current;
    nav.nextEl = nextRef.current;
    swiper.navigation?.destroy?.();
    swiper.navigation?.init?.();
    swiper.navigation?.update?.();
  };

  const syncHeroNav = (swiper: SwiperType) => {
    const multi = heroSlides.length > 1;
    setHeroNav({
      prev: multi && !swiper.isBeginning,
      next: multi && !swiper.isEnd,
    });
  };

  const viewAllTitle =
    viewAll === "now-showing"
      ? `Movies In ${headingCity}`
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE_BG }}>
      <section className="pt-4 sm:pt-5">
        <div className="movie-hero-swiper relative">
            <Swiper
              modules={[Autoplay, Navigation, Pagination]}
              className="w-full"
              speed={650}
              slidesPerView={1}
              spaceBetween={0}
              autoplay={
                heroSlides.length > 1
                  ? { delay: 4500, disableOnInteraction: false, pauseOnMouseEnter: true }
                  : false
              }
              pagination={heroSlides.length > 1 ? { clickable: true } : false}
              navigation={{ prevEl: prevRef.current, nextEl: nextRef.current }}
              onBeforeInit={(swiper: SwiperType) => {
                const nav = swiper.params?.navigation;
                if (nav && typeof nav !== "boolean") {
                  nav.prevEl = prevRef.current;
                  nav.nextEl = nextRef.current;
                }
              }}
              onSwiper={(swiper) => {
                syncHeroNav(swiper);
                setTimeout(() => bindSwiperNav(swiper));
              }}
              onSlideChange={syncHeroNav}
            >
              {heroSlides.map((slide) => (
                <SwiperSlide key={slide.id} className="!h-auto">
                  <HeroBannerCard slide={slide} />
                </SwiperSlide>
              ))}
            </Swiper>

            <button
              ref={prevRef}
              type="button"
              aria-label="Previous slide"
              aria-hidden={!heroNav.prev}
              tabIndex={heroNav.prev ? 0 : -1}
              className={`movie-hero-nav movie-hero-nav-prev absolute z-20 hidden sm:flex items-center justify-center cursor-pointer transition-opacity ${
                heroNav.prev ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <ChevronLeft className="size-5" strokeWidth={2.25} />
            </button>
            <button
              ref={nextRef}
              type="button"
              aria-label="Next slide"
              aria-hidden={!heroNav.next}
              tabIndex={heroNav.next ? 0 : -1}
              className={`movie-hero-nav movie-hero-nav-next absolute z-20 hidden sm:flex items-center justify-center cursor-pointer transition-opacity ${
                heroNav.next ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <ChevronRight className="size-5" strokeWidth={2.25} />
            </button>
          </div>
      </section>

      <section id="movies-listing" className="pt-6 sm:pt-8 pb-12 sm:pb-16 scroll-mt-24">
        <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">
          <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900 flex items-center gap-2 min-w-0 mb-4 sm:mb-5">
            <span className="truncate">Movies In {headingCity}</span>
            <FaMapMarkerAlt className="size-4 shrink-0 text-[#6900AA]" aria-hidden />
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 lg:gap-6">
            <aside className="lg:col-span-1 lg:sticky lg:top-24 self-start space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">Filters</h2>
                  <button
                    type="button"
                    onClick={clearAll}
                    disabled={!hasActiveFilters}
                    className={`text-sm font-semibold cursor-pointer ${
                      hasActiveFilters ? "text-[#6900AA]" : "text-[#6900AA]/40 cursor-default"
                    }`}
                  >
                    Clear All
                  </button>
                </div>

                <FilterSection
                  title="Languages"
                  open={openFilters.languages}
                  onToggle={() => setOpenFilters((p) => ({ ...p, languages: !p.languages }))}
                  onClear={() => setSelectedLanguages([])}
                >
                  <div className="flex flex-wrap gap-2">
                    {languageOptions.map((lang) => {
                      const active = selectedLanguages.includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => toggleLanguage(lang)}
                          className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold border cursor-pointer transition-colors ${
                            active
                              ? "bg-[#6900AA] border-[#6900AA] text-white"
                              : "bg-white border-[#D4B3F0] text-[#6900AA] hover:bg-[#F7E9FF]"
                          }`}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                </FilterSection>

                <FilterSection
                  title="Genres"
                  open={openFilters.genres}
                  onToggle={() => setOpenFilters((p) => ({ ...p, genres: !p.genres }))}
                  onClear={() => setSelectedGenres([])}
                >
                  <div className="flex flex-wrap gap-2">
                    {genreOptions.map((genre) => {
                      const active = selectedGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => toggleGenre(genre)}
                          className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold border cursor-pointer transition-colors ${
                            active
                              ? "bg-[#6900AA] border-[#6900AA] text-white"
                              : "bg-white border-[#D4B3F0] text-[#6900AA] hover:bg-[#F7E9FF]"
                          }`}
                        >
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </FilterSection>

                <FilterSection
                  title="Format"
                  open={openFilters.formats}
                  onToggle={() => setOpenFilters((p) => ({ ...p, formats: !p.formats }))}
                  onClear={() => setSelectedFormats([])}
                  last
                >
                  <div className="flex flex-wrap gap-2">
                    {formatOptions.map((format) => {
                      const active = selectedFormats.includes(format);
                      return (
                        <button
                          key={format}
                          type="button"
                          onClick={() => toggleFormat(format)}
                          className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold border cursor-pointer transition-colors ${
                            active
                              ? "border-[#6900AA] bg-[#6900AA] text-white"
                              : "border-[#D4B3F0] bg-white text-[#6900AA] hover:bg-[#F7E9FF]"
                          }`}
                        >
                          {format}
                        </button>
                      );
                    })}
                  </div>
                </FilterSection>
              </div>

              <Link
                href={cinemasHref}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#6900AA] bg-white py-2.5 text-sm sm:text-base font-semibold text-[#6900AA] hover:bg-[#F7E9FF] transition-colors"
              >
                <Ticket className="size-4" />
                Browse by Cinemas
              </Link>
            </aside>

            <div className="lg:col-span-3 min-w-0">
              {viewAll ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setViewAll(null)}
                    className="inline-flex items-center gap-1 mb-4 text-sm sm:text-base font-semibold text-[#6900AA] hover:text-[#57008E] cursor-pointer"
                  >
                    <ChevronLeft className="size-4" />
                    Back
                  </button>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900 mb-4 sm:mb-5 flex items-center gap-2">
                    <span className="truncate">{viewAllTitle}</span>
                    {viewAll === "now-showing" && (
                      <FaMapMarkerAlt className="size-4 shrink-0 text-[#6900AA]" aria-hidden />
                    )}
                  </h2>
                  {viewAllMovies.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                      <p className="text-slate-600 font-medium">No movies match these filters</p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearAll}
                          className="mt-4 text-sm font-semibold text-[#6900AA] cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-6">
                      {viewAllMovies.map((movie) => (
                        <MovieCard key={movie.id} movie={movie} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-8 sm:space-y-10">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                      <Loader2 className="size-8 animate-spin text-[#6900AA]" />
                      <p className="text-sm sm:text-base font-medium">Loading movies...</p>
                    </div>
                  ) : noCinemasInCity ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                      <p className="text-slate-600 font-medium">No cinemas in {headingCity} yet</p>
                      <p className="text-slate-400 text-sm sm:text-base mt-1">
                        Try another city or browse cinemas near you.
                      </p>
                      <Link
                        href={cinemasHref}
                        className="mt-4 inline-flex text-sm font-semibold text-[#6900AA] hover:text-[#57008E]"
                      >
                        Browse by Cinemas
                      </Link>
                    </div>
                  ) : movies.length === 0 && comingSoonMovies.length === 0 ? (
                    <div className={`text-center py-16 bg-white rounded-2xl border border-slate-200 ${isFetching ? "opacity-70" : ""}`}>
                      <p className="text-slate-600 font-medium">
                        {hasActiveFilters ? "No movies match these filters" : "No movies available yet"}
                      </p>
                      <p className="text-slate-400 text-sm sm:text-base mt-1">
                        {hasActiveFilters
                          ? "Try clearing filters or choosing another language."
                          : "Check back soon for the latest titles in cinemas."}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearAll}
                          className="mt-4 text-sm font-semibold text-[#6900AA] cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className={isFetching ? "opacity-70 transition-opacity" : ""}>
                    <MovieRail
                      title="Now Showing"
                      movies={movies}
                      onSeeAll={() => openViewAll("now-showing")}
                    />
                    </div>
                  )}

                  <div id="coming-soon" className={`scroll-mt-28 ${isFetching ? "opacity-70 transition-opacity" : ""}`}>
                    <MovieRail
                      title="Upcoming Movies"
                      movies={comingSoonMovies}
                      onSeeAll={() => openViewAll("coming-soon")}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <OfferShapeCard
                      href="#movies-listing"
                      title="Weekend Movie Marathon"
                      subtitle="Book the latest titles and enjoy the big screen."
                      cta="Grab Offer"
                      tone="peach"
                    />
                    <OfferShapeCard
                      href="/gift-cards"
                      title="Gift the magic of movies"
                      subtitle="Buy gift cards for friends and family."
                      cta="Buy Gift Card"
                      tone="mint"
                    />
                  </div>

                  <MovieRail
                    title="Top Rated Movies"
                    movies={topRatedMovies}
                    onSeeAll={() => openViewAll("top-rated")}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
