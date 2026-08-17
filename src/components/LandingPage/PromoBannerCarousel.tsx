"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useHomeCatalog } from "./useHomeCatalog";
import { eventLandscape } from "./homeUtils";

type PromoBannerCarouselProps = {
  city: string;
};

export default function PromoBannerCarousel({ city }: PromoBannerCarouselProps) {
  const { bannerEvents, isLoadingEvents, isLoadingFallback } = useHomeCatalog(city);
  const slides = bannerEvents.slice(0, 5);
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(t);
  }, [slides.length, index]);

  if (isLoadingEvents || (slides.length === 0 && isLoadingFallback)) {
    return (
      <section className="bg-white pt-5 pb-6 w-full">
        <div className="relative h-[180px] sm:h-[220px] md:h-[280px] lg:h-[320px] w-full">
          <div className="absolute left-0 top-0 bottom-0 w-[70px] sm:w-[90px] rounded-xl bg-[#F7F7F7]" />
          <div className="absolute left-[82px] sm:left-[106px] right-[82px] sm:right-[106px] top-0 bottom-0 rounded-xl bg-[#F7F7F7]" />
          <div className="absolute right-0 top-0 bottom-0 w-[70px] sm:w-[90px] rounded-xl bg-[#F7F7F7]" />
        </div>
      </section>
    );
  }

  if (slides.length === 0) return null;

  const n = slides.length;
  const go = (dir: -1 | 1) => setIndex((i) => (i + dir + n) % n);
  const prevSlide = slides[(index - 1 + n) % n];
  const current = slides[index];
  const nextSlide = slides[(index + 1) % n];

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null || n < 2) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx > 40) go(-1);
    if (dx < -40) go(1);
    touchX.current = null;
  };

  return (
    <section className="bg-white pt-5 pb-6 w-full overflow-x-hidden">
      <div
        className="relative h-[180px] sm:h-[220px] md:h-[280px] lg:h-[320px] w-full"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {n > 1 && (
          <button
            type="button"
            onClick={() => go(-1)}
            className="absolute left-0 top-0 bottom-0 w-[70px] sm:w-[90px] rounded-xl overflow-hidden cursor-pointer"
            aria-label="Previous banner"
          >
            <img
              src={eventLandscape(prevSlide)}
              alt=""
              className="w-full h-full object-cover object-left"
            />
          </button>
        )}

        <Link
          href={`/events/${current.id}`}
          className={`absolute top-0 bottom-0 rounded-xl overflow-hidden bg-[#111111] ${
            n > 1
              ? "left-[82px] sm:left-[106px] right-[82px] sm:right-[106px]"
              : "left-4 right-4"
          }`}
        >
          <img
            src={eventLandscape(current)}
            alt={current.name}
            className="w-full h-full object-cover"
          />
          {n > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {slides.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-1.5 rounded-full ${
                    i === index ? "w-5 bg-white" : "w-1.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </Link>

        {n > 1 && (
          <button
            type="button"
            onClick={() => go(1)}
            className="absolute right-0 top-0 bottom-0 w-[70px] sm:w-[90px] rounded-xl overflow-hidden cursor-pointer"
            aria-label="Next banner"
          >
            <img
              src={eventLandscape(nextSlide)}
              alt=""
              className="w-full h-full object-cover object-right"
            />
          </button>
        )}

        {n > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous banner"
              onClick={() => go(-1)}
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 text-[#333] shadow flex items-center justify-center cursor-pointer hover:bg-white"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Next banner"
              onClick={() => go(1)}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 text-[#333] shadow flex items-center justify-center cursor-pointer hover:bg-white"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
