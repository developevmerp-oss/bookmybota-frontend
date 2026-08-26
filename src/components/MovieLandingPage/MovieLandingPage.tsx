"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  href?: string;
};

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
  href: `/movies/${m.id}`,
}));

/** Static promo banners — layout matches BMS-style movie hero (peek + pills). */
const HERO_SLIDES = [
  {
    id: "toxic",
    href: "/movies/s1",
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1400&h=700&fit=crop&q=80",
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
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1400&h=700&fit=crop&q=80",
    poster:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&h=750&fit=crop&q=80",
    eyebrow: "NOW SHOWING",
    title: "ON SCREEN",
    tagline: "Book tickets for the latest movies near you",
    promoTitle: "Your next favourite film awaits",
    promoSub: "Explore showtimes across Ethiopia.",
    accent: "#6900AA",
    panel: "#1A0A2E",
  },
  {
    id: "weekend",
    href: "#movies-listing",
    image:
      "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1400&h=700&fit=crop&q=80",
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

function HeroBannerCard({
  slide,
}: {
  slide: (typeof HERO_SLIDES)[number];
}) {
  return (
    <Link
      href={slide.href}
      className="movie-hero-card relative block h-full w-full overflow-hidden rounded-xl sm:rounded-2xl"
    >
      <img
        src={slide.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(105deg, ${slide.accent}ee 0%, ${slide.accent}99 42%, rgba(0,0,0,0.55) 68%, ${slide.panel} 100%)`,
        }}
      />
      <div className="relative z-[1] flex h-full">
        <div className="flex min-w-0 flex-1 items-end sm:items-center px-4 sm:px-7 lg:px-10 pb-8 sm:pb-0">
          <div className="flex items-end sm:items-center gap-3 sm:gap-5 max-w-xl">
            <div className="hidden sm:block shrink-0 w-[4.5rem] sm:w-[5.5rem] lg:w-[6.5rem] aspect-[2/3] rounded-md overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-1 ring-white/20">
              <img
                src={slide.poster}
                alt={slide.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 text-white">
              <p className="text-[10px] sm:text-xs font-semibold tracking-[0.18em] uppercase text-white/85">
                {slide.eyebrow}
              </p>
              <h2
                className="mt-1 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-none"
                style={{ textShadow: "0 2px 18px rgba(0,0,0,0.35)" }}
              >
                {slide.title}
              </h2>
              <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-sm text-white/80 font-medium tracking-wide uppercase">
                {slide.tagline}
              </p>
            </div>
          </div>
        </div>
        <div
          className="hidden md:flex w-[34%] lg:w-[32%] shrink-0 flex-col justify-center px-5 lg:px-8"
          style={{ backgroundColor: slide.panel }}
        >
          <p className="text-white text-xl lg:text-2xl xl:text-[1.65rem] font-bold leading-snug">
            {slide.promoTitle}
          </p>
          <p className="mt-2 text-white/70 text-sm lg:text-base">{slide.promoSub}</p>
          <span
            className="mt-5 inline-flex w-fit items-center rounded-full px-3.5 py-1.5 text-xs font-bold text-white"
            style={{ backgroundColor: slide.accent }}
          >
            Book tickets
          </span>
        </div>
      </div>
    </Link>
  );
}

function MovieCard({ movie }: { movie: MovieCardData }) {
  const inner = (
    <>
      <div className="movie-card-poster relative rounded-lg overflow-hidden bg-slate-200  transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 ">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg">
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
            <span className="absolute top-1.5 right-1.5 z-[2] rounded-md bg-[#E11D48] backdrop-blur-[2px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              PROMOTED
            </span>
          )}

          {(movie.likes || movie.rating) && (
            <div className="absolute inset-x-0 bottom-0 z-[2] flex items-center gap-1.5 bg-black/45 backdrop-blur-[2px] px-2 py-1.5 text-white">
              {movie.likes ? (
                <>
                  <ThumbsUp size={12} className="shrink-0 text-[#22C55E]" fill="currentColor" />
                  <span className="text-[10px] sm:text-[11px] font-medium truncate">{movie.likes}</span>
                </>
              ) : (
                <>
                  <Star size={12} className="shrink-0 text-[#EF4444]" fill="currentColor" />
                  <span className="text-[10px] sm:text-[11px] font-semibold shrink-0">{movie.rating}</span>
                  {movie.votes && (
                    <span className="text-[10px] sm:text-[11px] text-white/90 truncate">{movie.votes}</span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <h3 className="mt-2 text-[13px] sm:text-sm font-bold text-[#111111] leading-snug line-clamp-2 group-hover:text-[#6900AA] transition-colors">
        {movie.title}
      </h3>
      {movie.certification && (
        <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500">{movie.certification}</p>
      )}
      {movie.language && (
        <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 line-clamp-1">{movie.language}</p>
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

function ComingSoonBanner() {
  return (
    <Link
      href="#coming-soon"
      className="movie-coming-soon-banner flex items-center justify-between gap-3 rounded-lg bg-white px-4 sm:px-5 py-3.5 sm:py-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
    >
      <span className="text-base sm:text-lg font-bold text-[#111111]">Coming Soon</span>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-[#6900AA] shrink-0">
        Explore Upcoming Movies
        <ChevronRight size={16} />
      </span>
    </Link>
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
            size={14}
            className={`shrink-0 transition-transform ${
              open ? "rotate-180 text-[#6900AA]" : "text-slate-400"
            }`}
          />
          <span className={`text-sm font-semibold ${open ? "text-[#6900AA]" : "text-slate-800"}`}>
            {title}
          </span>
        </button>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
        >
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
  const [showAll, setShowAll] = useState(false);

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
          ? selectedLanguages.some((l) =>
              movie.language!.toLowerCase().includes(l.toLowerCase())
            )
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

  const visibleMovies = showAll ? movies : movies.slice(0, 6);
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
    setShowAll(false);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
    setShowAll(false);
  };

  const toggleFormat = (format: string) => {
    setSelectedFormats((prev) =>
      prev.includes(format) ? prev.filter((f) => f !== format) : [...prev, format]
    );
    setShowAll(false);
  };

  const clearAll = () => {
    setSelectedLanguages([]);
    setSelectedGenres([]);
    setSelectedFormats([]);
    setShowAll(false);
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE_BG }}>
      {/* Hero banner — BMS-style centered peek carousel */}
      <section className="pt-4 sm:pt-5 lg:pt-6 overflow-x-hidden">
        <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">
          <div className="movie-hero-swiper relative">
            <Swiper
              modules={[Autoplay, Navigation, Pagination]}
              className="movie-hero-swiper-el w-full"
              speed={650}
              centeredSlides
              slidesPerView={1.08}
              spaceBetween={12}
              breakpoints={{
                480: { slidesPerView: 1.1, spaceBetween: 14 },
                640: { slidesPerView: 1.12, spaceBetween: 16 },
                1024: { slidesPerView: 1.16, spaceBetween: 18 },
                1280: { slidesPerView: 1.2, spaceBetween: 20 },
              }}
              autoplay={
                HERO_SLIDES.length > 1
                  ? {
                      delay: 4500,
                      disableOnInteraction: false,
                      pauseOnMouseEnter: true,
                    }
                  : false
              }
              pagination={HERO_SLIDES.length > 1 ? { clickable: true } : false}
              navigation={{
                prevEl: prevRef.current,
                nextEl: nextRef.current,
              }}
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
                  <div className="h-[168px] sm:h-[240px] md:h-[280px] lg:h-[320px] xl:h-[340px]">
                    <HeroBannerCard slide={slide} />
                  </div>
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
              <ChevronLeft size={22} strokeWidth={2.25} />
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
              <ChevronRight size={22} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </section>

      {/* Filters + movies */}
      <section id="movies-listing" className="pt-6 sm:pt-8 pb-12 sm:pb-16">
        <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 lg:gap-6">
            <aside className="lg:col-span-1 lg:sticky lg:top-24 self-start space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h2 className="text-base font-bold text-slate-900">Filters</h2>
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
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
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
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {GENRES.map((genre) => {
                      const active = selectedGenres.includes(genre);
                      return (
                        <label
                          key={genre}
                          className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleGenre(genre)}
                            className="accent-[#6900AA] h-3.5 w-3.5"
                          />
                          {genre}
                        </label>
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
                          className={`px-2.5 py-1.5 text-[11px] rounded-md border cursor-pointer transition-colors ${
                            active
                              ? "border-[#6900AA] bg-[#6900AA] text-white"
                              : "border-slate-200 bg-white text-[#6900AA]"
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
                className="flex w-full items-center justify-center rounded-lg border border-[#6900AA] bg-white py-2.5 text-sm font-semibold text-[#6900AA] hover:bg-[#F7E9FF] transition-colors"
              >
                Browse by Cinemas
              </Link>
            </aside>

            <div className="lg:col-span-3 min-w-0">
              <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2 min-w-0">
                  <span className="truncate">Movies In {headingCity}</span>
                  <FaMapMarkerAlt size={16} className="shrink-0 text-[#6900AA]" aria-hidden />
                </h2>
                {movies.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="shrink-0 text-sm font-semibold text-[#6900AA] hover:text-[#57008E] cursor-pointer"
                  >
                    {showAll ? "Show less" : "View All"}
                  </button>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 mb-3">
                {languageOptions.map((lang) => {
                  const active = selectedLanguages.includes(lang);
                  return (
                    <button
                      key={`pill-${lang}`}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold border cursor-pointer transition-colors ${
                        active
                          ? "bg-[#6900AA] border-[#6900AA] text-white"
                          : "bg-white border-slate-200 text-slate-600 hover:border-[#D4B3F0] hover:text-[#6900AA]"
                      }`}
                    >
                      {lang}
                    </button>
                  );
                })}
              </div>

              <div className="mb-5 sm:mb-6">
                <ComingSoonBanner />
              </div>

              {isLoading && apiMovies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <Loader2 size={32} className="animate-spin text-[#6900AA]" />
                  <p className="text-sm font-medium">Loading movies...</p>
                </div>
              ) : movies.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                  <p className="text-slate-600 font-medium">No movies match these filters</p>
                  <p className="text-slate-400 text-sm mt-1">
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2.5 gap-y-5 sm:gap-x-3.5 sm:gap-y-6 pr-2 pb-2">
                  {visibleMovies.map((movie) => (
                    <MovieCard key={movie.id} movie={movie} />
                  ))}
                </div>
              )}

              <div id="coming-soon" className="mt-8 sm:mt-10 scroll-mt-28">
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 mb-4">
                  Upcoming Movies
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-2.5 gap-y-5 sm:gap-x-3.5 sm:gap-y-6 pr-2 pb-2">
                  {COMING_SOON_MOVIES.map((movie) => (
                    <MovieCard key={movie.id} movie={movie} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
