import type { EventCategoryKey } from "@/lib/eventCategories";

/** Static showcase event cards — UI fallback when no live events are available. */
export type ShowcaseEventCard = {
  id: string;
  title: string;
  image: string;
  showDate: string;
  place: string;
  eventType: string;
  href: string;
  category: EventCategoryKey;
};

export const SHOWCASE_EVENT_CARDS_BY_CATEGORY: Record<EventCategoryKey, ShowcaseEventCard[]> = {
  concert: [
    {
      id: "showcase-concert-1",
      title: "Addis Live Concert Night",
      image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd0?w=500&h=750&fit=crop&q=80",
      showDate: "2026-10-18T19:00:00",
      place: "Millennium Hall: Addis Ababa",
      eventType: "Concert · Live Music",
      href: "/events?category=concert",
      category: "concert",
    },
    {
      id: "showcase-concert-2",
      title: "Sunset Arena Concert",
      image: "https://images.unsplash.com/photo-1540037873-006683e40f3e?w=500&h=750&fit=crop&q=80",
      showDate: "2026-11-08T18:30:00",
      place: "Friendship Park: Addis Ababa",
      eventType: "Concert · Arena",
      href: "/events?category=concert",
      category: "concert",
    },
  ],
  comedy: [
    {
      id: "showcase-comedy-1",
      title: "Addis Stand-Up Comedy Night",
      image: "https://images.unsplash.com/photo-1527224857830-43a7bb10870c?w=500&h=750&fit=crop&q=80",
      showDate: "2026-10-25T20:00:00",
      place: "Jazzamba Lounge: Addis Ababa",
      eventType: "Comedy · Stand-Up",
      href: "/events?category=comedy",
      category: "comedy",
    },
    {
      id: "showcase-comedy-2",
      title: "Laugh Factory Live",
      image: "https://images.unsplash.com/photo-1585699324551-c6dc3dc0f9ed?w=500&h=750&fit=crop&q=80",
      showDate: "2026-11-15T19:30:00",
      place: "Kazanchis Social House: Addis Ababa",
      eventType: "Comedy · Open Mic",
      href: "/events?category=comedy",
      category: "comedy",
    },
  ],
  music: [
    {
      id: "showcase-music-1",
      title: "Ethiopian Jazz Festival",
      image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&h=750&fit=crop&q=80",
      showDate: "2026-12-01T17:00:00",
      place: "National Theatre: Addis Ababa",
      eventType: "Music · Jazz",
      href: "/events?category=music",
      category: "music",
    },
    {
      id: "showcase-music-2",
      title: "Habesha Music Live",
      image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&h=750&fit=crop&q=80",
      showDate: "2026-12-20T18:00:00",
      place: "Skylight Hotel: Addis Ababa",
      eventType: "Music · Traditional",
      href: "/events?category=music",
      category: "music",
    },
  ],
  sports: [
    {
      id: "showcase-sports-1",
      title: "Great Ethiopian Run 10K",
      image: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=500&h=750&fit=crop&q=80",
      showDate: "2026-11-20T09:00:00",
      place: "Meskel Square: Addis Ababa",
      eventType: "Sports · Running",
      href: "/events?category=sports",
      category: "sports",
    },
    {
      id: "showcase-sports-2",
      title: "Ethiopian Premier League Final",
      image: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=500&h=750&fit=crop&q=80",
      showDate: "2026-12-05T16:00:00",
      place: "Addis Ababa Stadium: Addis Ababa",
      eventType: "Sports · Football",
      href: "/events?category=sports",
      category: "sports",
    },
    {
      id: "showcase-sports-3",
      title: "National Wrestling Cup",
      image: "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=500&h=750&fit=crop&q=80",
      showDate: "2026-12-12T14:00:00",
      place: "Dire Dawa Arena: Dire Dawa",
      eventType: "Sports · Wrestling",
      href: "/events?category=sports",
      category: "sports",
    },
    {
      id: "showcase-sports-4",
      title: "Addis Basketball Night",
      image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=500&h=750&fit=crop&q=80",
      showDate: "2026-12-18T19:00:00",
      place: "Millennium Hall: Addis Ababa",
      eventType: "Sports · Basketball",
      href: "/events?category=sports",
      category: "sports",
    },
    {
      id: "showcase-sports-5",
      title: "Rift Valley Cycling Challenge",
      image: "https://images.unsplash.com/photo-1517649763962-0c623066027c?w=500&h=750&fit=crop&q=80",
      showDate: "2027-01-22T07:00:00",
      place: "Hawassa Lakeside: Hawassa",
      eventType: "Sports · Cycling",
      href: "/events?category=sports",
      category: "sports",
    },
  ],
};

/** All showcase cards across Concert, Comedy, Music, and Sports. */
export const SHOWCASE_EVENT_CARDS: ShowcaseEventCard[] = (
  Object.values(SHOWCASE_EVENT_CARDS_BY_CATEGORY) as ShowcaseEventCard[][]
).flat();

/** Sports-only showcase cards for the Popular Sports Events rail. */
export const SHOWCASE_SPORTS_EVENT_CARDS = SHOWCASE_EVENT_CARDS_BY_CATEGORY.sports;

export function showcaseCardsForCategory(category: EventCategoryKey): ShowcaseEventCard[] {
  return SHOWCASE_EVENT_CARDS_BY_CATEGORY[category];
}

export function showcaseCardsForCategories(categories: EventCategoryKey[]): ShowcaseEventCard[] {
  if (categories.length === 0) return SHOWCASE_EVENT_CARDS;
  return categories.flatMap((category) => SHOWCASE_EVENT_CARDS_BY_CATEGORY[category]);
}
