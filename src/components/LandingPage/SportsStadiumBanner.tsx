"use client";

import Link from "next/link";
import images from "@/Images";

export default function SportsStadiumBanner() {
  const src =
    typeof images.sportsStadiumBanner === "string"
      ? images.sportsStadiumBanner
      : images.sportsStadiumBanner.src;

  return (
    <section className="bg-white py-4 sm:py-6 lg:py-8">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <Link
          href="/events?category=sports"
          className="block w-full overflow-hidden rounded-4xl"
        >
          <img
            src={src}
            alt="Live sports at the stadium"
            className="w-full h-auto object-cover object-center aspect-[21/9] sm:aspect-[16/6] max-h-[280px] sm:max-h-[340px] lg:max-h-[500px]"
            loading="lazy"
          />
        </Link>
      </div>
    </section>
  );
}
