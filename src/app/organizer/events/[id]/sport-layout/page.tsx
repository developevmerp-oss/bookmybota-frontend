"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

const SportMapStudio = dynamic(() => import("@/components/EventAdminPanel/SportMapStudio"), { ssr: false });

export default function SportLayoutPage() {
  const params = useParams();
  const eventId = typeof params?.id === "string" ? params.id : "";
  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/organizer/events/${eventId}/layout`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"><ArrowLeft size={20} /></Link>
          <h1 className="text-2xl font-bold text-slate-900">Sport map layout</h1>
        </div>
        {eventId ? (
          <Link href={`/events/${eventId}`} target="_blank" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
            <ExternalLink size={14} /> Open customer page
          </Link>
        ) : null}
      </div>
      {eventId ? <SportMapStudio eventId={eventId} /> : null}
    </div>
  );
}
