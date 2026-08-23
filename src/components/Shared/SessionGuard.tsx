"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useGetMeQuery } from "@/services/api";
import { useAppDispatch } from "@/lib/hooks";
import {
  handleAuthSessionFailure,
  isAuthSessionError,
  resolveRoleFromPath,
} from "@/lib/authSession";

/** Calls GET /auth/me; logs out when the session is invalid or expired. */
export default function SessionGuard({
  skip = false,
  children,
}: {
  skip?: boolean;
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const pathname = usePathname() || "";
  const { isError, error } = useGetMeQuery(undefined, { skip });

  useEffect(() => {
    if (skip || !isError || !error) return;

    const status = "status" in error ? error.status : undefined;
    const data =
      "data" in error
        ? (error.data as { code?: string; error?: string } | undefined)
        : undefined;

    if (isAuthSessionError(status, data, pathname)) {
      handleAuthSessionFailure(resolveRoleFromPath(pathname), dispatch, data, pathname);
    }
  }, [skip, isError, error, dispatch, pathname]);

  return <>{children}</>;
}
