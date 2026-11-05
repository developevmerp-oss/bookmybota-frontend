"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  Building2,
  Clapperboard,
  Film,
  Heart,
  UtensilsCrossed,
} from "lucide-react";
import {
  useGetCinemaWishlistQuery,
  useGetDiningWishlistQuery,
  useGetMovieWishlistQuery,
  useSyncCinemaWishlistMutation,
  useSyncDiningWishlistMutation,
  useSyncMovieWishlistMutation,
  type Business,
  type Movie,
} from "@/services/api";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { useAppDispatch } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import {
  clearGuestDiningWishlistIds,
  readGuestDiningWishlistIds,
} from "@/lib/diningWishlist";
import {
  clearGuestMovieWishlistIds,
  readGuestMovieWishlistIds,
} from "@/lib/movieWishlist";
import {
  clearGuestCinemaWishlistIds,
  readGuestCinemaWishlistIds,
} from "@/lib/cinemaWishlist";
import { cinemaHref } from "@/lib/businessPublicPath";
import {
  formatMovieCardTitle,
  isMoviePromoted,
  parseLanguageList,
} from "@/lib/movieDisplay";
import { MovieNotifyCard } from "@/components/LandingPage/MovieNotifyCard";
import type { MustWatchMovieCard } from "@/components/LandingPage/useMustWatchMoviesCatalog";
import AdaptiveCardRow from "@/components/LandingPage/AdaptiveCardRow";
import { RailPagerNav } from "@/components/LandingPage/RailChrome";
import { scrollRailBy, useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import CinemaWishlistButton from "@/components/MovieLandingPage/CinemaWishlistButton";
import DiningRestaurantCardOption2 from "@/components/DinningLandingPage/DiningRestaurantCardOption2";
import { CustomerPageShimmer } from "@/components/Shared/Shimmer";

/** Desktop favourite rail: 3 cards in view, extra cards scroll horizontally. */
const MOVIE_RAIL_VISIBLE = 3;
const DINING_RAIL_VISIBLE = 3;

function parseRating(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(10, Math.round(n * 10) / 10);
}

function toMustWatchCard(movie: Movie): MustWatchMovieCard {
  const displayTitle = formatMovieCardTitle(movie.title, movie.release_date);
  return {
    id: movie.id,
    title: displayTitle,
    displayTitle,
    poster: resolveMediaUrl(movie.poster_url),
    certification: movie.certificate?.trim() || undefined,
    languages: parseLanguageList(movie.languages),
    genres: (movie.genres || []).map((g) => String(g).trim()).filter(Boolean),
    formats: (movie.formats || []).map((f) => String(f).trim()).filter(Boolean),
    durationMinutes: movie.duration_minutes,
    rating: parseRating(movie.rating),
    reviewsCount: Math.max(0, Number(movie.reviews_count) || 0),
    releaseDate: movie.release_date || null,
    comingSoon: movie.status === "coming_soon",
    promoted: isMoviePromoted(movie.is_promoted),
    href: `/movies/${movie.slug || movie.id}`,
    fromPrice: null,
  };
}

function cinemaAddressLine(cinema: Business): string {
  const locality = (cinema.address || "").split(",")[0]?.trim();
  return (
    [locality, cinema.city_name].filter(Boolean).join(", ") ||
    cinema.address ||
    cinema.city_name ||
    ""
  );
}

/** Same card UI as CinemaListingPage. */
function WishlistCinemaCard({ cinema }: { cinema: Business }) {
  const href = cinemaHref(cinema);
  const address = cinemaAddressLine(cinema);

  return (
    <article className="h-full rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3">
      <CinemaWishlistButton cinemaId={String(cinema.id)} />
      <Link href={href} className="min-w-0 flex-1 group block">
        <h3 className="text-sm sm:text-base font-bold text-[#111111] leading-snug group-hover:text-[#6900AA] transition-colors">
          {cinema.name}
        </h3>
        {address ? (
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
            {address}
          </p>
        ) : null}
      </Link>
    </article>
  );
}

let guestWishlistSyncOnPage = false;

function WishlistSection({
  title,
  count,
  browseHref,
  browseLabel,
  browseIcon: BrowseIcon,
  isLoading,
  isError,
  onRetry,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  children,
}: {
  title: string;
  count: number;
  browseHref: string;
  browseLabel: string;
  browseIcon: typeof Film;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyIcon: typeof Film;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-lg font-bold text-[#111111]">
          {title}
          {count > 0 ? (
            <span className="ml-2 text-sm font-semibold text-slate-400">({count})</span>
          ) : null}
        </h3>
        <Link
          href={browseHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#6900AA] hover:underline"
        >
          <BrowseIcon size={16} />
          {browseLabel}
        </Link>
      </div>

      {isLoading ? (
        <CustomerPageShimmer rows={4} />
      ) : isError ? (
        <div className="text-center py-10 rounded-xl border border-slate-200 bg-slate-50">
          <p className="text-slate-600 font-medium">Could not load this section.</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 text-sm font-semibold text-[#6900AA] hover:underline cursor-pointer"
          >
            Try again
          </button>
        </div>
      ) : count === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#F7E9FF] flex items-center justify-center text-[#6900AA] mb-3">
            <EmptyIcon size={22} />
          </div>
          <p className="font-semibold text-[#111111]">{emptyTitle}</p>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{emptyDescription}</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

export default function CustomerWishlistPage() {
  const dispatch = useAppDispatch();
  const movieScrollerRef = useRef<HTMLDivElement>(null);
  const diningScrollerRef = useRef<HTMLDivElement>(null);
  const [syncMovieWishlist] = useSyncMovieWishlistMutation();
  const [syncDiningWishlist] = useSyncDiningWishlistMutation();
  const [syncCinemaWishlist] = useSyncCinemaWishlistMutation();

  const {
    data: movies = [],
    isLoading: moviesLoading,
    isError: moviesError,
    refetch: refetchMovies,
  } = useGetMovieWishlistQuery(undefined, { refetchOnMountOrArgChange: true });
  const {
    data: restaurants = [],
    isLoading: diningLoading,
    isError: diningError,
    refetch: refetchDining,
  } = useGetDiningWishlistQuery(undefined, { refetchOnMountOrArgChange: true });
  const {
    data: cinemas = [],
    isLoading: cinemasLoading,
    isError: cinemasError,
    refetch: refetchCinemas,
  } = useGetCinemaWishlistQuery(undefined, { refetchOnMountOrArgChange: true });

  const movieScrollEdges = useHorizontalScrollEdges(movieScrollerRef, [
    movies.length,
    moviesLoading,
  ]);
  const diningScrollEdges = useHorizontalScrollEdges(diningScrollerRef, [
    restaurants.length,
    diningLoading,
  ]);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    void refetchMovies();
    void refetchDining();
    void refetchCinemas();
  }, [refetchMovies, refetchDining, refetchCinemas]);

  useEffect(() => {
    if (guestWishlistSyncOnPage) return;
    const guestMovieIds = readGuestMovieWishlistIds();
    const guestDiningIds = readGuestDiningWishlistIds();
    const guestCinemaIds = readGuestCinemaWishlistIds();
    if (
      guestMovieIds.length === 0 &&
      guestDiningIds.length === 0 &&
      guestCinemaIds.length === 0
    ) {
      return;
    }

    guestWishlistSyncOnPage = true;
    void (async () => {
      try {
        if (guestMovieIds.length > 0) {
          await syncMovieWishlist({ movie_ids: guestMovieIds }).unwrap();
          clearGuestMovieWishlistIds();
          void refetchMovies();
        }
        if (guestDiningIds.length > 0) {
          await syncDiningWishlist({ business_ids: guestDiningIds }).unwrap();
          clearGuestDiningWishlistIds();
          void refetchDining();
        }
        if (guestCinemaIds.length > 0) {
          await syncCinemaWishlist({ business_ids: guestCinemaIds }).unwrap();
          clearGuestCinemaWishlistIds();
          void refetchCinemas();
        }
      } catch {
        guestWishlistSyncOnPage = false;
      }
    })();
  }, [
    syncMovieWishlist,
    syncDiningWishlist,
    syncCinemaWishlist,
    refetchMovies,
    refetchDining,
    refetchCinemas,
  ]);

  const isLoading = moviesLoading || diningLoading || cinemasLoading;

  return (
    <CustomerAccountLayout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="mb-4 lg:mb-8">
          <h2 className="hidden lg:block text-2xl font-extrabold text-[#111111]">My Favourite</h2>
          <p className="text-sm text-slate-500 mt-1">
            Movies, cinemas, and restaurants you saved for later
          </p>
        </div>

        {isLoading && movies.length === 0 && restaurants.length === 0 && cinemas.length === 0 ? (
          <CustomerPageShimmer rows={6} />
        ) : (
          <div className="space-y-10">
            <WishlistSection
              title="Saved Movies"
              count={movies.length}
              browseHref="/movies"
              browseLabel="Browse movies"
              browseIcon={Clapperboard}
              isLoading={moviesLoading}
              isError={moviesError}
              onRetry={() => void refetchMovies()}
              emptyIcon={Film}
              emptyTitle="No movies saved yet"
              emptyDescription="Tap the heart icon on any movie detail page to add it here."
            >
              <div>
                <AdaptiveCardRow
                  minVisible={MOVIE_RAIL_VISIBLE}
                  scrollerRef={movieScrollerRef}
                  className="adaptive-card-row--four"
                >
                  {movies.map((movie) => (
                    <MovieNotifyCard key={movie.id} movie={toMustWatchCard(movie)} />
                  ))}
                </AdaptiveCardRow>
                <RailPagerNav
                  canPrev={movieScrollEdges.left}
                  canNext={movieScrollEdges.right}
                  pageCount={movieScrollEdges.pageCount}
                  activePage={movieScrollEdges.activePage}
                  onPrev={() => {
                    const el = movieScrollerRef.current;
                    if (el) scrollRailBy(el, -1);
                  }}
                  onNext={() => {
                    const el = movieScrollerRef.current;
                    if (el) scrollRailBy(el, 1);
                  }}
                  label="saved movies"
                />
              </div>
            </WishlistSection>

            <WishlistSection
              title="Saved Cinemas"
              count={cinemas.length}
              browseHref="/movies/cinemas"
              browseLabel="Browse cinemas"
              browseIcon={Building2}
              isLoading={cinemasLoading}
              isError={cinemasError}
              onRetry={() => void refetchCinemas()}
              emptyIcon={Building2}
              emptyTitle="No cinemas saved yet"
              emptyDescription="Tap the heart icon on any cinema page to add it here."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {cinemas.map((cinema) => (
                  <WishlistCinemaCard key={cinema.id} cinema={cinema} />
                ))}
              </div>
            </WishlistSection>

            <WishlistSection
              title="Saved Restaurants"
              count={restaurants.length}
              browseHref="/dining"
              browseLabel="Browse dining"
              browseIcon={UtensilsCrossed}
              isLoading={diningLoading}
              isError={diningError}
              onRetry={() => void refetchDining()}
              emptyIcon={Heart}
              emptyTitle="No restaurants saved yet"
              emptyDescription="Tap the heart icon on any dining listing card to add it here."
            >
              <div>
                <AdaptiveCardRow
                  minVisible={DINING_RAIL_VISIBLE}
                  scrollerRef={diningScrollerRef}
                  className="adaptive-card-row--dining"
                >
                  {restaurants.map((r) => (
                    <DiningRestaurantCardOption2 key={r.id} place={r} />
                  ))}
                </AdaptiveCardRow>
                <RailPagerNav
                  canPrev={diningScrollEdges.left}
                  canNext={diningScrollEdges.right}
                  pageCount={diningScrollEdges.pageCount}
                  activePage={diningScrollEdges.activePage}
                  onPrev={() => {
                    const el = diningScrollerRef.current;
                    if (el) scrollRailBy(el, -1);
                  }}
                  onNext={() => {
                    const el = diningScrollerRef.current;
                    if (el) scrollRailBy(el, 1);
                  }}
                  label="saved restaurants"
                />
              </div>
            </WishlistSection>
          </div>
        )}
      </div>
    </CustomerAccountLayout>
  );
}
