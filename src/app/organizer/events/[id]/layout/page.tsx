"use client";
import React from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// Konva relies on window, so we must load it client-side only
const VenueLayoutBuilder = dynamic(
  () => import("@/components/events/VenueLayoutBuilder"),
  { ssr: false }
);

export default function EventLayoutPage() {
  const params = useParams();
  const eventId = typeof params.id === "string" ? params.id : "";

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href={`/organizer/events/${eventId}`}
              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-white">Seating Layout Builder</h1>
          </div>
          <p className="text-zinc-400 mt-1 ml-11">
            Drag and drop seats to configure your dynamic venue floor plan.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <VenueLayoutBuilder eventId={eventId} />
      </div>
    </div>
  );
}
