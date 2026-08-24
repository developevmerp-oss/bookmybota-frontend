export const PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_prev: boolean;
  has_next: boolean;
};

export type PaginatedList<T> = {
  items: T[];
  meta: PaginationMeta;
};

export const EMPTY_PAGE_META: PaginationMeta = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  total_pages: 0,
  has_prev: false,
  has_next: false,
};

export function unwrapPaginated<T>(
  res: { data?: T[]; meta?: PaginationMeta } | undefined
): PaginatedList<T> {
  const items = res?.data ?? [];
  return {
    items,
    meta:
      res?.meta ?? {
        ...EMPTY_PAGE_META,
        total: items.length,
        limit: Math.max(items.length, 1),
        total_pages: items.length ? 1 : 0,
      },
  };
}

export function toListQuery(
  params: Record<string, string | number | undefined | null>
): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    sp.set(key, String(value));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export type PagedQuery = {
  q?: string;
  page?: number;
  limit?: number;
};

export type PagedBizQuery = string | ({ bizId: string } & PagedQuery);

export function bizIdOf(arg: PagedBizQuery): string {
  return typeof arg === "string" ? arg : arg.bizId;
}

export function pagedBizQuery(arg: PagedBizQuery): string {
  if (typeof arg === "string") return "";
  return toListQuery({ q: arg.q, page: arg.page, limit: arg.limit });
}
