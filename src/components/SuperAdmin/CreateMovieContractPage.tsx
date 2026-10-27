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
  useReviseMovieContractMutation,
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
  const isRevise = searchParams.get("mode") === "revise";

  const { data: eligible = [], isLoading: loadingEligible } = useGetEligibleContractCinemasQuery(undefined, {
    skip: isRevise,
  });
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
      beverage_commission: "0",
    },
    mode: "onSubmit",
  });

  const businessId = watch("business_id");
  const convenienceFee = watch("convenience_fee") ?? "";
  const commission = watch("commission") ?? "";
  const beverageCommission = watch("beverage_commission") ?? "";
  const terms = watch("terms") ?? "";
  const bodyHtml = watch("body_html") ?? "";

  const { data: prefill, isLoading: loadingPrefill } = useGetMovieContractPrefillQuery(businessId, {
    skip: !businessId,
  });

  const [previewContract, setPreviewContract] = useState<MovieContract | null>(null);
  const [createContract, { isLoading: creating }] = useCreateMovieContractMutation();
  const [reviseContract, { isLoading: revising }] = useReviseMovieContractMutation();
  const saving = creating || revising;

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
    setValue(
      "beverage_commission",
      sanitizePercentInput(String(prefill.suggested.beverage_commission_percent ?? 0))
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
      beverageCommissionPercent: parsePercent(beverageCommission) ?? 0,
    };
  }, [prefill, convenienceFee, commission, beverageCommission]);

  const convenienceLiveError = getPercentValidationError(convenienceFee, "Convenience fee (%)");
  const commissionLiveError = getPercentValidationError(commission, "Commission (%)");
  const beverageLiveError = getPercentValidationError(beverageCommission, "Snacks & beverages commission (%)");
  const feesValid = !convenienceLiveError && !commissionLiveError && !beverageLiveError;

  const onValid = async (values: AdminMovieContractCreateValues) => {
    const convErr = getPercentValidationError(values.convenience_fee, "Convenience fee (%)");
    const commErr = getPercentValidationError(values.commission, "Commission (%)");
    const bevErr = getPercentValidationError(values.beverage_commission, "Snacks & beverages commission (%)");
    if (convErr) {
      setError("convenience_fee", { type: "manual", message: convErr });
    }
    if (commErr) {
      setError("commission", { type: "manual", message: commErr });
    }
    if (bevErr) {
      setError("beverage_commission", { type: "manual", message: bevErr });
    }
    if (convErr || commErr || bevErr) return;

    const conv = parsePercent(values.convenience_fee);
    const comm = parsePercent(values.commission);
    const bevComm = parsePercent(values.beverage_commission);
    if (conv === null || comm === null || bevComm === null) {
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
      if (bevComm === null) {
        setError("beverage_commission", {
          type: "manual",
          message: "Enter valid fee percentages between 0 and 100.",
        });
      }
      return;
    }

    try {
      if (isRevise) {
        const res = await reviseContract({
          businessId: values.business_id,
          body_html: values.body_html,
          terms_and_conditions: values.terms ?? "",
          convenience_fee_percent: conv,
          commission_percent: comm,
          beverage_commission_percent: bevComm,
        }).unwrap();
        toast.success(
          (res as { message?: string }).message ||
            "Revised contract created. Both Super Admin and Cinema must sign again to reactivate."
        );
        router.push(`/admin/movie-contracts/${values.business_id}`);
      } else {
        const res = await createContract({
          business_id: values.business_id,
          body_html: values.body_html,
          terms_and_conditions: values.terms ?? "",
          convenience_fee_percent: conv,
          commission_percent: comm,
          beverage_commission_percent: bevComm,
        }).unwrap();
        toast.success(
          (res as { message?: string }).message ||
            "Cinema contract created. Sign with signature + OTP, then ask the cinema admin to sign."
        );
        router.push(`/admin/movie-contracts/${values.business_id}`);
      }
    } catch (err) {
      toast.error(extractApiError(err, isRevise ? "Failed to revise contract" : "Failed to create cinema contract"));
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
      beverage_commission_percent: parsePercent(beverageCommission) ?? 0,
      dynamic_data: dynamicPreview,
      cinema_name: prefill.business.name,
      cinema_phone: prefill.business.phone,
    });
  };

  const convenienceError = errors.convenience_fee?.message || convenienceLiveError;
  const commissionError = errors.commission?.message || commissionLiveError;
  const beverageError = errors.beverage_commission?.message || beverageLiveError;

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href="/admin/movie-contracts"
          className="inline-flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 mb-3"
        >
          <ArrowLeft size={16} /> Back to contracts
        </Link>
        <h2 className="text-2xl font-bold text-white">
          {isRevise ? "Edit / Revise Cinema Platform Contract" : "Create Cinema Contract"}
        </h2>
        <p className="text-zinc-400 mt-1">
          {isRevise
            ? "Saving changes creates a new version awaiting dual signatures; the previous contract becomes SUPERSEDED."
            : "Select a pending cinema partner, review auto-filled details, compose the contract with dynamic fields, then open the contract and sign with your signature + email OTP. The cinema goes live only after the cinema admin also signs."}
        </p>
      </div>

      {isRevise ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Saving a revision supersedes the active contract. A new contract version will be created, requiring fresh signatures from Super Admin and the Cinema Partner.
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-6">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-5">
            <h3 className="text-lg font-semibold text-white">Cinema &amp; commercial terms</h3>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Select Cinema Partner <span className="text-rose-500">*</span>
              </label>
              {isRevise ? (
                <input
                  type="text"
                  readOnly
                  className="input-field w-full opacity-80 cursor-not-allowed"
                  value={prefill?.business?.name ?? "Selected cinema"}
                />
              ) : (
                <select
                  className="input-field w-full"
                  {...register("business_id")}
                  disabled={loadingEligible}
                >
                  <option value="">Select pending cinema…</option>
                  {eligible.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.contract_status === "REJECTED" ? "(rejected — re-issue)" : ""}
                    </option>
                  ))}
                </select>
              )}
              {errors.business_id && (
                <p className="text-xs text-rose-400 font-medium mt-1">{errors.business_id.message}</p>
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Convenience Fee (%) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="input-field w-full"
                  {...register("convenience_fee", {
                    onChange: (e) => {
                      e.target.value = sanitizePercentInput(e.target.value);
                    },
                  })}
                />
                {convenienceError && (
                  <p className="text-xs text-rose-400 font-medium mt-1">{convenienceError}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Commission (%) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="input-field w-full"
                  {...register("commission", {
                    onChange: (e) => {
                      e.target.value = sanitizePercentInput(e.target.value);
                    },
                  })}
                />
                {commissionError && (
                  <p className="text-xs text-rose-400 font-medium mt-1">{commissionError}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Snacks/Bev Comm (%) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="input-field w-full"
                  {...register("beverage_commission", {
                    onChange: (e) => {
                      e.target.value = sanitizePercentInput(e.target.value);
                    },
                  })}
                />
                {beverageError && (
                  <p className="text-xs text-rose-400 font-medium mt-1">{beverageError}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Contract Terms &amp; Conditions (Optional)
              </label>
              <textarea
                rows={3}
                className="input-field w-full"
                placeholder="Additional specific terms, cancellation clauses, or penalty details..."
                {...register("terms")}
              />
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">Contract Body</h3>
            <p className="text-xs text-zinc-400">
              Use available dynamic placeholders like &#123;&#123;cinemaName&#125;&#125;, &#123;&#123;commissionPercent&#125;&#125;, etc.
            </p>
            <ContractRichTextEditor
              value={bodyHtml}
              onChange={(html) => setValue("body_html", html)}
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
            disabled={saving || !businessId || !feesValid}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {isRevise ? "Issue Revised Contract" : "Create contract"}
          </button>
        </div>
      </form>
    </div>
  );
}
