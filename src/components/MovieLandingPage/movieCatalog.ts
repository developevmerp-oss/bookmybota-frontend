export type MovieDetailData = {
  id: string;
  slug?: string;
  title: string;
  poster: string;
  landscape?: string;
  certification?: string;
  languages: string[];
  genres: string[];
  formats: string[];
  rating?: string;
  votes?: string;
  likes?: string;
  duration?: string;
  releaseDate?: string;
  synopsis?: string;
  trailersCount?: number;
  trailerUrl?: string;
  inCinemas?: boolean;
  comingSoon?: boolean;
  bookHref?: string;
  cast?: MoviePerson[];
  crew?: MoviePerson[];
  offers?: MovieOfferItem[];
  reviews?: MovieReviewItem[];
  reviewTags?: Array<{ tag: string; count: number }>;
  reviewsCountLabel?: string;
};

export type MoviePerson = {
  name: string;
  role?: string;
  image: string;
};

export type MovieOfferItem = {
  id: string;
  title: string;
  subtitle?: string;
};

export type MovieReviewItem = {
  id: string;
  userName: string;
  rating: string;
  text: string;
  tags?: string[];
  likes?: number;
  timeAgo?: string;
};

const DEFAULT_CAST: MoviePerson[] = [
  {
    name: "Yash",
    role: "as Raya",
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=500&fit=crop&q=80",
  },
  {
    name: "Nayanthara",
    role: "as Lead",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop&q=80",
  },
  {
    name: "Kiara Advani",
    role: "as Supporting",
    image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=500&fit=crop&q=80",
  },
  {
    name: "Huma Qureshi",
    role: "as Supporting",
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=500&fit=crop&q=80",
  },
  {
    name: "Rana Daggubati",
    role: "as Antagonist",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=500&fit=crop&q=80",
  },
  {
    name: "Tara Sutaria",
    role: "as Supporting",
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop&q=80",
  },
];

const DEFAULT_CREW: MoviePerson[] = [
  {
    name: "Geetu Mohandas",
    role: "Director",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=300&fit=crop&q=80",
  },
  {
    name: "G.V. Prakash Kumar",
    role: "Musician",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&q=80",
  },
  {
    name: "Vijay Kiragandur",
    role: "Producer",
    image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop&q=80",
  },
  {
    name: "Rahul Suresh",
    role: "Writer",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop&q=80",
  },
  {
    name: "Anirudh Ravichander",
    role: "Music",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&q=80",
  },
];

const DEFAULT_OFFERS: MovieOfferItem[] = [
  { id: "o1", title: "YES Private Debit Card Offer", subtitle: "Tap to view details" },
  { id: "o2", title: "Visa Infinite Card Offer", subtitle: "Tap to view details" },
  { id: "o3", title: "BookMyBota Cashback up to 100 ETB", subtitle: "Tap to view details" },
];

const DEFAULT_REVIEWS: MovieReviewItem[] = [
  {
    id: "r1",
    userName: "User",
    rating: "10/10",
    text: "Booked on BookMyBota",
    tags: ["#Rocking", "#GreatActing", "#Blockbuster"],
    likes: 24,
    timeAgo: "4 Hours ago",
  },
  {
    id: "r2",
    userName: "CinemaFan",
    rating: "9/10",
    text: "Booked on BookMyBota",
    tags: ["#MustWatch", "#Thriller"],
    likes: 18,
    timeAgo: "1 Day ago",
  },
  {
    id: "r3",
    userName: "MovieBuff",
    rating: "8/10",
    text: "Booked on BookMyBota",
    tags: ["#WorthIt", "#Action"],
    likes: 11,
    timeAgo: "2 Days ago",
  },
];

const DEFAULT_REVIEW_TAGS = [
  { tag: "#Rocking", count: 5883 },
  { tag: "#GreatActing", count: 5506 },
  { tag: "#Blockbuster", count: 4500 },
  { tag: "#MustWatch", count: 3201 },
  { tag: "#Wholesome", count: 2100 },
];

