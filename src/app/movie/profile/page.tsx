"use client";

import { Suspense, useEffect, useState } from "react";
import { DetailFormShimmer } from "@/components/Shared/Shimmer";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ImagePlus, Lock, Save, User } from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { extractApiError } from "@/lib/apiErrors";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import {
  useGetBusinessSettingsQuery,
  useUpdateBusinessSettingsMutation,
  useUploadImageMutation,
} from "@/services/api";
import PhoneInput from "@/components/Shared/PhoneInput";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import ChangePasswordForm from "@/components/Shared/ChangePasswordForm";

const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";
const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 transition-all";
const panelClass =
  "bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 lg:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300";

type ProfileTab = "profile" | "password";

function MovieProfileContent() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id ?? "";
  const { data: settings, isLoading } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const [updateSettings, { isLoading: saving }] = useUpdateBusinessSettingsMutation();
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();

  const tabParam = searchParams.get("tab");
  const activeTab: ProfileTab = tabParam === "password" ? "password" : "profile";

  const setTab = (tab: ProfileTab) => {
    const next = tab === "password" ? `${pathname}?tab=password` : pathname;
    router.replace(next);
  };

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(true);
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingKind, setUploadingKind] = useState<"logo" | "cover" | null>(null);

  useEffect(() => {
    if (!settings) return;
    setName(settings.name || "");
    setAddress(settings.address || "");
    setPhone(settings.phone || "");
    setDescription(settings.description || "");
    setCoverImageUrl(settings.cover_image_url || "");
    setLogoUrl(settings.logo_url || "");
  }, [settings]);

  const uploadCropped = async (file: File, kind: "logo" | "cover") => {
    const fd = new FormData();
    fd.append("image", file);
    setUploadingKind(kind);
    try {
      const res = await uploadImage(fd).unwrap();
      if (!res.url) throw new Error("Upload succeeded but no URL returned");
      if (kind === "logo") {
        setLogoUrl(res.url);
        toast.success("Logo uploaded");
      } else {
        setCoverImageUrl(res.url);
        toast.success("Cover image uploaded");
      }
    } catch (err) {
      toast.error(extractApiError(err, kind === "logo" ? "Failed to upload logo" : "Failed to upload image"));
    } finally {
      setUploadingKind(null);
    }
  };

  const onSave = async () => {
    if (!phoneValid) {
      toast.error("Please enter a valid phone number");
      return;
    }
    try {
      await updateSettings({
        bizId,
        body: {
          name,
          address,
          phone,
          description,
          cover_image_url: coverImageUrl || "",
          logo_url: logoUrl || "",
        },
      }).unwrap();
      toast.success("Cinema profile saved");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save profile"));
    }
  };

  if (isLoading || !user) {
    return <DetailFormShimmer />;
  }

  const tabs = [
    { id: "profile" as const, label: "My Profile", icon: User },
    { id: "password" as const, label: "Change Password", icon: Lock },
  ];

  const displayName = name || user.name || user.email?.split("@")[0] || "Cinema";
  const initial = displayName.charAt(0).toUpperCase();
  const logoSrc = logoUrl ? resolveMediaUrl(logoUrl) : "";
  const isUploading = uploading || uploadingKind !== null;

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start">
        <aside className="w-full lg:w-[240px] shrink-0 lg:sticky lg:top-24 self-start">
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

        <div className="flex-1 min-w-0 w-full space-y-6">
          {activeTab === "profile" ? (
            <div className={panelClass}>
              <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-slate-200">
                {logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoSrc}
                    alt={`${displayName} logo`}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border border-slate-200 shrink-0 bg-white"
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xl sm:text-2xl font-bold shrink-0">
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-base sm:text-lg font-semibold text-slate-800 truncate">
                    {displayName}
                  </p>
                  <p className="text-sm text-slate-500 truncate">{user.email}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Movie Admin</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-5 items-start">
                  <div>
                    <label className={labelClass}>Logo</label>
                    <CroppedImageField
                      value={logoUrl}
                      aspect={1}
                      disabled={isUploading}
                      previewClassName="w-28 h-28 rounded-2xl border border-slate-200 object-cover"
                      emptyClassName="flex flex-col items-center justify-center w-28 h-28 rounded-2xl border border-dashed border-slate-200 bg-slate-50 hover:border-rose-300 hover:bg-rose-50/40"
                      onRemove={() => setLogoUrl("")}
                      onCroppedFile={(file) => void uploadCropped(file, "logo")}
                      emptyContent={
                        <>
                          <ImagePlus className="text-slate-400 mb-1" size={18} />
                          <span className="text-[10px] text-slate-500">
                            {uploadingKind === "logo" ? "Uploading…" : "Add logo"}
                          </span>
                        </>
                      }
                    />
                    <p className="mt-1.5 text-xs text-slate-400 max-w-[11rem]">
                      Square logo shown in your admin sidebar.
                    </p>
                  </div>

                  <div>
                    <label className={labelClass}>Cover image</label>
                    <CroppedImageField
                      value={coverImageUrl}
                      aspect={16 / 9}
                      disabled={isUploading}
                      previewClassName="w-full max-w-sm aspect-video rounded-2xl border border-slate-200"
                      emptyClassName="flex flex-col items-center justify-center w-full max-w-sm aspect-video rounded-2xl border border-dashed border-slate-200 bg-slate-50 hover:border-rose-300 hover:bg-rose-50/40"
                      onRemove={() => setCoverImageUrl("")}
                      onCroppedFile={(file) => void uploadCropped(file, "cover")}
                      emptyContent={
                        <>
                          <ImagePlus className="text-slate-400 mb-1" size={20} />
                          <span className="text-[10px] text-slate-500">
                            {uploadingKind === "cover" ? "Uploading…" : "Add cover"}
                          </span>
                        </>
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>
                      Cinema name <span className="text-rose-600">*</span>
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                      placeholder="Cinema name"
                    />
                  </div>
                  <PhoneInput
                    label="Phone"
                    labelClassName={labelClass}
                    variant="light"
                    value={phone}
                    onChange={setPhone}
                    onValidChange={setPhoneValid}
                    required={false}
                  />
                </div>

                <div>
                  <label className={labelClass}>Address</label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={inputClass}
                    rows={2}
                    placeholder="Cinema address"
                  />
                </div>

                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={inputClass}
                    rows={4}
                    placeholder="Short description of your cinema"
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!settings) return;
                      setName(settings.name || "");
                      setAddress(settings.address || "");
                      setPhone(settings.phone || "");
                      setDescription(settings.description || "");
                      setCoverImageUrl(settings.cover_image_url || "");
                      setLogoUrl(settings.logo_url || "");
                    }}
                    className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void onSave()}
                    disabled={saving || !phoneValid}
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
                  >
                    <Save size={16} /> {saving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={`${panelClass} max-w-lg`}>
              <ChangePasswordForm variant="light" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MovieProfilePage() {
  return (
    <Suspense
      fallback={
        <DetailFormShimmer />
      }
    >
      <MovieProfileContent />
    </Suspense>
  );
}
