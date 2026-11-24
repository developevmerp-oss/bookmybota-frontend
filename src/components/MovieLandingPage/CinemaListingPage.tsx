"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpDown, ChevronRight, Heart, Search } from "lucide-react";
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

const PAGE_BG = "#FFFFFF";
const TIP_KEY = "bmb_cinema_favorite_tip_dismissed";

type CinemaCard = {
  id: string;
  name: string;
  address: string;
  href?: string;
  slug?: string;
  cover_image_url?: string;
};

type SortMode = "az" | "za";

const SHOWCASE_CINEMAS: CinemaCard[] = [
  {
    id: "c1",
    name: "PVR: Palladium Mall, Addis Ababa",
    address: "4th floor, Palladium Mall, Bole Road, Addis Ababa, Ethiopia",
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

function CinemaRowItem({ cinema }: { cinema: CinemaCard }) {
  const body = (
    <>
      <div className="min-w-0 flex-1 pr-2">
        <h3 className="text-[15px] sm:text-base font-bold text-[#111111] leading-snug">
          {cinema.name}
        </h3>
        {cinema.address ? (
          <p className="mt-1 text-[13px] sm:text-sm text-[#6B7280] leading-relaxed line-clamp-2">
            {cinema.address}
          </p>
        ) : null}
      </div>
      <ChevronRight
        size={18}
        strokeWidth={2}
        className="shrink-0 text-[#C4C4C4] self-center"
        aria-hidden
      />
    </>
  );

  return (
    <article className="flex items-start gap-3 px-4 sm:px-5 py-4 border-b border-[#EFEFEF] bg-white">
      <div className="pt-0.5 shrink-0">
        <CinemaWishlistButton
          cinemaId={cinema.id}
          iconSize={22}
          unsavedClassName="text-[#9CA3AF] hover:text-[#6900AA]"
          savedClassName="fill-[#6900AA] text-[#6900AA]"
        />
      </div>
      {cinema.href ? (
        <Link
          href={cinema.href}
          className="min-w-0 flex-1 flex items-start gap-2 group"
        >
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="text-[15px] sm:text-base font-bold text-[#111111] leading-snug group-hover:text-[#6900AA] transition-colors">
              {cinema.name}
            </h3>
            {cinema.address ? (
              <p className="mt-1 text-[13px] sm:text-sm text-[#6B7280] leading-relaxed line-clamp-2">
                {cinema.address}
              </p>
            ) : null}
          </div>
          <ChevronRight
            size={18}
            strokeWidth={2}
            className="shrink-0 text-[#C4C4C4] self-center"
            aria-hidden
          />
        </Link>
      ) : (
        <div className="min-w-0 flex-1 flex items-start gap-2">{body}</div>
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
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    const s = (searchParams.get("sort") || "").toLowerCase();
    return s === "desc" || s === "za" ? "za" : "az";
  });
  /** Tip shows by default; never permanently hidden after refresh or revisit. */
  const [tipDismissed, setTipDismissed] = useState(false);

  const serverSort = sortMode === "za" ? "desc" : "asc";

  const queryArgs = useMemo(
    () => ({
      ...(city ? { city } : {}),
      ...(search.trim() ? { q: search.trim() } : {}),
      sort: serverSort as "asc" | "desc",
    }),
    [city, search, serverSort]
  );

  const { data: venues = [], isLoading, isFetching } =
    useGetPublicRegisteredCinemasQuery(queryArgs);

  useEffect(() => {
    // Clear any previous persistent dismissal so the tip is not hidden after refresh or coming back
    try {
      localStorage.removeItem(TIP_KEY);
      sessionStorage.removeItem(TIP_KEY);
      document.cookie = `${TIP_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
    } catch {
      /* ignore */
    }
  }, []);

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
    const sortParam = (searchParams.get("sort") || "").toLowerCase();
    setSearch((prev) => (prev === qFromUrl ? prev : qFromUrl));
    if (cityParam) {
      const nextCity = cityParam === "All Cities" ? "" : cityParam;
      setCity((prev) => (prev === nextCity ? prev : nextCity));
    }
    const nextSort: SortMode =
      sortParam === "desc" || sortParam === "za" ? "za" : "az";
    setSortMode((prev) => (prev === nextSort ? prev : nextSort));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsKey]);

  useEffect(() => {
    const params = new URLSearchParams();
    setOrDeleteParam(params, "q", search.trim());
    setOrDeleteParam(params, "city", city);
    setOrDeleteParam(params, "sort", serverSort === "asc" ? "" : serverSort);
    if (stableSearchParamsString(params) === stableSearchParamsString(searchParams)) return;
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, city, serverSort, pathname, router]);

  const apiCinemas = venues.map(mapVenue);
  /** API order is authoritative; showcase fallback only when API is empty. */
  const cinemas = useMemo(() => {
    if (apiCinemas.length > 0) return apiCinemas;
    const q = search.trim().toLowerCase();
    let list = SHOWCASE_CINEMAS;
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q) ||
          (c.slug || "").toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) =>
      sortMode === "az"
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name)
    );
  }, [apiCinemas, search, sortMode]);

  const cityLabel = (city || "").trim() ? city : "Select City";

  const dismissTip = () => {
    setTipDismissed(true);
  };

  const openCitySelect = () => {
    window.dispatchEvent(new Event("open_city_select"));
  };

  const toggleSort = () => {
    setSortMode((prev) => (prev === "az" ? "za" : "az"));
  };

  return (
    <div className="min-h-screen bg-white pb-[max(4.5rem,env(safe-area-inset-bottom,0px))] lg:pb-8">
      {/* ── Mobile / tablet: sticky Cinema directory chrome ── */}
      <div
        className="lg:hidden sticky top-0 z-40 bg-white border-b border-[#EFEFEF] shadow-sm"
        style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px))" }}
      >
        <div className="flex items-start gap-1 px-2 sm:px-3 pt-2.5 pb-2">
          <button
            type="button"
            onClick={() => router.push("/movies")}
            aria-label="Back to movies"
            className="flex size-10 shrink-0 items-center justify-center text-[#111111] cursor-pointer"
          >
            <ArrowLeft size={22} strokeWidth={2.25} />
          </button>
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="text-[17px] sm:text-lg font-bold text-[#111111] leading-tight">
              Cinema
            </h1>
            <button
              type="button"
              onClick={openCitySelect}
              className="mt-0.5 inline-flex max-w-full items-center gap-0.5 text-[13px] font-medium text-[#6B7280] hover:text-[#6900AA] cursor-pointer"
            >
              <span className="truncate">In {cityLabel}</span>
              <ChevronRight size={14} strokeWidth={2.5} className="shrink-0 opacity-80" />
            </button>
          </div>
          <button
            type="button"
            onClick={toggleSort}
            aria-label={sortMode === "az" ? "Sort Z to A" : "Sort A to Z"}
            className="flex size-10 shrink-0 items-center justify-center text-[#111111] cursor-pointer"
          >
            <ArrowUpDown size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="px-4 sm:px-5 pb-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by cinema or area"
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-[#E5E7EB] bg-[#F7F7F7] text-sm text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:bg-white focus:border-[#6900AA] focus:ring-1 focus:ring-[#6900AA]"
            />
          </div>
        </div>
      </div>

      {/* ── Desktop header ── */}
      <div className="hidden lg:block sticky top-0 z-40 border-b border-[#EFEFEF] bg-white shadow-sm">
        <div className="bmb-section-container py-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#111111]">Cinema</h1>
            <button
              type="button"
              onClick={openCitySelect}
              className="mt-1 inline-flex items-center gap-0.5 text-sm font-medium text-[#6B7280] hover:text-[#6900AA] cursor-pointer"
            >
              In {cityLabel}
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSort}
              className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:border-[#6900AA] cursor-pointer"
            >
              <ArrowUpDown size={16} />
              {sortMode === "az" ? "A–Z" : "Z–A"}
            </button>
            <div className="relative w-[320px]">
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
        </div>
      </div>

      <div className="lg:bmb-section-container lg:py-6" style={{ backgroundColor: PAGE_BG }}>
        {isLoading && apiCinemas.length === 0 ? (
          <div className="px-4 sm:px-5 lg:px-0 py-4">
            <CinemaListShimmer count={6} />
          </div>
        ) : cinemas.length === 0 ? (
          <div className="px-4 sm:px-5 lg:px-0 py-6">
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
          </div>
        ) : (
          <div
            className={`lg:rounded-xl lg:border lg:border-slate-200 lg:overflow-hidden lg:bg-white transition-opacity ${
              isFetching ? "opacity-70" : "opacity-100"
            }`}
          >
            {cinemas.map((cinema) => (
              <CinemaRowItem key={cinema.id} cinema={cinema} />
            ))}
          </div>
        )}
      </div>

      {/* BMS tip — stays visible; not hidden after refresh or coming back to the page */}
      {!tipDismissed ? (
        <div
          className="lg:hidden fixed inset-x-0 z-[55] border-t border-[#E8E8E8] bg-[#F5F5F5]/95 backdrop-blur-md px-4 py-2.5 flex items-center gap-2"
          style={{ bottom: "max(0px, env(safe-area-inset-bottom, 0px))" }}
        >
          <p className="min-w-0 flex-1 text-[12px] sm:text-[13px] text-[#4B5563] leading-snug">
            Favorite cinemas by tapping on the{" "}
            <Heart size={12} className="inline-block align-[-1px] text-[#9CA3AF]" strokeWidth={2} />
          </p>
          <button
            type="button"
            onClick={dismissTip}
            className="shrink-0 text-[13px] font-bold text-[#6900AA] cursor-pointer px-1"
          >
            Got It
          </button>
        </div>
      ) : null}
    </div>
  );
}
