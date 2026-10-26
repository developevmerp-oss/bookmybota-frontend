"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "bookmybota_liked_event_ids";

function readLikedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeLikedIds(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

type Props = {
  eventId: string;
  className?: string;
};

/** Local like/heart control for event cards (persisted in localStorage). */
export default function EventLikeButton({ eventId, className }: Props) {
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    setLiked(readLikedIds().includes(String(eventId)));
  }, [eventId]);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const id = String(eventId);
      const ids = readLikedIds();
      const nextLiked = !ids.includes(id);
      const next = nextLiked ? [...ids, id] : ids.filter((x) => x !== id);
      writeLikedIds(next);
      setLiked(nextLiked);
      toast.success(
        nextLiked ? "Successfully added to favourites" : "Removed from favourites"
      );
    },
    [eventId]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={liked ? "Remove from favourites" : "Add to favourites"}
      aria-pressed={liked}
      className={
        className ||
        "absolute top-3 right-3 z-[2] w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
      }
    >
      <Heart
        size={18}
        className={liked ? "fill-[#E11D48] text-[#E11D48]" : "fill-none text-[#111111]"}
        strokeWidth={2}
      />
    </button>
  );
}
