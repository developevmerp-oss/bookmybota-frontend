"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import AuthGate from "@/components/Shared/AuthGate";
import PasswordInput from "@/components/Shared/PasswordInput";
import { useResetPasswordMutation } from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { isValidPassword } from "@/lib/validation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const validateClient = (): string | null => {
    if (!token) return "Reset link is missing or invalid. Request a new one.";
    if (!newPassword) return "New password is required.";
    if (!confirmPassword) return "Please confirm your new password.";
    if (newPassword !== confirmPassword) return "New password and confirmation do not match.";
    if (!isValidPassword(newPassword)) return "New password does not meet all requirements.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const clientErr = validateClient();
    if (clientErr) {
      setFormError(clientErr);
      return;
    }
    try {
      const res = await resetPassword({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }).unwrap();
      setDone(true);
      toast.success(res.message || "Password updated.");
    } catch (err) {
      const msg = extractApiError(err, "Could not reset password");
      setFormError(msg);
      toast.error(msg);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          <p className="text-slate-700 font-semibold">Invalid reset link</p>
          <p className="text-sm text-slate-500">
            This page needs a valid token from your email. Request a new reset link.
          </p>
          <Link href="/forgot-password" className="text-rose-600 font-semibold hover:underline text-sm">
            Request password reset →
          </Link>
        </div>
      </div>
    );
  }

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
          <h1 className="text-2xl font-black text-slate-800 mb-1">Set new password</h1>
          <p className="text-sm text-slate-500 mb-6">Choose a strong password for your account.</p>

          {done ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm px-4 py-3 flex gap-2">
                <CheckCircle size={18} className="shrink-0 mt-0.5" />
                <span>Password updated successfully. You can now log in with your new password.</span>
              </div>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-2xl py-3.5 text-sm font-bold"
              >
                Go to login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-600 text-xs font-semibold p-3.5 text-center">
                  {formError}
                </div>
              )}
              <PasswordInput
                mode="create"
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                variant="light"
                placeholder="New password"
                required
              />
              <PasswordInput
                mode="login"
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                variant="light"
                placeholder="Re-enter new password"
                required
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-2xl py-3.5 text-sm font-bold disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                {isLoading ? "Saving…" : "Reset password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthGate mode="guest">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-slate-500">Loading…</div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthGate>
  );
}
