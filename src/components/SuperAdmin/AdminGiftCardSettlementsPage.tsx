"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  RotateCcw,
  Store,
  Ticket,
  Wallet,
} from "lucide-react";
import {
  useGetAdminEventGiftCardRedemptionsQuery,
  useGetAdminGiftCardSettlementOverviewQuery,
} from "@/services/api";
import { formatDate, formatTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  AdminCallout,
  AdminEmptyState,
  AdminFilterBar,
  AdminSegmentedTabs,
  AdminStatCard,
  AdminStatusBadge,
  adminFinancePageClass,
} from "@/components/SuperAdmin/AdminFinanceChrome";

type VerticalTab = "overview" | "dining" | "events";

/**
 * Gift Card Ledger — liability + usage visibility.
 * Partner payments happen under Partner Payouts.
 */
export default function AdminGiftCardSettlementsPage() {
  const [vertical, setVertical] = useState<VerticalTab>("overview");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data: overview, isLoading: overviewLoading } =
    useGetAdminGiftCardSettlementOverviewQuery(undefined, {
      skip: vertical !== "overview" && vertical !== "dining",
    });

  const { data: eventData, isLoading: eventLoading, isError: eventError } =
    useGetAdminEventGiftCardRedemptionsQuery(
      {
        page,
        limit: PAGE_SIZE,
        ...(q.trim() ? { q: q.trim() } : {}),
        ...(fromDate ? { from: fromDate } : {}),
        ...(toDate ? { to: toDate } : {}),
      },
      { skip: vertical !== "events" }
    );

  const eventRows = eventData?.items ?? [];
  const eventMeta = eventData?.meta;
  const eventSummary = eventData?.summary;

  const switchVertical = (next: VerticalTab) => {
    setVertical(next);
    setPage(1);
    setQ("");
    setFromDate("");
    setToDate("");
  };

  return (
    <div className={adminFinancePageClass}>
      <AdminSegmentedTabs
        tabs={[
          { key: "overview", label: "Overview", icon: Wallet },
          { key: "dining", label: "Dining", icon: Store },
          { key: "events", label: "Events", icon: Ticket },
        ]}
        active={vertical}
        onChange={switchVertical}
      />

      {vertical === "overview" && (
        <>
          {overviewLoading ? (
            <AdminListShimmer rows={4} columns={4} showTabs={false} showToolbar={false} />
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-amber-500 to-amber-400/30" />
                  <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl bg-amber-500/15 border border-amber-500/25 p-2.5 text-amber-300">
                        <Store size={18} />
                      </span>
                      <div>
                        <p className="text-base font-bold text-white">Dining</p>
                        <p className="text-xs text-zinc-500">POS redeem → restaurant payable</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                        Pending payable
                      </p>
                      <p className="text-2xl font-extrabold text-emerald-600 tabular-nums mt-1">
                        {formatMoney(overview?.dining?.pending_amount || 0)}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {overview?.dining?.pending_count || 0} redemption(s) awaiting approval
                      </p>
                    </div>
                    <Link
                      href="/admin/organizer-payouts?tab=dining"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
                    >
                      Settle dining <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>

                <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-sky-500 to-sky-400/30" />
                  <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xl bg-sky-500/15 border border-sky-500/25 p-2.5 text-sky-300">
                        <Ticket size={18} />
                      </span>
                      <div>
                        <p className="text-base font-bold text-white">Events</p>
                        <p className="text-xs text-zinc-500">GC vs cash · organizer share unchanged</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                          GC used
                        </p>
                        <p className="text-xl font-extrabold text-emerald-600 tabular-nums mt-1">
                          {formatMoney(overview?.events?.gift_card_redeemed || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                          Organizer share
                        </p>
                        <p className="text-xl font-extrabold text-emerald-600 tabular-nums mt-1">
                          {formatMoney(overview?.events?.organizer_payout_total || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/admin/organizer-payouts?tab=events"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors"
                      >
                        Settle events <ArrowRight size={14} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => switchVertical("events")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-white/10 text-zinc-300 hover:bg-white/5 transition-colors"
                      >
                        View GC usage
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">
                  Platform gift-card float
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  <AdminStatCard
                    icon={Wallet}
                    label="Liability outstanding"
                    value={formatMoney(
                      overview?.gift_card_liability?.outstanding_liability || 0
                    )}
                    hint={`${overview?.gift_card_liability?.active_cards || 0} active cards`}
                    accent="text-emerald-600"
                  />
                  <AdminStatCard
                    icon={CreditCard}
                    label="All redeemed"
                    value={formatMoney(overview?.ledger?.total_redeemed || 0)}
                    hint="All verticals"
                    accent="text-emerald-600"
                  />
                  <AdminStatCard
                    icon={Store}
                    label="Dining redeemed"
                    value={formatMoney(overview?.ledger?.dining_redeemed || 0)}
                    accent="text-emerald-600"
                  />
                  <AdminStatCard
                    icon={Ticket}
                    label="Event redeemed"
                    value={formatMoney(overview?.ledger?.event_redeemed || 0)}
                    accent="text-emerald-600"
                  />
                  <AdminStatCard
                    icon={RotateCcw}
                    label="Reversed"
                    value={formatMoney(overview?.ledger?.total_reversed || 0)}
                    hint="Cancels / restores"
                    accent="text-emerald-600"
                  />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {vertical === "dining" && (
        <div className="space-y-5">
          <AdminCallout
            tone="amber"
            action={
              <Link
                href="/admin/organizer-payouts?tab=dining"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
              >
                Open Dining payables <ArrowRight size={14} />
              </Link>
            }
          >
            Snapshot of restaurant gift-card payables. Approve and mark paid under{" "}
            <span className="font-semibold">Partner Payouts → Dining</span>.
          </AdminCallout>

          {overviewLoading ? (
            <AdminListShimmer rows={2} columns={4} showTabs={false} showToolbar={false} />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <AdminStatCard
                label="Pending"
                value={formatMoney(overview?.dining?.pending_amount || 0)}
                hint={`${overview?.dining?.pending_count || 0} redemptions`}
                accent="text-emerald-600"
              />
              <AdminStatCard
                label="Approved"
                value={formatMoney(overview?.dining?.approved_amount || 0)}
                hint={`${overview?.dining?.approved_count || 0} ready`}
                accent="text-emerald-600"
              />
              <AdminStatCard
                label="Paid"
                value={formatMoney(overview?.dining?.paid_amount || 0)}
                hint={`${overview?.dining?.paid_count || 0} settled`}
                accent="text-emerald-600"
              />
              <AdminStatCard
                label="GC redeemed"
                value={formatMoney(overview?.ledger?.dining_redeemed || 0)}
                accent="text-emerald-600"
              />
            </div>
          )}
        </div>
      )}

      {vertical === "events" && (
        <div className="space-y-5">
          <AdminCallout
            tone="sky"
            action={
              <Link
                href="/admin/organizer-payouts?tab=events"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
              >
                Open Partner Payouts <ArrowRight size={14} />
              </Link>
            }
          >
            Usage visibility only — organizer money is paid via{" "}
            <span className="font-semibold">Partner Payouts → Events</span>.
          </AdminCallout>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <AdminStatCard
              label="GC redeemed"
              value={formatMoney(eventSummary?.gift_card_redeemed || 0)}
              hint={`${eventSummary?.bookings_count || 0} bookings`}
              accent="text-emerald-600"
            />
            <AdminStatCard
              label="Customer cash"
              value={formatMoney(eventSummary?.customer_cash_total || 0)}
              hint="After gift card"
              accent="text-emerald-600"
            />
            <AdminStatCard
              label="Organizer entitlement"
              value={formatMoney(eventSummary?.organizer_payout_total || 0)}
              hint="Ticket − commission"
              accent="text-emerald-600"
            />
            <AdminStatCard
              label="Bookings"
              value={String(eventSummary?.bookings_count || 0)}
              accent="text-zinc-200"
            />
          </div>

          <AdminFilterBar>
            <div className="flex-1 min-w-0">
              <SearchInput
                value={q}
                onChange={(v) => {
                  setQ(v);
                  setPage(1);
                }}
                placeholder="Search event, organizer, guest, last4…"
              />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <label className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                <CalendarDays size={14} />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                  aria-label="From date"
                />
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                aria-label="To date"
              />
            </div>
          </AdminFilterBar>

          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            {eventLoading ? (
              <AdminListShimmer rows={6} columns={6} showTabs={false} showToolbar={false} />
            ) : eventError ? (
              <p className="text-center text-rose-400 py-16">Could not load event gift card usage.</p>
            ) : eventRows.length === 0 ? (
              <AdminEmptyState
                icon={Ticket}
                title="No event gift card redemptions yet"
                description="When guests apply a gift card at checkout, usage appears here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[760px]">
                  <thead className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                    <tr>
                      <th className="px-4 py-3.5 font-semibold">Event / Organizer</th>
                      <th className="px-4 py-3.5 font-semibold">Guest / Card</th>
                      <th className="px-4 py-3.5 font-semibold">Ticket / Fee</th>
                      <th className="px-4 py-3.5 font-semibold">Paid with</th>
                      <th className="px-4 py-3.5 font-semibold">Organizer</th>
                      <th className="px-4 py-3.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {eventRows.map((row) => (
                      <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3.5 align-top">
                          <p className="font-semibold text-white">{row.event_name || "—"}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">{row.organizer_name || "—"}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {row.redeemed_at
                              ? `${formatDate(row.redeemed_at)} ${formatTime12h(row.redeemed_at)}`
                              : "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <p className="text-sm text-zinc-200">{row.guest_name || "—"}</p>
                          <p className="text-xs text-zinc-500">{row.guest_email || ""}</p>
                          <p className="text-xs font-mono text-zinc-400 mt-1">
                            ****{row.code_last4 || "————"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 align-top text-xs text-emerald-600 space-y-0.5">
                          <p>Ticket {formatMoney(row.ticket_amount || 0)}</p>
                          <p>
                            Commission −{formatMoney(row.commission_total || 0)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 align-top text-xs space-y-0.5 text-emerald-600">
                          <p className="font-semibold">
                            GC {formatMoney(row.gift_card_amount)}
                          </p>
                          <p className="text-emerald-600/80">Cash {formatMoney(row.grand_total || 0)}</p>
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <p className="font-bold text-emerald-600 tabular-nums">
                            {formatMoney(row.organizer_payout || 0)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 align-top">
                          <AdminStatusBadge status={row.booking_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {eventMeta && <Pagination meta={eventMeta} onPageChange={setPage} />}
        </div>
      )}
    </div>
  );
}
