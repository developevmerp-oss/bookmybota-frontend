export const EVENT_CATEGORY_OPTIONS = [
  { key: "concert", label: "Concert" },
  { key: "comedy", label: "Comedy" },
  { key: "music", label: "Music" },
  { key: "sports", label: "Sports" },
] as const;

export type EventCategoryKey = (typeof EVENT_CATEGORY_OPTIONS)[number]["key"];

export function isEventCategoryKey(value: string): value is EventCategoryKey {
  return EVENT_CATEGORY_OPTIONS.some((opt) => opt.key === value.toLowerCase());
}

export function resolveCategorySlug(
  key: string,
  categories: Array<{ slug: string; name: string }>
): string {
  const normalized = key.trim().toLowerCase();
  const match = categories.find((c) => {
    const slug = c.slug.toLowerCase();
    const name = c.name.toLowerCase();
    return slug === normalized || name === normalized || slug.includes(normalized) || name.includes(normalized);
  });
  return match?.slug || key;
}

export function normalizeCategoryParam(
  param: string,
  categories: Array<{ slug: string; name: string }>
): string {
  const direct = categories.find((c) => c.slug.toLowerCase() === param.trim().toLowerCase());
  if (direct) return direct.slug;
  return resolveCategorySlug(param, categories);
}

export function categorySlugsMatch(
  a: string,
  b: string,
  categories: Array<{ slug: string; name: string }>
): boolean {
  return (
    normalizeCategoryParam(a, categories).toLowerCase() ===
    normalizeCategoryParam(b, categories).toLowerCase()
  );
}

export function eventCategoryHref(
  key: EventCategoryKey,
  categories: Array<{ slug: string; name: string }>
): string {
  const slug = resolveCategorySlug(key, categories);
  return `/events?category=${encodeURIComponent(slug)}`;
}

/** Map an API/URL category slug back to a known event category key. */
export function resolveCategoryKeyFromSlug(
  slug: string,
  categories: Array<{ slug: string; name: string }>
): EventCategoryKey | null {
  for (const opt of EVENT_CATEGORY_OPTIONS) {
    if (categorySlugsMatch(slug, resolveCategorySlug(opt.key, categories), categories)) {
      return opt.key;
    }
  }
  return null;
}
