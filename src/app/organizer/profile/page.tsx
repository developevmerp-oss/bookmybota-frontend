"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Check,
  ImagePlus,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Pencil,
  Save,
  User,
} from "lucide-react";
import { toast } from "sonner";
import ChangePasswordForm from "@/components/Shared/ChangePasswordForm";
import PhoneInput from "@/components/Shared/PhoneInput";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import { useAppSelector } from "@/lib/hooks";
import { extractApiError } from "@/lib/apiErrors";
import { isValidPhone, PHONE_MAX_DIGITS, PHONE_MIN_DIGITS } from "@/lib/validation";
import {
  useGetBusinessSettingsQuery,
  useUpdateBusinessSettingsMutation,
  useUploadImageMutation,
  useGetCitiesQuery,
} from "@/services/api";

type FieldKey = "name" | "phone" | "city" | "address" | "description" | "cover";
type ProfileTab = "profile" | "password";

const inputClass =
  "w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 disabled:bg-slate-50 disabled:text-slate-500";

const selectClass =
  "w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 disabled:bg-slate-50 disabled:text-slate-500";

const textareaClass =
  "w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 disabled:bg-slate-50 disabled:text-slate-500 min-h-[110px] resize-y";

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
  alignTop,
}: {
  icon: ReactNode;
  children: ReactNode;
  showCheck?: boolean;
  alignTop?: boolean;
}) {
  return (
    <div className="relative">
      <span
        className={`absolute left-3 text-slate-400 pointer-events-none ${
          alignTop ? "top-3" : "top-1/2 -translate-y-1/2"
        }`}
      >
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
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";
  const { data: settings, isLoading } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const [updateSettings, { isLoading: isSaving }] = useUpdateBusinessSettingsMutation();
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();
  const { data: cities = [] } = useGetCitiesQuery();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [cityId, setCityId] = useState<number | "">("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [editing, setEditing] = useState<Record<FieldKey, boolean>>({
    name: false,
    phone: false,
    city: false,
    address: false,
    description: false,
    cover: false,
  });

  useEffect(() => {
    if (!settings || initialized) return;
    setName(settings.name || "");
    setAddress(settings.address || "");
    setCityId(settings.city_id ?? "");
    setPhone(settings.phone || "");
    setDescription(settings.description || "");
    setCoverImageUrl(settings.cover_image_url || "");
    setInitialized(true);
  }, [settings, initialized]);

  const enableEdit = (key: FieldKey) => {
    setEditing((prev) => ({ ...prev, [key]: true }));
  };

  const resetFromSettings = () => {
    setName(settings?.name || "");
    setAddress(settings?.address || "");
    setCityId(settings?.city_id ?? "");
    setPhone(settings?.phone || "");
    setDescription(settings?.description || "");
    setCoverImageUrl(settings?.cover_image_url || "");
    setEditing({
      name: false,
      phone: false,
      city: false,
      address: false,
      description: false,
      cover: false,
    });
  };

  const anyEditing = Object.values(editing).some(Boolean);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizId) return;
    if (!name.trim()) {
      toast.error("Organizer name is required");
      return;
    }
    if (phone.trim() && !isValidPhone(phone)) {
      toast.error(`Phone must be ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (numbers only)`);
      return;
    }
    try {
      await updateSettings({
        bizId,
        body: {
          name: name.trim(),
          address: address.trim(),
          city_id: cityId === "" ? null : cityId,
          phone: phone.trim(),
          description: description.trim(),
          cover_image_url: coverImageUrl || "",
        },
      }).unwrap();
      setEditing({
        name: false,
        phone: false,
        city: false,
        address: false,
        description: false,
        cover: false,
      });
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update profile"));
    }
  };

  if (isLoading || !initialized || !user) {
    return (
      <div className="flex items-center justify-center min-h-[12rem] text-slate-500 text-sm">
        Loading profile...
      </div>
    );
  }

  const email = user.email || "";
  const displayName = name || email.split("@")[0] || "Organizer";
  const selectedCity = cityId === "" ? undefined : cities.find((c) => c.id === cityId);
  const cityLabel = selectedCity
    ? `${selectedCity.name}${selectedCity.state ? `, ${selectedCity.state}` : ""}`
    : "—";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-slate-200">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt=""
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover shrink-0 border border-slate-200"
          />
        ) : (
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xl sm:text-2xl font-bold shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-base sm:text-lg font-semibold text-slate-800 truncate">{displayName}</p>
          <p className="text-sm text-slate-500 truncate">{email}</p>
          <p className="text-xs text-slate-400 mt-0.5">Event Organizer</p>
        </div>
      </div>

      <form onSubmit={onSave} className="space-y-5" noValidate>
        <div>
          <FieldHeader
            label="Profile image"
            editing={editing.cover}
            onEdit={() => enableEdit("cover")}
          />
          {editing.cover ? (
            <CroppedImageField
              value={coverImageUrl}
              aspect={1}
              disabled={uploading}
              previewClassName="w-32 h-32 rounded-2xl border border-slate-200"
              emptyClassName="flex flex-col items-center justify-center w-32 h-32 rounded-2xl border border-dashed border-slate-300 hover:border-rose-400 bg-slate-50"
              onRemove={() => setCoverImageUrl("")}
              onCroppedFile={async (file) => {
                const fd = new FormData();
                fd.append("image", file);
                try {
                  const res = await uploadImage(fd).unwrap();
                  if (res.url) setCoverImageUrl(res.url);
                } catch {
                  toast.error("Failed to upload image");
                }
              }}
              emptyContent={
                <>
                  <ImagePlus className="text-slate-400 mb-1" size={20} />
                  <span className="text-[10px] text-slate-500">Add photo</span>
                </>
              }
            />
          ) : (
            <div className="flex items-center gap-3">
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt=""
                  className="w-20 h-20 rounded-2xl object-cover border border-slate-200"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400">
                  <ImagePlus size={20} />
                </div>
              )}
              <p className="text-xs text-slate-400">Shown with your public events.</p>
            </div>
          )}
        </div>

        <div>
          <FieldHeader
            label="Organizer name"
            required
            htmlFor="org-profile-name"
            editing={editing.name}
            onEdit={() => enableEdit("name")}
          />
          <IconField icon={<Building2 size={16} />}>
            <input
              id="org-profile-name"
              type="text"
              disabled={!editing.name}
              className={inputClass}
              placeholder="Your organization name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </IconField>
        </div>

        <div>
          <FieldHeader
            label="Mobile Number"
            editing={editing.phone}
            onEdit={() => enableEdit("phone")}
          />
          <PhoneInput
            value={phone || ""}
            onChange={setPhone}
            disabled={!editing.phone}
            variant="light"
            showIcon
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

        <div>
          <FieldHeader
            label="City"
            htmlFor="org-profile-city"
            editing={editing.city}
            onEdit={() => enableEdit("city")}
          />
          {editing.city ? (
            <IconField icon={<MapPin size={16} />}>
              <select
                id="org-profile-city"
                className={selectClass}
                value={cityId === "" ? "" : String(cityId)}
                onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">Select city</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.state ? `, ${c.state}` : ""}
                  </option>
                ))}
              </select>
            </IconField>
          ) : (
            <IconField icon={<MapPin size={16} />}>
              <input type="text" value={cityLabel} disabled className={inputClass} readOnly />
            </IconField>
          )}
        </div>

        <div>
          <FieldHeader
            label="Address"
            htmlFor="org-profile-address"
            editing={editing.address}
            onEdit={() => enableEdit("address")}
          />
          <IconField icon={<MapPin size={16} />}>
            <input
              id="org-profile-address"
              type="text"
              disabled={!editing.address}
              className={inputClass}
              placeholder="Office / street address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </IconField>
        </div>

        <div>
          <FieldHeader
            label="About"
            htmlFor="org-profile-about"
            editing={editing.description}
            onEdit={() => enableEdit("description")}
          />
          <IconField icon={<User size={16} />} alignTop>
            <textarea
              id="org-profile-about"
              disabled={!editing.description}
              className={textareaClass}
              placeholder="Short description of your organization"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </IconField>
        </div>

        {anyEditing && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetFromSettings}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || uploading}
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

function OrganizerProfileContent() {
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
    <div className="-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8">
      <div className="w-full max-w-7xl mx-auto">
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
    </div>
  );
}

export default function OrganizerProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full flex items-center justify-center min-h-[12rem] text-slate-500 text-sm">
          Loading profile...
        </div>
      }
    >
      <OrganizerProfileContent />
    </Suspense>
  );
}

