"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Save, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  useGetCustomerProfileQuery,
  useUpdateCustomerProfileMutation,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage, updateUser } from "@/features/auth/authSlice";
import PhoneInput from "@/components/Shared/PhoneInput";
import { isValidPhone } from "@/lib/validation";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";

export default function CustomerProfilePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [phoneValid, setPhoneValid] = useState(false);

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
    setAddress(profile.address || "");
    setCity(profile.city || "");
    setState(profile.state || "");
    setInitialized(true);
  }, [profile, user?.email, initialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (phone.trim() && !isValidPhone(phone)) {
      toast.error("Phone must be 9–12 digits (numbers only)");
      return;
    }

    try {
      const res = await updateProfile({
        customerId,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
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
      <div className="min-h-[calc(100vh-4rem)] bg-[#f4f5f7] flex items-center justify-center text-slate-500">
        Loading profile...
      </div>
    );
  }

  const displayName = name || user.name || user.email?.split("@")[0] || "Guest";

  return (
    <CustomerAccountLayout>
      <div className="mb-6">
        <h1 className="text-[32px] leading-tight font-extrabold text-[#111111]">Edit Profile</h1>
        <p className="text-slate-500 mt-1">Update your personal and contact details.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
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

            <PhoneInput
              label="Phone"
              labelClassName="block text-sm font-medium text-foreground mb-1.5"
              value={phone}
              onChange={setPhone}
              onValidChange={setPhoneValid}
              required={!!phone.trim()}
              placeholder="9876543210"
              inputClassName="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
            />

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

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Address</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                  placeholder="Street address"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                  placeholder="City"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                  placeholder="State"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving || (phone.trim() !== "" && !phoneValid)}
              className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 disabled:opacity-60"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
    </CustomerAccountLayout>
  );
}
