import type { PublicEvent } from "@/services/api";
import images from "@/Images";

function imageSrc(img: string | { src: string }) {
  return typeof img === "string" ? img : img.src;
}

export const CATEGORY_NAV_TILES = [
  {
    key: "dining",
    title: "Dining",
    keywords: ["dining"],
    fallbackSlug: "dining",
    countLabel: "Places to dine",
    image: imageSrc(images.diningCard),
  },
  {
    key: "concert",
    title: "Concert",
    keywords: ["concert"],
    fallbackSlug: "concert",
    countLabel: "Live concerts",
    image: imageSrc(images.concertCard),
  },
  {
    key: "comedy",
    title: "Comedy",
    keywords: ["comedy"],
    fallbackSlug: "comedy",
    countLabel: "Comedy shows",
    image: imageSrc(images.comedyCard),
  },
  {
    key: "music",
    title: "Music",
    keywords: ["music"],
    fallbackSlug: "music",
    countLabel: "Music events",
    image: imageSrc(images.musicCard),
  },
  {
    key: "movie",
    title: "Movie",
    keywords: ["movie", "movies", "film"],
    fallbackSlug: "movie",
    countLabel: "Movies to watch",
    image: imageSrc(images.movieCard),
  },
  {
    key: "sports",
    title: "Sports",
    keywords: ["sports", "sport"],
    fallbackSlug: "sports",
    countLabel: "Sports events",
    image: imageSrc(images.sportsCard),
  },
] as const;

export type CategoryNavTile = {
  key: string;
  href: string;
  title: string;
  count: number;
  countLabel: string;
  image: string;
};

export function titleLines(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [name.toUpperCase()];
  if (words.length === 2) return words.map((w) => w.toUpperCase());
  return [words.slice(0, -1).join(" ").toUpperCase(), words[words.length - 1].toUpperCase()];
}

export function matchEventsByKeywords(events: PublicEvent[], keywords: readonly string[]) {
  const keys = keywords.map((k) => k.toLowerCase());
  return events.filter((e) => {
    const es = (e.category_slug || "").toLowerCase();
    const en = (e.category_name || "").toLowerCase();
    return keys.some((k) => es === k || en === k || es.includes(k) || en.includes(k));
  });
}

export function buildCategoryNavTiles(input: {
  categories: Array<{ slug: string; name: string }>;
  events: PublicEvent[];
  diningCount: number;
  movieCount: number;
  city?: string;
}): CategoryNavTile[] {
  const { categories, events, diningCount, movieCount, city } = input;
  const cityQuery =
    city && city !== "All Cities" ? `?city=${encodeURIComponent(city)}` : "";

  return CATEGORY_NAV_TILES.map((tile) => {
    if (tile.key === "dining") {
      return {
        key: tile.key,
        href: `/dining${cityQuery}`,
        title: tile.title,
        count: diningCount,
        countLabel: tile.countLabel,
        image: tile.image,
      };
    }

    if (tile.key === "movie") {
      return {
        key: tile.key,
        href: "/movies",
        title: tile.title,
        count: movieCount,
        countLabel: tile.countLabel,
        image: tile.image,
      };
    }

    const matchedCategory = categories.find((cat) => {
      const slug = (cat.slug || "").toLowerCase();
      const name = (cat.name || "").toLowerCase();
      return tile.keywords.some((k) => slug.includes(k) || name.includes(k));
    });
    const matchedEvents = matchEventsByKeywords(events, tile.keywords);

    return {
      key: tile.key,
      href: `/events?category=${encodeURIComponent(matchedCategory?.slug || tile.fallbackSlug)}`,
      title: tile.title,
      count: matchedEvents.length,
      countLabel: tile.countLabel,
      image: tile.image,
    };
  });
}
