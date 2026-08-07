"use client";
import { useAppSelector } from "@/lib/hooks";
import { useGetBusinessSettingsQuery } from "@/services/api";
import { CalendarDays, Ticket, Info } from "lucide-react";

export default function OrganizerDashboardPage() {
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
          You are logged in as an <span className="text-violet-400 font-medium">event organizer</span>.
          This portal is separate from the dining venue system.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="glass-panel rounded-2xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-violet-500/15 text-violet-400 p-2 rounded-lg">
              <CalendarDays size={20} />
            </span>
            <h3 className="text-lg font-semibold text-white">My Events</h3>
          </div>
          <p className="text-sm text-zinc-400">
            Create and submit events for Super Admin approval. Event CRUD APIs will be wired by the
            organizer build — shell routes are ready under this portal.
          </p>
        </div>
        <div className="glass-panel rounded-2xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-violet-500/15 text-violet-400 p-2 rounded-lg">
              <Ticket size={20} />
            </span>
            <h3 className="text-lg font-semibold text-white">Fees</h3>
          </div>
          <p className="text-sm text-zinc-400">
            Super Admin sets two fees on approval (read-only for you):
          </p>
          <ul className="text-sm text-zinc-400 mt-2 list-disc list-inside space-y-1">
            <li>
              <span className="text-zinc-200">Convenience fee</span> (₹ / ticket) — charged to the
              customer
            </li>
            <li>
              <span className="text-zinc-200">Commission %</span> — taken from your ticket sales
            </li>
          </ul>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5 flex gap-3">
        <Info className="text-violet-400 shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-zinc-300">
          <p className="font-medium text-white mb-1">Role isolation</p>
          <p className="text-zinc-400">
            Dining tables, restaurant bookings, and venue settings are only for{" "}
            <code className="text-zinc-300">business_admin</code>. Your account (
            <code className="text-zinc-300">event_admin</code>) cannot open the dining dashboard.
          </p>
          {user?.email && (
            <p className="text-zinc-500 mt-2">Signed in as {user.email}</p>
          )}
        </div>
      </div>
    </div>
  );
}
