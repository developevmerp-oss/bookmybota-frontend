"use client";

import Link from "next/link";
import { FaArrowRight } from "react-icons/fa";

const CARDS = [
  {
    title: "Events",
    description: "Concerts, festivals, theatre and unforgettable nights across Ethiopia.",
    href: "/events",
    cta: "Explore Events",
    image:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=80",
    overlay: "from-[#0d3b28]/85 via-[#1B5E3B]/70 to-[#1B5E3B]/40",
  },
  {
    title: "Dining",
    description: "Restaurants, cafes and bars — discover places worth booking tonight.",
    href: "/dining",
    cta: "Explore Dining",
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
    overlay: "from-[#7a5c12]/80 via-[#C9A227]/65 to-[#C9A227]/35",
  },
];

export default function EventDiningCardsSection() {
  return (
    <section className="bg-[#f4f1ea] py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {CARDS.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className="group relative h-56 sm:h-64 rounded-2xl overflow-hidden shadow-lg"
            >
              <img
                src={card.image}
                alt={card.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className={`absolute inset-0 bg-gradient-to-r ${card.overlay}`} />
              <div className="relative h-full flex flex-col justify-end p-6 sm:p-8">
                <h2 className="text-3xl font-extrabold text-white">{card.title}</h2>
                <p className="mt-2 text-white/85 text-sm max-w-sm">{card.description}</p>
                <span className="mt-4 inline-flex items-center gap-2 self-start bg-white text-slate-800 text-sm font-semibold px-4 py-2 rounded-full group-hover:gap-3 transition-all">
                  {card.cta}
                  <FaArrowRight size={16} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
