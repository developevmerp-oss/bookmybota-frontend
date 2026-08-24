"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Check, Loader2, Lock, Mail, Pencil, Save, User } from "lucide-react";
import { toast } from "sonner";
import { useGetMeQuery, useUpdateMyProfileMutation } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage, updateUser } from "@/features/auth/authSlice";
import PhoneInput from "@/components/Shared/PhoneInput";
import ChangePasswordForm from "@/components/Shared/ChangePasswordForm";
import { extractApiError } from "@/lib/apiErrors";
import {
  adminProfileSchema,
  type AdminProfileValues,
} from "@/lib/adminFormSchemas";
import { PHONE_MAX_DIGITS, PHONE_MIN_DIGITS } from "@/lib/validation";

type FieldKey = "name" | "phone";
type ProfileTab = "profile" | "password";

const inputClass =
  "w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 disabled:bg-slate-50 disabled:text-slate-500";

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
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-600 ml-0.5">*</span>}
      </label>
      {!editing && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
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

function ProfileDetailsForm() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { data: me, isLoading } = useGetMeQuery();
  const [updateProfile, { isLoading: isSaving }] = useUpdateMyProfileMutation();
  const [editing, setEditing] = useState<Record<FieldKey, boolean>>({
    name: false,
    phone: false,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AdminProfileValues>({
    resolver: yupResolver(adminProfileSchema),
    defaultValues: { name: "", phone: "" },
    mode: "onSubmit",
  });

  const name = watch("name");
  const phone = watch("phone");

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    const source = me || user;
    if (!source) return;
    reset({
      name: source.name || "",
      phone: source.phone || "",
    });
  }, [me, user, reset]);

  const enableEdit = (key: FieldKey) => {
    setEditing((prev) => ({ ...prev, [key]: true }));
  };

  const onValid = async (values: AdminProfileValues) => {
    try {
      const res = await updateProfile({
        name: values.name.trim(),
        phone: values.phone,
      }).unwrap();

      dispatch(
        updateUser({
          name: res.data.name || values.name.trim(),
          phone: res.data.phone || values.phone,
          email: res.data.email || user?.email,
        })
      );
      window.dispatchEvent(new Event("auth_changed"));
      setEditing({ name: false, phone: false });
      toast.success(res.message || "Profile updated successfully");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update profile"));
    }
  };

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[12rem] text-slate-500 text-sm">
        Loading profile...
      </div>
    );
  }

  const email = me?.email || user.email || "";
  const displayName = name || user.name || email.split("@")[0] || "Admin";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-slate-200">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xl sm:text-2xl font-bold shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-base sm:text-lg font-semibold text-slate-800 truncate">{displayName}</p>
          <p className="text-sm text-slate-500 truncate">{email}</p>
          <p className="text-xs text-slate-400 mt-0.5">Super Admin</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onValid)} className="space-y-5" noValidate>
        <div>
          <FieldHeader
            label="Full Name"
            required
            htmlFor="admin-profile-name"
            editing={editing.name}
            onEdit={() => enableEdit("name")}
          />
          <IconField icon={<User size={16} />}>
            <input
              id="admin-profile-name"
              type="text"
              disabled={!editing.name}
              className={inputClass}
              placeholder="Your name"
              {...register("name")}
            />
          </IconField>
          {errors.name && (
            <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.name.message}</p>
          )}
        </div>

        <div>
          <FieldHeader
            label="Mobile Number"
            required
            editing={editing.phone}
            onEdit={() => enableEdit("phone")}
          />
          <PhoneInput
            value={phone || ""}
            onChange={(v) => setValue("phone", v, { shouldValidate: true, shouldDirty: true })}
            disabled={!editing.phone}
            required
            variant="light"
            showIcon
            showError={Boolean(errors.phone)}
            error={errors.phone?.message}
            helperText={`${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits, numbers only`}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
          <IconField icon={<Mail size={16} />} showCheck>
            <input type="email" value={email} disabled className={inputClass} readOnly />
          </IconField>
          <p className="mt-1.5 text-xs text-slate-400">Email cannot be changed from profile.</p>
        </div>

        {(editing.name || editing.phone) && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                reset({
                  name: me?.name || user.name || "",
                  phone: me?.phone || user.phone || "",
                });
                setEditing({ name: false, phone: false });
              }}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save changes
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function AdminProfileContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: ProfileTab = tabParam === "password" ? "password" : "profile";

  const setTab = (tab: ProfileTab) => {
    const next = tab === "password" ? `${pathname}?tab=password` : pathname;
    router.replace(next);
  };

  const tabs = [
    { id: "profile" as const, label: "My Profile", icon: User },
    { id: "password" as const, label: "Change Password", icon: Lock },
  ];

  return (
    <div className="w-full max-w-5xl">
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start">
        <aside className="w-full lg:w-[240px] shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
            <h2 className="px-3 pt-2 pb-3 text-xl sm:text-2xl border-b border-slate-200 mb-3 font-extrabold text-slate-900">
              My Account
            </h2>
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {tabs.map((item) => {
                const active = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? "bg-rose-50 text-rose-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={18} className={active ? "text-rose-600" : "text-slate-500"} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex-1 min-w-0 w-full">
          {activeTab === "profile" ? (
            <ProfileDetailsForm />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 max-w-lg">
              <ChangePasswordForm variant="light" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full flex items-center justify-center min-h-[12rem] text-slate-500 text-sm">
          Loading profile...
        </div>
      }
    >
      <AdminProfileContent />
    </Suspense>
  );
}
