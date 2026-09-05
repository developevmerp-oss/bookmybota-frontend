"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Check, Loader2, Mail, MapPin, Pencil, Save, User } from "lucide-react";
import { toast } from "sonner";
import {
  useGetCustomerProfileQuery,
  useUpdateCustomerProfileMutation,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage, updateUser } from "@/features/auth/authSlice";
import PhoneInput from "@/components/Shared/PhoneInput";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";
import { extractApiError } from "@/lib/apiErrors";
import {
  customerProfileSchema,
  type CustomerProfileValues,
} from "@/lib/customerProfileFormSchema";

type FieldKey = "name" | "phone" | "email" | "address" | "city" | "state";

const inputClass =
  "w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-[#6900AA]/25 focus:border-[#6900AA] disabled:bg-[#f7f7f7] disabled:text-[#555]";

const plainInputClass =
  "w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-[#6900AA]/25 focus:border-[#6900AA] disabled:bg-[#f7f7f7] disabled:text-[#555]";

const fieldErrorClass = "mt-1.5 text-[12px] font-semibold text-rose-500";

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
        {required && <span className="text-rose-500 ml-0.5">*</span>}
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

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<CustomerProfileValues>({
    resolver: yupResolver(customerProfileSchema) as any,
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
    },
    mode: "onSubmit",
  });

  const name = watch("name") || "";
  const phone = watch("phone") || "";
  const email = watch("email") || "";

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
    if (!profile) return;
    reset({
      name: profile.name || "",
      phone: profile.phone || "",
      email: profile.email || user?.email || "",
      address: profile.address || "",
      city: profile.city || "",
      state: profile.state || "",
    });
  }, [profile, user?.email, reset]);

  const onValid = async (values: CustomerProfileValues) => {
    if (!customerId) return;

    try {
      const res = await updateProfile({
        customerId,
        name: values.name.trim(),
        phone: (values.phone || "").trim(),
        email: (values.email || "").trim(),
        address: (values.address || "").trim(),
        city: (values.city || "").trim(),
        state: (values.state || "").trim(),
      }).unwrap();

      dispatch(
        updateUser({
          name: res.data.name,
          phone: res.data.phone,
          email: res.data.email || (values.email || "").trim(),
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
      toast.success(res.message || "Profile updated successfully");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update profile"));
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
  const { ref: nameRegisterRef, ...nameRegister } = register("name");
  const { ref: emailRegisterRef, ...emailRegister } = register("email");
  const { ref: addressRegisterRef, ...addressRegister } = register("address");
  const { ref: cityRegisterRef, ...cityRegister } = register("city");
  const { ref: stateRegisterRef, ...stateRegister } = register("state");

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

        <form onSubmit={handleSubmit(onValid)} className="space-y-5" noValidate>
          <div>
            <FieldHeader
              label="Full Name"
              required
              htmlFor="profile-name"
              editing={editing.name}
              onEdit={() => enableEdit("name", () => nameRef.current?.focus())}
            />
            <IconField icon={<User size={16} />}>
              <input
                id="profile-name"
                type="text"
                disabled={!editing.name}
                className={inputClass}
                placeholder="Your name"
                {...nameRegister}
                ref={(el) => {
                  nameRegisterRef(el);
                  nameRef.current = el;
                }}
              />
            </IconField>
            {errors.name && (
              <p className={fieldErrorClass}>{errors.name.message}</p>
            )}
          </div>

          <div>
            <FieldHeader
              label="Phone"
              required
              editing={editing.phone}
              onEdit={() => enableEdit("phone")}
            />
            <div className="relative">
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    value={field.value || ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    required={!!(field.value || "").trim()}
                    placeholder="9876543210"
                    showIcon
                    disabled={!editing.phone}
                    inputClassName={`${inputClass}${!editing.phone && (field.value || "").trim() ? " pr-10" : ""}`}
                  />
                )}
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
            {errors.phone && (
              <p className={fieldErrorClass}>{errors.phone.message}</p>
            )}
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
                id="profile-email"
                type="email"
                disabled={!editing.email}
                className={`${inputClass}${!editing.email && email.trim() ? " pr-10" : ""}`}
                placeholder="you@example.com"
                {...emailRegister}
                ref={(el) => {
                  emailRegisterRef(el);
                  emailRef.current = el;
                }}
              />
            </IconField>
            {errors.email && (
              <p className={fieldErrorClass}>{errors.email.message}</p>
            )}
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
                id="profile-address"
                type="text"
                disabled={!editing.address}
                className={inputClass}
                placeholder="Street address"
                {...addressRegister}
                ref={(el) => {
                  addressRegisterRef(el);
                  addressRef.current = el;
                }}
              />
            </IconField>
            {errors.address && (
              <p className={fieldErrorClass}>{errors.address.message}</p>
            )}
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
                id="profile-city"
                type="text"
                disabled={!editing.city}
                className={plainInputClass}
                placeholder="City"
                {...cityRegister}
                ref={(el) => {
                  cityRegisterRef(el);
                  cityRef.current = el;
                }}
              />
              {errors.city && (
                <p className={fieldErrorClass}>{errors.city.message}</p>
              )}
            </div>
            <div>
              <FieldHeader
                label="State"
                htmlFor="profile-state"
                editing={editing.state}
                onEdit={() => enableEdit("state", () => stateRef.current?.focus())}
              />
              <input
                id="profile-state"
                type="text"
                disabled={!editing.state}
                className={plainInputClass}
                placeholder="State"
                {...stateRegister}
                ref={(el) => {
                  stateRegisterRef(el);
                  stateRef.current = el;
                }}
              />
              {errors.state && (
                <p className={fieldErrorClass}>{errors.state.message}</p>
              )}
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
    </CustomerAccountLayout>
  );
}
