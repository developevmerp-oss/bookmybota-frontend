"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search,
  MapPin,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Navigation,
  Loader2,
  X,
  Percent,
  Tag,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { Playfair_Display } from "next/font/google";
import type { IconType } from "react-icons";
import { IoRestaurantOutline } from "react-icons/io5";
import { HiOutlineMicrophone } from "react-icons/hi";
import {
  MdOutlineBakeryDining,
  MdOutlineBrunchDining,
  MdOutlineCelebration,
  MdOutlineDeck,
  MdOutlineDinnerDining,
  MdOutlineEvent,
  MdOutlineFamilyRestroom,
  MdOutlineHotel,
  MdOutlineLocalCafe,
  MdOutlineLocalPizza,
  MdOutlineMusicNote,
  MdOutlineNightlife,
  MdOutlineOutdoorGrill,
  MdOutlineRestaurant,
  MdOutlineSpa,
  MdOutlineSportsBar,
  MdOutlineSportsSoccer,
  MdOutlineTheaterComedy,
  MdOutlineTheaters,
  MdOutlineWineBar,
} from "react-icons/md";
import { useGetBusinessTypesQuery, useGetBusinessesQuery, useGetCollectionsQuery, useGetMoodsQuery, Business, Collection, Mood } from "@/services/api";
import { useRouter } from "next/navigation";
import DiningFiltersBar from "@/components/DinningLandingPage/DiningFiltersBar";
import { formatMoney } from "@/lib/currencyFormat";
import { useAppSelector } from "@/lib/hooks";
import {
  applyDiningFilters,
  DEFAULT_DINING_FILTERS,
  DiningFilterState,
  extractCuisines,
} from "@/lib/diningFilters";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const HERO_ACCENT = "#E85D04";

type MealOccasion = "lunch" | "breakfast" | "dinner" | "fastfood";

const MEAL_OCCASIONS: {
  id: MealOccasion;
  label: string;
  image: string;
}[] = [
  { id: "fastfood", label: "Fast Food", image: "/images/dining/fastfood.png" },
  { id: "breakfast", label: "Breakfast", image: "/images/dining/breakfast.png" },
  { id: "dinner", label: "Dinner", image: "/images/dining/dinner.png" },
  { id: "lunch", label: "Lunch", image: "/images/dining/lunch.png" },
];

const PROMO_SLIDES = [
  { src: "/images/dining/promo-rakhi.png", alt: "Rakhi Special Celebrations" },
  { src: "/images/dining/promo-cafe.png", alt: "Good Food. Great Moments." },
];

const DINING_OFFER_CARDS = [
  {
    id: "weekend",
    bg: "#FDE8D8",
    text: "#7A2E08",
    accent: "#E85D04",
    pattern: "bolts",
    badge: "Weekend Special",
    title: "Save up to 30% Off",
    subtitle: "on table bookings at selected venues",
    cta: "Explore Offers",
    images: [
      "/images/dining/lunch.png",
      "/images/dining/dinner.png",
      "/images/dining/breakfast.png",
    ],
  },
  {
    id: "flat20",
    bg: "#E4F3EA",
    text: "#1F6B4A",
    accent: "#1F6B4A",
    pattern: "burst",
    badge: "Limited Offer",
    title: "Flat 20% OFF",
    subtitle: "Up to ₹200 on dining bookings",
    cta: "View Offers",
    images: [
      "/images/dining/fastfood.png",
      "/images/dining/breakfast.png",
      "/images/dining/lunch.png",
    ],
  },
  {
    id: "prime",
    bg: "#EEE8F8",
    text: "#5B3A8C",
    accent: "#5B3A8C",
    pattern: "arcs",
    badge: "BookMyBota Prime",
    title: "Special Offers",
    subtitle: "Exclusive deals at premium restaurants",
    cta: "Grab Deal",
    images: [
      "/images/dining/dinner.png",
      "/images/dining/fastfood.png",
      "/images/dining/breakfast.png",
    ],
  },
] as const;

function timeToMinutes(value?: string): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function hoursOverlapWindow(
  hours: Business["operating_hours"],
  startMin: number,
  endMin: number
): boolean {
  if (!hours) return true;
  const days = Object.values(hours);
  if (days.length === 0) return true;
  return days.some((day) => {
    if (!day || day.closed) return false;
    const open = timeToMinutes(day.open);
    const close = timeToMinutes(day.close);
    if (open == null || close == null) return true;
    return open < endMin && close > startMin;
  });
}

function matchesMealOccasion(business: Business, meal: MealOccasion | ""): boolean {
  if (!meal) return true;
  const hay = `${business.name} ${business.cuisine || ""} ${business.type_name || ""} ${business.description || ""}`.toLowerCase();
  if (meal === "fastfood") {
    return /fast\s*food|burger|pizza|fried|snack|quick bite|street food/.test(hay);
  }
  if (meal === "breakfast") return hoursOverlapWindow(business.operating_hours, 6 * 60, 11 * 60);
  if (meal === "lunch") return hoursOverlapWindow(business.operating_hours, 11 * 60, 16 * 60);
  if (meal === "dinner") return hoursOverlapWindow(business.operating_hours, 17 * 60, 23 * 60);
  return true;
}

const EXPLORE_CUISINES = [
  {
    name: "Indian",
    tags: "Spicy • Rich • Flavorful",
    image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=300&q=80",
    accent: "#E07A3A",
    blob: "#FDE8D8",
    icon: "taj",
  },
  {
    name: "Italian",
    tags: "Classic • Fresh • Comforting",
    image: "https://images.unsplash.com/photo-1551183053-bf7f1ea6a82a?w=400&q=80",
    accent: "#5A9A6A",
    blob: "#E4F3E6",
    icon: "colosseum",
  },
  {
    name: "Chinese",
    tags: "Bold • Savory • Aromatic",
    image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=300&q=80",
    accent: "#D97A8C",
    blob: "#FBE4EA",
    icon: "takeout",
  },
  {
    name: "Continental",
    tags: "Global • Delicious • Modern",
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=300&q=80",
    accent: "#8B7AC8",
    blob: "#EEE8F8",
    icon: "cloche",
  },
  {
    name: "Mexican",
    tags: "Vibrant • Zesty • Bold",
    image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=300&q=80",
    accent: "#6AA86A",
    blob: "#D8F3E8",
    icon: "cactus",
  },
  {
    name: "Thai",
    tags: "Aromatic • Spicy • Fresh",
    image: "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=300&q=80",
    accent: "#C9A227",
    blob: "#F8EFD0",
    icon: "temple",
  },
  {
    name: "Japanese",
    tags: "Light • Fresh • Balanced",
    image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300&q=80",
    accent: "#5B8FD4",
    blob: "#E4EEF8",
    icon: "torii",
  },
  {
    name: "Middle Eastern",
    tags: "Warm • Rich • Authentic",
    image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&q=80",
    accent: "#C4A06A",
    blob: "#F3E9D8",
    icon: "lantern",
  },
] as const;

