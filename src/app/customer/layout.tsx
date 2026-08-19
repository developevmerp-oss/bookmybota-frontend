"use client";

import { usePathname } from "next/navigation";
import AuthGate from "@/components/Shared/AuthGate";
import SessionGuard from "@/components/Shared/SessionGuard";

/** Booking confirmation stays reachable without login (post-checkout). */
const PUBLIC_CUSTOMER_PREFIXES = [
  "/customer/bookings/confirmation",
  "/customer/event-bookings/confirmation",
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const isPublic = PUBLIC_CUSTOMER_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <AuthGate mode="require" roles={["customer"]}>
      <SessionGuard>{children}</SessionGuard>
    </AuthGate>
  );
}
