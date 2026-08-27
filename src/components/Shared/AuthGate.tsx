"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  homePathForRole,
  loginPathForRole,
  readSessionForRole,
  clearSessionForRole,
  type UserRole,
} from "@/lib/authStorage";
import { isTokenExpired } from "@/lib/authSession";
import { useAppDispatch } from "@/lib/hooks";
import { loadFromStorage, setCredentials, clearCredentials } from "@/features/auth/authSlice";

type Mode =
  /** Must be logged in with one of `roles` */
  | "require"
  | "guest";

interface AuthGateProps {
  mode: Mode;
  /** Required when mode="require" */
  roles?: UserRole[];
  /**
   * When mode="guest": only these roles trigger redirect-away-from-login.
   * Other roles may stay logged in in other tabs.
   * Defaults to all roles (legacy behavior) if omitted.
   */
  guestRoles?: UserRole[];
  children: ReactNode;
  loading?: ReactNode;
}

const defaultLoading = (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">
    Loading...
  </div>
);

/**
 * Client-side route guard.
 * - guest: login/register — bounce only if a matching guestRoles session exists
 * - require: private areas — bounce missing/wrong role to that role's login page
 *   Re-checks on auth_changed / storage so logout leaves private pages.
 *   Does not re-run on every pathname change (that blanked the admin shell on Back).
 */
export default function AuthGate({
  mode,
  roles = [],
  guestRoles,
  children,
  loading,
}: AuthGateProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [ready, setReady] = useState(false);

  const rolesKey = roles.join(",");
  const guestRolesKey = (guestRoles ?? []).join(",");

  useEffect(() => {
    const runGate = () => {
      if (mode === "guest") {
        const checkRoles: UserRole[] =
          guestRoles === undefined
            ? (["super_admin", "event_admin", "business_admin", "customer"] as UserRole[])
            : guestRoles;

        for (const role of checkRoles) {
          const session = readSessionForRole(role);
          if (session) {
            dispatch(setCredentials({ user: session.user, token: session.token }));
            router.replace(homePathForRole(session.user.role));
            return;
          }
        }
        setReady(true);
        return;
      }

      // require mode
      dispatch(loadFromStorage());

      const allowed = rolesKey.split(",").filter(Boolean) as UserRole[];
      let matched: ReturnType<typeof readSessionForRole> = null;
      for (const role of allowed) {
        matched = readSessionForRole(role);
        if (matched) break;
      }

      if (!matched) {
        setReady(false);
        dispatch(clearCredentials());
        const loginRole = allowed[0] || "customer";
        router.replace(loginPathForRole(loginRole));
        return;
      }

      if (isTokenExpired(matched.token)) {
        setReady(false);
        clearSessionForRole(matched.user.role);
        dispatch(clearCredentials());
        router.replace(loginPathForRole(matched.user.role));
        return;
      }

      dispatch(setCredentials({ user: matched.user, token: matched.token }));
      setReady(true);
    };

    runGate();

    if (mode !== "require") return;

    const onAuthChange = () => runGate();
    window.addEventListener("auth_changed", onAuthChange);
    window.addEventListener("storage", onAuthChange);
    return () => {
      window.removeEventListener("auth_changed", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, [mode, rolesKey, guestRolesKey, guestRoles, router, dispatch]);

  if (!ready) return <>{loading ?? defaultLoading}</>;
  return <>{children}</>;
}
