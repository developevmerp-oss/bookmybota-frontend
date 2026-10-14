"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  useGetMerchantGiftCardRedemptionsQuery,
  type DiningGiftCardRedemptionRow,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDate, formatDateTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
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
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : s === "APPROVED"
        ? "border-sky-100 bg-sky-50 text-sky-700"
        : s === "CANCELLED"
          ? "border-rose-100 bg-rose-50 text-rose-600"
          : "border-amber-100 bg-amber-50 text-amber-700";
  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${cls}`}
    >
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
    <div className="-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8 animate-fadeIn">
      <div className="max-w-6xl mx-auto space-y-6">
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold">Pending payout</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {formatMoney(summary.pending_amount)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">{summary.pending_count} redemption(s)</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold">Approved</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {formatMoney(summary.approved_amount)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">{summary.approved_count} redemption(s)</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold">Paid to you</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {formatMoney(summary.paid_amount)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">{summary.paid_count} redemption(s)</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold">Cancelled</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{summary.cancelled_count}</p>
              <p className="text-[11px] text-slate-500 mt-1">Balance restored to guest</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id || "all"}
              type="button"
              onClick={() => {
                setStatus(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                status === tab.id
                  ? "bg-rose-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-rose-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {isFetching && !isLoading && (
            <Loader2 size={14} className="animate-spin text-slate-400 self-center" />
          )}
        </div>

        {isLoading ? (
          <AdminListShimmer rows={6} columns={7} showTabs={false} showToolbar={false} showPagination />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {isError ? (
              <p className="px-5 py-10 text-center text-rose-600 text-sm">
                {extractApiError(error, "Failed to load settlements.")}
              </p>
            ) : items.length === 0 ? (
              <p className="px-5 py-10 text-center text-slate-500 text-sm">
                No gift-card redemptions yet. Redeem a card on Scan guest QR to create a payable
                entry.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[800px]">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Redeemed</th>
                        <th className="px-3 py-2.5 font-semibold">Card / guest</th>
                        <th className="px-3 py-2.5 font-semibold text-right">Bill</th>
                        <th className="px-3 py-2.5 font-semibold text-right">GC used</th>
                        <th className="px-3 py-2.5 font-semibold text-right">Guest paid</th>
                        <th className="px-3 py-2.5 font-semibold">Status</th>
                        <th className="px-3 py-2.5 font-semibold">Paid ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                            {row.redeemed_at ? formatDateTime12h(row.redeemed_at) : "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <p className="text-slate-900 font-semibold">
                              ****{row.code_last4}
                              {row.product_name ? (
                                <span className="text-slate-500 font-normal">
                                  {" "}
                                  · {row.product_name}
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs text-slate-500">
                              {row.guest_name || "Guest"}
                              {row.guest_phone ? ` · ${row.guest_phone}` : ""}
                            </p>
                          </td>
                          <td className="px-3 py-2.5 text-right text-emerald-700">
                            {formatMoney(row.bill_amount)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-emerald-700 font-semibold">
                            {formatMoney(row.settlement_amount ?? row.gift_card_amount)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-emerald-700">
                            {formatMoney(row.customer_payable)}
                          </td>
                          <td className="px-3 py-2.5">{statusBadge(row.settlement_status)}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">
                            {row.payment_reference ||
                              (row.settled_at ? formatDate(row.settled_at) : "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {meta && (
                  <div className="px-3 py-3 border-t border-slate-100">
                    <Pagination
                      meta={{
                        page: meta.page || page,
                        limit: meta.limit || PAGE_SIZE,
                        total: meta.total || 0,
                        total_pages: Math.max(
                          1,
                          Math.ceil((meta.total || 0) / (meta.limit || PAGE_SIZE))
                        ),
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
        )}
      </div>
    </div>
  );
}
