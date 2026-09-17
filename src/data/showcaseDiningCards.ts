/** Static showcase dining cards — UI fallback when no live restaurants are available. */
export type ShowcaseDiningCard = {
  id: string;
  name: string;
  image: string;
  rating: number;
  locality: string;
  cuisine: string;
  href: string;
  kind?: "restaurant" | "bar";
};

export const SHOWCASE_DINING_CARDS: ShowcaseDiningCard[] = [
  {
    id: "showcase-dining-1",
    name: "The Sweet Spot",
    image: "",
    rating: 4.9,
    locality: "Bole: Addis Ababa",
    cuisine: "Desserts · Cafe",
    href: "/dining",
    kind: "restaurant",
  },
  {
    id: "showcase-dining-2",
    name: "Habesha Kitchen",
    image: "",
    rating: 4.7,
    locality: "Kazanchis: Addis Ababa",
    cuisine: "Ethiopian · Traditional",
    href: "/dining",
    kind: "restaurant",
  },
  {
    id: "showcase-dining-3",
    name: "Sushi 360",
    image: "",
    rating: 4.6,
    locality: "CMC: Addis Ababa",
    cuisine: "Japanese · Sushi",
    href: "/dining",
    kind: "restaurant",
  },
  {
    id: "showcase-dining-4",
    name: "Garden Table",
    image: "",
    rating: 4.8,
    locality: "Old Airport: Addis Ababa",
    cuisine: "Continental · Fine Dining",
    href: "/dining",
    kind: "restaurant",
  },
  {
    id: "showcase-dining-5",
    name: "Spice Route",
    image: "",
    rating: 4.5,
    locality: "Piassa: Addis Ababa",
    cuisine: "Indian · Curry",
    href: "/dining",
    kind: "restaurant",
  },
  {
    id: "showcase-dining-6",
    name: "La Piazza Trattoria",
    image: "",
    rating: 4.4,
    locality: "Friendship Park: Addis Ababa",
    cuisine: "Italian · Pasta",
    href: "/dining",
    kind: "restaurant",
  },
  {
    id: "showcase-dining-7",
    name: "Skyline Grill",
    image: "",
    rating: 4.7,
    locality: "Meskel Square: Addis Ababa",
    cuisine: "Grill · Steakhouse",
    href: "/dining",
    kind: "restaurant",
  },
  {
    id: "showcase-dining-8",
    name: "Morning Brew Cafe",
    image: "",
    rating: 4.6,
    locality: "Sarbet: Addis Ababa",
    cuisine: "Cafe · Breakfast",
    href: "/dining",
    kind: "restaurant",
  },
];

/** Bar / lounge showcase cards for the Raise a Glass rail. */
export const SHOWCASE_BAR_CARDS: ShowcaseDiningCard[] = [
  {
    id: "showcase-bar-1",
    name: "Neon Lounge",
    image: "",
    rating: 4.8,
    locality: "Bole: Addis Ababa",
    cuisine: "Bar · Cocktails",
    href: "/dining",
    kind: "bar",
  },
  {
    id: "showcase-bar-2",
    name: "Rooftop Social",
    image: "",
    rating: 4.7,
    locality: "Kazanchis: Addis Ababa",
    cuisine: "Bar · Lounge",
    href: "/dining",
    kind: "bar",
  },
  {
    id: "showcase-bar-3",
    name: "The Copper Room",
    image: "",
    rating: 4.6,
    locality: "Old Airport: Addis Ababa",
    cuisine: "Bar · Whisky",
    href: "/dining",
    kind: "bar",
  },
  {
    id: "showcase-bar-4",
    name: "Jazzamba After Dark",
    image: "",
    rating: 4.9,
    locality: "Piassa: Addis Ababa",
    cuisine: "Bar · Live Music",
    href: "/dining",
    kind: "bar",
  },
  {
    id: "showcase-bar-5",
    name: "Sky Bar Addis",
    image: "",
    rating: 4.5,
    locality: "CMC: Addis Ababa",
    cuisine: "Bar · Nightlife",
    href: "/dining",
    kind: "bar",
  },
  {
    id: "showcase-bar-6",
    name: "Velvet Pour",
    image: "",
    rating: 4.4,
    locality: "Friendship Park: Addis Ababa",
    cuisine: "Bar · Wine",
    href: "/dining",
    kind: "bar",
  },
];
