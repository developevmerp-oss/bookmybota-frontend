"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  CheckCircle,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Undo2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import PartnerDocumentsFields from "@/components/DiningAdminPanel/PartnerDocumentsFields";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import {
  useArchiveBusinessMutation,
  useGetAdminBusinessQuery,
  useUnarchiveBusinessMutation,
  type PartnerDocumentUpload,
} from "@/services/api";

interface AdminPartnerDetailPageProps {
  module: "dining" | "event";
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      <p className="text-white text-sm leading-relaxed">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

export default function AdminPartnerDetailPage({ module }: AdminPartnerDetailPageProps) {
  const params = useParams();
  const id = String(params.id ?? "");
  const isDining = module === "dining";
  const listHref = `/admin/businesses/${module}`;
  const { data: biz, isLoading } = useGetAdminBusinessQuery(id, { skip: !id });
  const [archiveBusiness, { isLoading: isArchiving }] = useArchiveBusinessMutation();
  const [unarchiveBusiness, { isLoading: isUnarchiving }] = useUnarchiveBusinessMutation();
  const [confirmAction, setConfirmAction] = useState<"archive" | "unarchive" | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  if (isLoading) {
    return <div className="text-white p-10 text-center">Loading partner...</div>;
  }

  if (!biz) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400 mb-4">Partner not found.</p>
        <Link href={listHref} className="text-rose-500 hover:text-rose-400">
          Back to list
        </Link>
      </div>
    );
  }

  const documents: PartnerDocumentUpload[] = Array.isArray(biz.documents)
    ? biz.documents.filter((d) => d.document_type_id > 0 && d.url)
    : [];
  const isArchived = !!biz.deleted_at;
  const archiveBlocked = isDining
    ? (biz.upcoming_booking_count ?? 0) > 0
    : (biz.live_event_count ?? 0) > 0;
  const actionBusy = isArchiving || isUnarchiving || confirmBusy;

  const runConfirmed = async () => {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      if (confirmAction === "archive") {
        await archiveBusiness(biz.id).unwrap();
        toast.success("Partner archived");
      } else {
        await unarchiveBusiness(biz.id).unwrap();
        toast.success(
          biz.credentials_sent_at
            ? "Partner unarchived — they can log in with their existing password"
            : "Partner unarchived — login credentials were emailed"
        );
      }
      setConfirmAction(null);
    } catch (err) {
      toast.error(extractApiError(err, confirmAction === "archive" ? "Failed to archive" : "Failed to unarchive"));
    } finally {
      setConfirmBusy(false);
    }
  };

  const confirmCopy =
    confirmAction === "unarchive"
      ? {
          title: "Unarchive partner?",
          body: biz.credentials_sent_at
            ? `Unarchive "${biz.name}"? They return to the Active list and can log in with their existing password. No new credentials email is sent.`
            : `Unarchive "${biz.name}"? They return to the Active list. Login credentials will be emailed once because they were never sent.`,
          confirmLabel: "Unarchive",
          danger: false,
        }
      : {
          title: "Archive partner?",
          body: isDining
            ? `You cannot archive this dining partner while they have upcoming or in-progress reservations. After archive, "${biz.name}" cannot log in. Booking history is kept.`
            : `You cannot archive this organizer if any event is still LIVE. Close live events first. After archive, "${biz.name}" cannot log in. Booking and fee history is kept.`,
          confirmLabel: "Archive",
          danger: true,
        };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href={listHref}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-white"
      >
        <ArrowLeft size={16} /> Back to {isDining ? "dining businesses" : "event organizers"}
      </Link>

      {biz.cover_image_url && (
        <div className="rounded-2xl overflow-hidden border border-white/10 h-52 bg-zinc-900">
          <img
            src={biz.cover_image_url}
            alt={biz.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="glass-panel rounded-2xl border border-white/10 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {isArchived ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border bg-zinc-500/10 text-zinc-300 border-white/10">
                  <Archive size={12} /> Archived
                </span>
              ) : biz.is_enabled ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <CheckCircle size={12} /> Enabled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border bg-amber-500/10 text-amber-400 border-amber-500/20">
                  <XCircle size={12} /> Disabled
                </span>
              )}
              {isDining ? (
                biz.type_name && (
                  <span className="px-2 py-1 rounded-md text-xs font-semibold bg-white/5 text-zinc-300 border border-white/10">
                    {biz.type_name}
                  </span>
                )
              ) : (
                <span className="px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border bg-violet-500/10 text-violet-400 border-violet-500/20">
                  Event
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{biz.name}</h1>
            {biz.address && (
              <p className="text-zinc-400 mt-2 flex items-center gap-1.5 text-sm">
                <MapPin size={14} className="shrink-0" /> {biz.address}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isArchived && (
              <>
                <Link
                  href={`${listHref}/${biz.id}/edit`}
                  className="btn-primary inline-flex items-center justify-center gap-2"
                >
                  <Pencil size={16} /> Edit partner
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmAction("archive")}
                  disabled={actionBusy || archiveBlocked}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 inline-flex items-center gap-2"
                  title={
                    archiveBlocked
                      ? isDining
                        ? "Wait until reservations finish"
                        : "Close live events first"
                      : "Archive"
                  }
                >
                  <Archive size={16} /> Archive
                </button>
              </>
            )}
            {isArchived && (
              <button
                type="button"
                onClick={() => setConfirmAction("unarchive")}
                disabled={actionBusy}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Undo2 size={16} /> Unarchive
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isDining && <Field label="Parent category" value={biz.parent_type_name} />}
          <Field label={isDining ? "Venue type" : "Module"} value={isDining ? biz.type_name : "Event"} />
          <Field label={isDining ? "Business name" : "Organizer name"} value={biz.name} />
          <Field label="Address" value={biz.address} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Phone</p>
            <p className="text-white text-sm flex items-center gap-1.5">
              <Phone size={14} className="text-zinc-500 shrink-0" />
              {biz.phone?.trim() || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Admin email</p>
            <p className="text-white text-sm flex items-center gap-1.5">
              <Mail size={14} className="text-zinc-500 shrink-0" />
              {biz.admin_email?.trim() || "—"}
            </p>
            {biz.admin_role && (
              <p className="text-xs text-zinc-500 mt-1">{biz.admin_role}</p>
            )}
          </div>
          {isDining && <Field label="Cuisine" value={biz.cuisine} />}
          <div className="md:col-span-2">
            <Field label="Description" value={biz.description} />
          </div>
        </div>
      </div>

      <PartnerDocumentsFields
        module={module}
        value={documents}
        onChange={() => {}}
        variant="dark"
        editable={false}
      />

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmCopy.title}
        body={confirmCopy.body}
        confirmLabel={confirmCopy.confirmLabel}
        danger={confirmCopy.danger}
        variant={confirmAction === "unarchive" ? "success" : "warning"}
        busy={confirmBusy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={runConfirmed}
      />
    </div>
  );
}
