"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Ticket,
  Users,
  Banknote,
  Package,
  TrendingUp,
  XCircle,
  Filter,
} from "lucide-react";
import {
  useGetOrganizerEventsQuery,
  useGetOrganizerTicketStatsQuery,
} from "@/services/api";
import { formatMoney } from "@/lib/currencyFormat";

const formatPrice = (n: number) => formatMoney(n, { compact: true });

function statusBadge(status: string) {
  switch (status) {
    case "LIVE":
      return "bg-green-500/10 text-green-700 border-green-200";
    case "APPROVED":
      return "bg-blue-500/10 text-blue-700 border-blue-200";
    case "PENDING_APPROVAL":
      return "bg-amber-500/10 text-amber-700 border-amber-200";
    case "DRAFT":
      return "bg-slate-500/10 text-slate-600 border-slate-200";
    case "CLOSED":
      return "bg-rose-500/10 text-rose-700 border-rose-200";
    default:
      return "bg-slate-500/10 text-slate-600 border-slate-200";
  }
}

function FillBar({ percent }: { percent: number }) {
  const p = Math.min(100, Math.max(0, percent));
  const color = p >= 90 ? "bg-rose-500" : p >= 70 ? "bg-amber-500" : "bg-violet-500";
  return (
    <div className="h-2 rounded-full portal-progress-track overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${p}%` }} />
    </div>
  );
}

