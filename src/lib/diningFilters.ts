import type { Business } from "@/services/api";

export type SortOption = "relevance" | "rating" | "popular" | "costAsc" | "costDesc";

export interface DiningFilterState {
  cuisines: string[];
  minRating: number;
  offersOnly: boolean;
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
  sort: "relevance",
  bookTable: false,
  pureVeg: false,
  servesAlcohol: false,
  maxCost: 0,
};

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

export function businessHasOffer(b: Business): boolean {
  return Boolean(b.dining_offers && b.dining_offers.some((offer) => Boolean(offer?.title?.trim())));
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
    const matchesOffers = !filters.offersOnly || businessHasOffer(r);
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
