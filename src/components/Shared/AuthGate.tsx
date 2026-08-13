"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  getActiveSession,
  homePathForRole,
  readSessionForRole,
  type UserRole,
} from "@/lib/authStorage";
import { useAppDispatch } from "@/lib/hooks";
import { loadFromStorage, setCredentials } from "@/features/auth/authSlice";

type Mode =
  /** Must be logged in with one of `roles` */
  | "require"
  /** Must NOT be logged in; redirect home if any session exists */
  | "guest";

interface AuthGateProps {
  mode: Mode;
  /** Required when mode="require" */
  roles?: UserRole[];
  children: ReactNode;
  /** Optional loading UI */
  loading?: ReactNode;
}

const defaultLoading = (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">
    Loading...
  </div>
);

/**
 * Client-side route guard.
 * - guest: /login, /register — bounce logged-in users to their portal
 * - require: private areas — bounce missing/wrong role to /login or their home
 */
export default function AuthGate({ mode, roles = [], children, loading }: AuthGateProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [ready, setReady] = useState(false);

  const rolesKey = roles.join(",");

  useEffect(() => {
    if (mode === "guest") {
      const session = getActiveSession();
      if (session) {
        dispatch(setCredentials({ user: session.user, token: session.token }));
        router.replace(homePathForRole(session.user.role));
        return;
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
      const any = getActiveSession();
      if (any && !allowed.includes(any.user.role)) {
        router.replace(homePathForRole(any.user.role));
        return;
      }
      router.replace("/login");
      return;
    }

    dispatch(setCredentials({ user: matched.user, token: matched.token }));
    setReady(true);
  }, [mode, rolesKey, router, dispatch]);

  if (!ready) return <>{loading ?? defaultLoading}</>;
  return <>{children}</>;
}
