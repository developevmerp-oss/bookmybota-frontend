"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Search,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  useGetCinemaLedgerCustomersQuery,
  useGetCinemaLedgerQuery,
  useGetCinemaSettlementQuery,
  useGetCinemaSettlementsPendingQuery,
  useGetCinemaSettlementsQuery,
} from "@/services/api";
import { formatDate } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";

const money = formatMoney;

type Tab = "revenue" | "settlements";

function statusBadge(status?: string) {
  const s = String(status || "").toUpperCase();
  const cls =
    s === "PAID"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : s === "APPROVED"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : s === "PENDING" || s === "DRAFT"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : s === "CANCELLED"
            ? "border-rose-200 bg-rose-50 text-rose-700"
            : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span
      className={`inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${cls}`}
    >
      {s || "—"}
    </span>
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

export default function CinemaSettlementsPage() {
  const [tab, setTab] = useState<Tab>("revenue");
  const [movieFilter, setMovieFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [settlementStatus, setSettlementStatus] = useState("ALL");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const filterParams = useMemo(
    () => ({
      ...(movieFilter ? { movie_id: movieFilter } : {}),
      ...(searchQuery ? { q: searchQuery } : {}),
      ...(fromDate ? { from: fromDate } : {}),
      ...(toDate ? { to: toDate } : {}),
    }),
    [movieFilter, searchQuery, fromDate, toDate]
  );

  const { data, isLoading } = useGetCinemaLedgerQuery(filterParams, {
    skip: tab !== "revenue",
  });

  const {
    data: customerData,
    isLoading: customersLoading,
    isFetching: customersFetching,
  } = useGetCinemaLedgerCustomersQuery(
    { ...filterParams, page },
    { skip: tab !== "revenue" }
  );

  const { data: pendingRes, isLoading: pendingLoading } =
    useGetCinemaSettlementsPendingQuery(undefined, { skip: tab !== "settlements" });

  const {
    data: settlements = [],
    isLoading: settlementsLoading,
    isFetching: settlementsFetching,
  } = useGetCinemaSettlementsQuery(
    settlementStatus !== "ALL" ? { status: settlementStatus } : undefined,
    { skip: tab !== "settlements" }
  );

  const { data: selectedRun, isLoading: runDetailLoading } = useGetCinemaSettlementQuery(
    selectedRunId || "",
    { skip: !selectedRunId }
  );

  const summary = data?.summary;
  const movieRows = data?.rows || [];
  const movies = data?.movies || [];
  const recentSettlements = data?.recent_settlements || [];
  const customerEntries = customerData?.items || [];
  const pagination = customerData?.pagination;
  const pendingItems = pendingRes?.data ?? [];
  const pendingSummary = pendingRes?.summary;

  const applyFilters = () => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  const resetFilters = () => {
    setMovieFilter("");
    setSearchInput("");
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  const hasActiveFilters = Boolean(movieFilter || searchQuery || fromDate || toDate);

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
                <label className="portal-label text-xs mb-1.5 block">Movie</label>
                <select
                  value={movieFilter}
                  onChange={(e) => {
                    setMovieFilter(e.target.value);
                    setPage(1);
                  }}
                  className="portal-select w-full"
                >
                  <option value="">All movies</option>
                  {movies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="portal-label text-xs mb-1.5 block">Customer search</label>
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                    placeholder="Name, phone, email or booking code"
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
                <StatCard
                  label="Ticket sales"
                  value={money(summary?.ticket_amount)}
                  accent="text-emerald-600"
                />
                <StatCard
                  label="Commission deducted"
                  value={money(summary?.commission_total)}
                  accent="text-emerald-600"
                />
                <StatCard
                  label="Your earnings"
                  value={money(summary?.cinema_earned)}
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
                  label="Open settlement runs"
                  value={money(summary?.open_runs_payable)}
                  accent="text-emerald-600"
                />
              </div>

              <div className="org-card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="portal-heading font-semibold">By movie</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="portal-table-head text-left px-4 py-3">Movie</th>
                        <th className="portal-table-head text-right px-4 py-3">Bookings</th>
                        <th className="portal-table-head text-right px-4 py-3">Tickets</th>
                        <th className="portal-table-head text-right px-4 py-3">Sales</th>
                        <th className="portal-table-head text-right px-4 py-3">Commission</th>
                        <th className="portal-table-head text-right px-4 py-3">Earned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movieRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center portal-muted">
                            No ticket sales recorded yet.
                          </td>
                        </tr>
                      ) : (
                        movieRows.map((row) => (
                          <tr key={row.movie_id} className="border-b border-slate-50">
                            <td className="portal-table-strong px-4 py-3">
                              {row.movie_title}
                              <span className="block text-[10px] font-normal portal-muted">
                                {row.movie_status || "—"}
                              </span>
                            </td>
                            <td className="portal-table-cell px-4 py-3 text-right">
                              {row.bookings_count}
                            </td>
                            <td className="portal-table-cell px-4 py-3 text-right">
                              {row.tickets_sold}
                            </td>
                            <td className="portal-table-cell px-4 py-3 text-right text-emerald-600">
                              {money(row.ticket_amount)}
                            </td>
                            <td className="portal-table-cell px-4 py-3 text-right text-emerald-600">
                              {money(row.commission_total)}
                            </td>
                            <td className="portal-table-cell px-4 py-3 text-right font-semibold text-emerald-600">
                              {money(row.cinema_earned)}
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
                            <th className="portal-table-head text-left px-4 py-3">Movie</th>
                            <th className="portal-table-head text-right px-4 py-3">Tickets</th>
                            <th className="portal-table-head text-right px-4 py-3">Sales</th>
                            <th className="portal-table-head text-right px-4 py-3">Your share</th>
                            <th className="portal-table-head text-left px-4 py-3">Booked</th>
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
                                    {row.booking_code || row.guest_phone || row.guest_email || "—"}
                                  </span>
                                </td>
                                <td className="portal-table-cell px-4 py-3">{row.movie_title}</td>
                                <td className="portal-table-cell px-4 py-3 text-right">
                                  {row.ticket_qty}
                                </td>
                                <td className="portal-table-cell px-4 py-3 text-right text-emerald-600">
                                  {money(row.ticket_amount)}
                                </td>
                                <td className="portal-table-cell px-4 py-3 text-right font-semibold text-emerald-700">
                                  {money(row.cinema_earned)}
                                </td>
                                <td className="portal-table-cell px-4 py-3">
                                  {row.created_at ? formatDate(row.created_at) : "—"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {pagination && pagination.total_pages > 1 && (
                      <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <p className="text-xs portal-muted">
                          Page {pagination.page} of {pagination.total_pages}
                        </p>
                        <div className="flex items-center gap-1">
                          <PaginationButton
                            onClick={() => goToPage(pagination.page - 1)}
                            disabled={!pagination.has_prev}
                          >
                            <ChevronLeft size={16} />
                          </PaginationButton>
                          <PaginationButton
                            onClick={() => goToPage(pagination.page + 1)}
                            disabled={!pagination.has_next}
                          >
                            <ChevronRight size={16} />
                          </PaginationButton>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="org-card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="portal-heading font-semibold flex items-center gap-2">
                    <FileText size={18} className="text-rose-500" /> Recent settlement runs
                  </h3>
                  <p className="portal-muted text-xs mt-1">
                    Prepared by Super Admin under Partner Payouts → Movies.
                  </p>
                </div>
                {recentSettlements.length === 0 ? (
                  <p className="px-5 py-8 text-center portal-muted text-sm">
                    No settlement runs yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="portal-table-head text-left px-4 py-3">Created</th>
                          <th className="portal-table-head text-left px-4 py-3">Status</th>
                          <th className="portal-table-head text-right px-4 py-3">Bookings</th>
                          <th className="portal-table-head text-right px-4 py-3">You receive</th>
                          <th className="portal-table-head text-right px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {recentSettlements.map((run) => (
                          <tr key={run.id} className="border-b border-slate-50">
                            <td className="portal-table-cell px-4 py-3">
                              {run.created_at ? formatDate(run.created_at) : "—"}
                            </td>
                            <td className="portal-table-cell px-4 py-3">
                              {statusBadge(run.status)}
                            </td>
                            <td className="portal-table-cell px-4 py-3 text-right">
                              {run.booking_count || 0}
                            </td>
                            <td className="portal-table-cell px-4 py-3 text-right font-semibold text-emerald-700">
                              {money(run.cinema_payable)}
                            </td>
                            <td className="portal-table-cell px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setTab("settlements");
                                  setSelectedRunId(run.id);
                                }}
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
          settlementStatus={settlementStatus}
          setSettlementStatus={setSettlementStatus}
          onOpenRun={setSelectedRunId}
        />
      )}

      {selectedRunId ? (
        <SettlementDetailModal
          loading={runDetailLoading}
          run={selectedRun}
          onClose={() => setSelectedRunId(null)}
        />
      ) : null}
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
  settlementStatus,
  setSettlementStatus,
  onOpenRun,
}: {
  pendingLoading: boolean;
  pendingSummary?: {
    bookings_count: number;
    cinema_payable: number;
    gift_card_amount: number;
    cash_amount: number;
    period_from?: string | null;
    period_to?: string | null;
  };
  pendingItems: Array<{
    booking_id: string;
    created_at?: string;
    guest_name?: string | null;
    booking_code?: string | null;
    cinema_payable: number | string;
    gift_card_amount: number | string;
    cash_amount: number | string;
    movie_title?: string;
  }>;
  settlementsLoading: boolean;
  settlementsFetching: boolean;
  settlements: any[];
  settlementStatus: string;
  setSettlementStatus: (v: string) => void;
  onOpenRun: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="org-card p-4">
        <p className="text-sm portal-muted">
          Super Admin prepares settlement runs from your confirmed bookings (ticket sales −
          commission). You can track pending → approved → paid here. Gift-card amounts on bookings
          do not reduce your cinema share.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Awaiting settlement"
          value={String(pendingSummary?.bookings_count ?? (pendingLoading ? "…" : 0))}
        />
        <StatCard
          label="Payable (unsettled)"
          value={pendingLoading ? "…" : money(pendingSummary?.cinema_payable)}
          accent="text-emerald-600"
        />
        <StatCard
          label="GC on unsettled bookings"
          value={pendingLoading ? "…" : money(pendingSummary?.gift_card_amount)}
          accent="text-emerald-600"
        />
        <StatCard
          label="Cash on unsettled bookings"
          value={pendingLoading ? "…" : money(pendingSummary?.cash_amount)}
          accent="text-emerald-600"
        />
      </div>

      <div className="org-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="portal-heading font-semibold">Bookings waiting for a settlement run</h3>
          <p className="portal-muted text-xs mt-1">
            These confirmed bookings are not on any pending/approved/paid run yet.
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
                  <th className="portal-table-head text-left px-4 py-3">Movie</th>
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
                    <td className="portal-table-strong px-4 py-3">{row.movie_title || "—"}</td>
                    <td className="portal-table-cell px-4 py-3">
                      {row.guest_name || "—"}
                      {row.booking_code ? (
                        <span className="block text-[10px] portal-muted">{row.booking_code}</span>
                      ) : null}
                    </td>
                    <td className="portal-table-cell px-4 py-3 text-right font-semibold text-emerald-700">
                      {money(row.cinema_payable)}
                    </td>
                    <td className="portal-table-cell px-4 py-3 text-right text-emerald-600">
                      {money(row.gift_card_amount)}
                    </td>
                    <td className="portal-table-cell px-4 py-3 text-right text-emerald-600">
                      {money(row.cash_amount)}
                    </td>
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
            <p className="portal-muted text-xs mt-1">
              Same runs Super Admin manages under Partner Payouts → Movies.
            </p>
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
              {(["PENDING", "APPROVED", "PAID", "CANCELLED"] as const).map((s) => (
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
            No settlement runs yet. When Super Admin generates a run for your bookings, it will appear
            here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="portal-table-head text-left px-4 py-3">Created</th>
                  <th className="portal-table-head text-left px-4 py-3">Status</th>
                  <th className="portal-table-head text-right px-4 py-3">Bookings</th>
                  <th className="portal-table-head text-right px-4 py-3">You receive</th>
                  <th className="portal-table-head text-right px-4 py-3">Commission</th>
                  <th className="portal-table-head text-left px-4 py-3">Paid</th>
                  <th className="portal-table-head text-right px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {settlements.map((run) => (
                  <tr key={run.id} className="border-b border-slate-50">
                    <td className="portal-table-strong px-4 py-3">
                      {run.created_at ? formatDate(run.created_at) : "—"}
                      {run.notes ? (
                        <span className="block text-[10px] font-normal portal-muted line-clamp-1">
                          {run.notes}
                        </span>
                      ) : null}
                    </td>
                    <td className="portal-table-cell px-4 py-3">{statusBadge(run.status)}</td>
                    <td className="portal-table-cell px-4 py-3 text-right">
                      {run.booking_count || 0}
                    </td>
                    <td className="portal-table-cell px-4 py-3 text-right font-semibold text-emerald-700">
                      {money(run.cinema_payable)}
                    </td>
                    <td className="portal-table-cell px-4 py-3 text-right text-emerald-600">
                      {money(run.commission_total)}
                    </td>
                    <td className="portal-table-cell px-4 py-3">
                      {String(run.status).toUpperCase() === "PAID" ? (
                        <span className="text-xs">
                          {run.paid_at ? formatDate(run.paid_at) : "Paid"}
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
  run?: any;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="portal-heading font-semibold text-lg">Settlement detail</h3>
            {run && (
              <p className="portal-muted text-xs mt-1 flex flex-wrap items-center gap-2">
                {run.created_at ? formatDate(run.created_at) : "—"} · {statusBadge(run.status)}
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
                <StatCard label="You receive" value={money(run.cinema_payable)} accent="text-emerald-600" />
                <StatCard label="Commission" value={money(run.commission_total)} accent="text-emerald-600" />
                <StatCard label="Gift card" value={money(run.gift_card_amount)} accent="text-emerald-600" />
                <StatCard label="Cash" value={money(run.cash_amount)} accent="text-emerald-600" />
              </div>
              {run.notes ? (
                <p className="text-sm">
                  <span className="portal-muted">Notes:</span> {run.notes}
                </p>
              ) : null}
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                      <th className="portal-table-head text-left px-3 py-2">Movie</th>
                      <th className="portal-table-head text-left px-3 py-2">Guest</th>
                      <th className="portal-table-head text-right px-3 py-2">Your share</th>
                      <th className="portal-table-head text-right px-3 py-2">GC</th>
                      <th className="portal-table-head text-right px-3 py-2">Cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(run.lines || []).map((line: any) => (
                      <tr key={line.id} className="border-b border-slate-50">
                        <td className="px-3 py-2">{line.movie_title || "—"}</td>
                        <td className="px-3 py-2">
                          {line.guest_name || "—"}
                          {line.booking_code ? (
                            <span className="block text-[10px] portal-muted">{line.booking_code}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-600">
                          {money(line.cinema_payable)}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-600">
                          {money(line.gift_card_amount)}
                        </td>
                        <td className="px-3 py-2 text-right text-emerald-600">
                          {money(line.cash_amount)}
                        </td>
                      </tr>
                    ))}
                    {(run.lines || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center portal-muted text-sm">
                          No booking lines on this run.
                        </td>
                      </tr>
                    ) : null}
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
