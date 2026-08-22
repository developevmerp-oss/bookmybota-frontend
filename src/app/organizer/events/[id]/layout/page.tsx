"use client";
import React from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import OrganizerLayoutRequestsPanel from "@/components/EventAdminPanel/OrganizerLayoutRequestsPanel";

const VenueLayoutBuilder = dynamic(
  () => import("@/components/EventAdminPanel/VenueLayoutBuilder"),
  { ssr: false }
);

export default function EventLayoutPage() {
  const params = useParams();
  const eventId = typeof params.id === "string" ? params.id : "";

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full gap-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href={`/organizer/events/${eventId}`}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-white">Seating & layout</h1>
          </div>
          <p className="text-zinc-400 mt-1 ml-11">
            Review custom layout builds from the platform, then edit your floor plan if needed.
          </p>
        </div>
      </div>

      <OrganizerLayoutRequestsPanel eventId={eventId} />

      <div className="flex-1 min-h-0">
        <h2 className="text-lg font-semibold text-white mb-3">Layout builder</h2>
        <VenueLayoutBuilder eventId={eventId} />
      </div>
    </div>
  );
}
