"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link2, Share2, Star, X } from "lucide-react";
import { FaFacebookF, FaXTwitter } from "react-icons/fa6";
import { toast } from "sonner";
import images from "@/Images";
import { lockBodyScroll } from "@/lib/lockBodyScroll";

function logoSrc() {
  return typeof images.logo === "string" ? images.logo : images.logo.src;
}

export type CustomerReviewCardProps = {
  name: string;
  rating: number;
  text?: string;
  timeLabel?: string;
  bookedOnPlatform?: boolean;
  /** Left accent border color (dining / movie cards). */
  accentColor?: string;
  className?: string;
  /** Optional share URL; defaults to current page. */
  shareUrl?: string;
  lineClamp?: number;
};

function ReviewShareModal({
  open,
  onClose,
  shareUrl,
  shareText,
}: {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  shareText: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(shareText);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
      onClose();
    } catch {
      toast.error("Could not copy link");
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-share-title"
        className="relative w-full max-w-[22rem] rounded-xl bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex items-center justify-center px-4 py-3.5 border-b border-[#EBEBEB]">
          <h3
            id="review-share-title"
            className="text-[1.05rem] font-bold text-[#111]"
          >
            Share
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 inline-flex items-center justify-center rounded-full text-[#888] hover:bg-[#F5F5F5] cursor-pointer"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="py-1">
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 px-5 py-3.5 text-[0.9375rem] text-[#222] hover:bg-[#FAFAFA] transition-colors"
          >
            <span>Facebook</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1877F2] text-white">
              <FaFacebookF size={13} />
            </span>
          </a>
          <div className="mx-5 border-t border-[#EFEFEF]" />
          <a
            href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 px-5 py-3.5 text-[0.9375rem] text-[#222] hover:bg-[#FAFAFA] transition-colors"
          >
            <span>X (Formerly Twitter)</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#111] text-white">
              <FaXTwitter size={13} />
            </span>
          </a>
          <div className="mx-5 border-t border-[#EFEFEF]" />
          <button
            type="button"
            onClick={copyLink}
            className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-[0.9375rem] text-[#222] hover:bg-[#FAFAFA] transition-colors cursor-pointer"
          >
            <span>Copy Link</span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#F0F0F0] text-[#555]">
              <Link2 size={15} strokeWidth={2} />
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Customer-facing review card — keeps current look, with BMS-style
 * name + “Booked on” logo under avatar height, time + share on the right.
 */
export default function CustomerReviewCard({
  name,
  rating,
  text,
  timeLabel,
  bookedOnPlatform = true,
  accentColor = "#6900AA",
  className = "",
  shareUrl,
  lineClamp = 4,
}: CustomerReviewCardProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const displayName = name?.trim() || "Guest";
  const ratingLabel = `${Number(rating || 0).toFixed(1)}/5`;
  const body = (text || "").trim();
  const resolvedShareUrl =
    shareUrl ||
    (typeof window !== "undefined" ? window.location.href : "");

  return (
    <>
      <article
        className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-4 flex flex-col shadow-sm ${className}`}
        style={{ borderLeftColor: accentColor }}
      >
        <div className="flex items-start gap-2.5">
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{
              backgroundColor: `${accentColor}18`,
              color: accentColor,
            }}
          >
            {displayName.slice(0, 1).toUpperCase()}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#111111] truncate leading-snug">
              {displayName}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm sm:text-[0.9375rem] text-gray-800 leading-none">
              <span className="shrink-0">
                {bookedOnPlatform ? "Booked on" : "Customer on"}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc()}
                alt="Book My Bota"
                className="h-5 sm:h-7 w-auto object-contain"
              />
            </p>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-[#111111] pt-0.5">
            <Star size={14} className="fill-[#F84464] text-[#F84464]" />
            {ratingLabel}
          </span>
        </div>

        {body ? (
          <p
            className={`mt-2.5 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap ${
              lineClamp === 4
                ? "line-clamp-4"
                : lineClamp === 3
                  ? "line-clamp-3"
                  : ""
            }`}
          >
            {body}
          </p>
        ) : null}

        <div className="mt-auto pt-3 flex items-center justify-end gap-3">
          {timeLabel ? (
            <span className="text-xs text-slate-400">{timeLabel}</span>
          ) : null}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-label="Share review"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <Share2 size={15} strokeWidth={2} />
          </button>
        </div>
      </article>

      <ReviewShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        shareUrl={resolvedShareUrl}
        shareText={`${displayName}'s review on Book My Bota`}
      />
    </>
  );
}
