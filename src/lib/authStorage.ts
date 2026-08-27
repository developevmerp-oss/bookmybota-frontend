/** Role-scoped auth storage + redirect helpers */

export type UserRole =
  | 'super_admin'
  | 'business_admin'
  | 'event_admin'
  | 'venue_admin'
  | 'artist_admin'
  | 'movie_admin'
  | 'customer';

export interface StoredAuthUser {
  id: string;
  email: string;
  role: UserRole;
  business_id?: string;
  customer_id?: string;
  name?: string;
  phone?: string;
}

const ROLE_PRIORITY: UserRole[] = [
  'super_admin',
  'event_admin',
  'movie_admin',
  'venue_admin',
  'artist_admin',
  'business_admin',
  'customer',
];

export function storageKeysForRole(role: UserRole | string) {
  switch (role) {
    case 'super_admin':
      return { tokenKey: 'token_super_admin', userKey: 'user_super_admin' };
    case 'business_admin':
      return { tokenKey: 'token_business_admin', userKey: 'user_business_admin' };
    case 'event_admin':
      return { tokenKey: 'token_event_admin', userKey: 'user_event_admin' };
    case 'venue_admin':
      return { tokenKey: 'token_venue_admin', userKey: 'user_venue_admin' };
    case 'artist_admin':
      return { tokenKey: 'token_artist_admin', userKey: 'user_artist_admin' };
    case 'movie_admin':
      return { tokenKey: 'token_movie_admin', userKey: 'user_movie_admin' };
    default:
      return { tokenKey: 'token_customer', userKey: 'user_customer' };
  }
}

/** Partner admin panels use singular paths — not plural customer listings. */
export function isArtistAdminPath(pathname: string): boolean {
  return pathname === '/artist' || pathname.startsWith('/artist/');
}

export function isVenueAdminPath(pathname: string): boolean {
  return pathname === '/venue' || pathname.startsWith('/venue/');
}

export function isMovieAdminPath(pathname: string): boolean {
  return pathname === '/movie' || pathname.startsWith('/movie/');
}

export function storageKeysForPath(pathname: string) {
  if (pathname.startsWith('/admin')) return storageKeysForRole('super_admin');
  if (pathname.startsWith('/organizer')) return storageKeysForRole('event_admin');
  if (isMovieAdminPath(pathname)) return storageKeysForRole('movie_admin');
  if (isVenueAdminPath(pathname)) return storageKeysForRole('venue_admin');
  if (isArtistAdminPath(pathname)) return storageKeysForRole('artist_admin');
  if (pathname.startsWith('/business')) return storageKeysForRole('business_admin');
  if (pathname.startsWith('/customer')) return storageKeysForRole('customer');
  return storageKeysForRole('customer');
}

export function homePathForRole(role: UserRole | string) {
  switch (role) {
    case 'super_admin':
      return '/admin';
    case 'business_admin':
      return '/business';
    case 'event_admin':
      return '/organizer';
    case 'movie_admin':
      return '/movie';
    case 'venue_admin':
      return '/venue';
    case 'artist_admin':
      return '/artist';
    case 'customer':
      return '/customer/dashboard';
    default:
      return '/login';
  }
}

/** Login URL for a specific role (so other roles can stay logged in). */
export function loginPathForRole(role: UserRole | string) {
  switch (role) {
    case 'super_admin':
      return '/admin/login';
    case 'business_admin':
      return '/business/login';
    case 'event_admin':
      return '/organizer/login';
    case 'movie_admin':
      return '/movie/login';
    case 'venue_admin':
      return '/venue/login';
    case 'artist_admin':
      return '/artist/login';
    case 'customer':
    default:
      return '/';
  }
}

/** Read a single role session from localStorage (browser only). */
export function readSessionForRole(role: UserRole): { user: StoredAuthUser; token: string } | null {
  if (typeof window === 'undefined') return null;
  const { tokenKey, userKey } = storageKeysForRole(role);
  const token = localStorage.getItem(tokenKey);
  const userStr = localStorage.getItem(userKey);
  if (!token || !userStr) return null;
  try {
    const user = JSON.parse(userStr) as StoredAuthUser;
    if (!user?.role || user.role !== role) return null;
    return { user, token };
  } catch {
    return null;
  }
}

/**
 * Find any active logged-in session (for /login redirect).
 * Priority: super_admin → event_admin → movie_admin → business_admin → customer
 */
export function getActiveSession(): { user: StoredAuthUser; token: string } | null {
  if (typeof window === 'undefined') return null;
  for (const role of ROLE_PRIORITY) {
    const session = readSessionForRole(role);
    if (session) return session;
  }
  return null;
}

/** Clear one role's session keys. */
export function clearSessionForRole(role: UserRole | string) {
  if (typeof window === 'undefined') return;
  const { tokenKey, userKey } = storageKeysForRole(role);
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(userKey);
}
