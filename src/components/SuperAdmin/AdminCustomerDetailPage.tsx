"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle, Pencil, XCircle } from "lucide-react";
import { useGetAdminCustomerQuery } from "@/services/api";

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      <p className="text-white text-sm leading-relaxed">
        {value === 0 || value ? String(value) : "—"}
      </p>
    </div>
  );
}

export default function AdminCustomerDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const { data: c, isLoading } = useGetAdminCustomerQuery(id, { skip: !id });

  if (isLoading) {
    return <div className="text-white p-10 text-center">Loading customer...</div>;
  }

  if (!c) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400 mb-4">Customer not found.</p>
        <Link href="/admin/customers" className="text-rose-500 hover:text-rose-400">
          Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-white"
      >
        <ArrowLeft size={16} /> Back to customers
      </Link>

      <div className="glass-panel rounded-2xl border border-white/10 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {c.is_enabled ? (
                <span className="flex items-center gap-1 text-green-400 text-sm">
                  <CheckCircle size={14} /> Enabled
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400 text-sm">
                  <XCircle size={14} /> Disabled
                </span>
              )}
              <span className="text-xs text-zinc-500">
                {c.is_registered_user ? "Registered" : "Guest"}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white">{c.name}</h1>
          </div>
          <Link
            href={`/admin/customers/${c.id}/edit`}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Pencil size={16} /> Edit
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Field label="Phone" value={c.phone} />
          <Field label="Email" value={c.user_email || c.email} />
          <Field label="Dining bookings" value={c.dining_bookings_count} />
          <Field label="Event bookings" value={c.event_bookings_count} />
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <h2 className="text-lg font-semibold text-white px-6 py-4 border-b border-white/5">Dining bookings</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-400 bg-zinc-900/40">
            <tr>
              <th className="px-6 py-3">Venue</th>
              <th className="px-6 py-3">Time</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Guests</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-zinc-300">
            {(c.dining_bookings || []).map((b) => (
              <tr key={b.id}>
                <td className="px-6 py-3">{b.venue_name || "—"}</td>
                <td className="px-6 py-3">{b.booking_time ? new Date(b.booking_time).toLocaleString() : "—"}</td>
                <td className="px-6 py-3">{b.status}</td>
                <td className="px-6 py-3">{b.guests ?? "—"}</td>
              </tr>
            ))}
            {(!c.dining_bookings || c.dining_bookings.length === 0) && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                  No dining bookings.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <h2 className="text-lg font-semibold text-white px-6 py-4 border-b border-white/5">Event bookings</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-400 bg-zinc-900/40">
            <tr>
              <th className="px-6 py-3">Event</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Tickets</th>
              <th className="px-6 py-3">Total</th>
              <th className="px-6 py-3">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-zinc-300">
            {(c.event_bookings || []).map((b) => (
              <tr key={b.id}>
                <td className="px-6 py-3">{b.event_name || "—"}</td>
                <td className="px-6 py-3">{b.status}</td>
                <td className="px-6 py-3">{b.ticket_qty ?? "—"}</td>
                <td className="px-6 py-3">{b.grand_total != null ? String(b.grand_total) : "—"}</td>
                <td className="px-6 py-3">{b.created_at ? new Date(b.created_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
            {(!c.event_bookings || c.event_bookings.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                  No event bookings.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
