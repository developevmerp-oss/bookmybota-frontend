"use client";

import Link from "next/link";
import { useAppSelector } from "@/lib/hooks";
import { useGetBusinessSettingsQuery, useGetOrganizerEventsQuery, useGetOrganizerTicketStatsQuery } from "@/services/api";
import { CalendarDays, Ticket, Info, Plus, BarChart3, Users } from "lucide-react";

export default function OrganizerDashboardPage() {
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";
  const { data: settings } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const { data: events = [] } = useGetOrganizerEventsQuery();
  const { data: ticketStats } = useGetOrganizerTicketStatsQuery();

  const pending = events.filter((e) => e.status === "PENDING_APPROVAL").length;
  const drafts = events.filter((e) => e.status === "DRAFT").length;
  const live = events.filter((e) => e.status === "LIVE" || e.status === "APPROVED").length;
  const sold = ticketStats?.overall.total_sold ?? 0;
  const remaining = ticketStats?.overall.total_remaining ?? 0;
  const bookingsCount = ticketStats?.overall.bookings_count ?? 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Welcome{settings?.name ? `, ${settings.name}` : ""}
          </h2>
          <p className="text-zinc-400 mt-1">
            Create events, submit for approval, and manage your listings from this portal.
          </p>
        </div>
        <Link href="/organizer/events/new" className="btn-primary inline-flex items-center gap-2 w-fit">
          <Plus size={18} /> New event
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="glass-panel rounded-2xl border border-white/5 p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Drafts</p>
          <p className="text-3xl font-bold text-white mt-1">{drafts}</p>
        </div>
        <div className="glass-panel rounded-2xl border border-amber-500/20 p-5">
          <p className="text-xs text-amber-400/80 uppercase tracking-wide">Pending review</p>
          <p className="text-3xl font-bold text-amber-300 mt-1">{pending}</p>
        </div>
        <div className="glass-panel rounded-2xl border border-green-500/20 p-5">
          <p className="text-xs text-green-400/80 uppercase tracking-wide">Approved / live</p>
          <p className="text-3xl font-bold text-green-300 mt-1">{live}</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Link
          href="/organizer/tickets"
          className="glass-panel rounded-2xl border border-violet-500/20 p-5 hover:border-violet-500/40 transition-colors group"
        >
          <div className="flex items-center gap-2 mb-2">
            <Ticket size={16} className="text-violet-400" />
            <p className="text-xs text-violet-400/80 uppercase tracking-wide">Tickets sold</p>
          </div>
          <p className="text-3xl font-bold text-violet-300 group-hover:text-violet-200">{sold}</p>
          <p className="text-xs text-zinc-500 mt-1">{remaining} remaining across all events</p>
        </Link>
        <Link
          href="/organizer/bookings"
          className="glass-panel rounded-2xl border border-blue-500/20 p-5 hover:border-blue-500/40 transition-colors group"
        >
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-blue-400" />
            <p className="text-xs text-blue-400/80 uppercase tracking-wide">Customer bookings</p>
          </div>
          <p className="text-3xl font-bold text-blue-300 group-hover:text-blue-200">{bookingsCount}</p>
          <p className="text-xs text-zinc-500 mt-1">View all ticket orders</p>
        </Link>
        <Link
          href="/organizer/tickets"
          className="glass-panel rounded-2xl border border-white/5 p-5 hover:border-violet-500/30 transition-colors group"
        >
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={16} className="text-zinc-400 group-hover:text-violet-400" />
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Ticket statistics</p>
          </div>
          <p className="text-sm text-zinc-400 mt-2 group-hover:text-zinc-300">
            Per-event sold vs remaining, revenue, and fill rates
          </p>
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/organizer/events"
          className="glass-panel rounded-2xl border border-white/5 p-6 hover:border-violet-500/30 transition-colors group"
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-violet-500/15 text-violet-400 p-2 rounded-lg">
              <CalendarDays size={20} />
            </span>
            <h3 className="text-lg font-semibold text-white group-hover:text-violet-300">
              My Events
            </h3>
          </div>
          <p className="text-sm text-zinc-400">
            Add event details, upload posters & documents, and submit for Super Admin approval.
            Rejected events can be edited and resubmitted.
          </p>
        </Link>
        <div className="glass-panel rounded-2xl border border-white/5 p-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="bg-violet-500/15 text-violet-400 p-2 rounded-lg">
              <Ticket size={20} />
            </span>
            <h3 className="text-lg font-semibold text-white">Fees</h3>
          </div>
          <p className="text-sm text-zinc-400">
            Super Admin sets two fees when approving your event (read-only for you):
          </p>
          <ul className="text-sm text-zinc-400 mt-2 list-disc list-inside space-y-1">
            <li>
              <span className="text-zinc-200">Convenience fee</span> (% of ticket) — charged to the
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
          <p className="font-medium text-white mb-1">How approval works</p>
          <ol className="text-zinc-400 list-decimal list-inside space-y-1">
            <li>Save a draft or submit the full form for review.</li>
            <li>Super Admin approves or rejects with a reason.</li>
            <li>Approved events appear on the public <Link href="/events" className="text-violet-400 hover:text-violet-300">Events page</Link> for customers.</li>
          </ol>
          {user?.email && (
            <p className="text-zinc-500 mt-2">Signed in as {user.email}</p>
          )}
        </div>
      </div>
    </div>
  );
}
