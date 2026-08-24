"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Mail, X } from "lucide-react";
import { FaApple, FaGoogle } from "react-icons/fa";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import {
  useSendCustomerOtpMutation,
  useVerifyCustomerOtpMutation,
  useRegisterCustomerMutation,
} from "@/services/api";
import { useAppDispatch } from "@/lib/hooks";
import { setCredentials } from "@/features/auth/authSlice";
import { extractApiError, extractApiSuccessMessage } from "@/lib/apiErrors";
import { sanitizePhoneInput, PHONE_MIN_DIGITS } from "@/lib/validation";
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
const DIAL_CODE = "+251";
const RESEND_SECONDS = 30;

export default function CustomerAuthModal({ open, onClose, onSuccess }: Props) {
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<Step>("start");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const [sendOtp, { isLoading: isSendingOtp }] = useSendCustomerOtpMutation();
  const [verifyOtp, { isLoading: isVerifyingOtp }] = useVerifyCustomerOtpMutation();
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

  useEffect(() => {
    if (step === "register" && verifiedPhone) {
      registerForm.setValue("phone", verifiedPhone);
    }
  }, [step, verifiedPhone, registerForm]);

  const phoneValue = phoneForm.watch("phone");
  const phoneDigits = sanitizePhoneInput(phoneValue || "");
  const canContinuePhone = phoneDigits.length >= PHONE_MIN_DIGITS && !phoneForm.formState.errors.phone;

  const resetFlow = () => {
    setStep("start");
    setVerifiedPhone("");
    setVerificationToken("");
    setResendIn(0);
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

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setInterval(() => {
      setResendIn((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendIn]);

  const finishAuth = (message?: string) => {
    window.dispatchEvent(new Event("auth_changed"));
    if (message) toast.success(message);
    onSuccess?.();
    onClose();
  };

  const onComingSoon = (provider: string) => {
    toast.info(`${provider} sign-in is coming soon. Please use phone number for now.`);
  };

  const requestOtp = async (phone: string) => {
    const data = await sendOtp({ phone }).unwrap();
    setVerifiedPhone(phone);
    otpForm.reset({ otp: "" });
    setStep("otp");
    setResendIn(RESEND_SECONDS);
    toast.success(data.message || `OTP sent to ${DIAL_CODE} ${phone}.`);
    if (data.demo_otp) {
      toast.message(`Demo OTP: ${data.demo_otp}`, { duration: 8000 });
    }
  };

  const onSendOtp = phoneForm.handleSubmit(async (values) => {
    const phone = sanitizePhoneInput(values.phone);
    try {
      await requestOtp(phone);
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Could not send OTP. Please try again."));
    }
  });

  const onResendOtp = async () => {
    if (!verifiedPhone || resendIn > 0 || isSendingOtp) return;
    try {
      await requestOtp(verifiedPhone);
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Could not resend OTP."));
    }
  };

  const onVerifyOtp = otpForm.handleSubmit(async (values) => {
    try {
      const data = await verifyOtp({ phone: verifiedPhone, otp: values.otp }).unwrap();

      if (data.next === "authenticated") {
        dispatch(setCredentials({ user: data.user, token: data.token }));
        finishAuth(extractApiSuccessMessage(data, "Login successful"));
        return;
      }

      setVerificationToken(data.verification_token);
      registerForm.reset({ name: "", email: "", phone: verifiedPhone });
      setStep("register");
      toast.info("Complete your profile to create an account.");
    } catch (err: unknown) {
      toast.error(extractApiError(err, "OTP verification failed."));
    }
  });

  const onRegister = registerForm.handleSubmit(async (values) => {
    if (!verificationToken) {
      toast.error("Phone verification expired. Please verify OTP again.");
      setStep("otp");
      return;
    }
    try {
      const phone = sanitizePhoneInput(values.phone || verifiedPhone);
      const data = await registerCustomer({
        name: values.name.trim(),
        email: values.email.trim(),
        phone,
        verification_token: verificationToken,
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
                className="text-center text-[22px] sm:text-[24px] font-extrabold text-[#1A1A1A] mb-2"
              >
                Get Started
              </h2>
              <p className="text-center text-sm text-slate-500 mb-5 sm:mb-6">
                Enter your mobile number. We&apos;ll send an OTP to sign in or create an account.
              </p>

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
                      🇪🇹
                    </span>
                    <span>{DIAL_CODE}</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="Mobile number"
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
                  disabled={!canContinuePhone || isSendingOtp}
                  className={`mt-5 sm:mt-6 w-full rounded-xl py-3 sm:py-3.5 text-[14px] sm:text-[15px] font-bold text-white transition-colors ${
                    canContinuePhone && !isSendingOtp
                      ? "cursor-pointer"
                      : "bg-slate-300 cursor-not-allowed"
                  }`}
                  style={canContinuePhone && !isSendingOtp ? { backgroundColor: BRAND } : undefined}
                >
                  {isSendingOtp ? "Sending OTP..." : "Continue"}
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
                Sent to{" "}
                <span className="font-bold text-slate-700">
                  {DIAL_CODE} {verifiedPhone}
                </span>
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
                  disabled={isVerifyingOtp}
                  className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white cursor-pointer disabled:opacity-60"
                  style={{ backgroundColor: BRAND }}
                >
                  {isVerifyingOtp ? "Verifying..." : "Verify & Continue"}
                </button>
                <p className="text-center text-xs text-slate-500">
                  {resendIn > 0 ? (
                    <>Resend OTP in {resendIn}s</>
                  ) : (
                    <button
                      type="button"
                      onClick={onResendOtp}
                      disabled={isSendingOtp}
                      className="font-bold text-[#6900AA] hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Resend OTP
                    </button>
                  )}
                </p>
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
                Finish signup for{" "}
                <span className="font-bold text-slate-700">
                  {DIAL_CODE} {verifiedPhone}
                </span>
              </p>
              <form onSubmit={onRegister} className="space-y-3.5" noValidate>
                <div>
                  <input
                    type="text"
                    placeholder="Full name"
                    autoFocus
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
                <input type="hidden" {...registerForm.register("phone")} value={verifiedPhone} />
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full rounded-xl py-3.5 text-[15px] font-bold text-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
