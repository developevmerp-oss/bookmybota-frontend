"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ContractRichTextEditor from "@/components/SuperAdmin/ContractRichTextEditor";
import MovieContractDocument from "@/components/MovieAdminPanel/MovieContractDocument";
import {
  useCreateMovieContractMutation,
  useGetMovieContractPrefillQuery,
  useGetEligibleContractCinemasQuery,
  type MovieContract,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import {
  adminMovieContractCreateSchema,
  type AdminMovieContractCreateValues,
} from "@/lib/adminFormSchemas";
import { MOVIE_CONTRACT_DYNAMIC_FIELDS } from "@/lib/movieContractPlaceholders";
import { htmlWithMergedValues } from "@/lib/contractPlaceholdersShared";
import {
  getPercentValidationError,
  parsePercent,
  sanitizePercentInput,
} from "@/lib/validation";

export default function CreateMovieContractPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialBusinessId = searchParams.get("businessId") ?? "";

  const { data: eligible = [], isLoading: loadingEligible } = useGetEligibleContractCinemasQuery();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<AdminMovieContractCreateValues>({
    resolver: yupResolver(adminMovieContractCreateSchema),
    defaultValues: {
      business_id: initialBusinessId,
      body_html: "",
      terms: "",
      convenience_fee: "0",
      commission: "0",
    },
    mode: "onSubmit",
  });

  const businessId = watch("business_id");
  const convenienceFee = watch("convenience_fee") ?? "";
  const commission = watch("commission") ?? "";
  const terms = watch("terms") ?? "";
  const bodyHtml = watch("body_html") ?? "";

  const { data: prefill, isLoading: loadingPrefill } = useGetMovieContractPrefillQuery(businessId, {
    skip: !businessId,
  });

  const [previewContract, setPreviewContract] = useState<MovieContract | null>(null);
  const [createContract, { isLoading: creating }] = useCreateMovieContractMutation();

  useEffect(() => {
    if (initialBusinessId) setValue("business_id", initialBusinessId);
  }, [initialBusinessId, setValue]);

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
  }, [prefill?.suggested?.contract_number, prefill?.business?.id, setValue]);

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

  const onValid = async (values: AdminMovieContractCreateValues) => {
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
        business_id: values.business_id,
        body_html: values.body_html,
        terms_and_conditions: values.terms ?? "",
        convenience_fee_percent: conv,
        commission_percent: comm,
      }).unwrap();
      toast.success(
        (res as { message?: string }).message ||
          "Cinema contract created. Sign with signature + OTP, then ask the cinema admin to sign."
      );
      router.push(`/admin/movie-contracts/${values.business_id}`);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to create cinema contract"));
    }
  };

  const showLivePreview = () => {
    if (!prefill?.suggested || !bodyHtml.trim()) return;
    setPreviewContract({
      id: "preview",
      business_id: businessId,
      contract_number: prefill.suggested.contract_number,
      body_html: bodyHtml,
      terms_and_conditions: terms,
      status: "PENDING_SIGNATURES",
      convenience_fee_percent: parsePercent(convenienceFee) ?? 0,
      commission_percent: parsePercent(commission) ?? 0,
      dynamic_data: dynamicPreview,
      cinema_name: prefill.business.name,
      cinema_phone: prefill.business.phone,
    });
  };

  const convenienceError = errors.convenience_fee?.message || convenienceLiveError;
  const commissionError = errors.commission?.message || commissionLiveError;

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href="/admin/movie-contracts"
          className="inline-flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 mb-3"
        >
          <ArrowLeft size={16} /> Back to contracts
        </Link>
        <h2 className="text-2xl font-bold text-white">Create Cinema Contract</h2>
        <p className="text-zinc-400 mt-1">
          Select a pending cinema partner, review auto-filled details, compose the contract with dynamic fields,
          then open the contract and sign with your signature + email OTP. The cinema goes live only after the cinema admin also signs.
        </p>
      </div>

      <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-6">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-5">
            <h3 className="text-lg font-semibold text-white">Cinema &amp; commercial terms</h3>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Select Cinema Partner <span className="text-rose-500">*</span>
              </label>
              <select
                className="input-field w-full"
                {...register("business_id")}
                disabled={loadingEligible}
              >
                <option value="">Select pending cinema…</option>
                {eligible.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.contract_status === "REJECTED" ? "(Rejected — needs revision)" : ""}
                  </option>
                ))}
              </select>
              {errors.business_id && (
                <p className="text-xs text-rose-400 font-medium mt-1">{errors.business_id.message}</p>
              )}
            </div>

            {loadingPrefill && businessId && (
              <p className="text-sm text-zinc-500 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading cinema details…
              </p>
            )}

            {prefill && (
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                {[
                  ["Cinema Name", prefill.business.name],
                  ["Representative", prefill.cinema_admin?.name],
                  ["Email", prefill.cinema_admin?.email],
                  ["Phone", prefill.business.phone],
                  ["Total Screens", prefill.business.total_screens ? `${prefill.business.total_screens} screens` : "0 screens"],
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
                <p className="text-xs text-zinc-500 mt-1">Taken from the cinema on ticket amount.</p>
                {commissionError && (
                  <p className="text-xs text-rose-400 font-medium mt-1">{commissionError}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Terms &amp; Conditions</label>
              <textarea
                rows={3}
                className="input-field w-full"
                {...register("terms")}
                placeholder="Optional summary terms…"
              />
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">
              Contract details (rich text) <span className="text-rose-500">*</span>
            </h3>
            <p className="text-xs text-zinc-500">
              Use <strong className="text-zinc-400">+ Insert Dynamic Field</strong> to add placeholders.
              They appear as labeled chips in the editor — not raw HTML tags.
            </p>
            <ContractRichTextEditor
              value={bodyHtml}
              onChange={(html) => setValue("body_html", html, { shouldDirty: true, shouldValidate: false })}
              minHeight="320px"
              dynamicFields={MOVIE_CONTRACT_DYNAMIC_FIELDS}
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
              <MovieContractDocument contract={previewContract} showSignatures={false} />
            ) : (
              <div
                className="contract-document-body rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-800"
                dangerouslySetInnerHTML={{
                  __html: htmlWithMergedValues(bodyHtml, dynamicPreview, MOVIE_CONTRACT_DYNAMIC_FIELDS),
                }}
              />
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-end">
          <Link
            href="/admin/movie-contracts"
            className="px-5 py-2.5 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={creating || !businessId || !feesValid}
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
