"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle, Loader2, Mail, XCircle } from "lucide-react";
import { toast } from "sonner";
import MovieContractDocument from "@/components/MovieAdminPanel/MovieContractDocument";
import SignaturePad from "@/components/EventAdminPanel/SignaturePad";
import {
  useGetCinemaContractQuery,
  useRejectCinemaContractMutation,
  useRequestCinemaContractOtpMutation,
  useSignCinemaContractMutation,
} from "@/services/api";
import { movieContractStatusLabel } from "@/lib/movieContractPlaceholders";
import { extractApiError } from "@/lib/apiErrors";

export default function CinemaContractPage() {
  const [rejectReason, setRejectReason] = useState("");
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [otpHint, setOtpHint] = useState<string | null>(null);

  const { data: contract, isLoading, isError } = useGetCinemaContractQuery();
  const [requestOtp, { isLoading: sendingOtp }] = useRequestCinemaContractOtpMutation();
  const [sign, { isLoading: signing }] = useSignCinemaContractMutation();
  const [reject, { isLoading: rejecting }] = useRejectCinemaContractMutation();

  const handleRequestOtp = async () => {
    try {
      const res = await requestOtp().unwrap();
      setOtpHint(res.email_hint || null);
      toast.success(res.message || "OTP sent to your email.");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to send OTP"));
    }
  };

  const handleSign = async () => {
    if (!signatureUrl) {
      toast.error("Upload your signature first.");
      return;
    }
    if (!otp.trim()) {
      toast.error("Enter the OTP from your email.");
      return;
    }
    try {
      await sign({ signature_url: signatureUrl, otp: otp.trim() }).unwrap();
      toast.success(
        "Contract signed digitally. Goes ACTIVE once Super Admin signs as well."
      );
      setOtp("");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to sign contract"));
    }
  };

  const handleReject = async () => {
    try {
      await reject({ rejection_reason: rejectReason.trim() || undefined }).unwrap();
      toast.success("Contract rejected. Super Admin will review and issue revised terms.");
      setRejectReason("");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to reject contract"));
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center portal-muted">Loading contract…</div>;
  }

  if (isError || !contract) {
    return (
      <div className="p-10 text-center space-y-3">
        <p className="portal-muted">
          No contract available yet. Super Admin will prepare and issue your cinema platform
          agreement shortly.
        </p>
        <Link href="/movie/dashboard" className="text-rose-600 hover:underline">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const needsSign = contract.status === "PENDING_SIGNATURES" && !contract.cinema_signed_at;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/movie/dashboard"
          className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-800 mb-3"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <h2 className="portal-heading text-2xl font-bold">Platform contract</h2>
        <p className="portal-muted">
          {movieContractStatusLabel(contract.status)}
          {contract.contract_number ? ` · #${contract.contract_number}` : ""}
        </p>
        {contract.status === "REJECTED" && contract.rejection_reason ? (
          <p className="mt-2 text-sm text-rose-700">
            Rejection reason: {contract.rejection_reason}
          </p>
        ) : null}
        {contract.cinema_signed_at && !contract.admin_signed_at ? (
          <p className="mt-2 text-sm text-amber-700">
            You have signed. Waiting for Super Admin counter-signature.
          </p>
        ) : null}
        {contract.status === "ACTIVE" ? (
          <p className="mt-2 text-sm text-emerald-700">
            Agreement active — both parties have signed. Your cinema can publish showtimes and sell
            tickets.
          </p>
        ) : null}
      </div>

      <MovieContractDocument contract={contract} />

      {needsSign && (
        <div className="org-card p-5 space-y-5">
          <h3 className="portal-heading text-lg font-semibold">Authorize your signature</h3>
          <p className="text-sm portal-muted">
            Upload your signature image, request OTP by email, then confirm to sign this contract
            digitally.
          </p>
          <SignaturePad
            value={signatureUrl}
            onChange={setSignatureUrl}
            label="Cinema authorized representative signature"
          />
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="portal-label text-xs font-bold uppercase tracking-wider mb-1.5 block">
                OTP from email
              </label>
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit OTP"
                className="input-field w-full tracking-[0.25em]"
              />
              {otpHint && <p className="text-xs portal-muted mt-1">Sent to {otpHint}</p>}
            </div>
            <button
              type="button"
              disabled={sendingOtp}
              onClick={() => void handleRequestOtp()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
            >
              {sendingOtp ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              Send OTP
            </button>
            <button
              type="button"
              disabled={signing}
              onClick={() => void handleSign()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
            >
              {signing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              Confirm &amp; sign
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
            <input
              className="input-field flex-1"
              placeholder="Rejection reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <button
              type="button"
              disabled={rejecting}
              onClick={() => void handleReject()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
            >
              {rejecting ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              Reject contract
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
