"use client";

import { useMemo, useState } from "react";
import { Building2, Mic2, Search, X } from "lucide-react";
import {
  useGetPublicRegisteredArtistsQuery,
  useGetPublicRegisteredVenuesQuery,
} from "@/services/api";
import PartnerDirectorySection from "@/components/Shared/PartnerDirectorySection";

const BRAND = "#6900AA";

type PartnerListingKind = "artist" | "venue";

export default function PartnerListingPage({ kind }: { kind: PartnerListingKind }) {
  const [q, setQ] = useState("");
  /** Start with all partners; city is an optional filter (not auto-locked to header city). */
  const [city, setCity] = useState("");

  const queryArgs = useMemo(() => {
    const trimmed = q.trim();
    return {
      ...(trimmed ? { q: trimmed } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
    };
  }, [q, city]);

  const artistsQuery = useGetPublicRegisteredArtistsQuery(queryArgs, {
    skip: kind !== "artist",
  });
  const venuesQuery = useGetPublicRegisteredVenuesQuery(queryArgs, {
    skip: kind !== "venue",
  });

  const { data: partners = [], isLoading } = kind === "artist" ? artistsQuery : venuesQuery;

  const title = kind === "artist" ? "Artists" : "Venues";
  const subtitle =
    kind === "artist"
      ? "Browse all registered artists and send a booking inquiry."
      : "Browse all registered venues, check free dates, and send a booking inquiry.";
  const searchPlaceholder =
    kind === "artist" ? "Search artists by name or type…" : "Search venues by name or type…";
  const Icon = kind === "artist" ? Mic2 : Building2;

  return (
    <div className="min-h-screen bg-[#faf7fc]">
      <div className="bg-white border-b border-[#F3E8FF]">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <span
                className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-xl text-white shrink-0"
                style={{ backgroundColor: BRAND }}
              >
                <Icon size={22} />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#111111]">
                  {title}
                </h1>
                <p className="mt-1.5 text-sm sm:text-base text-[#5c5c5c] max-w-2xl">{subtitle}</p>
                {!isLoading ? (
                  <p className="mt-2 text-xs font-semibold text-[#6900AA]">
                    {partners.length} registered {kind === "artist" ? "artist" : "venue"}
                    {partners.length === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#6900AA]/40"
              />
            </div>
            <div className="relative sm:w-56">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Filter by city (optional)"
                className="w-full h-11 px-4 pr-9 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#6900AA]/40"
              />
              {city.trim() ? (
                <button
                  type="button"
                  onClick={() => setCity("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700"
                  aria-label="Clear city filter"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <PartnerDirectorySection
          title={kind === "artist" ? "All artists" : "All venues"}
          subtitle=""
          kind={kind}
          partners={partners}
          isLoading={isLoading}
          showHeader={false}
          emptyMessage={
            q.trim() || city.trim()
              ? `No ${kind === "artist" ? "artists" : "venues"} match your search.`
              : `No registered ${kind === "artist" ? "artists" : "venues"} yet.`
          }
        />
    </div>
  );
}
