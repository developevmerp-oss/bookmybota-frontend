"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Users,
  Wallet,
  FileText,
  X,
} from "lucide-react";
import {
  useGetOrganizerEventsQuery,
  useGetOrganizerLedgerCustomersQuery,
  useGetOrganizerLedgerQuery,
  useGetMyOrganizerPendingSettlementsQuery,
  useGetMyOrganizerSettlementQuery,
  useGetMyOrganizerSettlementsQuery,
  type OrganizerSettlementRun,
  type OrganizerSettlementStatus,
} from "@/services/api";
import { formatDate, formatDateTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import Pagination from "@/components/Shared/Pagination";

const money = formatMoney;

type Tab = "revenue" | "settlements";

function statusBadge(status: string) {
  const s = String(status || "").toUpperCase();
  const cls =
    s === "PAID"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : s === "APPROVED"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : s === "DRAFT"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : s === "CANCELLED"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span className={`inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${cls}`}>
      {s || "—"}
    </span>
  );
}

export default function OrganizerLedgerPage() {
  const [tab, setTab] = useState<Tab>("revenue");
  const [eventFilter, setEventFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [settlementPage, setSettlementPage] = useState(1);
  const [settlementStatus, setSettlementStatus] = useState<string>("ALL");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: eventsData } = useGetOrganizerEventsQuery();
  const events = eventsData?.items ?? [];

  const filterParams = useMemo(
    () => ({
      ...(eventFilter ? { event_id: eventFilter } : {}),
      ...(searchQuery ? { q: searchQuery } : {}),
      ...(fromDate ? { from: fromDate } : {}),
      ...(toDate ? { to: toDate } : {}),
    }),
    [eventFilter, searchQuery, fromDate, toDate]
  );

  const { data, isLoading } = useGetOrganizerLedgerQuery(filterParams, {
    skip: tab !== "revenue",
  });

  const {
    data: customerData,
    isLoading: customersLoading,
    isFetching: customersFetching,
  } = useGetOrganizerLedgerCustomersQuery(
    { ...filterParams, page },
    { skip: tab !== "revenue" }
  );

  const {
    data: pendingData,
    isLoading: pendingLoading,
  } = useGetMyOrganizerPendingSettlementsQuery(
    { page: 1, limit: 10 },
    { skip: tab !== "settlements" }
  );

  const {
    data: settlementsData,
    isLoading: settlementsLoading,
    isFetching: settlementsFetching,
  } = useGetMyOrganizerSettlementsQuery(
    {
      page: settlementPage,
      limit: 10,
      ...(settlementStatus !== "ALL" ? { status: settlementStatus } : {}),
    },
    { skip: tab !== "settlements" }
  );

  const { data: selectedRun, isLoading: runDetailLoading } = useGetMyOrganizerSettlementQuery(
    selectedRunId || "",
    { skip: !selectedRunId }
  );

  const summary = data?.summary;
  const eventRows = data?.rows || [];
  const customerEntries = customerData?.items || [];
  const pagination = customerData?.pagination;
  const payouts = data?.recent_payouts || [];
  const settlements = settlementsData?.items ?? [];
  const settlementsMeta = settlementsData?.meta;
  const pendingSummary = pendingData?.summary;
  const pendingItems = pendingData?.items ?? [];

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
          <Wallet className="text-rose-500" /> Revenue & Payouts
        </h2>
        <p className="portal-muted text-sm mt-1">
          Ticket revenue, platform commission, settlement runs from BookMyBota, and payout status.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "revenue" as const, label: "Revenue ledger" },
            { id: "settlements" as const, label: "Settlement payouts" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.id
                ? "bg-rose-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-rose-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "revenue" ? (
        <>
          <div className="org-card p-4 space-y-4">
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
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700"
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
                <StatCard label="Ticket sales" value={money(summary?.ticket_amount)} accent="text-emerald-600" />
                <StatCard
                  label="Commission deducted"
                  value={money(summary?.commission_total)}
                  accent="text-emerald-600"
                />
                <StatCard
                  label="Your earnings"
                  value={money(summary?.organizer_earned)}
                  accent="text-emerald-600"
                />
                <StatCard
                  label="Paid by admin"
                  value={money(summary?.total_paid)}
                  accent="text-emerald-600"
                />
                <StatCard
                  label="Pending payout"
                  value={money(summary?.pending_amount)}
                  accent="text-emerald-600"
                />
                <StatCard label="Bookings" value={String(summary?.bookings_count ?? 0)} />
                <StatCard label="Tickets sold" value={String(summary?.tickets_sold ?? 0)} />
                <StatCard
                  label="Admin pending payments"
                  value={money(summary?.admin_pending_payments)}
                  accent="text-emerald-600"
                />
              </div>

              <div className="org-card overflow-hidden">
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
                            <td className="portal-table-cell px-4 py-3 text-right text-emerald-600">{money(row.ticket_amount)}</td>
                            <td className="portal-table-cell px-4 py-3 text-right text-emerald-600">{money(row.commission_total)}</td>
                            <td className="portal-table-cell px-4 py-3 text-right font-semibold text-emerald-600">
                              {money(row.organizer_earned)}
                            </td>
                            <td className="portal-table-cell px-4 py-3 text-right text-emerald-700">
                              {money(row.paid_amount)}
                            </td>
                            <td className="portal-table-cell px-4 py-3 text-right text-emerald-600 font-semibold">
                              {money(row.pending_amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="org-card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="portal-heading font-semibold flex items-center gap-2">
                    <Users size={18} className="text-rose-500" /> Customer-wise bookings
                  </h3>
                  {customersFetching && !customersLoading && (
                    <Loader2 size={14} className="animate-spin text-slate-400" />
                  )}
                </div>

                {customersLoading ? (
                  <div className="text-center py-10 portal-muted">
                    <Loader2 className="animate-spin inline mr-2" size={16} /> Loading…
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="portal-table-head text-left px-4 py-3">Guest</th>
                            <th className="portal-table-head text-left px-4 py-3">Event</th>
                            <th className="portal-table-head text-right px-4 py-3">Tickets</th>
                            <th className="portal-table-head text-right px-4 py-3">Sales</th>
                            <th className="portal-table-head text-right px-4 py-3">Your share</th>
                            <th className="portal-table-head text-left px-4 py-3">When</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerEntries.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center portal-muted">
                                No bookings match these filters.
                              </td>
                            </tr>
                          ) : (
                            customerEntries.map((row) => (
                              <tr key={row.booking_id} className="border-b border-slate-50">
                                <td className="portal-table-strong px-4 py-3">
                                  {row.guest_name || "—"}
                                  <span className="block text-[10px] font-normal portal-muted">
                                    {row.guest_phone || row.guest_email || ""}
                                  </span>
                                </td>
                                <td className="portal-table-cell px-4 py-3">{row.event_name}</td>
                                <td className="portal-table-cell px-4 py-3 text-right">{row.ticket_qty}</td>
                                <td className="portal-table-cell px-4 py-3 text-right text-emerald-600">{money(row.ticket_amount)}</td>
                                <td className="portal-table-cell px-4 py-3 text-right font-semibold text-emerald-700">
                                  {money(row.organizer_earned)}
                                </td>
                                <td className="portal-table-cell px-4 py-3">
                                  {row.created_at ? formatDateTime12h(row.created_at) : "—"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {pagination && pagination.total_pages > 1 && (
                      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <PaginationButton
                          disabled={!pagination.has_prev}
                          onClick={() => goToPage(pagination.page - 1)}
                        >
                          <ChevronLeft size={16} />
                        </PaginationButton>
                        <span className="text-xs portal-muted">
                          Page {pagination.page} of {pagination.total_pages}
                        </span>
                        <PaginationButton
                          disabled={!pagination.has_next}
                          onClick={() => goToPage(pagination.page + 1)}
                        >
                          <ChevronRight size={16} />
                        </PaginationButton>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="org-card p-5">
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
        </>
      ) : (
        <SettlementsTab
          pendingLoading={pendingLoading}
          pendingSummary={pendingSummary}
          pendingItems={pendingItems}
          settlementsLoading={settlementsLoading}
          settlementsFetching={settlementsFetching}
          settlements={settlements}
          settlementsMeta={settlementsMeta}
          settlementPage={settlementPage}
          setSettlementPage={setSettlementPage}
          settlementStatus={settlementStatus}
          setSettlementStatus={(v) => {
            setSettlementStatus(v);
            setSettlementPage(1);
          }}
          onOpenRun={setSelectedRunId}
        />
      )}

      {selectedRunId && (
        <SettlementDetailModal
          loading={runDetailLoading}
          run={selectedRun}
          onClose={() => setSelectedRunId(null)}
        />
      )}
    </div>
  );
}

function SettlementsTab({
  pendingLoading,
  pendingSummary,
  pendingItems,
  settlementsLoading,
  settlementsFetching,
  settlements,
  settlementsMeta,
  settlementPage,
  setSettlementPage,
  settlementStatus,
  setSettlementStatus,
  onOpenRun,
}: {
  pendingLoading: boolean;
  pendingSummary?: {
    bookings_count: number;
    organizer_payable: number;
    gift_card_funded: number;
    cash_funded: number;
    period_from?: string | null;
    period_to?: string | null;
  };
  pendingItems: Array<{
    booking_id: string;
    created_at?: string;
    guest_name?: string | null;
    organizer_payout: number | string;
    gift_card_amount: number | string;
    cash_amount: number | string;
    event_name?: string;
  }>;
  settlementsLoading: boolean;
  settlementsFetching: boolean;
  settlements: OrganizerSettlementRun[];
  settlementsMeta?: { total?: number; page?: number; limit?: number; total_pages?: number };
  settlementPage: number;
  setSettlementPage: (p: number) => void;
  settlementStatus: string;
  setSettlementStatus: (v: string) => void;
  onOpenRun: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="org-card p-4">
        <p className="text-sm portal-muted">
          Super Admin prepares settlement runs from your confirmed bookings (ticket sales − commission).
          You can track draft → approved → paid here. Gift-card amounts on bookings do not reduce your
          organizer share.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Awaiting settlement"
          value={String(pendingSummary?.bookings_count ?? (pendingLoading ? "…" : 0))}
        />
        <StatCard
          label="Payable (unsettled)"
          value={pendingLoading ? "…" : money(pendingSummary?.organizer_payable)}
          accent="text-emerald-600"
        />
        <StatCard
          label="GC on unsettled bookings"
          value={pendingLoading ? "…" : money(pendingSummary?.gift_card_funded)}
          accent="text-emerald-600"
        />
        <StatCard
          label="Cash on unsettled bookings"
          value={pendingLoading ? "…" : money(pendingSummary?.cash_funded)}
          accent="text-emerald-600"
        />
      </div>

      <div className="org-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="portal-heading font-semibold">Bookings waiting for a settlement run</h3>
          <p className="portal-muted text-xs mt-1">
            These confirmed bookings are not on any draft/approved/paid run yet.
            {pendingSummary?.period_from
              ? ` Period so far: ${formatDate(pendingSummary.period_from)} – ${formatDate(pendingSummary.period_to || undefined)}.`
              : ""}
          </p>
        </div>
        {pendingLoading ? (
          <div className="text-center py-10 portal-muted">
            <Loader2 className="animate-spin inline mr-2" size={16} /> Loading…
          </div>
        ) : pendingItems.length === 0 ? (
          <p className="px-5 py-8 text-center portal-muted text-sm">
            No unsettled bookings — everything earned is already on a settlement run, or you have no
            confirmed sales yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="portal-table-head text-left px-4 py-3">Event</th>
                  <th className="portal-table-head text-left px-4 py-3">Guest</th>
                  <th className="portal-table-head text-right px-4 py-3">Your share</th>
                  <th className="portal-table-head text-right px-4 py-3">Gift card</th>
                  <th className="portal-table-head text-right px-4 py-3">Cash</th>
                  <th className="portal-table-head text-left px-4 py-3">Booked</th>
                </tr>
              </thead>
              <tbody>
                {pendingItems.map((row) => (
                  <tr key={row.booking_id} className="border-b border-slate-50">
                    <td className="portal-table-strong px-4 py-3">{row.event_name || "—"}</td>
                    <td className="portal-table-cell px-4 py-3">{row.guest_name || "—"}</td>
                    <td className="portal-table-cell px-4 py-3 text-right font-semibold text-emerald-700">
                      {money(row.organizer_payout)}
                    </td>
                    <td className="portal-table-cell px-4 py-3 text-right text-emerald-600">{money(row.gift_card_amount)}</td>
                    <td className="portal-table-cell px-4 py-3 text-right text-emerald-600">{money(row.cash_amount)}</td>
                    <td className="portal-table-cell px-4 py-3">
                      {row.created_at ? formatDate(row.created_at) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="org-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="portal-heading font-semibold flex items-center gap-2">
              <FileText size={18} className="text-rose-500" /> Settlement runs
            </h3>
            <p className="portal-muted text-xs mt-1">Same runs Super Admin manages under Partner Payouts.</p>
          </div>
          <div className="flex items-center gap-2">
            {settlementsFetching && !settlementsLoading && (
              <Loader2 size={14} className="animate-spin text-slate-400" />
            )}
            <select
              value={settlementStatus}
              onChange={(e) => setSettlementStatus(e.target.value)}
              className="portal-select text-sm"
            >
              <option value="ALL">All statuses</option>
              {(["DRAFT", "APPROVED", "PAID", "CANCELLED"] as OrganizerSettlementStatus[]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {settlementsLoading ? (
          <div className="text-center py-10 portal-muted">
            <Loader2 className="animate-spin inline mr-2" size={16} /> Loading settlements…
          </div>
        ) : settlements.length === 0 ? (
          <p className="px-5 py-8 text-center portal-muted text-sm">
            No settlement runs yet. When Super Admin generates a draft for your bookings, it will appear
            here.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="portal-table-head text-left px-4 py-3">Period</th>
                    <th className="portal-table-head text-left px-4 py-3">Status</th>
                    <th className="portal-table-head text-right px-4 py-3">Bookings</th>
                    <th className="portal-table-head text-right px-4 py-3">You receive</th>
                    <th className="portal-table-head text-right px-4 py-3">Commission</th>
                    <th className="portal-table-head text-left px-4 py-3">Paid / ref</th>
                    <th className="portal-table-head text-right px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((run) => (
                    <tr key={run.id} className="border-b border-slate-50">
                      <td className="portal-table-strong px-4 py-3">
                        {formatDate(run.period_from)} – {formatDate(run.period_to)}
                        <span className="block text-[10px] font-normal portal-muted">
                          Created {run.created_at ? formatDate(run.created_at) : "—"}
                        </span>
                      </td>
                      <td className="portal-table-cell px-4 py-3">{statusBadge(run.status)}</td>
                      <td className="portal-table-cell px-4 py-3 text-right">{run.bookings_count}</td>
                      <td className="portal-table-cell px-4 py-3 text-right font-semibold text-emerald-700">
                        {money(run.organizer_payable)}
                      </td>
                      <td className="portal-table-cell px-4 py-3 text-right text-emerald-600">{money(run.commission_total)}</td>
                      <td className="portal-table-cell px-4 py-3">
                        {run.status === "PAID" ? (
                          <span className="text-xs">
                            {run.paid_at ? formatDate(run.paid_at) : "Paid"}
                            {run.payment_reference ? (
                              <span className="block portal-muted">Ref: {run.payment_reference}</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="portal-muted text-xs">—</span>
                        )}
                      </td>
                      <td className="portal-table-cell px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenRun(run.id)}
                          className="text-rose-600 text-xs font-semibold hover:underline"
                        >
                          View lines
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {settlementsMeta && (
              <div className="px-4 py-3 border-t border-slate-100">
                <Pagination
                  meta={{
                    page: settlementsMeta.page || settlementPage,
                    limit: settlementsMeta.limit || 10,
                    total: settlementsMeta.total || 0,
                    total_pages:
                      settlementsMeta.total_pages ||
                      Math.max(1, Math.ceil((settlementsMeta.total || 0) / (settlementsMeta.limit || 10))),
                    has_prev: (settlementsMeta.page || settlementPage) > 1,
                    has_next:
                      (settlementsMeta.page || settlementPage) <
                      (settlementsMeta.total_pages ||
                        Math.max(
                          1,
                          Math.ceil((settlementsMeta.total || 0) / (settlementsMeta.limit || 10))
                        )),
                  }}
                  onPageChange={setSettlementPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SettlementDetailModal({
  loading,
  run,
  onClose,
}: {
  loading: boolean;
  run?: OrganizerSettlementRun;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="portal-heading font-semibold text-lg">Settlement detail</h3>
            {run && (
              <p className="portal-muted text-xs mt-1">
                {formatDate(run.period_from)} – {formatDate(run.period_to)} · {statusBadge(run.status)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4">
          {loading || !run ? (
            <div className="text-center py-10 portal-muted">
              <Loader2 className="animate-spin inline mr-2" size={16} /> Loading…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="You receive" value={money(run.organizer_payable)} accent="text-emerald-600" />
                <StatCard label="Commission" value={money(run.commission_total)} accent="text-emerald-600" />
                <StatCard label="Gift card funded" value={money(run.gift_card_funded)} accent="text-emerald-600" />
                <StatCard label="Cash funded" value={money(run.cash_funded)} accent="text-emerald-600" />
              </div>
              {run.payment_reference || run.notes ? (
                <div className="text-sm space-y-1">
                  {run.payment_reference ? (
                    <p>
                      <span className="portal-muted">Payment ref:</span> {run.payment_reference}
                    </p>
                  ) : null}
                  {run.notes ? (
                    <p>
                      <span className="portal-muted">Notes:</span> {run.notes}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="portal-table-head text-left px-3 py-2">Event</th>
                      <th className="portal-table-head text-left px-3 py-2">Guest</th>
                      <th className="portal-table-head text-right px-3 py-2">Your share</th>
                      <th className="portal-table-head text-right px-3 py-2">GC</th>
                      <th className="portal-table-head text-right px-3 py-2">Cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(run.lines || []).map((line) => (
                      <tr key={line.id} className="border-b border-slate-50">
                        <td className="px-3 py-2">{line.event_name || "—"}</td>
                        <td className="px-3 py-2">{line.guest_name || "—"}</td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-600">{money(line.organizer_payout)}</td>
                        <td className="px-3 py-2 text-right text-emerald-600">{money(line.gift_card_amount)}</td>
                        <td className="px-3 py-2 text-right text-emerald-600">{money(line.cash_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
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
    <div className="org-card p-4">
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
          ? "bg-rose-600 text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-rose-50 hover:border-rose-200"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
