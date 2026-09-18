"use client";

import { useState, type ReactNode } from "react";
import { Calendar, Clapperboard, Mic2, Utensils } from "lucide-react";

type SafeCoverImageProps = {
  src?: string | null;
  alt?: string;
  fallback: ReactNode;
  /** Applied to the <img> when the image loads. */
  className?: string;
  /** Applied to the fallback container (and optionally wraps layout). */
  fallbackClassName?: string;
  loading?: "lazy" | "eager";
  draggable?: boolean;
};

/** Image that swaps to an icon placeholder when missing or broken. */
export default function SafeCoverImage({
  src,
  alt = "",
  fallback,
  className = "h-full w-full object-cover",
  fallbackClassName = "flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300",
  loading = "lazy",
  draggable = false,
}: SafeCoverImageProps) {
  const [failed, setFailed] = useState(false);
  const url = (src || "").trim();

  if (!url || failed) {
    return <div className={fallbackClassName}>{fallback}</div>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={className}
      loading={loading}
      draggable={draggable}
      onError={() => setFailed(true)}
    />
  );
}

export function MovieImageFallback({ size = 32 }: { size?: number }) {
  return <Clapperboard size={size} strokeWidth={1.4} />;
}

export function DiningImageFallback({ size = 28 }: { size?: number }) {
  return <Utensils size={size} strokeWidth={1.5} />;
}

export function EventImageFallback({ size = 28 }: { size?: number }) {
  return <Calendar size={size} strokeWidth={1.5} />;
}

/** Same Mic2 placeholder used on the home Top Artists rail. */
export function ArtistImageFallback({ size = 32 }: { size?: number }) {
  return <Mic2 size={size} strokeWidth={1.4} />;
}

/** Soft brand plate behind artist image placeholders (landing style). */
export const ARTIST_IMAGE_FALLBACK_CLASS =
  "flex h-full w-full items-center justify-center bg-[#F7E9FF] text-[#6900AA]";
