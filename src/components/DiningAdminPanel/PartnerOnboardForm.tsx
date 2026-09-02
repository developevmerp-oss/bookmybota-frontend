"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ArrowLeft, CheckCircle, Loader2, Plus, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import PartnerTypeFields, {
  resolvePartnerFromParentId,
  type PartnerModule,
} from "@/components/DiningAdminPanel/PartnerTypeFields";
import PartnerDocumentsFields, {
  validateRequiredPartnerDocuments,
} from "@/components/DiningAdminPanel/PartnerDocumentsFields";
import PhoneInput from "@/components/Shared/PhoneInput";
import { extractApiError } from "@/lib/apiErrors";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import {
  partnerOnboardSchema,
  type PartnerOnboardValues,
} from "@/lib/adminFormSchemas";
import {
  useGetBusinessTypesQuery,
  useGetPartnerDocumentMastersQuery,
  useGetAdminDiningCollectionsQuery,
  useGetPartnerOnboardingTermsQuery,
  useGetAdminCitiesQuery,
  useRegisterBusinessMutation,
  useUpdateAdminBusinessMutation,
  useUploadImageMutation,
  type Business,
  type CityMaster,
  type PartnerDocumentUpload,
} from "@/services/api";

type FormVariant = "light" | "dark";
type FormMode = "create" | "edit";

interface PartnerOnboardFormProps {
  partnerType: PartnerModule;
  variant?: FormVariant;
  mode?: FormMode;
  editingBusiness?: Business | null;
  backHref: string;
  title: string;
  subtitle: string;
  successDetail?: string;
}

