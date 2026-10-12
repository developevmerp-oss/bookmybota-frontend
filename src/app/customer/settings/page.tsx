"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CustomerAccountShellShimmer,
  CustomerProfileShimmer,
} from "@/components/Shared/Shimmer";

/** Overview removed — My Account opens Edit Profile directly. */
export default function CustomerSettingsPage() {
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
