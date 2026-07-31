"use client";
import { useState } from 'react';
import { UtensilsCrossed, Phone, Mail, Lock, ChevronRight, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLoginMutation, usePhoneLoginMutation, useRegisterCustomerMutation } from '@/services/api';
import { useAppDispatch } from '@/lib/hooks';
import { setCredentials } from '@/features/auth/authSlice';

type LoginTab = 'customer' | 'business';
type CustomerStep = 'phone' | 'otp' | 'register';

export default function Login() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  // Tab state
  const [activeTab, setActiveTab] = useState<LoginTab>('customer');

  // ── Customer (Phone OTP) state ──
  const [customerStep, setCustomerStep] = useState<CustomerStep>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [customerError, setCustomerError] = useState<string | null>(null);

  // Register sub-form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');

  // ── Business/Admin (Email Password) state ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // RTK mutations
  const [login, { isLoading: isEmailLoading, error: emailError }] = useLoginMutation();
  const [phoneLogin, { isLoading: isPhoneLoading }] = usePhoneLoginMutation();
  const [registerCustomer, { isLoading: isRegistering }] = useRegisterCustomerMutation();

  const emailErrorMessage = emailError
    ? ('data' in emailError ? (emailError.data as any)?.error : 'Network error. Please try again.')
    : null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerError(null);
    if (!phone || phone.replace(/\D/g, '').length < 8) {
      setCustomerError('Please enter a valid phone number.');
      return;
    }
    setCustomerStep('otp');
    setOtp('');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerError(null);
    if (otp !== '123456') {
      setCustomerError('Invalid OTP. For demo, please use 123456.');
      return;
    }
    try {
      const data = await phoneLogin({ phone, otp }).unwrap();
      dispatch(setCredentials({ user: data.user, token: data.token }));
      window.dispatchEvent(new Event('auth_changed'));
      router.push('/customer/dashboard');
    } catch (err: any) {
      setCustomerError(err?.data?.error || 'Login failed. Please try again.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomerError(null);
    if (!regName || !regEmail || !regPhone) {
      setCustomerError('All fields are required.');
      return;
    }
    try {
      const data = await registerCustomer({
        name: regName,
        email: regEmail,
        phone: regPhone,
        password: 'OtpDefaultPassword123',
      }).unwrap();
      dispatch(setCredentials({ user: data.user, token: data.token }));
      window.dispatchEvent(new Event('auth_changed'));
      router.push('/customer/dashboard');
    } catch (err: any) {
      setCustomerError(err?.data?.error || 'Registration failed. Please try again.');
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await login({ email, password }).unwrap();
      dispatch(setCredentials({ user: data.user, token: data.token }));
      window.dispatchEvent(new Event('auth_changed'));
      if (data.user.role === 'super_admin') router.push('/admin');
      else if (data.user.role === 'customer') router.push('/customer/dashboard');
      else router.push('/business');
    } catch {
      // error shown via RTK error state
    }
  };

  const resetCustomerFlow = () => {
    setCustomerStep('phone');
    setPhone('');
    setOtp('');
    setCustomerError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-50 via-white to-rose-50/30">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="bg-rose-600 p-2.5 rounded-xl group-hover:scale-105 transition-transform shadow-md shadow-rose-200">
              <UtensilsCrossed size={26} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-800 tracking-tight">Book My Bota</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 overflow-hidden">

          {/* Tab switcher */}
          <div className="flex border-b border-slate-100">
            <button
              type="button"
              onClick={() => { setActiveTab('customer'); resetCustomerFlow(); }}
              className={`flex-1 py-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'customer'
                  ? 'text-rose-600 border-b-2 border-rose-500 bg-rose-50/50'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Phone size={16} />
              Customer Login
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('business')}
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

            {/* ── CUSTOMER TAB ── */}
            {activeTab === 'customer' && (
              <div>
                {/* Phone step */}
                {customerStep === 'phone' && (
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 mb-1">Welcome back!</h2>
                    <p className="text-sm text-slate-400 font-medium mb-7">Enter your phone number to continue</p>

                    {customerError && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold p-3.5 rounded-xl text-center mb-5">
                        {customerError}
                      </div>
                    )}

                    <form onSubmit={handleSendOtp} className="space-y-5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Phone Number</label>
                        <div className="relative">
                          <span className="absolute left-4 top-3.5 text-slate-500 font-bold text-sm">+91</span>
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-14 pr-4 py-3.5 text-sm focus:outline-none focus:border-rose-400 focus:bg-white text-slate-800 font-semibold transition-all"
                            placeholder="99000-00000"
                            autoFocus
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isPhoneLoading}
                        className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-2xl py-3.5 text-sm font-bold transition-all shadow-md shadow-rose-200 cursor-pointer flex justify-center items-center gap-2"
                      >
                        Send OTP <ChevronRight size={16} />
                      </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-slate-400 font-medium">
                      New customer?{' '}
                      <button
                        type="button"
                        onClick={() => { setCustomerStep('register'); setCustomerError(null); setRegPhone(phone); }}
                        className="text-rose-600 font-bold hover:underline cursor-pointer"
                      >
                        Create an account
                      </button>
                    </p>
                  </div>
                )}

                {/* OTP step */}
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
                      OTP sent to <span className="text-slate-600 font-bold">+91 {phone}</span>
                    </p>
                    <p className="text-xs text-amber-600 font-semibold mb-7 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 inline-block">
                      Demo OTP: <span className="font-black tracking-widest">123456</span>
                    </p>

                    {customerError && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold p-3.5 rounded-xl text-center mb-5">
                        {customerError}
                      </div>
                    )}

                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Enter 6-digit OTP</label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-center text-xl tracking-[0.5em] font-extrabold focus:outline-none focus:border-rose-400 focus:bg-white text-slate-800 transition-all"
                          placeholder="••••••"
                          autoFocus
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isPhoneLoading}
                        className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-2xl py-3.5 text-sm font-bold transition-all shadow-md shadow-rose-200 cursor-pointer flex justify-center items-center gap-2"
                      >
                        {isPhoneLoading ? 'Verifying...' : 'Verify & Login'}
                      </button>
                    </form>
                  </div>
                )}

                {/* Register step */}
                {customerStep === 'register' && (
                  <div>
                    <button
                      type="button"
                      onClick={() => { setCustomerStep('phone'); setCustomerError(null); }}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-semibold mb-5 cursor-pointer transition-colors"
                    >
                      <ArrowLeft size={14} /> Back to login
                    </button>

                    <h2 className="text-2xl font-black text-slate-800 mb-1">Create Account</h2>
                    <p className="text-sm text-slate-400 font-medium mb-7">Join Book My Bota in seconds</p>

                    {customerError && (
                      <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold p-3.5 rounded-xl text-center mb-5">
                        {customerError}
                      </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Full Name</label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:border-rose-400 focus:bg-white text-slate-800 font-semibold transition-all"
                          placeholder="Raj Mehta"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Email Address</label>
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:border-rose-400 focus:bg-white text-slate-800 font-semibold transition-all"
                          placeholder="raj@example.com"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Phone Number</label>
                        <div className="relative">
                          <span className="absolute left-4 top-3.5 text-slate-500 font-bold text-sm">+91</span>
                          <input
                            type="tel"
                            required
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-14 pr-4 py-3.5 text-sm focus:outline-none focus:border-rose-400 focus:bg-white text-slate-800 font-semibold transition-all"
                            placeholder="99000-00000"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isRegistering}
                        className="w-full bg-rose-500 hover:bg-rose-600 text-white rounded-2xl py-3.5 text-sm font-bold transition-all shadow-md shadow-rose-200 cursor-pointer flex justify-center items-center gap-2 mt-2"
                      >
                        {isRegistering ? 'Creating account...' : 'Create Account'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ── BUSINESS / ADMIN TAB ── */}
            {activeTab === 'business' && (
              <div>
                <h2 className="text-2xl font-black text-slate-800 mb-1">Business Login</h2>
                <p className="text-sm text-slate-400 font-medium mb-7">Sign in with your admin credentials</p>

                {emailErrorMessage && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold p-3.5 rounded-xl text-center mb-5">
                    {emailErrorMessage}
                  </div>
                )}

                <form onSubmit={handleEmailLogin} className="space-y-5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Email Address</label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-3.5 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:border-slate-400 focus:bg-white text-slate-800 font-semibold transition-all"
                        placeholder="admin@business.com"
                        required
                        autoFocus
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-3.5 text-slate-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-3.5 text-sm focus:outline-none focus:border-slate-400 focus:bg-white text-slate-800 font-semibold transition-all"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isEmailLoading}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-2xl py-3.5 text-sm font-bold transition-all shadow-md cursor-pointer flex justify-center items-center gap-2 mt-2"
                  >
                    {isEmailLoading ? 'Logging in...' : 'Log In'}
                  </button>
                </form>

                <div className="mt-6 p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Super Admin Default</p>
                  <p className="text-xs text-slate-600 font-mono">admin@reserve.com / Admin@123</p>
                  <p className="text-[10px] text-slate-400 mt-2">Business admins: name@bookmybota.com / Admin@123</p>
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
