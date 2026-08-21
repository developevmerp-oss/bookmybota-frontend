"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGetPublicEventQuery } from "@/services/api";
import EventGalleryModal from "@/components/EventLandingPage/EventGalleryModal";
import { EventGalleryShimmer } from "@/components/Shared/Shimmer";

/** Deep-link: /events/[id]/gallery opens the same lightbox modal on the event. */
export default function EventGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: event, isLoading, isError } = useGetPublicEventQuery(id);
  const [open, setOpen] = useState(true);

  const images = useMemo(() => {
    const gallery = (event?.gallery_images || []).filter(Boolean);
    if (gallery.length > 0) return gallery;
    return [event?.poster_horizontal_url, event?.poster_vertical_url].filter(
      (u): u is string => Boolean(u)
    );
  }, [event]);

  useEffect(() => {
    if (!open) router.replace(`/events/${id}`);
  }, [open, id, router]);

  if (isLoading) {
    return <EventGalleryShimmer />;
  }

  if (isError || !event) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-600 mb-4 text-[1rem]">Could not load gallery.</p>
        <Link href="/events" className="font-medium text-[1rem]" style={{ color: "#6900AA" }}>
          Browse all events
        </Link>
      </div>
    );
  }

  return (
    <EventGalleryModal
      open={open && images.length > 0}
      eventName={event.name}
      images={images}
      startIndex={0}
      onClose={() => setOpen(false)}
    />
  );
}
