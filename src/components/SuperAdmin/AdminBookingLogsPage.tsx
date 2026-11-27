"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import { useGetAdminBookingLogsQuery } from "@/services/api";
import { formatDateTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { AdminEmptyState, AdminStatusBadge } from "@/components/SuperAdmin/AdminFinanceChrome";

const TYPES = [
  { id: "", label: "All" },
  { id: "event", label: "Events" },
  { id: "movie", label: "Movies" },
  { id: "dining", label: "Dining" },
];

const typeBadge: Record<string, string> = {
  event: "bg-violet-100 text-violet-800 border-violet-300",
  movie: "bg-sky-100 text-sky-800 border-sky-300",
  dining: "bg-amber-100 text-amber-900 border-amber-300",
};

/** Every booking a customer makes (events, movies, dining), newest first. */
export default function AdminBookingLogsPage() {
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const { data, isFetching } = useGetAdminBookingLogsQuery({ page, limit: 25, q: q || undefined, type: type || undefined, from: from || undefined, to: to || undefined });
  const rows = data?.items || [];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">Booking Logs</h1>
        <p className="text-sm text-slate-500">Every booking made by customers: events, movies and dining. {data ? `${data.summary.total} bookings` : ""}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-xl border border-slate-300 p-1">
          {TYPES.map((t) => (
            <button key={t.id} type="button" onClick={() => { setType(t.id); setPage(1); }} className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold ${type === t.id ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="min-w-[14rem] flex-1">
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search customer, phone, event, movie, restaurant, booking id…" />
        </div>
        <label className="text-xs text-slate-500">From<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-transparent px-2 py-1.5 text-sm text-slate-800" /></label>
        <label className="text-xs text-slate-500">To<input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="mt-1 block rounded-lg border border-slate-300 bg-transparent px-2 py-1.5 text-sm text-slate-800" /></label>
      </div>

      {isFetching && !data ? (
        <AdminListShimmer />
      ) : rows.length === 0 ? (
        <AdminEmptyState icon={ScrollText} title="No bookings found" description="Bookings customers make will appear here." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-300">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Booked</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime12h(r.created_at)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold capitalize ${typeBadge[r.type] || ""}`}>{r.type}</span></td>
                  <td className="px-4 py-3"><p className="font-semibold">{r.customer_name}</p><p className="text-xs text-slate-500">{[r.customer_phone, r.customer_email].filter(Boolean).join(" · ")}</p></td>
                  <td className="px-4 py-3"><p className="font-semibold">{r.item}</p><p className="text-xs text-slate-500">{r.partner || ""}</p></td>
                  <td className="max-w-[16rem] px-4 py-3 text-slate-600">{r.detail || ""}</td>
                  <td className="px-4 py-3 text-right">{r.qty ?? ""}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold">{r.amount == null ? "-" : formatMoney(r.amount)}</td>
                  <td className="px-4 py-3"><AdminStatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.meta ? <Pagination meta={data.meta} onPageChange={setPage} /> : null}
    </div>
  );
}
