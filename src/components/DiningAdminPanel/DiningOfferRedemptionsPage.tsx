"use client";

import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { useGetMerchantOfferRedemptionsQuery } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDateCustomer, formatTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
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
    <div className="-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8 animate-fadeIn">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search code, guest, offer..."
            className="w-full sm:w-72"
          />
        </div>

        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold">Total</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.total_redemptions ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold">From bookings</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.booking_redemptions ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold">Walk-in</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.walk_in_redemptions ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold">Bill total recorded</p>
              <p className="text-lg font-bold text-slate-900 mt-1">
                {formatMoney(summary.total_bill_amount, { compact: true })}
              </p>
            </div>
          </div>
        )}

        {byOffer.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Top offers</h3>
            <div className="flex flex-wrap gap-2">
              {byOffer.map((row) => (
                <span
                  key={`${row.promo_code}-${row.offer_title}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-600"
                >
                  <span className="font-mono text-[#e11d48]">{row.promo_code}</span>
                  <span>{row.redemption_count}×</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <AdminListShimmer rows={6} columns={5} showTabs={false} showToolbar={false} showPagination />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">When</th>
                  <th className="px-3 py-2.5 font-semibold">Code / Offer</th>
                  <th className="px-3 py-2.5 font-semibold hidden md:table-cell">Guest</th>
                  <th className="px-3 py-2.5 font-semibold hidden lg:table-cell">Source</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Bill</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isError ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-rose-600">
                      {extractApiError(error, "Could not load offer redemptions.")}
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      <Receipt className="inline mr-2 opacity-50" size={18} />
                      No redemptions yet. Redeem offers from Scan QR or walk-in promo.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-2.5 text-sm text-slate-700">
                        {formatDateCustomer(row.redeemed_at)}
                        <span className="block text-xs text-slate-500 font-medium mt-0.5">
                          {formatTime12h(row.redeemed_at)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-mono text-sm text-[#e11d48]">{row.promo_code}</p>
                        <p className="text-xs text-slate-500">{row.offer_title}</p>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell text-sm text-slate-700">
                        {row.guest_name || row.guest_phone || "—"}
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                            row.redemption_source === "walk_in"
                              ? "bg-violet-50 text-violet-700 border border-violet-100"
                              : "bg-sky-50 text-sky-700 border border-sky-100"
                          }`}
                        >
                          {row.redemption_source === "walk_in" ? "Walk-in" : "Booking"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-slate-700">
                        {row.bill_amount != null && Number(row.bill_amount) > 0
                          ? formatMoney(row.bill_amount, { compact: true })
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
            {data?.meta && (
              <div className="px-3 py-3 border-t border-slate-100">
                <Pagination meta={data.meta} onPageChange={setPage} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
