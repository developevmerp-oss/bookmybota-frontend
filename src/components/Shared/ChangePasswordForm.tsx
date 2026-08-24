"use client";

import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import PasswordInput from "@/components/Shared/PasswordInput";
import { useChangePasswordMutation } from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import {
  adminChangePasswordSchema,
  type AdminChangePasswordValues,
} from "@/lib/adminFormSchemas";

type Props = {
  /** Visual style for portal themes */
  variant?: "light" | "portal";
  className?: string;
};

export default function ChangePasswordForm({ variant = "light", className = "" }: Props) {
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const inputVariant = variant === "portal" ? "input-field" : "light";

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AdminChangePasswordValues>({
    resolver: yupResolver(adminChangePasswordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
    mode: "onSubmit",
  });

  const currentPassword = watch("current_password");
  const newPassword = watch("new_password");
  const confirmPassword = watch("confirm_password");

  const onValid = async (values: AdminChangePasswordValues) => {
    try {
      const res = await changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
        confirm_password: values.confirm_password,
      }).unwrap();
      toast.success(res.message || "Password changed successfully.");
      reset({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (err) {
      toast.error(extractApiError(err, "Failed to change password"));
    }
  };

  return (
    <form onSubmit={handleSubmit(onValid)} className={`space-y-4 ${className}`} noValidate>
      <div className="flex items-center gap-2 mb-1">
        <Lock size={18} className="text-rose-600" />
        <h3 className={variant === "portal" ? "portal-heading font-semibold" : "font-semibold text-slate-800"}>
          Change password
        </h3>
      </div>
      <p className={variant === "portal" ? "text-sm portal-muted" : "text-sm text-slate-500"}>
        Enter your current password, then choose a strong new password.
      </p>

      <PasswordInput
        mode="login"
        label="Current password"
        value={currentPassword}
        onChange={(v) => setValue("current_password", v, { shouldValidate: true, shouldDirty: true })}
        variant={inputVariant}
        placeholder="Current password"
        required
      />
      {errors.current_password && (
        <p className="text-xs text-rose-500 font-medium -mt-2">{errors.current_password.message}</p>
      )}

      <PasswordInput
        mode="create"
        label="New password"
        value={newPassword}
        onChange={(v) => setValue("new_password", v, { shouldValidate: true, shouldDirty: true })}
        variant={inputVariant}
        placeholder="New password"
        required
      />
      {errors.new_password && (
        <p className="text-xs text-rose-500 font-medium -mt-2">{errors.new_password.message}</p>
      )}

      <PasswordInput
        mode="login"
        label="Confirm new password"
        value={confirmPassword}
        onChange={(v) => setValue("confirm_password", v, { shouldValidate: true, shouldDirty: true })}
        variant={inputVariant}
        placeholder="Re-enter new password"
        required
      />
      {errors.confirm_password && (
        <p className="text-xs text-rose-500 font-medium -mt-2">{errors.confirm_password.message}</p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
      >
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
        Update password
      </button>
    </form>
  );
}
