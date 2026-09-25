/**
 * Public SEO-friendly path for partner businesses.
 * Prefers slug when present; falls back to UUID for legacy rows.
 */
export function businessPublicPath(
  kind: "restaurant" | "venues" | "artists" | "cinemas",
  entity: { id?: string | null; slug?: string | null } | null | undefined
): string {
  const key = String(entity?.slug || entity?.id || "").trim();
  if (!key) {
    if (kind === "restaurant") return "/dining";
    if (kind === "venues") return "/venues";
    if (kind === "artists") return "/artists";
    return "/movies/cinemas";
  }
  if (kind === "cinemas") return `/movies/cinemas/${encodeURIComponent(key)}`;
  return `/${kind}/${encodeURIComponent(key)}`;
}

export function restaurantHref(entity: { id?: string | null; slug?: string | null } | null | undefined) {
  return businessPublicPath("restaurant", entity);
}

export function venueHref(entity: { id?: string | null; slug?: string | null } | null | undefined) {
  return businessPublicPath("venues", entity);
}

export function artistHref(entity: { id?: string | null; slug?: string | null } | null | undefined) {
  return businessPublicPath("artists", entity);
}

export function cinemaHref(entity: { id?: string | null; slug?: string | null } | null | undefined) {
  return businessPublicPath("cinemas", entity);
}
