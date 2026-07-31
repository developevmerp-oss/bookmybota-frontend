import type { Business } from "@/services/api";

export type SortOption = "relevance" | "rating" | "popular";

export interface DiningFilterState {
  cuisine: string;
  minRating: number;
  offersOnly: boolean;
  sort: SortOption;
}

export const DEFAULT_DINING_FILTERS: DiningFilterState = {
  cuisine: "",
  minRating: 0,
  offersOnly: false,
  sort: "relevance",
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
  if (b.dining_offers && b.dining_offers.length > 0) return true;
  const idHash = b.id
    ? b.id.toString().split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    : 0;
  return idHash % 3 === 0 || idHash % 5 === 0;
}

export function applyDiningFilters(
  businesses: Business[],
  filters: DiningFilterState
): Business[] {
  let list = businesses.filter((r) => {
    const cuisine = r.cuisine || "";
    const rating = Number(r.rating || 0);

    const matchesCuisine =
      !filters.cuisine ||
      cuisine.toLowerCase().includes(filters.cuisine.toLowerCase());
    const matchesRating = !filters.minRating || rating >= filters.minRating;
    const matchesOffers = !filters.offersOnly || businessHasOffer(r);

    return matchesCuisine && matchesRating && matchesOffers;
  });

  if (filters.sort === "rating") {
    list = [...list].sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
  } else if (filters.sort === "popular") {
    list = [...list].sort(
      (a, b) => Number(b.reviews_count || 0) - Number(a.reviews_count || 0)
    );
  }

  return list;
}
