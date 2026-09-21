"use client";

import { MapPin } from "lucide-react";

/** Inline notice under a landing rail title when the selected city has no data for that module. */
export default function CitySectionEmptyNotice({ message }: { message: string }) {
  return (
    <div className="mt-2 flex items-center gap-1.5 min-w-0">
      <MapPin size={14} className="shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
      <p className="text-sm text-slate-500 leading-snug">{message}</p>
    </div>
  );
}
