"use client";

import { Suspense } from "react";
import AdminOrganizerPayoutsPage from "@/components/SuperAdmin/AdminOrganizerPayoutsPage";
import { Loader2 } from "lucide-react";

function Fallback() {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-zinc-400">
      <Loader2 className="animate-spin" size={18} /> Loading partner payouts…
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <AdminOrganizerPayoutsPage />
    </Suspense>
  );
}
