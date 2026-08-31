"use client";

import { useEffect, useState } from "react";
import { Loader2, Tag, Receipt } from "lucide-react";
import { useGetMerchantOfferRedemptionsQuery } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDate, formatTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { extractApiError } from "@/lib/apiErrors";
import { PAGE_SIZE } from "@/lib/pagination";

export default function DiningOfferRedemptionsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const { data, isLoading, isError, error } = useGetMerchantOfferRedemptionsQuery(
    { page, limit: PAGE_SIZE, ...(q.trim() ? { q: q.trim() } : {}) },
    { skip: !user?.business_id }
  );

  if (!user?.business_id) return null;

  const items = data?.items ?? [];
  const summary = data?.summary;
  const byOffer = data?.by_offer ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Tag size={24} className="text-rose-500" />
            Offer Redemptions
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Merchant promo codes redeemed at your restaurant (bookings + walk-ins).
          </p>
        </div>
        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search code, guest, offer..."
        />
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel rounded-xl border border-white/5 p-4">
            <p className="text-xs text-zinc-500 uppercase font-semibold">Total</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.total_redemptions ?? 0}</p>
          </div>
          <div className="glass-panel rounded-xl border border-white/5 p-4">
            <p className="text-xs text-zinc-500 uppercase font-semibold">From bookings</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.booking_redemptions ?? 0}</p>
          </div>
          <div className="glass-panel rounded-xl border border-white/5 p-4">
            <p className="text-xs text-zinc-500 uppercase font-semibold">Walk-in</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.walk_in_redemptions ?? 0}</p>
          </div>
          <div className="glass-panel rounded-xl border border-white/5 p-4">
            <p className="text-xs text-zinc-500 uppercase font-semibold">Bill total recorded</p>
            <p className="text-lg font-bold text-white mt-1">
              {formatMoney(summary.total_bill_amount, { compact: true })}
            </p>
          </div>
        </div>
      )}

      {byOffer.length > 0 && (
        <div className="glass-panel rounded-2xl border border-white/5 p-5">
          <h3 className="text-sm font-bold text-white mb-3">Top offers</h3>
          <div className="flex flex-wrap gap-2">
            {byOffer.map((row) => (
              <span
                key={`${row.promo_code}-${row.offer_title}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-300"
              >
                <span className="font-mono text-rose-400">{row.promo_code}</span>
                <span>{row.redemption_count}×</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/5">
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase">When</th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Code / Offer</th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase hidden md:table-cell">Guest</th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase hidden lg:table-cell">Source</th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase text-right">Bill</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-zinc-400">
                  <Loader2 className="animate-spin inline mr-2" size={18} />
                  Loading redemptions…
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-rose-400">
                  {extractApiError(error, "Could not load offer redemptions.")}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-zinc-500">
                  <Receipt className="inline mr-2 opacity-50" size={18} />
                  No redemptions yet. Redeem offers from Scan QR or walk-in promo.
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4 text-sm text-zinc-300">
                    {formatDate(row.redeemed_at)}
                    <span className="block text-xs text-zinc-500">{formatTime12h(row.redeemed_at)}</span>
                  </td>
                  <td className="p-4">
                    <p className="font-mono text-sm text-rose-400">{row.promo_code}</p>
                    <p className="text-xs text-zinc-500">{row.offer_title}</p>
                  </td>
                  <td className="p-4 hidden md:table-cell text-sm text-zinc-300">
                    {row.guest_name || row.guest_phone || "—"}
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        row.redemption_source === "walk_in"
                          ? "bg-violet-500/15 text-violet-300"
                          : "bg-sky-500/15 text-sky-300"
                      }`}
                    >
                      {row.redemption_source === "walk_in" ? "Walk-in" : "Booking"}
                    </span>
                  </td>
                  <td className="p-4 text-right text-sm text-zinc-300">
                    {row.bill_amount != null && Number(row.bill_amount) > 0
                      ? formatMoney(row.bill_amount, { compact: true })
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {data?.meta && <Pagination meta={data.meta} onPageChange={setPage} />}
      </div>
    </div>
  );
}
