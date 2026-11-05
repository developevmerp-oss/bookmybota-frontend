const CINEMA_FAVORITES_KEY = "movie_cinema_favorites";
const CINEMA_FAVORITES_ITEMS_KEY = "movie_cinema_favorites_items";

export type SavedCinemaItem = {
  id: string;
  name: string;
  address?: string;
  cover_image_url?: string;
  slug?: string;
  href?: string;
};

export function readCinemaFavoriteIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CINEMA_FAVORITES_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids)) return [];
    return Array.from(
      new Set(
        ids
          .map((id) => (id == null ? "" : String(id).trim()))
          .filter(Boolean)
      )
    );
  } catch {
    return [];
  }
}

export function writeCinemaFavoriteIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    const unique = Array.from(
      new Set(
        ids
          .map((id) => (id == null ? "" : String(id).trim()))
          .filter(Boolean)
      )
    );
    localStorage.setItem(CINEMA_FAVORITES_KEY, JSON.stringify(unique));
    window.dispatchEvent(new CustomEvent("movie_cinema_favorites_changed", { detail: unique }));
    window.dispatchEvent(new Event("storage"));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readCinemaFavoriteItems(): SavedCinemaItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CINEMA_FAVORITES_ITEMS_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (item): item is SavedCinemaItem =>
        Boolean(item && typeof item === "object" && ("id" in item || "name" in item))
    );
  } catch {
    return [];
  }
}

export function writeCinemaFavoriteItems(items: SavedCinemaItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CINEMA_FAVORITES_ITEMS_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("movie_cinema_favorites_changed"));
    window.dispatchEvent(new Event("storage"));
  } catch {
    /* ignore quota / private mode */
  }
}

export function isCinemaFavorited(
  cinemaIdOrKeys: string | string[],
  currentFavorites?: string[]
): boolean {
  const favorites = currentFavorites ?? readCinemaFavoriteIds();
  const keys = Array.isArray(cinemaIdOrKeys) ? cinemaIdOrKeys : [cinemaIdOrKeys];
  const cleaned = keys.map((k) => (k == null ? "" : String(k).trim().toLowerCase())).filter(Boolean);
  if (cleaned.length === 0) return false;

  return favorites.some((fav) => {
    const favKey = String(fav).trim().toLowerCase();
    return cleaned.includes(favKey);
  });
}

export function toggleCinemaFavorite(
  storageIdOrCinema: string | SavedCinemaItem,
  legacyKeys: string[] = []
): { wishlisted: boolean; ids: string[]; items: SavedCinemaItem[] } {
  const isObject = typeof storageIdOrCinema === "object" && storageIdOrCinema !== null;
  const cinemaObj = isObject ? (storageIdOrCinema as SavedCinemaItem) : null;
  const storageId = isObject ? cinemaObj!.id : String(storageIdOrCinema).trim();

  const currentIds = readCinemaFavoriteIds();
  const currentItems = readCinemaFavoriteItems();

  const keysToRemove = new Set([
    storageId.toLowerCase(),
    ...(cinemaObj?.slug ? [cinemaObj.slug.toLowerCase()] : []),
    ...(cinemaObj?.name ? [cinemaObj.name.toLowerCase()] : []),
    ...(cinemaObj?.href ? [cinemaObj.href.split("/").pop()!.toLowerCase()] : []),
    ...legacyKeys.map((k) => String(k).trim().toLowerCase()).filter(Boolean),
  ]);

  const alreadySaved = currentIds.some((id) => keysToRemove.has(String(id).trim().toLowerCase())) ||
    currentItems.some((item) =>
      keysToRemove.has(item.id.toLowerCase()) ||
      (item.slug && keysToRemove.has(item.slug.toLowerCase())) ||
      (item.name && keysToRemove.has(item.name.toLowerCase()))
    );

  let nextIds: string[];
  let nextItems: SavedCinemaItem[];

  if (alreadySaved) {
    nextIds = currentIds.filter((id) => !keysToRemove.has(String(id).trim().toLowerCase()));
    nextItems = currentItems.filter((item) => {
      const idMatch = keysToRemove.has(item.id.toLowerCase());
      const slugMatch = item.slug ? keysToRemove.has(item.slug.toLowerCase()) : false;
      const nameMatch = item.name ? keysToRemove.has(item.name.toLowerCase()) : false;
      return !idMatch && !slugMatch && !nameMatch;
    });
  } else {
    const newKeys = [storageId];
    if (cinemaObj?.slug) newKeys.push(cinemaObj.slug);
    if (cinemaObj?.name) newKeys.push(cinemaObj.name);
    nextIds = Array.from(new Set([...currentIds, ...newKeys]));

    const newItem: SavedCinemaItem = cinemaObj || {
      id: storageId,
      name: storageId,
    };
    nextItems = [
      ...currentItems.filter((it) => it.id !== newItem.id),
      newItem,
    ];
  }

  writeCinemaFavoriteIds(nextIds);
  writeCinemaFavoriteItems(nextItems);

  return { wishlisted: !alreadySaved, ids: nextIds, items: nextItems };
}

export { CINEMA_FAVORITES_KEY, CINEMA_FAVORITES_ITEMS_KEY };
