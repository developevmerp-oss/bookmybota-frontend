"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import "./PopularSportsEventsRail.css";

type SportEvent = {
  id: string;
  title: string;
  meta: string;
  image: string;
  date: string;
  price: string;
  href: string;
};

/** Static showcase data for the landing Popular Sports Events rail. */
export const POPULAR_SPORTS_EVENTS: SportEvent[] = [
  {
    id: "1",
    title: "Great Ethiopian Run 10K",
    meta: "English · Running",
    image: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=500&h=750&fit=crop&q=80",
    date: "20 Nov 2026",
    price: "From 200 ETB",
    href: "/events?category=sports",
  },
  {
    id: "2",
    title: "Ethiopian Premier League Final",
    meta: "Amharic · Football",
    image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=500&h=750&fit=crop&q=80",
    date: "5 Dec 2026",
    price: "From 350 ETB",
    href: "/events?category=sports",
  },
  {
    id: "3",
    title: "National Wrestling Cup",
    meta: "Amharic · Wrestling",
    image: "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=500&h=750&fit=crop&q=80",
    date: "12 Dec 2026",
    price: "From 150 ETB",
    href: "/events?category=sports",
  },
  {
    id: "4",
    title: "Addis Basketball Night",
    meta: "English · Basketball",
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500&h=750&fit=crop&q=80",
    date: "18 Dec 2026",
    price: "From 250 ETB",
    href: "/events?category=sports",
  },
  {
    id: "5",
    title: "Rift Valley Cycling Challenge",
    meta: "English · Cycling",
    image: "https://images.unsplash.com/photo-1517649763962-0c623066027c?w=500&h=750&fit=crop&q=80",
    date: "22 Jan 2027",
    price: "From 300 ETB",
    href: "/events?category=sports",
  },
  {
    id: "6",
    title: "Track & Field Open Meet",
    meta: "English · Athletics",
    image: "https://images.unsplash.com/photo-1461896836934-ffe607ba6851?w=500&h=750&fit=crop&q=80",
    date: "8 Feb 2027",
    price: "From 180 ETB",
    href: "/events?category=sports",
  },
  {
    id: "7",
    title: "Youth Football Festival",
    meta: "Amharic · Football",
    image: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=500&h=750&fit=crop&q=80",
    date: "15 Feb 2027",
    price: "From 100 ETB",
    href: "/events?category=sports",
  },
];

const VISIBLE = 5;

function SportEventCard({ event }: { event: SportEvent }) {
  return (
    <Link href={event.href} className="sports-rail-slot group block min-w-0">
      <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#F7F7F7] border border-[#EDEDED]">
        <img
          src={event.image}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          loading="lazy"
          draggable={false}
        />
      </div>
      <h3 className="mt-2.5 text-sm font-semibold text-[#111111] line-clamp-2 leading-snug">
        {event.title}
      </h3>
      <p className="mt-1 text-xs text-[#6B6B6B] line-clamp-1">{event.meta}</p>
      <p className="mt-0.5 text-xs text-[#6B6B6B]">{event.date}</p>
      <p className="mt-1 text-xs font-medium text-[#111111]">{event.price}</p>
    </Link>
  );
}

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
              <SportEventCard key={event.id} event={event} />
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
