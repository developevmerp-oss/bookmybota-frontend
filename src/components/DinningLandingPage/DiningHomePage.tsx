"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Navigation,
  Loader2,
  X,
  Utensils,
  UtensilsCrossed,
  Users,
  Tag,
  ArrowRight,
  Crown,
  Star,
} from "lucide-react";
import Link from "next/link";
import type { IconType } from "react-icons";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation as SwiperNavigation } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import DiningWishlistButton from "@/components/DinningLandingPage/DiningWishlistButton";
import { SHOWCASE_BAR_CARDS, SHOWCASE_DINING_CARDS, type ShowcaseDiningCard } from "@/data/showcaseDiningCards";
import { preferCityOrAll } from "@/components/LandingPage/homeUtils";
import CategoryPromoBanners from "@/components/LandingPage/CategoryPromoBanners";
import CitySectionEmptyNotice from "@/components/LandingPage/CitySectionEmptyNotice";
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
import { useGetBusinessTypesQuery, useGetBusinessesPagedQuery, useGetBusinessesQuery, useGetCollectionsQuery, useGetDiningCuisinesQuery, useGetActiveMarketingPromotionsQuery, Business, Collection, type MarketingCampaign } from "@/services/api";
// import { useGetMoodsQuery, Mood } from "@/services/api";
import { useRouter } from "next/navigation";
import DiningFiltersBar from "@/components/DinningLandingPage/DiningFiltersBar";
import { formatMoney } from "@/lib/currencyFormat";
import { listingOfferLabel } from "@/lib/diningOffers";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { restaurantHref } from "@/lib/businessPublicPath";
import { promotionClickHref } from "@/lib/promotionCta";
import { useAppSelector } from "@/lib/hooks";
import {
  DEFAULT_DINING_FILTERS,
  DiningFilterState,
  DiningHomeOfferCard,
  DiningOfferBucket,
  buildDiningHomeOfferCards,
  businessHasOffer,
  businessMatchesOfferBucket,
  extractCuisines,
  offerBucketSectionTitle,
} from "@/lib/diningFilters";
import { useHorizontalScrollEdges } from "@/lib/useHorizontalScrollEdges";
import "./DiningHomePage.css";

const HERO_ACCENT = "#6900AA";
const PAGE_MUTED = "#f6f7f8";
const DINING_LIST_LIMIT = 12;

const EXPLORE_DINING_CARDS = [
  {
    id: "all-dining",
    title: "All dining",
    image: "/images/dining-category-all.png",
    match: null as readonly string[] | null,
  },
  {
    id: "bar",
    title: "Bar",
    image: "/images/dining-category-bar.png",
    match: ["bar"] as const,
  },
  {
    id: "restaurant",
    title: "Restaurant",
    image: "/images/dining-category-restaurant.png",
    match: ["restaurant"] as const,
  },
  // {
  //   id: "bar-grill",
  //   title: "Bar & Grill",
  //   image: "/images/dining-category-bar-grill.png",
  //   match: ["grill", "bar & grill", "bar and grill"] as const,
  // },
  {
    id: "cafe",
    title: "Cafe",
    image: "/images/dining-category-cafe.png",
    match: ["cafe", "café", "coffee"] as const,
  },
  // Hidden from Explore Dining (frontend only) — keep entries for easy restore.
  // {
  //   id: "pub",
  //   title: "Pub",
  //   image: "/images/dining-category-pub.png",
  //   match: ["pub"] as const,
  // },
  // {
  //   id: "fine-dining",
  //   title: "Fine dining",
  //   image: "/images/dining-category-fine-dining.png",
  //   match: ["fine dining", "fine-dining", "fine"] as const,
  // },
  // {
  //   id: "general-restaurant",
  //   title: "General restaurant",
  //   image: "/images/dining-category-general.png",
  //   match: ["general restaurant", "general"] as const,
  // },
] as const;

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

type DiningPromoSlide = {
  id: string;
  title: string;
  image: string;
  location: string;
  rating: string;
  reviewsLabel: string;
  cuisines: string[];
  href: string;
};

