/** Role-scoped auth storage + redirect helpers */

export type UserRole = 'super_admin' | 'business_admin' | 'event_admin' | 'venue_admin' | 'customer';

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
  'venue_admin',
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
    default:
      return { tokenKey: 'token_customer', userKey: 'user_customer' };
  }
}

export function storageKeysForPath(pathname: string) {
  if (pathname.startsWith('/admin')) return storageKeysForRole('super_admin');
  if (pathname.startsWith('/organizer')) return storageKeysForRole('event_admin');
  if (pathname.startsWith('/venue')) return storageKeysForRole('venue_admin');
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
    case 'venue_admin':
      return '/venue';
    case 'customer':
      return '/customer/dashboard';
    default:
      return '/login';
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
 * Priority: super_admin → event_admin → business_admin → customer
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
