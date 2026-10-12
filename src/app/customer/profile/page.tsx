"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Loader2,
  Map,
  MapPin,
  Pencil,
  Plus,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetCustomerProfileQuery,
  useUpdateCustomerProfileMutation,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage, updateUser } from "@/features/auth/authSlice";
import PhoneInput from "@/components/Shared/PhoneInput";
import CustomerAccountLayout, {
  CUSTOMER_ACCOUNT_NAV,
} from "@/components/Shared/CustomerAccountLayout";
import {
  CustomerAccountShellShimmer,
  CustomerProfileShimmer,
} from "@/components/Shared/Shimmer";
import { extractApiError } from "@/lib/apiErrors";
import { logoutCustomer } from "@/lib/authSession";
import {
  customerProfileSchema,
  type CustomerProfileValues,
} from "@/lib/customerProfileFormSchema";

/** Task-1: labels black, input/value text dark gray — colors only */
const LABEL_COLOR = "text-black";
const VALUE_COLOR = "text-[#555555]";
const INPUT_TEXT = "text-[#555555]";

const editInputClass = `w-full max-w-md px-3 py-2 rounded-lg border border-slate-200 bg-white text-[15px] ${INPUT_TEXT} focus:outline-none focus:ring-2 focus:ring-[#111111]/15 focus:border-[#111111] placeholder:text-slate-400`;

const mobileInputClass = `w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-[15px] ${INPUT_TEXT} focus:outline-none focus:ring-2 focus:ring-[#6900AA]/20 focus:border-[#6900AA] placeholder:text-slate-400`;

const fieldErrorClass = "mt-1.5 text-[12px] font-semibold text-rose-500";

const TOTAL_STEPS = 4;

function DetailRow({
  label,
  children,
  action,
}: {
  label: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(120px,160px)_1fr_auto] sm:grid-cols-[180px_1fr_auto] gap-x-4 sm:gap-x-6 gap-y-1 items-center py-3.5">
      <dt className={`text-[15px] ${LABEL_COLOR}`}>{label}</dt>
      <dd className={`min-w-0 text-[15px] font-medium ${VALUE_COLOR}`}>{children}</dd>
      <div className="shrink-0 justify-self-end">{action}</div>
    </div>
  );
}

function EmptyFieldValue({ icon }: { icon: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-slate-400 italic font-normal">
      <span className="text-slate-300 shrink-0" aria-hidden>
        {icon}
      </span>
      Not added yet
    </span>
  );
}

function AddFieldButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-0.5 text-sm font-medium text-[#6900AA] hover:text-[#550088] transition-colors cursor-pointer whitespace-nowrap"
    >
      <Plus size={14} strokeWidth={2.5} />
      Add
    </button>
  );
}

function isEmpty(value?: string | null) {
  return !(value || "").trim();
}

function profileStepsDone(values: {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
}) {
  const steps = [
    !!values.name.trim(),
    !!values.phone.trim(),
    !!values.email.trim(),
    !!(values.address.trim() || values.city.trim() || values.state.trim()),
  ];
  return steps.filter(Boolean).length;
}

function MobileField({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className={`block text-[15px] font-medium ${LABEL_COLOR} mb-2`}>{label}</label>
      {children}
      {error && <p className={fieldErrorClass}>{error}</p>}
    </div>
  );
}

