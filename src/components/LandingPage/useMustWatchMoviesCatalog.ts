"use client";

import { useEffect, useMemo, useState } from "react";
import { useGetPublicMoviesQuery, type Movie } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { SHOWCASE_MOVIE_CARDS, type ShowcaseMovieCard } from "@/data/showcaseMovieCards";
import {
  formatMovieCardTitle,
  isMoviePromoted,
  parseLanguageList,
} from "@/lib/movieDisplay";
import { hasCityFilter, shouldShowShowcaseCards } from "./homeUtils";

export type MustWatchMovieCard = {
  id: string;
  title: string;
  displayTitle: string;
  poster: string;
  certification?: string;
  languages: string[];
  genres: string[];
  formats: string[];
  durationMinutes?: number | null;
  rating?: number | null;
  releaseDate?: string | null;
  comingSoon?: boolean;
  promoted?: boolean;
  href: string;
  fromPrice?: number | null;
};

function formatDuration(minutes?: number | null): string {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return "";
  const h = Math.floor(m / 60);
  const mins = Math.round(m % 60);
  if (h <= 0) return `${mins}m`;
  if (mins <= 0) return `${h}h`;
  return `${h}h ${String(mins).padStart(2, "0")}m`;
}

function parseRating(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(10, Math.round(n * 10) / 10);
}

function stableHash(value: string): number {
  return value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

export function formatMovieDurationLabel(minutes?: number | null): string {
  return formatDuration(minutes);
}

function mapApiMovie(movie: Movie): MustWatchMovieCard {
  return {
    id: movie.id,
    title: movie.title,
    displayTitle: formatMovieCardTitle(movie.title, movie.release_date),
    poster: resolveMediaUrl(movie.poster_url),
    certification: movie.certificate?.trim() || undefined,
    languages: parseLanguageList(movie.languages),
    genres: (movie.genres || []).map((g) => String(g).trim()).filter(Boolean),
    formats: (movie.formats || []).map((f) => String(f).trim()).filter(Boolean),
    durationMinutes: movie.duration_minutes,
    rating: parseRating(movie.rating),
    releaseDate: movie.release_date || null,
    comingSoon: movie.status === "coming_soon",
    promoted: isMoviePromoted(movie.is_promoted),
    href: `/movies/${movie.slug || movie.id}`,
    fromPrice: null,
  };
}

function mapShowcaseMovie(movie: ShowcaseMovieCard): MustWatchMovieCard {
  const idHash = stableHash(movie.id);
  return {
    id: movie.id,
    title: movie.title,
    displayTitle: formatMovieCardTitle(movie.title, movie.year),
    poster: movie.poster,
    certification: movie.certification,
    languages: parseLanguageList(movie.language),
    genres: [
      ["Action", "Thriller"],
      ["Romance", "Drama"],
      ["Animation", "Adventure"],
      ["Mystery", "Drama"],
    ][idHash % 4],
    formats: [idHash % 3 === 0 ? "3D" : "2D"],
    durationMinutes: [138, 124, 102, 125][idHash % 4],
    rating: [8.6, 7.9, 8.2, 8.1][idHash % 4],
    releaseDate: movie.year ? `${movie.year}-10-24` : "2026-10-24",
    comingSoon: movie.comingSoon,
    promoted: Boolean(movie.promoted),
    href: movie.href,
    fromPrice: [350, 300, 280, 320][idHash % 4],
  };
}

/** Shared Must-Watch Movies catalog (city → global → showcase). */
export function useMustWatchMoviesCatalog() {
  const [city, setCity] = useState("");

  useEffect(() => {
    const applyCity = () => {
      const stored = localStorage.getItem("selected_city") || "";
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

  const moviesQueryArg = useMemo(
    () => ({
      limit: 12,
      ...(city ? { city } : {}),
    }),
    [city]
  );

  const { data: cityData, isLoading: cityLoading } = useGetPublicMoviesQuery(moviesQueryArg);
  const { data: allData, isLoading: allLoading } = useGetPublicMoviesQuery(
    { limit: 12 },
    { skip: !hasCityFilter(city) }
  );

  const hasCity = hasCityFilter(city);
  const cityMovies = (cityData?.items ?? []).map(mapApiMovie);
  const allMovies = (allData?.items ?? []).map(mapApiMovie);
  const apiMovies = !hasCity || cityMovies.length > 0 ? cityMovies : allMovies;
  const isLoading =
    cityLoading || (hasCity && cityMovies.length === 0 && allLoading);
  const isEmpty = !isLoading && apiMovies.length === 0;
  const useStatic = shouldShowShowcaseCards(isEmpty);
  const cityHasNoMovies = hasCity && !isLoading && cityMovies.length === 0;
  const items = useStatic ? SHOWCASE_MOVIE_CARDS.map(mapShowcaseMovie) : apiMovies;

  const seeAllHref =
    city && cityMovies.length > 0
      ? `/movies?city=${encodeURIComponent(city)}`
      : "/movies";

  return {
    city,
    items,
    isLoading,
    isEmpty,
    useStatic,
    cityHasNoMovies,
    seeAllHref,
  };
}

export function movieDetailMeta(movie: MustWatchMovieCard) {
  const rating = movie.rating ?? null;
  const duration = formatDuration(movie.durationMinutes);
  const format = movie.formats[0] || "";
  const genres =
    movie.genres.length > 0
      ? movie.genres.slice(0, 2).join(" · ")
      : "";
  const language = movie.languages[0] || "";
  const certification = movie.certification?.trim() || "";
  const fromPrice =
    typeof movie.fromPrice === "number" && movie.fromPrice > 0
      ? movie.fromPrice
      : null;

  const metaParts = [
    rating != null ? rating.toFixed(1) : "",
    duration,
    format,
  ].filter(Boolean);

  const tagLine = [
    ...movie.genres.slice(0, 2),
    language,
    format,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    rating,
    duration,
    format,
    genres,
    language,
    certification,
    fromPrice,
    metaLine: metaParts.join(" · "),
    tagLine,
  };
}

/** e.g. "24 OCT 2026" */
export function formatMovieReleaseLabel(value?: string | null): string {
  if (!value) return "";
  if (/^\d{4}$/.test(value.trim())) return value.trim();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-GB", { month: "short" }).toUpperCase();
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}
