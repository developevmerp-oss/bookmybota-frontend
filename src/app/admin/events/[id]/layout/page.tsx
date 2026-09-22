"use client";

import React from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useGetAdminEventDetailQuery } from "@/services/api";

const VenueLayoutBuilder = dynamic(
  () => import("@/components/EventAdminPanel/VenueLayoutBuilder"),
  { ssr: false }
);

export default function AdminEventLayoutPage() {
  const params = useParams();
  const eventId = typeof params?.id === "string" ? params.id : "";
  const { data: event, isLoading } = useGetAdminEventDetailQuery(eventId, { skip: !eventId });

  return (
    <div className="max-w-7xl mx-auto flex flex-col h-full gap-6 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/events/${eventId}`}
              className="p-2 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-500">
                Admin Seating Studio
              </span>
              <h1 className="text-2xl font-bold text-slate-900">
                {event?.name ? `${event.name} — Layout` : "Event Seating & Layout"}
              </h1>
            </div>
          </div>
          <p className="text-slate-500 text-sm mt-1 ml-11">
            Build custom seat floor plans or configure full sports stadium layouts with blocks, pitch, and tiers.
          </p>
        </div>

        {eventId && (
          <Link
            href={`/events/${eventId}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
          >
            <ExternalLink size={14} /> Preview customer booking
          </Link>
        )}
      </div>

      <div className="flex-1 min-h-[750px]">
        <VenueLayoutBuilder eventId={eventId} />
      </div>
    </div>
  );
}