function getDiningTypeVisual(label: string): {
  Icon: IconType;
  bg: string;
  accent: string;
} {
  const lower = label.trim().toLowerCase();

  let Icon: IconType = MdOutlineRestaurant;
  if (lower === "all" || lower.includes("all dining")) Icon = MdOutlineDinnerDining;
  else if (lower.includes("comedy") || lower.includes("stand up") || lower.includes("stand-up")) Icon = MdOutlineTheaterComedy;
  else if (lower.includes("concert") || lower.includes("live show") || lower.includes("gig")) Icon = HiOutlineMicrophone;
  else if (lower.includes("music") || lower.includes("dj") || lower.includes("band")) Icon = MdOutlineMusicNote;
  else if (lower.includes("theatre") || lower.includes("theater") || lower.includes("drama")) Icon = MdOutlineTheaters;
  else if (lower.includes("party") || lower.includes("celebration")) Icon = MdOutlineCelebration;
  else if (lower.includes("sport")) Icon = MdOutlineSportsSoccer;
  else if (lower.includes("spa") || lower.includes("wellness")) Icon = MdOutlineSpa;
  else if (lower.includes("hotel") || lower.includes("stay")) Icon = MdOutlineHotel;
  else if (lower.includes("pizza")) Icon = MdOutlineLocalPizza;
  else if (lower.includes("nightclub") || lower.includes("nightlife")) Icon = MdOutlineNightlife;
  else if (lower.includes("event")) Icon = MdOutlineEvent;
  else if (lower.includes("grill")) Icon = MdOutlineOutdoorGrill;
  else if (lower === "bar") Icon = MdOutlineSportsBar;
  else if (lower.includes("pub")) Icon = MdOutlineWineBar;
  else if (lower.includes("lounge") || lower.includes("club")) Icon = MdOutlineNightlife;
  else if (lower.includes("cafe") || lower.includes("coffee")) Icon = MdOutlineLocalCafe;
  else if (lower.includes("fine")) Icon = MdOutlineBrunchDining;
  else if (lower.includes("general")) Icon = IoRestaurantOutline;
  else if (lower.includes("dessert") || lower.includes("sweet") || lower.includes("bakery")) Icon = MdOutlineBakeryDining;
  else if (lower.includes("family")) Icon = MdOutlineFamilyRestroom;
  else if (lower.includes("rooftop") || lower.includes("outdoor")) Icon = MdOutlineDeck;
  else if (lower.includes("karaoke") || lower.includes("open mic")) Icon = HiOutlineMicrophone;
  else if (lower.includes("bar")) Icon = MdOutlineSportsBar;
  else if (lower.includes("restaurant") || lower.includes("dining")) Icon = MdOutlineRestaurant;

  return { Icon, bg: "rgba(232,93,4,0.12)", accent: HERO_ACCENT };
}

function CuisineLandmarkIcon({
  type,
  color,
}: {
  type: string;
  color: string;
}) {
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (type === "taj") {
    return (
      <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" aria-hidden>
        <path {...common} d="M12 3.2c0 1.4-.9 2.4-2 2.8" />
        <circle cx="12" cy="2.6" r="0.7" fill={color} stroke="none" />
        <path {...common} d="M12 6.2v2.2M7 10.2c1.4-1.8 3-2.6 5-2.6s3.6.8 5 2.6" />
        <path {...common} d="M6.2 10.2h11.6v8.6H6.2z" />
        <path {...common} d="M10.2 18.8v-3.2a1.8 1.8 0 0 1 3.6 0v3.2" />
        <path {...common} d="M4.4 18.8h15.2M4.8 10.2v-1.4M19.2 10.2V8.8" />
        <circle cx="4.8" cy="6.8" r="0.5" fill={color} stroke="none" />
        <circle cx="19.2" cy="6.8" r="0.5" fill={color} stroke="none" />
      </svg>
    );
  }
  if (type === "colosseum") {
    return (
      <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" aria-hidden>
        <ellipse {...common} cx="12" cy="8" rx="7.2" ry="3.2" />
        <path {...common} d="M4.8 8v7.2c0 1.8 3.2 3.2 7.2 3.2s7.2-1.4 7.2-3.2V8" />
        <path {...common} d="M4.8 11.4c1.6 1.1 4.2 1.8 7.2 1.8s5.6-.7 7.2-1.8" />
        <path {...common} d="M8.2 8v10.2M12 8v11.2M15.8 8v10.2" />
      </svg>
    );
  }
  if (type === "takeout") {
    return (
      <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" aria-hidden>
        <path {...common} d="M7 9.2h10l-1.1 9.2H8.1z" />
        <path {...common} d="M6.4 9.2h11.2l-1.4-2.4H7.8z" />
        <path {...common} d="M9 6.8 7.4 3.8M15 6.8l1.6-3M10.6 6.8 9.6 4.2M13.4 6.8l1-2.6" />
      </svg>
    );
  }
  if (type === "cloche") {
    return (
      <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" aria-hidden>
        <path {...common} d="M5 16.6c0-4.4 3.1-8 7-8s7 3.6 7 8" />
        <path {...common} d="M4.2 16.6h15.6M6 19h12" />
        <circle cx="12" cy="7.4" r="1" {...common} />
      </svg>
    );
  }
  if (type === "cactus") {
    return (
      <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" aria-hidden>
        <path {...common} d="M12 20.2V7.4a2.4 2.4 0 0 1 4.8 0v3.2" />
        <path {...common} d="M12 12.4H8.4a2 2 0 0 1 0-4" />
        <path {...common} d="M9.4 20.2h5.2" />
      </svg>
    );
  }
  if (type === "temple") {
    return (
      <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" aria-hidden>
        <path {...common} d="M12 3.4 6.4 8.2h11.2z" />
        <path {...common} d="M8.2 8.2 5.6 11h12.8L15.8 8.2" />
        <path {...common} d="M7.2 11v7.4h9.6V11" />
        <path {...common} d="M5.2 18.4h13.6M12 3.4v-1" />
        <path {...common} d="M10.4 18.4v-3.2h3.2v3.2" />
      </svg>
    );
  }
  if (type === "torii") {
    return (
      <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" aria-hidden>
        <path {...common} d="M4.6 6.2h14.8" />
        <path {...common} d="M5.6 9h12.8" />
        <path {...common} d="M7.4 6.2v13.2M16.6 6.2v13.2" />
        <path {...common} d="M4.2 5.4c2.4.8 5.1 1.2 7.8 1.2s5.4-.4 7.8-1.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-[70%] h-[70%]" aria-hidden>
      <path {...common} d="M8.2 9.2c0-2.4 1.7-4.4 3.8-4.4s3.8 2 3.8 4.4v7.2c0 1.5-1.7 2.6-3.8 2.6s-3.8-1.1-3.8-2.6z" />
      <path {...common} d="M8.2 11.4h7.6M8.2 14.4h7.6" />
      <path {...common} d="M12 4.8V3.4" />
    </svg>
  );
}

const CUISINE_THEME_FALLBACKS = [
  { accent: "#E07A3A", blob: "#FDE8D8", icon: "taj" },
  { accent: "#5A9A6A", blob: "#E4F3E6", icon: "colosseum" },
  { accent: "#D97A8C", blob: "#FBE4EA", icon: "takeout" },
  { accent: "#8B7AC8", blob: "#EEE8F8", icon: "cloche" },
] as const;

const CUISINE_IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=400&q=80";

const CARD_COLOR_PALETTE = [
  { blob: "#F8D4BC", accent: "#E07A3A" },
  { blob: "#C5E8CE", accent: "#4F9A62" },
  { blob: "#F5C9D6", accent: "#D97A8C" },
  { blob: "#D4C8F0", accent: "#8B7AC8" },
  { blob: "#BFE8DC", accent: "#3D9A84" },
  { blob: "#F0E0A0", accent: "#C9A227" },
  { blob: "#BFD8F4", accent: "#5B8FD4" },
  { blob: "#E5CFAF", accent: "#C4A06A" },
] as const;

function assignCardColors(count: number) {
  const assigned: (typeof CARD_COLOR_PALETTE)[number][] = [];
  for (let i = 0; i < count; i += 1) {
    const forbidden = new Set<string>();
    if (i > 0) forbidden.add(assigned[i - 1].blob);
    if (i >= 2) forbidden.add(assigned[i - 2].blob);
    if (i >= 4) forbidden.add(assigned[i - 4].blob);
    const next =
      CARD_COLOR_PALETTE.find((c) => !forbidden.has(c.blob)) ||
      CARD_COLOR_PALETTE[i % CARD_COLOR_PALETTE.length];
    assigned.push(next);
  }
  return assigned;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    city?: string;
    town?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

// Nominatim requires a User-Agent — without it requests silently fail (returns error JSON with no address)
const NOMINATIM_HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "BookMyBotaApp/1.0 (table-booking-app)",
};

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
    { headers: NOMINATIM_HEADERS }
  );
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  const addr = data?.address;
  const city = addr?.city || addr?.town || addr?.county || addr?.suburb || addr?.state;
  if (!city) throw new Error("No city in response");
  return city;
}

