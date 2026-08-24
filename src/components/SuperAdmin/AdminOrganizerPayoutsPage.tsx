"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Banknote, Loader2, Plus } from "lucide-react";
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
import {
  adminPayoutSchema,
  type AdminPayoutValues,
} from "@/lib/adminFormSchemas";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { PAGE_SIZE } from "@/lib/pagination";

const money = formatMoney;

const EMPTY_FORM: AdminPayoutValues = {
  business_id: "",
  event_id: "",
  amount: undefined as unknown as number,
  status: "PAID",
  payment_reference: "",
  notes: "",
};

export default function AdminOrganizerPayoutsPage() {
  const [organizerFilter, setOrganizerFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data: organizers = [] } = useGetBusinessesQuery({ module: "event" });
  const { data: eventsData } = useGetAdminEventsQuery();
  const events = eventsData?.items ?? [];
  const { data: payoutsData, isLoading, isFetching } = useGetOrganizerPayoutsQuery({
    page,
    limit,
    ...(organizerFilter ? { business_id: organizerFilter } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const payouts = payoutsData?.items ?? [];
  const [createPayout, { isLoading: saving }] = useCreateOrganizerPayoutMutation();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AdminPayoutValues>({
    resolver: yupResolver(adminPayoutSchema),
    defaultValues: EMPTY_FORM,
    mode: "onSubmit",
  });

  const businessId = watch("business_id");

  const organizerEvents = useMemo(() => {
    if (!businessId) return [];
    return events.filter((e) => e.business_id === businessId);
  }, [events, businessId]);

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

  const onValid = async (values: AdminPayoutValues) => {
    try {
      const created = await createPayout({
        business_id: values.business_id,
        event_id: values.event_id || undefined,
        amount: values.amount,
        status: values.status,
        payment_reference: values.payment_reference?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
      }).unwrap();
      toast.success(
        (created as { message?: string }).message || "Payout recorded."
      );
      reset(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to record payout"));
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="admin-list-toolbar">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors"
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
          onSubmit={handleSubmit(onValid)}
          noValidate
          className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-white">New payout</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Event organizer *</label>
              <select
                {...register("business_id", {
                  onChange: () => setValue("event_id", ""),
                })}
                className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">Select organizer</option>
                {organizers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              {errors.business_id && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">
                  {errors.business_id.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Event (optional)</label>
              <select
                {...register("event_id")}
                className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                disabled={!businessId}
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
                {...register("amount", { valueAsNumber: true })}
                className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
              {errors.amount && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">{errors.amount.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Status</label>
              <select
                {...register("status")}
                className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
              </select>
              {errors.status && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">{errors.status.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Payment reference</label>
              <input
                type="text"
                {...register("payment_reference")}
                placeholder="UTR / transaction ID"
                className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Notes</label>
              <input
                type="text"
                {...register("notes")}
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

      <div className="glass-panel rounded-2xl border border-white/5 p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs text-zinc-500 mb-1">Filter by organizer</label>
          <select
            value={organizerFilter}
            onChange={(e) => {
              setOrganizerFilter(e.target.value);
              setPage(1);
            }}
            className="bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm w-full max-w-md"
          >
            <option value="">All organizers</option>
            {organizers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search organizer or event"
        />
      </div>

      {isLoading || isFetching ? (
        <AdminListShimmer
          rows={isLoading ? 6 : limit > 10 ? 8 : 5}
          columns={6}
          showTabs={false}
          showToolbar={false}
        />
      ) : payouts.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/5 px-6 py-10 text-center text-zinc-500">
          No payouts recorded yet.
        </div>
      ) : (
        <>
          <div className="admin-card-grid">
            {payouts.map((p) => (
              <article key={p.id} className="admin-data-card">
                <div className="admin-data-card-header">
                  <p className="admin-data-card-title">{p.organizer_name || "—"}</p>
                </div>
                <div className="admin-data-card-body">
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Date</span>
                    <div className="admin-data-card-value">
                      {formatDate(p.paid_at || p.created_at)}
                    </div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Event</span>
                    <div className="admin-data-card-value">{p.event_name || "General"}</div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Amount</span>
                    <div className="admin-data-card-value font-semibold text-emerald-400 inline-flex items-center gap-1">
                      <Banknote size={14} />
                      {money(p.amount)}
                    </div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Status</span>
                    <div className="admin-data-card-value">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          p.status === "PAID"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Reference</span>
                    <div className="admin-data-card-value">{p.payment_reference || "—"}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="admin-table-desktop glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
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
                  {payouts.map((p) => (
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <div className="admin-list-footer">
        <Pagination
          meta={
            payoutsData?.meta ?? {
              page,
              limit,
              total: 0,
              total_pages: 0,
              has_prev: false,
              has_next: false,
            }
          }
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
          disabled={isFetching}
        />
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
