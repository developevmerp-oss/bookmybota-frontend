"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useGetMovieWishlistIdsQuery,
  useSyncMovieWishlistMutation,
  useToggleMovieWishlistMutation,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { extractApiError } from "@/lib/apiErrors";
import {
  clearGuestMovieWishlistIds,
  readGuestMovieWishlistIds,
  writeGuestMovieWishlistIds,
} from "@/lib/movieWishlist";

type Props = {
  movieId: string;
  className?: string;
};

let guestWishlistSyncStarted = false;

export default function MovieWishlistButton({ movieId, className }: Props) {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const isCustomer = authUser?.role === "customer" && Boolean(authUser.customer_id);

  const [guestSaved, setGuestSaved] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const { data: wishlistIds = [] } = useGetMovieWishlistIdsQuery(undefined, {
    skip: !isCustomer,
  });
  const [toggleWishlist, { isLoading: toggling }] = useToggleMovieWishlistMutation();
  const [syncWishlist] = useSyncMovieWishlistMutation();

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    if (isCustomer) return;
    setGuestSaved(readGuestMovieWishlistIds().includes(String(movieId)));
  }, [movieId, isCustomer]);

  useEffect(() => {
    if (!isCustomer || guestWishlistSyncStarted) return;
    const guestIds = readGuestMovieWishlistIds();
    if (guestIds.length === 0) return;
    guestWishlistSyncStarted = true;
    void (async () => {
      try {
        await syncWishlist({ movie_ids: guestIds }).unwrap();
        clearGuestMovieWishlistIds();
      } catch {
        guestWishlistSyncStarted = false;
      }
    })();
  }, [isCustomer, syncWishlist]);

  const serverSaved = useMemo(
    () => wishlistIds.map(String).includes(String(movieId)),
    [wishlistIds, movieId]
  );

  const saved = optimistic ?? (isCustomer ? serverSaved : guestSaved);

  useEffect(() => {
    setOptimistic(null);
  }, [serverSaved, guestSaved, movieId]);

  const handleClick = useCallback(
    async (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isCustomer) {
        const ids = readGuestMovieWishlistIds();
        const next = saved ? ids.filter((id) => id !== movieId) : [...ids, movieId];
        writeGuestMovieWishlistIds(next);
        setGuestSaved(!saved);
        toast.success(saved ? "Removed from favorites" : "Added to favorites");
        return;
      }

      const guestIds = readGuestMovieWishlistIds();
      if (guestIds.length > 0) {
        try {
          await syncWishlist({ movie_ids: guestIds }).unwrap();
          clearGuestMovieWishlistIds();
        } catch {
          /* continue with toggle even if sync fails */
        }
      }

      const prev = saved;
      setOptimistic(!prev);
      try {
        const result = await toggleWishlist({ movie_id: String(movieId) }).unwrap();
        const wishlisted = Boolean(result.data?.wishlisted);
        setOptimistic(wishlisted);
        toast.success(
          result.message ||
            (wishlisted ? "Successfully added to wishlist" : "Removed from wishlist")
        );
      } catch (err) {
        setOptimistic(prev);
        toast.error(extractApiError(err, "Could not update wishlist"));
      }
    },
    [isCustomer, movieId, saved, toggleWishlist, syncWishlist]
  );

  return (
    <button
      type="button"
      onClick={(e) => void handleClick(e)}
      disabled={toggling}
      aria-label={saved ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={saved}
      className={
        className ||
        "inline-flex size-11 sm:size-12 items-center justify-center rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 cursor-pointer disabled:opacity-70"
      }
    >
      {toggling ? (
        <Loader2 className="size-4 sm:size-5 animate-spin text-white" />
      ) : (
        <Heart
          className={`size-4 sm:size-5 ${saved ? "fill-[#F84464] text-[#F84464]" : "text-white"}`}
          strokeWidth={2}
        />
      )}
    </button>
  );
}
