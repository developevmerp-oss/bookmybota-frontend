"use client";

import Link from "next/link";

const OFFERS = [
  {
    title: "20% OFF",
    subtitle: "Selected restaurants this week",
    href: "/dining",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80",
    overlay: "bg-[#1B5E3B]/75",
  },
  {
    title: "Weekend Events",
    subtitle: "Up to 30% off tickets",
    href: "/events",
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&q=80",
    overlay: "bg-[#C9A227]/80",
  },
  {
    title: "Happy Hour",
    subtitle: "Buy 1 Get 1 at partner bars",
    href: "/dining",
    image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=900&q=80",
    overlay: "bg-[#1B5E3B]/75",
  },
  {
    title: "Early Bird Tickets",
    subtitle: "Save on upcoming shows",
    href: "/events",
    image: "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=900&q=80",
    overlay: "bg-[#0d2f1f]/80",
  },
];

export default function SpecialOffersSection() {
  return (
    <section className="bg-[#f7f4ee] py-14 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-slate-900 mb-10">
          Today&apos;s Special Offers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {OFFERS.map((offer) => (
            <Link
              key={offer.title}
              href={offer.href}
              className="group relative h-40 rounded-2xl overflow-hidden shadow-md"
            >
              <img
                src={offer.image}
                alt={offer.title}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className={`absolute inset-0 ${offer.overlay}`} />
              <div className="relative h-full flex flex-col justify-end p-5 text-white">
                <h3 className="text-xl font-extrabold">{offer.title}</h3>
                <p className="text-sm text-white/90 mt-0.5">{offer.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
