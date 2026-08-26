"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { Bookmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useGetDiningWishlistIdsQuery,
  useSyncDiningWishlistMutation,
  useToggleDiningWishlistMutation,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { extractApiError } from "@/lib/apiErrors";
import CustomerAuthModal from "@/components/Shared/CustomerAuthModal";
import {
  clearGuestDiningWishlistIds,
  readGuestDiningWishlistIds,
} from "@/lib/diningWishlist";

type Props = {
  businessId: string;
  className?: string;
};

/** Avoid every card on a grid firing guest→account sync at once */
let guestWishlistSyncStarted = false;

export default function DiningWishlistButton({ businessId, className }: Props) {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const isCustomer = authUser?.role === "customer" && Boolean(authUser.customer_id);

  const [authOpen, setAuthOpen] = useState(false);
  const [guestSaved, setGuestSaved] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const { data: wishlistIds = [] } = useGetDiningWishlistIdsQuery(undefined, {
    skip: !isCustomer,
  });
  const [toggleWishlist, { isLoading: toggling }] = useToggleDiningWishlistMutation();
  const [syncWishlist] = useSyncDiningWishlistMutation();

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    if (isCustomer) return;
    setGuestSaved(readGuestDiningWishlistIds().includes(String(businessId)));
  }, [businessId, isCustomer]);

  // One-time merge of legacy guest localStorage saves after customer login
  useEffect(() => {
    if (!isCustomer || guestWishlistSyncStarted) return;
    const guestIds = readGuestDiningWishlistIds();
    if (guestIds.length === 0) return;
    guestWishlistSyncStarted = true;
    void (async () => {
      try {
        await syncWishlist({ business_ids: guestIds }).unwrap();
        clearGuestDiningWishlistIds();
      } catch {
        guestWishlistSyncStarted = false;
      }
    })();
  }, [isCustomer, syncWishlist]);

  const serverSaved = useMemo(
    () => wishlistIds.map(String).includes(String(businessId)),
    [wishlistIds, businessId]
  );

  const saved = optimistic ?? (isCustomer ? serverSaved : guestSaved);

  useEffect(() => {
    setOptimistic(null);
  }, [serverSaved, guestSaved, businessId]);

  const handleClick = useCallback(
    async (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isCustomer) {
        toast.message("Sign in to save restaurants to My Wishlist");
        setAuthOpen(true);
        return;
      }

      const prev = saved;
      setOptimistic(!prev);
      try {
        const result = await toggleWishlist({ business_id: String(businessId) }).unwrap();
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
    [businessId, isCustomer, saved, toggleWishlist]
  );

  return (
    <>
      <button
        type="button"
        onClick={(e) => void handleClick(e)}
        disabled={toggling}
        aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
        aria-pressed={saved}
        className={
          className ||
          "absolute top-3 right-3 z-[2] w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-70"
        }
      >
        {toggling ? (
          <Loader2 size={16} className="animate-spin text-[#6900AA]" />
        ) : (
          <Bookmark
            size={18}
            className={saved ? "fill-[#6900AA] text-[#6900AA]" : "fill-none text-[#6900AA]"}
            strokeWidth={2.25}
          />
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
