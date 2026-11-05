"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useGetCinemaWishlistIdsQuery,
  useSyncCinemaWishlistMutation,
  useToggleCinemaWishlistMutation,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { extractApiError } from "@/lib/apiErrors";
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
import {
  clearGuestCinemaWishlistIds,
  readGuestCinemaWishlistIds,
} from "@/lib/cinemaWishlist";

type Props = {
  cinemaId: string;
  className?: string;
  /** Filled heart when saved; outline otherwise. */
  savedClassName?: string;
  unsavedClassName?: string;
  iconSize?: number;
  /** Optional label next to the heart (e.g. cinema detail sheet). */
  label?: string | ((saved: boolean) => string);
  labelClassName?: string;
};

let guestCinemaWishlistSyncStarted = false;

export default function CinemaWishlistButton({
  cinemaId,
  className,
  savedClassName = "fill-[#6900AA] text-[#6900AA]",
  unsavedClassName = "text-slate-400 hover:text-[#6900AA]",
  iconSize = 18,
  label,
  labelClassName = "text-[13px] text-[#4B5563]",
}: Props) {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  /** Same gate as movie / dining favourites — customer role only. */
  const isCustomer = authUser?.role === "customer";

  const [authOpen, setAuthOpen] = useState(false);
  const [guestSaved, setGuestSaved] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const { data: wishlistIds = [] } = useGetCinemaWishlistIdsQuery(undefined, {
    skip: !isCustomer,
  });
  const [toggleWishlist, { isLoading: toggling }] = useToggleCinemaWishlistMutation();
  const [syncWishlist] = useSyncCinemaWishlistMutation();

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    if (isCustomer) return;
    setGuestSaved(readGuestCinemaWishlistIds().includes(String(cinemaId)));
  }, [cinemaId, isCustomer]);

  // One-time merge of legacy guest localStorage saves after customer login
  useEffect(() => {
    if (!isCustomer || guestCinemaWishlistSyncStarted) return;
    const guestIds = readGuestCinemaWishlistIds();
    if (guestIds.length === 0) return;
    guestCinemaWishlistSyncStarted = true;
    void (async () => {
      try {
        await syncWishlist({ business_ids: guestIds }).unwrap();
        clearGuestCinemaWishlistIds();
      } catch {
        guestCinemaWishlistSyncStarted = false;
      }
    })();
  }, [isCustomer, syncWishlist]);

  const serverSaved = useMemo(
    () => wishlistIds.map(String).includes(String(cinemaId)),
    [wishlistIds, cinemaId]
  );

  const saved = optimistic ?? (isCustomer ? serverSaved : guestSaved);

  useEffect(() => {
    setOptimistic(null);
  }, [serverSaved, guestSaved, cinemaId]);

  const handleClick = useCallback(
    async (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isCustomer) {
        toast.message("Sign in to save cinemas to My Favourite");
        setAuthOpen(true);
        return;
      }

      const prev = saved;
      setOptimistic(!prev);
      try {
        const result = await toggleWishlist({ business_id: String(cinemaId) }).unwrap();
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
    [cinemaId, isCustomer, saved, toggleWishlist]
  );

  const labelText =
    typeof label === "function"
      ? label(saved)
      : label;

  return (
    <>
      <button
        type="button"
        onClick={(e) => void handleClick(e)}
        disabled={toggling}
        aria-label={saved ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={saved}
        className={
          className ||
          "mt-0.5 shrink-0 cursor-pointer p-1 -m-1 rounded-full hover:bg-slate-100 transition-colors relative z-10 disabled:opacity-70"
        }
      >
        {toggling ? (
          <Loader2 size={iconSize} className="animate-spin text-[#6900AA]" />
        ) : (
          <Heart
            size={iconSize}
            strokeWidth={2.25}
            className={saved ? savedClassName : unsavedClassName}
          />
        )}
        {labelText ? <span className={labelClassName}>{labelText}</span> : null}
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