export const MOVIE_CATALOG: MovieDetailData[] = [
  {
    id: "s1",
    slug: "toxic-a-fairy-tale-for-grown-ups",
    title: "Toxic: A Fairy Tale for Grown-ups",
    poster: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&h=750&fit=crop&q=80",
    landscape: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1600&h=800&fit=crop&q=80",
    certification: "A",
    languages: ["Kannada", "Telugu", "Tamil", "Hindi", "Malayalam", "English"],
    genres: ["Action", "Crime", "Period", "Thriller"],
    formats: ["2D", "4DX", "IMAX 2D", "EPIQ", "DOLBY CINEMA 2D", "ICE"],
    rating: "5.6/10",
    votes: "26.3K+ Votes",
    duration: "3h 14m",
    releaseDate: "26 Aug, 2026",
    synopsis:
      "A high-octane fairy tale for grown-ups — intense action, crime, and thriller twists. Book your tickets and experience it on the big screen.",
    trailersCount: 1,
    trailerUrl: "https://youtu.be/sJwaiRN-rvc?si=oQX0jAqaOXtyTjMP",
    inCinemas: true,
    cast: DEFAULT_CAST,
    crew: DEFAULT_CREW,
    offers: DEFAULT_OFFERS,
    reviews: DEFAULT_REVIEWS,
    reviewTags: DEFAULT_REVIEW_TAGS,
    reviewsCountLabel: "15K reviews",
  },
  {
    id: "s2",
    slug: "tom-and-cherry",
    title: "Tom & Cherry",
    poster: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500&h=750&fit=crop&q=80",
    certification: "UA 7+",
    languages: ["Gujarati"],
    genres: ["Comedy", "Animation"],
    formats: ["2D", "3D"],
    likes: "25.5K+ Likes",
    duration: "1h 45m",
    releaseDate: "15 Aug, 2026",
    synopsis: "A fun family adventure full of laughs, heart, and colorful animation.",
    trailersCount: 4,
    inCinemas: true,
  },
  {
    id: "s3",
    slug: "get-set-go",
    title: "Get Set Go",
    poster: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&h=750&fit=crop&q=80",
    certification: "UA16+",
    languages: ["Gujarati"],
    genres: ["Comedy"],
    formats: ["2D"],
    rating: "8.9/10",
    votes: "620+ Votes",
    duration: "2h 05m",
    releaseDate: "10 Aug, 2026",
    synopsis: "A breezy comedy about friendship, ambition, and finding your pace.",
    trailersCount: 3,
    inCinemas: true,
  },
  {
    id: "s4",
    slug: "jindagi-once-more",
    title: "Jindagi Once More",
    poster: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=500&h=750&fit=crop&q=80",
    certification: "U",
    languages: ["Gujarati"],
    genres: ["Drama"],
    formats: ["2D"],
    rating: "7.9/10",
    votes: "1.7K+ Votes",
    duration: "2h 20m",
    releaseDate: "01 Aug, 2026",
    synopsis: "A heartfelt drama about second chances and the people who shape us.",
    trailersCount: 2,
    inCinemas: true,
  },
  {
    id: "s5",
    slug: "spider-man-brand-new-day",
    title: "Spider-Man: Brand New Day",
    poster: "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=500&h=750&fit=crop&q=80",
    certification: "UA",
    languages: ["English"],
    genres: ["Action", "Adventure", "Sci-Fi"],
    formats: ["2D", "3D", "IMAX 2D"],
    rating: "8.9/10",
    votes: "314K+ Votes",
    duration: "2h 28m",
    releaseDate: "20 Jul, 2026",
    synopsis: "A brand-new day of web-slinging action and city-saving thrills.",
    trailersCount: 8,
    inCinemas: true,
  },
  {
    id: "s6",
    slug: "insidious-out-of-the-further",
    title: "Insidious: Out of The Further",
    poster: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=500&h=750&fit=crop&q=80",
    certification: "A",
    languages: ["English"],
    genres: ["Horror", "Thriller"],
    formats: ["2D", "4DX"],
    rating: "8.9/10",
    votes: "470+ Votes",
    duration: "1h 52m",
    releaseDate: "12 Jul, 2026",
    synopsis: "Terror returns from The Further in this chilling new chapter.",
    trailersCount: 5,
    inCinemas: true,
  },
  {
    id: "u1",
    slug: "desert-mirage",
    title: "Desert Mirage",
    poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abb1?w=500&h=750&fit=crop&q=80",
    certification: "UA",
    languages: ["Amharic", "English"],
    genres: ["Drama", "Adventure"],
    formats: ["2D"],
    likes: "6.8K+ Likes",
    duration: "2h 10m",
    releaseDate: "Coming Soon",
    synopsis: "An atmospheric adventure across dunes, destiny, and discovery.",
    trailersCount: 2,
    comingSoon: true,
  },
  {
    id: "u2",
    slug: "the-night-express",
    title: "The Night Express",
    poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&h=750&fit=crop&q=80",
    certification: "UA16+",
    languages: ["English"],
    genres: ["Thriller"],
    formats: ["2D", "IMAX 2D"],
    rating: "8.1/10",
    votes: "22.4K+ Votes",
    duration: "2h 02m",
    releaseDate: "Coming Soon",
    synopsis: "A midnight thriller racing against time on a train with no exits.",
    trailersCount: 3,
    comingSoon: true,
  },
  {
    id: "u3",
    slug: "marham-poetry-music-night",
    title: "Marham: Poetry & Music Night",
    poster: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=500&h=750&fit=crop&q=80",
    certification: "U",
    languages: ["Amharic"],
    genres: ["Drama"],
    formats: ["2D"],
    likes: "390+ Likes",
    duration: "1h 40m",
    releaseDate: "Coming Soon",
    synopsis: "An evening of poetry, music, and stories that heal.",
    trailersCount: 1,
    comingSoon: true,
  },
];

