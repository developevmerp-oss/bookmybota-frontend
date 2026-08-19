"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRegisterCustomerMutation } from '@/services/api';
import { useAppDispatch } from '@/lib/hooks';
import { setCredentials } from '@/features/auth/authSlice';
import { toast } from 'sonner';
import AuthGate from '@/components/Shared/AuthGate';
import PhoneInput from '@/components/Shared/PhoneInput';
import PasswordInput from '@/components/Shared/PasswordInput';
import { isValidPhone, isValidPassword } from '@/lib/validation';

function RegisterForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [phoneValid, setPhoneValid] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);
  const [registerCustomer, { isLoading, error }] = useRegisterCustomerMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(phone) || !isValidPassword(password)) return;
    try {
      const data = await registerCustomer({ name, email, phone, password }).unwrap();
      dispatch(setCredentials({ user: data.user, token: data.token }));
      window.dispatchEvent(new Event('auth_changed'));
      toast.success('Registration successful! Welcome.');
      router.push('/');
    } catch (err: any) {
      toast.error(err?.data?.error || 'Registration failed.');
    }
  };

  const errorMessage = error
    ? ('data' in error ? (error.data as any)?.error : 'An error occurred during registration.')
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md p-8 glass-panel rounded-2xl border border-border">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create an Account</h1>
          <p className="text-muted-foreground">Join to manage your reservations</p>
        </div>

        {errorMessage && (
          <div className="p-3 mb-6 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Full Name</label>
            <input type="text" required className="input-field" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
            <input type="email" required className="input-field" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <PhoneInput
            label="Phone Number"
            value={phone}
            onChange={setPhone}
            onValidChange={setPhoneValid}
            required
            helperText="We will use this to sync any past guest bookings."
          />
          <PasswordInput
            label="Password"
            mode="create"
            value={password}
            onChange={setPassword}
            onValidChange={setPasswordValid}
            required
            placeholder="••••••••"
          />
          <button
            type="submit"
            disabled={isLoading || !phoneValid || !passwordValid || !name || !email}
            className="w-full btn-primary mt-6 disabled:opacity-50"
          >
            {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-rose-500 hover:text-rose-400">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default function Register() {
  return (
    <AuthGate mode="guest">
      <RegisterForm />
    </AuthGate>
  );
}
