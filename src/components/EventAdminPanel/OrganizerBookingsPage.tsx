"use client";

import { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CalendarCheck, Plus } from "lucide-react";
import OrganizerTicketPurchase from "@/components/EventAdminPanel/OrganizerTicketPurchase";
import { useGetOrganizerBookingsQuery, useGetOrganizerEventsQuery } from "@/services/api";
import { formatDateTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";

const formatPrice = (n: number | string) => formatMoney(n, { compact: true });

const STATUS_FILTERS = [
  { label: "All statuses", value: "" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Pending", value: "PENDING" },
  { label: "Used", value: "USED" },
  { label: "Cancelled", value: "CANCELLED" },
];

function statusBadge(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-green-500/10 text-green-700 border-green-200";
    case "PENDING":
      return "bg-amber-500/10 text-amber-700 border-amber-200";
    case "USED":
      return "bg-blue-500/10 text-blue-700 border-blue-200";
    case "CANCELLED":
      return "bg-rose-500/10 text-rose-700 border-rose-200";
    default:
      return "bg-slate-500/10 text-slate-600 border-slate-200";
  }
}

function OrganizerBookingsContent() {
  const searchParams = useSearchParams();
  const initialEvent = searchParams.get("event") ?? "";

  const [eventFilter, setEventFilter] = useState(initialEvent);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const { data: eventsData } = useGetOrganizerEventsQuery();
  const events = eventsData?.items ?? [];
  const { data: bookingsData, isLoading } = useGetOrganizerBookingsQuery({
    page,
    limit: PAGE_SIZE,
    event_id: eventFilter || undefined,
    status: statusFilter || undefined,
    ...(search.trim() ? { q: search.trim() } : {}),
  });
  const bookings = bookingsData?.items ?? [];

  const totals = useMemo(
    () =>
      bookings.reduce(
        (acc, b) => {
          if (b.status === "CONFIRMED" || b.status === "USED") {
            acc.tickets += b.ticket_qty || 0;
            acc.revenue += Number(b.ticket_amount) || 0;
          }
          return acc;
        },
        { tickets: 0, revenue: 0 }
      ),
    [bookings]
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="portal-heading text-2xl font-bold flex items-center gap-2">
            <CalendarCheck size={24} className="text-violet-600" />
            Event Bookings
          </h2>
          <p className="portal-muted mt-1">
            Customer ticket purchases appear here in real time after checkout.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-fit">
          <button
            type="button"
            onClick={() => setPurchaseOpen(true)}
            className="btn-primary inline-flex items-center gap-2 text-sm"
          >
            <Plus size={16} /> Buy tickets for customer
          </button>
          <Link
            href="/organizer/tickets"
            className="text-sm text-violet-600 hover:text-violet-700 font-medium inline-flex items-center px-3 py-2"
          >
            View ticket statistics →
          </Link>
        </div>
      </div>

      <OrganizerTicketPurchase
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        preselectedEventId={eventFilter || undefined}
        onSuccess={() => setPurchaseOpen(false)}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="glass-panel rounded-xl p-4">
          <p className="text-[10px] portal-stat-label uppercase tracking-wide">Bookings shown</p>
          <p className="text-2xl font-bold portal-heading mt-1">{bookingsData?.meta?.total ?? bookings.length}</p>
        </div>
        <div className="glass-panel rounded-xl border border-green-200 p-4">
          <p className="text-[10px] text-green-700 uppercase tracking-wide font-semibold">Tickets (confirmed)</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{totals.tickets}</p>
        </div>
        <div className="glass-panel rounded-xl border border-violet-200 p-4 col-span-2 sm:col-span-1">
          <p className="text-[10px] text-violet-700 uppercase tracking-wide font-semibold">Ticket revenue</p>
          <p className="text-2xl font-bold text-violet-600 mt-1">{formatPrice(totals.revenue)}</p>
        </div>
      </div>

      <div className="portal-toolbar glass-panel rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1 min-w-0">
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Search guest, phone, event, QR…"
              className="w-full"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:min-w-[320px]">
            <div>
              <label htmlFor="booking-event-filter" className="portal-label text-xs font-bold uppercase tracking-wider mb-1.5 block">
                Event
              </label>
              <select
                id="booking-event-filter"
                value={eventFilter}
                onChange={(e) => {
                  setEventFilter(e.target.value);
                  setPage(1);
                }}
                className="portal-select"
              >
                <option value="">All events</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="booking-status-filter" className="portal-label text-xs font-bold uppercase tracking-wider mb-1.5 block">
                Status
              </label>
              <select
                id="booking-status-filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="portal-select"
              >
                {STATUS_FILTERS.map((f) => (
                  <option key={f.value || "all"} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center portal-muted">Loading bookings…</div>
        ) : bookings.length === 0 ? (
          <div className="p-10 text-center portal-muted">
            No bookings yet for this filter. They will appear when customers complete checkout on your
            live events.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-200/80">
                  <th className="px-5 py-4 font-medium portal-table-head">Guest</th>
                  <th className="px-5 py-4 font-medium portal-table-head">Event</th>
                  <th className="px-5 py-4 font-medium portal-table-head">Tickets</th>
                  <th className="px-5 py-4 font-medium portal-table-head">Amount</th>
                  <th className="px-5 py-4 font-medium portal-table-head">Status</th>
                  <th className="px-5 py-4 font-medium portal-table-head">Booked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <p className="font-medium portal-table-strong">{b.guest_name || "Guest"}</p>
                      <p className="text-xs portal-table-muted">{b.guest_phone}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium portal-table-strong">{b.event_name}</p>
                      {b.starts_at && (
                        <p className="text-xs portal-table-muted">
                          {b.venue_name ? `${b.venue_name} · ` : ""}
                          {formatDateTime12h(b.starts_at)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold portal-table-strong">
                        {b.ticket_qty} ticket{b.ticket_qty === 1 ? "" : "s"}
                      </p>
                      <ul className="text-xs portal-table-muted mt-0.5 space-y-0.5">
                        {(b.items || []).map((item) => (
                          <li key={item.id}>
                            {item.ticket_type} × {item.qty}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold portal-table-strong">{formatPrice(b.grand_total)}</p>
                      <p className="text-xs portal-table-muted">Tickets {formatPrice(b.ticket_amount)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusBadge(b.status)}`}
                      >
                        {b.status}
                      </span>
                      {b.qr_code && (
                        <p className="text-[10px] text-slate-400 mt-1 font-mono">{b.qr_code}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 portal-table-muted text-xs whitespace-nowrap">
                      {b.created_at ? formatDateTime12h(b.created_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {bookingsData?.meta && <Pagination meta={bookingsData.meta} onPageChange={setPage} />}
      </div>
    </div>
  );
}

export default function OrganizerBookingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center portal-muted">Loading bookings…</div>
      }
    >
      <OrganizerBookingsContent />
    </Suspense>
  );
}
