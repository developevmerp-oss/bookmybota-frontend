"use client";

import Link from "next/link";
import { useState } from "react";
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

export default function ModuleBusinessesPage({ module }: ModuleBusinessesPageProps) {
  const [tab, setTab] = useState<ListTab>("active");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetAdminBusinessesQuery({
    module: module as "dining" | "event" | "venue" | "artist",
    tab,
    page,
    limit: PAGE_SIZE,
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

  if (isLoading) {
    return <div className="text-white p-10 text-center">Loading businesses...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">
            {isDining
              ? "Dining Businesses"
              : isVenue
                ? "Venue Partners"
                : isArtist
                  ? "Artist Partners"
                  : "Event Organizers"}
          </h2>
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
            placeholder="Search name, address, email"
          />
          <Link href={`${listBase}/onboard`} className="btn-primary flex items-center gap-2">
            <Building2 size={18} /> Onboard Partner
          </Link>
          {isVenue && (
            <Link href="/admin/venue-layouts" className="btn-secondary flex items-center gap-2">
              Layout requests
            </Link>
          )}
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
              <th className="px-6 py-4 font-medium">Business Name</th>
              {isDining && <th className="px-6 py-4 font-medium">Parent</th>}
              <th className="px-6 py-4 font-medium">{isDining || isVenue || isArtist ? (isArtist ? "Artist Type" : "Venue Type") : "Module"}</th>
              <th className="px-6 py-4 font-medium">Location</th>
              <th className="px-6 py-4 font-medium">Admin</th>
              <th className="px-6 py-4 font-medium">Docs</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {businesses.map((biz) => {
              const isArchived = !!biz.deleted_at;
              const archiveBlocked = isDining
                ? (biz.upcoming_booking_count ?? 0) > 0
                : isVenue || isArtist
                  ? false
                  : (biz.live_event_count ?? 0) > 0;
              return (
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
                    {isDining || isVenue || isArtist ? (
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
                    {isArchived ? (
                      <span className="flex items-center gap-1 text-zinc-400 text-sm">
                        <Archive size={14} /> Archived
                      </span>
                    ) : biz.is_enabled ? (
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
                      {!isArchived && (
                        <>
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
                            onClick={() =>
                              setConfirmState({
                                action: biz.is_enabled ? "disable" : "enable",
                                business: biz,
                              })
                            }
                            disabled={actionBusy}
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
                            onClick={() => setConfirmState({ action: "archive", business: biz })}
                            disabled={actionBusy || archiveBlocked}
                            className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
                            title={
                              archiveBlocked
                                ? isDining
                                  ? "Wait until reservations finish"
                                  : "Close live events first"
                                : "Archive"
                            }
                          >
                            <Archive size={16} />
                          </button>
                        </>
                      )}
                      {isArchived && (
                        <button
                          type="button"
                          onClick={() => setConfirmState({ action: "unarchive", business: biz })}
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
            {businesses.length === 0 && (
              <tr>
                <td colSpan={isDining ? 8 : 7} className="text-center py-10 text-zinc-500">
                  {tab === "archived"
                    ? `No archived ${isDining ? "dining businesses" : isVenue ? "venue partners" : isArtist ? "artist partners" : "event organizers"}.`
                    : `No ${isDining ? "dining businesses" : isVenue ? "venue partners" : isArtist ? "artist partners" : "event organizers"} found.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {data?.meta && <Pagination meta={data.meta} onPageChange={setPage} />}
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
        onCancel={closeConfirm}
        onConfirm={runConfirmedAction}
      />
    </div>
  );
}
