"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle, Loader2, Mail, XCircle } from "lucide-react";
import { toast } from "sonner";
import EventContractDocument from "@/components/EventContractDocument";
import SignaturePad from "@/components/SignaturePad";
import {
  useGetOrganizerEventContractQuery,
  useRejectOrganizerEventContractMutation,
  useRequestOrganizerContractOtpMutation,
  useSignOrganizerEventContractMutation,
} from "@/services/api";
import { contractStatusLabel } from "@/lib/contractPlaceholders";
import { extractApiError } from "@/lib/apiErrors";

export default function OrganizerContractPage() {
  const params = useParams();
  const eventId = String(params.id);
  const [rejectReason, setRejectReason] = useState("");
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [otpHint, setOtpHint] = useState<string | null>(null);

  const { data: contract, isLoading, isError } = useGetOrganizerEventContractQuery(eventId, {
    skip: !eventId,
  });
  const [requestOtp, { isLoading: sendingOtp }] = useRequestOrganizerContractOtpMutation();
  const [sign, { isLoading: signing }] = useSignOrganizerEventContractMutation();
  const [reject, { isLoading: rejecting }] = useRejectOrganizerEventContractMutation();

  const handleRequestOtp = async () => {
    try {
      const res = await requestOtp(eventId).unwrap();
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
      await sign({ eventId, signature_url: signatureUrl, otp: otp.trim() }).unwrap();
      toast.success("Contract signed. Event goes public once Super Admin has also signed.");
      setOtp("");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to sign"));
    }
  };

  const handleReject = async () => {
    try {
      await reject({ eventId, rejection_reason: rejectReason }).unwrap();
      toast.success("Contract rejected.");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to reject"));
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center portal-muted">Loading contract…</div>;
  }

  if (isError || !contract) {
    return (
      <div className="p-10 text-center space-y-3">
        <p className="portal-muted">
          No contract available yet. Super Admin will create it after reviewing your event.
        </p>
        <Link href="/organizer/events" className="text-violet-600 hover:underline">
          ← Back to My Events
        </Link>
      </div>
    );
  }

  const needsSign = contract.status === "PENDING_SIGNATURES" && !contract.organizer_signed_at;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/organizer/events"
          className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800 mb-3"
        >
          <ArrowLeft size={16} /> Back to My Events
        </Link>
        <h2 className="portal-heading text-2xl font-bold">Platform contract</h2>
        <p className="portal-muted">{contractStatusLabel(contract.status)}</p>
      </div>

      <EventContractDocument contract={contract} />

      {needsSign && (
        <div className="glass-panel rounded-2xl p-5 space-y-5">
          <h3 className="portal-heading text-lg font-semibold">Authorize your signature</h3>
          <p className="text-sm portal-muted">
            Upload your signature image, request OTP by email, then confirm to sign this contract
            digitally.
          </p>
          <SignaturePad value={signatureUrl} onChange={setSignatureUrl} label="Organizer signature" />
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
              onClick={handleRequestOtp}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            >
              {sendingOtp ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              Send OTP
            </button>
            <button
              type="button"
              disabled={signing}
              onClick={handleSign}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 disabled:opacity-50"
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
              onClick={handleReject}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              <XCircle size={16} /> Reject contract
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