// IP-based geolocation fallback — works without GPS permission, always returns city name
async function getLocationByIP(): Promise<string> {
  const res = await fetch("https://ipapi.co/json/", {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error("IP geolocation failed");
  const data = await res.json();
  return data?.city || data?.region || "Your Location";
}

async function searchLocations(query: string): Promise<NominatimResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
    { headers: NOMINATIM_HEADERS }
  );
  if (!res.ok) return [];
  return res.json();
}


// ─── Sub-components ───────────────────────────────────────────────────────────

function RestaurantCard({ restaurant }: { restaurant: Business }) {
  const getFallbackImageForType = (type?: string) => {
    const lower = type?.toLowerCase() || "";
    if (lower.includes("cafe")) return "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=500&q=80";
    if (lower.includes("bar") || lower.includes("pub")) return "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=500&q=80";
    return "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
  };

  const imageSrc = restaurant.cover_image_url || getFallbackImageForType(restaurant.type_name);
  const rating = Number(restaurant.rating || 4.2).toFixed(1);
  const cuisine = restaurant.cuisine || "Italian, Chinese, Continental";
  
  const getLocality = (addr: string) => {
    const parts = addr.split(",");
    if (parts.length >= 2) {
      return `${parts[0].trim()}, ${parts[1].trim()}`;
    }
    return addr;
  };

  const idHash = typeof restaurant.id === 'number' 
    ? restaurant.id 
    : (restaurant.id ? restaurant.id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0);

  const getPriceForTwo = (id: number) => {
    const bases = [1200, 1500, 2000, 2400, 1800];
    return `${formatMoney(bases[id % bases.length], { compact: true })} for two`;
  };

  const getDistance = (id: number) => {
    const dists = [4.9, 3.5, 5.0, 2.8, 6.2];
    return `${dists[id % dists.length]} km`;
  };

  const isPromoted = !!restaurant.is_promoted;
  const hasDiscount = idHash % 3 === 0 || idHash % 5 === 0;

  return (
    <Link
      href={`/restaurant/${restaurant.id}`}
      className="group block bg-white hover:shadow-xl rounded-2xl p-3 transition-all duration-300 hover:-translate-y-1.5 border border-slate-100/80"
    >
      <div className="relative h-56 rounded-xl overflow-hidden bg-slate-100 mb-3.5">
        <img
          src={imageSrc}
          alt={restaurant.name}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        
        {isPromoted && (
          <span className="absolute top-3 left-3 bg-black/40 backdrop-blur-[2px] text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-sm">
            Promoted
          </span>
        )}

        {hasDiscount && (
          <div
            className="absolute bottom-3 left-0 text-white text-[11px] font-bold px-2.5 py-1 rounded-r-md flex items-center gap-1 shadow-md"
            style={{ backgroundColor: HERO_ACCENT, boxShadow: "0 6px 14px rgba(232,93,4,0.28)" }}
          >
            <Percent size={11} className="text-white shrink-0" />
            <span>Flat 10% OFF</span>
          </div>
        )}
      </div>

      <div className="px-1 pb-1">
        <div className="flex justify-between items-start gap-2 mb-1.5">
          <h3 className="font-bold text-slate-800 text-[16px] leading-tight truncate flex-1 group-hover:text-rose-600 transition-colors">
            {restaurant.name}
          </h3>
          <div className="shrink-0 flex items-center gap-0.5 bg-emerald-700 text-white text-[11px] font-black px-1.5 py-0.5 rounded-md shadow-sm">
            <span>{rating}</span>
            <span className="text-[9px]">★</span>
          </div>
        </div>

        <div className="flex justify-between items-center gap-4 mb-1 text-[13px] text-slate-500">
          <span className="truncate flex-1 font-medium">{cuisine}</span>
          <span className="shrink-0 whitespace-nowrap font-medium text-slate-650">
            {getPriceForTwo(idHash)}
          </span>
        </div>

        <div className="flex justify-between items-center gap-4 text-xs text-slate-400">
          <span className="truncate flex-1 font-medium">{getLocality(restaurant.address)}</span>
          <span className="shrink-0 whitespace-nowrap font-medium">{getDistance(idHash)}</span>
        </div>
      </div>
    </Link>
  );
}

function CollectionCard({ collection }: { collection: Collection }) {
  const subtitle = collection.places_count !== undefined 
    ? `${collection.places_count} place${collection.places_count !== 1 ? 's' : ''}`
    : collection.subtitle || "0 places";

  return (
    <Link
      href={`/search?collection=${collection.slug}`}
      className="relative shrink-0 w-48 h-56 rounded-2xl overflow-hidden cursor-pointer group shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 block"
    >
      <img
        src={collection.image_url || "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80"}
        alt={collection.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
        }}
      />
      <div className={`absolute inset-0 bg-gradient-to-t ${collection.color_gradient || 'from-rose-900/80'} to-transparent`} />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-white font-bold text-base leading-tight">{collection.title}</h3>
        <p className="text-white/70 text-xs mt-1">{subtitle}</p>
      </div>
    </Link>
  );
}

// ─── Location Dropdown ────────────────────────────────────────────────────────

interface LocationDropdownProps {
  onSelect: (city: string) => void;
  onDetect: () => void;
  detecting: boolean;
  onClose: () => void;
}

