import type { Business } from "@/services/api";
import {
  businessHasCustomerVisibleOffer,
  formatDiningOfferDiscount,
  isDiningOfferCustomerVisible,
  normalizeDiningOffers,
  type DiningOffer,
} from "@/lib/diningOffers";

export type SortOption = "relevance" | "rating" | "popular" | "costAsc" | "costDesc";

/** Homepage offer rail buckets — aggregate deals, not one card per restaurant. */
export type DiningOfferBucket =
  | "any"
  | "percent_upto_20"
  | "percent_upto_50"
  | "percent_high"
  | "flat";

export interface DiningFilterState {
  cuisines: string[];
  minRating: number;
  offersOnly: boolean;
  /** When set from homepage Offers rail, further narrows which offer restaurants show. */
  offerBucket: DiningOfferBucket | null;
  sort: SortOption;
  bookTable: boolean;
  pureVeg: boolean;
  servesAlcohol: boolean;
  maxCost: number;
}

export const DEFAULT_DINING_FILTERS: DiningFilterState = {
  cuisines: [],
  minRating: 0,
  offersOnly: false,
  offerBucket: null,
  sort: "relevance",
  bookTable: false,
  pureVeg: false,
  servesAlcohol: false,
  maxCost: 0,
};

export type DiningHomeOfferCard = {
  id: string;
  bucket: DiningOfferBucket;
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  restaurantCount: number;
};

function visibleOffersForBusiness(b: Business): DiningOffer[] {
  return normalizeDiningOffers(b.dining_offers).filter(isDiningOfferCustomerVisible);
}

function bestPercentOffer(offers: DiningOffer[]): number | null {
  const percents = offers
    .filter((o) => o.discount_type === "PERCENT" && o.discount_value != null)
    .map((o) => Number(o.discount_value));
  if (percents.length === 0) return null;
  return Math.max(...percents);
}

function bestFlatOffer(offers: DiningOffer[]): number | null {
  const flats = offers
    .filter((o) => o.discount_type === "FLAT" && o.discount_value != null)
    .map((o) => Number(o.discount_value));
  if (flats.length === 0) return null;
  return Math.max(...flats);
}

export function businessHasOffer(b: Business): boolean {
  return businessHasCustomerVisibleOffer(b.dining_offers);
}

export function businessMatchesOfferBucket(
  b: Business,
  bucket: DiningOfferBucket | null
): boolean {
  if (!bucket) return businessHasOffer(b);
  const offers = visibleOffersForBusiness(b);
  if (offers.length === 0) return false;

  if (bucket === "any") return true;
  if (bucket === "flat") {
    return offers.some((o) => o.discount_type === "FLAT" && o.discount_value != null);
  }
  if (bucket === "percent_upto_20") {
    return offers.some(
      (o) =>
        o.discount_type === "PERCENT" &&
        o.discount_value != null &&
        Number(o.discount_value) > 0 &&
        Number(o.discount_value) <= 20
    );
  }
  if (bucket === "percent_upto_50") {
    return offers.some(
      (o) =>
        o.discount_type === "PERCENT" &&
        o.discount_value != null &&
        Number(o.discount_value) > 0 &&
        Number(o.discount_value) <= 50
    );
  }
  if (bucket === "percent_high") {
    return offers.some(
      (o) =>
        o.discount_type === "PERCENT" &&
        o.discount_value != null &&
        Number(o.discount_value) > 50
    );
  }
  return false;
}

