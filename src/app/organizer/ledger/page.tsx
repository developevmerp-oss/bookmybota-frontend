"use client";

import { useState } from "react";
import { IndianRupee, Loader2, Wallet } from "lucide-react";
import { useGetOrganizerEventsQuery, useGetOrganizerLedgerQuery } from "@/services/api";
import { formatDate } from "@/lib/dateFormat";

function money(v: number | string | undefined) {
  return `₹${Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function OrganizerLedgerPage() {
  const [eventFilter, setEventFilter] = useState("");
  const { data: events = [] } = useGetOrganizerEventsQuery();
  const { data, isLoading } = useGetOrganizerLedgerQuery(
    eventFilter ? { event_id: eventFilter } : undefined
  );

  const summary = data?.summary;
  const rows = data?.rows || [];
  const payouts = data?.recent_payouts || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="portal-heading text-2xl font-bold flex items-center gap-2">
          <Wallet className="text-violet-500" /> Revenue Ledger
        </h2>
        <p className="portal-muted text-sm mt-1">
          Ticket revenue, platform commission, your earnings, and payouts from Super Admin.
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-4">
        <label className="portal-label text-xs font-bold uppercase tracking-wider mb-1.5 block">
          Filter by event
        </label>
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="portal-select max-w-md"
        >
          <option value="">All events</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 portal-muted">
          <Loader2 className="animate-spin inline mr-2" size={18} /> Loading ledger...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Ticket sales" value={money(summary?.ticket_amount)} />
            <StatCard label="Commission deducted" value={money(summary?.commission_total)} accent="text-amber-600" />
            <StatCard label="Your earnings" value={money(summary?.organizer_earned)} accent="text-emerald-600" />
            <StatCard label="Paid by admin" value={money(summary?.total_paid)} accent="text-violet-600" />
            <StatCard label="Pending payout" value={money(summary?.pending_amount)} accent="text-rose-600" />
            <StatCard label="Bookings" value={String(summary?.bookings_count ?? 0)} />
            <StatCard label="Tickets sold" value={String(summary?.tickets_sold ?? 0)} />
            <StatCard
              label="Admin pending payments"
              value={money(summary?.admin_pending_payments)}
              accent="text-slate-600"
            />
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="portal-heading font-semibold">By event</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="portal-table-head text-left px-4 py-3">Event</th>
                    <th className="portal-table-head text-right px-4 py-3">Tickets</th>
                    <th className="portal-table-head text-right px-4 py-3">Sales</th>
                    <th className="portal-table-head text-right px-4 py-3">Commission</th>
                    <th className="portal-table-head text-right px-4 py-3">Earned</th>
                    <th className="portal-table-head text-right px-4 py-3">Paid</th>
                    <th className="portal-table-head text-right px-4 py-3">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center portal-muted">
                        No ticket sales recorded yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.event_id} className="border-b border-slate-50">
                        <td className="portal-table-strong px-4 py-3">
                          {row.event_name}
                          <span className="block text-[10px] font-normal portal-muted">
                            {row.event_status}
                          </span>
                        </td>
                        <td className="portal-table-cell px-4 py-3 text-right">{row.tickets_sold}</td>
                        <td className="portal-table-cell px-4 py-3 text-right">{money(row.ticket_amount)}</td>
                        <td className="portal-table-cell px-4 py-3 text-right">{money(row.commission_total)}</td>
                        <td className="portal-table-cell px-4 py-3 text-right font-semibold">
                          {money(row.organizer_earned)}
                        </td>
                        <td className="portal-table-cell px-4 py-3 text-right text-violet-700">
                          {money(row.paid_amount)}
                        </td>
                        <td className="portal-table-cell px-4 py-3 text-right text-rose-600 font-semibold">
                          {money(row.pending_amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <h3 className="portal-heading font-semibold mb-4 flex items-center gap-2">
              <IndianRupee size={18} /> Recent payouts from Super Admin
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
    <div className="glass-panel rounded-2xl p-4">
      <p className="portal-stat-label text-xs uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent}`}>{value}</p>
    </div>
  );
}
