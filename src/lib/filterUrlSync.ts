/** Build a stable query string for comparing filter URLs (order-independent). */
export function stableSearchParamsString(params: URLSearchParams | string): string {
  const src =
    typeof params === "string" ? new URLSearchParams(params) : new URLSearchParams(params.toString());
  const keys = Array.from(new Set(Array.from(src.keys()))).sort();
  const next = new URLSearchParams();
  for (const key of keys) {
    const values = src.getAll(key).map((v) => v.trim()).filter(Boolean).sort();
    for (const value of values) next.append(key, value);
  }
  return next.toString();
}

export function setOrDeleteParam(
  params: URLSearchParams,
  key: string,
  value: string | null | undefined
) {
  const v = (value || "").trim();
  if (v) params.set(key, v);
  else params.delete(key);
}

export function setOrDeleteCsvParam(
  params: URLSearchParams,
  key: string,
  values: string[] | null | undefined
) {
  const list = (values || []).map((v) => v.trim()).filter(Boolean);
  if (list.length) params.set(key, list.join(","));
  else params.delete(key);
}

export function parseCsvParam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function sameStringList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].map((v) => v.trim().toLowerCase()).sort();
  const sb = [...b].map((v) => v.trim().toLowerCase()).sort();
  return sa.every((v, i) => v === sb[i]);
}
