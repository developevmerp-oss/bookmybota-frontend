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
    <div className="w-full max-w-[1600px] mx-auto pb-28">
      <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
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
          {/* Basics — left */}
          <section className="org-card p-4 sm:p-5 xl:col-span-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-foreground">Basic details</h3>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="shrink-0">
                <label className="portal-label block text-xs font-semibold mb-1.5">Profile photo</label>
                <CroppedImageField
                  value={coverImageUrl}
                  aspect={1}
                  disabled={uploading}
                  previewClassName="w-28 h-28 rounded-2xl border border-border"
                  emptyClassName="flex flex-col items-center justify-center w-28 h-28 rounded-2xl border border-dashed border-border hover:border-primary"
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
                      <ImagePlus className="text-muted-foreground mb-1" size={18} />
                      <span className="text-[10px] text-muted-foreground">
                        {uploading ? "Uploading…" : "Add photo"}
                      </span>
                    </>
                  }
                />
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <label className="portal-label block text-xs font-semibold mb-1">
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
              </div>
            </div>

            <div>
              <label className="portal-label block text-xs font-semibold mb-1">
                Address / base city <span className="text-destructive">*</span>
              </label>
              <textarea
                {...register("address")}
                className="input-field min-h-[56px]"
                rows={2}
                placeholder="City or base location"
              />
              {errors.address && <p className="field-error">{errors.address.message}</p>}
            </div>

            <div>
              <label className="portal-label block text-xs font-semibold mb-1">
                Bio / description <span className="text-destructive">*</span>
              </label>
              <textarea
                {...register("description")}
                className="input-field min-h-[100px]"
                rows={4}
                placeholder="Genre, experience, performance style..."
              />
              {errors.description && <p className="field-error">{errors.description.message}</p>}
            </div>
          </section>

          {/* Gallery + social — right */}
          <div className="xl:col-span-7 space-y-4 min-w-0">
            <PartnerPhotoGalleryFields
              value={galleryImages}
              onChange={setGalleryImages}
              title="Photo gallery"
              description="Public artist page photos."
              compact
            />

            <ArtistMediaSocialFields
              typeSlug={settings?.venue_type_slug}
              value={artistMeta}
              onChange={setArtistMeta}
              refreshingSocial={saving}
              compact
              showMedia={false}
              showSocial
            />
          </div>
        </div>

        {/* Media samples — full width below */}
        <ArtistMediaSocialFields
          typeSlug={settings?.venue_type_slug}
          value={artistMeta}
          onChange={setArtistMeta}
          refreshingSocial={saving}
          compact
          showMedia
          showSocial={false}
        />

        {/* Mobile / sticky save */}
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 py-3 md:pl-[calc(16rem+1rem)]">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground hidden sm:block">
              Changes apply to your public artist page after save.
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
