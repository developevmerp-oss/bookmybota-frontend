import { clearCredentials } from '@/features/auth/authSlice';
import {
  clearSessionForRole,
  isArtistAdminPath,
  isMovieAdminPath,
  isVenueAdminPath,
  loginPathForRole,
  readSessionForRole,
  storageKeysForPath,
  type UserRole,
} from '@/lib/authStorage';
import type { AppDispatch } from '@/lib/store';

const LOGIN_AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register-customer',
  '/auth/phone-login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-otp',
  '/auth/resend-otp',
];

const LOGIN_FORM_ERRORS = new Set(['Invalid credentials', 'Invalid OTP']);

type AuthErrorData = { code?: string; error?: string } | undefined;

export function resolveRoleFromPath(pathname: string): UserRole {
  if (pathname.startsWith('/admin')) return 'super_admin';
  if (pathname.startsWith('/organizer')) return 'event_admin';
  if (isMovieAdminPath(pathname)) return 'movie_admin';
  if (isVenueAdminPath(pathname)) return 'venue_admin';
  if (isArtistAdminPath(pathname)) return 'artist_admin';
  if (pathname.startsWith('/business')) return 'business_admin';
  if (pathname.startsWith('/customer')) return 'customer';
  return 'customer';
}

export function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/business') ||
    pathname.startsWith('/organizer') ||
    isMovieAdminPath(pathname) ||
    isVenueAdminPath(pathname) ||
    isArtistAdminPath(pathname) ||
    pathname.startsWith('/customer')
  );
}

/**
 * Customer account / private routes — leave these after logout.
 * Public browse pages (/, /events, /gift-cards, dining, etc.) stay put.
 */
export function isCustomerPrivatePath(pathname: string): boolean {
  if (!pathname.startsWith('/customer')) return false;
  // Post-checkout receipts stay reachable without login
  if (pathname.startsWith('/customer/bookings/confirmation')) return false;
  if (pathname.startsWith('/customer/event-bookings/confirmation')) return false;
  return true;
}

/**
 * Customer logout: clear session; redirect home only from private account pages.
 */
export function logoutCustomer(
  dispatch: AppDispatch,
  options?: { pathname?: string }
): void {
  if (typeof window === 'undefined') return;

  const pathname = options?.pathname ?? window.location.pathname;
  clearSessionForRole('customer');
  dispatch(clearCredentials());
  window.dispatchEvent(new Event('auth_changed'));
  window.dispatchEvent(new Event('storage'));

  if (isCustomerPrivatePath(pathname)) {
    window.location.replace('/');
  }
}

export function isLoginAuthRequest(url: string): boolean {
  return LOGIN_AUTH_ENDPOINTS.some((ep) => url.includes(ep));
}

export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    ) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function isAuthSessionError(
  status: number | string | undefined,
  data: AuthErrorData,
  pathname?: string
): boolean {
  if (status !== 401 || !data) return false;

  if (data.error && LOGIN_FORM_ERRORS.has(data.error)) return false;

  const path =
    pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  const { tokenKey } = storageKeysForPath(path);
  const hasToken =
    typeof window !== 'undefined' && Boolean(localStorage.getItem(tokenKey));

  if (data.code === 'ACCOUNT_DISABLED' || data.code === 'TOKEN_EXPIRED') return true;
  if (data.error === 'Invalid or expired token.') return true;

  if (data.error === 'Authentication required.' && hasToken) return true;

  if (
    data.error === 'Customer authentication required.' &&
    readSessionForRole('customer')
  ) {
    return true;
  }

  return false;
}

let logoutInProgress = false;

/** All logged-in dashboard areas (matches storageKeysForPath). */
export function isManagedPanelPath(pathname: string): boolean {
  return isProtectedPath(pathname);
}

/**
 * Single handler for expired/invalid sessions and disabled accounts.
 * Disabled accounts on any panel → clear session and redirect home.
 * Other session errors → role login page via forceLogout.
 */
export function handleAuthSessionFailure(
  role: UserRole,
  dispatch: AppDispatch,
  data: AuthErrorData,
  pathname?: string
): void {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');

  if (data?.code === 'ACCOUNT_DISABLED' && isManagedPanelPath(path)) {
    if (typeof window === 'undefined' || logoutInProgress) return;
    logoutInProgress = true;
    clearSessionForRole(role);
    dispatch(clearCredentials());
    window.dispatchEvent(new Event('auth_changed'));
    window.location.replace('/');
    return;
  }

  forceLogout(role, dispatch, { pathname: path });
}

export function forceLogout(
  role: UserRole,
  dispatch: AppDispatch,
  options?: { redirect?: boolean; pathname?: string }
): void {
  if (typeof window === 'undefined' || logoutInProgress) return;

  logoutInProgress = true;
  clearSessionForRole(role);
  dispatch(clearCredentials());
  window.dispatchEvent(new Event('auth_changed'));

  const pathname = options?.pathname ?? window.location.pathname;
  const shouldRedirect = options?.redirect ?? isProtectedPath(pathname);

  if (shouldRedirect) {
    window.location.replace(loginPathForRole(role));
  } else {
    logoutInProgress = false;
  }
}
