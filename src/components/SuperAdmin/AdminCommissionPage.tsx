"use client";

import { useMemo, useState } from "react";
import { Film, Ticket } from "lucide-react";
import { useGetCommissionLedgerQuery } from "@/services/api";
import { formatDate } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { AdminSegmentedTabs } from "@/components/SuperAdmin/AdminFinanceChrome";

const money = formatMoney;

type RevenueModule = "events" | "movies";
type GroupBy = "event" | "movie" | "business" | "date" | "customer";

export default function AdminCommissionPage() {
  const [moduleTab, setModuleTab] = useState<RevenueModule>("events");
  const [groupBy, setGroupBy] = useState<GroupBy>("event");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const activeGroupBy: GroupBy =
    moduleTab === "movies"
      ? groupBy === "event"
        ? "movie"
        : groupBy
      : groupBy === "movie"
        ? "event"
        : groupBy;

  const { data, isLoading, isFetching } = useGetCommissionLedgerQuery({
    module: moduleTab,
    group_by: activeGroupBy,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  const groupOptions = useMemo(() => {
    if (moduleTab === "movies") {
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
  }, [moduleTab]);

  const switchModule = (next: RevenueModule) => {
    setModuleTab(next);
    setGroupBy(next === "movies" ? "movie" : "event");
  };

  if (isLoading) {
    return <AdminListShimmer rows={6} columns={8} showToolbar showTabs />;
  }

  const rows = data?.rows || [];
  const totals = data?.totals;
  const isMovies = moduleTab === "movies";
  const partnerLabel = isMovies ? "Cinema payout" : "Organizer payout";
  const commissionFromLabel = isMovies ? "From cinemas" : "From organizers";
  const primaryGroup = isMovies ? "movie" : "event";

  const customerContact = (row: (typeof rows)[number]) =>
    [row.guest_phone, row.guest_email].filter(Boolean).join(" · ") || "—";

  return (
    <div className="w-full space-y-6">
      <div className="admin-list-toolbar">
        <div className="flex flex-wrap items-end justify-between gap-3 w-full">
          <AdminSegmentedTabs
            tabs={[
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

      <p className="text-xs text-zinc-500 -mt-2">
        Partner promos reduce {isMovies ? "cinema" : "organizer"} payout. Platform (BookMyBota)
        promos are absorbed by BookMyBota and do not reduce partner payout. Gift cards reduce
        customer cash only.
      </p>

      {rows.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/5 text-center py-10 text-zinc-500">
          {isMovies
            ? "No movie fee data yet. Bookings will appear once customers purchase movie tickets."
            : "No fee data yet. Bookings will appear once customers purchase tickets."}
        </div>
      ) : (
        <>
          <div className="admin-card-grid">
            {rows.map((row, idx) => (
              <article key={row.customer_key || idx} className="admin-data-card">
                <div className="admin-data-card-header">
                  {activeGroupBy === primaryGroup && (
                    <p className="admin-data-card-title">
                      {isMovies
                        ? row.movie_title || row.event_name || "—"
                        : row.event_name || "—"}
                    </p>
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
                  {activeGroupBy === primaryGroup && (
                    <>
                      <div className="admin-data-card-row">
                        <span className="admin-data-card-label">
                          {isMovies ? "Cinema" : "Organizer"}
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
                    {activeGroupBy === primaryGroup && (
                      <>
                        <th className="px-6 py-4 font-medium">
                          {isMovies ? "Movie" : "Event"}
                        </th>
                        <th className="px-6 py-4 font-medium">
                          {isMovies ? "Cinema" : "Organizer"}
                        </th>
                        <th className="px-6 py-4 font-medium">Rates</th>
                      </>
                    )}
                    {activeGroupBy === "business" && (
                      <th className="px-6 py-4 font-medium">
                        {isMovies ? "Cinema" : "Organizer"}
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
                      key={row.customer_key || idx}
                      className="hover:bg-white/5 transition-colors"
                    >
                      {activeGroupBy === primaryGroup && (
                        <>
                          <td className="px-6 py-4 font-medium text-white">
                            {isMovies
                              ? row.movie_title || row.event_name || "—"
                              : row.event_name || "—"}
                          </td>
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
