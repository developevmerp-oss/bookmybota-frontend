import images from "@/Images";
import type { PartnerImageCard } from "@/components/Shared/PartnerListYourShowLanding";

function imageSrc(img: string | { src: string }) {
  return typeof img === "string" ? img : img.src;
}

/** Venue-type image cards shown on partner detail pages after the hero banner. */
export const PARTNER_VENUE_TYPE_CARDS: PartnerImageCard[] = [
  { label: "Auditorium", image: imageSrc(images.businessAuditorium) },
  { label: "Banquet Hall", image: imageSrc(images.businessBanquetHall) },
  { label: "Arena", image: imageSrc(images.businessArena) },
  { label: "Stadium", image: imageSrc(images.businessStadium) },
];
