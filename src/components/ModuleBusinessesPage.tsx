"use client";

import { useState } from "react";
import {
  Building2,
  CheckCircle,
  Plus,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetBusinessesQuery,
  useGetBusinessTypesQuery,
  useRegisterBusinessMutation,
  useUpdateAdminBusinessMutation,
  useSetBusinessEnabledMutation,
  useSoftDeleteBusinessMutation,
  type Business,
} from "@/services/api";
import PartnerTypeFields, { type PartnerModule } from "@/components/PartnerTypeFields";
import PhoneInput from "@/components/PhoneInput";
import PasswordInput from "@/components/PasswordInput";
import { isValidPhone, isValidPassword } from "@/lib/validation";

interface ModuleBusinessesPageProps {
  module: PartnerModule;
}

type ModalMode = "create" | "edit";
type ConfirmAction = "enable" | "disable" | "delete";

interface ConfirmState {
  action: ConfirmAction;
  business: Business;
}

export default function ModuleBusinessesPage({ module }: ModuleBusinessesPageProps) {
  const { data: businesses = [], isLoading } = useGetBusinessesQuery({ module: module as "dining" | "event" });
  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const [registerBusiness, { isLoading: isOnboarding }] = useRegisterBusinessMutation();
  const [updateAdminBusiness, { isLoading: isUpdating }] = useUpdateAdminBusinessMutation();
  const [setBusinessEnabled, { isLoading: isToggling }] = useSetBusinessEnabledMutation();
  const [softDeleteBusiness, { isLoading: isDeleting }] = useSoftDeleteBusinessMutation();

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [parentTypeId, setParentTypeId] = useState("");
  const [venueTypeId, setVenueTypeId] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);
  const [onboardStatus, setOnboardStatus] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const isDining = module === "dining";

  const resetForm = () => {
    setBusinessName("");
    setAddress("");
    setPhone("");
    setDescription("");
    setParentTypeId("");
    setVenueTypeId("");
    setAdminEmail("");
    setAdminPassword("");
    setPhoneValid(false);
    setPasswordValid(false);
    setEditingBusiness(null);
    setOnboardStatus(null);
  };

  const resolveParentAndVenue = (biz: Business) => {
    if (!isDining) {
      const eventParent =
        businessTypes.find((t) => t.module_key === "event" && !t.parent_type_id) ||
        businessTypes.find((t) => t.id === biz.type_id);
      return {
        parentId: eventParent ? String(eventParent.id) : biz.type_id ? String(biz.type_id) : "",
        venueId: "",
      };
    }
    const venue = businessTypes.find((t) => t.id === biz.type_id);
    if (!venue) return { parentId: "", venueId: "" };
    return {
      parentId: venue.parent_type_id != null ? String(venue.parent_type_id) : "",
      venueId: String(venue.id),
    };
  };

  const openCreateModal = () => {
    resetForm();
    setModalMode("create");
    setShowModal(true);
  };

  const openEditModal = (biz: Business) => {
    resetForm();
    setModalMode("edit");
    setEditingBusiness(biz);
    setBusinessName(biz.name || "");
    setAddress(biz.address || "");
    setPhone(biz.phone || "");
    setDescription(biz.description || "");
    setAdminEmail(biz.admin_email || "");
    const { parentId, venueId } = resolveParentAndVenue(biz);
    setParentTypeId(parentId);
    setVenueTypeId(venueId);
    setPhoneValid(!!biz.phone);
    setShowModal(true);
  };

  const handleOnboard = async () => {
    if (!isValidPhone(phone) || !isValidPassword(adminPassword)) return;
    setOnboardStatus("loading");
    try {
      await registerBusiness({
        business_name: businessName,
        address,
        phone,
        description,
        ...(isDining
          ? { type_id: parseInt(venueTypeId, 10) }
          : { type_id: parseInt(parentTypeId, 10) }),
        admin_email: adminEmail,
        admin_password: adminPassword,
        partner_type: module as "dining" | "event",
      }).unwrap();
      setOnboardStatus("success");
      toast.success(
        isDining ? "Dining business registered successfully!" : "Event organizer registered successfully!"
      );
      setTimeout(() => {
        setShowModal(false);
        resetForm();
      }, 1500);
    } catch {
      setOnboardStatus("error");
      toast.error("Failed to register partner");
    }
  };

  const handleUpdate = async () => {
    if (!editingBusiness) return;
    if (phone && !isValidPhone(phone)) return;
    if (adminPassword && !isValidPassword(adminPassword)) return;

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
      }).unwrap();
      toast.success(isDining ? "Dining business updated" : "Event organizer updated");
      setShowModal(false);
      resetForm();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "data" in err
          ? ((err as { data?: { error?: string } }).data?.error ?? "Failed to update")
          : "Failed to update";
      toast.error(message);
    }
  };

  const requestToggleEnabled = (biz: Business) => {
    setConfirmState({
      action: biz.is_enabled ? "disable" : "enable",
      business: biz,
    });
  };

  const requestSoftDelete = (biz: Business) => {
    setConfirmState({ action: "delete", business: biz });
  };

  const closeConfirm = () => {
    if (confirmBusy) return;
    setConfirmState(null);
  };

  const runConfirmedAction = async () => {
    if (!confirmState) return;
    const { action, business } = confirmState;
    const label = isDining ? "dining business" : "event organizer";
    setConfirmBusy(true);
    try {
      if (action === "delete") {
        await softDeleteBusiness(business.id).unwrap();
        toast.success(`${label} deleted`);
      } else {
        const next = action === "enable";
        await setBusinessEnabled({ id: business.id, is_enabled: next }).unwrap();
        toast.success(
          next ? "Partner enabled — they can log in now" : "Partner disabled — login blocked"
        );
      }
      setConfirmState(null);
    } catch {
      toast.error(action === "delete" ? "Failed to delete" : "Failed to update status");
    } finally {
      setConfirmBusy(false);
    }
  };

  const confirmCopy = (() => {
    if (!confirmState) return { title: "", body: "", confirmLabel: "", danger: false };
    const name = confirmState.business.name;
    if (confirmState.action === "enable") {
      return {
        title: "Enable partner?",
        body: `Enable "${name}"? They will be able to log in and appear on the public marketplace.`,
        confirmLabel: "Enable",
        danger: false,
      };
    }
    if (confirmState.action === "disable") {
      return {
        title: "Disable partner?",
        body: `Disable "${name}"? They will not be able to log in until you enable them again.`,
        confirmLabel: "Disable",
        danger: false,
      };
    }
    return {
      title: "Delete partner?",
      body: `Soft-delete "${name}"? They will be removed from lists and cannot log in.`,
      confirmLabel: "Delete",
      danger: true,
    };
  })();

  const canSubmitCreate =
    businessName &&
    adminEmail &&
    phoneValid &&
    passwordValid &&
    parentTypeId &&
    (isDining ? !!venueTypeId : true);

  const canSubmitEdit =
    businessName &&
    phoneValid &&
    parentTypeId &&
    (isDining ? !!venueTypeId : true) &&
    (!adminPassword || passwordValid);

  if (isLoading) {
    return <div className="text-white p-10 text-center">Loading businesses...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {isDining ? "Dining Businesses" : "Event Organizers"}
          </h2>
          <p className="text-zinc-400">
            {isDining
              ? "All dining venues on the platform — restaurants, cafes, bars, and more."
              : "All event organizer partners registered under the Event module."}
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
          <Building2 size={18} /> Onboard Partner
        </button>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400 text-sm">
            <tr>
              <th className="px-6 py-4 font-medium">Business Name</th>
              {isDining && <th className="px-6 py-4 font-medium">Parent</th>}
              <th className="px-6 py-4 font-medium">{isDining ? "Venue Type" : "Module"}</th>
              <th className="px-6 py-4 font-medium">Location</th>
              <th className="px-6 py-4 font-medium">Admin</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {businesses.map((biz) => (
              <tr key={biz.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-medium text-white">{biz.name}</td>
                {isDining && (
                  <td className="px-6 py-4 text-zinc-400">{biz.parent_type_name || "—"}</td>
                )}
                <td className="px-6 py-4">
                  {isDining ? (
                    <span className="text-zinc-400">{biz.type_name || "Unspecified"}</span>
                  ) : (
                    <span className="px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border bg-violet-500/10 text-violet-400 border-violet-500/20">
                      Event
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-zinc-400">{biz.address}</td>
                <td className="px-6 py-4 text-zinc-400 text-sm">
                  {biz.admin_email || "—"}
                  {biz.admin_role ? (
                    <div className="text-xs text-zinc-500">{biz.admin_role}</div>
                  ) : null}
                </td>
                <td className="px-6 py-4">
                  {biz.is_enabled ? (
                    <span className="flex items-center gap-1 text-green-400 text-sm">
                      <CheckCircle size={14} /> Enabled
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400 text-sm">
                      <XCircle size={14} /> Disabled
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => openEditModal(biz)}
                      className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!biz.is_enabled}
                      aria-label={biz.is_enabled ? "Disable partner" : "Enable partner"}
                      onClick={() => requestToggleEnabled(biz)}
                      disabled={isToggling || confirmBusy}
                      title={biz.is_enabled ? "Disable" : "Enable"}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-rose-500/40 disabled:opacity-50 disabled:cursor-not-allowed ${
                        biz.is_enabled ? "bg-emerald-500" : "bg-zinc-600"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          biz.is_enabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => requestSoftDelete(biz)}
                      disabled={isDeleting || confirmBusy}
                      className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                      title="Soft delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr>
                <td colSpan={isDining ? 7 : 6} className="text-center py-10 text-zinc-500">
                  No {isDining ? "dining businesses" : "event organizers"} found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-white/10 relative shadow-2xl my-8">
            <button
              onClick={() => {
                setShowModal(false);
                resetForm();
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-2 text-white">
              {modalMode === "create"
                ? isDining
                  ? "Onboard Dining Partner"
                  : "Onboard Event Organizer"
                : isDining
                  ? "Edit Dining Partner"
                  : "Edit Event Organizer"}
            </h2>
            <p className="text-zinc-400 mb-6">
              {modalMode === "create"
                ? isDining
                  ? "Select parent category and venue type, then create login credentials. Partner is enabled immediately."
                  : "Select the Event parent — venue type stays disabled. Partner is enabled immediately."
                : "Update partner details. Leave password blank to keep the current one."}
            </p>

            {onboardStatus === "success" ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Partner Onboarded!</h3>
                <p className="text-zinc-400">They can now log in using the credentials you created.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <PartnerTypeFields
                  partnerType={module as "dining" | "event"}
                  businessTypes={businessTypes}
                  parentTypeId={parentTypeId}
                  venueTypeId={venueTypeId}
                  onParentTypeIdChange={setParentTypeId}
                  onVenueTypeIdChange={setVenueTypeId}
                  variant="dark"
                />

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    {isDining ? "Business Name" : "Organizer Name"}
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="input-field"
                    placeholder={
                      isDining ? "E.g., The Sapphire Room" : "E.g., LiveWire Productions"
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="input-field"
                    placeholder="City / area"
                  />
                </div>
                <PhoneInput
                  label="Phone Number"
                  labelClassName="block text-sm font-medium text-zinc-400 mb-2"
                  variant="dark"
                  value={phone}
                  onChange={setPhone}
                  onValidChange={setPhoneValid}
                  required
                  placeholder="9876543210"
                />
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 transition-all"
                    placeholder="Brief description..."
                    rows={3}
                  />
                </div>
                <hr className="border-white/10 my-4" />
                <h3 className="text-lg font-medium text-white mb-2">Admin Credentials</h3>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Admin Login Email
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="input-field"
                    placeholder="admin@example.com"
                    required={modalMode === "create"}
                  />
                </div>
                <PasswordInput
                  label={modalMode === "create" ? "Temporary Password" : "New Password (optional)"}
                  labelClassName="block text-sm font-medium text-zinc-400 mb-2"
                  variant="dark"
                  mode="create"
                  value={adminPassword}
                  onChange={setAdminPassword}
                  onValidChange={setPasswordValid}
                  required={modalMode === "create"}
                  placeholder={
                    modalMode === "create"
                      ? "Auto-generate or type..."
                      : "Leave blank to keep current password"
                  }
                />
              </div>
            )}

            {onboardStatus !== "success" && (
              <div className="mt-6 pt-4 border-t border-white/5">
                {modalMode === "create" ? (
                  <button
                    onClick={handleOnboard}
                    disabled={!canSubmitCreate || isOnboarding}
                    className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    {isOnboarding
                      ? "Creating..."
                      : isDining
                        ? "Create Dining Business"
                        : "Create Event Organizer"}
                  </button>
                ) : (
                  <button
                    onClick={handleUpdate}
                    disabled={!canSubmitEdit || isUpdating}
                    className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {confirmState && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-60 flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-white/10 shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">{confirmCopy.title}</h3>
            <p className="text-zinc-400 text-sm mb-6">{confirmCopy.body}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeConfirm}
                disabled={confirmBusy}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runConfirmedAction}
                disabled={confirmBusy}
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${
                  confirmCopy.danger
                    ? "bg-rose-600 hover:bg-rose-500"
                    : confirmState.action === "enable"
                      ? "bg-emerald-600 hover:bg-emerald-500"
                      : "bg-amber-600 hover:bg-amber-500"
                }`}
              >
                {confirmBusy ? "Please wait..." : confirmCopy.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
