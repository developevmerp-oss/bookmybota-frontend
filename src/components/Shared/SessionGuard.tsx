"use client";

import { useEffect } from "react";
import { useGetMeQuery } from "@/services/api";

/** Calls GET /auth/me so a disabled partner/customer is kicked out on refresh. */
export default function SessionGuard({
  skip = false,
  children,
}: {
  skip?: boolean;
  children: React.ReactNode;
}) {
  const { isError } = useGetMeQuery(undefined, { skip });

  useEffect(() => {
    // Logout is handled by the shared RTK baseQuery on ACCOUNT_DISABLED.
    void isError;
  }, [isError]);

  return <>{children}</>;
}
