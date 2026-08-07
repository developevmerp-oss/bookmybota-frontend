"use client";

import { useState } from "react";
import { Building2, CheckCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  useGetBusinessesQuery,
  useGetBusinessTypesQuery,
  useRegisterBusinessMutation,
} from "@/services/api";
import PartnerTypeFields, { type PartnerModule } from "@/components/PartnerTypeFields";
import PhoneInput from "@/components/PhoneInput";
import PasswordInput from "@/components/PasswordInput";
import { isValidPhone, isValidPassword } from "@/lib/validation";

interface ModuleBusinessesPageProps {
  module: PartnerModule;
}

export default function ModuleBusinessesPage({ module }: ModuleBusinessesPageProps) {
  const { data: businesses = [], isLoading } = useGetBusinessesQuery({ module });
  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const [registerBusiness, { isLoading: isOnboarding }] = useRegisterBusinessMutation();

  const [showModal, setShowModal] = useState(false);
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
        partner_type: module,
      }).unwrap();
      setOnboardStatus("success");
      toast.success(
        isDining ? "Dining business registered successfully!" : "Event organizer registered successfully!"
      );
      setTimeout(() => {
        setShowModal(false);
        setOnboardStatus(null);
        resetForm();
      }, 2000);
    } catch {
      setOnboardStatus("error");
      toast.error("Failed to register partner");
    }
  };

  const canSubmit =
    businessName &&
    adminEmail &&
    phoneValid &&
    passwordValid &&
    parentTypeId &&
    (isDining ? !!venueTypeId : true);

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
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
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
                  <span className="flex items-center gap-1 text-green-400 text-sm">
                    <CheckCircle size={14} /> Active
                  </span>
                </td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr>
                <td colSpan={isDining ? 6 : 5} className="text-center py-10 text-zinc-500">
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
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-2 text-white">
              {isDining ? "Onboard Dining Partner" : "Onboard Event Organizer"}
            </h2>
            <p className="text-zinc-400 mb-6">
              {isDining
                ? "Select parent category and venue type, then create login credentials."
                : "Select the Event parent — venue type stays disabled. Subtypes (Comedy, Music, etc.) are chosen when creating events."}
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
                  partnerType={module}
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
                  />
                </div>
                <PasswordInput
                  label="Temporary Password"
                  labelClassName="block text-sm font-medium text-zinc-400 mb-2"
                  variant="dark"
                  mode="create"
                  value={adminPassword}
                  onChange={setAdminPassword}
                  onValidChange={setPasswordValid}
                  required
                  placeholder="Auto-generate or type..."
                />
              </div>
            )}

            {onboardStatus !== "success" && (
              <div className="mt-6 pt-4 border-t border-white/5">
                <button
                  onClick={handleOnboard}
                  disabled={!canSubmit || isOnboarding}
                  className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  {isOnboarding
                    ? "Creating..."
                    : isDining
                      ? "Create Dining Business"
                      : "Create Event Organizer"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
