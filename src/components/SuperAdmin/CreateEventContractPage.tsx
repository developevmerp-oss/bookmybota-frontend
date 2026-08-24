"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ContractRichTextEditor from "@/components/SuperAdmin/ContractRichTextEditor";
import EventContractDocument from "@/components/EventAdminPanel/EventContractDocument";
import {
  useCreateEventContractMutation,
  useGetContractPrefillQuery,
  useGetEligibleContractEventsQuery,
  type EventContract,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import {
  adminEventContractCreateSchema,
  type AdminEventContractCreateValues,
} from "@/lib/adminFormSchemas";
import { htmlWithMergedValues } from "@/lib/contractPlaceholdersShared";
import {
  getPercentValidationError,
  parsePercent,
  sanitizePercentInput,
} from "@/lib/validation";

export default function CreateEventContractPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get("eventId") ?? "";

  const { data: eligible = [], isLoading: loadingEligible } = useGetEligibleContractEventsQuery();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<AdminEventContractCreateValues>({
    resolver: yupResolver(adminEventContractCreateSchema),
    defaultValues: {
      event_id: initialEventId,
      body_html: "",
      terms: "",
      convenience_fee: "0",
      commission: "0",
    },
    mode: "onSubmit",
  });

  const eventId = watch("event_id");
  const convenienceFee = watch("convenience_fee") ?? "";
  const commission = watch("commission") ?? "";
  const terms = watch("terms") ?? "";
  const bodyHtml = watch("body_html") ?? "";

  const { data: prefill, isLoading: loadingPrefill } = useGetContractPrefillQuery(eventId, {
    skip: !eventId,
  });

  const [previewContract, setPreviewContract] = useState<EventContract | null>(null);

  const [createContract, { isLoading: creating }] = useCreateEventContractMutation();

  useEffect(() => {
    if (initialEventId) setValue("event_id", initialEventId);
  }, [initialEventId, setValue]);

  useEffect(() => {
    if (!prefill?.suggested) return;
    setValue(
      "convenience_fee",
      sanitizePercentInput(String(prefill.suggested.convenience_fee_percent ?? 0))
    );
    setValue(
      "commission",
      sanitizePercentInput(String(prefill.suggested.commission_percent ?? 0))
    );
    setValue("terms", prefill.suggested.terms_and_conditions ?? "");
    setValue("body_html", prefill.suggested.body_html ?? "");
  }, [prefill?.suggested?.contract_number, prefill?.event?.id, setValue]);

  const dynamicPreview = useMemo(() => {
    if (!prefill?.suggested) return {};
    return {
      ...prefill.suggested.dynamic_data,
      convenienceFeePercent: parsePercent(convenienceFee) ?? 0,
      commissionPercent: parsePercent(commission) ?? 0,
    };
  }, [prefill, convenienceFee, commission]);

  const convenienceLiveError = getPercentValidationError(convenienceFee, "Convenience fee (%)");
  const commissionLiveError = getPercentValidationError(commission, "Commission (%)");
  const feesValid = !convenienceLiveError && !commissionLiveError;

  const onValid = async (values: AdminEventContractCreateValues) => {
    const convErr = getPercentValidationError(values.convenience_fee, "Convenience fee (%)");
    const commErr = getPercentValidationError(values.commission, "Commission (%)");
    if (convErr) {
      setError("convenience_fee", { type: "manual", message: convErr });
    }
    if (commErr) {
      setError("commission", { type: "manual", message: commErr });
    }
    if (convErr || commErr) return;

    const conv = parsePercent(values.convenience_fee);
    const comm = parsePercent(values.commission);
    if (conv === null || comm === null) {
      if (conv === null) {
        setError("convenience_fee", {
          type: "manual",
          message: "Enter valid fee percentages between 0 and 100.",
        });
      }
      if (comm === null) {
        setError("commission", {
          type: "manual",
          message: "Enter valid fee percentages between 0 and 100.",
        });
      }
      return;
    }

    try {
      const res = await createContract({
        event_id: values.event_id,
        body_html: values.body_html,
        terms_and_conditions: values.terms ?? "",
        convenience_fee_percent: conv,
        commission_percent: comm,
      }).unwrap();
      toast.success(
        (res as { message?: string }).message ||
          "Contract created. Sign with signature + OTP, then ask the organizer to sign."
      );
      router.push(`/admin/event-contracts/${values.event_id}`);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to create contract"));
    }
  };

  const showLivePreview = () => {
    if (!prefill?.suggested || !bodyHtml.trim()) return;
    setPreviewContract({
      id: "preview",
      event_id: eventId,
      contract_number: prefill.suggested.contract_number,
      body_html: bodyHtml,
      terms_and_conditions: terms,
      status: "PENDING_SIGNATURES",
      convenience_fee_percent: parsePercent(convenienceFee) ?? 0,
      commission_percent: parsePercent(commission) ?? 0,
      dynamic_data: dynamicPreview,
      event_name: prefill.event.name,
      organizer_name: prefill.event.organizer_name,
    });
  };

  const convenienceError = errors.convenience_fee?.message || convenienceLiveError;
  const commissionError = errors.commission?.message || commissionLiveError;

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href="/admin/event-contracts"
          className="inline-flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 mb-3"
        >
          <ArrowLeft size={16} /> Back to contracts
        </Link>
        <h2 className="text-2xl font-bold text-white">Create Event Contract</h2>
        <p className="text-zinc-400 mt-1">
          Select a pending event, review auto-filled details, compose the contract with dynamic fields,
          then open the contract and sign with your signature + email OTP. The event goes public only after the organizer also signs.
        </p>
      </div>

      <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-6">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-5">
            <h3 className="text-lg font-semibold text-white">Event & commercial terms</h3>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Select event *</label>
              <select
                className="input-field w-full"
                {...register("event_id")}
                disabled={loadingEligible}
              >
                <option value="">Select pending event…</option>
                {eligible.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} — {ev.organizer_name} ({ev.status.replace("_", " ")})
                  </option>
                ))}
              </select>
              {errors.event_id && (
                <p className="text-xs text-rose-400 font-medium mt-1">{errors.event_id.message}</p>
              )}
            </div>

            {loadingPrefill && eventId && (
              <p className="text-sm text-zinc-500 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading event details…
              </p>
            )}

            {prefill && (
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                {[
                  ["Organizer", prefill.event.organizer_name],
                  ["Category", prefill.event.category_name],
                  ["Language", prefill.event.language],
                  ["Age group", prefill.event.age_group],
                  ["Duration", prefill.event.duration_minutes ? `${prefill.event.duration_minutes} min` : "—"],
                  ["Contract #", prefill.suggested.contract_number],
                ].map(([label, val]) => (
                  <div key={label} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                    <p className="text-xs text-zinc-500">{label}</p>
                    <p className="text-zinc-200 font-medium truncate">{val || "—"}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Convenience fee (%) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className={`input-field w-full ${convenienceError ? "border-rose-500" : ""}`}
                  {...register("convenience_fee", {
                    onChange: (e) => {
                      e.target.value = sanitizePercentInput(e.target.value);
                    },
                  })}
                  placeholder="0–100"
                />
                <p className="text-xs text-zinc-500 mt-1">Charged to the customer on ticket amount.</p>
                {convenienceError && (
                  <p className="text-xs text-rose-400 font-medium mt-1">{convenienceError}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Commission (%) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className={`input-field w-full ${commissionError ? "border-rose-500" : ""}`}
                  {...register("commission", {
                    onChange: (e) => {
                      e.target.value = sanitizePercentInput(e.target.value);
                    },
                  })}
                  placeholder="0–100"
                />
                <p className="text-xs text-zinc-500 mt-1">Taken from the organizer on ticket amount.</p>
                {commissionError && (
                  <p className="text-xs text-rose-400 font-medium mt-1">{commissionError}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Terms & Conditions</label>
              <textarea
                rows={3}
                className="input-field w-full"
                {...register("terms")}
                placeholder="Optional summary terms…"
              />
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Contract details (rich text)</h3>
            <p className="text-xs text-zinc-500">
              Use <strong className="text-zinc-400">+ Insert Dynamic Field</strong> to add placeholders.
              They appear as labeled chips in the editor — not raw HTML tags.
            </p>
            <ContractRichTextEditor
              value={bodyHtml}
              onChange={(html) => setValue("body_html", html, { shouldDirty: true, shouldValidate: false })}
              minHeight="320px"
            />
            {errors.body_html && (
              <p className="text-xs text-rose-400 font-medium">{errors.body_html.message}</p>
            )}
          </div>
        </div>

        {bodyHtml && (
          <div className="glass-panel rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Live preview (merged values)</h3>
              <button
                type="button"
                onClick={showLivePreview}
                className="text-sm text-emerald-400 hover:text-emerald-300"
              >
                Refresh preview
              </button>
            </div>
            {previewContract ? (
              <EventContractDocument contract={previewContract} showSignatures={false} />
            ) : (
              <div
                className="contract-document-body rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-800"
                dangerouslySetInnerHTML={{
                  __html: htmlWithMergedValues(bodyHtml, dynamicPreview),
                }}
              />
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-end">
          <Link
            href="/admin/events"
            className="px-5 py-2.5 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={creating || !eventId || !feesValid}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            Create contract
          </button>
        </div>
      </form>
    </div>
  );
}
