"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  Bookmark,
  Clapperboard,
  Film,
  Heart,
  Loader2,
  MapPin,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetDiningWishlistQuery,
  useGetMovieWishlistQuery,
  useSyncDiningWishlistMutation,
  useSyncMovieWishlistMutation,
  useToggleDiningWishlistMutation,
  useToggleMovieWishlistMutation,
  type Business,
  type Movie,
} from "@/services/api";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";
import { formatMoney } from "@/lib/currencyFormat";
import { listingOfferLabel } from "@/lib/diningOffers";
import { extractApiError } from "@/lib/apiErrors";
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
import { movieDetailPath } from "@/components/MovieLandingPage/movieCatalog";

function WishlistRestaurantCard({
  restaurant,
  onRemoved,
}: {
  restaurant: Business & { wishlisted_at?: string };
  onRemoved?: () => void;
}) {
  const [toggleWishlist, { isLoading }] = useToggleDiningWishlistMutation();
  const imageSrc =
    resolveMediaUrl(restaurant.cover_image_url) ||
    "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
  const rating = Number(restaurant.rating || 0).toFixed(1);
  const offerLabel = listingOfferLabel(restaurant.dining_offers);
  const locality = (() => {
    const addr = restaurant.address || "";
    const parts = addr.split(",");
    if (parts.length >= 2) return `${parts[0].trim()}, ${parts[1].trim()}`;
    return addr || restaurant.city_name || "";
  })();

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const result = await toggleWishlist({ business_id: String(restaurant.id) }).unwrap();
      toast.success(result.message || "Removed from wishlist");
      onRemoved?.();
    } catch (err) {
      toast.error(extractApiError(err, "Could not remove from wishlist"));
    }
  };

  return (
    <div className="group flex h-full flex-col bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="relative h-44 shrink-0 bg-slate-100">
        <Link href={`/restaurant/${restaurant.id}`} className="absolute inset-0 block">
          <img
            src={imageSrc}
            alt={restaurant.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
            }}
          />
        </Link>
        <button
          type="button"
          onClick={(e) => void handleRemove(e)}
          disabled={isLoading}
          aria-label="Remove from wishlist"
          className="absolute top-3 right-3 z-[2] w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-70"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-[#6900AA]" />
          ) : (
            <Bookmark size={18} className="fill-[#6900AA] text-[#6900AA]" strokeWidth={2.25} />
          )}
        </button>
        {offerLabel && (
          <span className="absolute bottom-3 left-3 z-[1] max-w-[calc(100%-1.5rem)] truncate rounded-full bg-rose-50 text-rose-700 text-xs font-bold px-3 py-1 shadow-sm">
            {offerLabel}
          </span>
        )}
      </div>

      <Link href={`/restaurant/${restaurant.id}`} className="flex flex-col flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-[#111111] text-base leading-snug line-clamp-2 group-hover:text-[#6900AA] transition-colors">
            {restaurant.name}
          </h3>
          {Number(restaurant.rating) > 0 && (
            <span className="shrink-0 inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-1.5 py-0.5 rounded-md">
              ★ {rating}
            </span>
          )}
        </div>
        {(restaurant.cuisine || restaurant.type_name) && (
          <p className="text-sm text-slate-500 mt-1 line-clamp-1">
            {restaurant.cuisine || restaurant.type_name}
          </p>
        )}
        {locality && (
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1 min-w-0">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{locality}</span>
          </p>
        )}
        {restaurant.average_cost != null && Number(restaurant.average_cost) > 0 && (
          <p className="text-xs font-semibold text-slate-600 mt-2">
            {formatMoney(restaurant.average_cost, { compact: true })} for two
          </p>
        )}
      </Link>
    </div>
  );
}

function WishlistMovieCard({ movie }: { movie: Movie & { wishlisted_at?: string } }) {
  const [toggleWishlist, { isLoading }] = useToggleMovieWishlistMutation();
  const poster = resolveMediaUrl(movie.poster_url);
  const genres = (movie.genres || []).slice(0, 2).join(", ");
  const languages = (movie.languages || []).slice(0, 2).join(", ");

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const result = await toggleWishlist({ movie_id: String(movie.id) }).unwrap();
      toast.success(result.message || "Removed from favorites");
    } catch (err) {
      toast.error(extractApiError(err, "Could not remove from favorites"));
    }
  };

  return (
    <div className="group flex h-full flex-col bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="relative aspect-[2/3] shrink-0 bg-slate-100">
        <Link href={movieDetailPath({ id: movie.id, slug: movie.slug })} className="absolute inset-0 block">
          {poster ? (
            <img src={poster} alt={movie.title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-slate-200" />
          )}
        </Link>
        <button
          type="button"
          onClick={(e) => void handleRemove(e)}
          disabled={isLoading}
          aria-label="Remove from favorites"
          className="absolute top-3 right-3 z-[2] w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-70"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-[#6900AA]" />
          ) : (
            <Heart size={18} className="fill-[#F84464] text-[#F84464]" strokeWidth={2} />
          )}
        </button>
        {movie.status === "coming_soon" && (
          <span className="absolute bottom-3 left-3 z-[1] rounded-full bg-violet-600 text-white text-xs font-bold px-3 py-1 shadow-sm">
            Coming Soon
          </span>
        )}
      </div>

      <Link
        href={movieDetailPath({ id: movie.id, slug: movie.slug })}
        className="flex flex-col flex-1 p-4 min-w-0"
      >
        <h3 className="font-bold text-[#111111] text-base leading-snug line-clamp-2 group-hover:text-[#6900AA] transition-colors">
          {movie.title}
        </h3>
        {genres && <p className="text-sm text-slate-500 mt-1 line-clamp-1">{genres}</p>}
        {languages && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{languages}</p>}
        {movie.certificate && (
          <p className="text-xs font-semibold text-slate-500 mt-2">{movie.certificate}</p>
        )}
      </Link>
    </div>
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
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 className="animate-spin" size={20} />
          Loading…
        </div>
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
  const [syncMovieWishlist] = useSyncMovieWishlistMutation();
  const [syncDiningWishlist] = useSyncDiningWishlistMutation();

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

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    void refetchMovies();
    void refetchDining();
  }, [refetchMovies, refetchDining]);

  useEffect(() => {
    if (guestWishlistSyncOnPage) return;
    const guestMovieIds = readGuestMovieWishlistIds();
    const guestDiningIds = readGuestDiningWishlistIds();
    if (guestMovieIds.length === 0 && guestDiningIds.length === 0) return;

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
      } catch {
        guestWishlistSyncOnPage = false;
      }
    })();
  }, [syncMovieWishlist, syncDiningWishlist, refetchMovies, refetchDining]);

  const isLoading = moviesLoading || diningLoading;

  return (
    <CustomerAccountLayout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="mb-8">
          <h2 className="text-2xl font-extrabold text-[#111111]">My Wishlist</h2>
          <p className="text-sm text-slate-500 mt-1">
            Movies and restaurants you saved for later
          </p>
        </div>

        {isLoading && movies.length === 0 && restaurants.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 className="animate-spin" size={22} />
            Loading wishlist…
          </div>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {movies.map((movie) => (
                  <WishlistMovieCard key={movie.id} movie={movie} />
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
              emptyIcon={Bookmark}
              emptyTitle="No restaurants saved yet"
              emptyDescription="Tap the bookmark icon on any dining listing card to add it here."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {restaurants.map((r) => (
                  <WishlistRestaurantCard key={r.id} restaurant={r} />
                ))}
              </div>
            </WishlistSection>
          </div>
        )}
      </div>
    </CustomerAccountLayout>
  );
}
