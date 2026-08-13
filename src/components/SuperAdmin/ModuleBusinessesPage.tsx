"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Building2,
  CheckCircle,
  Eye,
  Pencil,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { type PartnerModule } from "@/components/DiningAdminPanel/PartnerTypeFields";
import {
  useGetBusinessesQuery,
  useSetBusinessEnabledMutation,
  useSoftDeleteBusinessMutation,
  type Business,
} from "@/services/api";

interface ModuleBusinessesPageProps {
  module: PartnerModule;
}

type ConfirmAction = "enable" | "disable" | "delete";

interface ConfirmState {
  action: ConfirmAction;
  business: Business;
}

export default function ModuleBusinessesPage({ module }: ModuleBusinessesPageProps) {
  const { data: businesses = [], isLoading } = useGetBusinessesQuery({
    module: module as "dining" | "event",
  });
  const [setBusinessEnabled, { isLoading: isToggling }] = useSetBusinessEnabledMutation();
  const [softDeleteBusiness, { isLoading: isDeleting }] = useSoftDeleteBusinessMutation();

  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const isDining = module === "dining";
  const listBase = `/admin/businesses/${module}`;

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
        <Link href={`${listBase}/onboard`} className="btn-primary flex items-center gap-2">
          <Building2 size={18} /> Onboard Partner
        </Link>
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
              <th className="px-6 py-4 font-medium">Docs</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {businesses.map((biz) => (
              <tr key={biz.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-medium text-white">
                  <Link href={`${listBase}/${biz.id}`} className="hover:text-rose-400 transition-colors">
                    {biz.name}
                  </Link>
                </td>
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
                <td className="px-6 py-4 text-zinc-400 text-sm">
                  {Array.isArray(biz.documents) && biz.documents.length > 0 ? (
                    <span className="text-emerald-400">{biz.documents.length} file(s)</span>
                  ) : (
                    <span className="text-amber-400">None</span>
                  )}
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
                    <Link
                      href={`${listBase}/${biz.id}`}
                      className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                      title="View details"
                    >
                      <Eye size={16} />
                    </Link>
                    <Link
                      href={`${listBase}/${biz.id}/edit`}
                      className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </Link>
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
                <td colSpan={isDining ? 8 : 7} className="text-center py-10 text-zinc-500">
                  No {isDining ? "dining businesses" : "event organizers"} found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
