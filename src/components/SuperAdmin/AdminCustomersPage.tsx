"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CheckCircle,
  Eye,
  Pencil,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiErrors";
import {
  useGetAdminCustomersQuery,
  useSetAdminCustomerEnabledMutation,
  useSoftDeleteAdminCustomerMutation,
  type AdminCustomer,
} from "@/services/api";

type ConfirmAction = "enable" | "disable" | "delete";

export default function AdminCustomersPage() {
  const [q, setQ] = useState("");
  const { data: customers = [], isLoading } = useGetAdminCustomersQuery(q ? { q } : undefined);
  const [setEnabled, { isLoading: isToggling }] = useSetAdminCustomerEnabledMutation();
  const [softDelete, { isLoading: isDeleting }] = useSoftDeleteAdminCustomerMutation();
  const [confirmState, setConfirmState] = useState<{ action: ConfirmAction; customer: AdminCustomer } | null>(
    null
  );
  const [confirmBusy, setConfirmBusy] = useState(false);

  const filtered = useMemo(() => customers, [customers]);

  const runConfirmed = async () => {
    if (!confirmState) return;
    const { action, customer } = confirmState;
    setConfirmBusy(true);
    try {
      if (action === "delete") {
        await softDelete(customer.id).unwrap();
        toast.success("Customer deleted");
      } else {
        const next = action === "enable";
        await setEnabled({ id: customer.id, is_enabled: next }).unwrap();
        toast.success(next ? "Customer enabled" : "Customer disabled — they cannot log in");
      }
      setConfirmState(null);
    } catch (err) {
      toast.error(extractApiError(err, action === "delete" ? "Failed to delete" : "Failed to update status"));
    } finally {
      setConfirmBusy(false);
    }
  };

  const confirmCopy = (() => {
    if (!confirmState) return { title: "", body: "", confirmLabel: "", danger: false };
    const name = confirmState.customer.name;
    if (confirmState.action === "enable") {
      return {
        title: "Enable customer?",
        body: `Enable "${name}"? They will be able to log in to the customer panel again.`,
        confirmLabel: "Enable",
        danger: false,
      };
    }
    if (confirmState.action === "disable") {
      return {
        title: "Disable customer?",
        body: `Disable "${name}"? They cannot log in. Booking history is kept. They cannot place new online bookings.`,
        confirmLabel: "Disable",
        danger: false,
      };
    }
    return {
      title: "Delete customer?",
      body: `You cannot delete this customer if they have confirmed tickets on a LIVE event. After delete, "${name}" cannot log in. Booking history is kept.`,
      confirmLabel: "Delete",
      danger: true,
    };
  })();

  if (isLoading) {
    return <div className="text-white p-10 text-center">Loading customers...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Customers</h2>
          <p className="text-zinc-400">Registered and guest customers — view, edit, enable, or delete.</p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, email"
            className="input-field pl-9 w-full sm:w-72"
          />
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400 text-sm">
            <tr>
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Phone</th>
              <th className="px-6 py-4 font-medium">Email</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Dining</th>
              <th className="px-6 py-4 font-medium">Events</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((c) => {
              const liveCount = c.live_event_booking_count ?? 0;
              return (
                <tr key={c.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">
                    <Link href={`/admin/customers/${c.id}`} className="hover:text-rose-400">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-zinc-400">{c.phone || "—"}</td>
                  <td className="px-6 py-4 text-zinc-400 text-sm">{c.user_email || c.email || "—"}</td>
                  <td className="px-6 py-4 text-zinc-400 text-sm">
                    {c.is_registered_user ? "Registered" : "Guest"}
                  </td>
                  <td className="px-6 py-4 text-zinc-400">{c.dining_bookings_count ?? 0}</td>
                  <td className="px-6 py-4 text-zinc-400">{c.event_bookings_count ?? 0}</td>
                  <td className="px-6 py-4">
                    {c.is_enabled ? (
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
                        href={`/admin/customers/${c.id}`}
                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                        title="View details"
                      >
                        <Eye size={16} />
                      </Link>
                      <Link
                        href={`/admin/customers/${c.id}/edit`}
                        className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </Link>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!!c.is_enabled}
                        onClick={() =>
                          setConfirmState({ action: c.is_enabled ? "disable" : "enable", customer: c })
                        }
                        disabled={isToggling || confirmBusy}
                        title={c.is_enabled ? "Disable" : "Enable"}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 ${
                          c.is_enabled ? "bg-emerald-500" : "bg-zinc-600"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            c.is_enabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmState({ action: "delete", customer: c })}
                        disabled={isDeleting || confirmBusy || liveCount > 0}
                        className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                        title={liveCount > 0 ? "Close live event bookings first" : "Soft delete"}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-zinc-500">
                  No customers found.
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
                onClick={() => !confirmBusy && setConfirmState(null)}
                disabled={confirmBusy}
                className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runConfirmed}
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
