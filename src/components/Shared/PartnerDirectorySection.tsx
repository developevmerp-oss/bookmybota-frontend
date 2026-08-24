"use client";

import { Building2, MapPin, Mic2 } from "lucide-react";
import type { PublicRegisteredPartner } from "@/services/api";

const BRAND = "#6900AA";
const BRAND_SOFT = "#F7E9FF";
const BRAND_BORDER = "#EFD7FF";

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

  return (
    <div
      className="w-full group bg-white rounded-2xl overflow-hidden border shadow-[0_8px_24px_rgba(105,0,170,0.06)]"
      style={{ borderColor: BRAND_BORDER }}
    >
      <div className="relative aspect-[3/4] overflow-hidden" style={{ backgroundColor: BRAND_SOFT }}>
        {partner.cover_image_url ? (
          <img
            src={partner.cover_image_url}
            alt={partner.name}
            className="w-full h-full object-cover group-hover:scale-[1.05] transition-transform duration-500"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ color: BRAND }}
          >
            {kind === "venue" ? (
              <Building2 size={40} strokeWidth={1.4} />
            ) : (
              <Mic2 size={40} strokeWidth={1.4} />
            )}
          </div>
        )}
        <div
          className="absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
          style={{ color: BRAND }}
        >
          Registered
        </div>
      </div>
      <div className="px-3.5 pt-3.5 pb-4 text-left">
        <h3 className="font-bold text-[#111111] text-[15px] leading-snug line-clamp-2">
          {partner.name}
        </h3>
        {place ? (
          <p className="mt-1.5 text-[12px] text-[#6b7280] flex items-start gap-1 line-clamp-1">
            <MapPin size={12} className="mt-0.5 shrink-0" style={{ color: BRAND }} />
            {place}
          </p>
        ) : null}
        <p className="mt-1 text-[12px] text-[#9ca3af] line-clamp-1">{subtitle}</p>
        {kind === "venue" && partner.address ? (
          <p className="mt-1 text-[11px] text-[#9ca3af] line-clamp-2">{partner.address}</p>
        ) : null}
        {kind === "artist" && partner.description ? (
          <p className="mt-1 text-[11px] text-[#9ca3af] line-clamp-2">{partner.description}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function PartnerDirectorySection({
  title,
  subtitle,
  kind,
  partners,
  isLoading,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  kind: "venue" | "artist";
  partners: PublicRegisteredPartner[];
  isLoading?: boolean;
  emptyMessage?: string;
}) {
  return (
    <section
      id="partners"
      className="bg-white py-16 md:py-20 scroll-mt-24 border-t border-[#F3E8FF]"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#111111]">
            {title}
          </h2>
          <p className="mt-4 text-sm md:text-base text-[#5c5c5c] leading-relaxed">{subtitle}</p>
        </div>

        {isLoading ? (
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden border border-[#F3E8FF] bg-[#faf7fc] animate-pulse"
              >
                <div className="aspect-[3/4] bg-[#EFD7FF]" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-[#EFD7FF] rounded w-3/4" />
                  <div className="h-3 bg-[#F7E9FF] rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : partners.length === 0 ? (
          <p className="mt-12 text-center text-sm text-[#888]">
            {emptyMessage || "No registered partners to show yet."}
          </p>
        ) : (
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
            {partners.map((p) => (
              <PartnerCard key={p.id} partner={p} kind={kind} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
