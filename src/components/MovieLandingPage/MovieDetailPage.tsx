"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { useParams } from "next/navigation";

import { ArrowRight, ChevronRight, Loader2, Play, Share2, Star, ThumbsUp, Ticket } from "lucide-react";
import { toast } from "sonner";
import MovieTrailerModal from "@/components/MovieLandingPage/MovieTrailerModal";
import {
  useGetMovieEligiblePlatformOffersQuery,
  useGetPublicMovieQuery,
} from "@/services/api";
import {
  mapApiMovieToDetail,
  withMovieExtras,
  type MovieDetailData,
  type MovieOfferItem,
} from "@/components/MovieLandingPage/movieCatalog";
import MovieDetailSections from "@/components/MovieLandingPage/MovieDetailSections";
import MovieWishlistButton from "@/components/MovieLandingPage/MovieWishlistButton";
import MovieShowtimeSelector from "@/components/MovieLandingPage/MovieShowtimeSelector";



function languageLine(languages: string[]) {

  if (languages.length <= 4) return languages.join(", ");

  return `${languages.slice(0, 3).join(", ")}, +${languages.length - 3}`;

}



function mapPlatformOffersToMovieOffers(

  offers: Array<{ id: string; name: string; description?: string | null; discount_label: string }>

): MovieOfferItem[] {

  return offers.map((offer) => ({

    id: offer.id,

    title: offer.discount_label || offer.name,

    subtitle: offer.description?.trim() || offer.name,

  }));

}



function MovieDetailBanner({ movie }: { movie: MovieDetailData }) {
  const [trailerModalOpen, setTrailerModalOpen] = useState(false);
  const [selectedTrailerUrl, setSelectedTrailerUrl] = useState<string | undefined>(undefined);
  const [selectedTrailerLang, setSelectedTrailerLang] = useState<string | undefined>(undefined);

  const handleOpenTrailer = (url?: string, lang?: string) => {
    setSelectedTrailerUrl(url || movie.trailerUrl || movie.trailers?.[0]?.trailerUrl);
    setSelectedTrailerLang(lang || movie.trailers?.[0]?.language);
    setTrailerModalOpen(true);
  };

  const bg = movie.landscape || movie.poster;

  const metaParts = [

    movie.duration,

    movie.genres.length ? movie.genres.join(", ") : "",

    movie.certification,

    movie.releaseDate,

  ].filter(Boolean);



  const handleShare = async () => {

    const url = typeof window !== "undefined" ? window.location.href : "";

    try {

      if (navigator.share) {

        await navigator.share({ title: movie.title, url });

        return;

      }

      await navigator.clipboard.writeText(url);

      toast.success("Link copied");

    } catch {

      toast.error("Unable to share");

    }

  };



  const bookClass =

    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] px-5 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base font-bold text-white shadow-lg shadow-[#6900AA]/20 hover:opacity-90 transition-opacity";



  const bookLabel = (

    <>

      Book Tickets

      <ArrowRight className="size-4 sm:size-5" strokeWidth={2.25} />

    </>

  );



  return (

    <section className="relative w-full overflow-hidden">

      <div className="absolute inset-0 pointer-events-none" aria-hidden>

        <img src={bg} alt="" className="h-full w-full object-cover object-center" />

        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/25" />

        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/30" />

      </div>



      <div className="relative container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 py-8 sm:py-10 lg:py-14">

        <button

          type="button"

          onClick={handleShare}

          className="absolute top-6 right-5 sm:top-8 sm:right-10 2xl:right-0 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur-sm border border-white/20 px-3 py-1.5 text-xs sm:text-sm font-medium text-white hover:bg-black/50 cursor-pointer"

        >

          <Share2 className="size-3.5 sm:size-4" />

          Share

        </button>



        <nav className="mb-6 sm:mb-8 text-xs sm:text-sm text-white/70 flex items-center gap-1.5 flex-wrap">

          <Link href="/movies" className="hover:text-white transition-colors">

            Movies

          </Link>

          <ChevronRight className="size-3.5 opacity-70" />

          <span className="text-white/90 truncate">{movie.title}</span>

        </nav>



        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-10 items-start">

          <div className="hidden lg:block rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 aspect-[2/3] max-w-[220px]">

            <img src={movie.poster} alt={movie.title} className="h-full w-full object-cover" />

          </div>



          <div className="min-w-0 text-white">

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight">{movie.title}</h1>



            {metaParts.length > 0 && (

              <p className="mt-2 text-sm sm:text-base text-white/80">{metaParts.join(" · ")}</p>

            )}



            {movie.languages.length > 0 && (

              <p className="mt-2 text-xs sm:text-sm text-white/70">{languageLine(movie.languages)}</p>

            )}



            {(movie.rating || movie.votes || movie.likes) && (

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">

                {movie.rating && (

                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5">

                    <Star className="size-4 text-[#EF4444]" fill="currentColor" />

                    <span className="font-bold">{movie.rating}</span>

                    {movie.votes && <span className="text-white/80">{movie.votes}</span>}

                  </span>

                )}

                {movie.likes && (

                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5">

                    <ThumbsUp className="size-4 text-[#22C55E]" fill="currentColor" />

                    <span>{movie.likes}</span>

                  </span>

                )}

              </div>

            )}



            {movie.trailers && movie.trailers.length > 1 ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60 mr-1 flex items-center gap-1.5">
                  <Play className="size-3.5" fill="currentColor" /> Watch Trailer:
                </span>
                {movie.trailers.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleOpenTrailer(t.trailerUrl, t.language)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3.5 py-1.5 text-xs sm:text-sm font-semibold hover:bg-white/20 hover:border-white/50 transition-colors cursor-pointer"
                  >
                    <Play className="size-3 text-rose-400" fill="currentColor" />
                    {t.language}
                  </button>
                ))}
              </div>
            ) : (movie.trailerUrl || (movie.trailers && movie.trailers.length > 0)) ? (
              <button
                type="button"
                onClick={() =>
                  handleOpenTrailer(
                    movie.trailerUrl || movie.trailers?.[0]?.trailerUrl,
                    movie.trailers?.[0]?.language
                  )
                }
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20 transition-colors cursor-pointer"
              >
                <Play className="size-4 text-rose-400" fill="currentColor" />
                Watch trailer
              </button>
            ) : null}

            <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3">
              {movie.comingSoon ? (
                <span className={bookClass.replace("hover:opacity-90", "opacity-80 cursor-default")}>
                  Coming Soon
                </span>
              ) : movie.bookHref ? (
                <Link href={movie.bookHref} className={bookClass}>
                  {bookLabel}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("showtimes-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={bookClass}
                >
                  {bookLabel}
                </button>
              )}

              <MovieWishlistButton movieId={movie.id} />
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Trailer Modal */}
      <MovieTrailerModal
        isOpen={trailerModalOpen}
        onClose={() => setTrailerModalOpen(false)}
        movieTitle={movie.title}
        initialTrailerUrl={selectedTrailerUrl}
        initialLanguage={selectedTrailerLang}
        trailers={movie.trailers}
      />
    </section>
  );
}



