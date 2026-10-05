"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, /* Mail, */ X } from "lucide-react";
// import { FaApple, FaGoogle } from "react-icons/fa";
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
import { lockBodyScroll } from "@/lib/lockBodyScroll";
import {
  phoneLoginSchema,
  otpVerifySchema,
  customerRegisterSchema,
  type PhoneLoginValues,
  type OtpVerifyValues,
  type CustomerRegisterValues,
} from "@/lib/loginFormSchema";
import images from "@/Images";

type Step = "start" | "otp" | "register";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

const DIAL_CODE = "+251";
const RESEND_SECONDS = 30;
const BTN_BLACK = "#111111";

const logoSrc =
  typeof images.logo === "string" ? images.logo : images.logo.src;

export default function CustomerAuthModal({ open, onClose, onSuccess }: Props) {
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<Step>("start");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [dynamicOtp, setDynamicOtp] = useState<string>("");

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
    setDynamicOtp("");
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
    const unlock = lockBodyScroll();
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
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

  // Social providers temporarily hidden — keep for restore
  // const onComingSoon = (provider: string) => {
  //   toast.info(`${provider} sign-in is coming soon. Please use phone number for now.`);
  // };

  const requestOtp = async (phone: string) => {
    const data = await sendOtp({ phone }).unwrap();
    setVerifiedPhone(phone);
    const receivedOtp = data.demo_otp || "";
    setDynamicOtp(receivedOtp);
    otpForm.reset({ otp: receivedOtp });
    setStep("otp");
    setResendIn(RESEND_SECONDS);
    toast.success(data.message || `OTP sent to ${DIAL_CODE} ${phone}.`);
    if (receivedOtp) {
      toast.message(`Your OTP is: ${receivedOtp}`, { duration: 8000 });
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

  const primaryBtnClass =
    "w-full rounded-xl py-3.5 sm:py-4 text-[15px] sm:text-[16px] font-bold text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

  const fieldClass =
    "rounded-xl border border-slate-300 bg-white outline-none text-[#1A1A1A] placeholder:text-slate-400 focus:border-brand-4 focus:ring-2 focus:ring-brand-100";

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[3px] p-0 sm:p-5"
      data-scroll-lock-container
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-auth-title"
        className="relative w-full sm:max-w-[460px] md:max-w-[500px] max-h-[94vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand header — white so the official logo (black + colorful “my”) reads correctly */}
        <div className="relative overflow-hidden rounded-t-[28px]">
          <div
            className="h-1.5 w-full"
            style={{
              background:
                "linear-gradient(90deg, #2563EB 0%, #7C3AED 45%, #DB2777 100%)",
            }}
            aria-hidden
          />
          <div className="relative px-6 sm:px-8 pt-10 sm:pt-12 pb-6 sm:pb-7 text-center bg-white">
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="absolute top-3.5 right-3.5 z-10 h-9 w-9 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 flex items-center justify-center cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center">
              <img
                src={logoSrc}
                alt="Book My Bota"
                className="h-14 sm:h-16 w-auto max-w-[280px] sm:max-w-[320px] object-contain"
              />
              <p className="mt-3 sm:mt-3.5 text-[13px] sm:text-[14px] text-[#1A1A1A] font-medium leading-snug max-w-[18rem] sm:max-w-[20rem]">
                Experience the best in Dining, Movies, and Events
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 sm:px-9 pt-7 sm:pt-8 pb-8 sm:pb-10">
          {step === "start" && (
            <>
              <h2
                id="customer-auth-title"
                className="text-center text-[22px] sm:text-[24px] font-bold text-[#1A1A1A] mb-2"
              >
                Enter your mobile number
              </h2>
              <p className="text-center text-[13px] sm:text-[15px] text-slate-500 mb-6 sm:mb-7">
                If you don&apos;t have an account yet, we&apos;ll create one for you.
              </p>

              {/* Social login — temporarily commented (restore when ready)
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
              */}

              <form onSubmit={onSendOtp} noValidate>
                <div className="flex items-stretch gap-2.5 sm:gap-3">
                  <div
                    className={`flex items-center gap-1.5 shrink-0 px-3 sm:px-3.5 py-3 sm:py-3.5 text-[14px] sm:text-[15px] font-semibold ${fieldClass}`}
                  >
                    <span aria-hidden className="text-lg leading-none">
                      🇪🇹
                    </span>
                    <span>{DIAL_CODE}</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="Enter mobile number"
                    autoFocus
                    className={`min-w-0 flex-1 px-3.5 sm:px-4 py-3 sm:py-3.5 text-[14px] sm:text-[15px] font-medium ${fieldClass}`}
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
                  className={`${primaryBtnClass} mt-5 sm:mt-6`}
                  style={{
                    backgroundColor:
                      canContinuePhone && !isSendingOtp ? BTN_BLACK : "#C8C8C8",
                  }}
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
                className="text-center text-[22px] sm:text-[24px] font-bold text-[#1A1A1A] mb-2"
              >
                Enter OTP
              </h2>
              <p className="text-center text-[13px] sm:text-[15px] text-slate-500 mb-1">
                Sent to{" "}
                <span className="font-bold text-slate-700">
                  {DIAL_CODE} {verifiedPhone}
                </span>
              </p>
              <p className="text-center text-xs text-amber-700 font-semibold mb-5 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                One-Time Password:{" "}
                <span className="tracking-widest font-black text-amber-900 text-sm">
                  {dynamicOtp || "123456"}
                </span>
              </p>
              <form onSubmit={onVerifyOtp} className="space-y-4" noValidate>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  placeholder="••••••"
                  className={`w-full px-4 py-3.5 text-center text-xl tracking-[0.45em] font-extrabold ${fieldClass}`}
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
                  className={primaryBtnClass}
                  style={{ backgroundColor: BTN_BLACK }}
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
                      className="font-bold text-brand-4 hover:underline cursor-pointer disabled:opacity-50"
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
                className="text-center text-[22px] sm:text-[24px] font-bold text-[#1A1A1A] mb-2"
              >
                Create Account
              </h2>
              <p className="text-center text-[13px] sm:text-[15px] text-slate-500 mb-5">
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
                    className={`w-full px-4 py-3.5 text-sm font-semibold ${fieldClass}`}
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
                    className={`w-full px-4 py-3.5 text-sm font-semibold ${fieldClass}`}
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
                  className={primaryBtnClass}
                  style={{ backgroundColor: BTN_BLACK }}
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

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
