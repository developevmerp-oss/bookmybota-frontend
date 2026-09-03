"use client";

import Link from "next/link";
import { useAppSelector } from "@/lib/hooks";
import {
  useGetBusinessSettingsQuery,
  useGetCinemaScreensQuery,
  useGetPartnerMovieShowtimesQuery,
  useGetPartnerMovieCatalogQuery,
  useGetActivePlatformOffersQuery,
} from "@/services/api";
import {
  Clapperboard,
  Film,
  Plus,
  Tag,
  Ticket,
  User,
  Tv,
  Calendar,
  Clock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export default function MovieDashboardPage() {
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";
  const { data: settings } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const { data: screens = [] } = useGetCinemaScreensQuery(bizId, { skip: !bizId });
  const { data: showtimes = [] } = useGetPartnerMovieShowtimesQuery({ bizId }, { skip: !bizId });
  const { data: catalogData } = useGetPartnerMovieCatalogQuery();
  const { data: offers = [] } = useGetActivePlatformOffersQuery();

  const totalCatalogMovies = catalogData?.meta?.total ?? catalogData?.items?.length ?? 0;
  const movieOffers = offers.filter(
    (offer) => offer.category === "MOVIES" || offer.category === "ALL"
  );

  // Format time helper
  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const parts = isoString.split(" ");
      const timePart = parts[1] || parts[0];
      const [hStr, mStr] = timePart.split(":");
      let h = parseInt(hStr, 10);
      const m = mStr || "00";
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      return `${h.toString().padStart(2, "0")}:${m} ${ampm}`;
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Welcome, {settings?.name || user?.name || "Cinema Partner"}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Manage your cinema screens, seat layout requests, catalog showtimes, and movie bookings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/movie/showtimes"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F84464] to-[#6900AA] text-white text-xs sm:text-sm font-bold shadow-lg shadow-[#F84464]/20 hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            Schedule Showtime
          </Link>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Screens */}
        <Link
          href="/movie/screens"
          className="glass-panel rounded-2xl border border-white/10 p-5 hover:border-fuchsia-500/40 transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-xl bg-fuchsia-500/10 text-fuchsia-400 flex items-center justify-center">
              <Tv size={18} />
            </div>
            <ArrowRight size={14} className="text-zinc-600 group-hover:text-fuchsia-400 transition-colors" />
          </div>
          <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Cinema Screens</p>
          <p className="text-3xl font-extrabold text-white mt-1">{screens.length}</p>
          <p className="text-xs text-zinc-500 mt-1">
            {screens.filter((s) => s.is_active).length} active screens
          </p>
        </Link>

        {/* Showtimes */}
        <Link
          href="/movie/showtimes"
          className="glass-panel rounded-2xl border border-white/10 p-5 hover:border-rose-500/40 transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-xl bg-rose-500/10 text-[#F84464] flex items-center justify-center">
              <Clapperboard size={18} />
            </div>
            <ArrowRight size={14} className="text-zinc-600 group-hover:text-rose-400 transition-colors" />
          </div>
          <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Scheduled Shows</p>
          <p className="text-3xl font-extrabold text-white mt-1">{showtimes.length}</p>
          <p className="text-xs text-zinc-500 mt-1">
            {showtimes.filter((s) => s.is_active).length} published shows
          </p>
        </Link>

        {/* Movie Catalog */}
        <Link
          href="/movie/movies"
          className="glass-panel rounded-2xl border border-white/10 p-5 hover:border-purple-500/40 transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Film size={18} />
            </div>
            <ArrowRight size={14} className="text-zinc-600 group-hover:text-purple-400 transition-colors" />
          </div>
          <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Catalog Movies</p>
          <p className="text-3xl font-extrabold text-white mt-1">{totalCatalogMovies}</p>
          <p className="text-xs text-zinc-500 mt-1">Available for scheduling</p>
        </Link>

        {/* Offers */}
        <Link
          href="/movie/offers"
          className="glass-panel rounded-2xl border border-white/10 p-5 hover:border-amber-500/40 transition-colors group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="size-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Tag size={18} />
            </div>
            <ArrowRight size={14} className="text-zinc-600 group-hover:text-amber-400 transition-colors" />
          </div>
          <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Active Offers</p>
          <p className="text-3xl font-extrabold text-white mt-1">{movieOffers.length}</p>
          <p className="text-xs text-zinc-500 mt-1">Platform promo discounts</p>
        </Link>
      </div>

      {/* Recent Scheduled Shows List */}
      <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Clapperboard size={18} className="text-[#F84464]" />
            Your Scheduled Showtimes
          </h2>
          <Link
            href="/movie/showtimes"
            className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
          >
            Manage all shows <ArrowRight size={13} />
          </Link>
        </div>

        {showtimes.length === 0 ? (
          <div className="py-10 text-center text-zinc-500 space-y-3">
            <Clapperboard size={36} className="mx-auto text-zinc-600" />
            <p className="text-sm">No showtimes scheduled yet.</p>
            <Link
              href="/movie/showtimes"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors"
            >
              <Plus size={14} /> Schedule your first show
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {showtimes.slice(0, 5).map((st) => (
              <div
                key={st.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-center justify-between gap-4 hover:border-white/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {st.movie_poster_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveMediaUrl(st.movie_poster_url)}
                      alt={st.movie_title || "Movie"}
                      className="size-12 rounded-lg object-cover bg-zinc-800 shrink-0"
                    />
                  ) : (
                    <div className="size-12 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                      <Film size={20} />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-white">{st.movie_title || "Untitled Movie"}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                      <span>{st.screen_name || "Screen"}</span>
                      <span>•</span>
                      <span className="text-rose-400 font-semibold">{st.format}</span>
                      <span>•</span>
                      <span>{st.language}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-white flex items-center gap-1 justify-end">
                      <Clock size={13} className="text-[#F84464]" />
                      {formatTime(st.starts_at)}
                    </p>
                    <p className="text-zinc-500">{st.starts_at ? String(st.starts_at).slice(0, 10) : ""}</p>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      st.is_active && st.status === "SCHEDULED"
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {st.status || "SCHEDULED"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/movie/screens"
          className="glass-panel rounded-2xl border border-white/10 p-5 hover:border-white/25 transition-colors space-y-2 group"
        >
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Tv size={16} className="text-fuchsia-400" />
            Screens &amp; Layout Requests
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Create screens, configure layout templates, and submit seat layout requests to Super Admin.
          </p>
        </Link>

        <Link
          href="/movie/movies"
          className="glass-panel rounded-2xl border border-white/10 p-5 hover:border-white/25 transition-colors space-y-2 group"
        >
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Film size={16} className="text-purple-400" />
            Movie Catalog
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Explore approved releases from Super Admin to schedule onto your screens.
          </p>
        </Link>

        <Link
          href="/movie/profile"
          className="glass-panel rounded-2xl border border-white/10 p-5 hover:border-white/25 transition-colors space-y-2 group"
        >
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <User size={16} className="text-rose-400" />
            Cinema Partner Profile
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Update cinema address, contact details, cover branding photos, and operating information.
          </p>
        </Link>
      </div>
    </div>
  );
}
