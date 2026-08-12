"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import PasswordInput from "@/components/PasswordInput";
import { useChangePasswordMutation } from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { isValidPassword } from "@/lib/validation";

type Props = {
  /** Visual style for portal themes */
  variant?: "light" | "portal";
  className?: string;
};

export default function ChangePasswordForm({ variant = "light", className = "" }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const inputVariant = variant === "portal" ? "input-field" : "light";

  const validateClient = (): string | null => {
    if (!currentPassword) return "Current password is required.";
    if (!newPassword) return "New password is required.";
    if (!confirmPassword) return "Please confirm your new password.";
    if (newPassword !== confirmPassword) return "New password and confirmation do not match.";
    if (!isValidPassword(newPassword)) return "New password does not meet all requirements.";
    if (currentPassword === newPassword) {
      return "New password must be different from your current password.";
    }
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
      const res = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }).unwrap();
      toast.success(res.message || "Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const msg = extractApiError(err, "Failed to change password");
      setFormError(msg);
      toast.error(msg);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <Lock size={18} className="text-rose-600" />
        <h3 className={variant === "portal" ? "portal-heading font-semibold" : "font-semibold text-slate-800"}>
          Change password
        </h3>
      </div>
      <p className={variant === "portal" ? "text-sm portal-muted" : "text-sm text-slate-500"}>
        Enter your current password, then choose a strong new password.
      </p>

      {formError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm px-3 py-2.5">
          {formError}
        </div>
      )}

      <PasswordInput
        mode="login"
        label="Current password"
        value={currentPassword}
        onChange={setCurrentPassword}
        variant={inputVariant}
        placeholder="Current password"
        required
      />
      <PasswordInput
        mode="create"
        label="New password"
        value={newPassword}
        onChange={setNewPassword}
        variant={inputVariant}
        placeholder="New password"
        required
      />
      <PasswordInput
        mode="login"
        label="Confirm new password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        variant={inputVariant}
        placeholder="Re-enter new password"
        required
      />

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
      >
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
        Update password
      </button>
    </form>
  );
}
