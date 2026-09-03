"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { extractApiError } from "@/lib/apiErrors";
import {
  useGetBusinessSettingsQuery,
  useUpdateBusinessSettingsMutation,
  useUploadImageMutation,
  type PartnerDocumentUpload,
} from "@/services/api";
import PhoneInput from "@/components/Shared/PhoneInput";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import PartnerDocumentsFields from "@/components/DiningAdminPanel/PartnerDocumentsFields";
import VenueLocationFields from "@/components/VenueAdminPanel/VenueLocationFields";
import { parseContactPerson, venueTypeDisplayName } from "@/lib/venuePartnerInfo";
import { defaultVenueMeta, type VenueMeta } from "@/lib/venueCategoryConfig";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-sm text-white mt-1">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

export default function VenueProfilePage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id ?? "";
  const { data: settings, isLoading } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const [updateSettings, { isLoading: saving }] = useUpdateBusinessSettingsMutation();
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(true);
  const [description, setDescription] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [countryId, setCountryId] = useState<number | "">("");
  const [cityId, setCityId] = useState<number | "">("");
  const [contactName, setContactName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [documents, setDocuments] = useState<PartnerDocumentUpload[]>([]);
  const [venueMeta, setVenueMeta] = useState<VenueMeta>(() => defaultVenueMeta());

  const venueTypeLabel = venueTypeDisplayName(settings?.venue_type_slug, settings?.venue_type_name);

  useEffect(() => {
    if (!settings) return;
    setName(settings.name || "");
    setAddress(settings.address || "");
    setPhone(settings.phone || "");
    setDescription(settings.description || "");
    setAboutText(() => {
      const raw = (settings.description || "").trim();
      if (!raw) return "";
      return raw.replace(/Contact person:\s*.+/i, "").trim();
    });
    setCoverImageUrl(settings.cover_image_url || "");
    setCityId(settings.city_id ?? "");
    setAdminEmail(settings.admin_email || user?.email || "");
    setContactName(parseContactPerson(settings.description));
    setDocuments(Array.isArray(settings.documents) ? settings.documents : []);
    const meta =
      settings.venue_meta && typeof settings.venue_meta === "object"
        ? (settings.venue_meta as VenueMeta)
        : defaultVenueMeta();
    setVenueMeta(meta);
    setCountryId(
      settings.country_id ?? meta.registration?.country_id ?? ""
    );
  }, [settings, user?.email]);

  if (isLoading || !user) {
    return <div className="text-white p-10 text-center">Loading venue profile...</div>;
  }

  const saveProfile = async () => {
    try {
      const nextDescription = [
        contactName.trim() ? `Contact person: ${contactName.trim()}` : "",
        aboutText,
      ]
        .filter(Boolean)
        .join("\n\n");

      await updateSettings({
        bizId,
        body: {
          name,
          address,
          phone,
          description: nextDescription,
          cover_image_url: coverImageUrl || "",
          city_id: cityId ? Number(cityId) : null,
          documents,
          venue_meta: {
            ...venueMeta,
            registration: {
              ...(venueMeta.registration || {}),
              country_id: countryId ? Number(countryId) : null,
              contact_name: contactName.trim(),
            },
          },
        },
      }).unwrap();
      toast.success("Venue profile saved");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save profile"));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Venue profile</h2>
        <p className="text-zinc-400 mt-1">
          Your registered venue details, contact person, and onboarding documents.
        </p>
        <Link
          href="/venue/layout-requests"
          className="inline-block mt-2 text-sm font-medium text-amber-400 hover:text-amber-300"
        >
          Request a layout site visit →
        </Link>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-white">Venue information</h3>
          <p className="text-sm text-zinc-400 mt-1">Basic details registered with BookMyBota.</p>
        </div>

        <InfoRow label="Venue type" value={venueTypeLabel} />

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Cover image</label>
          <CroppedImageField
            value={coverImageUrl}
            aspect={16 / 9}
            disabled={uploading}
            previewClassName="w-full max-w-sm aspect-video rounded-2xl border border-white/10"
            emptyClassName="flex flex-col items-center justify-center w-full max-w-sm aspect-video rounded-2xl border border-dashed border-white/20 hover:border-amber-400"
            onRemove={() => setCoverImageUrl("")}
            onCroppedFile={async (file) => {
              const fd = new FormData();
              fd.append("image", file);
              try {
                const res = await uploadImage(fd).unwrap();
                if (res.url) {
                  setCoverImageUrl(res.url);
                  toast.success("Image uploaded");
                }
              } catch (err) {
                toast.error(extractApiError(err, "Failed to upload image"));
              }
            }}
            emptyContent={
              <>
                <ImagePlus className="text-zinc-400 mb-1" size={20} />
                <span className="text-[10px] text-zinc-500">{uploading ? "Uploading…" : "Add cover"}</span>
              </>
            }
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Venue name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" />
          </div>
          <PhoneInput
            label="Phone"
            labelClassName="block text-sm font-medium text-zinc-400 mb-2"
            variant="dark"
            value={phone}
            onChange={setPhone}
            onValidChange={setPhoneValid}
            required={false}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">Venue address</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white"
            rows={2}
          />
        </div>

        <VenueLocationFields
          variant="dark"
          countryId={countryId}
          cityId={cityId}
          onCountryChange={setCountryId}
          onCityChange={setCityId}
        />

        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-2">About venue</label>
          <textarea
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white"
            rows={3}
            placeholder="Short description of your venue"
          />
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Contact person</h3>
          <p className="text-sm text-zinc-400 mt-1">Primary contact for BookMyBota coordination.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Contact person name</label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="input-field"
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Login email</label>
            <input value={adminEmail} readOnly className="input-field opacity-80" />
          </div>
        </div>
      </div>

      <PartnerDocumentsFields
        module="venue"
        value={documents}
        onChange={setDocuments}
        variant="dark"
        editable
      />

      <div className="flex justify-end">
        <button
          onClick={() => void saveProfile()}
          disabled={saving || !phoneValid}
          className="btn-primary disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </div>
  );
}
