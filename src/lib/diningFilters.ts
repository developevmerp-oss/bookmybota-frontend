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

const OFFER_BUCKETS: DiningOfferBucket[] = [
  "any",
  "percent_upto_20",
  "percent_upto_50",
  "percent_high",
  "flat",
];

const SORT_OPTIONS: SortOption[] = ["relevance", "rating", "popular", "costAsc", "costDesc"];

/** Read dining filter state from URL search params. */
export function diningFiltersFromSearchParams(params: URLSearchParams): DiningFilterState {
  const cuisinesRaw = params.get("cuisines") || params.get("cuisine") || "";
  const cuisines = cuisinesRaw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const minRating = Number(params.get("rating") || 0) || 0;
  const maxCost = Number(params.get("max_cost") || 0) || 0;
  const sortRaw = (params.get("sort") || "relevance") as SortOption;
  const sort = SORT_OPTIONS.includes(sortRaw) ? sortRaw : "relevance";
  const bucketRaw = params.get("offer_bucket") as DiningOfferBucket | null;
  const offerBucket =
    bucketRaw && OFFER_BUCKETS.includes(bucketRaw) ? bucketRaw : null;
  return {
    cuisines,
    minRating: minRating > 0 ? minRating : 0,
    offersOnly: params.get("offers") === "1" || params.get("offers") === "true" || Boolean(offerBucket),
    offerBucket,
    sort,
    bookTable: params.get("book_table") === "1" || params.get("book_table") === "true",
    pureVeg: params.get("pure_veg") === "1" || params.get("pure_veg") === "true",
    servesAlcohol: params.get("alcohol") === "1" || params.get("alcohol") === "true",
    maxCost: maxCost > 0 ? maxCost : 0,
  };
}

/** Write dining filter fields onto URL search params (mutates params). */
export function writeDiningFiltersToSearchParams(
  params: URLSearchParams,
  filters: DiningFilterState
) {
  if (filters.cuisines.length) params.set("cuisines", filters.cuisines.join(","));
  else {
    params.delete("cuisines");
    params.delete("cuisine");
  }
  if (filters.minRating > 0) params.set("rating", String(filters.minRating));
  else params.delete("rating");
  if (filters.offerBucket) {
    params.set("offer_bucket", filters.offerBucket);
    params.set("offers", "1");
  } else {
    params.delete("offer_bucket");
    if (filters.offersOnly) params.set("offers", "1");
    else params.delete("offers");
  }
  if (filters.sort && filters.sort !== "relevance") params.set("sort", filters.sort);
  else params.delete("sort");
  if (filters.bookTable) params.set("book_table", "1");
  else params.delete("book_table");
  if (filters.pureVeg) params.set("pure_veg", "1");
  else params.delete("pure_veg");
  if (filters.servesAlcohol) params.set("alcohol", "1");
  else params.delete("alcohol");
  if (filters.maxCost > 0) params.set("max_cost", String(filters.maxCost));
  else params.delete("max_cost");
}

export function diningFiltersEqual(a: DiningFilterState, b: DiningFilterState): boolean {
  if (a.minRating !== b.minRating) return false;
  if (a.offersOnly !== b.offersOnly) return false;
  if (a.offerBucket !== b.offerBucket) return false;
  if (a.sort !== b.sort) return false;
  if (a.bookTable !== b.bookTable) return false;
  if (a.pureVeg !== b.pureVeg) return false;
  if (a.servesAlcohol !== b.servesAlcohol) return false;
  if (a.maxCost !== b.maxCost) return false;
  if (a.cuisines.length !== b.cuisines.length) return false;
  const sa = [...a.cuisines].map((c) => c.toLowerCase()).sort();
  const sb = [...b.cuisines].map((c) => c.toLowerCase()).sort();
  return sa.every((v, i) => v === sb[i]);
}

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

  // Specific buckets only — no catch-all "Special Offers" card (that duplicates % + flat).
  return cards.slice(0, 3);
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

export function applyDiningFilters(
  businesses: Business[],
  filters: DiningFilterState
): Business[] {
  let list = businesses.filter((r) => {
    const cuisine = r.cuisine || "";
    const rating = Number(r.rating || 0);
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
    const amenityText = (r.amenities || []).join(" ");
    const vegHay = `${r.name || ""} ${r.cuisine || ""} ${amenityText}`.toLowerCase();
    const alcoholHay = `${r.name || ""} ${r.cuisine || ""} ${r.type_name || ""} ${amenityText}`.toLowerCase();
    const matchesVeg =
      !filters.pureVeg ||
      /pure\s*veg|\bjain\b/.test(vegHay) ||
      (/\bvegetarian\b/.test(vegHay) && !/vegetarian\s*friendly/.test(vegHay));
    const matchesAlcohol =
      !filters.servesAlcohol ||
      /full\s*bar|\balcohol\b|\bbar\b|\bwine\b|\bbeer\b|\bliquor\b|\bcocktail\b|\bpub\b|\blounge\b/.test(alcoholHay);
    const matchesCost = !filters.maxCost || (cost > 0 && cost <= filters.maxCost);

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