export default function OrganizerTicketStatsPage() {
  const [eventFilter, setEventFilter] = useState("");
  const { data: events = [] } = useGetOrganizerEventsQuery();
  const { data, isLoading, isError } = useGetOrganizerTicketStatsQuery(
    eventFilter ? { event_id: eventFilter } : undefined
  );

  const overall = data?.overall;
  const eventStats = data?.events ?? [];

  const filterLabel = useMemo(() => {
    if (!eventFilter) return "All events";
    return events.find((e) => e.id === eventFilter)?.name ?? "Selected event";
  }, [eventFilter, events]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="portal-heading text-2xl font-bold flex items-center gap-2">
          <BarChart3 size={24} className="text-violet-600" />
          Ticket Statistics
        </h2>
        <p className="portal-muted mt-1 max-w-2xl">
          Sold vs remaining inventory per event and ticket type. Updates when customers book tickets.
        </p>
      </div>

      <div className="portal-toolbar glass-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex items-center gap-2 text-violet-700 shrink-0">
            <Filter size={18} />
            <span className="text-sm font-semibold">Filters</span>
          </div>
          <div className="flex-1 min-w-0 sm:max-w-md">
            <label htmlFor="event-stats-filter" className="portal-label text-xs font-bold uppercase tracking-wider mb-1.5 block">
              Event
            </label>
            <select
              id="event-stats-filter"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="portal-select"
            >
              <option value="">All events</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.status.replace("_", " ")})
                </option>
              ))}
            </select>
          </div>
          {!isLoading && overall && (
            <p className="text-sm portal-muted sm:pb-2 sm:ml-auto">
              Showing: <span className="font-semibold text-slate-800">{filterLabel}</span>
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="glass-panel rounded-2xl p-10 text-center portal-muted">
          Loading ticket statistics…
        </div>
      ) : isError || !overall ? (
        <div className="glass-panel rounded-2xl p-10 text-center portal-muted">
          Could not load statistics.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={Package}
              label="Total capacity"
              value={String(overall.total_capacity)}
              sub="Tickets listed"
              accent="text-slate-800"
            />
            <StatCard
              icon={Ticket}
              label="Sold"
              value={String(overall.total_sold)}
              sub={`${overall.fill_percent}% filled`}
              accent="text-green-600"
            />
            <StatCard
              icon={TrendingUp}
              label="Remaining"
              value={String(overall.total_remaining)}
              sub="Available to buy"
              accent="text-violet-600"
            />
            <StatCard
              icon={Users}
              label="Bookings"
              value={String(overall.bookings_count)}
              sub={`${overall.tickets_sold_bookings} tickets confirmed`}
              accent="text-blue-600"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <StatCard
              icon={Banknote}
              label="Ticket revenue"
              value={formatPrice(overall.ticket_revenue)}
              sub="Confirmed sales (excl. convenience fee)"
              accent="text-emerald-600"
            />
            <StatCard
              icon={Banknote}
              label="Your payout (est.)"
              value={formatPrice(overall.organizer_payout)}
              sub="After platform commission"
              accent="text-violet-600"
            />
          </div>

          {overall.cancelled_bookings > 0 && (
            <div className="portal-banner-error rounded-xl px-4 py-3 flex items-center gap-3 text-sm">
              <XCircle size={18} className="shrink-0" />
              {overall.cancelled_bookings} cancelled booking
              {overall.cancelled_bookings === 1 ? "" : "s"} — inventory restored for those tickets.
            </div>
          )}

          {eventStats.length === 0 ? (
            <div className="glass-panel rounded-2xl p-10 text-center portal-muted">
              No events yet.{" "}
              <Link href="/organizer/events/new" className="text-violet-600 hover:text-violet-700 font-medium">
                Create an event
              </Link>{" "}
              to start selling tickets.
            </div>
          ) : (
            <div className="space-y-5">
              <h3 className="portal-heading text-lg font-semibold">
                {eventFilter ? "Event breakdown" : `All events (${eventStats.length})`}
              </h3>
              {eventStats.map((ev) => (
                <div key={ev.event_id} className="glass-panel rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-slate-200/80 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg font-bold portal-heading">{ev.event_name}</h4>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusBadge(ev.status)}`}
                        >
                          {ev.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm portal-muted mt-1">
                        {ev.summary.total_sold} sold · {ev.summary.total_remaining} remaining ·{" "}
                        {ev.summary.bookings_count} bookings · {formatPrice(ev.summary.ticket_revenue)} revenue
                      </p>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <p className="text-2xl font-black text-violet-600">{ev.summary.fill_percent}%</p>
                      <p className="text-[10px] portal-stat-label uppercase tracking-wide">Filled</p>
                    </div>
                  </div>

                  <div className="px-5 pt-4">
                    <FillBar percent={ev.summary.fill_percent} />
                  </div>

                  {ev.ticket_types.length === 0 ? (
                    <p className="p-5 text-sm portal-muted">No ticket types configured.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm mt-4">
                        <thead>
                          <tr className="text-left border-t border-slate-200/80">
                            <th className="px-5 py-3 font-medium portal-table-head">Ticket type</th>
                            <th className="px-5 py-3 font-medium portal-table-head">Venue</th>
                            <th className="px-5 py-3 font-medium portal-table-head">Price</th>
                            <th className="px-5 py-3 font-medium portal-table-head">Total</th>
                            <th className="px-5 py-3 font-medium portal-table-head text-green-600">Sold</th>
                            <th className="px-5 py-3 font-medium portal-table-head text-violet-600">Remaining</th>
                            <th className="px-5 py-3 font-medium portal-table-head">Fill</th>
                            <th className="px-5 py-3 font-medium portal-table-head text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60">
                          {ev.ticket_types.map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50/80">
                              <td className="px-5 py-3 portal-table-strong">{t.ticket_type}</td>
                              <td className="px-5 py-3 portal-table-cell">{t.venue_name || "—"}</td>
                              <td className="px-5 py-3 portal-table-cell">{formatPrice(t.price)}</td>
                              <td className="px-5 py-3 portal-table-cell">{t.total_count}</td>
                              <td className="px-5 py-3 text-green-600 font-semibold">{t.sold}</td>
                              <td className="px-5 py-3 text-violet-600 font-semibold">{t.remaining}</td>
                              <td className="px-5 py-3 w-36">
                                <div className="flex items-center gap-2">
                                  <FillBar percent={t.fill_percent} />
                                  <span className="text-xs portal-stat-sub shrink-0">{t.fill_percent}%</span>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-right portal-table-strong">{formatPrice(t.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-200 bg-slate-50/80 font-semibold">
                            <td className="px-5 py-3 portal-table-strong" colSpan={2}>
                              Event total
                            </td>
                            <td className="px-5 py-3 portal-table-cell">{ev.summary.total_capacity}</td>
                            <td className="px-5 py-3 text-green-600">{ev.summary.total_sold}</td>
                            <td className="px-5 py-3 text-violet-600">{ev.summary.total_remaining}</td>
                            <td className="px-5 py-3 portal-table-cell">{ev.summary.fill_percent}%</td>
                            <td className="px-5 py-3 text-right portal-table-strong">
                              {formatPrice(ev.summary.ticket_revenue)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  <div className="px-5 py-3 border-t border-slate-200/80 flex flex-wrap gap-4 text-xs portal-muted">
                    <Link
                      href={`/organizer/bookings?event=${ev.event_id}`}
                      className="text-violet-600 hover:text-violet-700 font-medium"
                    >
                      View bookings →
                    </Link>
                    <span>
                      {ev.summary.total_remaining === 0 ? "Sold out · " : ""}
                      {ev.summary.total_sold === 0 ? "No sales yet · " : ""}
                      {ev.summary.fill_percent >= 90 && ev.summary.total_remaining > 0 ? "Almost full · " : ""}
                      {ev.summary.cancelled_bookings > 0
                        ? `${ev.summary.cancelled_bookings} cancelled`
                        : "No cancellations"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={`${accent} opacity-90`} />
        <p className="text-[10px] font-bold portal-stat-label uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-2xl sm:text-3xl font-black ${accent}`}>{value}</p>
      <p className="text-xs portal-stat-sub mt-1">{sub}</p>
    </div>
  );
}