function formatReviewCount(count?: number | null): string {
  const n = Number(count || 0);
  if (!n) return "(New)";
  if (n >= 1000) {
    const k = n / 1000;
    const label = k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1).replace(/\.0$/, "")}k`;
    return `(${label} reviews)`;
  }
  return `(${n} review${n === 1 ? "" : "s"})`;
}

function diningLocality(business: Business): string {
  const city = (business.city_name || "").trim();
  const addr = (business.address || "").trim();
  if (addr) {
    const parts = addr.split(",").map((p) => p.trim()).filter(Boolean);
    const area = parts[0] || addr;
    if (city && !area.toLowerCase().includes(city.toLowerCase())) {
      return `${area}, ${city}`;
    }
    if (parts.length >= 2) return `${parts[0]}, ${parts[1]}`;
    return area;
  }
  return city || "Addis Ababa";
}

function diningCuisineTags(business: Business): string[] {
  const raw =
    business.cuisine ||
    business.type_name ||
    "";
  const tags = raw
    .split(/[,·|/]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 3);
  return tags.length ? tags : ["Dining"];
}

function businessToPromoSlide(business: Business): DiningPromoSlide {
  const image =
    resolveMediaUrl(business.cover_image_url) ||
    (business.gallery_images?.[0] ? resolveMediaUrl(business.gallery_images[0]) : "") ||
    "";
  return {
    id: `biz-${business.id}`,
    title: business.name,
    image,
    location: diningLocality(business),
    rating: Number(business.rating || 4.5).toFixed(1),
    reviewsLabel: formatReviewCount(business.reviews_count),
    cuisines: diningCuisineTags(business),
    href: restaurantHref(business),
  };
}

/** Prefer banner uploaded on the marketing promotion plan; fall back to restaurant media. */
function campaignToPromoSlide(
  promo: MarketingCampaign,
  businessesById: Map<string, Business>
): DiningPromoSlide {
  const targetType = String(promo.target_type || "").toUpperCase();
  const targetId = promo.target_id ? String(promo.target_id) : "";
  const businessId = promo.business_id ? String(promo.business_id) : "";
  const linkedId =
    targetType === "RESTAURANT" || targetType === "BUSINESS"
      ? targetId || businessId
      : businessId;
  const linked = linkedId
    ? businessesById.get(linkedId) || businessesById.get(businessId)
    : undefined;

  const planBanner = resolveMediaUrl(promo.banner_image_url || "");
  const restaurantImage = linked
    ? resolveMediaUrl(linked.cover_image_url) ||
      (linked.gallery_images?.[0] ? resolveMediaUrl(linked.gallery_images[0]) : "")
    : "";

  const title =
    (promo.title || "").trim() ||
    linked?.name ||
    "Featured dining";

  return {
    id: `promo-${promo.id}`,
    title,
    image: planBanner || restaurantImage || "",
    location: linked ? diningLocality(linked) : "Addis Ababa",
    rating: Number(linked?.rating || 4.5).toFixed(1),
    reviewsLabel: formatReviewCount(linked?.reviews_count),
    cuisines: linked ? diningCuisineTags(linked) : ["Dining"],
    href: promotionClickHref(promo) || (linked ? restaurantHref(linked) : linkedId ? restaurantHref({ id: linkedId }) : "/dining"),
  };
}

function DiningPromoBannerCard({ slide }: { slide: DiningPromoSlide }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(slide.image?.trim()) && !imgFailed;
  const locationParts = slide.location.split(",").map((p) => p.trim()).filter(Boolean);
  const placeLabel = locationParts[0] || slide.location;
  const cityLabel = locationParts.slice(1).join(", ") || "";

  return (
    <Link
      href={slide.href}
      aria-label={`Book a table at ${slide.title}`}
      className="dining-promo-card group relative flex h-full w-full overflow-hidden rounded-2xl sm:rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-[#6900AA] focus-visible:ring-offset-2"
    >
      <div className="absolute inset-0">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.image}
            alt=""
            aria-hidden
            className="dining-promo-card-photo h-full w-full object-cover"
            draggable={false}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-[#1a1a1a]"
            aria-hidden
          >
            <Utensils size={52} className="text-white/30" strokeWidth={1.5} />
          </div>
        )}
        <div className="dining-promo-card-scrim pointer-events-none absolute inset-0" />
      </div>

      <div className="relative z-[2] flex h-full max-w-[58%] sm:max-w-[52%] md:max-w-[48%] lg:max-w-[46%] flex-col justify-center pl-5 pr-2 sm:pl-7 sm:pr-4 md:pl-9 md:pr-6 pb-6 sm:pb-8">
        <h2 className="text-white text-xl sm:text-2xl md:text-3xl lg:text-[2rem] font-extrabold leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] line-clamp-2">
          {slide.title}
        </h2>

        <div className="mt-3 sm:mt-4 flex items-center gap-3 sm:gap-4 text-white">
          <div className="flex items-start gap-2 min-w-0">
            <Star
              className="mt-0.5 shrink-0 fill-[#F59E0B] text-[#F59E0B]"
              size={16}
              strokeWidth={0}
            />
            <div className="min-w-0 leading-tight">
              <p className="text-[12px] sm:text-sm font-semibold truncate">{slide.rating}</p>
              <p className="text-[10px] sm:text-xs text-white/65 truncate">
                {slide.reviewsLabel.replace(/[()]/g, "")}
              </p>
            </div>
          </div>

          <span className="hidden sm:block w-px h-8 bg-white/30 shrink-0" aria-hidden />

          <div className="hidden sm:flex items-start gap-2 min-w-0">
            <MapPin className="mt-0.5 shrink-0 text-white/80" size={16} strokeWidth={2} />
            <div className="min-w-0 leading-tight">
              <p className="text-[12px] sm:text-sm font-semibold truncate">
                {cityLabel || placeLabel}
              </p>
              {cityLabel ? (
                <p className="text-[10px] sm:text-xs text-white/65 truncate">{placeLabel}</p>
              ) : null}
            </div>
          </div>
        </div>

        <span className="mt-3.5 sm:mt-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#6900AA] px-4 sm:px-5 py-2 sm:py-2.5 text-[12px] sm:text-sm font-bold text-white shadow-[0_8px_22px_rgba(105,0,170,0.4)] transition-transform duration-200 group-hover:scale-[1.03]">
          <Utensils size={15} className="shrink-0" strokeWidth={2.25} />
          Book a Table
          <ArrowRight size={15} className="shrink-0" strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}

const OFFER_THEMES = [
  { bg: "#FDE8E8", text: "#9B1C1C", accent: "#DC2626", shape: "#F5C2C2" },
  { bg: "#F7E9FF", text: "#57008E", accent: "#6900AA", shape: "#E3BCFF" },
  { bg: "#FFF6D9", text: "#92400E", accent: "#D97706", shape: "#FDE68A" },
  { bg: "#E8F1FF", text: "#1E3A8A", accent: "#2563EB", shape: "#BFDBFE" },
] as const;

const TAB_THEME_COLORS = [
  "#6900AA",
  "#9D00FF",
  "#C026D3",
  "#DB2777",
  "#E11D48",
  "#EA580C",
  "#D97706",
  "#F5C542",
  "#059669",
  "#0D9488",
  "#0891B2",
  "#2563EB",
  "#4F46E5",
  "#7C3AED",
  "#EC4899",
  "#0EA5E9",
];

function OfferPromoCard({
  card,
  locationCity,
  colorIndex = 0,
  className = "",
  onSelect,
}: {
  card: DiningHomeOfferCard;
  locationCity: string;
  colorIndex?: number;
  className?: string;
  onSelect: (bucket: DiningOfferBucket) => void;
}) {
  const theme = OFFER_THEMES[colorIndex % OFFER_THEMES.length];
  return (
    <div
      className={`relative overflow-hidden rounded-[24px] min-h-[188px] sm:min-h-[200px] px-5 py-5 sm:px-6 sm:py-6 ${className}`}
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <span
        className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full"
        style={{ backgroundColor: theme.shape }}
      />
      <span
        className="pointer-events-none absolute -bottom-10 -left-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full"
        style={{ backgroundColor: theme.shape }}
      />
      <div className="relative z-10">
        <span
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm lg:text-xs font-bold uppercase tracking-widest mb-2"
          style={{ color: theme.accent }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.accent }} />
          {card.badge}
        </span>
        <h3 className="text-xl sm:text-2xl font-extrabold leading-tight">{card.title}</h3>
        <p className="mt-1.5 text-sm sm:text-base lg:text-sm opacity-80">
          {card.subtitle}
          {locationCity && locationCity !== "All Cities" ? ` in ${locationCity}.` : "."}
        </p>
        <button
          type="button"
          onClick={() => onSelect(card.bucket)}
          className="mt-4 inline-flex items-center gap-1.5 bg-white rounded-full px-4 py-2 text-sm sm:text-base lg:text-sm font-bold shadow-sm hover:shadow-md transition-shadow"
          style={{ color: theme.accent }}
        >
          {card.cta} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

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

function themeColorFromLabel(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return TAB_THEME_COLORS[hash % TAB_THEME_COLORS.length];
}

function getDiningTypeVisual(label: string): {
  Icon: IconType;
  bg: string;
  accent: string;
} {
  const lower = label.trim().toLowerCase();

  let Icon: IconType = MdOutlineRestaurant;
  let accent = themeColorFromLabel(label);

  if (lower === "all" || lower.includes("all dining")) {
    Icon = MdOutlineDinnerDining;
    accent = "#6900AA";
  } else if (lower.includes("comedy") || lower.includes("stand up") || lower.includes("stand-up")) {
    Icon = MdOutlineTheaterComedy;
    accent = "#DB2777";
  } else if (lower.includes("concert") || lower.includes("live show") || lower.includes("gig")) {
    Icon = HiOutlineMicrophone;
    accent = "#C026D3";
  } else if (lower.includes("music") || lower.includes("dj") || lower.includes("band")) {
    Icon = MdOutlineMusicNote;
    accent = "#7C3AED";
  } else if (lower.includes("theatre") || lower.includes("theater") || lower.includes("drama")) {
    Icon = MdOutlineTheaters;
    accent = "#4F46E5";
  } else if (lower.includes("party") || lower.includes("celebration")) {
    Icon = MdOutlineCelebration;
    accent = "#E11D48";
  } else if (lower.includes("sport")) {
    Icon = MdOutlineSportsSoccer;
    accent = "#059669";
  } else if (lower.includes("spa") || lower.includes("wellness")) {
    Icon = MdOutlineSpa;
    accent = "#0D9488";
  } else if (lower.includes("hotel") || lower.includes("stay")) {
    Icon = MdOutlineHotel;
    accent = "#0891B2";
  } else if (lower.includes("pizza")) {
    Icon = MdOutlineLocalPizza;
    accent = "#EA580C";
  } else if (lower.includes("nightclub") || lower.includes("nightlife")) {
    Icon = MdOutlineNightlife;
    accent = "#9D00FF";
  } else if (lower.includes("event")) {
    Icon = MdOutlineEvent;
    accent = "#2563EB";
  } else if (lower.includes("grill")) {
    Icon = MdOutlineOutdoorGrill;
    accent = "#D97706";
  } else if (lower === "bar") {
    Icon = MdOutlineSportsBar;
    accent = "#7C3AED";
  } else if (lower.includes("pub")) {
    Icon = MdOutlineWineBar;
    accent = "#9333EA";
  } else if (lower.includes("lounge") || lower.includes("club")) {
    Icon = MdOutlineNightlife;
    accent = "#A21CAF";
  } else if (lower.includes("cafe") || lower.includes("coffee")) {
    Icon = MdOutlineLocalCafe;
    accent = "#C2410C";
  } else if (lower.includes("fine")) {
    Icon = MdOutlineBrunchDining;
    accent = "#6D28D9";
  } else if (lower.includes("general")) {
    Icon = IoRestaurantOutline;
    accent = "#0EA5E9";
  } else if (lower.includes("dessert") || lower.includes("sweet") || lower.includes("bakery")) {
    Icon = MdOutlineBakeryDining;
    accent = "#EC4899";
  } else if (lower.includes("family")) {
    Icon = MdOutlineFamilyRestroom;
    accent = "#16A34A";
  } else if (lower.includes("rooftop") || lower.includes("outdoor")) {
    Icon = MdOutlineDeck;
    accent = "#0284C7";
  } else if (lower.includes("karaoke") || lower.includes("open mic")) {
    Icon = HiOutlineMicrophone;
    accent = "#F59E0B";
  } else if (lower.includes("bar")) {
    Icon = MdOutlineSportsBar;
    accent = "#8B5CF6";
  } else if (lower.includes("restaurant") || lower.includes("dining")) {
    Icon = MdOutlineRestaurant;
    accent = "#E11D48";
  }

  return { Icon, bg: `${accent}1F`, accent };
}

/** Resolve a static explore card to a backend type name. Exact name only (no substring overlap). */
function resolveExploreTypeName(
  match: readonly string[] | null,
  types: { name: string }[],
  fallback: string
): string | null {
  if (!match) return null;
  const exact = types.find((t) =>
    match.some((m) => t.name.trim().toLowerCase() === m)
  );
  return exact?.name || fallback;
}

/** Map filter category selection back to an Explore Dining card id. */
function exploreCardIdForCategories(
  categories: string[],
  types: { name: string }[]
): string {
  if (categories.length === 0) return "all-dining";
  for (const cat of categories) {
    const lower = cat.trim().toLowerCase();
    if (!lower) continue;
    for (const card of EXPLORE_DINING_CARDS) {
      if (!card.match) continue;
      const resolved = resolveExploreTypeName(card.match, types, card.title);
      if (resolved && resolved.trim().toLowerCase() === lower) return card.id;
      if (card.title.trim().toLowerCase() === lower) return card.id;
      if (card.match.some((m) => m === lower)) return card.id;
    }
  }
  return "all-dining";
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
  const [imgFailed, setImgFailed] = useState(false);
  const imageSrc = resolveMediaUrl(restaurant.cover_image_url) || "";
  const showImage = Boolean(imageSrc) && !imgFailed;
  const rating = Number(restaurant.rating || 4.2).toFixed(1);
  const cuisine =
    restaurant.cuisine ||
    restaurant.type_name ||
    "Italian, Chinese, Continental";
  const cuisineLine = cuisine
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" • ");

  const getLocality = (addr?: string | null) => {
    if (!addr || typeof addr !== "string") return "Address not available";
    const parts = addr.split(",");
    if (parts.length >= 2) {
      return `${parts[0].trim()}, ${parts[1].trim()}`;
    }
    return addr.trim() || "Address not available";
  };

  const idHash =
    typeof restaurant.id === "number"
      ? restaurant.id
      : restaurant.id
        ? restaurant.id.toString().split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
        : 0;

  const priceForTwo = restaurant.average_cost
    ? `${formatMoney(restaurant.average_cost, { compact: true })} for two`
    : (() => {
        const bases = [1200, 1500, 2000, 2400, 1800];
        return `${formatMoney(bases[idHash % bases.length], { compact: true })} for two`;
      })();

  const distance = (() => {
    const dists = [4.9, 3.5, 5.0, 2.8, 6.2];
    return `${dists[idHash % dists.length]} km away`;
  })();

  const isPromoted = !!restaurant.is_promoted;
  const offerLabel = listingOfferLabel(restaurant.dining_offers);

  return (
    <div className="group flex h-full flex-col bg-white rounded-2xl border border-[#E8E8E8] shadow-sm hover:shadow-md transition-shadow duration-300 p-3">
      <div className="relative h-52 sm:h-56 shrink-0 overflow-hidden rounded-2xl bg-[#F3F4F6]">
        <Link href={restaurantHref(restaurant)} className="absolute inset-0 block">
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={restaurant.name}
              className="w-full h-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <Utensils size={28} strokeWidth={1.5} />
            </div>
          )}
          {showImage ? (
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />
          ) : null}
        </Link>

        <DiningWishlistButton businessId={String(restaurant.id)} />

        {(isPromoted || offerLabel) && (
          <div className="absolute bottom-3 left-3 z-[1] flex flex-col gap-1.5 max-w-[calc(100%-1.5rem)] pointer-events-none">
            {isPromoted ? (
              <span
                className="inline-flex max-w-full items-center gap-1.5 rounded-full text-[#9F1239] text-xs font-bold px-3 py-1.5 shadow-md"
                style={{
                  background: "linear-gradient(90deg, #FFF1F2 0%, #FFE4E6 45%, #FECDD3 100%)",
                }}
              >
                <Crown
                  size={13}
                  className="shrink-0 fill-[#9F1239] text-[#9F1239]"
                  strokeWidth={0}
                />
                <span className="truncate">Promoted</span>
              </span>
            ) : null}
            {offerLabel ? (
              <span
                className="inline-flex max-w-full items-center gap-1.5 rounded-full text-[#9F1239] text-xs font-bold px-3 py-1.5 shadow-md"
                style={{
                  background: "linear-gradient(90deg, #FFF1F2 0%, #FFE4E6 45%, #FECDD3 100%)",
                }}
              >
                <Tag
                  size={13}
                  className="shrink-0 fill-[#9F1239] text-[#9F1239]"
                  strokeWidth={0}
                />
                <span className="truncate">{offerLabel}</span>
              </span>
            ) : null}
          </div>
        )}
      </div>

      <Link
        href={restaurantHref(restaurant)}
        className="flex flex-col flex-1 px-0.5 pt-3.5 pb-1 min-w-0 min-h-0 bg-white"
      >
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="font-bold text-[#292929] text-lg sm:text-xl leading-tight truncate flex-1 group-hover:text-[#6900AA] transition-colors">
            {restaurant.name}
          </h3>
          <div className="shrink-0 inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-1.5 py-0.5 rounded-md">
            <span className="text-[10px]">★</span>
            <span>{rating}+</span>
          </div>
        </div>

        <div className="space-y-1.5 text-sm text-[#292929]">
          <p className="flex items-center gap-1.5 min-w-0">
            <UtensilsCrossed size={14} className="shrink-0 text-[#6900AA]" />
            <span className="truncate font-medium">{cuisineLine}</span>
          </p>
          <div className="flex items-start justify-between gap-2 min-w-0">
            <p className="flex items-center gap-1.5 min-w-0 flex-1">
              <MapPin size={14} className="shrink-0 text-[#6900AA]" />
              <span className="truncate font-medium">{getLocality(restaurant.address)}</span>
            </p>
            <span className="shrink-0 font-medium whitespace-nowrap text-[#292929]">{distance}</span>
          </div>
          <p className="flex items-center gap-1.5 min-w-0">
            <Users size={14} className="shrink-0 text-[#6900AA]" />
            <span className="truncate font-medium">{priceForTwo}</span>
          </p>
        </div>

        <div className="mt-auto pt-3 w-full">
          <span
            className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-[#6900AA] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#6900AA] group-hover:bg-[#f7e9ff] transition-colors [transform:translateZ(0)] [backface-visibility:hidden]"
          >
            <span>View Booking</span>
            <ArrowRight size={16} className="shrink-0" />
          </span>
        </div>
      </Link>
    </div>
  );
}

/** Static showcase listing card — same look as RestaurantCard, not clickable (no detail page). */
function ShowcaseRestaurantCard({ place }: { place: ShowcaseDiningCard }) {
  const [imgFailed, setImgFailed] = useState(false);
  const cuisineLine = place.cuisine
    .split(/[·|,]/)
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" • ");
  const rating = Number(place.rating || 0).toFixed(1);
  const idHash = place.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const priceForTwo = (() => {
    const bases = [1200, 1500, 2000, 2400, 1800];
    return `${formatMoney(bases[idHash % bases.length], { compact: true })} for two`;
  })();
  const distance = (() => {
    const dists = [4.9, 3.5, 5.0, 2.8, 6.2];
    return `${dists[idHash % dists.length]} km away`;
  })();
  const showImage = Boolean(place.image) && !imgFailed;

  return (
    <div className="group flex h-full flex-col bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-3 select-none">
      <div className="relative h-52 sm:h-56 shrink-0 overflow-hidden rounded-2xl bg-[#F3F4F6]">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.image}
            alt={place.name}
            className="w-full h-full object-cover"
            draggable={false}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <Utensils size={28} strokeWidth={1.5} />
          </div>
        )}
        {showImage ? (
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />
        ) : null}
      </div>

      <div className="flex flex-col flex-1 px-0.5 pt-3.5 pb-1 min-w-0 min-h-0 bg-white">
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="font-bold text-[#292929] text-lg sm:text-xl leading-tight truncate flex-1">
            {place.name}
          </h3>
          <div className="shrink-0 inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-1.5 py-0.5 rounded-md">
            <span className="text-[10px]">★</span>
            <span>{rating}+</span>
          </div>
        </div>

        <div className="space-y-1.5 text-sm text-[#292929]">
          <p className="flex items-center gap-1.5 min-w-0">
            <UtensilsCrossed size={14} className="shrink-0 text-[#6900AA]" />
            <span className="truncate font-medium">{cuisineLine || place.cuisine}</span>
          </p>
          <div className="flex items-start justify-between gap-2 min-w-0">
            <p className="flex items-center gap-1.5 min-w-0 flex-1">
              <MapPin size={14} className="shrink-0 text-[#6900AA]" />
              <span className="truncate font-medium">{place.locality}</span>
            </p>
            <span className="shrink-0 font-medium whitespace-nowrap text-[#292929]">{distance}</span>
          </div>
          <p className="flex items-center gap-1.5 min-w-0">
            <Users size={14} className="shrink-0 text-[#6900AA]" />
            <span className="truncate font-medium">{priceForTwo}</span>
          </p>
        </div>

        <div className="mt-auto pt-3 w-full">
          <span className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-[#6900AA] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#6900AA] opacity-70">
            <span>View Booking</span>
            <ArrowRight size={16} className="shrink-0" />
          </span>
        </div>
      </div>
    </div>
  );
}

function CollectionCard({
  collection,
  city,
}: {
  collection: Collection;    
  city?: string;
}) {
  const subtitle = collection.places_count !== undefined 
    ? `${collection.places_count} place${collection.places_count !== 1 ? 's' : ''}`
    : collection.subtitle || "0 places";
  const href = city
    ? `/search?collection=${encodeURIComponent(collection.slug)}&city=${encodeURIComponent(city)}`
    : `/search?collection=${encodeURIComponent(collection.slug)}`;

  return (
    <Link
      href={href}
      className="relative shrink-0 w-[200px] h-[268px] sm:w-[220px] sm:h-[300px] lg:w-[236px] lg:h-[320px] rounded-2xl overflow-hidden cursor-pointer group shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 block"
    >
      <img
        src={resolveMediaUrl(collection.image_url) || "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80"}
        alt={collection.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
        }}
      />
      <div className={`absolute inset-0 bg-gradient-to-t ${collection.color_gradient || 'from-rose-900/80'} to-transparent`} />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-white font-bold text-base sm:text-lg leading-tight">{collection.title}</h3>
        <p className="text-white/80 text-xs sm:text-sm mt-1 flex items-center gap-0.5">
          {subtitle} <ChevronRight size={14} className="opacity-80" />
        </p>
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
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [exploreCardId, setExploreCardId] = useState("all-dining");
  const [diningFilters, setDiningFilters] = useState<DiningFilterState>(DEFAULT_DINING_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadedRestaurants, setLoadedRestaurants] = useState<Business[]>([]);
  const [mealOccasion, setMealOccasion] = useState<MealOccasion | "">("");
  const authUser = useAppSelector((state) => state.auth.user);
  const foodieName = authUser?.name?.trim().split(/\s+/)[0] || "Foodie";
  const bannerPrevRef = useRef<HTMLButtonElement>(null);
  const bannerNextRef = useRef<HTMLButtonElement>(null);
  const bannerSwiperRef = useRef<SwiperType | null>(null);
  const [bannerActiveDot, setBannerActiveDot] = useState(0);

  const collectionsRef = useRef<HTMLDivElement>(null);
  const cuisinesRef = useRef<HTMLDivElement>(null);
  const stickyCuisinesRef = useRef<HTMLDivElement>(null);
  const cuisineStickySentinelRef = useRef<HTMLDivElement>(null);
  const filtersStickySentinelRef = useRef<HTMLDivElement>(null);
  const offersRef = useRef<HTMLDivElement>(null);
  const [collectionsScroll, setCollectionsScroll] = useState({ left: false, right: false });
  const [showStickyCuisineNames, setShowStickyCuisineNames] = useState(false);
  const [isFiltersStuck, setIsFiltersStuck] = useState(false);
  const [siteHeaderHeight, setSiteHeaderHeight] = useState(0);

  const bindBannerNav = useCallback((swiper: SwiperType) => {
    const nav = swiper.params?.navigation;
    if (!nav || typeof nav === "boolean") return;
    nav.prevEl = bannerPrevRef.current;
    nav.nextEl = bannerNextRef.current;
    swiper.navigation?.destroy?.();
    swiper.navigation?.init?.();
    swiper.navigation?.update?.();
  }, []);

  const updateCollectionsScroll = useCallback(() => {
    const el = collectionsRef.current;
    if (!el) {
      setCollectionsScroll({ left: false, right: false });
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    const canOverflow = maxScroll > 2;
    setCollectionsScroll({
      left: canOverflow && el.scrollLeft > 2,
      right: canOverflow && el.scrollLeft < maxScroll - 2,
    });
  }, []);

  const scrollCollections = (direction: "left" | "right") => {
    if (!collectionsRef.current) return;
    const amount = Math.max(collectionsRef.current.clientWidth * 0.7, 236);
      collectionsRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
      });
  };

  const scrollCuisines = (direction: "left" | "right") => {
    const el = (showStickyCuisineNames ? stickyCuisinesRef : cuisinesRef).current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.7, 160);
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const scrollOffers = (direction: "left" | "right") => {
    if (!offersRef.current) return;
    const amount = Math.max(offersRef.current.clientWidth * 0.8, 280);
    offersRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const handleSearchSubmit = () => {
    setSearchQuery(searchInput);
  };

  // Restore with In The Mood For section below.
  // const handleMoodSelect = (query: string) => {
  //   const params = new URLSearchParams();
  //   params.set("mood", query);
  //   if (locationCity) {
  //     params.set("city", locationCity);
  //   }
  //   router.push(`/search?${params.toString()}`);
  // };

  const scrollToDiningBrowseViewport = useCallback(() => {
    requestAnimationFrame(() => {
      document.getElementById("explore-dining")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const handleCuisineSelect = (cuisine: string) => {
    setDiningFilters((prev) => {
      const exists = prev.cuisines.some((c) => c.toLowerCase() === cuisine.toLowerCase());
      return {
        ...prev,
        cuisines: exists
          ? prev.cuisines.filter((c) => c.toLowerCase() !== cuisine.toLowerCase())
          : [...prev.cuisines, cuisine],
      };
    });
    scrollToDiningBrowseViewport();
  };

  const handleExploreRestaurants = () => {
    setDiningFilters(DEFAULT_DINING_FILTERS);
    scrollToDiningBrowseViewport();
  };

  // ── Location state ──
  const [locationLabel, setLocationLabel] = useState("All Cities");
  const [locationCity, setLocationCity] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);

  // Prefer URL ?city=, else keep the shared top-bar city from localStorage.
  // Never clear selected_city just because dining opened without a query param.
  useEffect(() => {
    if (typeof window === "undefined") return;

      const params = new URLSearchParams(window.location.search);
    const filterParam = params.get("filter");
    const cityParam = params.get("city");
    const searchParam = params.get("search");
    const storedCity = localStorage.getItem("selected_city") || "";

    if (filterParam) {
      setActiveCategories([filterParam]);
      setExploreCardId(exploreCardIdForCategories([filterParam], []));
    }

    const nextCity =
      cityParam && cityParam !== "All Cities"
        ? cityParam
        : storedCity && storedCity !== "All Cities"
          ? storedCity
          : "";

    setLocationCity(nextCity);
    setLocationLabel(nextCity || "All Cities");

      if (cityParam && cityParam !== "All Cities") {
      localStorage.setItem("selected_city", cityParam);
      window.dispatchEvent(new Event("selected_city_changed"));
    }

      if (searchParam) {
        setSearchQuery(searchParam);
        setSearchInput(searchParam);
    }
  }, []);

  // Stay in sync when top-bar city changes while on dining.
  useEffect(() => {
    const syncCity = () => {
      const stored = localStorage.getItem("selected_city") || "";
      const next = stored && stored !== "All Cities" ? stored : "";
      setLocationCity(next);
      setLocationLabel(next || "All Cities");
    };
    window.addEventListener("selected_city_changed", syncCity);
    window.addEventListener("storage", syncCity);
    return () => {
      window.removeEventListener("selected_city_changed", syncCity);
      window.removeEventListener("storage", syncCity);
    };
  }, []);

  const activeCity =
    locationCity && locationCity !== "All Cities" ? locationCity : undefined;

  const { data: businessTypes = [] } = useGetBusinessTypesQuery('dining');

  // Keep Explore Dining highlight in sync with Filters → Category (same shared options).
  useEffect(() => {
    const nextId = exploreCardIdForCategories(activeCategories, businessTypes);
    setExploreCardId((prev) => (prev === nextId ? prev : nextId));
  }, [activeCategories, businessTypes]);

  const diningListArgs = useMemo(
    () => ({
      module: "dining" as const,
      q: searchQuery || undefined,
      categories: activeCategories.length > 0 ? activeCategories : undefined,
      cuisines: diningFilters.cuisines.length > 0 ? diningFilters.cuisines : undefined,
      min_rating: diningFilters.minRating > 0 ? diningFilters.minRating : undefined,
      offers_only: diningFilters.offersOnly || undefined,
      pure_veg: diningFilters.pureVeg || undefined,
      serves_alcohol: diningFilters.servesAlcohol || undefined,
      max_cost: diningFilters.maxCost > 0 ? diningFilters.maxCost : undefined,
      sort: diningFilters.sort,
      page: currentPage,
      limit: DINING_LIST_LIMIT,
    }),
    [
      searchQuery,
      activeCategories,
      diningFilters.cuisines,
      diningFilters.minRating,
      diningFilters.offersOnly,
      diningFilters.pureVeg,
      diningFilters.servesAlcohol,
      diningFilters.maxCost,
      diningFilters.sort,
      currentPage,
    ]
  );

  const {
    data: cityBusinessesData,
    isLoading: cityBusinessesLoading,
    isFetching: cityBusinessesFetching,
  } = useGetBusinessesPagedQuery({
    ...diningListArgs,
    city: activeCity,
  });
  const {
    data: allBusinessesData,
    isLoading: allBusinessesLoading,
    isFetching: allBusinessesFetching,
  } = useGetBusinessesPagedQuery(diningListArgs, { skip: !activeCity });

  const cityBusinessItems = cityBusinessesData?.items ?? [];
  const usingDiningFallback =
    Boolean(activeCity) &&
    !cityBusinessesLoading &&
    cityBusinessItems.length === 0 &&
    (cityBusinessesData?.meta?.total ?? 0) === 0;
  const businessesData = usingDiningFallback ? allBusinessesData : cityBusinessesData;
  const businessesLoading =
    cityBusinessesLoading ||
    (Boolean(activeCity) && cityBusinessItems.length === 0 && allBusinessesLoading);
  const businessesFetching =
    cityBusinessesFetching || (usingDiningFallback && allBusinessesFetching);
  const businesses = businessesData?.items ?? [];

  // Full list for homepage sections — city-first, then all dining.
  const { data: citySectionBusinesses = [] } = useGetBusinessesQuery({
    module: "dining",
    ...(activeCity ? { city: activeCity } : {}),
  });
  const { data: allSectionBusinesses = [] } = useGetBusinessesQuery(
    { module: "dining" },
    { skip: !activeCity }
  );
  const sectionBusinesses = preferCityOrAll(
    citySectionBusinesses,
    allSectionBusinesses,
    Boolean(activeCity)
  );
  const { data: diningSliderPromotions = [] } = useGetActiveMarketingPromotionsQuery({
    category: "DINING",
    surface: "slider",
    ...(activeCity ? { city: activeCity } : {}),
  });
  const { data: collections = [] } = useGetCollectionsQuery();
  // const { data: moods = [] } = useGetMoodsQuery();
  const { data: cuisineMasters = [] } = useGetDiningCuisinesQuery();

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

  const exploreDiningFilterCategories = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const card of EXPLORE_DINING_CARDS) {
      if (!card.match) continue;
      const name = resolveExploreTypeName(card.match, businessTypes, card.title) || card.title;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
    return out;
  }, [businessTypes]);

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
  const sectionPool = sectionBusinesses.length > 0 ? sectionBusinesses : businesses;
  const cuisineOptions = useMemo(() => extractCuisines(sectionPool), [sectionPool]);
  const homeOfferCards = useMemo(
    () => buildDiningHomeOfferCards(sectionPool),
    [sectionPool]
  );

  // Priority: active dining slider promotions (plan banner image) → promoted → offers → any.
  const promoSlides = useMemo(() => {
    const businessesById = new Map<string, Business>();
    for (const b of sectionPool) businessesById.set(String(b.id), b);

    if (diningSliderPromotions.length > 0) {
      const fromPlans = diningSliderPromotions
        .slice(0, 8)
        .map((promo) => campaignToPromoSlide(promo, businessesById))
        // Prefer slides that have the admin-uploaded promotion banner image.
        .filter((slide) => Boolean(slide.image?.trim()));
      if (fromPlans.length > 0) return fromPlans;
      // Plans exist but no banner uploaded yet — still show plan slides (icon fallback).
      return diningSliderPromotions
        .slice(0, 8)
        .map((promo) => campaignToPromoSlide(promo, businessesById));
    }

    if (!sectionPool.length) return [];

    const toSlides = (list: Business[]) => list.map(businessToPromoSlide).slice(0, 8);

    const promotedOnly = sectionPool.filter((b) => Boolean(b.is_promoted));
    if (promotedOnly.length) return toSlides(promotedOnly);

    const withOffers = sectionPool.filter((b) => businessHasOffer(b));
    if (withOffers.length) {
      const promotedOffers = withOffers.filter((b) => Boolean(b.is_promoted));
      return toSlides(promotedOffers.length ? promotedOffers : withOffers);
    }

    return toSlides(sectionPool);
  }, [sectionPool, diningSliderPromotions]);

  // Same as landing promo: duplicate so loop + peeks keep autoplay seamless.
  const promoDisplaySlides = useMemo(() => {
    if (promoSlides.length <= 1) return promoSlides;
    const minNeeded = 6;
    if (promoSlides.length >= minNeeded) return promoSlides;
    const out: DiningPromoSlide[] = [];
    let copy = 0;
    while (out.length < minNeeded) {
      for (const s of promoSlides) {
        out.push(copy === 0 ? s : { ...s, id: `${s.id}__c${copy}` });
        if (out.length >= minNeeded) break;
      }
      copy += 1;
    }
    return out;
  }, [promoSlides]);

  const applyOfferBucket = useCallback((bucket: DiningOfferBucket) => {
    setDiningFilters((prev) => ({
      ...prev,
      offersOnly: true,
      offerBucket: bucket,
    }));
    setCurrentPage(1);
    scrollToDiningBrowseViewport();
  }, [scrollToDiningBrowseViewport]);

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
      const match = sectionPool.find((b) =>
        (b.cuisine || "").toLowerCase().includes(name.toLowerCase())
      );
      return resolveMediaUrl(match?.cover_image_url) || "";
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

    // When a city is selected, only show cuisines present in that city's restaurants.
    const cityCuisineSet = activeCity
      ? new Set(cuisineOptions.map((c) => c.toLowerCase()))
      : null;

    cuisineMasters.forEach((master, idx) => {
      const key = master.name.toLowerCase();
      if (used.has(key)) return;
      if (
        cityCuisineSet &&
        !cityCuisineSet.has(key) &&
        ![...cityCuisineSet].some((c) => c.includes(key) || key.includes(c))
      ) {
        return;
      }
      used.add(key);
      const known = EXPLORE_CUISINES.find((c) => c.name.toLowerCase() === key);
      const theme = known || CUISINE_THEME_FALLBACKS[idx % CUISINE_THEME_FALLBACKS.length];
      cards.push({
        name: master.name,
        tags: known?.tags || "Fresh • Tasty • Popular",
        image: resolveMediaUrl(master.image_url) || coverForCuisine(master.name) || known?.image || CUISINE_IMAGE_FALLBACK,
        accent: theme.accent,
        blob: theme.blob,
        icon: known?.icon || theme.icon,
      });
    });

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

    if (cuisineMasters.length === 0 && !activeCity) {
    EXPLORE_CUISINES.forEach((known) => pushKnown(known));
    }
    return cards;
  }, [sectionPool, cuisineOptions, cuisineMasters, activeCity]);

  const filteredRestaurants = useMemo(() => {
    const mealFiltered = loadedRestaurants.filter((r) => matchesMealOccasion(r, mealOccasion));
    if (!diningFilters.offerBucket) return mealFiltered;
    return mealFiltered.filter((r) =>
      businessMatchesOfferBucket(r, diningFilters.offerBucket)
    );
  }, [loadedRestaurants, mealOccasion, diningFilters.offerBucket]);

  const bucketFilteredFromPool = useMemo(() => {
    if (!diningFilters.offerBucket) return null;
    return sectionPool
      .filter((r) => businessMatchesOfferBucket(r, diningFilters.offerBucket))
      .filter((r) => matchesMealOccasion(r, mealOccasion));
  }, [diningFilters.offerBucket, sectionPool, mealOccasion]);

  const displayRestaurants = bucketFilteredFromPool ?? filteredRestaurants;

  useEffect(() => {
    setCurrentPage(1);
    setLoadedRestaurants([]);
  }, [searchQuery, locationCity, activeCategories, diningFilters, mealOccasion]);

  useEffect(() => {
    if (!businessesData) return;
    const pageItems = businessesData.items ?? [];
    if (currentPage <= 1) {
      setLoadedRestaurants(pageItems);
      return;
    }
    setLoadedRestaurants((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      const next = pageItems.filter((r) => !seen.has(r.id));
      return next.length ? [...prev, ...next] : prev;
    });
  }, [businessesData, currentPage]);

  const hasMoreRestaurants =
    !diningFilters.offerBucket && Boolean(businessesData?.meta?.has_next);
  const loadingMore = businessesFetching && currentPage > 1;

  const hasActiveFilters =
    Boolean(searchQuery) ||
    activeCategories.length > 0 ||
    Boolean(mealOccasion) ||
    diningFilters.cuisines.length > 0 ||
    diningFilters.minRating > 0 ||
    diningFilters.offersOnly ||
    Boolean(diningFilters.offerBucket) ||
    diningFilters.pureVeg ||
    diningFilters.servesAlcohol ||
    diningFilters.maxCost > 0 ||
    diningFilters.sort !== "relevance" ||
    diningFilters.bookTable;
  const showHomeExtras = !hasActiveFilters;
  const diningFiltersAreDefault =
    diningFilters.cuisines.length === 0 &&
    diningFilters.minRating === 0 &&
    !diningFilters.offersOnly &&
    !diningFilters.offerBucket &&
    !diningFilters.pureVeg &&
    !diningFilters.servesAlcohol &&
    diningFilters.maxCost === 0 &&
    diningFilters.sort === "relevance" &&
    !diningFilters.bookTable;
  const isBarCategoryOnly =
    activeCategories.length === 1 &&
    activeCategories[0].trim().toLowerCase() === "bar";
  const hasSelectedCity =
    Boolean(locationCity) && locationCity !== "All Cities";
  const canShowCatalogFallback =
    !businessesLoading &&
    displayRestaurants.length === 0 &&
    !searchQuery &&
    !mealOccasion &&
    diningFiltersAreDefault &&
    (activeCategories.length === 0 || isBarCategoryOnly);
  const useStaticDining = canShowCatalogFallback && !hasSelectedCity;
  const staticDiningCards = isBarCategoryOnly ? SHOWCASE_BAR_CARDS : SHOWCASE_DINING_CARDS;

  const cuisinesScroll = useHorizontalScrollEdges(cuisinesRef, [
    cuisineCards.length,
    exploreCardId,
  ]);
  const stickyCuisinesScroll = useHorizontalScrollEdges(stickyCuisinesRef, [
    cuisineCards.length,
    exploreCardId,
    showStickyCuisineNames,
  ]);
  const offersScroll = useHorizontalScrollEdges(offersRef, [
    homeOfferCards.length,
    showHomeExtras,
  ]);

  useEffect(() => {
    const measureHeader = () => {
      const header = document.querySelector("header");
      setSiteHeaderHeight(header?.getBoundingClientRect().height ?? 0);
    };
    measureHeader();
    window.addEventListener("resize", measureHeader);
    return () => window.removeEventListener("resize", measureHeader);
  }, []);

  useEffect(() => {
    const sentinel = cuisineStickySentinelRef.current;
    if (!sentinel || exploreCardId !== "restaurant" || cuisineCards.length === 0) {
      setShowStickyCuisineNames(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyCuisineNames(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
        rootMargin: siteHeaderHeight > 0 ? `-${siteHeaderHeight}px 0px 0px 0px` : "-120px 0px 0px 0px",
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [exploreCardId, cuisineCards.length, siteHeaderHeight]);

  useEffect(() => {
    const sentinel = filtersStickySentinelRef.current;
    if (!sentinel) {
      setIsFiltersStuck(false);
      return;
    }

    const topOffset = siteHeaderHeight + (showStickyCuisineNames ? 52 : 0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsFiltersStuck(!entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
        rootMargin: `-${Math.max(topOffset, 1)}px 0px 0px 0px`,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [siteHeaderHeight, showStickyCuisineNames]);

  useEffect(() => {
    if (!showHomeExtras) {
      setCollectionsScroll({ left: false, right: false });
      return;
    }
    const frame = requestAnimationFrame(() => updateCollectionsScroll());
    const el = collectionsRef.current;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => updateCollectionsScroll()) : null;
    if (el) {
      ro?.observe(el);
      el.addEventListener("scroll", updateCollectionsScroll, { passive: true });
    }
    window.addEventListener("resize", updateCollectionsScroll);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      el?.removeEventListener("scroll", updateCollectionsScroll);
      window.removeEventListener("resize", updateCollectionsScroll);
    };
  }, [collections, showHomeExtras, updateCollectionsScroll]);

  const cityDisplay =
    locationCity && locationCity !== "All Cities" ? locationCity : "All Cities";
  const totalRestaurants = useStaticDining
    ? staticDiningCards.length
    : diningFilters.offerBucket
      ? displayRestaurants.length
      : businessesData?.meta?.total ?? filteredRestaurants.length;
  const restaurantCountLabel = `${totalRestaurants} restaurant${totalRestaurants !== 1 ? "s" : ""}`;

  const getFilteredSectionTitle = () => {
    const bucketTitle = offerBucketSectionTitle(diningFilters.offerBucket);
    if (bucketTitle) {
      return locationCity && locationCity !== "All Cities"
        ? `${bucketTitle} in ${locationCity}`
        : bucketTitle;
    }
    const city = locationCity;
    if (mealOccasion) {
      const mealLabel = MEAL_OCCASIONS.find((m) => m.id === mealOccasion)?.label || "Dining";
      return (city && city !== "All Cities") ? `${mealLabel} in ${city}` : `${mealLabel} Near You`;
    }
    if (activeCategories.length === 0) {
      return (city && city !== "All Cities") ? `Restaurants in ${city}` : "Restaurants Near You";
    }
    if (activeCategories.length === 1) {
      const label = activeCategories[0];
      const lower = label.toLowerCase();
      let name = label;
    if (lower === "bar") name = "Bars";
    else if (lower === "cafe") name = "Cafes";
    else if (lower === "restaurant") name = "Restaurants";
      else if (!name.endsWith("s")) name = `${name}s`;
    return (city && city !== "All Cities") ? `${name} in ${city}` : `${name} Near You`;
    }
    return (city && city !== "All Cities")
      ? `${activeCategories.length} categories in ${city}`
      : `${activeCategories.length} categories Near You`;
  };

  const heroRestaurantStat =
    totalRestaurants >= 1000
      ? `${Math.floor(totalRestaurants / 100) * 100}+`
      : totalRestaurants > 0
        ? `${totalRestaurants}+`
        : "5,000+";

  // Landing-page carousel rules: peek when >1 slide, centered single when 1.
  const promoMulti = promoSlides.length > 1;

  return (
    <div className="min-h-screen bg-white">
      {/* ── Top promo banner — same carousel layout as landing PromoBannerCarousel ─ */}
      {promoSlides.length > 0 ? (
      <section
        className={`dining-promo-swiper w-full bg-[#F5F5F5] pt-3 sm:pt-4 pb-3 sm:pb-4 ${
          promoMulti ? "is-multi" : "is-compact"
        }`}
      >
        <div
          className={`relative w-full ${
            promoMulti ? "" : "dining-promo-single-wrap"
          }`}
        >
          <Swiper
            key={`dining-promo-${promoSlides.map((s) => s.id).join("-")}-${promoDisplaySlides.length}`}
            modules={[Autoplay, SwiperNavigation]}
            className="dining-promo-peek w-full"
            loop={promoMulti}
            loopAdditionalSlides={promoMulti ? 2 : 0}
            speed={600}
            centeredSlides={promoMulti}
            centeredSlidesBounds={!promoMulti}
            grabCursor={promoMulti}
            allowTouchMove={promoMulti}
            slidesPerView={promoMulti ? "auto" : 1}
            spaceBetween={promoMulti ? 14 : 0}
            watchSlidesProgress={promoMulti}
            breakpoints={
              promoMulti
                ? {
                    640: { spaceBetween: 16 },
                    768: { spaceBetween: 18 },
                    1024: { spaceBetween: 20 },
                  }
                : undefined
            }
            autoplay={
              promoMulti
                ? {
                    delay: 5000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                    stopOnLastSlide: false,
                    waitForTransition: true,
                  }
                : false
            }
            navigation={
              promoMulti
                ? { prevEl: bannerPrevRef.current, nextEl: bannerNextRef.current }
                : false
            }
            onBeforeInit={(swiper: SwiperType) => {
              if (!promoMulti) return;
              const nav = swiper.params?.navigation;
              if (nav && typeof nav !== "boolean") {
                nav.prevEl = bannerPrevRef.current;
                nav.nextEl = bannerNextRef.current;
              }
            }}
            onSwiper={(swiper) => {
              bannerSwiperRef.current = swiper;
              if (!promoMulti) return;
              setTimeout(() => bindBannerNav(swiper));
            }}
            onSlideChange={(swiper) => {
              const originalCount = promoSlides.length;
              if (originalCount <= 0) return;
              const real =
                ((swiper.realIndex % originalCount) + originalCount) % originalCount;
              setBannerActiveDot(real);
            }}
          >
            {promoDisplaySlides.map((slide) => (
              <SwiperSlide key={slide.id} className="dining-promo-slide">
                <DiningPromoBannerCard slide={slide} />
              </SwiperSlide>
            ))}
          </Swiper>

          {promoMulti ? (
            <>
              <button
                ref={bannerPrevRef}
                type="button"
                aria-label="Previous banner"
                className="dining-promo-nav dining-promo-nav-prev"
              >
                <ChevronLeft className="size-5 sm:size-6" strokeWidth={2.25} />
              </button>
              <button
                ref={bannerNextRef}
                type="button"
                aria-label="Next banner"
                className="dining-promo-nav dining-promo-nav-next"
              >
                <ChevronRight className="size-5 sm:size-6" strokeWidth={2.25} />
              </button>
              <div className="dining-promo-dots" role="tablist" aria-label="Banner slides">
                {promoSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-label={`Show ${slide.title}`}
                    aria-selected={index === bannerActiveDot}
                    className={`dining-promo-dot ${
                      index === bannerActiveDot ? "is-active" : ""
                    }`}
                    onClick={() => {
                      const swiper = bannerSwiperRef.current;
                      if (!swiper) return;
                      swiper.slideToLoop(index);
                      setBannerActiveDot(index);
                    }}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>
      ) : null}

      <CategoryPromoBanners
        category="DINING"
        city={activeCity || locationCity || ""}
        className="container mx-auto px-4 sm:px-6 lg:px-8 pt-3"
      />

      {/* ── 1. Hero Search Banner (centered, reference layout) ─────────────── */}
      {/* <section
        className={`relative w-full ${
          showLocationDropdown ? "z-40" : "z-0"
        }`}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 bg-cover bg-center scale-105 dining-hero-bg"
            style={{
              backgroundImage: "url(/images/dining-hero.png)",
            }}
          />
          <div className="absolute inset-0 bg-slate-900/55" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/30 via-slate-900/45 to-slate-900/65" />
        </div>

        <div className="relative z-10 w-full mx-auto container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 min-h-[340px] sm:min-h-[380px] lg:min-h-[400px] flex flex-col items-start justify-end pt-10 sm:pt-12 pb-6 sm:pb-7 text-left">
          <div className="w-full max-w-3xl dining-hero-fade-up">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.12] tracking-tight">
              What are you in the{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(90deg, #FB7185, #C084FC, #FCD34D)",
                }}
              >
                mood for?
              </span>
              </h1>
            <p className="mt-3 sm:mt-4 text-white/90 text-base sm:text-xl font-medium max-w-2xl">
              Discover top restaurants, cafes &amp; bars — book your table in seconds.
              </p>
            </div>

          <div className="w-full max-w-3xl mt-5 sm:mt-8 lg:mt-10 dining-hero-fade-up dining-hero-delay-1">
            <div ref={locationRef} className="relative z-50 text-left">
              <div className="flex flex-col sm:flex-row items-stretch bg-white rounded-2xl sm:rounded-full shadow-2xl shadow-black/25 border border-white/50 overflow-hidden">
                <button
                  id="location-picker-btn"
                  type="button"
                  onClick={() => setShowLocationDropdown((v) => !v)}
                  className={`flex items-center gap-2 px-4 py-3.5 sm:py-0 sm:min-h-[52px] shrink-0 border-b sm:border-b-0 sm:border-r border-slate-100 hover:bg-slate-50 transition-colors w-full sm:w-auto sm:min-w-[170px] md:min-w-[200px] sm:max-w-[240px] ${
                    showLocationDropdown ? "bg-[#f7e9ff]" : ""
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
                    className={`text-sm sm:text-base lg:text-sm font-semibold truncate ${
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
                    className="flex-1 text-slate-800 placeholder:text-slate-400 text-sm sm:text-base focus:outline-none bg-transparent py-3.5 sm:py-0 min-w-0"
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
                  className="inline-flex items-center justify-center text-white px-6 sm:px-8 py-3.5 sm:py-0 sm:min-h-[52px] font-bold text-sm transition-all hover:brightness-110 active:scale-[0.99] whitespace-nowrap w-full sm:w-auto sm:rounded-full sm:m-1"
                  style={{
                    backgroundColor: HERO_ACCENT,
                    boxShadow: "0 8px 20px rgba(105,0,170,0.3)",
                  }}
                >
                  Search
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

          <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-start gap-x-8 sm:gap-x-12 gap-y-3 text-white/90 text-sm sm:text-base font-medium dining-hero-fade-up dining-hero-delay-2">
            <span>{heroRestaurantStat} Restaurants</span>
            <span>1M+ Happy Diners</span>
            <span>50+ Cities</span>
              </div>
            </div>
      </section> */}

      {/* ── Explore Dining categories ─────────────────────────────────────── */}
      <section
        id="explore-dining"
        className="w-full bg-white border-b border-slate-100"
        style={{ scrollMarginTop: Math.max(siteHeaderHeight, 96) + 8 }}
      >
        <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 py-6 sm:py-3">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 sm:mb-5 tracking-tight">
            Explore Dining
          </h2>
          <div className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide pt-1.5 pb-1">
            {EXPLORE_DINING_CARDS.map((card) => {
              const resolvedCategory = resolveExploreTypeName(
                card.match,
                businessTypes,
                card.title
              );
              const isActive = exploreCardId === card.id;
                    return (
                <div
                  key={card.id}
                  className="text-center flex flex-col items-center justify-center transition-all shrink-0"
                >
                            <button
                              type="button"
                  onClick={() => {
                    // Re-clicking the active card must keep selection + results.
                    // Resetting categories with a new array would clear the list
                    // while RTK Query returns the same cached page and never rehydrates.
                    if (exploreCardId === card.id) {
                      scrollToDiningBrowseViewport();
                      return;
                    }
                    setExploreCardId(card.id);
                    if (resolvedCategory) {
                      // Use the same label as Filters → Category so both stay highlighted together.
                      const filterLabel =
                        exploreDiningFilterCategories.find(
                          (c) => c.toLowerCase() === resolvedCategory.toLowerCase()
                        ) || resolvedCategory;
                      setActiveCategories([filterLabel]);
                    } else {
                      setActiveCategories([]);
                    }
                    setCurrentPage(1);
                    scrollToDiningBrowseViewport();
                  }}
                  className="text-center cursor-pointer w-[120px] h-[140px] sm:w-[132px] sm:h-[160px] rounded-2xl transition-all hover:-translate-y-0.5"
                  aria-pressed={isActive}
                >
                  <span className={`block w-full h-full rounded-2xl transition-all ${
                    isActive ? "border-[2px] border-[#6900AA]" : "border-[2px] border-transparent"
                  }`}>
                    <img
                      src={card.image}
                              alt={card.title}
                      className={`w-full h-full block rounded-xl transition-all ${
                        isActive ? "opacity-100" : "opacity-90 hover:opacity-100"
                      }`}
                    />
                  </span>
                  
                </button>

<p
className={`text-sm font-bold mt-2 transition-colors ${
  isActive ? "text-[#6900AA]" : "text-slate-800"
}`}
>
{card.title}
</p>

                            </div>

                
                    );
                  })}
              </div>

            </div>
          </section>

      {/* Explore Cuisines — only after Restaurant is selected in Explore Dining */}
      {exploreCardId === "restaurant" && cuisineCards.length > 0 && (
        <div className="w-full bg-white border-b border-slate-100">
          <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 py-5 sm:py-6">
            <section id="explore-cuisines" className="scroll-mt-24">
              <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4 md:mb-5">
                <h2 className="font-bold text-[#1A1A1A] text-base sm:text-lg md:text-xl min-w-0 truncate">
                  Explore Cuisines
                </h2>
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  {cuisinesScroll.left && (
                  <button
                    type="button"
                    aria-label="Previous cuisines"
                    onClick={() => scrollCuisines("left")}
                    className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                  >
                    <ChevronLeft className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  </button>
                  )}
                  {cuisinesScroll.right && (
                  <button
                    type="button"
                    aria-label="Next cuisines"
                    onClick={() => scrollCuisines("right")}
                    className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
                  >
                    <ChevronRight className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                  </button>
                  )}
                </div>
              </div>
              <div
                ref={cuisinesRef}
                className="flex gap-3 sm:gap-5 md:gap-6 lg:gap-8 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-0 -mx-1 px-1"
              >
                {cuisineCards.map((item) => {
                  const isActive = diningFilters.cuisines.some(
                    (selected) => selected.toLowerCase() === item.name.toLowerCase()
                  );
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => handleCuisineSelect(item.name)}
                      className="shrink-0 snap-start flex flex-col items-center w-[72px] sm:w-[96px] md:w-[112px] lg:w-[124px] cursor-pointer group"
                    >
                      <span
                        className={`w-[64px] h-[64px] sm:w-[84px] sm:h-[84px] md:w-[100px] md:h-[100px] lg:w-[112px] lg:h-[112px] rounded-full overflow-hidden bg-white shadow-[0_6px_16px_rgba(15,23,42,0.1)] ${
                          isActive ? "ring-2 ring-[#6900AA] ring-offset-1 sm:ring-offset-2" : ""
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
                      <span className="mt-1.5 sm:mt-3 text-sm sm:text-lg lg:text-[1.1rem] font-semibold text-slate-500 text-center leading-tight line-clamp-2 w-full">
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div ref={cuisineStickySentinelRef} className="h-px w-full" aria-hidden />
            </section>
          </div>
        </div>
      )}

      {exploreCardId === "restaurant" && cuisineCards.length > 0 && (
        <div
          className={`dining-sticky-cuisine-names fixed left-0 right-0 z-40 bg-white border-b border-slate-100 shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-[opacity,transform] duration-200 ${
            showStickyCuisineNames
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 -translate-y-1 pointer-events-none"
          }`}
          style={siteHeaderHeight > 0 ? { top: siteHeaderHeight } : undefined}
          aria-hidden={!showStickyCuisineNames}
        >
          <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">
            <div className="relative py-2.5 sm:py-3">
              {stickyCuisinesScroll.left && (
                <button
                  type="button"
                  aria-label="Previous cuisines"
                  onClick={() => scrollCuisines("left")}
                  className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm items-center justify-center text-slate-600 hover:bg-slate-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              {stickyCuisinesScroll.right && (
                <button
                  type="button"
                  aria-label="Next cuisines"
                  onClick={() => scrollCuisines("right")}
                  className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm items-center justify-center text-slate-600 hover:bg-slate-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
              <div
                ref={stickyCuisinesRef}
                className="flex items-center gap-5 sm:gap-6 md:gap-8 overflow-x-auto scrollbar-hide scroll-smooth px-0.5"
              >
                {cuisineCards.map((item) => {
                  const isActive = diningFilters.cuisines.some(
                    (selected) => selected.toLowerCase() === item.name.toLowerCase()
                  );
                  return (
                    <button
                      key={`sticky-${item.name}`}
                      type="button"
                      onClick={() => handleCuisineSelect(item.name)}
                      className={`shrink-0 text-sm sm:text-base font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        isActive ? "text-[#6900AA]" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {showHomeExtras && (
      <div className="w-full" style={{ backgroundColor: PAGE_MUTED }}>
      <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 pt-5 pb-2">
        {/* ── 2. Collections (after hero) ──────────────────────────────────── */}
          <section className="w-full">
            {/* Mobile / tablet: title + All collections on one line, subtitle below */}
            <div className="lg:hidden mb-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-slate-800 shrink-0">Collections</h2>
                <Link
                  href={locationCity ? `/collections?city=${encodeURIComponent(locationCity)}` : "/collections"}
                  className="flex items-center gap-0.5 text-sm font-semibold text-[#6900AA] hover:text-[#57008E] transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                >
                  All collections <ChevronRight size={16} />
                </Link>
                    </div>
              <p className="text-sm text-slate-500 mt-0.5">
                Explore curated lists of top restaurants, cafes and bars
              </p>
              </div>

            {/* Desktop: title + subtitle left, All collections right */}
            <div className="hidden lg:flex items-center justify-between mb-2">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Collections</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Explore curated lists of top restaurants, cafes and bars
                </p>
              </div>
              <Link
                href={locationCity ? `/collections?city=${encodeURIComponent(locationCity)}` : "/collections"}
                className="flex items-center gap-1 text-sm font-semibold text-[#6900AA] hover:text-[#57008E] transition-colors cursor-pointer"
              >
                All collections <ChevronRight size={16} />
              </Link>
            </div>

            <div className="relative mt-5">
              {collectionsScroll.left && (
                <button
                  type="button"
                  onClick={() => scrollCollections("left")}
                  className="absolute left-0 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.18)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.22)] hidden md:flex items-center justify-center transition-shadow cursor-pointer"
                  aria-label="Scroll left"
                >
                  <ChevronLeft size={22} strokeWidth={1.75} />
                </button>
              )}

              <div
                ref={collectionsRef}
                className="overflow-x-auto pt-1 pb-4 scrollbar-hide scroll-smooth"
              >
                <div className="flex gap-4 w-max">
                  {collections.map((col) => (
                    <CollectionCard key={col.id} collection={col} city={activeCity} />
                  ))}
              </div>
              </div>

              {collectionsScroll.right && (
              <button
                type="button"
                  onClick={() => scrollCollections("right")}
                  className="absolute right-0 top-1/2 z-20 translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.18)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.22)] hidden md:flex items-center justify-center transition-shadow cursor-pointer"
                  aria-label="Scroll right"
              >
                  <ChevronRight size={22} strokeWidth={1.75} />
              </button>
              )}
            </div>
          </section>

        {/* ── 3. Tab section (hidden — categories live in Filter popup) ──── */}
       
        {/* <div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="relative">
              <div className="flex flex-nowrap items-center gap-2 sm:gap-2.5 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory py-1 px-1 pr-4">
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
                      className={`shrink-0 snap-start inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[12px] sm:text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                        isActive
                          ? "text-white"
                          : "bg-[#eef0f2] text-slate-700 hover:bg-slate-200"
                      }`}
                      style={isActive ? { backgroundColor: "#6900AA" } : undefined}
                    >
                      <TypeIcon size={16} color={isActive ? "#ffffff" : theme.accent} />
                    {displayName}
                </button>
              );
            })}
            </div>
          </div>
        </div>
        </div> */}
        
      </div>
      </div>
      )}

      <div className="w-full bg-white">
        {/* Sentinel: when it leaves the sticky offset, filter bar is "stuck" */}
        <div ref={filtersStickySentinelRef} className="h-px w-full" aria-hidden />
        {/* ── 4. Filter Section (full-bleed sticky bar; chips stay content-width) ─ */}
        <section
          id="dining-filters-bar"
          className="sticky z-30 w-full"
          style={{
            top:
              siteHeaderHeight +
              (showStickyCuisineNames ? 52 : 0),
            scrollMarginTop: Math.max(siteHeaderHeight, 96) + 8,
          }}
        >
          <div
            className={`dining-filters-sticky w-full transition-[background-color,border-color] duration-200 ${
              isFiltersStuck ? "is-stuck" : ""
            }`}
          >
            <div className="container mx-auto px-5 sm:px-0 lg:px-10 2xl:px-0 pt-4">
              <DiningFiltersBar
                cuisines={cuisineOptions}
                filters={diningFilters}
                onChange={(next) => {
                  setDiningFilters(next);
                  scrollToDiningBrowseViewport();
                }}
                onReset={() => setDiningFilters(DEFAULT_DINING_FILTERS)}
                categories={exploreDiningFilterCategories}
                categoriesSelected={activeCategories}
                onCategoriesChange={(next) => {
                  setActiveCategories(next);
                  setExploreCardId(exploreCardIdForCategories(next, businessTypes));
                  setCurrentPage(1);
                  scrollToDiningBrowseViewport();
                }}
                showSearch
                searchValue={searchInput}
                onSearchChange={setSearchInput}
                onSearchSubmit={(value) => {
                  setSearchInput(value);
                  setSearchQuery(value);
                  setCurrentPage(1);
                  scrollToDiningBrowseViewport();
                }}
                extraChips={[
                  ...(searchQuery
                    ? [
                        {
                          label: `Search: "${searchQuery}"`,
                          onClear: () => {
                            setSearchInput("");
                            setSearchQuery("");
                          },
                        },
                      ]
                    : []),
                  ...(mealOccasion
                    ? [
                        {
                          label:
                            MEAL_OCCASIONS.find((m) => m.id === mealOccasion)?.label || mealOccasion,
                          onClear: () => setMealOccasion(""),
                        },
                      ]
                    : []),
                ]}
                onClearExtras={() => {
                  setSearchInput("");
                  setSearchQuery("");
                  setMealOccasion("");
                }}
              />
            </div>
          </div>
        </section>

      <div className="container mx-auto px-5 sm:px-0 lg:px-10 2xl:px-0 py-5">
        <div >
          {/* ── 5. Offer Section ────────────────────────────────────────────── */}
          {showHomeExtras && homeOfferCards.length > 0 && (
            <section id="dining-offers" className="pt-3 pb-5 sm:pt-2 scroll-mt-24">
              {homeOfferCards.length > 3 ? (
                <div className="relative">
                  {offersScroll.left && (
                  <button
                    type="button"
                    aria-label="Previous offers"
                    onClick={() => scrollOffers("left")}
                    className="absolute left-0 sm:-left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md hidden md:flex items-center justify-center text-slate-700"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  )}
                  <div
                    ref={offersRef}
                    className="flex gap-4 sm:gap-5 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-1"
                  >
                    {homeOfferCards.map((card, idx) => (
                      <OfferPromoCard
                        key={card.id}
                        card={card}
                        locationCity={locationCity}
                        colorIndex={idx}
                        onSelect={applyOfferBucket}
                        className="shrink-0 snap-start w-[min(86vw,340px)] xl:w-[calc((100%-40px)/3)]"
                      />
                    ))}
                  </div>
                  {offersScroll.right && (
                  <button
                    type="button"
                    aria-label="Next offers"
                    onClick={() => scrollOffers("right")}
                    className="absolute right-0 sm:-right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white shadow-md hidden md:flex items-center justify-center text-slate-700"
                  >
                    <ChevronRight size={18} />
                  </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                  {homeOfferCards.map((card, idx) => (
                    <OfferPromoCard
                      key={card.id}
                      card={card}
                      locationCity={locationCity}
                      colorIndex={idx}
                      onSelect={applyOfferBucket}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── 6. Restaurant section ───────────────────────────────────────── */}
          <section id="restaurant-listings" className={`pb-3 ${showHomeExtras ? "" : "pt-2"}`}>
          <div className="mb-3">
            <h2 className="text-xl sm:text-2xl lg:text-xl font-bold text-slate-800">
              {getFilteredSectionTitle()}
            </h2>
            {usingDiningFallback ||
            (Boolean(activeCity) &&
              !cityBusinessesLoading &&
              citySectionBusinesses.length === 0) ? (
              <CitySectionEmptyNotice message="No dining options available in your city yet." />
            ) : (
              <p className="text-sm sm:text-base lg:text-sm text-slate-500 mt-0.5">
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
            )}
          </div>

          {businessesLoading && loadedRestaurants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
              <Loader2 size={36} className="animate-spin text-[#6900AA]" />
              <p className="text-sm font-medium">Loading top restaurants...</p>
            </div>
          ) : useStaticDining ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {staticDiningCards.map((place) => (
                <ShowcaseRestaurantCard key={place.id} place={place} />
              ))}
            </div>
          ) : displayRestaurants.length === 0 ? (
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
                    setSearchInput("");
                    setActiveCategories([]);
                    setExploreCardId("all-dining");
                    setDiningFilters(DEFAULT_DINING_FILTERS);
                    setMealOccasion("");
                    setLocationCity("");
                    setLocationLabel("All Cities");
                    localStorage.removeItem("selected_city");
                    window.dispatchEvent(new Event("selected_city_changed"));
                    setCurrentPage(1);
                    setLoadedRestaurants([]);
                  }}
                  className="bg-[#6900AA] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#57008E] transition-colors"
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
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayRestaurants.map((restaurant) => (
                <RestaurantCard key={restaurant.id} restaurant={restaurant} />
              ))}
            </div>
              {hasMoreRestaurants && (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => p + 1)}
                    disabled={loadingMore}
                    className="inline-flex items-center justify-center gap-2 min-w-[160px] px-8 py-3 rounded-full bg-[#6900AA] text-white text-sm font-semibold hover:bg-[#57008E] disabled:opacity-60 transition-colors"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More"
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
        </div>
      </div>
      </div>
    </div>
  );
}
// comment