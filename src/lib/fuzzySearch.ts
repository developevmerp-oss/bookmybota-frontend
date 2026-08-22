import Fuse, { type FuseOptionKey } from 'fuse.js';

export function fuzzyFilter<T>(
  items: T[],
  query: string,
  keys: FuseOptionKey<T>[],
  options?: { threshold?: number; limit?: number }
): T[] {
  const q = query.trim();
  if (!q) return items.slice(0, options?.limit ?? 50);
  const fuse = new Fuse(items, {
    keys,
    threshold: options?.threshold ?? 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });
  return fuse.search(q, { limit: options?.limit ?? 30 }).map((r) => r.item);
}
