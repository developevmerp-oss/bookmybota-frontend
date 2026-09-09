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
    <div className="w-full max-w-[1600px] mx-auto pb-28">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Link
          href="/venue/layout-requests"
          className="text-sm font-semibold text-primary hover:opacity-80"
        >
          Request a layout site visit →
        </Link>
        <button
          type="button"
          disabled={saving || !phoneValid}
          onClick={() => void onSave()}
          className="btn-primary disabled:opacity-50 shrink-0 hidden sm:inline-flex"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>

      <form onSubmit={onSave} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          {/* Left — core venue details (narrower column = readable fields) */}
          <section className="org-card p-4 sm:p-5 xl:col-span-5 space-y-4">
            <div>
              <h3 className="font-display text-base font-bold text-foreground">Venue information</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Basic details registered with BookMyBota.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Venue type
              </p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{venueTypeLabel || "—"}</p>
            </div>

            <div>
              <label className="portal-label block text-xs font-semibold mb-1.5">Cover image</label>
              <CroppedImageField
                value={coverImageUrl}
                aspect={16 / 9}
                disabled={uploading}
                previewClassName="w-full max-w-[280px] aspect-video rounded-xl border border-border"
                emptyClassName="flex flex-col items-center justify-center w-full max-w-[280px] aspect-video rounded-xl border border-dashed border-border hover:border-primary"
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

            <div>
              <label className="portal-label block text-xs font-semibold mb-1">
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
                  labelClassName="portal-label block text-xs font-semibold mb-1"
                  variant="light"
                  value={field.value}
                  onChange={field.onChange}
                  onValidChange={setPhoneValid}
                  required
                  error={errors.phone?.message}
                />
              )}
            />

            <div>
              <label className="portal-label block text-xs font-semibold mb-1">
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
                onCityChange={(id) =>
                  setValue("cityId", id, { shouldValidate: true, shouldDirty: true })
                }
              />
              {(errors.countryId || errors.cityId) && (
                <p className="field-error">{errors.countryId?.message || errors.cityId?.message}</p>
              )}
            </div>

            <div>
              <label className="portal-label block text-xs font-semibold mb-1">About venue</label>
              <textarea
                {...register("aboutText")}
                className="input-field min-h-[96px]"
                rows={3}
                placeholder="Short description of your venue"
              />
              {errors.aboutText && <p className="field-error">{errors.aboutText.message}</p>}
            </div>
          </section>

          {/* Right — contact + gallery */}
          <div className="xl:col-span-7 space-y-4">
            <section className="org-card p-4 sm:p-5 space-y-4">
              <div>
                <h3 className="font-display text-base font-bold text-foreground">Contact person</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Primary contact for BookMyBota coordination.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="portal-label block text-xs font-semibold mb-1">
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
                  <label className="portal-label block text-xs font-semibold mb-1">Login email</label>
                  <input
                    value={adminEmail}
                    readOnly
                    className="input-field opacity-80 bg-muted/40"
                  />
                </div>
              </div>
            </section>

            <PartnerPhotoGalleryFields
              value={galleryImages}
              onChange={setGalleryImages}
              title="Photo gallery"
              description="Add photos of your venue. Customers see these on your public profile."
            />
          </div>
        </div>

        <PartnerDocumentsFields
          module="venue"
          value={documents}
          onChange={setDocuments}
          variant="light"
          editable
        />

        <div className="fixed bottom-0 inset-x-0 md:left-64 z-20 border-t border-border bg-card/95 backdrop-blur-sm px-4 py-3 sm:px-6 lg:px-8">
          <div className="w-full max-w-[1600px] mx-auto flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground hidden sm:block">
              Changes apply to your public venue page after save.
            </p>
            <button
              type="submit"
              disabled={saving || !phoneValid}
              className="btn-primary disabled:opacity-50 ml-auto"
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
