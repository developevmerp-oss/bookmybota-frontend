"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, Search } from "lucide-react";
import { toast } from "sonner";
import {
  readCinemaFavoriteIds,
  toggleCinemaFavorite,
  isCinemaFavorited,
} from "@/lib/cinemaWishlist";
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
  {
    id: "c4",
    name: "Alliance Ethio-Française Cinema",
    address: "Wollo Sefer, Near Mexico, Addis Ababa, Ethiopia",
    href: cinemaHref({ id: "c4", slug: "alliance-ethio-francaise-cinema" }),
    slug: "alliance-ethio-francaise-cinema",
  },
  {
    id: "c5",
    name: "Century Cinema: Merkato",
    address: "Merkato Complex, Addis Ababa, Ethiopia",
    href: cinemaHref({ id: "c5", slug: "century-cinema-merkato" }),
    slug: "century-cinema-merkato",
  },
  {
    id: "c6",
    name: "Gas Cinema: CMC",
    address: "CMC Michael, Addis Ababa, Ethiopia",
    href: cinemaHref({ id: "c6", slug: "gas-cinema-cmc" }),
    slug: "gas-cinema-cmc",
  },
];

function mapVenue(v: PublicRegisteredPartner): CinemaCard {
  const cityPart = [v.city_name, v.city_state].filter(Boolean).join(", ");
  const address =
    v.address?.trim() ||
    [v.type_name, cityPart].filter(Boolean).join(" · ") ||
    "Address coming soon";
  return {
    id: v.id,
    name: v.name,
    address,
    href: cinemaHref(v),
    slug: v.slug,
    cover_image_url: v.cover_image_url,
  };
}

function CinemaCardItem({
  cinema,
  favorited,
  onToggleFavorite,
}: {
  cinema: CinemaCard;
  favorited: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <article className="h-full rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3">
      <button
        type="button"
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={favorited}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="mt-0.5 shrink-0 cursor-pointer p-1 -m-1 rounded-full hover:bg-slate-100 transition-colors relative z-10"
      >
        <Heart
          size={18}
          className={
            favorited
              ? "fill-[#6900AA] text-[#6900AA]"
              : "text-slate-400 hover:text-[#6900AA]"
          }
        />
      </button>
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
  const [favorites, setFavorites] = useState<string[]>([]);

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

  useEffect(() => {
    const update = () => {
      setFavorites(readCinemaFavoriteIds());
    };
    update();
    window.addEventListener("movie_cinema_favorites_changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("movie_cinema_favorites_changed", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  const toggleFavorite = (cinema: CinemaCard) => {
    const slugKey = cinema.slug || cinema.href?.split("/").pop() || "";
    const legacyKeys = [cinema.id, slugKey, cinema.name].filter(Boolean);
    const { wishlisted, ids } = toggleCinemaFavorite(
      {
        id: cinema.id,
        name: cinema.name,
        address: cinema.address,
        slug: cinema.slug || slugKey,
        cover_image_url: cinema.cover_image_url,
        href: cinema.href,
      },
      legacyKeys
    );
    setFavorites(ids);
    if (wishlisted) {
      toast.success(`Added ${cinema.name || "cinema"} to your favorite cinemas`);
    } else {
      toast.success(`Removed ${cinema.name || "cinema"} from your favorite cinemas`);
    }
  };

  const apiCinemas = venues.map(mapVenue);
  const source = apiCinemas.length > 0 ? apiCinemas : SHOWCASE_CINEMAS;

  const cinemas = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || apiCinemas.length > 0) return source;
    return source.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q)
    );
  }, [source, search, apiCinemas.length]);

  const headingCity = city || "Ethiopia";

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE_BG }}>
      <div className="bmb-section-container py-6 sm:py-8 lg:py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-[1.75rem] font-extrabold text-[#333333]">
            Cinema In {headingCity}
          </h1>
          <div className="relative w-full sm:w-auto sm:min-w-[16rem] lg:min-w-[18rem]">
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
              <CinemaCardItem
                key={cinema.id}
                cinema={cinema}
                favorited={isCinemaFavorited([cinema.id, cinema.slug || "", cinema.name, cinema.href?.split("/").pop() || ""], favorites)}
                onToggleFavorite={() => toggleFavorite(cinema)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
