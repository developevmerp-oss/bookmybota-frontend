"use client";

import { use, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useGetPublicEventQuery } from "@/services/api";
import EventCheckout from "@/components/EventLandingPage/EventCheckout";
import { EventBookingShimmer } from "@/components/Shared/Shimmer";

export default function EventBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialShowtimeId = searchParams.get("showtime") || "";

  const { data: event, isLoading, isError } = useGetPublicEventQuery(id);

  const canBook = useMemo(() => {
    if (!event) return false;
    const showtimes = event.showtimes || [];
    const tickets = event.ticket_types || [];
    return showtimes.length > 0 && tickets.some((t) => (Number(t.available_count) || 0) > 0);
  }, [event]);

  if (isLoading) {
    return <EventBookingShimmer />;
  }

  if (isError || !event) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600 mb-4 text-[1rem]">Could not load this event.</p>
        <Link href="/events" className="font-medium text-[1rem]" style={{ color: "#6900AA" }}>
          Browse all events
        </Link>
      </div>
    );
  }

  if (!canBook) {
    return (
      <div className="text-center py-20 px-4">
        <p className="text-slate-600 mb-4 text-[1rem]">Booking is not available for this event.</p>
        <Link
          href={`/events/${id}`}
          className="font-medium text-[1rem]"
          style={{ color: "#6900AA" }}
        >
          Back to event
        </Link>
      </div>
    );
  }

  return (
    <EventCheckout
      event={event}
      open
      variant="page"
      initialShowtimeId={initialShowtimeId || undefined}
      onClose={() => router.push(`/events/${id}`)}
    />
  );
}
