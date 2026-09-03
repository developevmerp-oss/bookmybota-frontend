const GUEST_WISHLIST_KEY = "movie_detail_favorites";

/** Legacy static catalog ids (e.g. s1, s2) from pre-API movie pages */
const LEGACY_STATIC_MOVIE_ID = /^s\d+$/i;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistableMovieWishlistId(id: string): boolean {
  const trimmed = String(id || "").trim();
  if (!trimmed || LEGACY_STATIC_MOVIE_ID.test(trimmed)) return false;
  return UUID_RE.test(trimmed) || trimmed.length >= 3;
}

export function readGuestMovieWishlistIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_WISHLIST_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(ids)) return [];
    const cleaned = [
      ...new Set(
        ids
          .map((id) => String(id || "").trim())
          .filter(isPersistableMovieWishlistId)
      ),
    ];
    if (cleaned.length !== ids.filter(Boolean).length) {
      writeGuestMovieWishlistIds(cleaned);
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function writeGuestMovieWishlistIds(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      GUEST_WISHLIST_KEY,
      JSON.stringify([
        ...new Set(ids.map(String).filter(Boolean).filter(isPersistableMovieWishlistId)),
      ])
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearGuestMovieWishlistIds() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_WISHLIST_KEY);
  } catch {
    /* ignore */
  }
}

export { GUEST_WISHLIST_KEY };
