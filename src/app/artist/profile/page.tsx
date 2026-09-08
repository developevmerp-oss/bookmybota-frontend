"use client";

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
} from "@/services/api";
import PhoneInput from "@/components/Shared/PhoneInput";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import PartnerPhotoGalleryFields, {
  normalizeImageList,
} from "@/components/Shared/PartnerPhotoGalleryFields";
import ArtistMediaSocialFields from "@/components/ArtistAdminPanel/ArtistMediaSocialFields";
import {
  artistPartnerProfileSchema,
  type ArtistPartnerProfileValues,
} from "@/lib/partnerProfileFormSchemas";
import { emptyArtistMeta, normalizeArtistMetaClient, type ArtistMeta } from "@/lib/artistMeta";

export default function ArtistProfilePage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id ?? "";
  const { data: settings, isLoading, refetch } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const [updateSettings, { isLoading: saving }] = useUpdateBusinessSettingsMutation();
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [phoneValid, setPhoneValid] = useState(true);
  const [artistMeta, setArtistMeta] = useState<ArtistMeta>(() => emptyArtistMeta());

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ArtistPartnerProfileValues>({
    resolver: yupResolver(artistPartnerProfileSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      description: "",
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    if (!settings) return;
    setCoverImageUrl(settings.cover_image_url || "");
    setGalleryImages(normalizeImageList(settings.gallery_images));
    setArtistMeta(normalizeArtistMetaClient(settings.artist_meta));
    reset({
      name: settings.name || "",
      phone: settings.phone || "",
      address: settings.address || "",
      description: settings.description || "",
    });
  }, [settings, reset]);

  const onSave = handleSubmit(async (values) => {
    if (!phoneValid) {
      toast.error("Enter a valid phone number.");
      return;
    }
    try {
      await updateSettings({
        bizId,
        body: {
          name: values.name,
          address: values.address,
          phone: values.phone,
          description: values.description,
          cover_image_url: coverImageUrl || "",
          gallery_images: galleryImages,
          artist_meta: artistMeta,
        },
      }).unwrap();
      const refreshed = await refetch();
      if (refreshed.data?.artist_meta) {
        setArtistMeta(normalizeArtistMetaClient(refreshed.data.artist_meta));
      }
      toast.success("Artist profile saved");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save profile"));
    }
  });

  if (isLoading || !user) {
    return (
      <div className="p-10 text-center text-muted-foreground font-medium">Loading artist profile...</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <p className="org-section-label mb-2">Artist workspace</p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Artist profile
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          Update your profile, media samples, and social links after registration. Customers see these on your
          public page.
        </p>
        {settings?.venue_type_name ? (
          <p className="text-xs text-muted-foreground mt-2">
            Type: <span className="font-semibold text-foreground">{settings.venue_type_name}</span>
          </p>
        ) : null}
      </div>

      <form onSubmit={onSave} className="space-y-6" noValidate>
        <section className="org-card p-5 sm:p-6 space-y-5">
          <div>
            <label className="portal-label block text-sm font-semibold mb-1.5">Profile photo</label>
            <CroppedImageField
              value={coverImageUrl}
              aspect={1}
              disabled={uploading}
              previewClassName="w-32 h-32 rounded-2xl border border-border"
              emptyClassName="flex flex-col items-center justify-center w-32 h-32 rounded-2xl border border-dashed border-border hover:border-primary"
              onRemove={() => setCoverImageUrl("")}
              onCroppedFile={async (file) => {
                const fd = new FormData();
                fd.append("image", file);
                try {
                  const res = await uploadImage(fd).unwrap();
                  if (res.url) {
                    setCoverImageUrl(res.url);
                    toast.success("Photo uploaded");
                  }
                } catch (err) {
                  toast.error(extractApiError(err, "Failed to upload photo"));
                }
              }}
              emptyContent={
                <>
                  <ImagePlus className="text-muted-foreground mb-1" size={20} />
                  <span className="text-[10px] text-muted-foreground">
                    {uploading ? "Uploading…" : "Add photo"}
                  </span>
                </>
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="portal-label block text-sm font-semibold mb-1.5">
                Artist / stage name <span className="text-destructive">*</span>
              </label>
              <input {...register("name")} className="input-field" placeholder="Stage name" />
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
              Address / base city <span className="text-destructive">*</span>
            </label>
            <textarea
              {...register("address")}
              className="input-field min-h-[72px]"
              rows={2}
              placeholder="City or base location"
            />
            {errors.address && <p className="field-error">{errors.address.message}</p>}
          </div>

          <div>
            <label className="portal-label block text-sm font-semibold mb-1.5">
              Bio / description <span className="text-destructive">*</span>
            </label>
            <textarea
              {...register("description")}
              className="input-field min-h-[120px]"
              rows={4}
              placeholder="Genre, experience, performance style..."
            />
            {errors.description && <p className="field-error">{errors.description.message}</p>}
          </div>
        </section>

        <PartnerPhotoGalleryFields
          value={galleryImages}
          onChange={setGalleryImages}
          title="Photo gallery"
          description="Add photos for your public artist page."
        />

        <ArtistMediaSocialFields
          typeSlug={settings?.venue_type_slug}
          value={artistMeta}
          onChange={setArtistMeta}
          refreshingSocial={saving}
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