export default function MovieDetailPage() {

  const params = useParams();

  const idOrSlug = String(params?.id || "");



  const {

    data: apiMovie,

    isLoading,

    isError,

  } = useGetPublicMovieQuery(idOrSlug, {

    skip: !idOrSlug,

  });



  const { data: platformOffers = [] } = useGetMovieEligiblePlatformOffersQuery(

    { movie_id: apiMovie?.id || "" },

    { skip: !apiMovie?.id }

  );



  const movie = useMemo<MovieDetailData | null>(() => {

    if (!apiMovie) return null;

    const mapped = mapApiMovieToDetail(apiMovie);

    const offers = mapPlatformOffersToMovieOffers(platformOffers);

    return withMovieExtras(
      { ...mapped, offers },
      { fillCastCrew: false, fillOffers: false, fillReviews: true, fillRating: true }
    );

  }, [apiMovie, platformOffers]);



  if (isLoading) {

    return (

      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-slate-400">

        <Loader2 className="size-8 animate-spin text-[#6900AA]" />

        <p className="text-sm sm:text-base font-medium">Loading movie...</p>

      </div>

    );

  }



  if (!movie || isError) {

    return (

      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-5 text-center">

        <p className="text-base sm:text-lg text-slate-700 font-semibold">Movie not found</p>

        <Link href="/movies" className="text-sm sm:text-base font-semibold text-[#6900AA]">

          Back to Movies

        </Link>

      </div>

    );

  }



  return (
    <div className="min-h-screen bg-white">
      <MovieDetailBanner movie={movie} />

      {!movie.comingSoon && (
        <section id="showtimes-section" className="py-10 bg-slate-950 text-white border-t border-b border-white/10">
          <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 space-y-4">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
              <Ticket className="size-6 text-[#F84464]" />
              Select Cinema &amp; Showtime
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Pick a date and cinema below to book your tickets and reserved seats.
            </p>
            <MovieShowtimeSelector
              movieIdOrSlug={idOrSlug}
              movieTitle={movie.title}
              movieCertificate={movie.certification}
            />
          </div>
        </section>
      )}

      <MovieDetailSections movie={movie} idOrSlug={idOrSlug} />
    </div>
  );

}

