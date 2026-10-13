"use client";

import type { Business } from "@/services/api";
import DiningRestaurantCardOption2, {
  ShowcaseDiningRestaurantCard,
} from "@/components/DinningLandingPage/DiningRestaurantCardOption2";
import { useAdaptiveCard } from "./AdaptiveCardRow";

const CARD_WIDTH = "snap-start shrink-0 w-[260px] sm:w-[280px] lg:w-[300px]";

/**
 * Landing detail dining card — same shared dining card UI,
 * without promoted badge or offer (listing-only chrome).
 */
export function DiningDetailCard({
  place,
  className = "",
}: {
  place: Business;
  className?: string;
}) {
  const adaptive = useAdaptiveCard();
  const widthClass = adaptive ? "w-full" : CARD_WIDTH;

  return (
    <DiningRestaurantCardOption2
      place={place}
      showPromoted={false}
      showOffer={false}
      className={`${widthClass} ${className}`}
    />
  );
}

/** Showcase variant when live dining data is empty. */
export function ShowcaseDiningDetailCard({
  name,
  image,
  rating,
  locality,
  cuisine,
  href,
  className = "",
}: {
  name: string;
  image: string;
  rating?: number;
  locality?: string;
  cuisine?: string;
  href?: string;
  className?: string;
}) {
  const adaptive = useAdaptiveCard();
  const widthClass = adaptive ? "w-full" : CARD_WIDTH;

  return (
    <ShowcaseDiningRestaurantCard
      name={name}
      image={image}
      rating={rating}
      locality={locality}
      cuisine={cuisine}
      href={href}
      className={`${widthClass} ${className}`}
    />
  );
}
