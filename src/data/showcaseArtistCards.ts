/** Static showcase artist cards — UI fallback when no registered artists are available. */
export type ShowcaseArtistCard = {
  id: string;
  name: string;
  image: string;
  role: string;
  place: string;
  href: string;
};

export const SHOWCASE_ARTIST_CARDS: ShowcaseArtistCard[] = [
  {
    id: "showcase-artist-1",
    name: "Sara Tekle",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&q=80",
    role: "Singer",
    place: "Addis Ababa",
    href: "/artists",
  },
  {
    id: "showcase-artist-2",
    name: "Daniel Mekonnen",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&q=80",
    role: "DJ",
    place: "Addis Ababa",
    href: "/artists",
  },
  {
    id: "showcase-artist-3",
    name: "Hanna Belay",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&q=80",
    role: "Comedian",
    place: "Bahir Dar",
    href: "/artists",
  },
  {
    id: "showcase-artist-4",
    name: "Yonas & The Groove",
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop&q=80",
    role: "Band",
    place: "Addis Ababa",
    href: "/artists",
  },
  {
    id: "showcase-artist-5",
    name: "Liya Assefa",
    image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop&q=80",
    role: "Dancer",
    place: "Hawassa",
    href: "/artists",
  },
  {
    id: "showcase-artist-6",
    name: "Abel Tadesse",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&q=80",
    role: "Musician",
    place: "Addis Ababa",
    href: "/artists",
  },
  {
    id: "showcase-artist-7",
    name: "Meron Desta",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&q=80",
    role: "Vocalist",
    place: "Dire Dawa",
    href: "/artists",
  },
  {
    id: "showcase-artist-8",
    name: "Kaleb Studio",
    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop&q=80",
    role: "Special Act",
    place: "Addis Ababa",
    href: "/artists",
  },
];
