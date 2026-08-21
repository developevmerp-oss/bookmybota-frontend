"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import AuthGate from "@/components/Shared/AuthGate";
import { useForgotPasswordMutation } from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = email.trim();
    if (!trimmed) {
      setFormError("Email is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFormError("Enter a valid email address.");
      return;
    }
    try {
      const res = await forgotPassword({ email: trimmed }).unwrap();
      setSent(true);
      setHint(res.email_hint || null);
      toast.success(res.message || "If that email exists, a reset link was sent.");
    } catch (err) {
      const msg = extractApiError(err, "Could not send reset email");
      setFormError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6"
        >
          <ArrowLeft size={16} /> Back to login
        </Link>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-2xl font-black text-slate-800 mb-1">Forgot password</h1>
          <p className="text-sm text-slate-500 mb-6">
            Enter the email for your Business / Admin account. We&apos;ll send a reset link if it
            exists.
          </p>

          {sent ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm px-4 py-3">
                If an account exists for that email, a password reset link has been sent.
                {hint && (
                  <p className="mt-2 text-xs text-emerald-700">
                    Dev mode: check the backend console for the email to {hint}.
                  </p>
                )}
              </div>
              <p className="text-sm text-slate-500">
                Didn&apos;t get it? Check spam, or{" "}
                <button
                  type="button"
                  className="text-rose-600 font-semibold hover:underline"
                  onClick={() => {
                    setSent(false);
                    setHint(null);
                  }}
                >
                  try again
                </button>
                .
              </p>
              <Link
                href="/login"
                className="inline-flex w-full justify-center items-center gap-2 rounded-2xl bg-slate-800 text-white py-3 text-sm font-bold"
              >
                Return to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-600 text-xs font-semibold p-3.5 text-center">
                  {formError}
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
                  Email address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:border-rose-400 focus:bg-white text-slate-800 font-semibold"
                    placeholder="you@example.com"
                    required
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-2xl py-3.5 text-sm font-bold transition-all disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                {isLoading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthGate mode="guest" guestRoles={[]}>
      <ForgotPasswordForm />
    </AuthGate>
  );
}
