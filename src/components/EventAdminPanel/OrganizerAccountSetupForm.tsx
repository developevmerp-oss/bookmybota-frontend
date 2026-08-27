"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import PartnerDocumentsFields, {
  validateRequiredPartnerDocuments,
} from "@/components/DiningAdminPanel/PartnerDocumentsFields";
import PhoneInput from "@/components/Shared/PhoneInput";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import { isValidPhone } from "@/lib/validation";
import { extractApiError } from "@/lib/apiErrors";
import {
  useGetBusinessTypesQuery,
  useGetPartnerDocumentMastersQuery,
  useGetPartnerOnboardingTermsQuery,
  useRegisterBusinessMutation,
  useUploadImageMutation,
  type PartnerDocumentUpload,
} from "@/services/api";

type StepId = 1 | 2;

const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: "General Information" },
  { id: 2, label: "Upload documents" },
];

/** Full-bleed section: header bar flush to main box edges; only fields are padded */
function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white">
      <div className="flex items-stretch border-b border-[#E3BCFF]">
        <div className="w-1.5 shrink-0 bg-[#6900AA]" />
        <h3 className="flex-1 bg-[#F7E9FF] px-4 sm:px-5 py-2.5 text-sm font-bold text-[#111111]">
          {title}
        </h3>
      </div>
      <div className="px-4 sm:px-5 py-5 space-y-5">{children}</div>
    </section>
  );
}

