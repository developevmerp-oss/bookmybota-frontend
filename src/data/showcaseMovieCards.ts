/** Static showcase movie cards — UI fallback when no live movies are available. */
export type ShowcaseMovieCard = {
  id: string;
  title: string;
  poster: string;
  certification: string;
  language: string;
  comingSoon?: boolean;
  href: string;
};

export const SHOWCASE_MOVIE_CARDS: ShowcaseMovieCard[] = [
  {
    id: "showcase-movie-1",
    title: "Toxic: A Fairy Tale for Grown-ups",
    poster: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&h=750&fit=crop&q=80",
    certification: "A",
    language: "Kannada, Telugu, Tamil, Hindi, Malayalam",
    href: "/movies",
  },
  {
    id: "showcase-movie-2",
    title: "Tom & Cherry",
    poster: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&h=750&fit=crop&q=80",
    certification: "UA 7+",
    language: "Gujarati",
    href: "/movies",
  },
  {
    id: "showcase-movie-3",
    title: "Get Set Go",
    poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abb1?w=500&h=750&fit=crop&q=80",
    certification: "UA16+",
    language: "Gujarati",
    href: "/movies",
  },
  {
    id: "showcase-movie-4",
    title: "Jindagi Once More",
    poster: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=500&h=750&fit=crop&q=80",
    certification: "U",
    language: "Gujarati",
    href: "/movies",
  },
  {
    id: "showcase-movie-5",
    title: "The Night Express",
    poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&h=750&fit=crop&q=80",
    certification: "UA",
    language: "Amharic, English",
    comingSoon: true,
    href: "/movies",
  },
  {
    id: "showcase-movie-6",
    title: "Desert Mirage",
    poster: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=500&h=750&fit=crop&q=80",
    certification: "UA16+",
    language: "Amharic, English",
    comingSoon: true,
    href: "/movies",
  },
  {
    id: "showcase-movie-7",
    title: "Cinema Nights",
    poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&h=750&fit=crop&q=80",
    certification: "U",
    language: "English",
    comingSoon: true,
    href: "/movies",
  },
];

/** Now Showing–style static cards (no coming soon badge). */
export const SHOWCASE_NOW_SHOWING_MOVIE_CARDS = SHOWCASE_MOVIE_CARDS.filter((m) => !m.comingSoon);

/** Upcoming–style static cards (coming soon badge). */
export const SHOWCASE_UPCOMING_MOVIE_CARDS = SHOWCASE_MOVIE_CARDS.filter((m) => m.comingSoon);
