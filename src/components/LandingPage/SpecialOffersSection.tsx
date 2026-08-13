"use client";

import Link from "next/link";

const OFFERS = [
  {
    title: "20% OFF",
    subtitle: "On Selected Restaurants Today Only!",
    href: "/dining",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80",
    color: "#1B5E3B",
  },
  {
    title: "Weekend Events",
    subtitle: "Get up to 30% off on selected events.",
    href: "/events",
    image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=900&q=80",
    color: "#C9A227",
  },
  {
    title: "Happy Hour",
    subtitle: "Buy 1 Get 1 on selected drinks",
    href: "/dining",
    image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=900&q=80",
    color: "#1B5E3B",
  },
  {
    title: "Early Bird Tickets",
    subtitle: "Get special discounts on early bookings.",
    href: "/events",
    image: "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=900&q=80",
    color: "#C9A227",
  },
];

export default function SpecialOffersSection() {
  return (
    <section className="bg-[#f7f4ee] py-14 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-center text-slate-900 mb-10">
          Today&apos;s Special Offers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {OFFERS.map((offer) => (
            <Link
              key={offer.title}
              href={offer.href}
              className="group relative h-48 sm:h-52 lg:h-56 rounded-2xl overflow-hidden shadow-md"
            >
              <img
                src={offer.image}
                alt={offer.title}
                className="absolute inset-0 w-full h-full object-cover object-right group-hover:scale-105 transition-transform duration-500"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(90deg, ${offer.color} 0%, ${offer.color} 38%, ${offer.color}cc 52%, transparent 78%)`,
                }}
              />
              <div className="relative h-full flex flex-col justify-center px-6 py-5 max-w-[62%] text-white">
                <h3 className="text-xl sm:text-2xl font-extrabold leading-tight">{offer.title}</h3>
                <p className="mt-2 text-sm text-white/95 leading-snug">{offer.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