export default function CustomerProfilePage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  /** Mobile/tablet only: overview → details list → edit form. Desktop uses isEditing. */
  const [mobileScreen, setMobileScreen] = useState<"overview" | "details" | "edit">("overview");
  const [isEditing, setIsEditing] = useState(false);

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
  const address = watch("address") || "";
  const city = watch("city") || "";
  const state = watch("state") || "";

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
      setIsEditing(false);
      setMobileScreen("details");
      toast.success(res.message || "Profile updated successfully");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update profile"));
    }
  };

  if (!user || isLoading) {
    return (
      <CustomerAccountShellShimmer>
        <CustomerProfileShimmer />
      </CustomerAccountShellShimmer>
    );
  }

  const displayName = name || user.name || user.email?.split("@")[0] || "Guest";
  const displayEmail = email || user.email || "";
  const stepsDone = profileStepsDone({ name, phone, email, address, city, state });
  const progressPct = Math.round((stepsDone / TOTAL_STEPS) * 100);

  const handleLogout = () => {
    logoutCustomer(dispatch, { pathname: "/customer/profile" });
    toast.success("Logged out successfully");
  };

  const mobileNavItems = CUSTOMER_ACCOUNT_NAV.filter(
    (item) => item.href !== "/customer/profile" && !item.mobileOnly
  );

  const desktopFormFields = (
    <dl>
      <DetailRow label="Full name:">
        {isEditing ? (
          <div>
            <input
              id="profile-name"
              type="text"
              className={editInputClass}
              placeholder="Your name"
              {...register("name")}
            />
            {errors.name && <p className={fieldErrorClass}>{errors.name.message}</p>}
          </div>
        ) : (
          name.trim() || "—"
        )}
      </DetailRow>

      <DetailRow label="Phone Number:">
        {isEditing ? (
          <div className="max-w-md">
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
                  showIcon={false}
                  inputClassName={editInputClass}
                />
              )}
            />
            {errors.phone && <p className={fieldErrorClass}>{errors.phone.message}</p>}
          </div>
        ) : (
          phone.trim() || "—"
        )}
      </DetailRow>

      <DetailRow label="Email:">
        {isEditing ? (
          <div>
            <input
              id="profile-email"
              type="email"
              className={editInputClass}
              placeholder="you@example.com"
              {...register("email")}
            />
            {errors.email && <p className={fieldErrorClass}>{errors.email.message}</p>}
          </div>
        ) : (
          email.trim() || "—"
        )}
      </DetailRow>

      <DetailRow
        label="Address:"
        action={
          !isEditing && isEmpty(address) ? (
            <AddFieldButton onClick={() => setIsEditing(true)} />
          ) : undefined
        }
      >
        {isEditing ? (
          <div>
            <input
              id="profile-address"
              type="text"
              className={editInputClass}
              placeholder="Street address"
              {...register("address")}
            />
            {errors.address && <p className={fieldErrorClass}>{errors.address.message}</p>}
          </div>
        ) : isEmpty(address) ? (
          <EmptyFieldValue icon={<MapPin size={15} strokeWidth={1.75} />} />
        ) : (
          address.trim()
        )}
      </DetailRow>

      <DetailRow
        label="City:"
        action={
          !isEditing && isEmpty(city) ? (
            <AddFieldButton onClick={() => setIsEditing(true)} />
          ) : undefined
        }
      >
        {isEditing ? (
          <div>
            <input
              id="profile-city"
              type="text"
              className={editInputClass}
              placeholder="City"
              {...register("city")}
            />
            {errors.city && <p className={fieldErrorClass}>{errors.city.message}</p>}
          </div>
        ) : isEmpty(city) ? (
          <EmptyFieldValue icon={<Building2 size={15} strokeWidth={1.75} />} />
        ) : (
          city.trim()
        )}
      </DetailRow>

      <DetailRow
        label="State:"
        action={
          !isEditing && isEmpty(state) ? (
            <AddFieldButton onClick={() => setIsEditing(true)} />
          ) : undefined
        }
      >
        {isEditing ? (
          <div>
            <input
              id="profile-state"
              type="text"
              className={editInputClass}
              placeholder="State"
              {...register("state")}
            />
            {errors.state && <p className={fieldErrorClass}>{errors.state.message}</p>}
          </div>
        ) : isEmpty(state) ? (
          <EmptyFieldValue icon={<Map size={15} strokeWidth={1.75} />} />
        ) : (
          state.trim()
        )}
      </DetailRow>
    </dl>
  );

  return (
    <CustomerAccountLayout hideSidebarBelowLg>
      {/* ── Desktop / large screens ── */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 lg:p-10">
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-200">
          <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-[#F7E9FF] text-[#6900AA] flex items-center justify-center text-2xl sm:text-3xl font-bold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-black leading-tight truncate">
              {displayName}
            </h2>
            <p className="mt-1 text-sm text-slate-400 truncate">{displayEmail}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onValid)} noValidate>
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="text-lg sm:text-xl font-bold text-black">Personal details</h3>
            {!isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6900AA] hover:text-[#550088] transition-colors cursor-pointer"
              >
                <Pencil size={15} strokeWidth={2.25} />
                Edit
              </button>
            )}
          </div>

          {desktopFormFields}

          {isEditing && (
            <div className="mt-8 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-[#111111] text-white text-sm font-semibold hover:bg-[#222222] transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* ── Mobile / tablet ── */}
      <div className="lg:hidden space-y-4">
        {mobileScreen === "overview" && (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-1">
              <button
                type="button"
                onClick={() => router.back()}
                className="p-1 -ml-1 text-black cursor-pointer"
                aria-label="Go back"
              >
                <ArrowLeft size={22} />
              </button>
              <h1 className="text-xl font-bold text-black">Profile</h1>
            </div>

            {/* Summary card — whole box opens personal details */}
            <button
              type="button"
              onClick={() => setMobileScreen("details")}
              className="w-full rounded-2xl border border-slate-200 bg-white overflow-hidden text-left cursor-pointer hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center gap-4 p-4">
                <div className="relative shrink-0 w-[72px] h-[72px]">
                  <svg className="absolute inset-0 w-[72px] h-[72px] -rotate-90" viewBox="0 0 72 72" aria-hidden>
                    <circle cx="36" cy="36" r="32" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                    <circle
                      cx="36"
                      cy="36"
                      r="32"
                      fill="none"
                      stroke="#6900AA"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${(progressPct / 100) * 201} 201`}
                    />
                  </svg>
                  <div className="absolute inset-[6px] rounded-full bg-[#F7E9FF] text-[#6900AA] flex items-center justify-center text-2xl font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-black truncate">{displayName}</p>
                  {phone.trim() ? (
                    <p className={`text-sm ${VALUE_COLOR} mt-0.5`}>
                      {phone.trim().startsWith("+") ? phone.trim() : `+91 ${phone.trim()}`}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 mt-0.5 truncate">{displayEmail}</p>
                  )}
                  <p className="text-sm font-medium text-[#6900AA] mt-1">
                    {stepsDone} / {TOTAL_STEPS} steps done
                  </p>
                </div>
              </div>
            </button>

            {/* Account menu */}
            <div>
              <h2 className="text-base font-bold text-black px-1 mb-2">My Account</h2>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {mobileNavItems.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.soon ? "#" : item.href}
                      onClick={(e) => {
                        if (!item.soon) return;
                        e.preventDefault();
                        toast.message("Coming soon");
                      }}
                      className={`flex items-center gap-3 px-4 py-3.5 ${
                        idx < mobileNavItems.length - 1 ? "border-b border-slate-100" : ""
                      }`}
                    >
                      <Icon size={20} className="text-slate-500 shrink-0" />
                      <span className="flex-1 text-[15px] font-medium text-black">{item.label}</span>
                      {item.soon ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F7E9FF] text-[#6900AA]">
                          Soon
                        </span>
                      ) : (
                        <ChevronRight size={18} className="text-slate-400" />
                      )}
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3.5 border-t border-slate-100 text-red-600 cursor-pointer"
                >
                  <span className="flex-1 text-[15px] font-medium text-left">Log out</span>
                  <ChevronRight size={18} className="text-red-400" />
                </button>
              </div>
            </div>
          </>
        )}

        {mobileScreen === "details" && (
          <>
            <div className="flex items-center gap-3 px-1">
              <button
                type="button"
                onClick={() => setMobileScreen("overview")}
                className="p-1 -ml-1 text-black cursor-pointer"
                aria-label="Back to profile"
              >
                <ArrowLeft size={22} />
              </button>
              <h1 className="text-xl font-bold text-black">Profile</h1>
            </div>

            {/* Personal details list (2nd-image style) — Edit opens form */}
            <div>
              <div className="flex items-center justify-between gap-3 px-1 mb-2">
                <h2 className="text-base font-bold text-black">Personal details</h2>
                <button
                  type="button"
                  onClick={() => setMobileScreen("edit")}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#6900AA] cursor-pointer"
                >
                  <Pencil size={14} strokeWidth={2.25} />
                  Edit
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-1">
                <div className="py-3.5 border-b border-slate-100 flex justify-between gap-3">
                  <span className={`text-[15px] ${LABEL_COLOR}`}>Full name</span>
                  <span className={`text-[15px] font-medium ${VALUE_COLOR} text-right truncate`}>
                    {name.trim() || "—"}
                  </span>
                </div>
                <div className="py-3.5 border-b border-slate-100 flex justify-between gap-3">
                  <span className={`text-[15px] ${LABEL_COLOR}`}>Phone</span>
                  <span className={`text-[15px] font-medium ${VALUE_COLOR} text-right truncate`}>
                    {phone.trim() || "—"}
                  </span>
                </div>
                <div className="py-3.5 border-b border-slate-100 flex justify-between gap-3">
                  <span className={`text-[15px] ${LABEL_COLOR}`}>Email</span>
                  <span className={`text-[15px] font-medium ${VALUE_COLOR} text-right truncate`}>
                    {email.trim() || "—"}
                  </span>
                </div>
                <div className="py-3.5 border-b border-slate-100 flex justify-between gap-3 items-center">
                  <span className={`text-[15px] ${LABEL_COLOR}`}>Address</span>
                  {isEmpty(address) ? (
                    <button
                      type="button"
                      onClick={() => setMobileScreen("edit")}
                      className="text-sm font-medium text-[#6900AA] cursor-pointer"
                    >
                      + Add
                    </button>
                  ) : (
                    <span className={`text-[15px] font-medium ${VALUE_COLOR} text-right truncate max-w-[55%]`}>
                      {address.trim()}
                    </span>
                  )}
                </div>
                <div className="py-3.5 border-b border-slate-100 flex justify-between gap-3 items-center">
                  <span className={`text-[15px] ${LABEL_COLOR}`}>City</span>
                  {isEmpty(city) ? (
                    <button
                      type="button"
                      onClick={() => setMobileScreen("edit")}
                      className="text-sm font-medium text-[#6900AA] cursor-pointer"
                    >
                      + Add
                    </button>
                  ) : (
                    <span className={`text-[15px] font-medium ${VALUE_COLOR} text-right truncate`}>
                      {city.trim()}
                    </span>
                  )}
                </div>
                <div className="py-3.5 flex justify-between gap-3 items-center">
                  <span className={`text-[15px] ${LABEL_COLOR}`}>State</span>
                  {isEmpty(state) ? (
                    <button
                      type="button"
                      onClick={() => setMobileScreen("edit")}
                      className="text-sm font-medium text-[#6900AA] cursor-pointer"
                    >
                      + Add
                    </button>
                  ) : (
                    <span className={`text-[15px] font-medium ${VALUE_COLOR} text-right truncate`}>
                      {state.trim()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {mobileScreen === "edit" && (
          <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-4">
            <div className="flex items-center gap-3 px-1">
              <button
                type="button"
                onClick={() => setMobileScreen("details")}
                className="p-1 -ml-1 text-black cursor-pointer"
                aria-label="Back to personal details"
              >
                <ArrowLeft size={22} />
              </button>
              <h1 className="text-xl font-bold text-black">Edit Profile</h1>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-black">Basic information</h2>
                <div className="mt-3 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#6900AA] transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="mt-2 text-sm font-medium text-[#6900AA]">
                  {stepsDone} / {TOTAL_STEPS} steps done
                </p>
              </div>

              <div className="flex flex-col items-center py-2">
                <div className="w-24 h-24 rounded-full bg-[#F7E9FF] text-[#6900AA] flex items-center justify-center text-4xl font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              </div>

              <MobileField label="Full name" error={errors.name?.message}>
                <input
                  type="text"
                  className={mobileInputClass}
                  placeholder="Your name"
                  {...register("name")}
                />
              </MobileField>

              <MobileField label="Phone number" error={errors.phone?.message}>
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
                      showIcon={false}
                      inputClassName={mobileInputClass}
                    />
                  )}
                />
              </MobileField>

              <MobileField label="Email" error={errors.email?.message}>
                <input
                  type="email"
                  className={mobileInputClass}
                  placeholder="Enter your email"
                  {...register("email")}
                />
              </MobileField>

              <MobileField label="Address" error={errors.address?.message}>
                <input
                  type="text"
                  className={mobileInputClass}
                  placeholder="Street address"
                  {...register("address")}
                />
              </MobileField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <MobileField label="City" error={errors.city?.message}>
                  <input
                    type="text"
                    className={mobileInputClass}
                    placeholder="City"
                    {...register("city")}
                  />
                </MobileField>
                <MobileField label="State" error={errors.state?.message}>
                  <input
                    type="text"
                    className={mobileInputClass}
                    placeholder="State"
                    {...register("state")}
                  />
                </MobileField>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#111111] text-white text-[15px] font-semibold hover:bg-[#222222] transition-colors disabled:opacity-60 cursor-pointer"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </CustomerAccountLayout>
  );
}
