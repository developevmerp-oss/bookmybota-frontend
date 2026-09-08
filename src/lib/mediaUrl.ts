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

  let clean = url.trim();
  if (clean.startsWith("/public/uploads/")) clean = clean.replace(/^\/public/, "");
  else if (clean.startsWith("public/uploads/")) clean = clean.replace(/^public\//, "/");

  if (clean.startsWith("/uploads/")) return `${origin}${clean}`;
  if (clean.startsWith("uploads/")) return `${origin}/${clean}`;

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    try {
      const parsed = new URL(clean);
      let pathname = parsed.pathname;
      if (pathname.startsWith("/public/uploads/")) {
        pathname = pathname.replace(/^\/public/, "");
      }
      // Rewrite API-hosted uploads (often saved as localhost) to the active API origin.
      if (isBookMyBotaApiHost(parsed.hostname) && pathname.startsWith("/uploads/")) {
        return `${origin}${pathname}${parsed.search}`;
      }
    } catch {
      /* keep original */
    }
    return clean;
  }

  return clean;
}

/** Store uploads as /uploads/... paths when possible (stable across hosts).
 *  Keep absolute CDN URLs (e.g. Cloudinary) unchanged. */
export function normalizeUploadPath(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (url.startsWith("/uploads/")) return url;
  if (url.startsWith("uploads/")) return `/${url}`;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/uploads/")) return parsed.pathname;
    // Cloudinary / external CDN — persist full URL
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
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
