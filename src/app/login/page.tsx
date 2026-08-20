"use client";

import { useState } from "react";
import { Phone, ChevronRight, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import { usePhoneLoginMutation, useRegisterCustomerMutation } from "@/services/api";
import { useAppDispatch } from "@/lib/hooks";
import { setCredentials } from "@/features/auth/authSlice";
import { extractApiError, extractApiSuccessMessage } from "@/lib/apiErrors";
import AuthGate from "@/components/Shared/AuthGate";
import { sanitizePhoneInput } from "@/lib/validation";
import {
  phoneLoginSchema,
  otpVerifySchema,
  customerRegisterSchema,
  type PhoneLoginValues,
  type OtpVerifyValues,
  type CustomerRegisterValues,
} from "@/lib/loginFormSchema";

type CustomerStep = "phone" | "otp" | "register";

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";
const inputBase =
  "w-full bg-slate-50 border rounded-2xl py-3.5 text-sm focus:outline-none focus:bg-white text-slate-800 font-semibold transition-all";
const inputOk = "border-slate-200 focus:border-[#6900AA]";
const inputErr = "border-rose-300 focus:border-rose-400";
const labelClass =
  "text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block";

function FormLabel({
  children,
  required = false,
  className = labelClass,
}: {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={className}>
      {children}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
  );
}

function CustomerLoginForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [customerStep, setCustomerStep] = useState<CustomerStep>("phone");
  const [verifiedPhone, setVerifiedPhone] = useState("");

  const [phoneLogin, { isLoading: isPhoneLoading }] = usePhoneLoginMutation();
  const [registerCustomer, { isLoading: isRegistering }] = useRegisterCustomerMutation();

  const phoneForm = useForm<PhoneLoginValues>({
    resolver: yupResolver(phoneLoginSchema),
    defaultValues: { phone: "" },
    mode: "onBlur",
  });

  const otpForm = useForm<OtpVerifyValues>({
    resolver: yupResolver(otpVerifySchema),
    defaultValues: { otp: "" },
    mode: "onBlur",
  });

  const registerForm = useForm<CustomerRegisterValues>({
    resolver: yupResolver(customerRegisterSchema),
    defaultValues: { name: "", email: "", phone: "" },
    mode: "onBlur",
  });

  const onSendOtp = phoneForm.handleSubmit((values) => {
    const phone = sanitizePhoneInput(values.phone);
    setVerifiedPhone(phone);
    otpForm.reset({ otp: "" });
    setCustomerStep("otp");
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
      window.dispatchEvent(new Event("auth_changed"));
      toast.success(extractApiSuccessMessage(data, "Login successful"));
      router.push("/");
    } catch (err: unknown) {
      const msg = extractApiError(err, "Login failed");
      if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("register")) {
        registerForm.reset({ name: "", email: "", phone: verifiedPhone });
        setCustomerStep("register");
        toast.message("New number — please create an account");
        return;
      }
      toast.error(msg);
    }
  });

  const onRegister = registerForm.handleSubmit(async (values) => {
    try {
      const data = await registerCustomer({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: sanitizePhoneInput(values.phone),
      }).unwrap();
      dispatch(setCredentials({ user: data.user, token: data.token }));
      window.dispatchEvent(new Event("auth_changed"));
      toast.success(extractApiSuccessMessage(data, "Account created"));
      router.push("/");
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Registration failed"));
    }
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10 bg-[#F7F7F7]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl border border-[#EDEDED] shadow-sm overflow-hidden p-8">
          {customerStep === "phone" && (
            <div>
              <h2 className="text-2xl font-black text-slate-800 mb-1">Customer Login</h2>
              <p className="text-sm text-slate-400 font-medium mb-7">
                Sign in with your mobile number
              </p>

              <form onSubmit={onSendOtp} className="space-y-5" noValidate>
                <div>
                  <FormLabel required>Mobile Number</FormLabel>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-500 font-bold text-sm">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={12}
                      autoFocus
                      placeholder="9876543210"
                      className={`${inputBase} pl-14 pr-4 ${
                        phoneForm.formState.errors.phone ? inputErr : inputOk
                      }`}
                      {...phoneForm.register("phone", {
                        onChange: (e) => {
                          e.target.value = sanitizePhoneInput(e.target.value);
                        },
                      })}
                    />
                  </div>
                  {phoneForm.formState.errors.phone && (
                    <p className={fieldErrorClass}>{phoneForm.formState.errors.phone.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#6900AA] hover:bg-[#57008E] text-white rounded-2xl py-3.5 text-sm font-bold transition-all shadow-sm cursor-pointer flex justify-center items-center gap-2"
                >
                  <Phone size={16} />
                  Send OTP
                  <ChevronRight size={16} />
                </button>
              </form>

              <p className="mt-6 text-center text-[11px] text-slate-400">
                Partner login?{" "}
                <Link href="/business/login" className="text-[#6900AA] font-semibold hover:underline">
                  Dining
                </Link>
                {" · "}
                <Link href="/organizer/login" className="text-[#6900AA] font-semibold hover:underline">
                  Events
                </Link>
                {" · "}
                <Link href="/admin/login" className="text-[#6900AA] font-semibold hover:underline">
                  Admin
                </Link>
              </p>
            </div>
          )}

          {customerStep === "otp" && (
            <div>
              <button
                type="button"
                onClick={() => setCustomerStep("phone")}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-semibold mb-5 cursor-pointer transition-colors"
              >
                <ArrowLeft size={14} /> Change number
              </button>

              <h2 className="text-2xl font-black text-slate-800 mb-1">Verify OTP</h2>
              <p className="text-sm text-slate-400 font-medium mb-7">
                Sent to +91 {verifiedPhone}
              </p>

              <form onSubmit={onVerifyOtp} className="space-y-5" noValidate>
                <div>
                  <FormLabel required>Enter 6-digit OTP</FormLabel>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    placeholder="••••••"
                    className={`${inputBase} px-4 text-center text-xl tracking-[0.5em] font-extrabold ${
                      otpForm.formState.errors.otp ? inputErr : inputOk
                    }`}
                    {...otpForm.register("otp", {
                      onChange: (e) => {
                        e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
                      },
                    })}
                  />
                  {otpForm.formState.errors.otp && (
                    <p className={fieldErrorClass}>{otpForm.formState.errors.otp.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isPhoneLoading}
                  className="w-full bg-[#6900AA] hover:bg-[#57008E] text-white rounded-2xl py-3.5 text-sm font-bold transition-all shadow-sm cursor-pointer flex justify-center items-center gap-2 disabled:opacity-60"
                >
                  {isPhoneLoading ? "Verifying..." : "Verify & Login"}
                </button>
              </form>
            </div>
          )}

          {customerStep === "register" && (
            <div>
              <button
                type="button"
                onClick={() => setCustomerStep("phone")}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-semibold mb-5 cursor-pointer transition-colors"
              >
                <ArrowLeft size={14} /> Back to login
              </button>

              <h2 className="text-2xl font-black text-slate-800 mb-1">Create Account</h2>
              <p className="text-sm text-slate-400 font-medium mb-7">
                Join Book My Bota in seconds
              </p>

              <form onSubmit={onRegister} className="space-y-4" noValidate>
                <div>
                  <FormLabel required>Full Name</FormLabel>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Raj Mehta"
                    className={`${inputBase} px-4 ${
                      registerForm.formState.errors.name ? inputErr : inputOk
                    }`}
                    {...registerForm.register("name")}
                  />
                  {registerForm.formState.errors.name && (
                    <p className={fieldErrorClass}>{registerForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <FormLabel required>Email Address</FormLabel>
                  <input
                    type="email"
                    placeholder="raj@example.com"
                    className={`${inputBase} px-4 ${
                      registerForm.formState.errors.email ? inputErr : inputOk
                    }`}
                    {...registerForm.register("email")}
                  />
                  {registerForm.formState.errors.email && (
                    <p className={fieldErrorClass}>{registerForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <FormLabel required>Phone Number</FormLabel>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-slate-500 font-bold text-sm">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={12}
                      placeholder="9876543210"
                      className={`${inputBase} pl-14 pr-4 ${
                        registerForm.formState.errors.phone ? inputErr : inputOk
                      }`}
                      {...registerForm.register("phone", {
                        onChange: (e) => {
                          e.target.value = sanitizePhoneInput(e.target.value);
                        },
                      })}
                    />
                  </div>
                  {registerForm.formState.errors.phone && (
                    <p className={fieldErrorClass}>{registerForm.formState.errors.phone.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="w-full bg-[#6900AA] hover:bg-[#57008E] text-white rounded-2xl py-3.5 text-sm font-bold transition-all shadow-sm cursor-pointer flex justify-center items-center gap-2 mt-2 disabled:opacity-60"
                >
                  {isRegistering ? "Creating account..." : "Create Account"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthGate mode="guest" guestRoles={["customer"]}>
      <CustomerLoginForm />
    </AuthGate>
  );
}
