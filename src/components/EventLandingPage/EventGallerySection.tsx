"use client";

import Link from "next/link";

type Props = {
  eventId: string;
  images: string[];
};

const PREVIEW_COUNT = 4;

export default function EventGallerySection({ eventId, images }: Props) {
  const gallery = images.filter(Boolean);
  if (gallery.length === 0) return null;

  const preview = gallery.slice(0, PREVIEW_COUNT);
  const overlaySrc = gallery[PREVIEW_COUNT] || gallery[gallery.length - 1];

  return (
    <section className="mt-6 sm:mt-8 lg:mt-9">
      <h2 className="text-[1.25rem] sm:text-[1.375rem] lg:text-[1.5rem] font-bold text-[#1A1A1A] mb-2.5 sm:mb-3">
        Gallery
      </h2>
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {preview.map((src, i) => (
          <Link
            key={`${src}-${i}`}
            href={`/events/${eventId}/gallery`}
            className="relative shrink-0 w-[8.5rem] h-[8.5rem] sm:w-[9.5rem] sm:h-[9.5rem] lg:w-[10.5rem] lg:h-[10.5rem] rounded-[0.75rem] overflow-hidden bg-slate-200"
          >
            <img src={src} alt={`Gallery ${i + 1}`} className="absolute inset-0 w-full h-full object-cover" />
          </Link>
        ))}
        <Link
          href={`/events/${eventId}/gallery`}
          className="relative shrink-0 w-[8.5rem] h-[8.5rem] sm:w-[9.5rem] sm:h-[9.5rem] lg:w-[10.5rem] lg:h-[10.5rem] rounded-[0.75rem] overflow-hidden bg-slate-800 group"
        >
          {overlaySrc && (
            <img
              src={overlaySrc}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-50 transition-opacity"
              aria-hidden
            />
          )}
          <span className="absolute inset-0 bg-black/45" />
          <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-white font-bold text-[1rem] sm:text-[1.0625rem] lg:text-[1.125rem] leading-snug">
            See the Entire Gallery
          </span>
        </Link>
      </div>
    </section>
  );
}
