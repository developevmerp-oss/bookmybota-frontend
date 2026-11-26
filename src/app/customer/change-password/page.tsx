"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CustomerAccountShellShimmer,
  CustomerProfileShimmer,
} from "@/components/Shared/Shimmer";

/** Customers authenticate with Phone + OTP — redirect legacy change-password route to My Profile. */
export default function CustomerChangePasswordPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/customer/profile");
  }, [router]);

  return (
    <CustomerAccountShellShimmer>
      <CustomerProfileShimmer />
    </CustomerAccountShellShimmer>
  );
}
