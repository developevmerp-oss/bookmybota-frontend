"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Loader2, Search } from "lucide-react";
import {
  useGetPublicRegisteredVenuesQuery,
  type PublicRegisteredPartner,
} from "@/services/api";

const PAGE_BG = "#f5f5f5";

type CinemaCard = {
  id: string;
  name: string;
  address: string;
  href?: string;
};

const SHOWCASE_CINEMAS: CinemaCard[] = [
  {
    id: "c1",
    name: "PVR: Palladium Mall, Addis Ababa",
    address:
      "4th floor, Palladium Mall, Bole Road, Addis Ababa, Ethiopia",
  },
  {
    id: "c2",
    name: "Cinepolis: City Centre, Addis Ababa",
    address: "City Centre Mall, Mexico Square, Addis Ababa, Ethiopia",
  },
  {
    id: "c3",
    name: "Edna Mall Cinema, Addis Ababa",
    address: "Edna Mall, Bole Medhanialem, Addis Ababa, Ethiopia",
  },
  {
    id: "c4",
    name: "Alliance Ethio-Française Cinema",
    address: "Wollo Sefer, Near Mexico, Addis Ababa, Ethiopia",
  },
  {
    id: "c5",
    name: "Century Cinema: Merkato",
    address: "Merkato Complex, Addis Ababa, Ethiopia",
  },
  {
    id: "c6",
    name: "Gas Cinema: CMC",
    address: "CMC Michael, Addis Ababa, Ethiopia",
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
    href: `/venues/${v.id}`,
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
  const content = (
    <div className="flex items-start gap-3">
      <button
        type="button"
        aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={favorited}
        onClick={onToggleFavorite}
        className="mt-0.5 shrink-0 cursor-pointer"
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
      <div className="min-w-0">
        {cinema.href ? (
          <Link href={cinema.href} className="block group">
            <h3 className="text-sm sm:text-base font-bold text-[#111111] leading-snug group-hover:text-[#6900AA] transition-colors">
              {cinema.name}
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
              {cinema.address}
            </p>
          </Link>
        ) : (
          <>
            <h3 className="text-sm sm:text-base font-bold text-[#111111] leading-snug">
              {cinema.name}
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
              {cinema.address}
            </p>
          </>
        )}
      </div>
    </div>
  );

  return (
    <article className="h-full rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow">
      {content}
    </article>
  );
}

export default function CinemaListingPage() {
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);

  const queryArgs = useMemo(
    () => ({
      ...(city ? { city } : {}),
      ...(search.trim() ? { q: search.trim() } : {}),
    }),
    [city, search]
  );

  const { data: venues = [], isLoading } = useGetPublicRegisteredVenuesQuery(queryArgs);

  useEffect(() => {
    const applyCity = () => {
      const params = new URLSearchParams(window.location.search);
      const cityParam = params.get("city");
      const stored = localStorage.getItem("selected_city");
      if (cityParam && cityParam !== "All Cities") setCity(cityParam);
      else if (stored && stored !== "All Cities") setCity(stored);
      else setCity("");
    };
    applyCity();
    window.addEventListener("selected_city_changed", applyCity);
    return () => window.removeEventListener("selected_city_changed", applyCity);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("movie_cinema_favorites");
      setFavorites(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setFavorites([]);
    }
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem("movie_cinema_favorites", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
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
      <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 py-6 sm:py-8 lg:py-10">
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
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Loader2 size={32} className="animate-spin text-[#6900AA]" />
            <p className="text-sm font-medium">Loading cinemas...</p>
          </div>
        ) : cinemas.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-600 font-medium">No cinemas found</p>
            <p className="text-slate-400 text-sm mt-1">Try another search or city.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {cinemas.map((cinema) => (
              <CinemaCardItem
                key={cinema.id}
                cinema={cinema}
                favorited={favorites.includes(cinema.id)}
                onToggleFavorite={() => toggleFavorite(cinema.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
