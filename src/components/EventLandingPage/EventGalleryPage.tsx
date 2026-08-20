"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { useGetPublicEventQuery } from "@/services/api";

export default function EventGalleryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: event, isLoading, isError } = useGetPublicEventQuery(id);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const images = useMemo(() => {
    const gallery = (event?.gallery_images || []).filter(Boolean);
    if (gallery.length > 0) return gallery;
    return [event?.poster_horizontal_url, event?.poster_vertical_url].filter(
      (u): u is string => Boolean(u)
    );
  }, [event]);

  if (isLoading) {
    return (
      <div className="text-center py-20 text-[1rem] text-slate-500">Loading gallery…</div>
    );
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
    <div className="min-h-screen bg-white">
      <div className="max-w-[73.75rem] 2xl:max-w-[82.5rem] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <Link
            href={`/events/${id}`}
            className="inline-flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Back to event"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-[1.375rem] sm:text-[1.625rem] lg:text-[1.875rem] font-extrabold text-[#1A1A1A] leading-tight truncate">
              Gallery
            </h1>
            <p className="mt-0.5 text-[0.875rem] sm:text-[1rem] text-slate-500 truncate">
              {event.name}
            </p>
          </div>
        </div>

        {images.length === 0 ? (
          <p className="text-[1rem] text-slate-500 py-12 text-center">No gallery images yet.</p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {images.map((src, i) => (
              <li key={`${src}-${i}`}>
                <button
                  type="button"
                  onClick={() => setLightbox(src)}
                  className="relative w-full aspect-square rounded-[0.75rem] overflow-hidden bg-slate-200 cursor-pointer group"
                >
                  <img
                    src={src}
                    alt={`${event.name} gallery ${i + 1}`}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 flex items-center justify-center p-3 sm:p-6"
          onClick={() => setLightbox(null)}
          role="presentation"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 h-9 w-9 rounded-full bg-white/15 text-white flex items-center justify-center cursor-pointer hover:bg-white/25"
          >
            <X size={18} />
          </button>
          <img
            src={lightbox}
            alt={event.name}
            className="max-w-full max-h-[85vh] rounded-[0.5rem] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
