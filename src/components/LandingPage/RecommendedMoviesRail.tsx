"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star, ThumbsUp } from "lucide-react";
import "./RecommendedMoviesRail.css";

type MovieCardData = {
  id: string;
  title: string;
  genres: string;
  poster: string;
  promoted?: boolean;
  rating?: string;
  votes?: string;
  likes?: string;
};

/** Static showcase data for the landing Recommended Movies rail. */
export const RECOMMENDED_MOVIES: MovieCardData[] = [
  {
    id: "1",
    title: "Awarapan 2",
    genres: "Action/Crime/Romantic",
    poster: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&h=750&fit=crop&q=80",
    promoted: true,
    rating: "8.2/10",
    votes: "55.6K+ Votes",
  },
  {
    id: "2",
    title: "Batwara 1947",
    genres: "Action/Drama/Period",
    poster: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=500&h=750&fit=crop&q=80",
    rating: "7.9/10",
    votes: "12.1K+ Votes",
  },
  {
    id: "3",
    title: "Insidious: Out of The Further",
    genres: "Horror/Thriller",
    poster: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=500&h=750&fit=crop&q=80",
    rating: "8.9/10",
    votes: "470+ Votes",
  },
  {
    id: "4",
    title: "Spider-Man: Brand New Day",
    genres: "Action/Adventure/Sci-Fi",
    poster: "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=500&h=750&fit=crop&q=80",
    rating: "8.9/10",
    votes: "314K+ Votes",
  },
  {
    id: "5",
    title: "PAW Patrol: The Dino Movie",
    genres: "Adventure/Animation/Comedy",
    poster: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=500&h=750&fit=crop&q=80",
    likes: "6.8K+ Likes",
  },
  {
    id: "6",
    title: "The Night Express",
    genres: "Thriller/Mystery",
    poster: "https://images.unsplash.com/photo-1440404653325-ab127d49abb1?w=500&h=750&fit=crop&q=80",
    rating: "8.1/10",
    votes: "22.4K+ Votes",
  },
  {
    id: "7",
    title: "Desert Mirage",
    genres: "Drama/Adventure",
    poster: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=500&h=750&fit=crop&q=80",
    rating: "7.5/10",
    votes: "9.2K+ Votes",
  },
];

const VISIBLE = 5;

function MovieCard({ movie }: { movie: MovieCardData }) {
  return (
    <article className="movies-rail-slot group">
      <div className="relative overflow-hidden rounded-t-lg bg-[#111111]">
        <div className="aspect-[2/3] w-full overflow-hidden">
          <img
            src={movie.poster}
            alt={movie.title}
            className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            loading="lazy"
            draggable={false}
          />
        </div>
        {movie.promoted && (
          <span className="absolute top-2 right-2 rounded-full bg-[#6900AA] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Promoted
          </span>
        )}
        <div className="flex items-center gap-1.5 bg-[#111111] px-2.5 py-1.5 text-white">
          {movie.likes ? (
            <>
              <ThumbsUp size={14} className="shrink-0 text-[#22C55E]" fill="currentColor" />
              <span className="text-xs font-medium truncate">{movie.likes}</span>
            </>
          ) : (
            <>
              <Star size={14} className="shrink-0 text-[#6900AA]" fill="currentColor" />
              <span className="text-xs font-semibold shrink-0">{movie.rating}</span>
              <span className="text-xs text-white/80 truncate">{movie.votes}</span>
            </>
          )}
        </div>
      </div>
      <h3 className="mt-2.5 text-sm sm:text-base font-semibold text-[#111111] line-clamp-2 leading-snug">
        {movie.title}
      </h3>
      <p className="mt-1 text-xs sm:text-sm text-[#6B6B6B] line-clamp-1">{movie.genres}</p>
    </article>
  );
}

export default function RecommendedMoviesRail() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="bg-white py-6 sm:py-8 lg:py-10">
      <div className="container mx-auto px-4 md:px-5 lg:px-8">
        <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-5">
          <h2 className="text-xl sm:text-[22px] md:text-2xl font-semibold tracking-tight text-[#111111]">
            Recommended Movies
          </h2>
          <Link
            href="/events"
            className="shrink-0 text-xs sm:text-sm font-medium text-[#6900AA] hover:text-[#57008E]"
          >
            See All ›
          </Link>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label="Previous movies"
            onClick={() => scrollBy(-1)}
            className="hidden md:flex absolute -left-2 lg:-left-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
          >
            <ChevronLeft size={18} />
          </button>

          <div
            ref={scrollerRef}
            className="movies-rail"
            style={{ ["--movies-visible" as string]: VISIBLE }}
          >
            {RECOMMENDED_MOVIES.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>

          <button
            type="button"
            aria-label="Next movies"
            onClick={() => scrollBy(1)}
            className="hidden md:flex absolute -right-2 lg:-right-3 top-[38%] -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center cursor-pointer bg-white border border-[#EDEDED] text-[#111111] shadow-sm hover:bg-[#F7E9FF]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
