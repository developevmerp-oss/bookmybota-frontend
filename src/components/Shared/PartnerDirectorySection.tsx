"use client";

import Link from "next/link";
import { Building2, MapPin, Mic2 } from "lucide-react";
import type { PublicRegisteredPartner } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";

const BRAND = "#6900AA";
const BRAND_SOFT = "#F7E9FF";

function PartnerCard({
  partner,
  kind,
}: {
  partner: PublicRegisteredPartner;
  kind: "venue" | "artist";
}) {
  const place = [partner.city_name, partner.city_state].filter(Boolean).join(", ");
  const subtitle =
    kind === "venue"
      ? partner.type_name ||
        (partner.published_layout_count
          ? `${partner.published_layout_count} published layout${
              partner.published_layout_count === 1 ? "" : "s"
            }`
          : "Registered venue")
      : partner.type_name || "Registered artist";

  const detailLine =
    kind === "artist"
      ? partner.description?.trim() || place || null
      : partner.address?.trim() || place || null;

  const ctaLabel = "View free dates & inquire";

  const card = (
    <div className="group relative w-full h-full min-h-[340px] sm:min-h-[380px] rounded-[1.75rem] overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.14)] bg-[#1a1a1a]">
      {partner.cover_image_url ? (
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
          {kind === "venue" ? (
            <Building2 size={48} strokeWidth={1.4} />
          ) : (
            <Mic2 size={48} strokeWidth={1.4} />
          )}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/90 via-black/55 to-transparent" />

      <div className="absolute top-3 left-3 z-10">
        <span className="inline-flex rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#111111]">
          Registered
        </span>
      </div>

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
      <Link href={`/artists/${partner.id}`} className="block h-full">
        {card}
      </Link>
    );
  }

  if (kind === "venue") {
    return (
      <Link href={`/venues/${partner.id}`} className="block h-full">
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
  showHeader = true,
}: {
  title: string;
  subtitle: string;
  kind: "venue" | "artist";
  partners: PublicRegisteredPartner[];
  isLoading?: boolean;
  emptyMessage?: string;
  showHeader?: boolean;
}) {
  return (
    <section
      id="partners"
      className={`scroll-mt-24 border-t border-[#F3E8FF] ${
        showHeader ? "bg-white py-16 md:py-20" : "bg-[#faf7fc] py-8 md:py-10 border-t-0"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {showHeader ? (
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#111111]">
              {title}
            </h2>
            <p className="mt-4 text-sm md:text-base text-[#5c5c5c] leading-relaxed">{subtitle}</p>
          </div>
        ) : null}

        {isLoading ? (
          <div
            className={`${showHeader ? "mt-12" : ""} grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5`}
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
        ) : partners.length === 0 ? (
          <p className={`${showHeader ? "mt-12" : ""} text-center text-sm text-[#888]`}>
            {emptyMessage || "No registered partners to show yet."}
          </p>
        ) : (
          <div
            className={`${showHeader ? "mt-12" : ""} grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5`}
          >
            {partners.map((p) => (
              <PartnerCard key={p.id} partner={p} kind={kind} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
