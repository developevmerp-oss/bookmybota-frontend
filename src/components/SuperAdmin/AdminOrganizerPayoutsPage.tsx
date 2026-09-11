"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Film,
  Loader2,
  Plus,
  Store,
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import * as yup from "yup";
import {
  useCreateOrganizerPayoutMutation,
  useGenerateOrganizerSettlementMutation,
  useGenerateAdminCinemaSettlementMutation,
  useGetAdminBusinessesQuery,
  useGetAdminCinemaSettlementQuery,
  useGetAdminCinemaSettlementsPendingQuery,
  useGetAdminCinemaSettlementsQuery,
  useGetAdminDiningGiftCardRedemptionsQuery,
  useGetOrganizerPayoutsQuery,
  useGetOrganizerSettlementQuery,
  useGetOrganizerSettlementsQuery,
  useGetPendingOrganizerSettlementsQuery,
  usePatchAdminCinemaSettlementMutation,
  usePatchAdminDiningGiftCardSettlementMutation,
  usePatchOrganizerSettlementMutation,
  type DiningGiftCardRedemptionRow,
  type OrganizerSettlementRun,
} from "@/services/api";
import { formatDate, formatTime12h, toDateOnlyParam } from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";
import { formatMoney } from "@/lib/currencyFormat";
import {
  adminPayoutSchema,
  adminSettlementNotesSchema,
  type AdminPayoutValues,
  type AdminSettlementNotesValues,
} from "@/lib/adminFormSchemas";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  AdminCallout,
  AdminEmptyState,
  AdminFilterBar,
  AdminSegmentedTabs,
  AdminStatCard,
  AdminStatusBadge,
  adminFinancePageClass,
} from "@/components/SuperAdmin/AdminFinanceChrome";

const money = formatMoney;

type PageTab = "events" | "movies" | "dining" | "history";
type EventsWorkspace = "queue" | "runs";
type MoviesWorkspace = "queue" | "runs";
type DiningStatusTab = "ALL" | "PENDING" | "APPROVED" | "PAID" | "CANCELLED";

type CinemaPendingRow = {
  business_id: string;
  cinema_name?: string;
  booking_count?: number;
  gross_ticket?: number;
  commission_total?: number;
  cinema_payable?: number;
  gift_card_amount?: number;
};

type CinemaSettlementLine = {
  id: string;
  movie_title?: string | null;
  guest_name?: string | null;
  booking_code?: string | null;
  ticket_amount?: number;
  commission_total?: number;
  gift_card_amount?: number;
  cash_amount?: number;
  cinema_payable?: number;
};

type CinemaSettlementRun = {
  id: string;
  business_id: string;
  cinema_name?: string;
  status?: string;
  booking_count?: number;
  gross_ticket?: number;
  commission_total?: number;
  cinema_payable?: number;
  gift_card_amount?: number;
  cash_amount?: number;
  notes?: string | null;
  created_at?: string;
  approved_at?: string | null;
  paid_at?: string | null;
  lines?: CinemaSettlementLine[];
};

const EMPTY_MANUAL: AdminPayoutValues = {
  business_id: "",
  event_id: "",
  amount: undefined as unknown as number,
  status: "PAID",
  payment_reference: "",
  notes: "",
};

const generateSchema = yup.object({
  business_id: yup.string().required("Select an organizer"),
  period_from: yup.string().optional(),
  period_to: yup.string().optional(),
  notes: yup.string().max(500).optional(),
});

type GenerateValues = yup.InferType<typeof generateSchema>;

const DINING_STATUS_TABS: { key: DiningStatusTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAID", label: "Paid" },
  { key: "CANCELLED", label: "Cancelled" },
];

const fieldErrorClass = "mt-1 text-[11px] font-semibold text-rose-400";

function statusBadge(status?: string) {
  return <AdminStatusBadge status={status} />;
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return <AdminStatCard label={label} value={value} hint={hint} accent={accent} />;
}

function FlowSteps() {
  const steps = ["Generate", "Approve", "Pay"];
  return (
    <div className="glass-panel rounded-2xl border border-white/5 p-4 h-full flex flex-col justify-center">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-3">
        Settlement flow
      </p>
      <div className="flex items-center gap-1.5 flex-wrap">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center size-6 rounded-full bg-rose-500/20 text-rose-400 text-[11px] font-bold">
              {i + 1}
            </span>
            <span className="text-xs font-semibold text-zinc-200">{step}</span>
            {i < steps.length - 1 ? (
              <ArrowRight size={12} className="text-zinc-600 mx-0.5" />
            ) : null}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500 mt-2.5">GC bookings included at full share</p>
    </div>
  );
}

function DiningSettlementRowActions({
  row,
  busy,
  onUpdate,
}: {
  row: DiningGiftCardRedemptionRow;
  busy: boolean;
  onUpdate: (
    row: DiningGiftCardRedemptionRow,
    status: string,
    notes: string,
    paymentReference: string
  ) => Promise<void>;
}) {
  const status = (row.settlement_status || "").toUpperCase();
  const isTerminal = status === "PAID" || status === "CANCELLED";
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminSettlementNotesValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(adminSettlementNotesSchema) as any,
    defaultValues: {
      notes: row.settlement_notes || "",
      payment_reference: row.payment_reference || "",
    },
    mode: "onSubmit",
  });

  const run = (nextStatus: string) =>
    handleSubmit(async (values) => {
      const notes = values.notes?.trim() || "";
      const paymentReference = values.payment_reference?.trim() || "";
      if (nextStatus === "PAID" && !paymentReference && !notes) {
        toast.error("Add a payment reference (or note) before marking paid");
        return;
      }
      if (nextStatus === "CANCELLED") {
        const ok = window.confirm(
          "Cancel this settlement? The guest gift-card balance will be restored and the restaurant will no longer be owed this amount."
        );
        if (!ok) return;
      }
      await onUpdate(row, nextStatus, notes, paymentReference);
    })();

  return (
    <td className="px-4 py-3 align-top min-w-[240px]">
      {!isTerminal ? (
        <>
          <input
            {...register("payment_reference")}
            disabled={busy}
            placeholder="Payment ref (required for Paid)"
            className="w-full mb-1 bg-zinc-900/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
          />
          {errors.payment_reference && (
            <p className={fieldErrorClass}>{errors.payment_reference.message}</p>
          )}
          <input
            {...register("notes")}
            disabled={busy}
            placeholder="Settlement note"
            className="w-full mb-1 bg-zinc-900/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white disabled:opacity-50"
          />
          {errors.notes && <p className={fieldErrorClass}>{errors.notes.message}</p>}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {status === "PENDING" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("APPROVED")}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-600/80 hover:bg-sky-500 text-white disabled:opacity-50"
              >
                Approve
              </button>
            )}
            {(status === "PENDING" || status === "APPROVED") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("PAID")}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-rose-600/80 hover:bg-rose-500 text-white disabled:opacity-50"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Mark paid
              </button>
            )}
            {(status === "PENDING" || status === "APPROVED") && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("CANCELLED")}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
              >
                Cancel &amp; restore
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="text-[11px] text-zinc-400 space-y-1">
          {row.payment_reference ? (
            <p>
              Ref: <span className="text-zinc-200 font-mono">{row.payment_reference}</span>
            </p>
          ) : null}
          {row.settlement_notes ? <p className="line-clamp-2">{row.settlement_notes}</p> : null}
          {row.settled_by_email ? <p>By {row.settled_by_email}</p> : null}
          {status === "CANCELLED" && row.balance_reversed_at ? (
            <p className="text-rose-300/90">Balance restored to guest</p>
          ) : null}
        </div>
      )}
    </td>
  );
}

