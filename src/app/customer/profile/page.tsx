"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Mail, MapPin, Pencil, Save, User } from "lucide-react";
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

type FieldKey = "name" | "phone" | "email" | "address" | "city" | "state";

const inputClass =
  "w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-[#6900AA]/25 focus:border-[#6900AA] disabled:bg-[#f7f7f7] disabled:text-[#555]";

const plainInputClass =
  "w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-[#6900AA]/25 focus:border-[#6900AA] disabled:bg-[#f7f7f7] disabled:text-[#555]";

function FieldHeader({
  label,
  required,
  editing,
  onEdit,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  editing: boolean;
  onEdit: () => void;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-[#6900AA] ml-0.5">*</span>}
      </label>
      {!editing && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#8B1538] hover:text-[#6900AA] cursor-pointer"
        >
          <Pencil size={12} strokeWidth={2.25} />
          Edit
        </button>
      )}
    </div>
  );
}

function IconField({
  icon,
  children,
  showCheck,
}: {
  icon: ReactNode;
  children: ReactNode;
  showCheck?: boolean;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        {icon}
      </span>
      {children}
      {showCheck && (
        <Check
          size={16}
          strokeWidth={2.5}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none"
        />
      )}
    </div>
  );
}

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
  const [editing, setEditing] = useState<Record<FieldKey, boolean>>({
    name: false,
    phone: false,
    email: false,
    address: false,
    city: false,
    state: false,
  });

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLInputElement>(null);

  const enableEdit = (key: FieldKey, focus?: () => void) => {
    setEditing((prev) => ({ ...prev, [key]: true }));
    window.setTimeout(() => focus?.(), 0);
  };

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    if (user === null) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem("user_customer") : null;
    if (!stored) {
      router.push("/");
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
      setEditing({
        name: false,
        phone: false,
        email: false,
        address: false,
        city: false,
        state: false,
      });
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
          <div className="w-16 h-16 rounded-full bg-[#F7E9FF] text-[#6900AA] flex items-center justify-center text-2xl font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{displayName}</p>
            <p className="text-sm text-muted-foreground">{email || user.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <FieldHeader
              label="Full Name"
              htmlFor="profile-name"
              editing={editing.name}
              onEdit={() => enableEdit("name", () => nameRef.current?.focus())}
            />
            <IconField icon={<User size={16} />}>
              <input
                ref={nameRef}
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!editing.name}
                className={inputClass}
                placeholder="Your name"
                required
              />
            </IconField>
          </div>

          <div>
            <FieldHeader
              label="Phone"
              required
              editing={editing.phone}
              onEdit={() => enableEdit("phone")}
            />
            <div className="relative">
              <PhoneInput
                value={phone}
                onChange={setPhone}
                onValidChange={setPhoneValid}
                required={!!phone.trim()}
                placeholder="9876543210"
                showIcon
                disabled={!editing.phone}
                inputClassName={`${inputClass}${!editing.phone && phone.trim() ? " pr-10" : ""}`}
              />
              {!editing.phone && phone.trim() && (
                <Check
                  size={16}
                  strokeWidth={2.5}
                  className="absolute right-3 top-[13px] text-emerald-500 pointer-events-none"
                  aria-hidden
                />
              )}
            </div>
          </div>

          <div>
            <FieldHeader
              label="Email"
              htmlFor="profile-email"
              editing={editing.email}
              onEdit={() => enableEdit("email", () => emailRef.current?.focus())}
            />
            <IconField icon={<Mail size={16} />} showCheck={!editing.email && !!email.trim()}>
              <input
                ref={emailRef}
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!editing.email}
                className={`${inputClass}${!editing.email && email.trim() ? " pr-10" : ""}`}
                placeholder="you@example.com"
              />
            </IconField>
          </div>

          <div>
            <FieldHeader
              label="Address"
              htmlFor="profile-address"
              editing={editing.address}
              onEdit={() => enableEdit("address", () => addressRef.current?.focus())}
            />
            <IconField icon={<MapPin size={16} />}>
              <input
                ref={addressRef}
                id="profile-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!editing.address}
                className={inputClass}
                placeholder="Street address"
              />
            </IconField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldHeader
                label="City"
                htmlFor="profile-city"
                editing={editing.city}
                onEdit={() => enableEdit("city", () => cityRef.current?.focus())}
              />
              <input
                ref={cityRef}
                id="profile-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={!editing.city}
                className={plainInputClass}
                placeholder="City"
              />
            </div>
            <div>
              <FieldHeader
                label="State"
                htmlFor="profile-state"
                editing={editing.state}
                onEdit={() => enableEdit("state", () => stateRef.current?.focus())}
              />
              <input
                ref={stateRef}
                id="profile-state"
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={!editing.state}
                className={plainInputClass}
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
