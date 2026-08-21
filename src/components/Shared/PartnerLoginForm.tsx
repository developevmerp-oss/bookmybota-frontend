"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import { Lock, Mail } from "lucide-react";
import { useLoginMutation } from "@/services/api";
import { useAppDispatch } from "@/lib/hooks";
import { setCredentials } from "@/features/auth/authSlice";
import { homePathForRole, type UserRole } from "@/lib/authStorage";
import { extractApiError, extractApiSuccessMessage } from "@/lib/apiErrors";
import PasswordInput from "@/components/Shared/PasswordInput";
import { businessLoginSchema, type BusinessLoginValues } from "@/lib/loginFormSchema";
import type { ReactNode } from "react";

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";
const inputBase =
  "w-full bg-slate-50 border rounded-2xl py-3.5 text-sm focus:outline-none focus:bg-white text-slate-800 font-semibold transition-all";
const inputOk = "border-slate-200 focus:border-slate-400";
const inputErr = "border-rose-300 focus:border-rose-400";

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super Admin",
  business_admin: "Dining Admin",
  event_admin: "Event Organizer",
  customer: "Customer",
};

type PartnerLoginFormProps = {
  expectedRole: Exclude<UserRole, "customer">;
  title: string;
  subtitle: string;
  hint?: ReactNode;
  /** page = full-page shell; embedded = card only (for modals) */
  variant?: "page" | "embedded";
  showCustomerLink?: boolean;
  titleId?: string;
};

export default function PartnerLoginForm({
  expectedRole,
  title,
  subtitle,
  hint,
  variant = "page",
  showCustomerLink = true,
  titleId,
}: PartnerLoginFormProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();

  const form = useForm<BusinessLoginValues>({
    resolver: yupResolver(businessLoginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const data = await login({
        email: values.email.trim(),
        password: values.password,
      }).unwrap();

      if (data.user.role !== expectedRole) {
        toast.error(
          `This account is ${ROLE_LABEL[data.user.role] || data.user.role}. Please use the correct login page.`
        );
        return;
      }

      dispatch(setCredentials({ user: data.user, token: data.token }));
      window.dispatchEvent(new Event("auth_changed"));
      toast.success(extractApiSuccessMessage(data, "Login successful"));
      router.push(homePathForRole(data.user.role));
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Invalid credentials"));
    }
  });

  const card = (
    <div className="bg-white rounded-3xl border border-[#EDEDED] shadow-sm overflow-hidden p-8">
      <h2 id={titleId} className="text-2xl font-black text-slate-800 mb-1">
        {title}
      </h2>
      <p className="text-sm text-slate-400 font-medium mb-7">{subtitle}</p>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">
            Email Address <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-3.5 text-slate-400" />
            <input
              type="email"
              autoFocus
              placeholder="admin@business.com"
              className={`${inputBase} pl-10 pr-4 ${
                form.formState.errors.email ? inputErr : inputOk
              }`}
              {...form.register("email")}
            />
          </div>
          {form.formState.errors.email && (
            <p className={fieldErrorClass}>{form.formState.errors.email.message}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Password <span className="text-rose-500">*</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] font-semibold text-[#6900AA] hover:text-[#57008E]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-4 top-3.5 text-slate-400 z-10 pointer-events-none"
            />
            <Controller
              name="password"
              control={form.control}
              render={({ field }) => (
                <PasswordInput
                  mode="login"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="••••••••"
                  inputClassName={`w-full bg-slate-50 border rounded-2xl pl-10 pr-11 py-3.5 text-sm focus:outline-none focus:bg-white text-slate-800 font-semibold transition-all ${
                    form.formState.errors.password ? inputErr : inputOk
                  }`}
                />
              )}
            />
          </div>
          {form.formState.errors.password && (
            <p className={fieldErrorClass}>{form.formState.errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-2xl py-3.5 text-sm font-bold transition-all shadow-md cursor-pointer flex justify-center items-center gap-2 mt-2 disabled:opacity-60"
        >
          {isLoading ? "Logging in..." : "Log In"}
        </button>
      </form>

      {hint ? (
        <div className="mt-6 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
          {hint}
        </div>
      ) : null}

      {showCustomerLink ? (
        <p className="mt-5 text-center text-[11px] text-slate-400">
          Customer login?{" "}
          <Link href="/login" className="text-[#6900AA] font-semibold hover:underline">
            Go to customer login
          </Link>
        </p>
      ) : null}
    </div>
  );

  if (variant === "embedded") {
    return <div className="w-full max-w-md">{card}</div>;
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10 bg-[#F7F7F7]">
      <div className="w-full max-w-md">{card}</div>
    </div>
  );
}
