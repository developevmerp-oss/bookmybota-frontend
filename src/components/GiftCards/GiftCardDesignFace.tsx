"use client";

import type { GiftCardDesign } from "@/services/api";
import { DEFAULT_DESIGN_GRADIENT } from "@/lib/giftCardDesigns";
import { resolveMediaUrl } from "@/lib/mediaUrl";

type Props = {
  design: Pick<GiftCardDesign, "title" | "image_url" | "color_gradient" | "caption_color">;
  className?: string;
  /** Larger type for buy-page preview */
  size?: "grid" | "preview";
  /** Force all overlay copy to white (admin / dark art). */
  forceWhiteText?: boolean;
};

/**
 * BookMyShow-style gift card face: full-bleed art + brand + title.
 */
export default function GiftCardDesignFace({
  design,
  className = "",
  size = "grid",
  forceWhiteText = false,
}: Props) {
  const gradient = design.color_gradient || DEFAULT_DESIGN_GRADIENT;
  const img = resolveMediaUrl(design.image_url);
  const isPreview = size === "preview";
  const brandColor = "#FFFFFF";
  const titleColor = forceWhiteText
    ? "#FFFFFF"
    : design.caption_color?.trim() || "#FFFFFF";

  return (
    <div
      className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br ${gradient} ${className}`}
    >
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img}
          alt=""
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
      ) : null}

      {/* Soft scrim so white text stays readable on bright art */}
      <div
        className="absolute inset-0 z-[1] bg-gradient-to-t from-black/60 via-black/20 to-black/35"
        aria-hidden
      />

      <div className="relative z-[2] flex h-full min-h-0 flex-col p-3 sm:p-4 text-white">
        <div>
          <p
            className={`font-bold tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] ${
              isPreview ? "text-[13px] sm:text-sm" : "text-[11px] sm:text-xs"
            }`}
            style={{ color: brandColor }}
          >
            BookMyBota
          </p>
          <p
            className={`font-extrabold leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${
              isPreview ? "text-2xl sm:text-3xl mt-0.5" : "text-lg sm:text-xl mt-0.5"
            }`}
            style={{ color: brandColor }}
          >
            gift{" "}
            <span className="font-bold tracking-[0.08em] text-[0.72em]" style={{ color: brandColor }}>
              CARD
            </span>
          </p>
          <p
            className={`mt-1 leading-snug drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${
              isPreview ? "text-[11px] sm:text-xs max-w-[14rem]" : "text-[9px] sm:text-[10px] max-w-[9.5rem]"
            }`}
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            Events, Sports, Dining and more.
          </p>
        </div>

        <div className="mt-auto pt-6 sm:pt-8">
          <p
            className={`font-extrabold leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${
              isPreview ? "text-xl sm:text-2xl" : "text-[15px] sm:text-lg"
            }`}
            style={{ color: titleColor }}
          >
            {design.title}
          </p>
        </div>
      </div>

      {/* Vertical use-line like BMS (desktop) */}
      <p
        className="pointer-events-none absolute right-1.5 top-1/2 z-[2] hidden -translate-y-1/2 rotate-180 text-[8px] font-medium tracking-wide [writing-mode:vertical-rl] sm:block drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
        style={{ color: "rgba(255,255,255,0.55)" }}
        aria-hidden
      >
        Events · Sports · Dining
      </p>
    </div>
  );
}
