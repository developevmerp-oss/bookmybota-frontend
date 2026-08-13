"use client";

import { useMemo, useState } from "react";
import { Banknote, Loader2, Plus, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateOrganizerPayoutMutation,
  useGetAdminEventsQuery,
  useGetBusinessesQuery,
  useGetOrganizerPayoutsQuery,
} from "@/services/api";
import { formatDate } from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";
import { formatMoney } from "@/lib/currencyFormat";

const money = formatMoney;

const EMPTY_FORM = {
  business_id: "",
  event_id: "",
  amount: "",
  status: "PAID" as "PAID" | "PENDING",
  payment_reference: "",
  notes: "",
};

export default function AdminOrganizerPayoutsPage() {
  const [organizerFilter, setOrganizerFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: organizers = [] } = useGetBusinessesQuery({ module: "event" });
  const { data: events = [] } = useGetAdminEventsQuery();
  const { data: payouts = [], isLoading } = useGetOrganizerPayoutsQuery(
    organizerFilter ? { business_id: organizerFilter } : undefined
  );
  const [createPayout, { isLoading: saving }] = useCreateOrganizerPayoutMutation();

  const organizerEvents = useMemo(() => {
    if (!form.business_id) return [];
    return events.filter((e) => e.business_id === form.business_id);
  }, [events, form.business_id]);

  const stats = useMemo(() => {
    const paid = payouts
      .filter((p) => p.status === "PAID")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const pending = payouts
      .filter((p) => p.status === "PENDING")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    return {
      total: payouts.length,
      paid,
      pending,
      paidCount: payouts.filter((p) => p.status === "PAID").length,
      pendingCount: payouts.filter((p) => p.status === "PENDING").length,
    };
  }, [payouts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.business_id) {
      toast.error("Select an event organizer.");
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    try {
      await createPayout({
        business_id: form.business_id,
        event_id: form.event_id || undefined,
        amount,
        status: form.status,
        payment_reference: form.payment_reference.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }).unwrap();
      toast.success("Payout recorded.");
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to record payout"));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="text-rose-400" size={24} />
            Organizer Payouts
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            Record payments to event organizers from ticket revenue. Organizers see these in their Ledger.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors"
        >
          <Plus size={16} />
          Record payout
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total payouts" value={String(stats.total)} />
        <StatCard label="Paid amount" value={money(stats.paid)} accent="text-emerald-400" />
        <StatCard label="Pending amount" value={money(stats.pending)} accent="text-amber-400" />
        <StatCard
          label="Paid / Pending"
          value={`${stats.paidCount} / ${stats.pendingCount}`}
          accent="text-violet-400"
        />
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">New payout</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Event organizer *</label>
              <select
                value={form.business_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, business_id: e.target.value, event_id: "" }))
                }
                className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                required
              >
                <option value="">Select organizer</option>
                {organizers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Event (optional)</label>
              <select
                value={form.event_id}
                onChange={(e) => setForm((f) => ({ ...f, event_id: e.target.value }))}
                className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                disabled={!form.business_id}
              >
                <option value="">General payout</option>
                {organizerEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.status})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Amount (ETB) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as "PAID" | "PENDING" }))
                }
                className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Payment reference</label>
              <input
                type="text"
                value={form.payment_reference}
                onChange={(e) => setForm((f) => ({ ...f, payment_reference: e.target.value }))}
                placeholder="UTR / transaction ID"
                className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="inline animate-spin mr-1" size={14} /> Saving...
                </>
              ) : (
                "Save payout"
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="glass-panel rounded-2xl border border-white/5 p-4">
        <label className="block text-xs text-zinc-500 mb-1">Filter by organizer</label>
        <select
          value={organizerFilter}
          onChange={(e) => setOrganizerFilter(e.target.value)}
          className="bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm max-w-md"
        >
          <option value="">All organizers</option>
          {organizers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-x-auto">
        {isLoading ? (
          <div className="text-center py-12 text-zinc-400">
            <Loader2 className="inline animate-spin mr-2" size={18} />
            Loading payouts...
          </div>
        ) : (
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400 text-sm">
              <tr>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Organizer</th>
                <th className="px-6 py-4 font-medium">Event</th>
                <th className="px-6 py-4 font-medium text-right">Amount</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                    No payouts recorded yet.
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-6 py-4 text-zinc-300">
                      {formatDate(p.paid_at || p.created_at)}
                    </td>
                    <td className="px-6 py-4 text-white">{p.organizer_name || "—"}</td>
                    <td className="px-6 py-4 text-zinc-400">{p.event_name || "General"}</td>
                    <td className="px-6 py-4 text-right font-semibold text-emerald-400">
                      <span className="inline-flex items-center justify-end gap-1">
                        <Banknote size={14} />
                        {money(p.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          p.status === "PAID"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">{p.payment_reference || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "text-white",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="glass-panel rounded-2xl border border-white/5 p-4">
      <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
    </div>
  );
}
