/** Static showcase movie cards — UI fallback when no live movies are available. */
export type ShowcaseMovieCard = {
  id: string;
  title: string;
  poster: string;
  certification: string;
  language: string;
  year?: string;
  comingSoon?: boolean;
  promoted?: boolean;
  href: string;
};

export const SHOWCASE_MOVIE_CARDS: ShowcaseMovieCard[] = [
  {
    id: "showcase-movie-1",
    title: "Mirzapur: The Movie (2026)",
    poster: "",
    certification: "UA16+",
    language: "Telugu, Hindi",
    year: "2026",
    href: "/movies",
  },
  {
    id: "showcase-movie-2",
    title: "Tom & Cherry",
    poster: "",
    certification: "UA 7+",
    language: "Gujarati",
    year: "2026",
    href: "/movies",
  },
  {
    id: "showcase-movie-3",
    title: "Get Set Go",
    poster: "",
    certification: "UA16+",
    language: "Gujarati",
    year: "2026",
    href: "/movies",
  },
  {
    id: "showcase-movie-4",
    title: "Jindagi Once More",
    poster: "",
    certification: "U",
    language: "Gujarati",
    year: "2025",
    href: "/movies",
  },
  {
    id: "showcase-movie-5",
    title: "The Night Express",
    poster: "",
    certification: "UA",
    language: "Amharic, English",
    comingSoon: true,
    year: "2026",
    href: "/movies",
  },
  {
    id: "showcase-movie-6",
    title: "Desert Mirage",
    poster: "",
    certification: "UA16+",
    language: "Amharic, English",
    comingSoon: true,
    year: "2026",
    href: "/movies",
  },
  {
    id: "showcase-movie-7",
    title: "Cinema Nights",
    poster: "",
    certification: "U",
    language: "English",
    comingSoon: true,
    year: "2026",
    href: "/movies",
  },
];

/** Now Showing–style static cards (no coming soon badge). */
export const SHOWCASE_NOW_SHOWING_MOVIE_CARDS = SHOWCASE_MOVIE_CARDS.filter((m) => !m.comingSoon);

/** Upcoming–style static cards (coming soon badge). */
export const SHOWCASE_UPCOMING_MOVIE_CARDS = SHOWCASE_MOVIE_CARDS.filter((m) => m.comingSoon);
