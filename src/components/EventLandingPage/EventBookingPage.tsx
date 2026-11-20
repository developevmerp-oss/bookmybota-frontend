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
  const stepParam = searchParams.get("step");
  const initialStep = useMemo(() => {
    if (!stepParam) return undefined;
    const key = stepParam.trim().toLowerCase();
    const fromSlug: Record<string, number> = {
      venue: 1,
      showtimes: 1,
      tickets: 2,
      mode: 3,
      confirm: 4,
      review: 4,
    };
    if (fromSlug[key]) return fromSlug[key];
    const n = Number(key);
    return Number.isFinite(n) && n >= 1 && n <= 4 ? n : undefined;
  }, [stepParam]);

  const { data: event, isLoading, isFetching, isError } = useGetPublicEventQuery(id);

  // Allow checkout when types exist even if sold out (post-booking inventory hit 0).
  const canOpenCheckout = useMemo(() => {
    if (!event) return false;
    const showtimes = event.showtimes || [];
    const tickets = event.ticket_types || [];
    return showtimes.length > 0 && tickets.length > 0;
  }, [event]);

  if (isLoading || (isFetching && !event)) {
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

  if (!canOpenCheckout) {
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
    <div className="h-full min-h-0 flex flex-col">
      <EventCheckout
        event={event}
        open
        variant="page"
        initialShowtimeId={initialShowtimeId || undefined}
        initialStep={initialStep}
        onClose={() => router.push(`/events/${id}`)}
      />
    </div>
  );
}