export function getCatalogMovie(idOrSlug: string) {
  const key = idOrSlug.trim().toLowerCase();
  if (!key) return null;
  return (
    MOVIE_CATALOG.find((movie) => {
      const id = movie.id.toLowerCase();
      const slug = (movie.slug || "").toLowerCase();
      return id === key || slug === key;
    }) || null
  );
}

import { resolveMediaUrl } from "@/lib/mediaUrl";

const FALLBACK_POSTER =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&h=750&fit=crop&q=80";

/** Map API movie record to customer detail shape. */
export function mapApiMovieToDetail(movie: {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  poster_url?: string | null;
  banner_url?: string | null;
  trailer_url?: string | null;
  duration_minutes?: number | null;
  certificate?: string | null;
  release_date?: string | null;
  languages?: string[];
  genres?: string[];
  formats?: string[];
  cast_text?: string | null;
  director?: string | null;
  status?: string;
}): MovieDetailData {
  const poster = resolveMediaUrl(movie.poster_url) || FALLBACK_POSTER;
  const landscape = resolveMediaUrl(movie.banner_url) || resolveMediaUrl(movie.poster_url) || undefined;
  const comingSoon = movie.status === "coming_soon";
  return {
    id: movie.id,
    slug: movie.slug,
    title: movie.title,
    poster,
    landscape,
    certification: movie.certificate?.trim() || undefined,
    languages: movie.languages || [],
    genres: movie.genres || [],
    formats: movie.formats?.length ? movie.formats : ["2D"],
    duration: formatDurationShort(movie.duration_minutes),
    releaseDate: comingSoon
      ? "Coming Soon"
      : formatReleaseShort(movie.release_date || undefined),
    synopsis: movie.description?.trim() || undefined,
    trailerUrl: movie.trailer_url?.trim() || undefined,
    trailersCount: movie.trailer_url ? 1 : 0,
    inCinemas: movie.status === "now_showing",
    comingSoon,
  };
}

export function movieDetailPath(movie: Pick<MovieDetailData, "id" | "slug">) {
  return `/movies/${movie.slug || movie.id}`;
}

/** Fill showcase extras for catalog titles that don't define their own. */
export function withMovieExtras(movie: MovieDetailData): MovieDetailData {
  return {
    ...movie,
    cast: movie.cast?.length ? movie.cast : DEFAULT_CAST,
    crew: movie.crew?.length ? movie.crew : DEFAULT_CREW,
    offers: movie.offers?.length ? movie.offers : DEFAULT_OFFERS,
    reviews: movie.reviews?.length ? movie.reviews : DEFAULT_REVIEWS,
    reviewTags: movie.reviewTags?.length ? movie.reviewTags : DEFAULT_REVIEW_TAGS,
    reviewsCountLabel: movie.reviewsCountLabel || "1.2K reviews",
  };
}

export function formatDurationShort(minutes?: number | null) {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function formatReleaseShort(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatVotesLabel(n?: number) {
  if (!n || n <= 0) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M+ Votes`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K+ Votes`;
  return `${n}+ Votes`;
}
