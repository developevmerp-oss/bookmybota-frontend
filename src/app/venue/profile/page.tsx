"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
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
import PartnerPhotoGalleryFields, {
  normalizeImageList,
} from "@/components/Shared/PartnerPhotoGalleryFields";
import { parseContactPerson, venueTypeDisplayName } from "@/lib/venuePartnerInfo";
import { defaultVenueMeta, type VenueMeta } from "@/lib/venueCategoryConfig";
import {
  venuePartnerProfileSchema,
  type VenuePartnerProfileValues,
} from "@/lib/partnerProfileFormSchemas";

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

  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [phoneValid, setPhoneValid] = useState(true);
  const [documents, setDocuments] = useState<PartnerDocumentUpload[]>([]);
  const [venueMeta, setVenueMeta] = useState<VenueMeta>(() => defaultVenueMeta());

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VenuePartnerProfileValues>({
    resolver: yupResolver(venuePartnerProfileSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      aboutText: "",
      contactName: "",
      countryId: "",
      cityId: "",
    },
    mode: "onSubmit",
  });

  const countryId = watch("countryId");
  const cityId = watch("cityId");
  const venueTypeLabel = venueTypeDisplayName(settings?.venue_type_slug, settings?.venue_type_name);
  const adminEmail = settings?.admin_email || user?.email || "";

  useEffect(() => {
    if (!settings) return;
    const about = (() => {
      const raw = (settings.description || "").trim();
      if (!raw) return "";
      return raw.replace(/Contact person:\s*.+/i, "").trim();
    })();
    const meta =
      settings.venue_meta && typeof settings.venue_meta === "object"
        ? (settings.venue_meta as VenueMeta)
        : defaultVenueMeta();
    setVenueMeta(meta);
    setCoverImageUrl(settings.cover_image_url || "");
    setGalleryImages(normalizeImageList(settings.gallery_images));
    setDocuments(Array.isArray(settings.documents) ? settings.documents : []);
    reset({
      name: settings.name || "",
      phone: settings.phone || "",
      address: settings.address || "",
      aboutText: about,
      contactName: parseContactPerson(settings.description),
      countryId: settings.country_id ?? meta.registration?.country_id ?? "",
      cityId: settings.city_id ?? "",
    });
  }, [settings, reset]);

  const onSave = handleSubmit(async (values) => {
    if (!phoneValid) {
      toast.error("Enter a valid phone number.");
      return;
    }
    try {
      const nextDescription = [
        values.contactName.trim() ? `Contact person: ${values.contactName.trim()}` : "",
        values.aboutText || "",
      ]
        .filter(Boolean)
        .join("\n\n");

      await updateSettings({
        bizId,
        body: {
          name: values.name,
          address: values.address,
          phone: values.phone,
          description: nextDescription,
          cover_image_url: coverImageUrl || "",
          gallery_images: galleryImages,
          city_id: values.cityId ? Number(values.cityId) : null,
          documents,
          venue_meta: {
            ...venueMeta,
            registration: {
              ...(venueMeta.registration || {}),
              country_id: values.countryId ? Number(values.countryId) : null,
              contact_name: values.contactName.trim(),
            },
          },
        },
      }).unwrap();
      toast.success("Venue profile saved");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save profile"));
    }
  });

  if (isLoading || !user) {
    return (
      <div className="p-10 text-center text-muted-foreground font-medium">Loading venue profile...</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="org-section-label mb-2">Venue workspace</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Venue profile
          </h2>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Your registered venue details, contact person, and onboarding documents.
          </p>
        </div>
        <Link href="/venue/layout-requests" className="text-sm font-semibold text-primary hover:opacity-80">
          Request a layout site visit →
        </Link>
      </div>

      <form onSubmit={onSave} className="space-y-6" noValidate>
        <section className="org-card p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="font-display text-lg font-bold text-foreground">Venue information</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Basic details registered with BookMyBota.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Venue type
            </p>
            <p className="text-sm font-semibold text-foreground mt-1">{venueTypeLabel || "—"}</p>
          </div>

          <div>
            <label className="portal-label block text-sm font-semibold mb-1.5">Cover image</label>
            <CroppedImageField
              value={coverImageUrl}
              aspect={16 / 9}
              disabled={uploading}
              previewClassName="w-full max-w-sm aspect-video rounded-xl border border-border"
              emptyClassName="flex flex-col items-center justify-center w-full max-w-sm aspect-video rounded-xl border border-dashed border-border hover:border-primary"
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
                  <ImagePlus className="text-muted-foreground mb-1" size={20} />
                  <span className="text-[10px] text-muted-foreground">
                    {uploading ? "Uploading…" : "Add cover"}
                  </span>
                </>
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="portal-label block text-sm font-semibold mb-1.5">
                Venue name <span className="text-destructive">*</span>
              </label>
              <input {...register("name")} className="input-field" placeholder="Venue name" />
              {errors.name && <p className="field-error">{errors.name.message}</p>}
            </div>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  label="Phone"
                  labelClassName="portal-label block text-sm font-semibold mb-1.5"
                  variant="light"
                  value={field.value}
                  onChange={field.onChange}
                  onValidChange={setPhoneValid}
                  required
                  error={errors.phone?.message}
                />
              )}
            />
          </div>

          <div>
            <label className="portal-label block text-sm font-semibold mb-1.5">
              Venue address <span className="text-destructive">*</span>
            </label>
            <textarea
              {...register("address")}
              className="input-field min-h-[72px]"
              rows={2}
              placeholder="Street, area, landmarks"
            />
            {errors.address && <p className="field-error">{errors.address.message}</p>}
          </div>

          <div>
            <VenueLocationFields
              variant="light"
              countryId={countryId ?? ""}
              cityId={cityId ?? ""}
              onCountryChange={(id) =>
                setValue("countryId", id, { shouldValidate: true, shouldDirty: true })
              }
              onCityChange={(id) => setValue("cityId", id, { shouldValidate: true, shouldDirty: true })}
            />
            {(errors.countryId || errors.cityId) && (
              <p className="field-error">
                {errors.countryId?.message || errors.cityId?.message}
              </p>
            )}
          </div>

          <div>
            <label className="portal-label block text-sm font-semibold mb-1.5">About venue</label>
            <textarea
              {...register("aboutText")}
              className="input-field min-h-[96px]"
              rows={3}
              placeholder="Short description of your venue"
            />
            {errors.aboutText && <p className="field-error">{errors.aboutText.message}</p>}
          </div>
        </section>

        <PartnerPhotoGalleryFields
          value={galleryImages}
          onChange={setGalleryImages}
          title="Photo gallery"
          description="Add photos of your venue. Customers see these on your public profile."
        />

        <section className="org-card p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="font-display text-lg font-bold text-foreground">Contact person</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Primary contact for BookMyBota coordination.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="portal-label block text-sm font-semibold mb-1.5">
                Contact person name <span className="text-destructive">*</span>
              </label>
              <input
                {...register("contactName")}
                className="input-field"
                placeholder="Full name"
              />
              {errors.contactName && <p className="field-error">{errors.contactName.message}</p>}
            </div>
            <div>
              <label className="portal-label block text-sm font-semibold mb-1.5">Login email</label>
              <input value={adminEmail} readOnly className="input-field opacity-80 bg-muted/40" />
            </div>
          </div>
        </section>

        <PartnerDocumentsFields
          module="venue"
          value={documents}
          onChange={setDocuments}
          variant="light"
          editable
        />

        <div className="flex justify-end">
          <button type="submit" disabled={saving || !phoneValid} className="btn-primary disabled:opacity-50">
            {saving ? "Saving..." : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
