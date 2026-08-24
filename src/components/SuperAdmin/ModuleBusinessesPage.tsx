"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  Archive,
  Building2,
  CheckCircle,
  Eye,
  Pencil,
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
import { type PartnerModule } from "@/components/DiningAdminPanel/PartnerTypeFields";
import {
  useArchiveBusinessMutation,
  useGetAdminBusinessesQuery,
  useSetBusinessEnabledMutation,
  useUnarchiveBusinessMutation,
  type Business,
} from "@/services/api";

interface ModuleBusinessesPageProps {
  module: PartnerModule;
}

type ListTab = "active" | "archived";
type ConfirmAction = "enable" | "disable" | "archive" | "unarchive";

interface ConfirmState {
  action: ConfirmAction;
  business: Business;
}

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

export default function ModuleBusinessesPage({ module }: ModuleBusinessesPageProps) {
  const [tab, setTab] = useState<ListTab>("active");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data, isLoading, isFetching } = useGetAdminBusinessesQuery({
    module: module as "dining" | "event" | "venue" | "artist",
    tab,
    page,
    limit,
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const businesses = data?.items ?? [];
  const [setBusinessEnabled, { isLoading: isToggling }] = useSetBusinessEnabledMutation();
  const [archiveBusiness, { isLoading: isArchiving }] = useArchiveBusinessMutation();
  const [unarchiveBusiness, { isLoading: isUnarchiving }] = useUnarchiveBusinessMutation();

  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const isDining = module === "dining";
  const isVenue = module === "venue";
  const isArtist = module === "artist";
  const listBase = `/admin/businesses/${module}`;
  const label = isDining
    ? "dining business"
    : isVenue
      ? "venue partner"
      : isArtist
        ? "artist partner"
        : "event organizer";
  const actionBusy = isToggling || isArchiving || isUnarchiving || confirmBusy;
  const typeLabel = isArtist ? "Artist Type" : isDining || isVenue ? "Venue Type" : "Module";
  const emptyLabel = isDining
    ? "dining businesses"
    : isVenue
      ? "venue partners"
      : isArtist
        ? "artist partners"
        : "event organizers";

  const closeConfirm = () => {
    if (confirmBusy) return;
    setConfirmState(null);
  };

  const runConfirmedAction = async () => {
    if (!confirmState) return;
    const { action, business } = confirmState;
    setConfirmBusy(true);
    try {
      if (action === "archive") {
        await archiveBusiness(business.id).unwrap();
        toast.success(`${label} archived`);
      } else if (action === "unarchive") {
        await unarchiveBusiness(business.id).unwrap();
        toast.success(
          business.credentials_sent_at
            ? "Partner unarchived — they can log in with their existing password"
            : "Partner unarchived — login credentials were emailed"
        );
      } else {
        const next = action === "enable";
        await setBusinessEnabled({ id: business.id, is_enabled: next }).unwrap();
        toast.success(
          next
            ? confirmState.business.credentials_sent_at
              ? "Partner enabled — they can log in with their existing password"
              : "Partner enabled — login credentials were emailed"
            : "Partner disabled — login blocked"
        );
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
    const name = confirmState.business.name;
    if (confirmState.action === "enable") {
      const firstCredentials = !confirmState.business.credentials_sent_at;
      return {
        title: "Enable partner?",
        body: firstCredentials
          ? `Enable "${name}"? They will get a one-time email with login email and password.`
          : isDining
            ? `Enable "${name}"? They can log in with their existing password and appear on the public marketplace.`
            : `Enable "${name}"? They can log in with their existing password. Live events stay as they are. Upcoming listings stay hidden until they are made visible again.`,
        confirmLabel: "Enable",
        danger: false,
      };
    }
    if (confirmState.action === "disable") {
      return {
        title: "Disable partner?",
        body: isDining
          ? `Disable "${name}"? They will not be able to log in until you enable them again.`
          : `Disable "${name}"? They cannot log in. Live events stay on the site so customers can still book. Upcoming (approved) listings will be hidden until you enable them again and make those events visible.`,
        confirmLabel: "Disable",
        danger: false,
      };
    }
    if (confirmState.action === "unarchive") {
      const firstCredentials = !confirmState.business.credentials_sent_at;
      return {
        title: "Unarchive partner?",
        body: firstCredentials
          ? `Unarchive "${name}"? They return to the Active list. Login credentials will be emailed once because they were never sent.`
          : `Unarchive "${name}"? They return to the Active list and can log in with their existing password. No new credentials email is sent.`,
        confirmLabel: "Unarchive",
        danger: false,
      };
    }
    return {
      title: "Archive partner?",
      body: isDining
        ? `You cannot archive this dining partner while they have upcoming or in-progress reservations. After archive, "${name}" cannot log in. Booking history is kept.`
        : `You cannot archive this organizer if any event is still LIVE. Close live events first. After archive, "${name}" cannot log in. Booking and fee history is kept.`,
      confirmLabel: "Archive",
      danger: true,
    };
  })();

  const statusNode = (biz: Business) => {
    const isArchived = !!biz.deleted_at;
    if (isArchived) {
      return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          <Archive size={12} /> Archived
        </span>
      );
    }
    if (biz.is_enabled) {
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

  const docsNode = (biz: Business) =>
    Array.isArray(biz.documents) && biz.documents.length > 0 ? (
      <span className="font-medium text-emerald-600">{biz.documents.length} file(s)</span>
    ) : (
      <span className="font-medium text-amber-600">None</span>
    );

  const typeNode = (biz: Business) => {
    if (isDining || isVenue || isArtist) {
      return <span>{biz.type_name || "Unspecified"}</span>;
    }
    return (
      <span className="px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border bg-violet-500/10 text-violet-600 border-violet-500/20">
        Event
      </span>
    );
  };

  const actionsNode = (biz: Business) => {
    const isArchived = !!biz.deleted_at;
    const archiveBlocked = isDining
      ? (biz.upcoming_booking_count ?? 0) > 0
      : isVenue || isArtist
        ? false
        : (biz.live_event_count ?? 0) > 0;

    return (
      <div className="flex items-center flex-wrap gap-2">
        <Link
          href={`${listBase}/${biz.id}`}
          className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100"
          title="View details"
        >
          <Eye size={17} />
        </Link>
        {!isArchived && (
          <>
            <Link
              href={`${listBase}/${biz.id}/edit`}
              className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100"
              title="Edit"
            >
              <Pencil size={17} />
            </Link>
            <button
              type="button"
              role="switch"
              aria-checked={!!biz.is_enabled}
              aria-label={biz.is_enabled ? "Disable partner" : "Enable partner"}
              onClick={() =>
                setConfirmState({
                  action: biz.is_enabled ? "disable" : "enable",
                  business: biz,
                })
              }
              disabled={actionBusy}
              title={biz.is_enabled ? "Disable" : "Enable"}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-rose-500/40 disabled:opacity-50 disabled:cursor-not-allowed ${
                biz.is_enabled ? "bg-emerald-500" : "bg-zinc-400"
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
              onClick={() => setConfirmState({ action: "archive", business: biz })}
              disabled={actionBusy || archiveBlocked}
              className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              title={
                archiveBlocked
                  ? isDining
                    ? "Wait until reservations finish"
                    : "Close live events first"
                  : "Archive"
              }
            >
              <Archive size={17} />
            </button>
          </>
        )}
        {isArchived && (
          <button
            type="button"
            onClick={() => setConfirmState({ action: "unarchive", business: biz })}
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
    return <AdminListShimmer rows={6} columns={isDining ? 8 : 7} showTabs tabCount={2} showToolbar />;
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
            placeholder="Search name, address, email"
          />
          <Link
            href={`${listBase}/onboard`}
            className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap"
          >
            <Building2 size={18} /> Onboard Partner
          </Link>
          {isVenue && (
            <Link
              href="/admin/venue-layouts"
              className="btn-secondary inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap"
            >
              Layout requests
            </Link>
          )}
        </div>
      </div>

      {isFetching && !isLoading ? (
        <AdminListShimmer rows={limit > 10 ? 8 : 5} columns={isDining ? 8 : 7} showTabs={false} showToolbar={false} />
      ) : businesses.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-base text-slate-500 shadow-sm">
          {tab === "archived" ? `No archived ${emptyLabel}.` : `No ${emptyLabel} found.`}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {businesses.map((biz) => (
              <article
                key={biz.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <Link
                    href={`${listBase}/${biz.id}`}
                    className="min-w-0 text-sm font-bold text-slate-900 hover:text-rose-600"
                  >
                    {biz.name}
                  </Link>
                  {statusNode(biz)}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2">
                  {isDining && <Field label="Parent">{biz.parent_type_name || "—"}</Field>}
                  <Field label={typeLabel}>{typeNode(biz)}</Field>
                  <Field label="Location" full>
                    {biz.address || "—"}
                  </Field>
                  <Field label="Admin" full>
                    <div>
                      <div>{biz.admin_email || "—"}</div>
                      {biz.admin_role ? (
                        <div className="mt-0.5 text-xs font-normal text-slate-500">{biz.admin_role}</div>
                      ) : null}
                    </div>
                  </Field>
                  <Field label="Docs">{docsNode(biz)}</Field>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1 border-t border-slate-100 bg-slate-50/80 px-3 py-2.5">
                  {actionsNode(biz)}
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base">
                <thead className="border-b border-slate-200 bg-slate-50 text-sm text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Business Name</th>
                    {isDining && <th className="px-5 py-3.5 font-semibold">Parent</th>}
                    <th className="px-5 py-3.5 font-semibold">{typeLabel}</th>
                    <th className="px-5 py-3.5 font-semibold">Location</th>
                    <th className="px-5 py-3.5 font-semibold">Admin</th>
                    <th className="px-5 py-3.5 font-semibold">Docs</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {businesses.map((biz) => (
                    <tr key={biz.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        <Link
                          href={`${listBase}/${biz.id}`}
                          className="hover:text-rose-600 transition-colors"
                        >
                          {biz.name}
                        </Link>
                      </td>
                      {isDining && (
                        <td className="px-5 py-4 text-slate-500">{biz.parent_type_name || "—"}</td>
                      )}
                      <td className="px-5 py-4 text-slate-500">{typeNode(biz)}</td>
                      <td className="px-5 py-4 text-slate-500">{biz.address}</td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {biz.admin_email || "—"}
                        {biz.admin_role ? (
                          <div className="text-xs text-slate-400">{biz.admin_role}</div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-sm">{docsNode(biz)}</td>
                      <td className="px-5 py-4">{statusNode(biz)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end">{actionsNode(biz)}</div>
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
          disabled={isFetching || actionBusy}
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
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
        onCancel={closeConfirm}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
}
