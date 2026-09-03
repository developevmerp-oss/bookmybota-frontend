import {
  getApiOrigin,
  LOCAL_API_BASE_URL,
  PRODUCTION_API_BASE_URL,
} from "@/lib/apiBaseUrl";

const KNOWN_API_HOSTS = new Set(
  [LOCAL_API_BASE_URL, PRODUCTION_API_BASE_URL]
    .map((base) => {
      try {
        return new URL(base).hostname.toLowerCase();
      } catch {
        return "";
      }
    })
    .filter(Boolean)
);

function isLocalHostName(host: string) {
  return host === "localhost" || host === "127.0.0.1";
}

function isBookMyBotaApiHost(host: string) {
  const h = host.toLowerCase();
  if (isLocalHostName(h)) return true;
  if (KNOWN_API_HOSTS.has(h)) return true;
  if (h.endsWith(".onrender.com")) return true;
  try {
    return new URL(getApiOrigin()).hostname.toLowerCase() === h;
  } catch {
    return false;
  }
}

/** Normalize upload paths and API-hosted media URLs for browser display. */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;

  const origin = getApiOrigin();

  if (url.startsWith("/uploads/")) return `${origin}${url}`;
  if (url.startsWith("uploads/")) return `${origin}/${url}`;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const parsed = new URL(url);
      // Rewrite API-hosted uploads (often saved as localhost) to the active API origin.
      if (isBookMyBotaApiHost(parsed.hostname) && parsed.pathname.startsWith("/uploads/")) {
        return `${origin}${parsed.pathname}${parsed.search}`;
      }
    } catch {
      /* keep original */
    }
    return url;
  }

  return url;
}

/** Store uploads as /uploads/... paths when possible (stable across hosts). */
export function normalizeUploadPath(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (url.startsWith("/uploads/")) return url;
  if (url.startsWith("uploads/")) return `/${url}`;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/uploads/")) return parsed.pathname;
  } catch {
    /* relative or invalid */
  }
  return url;
}

export function extractUploadUrl(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as { url?: string; data?: { url?: string } };
  return normalizeUploadPath(record.url || record.data?.url || "");
}
