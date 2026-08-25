"use client";

import { useRef } from "react";
import Link from "next/link";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { useGetPublicRegisteredVenuesQuery, type PublicRegisteredPartner } from "@/services/api";
import "./TopArtistsRail.css";

const VISIBLE = 6;

function VenueCard({ venue }: { venue: PublicRegisteredPartner }) {
  const role = venue.type_name || "Venue";
  const place = [venue.city_name, venue.city_state].filter(Boolean).join(", ");

  return (
    <Link
      href={`/venues/${venue.id}`}
      className="top-artists-slot top-artists-slot-link"
      title={`View ${venue.name} availability and send an inquiry`}
    >
      <div className="top-artists-avatar">
        <div className="top-artists-avatar-inner">
          {venue.cover_image_url ? (
            <img
              src={venue.cover_image_url}
              alt={venue.name}
              className="w-full h-full object-cover"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#F7E9FF] text-[#6900AA]">
              <Building2 size={32} strokeWidth={1.4} />
            </div>
          )}
        </div>
      </div>
      <p className="top-artists-name">{venue.name}</p>
      <p className="top-artists-role">{place ? `${role} · ${place}` : role}</p>
    </Link>
  );
}

export default function TopVenuesRail() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { data: venues = [], isLoading } = useGetPublicRegisteredVenuesQuery();

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.7, 280), behavior: "smooth" });
  };

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="type-section font-semibold tracking-tight text-[#111111]">Top Venues</h2>
          <Link
            href="/venues"
            className="shrink-0 type-link font-medium text-[#6900AA] hover:text-[#57008E]"
          >
            See All ›
          </Link>
        </div>

        {isLoading ? (
          <div className="flex gap-4 overflow-hidden py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center w-[6.75rem] sm:w-[7.75rem] shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#F7E9FF] animate-pulse" />
                <div className="mt-3 h-3 w-16 bg-slate-100 rounded animate-pulse" />
                <div className="mt-2 h-2.5 w-12 bg-slate-50 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : venues.length === 0 ? (
          <p className="text-sm text-[#6b6b6b] py-6">
            No registered venues yet. After venues are approved, they will appear here with free
            dates you can inquire about.
          </p>
        ) : (
          <div className="relative">
            {venues.length > 5 ? (
              <button
                type="button"
                aria-label="Previous venues"
                onClick={() => scrollBy(-1)}
                className="flex absolute left-0 md:-left-2 lg:-left-3 top-[36%] -translate-y-1/2 z-10 w-8 h-8 md:w-9 md:h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
              >
                <ChevronLeft size={18} />
              </button>
            ) : null}

            <div
              ref={scrollerRef}
              className="top-artists-rail"
              style={{ ["--artists-visible" as string]: VISIBLE }}
            >
              {venues.map((venue) => (
                <VenueCard key={venue.id} venue={venue} />
              ))}
            </div>

            {venues.length > 5 ? (
              <button
                type="button"
                aria-label="Next venues"
                onClick={() => scrollBy(1)}
                className="flex absolute right-0 md:-right-2 lg:-right-3 top-[36%] -translate-y-1/2 z-10 w-8 h-8 md:w-9 md:h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
              >
                <ChevronRight size={18} />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
