"use client";

import Link from "next/link";
import { Bookmark, Loader2, MapPin, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import {
  useGetDiningWishlistQuery,
  useToggleDiningWishlistMutation,
  type Business,
} from "@/services/api";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";
import { formatMoney } from "@/lib/currencyFormat";
import { listingOfferLabel } from "@/lib/diningOffers";
import { extractApiError } from "@/lib/apiErrors";

function WishlistRestaurantCard({
  restaurant,
  onRemoved,
}: {
  restaurant: Business & { wishlisted_at?: string };
  onRemoved?: () => void;
}) {
  const [toggleWishlist, { isLoading }] = useToggleDiningWishlistMutation();
  const imageSrc =
    restaurant.cover_image_url ||
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

export default function CustomerDiningWishlistPage() {
  const { data: restaurants = [], isLoading, isError, refetch } = useGetDiningWishlistQuery();

  return (
    <CustomerAccountLayout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-[#111111]">My Wishlist</h2>
            <p className="text-sm text-slate-500 mt-1">
              Dining restaurants you saved for later
            </p>
          </div>
          <Link
            href="/dining"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#6900AA] hover:underline"
          >
            <UtensilsCrossed size={16} />
            Browse dining
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 className="animate-spin" size={22} />
            Loading wishlist…
          </div>
        ) : isError ? (
          <div className="text-center py-16">
            <p className="text-slate-600 font-medium">Could not load your wishlist.</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 text-sm font-semibold text-[#6900AA] hover:underline cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : restaurants.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-[#F7E9FF] flex items-center justify-center text-[#6900AA] mb-4">
              <Bookmark size={26} />
            </div>
            <h3 className="text-lg font-bold text-[#111111]">No restaurants saved yet</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
              Tap the bookmark icon on any dining listing card to add it here.
            </p>
            <Link
              href="/dining"
              className="inline-flex mt-5 items-center justify-center rounded-xl bg-[#6900AA] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#5a0092] transition-colors"
            >
              Explore restaurants
            </Link>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
              {restaurants.length} saved
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {restaurants.map((r) => (
                <WishlistRestaurantCard key={r.id} restaurant={r} />
              ))}
            </div>
          </>
        )}
      </div>
    </CustomerAccountLayout>
  );
}