function SettlementDetailPanel({
  runId,
  onClose,
}: {
  runId: string;
  onClose: () => void;
}) {
  const { data: run, isLoading } = useGetOrganizerSettlementQuery(runId);
  const [patchSettlement, { isLoading: patching }] =
    usePatchOrganizerSettlementMutation();
  const [paymentRef, setPaymentRef] = useState("");

  const act = async (status: "APPROVED" | "PAID" | "CANCELLED") => {
    if (status === "PAID" && !paymentRef.trim()) {
      toast.error("Add a payment reference before marking paid");
      return;
    }
    if (status === "CANCELLED") {
      const ok = window.confirm(
        "Cancel this settlement? Bookings will become unsettled and can enter a new run."
      );
      if (!ok) return;
    }
    try {
      const res = await patchSettlement({
        id: runId,
        status,
        payment_reference: paymentRef.trim() || undefined,
      }).unwrap();
      toast.success(res.message || "Settlement updated");
      if (status === "CANCELLED" || status === "PAID") onClose();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update settlement"));
    }
  };

  const status = (run?.status || "").toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-[2px]">
      <div className="glass-panel rounded-t-2xl sm:rounded-2xl border border-white/10 w-full max-w-4xl max-h-[92vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Settlement detail</h3>
          <p className="text-xs text-zinc-400 mt-1">
            Gift-card bookings are included at full organizer share (ticket − commission).
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-zinc-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5"
        >
          Close
        </button>
      </div>

      {isLoading || !run ? (
        <div className="flex items-center gap-2 py-10 text-zinc-400 justify-center">
          <Loader2 className="animate-spin" size={18} /> Loading…
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge(run.status)}
            <span className="text-sm text-white font-semibold">{run.organizer_name}</span>
            <span className="text-xs text-zinc-500">
              {formatDate(run.period_from)} – {formatDate(run.period_to)}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Gross tickets" value={money(run.gross_ticket)} accent="text-emerald-600" />
            <StatCard
              label="Commission"
              value={money(run.commission_total)}
              accent="text-emerald-600"
            />
            <StatCard
              label="Organizer payable"
              value={money(run.organizer_payable)}
              accent="text-emerald-600"
            />
            <StatCard
              label="GC funded (float)"
              value={money(run.gift_card_funded)}
              hint="Does not reduce payable"
              accent="text-emerald-600"
            />
            <StatCard
              label="Cash funded"
              value={money(run.cash_funded)}
              accent="text-emerald-600"
            />
          </div>

          {(status === "DRAFT" || status === "APPROVED") && (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1">
                <label className="block text-xs text-zinc-500 mb-1">
                  Payment reference (required for Mark paid)
                </label>
                <input
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="MOCK-BANK-REF or transfer id"
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {status === "DRAFT" && (
                  <button
                    type="button"
                    disabled={patching}
                    onClick={() => void act("APPROVED")}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-sky-600/80 hover:bg-sky-500 text-white disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                <button
                  type="button"
                  disabled={patching}
                  onClick={() => void act("PAID")}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600/80 hover:bg-rose-500 text-white disabled:opacity-50"
                >
                  {patching ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  Mark paid
                </button>
                <button
                  type="button"
                  disabled={patching}
                  onClick={() => void act("CANCELLED")}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {status === "PAID" && run.payment_reference ? (
            <p className="text-xs text-zinc-400">
              Paid ref:{" "}
              <span className="font-mono text-zinc-200">{run.payment_reference}</span>
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-left text-sm min-w-[720px]">
              <thead className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Event / Guest</th>
                  <th className="px-3 py-2.5 font-semibold">Ticket</th>
                  <th className="px-3 py-2.5 font-semibold">Commission</th>
                  <th className="px-3 py-2.5 font-semibold">GC / Cash</th>
                  <th className="px-3 py-2.5 font-semibold">Organizer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(run.lines || []).map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2.5">
                      <p className="text-white font-medium">{line.event_name || "—"}</p>
                      <p className="text-xs text-zinc-500">{line.guest_name || "—"}</p>
                    </td>
                    <td className="px-3 py-2.5 text-emerald-600">{money(line.ticket_amount)}</td>
                    <td className="px-3 py-2.5 text-emerald-600">
                      −{money(line.commission_total)}
                    </td>
                    <td className="px-3 py-2.5 text-xs space-y-0.5">
                      <p className="text-emerald-600">GC {money(line.gift_card_amount)}</p>
                      <p className="text-emerald-600/80">Cash {money(line.cash_amount)}</p>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-emerald-600">
                      {money(line.organizer_payout)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

function CinemaSettlementDetailPanel({
  runId,
  onClose,
}: {
  runId: string;
  onClose: () => void;
}) {
  const { data: run, isLoading } = useGetAdminCinemaSettlementQuery(runId);
  const [patchSettlement, { isLoading: patching }] =
    usePatchAdminCinemaSettlementMutation();
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setNotes(run?.notes || "");
  }, [run?.notes, runId]);

  const act = async (status: "APPROVED" | "PAID" | "CANCELLED") => {
    if (status === "CANCELLED") {
      const ok = window.confirm(
        "Cancel this cinema settlement? Bookings will become unsettled and can enter a new run."
      );
      if (!ok) return;
    }
    try {
      const res = await patchSettlement({
        id: runId,
        status,
        notes: notes.trim() || undefined,
      }).unwrap();
      toast.success(res.message || "Settlement updated");
      if (status === "CANCELLED" || status === "PAID") onClose();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update cinema settlement"));
    }
  };

  const status = (run?.status || "").toUpperCase();
  const canAct = status === "PENDING" || status === "APPROVED";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-[2px]">
      <div className="glass-panel rounded-t-2xl sm:rounded-2xl border border-white/10 w-full max-w-4xl max-h-[92vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Cinema settlement detail</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Gift-card bookings are included at full cinema share (ticket − commission).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-zinc-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5"
          >
            Close
          </button>
        </div>

        {isLoading || !run ? (
          <div className="flex items-center gap-2 py-10 text-zinc-400 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(run.status)}
              <span className="text-sm text-white font-semibold">{run.cinema_name}</span>
              <span className="text-xs text-zinc-500">
                {run.created_at ? formatDate(run.created_at) : "—"}
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <StatCard
                label="Gross tickets"
                value={money(run.gross_ticket)}
                accent="text-emerald-600"
              />
              <StatCard
                label="Commission"
                value={money(run.commission_total)}
                accent="text-emerald-600"
              />
              <StatCard
                label="Cinema payable"
                value={money(run.cinema_payable)}
                accent="text-emerald-600"
              />
              <StatCard
                label="GC funded"
                value={money(run.gift_card_amount)}
                hint="Does not reduce payable"
                accent="text-emerald-600"
              />
              <StatCard
                label="Cash funded"
                value={money(run.cash_amount)}
                accent="text-emerald-600"
              />
            </div>

            {canAct && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1">Notes (optional)</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Payment note or transfer id"
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {status === "PENDING" && (
                    <button
                      type="button"
                      disabled={patching}
                      onClick={() => void act("APPROVED")}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-sky-600/80 hover:bg-sky-500 text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={patching}
                    onClick={() => void act("PAID")}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600/80 hover:bg-rose-500 text-white disabled:opacity-50"
                  >
                    {patching ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={12} />
                    )}
                    Mark paid
                  </button>
                  <button
                    type="button"
                    disabled={patching}
                    onClick={() => void act("CANCELLED")}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {run.notes && !canAct ? (
              <p className="text-xs text-zinc-400">
                Notes: <span className="text-zinc-200">{run.notes}</span>
              </p>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-left text-sm min-w-[720px]">
                <thead className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Movie / Guest</th>
                    <th className="px-3 py-2.5 font-semibold">Ticket</th>
                    <th className="px-3 py-2.5 font-semibold">Commission</th>
                    <th className="px-3 py-2.5 font-semibold">GC / Cash</th>
                    <th className="px-3 py-2.5 font-semibold">Cinema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(run.lines || []).map((line: CinemaSettlementLine) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2.5">
                        <p className="text-white font-medium">{line.movie_title || "—"}</p>
                        <p className="text-xs text-zinc-500">
                          {line.guest_name || "—"}
                          {line.booking_code ? ` · ${line.booking_code}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-emerald-600">
                        {money(line.ticket_amount)}
                      </td>
                      <td className="px-3 py-2.5 text-emerald-600">
                        −{money(line.commission_total)}
                      </td>
                      <td className="px-3 py-2.5 text-xs space-y-0.5">
                        <p className="text-emerald-600">GC {money(line.gift_card_amount)}</p>
                        <p className="text-emerald-600/80">Cash {money(line.cash_amount)}</p>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-emerald-600">
                        {money(line.cinema_payable)}
                      </td>
                    </tr>
                  ))}
                  {(run.lines || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-zinc-500 text-sm">
                        No booking lines on this run.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function parseTab(raw: string | null): PageTab {
  if (raw === "dining" || raw === "history" || raw === "events" || raw === "movies") return raw;
  if (raw === "settlements") return "events";
  if (raw === "payouts") return "history";
  return "events";
}

export default function AdminOrganizerPayoutsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pageTab, setPageTab] = useState<PageTab>(() =>
    parseTab(searchParams.get("tab"))
  );
  const [organizerFilter, setOrganizerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [diningStatus, setDiningStatus] = useState<DiningStatusTab>("PENDING");
  const [diningBusinessId, setDiningBusinessId] = useState("");
  const [diningQ, setDiningQ] = useState("");
  const [diningFrom, setDiningFrom] = useState("");
  const [diningTo, setDiningTo] = useState("");
  const [busyDiningId, setBusyDiningId] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [eventsWorkspace, setEventsWorkspace] = useState<EventsWorkspace>("queue");
  const [moviesWorkspace, setMoviesWorkspace] = useState<MoviesWorkspace>("queue");
  const [moviesCinemaFilter, setMoviesCinemaFilter] = useState("");
  const [moviesStatusFilter, setMoviesStatusFilter] = useState("ALL");
  const [selectedCinemaRunId, setSelectedCinemaRunId] = useState<string | null>(null);
  const [settlingCinemaId, setSettlingCinemaId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(PAGE_SIZE);

  useEffect(() => {
    const next = parseTab(searchParams.get("tab"));
    setPageTab(next);
  }, [searchParams]);

  // Admin list (not public /businesses) so every active event organizer / restaurant appears.
  const { data: organizersData } = useGetAdminBusinessesQuery({
    module: "event",
    tab: "active",
  });
  const { data: restaurantsData } = useGetAdminBusinessesQuery(
    { module: "dining", tab: "active" },
    { skip: pageTab !== "dining" && pageTab !== "history" }
  );
  const { data: cinemasData } = useGetAdminBusinessesQuery(
    { module: "cinema", tab: "active" },
    { skip: pageTab !== "movies" }
  );

  const organizers = useMemo(() => {
    const items = organizersData?.items ?? [];
    return [...items].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [organizersData?.items]);

  const restaurantOptions = useMemo(() => {
    const items = restaurantsData?.items ?? [];
    return [...items].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [restaurantsData?.items]);

  const cinemaOptions = useMemo(() => {
    const items = cinemasData?.items ?? [];
    return [...items].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [cinemasData?.items]);

  const { data: settlementsData, isLoading: settlementsLoading, isFetching: settlementsFetching } =
    useGetOrganizerSettlementsQuery(
      {
        page,
        limit,
        ...(organizerFilter ? { business_id: organizerFilter } : {}),
        ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
      },
      { skip: pageTab !== "events" }
    );

  const { data: pendingData, isLoading: pendingLoading, isError: pendingError } =
    useGetPendingOrganizerSettlementsQuery(
      {
        page: 1,
        limit: 15,
        ...(organizerFilter ? { business_id: organizerFilter } : {}),
      },
      { skip: pageTab !== "events" }
    );

  const {
    data: cinemaPendingData = [],
    isLoading: cinemaPendingLoading,
    isError: cinemaPendingError,
    refetch: refetchCinemaPending,
  } = useGetAdminCinemaSettlementsPendingQuery(
    moviesCinemaFilter ? { business_id: moviesCinemaFilter } : undefined,
    { skip: pageTab !== "movies" }
  );

  const {
    data: cinemaSettlementsData = [],
    isLoading: cinemaSettlementsLoading,
    isFetching: cinemaSettlementsFetching,
    refetch: refetchCinemaSettlements,
  } = useGetAdminCinemaSettlementsQuery(
    {
      ...(moviesCinemaFilter ? { business_id: moviesCinemaFilter } : {}),
      ...(moviesStatusFilter !== "ALL" ? { status: moviesStatusFilter } : {}),
    },
    { skip: pageTab !== "movies" }
  );

  const { data: payoutsData, isLoading: payoutsLoading, isFetching: payoutsFetching } =
    useGetOrganizerPayoutsQuery(
      {
        page,
        limit,
        ...(organizerFilter ? { business_id: organizerFilter } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
      },
      { skip: pageTab !== "history" }
    );

  const { data: diningData, isLoading: diningLoading, isError: diningError } =
    useGetAdminDiningGiftCardRedemptionsQuery(
      {
        page,
        limit,
        ...(diningStatus !== "ALL" ? { status: diningStatus } : {}),
        ...(diningBusinessId ? { business_id: diningBusinessId } : {}),
        ...(diningQ.trim() ? { q: diningQ.trim() } : {}),
        ...(diningFrom ? { from: diningFrom } : {}),
        ...(diningTo ? { to: diningTo } : {}),
      },
      { skip: pageTab !== "dining" }
    );

  const { data: diningPaidHistory } = useGetAdminDiningGiftCardRedemptionsQuery(
    { page: 1, limit: 20, status: "PAID" },
    { skip: pageTab !== "history" }
  );

  const settlements = settlementsData?.items ?? [];
  const settlementsMeta = settlementsData?.meta;
  const pendingByOrganizer = pendingData?.by_organizer ?? [];
  const pendingBookings = pendingData?.items ?? [];
  const pendingSummary = pendingData?.summary;
  const payouts = payoutsData?.items ?? [];
  const payoutsMeta = payoutsData?.meta;
  const diningRows = diningData?.items ?? [];
  const diningMeta = diningData?.meta;
  const diningSummary = diningData?.summary;
  const diningPaidRows = diningPaidHistory?.items ?? [];
  const cinemaPending = cinemaPendingData as CinemaPendingRow[];
  const cinemaSettlements = cinemaSettlementsData as CinemaSettlementRun[];

  const [generateSettlement, { isLoading: generating }] =
    useGenerateOrganizerSettlementMutation();
  const [generateCinemaSettlement, { isLoading: generatingCinema }] =
    useGenerateAdminCinemaSettlementMutation();
  const [createPayout, { isLoading: savingManual }] = useCreateOrganizerPayoutMutation();
  const [patchDiningSettlement] = usePatchAdminDiningGiftCardSettlementMutation();
  const [settlingBizId, setSettlingBizId] = useState<string | null>(null);

  const {
    register: registerGen,
    handleSubmit: handleGenerate,
    reset: resetGen,
    setValue: setGenValue,
    formState: { errors: genErrors },
  } = useForm<GenerateValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(generateSchema) as any,
    defaultValues: { business_id: "", period_from: "", period_to: "", notes: "" },
  });

  const {
    register: registerManual,
    handleSubmit: handleManual,
    reset: resetManual,
    formState: { errors: manualErrors },
  } = useForm<AdminPayoutValues>({
    resolver: yupResolver(adminPayoutSchema),
    defaultValues: EMPTY_MANUAL,
  });

  const settlementStats = useMemo(() => {
    const draft = settlements.filter((s) => s.status === "DRAFT").length;
    const approved = settlements.filter((s) => s.status === "APPROVED").length;
    const paidAmt = settlements
      .filter((s) => s.status === "PAID")
      .reduce((sum, s) => sum + Number(s.organizer_payable || 0), 0);
    const openPayable = settlements
      .filter((s) => s.status === "DRAFT" || s.status === "APPROVED")
      .reduce((sum, s) => sum + Number(s.organizer_payable || 0), 0);
    return { draft, approved, paidAmt, openPayable, total: settlements.length };
  }, [settlements]);

  const cinemaStats = useMemo(() => {
    const pendingPayable = cinemaPending.reduce(
      (sum, row) => sum + Number(row.cinema_payable || 0),
      0
    );
    const pendingBookings = cinemaPending.reduce(
      (sum, row) => sum + Number(row.booking_count || 0),
      0
    );
    const pendingRuns = cinemaSettlements.filter(
      (s) => (s.status || "").toUpperCase() === "PENDING"
    ).length;
    const approvedRuns = cinemaSettlements.filter(
      (s) => (s.status || "").toUpperCase() === "APPROVED"
    ).length;
    const openPayable = cinemaSettlements
      .filter((s) => {
        const st = (s.status || "").toUpperCase();
        return st === "PENDING" || st === "APPROVED";
      })
      .reduce((sum, s) => sum + Number(s.cinema_payable || 0), 0);
    return {
      pendingPayable,
      pendingBookings,
      cinemasCount: cinemaPending.length,
      pendingRuns,
      approvedRuns,
      openPayable,
      totalRuns: cinemaSettlements.length,
    };
  }, [cinemaPending, cinemaSettlements]);

  const onGenerate = async (values: GenerateValues) => {
    try {
      const res = await generateSettlement({
        business_id: values.business_id,
        ...(values.period_from?.trim() ? { period_from: values.period_from.trim() } : {}),
        ...(values.period_to?.trim() ? { period_to: values.period_to.trim() } : {}),
        notes: values.notes?.trim() || undefined,
      }).unwrap();
      toast.success(res.message || "Settlement draft created");
      setSelectedRunId(res.data.id);
      setShowGenerate(false);
      resetGen({ business_id: values.business_id, period_from: "", period_to: "", notes: "" });
      setEventsWorkspace("runs");
      switchTab("events");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to generate settlement"));
    }
  };

  const settleOrganizerNow = async (row: {
    business_id: string;
    period_from?: string;
    period_to?: string;
  }) => {
    setSettlingBizId(row.business_id);
    try {
      // Omit period dates so backend includes ALL unsettled bookings for this organizer
      // (avoids timezone skew from date-only JSON / local midnight conversion).
      const res = await generateSettlement({
        business_id: row.business_id,
      }).unwrap();
      toast.success(res.message || "Settlement draft created");
      setSelectedRunId(res.data.id);
      setEventsWorkspace("runs");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to generate settlement"));
    } finally {
      setSettlingBizId(null);
    }
  };

  const prefillGenerate = (row: {
    business_id: string;
    period_from?: string;
    period_to?: string;
  }) => {
    setEventsWorkspace("runs");
    setShowGenerate(true);
    setShowManual(false);
    setGenValue("business_id", row.business_id);
    setGenValue("period_from", toDateOnlyParam(row.period_from));
    setGenValue("period_to", toDateOnlyParam(row.period_to));
  };

  const onManual = async (values: AdminPayoutValues) => {
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
        (created as { message?: string }).message || "Manual payout recorded."
      );
      resetManual(EMPTY_MANUAL);
      setShowManual(false);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to record payout"));
    }
  };

  const updateDiningStatus = async (
    row: DiningGiftCardRedemptionRow,
    settlement_status: string,
    notes: string,
    payment_reference: string
  ) => {
    setBusyDiningId(row.id);
    try {
      const res = await patchDiningSettlement({
        id: row.id,
        settlement_status,
        settlement_notes: notes || undefined,
        payment_reference: payment_reference || undefined,
      }).unwrap();
      toast.success(res.message || "Settlement updated");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update settlement"));
    } finally {
      setBusyDiningId(null);
    }
  };

  const settleCinemaNow = async (row: CinemaPendingRow) => {
    setSettlingCinemaId(row.business_id);
    try {
      const res = await generateCinemaSettlement({ business_id: row.business_id }).unwrap();
      toast.success(res.message || "Cinema settlement created");
      setMoviesWorkspace("runs");
      await Promise.all([refetchCinemaPending(), refetchCinemaSettlements()]);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to generate cinema settlement"));
    } finally {
      setSettlingCinemaId(null);
    }
  };

  const switchTab = (tab: PageTab) => {
    setPageTab(tab);
    setPage(1);
    setSelectedRunId(null);
    setSelectedCinemaRunId(null);
    router.replace(`/admin/organizer-payouts?tab=${tab}`, { scroll: false });
  };

  return (
    <div className={adminFinancePageClass}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <AdminSegmentedTabs
          tabs={[
            { key: "events", label: "Events", icon: Ticket },
            { key: "movies", label: "Movies", icon: Film },
            { key: "dining", label: "Dining", icon: Store },
            { key: "history", label: "History", icon: Banknote },
          ]}
          active={pageTab}
          onChange={switchTab}
        />
        {pageTab === "events" ? (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEventsWorkspace("runs");
                setShowGenerate((v) => !v);
                if (!showGenerate) setShowManual(false);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors"
            >
              <Plus size={16} />
              {showGenerate ? "Hide generate" : "Generate"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEventsWorkspace("runs");
                setShowManual((v) => !v);
                if (!showManual) setShowGenerate(false);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 text-zinc-300 hover:text-white hover:bg-white/5 text-sm font-semibold transition-colors"
            >
              Manual
            </button>
          </div>
        ) : null}
      </div>

      {pageTab === "events" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Pending bookings"
              value={String(pendingSummary?.bookings_count || 0)}
              hint={`${pendingSummary?.organizers_count || 0} organizers`}
              accent="text-amber-300"
            />
            <StatCard
              label="Pending payable"
              value={money(pendingSummary?.organizer_payable || 0)}
              hint="Not yet in a settlement run"
              accent="text-emerald-600"
            />
            <StatCard
              label="Open runs"
              value={money(settlementStats.openPayable)}
              hint={`${settlementStats.draft} draft · ${settlementStats.approved} approved`}
              accent="text-emerald-600"
            />
            <FlowSteps />
          </div>

          <AdminSegmentedTabs
            size="sm"
            tabs={[
              {
                key: "queue",
                label: "To settle",
                count: pendingSummary?.organizers_count || 0,
              },
              {
                key: "runs",
                label: "Settlement runs",
                count: settlementStats.total,
              },
            ]}
            active={eventsWorkspace}
            onChange={(key) => {
              setEventsWorkspace(key);
              setShowGenerate(false);
              setShowManual(false);
            }}
          />

          {eventsWorkspace === "queue" && (
          <>
          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-white">Pending entitlements</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Confirmed bookings that still need a settlement run.
                </p>
              </div>
            </div>
            {pendingLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-zinc-400">
                <Loader2 className="animate-spin" size={16} /> Loading pending bookings…
              </div>
            ) : pendingError ? (
              <p className="px-4 py-8 text-center text-rose-400 text-sm">
                Could not load pending entitlements. Restart the backend so settlement tables migrate.
              </p>
            ) : pendingByOrganizer.length === 0 ? (
              <p className="px-4 py-8 text-center text-zinc-500 text-sm">
                No unsettled confirmed bookings. After a customer books an event, it appears here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[720px]">
                  <thead className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Organizer</th>
                      <th className="px-4 py-3 font-semibold">Bookings</th>
                      <th className="px-4 py-3 font-semibold">GC / Cash</th>
                      <th className="px-4 py-3 font-semibold">Payable</th>
                      <th className="px-4 py-3 font-semibold">Period</th>
                      <th className="px-4 py-3 font-semibold" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pendingByOrganizer.map((row) => (
                      <tr key={row.business_id} className="hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-semibold text-white">
                          {row.organizer_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">{row.bookings_count}</td>
                        <td className="px-4 py-3 text-xs space-y-0.5">
                          <p className="text-emerald-600">GC {money(row.gift_card_funded)}</p>
                          <p className="text-emerald-600/80">Cash {money(row.cash_funded)}</p>
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-600 tabular-nums">
                          {money(row.organizer_payable)}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {formatDate(row.period_from)} – {formatDate(row.period_to)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => prefillGenerate(row)}
                              className="text-xs font-semibold text-zinc-300 hover:text-white"
                            >
                              Edit dates
                            </button>
                            <button
                              type="button"
                              disabled={settlingBizId === row.business_id || generating}
                              onClick={() => void settleOrganizerNow(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
                            >
                              {settlingBizId === row.business_id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Plus size={12} />
                              )}
                              Create draft
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pendingBookings.length > 0 ? (
              <div className="border-t border-white/5 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold mb-2">
                  Recent unsettled bookings
                </p>
                <div className="space-y-2">
                  {pendingBookings.slice(0, 8).map((b) => (
                    <div
                      key={b.booking_id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">
                          {b.event_name || "Event"} · {b.organizer_name || "—"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {b.guest_name || "Guest"} ·{" "}
                          {b.created_at ? formatDate(b.created_at) : "—"} ·{" "}
                          {b.booking_status}
                        </p>
                      </div>
                      <div className="text-right text-xs">
                        <p className="font-bold text-emerald-600 tabular-nums">
                          {money(b.organizer_payout)}
                        </p>
                        <p className="text-emerald-600/80">
                          GC {money(b.gift_card_amount)} · Cash {money(b.cash_amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          </>
          )}

          {eventsWorkspace === "runs" && (
          <>
          {showGenerate && (
            <form
              onSubmit={handleGenerate(onGenerate)}
              noValidate
              className="glass-panel rounded-2xl border border-rose-500/20 p-5 sm:p-6 space-y-4"
            >
              <div>
                <h3 className="text-lg font-bold text-white">Generate settlement run</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Dates are optional — leave blank to include all unsettled confirmed bookings for
                  that organizer. Payable stays ticket − commission (GC does not reduce it).
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-zinc-500 mb-1.5 font-medium">
                    Event organizer <span className="text-rose-400">*</span>
                  </label>
                  <select
                    {...registerGen("business_id")}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                  >
                    <option value="">Select organizer</option>
                    {organizers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {genErrors.business_id && (
                    <p className="mt-1 text-[11px] text-rose-400">{genErrors.business_id.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 font-medium">From</label>
                  <input
                    type="date"
                    {...registerGen("period_from")}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                  />
                  {genErrors.period_from && (
                    <p className="mt-1 text-[11px] text-rose-400">{genErrors.period_from.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5 font-medium">To</label>
                  <input
                    type="date"
                    {...registerGen("period_to")}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                  />
                  {genErrors.period_to && (
                    <p className="mt-1 text-[11px] text-rose-400">{genErrors.period_to.message}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Notes (optional)</label>
                <input
                  {...registerGen("notes")}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                  placeholder="e.g. Week of 1 Sep"
                />
              </div>
              <button
                type="submit"
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Generate draft
              </button>
            </form>
          )}

          {showManual && (
            <form
              onSubmit={handleManual(onManual)}
              noValidate
              className="glass-panel rounded-2xl border border-amber-500/20 p-6 space-y-4"
            >
              <h3 className="text-lg font-semibold text-white">Manual payout (fallback)</h3>
              <p className="text-xs text-amber-200/80 -mt-2">
                Prefer settlement runs so gift-card bookings stay tied to a period. Use this only for
                adjustments.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Organizer</label>
                  <select
                    {...registerManual("business_id")}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">Select</option>
                    {organizers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  {manualErrors.business_id && (
                    <p className="mt-1 text-[11px] text-rose-400">
                      {manualErrors.business_id.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    {...registerManual("amount")}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  {manualErrors.amount && (
                    <p className="mt-1 text-[11px] text-rose-400">{manualErrors.amount.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Payment reference</label>
                  <input
                    {...registerManual("payment_reference")}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Notes</label>
                  <input
                    {...registerManual("notes")}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={savingManual}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {savingManual ? "Saving…" : "Record manual payout"}
              </button>
            </form>
          )}

          <AdminFilterBar>
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Filter by organizer</label>
              <select
                value={organizerFilter}
                onChange={(e) => {
                  setOrganizerFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm w-full max-w-md"
              >
                <option value="">All organizers</option>
                {organizers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5 font-medium">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
              >
                <option value="ALL">All</option>
                <option value="DRAFT">Draft</option>
                <option value="APPROVED">Approved</option>
                <option value="PAID">Paid</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </AdminFilterBar>

          {settlementsLoading || settlementsFetching ? (
            <AdminListShimmer rows={6} columns={5} showTabs={false} showToolbar={false} />
          ) : settlements.length === 0 ? (
            <AdminEmptyState
              icon={Ticket}
              title="No settlement runs yet"
              description="Generate a draft for an organizer. Confirmed bookings — including gift card tickets — are included automatically."
              action={
                <button
                  type="button"
                  onClick={() => setShowGenerate(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold"
                >
                  <Plus size={16} /> Generate settlement
                </button>
              }
            />
          ) : (
            <>
              <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[800px]">
                    <thead className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Organizer / Period</th>
                        <th className="px-4 py-3 font-semibold">Bookings</th>
                        <th className="px-4 py-3 font-semibold">GC / Cash</th>
                        <th className="px-4 py-3 font-semibold">Payable</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {settlements.map((run: OrganizerSettlementRun) => (
                        <tr key={run.id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-white">{run.organizer_name || "—"}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {formatDate(run.period_from)} – {formatDate(run.period_to)}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-zinc-300">{run.bookings_count}</td>
                          <td className="px-4 py-3 text-xs space-y-0.5">
                            <p className="text-emerald-600">GC {money(run.gift_card_funded)}</p>
                            <p className="text-emerald-600/80">Cash {money(run.cash_funded)}</p>
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-600">
                            {money(run.organizer_payable)}
                          </td>
                          <td className="px-4 py-3">{statusBadge(run.status)}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedRunId(run.id)}
                              className="text-xs font-semibold text-rose-400 hover:underline"
                            >
                              Review →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {settlementsMeta && (
                <Pagination meta={settlementsMeta} onPageChange={setPage} />
              )}
            </>
          )}
          </>
          )}

          {selectedRunId ? (
            <SettlementDetailPanel
              runId={selectedRunId}
              onClose={() => setSelectedRunId(null)}
            />
          ) : null}
        </>
      )}

      {pageTab === "movies" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Pending bookings"
              value={String(cinemaStats.pendingBookings)}
              hint={`${cinemaStats.cinemasCount} cinemas`}
              accent="text-amber-300"
            />
            <StatCard
              label="Pending payable"
              value={money(cinemaStats.pendingPayable)}
              hint="Not yet in a settlement run"
              accent="text-emerald-600"
            />
            <StatCard
              label="Open runs"
              value={money(cinemaStats.openPayable)}
              hint={`${cinemaStats.pendingRuns} pending · ${cinemaStats.approvedRuns} approved`}
              accent="text-emerald-600"
            />
            <FlowSteps />
          </div>

          <AdminSegmentedTabs
            size="sm"
            tabs={[
              {
                key: "queue",
                label: "To settle",
                count: cinemaStats.cinemasCount,
              },
              {
                key: "runs",
                label: "Settlement runs",
                count: cinemaStats.totalRuns,
              },
            ]}
            active={moviesWorkspace}
            onChange={(key) => setMoviesWorkspace(key)}
          />

          <AdminFilterBar>
            <div className="min-w-[12rem]">
              <label className="block text-[11px] text-zinc-500 mb-1 font-medium">Cinema</label>
              <select
                value={moviesCinemaFilter}
                onChange={(e) => setMoviesCinemaFilter(e.target.value)}
                className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
              >
                <option value="">All cinemas</option>
                {cinemaOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            {moviesWorkspace === "runs" ? (
              <div className="min-w-[10rem]">
                <label className="block text-[11px] text-zinc-500 mb-1 font-medium">Status</label>
                <select
                  value={moviesStatusFilter}
                  onChange={(e) => setMoviesStatusFilter(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                >
                  <option value="ALL">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PAID">Paid</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>
            ) : null}
          </AdminFilterBar>

          {moviesWorkspace === "queue" && (
            <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="text-sm font-bold text-white">Pending by cinema</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Confirmed movie bookings that still need a settlement run.
                </p>
              </div>
              {cinemaPendingLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-zinc-400">
                  <Loader2 className="animate-spin" size={16} /> Loading pending…
                </div>
              ) : cinemaPendingError ? (
                <p className="px-4 py-8 text-center text-rose-400 text-sm">
                  Could not load pending cinema settlements.
                </p>
              ) : cinemaPending.length === 0 ? (
                <p className="px-4 py-8 text-center text-zinc-500 text-sm">
                  No unsettled confirmed movie bookings.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm min-w-[720px]">
                    <thead className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Cinema</th>
                        <th className="px-4 py-3 font-semibold">Bookings</th>
                        <th className="px-4 py-3 font-semibold">Gross / Commission</th>
                        <th className="px-4 py-3 font-semibold">Payable</th>
                        <th className="px-4 py-3 font-semibold" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {cinemaPending.map((row) => (
                        <tr key={row.business_id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-semibold text-white">
                            {row.cinema_name || "—"}
                          </td>
                          <td className="px-4 py-3 text-zinc-300">{row.booking_count || 0}</td>
                          <td className="px-4 py-3 text-xs space-y-0.5">
                            <p className="text-emerald-600">Gross {money(row.gross_ticket)}</p>
                            <p className="text-emerald-600/80">
                              Commission {money(row.commission_total)}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-bold text-emerald-600 tabular-nums">
                            {money(row.cinema_payable)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              disabled={
                                settlingCinemaId === row.business_id || generatingCinema
                              }
                              onClick={() => void settleCinemaNow(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
                            >
                              {settlingCinemaId === row.business_id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Plus size={12} />
                              )}
                              Generate settlement
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {moviesWorkspace === "runs" && (
            <>
              {cinemaSettlementsLoading || cinemaSettlementsFetching ? (
                <AdminListShimmer rows={6} columns={5} showTabs={false} showToolbar={false} />
              ) : cinemaSettlements.length === 0 ? (
                <AdminEmptyState
                  icon={Film}
                  title="No cinema settlement runs yet"
                  description="Generate a settlement from the pending queue for a cinema partner."
                />
              ) : (
                <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[860px]">
                      <thead className="text-[11px] uppercase tracking-wider text-zinc-500 border-b border-white/5 bg-white/[0.02]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Cinema</th>
                          <th className="px-4 py-3 font-semibold">Bookings</th>
                          <th className="px-4 py-3 font-semibold">Amounts</th>
                          <th className="px-4 py-3 font-semibold">Payable</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {cinemaSettlements.map((run) => (
                          <tr key={run.id} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-white">{run.cinema_name || "—"}</p>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {run.created_at ? formatDate(run.created_at) : "—"}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-zinc-300">{run.booking_count || 0}</td>
                            <td className="px-4 py-3 text-xs space-y-0.5">
                              <p className="text-emerald-600">Gross {money(run.gross_ticket)}</p>
                              <p className="text-emerald-600/80">
                                Commission {money(run.commission_total)}
                              </p>
                              <p className="text-emerald-600/80">GC {money(run.gift_card_amount)}</p>
                            </td>
                            <td className="px-4 py-3 font-bold text-emerald-600">
                              {money(run.cinema_payable)}
                            </td>
                            <td className="px-4 py-3">{statusBadge(run.status)}</td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => setSelectedCinemaRunId(run.id)}
                                className="text-xs font-semibold text-rose-400 hover:underline"
                              >
                                Review →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedCinemaRunId ? (
                <CinemaSettlementDetailPanel
                  runId={selectedCinemaRunId}
                  onClose={() => setSelectedCinemaRunId(null)}
                />
              ) : null}
            </>
          )}
        </>
      )}

      {pageTab === "dining" && (
        <>
          <AdminCallout tone="amber">
            Restaurant payable = gift card amount redeemed at POS.{" "}
            <span className="font-semibold">Pending → Approve → Mark paid</span>. Cancel
            restores the guest balance.
          </AdminCallout>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Pending payable"
              value={money(diningSummary?.pending_amount || 0)}
              hint={`${diningSummary?.pending_count || 0} redemptions`}
              accent="text-emerald-600"
            />
            <StatCard
              label="Approved"
              value={money(diningSummary?.approved_amount || 0)}
              hint={`${diningSummary?.approved_count || 0} ready to pay`}
              accent="text-emerald-600"
            />
            <StatCard
              label="Paid to restaurants"
              value={money(diningSummary?.paid_amount || 0)}
              hint={`${diningSummary?.paid_count || 0} settled`}
              accent="text-emerald-600"
            />
            <StatCard
              label="Cancelled"
              value={String(diningSummary?.cancelled_count || 0)}
              hint="Balance restored to guests"
              accent="text-rose-300"
            />
          </div>

          <AdminSegmentedTabs
            size="sm"
            tabs={DINING_STATUS_TABS.map((t) => ({
              key: t.key,
              label: t.label,
              count:
                t.key === "PENDING"
                  ? diningSummary?.pending_count
                  : t.key === "APPROVED"
                    ? diningSummary?.approved_count
                    : t.key === "PAID"
                      ? diningSummary?.paid_count
                      : t.key === "CANCELLED"
                        ? diningSummary?.cancelled_count
                        : undefined,
            }))}
            active={diningStatus}
            onChange={(key) => {
              setDiningStatus(key);
              setPage(1);
            }}
          />

          <AdminFilterBar>
              <div className="flex-1">
                <SearchInput
                  value={diningQ}
                  onChange={(v) => {
                    setDiningQ(v);
                    setPage(1);
                  }}
                  placeholder="Search restaurant, guest, last4…"
                />
              </div>
              <select
                value={diningBusinessId}
                onChange={(e) => {
                  setDiningBusinessId(e.target.value);
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
              <input
                type="date"
                value={diningFrom}
                onChange={(e) => {
                  setDiningFrom(e.target.value);
                  setPage(1);
                }}
                className="bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                aria-label="From date"
              />
              <input
                type="date"
                value={diningTo}
                onChange={(e) => {
                  setDiningTo(e.target.value);
                  setPage(1);
                }}
                className="bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white"
                aria-label="To date"
              />
          </AdminFilterBar>

          <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
            {diningLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-zinc-400">
                <Loader2 className="animate-spin" size={18} /> Loading dining payables…
              </div>
            ) : diningError ? (
              <p className="text-center text-rose-400 py-16">Could not load dining settlements.</p>
            ) : diningRows.length === 0 ? (
              <AdminEmptyState
                icon={Store}
                title="No redemptions match these filters"
                description="Redeem a gift card at dining POS to create a payable here."
              />
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
                    {diningRows.map((row) => {
                      const busy = busyDiningId === row.id;
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
                          <td className="px-4 py-3 align-top text-xs text-emerald-600 space-y-0.5">
                            <p>Bill {money(row.bill_amount)}</p>
                            <p>
                              GC −{money(row.gift_card_amount)}
                            </p>
                            <p>Guest {money(row.customer_payable)}</p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <p className="font-bold text-emerald-600">
                              {money(row.settlement_amount ?? row.gift_card_amount)}
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
                          <DiningSettlementRowActions
                            key={`${row.id}-${row.settlement_status}-${row.settlement_notes || ""}-${row.payment_reference || ""}`}
                            row={row}
                            busy={busy}
                            onUpdate={updateDiningStatus}
                          />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {diningMeta && <Pagination meta={diningMeta} onPageChange={setPage} />}
        </>
      )}

      {pageTab === "history" && (
        <>
          <div className="glass-panel rounded-2xl border border-white/5 p-4 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">Filter event organizer</label>
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

          <h3 className="text-sm font-semibold text-zinc-300">Event / organizer payouts</h3>
          {payoutsLoading || payoutsFetching ? (
            <AdminListShimmer rows={6} columns={6} showTabs={false} showToolbar={false} />
          ) : payouts.length === 0 ? (
            <div className="glass-panel rounded-2xl border border-white/5 px-6 py-8 text-center text-zinc-500">
              No event payouts recorded yet.
            </div>
          ) : (
            <>
              <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left min-w-[800px] text-sm">
                    <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400">
                      <tr>
                        <th className="px-6 py-4 font-medium">Date</th>
                        <th className="px-6 py-4 font-medium">Organizer</th>
                        <th className="px-6 py-4 font-medium">Event</th>
                        <th className="px-6 py-4 font-medium">Amount</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {payouts.map((p) => (
                        <tr key={p.id} className="hover:bg-white/[0.02]">
                          <td className="px-6 py-4 text-zinc-300">
                            {formatDate(p.paid_at || p.created_at)}
                          </td>
                          <td className="px-6 py-4 text-white font-medium">
                            {p.organizer_name || "—"}
                          </td>
                          <td className="px-6 py-4 text-zinc-400">
                            {p.event_name || "Settlement / General"}
                          </td>
                          <td className="px-6 py-4 text-emerald-600 font-semibold inline-flex items-center gap-1">
                            <Banknote size={14} />
                            {money(p.amount)}
                          </td>
                          <td className="px-6 py-4">{statusBadge(p.status)}</td>
                          <td className="px-6 py-4 font-mono text-xs text-zinc-400">
                            {p.payment_reference || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {payoutsMeta && <Pagination meta={payoutsMeta} onPageChange={setPage} />}
            </>
          )}

          <h3 className="text-sm font-semibold text-zinc-300 pt-2">
            Recent dining GC payables (paid)
          </h3>
          {diningPaidRows.length === 0 ? (
            <div className="glass-panel rounded-2xl border border-white/5 px-6 py-8 text-center text-zinc-500">
              No paid dining gift-card settlements yet.
            </div>
          ) : (
            <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[700px]">
                  <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Restaurant</th>
                      <th className="px-4 py-3 font-medium">Payable</th>
                      <th className="px-4 py-3 font-medium">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {diningPaidRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-3 text-zinc-300">
                          {formatDate(row.settled_at || row.redeemed_at)}
                        </td>
                        <td className="px-4 py-3 text-white">{row.business_name || "—"}</td>
                        <td className="px-4 py-3 text-emerald-600 font-semibold">
                          {money(row.settlement_amount ?? row.gift_card_amount)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                          {row.payment_reference || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
