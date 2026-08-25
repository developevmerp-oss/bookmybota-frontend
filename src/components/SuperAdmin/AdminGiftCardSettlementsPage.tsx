"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  useGetAdminDiningGiftCardRedemptionsQuery,
  useGetBusinessesQuery,
  usePatchAdminDiningGiftCardSettlementMutation,
  type DiningGiftCardRedemptionRow,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatDate, formatTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";

type StatusTab = "ALL" | "PENDING" | "APPROVED" | "PAID" | "CANCELLED";

const TABS: { key: StatusTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAID", label: "Paid" },
  { key: "CANCELLED", label: "Cancelled" },
];

function statusBadge(status?: string) {
  const s = (status || "PENDING").toUpperCase();
  const colors: Record<string, string> = {
    PENDING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    APPROVED: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    PAID: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    CANCELLED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
        colors[s] || colors.PENDING
      }`}
    >
      {s}
    </span>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="glass-panel rounded-2xl border border-white/5 p-4">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
      <p className={`text-xl font-extrabold mt-1 ${accent || "text-white"}`}>{value}</p>
    </div>
  );
}

export default function AdminGiftCardSettlementsPage() {
  const [tab, setTab] = useState<StatusTab>("PENDING");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [businessId, setBusinessId] = useState("");
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: restaurants = [] } = useGetBusinessesQuery({ module: "dining" });
  const { data, isLoading, isError } = useGetAdminDiningGiftCardRedemptionsQuery({
    page,
    limit: PAGE_SIZE,
    ...(tab !== "ALL" ? { status: tab } : {}),
    ...(businessId ? { business_id: businessId } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const [patchSettlement] = usePatchAdminDiningGiftCardSettlementMutation();

  const rows = data?.items ?? [];
  const meta = data?.meta;
  const summary = data?.summary;

  const restaurantOptions = useMemo(
    () => [...restaurants].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [restaurants]
  );

  const updateStatus = async (
    row: DiningGiftCardRedemptionRow,
    settlement_status: string
  ) => {
    setBusyId(row.id);
    try {
      const res = await patchSettlement({
        id: row.id,
        settlement_status,
        settlement_notes: notesById[row.id]?.trim() || undefined,
      }).unwrap();
      toast.success(res.message || "Settlement updated");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update settlement"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Wallet className="text-violet-400" size={24} />
          Gift Card Settlements
        </h2>
        <p className="text-zinc-400 text-sm mt-1">
          Dining gift cards redeemed at restaurants. BookMyBota owes the restaurant the gift-card
          amount used — approve then mark paid after payout.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pending payable"
          value={formatMoney(summary?.pending_amount || 0)}
          accent="text-amber-300"
        />
        <StatCard
          label="Approved"
          value={formatMoney(summary?.approved_amount || 0)}
          accent="text-sky-300"
        />
        <StatCard
          label="Paid to restaurants"
          value={formatMoney(summary?.paid_amount || 0)}
          accent="text-emerald-300"
        />
        <StatCard
          label="Counts P / A / Paid"
          value={`${summary?.pending_count || 0} / ${summary?.approved_count || 0} / ${summary?.paid_count || 0}`}
          accent="text-violet-300"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide border transition-colors ${
              tab === t.key
                ? "bg-violet-600/30 border-violet-500/50 text-violet-200"
                : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1">
          <SearchInput
            value={q}
            onChange={(v) => {
              setQ(v);
              setPage(1);
            }}
            placeholder="Search restaurant, guest, last4…"
          />
        </div>
        <select
          value={businessId}
          onChange={(e) => {
            setBusinessId(e.target.value);
            setPage(1);
          }}
          className="bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white min-w-[220px]"
        >
          <option value="">All restaurants</option>
          {restaurantOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
            <Loader2 className="animate-spin" size={18} /> Loading settlements…
          </div>
        ) : isError ? (
          <p className="text-center text-rose-400 py-16">Could not load settlements.</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-zinc-500 py-16">No redemptions match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Restaurant</th>
                  <th className="px-4 py-3 font-semibold">Gift card</th>
                  <th className="px-4 py-3 font-semibold">Bill / GC / Guest pays</th>
                  <th className="px-4 py-3 font-semibold">Payable</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row) => {
                  const busy = busyId === row.id;
                  const isPaid = row.settlement_status === "PAID";
                  return (
                    <tr key={row.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 align-top">
                        <p className="font-semibold text-white">{row.business_name || "—"}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {row.redeemed_at
                            ? `${formatDate(row.redeemed_at)} ${formatTime12h(row.redeemed_at)}`
                            : "—"}
                        </p>
                        {(row.guest_name || row.guest_phone) && (
                          <p className="text-xs text-zinc-400 mt-1">
                            {[row.guest_name, row.guest_phone].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-white font-mono text-xs">****{row.code_last4}</p>
                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">
                          {row.product_name || "Gift Card"}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-zinc-300 space-y-0.5">
                        <p>Bill {formatMoney(row.bill_amount)}</p>
                        <p className="text-violet-300">GC −{formatMoney(row.gift_card_amount)}</p>
                        <p>Guest {formatMoney(row.customer_payable)}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="font-extrabold text-violet-300">
                          {formatMoney(row.settlement_amount ?? row.gift_card_amount)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {statusBadge(row.settlement_status)}
                        {row.settled_at && (
                          <p className="text-[10px] text-zinc-500 mt-1">
                            {formatDate(row.settled_at)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top min-w-[220px]">
                        <input
                          value={notesById[row.id] ?? row.settlement_notes ?? ""}
                          onChange={(e) =>
                            setNotesById((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                          disabled={isPaid}
                          placeholder="Settlement note / ref"
                          className="w-full mb-2 bg-zinc-900/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {row.settlement_status === "PENDING" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void updateStatus(row, "APPROVED")}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-600/80 hover:bg-sky-500 text-white disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}
                          {(row.settlement_status === "PENDING" ||
                            row.settlement_status === "APPROVED") && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void updateStatus(row, "PAID")}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600/80 hover:bg-emerald-500 text-white disabled:opacity-50"
                            >
                              {busy ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={12} />
                              )}
                              Mark paid
                            </button>
                          )}
                          {row.settlement_status !== "PAID" &&
                            row.settlement_status !== "CANCELLED" && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void updateStatus(row, "CANCELLED")}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            )}
                          {row.settlement_status === "CANCELLED" && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void updateStatus(row, "PENDING")}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/15 text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                            >
                              Reopen
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {meta && <Pagination meta={meta} onPageChange={setPage} />}
    </div>
  );
}
