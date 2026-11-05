"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
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
  useGetPublicRegisteredCinemasQuery,
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
import {
  readCinemaFavoriteIds,
  readCinemaFavoriteItems,
  toggleCinemaFavorite,
  isCinemaFavorited,
  type SavedCinemaItem,
} from "@/lib/cinemaWishlist";
import { movieDetailPath } from "@/components/MovieLandingPage/movieCatalog";
import { cinemaHref, restaurantHref } from "@/lib/businessPublicPath";
import { CustomerPageShimmer } from "@/components/Shared/Shimmer";

const SHOWCASE_CINEMAS = [
  {
    id: "c1",
    name: "PVR: Palladium Mall, Addis Ababa",
    address: "4th floor, Palladium Mall, Bole Road, Addis Ababa, Ethiopia",
    cover_image_url: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80",
    slug: "pvr-palladium-mall",
  },
  {
    id: "c2",
    name: "Cinepolis: City Centre, Addis Ababa",
    address: "City Centre Mall, Mexico Square, Addis Ababa, Ethiopia",
    cover_image_url: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=500&q=80",
    slug: "cinepolis-city-centre",
  },
  {
    id: "c3",
    name: "Edna Mall Cinema, Addis Ababa",
    address: "Edna Mall, Bole Medhanialem, Addis Ababa, Ethiopia",
    cover_image_url: "https://images.unsplash.com/photo-1595769816263-9b910be24d5f?w=500&q=80",
    slug: "edna-mall-cinema",
  },
];

