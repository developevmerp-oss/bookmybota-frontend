/**
 * Single source of truth for backend API host selection.
 *
 * Priority:
 * 1. NEXT_PUBLIC_API_BASE_URL (or legacy NEXT_PUBLIC_API_URL)
 * 2. development / local → http://localhost:5000/api
 * 3. production → https://bookmybota-backend.onrender.com/api
 */

export const LOCAL_API_BASE_URL = "http://localhost:5000/api";
export const PRODUCTION_API_BASE_URL = "https://bookmybota-backend.onrender.com/api";

function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return trimmed;
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}

function envApiBaseUrl(): string | undefined {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  return raw ? normalizeApiBaseUrl(raw) : undefined;
}

/** True when this build/runtime should talk to the local backend. */
export function isLocalApiEnvironment(): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  // Explicit live hosting markers (Vercel / similar).
  if (
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.NEXT_PUBLIC_FORCE_LIVE_API === "true"
  ) {
    return false;
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    // Any non-local browser host in a production build → live API.
    return false;
  }

  // Production build with no deploy marker (e.g. local `next start` SSR) → local API.
  return true;
}

/** Full API base including `/api`, e.g. `http://localhost:5000/api`. */
export function getApiBaseUrl(): string {
  const fromEnv = envApiBaseUrl();
  if (fromEnv) {
    if (
      process.env.NODE_ENV === "production" &&
      !isLocalApiEnvironment() &&
      /localhost|127\.0\.0\.1/i.test(fromEnv)
    ) {
      console.warn(
        "[api] NEXT_PUBLIC_API_BASE_URL points at localhost in a live deploy. Using production API instead."
      );
      return PRODUCTION_API_BASE_URL;
    }
    return fromEnv;
  }

  return isLocalApiEnvironment() ? LOCAL_API_BASE_URL : PRODUCTION_API_BASE_URL;
}

/** Backend origin without `/api`, for `/uploads/...` media URLs. */
export function getApiOrigin(): string {
  return getApiBaseUrl().replace(/\/api\/?$/i, "");
}
