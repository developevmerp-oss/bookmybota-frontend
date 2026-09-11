/** Resolve hold expiry for countdown UI. Prefer ttl_seconds (timezone-safe). */
export function resolveHoldExpiresAt(data: {
  expires_at?: string | null;
  ttl_seconds?: number | null;
}): string {
  const ttl = Number(data.ttl_seconds);
  if (Number.isFinite(ttl) && ttl > 0) {
    return new Date(Date.now() + ttl * 1000).toISOString();
  }

  const raw = String(data.expires_at || "").trim();
  if (!raw) {
    return new Date(Date.now() + 10 * 60 * 1000).toISOString();
  }

  // Postgres timestamp text without Z is often mis-parsed as local; force UTC if needed.
  const normalized =
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
      ? `${raw.replace(" ", "T")}Z`
      : raw;

  const ms = new Date(normalized).getTime();
  if (!Number.isFinite(ms)) {
    return new Date(Date.now() + 10 * 60 * 1000).toISOString();
  }
  return new Date(ms).toISOString();
}
