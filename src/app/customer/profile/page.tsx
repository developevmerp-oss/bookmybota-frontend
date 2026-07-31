"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, User, Phone, Mail, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useGetCustomerProfileQuery,
  useUpdateCustomerProfileMutation,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage, updateUser } from "@/features/auth/authSlice";

export default function CustomerProfilePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    if (user === null) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem("user_customer") : null;
    if (!stored) {
      router.push("/login");
      return;
    }
    const parsed = JSON.parse(stored);
    if (parsed.role !== "customer") router.push("/");
  }, [user, router]);

  const customerId = user?.customer_id ?? "";
  const { data: profile, isLoading } = useGetCustomerProfileQuery(customerId, {
    skip: !customerId,
  });
  const [updateProfile, { isLoading: isSaving }] = useUpdateCustomerProfileMutation();

  useEffect(() => {
    if (!profile || initialized) return;
    setName(profile.name || "");
    setPhone(profile.phone || "");
    setEmail(profile.email || user?.email || "");
    setInitialized(true);
  }, [profile, user?.email, initialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      const res = await updateProfile({
        customerId,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
      }).unwrap();

      dispatch(
        updateUser({
          name: res.data.name,
          phone: res.data.phone,
          email: res.data.email || email.trim(),
        })
      );
      window.dispatchEvent(new Event("auth_changed"));
      toast.success("Profile updated successfully");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "data" in err
          ? String((err as { data?: { error?: string } }).data?.error || "Failed to update profile")
          : "Failed to update profile";
      toast.error(message);
    }
  };

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-background pt-24 text-center text-muted-foreground">
        Loading profile...
      </div>
    );
  }

  const displayName = name || user.name || user.email?.split("@")[0] || "Guest";

  return (
    <div className="min-h-screen bg-background pt-10 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <Link
          href="/customer/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back to reservations
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Edit Profile</h1>
          <p className="text-muted-foreground">Update your personal and contact details.</p>
        </div>

        <div className="glass-panel rounded-2xl border border-border p-6 sm:p-8">
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-2xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{displayName}</p>
              <p className="text-sm text-muted-foreground">{email || user.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                  placeholder="Your name"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Phone</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                  placeholder="Mobile number"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
