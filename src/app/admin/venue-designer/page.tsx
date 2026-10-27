"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Dynamically import UniversalVenueDesigner with SSR disabled since Konva requires window
const UniversalVenueDesigner = dynamic(
  () => import("@/modules/venue-designer").then((mod) => mod.UniversalVenueDesigner),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[calc(100vh-60px)] flex flex-col items-center justify-center bg-slate-950 text-white gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" aria-label="Loading venue designer" />
      </div>
    ),
  }
);

export default function AdminVenueDesignerPage() {
  return (
    <div className="w-full h-[calc(100vh-56px)] overflow-hidden bg-slate-950 flex flex-col">
      <Suspense
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-slate-950 text-white">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          </div>
        }
      >
        <UniversalVenueDesigner />
      </Suspense>
    </div>
  );
}
