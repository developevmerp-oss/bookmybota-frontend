"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Overview removed — My Account opens Edit Profile directly. */
export default function CustomerSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/customer/profile");
  }, [router]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f4f5f7] flex items-center justify-center text-slate-500">
      Redirecting...
    </div>
  );
}
