"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import {
  useGetPublicRegisteredCinemasQuery,
  type PublicRegisteredPartner,
} from "@/services/api";
import { cinemaHref } from "@/lib/businessPublicPath";
import {
  setOrDeleteParam,
  stableSearchParamsString,
} from "@/lib/filterUrlSync";
import { CinemaListShimmer } from "@/components/Shared/Shimmer";
import ListingNoResultsState from "@/components/Shared/ListingNoResultsState";
import CinemaWishlistButton from "@/components/MovieLandingPage/CinemaWishlistButton";

const PAGE_BG = "#f5f5f5";

type CinemaCard = {
  id: string;
  name: string;
  address: string;
  href?: string;
  slug?: string;
  cover_image_url?: string;
};

const SHOWCASE_CINEMAS: CinemaCard[] = [
  {
    id: "c1",
    name: "PVR: Palladium Mall, Addis Ababa",
    address:
      "4th floor, Palladium Mall, Bole Road, Addis Ababa, Ethiopia",
    href: cinemaHref({ id: "c1", slug: "pvr-palladium-mall" }),
    slug: "pvr-palladium-mall",
  },
  {
    id: "c2",
    name: "Cinepolis: City Centre, Addis Ababa",
    address: "City Centre Mall, Mexico Square, Addis Ababa, Ethiopia",
    href: cinemaHref({ id: "c2", slug: "cinepolis-city-centre" }),
    slug: "cinepolis-city-centre",
  },
  {
    id: "c3",
    name: "Edna Mall Cinema, Addis Ababa",
    address: "Edna Mall, Bole Medhanialem, Addis Ababa, Ethiopia",
    href: cinemaHref({ id: "c3", slug: "edna-mall-cinema" }),
    slug: "edna-mall-cinema",
  },
];

function mapVenue(v: PublicRegisteredPartner): CinemaCard {
  const locality = (v.address || "").split(",")[0]?.trim();
  const address =
    [locality, v.city_name].filter(Boolean).join(", ") ||
    v.address ||
    v.city_name ||
    "";
  return {
    id: String(v.id),
    name: v.name,
    address,
    href: cinemaHref(v),
    slug: v.slug ?? undefined,
    cover_image_url: v.cover_image_url ?? undefined,
  };
}

function CinemaCardItem({ cinema }: { cinema: CinemaCard }) {
  return (
    <article className="h-full rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3">
      <CinemaWishlistButton cinemaId={cinema.id} />
      {cinema.href ? (
        <Link href={cinema.href} className="min-w-0 flex-1 group block">
          <h3 className="text-sm sm:text-base font-bold text-[#111111] leading-snug group-hover:text-[#6900AA] transition-colors">
            {cinema.name}
          </h3>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
            {cinema.address}
          </p>
        </Link>
      ) : (
        <div className="min-w-0 flex-1">
          <h3 className="text-sm sm:text-base font-bold text-[#111111] leading-snug">
            {cinema.name}
          </h3>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
            {cinema.address}
          </p>
        </div>
      )}
    </article>
  );
}

export default function CinemaListingPage() {
  const router = useRouter();
  const pathname = usePathname() || "/movies/cinemas";
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  const [city, setCity] = useState(() => {
    const cityParam = searchParams.get("city");
    if (cityParam) return cityParam === "All Cities" ? "" : cityParam;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("selected_city");
      return stored && stored !== "All Cities" ? stored : "";
    }
    return "";
  });
  const [search, setSearch] = useState(() => searchParams.get("q") || "");

  const queryArgs = useMemo(
    () => ({
      ...(city ? { city } : {}),
      ...(search.trim() ? { q: search.trim() } : {}),
    }),
    [city, search]
  );

  const { data: venues = [], isLoading } = useGetPublicRegisteredCinemasQuery(queryArgs);

  useEffect(() => {
    const applyCity = () => {
      const stored = localStorage.getItem("selected_city");
      setCity(stored && stored !== "All Cities" ? stored : "");
    };
    window.addEventListener("selected_city_changed", applyCity);
    return () => window.removeEventListener("selected_city_changed", applyCity);
  }, []);

  useEffect(() => {
    const qFromUrl = searchParams.get("q") || "";
    const cityParam = searchParams.get("city");
    setSearch((prev) => (prev === qFromUrl ? prev : qFromUrl));
    if (cityParam) {
      const nextCity = cityParam === "All Cities" ? "" : cityParam;
      setCity((prev) => (prev === nextCity ? prev : nextCity));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsKey]);

  useEffect(() => {
    const params = new URLSearchParams();
    setOrDeleteParam(params, "q", search.trim());
    setOrDeleteParam(params, "city", city);
    if (stableSearchParamsString(params) === stableSearchParamsString(searchParams)) return;
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, city, pathname, router]);

  const apiCinemas = venues.map(mapVenue);
  const source = apiCinemas.length > 0 ? apiCinemas : SHOWCASE_CINEMAS;

  const cinemas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.slug || "").toLowerCase().includes(q)
    );
  }, [source, search]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE_BG }}>
      <div className="bmb-section-container py-5 sm:py-6 lg:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-[#111111]">Cinema In Ethiopia</h1>
          <div className="relative w-full sm:w-[280px] lg:w-[320px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by cinema or area"
              className="w-full h-10 pl-9 pr-3 rounded-md border border-slate-300 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]"
            />
          </div>
        </div>

        {isLoading && apiCinemas.length === 0 ? (
          <CinemaListShimmer count={6} />
        ) : cinemas.length === 0 ? (
          <ListingNoResultsState
            kind="venues"
            title="No cinemas found"
            description={
              search.trim()
                ? `We couldn’t find any cinemas matching “${search.trim()}”. Try another search or city.`
                : "We couldn’t find any cinemas here. Try another search or city."
            }
            actionLabel={search.trim() ? "Clear filters" : undefined}
            onAction={search.trim() ? () => setSearch("") : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {cinemas.map((cinema) => (
              <CinemaCardItem key={cinema.id} cinema={cinema} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
