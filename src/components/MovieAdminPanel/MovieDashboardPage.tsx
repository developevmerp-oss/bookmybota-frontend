"use client";

import Link from "next/link";
import { useAppSelector } from "@/lib/hooks";
import { useGetBusinessSettingsQuery } from "@/services/api";
import { Clapperboard, Film, Ticket, User } from "lucide-react";

export default function MovieDashboardPage() {
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";
  const { data: settings } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">
          Welcome{settings?.name ? `, ${settings.name}` : ""}
        </h2>
        <p className="text-zinc-400 mt-1">
          Your cinema partner account is active. Movie listing and showtime tools will appear here as
          they are rolled out.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl border border-white/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Film size={16} className="text-fuchsia-400" />
            <p className="text-xs text-fuchsia-400/80 uppercase tracking-wide">Movies</p>
          </div>
          <p className="text-3xl font-bold text-white mt-1">—</p>
          <p className="text-xs text-zinc-500 mt-1">Coming soon</p>
        </div>
        <div className="glass-panel rounded-2xl border border-indigo-500/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clapperboard size={16} className="text-indigo-400" />
            <p className="text-xs text-indigo-400/80 uppercase tracking-wide">Showtimes</p>
          </div>
          <p className="text-3xl font-bold text-indigo-300 mt-1">—</p>
          <p className="text-xs text-zinc-500 mt-1">Coming soon</p>
        </div>
        <div className="glass-panel rounded-2xl border border-violet-500/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Ticket size={16} className="text-violet-400" />
            <p className="text-xs text-violet-400/80 uppercase tracking-wide">Bookings</p>
          </div>
          <p className="text-3xl font-bold text-violet-300 mt-1">—</p>
          <p className="text-xs text-zinc-500 mt-1">Coming soon</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-5 space-y-3">
        <p className="text-sm font-semibold text-white">Quick links</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/movie/profile"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:border-fuchsia-500/30 transition-colors"
          >
            <User size={16} />
            Update profile
          </Link>
        </div>
      </div>
    </div>
  );
}
