const GUEST_WISHLIST_KEY = "dining_saved_restaurants";

export function readGuestDiningWishlistIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids)) return [];
    return [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

export function writeGuestDiningWishlistIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      GUEST_WISHLIST_KEY,
      JSON.stringify([...new Set(ids.map(String).filter(Boolean))])
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearGuestDiningWishlistIds() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_WISHLIST_KEY);
  } catch {
    /* ignore */
  }
}

export { GUEST_WISHLIST_KEY };
