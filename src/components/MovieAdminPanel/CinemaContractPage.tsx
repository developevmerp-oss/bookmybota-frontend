"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle, FileText, History, Loader2, Mail, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DetailFormShimmer } from "@/components/Shared/Shimmer";
import MovieContractDocument from "@/components/MovieAdminPanel/MovieContractDocument";
import SignaturePad from "@/components/EventAdminPanel/SignaturePad";
import {
  useGetCinemaContractQuery,
  useGetCinemaContractHistoryQuery,
  useRejectCinemaContractMutation,
  useRequestCinemaContractOtpMutation,
  useSignCinemaContractMutation,
  type MovieContract,
} from "@/services/api";
import { movieContractStatusLabel } from "@/lib/movieContractPlaceholders";
import { extractApiError } from "@/lib/apiErrors";

type ContractTab = "current" | "old";

export default function CinemaContractPage() {
  const [tab, setTab] = useState<ContractTab>("current");
  const [rejectReason, setRejectReason] = useState("");
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [selectedOldContract, setSelectedOldContract] = useState<MovieContract | null>(null);

  const { data: contract, isLoading, isError } = useGetCinemaContractQuery();
  const { data: history } = useGetCinemaContractHistoryQuery();
  const [requestOtp, { isLoading: sendingOtp }] = useRequestCinemaContractOtpMutation();
  const [sign, { isLoading: signing }] = useSignCinemaContractMutation();
  const [reject, { isLoading: rejecting }] = useRejectCinemaContractMutation();

  const oldVersions = (history?.contracts ?? []).filter((c) => !c.is_current);

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
    try {
      await reject({ rejection_reason: rejectReason.trim() || undefined }).unwrap();
      toast.success("Contract rejected. Super Admin will review and issue revised terms.");
      setRejectReason("");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to reject contract"));
    }
  };

  if (isLoading) return <DetailFormShimmer />;

  const needsSign = !!contract && contract.status === "PENDING_SIGNATURES" && !contract.cinema_signed_at;

  const tabClass = (active: boolean) =>
    `w-full flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition-colors cursor-pointer ${
      active ? "bg-rose-50 text-[#e11d48] border border-rose-200" : "text-slate-700 border border-transparent hover:bg-slate-50"
    }`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[15rem_minmax(0,1fr)] gap-5 items-start">
      {/* Left: contract options */}
      <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-1.5 md:sticky md:top-20">
        <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Contract</p>
        <button
          type="button"
          className={tabClass(tab === "current")}
          onClick={() => setTab("current")}
        >
          <FileText size={16} className="shrink-0" /> Current contract
        </button>
        <button
          type="button"
          className={tabClass(tab === "old")}
          onClick={() => {
            setTab("old");
            setSelectedOldContract(null);
          }}
        >
          <History size={16} className="shrink-0" />
          <span className="flex-1">Old contracts</span>
          {oldVersions.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              {oldVersions.length}
            </span>
          )}
        </button>
      </aside>

      {/* Right: selected view */}
      <section className="min-w-0 space-y-5">
        {tab === "current" ? (
          isError || !contract ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <FileText size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-600">
                No contract available yet. Super Admin will prepare and issue your cinema platform agreement shortly.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">Current contract</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {movieContractStatusLabel(contract.status)} · v{contract.version ?? 1}
                  {contract.contract_number ? ` · #${contract.contract_number}` : ""}
                </p>
                {contract.status === "REJECTED" && contract.rejection_reason ? (
                  <p className="mt-2 text-sm text-rose-700">Rejection reason: {contract.rejection_reason}</p>
                ) : null}
                {contract.cinema_signed_at && !contract.admin_signed_at ? (
                  <p className="mt-2 text-sm text-amber-700">
                    You have signed. Waiting for Super Admin counter-signature.
                  </p>
                ) : null}
                {contract.status === "ACTIVE" ? (
                  <p className="mt-2 text-sm text-emerald-700">
                    Agreement active — both parties have signed. Your cinema can publish showtimes and sell tickets.
                  </p>
                ) : null}
              </div>

              <MovieContractDocument contract={contract} />

              {needsSign && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Sign this contract</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Upload your signature, request an OTP by email, then confirm to sign digitally.
                    </p>
                  </div>
                  <SignaturePad
                    value={signatureUrl}
                    onChange={setSignatureUrl}
                    label="Cinema authorized representative signature"
                  />
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                    <div className="flex-1">
                      <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block text-slate-600">
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
                      {otpHint && <p className="text-xs text-slate-500 mt-1">Sent to {otpHint}</p>}
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
            </>
          )
        ) : selectedOldContract ? (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <button
                type="button"
                onClick={() => setSelectedOldContract(null)}
                className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-800 mb-2 cursor-pointer"
              >
                <ArrowLeft size={16} /> Back to old contracts
              </button>
              <h2 className="text-xl font-bold text-slate-900">
                Contract v{selectedOldContract.version ?? "—"}
                {selectedOldContract.contract_number ? ` · #${selectedOldContract.contract_number}` : ""}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {movieContractStatusLabel(selectedOldContract.status)} · Superseded
              </p>
            </div>
            <MovieContractDocument contract={selectedOldContract} />
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Old contracts</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Earlier versions that were replaced when a revised agreement was issued. Select one to read it.
              </p>
            </div>
            {oldVersions.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No old contracts yet.</p>
            ) : (
              <ul className="space-y-2">
                {oldVersions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedOldContract(c)}
                      className="w-full flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-rose-300 hover:bg-rose-50/40 transition-colors cursor-pointer"
                    >
                      <span className="text-sm font-semibold text-slate-800">
                        {c.contract_number ? `#${c.contract_number} · ` : ""}v{c.version ?? "—"}
                        <span className="ml-2 font-normal text-slate-500">{movieContractStatusLabel(c.status)}</span>
                      </span>
                      <span className="text-xs font-semibold text-rose-600">View</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
