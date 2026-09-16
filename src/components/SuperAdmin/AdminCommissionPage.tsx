"use client";

import { useMemo, useState } from "react";
import { Film, LayoutGrid, Ticket } from "lucide-react";
import { useGetCommissionLedgerQuery } from "@/services/api";
import { formatDate } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { AdminSegmentedTabs } from "@/components/SuperAdmin/AdminFinanceChrome";

const money = formatMoney;

type RevenueModule = "all" | "events" | "movies";
type GroupBy = "item" | "event" | "movie" | "business" | "date" | "customer";

export default function AdminCommissionPage() {
  const [moduleTab, setModuleTab] = useState<RevenueModule>("all");
  const [groupBy, setGroupBy] = useState<GroupBy>("item");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const isOverview = moduleTab === "all";
  const isMovies = moduleTab === "movies";

  const activeGroupBy: GroupBy = useMemo(() => {
    if (isOverview) {
      if (groupBy === "business" || groupBy === "date" || groupBy === "customer") return groupBy;
      return "item";
    }
    if (isMovies) {
      if (groupBy === "event" || groupBy === "item") return "movie";
      return groupBy === "movie" || groupBy === "business" || groupBy === "date" || groupBy === "customer"
        ? groupBy
        : "movie";
    }
    if (groupBy === "movie" || groupBy === "item") return "event";
    return groupBy === "event" || groupBy === "business" || groupBy === "date" || groupBy === "customer"
      ? groupBy
      : "event";
  }, [groupBy, isMovies, isOverview]);

  const { data, isLoading, isFetching } = useGetCommissionLedgerQuery({
    module: moduleTab,
    group_by: activeGroupBy,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  const groupOptions = useMemo(() => {
    if (isOverview) {
      return [
        { key: "item" as const, label: "By item" },
        { key: "business" as const, label: "By partner" },
        { key: "customer" as const, label: "By customer" },
        { key: "date" as const, label: "By date" },
      ];
    }
    if (isMovies) {
      return [
        { key: "movie" as const, label: "By movie" },
        { key: "business" as const, label: "By cinema" },
        { key: "customer" as const, label: "By customer" },
        { key: "date" as const, label: "By date" },
      ];
    }
    return [
      { key: "event" as const, label: "By event" },
      { key: "business" as const, label: "By organizer" },
      { key: "customer" as const, label: "By customer" },
      { key: "date" as const, label: "By date" },
    ];
  }, [isMovies, isOverview]);

  const switchModule = (next: RevenueModule) => {
    setModuleTab(next);
    setGroupBy(next === "all" ? "item" : next === "movies" ? "movie" : "event");
  };

  if (isLoading) {
    return <AdminListShimmer rows={6} columns={8} showToolbar showTabs />;
  }

  const rows = data?.rows || [];
  const totals = data?.totals;
  const breakdown = data?.breakdown;
  const partnerLabel = isOverview
    ? "Partner payout"
    : isMovies
      ? "Cinema payout"
      : "Organizer payout";
  const commissionFromLabel = isOverview
    ? "From all partners"
    : isMovies
      ? "From cinemas"
      : "From organizers";
  const primaryGroup = isOverview ? "item" : isMovies ? "movie" : "event";
  const isPrimaryGroup = activeGroupBy === primaryGroup;

  const customerContact = (row: (typeof rows)[number]) =>
    [row.guest_phone, row.guest_email].filter(Boolean).join(" · ") || "—";

  const itemTitle = (row: (typeof rows)[number]) =>
    row.item_name || row.movie_title || row.event_name || "—";

  const sourceLabel = (row: (typeof rows)[number]) =>
    row.revenue_source === "movies" ? "Movie" : row.revenue_source === "events" ? "Event" : "—";

  const emptyMessage = isOverview
    ? "No ticket revenue yet. Confirmed event and movie bookings will appear here."
    : isMovies
      ? "No movie fee data yet. Bookings will appear once customers purchase movie tickets."
      : "No fee data yet. Bookings will appear once customers purchase tickets.";

  return (
    <div className="w-full space-y-6">
      <div className="admin-list-toolbar">
        <div className="flex flex-wrap items-end justify-between gap-3 w-full">
          <AdminSegmentedTabs
            tabs={[
              { key: "all", label: "Overview", icon: LayoutGrid },
              { key: "events", label: "Events", icon: Ticket },
              { key: "movies", label: "Movies", icon: Film },
            ]}
            active={moduleTab}
            onChange={switchModule}
          />
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {groupOptions.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGroupBy(g.key)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border ${
                    activeGroupBy === g.key
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                      : "text-zinc-400 border-white/10 hover:bg-white/5"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {isFetching ? (
              <span className="text-xs text-zinc-500 self-center">Updating…</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <div className="glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Ticket sales</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {money(totals?.ticket_amount)}
          </div>
        </div>
        <div className="glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Discount</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {money(totals?.discount_total)}
          </div>
          <div className="text-[0.625rem] text-zinc-500 mt-1">Offers / promos</div>
        </div>
        <div className="glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Gift card</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {money(totals?.gift_card_total)}
          </div>
          <div className="text-[0.625rem] text-zinc-500 mt-1">Customer cash only</div>
        </div>
        <div className="glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Convenience fee</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {money(totals?.convenience_fee_total)}
          </div>
          <div className="text-[0.625rem] text-zinc-500 mt-1">From customers</div>
        </div>
        <div className="glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Commission</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {money(totals?.commission_total)}
          </div>
          <div className="text-[0.625rem] text-zinc-500 mt-1">{commissionFromLabel}</div>
        </div>
        <div className="glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Platform earned</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {money(totals?.platform_earned)}
          </div>
          <div className="text-[0.625rem] text-zinc-500 mt-1">Convenience + commission</div>
        </div>
        <div className="glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">{partnerLabel}</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {money(totals?.organizer_payout)}
          </div>
        </div>
      </div>

      {isOverview && breakdown ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 -mt-2">
          <div className="glass-panel rounded-xl border border-white/5 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Events share</p>
              <p className="text-sm text-zinc-300 mt-0.5">
                Platform {money(breakdown.events?.platform_earned)} · Payout{" "}
                {money(breakdown.events?.organizer_payout)}
              </p>
            </div>
            <p className="text-lg font-bold text-emerald-600 tabular-nums">
              {money(breakdown.events?.ticket_amount)}
            </p>
          </div>
          <div className="glass-panel rounded-xl border border-white/5 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Movies share</p>
              <p className="text-sm text-zinc-300 mt-0.5">
                Platform {money(breakdown.movies?.platform_earned)} · Payout{" "}
                {money(breakdown.movies?.organizer_payout)}
              </p>
            </div>
            <p className="text-lg font-bold text-emerald-600 tabular-nums">
              {money(breakdown.movies?.ticket_amount)}
            </p>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-zinc-500 -mt-2">
        {isOverview
          ? "Full BookMyBota ticket revenue across events and movies. Partner promos reduce payout; platform promos are absorbed by BookMyBota; gift cards reduce customer cash only."
          : `Partner promos reduce ${isMovies ? "cinema" : "organizer"} payout. Platform (BookMyBota) promos are absorbed by BookMyBota and do not reduce partner payout. Gift cards reduce customer cash only.`}
      </p>

      {rows.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/5 text-center py-10 text-zinc-500">
          {emptyMessage}
        </div>
      ) : (
        <>
          <div className="admin-card-grid">
            {rows.map((row, idx) => (
              <article
                key={`${row.revenue_source || ""}-${row.event_id || row.movie_id || row.customer_key || row.business_id || idx}`}
                className="admin-data-card"
              >
                <div className="admin-data-card-header">
                  {isPrimaryGroup && (
                    <p className="admin-data-card-title">{itemTitle(row)}</p>
                  )}
                  {activeGroupBy === "business" && (
                    <p className="admin-data-card-title">
                      {row.cinema_name || row.organizer_name || "—"}
                    </p>
                  )}
                  {activeGroupBy === "customer" && (
                    <p className="admin-data-card-title">{row.customer_name || "Guest"}</p>
                  )}
                  {activeGroupBy === "date" && (
                    <p className="admin-data-card-title">
                      {row.booking_date ? formatDate(row.booking_date) : "—"}
                    </p>
                  )}
                </div>
                <div className="admin-data-card-body">
                  {isPrimaryGroup && (
                    <>
                      {isOverview ? (
                        <div className="admin-data-card-row">
                          <span className="admin-data-card-label">Source</span>
                          <div className="admin-data-card-value">{sourceLabel(row)}</div>
                        </div>
                      ) : null}
                      <div className="admin-data-card-row">
                        <span className="admin-data-card-label">
                          {isOverview ? "Partner" : isMovies ? "Cinema" : "Organizer"}
                        </span>
                        <div className="admin-data-card-value">
                          {row.cinema_name || row.organizer_name || "—"}
                        </div>
                      </div>
                      <div className="admin-data-card-row">
                        <span className="admin-data-card-label">Rates</span>
                        <div className="admin-data-card-value text-sm">
                          {Number(row.convenience_fee_percent || 0).toFixed(2)}% convenience
                          <div className="text-xs text-zinc-500">
                            {Number(row.commission_percent || 0).toFixed(2)}% commission
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  {activeGroupBy === "customer" && (
                    <>
                      <div className="admin-data-card-row">
                        <span className="admin-data-card-label">Contact</span>
                        <div className="admin-data-card-value text-sm">{customerContact(row)}</div>
                      </div>
                      <div className="admin-data-card-row">
                        <span className="admin-data-card-label">Bookings</span>
                        <div className="admin-data-card-value">{row.bookings_count}</div>
                      </div>
                    </>
                  )}
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Tickets</span>
                    <div className="admin-data-card-value">{row.tickets_sold}</div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Ticket sales</span>
                    <div className="admin-data-card-value text-emerald-600">
                      {money(row.ticket_amount)}
                    </div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Discount</span>
                    <div className="admin-data-card-value text-emerald-600">
                      {money(row.discount_total)}
                    </div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Gift card</span>
                    <div className="admin-data-card-value text-emerald-600">
                      {money(row.gift_card_total)}
                    </div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Convenience fee</span>
                    <div className="admin-data-card-value text-emerald-600">
                      {money(row.convenience_fee_total)}
                    </div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Commission</span>
                    <div className="admin-data-card-value text-emerald-600">
                      {money(row.commission_total)}
                    </div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Platform earned</span>
                    <div className="admin-data-card-value text-emerald-600 font-medium">
                      {money(row.platform_earned)}
                    </div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">{partnerLabel}</span>
                    <div className="admin-data-card-value text-emerald-600">
                      {money(row.organizer_payout)}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="admin-table-desktop glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[900px]">
                <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400 text-sm">
                  <tr>
                    {isPrimaryGroup && (
                      <>
                        {isOverview ? (
                          <th className="px-6 py-4 font-medium">Source</th>
                        ) : null}
                        <th className="px-6 py-4 font-medium">
                          {isOverview ? "Item" : isMovies ? "Movie" : "Event"}
                        </th>
                        <th className="px-6 py-4 font-medium">
                          {isOverview ? "Partner" : isMovies ? "Cinema" : "Organizer"}
                        </th>
                        <th className="px-6 py-4 font-medium">Rates</th>
                      </>
                    )}
                    {activeGroupBy === "business" && (
                      <th className="px-6 py-4 font-medium">
                        {isOverview ? "Partner" : isMovies ? "Cinema" : "Organizer"}
                      </th>
                    )}
                    {activeGroupBy === "customer" && (
                      <>
                        <th className="px-6 py-4 font-medium">Customer</th>
                        <th className="px-6 py-4 font-medium">Contact</th>
                        <th className="px-6 py-4 font-medium">Bookings</th>
                      </>
                    )}
                    {activeGroupBy === "date" && (
                      <th className="px-6 py-4 font-medium">Date</th>
                    )}
                    <th className="px-6 py-4 font-medium">Tickets</th>
                    <th className="px-6 py-4 font-medium">Ticket sales</th>
                    <th className="px-6 py-4 font-medium">Discount</th>
                    <th className="px-6 py-4 font-medium">Gift card</th>
                    <th className="px-6 py-4 font-medium">Convenience fee</th>
                    <th className="px-6 py-4 font-medium">Commission</th>
                    <th className="px-6 py-4 font-medium">Platform earned</th>
                    <th className="px-6 py-4 font-medium">{partnerLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((row, idx) => (
                    <tr
                      key={`${row.revenue_source || ""}-${row.event_id || row.movie_id || row.customer_key || row.business_id || idx}`}
                      className="hover:bg-white/5 transition-colors"
                    >
                      {isPrimaryGroup && (
                        <>
                          {isOverview ? (
                            <td className="px-6 py-4 text-zinc-400">{sourceLabel(row)}</td>
                          ) : null}
                          <td className="px-6 py-4 font-medium text-white">{itemTitle(row)}</td>
                          <td className="px-6 py-4 text-zinc-400">
                            {row.cinema_name || row.organizer_name || "—"}
                          </td>
                          <td className="px-6 py-4 text-zinc-300 text-sm">
                            <div>
                              {Number(row.convenience_fee_percent || 0).toFixed(2)}% convenience
                            </div>
                            <div className="text-xs text-zinc-500">
                              {Number(row.commission_percent || 0).toFixed(2)}% commission
                            </div>
                          </td>
                        </>
                      )}
                      {activeGroupBy === "business" && (
                        <td className="px-6 py-4 font-medium text-white">
                          {row.cinema_name || row.organizer_name || "—"}
                        </td>
                      )}
                      {activeGroupBy === "customer" && (
                        <>
                          <td className="px-6 py-4 font-medium text-white">
                            {row.customer_name || "Guest"}
                          </td>
                          <td className="px-6 py-4 text-zinc-400 text-sm">
                            {customerContact(row)}
                          </td>
                          <td className="px-6 py-4 text-zinc-300">{row.bookings_count}</td>
                        </>
                      )}
                      {activeGroupBy === "date" && (
                        <td className="px-6 py-4 font-medium text-white">
                          {row.booking_date ? formatDate(row.booking_date) : "—"}
                        </td>
                      )}
                      <td className="px-6 py-4 text-zinc-300">{row.tickets_sold}</td>
                      <td className="px-6 py-4 text-emerald-600">{money(row.ticket_amount)}</td>
                      <td className="px-6 py-4 text-emerald-600">{money(row.discount_total)}</td>
                      <td className="px-6 py-4 text-emerald-600">{money(row.gift_card_total)}</td>
                      <td className="px-6 py-4 text-emerald-600">
                        {money(row.convenience_fee_total)}
                      </td>
                      <td className="px-6 py-4 text-emerald-600">
                        {money(row.commission_total)}
                      </td>
                      <td className="px-6 py-4 text-emerald-600 font-medium">
                        {money(row.platform_earned)}
                      </td>
                      <td className="px-6 py-4 text-emerald-600">
                        {money(row.organizer_payout)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
