"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ArrowLeft, CheckCircle, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import EventContractDocument from "@/components/EventAdminPanel/EventContractDocument";
import SignaturePad from "@/components/EventAdminPanel/SignaturePad";
import {
  useGetAdminEventContractQuery,
  useRequestAdminContractOtpMutation,
  useSignAdminEventContractMutation,
} from "@/services/api";
import { contractStatusLabel } from "@/lib/contractPlaceholders";
import { extractApiError } from "@/lib/apiErrors";
import {
  adminEventContractSignSchema,
  type AdminEventContractSignValues,
} from "@/lib/adminFormSchemas";

const fieldErrorClass = "mt-1.5 text-xs text-rose-400 font-medium";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

export default function AdminEventContractDetailPage() {
  const params = useParams();
  const eventId = String(params.eventId);
  const [otpHint, setOtpHint] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<AdminEventContractSignValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(adminEventContractSignSchema) as any,
    defaultValues: { signature_url: "", otp: "" },
    mode: "onSubmit",
  });

  const { data: contract, isLoading, isError } = useGetAdminEventContractQuery(eventId);
  const [requestOtp, { isLoading: sendingOtp }] = useRequestAdminContractOtpMutation();
  const [signAdmin, { isLoading: signing }] = useSignAdminEventContractMutation();

  const handleRequestOtp = async () => {
    try {
      const res = await requestOtp(eventId).unwrap();
      setOtpHint(res.email_hint || null);
      toast.success(res.message || "OTP sent to your email.");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to send OTP"));
    }
  };

  const onSign = async (values: AdminEventContractSignValues) => {
    try {
      await signAdmin({
        eventId,
        signature_url: values.signature_url,
        otp: values.otp.trim(),
      }).unwrap();
      toast.success("Signed as Super Admin.");
      setValue("otp", "");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to sign"));
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center text-zinc-500">Loading contract…</div>;
  }

  if (isError || !contract) {
    return (
      <div className="p-10 text-center">
        <p className="text-zinc-500">Contract not found.</p>
        <Link href="/admin/event-contracts/create" className="text-rose-400 mt-2 inline-block">
          Create contract →
        </Link>
      </div>
    );
  }

  const needsSign = !contract.admin_signed_at && contract.status === "PENDING_SIGNATURES";

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href="/admin/event-contracts"
          className="inline-flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 mb-3"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <h2 className="text-2xl font-bold text-white">{contract.event_name}</h2>
        <p className="text-zinc-400">{contractStatusLabel(contract.status)}</p>
      </div>

      <EventContractDocument contract={contract} />

      {needsSign && (
        <form
          onSubmit={handleSubmit(onSign)}
          className="glass-panel rounded-2xl border border-slate-200 p-5 space-y-5"
        >
          <h3 className="portal-heading text-lg font-semibold">Sign as Super Admin</h3>
          <p className="portal-muted text-sm">
            Upload your signature image, request OTP by email, then confirm to authorize this contract.
          </p>
          <div>
            <Controller
              name="signature_url"
              control={control}
              render={({ field }) => (
                <SignaturePad
                  value={field.value || null}
                  onChange={(url) => field.onChange(url || "")}
                  label={
                    <>
                      Super Admin signature <RequiredMark />
                    </>
                  }
                />
              )}
            />
            {errors.signature_url && (
              <p className={fieldErrorClass}>{errors.signature_url.message}</p>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="portal-label text-xs font-bold uppercase tracking-wider mb-1.5 block">
                  OTP from email <RequiredMark />
                </label>
                <input
                  {...register("otp", {
                    onChange: (e) => {
                      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    },
                  })}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  className="input-field w-full tracking-[0.25em]"
                />
                {errors.otp && <p className={fieldErrorClass}>{errors.otp.message}</p>}
                {otpHint && <p className="text-xs portal-muted mt-1">Sent to {otpHint}</p>}
              </div>
              <button
                type="button"
                disabled={sendingOtp}
                onClick={handleRequestOtp}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-50"
              >
                {sendingOtp ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                Send OTP
              </button>
              <button
                type="submit"
                disabled={signing}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {signing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Confirm &amp; sign
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
