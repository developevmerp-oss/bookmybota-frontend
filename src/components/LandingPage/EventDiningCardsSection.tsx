"use client";

import Link from "next/link";

const CARDS = [
  {
    title: "Events",
    description: "Discover concerts, festivals, conferences, exhibitions and more.",
    href: "/events",
    cta: "Explore Events",
    image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1600&q=80",
    border: "border-[#2e7a52]",
    text: "text-[#1B5E3B]",
    gradient:
      "linear-gradient(90deg, #0f3a28 0%, #14533a 36%, rgba(20,83,58,0.55) 55%, transparent 78%)",
  },
  {
    title: "Dining",
    description: "Discover restaurants, cafés, bars and unique dining experiences.",
    href: "/dining",
    cta: "Explore Dining",
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&q=80",
    border: "border-[#c4a35a]",
    text: "text-[#7a5a16]",
    gradient:
      "linear-gradient(90deg, #4a3508 0%, #6b4e10 36%, rgba(107,78,16,0.55) 55%, transparent 78%)",
  },
];

export default function EventDiningCardsSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
      {CARDS.map((card) => (
        <Link
          key={card.title}
          href={card.href}
          className={`group relative h-[220px] sm:h-[250px] lg:h-[270px] rounded-2xl overflow-hidden border-2 ${card.border}`}
        >
          <img
            src={card.image}
            alt={card.title}
            className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0" style={{ background: card.gradient }} />
          <div className="relative h-full flex flex-col justify-center px-7 sm:px-9 lg:px-10 py-8 max-w-[58%]">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {card.title}
            </h2>
            <p className="mt-3 text-white text-[15px] sm:text-base leading-relaxed">
              {card.description}
            </p>
            <span
              className={`mt-6 inline-flex items-center gap-2 self-start bg-white ${card.text} text-sm font-bold px-5 py-2.5 rounded-lg group-hover:gap-3 transition-all`}
            >
              {card.cta}
              <span className="text-lg leading-none font-normal">→</span>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