function LocationDropdown({ onSelect, onDetect, detecting, onClose }: LocationDropdownProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchLocations(val);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const extractCity = (result: NominatimResult) => {
    const addr = result.address;
    return addr.city || addr.town || addr.county || addr.state || result.display_name.split(",")[0];
  };

  return (
    <div className="absolute top-full left-0 mt-2 w-full md:w-[420px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
      {/* Use Current Location */}
      <button
        onClick={onDetect}
        disabled={detecting}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-rose-50 transition-colors text-left border-b border-slate-100 group disabled:opacity-60"
      >
        <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0 group-hover:bg-rose-200 transition-colors">
          {detecting ? (
            <Loader2 size={16} className="text-rose-600 animate-spin" />
          ) : (
            <Navigation size={16} className="text-rose-600" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {detecting ? "Detecting your location..." : "Use My Current Location"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Auto-detect via GPS</p>
        </div>
      </button>

      {/* Search Input */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search city or area..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          {searching && <Loader2 size={14} className="text-slate-400 animate-spin shrink-0" />}
          {query && !searching && (
            <button onClick={() => { setQuery(""); setSuggestions([]); }} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions */}
      <div className="max-h-60 overflow-y-auto">
        {suggestions.length > 0 ? (
          suggestions.map((s) => (
            <button
              key={s.place_id}
              onClick={() => { onSelect(extractCity(s)); onClose(); }}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors text-left"
            >
              <MapPin size={14} className="text-rose-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-800">{extractCity(s)}</p>
                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{s.display_name}</p>
              </div>
            </button>
          ))
        ) : query && !searching ? (
          <div className="px-5 py-6 text-center text-sm text-slate-400">No locations found</div>
        ) : !query ? (
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Popular Cities</p>
            {["Mumbai", "Delhi", "Bengaluru", "Ahmedabad", "Pune", "Hyderabad"].map((city) => (
              <button
                key={city}
                onClick={() => { onSelect(city); onClose(); }}
                className="w-full flex items-center gap-3 py-2.5 hover:text-rose-600 transition-colors text-left"
              >
                <MapPin size={13} className="text-slate-300 shrink-0" />
                <span className="text-sm text-slate-600">{city}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [diningFilters, setDiningFilters] = useState<DiningFilterState>(DEFAULT_DINING_FILTERS);
  const [mealOccasion, setMealOccasion] = useState<MealOccasion | "">("");
  const authUser = useAppSelector((state) => state.auth.user);
  const foodieName = authUser?.name?.trim().split(/\s+/)[0] || "Foodie";
  const [promoIndex, setPromoIndex] = useState(0);
  const [offerSlide, setOfferSlide] = useState(0);
  const [offerImageIndex, setOfferImageIndex] = useState([0, 0, 0]);

  const collectionsRef = useRef<HTMLDivElement>(null);
  const cuisinesRef = useRef<HTMLDivElement>(null);

  const scrollCollections = (direction: 'left' | 'right') => {
    if (collectionsRef.current) {
      const cardWidth = 192; // w-48 = 192px
      const gap = 16; // gap-4 = 16px
      const scrollAmount = cardWidth + gap;
      collectionsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollCuisines = (direction: "left" | "right") => {
    if (!cuisinesRef.current) return;
    const amount = Math.max(cuisinesRef.current.clientWidth * 0.7, 160);
    cuisinesRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const handleSearchSubmit = () => {
    setSearchQuery(searchInput);
  };

  const handleMoodSelect = (query: string) => {
    const params = new URLSearchParams();
    params.set("mood", query);
    if (locationCity) {
      params.set("city", locationCity);
    }
    router.push(`/search?${params.toString()}`);
  };

  const handleCuisineSelect = (cuisine: string) => {
    setDiningFilters((prev) => ({ ...prev, cuisine }));
    document.getElementById("restaurant-listings")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleExploreRestaurants = () => {
    setDiningFilters(DEFAULT_DINING_FILTERS);
    document.getElementById("restaurant-listings")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  // Read initial search/filter/city from URL query params.
  // Default to All Cities so Dining always shows the full discovery UI
  // (landing page city like Bahir Dar must not hide all restaurants).
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const filterParam = params.get('filter');
      const cityParam = params.get('city');
      const searchParam = params.get('search');

      if (filterParam) {
        setActiveFilter(filterParam);
      }
      if (cityParam && cityParam !== "All Cities") {
        setLocationCity(cityParam);
        setLocationLabel(cityParam);
        localStorage.setItem('selected_city', cityParam);
        window.dispatchEvent(new Event('selected_city_changed'));
      } else {
        setLocationCity("");
        setLocationLabel("All Cities");
        localStorage.removeItem('selected_city');
        window.dispatchEvent(new Event('selected_city_changed'));
      }
      if (searchParam) {
        setSearchQuery(searchParam);
        setSearchInput(searchParam);
      }
    }
  }, []);

  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const { data: businesses = [], isLoading: businessesLoading } = useGetBusinessesQuery();
  const { data: collections = [] } = useGetCollectionsQuery();
  const { data: moods = [] } = useGetMoodsQuery();

  const getEmojiForBusinessType = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("restaurant")) return "🍽️";
    if (lower.includes("cafe")) return "☕";
    if (lower.includes("bar") || lower.includes("pub") || lower.includes("lounge") || lower.includes("club")) return "🍺";
    return "🍽️";
  };

  const filters = [
    { label: "All", emoji: "🍽️" },
    ...(businessTypes.length > 0
      ? businessTypes.map((t) => ({
        label: t.name,
        emoji: getEmojiForBusinessType(t.name),
      }))
      : [
        { label: "Restaurant", emoji: "🍽️" },
        { label: "Cafe", emoji: "☕" },
        { label: "Bar", emoji: "🍺" },
      ]),
  ];

  // ── Location state ──
  const [locationLabel, setLocationLabel] = useState("All Cities");
  const [locationCity, setLocationCity] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);

  // ── Auto-detect on mount ──
  const detectCurrentLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(false);
    setLocationLabel("Detecting...");

    // Helper to apply result to state
    const applyCity = (city: string) => {
      setLocationLabel(city);
      setLocationCity(city);
      setLocationError(false);
      localStorage.setItem('selected_city', city);
      window.dispatchEvent(new Event('selected_city_changed'));
    };

    // If browser doesn't support geolocation → fall back to IP immediately
    if (!navigator.geolocation) {
      try {
        const city = await getLocationByIP();
        applyCity(city);
      } catch {
        setLocationLabel("Select Location");
        setLocationError(true);
      } finally {
        setLocationLoading(false);
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        // GPS success → reverse geocode with Nominatim
        try {
          const city = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          applyCity(city);
        } catch {
          // Nominatim failed → fall back to IP geolocation
          try {
            const city = await getLocationByIP();
            applyCity(city);
          } catch {
            setLocationLabel("Select Location");
            setLocationError(true);
          }
        } finally {
          setLocationLoading(false);
        }
      },
      async () => {
        // GPS denied → fall back to IP geolocation silently
        try {
          const city = await getLocationByIP();
          applyCity(city);
        } catch {
          setLocationLabel("Select Location");
          setLocationError(true);
        } finally {
          setLocationLoading(false);
        }
      },
      { timeout: 8000 }
    );
  }, []);

  // No auto-detect on mount. Geolocation only runs when user triggers it explicitly.

  // ── Close dropdown on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Filtering ──
  const cuisineOptions = useMemo(() => extractCuisines(businesses), [businesses]);

  const cuisineCards = useMemo(() => {
    const used = new Set<string>();
    const cards: {
      name: string;
      tags: string;
      image: string;
      accent: string;
      blob: string;
      icon: string;
    }[] = [];

    const coverForCuisine = (name: string) => {
      const match = businesses.find((b) =>
        (b.cuisine || "").toLowerCase().includes(name.toLowerCase())
      );
      return match?.cover_image_url || "";
    };

    const pushKnown = (known: (typeof EXPLORE_CUISINES)[number], displayName?: string) => {
      const name = displayName || known.name;
      if (used.has(name.toLowerCase())) return;
      used.add(name.toLowerCase());
      used.add(known.name.toLowerCase());
      cards.push({
        name,
        tags: known.tags,
        image: coverForCuisine(known.name) || known.image,
        accent: known.accent,
        blob: known.blob,
        icon: "icon" in known ? known.icon : "cloche",
      });
    };

    cuisineOptions.forEach((opt, idx) => {
      const known = EXPLORE_CUISINES.find(
        (c) =>
          opt.toLowerCase().includes(c.name.toLowerCase()) ||
          c.name.toLowerCase().includes(opt.toLowerCase())
      );
      if (known) {
        pushKnown(known);
        return;
      }
      if (used.has(opt.toLowerCase())) return;
      used.add(opt.toLowerCase());
      const theme = CUISINE_THEME_FALLBACKS[idx % CUISINE_THEME_FALLBACKS.length];
      cards.push({
        name: opt,
        tags: "Fresh • Tasty • Popular",
        image: coverForCuisine(opt) || CUISINE_IMAGE_FALLBACK,
        accent: theme.accent,
        blob: theme.blob,
        icon: theme.icon,
      });
    });

    EXPLORE_CUISINES.forEach((known) => pushKnown(known));
    return cards;
  }, [businesses, cuisineOptions]);

  const filteredRestaurants = useMemo(() => {
    const base = businesses.filter((r) => {
      const name = r.name || "";
      const cuisine = r.cuisine || "";
      const address = r.address || "";

      const matchesSearch =
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cuisine.toLowerCase().includes(searchQuery.toLowerCase()) ||
        address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeFilter === "All" || (r.type_name && r.type_name.toLowerCase() === activeFilter.toLowerCase());
      const matchesLocation =
        !locationCity ||
        locationCity === "All Cities" ||
        address.toLowerCase().includes(locationCity.toLowerCase());
      return matchesSearch && matchesFilter && matchesLocation;
    });
    const filtered = applyDiningFilters(base, diningFilters);
    return filtered.filter((r) => matchesMealOccasion(r, mealOccasion));
  }, [businesses, searchQuery, activeFilter, locationCity, diningFilters, mealOccasion]);

  const cityDisplay =
    locationCity && locationCity !== "All Cities" ? locationCity : "All Cities";
  const restaurantCountLabel = `${filteredRestaurants.length} restaurant${filteredRestaurants.length !== 1 ? "s" : ""}`;

  const getFilteredSectionTitle = () => {
    const city = locationCity;
    if (mealOccasion) {
      const mealLabel = MEAL_OCCASIONS.find((m) => m.id === mealOccasion)?.label || "Dining";
      return (city && city !== "All Cities") ? `${mealLabel} in ${city}` : `${mealLabel} Near You`;
    }
    if (activeFilter === "All") {
      return (city && city !== "All Cities") ? `Restaurants in ${city}` : "Restaurants Near You";
    }
    const lower = activeFilter.toLowerCase();
    let name = activeFilter;
    if (lower === "bar") name = "Bars";
    else if (lower === "cafe") name = "Cafes";
    else if (lower === "restaurant") name = "Restaurants";
    else if (!name.endsWith("s")) name = name + "s";

    return (city && city !== "All Cities") ? `${name} in ${city}` : `${name} Near You`;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ── Promo banner slider (full width, above hero) ─────────────────── */}
      <section className="relative w-full bg-[#F8E6D4] overflow-hidden">
        <div className="relative w-full h-[148px] sm:h-[190px] md:h-[230px] lg:h-[280px]">
          {PROMO_SLIDES.map((slide, i) => (
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-500 ${
                i === promoIndex ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="Previous offer"
          onClick={() =>
            setPromoIndex((prev) => (prev === 0 ? PROMO_SLIDES.length - 1 : prev - 1))
          }
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-slate-700"
        >
          <ChevronLeft size={22} />
        </button>
        <button
          type="button"
          aria-label="Next offer"
          onClick={() =>
            setPromoIndex((prev) => (prev === PROMO_SLIDES.length - 1 ? 0 : prev + 1))
          }
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-slate-700"
        >
          <ChevronRight size={22} />
        </button>
      </section>

      <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 py-5">

      {cuisineCards.length > 0 && (
        <section className="bg-white px-0 sm:px-1 py-4 sm:py-5 md:py-6 mb-3 sm:mb-5">
          <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4 md:mb-5">
            <h2 className="font-bold text-[#1A1A1A] text-base sm:text-lg md:text-xl min-w-0 truncate">
              Explore Cuisines
            </h2>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                aria-label="Previous cuisines"
                onClick={() => scrollCuisines("left")}
                className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <ChevronLeft className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              </button>
              <button
                type="button"
                aria-label="Next cuisines"
                onClick={() => scrollCuisines("right")}
                className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <ChevronRight className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>
          </div>
          <div
            ref={cuisinesRef}
            className="flex gap-3 sm:gap-5 md:gap-6 lg:gap-8 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1"
          >
            {cuisineCards.map((item) => {
              const isActive = diningFilters.cuisine.toLowerCase() === item.name.toLowerCase();
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => handleCuisineSelect(item.name)}
                  className="shrink-0 snap-start flex flex-col items-center w-[72px] sm:w-[96px] md:w-[112px] lg:w-[124px] cursor-pointer group"
                >
                  <span
                    className={`w-[64px] h-[64px] sm:w-[84px] sm:h-[84px] md:w-[100px] md:h-[100px] lg:w-[112px] lg:h-[112px] rounded-full overflow-hidden bg-white shadow-[0_6px_16px_rgba(15,23,42,0.1)] ${
                      isActive ? "ring-2 ring-[#E85D04] ring-offset-1 sm:ring-offset-2" : ""
                    }`}
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        if (el.src !== CUISINE_IMAGE_FALLBACK) {
                          el.src = CUISINE_IMAGE_FALLBACK;
                        }
                      }}
                    />
                  </span>
                  <span className="mt-1.5 sm:mt-3 text-[11px] sm:text-[13px] lg:text-[1.1rem] font-semibold text-slate-500 text-center leading-tight line-clamp-2 w-full">
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 1. Hero Search Banner ──────────────────────────────────────────── */}
      <div
        className={`relative ${
          showLocationDropdown ? "z-40" : "z-0"
        }`}
      >
        {/* Background only — clipped to rounded corners (dropdown can overflow like old UI) */}
        <div className="absolute inset-0 rounded-[22px] sm:rounded-[28px] overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 bg-cover bg-center scale-105 dining-hero-bg"
            style={{
              backgroundImage: "url(/images/dining-hero.png)",
            }}
          />
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-black/30" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_15%,rgba(232,93,4,0.1),transparent_50%)]" />
        </div>

        {/* Title lower + tight gap to search bar */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-5 lg:px-8 min-h-[360px] sm:min-h-[400px] lg:min-h-[440px] flex flex-col justify-end  pb-6 sm:pb-8 gap-4 sm:gap-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 sm:gap-6">
            <div className="max-w-xl dining-hero-fade-up">
              <h1
                className={`${playfair.className} text-[28px] sm:text-4xl lg:text-[52px] font-semibold text-white leading-[1.15] tracking-tight`}
              >
                Book Your Perfect Dining Experience
              </h1>
              <p className="mt-2 text-white/90 text-sm sm:text-base lg:text-lg font-medium max-w-md">
                Discover the best restaurants, cafes, bars and more.
              </p>
            </div>

            <div className="relative w-full max-w-[300px] sm:max-w-[320px] sm:shrink-0 dining-hero-fade-up dining-hero-delay-1">
              <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-black/35 backdrop-blur-md px-4 py-3.5 sm:px-5 sm:py-4 shadow-2xl">
                <div className="relative z-10 pr-14 sm:pr-16">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Tag size={13} style={{ color: HERO_ACCENT }} />
                    <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.18em] text-white/90 uppercase">
                      Offer
                    </span>
                  </div>
                  <p className={`${playfair.className} text-xl sm:text-2xl font-bold text-white leading-tight`}>
                    Flat 20% OFF
                  </p>
                  <p className="mt-0.5 text-xs text-white/75">Up to ₹200 on dining bookings</p>
                  <button
                    type="button"
                    onClick={() => {
                      document.getElementById("dining-offers")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                    className="mt-2.5 inline-flex items-center rounded-md bg-white hover:bg-slate-100 text-slate-900 text-[11px] sm:text-xs font-bold px-3 py-1.5 transition-all hover:scale-[1.03] active:scale-[0.98]"
                  >
                    View Offers
                  </button>
                </div>
                <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-16 h-20">
                  <div className="dining-hero-float absolute right-1 top-0 w-9 h-9 rounded-full bg-gradient-to-br from-[#c45a1a] to-[#7a2e08] border border-amber-200/30 shadow-lg flex items-center justify-center">
                    <Percent size={14} className="text-white/90" />
                  </div>
                  <div className="dining-hero-float-delayed absolute right-8 top-8 w-7 h-7 rounded-full bg-gradient-to-br from-[#a84812] to-[#5c2206] border border-amber-200/20 shadow-md flex items-center justify-center">
                    <Percent size={11} className="text-white/80" />
                  </div>
                  <div className="dining-hero-float absolute right-0 bottom-1 w-6 h-6 rounded-full bg-gradient-to-br from-[#d97706] to-[#92400e] border border-amber-100/25 shadow flex items-center justify-center">
                    <Percent size={9} className="text-white/85" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Previous location + search bar with orange accents */}
          <div className="w-full dining-hero-fade-up dining-hero-delay-2">
            <div ref={locationRef} className="relative z-50">
              <div className="flex flex-col sm:flex-row items-stretch bg-white rounded-2xl sm:rounded-full shadow-2xl shadow-black/25 border border-white/50 overflow-hidden">
                <button
                  id="location-picker-btn"
                  type="button"
                  onClick={() => setShowLocationDropdown((v) => !v)}
                  className={`flex items-center gap-2 px-4 py-3.5 sm:py-0 sm:min-h-[52px] shrink-0 border-b sm:border-b-0 sm:border-r border-slate-100 hover:bg-slate-50 transition-colors w-full sm:w-auto sm:min-w-[170px] md:min-w-[200px] sm:max-w-[240px] ${
                    showLocationDropdown ? "bg-orange-50" : ""
                  }`}
                >
                  {locationLoading ? (
                    <Loader2 size={17} className="shrink-0 animate-spin" style={{ color: HERO_ACCENT }} />
                  ) : (
                    <MapPin
                      size={17}
                      className="shrink-0"
                      style={{ color: locationError ? "#94a3b8" : HERO_ACCENT }}
                    />
                  )}
                  <span
                    className={`text-sm font-semibold truncate ${
                      locationLoading ? "text-slate-400" : "text-slate-800"
                    }`}
                  >
                    {locationLabel}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`ml-auto shrink-0 text-slate-400 transition-transform duration-200 ${
                      showLocationDropdown ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div className="flex-1 flex items-center gap-2 px-4 min-w-0 border-b sm:border-b-0 border-slate-100">
                  <Search size={17} className="text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search restaurants, cuisines or dishes..."
                    className="flex-1 text-slate-800 placeholder:text-slate-400 text-sm focus:outline-none bg-transparent py-3.5 sm:py-0 min-w-0"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearchSubmit();
                    }}
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput("");
                        setSearchQuery("");
                      }}
                      className="text-slate-300 hover:text-slate-500 transition-colors shrink-0"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="inline-flex items-center justify-center gap-2 text-white px-6 sm:px-7 py-3.5 sm:py-0 sm:min-h-[52px] font-bold text-sm transition-all hover:brightness-110 active:scale-[0.99] whitespace-nowrap w-full sm:w-auto sm:rounded-full sm:m-1"
                  style={{
                    backgroundColor: HERO_ACCENT,
                    boxShadow: "0 8px 20px rgba(232,93,4,0.3)",
                  }}
                >
                  Find a Table
                  <ArrowRight size={15} />
                </button>
              </div>

              {showLocationDropdown && (
                <LocationDropdown
                  onSelect={(city) => {
                    setLocationLabel(city);
                    setLocationCity(city);
                    localStorage.setItem("selected_city", city);
                    window.dispatchEvent(new Event("selected_city_changed"));
                  }}
                  onDetect={() => {
                    setShowLocationDropdown(false);
                    detectCurrentLocation();
                  }}
                  detecting={locationLoading}
                  onClose={() => setShowLocationDropdown(false)}
                />
              )}
            </div>

            {locationError && (
              <p className="mt-2.5 text-white/65 text-xs flex items-center gap-1.5 px-1">
                <Navigation size={12} />
                Location access denied —{" "}
                <button
                  type="button"
                  onClick={() => setShowLocationDropdown(true)}
                  className="underline underline-offset-2 hover:text-white/85 transition-colors"
                >
                  select city manually
                </button>
              </p>
            )}
            {!locationError && locationCity && (
              <p className="mt-2.5 text-white/65 text-xs flex items-center gap-1.5 px-1">
                <Navigation size={12} />
                Showing restaurants in{" "}
                <span className="text-white/90 font-medium">{locationCity}</span>
                <button
                  type="button"
                  onClick={() => setShowLocationDropdown(true)}
                  className="ml-1 underline underline-offset-2 hover:text-white/85 transition-colors"
                >
                  change
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Page Body Part 1 (Collections, Promotions, Moods) ───────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── 3. Collections ──────────────────────────────────────────────── */}
        {!searchQuery && activeFilter === "All" && (
          <section className="py-10">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Collections</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Explore curated lists of top restaurants, cafes and bars
                </p>
              </div>
              <Link
                href={locationCity ? `/collections?city=${encodeURIComponent(locationCity)}` : '/collections'}
                className="flex items-center gap-1 text-sm font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
              >
                All collections <ChevronRight size={16} />
              </Link>
            </div>
            <div className="relative mt-5">
              {/* Left Arrow */}
              <button 
                onClick={() => scrollCollections('left')}
                className="absolute left-2 sm:-left-5 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white text-slate-700 w-10 h-10 rounded-full hidden md:flex items-center justify-center border border-slate-200 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-sm"
                aria-label="Scroll left"
              >
                <ChevronLeft size={20} />
              </button>

              {/* Scrollable Container */}
              <div 
                ref={collectionsRef}
                className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide scroll-smooth"
              >
                {collections.map((col) => (
                  <CollectionCard key={col.id} collection={col} />
                ))}
              </div>

              {/* Right Arrow */}
              <button 
                onClick={() => scrollCollections('right')}
                className="absolute right-2 sm:-right-5 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white text-slate-750 w-10 h-10 rounded-full hidden md:flex items-center justify-center border border-slate-200 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-sm"
                aria-label="Scroll right"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </section>
        )}

        {/* ── 4. Promotional Banner ────────────────────────────────────────── */}
        {!searchQuery && activeFilter === "All" && (
          <section id="dining-offers" className="py-6 scroll-mt-24">
            <div className="relative">
              <div className="overflow-hidden rounded-[24px] sm:rounded-[28px]">
                <div
                  className="flex transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${offerSlide * 100}%)` }}
                >
                  {DINING_OFFER_CARDS.map((card, cardIdx) => {
                    const imgIdx = offerImageIndex[cardIdx] ?? 0;
                    return (
                      <div key={card.id} className="min-w-full w-full shrink-0">
                        <div
                          className="relative overflow-hidden rounded-[24px] sm:rounded-[28px] min-h-[200px] sm:min-h-[220px] md:min-h-[240px] px-5 sm:px-8 py-6 sm:py-7 flex items-center"
                          style={{ backgroundColor: card.bg, color: card.text }}
                        >
                          {card.pattern === "bolts" && (
                            <div className="pointer-events-none absolute inset-0 opacity-[0.12]"
                              style={{
                                backgroundImage:
                                  "repeating-linear-gradient(115deg, transparent, transparent 40px, currentColor 40px, currentColor 52px)",
                              }}
                            />
                          )}
                          {card.pattern === "burst" && (
                            <div className="pointer-events-none absolute -right-10 -top-16 w-64 h-64 rounded-full border-[18px] opacity-[0.12]"
                              style={{ borderColor: card.text }}
                            />
                          )}
                          {card.pattern === "arcs" && (
                            <div className="pointer-events-none absolute -right-8 bottom-[-40%] w-72 h-72 rounded-full border-[16px] opacity-[0.12]"
                              style={{ borderColor: card.text }}
                            />
                          )}

                          <div className="relative z-10 flex-1 min-w-0 pr-2 sm:pr-6">
                            <span
                              className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-2"
                              style={{ color: card.accent }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: card.accent }} />
                              {card.badge}
                            </span>
                            <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight">
                              {card.title}
                            </h3>
                            <p className="mt-1.5 text-sm sm:text-base opacity-80 max-w-md">
                              {card.subtitle}
                              {card.id === "weekend" && locationCity ? ` across ${locationCity}.` : "."}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                document.getElementById("restaurant-listings")?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "start",
                                })
                              }
                              className="mt-4 inline-flex items-center gap-1.5 bg-white rounded-full px-4 sm:px-5 py-2 text-sm font-bold shadow-sm hover:shadow-md transition-shadow"
                              style={{ color: card.accent }}
                            >
                              {card.cta} <ChevronRight size={16} />
                            </button>
                          </div>

                          <div className="relative z-10 shrink-0 flex flex-col items-center">
                            <img
                              src={card.images[imgIdx]}
                              alt={card.title}
                              className="w-[120px] h-[120px] sm:w-[160px] sm:h-[160px] md:w-[180px] md:h-[180px] object-contain drop-shadow-lg"
                            />
                            <div className="flex items-center gap-1.5 mt-2">
                              {card.images.map((_, dotIdx) => (
                                <button
                                  key={dotIdx}
                                  type="button"
                                  aria-label={`Offer image ${dotIdx + 1}`}
                                  onClick={() =>
                                    setOfferImageIndex((prev) => {
                                      const next = [...prev];
                                      next[cardIdx] = dotIdx;
                                      return next;
                                    })
                                  }
                                  className="w-2 h-2 rounded-full transition-all"
                                  style={{
                                    backgroundColor: imgIdx === dotIdx ? card.accent : "rgba(0,0,0,0.2)",
                                    transform: imgIdx === dotIdx ? "scale(1.2)" : "scale(1)",
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                aria-label="Previous offer"
                onClick={() =>
                  setOfferSlide((prev) => (prev === 0 ? DINING_OFFER_CARDS.length - 1 : prev - 1))
                }
                className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-slate-700"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                aria-label="Next offer"
                onClick={() =>
                  setOfferSlide((prev) => (prev === DINING_OFFER_CARDS.length - 1 ? 0 : prev + 1))
                }
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center text-slate-700"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        )}

        {/* ── 4.5. In The Mood For Section ────────────────────────────────── */}
        {!searchQuery && activeFilter === "All" && (
          <section className="py-8">
            <div className="flex items-center gap-4 text-center mb-8">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-slate-400 font-bold text-xs uppercase tracking-[0.25em] whitespace-nowrap">
                In The Mood For
              </span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Mobile Layout: 2-row horizontal scroll of tall cards (title at top, image at bottom) */}
            <div className="flex md:hidden overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 scroll-smooth">
              <div className="grid grid-rows-2 grid-flow-col gap-4">
                {moods.map((mood) => (
                  <button
                    key={mood.id}
                    onClick={() => handleMoodSelect(mood.query_tag)}
                    className="group bg-white rounded-2xl border border-slate-100/90 p-3.5 h-38 w-28 flex flex-col justify-between hover:shadow-sm hover:border-slate-200 transition-all cursor-pointer text-left shrink-0 shadow-sm relative overflow-hidden focus:outline-none"
                  >
                    <span className="font-bold text-slate-800 text-[12.5px] leading-tight block max-w-full group-hover:text-rose-600 transition-colors">
                      {mood.title}
                    </span>
                    <div className="absolute bottom-0 left-0 right-0 h-22 overflow-hidden rounded-b-2xl flex items-end">
                      <img
                        src={mood.image_url}
                        alt={mood.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
                        }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop Layout: Premium Circular Category Bubbles in exactly 1 line across full width (no left/right extra margins) */}
            <div className="hidden md:flex justify-between items-center w-full py-2">
              {moods.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => handleMoodSelect(mood.query_tag)}
                  className="group flex flex-col items-center text-center cursor-pointer w-28 lg:w-32 focus:outline-none shrink-0"
                >
                  {/* Circular Wrapper */}
                  <div className="relative w-24 h-24 lg:w-28 lg:h-28 rounded-full overflow-hidden border-2 border-slate-100 group-hover:border-rose-600 group-hover:scale-105 transition-all duration-300 shadow-sm bg-slate-50 flex items-center justify-center">
                    <img
                      src={mood.image_url}
                      alt={mood.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
                      }}
                    />
                    {/* Ring highlight on hover */}
                    <div className="absolute inset-0 ring-4 ring-rose-500/15 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  {/* Category Title */}
                  <span className="text-[12px] lg:text-[13px] font-bold text-slate-700 mt-3 group-hover:text-rose-600 transition-colors tracking-wide leading-tight">
                    {mood.title}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── 4.6. Can't decide ───────────────────────────────────────────── */}
        {!searchQuery && activeFilter === "All" && (
          <section className="py-8 sm:py-10">
            <div className="relative overflow-hidden rounded-[22px] sm:rounded-[28px] bg-[#F6EDE4] px-5 py-5 sm:px-8 sm:py-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0">
                <UtensilsCrossed size={22} className="text-[#E85D04]" />
              </div>
              <div className="flex-1 text-center sm:text-left min-w-0">
                <p className="font-bold text-[#1A2744] text-base sm:text-lg">Can&apos;t decide?</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  Explore restaurants near you and try something new.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExploreRestaurants}
                className="shrink-0 inline-flex items-center justify-center gap-2 bg-[#E85D04] hover:bg-[#d45303] text-white font-bold text-sm px-5 sm:px-6 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md w-full sm:w-auto"
              >
                Explore Restaurants
                <ArrowRight size={16} />
              </button>
              <div className="pointer-events-none absolute right-3 top-0 bottom-0 w-16 hidden md:block opacity-25"
                style={{
                  backgroundImage: "radial-gradient(#9ca3af 1.2px, transparent 1.2px)",
                  backgroundSize: "10px 10px",
                }}
              />
            </div>
          </section>
        )}

      </div>

      {/* ── 4.8. What are you looking for ─────────────────────────────────── */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <h2 className={`${playfair.className} text-xl sm:text-2xl font-bold text-[#1A1A1A] mb-5 sm:mb-6`}>
            What are you looking for?
          </h2>
          <div className="relative">
            <div className="flex flex-nowrap items-start gap-5 sm:gap-6 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pt-3 pb-4 px-1 pr-8">
            {filters.map((f) => {
              const isActive = activeFilter.toLowerCase() === f.label.toLowerCase();
              const theme = getDiningTypeVisual(f.label);
              const displayName = f.label.toLowerCase() === "all" ? "All Dining" : f.label;
              const TypeIcon = theme.Icon;
              return (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => {
                    setActiveFilter(f.label);
                    const element = document.getElementById("restaurant-listings");
                    if (element) {
                      element.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  className="shrink-0 snap-start flex flex-col items-center w-[84px] sm:w-[92px] cursor-pointer group"
                >
                  <span
                    className="w-[48px] h-[48px] sm:w-[52px] sm:h-[52px] rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: theme.bg,
                      boxShadow: isActive ? `0 0 0 2px ${HERO_ACCENT}` : undefined,
                    }}
                  >
                    <TypeIcon size={22} color={theme.accent} />
                  </span>
                  <span className="mt-2 text-[11px] sm:text-[12px] font-semibold text-[#1A1A1A] text-center leading-tight">
                    {displayName}
                  </span>
                </button>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* ── 5. Restaurant Listing Grid ───────────────────────────────────── */}
          <section id="restaurant-listings" className={`pb-16 ${(!searchQuery && activeFilter === "All") ? "" : "pt-8"}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {getFilteredSectionTitle()}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {locationLoading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 size={12} className="animate-spin" /> Locating restaurants…
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-slate-700">{cityDisplay}</span>
                    {" · "}
                    {restaurantCountLabel} to explore
                  </>
                )}
              </p>
            </div>

            {/* Active Filters & Search Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {searchQuery && (
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-600 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                  <span>Search: "{searchQuery}"</span>
                  <button
                    onClick={() => { setSearchInput(""); setSearchQuery(""); }}
                    className="hover:bg-rose-100 p-0.5 rounded-full transition-colors flex items-center justify-center"
                    aria-label="Clear search"
                  >
                    <X size={12} className="text-rose-600" />
                  </button>
                </div>
              )}

              {diningFilters.cuisine && (
                <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 text-[#E85D04] px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                  <span>Cuisine: {diningFilters.cuisine}</span>
                  <button
                    onClick={() => setDiningFilters({ ...diningFilters, cuisine: "" })}
                    className="hover:bg-orange-100 p-0.5 rounded-full transition-colors flex items-center justify-center"
                    aria-label="Clear cuisine filter"
                  >
                    <X size={12} className="text-[#E85D04]" />
                  </button>
                </div>
              )}

              {activeFilter !== "All" && (
                <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-650 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                  <span>Category: {activeFilter}</span>
                  <button
                    onClick={() => setActiveFilter("All")}
                    className="hover:bg-slate-200 p-0.5 rounded-full transition-colors flex items-center justify-center"
                    aria-label="Clear category filter"
                  >
                    <X size={12} className="text-slate-650" />
                  </button>
                </div>
              )}

              {mealOccasion && (
                <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 text-[#E85D04] px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                  <span>{MEAL_OCCASIONS.find((m) => m.id === mealOccasion)?.label}</span>
                  <button
                    onClick={() => setMealOccasion("")}
                    className="hover:bg-orange-100 p-0.5 rounded-full transition-colors flex items-center justify-center"
                    aria-label="Clear meal filter"
                  >
                    <X size={12} className="text-[#E85D04]" />
                  </button>
                </div>
              )}

              {(activeFilter !== "All" || searchQuery || diningFilters.cuisine || diningFilters.minRating > 0 || diningFilters.offersOnly || mealOccasion) && (
                <button
                  onClick={() => {
                    setSearchInput("");
                    setSearchQuery("");
                    setActiveFilter("All");
                    setDiningFilters(DEFAULT_DINING_FILTERS);
                    setMealOccasion("");
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1.5 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <DiningFiltersBar
            cuisines={cuisineOptions}
            filters={diningFilters}
            onChange={setDiningFilters}
            onReset={() => setDiningFilters(DEFAULT_DINING_FILTERS)}
          />

          <section className="mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-[#1A1A1A] mb-5">
              Hi {foodieName}, Dine Anytime!
            </h2>
            <div className="flex gap-4 sm:gap-5 overflow-x-auto scrollbar-hide scroll-smooth pt-2 pb-2">
              {MEAL_OCCASIONS.map((meal) => {
                const isActive = mealOccasion === meal.id;
                return (
                  <button
                    key={meal.id}
                    type="button"
                    onClick={() => {
                      setMealOccasion((prev) => (prev === meal.id ? "" : meal.id));
                      document.getElementById("restaurant-listings")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                    className={`shrink-0 overflow-visible flex items-center gap-4 bg-white rounded-2xl px-5 py-2 min-w-[220px] sm:min-w-[240px] transition-all cursor-pointer ${
                      isActive
                        ? "shadow-[0_8px_22px_rgba(232,93,4,0.2)] ring-2 ring-[#E85D04]"
                        : "shadow-[0_4px_16px_rgba(15,23,42,0.08)] hover:shadow-[0_8px_22px_rgba(15,23,42,0.12)]"
                    }`}
                  >
                    <span className="relative w-[76px] h-[76px] sm:w-[84px] sm:h-[84px] shrink-0 overflow-visible">
                      <span className="absolute left-0 bottom-0 w-[52px] h-[52px] sm:w-[58px] sm:h-[58px] rounded-2xl bg-[#F8E7B8]" />
                      <img
                        src={meal.image}
                        alt={meal.label}
                        className="absolute -top-1 -right-0.5 z-10 w-[78px] h-[78px] sm:w-[86px] sm:h-[86px] object-contain drop-shadow-md"
                      />
                    </span>
                    <span className="text-[16px] sm:text-[17px] font-bold text-[#1A1A1A] whitespace-nowrap">
                      {meal.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {businessesLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <Loader2 size={36} className="animate-spin text-rose-600" />
              <p className="text-sm font-medium">Loading top restaurants...</p>
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="text-center py-24">
              <div className="text-5xl mb-4">🍽️</div>
              <h3 className="text-lg font-semibold text-slate-600 mb-2">No restaurants found</h3>
              <p className="text-slate-400 text-sm">
                {locationCity
                  ? `No results in ${locationCity}. Try changing your city or filter.`
                  : "Try adjusting your search or removing the filter."}
              </p>
              <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveFilter("All");
                    setLocationCity("");
                    setLocationLabel("All Cities");
                  }}
                  className="bg-rose-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-rose-700 transition-colors"
                >
                  Show all restaurants
                </button>
                <button
                  onClick={() => setShowLocationDropdown(true)}
                  className="bg-white border border-slate-200 text-slate-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Change city
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRestaurants.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </div>
          )}
        </section>
        </div>
      </div>
      </div>
    </div>
  );
}
