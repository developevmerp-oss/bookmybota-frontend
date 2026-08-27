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
  useGetPublicEventFiltersQuery,
  useGetPublicEventsQuery,
  type PublicEvent,
} from "@/services/api";
import { eventPortrait } from "@/components/LandingPage/homeUtils";
import { MOVIE_CATALOG } from "@/components/MovieLandingPage/movieCatalog";
import "./MovieLandingPage.css";

const PAGE_BG = "#f6f7f8";
const BRAND = "#6900AA";
const MOVIE_KEYWORDS = ["movie", "movies", "film", "cinema"];
const DEFAULT_LANGUAGES = ["Amharic", "English", "Oromiffa", "Tigrigna", "Somali"];
const FORMATS = ["2D", "3D", "4DX", "IMAX 2D"] as const;
const GENRES = [
  "Action",
  "Comedy",
  "Drama",
  "Horror",
  "Thriller",
  "Romance",
  "Animation",
  "Adventure",
  "Crime",
  "Sci-Fi",
];

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

const SHOWCASE_MOVIES: MovieCardData[] = MOVIE_CATALOG.filter((m) => !m.comingSoon).map((m) => ({
  id: m.id,
  title: m.title,
  poster: m.poster,
  certification: m.certification,
  language: m.languages.join(", "),
  genres: m.genres,
  formats: m.formats,
  rating: m.rating,
  votes: m.votes,
  likes: m.likes,
  promoted: m.id === "s1",
  href: `/movies/${m.id}`,
}));

const COMING_SOON_MOVIES: MovieCardData[] = MOVIE_CATALOG.filter((m) => m.comingSoon).map((m) => ({
  id: m.id,
  title: m.title,
  poster: m.poster,
  certification: m.certification,
  language: m.languages.join(", "),
  genres: m.genres,
  formats: m.formats,
  rating: m.rating,
  votes: m.votes,
  likes: m.likes,
  comingSoon: true,
  href: `/movies/${m.id}`,
}));

