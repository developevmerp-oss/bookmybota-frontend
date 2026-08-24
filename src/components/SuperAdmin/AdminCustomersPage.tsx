"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
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
import { AdminListShimmer } from "@/components/Shared/Shimmer";
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

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1 border-b border-slate-100 px-4 py-3 ${
        full ? "sm:col-span-2" : ""
      }`}
    >
      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="break-words text-sm font-medium text-slate-800">{children}</div>
    </div>
  );
}

export default function AdminCustomersPage() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<ListTab>("active");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data, isLoading, isFetching } = useGetAdminCustomersQuery({
    tab,
    page,
    limit,
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const customers = data?.items ?? [];
  const [setEnabled, { isLoading: isToggling }] = useSetAdminCustomerEnabledMutation();
  const [archiveCustomer, { isLoading: isArchiving }] = useArchiveAdminCustomerMutation();
  const [unarchiveCustomer, { isLoading: isUnarchiving }] = useUnarchiveAdminCustomerMutation();
  const [confirmState, setConfirmState] = useState<{
    action: ConfirmAction;
    customer: AdminCustomer;
  } | null>(null);
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

  const statusNode = (c: AdminCustomer) => {
    if (c.deleted_at) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          <Archive size={12} /> Archived
        </span>
      );
    }
    if (c.is_enabled) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle size={12} /> Enabled
        </span>
      );
    }
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <XCircle size={12} /> Disabled
      </span>
    );
  };

  const actionsNode = (c: AdminCustomer) => {
    const liveCount = c.live_event_booking_count ?? 0;
    const isArchived = !!c.deleted_at;
    return (
      <div className="flex items-center flex-wrap gap-2">
        <Link
          href={`/admin/customers/${c.id}`}
          className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50"
          title="View details"
        >
          <Eye size={17} />
        </Link>
        {!isArchived && (
          <>
            <Link
              href={`/admin/customers/${c.id}/edit`}
              className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50"
              title="Edit"
            >
              <Pencil size={17} />
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
                c.is_enabled ? "bg-emerald-500" : "bg-zinc-400"
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
              className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              title={liveCount > 0 ? "Close live event bookings first" : "Archive"}
            >
              <Archive size={17} />
            </button>
          </>
        )}
        {isArchived && (
          <button
            type="button"
            onClick={() => setConfirmState({ action: "unarchive", customer: c })}
            disabled={actionBusy}
            className="p-2 rounded-lg text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
            title="Unarchive"
          >
            <Undo2 size={17} />
          </button>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <AdminListShimmer rows={6} columns={8} showTabs tabCount={2} showToolbar />;
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:mb-5 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-slate-100/80 p-1">
          <button
            type="button"
            onClick={() => {
              setTab("active");
              setPage(1);
            }}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              tab === "active"
                ? "bg-white text-rose-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
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
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              tab === "archived"
                ? "bg-white text-rose-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Archived
          </button>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <SearchInput
            className="w-full sm:max-w-xs lg:max-w-sm"
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search name, phone, email"
          />
          <Link
            href="/admin/customers/new"
            className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus size={16} /> Add customer
          </Link>
        </div>
      </div>

      {isFetching && !isLoading ? (
        <AdminListShimmer rows={limit > 10 ? 8 : 5} columns={8} showTabs={false} showToolbar={false} />
      ) : customers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-base text-slate-500 shadow-sm">
          {tab === "archived" ? "No archived customers." : "No customers found."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {customers.map((c) => (
              <article
                key={c.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <Link
                    href={`/admin/customers/${c.id}`}
                    className="min-w-0 text-sm font-bold text-slate-900 hover:text-rose-600"
                  >
                    {c.name}
                  </Link>
                  {statusNode(c)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <Field label="Phone">{c.phone || "—"}</Field>
                  <Field label="Type">{c.is_registered_user ? "Registered" : "Guest"}</Field>
                  <Field label="Email" full>
                    {c.user_email || c.email || "—"}
                  </Field>
                  <Field label="Dining">{c.dining_bookings_count ?? 0}</Field>
                  <Field label="Events">{c.event_bookings_count ?? 0}</Field>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1 border-t border-slate-100 bg-slate-50/80 px-3 py-2.5">
                  {actionsNode(c)}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base">
                <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Name</th>
                    <th className="px-5 py-3.5 font-semibold">Phone</th>
                    <th className="px-5 py-3.5 font-semibold">Email</th>
                    <th className="px-5 py-3.5 font-semibold">Type</th>
                    <th className="px-5 py-3.5 font-semibold">Dining</th>
                    <th className="px-5 py-3.5 font-semibold">Events</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        <Link href={`/admin/customers/${c.id}`} className="hover:text-rose-600">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-500">{c.phone || "—"}</td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {c.user_email || c.email || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {c.is_registered_user ? "Registered" : "Guest"}
                      </td>
                      <td className="px-5 py-4 text-slate-500">{c.dining_bookings_count ?? 0}</td>
                      <td className="px-5 py-4 text-slate-500">{c.event_bookings_count ?? 0}</td>
                      <td className="px-5 py-4">{statusNode(c)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end">{actionsNode(c)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="admin-list-footer">
        <Pagination
          meta={
            data?.meta ?? {
              page,
              limit,
              total: 0,
              total_pages: 0,
              has_prev: false,
              has_next: false,
            }
          }
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
          disabled={isFetching || actionBusy}
        />
      </div>

      <ConfirmDialog
        open={!!confirmState}
        title={confirmCopy.title}
        body={confirmCopy.body}
        confirmLabel={confirmCopy.confirmLabel}
        danger={confirmCopy.danger}
        variant={
          confirmState?.action === "enable" || confirmState?.action === "unarchive"
            ? "success"
            : "warning"
        }
        busy={confirmBusy}
        onCancel={() => setConfirmState(null)}
        onConfirm={runConfirmed}
      />
    </div>
  );
}
