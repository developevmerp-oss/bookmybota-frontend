"use client";

import { useEffect, useState } from "react";
import { Gift, Loader2, Wallet } from "lucide-react";
import {
  useGetMerchantGiftCardRedemptionsQuery,
  type DiningGiftCardRedemptionRow,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDate, formatDateTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import Pagination from "@/components/Shared/Pagination";
import { extractApiError } from "@/lib/apiErrors";
import { PAGE_SIZE } from "@/lib/pagination";

const STATUS_TABS = [
  { id: "", label: "All" },
  { id: "PENDING", label: "Pending" },
  { id: "APPROVED", label: "Approved" },
  { id: "PAID", label: "Paid" },
  { id: "CANCELLED", label: "Cancelled" },
] as const;

function statusBadge(status: string) {
  const s = String(status || "").toUpperCase();
  const cls =
    s === "PAID"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : s === "APPROVED"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
        : s === "CANCELLED"
          ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${cls}`}>
      {s || "—"}
    </span>
  );
}

export default function DiningSettlementsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const { data, isLoading, isError, error, isFetching } = useGetMerchantGiftCardRedemptionsQuery(
    {
      page,
      limit: PAGE_SIZE,
      ...(status ? { status } : {}),
    },
    { skip: !user?.business_id }
  );

  if (!user?.business_id) return null;

  const items: DiningGiftCardRedemptionRow[] = data?.data ?? data?.items ?? [];
  const summary = data?.summary;
  const meta = data?.meta;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Wallet size={24} className="text-rose-500" />
          Gift card settlements
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Amounts BookMyBota owes your restaurant after POS gift-card redemptions. Super Admin
          approves and marks paid under Partner Payouts → Dining.
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel rounded-xl border border-white/5 p-4">
            <p className="text-xs text-zinc-500 uppercase font-semibold">Pending payout</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {formatMoney(summary.pending_amount)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">{summary.pending_count} redemption(s)</p>
          </div>
          <div className="glass-panel rounded-xl border border-white/5 p-4">
            <p className="text-xs text-zinc-500 uppercase font-semibold">Approved</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {formatMoney(summary.approved_amount)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">{summary.approved_count} redemption(s)</p>
          </div>
          <div className="glass-panel rounded-xl border border-white/5 p-4">
            <p className="text-xs text-zinc-500 uppercase font-semibold">Paid to you</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {formatMoney(summary.paid_amount)}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">{summary.paid_count} redemption(s)</p>
          </div>
          <div className="glass-panel rounded-xl border border-white/5 p-4">
            <p className="text-xs text-zinc-500 uppercase font-semibold">Cancelled</p>
            <p className="text-2xl font-bold text-zinc-300 mt-1">{summary.cancelled_count}</p>
            <p className="text-[11px] text-zinc-500 mt-1">Balance restored to guest</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id || "all"}
            type="button"
            onClick={() => {
              setStatus(tab.id);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              status === tab.id
                ? "bg-rose-600 text-white"
                : "bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
        {isFetching && !isLoading && <Loader2 size={14} className="animate-spin text-zinc-500 self-center" />}
      </div>

      <div className="glass-panel rounded-xl border border-white/5 overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <Gift size={18} className="text-rose-500" />
          <h3 className="text-white font-semibold">Redemptions & payout status</h3>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-zinc-500">
            <Loader2 className="animate-spin inline mr-2" size={16} /> Loading settlements…
          </div>
        ) : isError ? (
          <p className="px-5 py-10 text-center text-rose-400 text-sm">
            {extractApiError(error, "Failed to load settlements.")}
          </p>
        ) : items.length === 0 ? (
          <p className="px-5 py-10 text-center text-zinc-500 text-sm">
            No gift-card redemptions yet. Redeem a card on Scan guest QR to create a payable entry.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3 font-semibold">Redeemed</th>
                    <th className="px-4 py-3 font-semibold">Card / guest</th>
                    <th className="px-4 py-3 font-semibold text-right">Bill</th>
                    <th className="px-4 py-3 font-semibold text-right">GC used</th>
                    <th className="px-4 py-3 font-semibold text-right">Guest paid</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Paid ref</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                        {row.redeemed_at ? formatDateTime12h(row.redeemed_at) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-white font-semibold">
                          ****{row.code_last4}
                          {row.product_name ? (
                            <span className="text-zinc-500 font-normal"> · {row.product_name}</span>
                          ) : null}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {row.guest_name || "Guest"}
                          {row.guest_phone ? ` · ${row.guest_phone}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600">
                        {formatMoney(row.bill_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                        {formatMoney(row.settlement_amount ?? row.gift_card_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600">
                        {formatMoney(row.customer_payable)}
                      </td>
                      <td className="px-4 py-3">{statusBadge(row.settlement_status)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {row.payment_reference || (row.settled_at ? formatDate(row.settled_at) : "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && (
              <div className="px-4 py-3 border-t border-white/5">
                <Pagination
                  meta={{
                    page: meta.page || page,
                    limit: meta.limit || PAGE_SIZE,
                    total: meta.total || 0,
                    total_pages: Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || PAGE_SIZE))),
                    has_prev: (meta.page || page) > 1,
                    has_next:
                      (meta.page || page) <
                      Math.max(1, Math.ceil((meta.total || 0) / (meta.limit || PAGE_SIZE))),
                  }}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