const labelClass = "block text-sm font-medium text-[#1a1a2e] mb-2";
const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6900AA]/30 focus:border-[#6900AA]";
const textareaClass = `${inputClass} min-h-[96px] resize-y`;

interface OrganizerAccountSetupFormProps {
  backHref?: string;
  /** Partner module for docs/terms/registration payload. Defaults to event organizer. */
  module?: "event" | "venue" | "artist" | "cinema";
}

const MODULE_COPY: Record<
  "event" | "venue" | "artist" | "cinema",
  {
    heading: string;
    intro: string;
    detailsTitle: string;
    nameLabel: string;
    namePlaceholder: string;
    addressLabel: string;
    addressPlaceholder: string;
    typeMissing: string;
    submitLabel: string;
    termsVersion: string;
  }
> = {
  event: {
    heading: "Account Setup",
    intro:
      "Please fill in the below details so that we can setup an account for your organisation in our system and give you access to the Do-It-Yourself portal for listing your event.",
    detailsTitle: "Organisation Details",
    nameLabel: "Organisation / Individual Name",
    namePlaceholder: "Enter your organisation name",
    addressLabel: "Organisation / Individual Address",
    addressPlaceholder: "Enter your organisation address",
    typeMissing: "Event organizer type is not configured. Please contact support.",
    submitLabel: "Register Business",
    termsVersion: "event-v1",
  },
  venue: {
    heading: "Venue Account Setup",
    intro:
      "Please fill in the below details so that we can setup a venue partner account and give you access to manage layouts and claim events at your property.",
    detailsTitle: "Venue Details",
    nameLabel: "Venue Name",
    namePlaceholder: "Enter your venue name",
    addressLabel: "Venue Address",
    addressPlaceholder: "Enter your venue address",
    typeMissing: "Venue partner type is not configured. Please contact support.",
    submitLabel: "Register Venue",
    termsVersion: "venue-v1",
  },
  artist: {
    heading: "Artist Account Setup",
    intro:
      "Please fill in the below details so that we can setup an artist partner account and give you access to manage your profile on Book My Bota.",
    detailsTitle: "Artist Details",
    nameLabel: "Artist / Act Name",
    namePlaceholder: "Enter your artist or act name",
    addressLabel: "City / Base Address",
    addressPlaceholder: "Enter your city or base address",
    typeMissing: "Artist partner type is not configured. Please contact support.",
    submitLabel: "Register Artist",
    termsVersion: "artist-v1",
  },
  cinema: {
    heading: "Movie Admin Account Setup",
    intro:
      "Please fill in the below details so that we can setup a cinema partner account and give you access to the Do-It-Yourself portal for listing movies and showtimes.",
    detailsTitle: "Cinema / Theatre Details",
    nameLabel: "Cinema / Theatre Name",
    namePlaceholder: "Enter your cinema or theatre name",
    addressLabel: "Cinema Address",
    addressPlaceholder: "Enter your cinema address",
    typeMissing: "Cinema partner type is not configured. Please contact support.",
    submitLabel: "Register Cinema",
    termsVersion: "cinema-v1",
  },
};

export default function OrganizerAccountSetupForm({
  backHref = "/organizer",
  module = "event",
}: OrganizerAccountSetupFormProps) {
  const router = useRouter();
  const copy = MODULE_COPY[module];
  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const { data: partnerDocMasters = [] } = useGetPartnerDocumentMastersQuery(module);
  const { data: onboardingTerms = [] } = useGetPartnerOnboardingTermsQuery(module);
  const [registerBusiness, { isLoading }] = useRegisterBusinessMutation();
  const [uploadImage, { isLoading: uploadingImage }] = useUploadImageMutation();

  const [step, setStep] = useState<StepId>(1);
  const [step1Done, setStep1Done] = useState(false);

  const [orgName, setOrgName] = useState("");
  const [orgAddress, setOrgAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [subtypeId, setSubtypeId] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [documents, setDocuments] = useState<PartnerDocumentUpload[]>([]);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [onboardStatus, setOnboardStatus] = useState<"idle" | "success">("idle");
  const [error, setError] = useState<string | null>(null);

  const needsSubtype = module === "venue" || module === "artist";

  const moduleParentId = useMemo(() => {
    const parent =
      businessTypes.find((t) => t.module_key === module && !t.parent_type_id) ||
      businessTypes.find((t) => t.module_key === module);
    return parent?.id ?? null;
  }, [businessTypes, module]);

  const subtypeOptions = useMemo(() => {
    if (!needsSubtype || moduleParentId == null) return [];
    return businessTypes
      .filter((t) => t.module_key === module && t.parent_type_id === moduleParentId)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [businessTypes, module, moduleParentId, needsSubtype]);

  useEffect(() => {
    if (!needsSubtype) {
      setSubtypeId("");
      return;
    }
    if (subtypeId && !subtypeOptions.some((t) => String(t.id) === subtypeId)) {
      setSubtypeId("");
    }
  }, [needsSubtype, subtypeId, subtypeOptions]);

  const step1Valid = useMemo(() => {
    return (
      !!moduleParentId &&
      (!needsSubtype || !!subtypeId) &&
      orgName.trim().length > 1 &&
      orgAddress.trim().length > 1 &&
      contactName.trim().length > 1 &&
      phoneValid &&
      !!adminEmail.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim()) &&
      (module !== "artist" || !!coverImageUrl.trim())
    );
  }, [
    moduleParentId,
    needsSubtype,
    subtypeId,
    orgName,
    orgAddress,
    contactName,
    phoneValid,
    adminEmail,
    module,
    coverImageUrl,
  ]);

  const canOpenStep = (id: StepId) => (id === 1 ? true : step1Done);

  const goToStep = (id: StepId) => {
    if (!canOpenStep(id)) {
      toast.error("Please complete General Information first.");
      return;
    }
    setStep(id);
    setError(null);
  };

  const handleSaveStep1 = () => {
    if (!step1Valid) {
      const message =
        module === "artist" && !coverImageUrl.trim()
          ? "Please upload an artist image and fill all required fields."
          : "Please fill all required General Information fields.";
      setError(message);
      toast.error(message);
      return;
    }
    if (!isValidPhone(phone)) return;
    setStep1Done(true);
    setError(null);
    toast.success("Details saved");
  };

  const handleProceedStep1 = () => {
    if (!step1Valid) {
      const message =
        module === "artist" && !coverImageUrl.trim()
          ? "Please upload an artist image and fill all required fields."
          : "Please fill all required General Information fields.";
      setError(message);
      toast.error(message);
      return;
    }
    if (!isValidPhone(phone)) return;
    setStep1Done(true);
    setError(null);
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!step1Done || !step1Valid) {
      toast.error("Please complete General Information first.");
      setStep(1);
      return;
    }
    if (!acceptTerms) {
      const message = "You must accept the onboarding terms and conditions.";
      setError(message);
      toast.error(message);
      return;
    }
    if (!moduleParentId) {
      const message = copy.typeMissing;
      setError(message);
      toast.error(message);
      return;
    }
    if (needsSubtype && !subtypeId) {
      const message =
        module === "artist"
          ? "Please select an artist type under Artist, such as Singer or Band."
          : "Please select a venue type under Venue, such as Banquet Hall or Auditorium.";
      setError(message);
      toast.error(message);
      setStep(1);
      return;
    }
    const docsErr = validateRequiredPartnerDocuments(partnerDocMasters, documents);
    if (docsErr) {
      setError(docsErr);
      toast.error(docsErr);
      return;
    }
    if (!isValidPhone(phone)) return;
    setError(null);
    const resolvedTypeId = needsSubtype ? Number(subtypeId) : moduleParentId;
    try {
      const data = await registerBusiness({
        business_name: orgName.trim(),
        address: orgAddress.trim(),
        phone: phone.trim(),
        description: `Contact person: ${contactName.trim()}`,
        type_id: resolvedTypeId,
        admin_email: adminEmail.trim(),
        partner_type: module,
        documents,
        cover_image_url: coverImageUrl.trim() || undefined,
        registration_terms_accepted: true,
        registration_terms_version: copy.termsVersion,
      }).unwrap();
      setOnboardStatus("success");
      toast.success(data.message || "Registration received");
      setTimeout(() => router.push(backHref), 2500);
    } catch (err: unknown) {
      const message = extractApiError(
        err,
        "Registration failed. Please check your details or try again."
      );
      setError(message);
      toast.error(message);
    }
  };

  useEffect(() => {
    if (!showTermsModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowTermsModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showTermsModal]);

  if (onboardStatus === "success") {
    return (
      <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold text-[#111111] mb-2">Registration received</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Your account is disabled until a Super Admin enables it. Login details will be emailed
          after approval. Redirecting…
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-8 px-1">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#111111] tracking-tight">
          {copy.heading}
        </h1>
        <p className="mt-3 text-sm md:text-base text-slate-500 max-w-2xl mx-auto leading-relaxed">
          {copy.intro}
        </p>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <nav className="grid grid-cols-2 border-b border-slate-200">
          {STEPS.map((s) => {
            const active = step === s.id;
            const unlocked = canOpenStep(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goToStep(s.id)}
                disabled={!unlocked}
                className={`relative px-2 sm:px-4 py-4 text-center text-xs sm:text-sm font-semibold transition-colors ${
                  active
                    ? "text-[#6900AA]"
                    : unlocked
                      ? "text-slate-600 hover:text-[#6900AA]"
                      : "text-slate-300 cursor-not-allowed"
                }`}
              >
                <span className="block">
                  {s.id}. {s.label}
                </span>
                <span
                  className={`absolute left-0 right-0 bottom-0 h-1 ${
                    active
                      ? "bg-[#6900AA]"
                      : s.id === 1 && step1Done
                        ? "bg-[#E3BCFF]"
                        : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* No outer padding — sections sit flush to the main box edges */}
        <div className="bg-white">
          {step === 1 && (
            <>
              <SectionBlock title={copy.detailsTitle}>
                {needsSubtype && (
                  <div>
                    <label className={labelClass}>
                      {module === "artist" ? "Artist type" : "Venue type"}{" "}
                      <span className="text-[#6900AA]">*</span>
                    </label>
                    <select
                      value={subtypeId}
                      onChange={(e) => setSubtypeId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">
                        {module === "artist"
                          ? "Select artist type (e.g. Singer, Band)"
                          : "Select venue type (e.g. Banquet Hall, Auditorium)"}
                      </option>
                      {subtypeOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    {subtypeOptions.length === 0 && (
                      <p className="mt-1 text-xs text-amber-700">
                        No {module === "artist" ? "artist" : "venue"} types configured yet. Ask Super
                        Admin to add subtypes under {module === "artist" ? "Artist" : "Venue"}.
                      </p>
                    )}
                  </div>
                )}
                <div>
                  <label className={labelClass}>
                    {copy.nameLabel} <span className="text-[#6900AA]">*</span>
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className={inputClass}
                    placeholder={copy.namePlaceholder}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    {copy.addressLabel} <span className="text-[#6900AA]">*</span>
                  </label>
                  <textarea
                    value={orgAddress}
                    onChange={(e) => setOrgAddress(e.target.value)}
                    className={textareaClass}
                    placeholder={copy.addressPlaceholder}
                    rows={3}
                  />
                </div>
                {(module === "artist" || module === "venue") && (
                  <div>
                    <label className={labelClass}>
                      {module === "artist" ? "Artist image" : "Venue cover image"}{" "}
                      {module === "artist" ? <span className="text-[#6900AA]">*</span> : null}
                    </label>
                    <CroppedImageField
                      value={coverImageUrl}
                      aspect={module === "artist" ? 1 : 16 / 9}
                      disabled={uploadingImage}
                      previewClassName={
                        module === "artist"
                          ? "w-36 h-36 rounded-2xl border border-slate-200"
                          : "w-full max-w-sm aspect-video rounded-2xl"
                      }
                      emptyClassName={
                        module === "artist"
                          ? "flex flex-col items-center justify-center w-36 h-36 rounded-2xl border border-dashed border-slate-300 hover:border-[#6900AA] bg-slate-50"
                          : "flex flex-col items-center justify-center w-full max-w-sm aspect-video rounded-2xl border border-dashed border-slate-300 hover:border-[#6900AA]"
                      }
                      onRemove={() => setCoverImageUrl("")}
                      onCroppedFile={async (file) => {
                        const formData = new FormData();
                        formData.append("image", file);
                        try {
                          const res = await uploadImage(formData).unwrap();
                          if (res.url) {
                            setCoverImageUrl(res.url);
                            toast.success(
                              module === "artist" ? "Artist image uploaded" : "Image uploaded"
                            );
                          }
                        } catch (err) {
                          toast.error(extractApiError(err, "Failed to upload image"));
                        }
                      }}
                      emptyContent={
                        <>
                          <ImagePlus className="text-slate-400 mb-1" size={22} />
                          <span className="text-[10px] text-slate-500 text-center px-2">
                            {uploadingImage
                              ? "Uploading…"
                              : module === "artist"
                                ? "Upload artist image"
                                : "Add photo"}
                          </span>
                        </>
                      }
                    />
                    <p className="mt-1.5 text-xs text-slate-400">
                      {module === "artist"
                        ? "Square photo of the artist — shown on public listings and your profile."
                        : "Shown on the public venue listing and profile page."}
                    </p>
                  </div>
                )}
              </SectionBlock>

              <SectionBlock title="Contact Person Details">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>
                      Full Name <span className="text-[#6900AA]">*</span>
                    </label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className={inputClass}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Email (Admin Login Email) <span className="text-[#6900AA]">*</span>
                    </label>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className={inputClass}
                      placeholder="Enter your email address"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Password is auto-generated and emailed after onboarding.
                    </p>
                  </div>
                  <div>
                    <PhoneInput
                      label="Phone Number"
                      labelClassName={labelClass}
                      variant="light"
                      value={phone}
                      onChange={setPhone}
                      onValidChange={setPhoneValid}
                      required
                      placeholder="Enter mobile number"
                      inputClassName={inputClass}
                      helperText="9–12 digits, numbers only"
                    />
                  </div>
                </div>
              </SectionBlock>
            </>
          )}

          {step === 2 && (
            <>
              <SectionBlock title="Upload documents">
                <PartnerDocumentsFields
                  module={module}
                  value={documents}
                  onChange={setDocuments}
                  variant="light"
                  className="!border-0 !bg-transparent !p-0 !rounded-none"
                />
              </SectionBlock>

              <SectionBlock title="Terms & conditions">
                <label className="flex items-start gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="mt-1 accent-[#6900AA] h-4 w-4"
                  />
                  <span>
                    I confirm the documents are valid and I accept the platform onboarding terms and
                    conditions.
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-sm text-[#6900AA] font-semibold hover:underline"
                >
                  View terms and conditions
                </button>
              </SectionBlock>
            </>
          )}

          {error && (
            <p className="px-4 sm:px-5 text-sm font-semibold text-rose-600 text-right">{error}</p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 px-4 sm:px-5 py-5 border-t border-slate-100">
            {step === 1 && (
              <>
                <button
                  type="button"
                  onClick={handleSaveStep1}
                  className="h-11 px-6 rounded-md border border-slate-300 bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Save details
                </button>
                <button
                  type="button"
                  onClick={handleProceedStep1}
                  disabled={!step1Valid}
                  className="h-11 px-8 rounded-md bg-[#6900AA] text-white text-sm font-bold hover:bg-[#57008E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Proceed
                </button>
              </>
            )}
            {step === 2 && (
              <>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="h-11 px-6 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !acceptTerms}
                  className="h-11 px-8 rounded-md bg-[#6900AA] text-white text-sm font-bold hover:bg-[#57008E] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Registering…
                    </>
                  ) : (
                    copy.submitLabel
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-[#111111] font-semibold">Onboarding Terms & Conditions</h3>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="text-slate-500 hover:text-slate-800 text-sm font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              {onboardingTerms.length > 0 ? (
                onboardingTerms.map((term, idx) => (
                  <p key={term.id} className="text-sm text-slate-700 leading-relaxed">
                    {idx + 1}. {term.text}
                  </p>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Platform onboarding terms will appear here when Super Admin adds them.
                </p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-slate-600 border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setAcceptTerms(true);
                  setShowTermsModal(false);
                }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#6900AA] hover:bg-[#57008E] cursor-pointer"
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
