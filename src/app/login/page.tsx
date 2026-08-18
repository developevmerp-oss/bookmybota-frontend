"use client";

import { useState } from 'react';
import { Phone, Mail, Lock, ChevronRight, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { toast } from 'sonner';
import { useLoginMutation, usePhoneLoginMutation, useRegisterCustomerMutation } from '@/services/api';
import { useAppDispatch } from '@/lib/hooks';
import { setCredentials } from '@/features/auth/authSlice';
import { homePathForRole } from '@/lib/authStorage';
import { extractApiError, extractApiSuccessMessage } from '@/lib/apiErrors';
import AuthGate from '@/components/Shared/AuthGate';
import PasswordInput from '@/components/Shared/PasswordInput';
import { sanitizePhoneInput } from '@/lib/validation';import {
  phoneLoginSchema,
  otpVerifySchema,
  customerRegisterSchema,
  businessLoginSchema,
  type PhoneLoginValues,
  type OtpVerifyValues,
  type CustomerRegisterValues,
  type BusinessLoginValues,
} from '@/lib/loginFormSchema';

type LoginTab = 'customer' | 'business';
type CustomerStep = 'phone' | 'otp' | 'register';

const fieldErrorClass =
  'mt-1.5 text-[11px] font-semibold text-rose-500';
const inputBase =
  'w-full bg-slate-50 border rounded-2xl py-3.5 text-sm focus:outline-none focus:bg-white text-slate-800 font-semibold transition-all';
const inputOk = 'border-slate-200 focus:border-[#6900AA]';
const inputErr = 'border-rose-300 focus:border-rose-400';
const labelClass =
  'text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block';

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

function LoginForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [activeTab, setActiveTab] = useState<LoginTab>('customer');
  const [customerStep, setCustomerStep] = useState<CustomerStep>('phone');
  const [verifiedPhone, setVerifiedPhone] = useState('');

  const [login, { isLoading: isEmailLoading }] = useLoginMutation();
  const [phoneLogin, { isLoading: isPhoneLoading }] = usePhoneLoginMutation();
  const [registerCustomer, { isLoading: isRegistering }] = useRegisterCustomerMutation();

  const phoneForm = useForm<PhoneLoginValues>({
    resolver: yupResolver(phoneLoginSchema),
    defaultValues: { phone: '' },
    mode: 'onBlur',
  });

  const otpForm = useForm<OtpVerifyValues>({
    resolver: yupResolver(otpVerifySchema),
    defaultValues: { otp: '' },
    mode: 'onBlur',
  });

  const registerForm = useForm<CustomerRegisterValues>({
    resolver: yupResolver(customerRegisterSchema),
    defaultValues: { name: '', email: '', phone: '' },
    mode: 'onBlur',
  });

  const businessForm = useForm<BusinessLoginValues>({
    resolver: yupResolver(businessLoginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const resetCustomerFlow = () => {
    setCustomerStep('phone');
    setVerifiedPhone('');
    phoneForm.reset({ phone: '' });
    otpForm.reset({ otp: '' });
    registerForm.reset({ name: '', email: '', phone: '' });
  };

  const onSendOtp = phoneForm.handleSubmit((values) => {
    const phone = sanitizePhoneInput(values.phone);
    setVerifiedPhone(phone);
    otpForm.reset({ otp: '' });
    setCustomerStep('otp');
    toast.success(`OTP sent to +91 ${phone}. Use demo OTP 123456.`);
  });

  const onVerifyOtp = otpForm.handleSubmit(async (values) => {
    if (values.otp !== '123456') {
      toast.error('Invalid OTP. For demo, please use 123456.');
      return;
    }
    try {
      const data = await phoneLogin({ phone: verifiedPhone, otp: values.otp }).unwrap();
      dispatch(setCredentials({ user: data.user, token: data.token }));
      window.dispatchEvent(new Event('auth_changed'));
      toast.success(extractApiSuccessMessage(data, 'Login successful'));
      router.push('/');
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Login failed. Please try again.'));
    }
  });

  const onRegister = registerForm.handleSubmit(async (values) => {
    try {
      const data = await registerCustomer({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: sanitizePhoneInput(values.phone),
        auto_generate_password: true,
      }).unwrap();
      dispatch(setCredentials({ user: data.user, token: data.token }));
      window.dispatchEvent(new Event('auth_changed'));
      toast.success(extractApiSuccessMessage(data, 'Customer registered successfully'));
      router.push('/');
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Registration failed. Please try again.'));
    }
  });

  const onBusinessLogin = businessForm.handleSubmit(async (values) => {
    try {
      const data = await login({
        email: values.email.trim(),
        password: values.password,
      }).unwrap();
      dispatch(setCredentials({ user: data.user, token: data.token }));
      window.dispatchEvent(new Event('auth_changed'));
      toast.success(extractApiSuccessMessage(data, 'Login successful'));
      router.push(homePathForRole(data.user.role));
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Invalid credentials'));
    }
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10 bg-[#F7F7F7]">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl border border-[#EDEDED] shadow-sm overflow-hidden">
          <div className="flex border-b border-[#EDEDED]">
            <button
              type="button"
              onClick={() => {
                setActiveTab('customer');
                resetCustomerFlow();
              }}
              className={`flex-1 py-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'customer'
                  ? 'text-[#6900AA] border-b-2 border-[#6900AA] bg-[#F7E9FF]'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Phone size={16} />
              Customer Login
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('business');
                businessForm.clearErrors();
              }}
              className={`flex-1 py-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'business'
                  ? 'text-slate-700 border-b-2 border-slate-600 bg-slate-50/50'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Lock size={16} />
              Business / Admin
            </button>
          </div>

          <div className="p-8">
            {activeTab === 'customer' && (
              <div>
                {customerStep === 'phone' && (
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 mb-1">Welcome back!</h2>
                    <p className="text-sm text-slate-400 font-medium mb-7">
                      Enter your phone number to continue
                    </p>

                    <form onSubmit={onSendOtp} className="space-y-5" noValidate>
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
                            autoFocus
                            placeholder="9876543210"
                            className={`${inputBase} pl-14 pr-4 ${
                              phoneForm.formState.errors.phone ? inputErr : inputOk
                            }`}
                            {...phoneForm.register('phone', {
                              onChange: (e) => {
                                e.target.value = sanitizePhoneInput(e.target.value);
                              },
                            })}
                          />
                        </div>
                        {phoneForm.formState.errors.phone && (
                          <p className={fieldErrorClass}>
                            {phoneForm.formState.errors.phone.message}
                          </p>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={isPhoneLoading}
                        className="w-full bg-[#6900AA] hover:bg-[#57008E] text-white rounded-2xl py-3.5 text-sm font-bold transition-all shadow-sm cursor-pointer flex justify-center items-center gap-2 disabled:opacity-60"
                      >
                        Send OTP <ChevronRight size={16} />
                      </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-slate-400 font-medium">
                      New customer?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          const phone = phoneForm.getValues('phone');
                          setCustomerStep('register');
                          registerForm.reset({
                            name: '',
                            email: '',
                            phone: sanitizePhoneInput(phone || ''),
                          });
                        }}
                        className="text-[#6900AA] font-bold hover:underline cursor-pointer"
                      >
                        Create an account
                      </button>
                    </p>
                  </div>
                )}

                {customerStep === 'otp' && (
                  <div>
                    <button
                      type="button"
                      onClick={resetCustomerFlow}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-semibold mb-5 cursor-pointer transition-colors"
                    >
                      <ArrowLeft size={14} /> Change number
                    </button>

                    <h2 className="text-2xl font-black text-slate-800 mb-1">Verify OTP</h2>
                    <p className="text-sm text-slate-400 font-medium mb-1">
                      OTP sent to{' '}
                      <span className="text-slate-600 font-bold">+91 {verifiedPhone}</span>
                    </p>
                    <p className="text-xs text-amber-600 font-semibold mb-7 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 inline-block">
                      Demo OTP: <span className="font-black tracking-widest">123456</span>
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
                          {...otpForm.register('otp', {
                            onChange: (e) => {
                              e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
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
                        {isPhoneLoading ? 'Verifying...' : 'Verify & Login'}
                      </button>
                    </form>
                  </div>
                )}

                {customerStep === 'register' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerStep('phone');
                      }}
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
                          {...registerForm.register('name')}
                        />
                        {registerForm.formState.errors.name && (
                          <p className={fieldErrorClass}>
                            {registerForm.formState.errors.name.message}
                          </p>
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
                          {...registerForm.register('email')}
                        />
                        {registerForm.formState.errors.email && (
                          <p className={fieldErrorClass}>
                            {registerForm.formState.errors.email.message}
                          </p>
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
                            {...registerForm.register('phone', {
                              onChange: (e) => {
                                e.target.value = sanitizePhoneInput(e.target.value);
                              },
                            })}
                          />
                        </div>
                        {registerForm.formState.errors.phone && (
                          <p className={fieldErrorClass}>
                            {registerForm.formState.errors.phone.message}
                          </p>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={isRegistering}
                        className="w-full bg-[#6900AA] hover:bg-[#57008E] text-white rounded-2xl py-3.5 text-sm font-bold transition-all shadow-sm cursor-pointer flex justify-center items-center gap-2 mt-2 disabled:opacity-60"
                      >
                        {isRegistering ? 'Creating account...' : 'Create Account'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'business' && (
              <div>
                <h2 className="text-2xl font-black text-slate-800 mb-1">Business Login</h2>
                <p className="text-sm text-slate-400 font-medium mb-7">
                  Sign in with your admin credentials
                </p>

                <form onSubmit={onBusinessLogin} className="space-y-5" noValidate>
                  <div>
                    <FormLabel required>Email Address</FormLabel>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-3.5 text-slate-400" />
                      <input
                        type="email"
                        autoFocus
                        placeholder="admin@business.com"
                        className={`${inputBase} pl-10 pr-4 ${
                          businessForm.formState.errors.email ? inputErr : 'border-slate-200 focus:border-slate-400'
                        }`}
                        {...businessForm.register('email')}
                      />
                    </div>
                    {businessForm.formState.errors.email && (
                      <p className={fieldErrorClass}>
                        {businessForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <FormLabel
                        required
                        className="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                      >
                        Password
                      </FormLabel>
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
                        control={businessForm.control}
                        render={({ field }) => (
                          <PasswordInput
                            mode="login"
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="••••••••"
                            inputClassName={`w-full bg-slate-50 border rounded-2xl pl-10 pr-11 py-3.5 text-sm focus:outline-none focus:bg-white text-slate-800 font-semibold transition-all ${
                              businessForm.formState.errors.password
                                ? inputErr
                                : 'border-slate-200 focus:border-slate-400'
                            }`}
                          />
                        )}
                      />
                    </div>
                    {businessForm.formState.errors.password && (
                      <p className={fieldErrorClass}>
                        {businessForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isEmailLoading}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-2xl py-3.5 text-sm font-bold transition-all shadow-md cursor-pointer flex justify-center items-center gap-2 mt-2 disabled:opacity-60"
                  >
                    {isEmailLoading ? 'Logging in...' : 'Log In'}
                  </button>
                </form>

                <div className="mt-6 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
                    Super Admin Default
                  </p>
                  <p className="text-xs text-slate-600 font-mono">admin@reserve.com / Admin@123</p>
                  <p className="text-[10px] text-slate-400 mt-2">
                    Business admins: name@bookmybota.com / Admin@123
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          By continuing, you agree to our{' '}
          <span className="text-slate-600 font-semibold">Terms of Service</span> and{' '}
          <span className="text-slate-600 font-semibold">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <AuthGate mode="guest">
      <LoginForm />
    </AuthGate>
  );
}