/** Build marketing-style offer cards from live restaurant dining_offers. */
export function buildDiningHomeOfferCards(businesses: Business[]): DiningHomeOfferCard[] {
  const withOffers = businesses.filter((b) => businessHasOffer(b));
  if (withOffers.length === 0) return [];

  let maxPercent = 0;
  let maxFlat = 0;
  for (const b of withOffers) {
    const offers = visibleOffersForBusiness(b);
    const pct = bestPercentOffer(offers);
    const flat = bestFlatOffer(offers);
    if (pct != null) maxPercent = Math.max(maxPercent, pct);
    if (flat != null) maxFlat = Math.max(maxFlat, flat);
  }

  const countUpto20 = withOffers.filter((b) =>
    businessMatchesOfferBucket(b, "percent_upto_20")
  ).length;
  const countUpto50 = withOffers.filter((b) =>
    businessMatchesOfferBucket(b, "percent_upto_50")
  ).length;
  const countHigh = withOffers.filter((b) =>
    businessMatchesOfferBucket(b, "percent_high")
  ).length;
  const countFlat = withOffers.filter((b) => businessMatchesOfferBucket(b, "flat")).length;

  const cards: DiningHomeOfferCard[] = [];

  if (countUpto20 > 0) {
    cards.push({
      id: "percent_upto_20",
      bucket: "percent_upto_20",
      badge: "Limited Offer",
      title: "Save up to 20% Off",
      subtitle: `${countUpto20} restaurant${countUpto20 === 1 ? "" : "s"} with deals up to 20%`,
      cta: "View Offers",
      restaurantCount: countUpto20,
    });
  }

  if (countUpto50 > 0 && maxPercent > 20) {
    cards.push({
      id: "percent_upto_50",
      bucket: "percent_upto_50",
      badge: "Weekend Special",
      title: "Save up to 50% Off",
      subtitle: `${countUpto50} restaurant${countUpto50 === 1 ? "" : "s"} with deals up to 50%`,
      cta: "Explore Offers",
      restaurantCount: countUpto50,
    });
  }

  if (countHigh > 0) {
    const displayMax = Math.min(100, Math.ceil(maxPercent / 5) * 5);
    cards.push({
      id: "percent_high",
      bucket: "percent_high",
      badge: "Big Savings",
      title: `Save up to ${displayMax}% Off`,
      subtitle: `${countHigh} restaurant${countHigh === 1 ? "" : "s"} with over 50% off`,
      cta: "Grab Deal",
      restaurantCount: countHigh,
    });
  }

  if (countFlat > 0) {
    cards.push({
      id: "flat",
      bucket: "flat",
      badge: "Flat Deal",
      title: maxFlat > 0 ? `Flat ${maxFlat} ETB OFF` : "Flat ETB Off",
      subtitle: `${countFlat} restaurant${countFlat === 1 ? "" : "s"} with fixed cash discounts`,
      cta: "View Offers",
      restaurantCount: countFlat,
    });
  }

  cards.push({
    id: "any",
    bucket: "any",
    badge: "Special Offers",
    title: "Special Offers",
    subtitle: `${withOffers.length} restaurant${withOffers.length === 1 ? "" : "s"} with dining promo codes`,
    cta: "Explore Offers",
    restaurantCount: withOffers.length,
  });

  const preferred = cards.filter((c) => c.bucket !== "any");
  const special = cards.find((c) => c.bucket === "any");
  const top = preferred.slice(0, 3);
  if (special) top.push(special);
  return top.length > 0 ? top : cards;
}

export function offerBucketSectionTitle(bucket: DiningOfferBucket | null): string | null {
  if (!bucket) return null;
  if (bucket === "any") return "Restaurants with Special Offers";
  if (bucket === "percent_upto_20") return "Up to 20% Off";
  if (bucket === "percent_upto_50") return "Up to 50% Off";
  if (bucket === "percent_high") return "Over 50% Off";
  if (bucket === "flat") return "Flat ETB Offers";
  return null;
}

export function offerDiscountPreview(offer: DiningOffer): string {
  return formatDiningOfferDiscount(offer);
}

export function extractCuisines(businesses: Business[]): string[] {
  const set = new Set<string>();
  businesses.forEach((b) => {
    const raw = b.cuisine || "";
    raw.split(/[·,|/]/).forEach((part) => {
      const cleaned = part.trim();
      if (cleaned) set.add(cleaned);
    });
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function businessText(b: Business): string {
  const amenities = (b.amenities || []).join(" ");
  return `${b.name || ""} ${b.cuisine || ""} ${b.type_name || ""} ${b.description || ""} ${amenities}`.toLowerCase();
}

export function applyDiningFilters(
  businesses: Business[],
  filters: DiningFilterState
): Business[] {
  let list = businesses.filter((r) => {
    const cuisine = r.cuisine || "";
    const rating = Number(r.rating || 0);
    const text = businessText(r);
    const cost = Number(r.average_cost || 0);

    const matchesCuisine =
      filters.cuisines.length === 0 ||
      filters.cuisines.some((selected) =>
        cuisine.toLowerCase().includes(selected.toLowerCase())
      );
    const matchesRating = !filters.minRating || rating >= filters.minRating;
    const matchesOffers =
      !filters.offersOnly && !filters.offerBucket
        ? true
        : filters.offerBucket
          ? businessMatchesOfferBucket(r, filters.offerBucket)
          : businessHasOffer(r);
    const matchesBookTable = !filters.bookTable || r.is_open !== false;
    const matchesVeg = !filters.pureVeg || /veg|vegetarian|jain/.test(text);
    const matchesAlcohol =
      !filters.servesAlcohol || /alcohol|bar|wine|beer|liquor|cocktail/.test(text);
    const matchesCost = !filters.maxCost || !cost || cost <= filters.maxCost;

    return (
      matchesCuisine &&
      matchesRating &&
      matchesOffers &&
      matchesBookTable &&
      matchesVeg &&
      matchesAlcohol &&
      matchesCost
    );
  });

  if (filters.sort === "rating") {
    list = [...list].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  } else if (filters.sort === "popular") {
    list = [...list].sort(
      (a, b) => Number(b.reviews_count || 0) - Number(a.reviews_count || 0)
    );
  } else if (filters.sort === "costAsc") {
    list = [...list].sort(
      (a, b) => Number(a.average_cost || 0) - Number(b.average_cost || 0)
    );
  } else if (filters.sort === "costDesc") {
    list = [...list].sort(
      (a, b) => Number(b.average_cost || 0) - Number(a.average_cost || 0)
    );
  } else {
    list = [...list].sort(
      (a, b) => Number(!!b.is_promoted) - Number(!!a.is_promoted)
    );
  }

  return list;
}
