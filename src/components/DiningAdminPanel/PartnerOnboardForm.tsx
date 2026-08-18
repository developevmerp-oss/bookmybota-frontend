"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { isValidPhone } from "@/lib/validation";
import { extractApiError } from "@/lib/apiErrors";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import {
  useGetBusinessTypesQuery,
  useGetPartnerDocumentMastersQuery,
  useGetAdminDiningCollectionsQuery,
  useRegisterBusinessMutation,
  useUpdateAdminBusinessMutation,
  useUploadImageMutation,
  type Business,
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

  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [parentTypeId, setParentTypeId] = useState("");
  const [venueTypeId, setVenueTypeId] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [documents, setDocuments] = useState<PartnerDocumentUpload[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [collectionIds, setCollectionIds] = useState<number[]>([]);
  const [phoneValid, setPhoneValid] = useState(false);
  const [onboardStatus, setOnboardStatus] = useState<"idle" | "success">("idle");
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [formReady, setFormReady] = useState(false);

  const selectedParent = businessTypes.find((t) => String(t.id) === parentTypeId);
  const isEventParent =
    partnerType === "event" || selectedParent?.module_key === "event";
  const resolvedModule: "dining" | "event" = isEventParent ? "event" : "dining";
  const isDining = resolvedModule === "dining";

  const { data: partnerDocMasters = [] } = useGetPartnerDocumentMastersQuery(resolvedModule, {
    skip: partnerType === "combined" && !parentTypeId,
  });
  const { data: collectionsData } = useGetAdminDiningCollectionsQuery(
    { limit: 100 },
    { skip: !isDining || variant !== "dark" }
  );
  const collectionOptions = collectionsData?.items ?? [];

  useEffect(() => {
    if (mode !== "edit" || !editingBusiness || formReady) return;
    if (businessTypes.length === 0) return;
    setBusinessName(editingBusiness.name || "");
    setAddress(editingBusiness.address || "");
    setPhone(editingBusiness.phone || "");
    setDescription(editingBusiness.description || "");
    setCoverImageUrl(editingBusiness.cover_image_url || "");
    setCollectionIds(
      Array.isArray(editingBusiness.collection_ids)
        ? editingBusiness.collection_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)
        : []
    );
    setAdminEmail(editingBusiness.admin_email || "");
    setDocuments(
      Array.isArray(editingBusiness.documents)
        ? editingBusiness.documents.filter((d) => d.document_type_id > 0 && d.url)
        : []
    );
    setPhoneValid(!!editingBusiness.phone);

    if (partnerType === "event") {
      const eventParent =
        businessTypes.find((t) => t.module_key === "event" && !t.parent_type_id) ||
        businessTypes.find((t) => t.id === editingBusiness.type_id);
      setParentTypeId(eventParent ? String(eventParent.id) : editingBusiness.type_id ? String(editingBusiness.type_id) : "");
      setVenueTypeId("");
    } else {
      const venue = businessTypes.find((t) => t.id === editingBusiness.type_id);
      setParentTypeId(venue?.parent_type_id != null ? String(venue.parent_type_id) : "");
      setVenueTypeId(venue ? String(venue.id) : "");
    }
    setFormReady(true);
  }, [mode, editingBusiness, partnerType, businessTypes, formReady]);

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

  const canSubmitCreate =
    !!businessName &&
    !!adminEmail &&
    phoneValid &&
    !!parentTypeId &&
    (isDining ? !!venueTypeId : true);

  const canSubmitEdit =
    !!businessName &&
    phoneValid &&
    !!parentTypeId &&
    (isDining ? !!venueTypeId : true);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(phone)) return;
    const docsErr = validateRequiredPartnerDocuments(partnerDocMasters, documents);
    if (docsErr) {
      setRegisterError(docsErr);
      toast.error(docsErr);
      return;
    }
    setRegisterError(null);
    try {
      const eventPartner =
        partnerType === "combined"
          ? resolvePartnerFromParentId(businessTypes, parentTypeId)
          : partnerType === "event"
            ? { partner_type: "event" as const, type_id: parseInt(parentTypeId, 10) }
            : null;
      const data = await registerBusiness({
        business_name: businessName,
        address,
        phone,
        description,
        type_id: eventPartner ? eventPartner.type_id : parseInt(venueTypeId, 10),
        admin_email: adminEmail,
        partner_type: eventPartner ? "event" : "dining",
        documents,
        cover_image_url: coverImageUrl || undefined,
        ...(eventPartner || variant !== "dark" ? {} : { collection_ids: collectionIds }),
      }).unwrap();
      setOnboardStatus("success");
      toast.success(data.message || "Registration received");
      setTimeout(() => router.push(backHref), 2500);
    } catch (err: unknown) {
      const message = extractApiError(err, "Registration failed. Please check your details or try again.");
      setRegisterError(message);
      toast.error(message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBusiness) return;
    if (phone && !isValidPhone(phone)) return;
    const docsErr = validateRequiredPartnerDocuments(partnerDocMasters, documents);
    if (docsErr) {
      toast.error(docsErr);
      return;
    }
    try {
      await updateAdminBusiness({
        id: editingBusiness.id,
        name: businessName,
        address,
        phone,
        description,
        ...(isDining
          ? { type_id: parseInt(venueTypeId, 10), collection_ids: collectionIds }
          : { type_id: parseInt(parentTypeId, 10) }),
        documents,
        cover_image_url: coverImageUrl || undefined,
      }).unwrap();
      toast.success(isDining ? "Dining business updated" : "Event organizer updated");
      router.push(backHref);
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to update"));
    }
  };

  const busy = isOnboarding || isUpdating;

  const fieldsGrid = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <PartnerTypeFields
        partnerType={partnerType}
        businessTypes={businessTypes}
        parentTypeId={parentTypeId}
        venueTypeId={venueTypeId}
        onParentTypeIdChange={(id) => {
          setParentTypeId(id);
          if (partnerType === "combined") setDocuments([]);
        }}
        onVenueTypeIdChange={setVenueTypeId}
        variant={variant}
      />

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
          {partnerType === "event" ? "Organizer Name" : "Business Name"}{" "}
          <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className={inputClass}
          placeholder={isDining ? "E.g., The Sapphire Room" : "E.g., LiveWire Productions"}
          required
        />
      </div>
      <div>
        <label className={labelClass}>
          Address <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={inputClass}
          placeholder="City / area"
          required
        />
      </div>
      <PhoneInput
        label="Phone Number"
        labelClassName={labelClass}
        variant={isDark ? "dark" : "light"}
        className={isDark ? undefined : "md:col-span-2"}
        value={phone}
        onChange={setPhone}
        onValidChange={setPhoneValid}
        required
        placeholder="9876543210"
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
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          className={`${inputClass} ${mode === "edit" ? "opacity-60 cursor-not-allowed" : ""}`}
          placeholder="admin@example.com"
          required={mode === "create"}
          disabled={mode === "edit"}
          readOnly={mode === "edit"}
        />
        <p className={`mt-1 text-xs ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
          {mode === "create"
            ? "Password is auto-generated and emailed after onboarding."
            : "Login email cannot be changed from this page."}
        </p>
      </div>
      <div className="md:col-span-2">
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
      disabled={busy || (mode === "create" ? !canSubmitCreate : !canSubmitEdit)}
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
          <form onSubmit={mode === "edit" ? handleUpdate : handleRegister} className="space-y-6">
            {fieldsGrid}
            {documentsBlock}
            {registerError && (
              <p className="text-sm font-semibold text-rose-500 text-center">{registerError}</p>
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
        <form onSubmit={mode === "edit" ? handleUpdate : handleRegister} className="space-y-6">
          <div className="glass-panel rounded-2xl border border-white/10 p-6 md:p-8">
            <h2 className="text-lg font-semibold text-white mb-5">Partner details</h2>
            {fieldsGrid}
          </div>

          {documentsBlock}

          {registerError && (
            <p className="text-sm font-semibold text-rose-500">{registerError}</p>
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
    </div>
  );
}
