"use client";

import { useEffect, useState } from "react";
import { Building2, Mail, MapPin, Phone, Save, User, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import ChangePasswordForm from "@/components/Shared/ChangePasswordForm";
import PhoneInput from "@/components/Shared/PhoneInput";
import { useAppSelector } from "@/lib/hooks";
import { extractApiError } from "@/lib/apiErrors";
import { isValidPhone } from "@/lib/validation";
import {
  useGetBusinessSettingsQuery,
  useUpdateBusinessSettingsMutation,
  useUploadImageMutation,
  useGetCitiesQuery,
} from "@/services/api";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";

export default function OrganizerProfilePage() {
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";
  const { data: settings, isLoading } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const [updateSettings, { isLoading: saving }] = useUpdateBusinessSettingsMutation();
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();
  const { data: cities = [] } = useGetCitiesQuery();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [cityId, setCityId] = useState<number | "">("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [initialized, setInitialized] = useState(false);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizId) return;
    if (!name.trim()) {
      toast.error("Organizer name is required");
      return;
    }
    if (phone.trim() && !isValidPhone(phone)) {
      toast.error("Phone must be 9–12 digits (numbers only)");
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
      toast.success("Profile updated");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update profile"));
    }
  };

  if (isLoading || !initialized) {
    return <div className="text-zinc-400 py-10 text-center">Loading profile...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="portal-heading text-2xl font-bold">Organizer profile</h2>
        <p className="portal-muted mt-1">
          Details from registration. Update contact info here; login email cannot be changed.
        </p>
      </div>

      <form onSubmit={handleSave} className="glass-panel rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-white/5">
          {coverImageUrl ? (
            <img src={coverImageUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <span className="w-12 h-12 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-lg">
              {(name || user?.email || "O").charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-white truncate">{name || "Event Organizer"}</p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">Profile image</label>
          <CroppedImageField
            value={coverImageUrl}
            aspect={1}
            disabled={uploading}
            previewClassName="w-32 h-32 rounded-2xl border border-white/10"
            emptyClassName="flex flex-col items-center justify-center w-32 h-32 rounded-2xl border border-dashed border-white/20 hover:border-violet-400"
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
                <ImagePlus className="text-zinc-400 mb-1" size={20} />
                <span className="text-[10px] text-zinc-500">Add photo</span>
              </>
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Building2 size={14} /> Organizer name
            </span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field w-full"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Mail size={14} /> Login email
            </span>
          </label>
          <input
            value={user?.email || ""}
            disabled
            className="input-field w-full opacity-70 cursor-not-allowed"
          />
          <p className="text-xs text-zinc-500 mt-1">Used to sign in. Set at registration and cannot be edited here.</p>
        </div>

        <div>
          <PhoneInput
            value={phone}
            onChange={setPhone}
            variant="input-field"
            label="Phone"
            helperText="Contact number shown on your public events."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} /> City
            </span>
          </label>
          <select
            value={cityId === "" ? "" : String(cityId)}
            onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : "")}
            className="input-field w-full"
          >
            <option value="">Select city</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.state ? `, ${c.state}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} /> Address
            </span>
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input-field w-full"
            placeholder="Office / street address"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <User size={14} /> About
            </span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="input-field w-full"
            placeholder="Short description of your organization"
          />
        </div>

        <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:opacity-50">
          <Save size={16} />
          {saving ? "Saving..." : "Save profile"}
        </button>
      </form>

      <div className="glass-panel rounded-2xl p-6" id="password">
        <ChangePasswordForm variant="portal" />
      </div>
    </div>
  );
}
