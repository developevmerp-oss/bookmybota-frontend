"use client";

import { useMemo, useState } from "react";
import { Building2, Mic2, Search } from "lucide-react";
import {
  useGetPublicRegisteredArtistsQuery,
  useGetPublicRegisteredVenuesQuery,
} from "@/services/api";
import PartnerDirectorySection from "@/components/Shared/PartnerDirectorySection";

const BRAND = "#6900AA";

type PartnerListingKind = "artist" | "venue";

export default function PartnerListingPage({ kind }: { kind: PartnerListingKind }) {
  const [q, setQ] = useState("");
  const [city, setCity] = useState(() => {
    if (typeof window === "undefined") return "";
    const stored = localStorage.getItem("selected_city");
    return stored && stored !== "All Cities" ? stored : "";
  });

  const queryArgs = useMemo(() => {
    const trimmed = q.trim();
    return {
      ...(trimmed ? { q: trimmed } : {}),
      ...(city ? { city } : {}),
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
      ? "Browse registered artists, check free dates, and send a booking inquiry."
      : "Browse registered venues, check free dates, and send a booking inquiry.";
  const searchPlaceholder =
    kind === "artist" ? "Search artists by name or type…" : "Search venues by name or type…";
  const Icon = kind === "artist" ? Mic2 : Building2;

  return (
    <div className="min-h-screen bg-[#faf7fc]">
      <div className="bg-white border-b border-[#F3E8FF]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex items-start gap-3">
            <span
              className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shrink-0"
              style={{ backgroundColor: BRAND }}
            >
              <Icon size={20} />
            </span>
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111111]">
                {title}
              </h1>
              <p className="mt-2 text-sm sm:text-base text-[#5c5c5c] max-w-2xl">{subtitle}</p>
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
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Filter by city (optional)"
              className="sm:w-56 h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#6900AA]/40"
            />
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
          q.trim() || city
            ? `No ${kind === "artist" ? "artists" : "venues"} match your search.`
            : `No registered ${kind === "artist" ? "artists" : "venues"} yet.`
        }
      />
    </div>
  );
}
