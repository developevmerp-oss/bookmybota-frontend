"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";

function RedirectToProfilePassword() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/profile?tab=password");
  }, [router]);

  return (
    <div className="w-full flex items-center justify-center min-h-[8rem] text-slate-500 text-sm">
      Opening change password...
    </div>
  );
}

export default function AdminChangePasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full flex items-center justify-center min-h-[8rem] text-slate-500 text-sm">
          Opening change password...
        </div>
      }
    >
      <RedirectToProfilePassword />
    </Suspense>
  );
}
