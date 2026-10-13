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
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
import {
  clearGuestMovieWishlistIds,
  readGuestMovieWishlistIds,
} from "@/lib/movieWishlist";

type Appearance = "default" | "glass";
/** Icon colors — independent of button chrome (`appearance` / `className`). */
type Tone = "default" | "onLight" | "onDark";

type Props = {
  movieId: string;
  className?: string;
  /** Button chrome when `className` is omitted. `glass` = frosted circle on media (dining parity). */
  appearance?: Appearance;
  /**
   * Heart / loader color:
   * - `default` — brand rose on light chips
   * - `onLight` — dark outline on white chip
   * - `onDark` / glass — white outline on media; rose fill when saved
   */
  tone?: Tone;
};

let guestWishlistSyncStarted = false;

function resolveIconClasses(
  appearance: Appearance,
  tone: Tone,
  saved: boolean
): { heart: string; loader: string } {
  const mediaOverlay = appearance === "glass" || tone === "onDark";

  if (mediaOverlay) {
    return {
      heart: saved ? "fill-[#E11D48] text-[#E11D48]" : "fill-none text-white",
      loader: "animate-spin text-white",
    };
  }

  if (tone === "onLight") {
    return {
      heart: saved ? "fill-[#E11D48] text-[#E11D48]" : "fill-none text-[#111111]",
      loader: "animate-spin text-[#6900AA]",
    };
  }

  return {
    heart: saved ? "fill-[#E11D48] text-[#E11D48]" : "fill-none text-[#B41739]",
    loader: "animate-spin text-[#6900AA]",
  };
}

export default function MovieWishlistButton({
  movieId,
  className,
  appearance = "default",
  tone = "default",
}: Props) {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  /** Same gate as dining favourites — customer role only. */
  const isCustomer = authUser?.role === "customer";

  const [authOpen, setAuthOpen] = useState(false);
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

  // One-time merge of legacy guest localStorage saves after customer login (dining parity)
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
        toast.message("Sign in to save movies to My Favourite");
        setAuthOpen(true);
        return;
      }

      const prev = saved;
      setOptimistic(!prev);
      try {
        const result = await toggleWishlist({ movie_id: String(movieId) }).unwrap();
        const wishlisted = Boolean(result.data?.wishlisted);
        setOptimistic(wishlisted);
        toast.success(
          result.message ||
            (wishlisted ? "Successfully added to favourites" : "Removed from favourites")
        );
      } catch (err) {
        setOptimistic(prev);
        toast.error(extractApiError(err, "Could not update favourites"));
      }
    },
    [isCustomer, movieId, saved, toggleWishlist]
  );

  const defaultClass =
    appearance === "glass"
      ? "absolute top-3 right-3 z-[2] w-9 h-9 rounded-full bg-white/35 backdrop-blur-md border border-white/50 shadow-sm flex items-center justify-center hover:bg-white/50 transition-colors cursor-pointer disabled:opacity-70"
      : "inline-flex size-11 sm:size-12 items-center justify-center rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 cursor-pointer disabled:opacity-70";

  const { heart: heartClass, loader: loaderClass } = resolveIconClasses(
    appearance,
    tone,
    saved
  );

  return (
    <>
      <button
        type="button"
        onClick={(e) => void handleClick(e)}
        disabled={toggling}
        aria-label={saved ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={saved}
        className={className || defaultClass}
      >
        {toggling ? (
          <Loader2 size={16} className={loaderClass} />
        ) : (
          <Heart size={18} className={heartClass} strokeWidth={2.25} />
        )}
      </button>

      <CustomerAuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          setAuthOpen(false);
          dispatch(loadFromStorage());
        }}
      />
    </>
  );
}
