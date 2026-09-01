import images from "@/Images";

export type PartnerCategoryKey =
  | "dining"
  | "movie"
  | "sports"
  | "music"
  | "comedy"
  | "concert";

export type PartnerCategoryTypeItem = {
  label: string;
  image: string;
};

export type PartnerCategoryTypesConfig = {
  title: string;
  types: PartnerCategoryTypeItem[];
};

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=240&h=240&q=80`;

function imageSrc(imgData: string | { src: string }) {
  return typeof imgData === "string" ? imgData : imgData.src;
}

export const PARTNER_CATEGORY_TYPES: Record<PartnerCategoryKey, PartnerCategoryTypesConfig> = {
  dining: {
    title: "Dining",
    types: [
      { label: "Restaurant", image: imageSrc(images.diningRestaurant) },
      { label: "Bar", image: imageSrc(images.diningBar) },
      { label: "Pub", image: imageSrc(images.diningPub) },
      { label: "Café", image: imageSrc(images.diningCafe) },
    ],
  },
  movie: {
    title: "Movie",
    types: [
      { label: "Cinema", image: imageSrc(images.movieCinema) },
      { label: "Premiere", image: imageSrc(images.moviePremiere) },
    ],
  },
  sports: {
    title: "Sports",
    types: [
      { label: "Football", image: imageSrc(images.sportsFootball) },
      { label: "Basketball", image: imageSrc(images.sportsBasketball) },
      { label: "Boxing", image: imageSrc(images.sportsBoxing) },
    ],
  },
  music: {
    title: "Music",
    types: [
      { label: "Cultural", image: imageSrc(images.musicCultural) },
      { label: "DJ", image: imageSrc(images.musicDj) },
    ],
  },
  comedy: {
    title: "Comedy",
    types: [{ label: "Stand-up", image: imageSrc(images.comedyStandUp) }],
  },
  concert: {
    title: "Concert",
    types: [
      { label: "Cultural", image: imageSrc(images.concertCultural) },
      { label: "Traditional", image: imageSrc(images.concertTraditional) },
      { label: "Live Music", image: imageSrc(images.concertLiveMusic) },
    ],
  },
};
