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
  const [showRejectForm, setShowRejectForm] = useState(false);
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
      toast.success("Contract signed digitally. Goes ACTIVE once Super Admin signs as well.");
      setOtp("");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to sign contract"));
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejecting the contract.");
      return;
    }
    try {
      await reject({ rejection_reason: rejectReason.trim() }).unwrap();
      toast.success("Contract rejected. Super Admin will review and issue revised terms.");
      setShowRejectForm(false);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to reject contract"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 size={24} className="animate-spin text-fuchsia-500" />
          <span>Loading contract details…</span>
        </div>
      </div>
    );
  }

  if (isError || !contract) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <CheckCircle size={24} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No Contract Yet</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Super Admin will prepare and issue your cinema platform agreement shortly. Once issued, you can review terms, upload your signature, and sign with email OTP here.
          </p>
          <div>
            <Link
              href="/movie/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 transition-colors shadow-sm"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const needsSign = contract.status === "PENDING_SIGNATURES" && !contract.cinema_signed_at;

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-4 px-4 sm:px-6">
      <div>
        <Link
          href="/movie/dashboard"
          className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-700 font-medium mb-3"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Cinema Platform Agreement</h2>
            <p className="text-slate-500 text-sm">Contract #{contract.contract_number}</p>
          </div>
          <span
            className={`inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold ${
              contract.status === "ACTIVE"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : contract.status === "REJECTED"
                ? "bg-rose-50 text-rose-700 border border-rose-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            {movieContractStatusLabel(contract.status)}
          </span>
        </div>
      </div>

      {contract.status === "ACTIVE" && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm flex items-center gap-3">
          <CheckCircle size={20} className="shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Agreement Active &amp; Verified</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Both parties have signed this agreement. Your cinema is fully enabled to publish screens, showtimes, and sell tickets on BookMyBota.
            </p>
          </div>
        </div>
      )}

      {contract.status === "REJECTED" && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-center gap-3">
          <XCircle size={20} className="shrink-0 text-rose-600" />
          <div>
            <p className="font-semibold">Contract Rejected</p>
            <p className="text-xs text-rose-700 mt-0.5">
              Reason: {contract.rejection_reason || "No reason given"}. The platform admin will revise the terms and re-issue a contract.
            </p>
          </div>
        </div>
      )}

      {contract.cinema_signed_at && !contract.admin_signed_at && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          ✓ You have signed the agreement. Waiting for Super Admin counter-signature to complete activation.
        </div>
      )}

      <MovieContractDocument contract={contract} />

      {needsSign && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Authorize &amp; Sign Agreement</h3>
            <p className="text-sm text-slate-500 mt-1">
              Upload your signature image, request an email OTP for verification, and submit to digitally sign.
            </p>
          </div>

          <SignaturePad
            value={signatureUrl}
            onChange={setSignatureUrl}
            label="Cinema Authorized Representative Signature"
          />

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 block">
                  Email OTP
                </label>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  className="input-field w-full tracking-[0.25em] bg-white text-slate-950 border border-slate-300 rounded-xl px-4 py-2.5 text-base font-semibold focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none shadow-sm placeholder:text-slate-400"
                />
                {otpHint && (
                  <p className="text-xs text-slate-500 mt-1">OTP sent to {otpHint}</p>
                )}
              </div>
              <button
                type="button"
                disabled={sendingOtp}
                onClick={handleRequestOtp}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
              >
                {sendingOtp ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Mail size={16} />
                )}
                Send OTP
              </button>
              <button
                type="button"
                disabled={signing}
                onClick={handleSign}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium disabled:opacity-50 transition-colors shadow-sm"
              >
                {signing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CheckCircle size={16} />
                )}
                Sign Agreement
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Do not agree with these commercial terms or clauses?
            </span>
            <button
              type="button"
              onClick={() => setShowRejectForm(!showRejectForm)}
              className="text-xs text-rose-600 hover:text-rose-700 font-medium"
            >
              {showRejectForm ? "Cancel rejection" : "Reject Contract"}
            </button>
          </div>

          {showRejectForm && (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-3">
              <label className="text-xs font-semibold text-rose-700 block">
                Reason for Rejection
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Explain which terms need revision (e.g. commission %, fee structures, payout schedules)..."
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                disabled={rejecting}
                onClick={handleReject}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                {rejecting && <Loader2 size={14} className="animate-spin" />}
                Confirm Rejection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
