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

function uploadsPathname(pathname: string): string | null {
  let p = pathname || "";
  if (p.startsWith("/public/uploads/")) p = p.replace(/^\/public/, "");
  if (p.startsWith("public/uploads/")) p = `/${p.replace(/^public\//, "")}`;
  if (p.startsWith("/uploads/")) return p;
  if (p.startsWith("uploads/")) return `/${p}`;
  return null;
}

/**
 * Normalize upload paths and API-hosted media URLs for browser display.
 * Always points `/uploads/...` at the backend origin (port 5000 locally),
 * never the Next.js frontend origin (port 3000).
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;

  const origin = getApiOrigin();
  let clean = url.trim();

  const relativeUploads = uploadsPathname(clean);
  if (relativeUploads) return `${origin}${relativeUploads}`;

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    try {
      const parsed = new URL(clean);
      const path = uploadsPathname(parsed.pathname);
      if (!path) return clean;

      // Rewrite frontend (3000) or any localhost / known API host uploads → active API origin
      const host = parsed.hostname.toLowerCase();
      const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
      const isFrontendDevPort = isLocalHostName(host) && (port === "3000" || port === "3001");
      if (isFrontendDevPort || isBookMyBotaApiHost(host)) {
        return `${origin}${path}${parsed.search}`;
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

  const asUploads = uploadsPathname(url);
  if (asUploads) return asUploads;

  try {
    const parsed = new URL(url);
    const path = uploadsPathname(parsed.pathname);
    if (path) return path;
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