export default function PartnerOnboardForm({
  partnerType,
  variant = "light",
  mode = "create",
  editingBusiness = null,
  backHref,
  title,
  subtitle,
  successDetail,
}: PartnerOnboardFormProps) {
  const router = useRouter();
  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const [registerBusiness, { isLoading: isOnboarding }] = useRegisterBusinessMutation();
  const [updateAdminBusiness, { isLoading: isUpdating }] = useUpdateAdminBusinessMutation();
  const [uploadImage, { isLoading: uploadingImage }] = useUploadImageMutation();

  const [documents, setDocuments] = useState<PartnerDocumentUpload[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [collectionIds, setCollectionIds] = useState<number[]>([]);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [onboardStatus, setOnboardStatus] = useState<"idle" | "success">("idle");
  const [formReady, setFormReady] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    reset,
    formState: { errors },
  } = useForm<PartnerOnboardValues>({
    resolver: yupResolver(partnerOnboardSchema),
    defaultValues: {
      business_name: "",
      address: "",
      phone: "",
      description: "",
      parent_type_id: "",
      venue_type_id: "",
      admin_email: "",
      accept_terms: mode === "edit",
    },
    mode: "onSubmit",
  });

  const parentTypeId = watch("parent_type_id");
  const venueTypeId = watch("venue_type_id");
  const phone = watch("phone");
  const acceptTerms = watch("accept_terms");

  const selectedParent = businessTypes.find((t) => String(t.id) === parentTypeId);
  const isEventParent =
    partnerType === "event" || selectedParent?.module_key === "event";
  const isVenueParent =
    partnerType === "venue" || selectedParent?.module_key === "venue";
  const isArtistParent =
    partnerType === "artist" || selectedParent?.module_key === "artist";
  const isCinemaParent =
    partnerType === "cinema" || selectedParent?.module_key === "cinema";
  const resolvedModule: "dining" | "event" | "venue" | "artist" | "cinema" = isEventParent
    ? "event"
    : isCinemaParent
      ? "cinema"
      : isVenueParent
        ? "venue"
        : isArtistParent
          ? "artist"
          : "dining";
  const isDining = resolvedModule === "dining";
  const isVenue = resolvedModule === "venue";
  const isArtist = resolvedModule === "artist";
  const needsSubtype = isDining || isVenue || isArtist;

  const { data: partnerDocMasters = [] } = useGetPartnerDocumentMastersQuery(resolvedModule, {
    skip: partnerType === "combined" && !parentTypeId,
  });
  const { data: collectionsData } = useGetAdminDiningCollectionsQuery(
    { limit: 100 },
    { skip: !isDining || variant !== "dark" }
  );
  const collectionOptions = collectionsData?.items ?? [];
  const { data: onboardingTerms = [] } = useGetPartnerOnboardingTermsQuery(resolvedModule, {
    skip: mode !== "create",
  });

  const { data: citiesData } = useGetAdminCitiesQuery({ limit: 500 });
  const allCities = citiesData?.items ?? [];

  const country = watch("country");
  const countries = useMemo(() => {
    const set = new Set<string>();
    allCities.forEach((c: CityMaster) => {
      if (c.country) set.add(c.country);
    });
    return Array.from(set).sort();
  }, [allCities]);

  const filteredCities = useMemo(() => {
    if (!country) return allCities;
    return allCities.filter((c: CityMaster) => c.country === country);
  }, [allCities, country]);

  const handleCityChange = useCallback((cityIdStr: string) => {
    setValue("city_id", cityIdStr, { shouldValidate: true, shouldDirty: true });
    if (cityIdStr) {
      const matchedCity = allCities.find((c: CityMaster) => String(c.id) === cityIdStr);
      if (matchedCity?.country) {
        setValue("country", matchedCity.country, { shouldDirty: true });
      }
    }
  }, [setValue, allCities]);

  const handleCountryChange = useCallback((countryName: string) => {
    setValue("country", countryName, { shouldValidate: true, shouldDirty: true });
    if (countryName) {
      const currentCityId = watch("city_id");
      const matched = allCities.find((c: CityMaster) => String(c.id) === currentCityId);
      if (matched && matched.country !== countryName) {
        setValue("city_id", "", { shouldDirty: true });
      }
    }
  }, [setValue, watch, allCities]);

  // If allCities loads after form is ready in edit mode, ensure country and city_id are hydrated
  useEffect(() => {
    if (mode !== "edit" || !editingBusiness || allCities.length === 0) return;
    if (editingBusiness.city_id) {
      const currentCity = allCities.find((c: CityMaster) => c.id === editingBusiness.city_id);
      if (currentCity?.country && !watch("country")) {
        setValue("country", currentCity.country, { shouldDirty: false });
      }
      if (!watch("city_id")) {
        setValue("city_id", String(editingBusiness.city_id), { shouldDirty: false });
      }
    }
  }, [mode, editingBusiness, allCities, setValue, watch]);

  useEffect(() => {
    if (mode !== "edit" || !editingBusiness || formReady) return;
    if (businessTypes.length === 0) return;

    let nextParent = "";
    let nextVenue = "";
    if (partnerType === "event") {
      const eventParent =
        businessTypes.find((t) => t.module_key === "event" && !t.parent_type_id) ||
        businessTypes.find((t) => t.id === editingBusiness.type_id);
      nextParent = eventParent ? String(eventParent.id) : editingBusiness.type_id ? String(editingBusiness.type_id) : "";
      nextVenue = "";
    } else if (partnerType === "cinema") {
      const cinemaParent =
        businessTypes.find((t) => t.module_key === "cinema" && !t.parent_type_id) ||
        businessTypes.find((t) => t.id === editingBusiness.type_id);
      nextParent = cinemaParent ? String(cinemaParent.id) : editingBusiness.type_id ? String(editingBusiness.type_id) : "";
      nextVenue = "";
    } else if (partnerType === "venue" || partnerType === "artist" || partnerType === "dining") {
      const child = businessTypes.find((t) => t.id === editingBusiness.type_id);
      nextParent = child?.parent_type_id != null ? String(child.parent_type_id) : "";
      nextVenue = child ? String(child.id) : "";
    } else {
      const child = businessTypes.find((t) => t.id === editingBusiness.type_id);
      nextParent = child?.parent_type_id != null ? String(child.parent_type_id) : "";
      nextVenue = child ? String(child.id) : "";
    }

    const currentCity = allCities.find((c: CityMaster) => c.id === editingBusiness.city_id);

    reset({
      business_name: editingBusiness.name || "",
      address: editingBusiness.address || "",
      phone: editingBusiness.phone || "",
      description: editingBusiness.description || "",
      parent_type_id: nextParent,
      venue_type_id: nextVenue,
      country: currentCity?.country || "",
      city_id: editingBusiness.city_id ? String(editingBusiness.city_id) : "",
      admin_email: editingBusiness.admin_email || "",
      accept_terms: true,
    });
    setCoverImageUrl(editingBusiness.cover_image_url || "");
    setCollectionIds(
      Array.isArray(editingBusiness.collection_ids)
        ? editingBusiness.collection_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)
        : []
    );
    setDocuments(
      Array.isArray(editingBusiness.documents)
        ? editingBusiness.documents.filter((d) => d.document_type_id > 0 && d.url)
        : []
    );
    setFormReady(true);
  }, [mode, editingBusiness, partnerType, businessTypes, allCities, formReady, reset]);

  const isDark = variant === "dark";
  const labelClass = isDark
    ? "block text-sm font-medium text-zinc-400 mb-2"
    : "block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2";
  const inputClass = isDark
    ? "input-field"
    : "w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6900AA] focus:border-[#6900AA] text-sm";
  const textareaClass = isDark
    ? "w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 transition-all"
    : "w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6900AA] focus:border-[#6900AA] text-sm";
  const headingClass = isDark ? "text-white" : "text-slate-800";
  const mutedClass = isDark ? "text-zinc-400" : "text-slate-500";
  const panelClass = isDark
    ? "glass-panel rounded-2xl border border-white/10 p-6 md:p-8"
    : "bg-white rounded-2xl border border-slate-100 shadow-xl p-6 md:p-8 w-full";
  const fieldErrorClass = isDark
    ? "mt-1.5 text-xs text-rose-400 font-medium"
    : "mt-1.5 text-xs text-rose-600 font-medium";

  const onValid = async (values: PartnerOnboardValues) => {
    let hasLocalError = false;
    if (needsSubtype && !values.venue_type_id) {
      setError("venue_type_id", { type: "manual", message: "Please select a type." });
      hasLocalError = true;
    } else {
      clearErrors("venue_type_id");
    }
    if (mode === "create" && !values.accept_terms) {
      setError("accept_terms", {
        type: "manual",
        message: "You must accept the onboarding terms and conditions.",
      });
      hasLocalError = true;
    } else {
      clearErrors("accept_terms");
    }
    if (hasLocalError) return;

    const docsErr = validateRequiredPartnerDocuments(partnerDocMasters, documents);
    if (docsErr) {
      toast.error(docsErr);
      return;
    }

    if (mode === "create") {
      try {
        const selectedPartner =
          partnerType === "combined"
            ? resolvePartnerFromParentId(businessTypes, values.parent_type_id)
            : partnerType === "event"
              ? { partner_type: "event" as const, type_id: parseInt(values.parent_type_id, 10) }
              : partnerType === "cinema"
                ? { partner_type: "cinema" as const, type_id: parseInt(values.parent_type_id, 10) }
                : partnerType === "venue"
                  ? { partner_type: "venue" as const, type_id: parseInt(values.parent_type_id, 10) }
                  : partnerType === "artist"
                    ? { partner_type: "artist" as const, type_id: parseInt(values.parent_type_id, 10) }
                    : null;
        const data = await registerBusiness({
          business_name: values.business_name,
          address: values.address,
          phone: values.phone,
          description: values.description || "",
          city_id: values.city_id ? parseInt(values.city_id, 10) : undefined,
          type_id: selectedPartner
            ? selectedPartner.partner_type === "event" || selectedPartner.partner_type === "cinema"
              ? selectedPartner.type_id
              : parseInt(values.venue_type_id, 10)
            : parseInt(values.venue_type_id, 10),
          admin_email: values.admin_email,
          partner_type: selectedPartner ? selectedPartner.partner_type : "dining",
          documents,
          cover_image_url: coverImageUrl || undefined,
          ...(isDining && variant === "dark" ? { collection_ids: collectionIds } : {}),
          registration_terms_accepted: true,
          registration_terms_version: `${resolvedModule}-v1`,
        }).unwrap();
        setOnboardStatus("success");
        toast.success(data.message || "Registration received");
        setTimeout(() => router.push(backHref), 2500);
      } catch (err: unknown) {
        toast.error(extractApiError(err, "Registration failed. Please check your details or try again."));
      }
      return;
    }

    if (!editingBusiness) return;
    try {
      await updateAdminBusiness({
        id: editingBusiness.id,
        name: values.business_name,
        address: values.address,
        phone: values.phone,
        description: values.description || "",
        city_id: values.city_id ? parseInt(values.city_id, 10) : null,
        ...(isDining
          ? { type_id: parseInt(values.venue_type_id, 10), collection_ids: collectionIds }
          : isVenue || isArtist
            ? { type_id: parseInt(values.venue_type_id, 10) }
            : { type_id: parseInt(values.parent_type_id, 10) }),
        documents,
        cover_image_url: coverImageUrl || undefined,
      }).unwrap();
      toast.success(
        isDining
          ? "Dining business updated"
          : isVenue
            ? "Venue partner updated"
            : isArtist
              ? "Artist partner updated"
              : isCinemaParent
                ? "Cinema partner updated"
                : "Event organizer updated"
      );
      router.push(backHref);
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to update"));
    }
  };

  const busy = isOnboarding || isUpdating;

  const handleParentTypeIdChange = useCallback((id: string) => {
    setValue("parent_type_id", id, { shouldValidate: true, shouldDirty: true });
    if (partnerType === "combined") setDocuments([]);
  }, [setValue, partnerType]);

  const handleVenueTypeIdChange = useCallback((id: string) => {
    setValue("venue_type_id", id, { shouldValidate: true, shouldDirty: true });
  }, [setValue]);

  const fieldsGrid = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <PartnerTypeFields
        partnerType={partnerType}
        businessTypes={businessTypes}
        parentTypeId={parentTypeId}
        venueTypeId={venueTypeId}
        onParentTypeIdChange={handleParentTypeIdChange}
        onVenueTypeIdChange={handleVenueTypeIdChange}
        variant={variant}
      />
      {errors.parent_type_id && (
        <p className={`md:col-span-2 ${fieldErrorClass}`}>{errors.parent_type_id.message}</p>
      )}
      {needsSubtype && errors.venue_type_id && (
        <p className={`md:col-span-2 ${fieldErrorClass}`}>{errors.venue_type_id.message}</p>
      )}

      {isDining && isDark && (
        <div className="md:col-span-2">
          <label className={labelClass}>Collections</label>
          {collectionOptions.length === 0 ? (
            <p className={`text-xs ${mutedClass}`}>
              No collections yet. Add them in Dining Masters, then assign restaurants here.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {collectionOptions.map((c) => {
                const selected = collectionIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setCollectionIds((prev) =>
                        selected ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                      )
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selected
                        ? isDark
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                        : isDark
                          ? "text-zinc-400 border-white/10 hover:bg-white/5 hover:text-white"
                          : "text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {c.title}
                  </button>
                );
              })}
            </div>
          )}
          <p className={`text-xs mt-1.5 ${mutedClass}`}>
            Super Admin curated lists shown on the dining homepage. Partners cannot change this from their profile.
          </p>
        </div>
      )}

      <div>
        <label className={labelClass}>
          {partnerType === "event" ? "Organizer Name" : partnerType === "venue" ? "Venue Name" : "Business Name"}{" "}
          <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          {...register("business_name")}
          className={inputClass}
          placeholder={isDining ? "E.g., The Sapphire Room" : isVenue ? "E.g., Millennium Hall" : "E.g., LiveWire Productions"}
        />
        {errors.business_name && <p className={fieldErrorClass}>{errors.business_name.message}</p>}
      </div>
      <div>
        <label className={labelClass}>
          Address <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          {...register("address")}
          className={inputClass}
          placeholder="Street address / locality"
        />
        {errors.address && <p className={fieldErrorClass}>{errors.address.message}</p>}
      </div>
      <div>
        <label className={labelClass}>Country</label>
        <select
          value={country || ""}
          onChange={(e) => handleCountryChange(e.target.value)}
          className={inputClass}
        >
          <option value="">All Countries</option>
          {countries.map((c: string) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>City (from City Master)</label>
        <select
          value={watch("city_id") || ""}
          onChange={(e) => handleCityChange(e.target.value)}
          className={inputClass}
        >
          <option value="">Select City</option>
          {filteredCities.map((c: CityMaster) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.state ? `(${c.state})` : ""} - {c.country}
            </option>
          ))}
        </select>
        {errors.city_id && <p className={fieldErrorClass}>{errors.city_id.message}</p>}
      </div>
      <PhoneInput
        label="Phone Number"
        labelClassName={labelClass}
        variant={isDark ? "dark" : "light"}
        className={isDark ? undefined : "md:col-span-2"}
        value={phone || ""}
        onChange={(v) => setValue("phone", v, { shouldValidate: true, shouldDirty: true })}
        required
        placeholder="9876543210"
        error={errors.phone?.message}
        showError={Boolean(errors.phone)}
        helperText={!isDark ? "9–12 digits, numbers only" : undefined}
      />
            <div className={isDark ? "" : "md:col-span-2"}>
              <label className={labelClass}>Profile image</label>
              <CroppedImageField
                value={coverImageUrl}
                aspect={1}
                disabled={uploadingImage}
                previewClassName="w-32 h-32 rounded-2xl"
                emptyClassName="flex flex-col items-center justify-center w-32 h-32 rounded-2xl border border-dashed border-slate-300 hover:border-[#6900AA]"
                onRemove={() => setCoverImageUrl("")}
                onCroppedFile={async (file) => {
                  const formData = new FormData();
                  formData.append("image", file);
                  try {
                    const res = await uploadImage(formData).unwrap();
                    if (res.url) setCoverImageUrl(res.url);
                  } catch {
                    toast.error("Failed to upload profile image");
                  }
                }}
                emptyContent={
                  <>
                    <ImagePlus className="text-slate-400 mb-1" size={20} />
                    <span className="text-[10px] portal-muted">Add photo</span>
                  </>
                }
              />
            </div>
      <div>
        <label className={labelClass}>
          Admin Login Email <span className="text-rose-500">*</span>
        </label>
        <input
          type="email"
          {...register("admin_email")}
          className={`${inputClass} ${mode === "edit" ? "opacity-60 cursor-not-allowed" : ""}`}
          placeholder="admin@example.com"
          disabled={mode === "edit"}
          readOnly={mode === "edit"}
        />
        {errors.admin_email && <p className={fieldErrorClass}>{errors.admin_email.message}</p>}
        <p className={`mt-1 text-xs ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
          {mode === "create"
            ? "Password is auto-generated and emailed after onboarding."
            : "Login email cannot be changed from this page."}
        </p>
      </div>
      <div className="md:col-span-2">
        <label className={labelClass}>Description</label>
        <textarea
          {...register("description")}
          className={textareaClass}
          placeholder="Brief description..."
          rows={3}
        />
      </div>
    </div>
  );

  const documentsBlock =
    partnerType !== "combined" || parentTypeId ? (
      <PartnerDocumentsFields
        module={resolvedModule}
        value={documents}
        onChange={setDocuments}
        variant={variant}
      />
    ) : null;

  const submitButton = (
    <button
      type="submit"
      disabled={busy}
      className={
        isDark
          ? "btn-primary disabled:opacity-50 inline-flex items-center justify-center gap-2 min-w-48"
          : "w-full bg-[#6900AA] hover:bg-[#57008E] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-colors"
      }
    >
      {busy ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          {mode === "create" ? (isDark ? "Creating..." : "Registering...") : "Saving..."}
        </>
      ) : (
        <>
          {mode === "create" && <Plus size={18} />}
          {mode === "create"
            ? isDark
              ? isDining
                ? "Create Dining Business"
                : isVenue
                  ? "Create Venue Partner"
                  : "Create Event Organizer"
              : "Register Business"
            : "Save Changes"}
        </>
      )}
    </button>
  );

  const successBlock = (
    <div className={`text-center py-10 ${isDark ? panelClass : ""}`}>
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
          isDark ? "bg-green-500/20 text-green-500" : "bg-green-100 text-green-500"
        }`}
      >
        <CheckCircle size={32} />
      </div>
      <h3 className={`text-xl font-bold mb-2 ${headingClass}`}>
        {mode === "create" ? "Registration received" : "Partner updated"}
      </h3>
      <p className={mutedClass}>
        {successDetail ||
          (mode === "create"
            ? "A temporary password is emailed when the account is enabled. Redirecting…"
            : "Redirecting back to the list…")}
      </p>
    </div>
  );

  if (!isDark) {
    return (
      <div className={panelClass}>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold mb-6 text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className={`text-2xl font-bold mb-2 ${headingClass}`}>{title}</h1>
        <p className={`${mutedClass} text-sm mb-8`}>{subtitle}</p>
        {onboardStatus === "success" ? (
          successBlock
        ) : (
          <form onSubmit={handleSubmit(onValid)} className="space-y-6" noValidate>
            {fieldsGrid}
            {documentsBlock}
            {mode === "create" && (
              <div className="space-y-2">
                <label className="flex items-start gap-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={!!acceptTerms}
                    onChange={(e) =>
                      setValue("accept_terms", e.target.checked, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                    className="mt-1"
                  />
                  <span>
                    I confirm the documents are valid and I accept the platform onboarding terms and conditions.
                  </span>
                </label>
                {errors.accept_terms && (
                  <p className={fieldErrorClass}>{errors.accept_terms.message}</p>
                )}
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 underline"
                >
                  View terms and conditions
                </button>
              </div>
            )}
            {submitButton}
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold mb-4 text-zinc-400 hover:text-white"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-white">{title}</h1>
        <p className="text-zinc-400 text-sm mt-1">{subtitle}</p>
      </div>

      {onboardStatus === "success" ? (
        successBlock
      ) : (
        <form onSubmit={handleSubmit(onValid)} className="space-y-6" noValidate>
          <div className="glass-panel rounded-2xl border border-white/10 p-6 md:p-8">
            <h2 className="text-lg font-semibold text-white mb-5">Partner details</h2>
            {fieldsGrid}
          </div>

          {documentsBlock}

          {mode === "create" && (
            <div className="glass-panel rounded-2xl border border-white/10 p-5">
              <label className="flex items-start gap-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={!!acceptTerms}
                  onChange={(e) =>
                    setValue("accept_terms", e.target.checked, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  className="mt-1"
                />
                <span>I confirm the documents are valid and I accept the platform onboarding terms and conditions.</span>
              </label>
              {errors.accept_terms && (
                <p className={fieldErrorClass}>{errors.accept_terms.message}</p>
              )}
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="mt-2 text-sm text-violet-300 hover:text-violet-200 underline"
              >
                View terms and conditions
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
            <Link
              href={backHref}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 text-center"
            >
              Cancel
            </Link>
            {submitButton}
          </div>
        </form>
      )}

      {showTermsModal && mode === "create" && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-zinc-950 shadow-2xl">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white font-semibold">Onboarding Terms & Conditions</h3>
              <button type="button" onClick={() => setShowTermsModal(false)} className="text-zinc-400 hover:text-white">
                Close
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              {onboardingTerms.length > 0 ? (
                onboardingTerms.map((term, idx) => (
                  <p key={term.id} className="text-sm text-zinc-200 leading-relaxed">
                    {idx + 1}. {term.text}
                  </p>
                ))
              ) : (
                <p className="text-sm text-zinc-400">
                  Platform onboarding terms will appear here when Super Admin adds them.
                </p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-zinc-300 border border-white/10 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue("accept_terms", true, { shouldValidate: true, shouldDirty: true });
                  setShowTermsModal(false);
                }}
                className="btn-primary"
              >
                Accept terms
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
