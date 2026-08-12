"use client";

import { useMemo, useState } from "react";
import { Banknote, ChevronLeft, ChevronRight, Loader2, Search, Users, Wallet } from "lucide-react";
import {
  useGetOrganizerEventsQuery,
  useGetOrganizerLedgerCustomersQuery,
  useGetOrganizerLedgerQuery,
} from "@/services/api";
import { formatDate, formatDateTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";

const money = formatMoney;

export default function OrganizerLedgerPage() {
  const [eventFilter, setEventFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const { data: events = [] } = useGetOrganizerEventsQuery();

  const filterParams = useMemo(
    () => ({
      ...(eventFilter ? { event_id: eventFilter } : {}),
      ...(searchQuery ? { q: searchQuery } : {}),
      ...(fromDate ? { from: fromDate } : {}),
      ...(toDate ? { to: toDate } : {}),
    }),
    [eventFilter, searchQuery, fromDate, toDate]
  );

  const { data, isLoading } = useGetOrganizerLedgerQuery(filterParams);

  const {
    data: customerData,
    isLoading: customersLoading,
    isFetching: customersFetching,
  } = useGetOrganizerLedgerCustomersQuery({ ...filterParams, page });

  const summary = data?.summary;
  const eventRows = data?.rows || [];
  const customerEntries = customerData?.items || [];
  const pagination = customerData?.pagination;
  const payouts = data?.recent_payouts || [];

  const applyFilters = () => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  const resetFilters = () => {
    setEventFilter("");
    setSearchInput("");
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const hasActiveFilters = eventFilter || searchQuery || fromDate || toDate;

  const goToPage = (nextPage: number) => {
    if (!pagination) return;
    if (nextPage < 1 || nextPage > pagination.total_pages) return;
    setPage(nextPage);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="portal-heading text-2xl font-bold flex items-center gap-2">
          <Wallet className="text-violet-500" /> Revenue Ledger
        </h2>
        <p className="portal-muted text-sm mt-1">
          Ticket revenue, platform commission, your earnings, and customer-wise booking entries.
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-4 space-y-4">
        <p className="portal-label text-xs font-bold uppercase tracking-wider">Filters</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="portal-label text-xs mb-1.5 block">Event</label>
            <select
              value={eventFilter}
              onChange={(e) => {
                setEventFilter(e.target.value);
                setPage(1);
              }}
              className="portal-select w-full"
            >
              <option value="">All events</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="portal-label text-xs mb-1.5 block">Customer search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                placeholder="Name, phone or email"
                className="input-field pl-9 w-full"
              />
            </div>
          </div>
          <div>
            <label className="portal-label text-xs mb-1.5 block">From date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="portal-label text-xs mb-1.5 block">To date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="input-field w-full"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
          >
            Apply filters
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 portal-muted">
          <Loader2 className="animate-spin inline mr-2" size={18} /> Loading ledger...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Ticket sales" value={money(summary?.ticket_amount)} />
            <StatCard label="Commission deducted" value={money(summary?.commission_total)} accent="text-amber-600" />
            <StatCard label="Your earnings" value={money(summary?.organizer_earned)} accent="text-emerald-600" />
            <StatCard label="Paid by admin" value={money(summary?.total_paid)} accent="text-violet-600" />
            <StatCard label="Pending payout" value={money(summary?.pending_amount)} accent="text-rose-600" />
            <StatCard label="Bookings" value={String(summary?.bookings_count ?? 0)} />
            <StatCard label="Tickets sold" value={String(summary?.tickets_sold ?? 0)} />
            <StatCard
              label="Admin pending payments"
              value={money(summary?.admin_pending_payments)}
              accent="text-slate-600"
            />
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="portal-heading font-semibold">By event</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="portal-table-head text-left px-4 py-3">Event</th>
                    <th className="portal-table-head text-right px-4 py-3">Bookings</th>
                    <th className="portal-table-head text-right px-4 py-3">Tickets</th>
                    <th className="portal-table-head text-right px-4 py-3">Sales</th>
                    <th className="portal-table-head text-right px-4 py-3">Commission</th>
                    <th className="portal-table-head text-right px-4 py-3">Earned</th>
                    <th className="portal-table-head text-right px-4 py-3">Paid</th>
                    <th className="portal-table-head text-right px-4 py-3">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {eventRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center portal-muted">
                        No ticket sales recorded yet.
                      </td>
                    </tr>
                  ) : (
                    eventRows.map((row) => (
                      <tr key={row.event_id} className="border-b border-slate-50">
                        <td className="portal-table-strong px-4 py-3">
                          {row.event_name}
                          <span className="block text-[10px] font-normal portal-muted">
                            {row.event_status}
                          </span>
                        </td>
                        <td className="portal-table-cell px-4 py-3 text-right">{row.bookings_count}</td>
                        <td className="portal-table-cell px-4 py-3 text-right">{row.tickets_sold}</td>
                        <td className="portal-table-cell px-4 py-3 text-right">{money(row.ticket_amount)}</td>
                        <td className="portal-table-cell px-4 py-3 text-right">{money(row.commission_total)}</td>
                        <td className="portal-table-cell px-4 py-3 text-right font-semibold">
                          {money(row.organizer_earned)}
                        </td>
                        <td className="portal-table-cell px-4 py-3 text-right text-violet-700">
                          {money(row.paid_amount)}
                        </td>
                        <td className="portal-table-cell px-4 py-3 text-right text-rose-600 font-semibold">
                          {money(row.pending_amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <h3 className="portal-heading font-semibold flex items-center gap-2">
                <Users size={18} className="text-violet-500" /> Customer-wise bookings
              </h3>
              {customersFetching && !customersLoading && (
                <Loader2 size={14} className="animate-spin text-slate-400" />
              )}
            </div>

            {customersLoading ? (
              <div className="text-center py-10 portal-muted">
                <Loader2 className="animate-spin inline mr-2" size={16} /> Loading customer entries...
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="portal-table-head text-left px-4 py-3">Date</th>
                        <th className="portal-table-head text-left px-4 py-3">Customer</th>
                        <th className="portal-table-head text-left px-4 py-3">Event</th>
                        <th className="portal-table-head text-right px-4 py-3">Tickets</th>
                        <th className="portal-table-head text-right px-4 py-3">Sales</th>
                        <th className="portal-table-head text-right px-4 py-3">Discount</th>
                        <th className="portal-table-head text-right px-4 py-3">Commission</th>
                        <th className="portal-table-head text-right px-4 py-3">Earned</th>
                        <th className="portal-table-head text-right px-4 py-3">Customer paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerEntries.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center portal-muted">
                            No customer bookings match your filters.
                          </td>
                        </tr>
                      ) : (
                        customerEntries.map((entry) => (
                          <tr key={entry.booking_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="portal-table-cell px-4 py-3 whitespace-nowrap">
                              {formatDateTime12h(entry.created_at)}
                            </td>
                            <td className="portal-table-strong px-4 py-3">
                              {entry.guest_name || "Guest"}
                              <span className="block text-[10px] font-normal portal-muted">
                                {entry.guest_phone || "—"}
                                {entry.guest_email ? ` · ${entry.guest_email}` : ""}
                              </span>
                              {entry.promo_code && (
                                <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  {entry.promo_code}
                                </span>
                              )}
                            </td>
                            <td className="portal-table-cell px-4 py-3">{entry.event_name}</td>
                            <td className="portal-table-cell px-4 py-3 text-right">{entry.ticket_qty}</td>
                            <td className="portal-table-cell px-4 py-3 text-right">{money(entry.ticket_amount)}</td>
                            <td className="portal-table-cell px-4 py-3 text-right text-emerald-700">
                              {Number(entry.discount_amount || 0) > 0
                                ? `−${money(entry.discount_amount)}`
                                : "—"}
                            </td>
                            <td className="portal-table-cell px-4 py-3 text-right">{money(entry.commission_total)}</td>
                            <td className="portal-table-cell px-4 py-3 text-right font-semibold text-emerald-700">
                              {money(entry.organizer_earned)}
                            </td>
                            <td className="portal-table-cell px-4 py-3 text-right">{money(entry.grand_total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {pagination && pagination.total > 0 && (
                  <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <p className="text-sm portal-muted">
                      Showing{" "}
                      <span className="font-semibold text-slate-800">
                        {(pagination.page - 1) * pagination.limit + 1}–
                        {Math.min(pagination.page * pagination.limit, pagination.total)}
                      </span>{" "}
                      of <span className="font-semibold text-slate-800">{pagination.total}</span> bookings
                      {pagination.total_pages > 1 && (
                        <span className="ml-2">
                          · Page {pagination.page} of {pagination.total_pages}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      <PaginationButton
                        disabled={!pagination.has_prev || customersFetching}
                        onClick={() => goToPage(pagination.page - 1)}
                        className="px-3 gap-1"
                      >
                        <ChevronLeft size={16} />
                        <span className="hidden sm:inline">Previous</span>
                      </PaginationButton>
                      {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map((p) => (
                        <PaginationButton
                          key={p}
                          active={p === pagination.page}
                          disabled={customersFetching}
                          onClick={() => goToPage(p)}
                        >
                          {p}
                        </PaginationButton>
                      ))}
                      <PaginationButton
                        disabled={!pagination.has_next || customersFetching}
                        onClick={() => goToPage(pagination.page + 1)}
                        className="px-3 gap-1"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight size={16} />
                      </PaginationButton>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <h3 className="portal-heading font-semibold mb-4 flex items-center gap-2">
              <Banknote size={18} /> Recent payouts from Super Admin
            </h3>
            {payouts.length === 0 ? (
              <p className="portal-muted text-sm">No payouts recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {payouts.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap justify-between gap-2 py-2 border-b border-slate-100 last:border-0 text-sm"
                  >
                    <span className="portal-muted">
                      {p.event_name || "General payout"} · {formatDate(p.paid_at || p.created_at)}
                      {p.payment_reference ? ` · Ref: ${p.payment_reference}` : ""}
                    </span>
                    <span
                      className={`font-semibold ${p.status === "PAID" ? "text-emerald-600" : "text-amber-600"}`}
                    >
                      {money(p.amount)} ({p.status})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "portal-heading",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <p className="portal-stat-label text-xs uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent}`}>{value}</p>
    </div>
  );
}

function PaginationButton({
  children,
  onClick,
  disabled,
  active,
  className = "",
  ...rest
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center min-w-[2rem] h-9 px-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "bg-violet-600 text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-violet-50 hover:border-violet-200"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
