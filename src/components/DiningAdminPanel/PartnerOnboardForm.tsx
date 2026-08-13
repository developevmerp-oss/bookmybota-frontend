"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import PartnerTypeFields, {
  resolvePartnerFromParentId,
  type PartnerModule,
} from "@/components/DiningAdminPanel/PartnerTypeFields";
import PartnerDocumentsFields, {
  validateRequiredPartnerDocuments,
} from "@/components/DiningAdminPanel/PartnerDocumentsFields";
import PhoneInput from "@/components/Shared/PhoneInput";
import PasswordInput from "@/components/Shared/PasswordInput";
import { isValidPhone, isValidPassword } from "@/lib/validation";
import { extractApiError } from "@/lib/apiErrors";
import {
  useGetBusinessTypesQuery,
  useGetPartnerDocumentMastersQuery,
  useRegisterBusinessMutation,
  useUpdateAdminBusinessMutation,
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

  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [parentTypeId, setParentTypeId] = useState("");
  const [venueTypeId, setVenueTypeId] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [documents, setDocuments] = useState<PartnerDocumentUpload[]>([]);
  const [phoneValid, setPhoneValid] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);
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

  useEffect(() => {
    if (mode !== "edit" || !editingBusiness || formReady) return;
    if (businessTypes.length === 0) return;
    setBusinessName(editingBusiness.name || "");
    setAddress(editingBusiness.address || "");
    setPhone(editingBusiness.phone || "");
    setDescription(editingBusiness.description || "");
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
    : "w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm";
  const textareaClass = isDark
    ? "w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 transition-all"
    : "w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm";
  const headingClass = isDark ? "text-white" : "text-slate-800";
  const mutedClass = isDark ? "text-zinc-400" : "text-slate-500";
  const panelClass = isDark
    ? "glass-panel rounded-2xl border border-white/10 p-6 md:p-8"
    : "bg-white rounded-3xl border border-slate-100 shadow-xl p-6 md:p-8";

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
    (isDining ? !!venueTypeId : true) &&
    (!adminPassword || passwordValid);

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
    if (adminPassword && !isValidPassword(adminPassword)) return;
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
          ? { type_id: parseInt(venueTypeId, 10) }
          : { type_id: parseInt(parentTypeId, 10) }),
        ...(adminEmail ? { admin_email: adminEmail } : {}),
        ...(adminPassword ? { admin_password: adminPassword } : {}),
        documents,
      }).unwrap();
      toast.success(isDining ? "Dining business updated" : "Event organizer updated");
      router.push(backHref);
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to update"));
    }
  };

  const busy = isOnboarding || isUpdating;

  return (
    <div className={panelClass}>
      <Link
        href={backHref}
        className={`inline-flex items-center gap-1.5 text-sm font-semibold mb-6 ${
          isDark ? "text-zinc-400 hover:text-white" : "text-slate-500 hover:text-slate-800"
        }`}
      >
        <ArrowLeft size={16} /> Back
      </Link>

      <h1 className={`text-2xl md:text-3xl font-bold mb-2 ${headingClass}`}>{title}</h1>
      <p className={`${mutedClass} text-sm mb-8`}>{subtitle}</p>

      {onboardStatus === "success" ? (
        <div className="text-center py-10">
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
      ) : (
        <form onSubmit={mode === "edit" ? handleUpdate : handleRegister} className="space-y-6">
          <div className={isDark ? "space-y-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
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
              value={phone}
              onChange={setPhone}
              onValidChange={setPhoneValid}
              required
              placeholder="9876543210"
              helperText={!isDark ? "9–12 digits, numbers only" : undefined}
            />
            <div className={isDark ? "" : "md:col-span-2"}>
              <label className={labelClass}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={textareaClass}
                placeholder="Brief description..."
                rows={3}
              />
            </div>
            {(partnerType !== "combined" || parentTypeId) && (
              <div className={isDark ? "" : "md:col-span-2"}>
                <PartnerDocumentsFields
                  module={resolvedModule}
                  value={documents}
                  onChange={setDocuments}
                  variant={variant}
                />
              </div>
            )}
          </div>

          <hr className={isDark ? "border-white/10" : "border-slate-200"} />

          <div>
            <h3 className={`text-lg font-semibold mb-1 ${headingClass}`}>Admin credentials</h3>
            <p className={`text-xs mb-4 ${mutedClass}`}>
              {mode === "create"
                ? "Password is auto-generated and emailed after onboarding / approval."
                : "Leave password blank to keep the current one."}
            </p>
            <div>
              <label className={labelClass}>
                Admin Login Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className={inputClass}
                placeholder="admin@example.com"
                required={mode === "create"}
              />
            </div>
            {mode === "edit" && (
              <div className="mt-4">
                <PasswordInput
                  label="New Password (optional)"
                  labelClassName={labelClass}
                  variant={isDark ? "dark" : "light"}
                  mode="create"
                  value={adminPassword}
                  onChange={setAdminPassword}
                  onValidChange={setPasswordValid}
                  placeholder="Leave blank to keep current password"
                />
              </div>
            )}
          </div>

          {registerError && (
            <p className="text-sm font-semibold text-rose-500 text-center">{registerError}</p>
          )}

          <button
            type="submit"
            disabled={busy || (mode === "create" ? !canSubmitCreate : !canSubmitEdit)}
            className={
              isDark
                ? "btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
                : "w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-colors"
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
        </form>
      )}
    </div>
  );
}
