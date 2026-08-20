"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Mail, X } from "lucide-react";
import { FaApple, FaGoogle } from "react-icons/fa";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import { usePhoneLoginMutation, useRegisterCustomerMutation } from "@/services/api";
import { useAppDispatch } from "@/lib/hooks";
import { setCredentials } from "@/features/auth/authSlice";
import { extractApiError, extractApiSuccessMessage } from "@/lib/apiErrors";
import { sanitizePhoneInput } from "@/lib/validation";
import {
  phoneLoginSchema,
  otpVerifySchema,
  customerRegisterSchema,
  type PhoneLoginValues,
  type OtpVerifyValues,
  type CustomerRegisterValues,
} from "@/lib/loginFormSchema";

type Step = "start" | "otp" | "register";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const BRAND = "#6900AA";

function isNotRegisteredError(err: unknown): boolean {
  const e = err as { status?: number; data?: { error?: string } };
  if (e?.status === 404) return true;
  const msg = String(e?.data?.error || "").toLowerCase();
  return msg.includes("not registered") || msg.includes("create an account");
}

export default function CustomerAuthModal({ open, onClose, onSuccess }: Props) {
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<Step>("start");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [phoneLogin, { isLoading: isPhoneLoading }] = usePhoneLoginMutation();
  const [registerCustomer, { isLoading: isRegistering }] = useRegisterCustomerMutation();

  const phoneForm = useForm<PhoneLoginValues>({
    resolver: yupResolver(phoneLoginSchema),
    defaultValues: { phone: "" },
    mode: "onChange",
  });

  const otpForm = useForm<OtpVerifyValues>({
    resolver: yupResolver(otpVerifySchema),
    defaultValues: { otp: "" },
    mode: "onChange",
  });

  const registerForm = useForm<CustomerRegisterValues>({
    resolver: yupResolver(customerRegisterSchema),
    defaultValues: { name: "", email: "", phone: "" },
    mode: "onBlur",
  });

  const phoneValue = phoneForm.watch("phone");
  const phoneDigits = sanitizePhoneInput(phoneValue || "");
  const canContinuePhone = phoneDigits.length >= 10 && !phoneForm.formState.errors.phone;

  const resetFlow = () => {
    setStep("start");
    setVerifiedPhone("");
    phoneForm.reset({ phone: "" });
    otpForm.reset({ otp: "" });
    registerForm.reset({ name: "", email: "", phone: "" });
  };

  useEffect(() => {
    if (!open) {
      resetFlow();
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);

  const finishAuth = (message?: string) => {
    window.dispatchEvent(new Event("auth_changed"));
    if (message) toast.success(message);
    onSuccess?.();
    onClose();
  };

  const onComingSoon = (provider: string) => {
    toast.info(`${provider} sign-in is coming soon. Please use phone number for now.`);
  };

  const onSendOtp = phoneForm.handleSubmit((values) => {
    const phone = sanitizePhoneInput(values.phone);
    setVerifiedPhone(phone);
    otpForm.reset({ otp: "" });
    setStep("otp");
    toast.success(`OTP sent to +91 ${phone}. Use demo OTP 123456.`);
  });

  const onVerifyOtp = otpForm.handleSubmit(async (values) => {
    if (values.otp !== "123456") {
      toast.error("Invalid OTP. For demo, please use 123456.");
      return;
    }
    try {
      const data = await phoneLogin({ phone: verifiedPhone, otp: values.otp }).unwrap();
      dispatch(setCredentials({ user: data.user, token: data.token }));
      finishAuth(extractApiSuccessMessage(data, "Login successful"));
    } catch (err: unknown) {
      if (isNotRegisteredError(err)) {
        registerForm.reset({ name: "", email: "", phone: verifiedPhone });
        setStep("register");
        toast.info("Phone not registered. Create an account to continue.");
        return;
      }
      toast.error(extractApiError(err, "Login failed. Please try again."));
    }
  });

  const onRegister = registerForm.handleSubmit(async (values) => {
    try {
      const data = await registerCustomer({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: sanitizePhoneInput(values.phone || verifiedPhone),
        auto_generate_password: true,
      }).unwrap();
      dispatch(setCredentials({ user: data.user, token: data.token }));
      finishAuth(extractApiSuccessMessage(data, "Account created successfully"));
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Registration failed. Please try again."));
    }
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-auth-title"
        className="relative w-full sm:max-w-[420px] 2xl:max-w-[440px] max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-10 h-8 w-8 rounded-full text-slate-500 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="px-5 sm:px-7 pt-6 sm:pt-7 pb-7 sm:pb-8">
          {step === "start" && (
            <>
              <h2
                id="customer-auth-title"
                className="text-center text-[22px] sm:text-[24px] font-extrabold text-[#1A1A1A] mb-5 sm:mb-6"
              >
                Get Started
              </h2>

              <div className="space-y-2.5 sm:space-y-3">
                <button
                  type="button"
                  onClick={() => onComingSoon("Google")}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] sm:text-[15px] font-semibold text-[#1A1A1A] hover:bg-slate-50 cursor-pointer"
                >
                  <FaGoogle className="text-[#EA4335]" size={18} />
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={() => onComingSoon("Email")}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] sm:text-[15px] font-semibold text-[#1A1A1A] hover:bg-slate-50 cursor-pointer"
                >
                  <Mail size={18} strokeWidth={1.8} />
                  Continue with Email
                </button>
                <button
                  type="button"
                  onClick={() => onComingSoon("Apple")}
                  className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] sm:text-[15px] font-semibold text-[#1A1A1A] hover:bg-slate-50 cursor-pointer"
                >
                  <FaApple size={20} />
                  Continue with Apple
                </button>
              </div>

              <div className="my-5 sm:my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] sm:text-xs font-semibold tracking-widest text-slate-400">
                  OR
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={onSendOtp} noValidate>
                <div className="flex items-end gap-3 border-b border-[#6900AA]/pb-2">
                  <div className="flex items-center gap-1.5 shrink-0 pb-0.5 text-[14px] font-semibold text-[#1A1A1A]">
                    <span aria-hidden className="text-base leading-none">
                      🇮🇳
                    </span>
                    <span>+91</span>
                    <span className="text-slate-400 text-xs">▾</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={12}
                    placeholder=""
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent border-0 outline-none text-[15px] sm:text-[16px] font-semibold text-[#1A1A1A] py-0.5"
                    {...phoneForm.register("phone", {
                      onChange: (e) => {
                        e.target.value = sanitizePhoneInput(e.target.value);
                      },
                    })}
                  />
                </div>
                {phoneForm.formState.errors.phone && (
                  <p className="mt-2 text-[11px] font-semibold text-rose-500">
                    {phoneForm.formState.errors.phone.message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!canContinuePhone || isPhoneLoading}
                  className={`mt-5 sm:mt-6 w-full rounded-xl py-3 sm:py-3.5 text-[14px] sm:text-[15px] font-bold text-white transition-colors ${
                    canContinuePhone && !isPhoneLoading
                      ? "cursor-pointer"
                      : "bg-slate-300 cursor-not-allowed"
                  }`}
                  style={canContinuePhone && !isPhoneLoading ? { backgroundColor: BRAND } : undefined}
                >
                  Continue
                </button>
              </form>
            </>
          )}

          {step === "otp" && (
            <>
              <button
                type="button"
                onClick={() => setStep("start")}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-semibold mb-4 cursor-pointer"
              >
                <ArrowLeft size={14} /> Change number
              </button>
              <h2
                id="customer-auth-title"
                className="text-center text-[22px] sm:text-[24px] font-extrabold text-[#1A1A1A] mb-2"
              >
                Enter OTP
              </h2>
              <p className="text-center text-sm text-slate-500 mb-1">
                Sent to <span className="font-bold text-slate-700">+91 {verifiedPhone}</span>
              </p>
              <p className="text-center text-xs text-amber-700 font-semibold mb-5 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                Demo OTP: <span className="tracking-widest font-black">123456</span>
              </p>
              <form onSubmit={onVerifyOtp} className="space-y-4" noValidate>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  placeholder="••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-xl tracking-[0.45em] font-extrabold text-slate-800 focus:outline-none focus:border-[#6900AA] focus:bg-white"
                  {...otpForm.register("otp", {
                    onChange: (e) => {
                      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    },
                  })}
                />
                {otpForm.formState.errors.otp && (
                  <p className="text-[11px] font-semibold text-rose-500">
                    {otpForm.formState.errors.otp.message}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isPhoneLoading}
                  className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white cursor-pointer disabled:opacity-60"
                  style={{ backgroundColor: BRAND }}
                >
                  {isPhoneLoading ? "Verifying..." : "Verify & Continue"}
                </button>
              </form>
            </>
          )}

          {step === "register" && (
            <>
              <button
                type="button"
                onClick={() => setStep("otp")}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-semibold mb-4 cursor-pointer"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <h2
                id="customer-auth-title"
                className="text-center text-[22px] sm:text-[24px] font-extrabold text-[#1A1A1A] mb-2"
              >
                Create Account
              </h2>
              <p className="text-center text-sm text-slate-500 mb-5">
                Finish signup for <span className="font-bold text-slate-700">+91 {verifiedPhone}</span>
              </p>
              <form onSubmit={onRegister} className="space-y-3.5" noValidate>
                <div>
                  <input
                    type="text"
                    placeholder="Full name"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#6900AA] focus:bg-white"
                    {...registerForm.register("name")}
                  />
                  {registerForm.formState.errors.name && (
                    <p className="mt-1.5 text-[11px] font-semibold text-rose-500">
                      {registerForm.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div>
                  <input
                    type="email"
                    placeholder="Email"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#6900AA] focus:bg-white"
                    {...registerForm.register("email")}
                  />
                  {registerForm.formState.errors.email && (
                    <p className="mt-1.5 text-[11px] font-semibold text-rose-500">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <input type="hidden" {...registerForm.register("phone")} />
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white cursor-pointer disabled:opacity-60"
                  style={{ backgroundColor: BRAND }}
                >
                  {isRegistering ? "Creating..." : "Create account"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
