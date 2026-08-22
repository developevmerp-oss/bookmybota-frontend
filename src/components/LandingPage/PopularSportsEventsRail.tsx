"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ShowcaseEventPosterCard } from "./PosterCard";
import "./PopularSportsEventsRail.css";

type SportEvent = {
  id: string;
  title: string;
  image: string;
  showDate: string;
  place: string;
  eventType: string;
  href: string;
};

/** Static showcase data for the landing Popular Sports Events rail. */
export const POPULAR_SPORTS_EVENTS: SportEvent[] = [
  {
    id: "1",
    title: "Great Ethiopian Run 10K",
    image: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=500&h=750&fit=crop&q=80",
    showDate: "2026-11-20T09:00:00",
    place: "Meskel Square: Addis Ababa",
    eventType: "Sports · Running",
    href: "/events?category=sports",
  },
  {
    id: "2",
    title: "Ethiopian Premier League Final",
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=500&h=750&fit=crop&q=80",
    showDate: "2026-12-05T16:00:00",
    place: "Addis Ababa Stadium: Addis Ababa",
    eventType: "Sports · Football",
    href: "/events?category=sports",
  },
  {
    id: "3",
    title: "National Wrestling Cup",
    image: "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=500&h=750&fit=crop&q=80",
    showDate: "2026-12-12T14:00:00",
    place: "Dire Dawa Arena: Dire Dawa",
    eventType: "Sports · Wrestling",
    href: "/events?category=sports",
  },
  {
    id: "4",
    title: "Addis Basketball Night",
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500&h=750&fit=crop&q=80",
    showDate: "2026-12-18T19:00:00",
    place: "Millennium Hall: Addis Ababa",
    eventType: "Sports · Basketball",
    href: "/events?category=sports",
  },
  {
    id: "5",
    title: "Rift Valley Cycling Challenge",
    image: "https://images.unsplash.com/photo-1517649763962-0c623066027c?w=500&h=750&fit=crop&q=80",
    showDate: "2027-01-22T07:00:00",
    place: "Hawassa Lakeside: Hawassa",
    eventType: "Sports · Cycling",
    href: "/events?category=sports",
  },
  {
    id: "6",
    title: "Track & Field Open Meet",
    image: "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?w=500&h=750&fit=crop&q=80",
    showDate: "2027-02-08T10:00:00",
    place: "Bahir Dar Stadium: Bahir Dar",
    eventType: "Sports · Athletics",
    href: "/events?category=sports",
  },
  {
    id: "7",
    title: "Youth Football Festival",
    image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=500&h=750&fit=crop&q=80",
    showDate: "2027-02-15T15:00:00",
    place: "Jimma Sports Complex: Jimma",
    eventType: "Sports · Football",
    href: "/events?category=sports",
  },
];

const VISIBLE = 5;

export default function PopularSportsEventsRail() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="text-xl sm:text-[22px] md:text-2xl font-semibold tracking-tight text-[#111111]">
            Popular Sports Events
          </h2>
          <Link
            href="/events?category=sports"
            className="shrink-0 text-xs sm:text-sm font-medium text-[#6900AA] hover:text-[#57008E]"
          >
            See All ›
          </Link>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Previous sports events"
            onClick={() => scrollBy(-1)}
            className="hidden md:flex absolute -left-2 lg:-left-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
          >
            <ChevronLeft size={18} />
          </button>

          <div
            ref={scrollerRef}
            className="sports-rail"
            style={{ ["--sports-visible" as string]: VISIBLE }}
          >
            {POPULAR_SPORTS_EVENTS.map((event) => (
              <div key={event.id} className="sports-rail-slot">
                <ShowcaseEventPosterCard
                  title={event.title}
                  image={event.image}
                  showDate={event.showDate}
                  place={event.place}
                  eventType={event.eventType}
                  href={event.href}
                  fullWidth
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            aria-label="Next sports events"
            onClick={() => scrollBy(1)}
            className="hidden md:flex absolute -right-2 lg:-right-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