/** Static promo banners — same slide content, new layout. */
const HERO_SLIDES = [
  {
    id: "toxic",
    href: "/movies/s1",
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

function formatCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K+`;
  return `${n}+`;
}

function ratingValue(rating?: string) {
  if (!rating) return 0;
  const n = Number.parseFloat(rating);
  return Number.isFinite(n) ? n : 0;
}

function mapEventToMovie(event: PublicEvent): MovieCardData {
  const ratingNum = Number(event.rating);
  const votesNum = Number(event.reviews_count);
  const hasRating = Number.isFinite(ratingNum) && ratingNum > 0;
  const hasVotes = Number.isFinite(votesNum) && votesNum > 0;
  const genre = event.category_name?.trim();
  return {
    id: event.id,
    title: event.name,
    poster: eventPortrait(event),
    certification: event.age_group?.trim() || undefined,
    language: event.language?.trim() || undefined,
    genres: genre && !MOVIE_KEYWORDS.some((k) => genre.toLowerCase().includes(k)) ? [genre] : [],
    formats: ["2D"],
    rating: hasRating ? `${ratingNum.toFixed(1)}/10` : undefined,
    votes: hasRating && hasVotes ? `${formatCount(votesNum)} Votes` : undefined,
    likes: !hasRating && hasVotes ? `${formatCount(votesNum)} Likes` : undefined,
    href: `/movies/${event.id}`,
  };
}

function HeroBannerCard({ slide }: { slide: (typeof HERO_SLIDES)[number] }) {
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
  const [heroNav, setHeroNav] = useState({
    prev: false,
    next: HERO_SLIDES.length > 1,
  });
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

  const { data: filterOptions } = useGetPublicEventFiltersQuery();

  const movieCategory = useMemo(() => {
    return filterOptions?.categories?.find((c) => {
      const slug = (c.slug || "").toLowerCase();
      const name = (c.name || "").toLowerCase();
      return MOVIE_KEYWORDS.some((k) => slug.includes(k) || name.includes(k));
    });
  }, [filterOptions]);

  const queryArg = useMemo(
    () => ({
      ...(city ? { city } : {}),
      ...(movieCategory?.slug ? { category: movieCategory.slug } : {}),
      ...(selectedLanguages.length ? { language: selectedLanguages.join(",") } : {}),
    }),
    [city, movieCategory, selectedLanguages]
  );

  const { data: eventsData, isLoading } = useGetPublicEventsQuery(queryArg);

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

  const languageOptions = useMemo(() => {
    const fromApi = filterOptions?.languages || [];
    const merged = [...DEFAULT_LANGUAGES];
    fromApi.forEach((lang) => {
      if (!merged.some((l) => l.toLowerCase() === lang.toLowerCase())) merged.push(lang);
    });
    return merged;
  }, [filterOptions]);

  const apiMovies = useMemo(() => {
    const list = eventsData ?? [];
    const filtered = movieCategory?.slug
      ? list
      : list.filter((e) => {
          const slug = (e.category_slug || "").toLowerCase();
          const name = (e.category_name || "").toLowerCase();
          return MOVIE_KEYWORDS.some((k) => slug.includes(k) || name.includes(k));
        });
    return filtered.map(mapEventToMovie);
  }, [eventsData, movieCategory]);

  const sourceMovies = apiMovies.length > 0 ? apiMovies : SHOWCASE_MOVIES;

  const movies = useMemo(() => {
    return sourceMovies.filter((movie) => {
      const langOk =
        selectedLanguages.length === 0 ||
        (movie.language
          ? selectedLanguages.some((l) => movie.language!.toLowerCase().includes(l.toLowerCase()))
          : true);
      const genreOk =
        selectedGenres.length === 0 ||
        movie.genres.length === 0 ||
        movie.genres.some((g) => selectedGenres.some((s) => s.toLowerCase() === g.toLowerCase()));
      const formatOk =
        selectedFormats.length === 0 ||
        !movie.formats?.length ||
        movie.formats.some((f) => selectedFormats.includes(f));
      return langOk && genreOk && formatOk;
    });
  }, [sourceMovies, selectedLanguages, selectedGenres, selectedFormats]);

  const topRatedMovies = useMemo(() => {
    return [...movies]
      .filter((m) => ratingValue(m.rating) > 0)
      .sort((a, b) => ratingValue(b.rating) - ratingValue(a.rating));
  }, [movies]);

  const hasActiveFilters =
    selectedLanguages.length > 0 || selectedGenres.length > 0 || selectedFormats.length > 0;
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
    const multi = HERO_SLIDES.length > 1;
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
        ? COMING_SOON_MOVIES
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
                HERO_SLIDES.length > 1
                  ? { delay: 4500, disableOnInteraction: false, pauseOnMouseEnter: true }
                  : false
              }
              pagination={HERO_SLIDES.length > 1 ? { clickable: true } : false}
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
              {HERO_SLIDES.map((slide) => (
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
                    {GENRES.map((genre) => {
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
                    {FORMATS.map((format) => {
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
                  {isLoading && apiMovies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                      <Loader2 className="size-8 animate-spin text-[#6900AA]" />
                      <p className="text-sm sm:text-base font-medium">Loading movies...</p>
                    </div>
                  ) : movies.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                      <p className="text-slate-600 font-medium">No movies match these filters</p>
                      <p className="text-slate-400 text-sm sm:text-base mt-1">
                        Try clearing filters or choosing another language.
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
                    <MovieRail
                      title="Now Showing"
                      movies={movies}
                      onSeeAll={() => openViewAll("now-showing")}
                    />
                  )}

                  <div id="coming-soon" className="scroll-mt-28">
                    <MovieRail
                      title="Upcoming Movies"
                      movies={COMING_SOON_MOVIES}
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
