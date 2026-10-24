"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import type { PublicRegisteredPartner } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { artistHref, venueHref } from "@/lib/businessPublicPath";
import SafeCoverImage, {
  ArtistImageFallback,
} from "@/components/Shared/SafeCoverImage";
import {
  isRegisteredDirectoryArtist,
  type DirectoryArtist,
} from "@/lib/usePublicArtistsCatalog";

const BRAND = "#6900AA";
const BRAND_SOFT = "#F7E9FF";

/** Mobile/tablet peek rail: ~1 full card + half of the next (dining collections style). */
function PartnerPeekCarousel({
  title,
  partners,
  kind,
}: {
  title?: string;
  partners: DirectoryArtist[];
  kind: "venue" | "artist";
}) {
  if (partners.length === 0) return null;

  return (
    <div>
      {title ? (
        <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#111111] mb-3 px-0">
          {title}
        </h2>
      ) : null}
      <div className="-mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-1 pr-4 sm:pr-6">
          {partners.map((p) => (
            <div
              key={p.id}
              className="shrink-0 snap-start w-[calc((100vw-2.5rem)/1.45)] sm:w-[calc((100vw-5rem)/1.5)] md:w-[calc((100vw-5rem)/1.55)]"
            >
              <PartnerCard partner={p} kind={kind} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PartnerCard({
  partner,
  kind,
}: {
  partner: DirectoryArtist;
  kind: "venue" | "artist";
}) {
  const place = [partner.city_name, partner.city_state].filter(Boolean).join(", ");
  const registered = kind === "artist" ? isRegisteredDirectoryArtist(partner) : true;
  const subtitle =
    kind === "venue"
      ? partner.type_name ||
        (partner.published_layout_count
          ? `${partner.published_layout_count} published layout${
              partner.published_layout_count === 1 ? "" : "s"
            }`
          : "Registered venue")
      : partner.type_name || partner.role_title || (registered ? "Registered artist" : "Artist");

  const detailLine =
    kind === "artist"
      ? partner.description?.trim() || place || null
      : partner.address?.trim() || place || null;

  const ctaLabel =
    kind === "artist"
      ? registered
        ? "View free dates & inquire"
        : "View profile & events"
      : "View free dates & inquire";

  const card = (
    <div className="group relative w-full h-full min-h-[340px] sm:min-h-[380px] rounded-[1.75rem] overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.14)] bg-[#1a1a1a]">
      {kind === "artist" ? (
        <SafeCoverImage
          src={partner.cover_image_url ? resolveMediaUrl(partner.cover_image_url) : ""}
          alt={partner.name}
          className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
          fallbackClassName="absolute inset-0 flex items-center justify-center bg-[#F7E9FF] text-[#6900AA]"
          fallback={<ArtistImageFallback size={48} />}
        />
      ) : partner.cover_image_url ? (
        <img
          src={resolveMediaUrl(partner.cover_image_url)}
          alt={partner.name}
          className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: BRAND_SOFT, color: BRAND }}
        >
          <Building2 size={48} strokeWidth={1.4} />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/90 via-black/55 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1.5 p-3.5 sm:p-4 pt-0">
        <h3 className="font-bold text-white text-[1.05rem] sm:text-lg leading-snug line-clamp-1 drop-shadow-sm">
          {partner.name}
        </h3>

        {detailLine ? (
          <p className="text-[12px] sm:text-[13px] text-white/85 leading-relaxed line-clamp-1">
            {detailLine}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {subtitle ? (
            <span className="inline-flex items-center rounded-full bg-black/45 border border-white/15 px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-white/95">
              {subtitle}
            </span>
          ) : null}
          {place ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 border border-white/15 px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-white/95">
              <MapPin size={11} className="shrink-0" />
              <span className="line-clamp-1 max-w-[9rem]">{place}</span>
            </span>
          ) : null}
        </div>

        <span className="mt-0.5 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-2.5 text-[12px] sm:text-[13px] font-bold text-[#111111] shadow-sm group-hover:bg-[#F7E9FF] transition-colors">
          {ctaLabel}
        </span>
      </div>
    </div>
  );

  if (kind === "artist") {
    return (
      <Link href={artistHref(partner)} className="block h-full">
        {card}
      </Link>
    );
  }

  if (kind === "venue") {
    return (
      <Link href={venueHref(partner)} className="block h-full">
        {card}
      </Link>
    );
  }

  return card;
}

export default function PartnerDirectorySection({
  title,
  subtitle,
  kind,
  partners,
  isLoading,
  emptyMessage,
  emptyContent,
  showHeader = true,
}: {
  title: string;
  subtitle: string;
  kind: "venue" | "artist";
  partners: PublicRegisteredPartner[] | DirectoryArtist[];
  isLoading?: boolean;
  emptyMessage?: string;
  /** Rich empty UI (e.g. ListingNoResultsState). Takes priority over emptyMessage. */
  emptyContent?: ReactNode;
  showHeader?: boolean;
}) {
  const artistList = partners as DirectoryArtist[];
  const registeredArtists =
    kind === "artist" ? artistList.filter((p) => isRegisteredDirectoryArtist(p)) : [];
  const eventArtists =
    kind === "artist" ? artistList.filter((p) => !isRegisteredDirectoryArtist(p)) : [];

  return (
    <section
      id="partners"
      className={`scroll-mt-24 border-t border-[#F3E8FF] ${
        showHeader ? "bg-white py-16 md:py-20" : "bg-[#faf7fc] py-8 md:py-10 border-t-0"
      }`}
    >
      <div className="bmb-section-container">
        {showHeader ? (
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#111111]">
              {title}
            </h2>
            <p className="mt-4 text-sm md:text-base text-[#5c5c5c] leading-relaxed">{subtitle}</p>
          </div>
        ) : null}

        {isLoading ? (
          <>
            {/* Mobile / tablet shimmer rails */}
            <div className={`lg:hidden ${showHeader ? "mt-12" : ""} space-y-8`}>
              {(kind === "artist" ? [0, 1] : [0]).map((row) => (
                <div key={row}>
                  {kind === "artist" ? (
                    <div className="h-6 w-40 rounded-md bg-[#E5E7EB] animate-pulse mb-3" />
                  ) : null}
                  <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 flex gap-3 overflow-hidden">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div
                        key={i}
                        className="shrink-0 w-[calc((100vw-2.5rem)/1.45)] sm:w-[calc((100vw-5rem)/1.5)] rounded-[1.75rem] overflow-hidden bg-[#f3f0f6] animate-pulse min-h-[340px]"
                      >
                        <div className="h-full w-full bg-[#E5E7EB]" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div
              className={`${showHeader ? "mt-12" : ""} hidden lg:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5`}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-[1.75rem] overflow-hidden bg-[#f3f0f6] animate-pulse min-h-[340px] sm:min-h-[380px]"
                >
                  <div className="h-full w-full bg-[#E5E7EB]" />
                </div>
              ))}
            </div>
          </>
        ) : partners.length === 0 ? (
          emptyContent ? (
            <div className={showHeader ? "mt-12" : ""}>{emptyContent}</div>
          ) : (
            <p className={`${showHeader ? "mt-12" : ""} text-center text-sm text-[#888]`}>
              {emptyMessage || "No partners to show yet."}
            </p>
          )
        ) : kind === "artist" ? (
          <>
            {/* Mobile / tablet: registered rail, then event (non-registered) rail */}
            <div className={`lg:hidden ${showHeader ? "mt-12" : ""} space-y-8`}>
              <PartnerPeekCarousel
                title="Registered artists"
                partners={registeredArtists}
                kind="artist"
              />
              <PartnerPeekCarousel
                title="Event artists"
                partners={eventArtists}
                kind="artist"
              />
              {registeredArtists.length === 0 && eventArtists.length === 0 ? (
                emptyContent ? (
                  emptyContent
                ) : (
                  <p className="text-center text-sm text-[#888]">
                    {emptyMessage || "No partners to show yet."}
                  </p>
                )
              ) : null}
            </div>
            {/* Desktop: unchanged grid */}
            <div
              className={`${showHeader ? "mt-12" : ""} hidden lg:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5`}
            >
              {artistList.map((p) => (
                <PartnerCard key={p.id} partner={p} kind="artist" />
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Mobile / tablet: registered venues peek carousel */}
            <div className={`lg:hidden ${showHeader ? "mt-12" : ""}`}>
              <PartnerPeekCarousel
                partners={partners as DirectoryArtist[]}
                kind="venue"
              />
            </div>
            {/* Desktop: unchanged grid */}
            <div
              className={`${showHeader ? "mt-12" : ""} hidden lg:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5`}
            >
              {partners.map((p) => (
                <PartnerCard key={p.id} partner={p as DirectoryArtist} kind="venue" />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
