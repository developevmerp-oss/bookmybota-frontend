"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Archive,
  CheckCircle,
  Eye,
  Pencil,
  Plus,
  Undo2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  useArchiveAdminCustomerMutation,
  useGetAdminCustomersQuery,
  useSetAdminCustomerEnabledMutation,
  useUnarchiveAdminCustomerMutation,
  type AdminCustomer,
} from "@/services/api";

type ListTab = "active" | "archived";
type ConfirmAction = "enable" | "disable" | "archive" | "unarchive";

export default function AdminCustomersPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<ListTab>("active");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetAdminCustomersQuery({
    tab,
    page,
    limit: PAGE_SIZE,
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const customers = data?.items ?? [];
  const [setEnabled, { isLoading: isToggling }] = useSetAdminCustomerEnabledMutation();
  const [archiveCustomer, { isLoading: isArchiving }] = useArchiveAdminCustomerMutation();
  const [unarchiveCustomer, { isLoading: isUnarchiving }] = useUnarchiveAdminCustomerMutation();
  const [confirmState, setConfirmState] = useState<{ action: ConfirmAction; customer: AdminCustomer } | null>(
    null
  );
  const [confirmBusy, setConfirmBusy] = useState(false);

  const actionBusy = isToggling || isArchiving || isUnarchiving || confirmBusy;

  const runConfirmed = async () => {
    if (!confirmState) return;
    const { action, customer } = confirmState;
    setConfirmBusy(true);
    try {
      if (action === "archive") {
        await archiveCustomer(customer.id).unwrap();
        toast.success("Customer archived");
      } else if (action === "unarchive") {
        await unarchiveCustomer(customer.id).unwrap();
        toast.success("Customer unarchived — they can log in with their existing password");
      } else {
        const next = action === "enable";
        await setEnabled({ id: customer.id, is_enabled: next }).unwrap();
        toast.success(next ? "Customer enabled" : "Customer disabled — they cannot log in");
      }
      setConfirmState(null);
    } catch (err) {
      const fallback =
        action === "archive"
          ? "Failed to archive"
          : action === "unarchive"
            ? "Failed to unarchive"
            : "Failed to update status";
      toast.error(extractApiError(err, fallback));
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
    if (confirmState.action === "unarchive") {
      return {
        title: "Unarchive customer?",
        body: `Unarchive "${name}"? They return to the Active list and can log in with their existing password. No new credentials email is sent.`,
        confirmLabel: "Unarchive",
        danger: false,
      };
    }
    return {
      title: "Archive customer?",
      body: `You cannot archive this customer if they have confirmed tickets on a LIVE event. After archive, "${name}" cannot log in. Booking history is kept.`,
      confirmLabel: "Archive",
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
          <p className="text-zinc-400">
            Enable/Disable freezes login. Archive moves them off the Active list; history is kept.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search name, phone, email"
          />
          <Link href="/admin/customers/new" className="btn-primary inline-flex items-center justify-center gap-2">
            <Plus size={16} /> Add customer
          </Link>
        </div>
      </div>

      <div className="flex gap-2 border-b border-white/10 mb-6">
        <button
          type="button"
          onClick={() => {
            setTab("active");
            setPage(1);
          }}
          className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 ${
            tab === "active"
              ? "border-rose-500 text-rose-500 bg-rose-500/5"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          Active
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("archived");
            setPage(1);
          }}
          className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 ${
            tab === "archived"
              ? "border-rose-500 text-rose-500 bg-rose-500/5"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          Archived
        </button>
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
            {customers.map((c) => {
              const liveCount = c.live_event_booking_count ?? 0;
              const isArchived = !!c.deleted_at;
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
                    {isArchived ? (
                      <span className="flex items-center gap-1 text-zinc-400 text-sm">
                        <Archive size={14} /> Archived
                      </span>
                    ) : c.is_enabled ? (
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
                      {!isArchived && (
                        <>
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
                            disabled={actionBusy}
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
                            onClick={() => setConfirmState({ action: "archive", customer: c })}
                            disabled={actionBusy || liveCount > 0}
                            className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                            title={liveCount > 0 ? "Close live event bookings first" : "Archive"}
                          >
                            <Archive size={16} />
                          </button>
                        </>
                      )}
                      {isArchived && (
                        <button
                          type="button"
                          onClick={() => setConfirmState({ action: "unarchive", customer: c })}
                          disabled={actionBusy}
                          className="p-2 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50"
                          title="Unarchive"
                        >
                          <Undo2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-zinc-500">
                  {tab === "archived" ? "No archived customers." : "No customers found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pagination meta={data?.meta ?? { page: 1, limit: PAGE_SIZE, total: 0, total_pages: 0, has_prev: false, has_next: false }} onPageChange={setPage} />
      </div>

      <ConfirmDialog
        open={!!confirmState}
        title={confirmCopy.title}
        body={confirmCopy.body}
        confirmLabel={confirmCopy.confirmLabel}
        danger={confirmCopy.danger}
        variant={
          confirmState?.action === "enable" || confirmState?.action === "unarchive" ? "success" : "warning"
        }
        busy={confirmBusy}
        onCancel={() => setConfirmState(null)}
        onConfirm={runConfirmed}
      />
    </div>
  );
}