function WishlistCinemaCard({
  cinema,
  onRemoved,
}: {
  cinema: { id: string; name: string; address?: string; cover_image_url?: string; slug?: string; href?: string };
  onRemoved?: () => void;
}) {
  const imageSrc =
    resolveMediaUrl(cinema.cover_image_url) ||
    "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80";

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleCinemaFavorite(
      {
        id: cinema.id,
        name: cinema.name,
        address: cinema.address,
        cover_image_url: cinema.cover_image_url,
        slug: cinema.slug,
        href: cinema.href || cinemaHref(cinema),
      },
      [cinema.id, cinema.slug || "", cinema.name]
    );
    toast.success(`Removed ${cinema.name} from your favorite cinemas`);
    onRemoved?.();
  };

  const href = cinema.href || cinemaHref(cinema);

  return (
    <div className="group flex h-full flex-col bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="relative h-44 shrink-0 bg-slate-100">
        <Link href={href} className="absolute inset-0 block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc}
            alt={cinema.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&q=80";
            }}
          />
        </Link>
        <button
          type="button"
          onClick={handleRemove}
          aria-label="Remove from favourites"
          className="absolute top-3 right-3 z-[2] w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <Heart size={18} className="fill-[#E11D48] text-[#E11D48]" strokeWidth={2.25} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4 justify-between gap-3">
        <div>
          <Link href={href}>
            <h3 className="text-base font-bold text-slate-900 group-hover:text-[#6900AA] transition-colors truncate">
              {cinema.name}
            </h3>
          </Link>
          {cinema.address && (
            <p className="flex items-start gap-1 text-xs text-slate-500 mt-1 line-clamp-2">
              <MapPin size={13} className="shrink-0 mt-0.5 text-slate-400" />
              <span>{cinema.address}</span>
            </p>
          )}
        </div>

        <Link
          href={href}
          className="w-full inline-flex items-center justify-center py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-black transition-colors"
        >
          View Showtimes
        </Link>
      </div>
    </div>
  );
}

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
      toast.success(result.message || "Removed from favourites");
      onRemoved?.();
    } catch (err) {
      toast.error(extractApiError(err, "Could not remove from favourites"));
    }
  };

  return (
    <div className="group flex h-full flex-col bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="relative h-44 shrink-0 bg-slate-100">
        <Link href={restaurantHref(restaurant)} className="absolute inset-0 block">
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
          aria-label="Remove from favourites"
          className="absolute top-3 right-3 z-[2] w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-70"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-[#E11D48]" />
          ) : (
            <Heart size={18} className="fill-[#E11D48] text-[#E11D48]" strokeWidth={2.25} />
          )}
        </button>
        {offerLabel && (
          <span className="absolute bottom-3 left-3 z-[1] max-w-[calc(100%-1.5rem)] truncate rounded-full bg-rose-50 text-rose-700 text-xs font-bold px-3 py-1 shadow-sm">
            {offerLabel}
          </span>
        )}
      </div>

      <Link href={restaurantHref(restaurant)} className="flex flex-col flex-1 p-4 min-w-0">
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
      toast.success(result.message || "Removed from favourites");
    } catch (err) {
      toast.error(extractApiError(err, "Could not remove from favourites"));
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
          aria-label="Remove from favourites"
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
  const [syncMovieWishlist] = useSyncMovieWishlistMutation();
  const [syncDiningWishlist] = useSyncDiningWishlistMutation();

  const [cinemaFavorites, setCinemaFavorites] = useState<string[]>([]);
  const [savedCinemaItems, setSavedCinemaItems] = useState<SavedCinemaItem[]>([]);

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
    data: registeredCinemas = [],
    isLoading: cinemasLoading,
    refetch: refetchCinemas,
  } = useGetPublicRegisteredCinemasQuery(undefined, { refetchOnMountOrArgChange: true });

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    const updateCinemas = () => {
      setCinemaFavorites(readCinemaFavoriteIds());
      setSavedCinemaItems(readCinemaFavoriteItems());
    };
    updateCinemas();
    window.addEventListener("movie_cinema_favorites_changed", updateCinemas);
    window.addEventListener("storage", updateCinemas);
    return () => {
      window.removeEventListener("movie_cinema_favorites_changed", updateCinemas);
      window.removeEventListener("storage", updateCinemas);
    };
  }, []);

  const allCinemas = useMemo(() => {
    const list: Array<{
      id: string;
      name: string;
      address?: string;
      cover_image_url?: string;
      slug?: string;
      href?: string;
    }> = [];
    const seen = new Set<string>();

    const addIfNew = (c: {
      id: string;
      name: string;
      address?: string;
      cover_image_url?: string;
      slug?: string;
      href?: string;
    }) => {
      const idKey = c.id ? c.id.toLowerCase() : "";
      const slugKey = c.slug ? c.slug.toLowerCase() : "";
      const nameKey = c.name ? c.name.toLowerCase() : "";
      if (idKey && seen.has(idKey)) return;
      if (slugKey && seen.has(slugKey)) return;
      if (nameKey && seen.has(nameKey)) return;

      if (idKey) seen.add(idKey);
      if (slugKey) seen.add(slugKey);
      if (nameKey) seen.add(nameKey);

      list.push(c);
    };

    // 1. Registered cinemas from API
    registeredCinemas.forEach((c) => {
      addIfNew({
        id: c.id,
        name: c.name,
        address: c.address,
        cover_image_url: c.cover_image_url,
        slug: c.slug,
        href: cinemaHref(c),
      });
    });

    // 2. Saved items stored directly in localStorage
    savedCinemaItems.forEach((c) => {
      addIfNew({
        id: c.id,
        name: c.name,
        address: c.address,
        cover_image_url: c.cover_image_url,
        slug: c.slug,
        href: c.href || cinemaHref(c),
      });
    });

    // 3. Showcase mock cinemas
    SHOWCASE_CINEMAS.forEach((c) => {
      addIfNew({
        ...c,
        href: cinemaHref(c),
      });
    });

    return list;
  }, [registeredCinemas, savedCinemaItems]);

  const savedCinemas = useMemo(() => {
    if (cinemaFavorites.length === 0 && savedCinemaItems.length === 0) return [];
    return allCinemas.filter((c) =>
      isCinemaFavorited([c.id, c.slug || "", c.name], cinemaFavorites) ||
      savedCinemaItems.some((item) =>
        item.id.toLowerCase() === c.id.toLowerCase() ||
        (item.slug && c.slug && item.slug.toLowerCase() === c.slug.toLowerCase()) ||
        item.name.toLowerCase() === c.name.toLowerCase()
      )
    );
  }, [allCinemas, cinemaFavorites, savedCinemaItems]);

  useEffect(() => {
    void refetchMovies();
    void refetchDining();
    void refetchCinemas();
  }, [refetchMovies, refetchDining, refetchCinemas]);

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

        {isLoading && movies.length === 0 && restaurants.length === 0 && savedCinemas.length === 0 ? (
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
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {movies.map((movie) => (
                  <WishlistMovieCard key={movie.id} movie={movie} />
                ))}
              </div>
            </WishlistSection>

            <WishlistSection
              title="Saved Cinemas"
              count={savedCinemas.length}
              browseHref="/movies/cinemas"
              browseLabel="Browse cinemas"
              browseIcon={Building2}
              isLoading={cinemasLoading && allCinemas.length === 0}
              isError={false}
              onRetry={() => void refetchCinemas()}
              emptyIcon={Building2}
              emptyTitle="No cinemas saved yet"
              emptyDescription="Tap the heart icon on any cinema page to add it here."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {savedCinemas.map((cinema) => (
                  <WishlistCinemaCard
                    key={cinema.id}
                    cinema={cinema}
                    onRemoved={() => {
                      setCinemaFavorites(readCinemaFavoriteIds());
                      setSavedCinemaItems(readCinemaFavoriteItems());
                    }}
                  />
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
