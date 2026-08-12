"use client";
import { use, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  FileText,
  MapPin,
  Radio,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetAdminEventDetailQuery,
  useUpdateAdminEventMutation,
  type EventDocumentUpload,
} from "@/services/api";
import { formatDateTime12h } from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING_APPROVAL: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    APPROVED: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    LIVE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    DRAFT: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
    CLOSED: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  };
  return map[status] || "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
}

function parseGenres(genres?: string[] | string | null): string[] {
  if (!genres) return [];
  if (Array.isArray(genres)) return genres.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(genres);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parseDocuments(
  docs?: EventDocumentUpload[] | string[] | null
): EventDocumentUpload[] {
  if (!docs?.length) return [];
  if (typeof docs[0] === "string") {
    return (docs as string[]).map((url, i) => ({
      document_type_id: -(i + 1),
      url,
      document_name: `Document ${i + 1}`,
    }));
  }
  return docs as EventDocumentUpload[];
}

export default function AdminEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: event, isLoading } = useGetAdminEventDetailQuery(id);
  const [updateEvent, { isLoading: isUpdating }] = useUpdateAdminEventMutation();
  const [convenienceFee, setConvenienceFee] = useState<string | null>(null);
  const [commissionPercent, setCommissionPercent] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const convenienceValue =
    convenienceFee ?? String(event?.convenience_fee_percent ?? 0);
  const commissionValue =
    commissionPercent ?? String(event?.commission_percent ?? 0);

  const feePayload = () => ({
    convenience_fee_percent: Number(convenienceValue) || 0,
    commission_percent: Number(commissionValue) || 0,
  });

  const handleAction = async (action: "approve" | "reject" | "go_live" | "close") => {
    try {
      await updateEvent({
        id,
        action,
        ...(action === "approve" ? feePayload() : {}),
        ...(action === "reject"
          ? { rejection_reason: rejectionReason.trim() || undefined }
          : {}),
      }).unwrap();
      toast.success("Event updated");
    } catch (err) {
      toast.error(extractApiError(err, "Update failed"));
    }
  };

  const saveFees = async () => {
    try {
      await updateEvent({
        id,
        ...feePayload(),
      }).unwrap();
      toast.success("Fees saved");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save fees"));
    }
  };

  const toggleVisibility = async () => {
    if (!event) return;
    try {
      await updateEvent({
        id,
        is_visible: !event.is_visible,
      }).unwrap();
      toast.success(event.is_visible ? "Hidden from customers" : "Visible to customers");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update visibility"));
    }
  };

  if (isLoading) {
    return <div className="portal-muted p-10 text-center">Loading event...</div>;
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <p className="portal-muted mb-4">Event not found.</p>
        <Link href="/admin/events" className="text-rose-600 hover:text-rose-700">
          Back to events
        </Link>
      </div>
    );
  }

  const genres = parseGenres(event.genres);
  const documents = parseDocuments(event.documents);
  const ticketsSold = (event.ticket_types || []).reduce(
    (sum, t) => sum + Math.max(0, Number(t.total_count || 0) - Number(t.available_count || 0)),
    0
  );
  const ticketsTotal = (event.ticket_types || []).reduce(
    (sum, t) => sum + Number(t.total_count || 0),
    0
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-2 text-sm portal-muted hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to events
      </Link>

      {(event.poster_horizontal_url || event.poster_vertical_url) && (
        <div className="grid sm:grid-cols-3 gap-4">
          {event.poster_horizontal_url && (
            <div className="sm:col-span-2 rounded-2xl overflow-hidden border border-white/10 bg-slate-100 h-56">
              <img
                src={event.poster_horizontal_url}
                alt={`${event.name} horizontal poster`}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {event.poster_vertical_url && (
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-100 h-56">
              <img
                src={event.poster_vertical_url}
                alt={`${event.name} vertical poster`}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${statusBadge(event.status)}`}
            >
              {event.status.replaceAll("_", " ")}
            </span>
            {event.category_name && (
              <span className="px-2 py-1 rounded-md text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100">
                {event.category_name}
              </span>
            )}
          </div>
          <h2 className="portal-heading text-2xl font-bold">{event.name}</h2>
          <p className="portal-muted mt-1">
            {event.organizer_name || "Organizer"}
            {event.organizer_email ? ` · ${event.organizer_email}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={isUpdating}
            onClick={toggleVisibility}
            className="px-4 py-2 rounded-xl border border-white/10 text-sm font-medium inline-flex items-center gap-2 hover:bg-white/5 disabled:opacity-50"
          >
            {event.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}
            {event.is_visible ? "Visible" : "Hidden"}
          </button>
          {event.status === "PENDING_APPROVAL" && (
            <>
              <button
                disabled={isUpdating}
                onClick={() => handleAction("approve")}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle size={16} /> Approve
              </button>
              <button
                disabled={isUpdating}
                onClick={() => handleAction("reject")}
                className="px-4 py-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-sm font-medium flex items-center gap-2"
              >
                <XCircle size={16} /> Reject
              </button>
            </>
          )}
          {event.status === "APPROVED" && (
            <button
              disabled={isUpdating}
              onClick={() => handleAction("go_live")}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Radio size={16} /> Go Live
            </button>
          )}
          {event.status === "LIVE" && (
            <button
              disabled={isUpdating}
              onClick={() => handleAction("close")}
              className="px-4 py-2 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 text-sm font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {event.rejection_reason && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Rejection reason</p>
          <p className="whitespace-pre-wrap">{event.rejection_reason}</p>
        </div>
      )}

      {event.status === "PENDING_APPROVAL" && (
        <div className="glass-panel rounded-2xl border border-white/5 p-6">
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Rejection reason (shown to organizer if you reject)
          </label>
          <textarea
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g. Poster quality is low, please upload a clearer image..."
            className="input-field resize-y min-h-[80px] w-full"
          />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
          <h3 className="portal-heading text-lg font-semibold">Event details</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="portal-muted">Category</dt>
              <dd className="text-slate-800 text-right">{event.category_name || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="portal-muted">Language</dt>
              <dd className="text-slate-800">{event.language || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="portal-muted">Age group</dt>
              <dd className="text-slate-800">{event.age_group || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="portal-muted">Duration</dt>
              <dd className="text-slate-800">
                {event.duration_minutes ? `${event.duration_minutes} min` : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="portal-muted">Visible to customers</dt>
              <dd className="text-slate-800">{event.is_visible ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="portal-muted">Tickets sold</dt>
              <dd className="text-slate-800">
                {ticketsSold} / {ticketsTotal || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="portal-muted">Created</dt>
              <dd className="text-slate-800">{formatDateTime12h(event.created_at)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="portal-muted">Updated</dt>
              <dd className="text-slate-800">{formatDateTime12h(event.updated_at)}</dd>
            </div>
          </dl>

          {genres.length > 0 && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider portal-muted mb-2">
                Genres
              </p>
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => (
                  <span
                    key={g}
                    className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 text-xs font-medium"
                  >
                    {g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {event.about_event && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-xs font-semibold uppercase tracking-wider portal-muted mb-2">
                About
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {event.about_event}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-3">
            <h3 className="portal-heading text-lg font-semibold">Organizer</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="portal-muted">Name</dt>
                <dd className="text-slate-800 text-right">{event.organizer_name || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="portal-muted">Email</dt>
                <dd className="text-slate-800 text-right break-all">{event.organizer_email || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="portal-muted">Phone</dt>
                <dd className="text-slate-800">{event.organizer_phone || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="portal-muted">Address</dt>
                <dd className="text-slate-800 text-right">{event.organizer_address || "—"}</dd>
              </div>
            </dl>
            {event.business_id && (
              <Link
                href="/admin/businesses/event"
                className="inline-block text-sm font-medium text-rose-600 hover:text-rose-700 mt-1"
              >
                View event organizers
              </Link>
            )}
          </div>

          <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
            <h3 className="portal-heading text-lg font-semibold">Fees</h3>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Convenience fee (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={convenienceValue}
                onChange={(e) => setConvenienceFee(e.target.value)}
                className="input-field"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Paid by the customer as % of ticket amount.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Commission (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={commissionValue}
                onChange={(e) => setCommissionPercent(e.target.value)}
                className="input-field"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Taken from the organizer on ticket amount.
              </p>
            </div>
            <button
              disabled={isUpdating}
              onClick={saveFees}
              className="btn-primary w-full disabled:opacity-50"
            >
              Save fees
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-6">
        <h3 className="portal-heading text-lg font-semibold mb-4">Documents</h3>
        {documents.length > 0 ? (
          <ul className="space-y-3">
            {documents.map((doc, idx) => (
              <li
                key={`${doc.document_type_id}-${idx}`}
                className="flex items-center justify-between gap-3 text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <span className="inline-flex items-center gap-2 text-slate-800">
                  <FileText size={16} className="text-slate-400 shrink-0" />
                  {doc.document_name || `Document ${idx + 1}`}
                </span>
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-rose-600 hover:text-rose-700 font-medium shrink-0"
                  >
                    Open
                  </a>
                ) : (
                  <span className="portal-muted">No file</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-500 text-sm">No documents uploaded.</p>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-6">
        <h3 className="portal-heading text-lg font-semibold mb-4">Ticket types</h3>
        {event.ticket_types && event.ticket_types.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Price</th>
                  <th className="py-2 font-medium">Available</th>
                  <th className="py-2 font-medium">Total</th>
                  <th className="py-2 font-medium">Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {event.ticket_types.map((t) => {
                  const sold = Math.max(
                    0,
                    Number(t.total_count || 0) - Number(t.available_count || 0)
                  );
                  return (
                    <tr key={t.id}>
                      <td className="py-3 font-medium">{t.ticket_type}</td>
                      <td className="py-3">₹{Number(t.price).toFixed(2)}</td>
                      <td className="py-3">{t.available_count}</td>
                      <td className="py-3">{t.total_count}</td>
                      <td className="py-3">{sold}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">No ticket types yet (partner will add).</p>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-6">
        <h3 className="portal-heading text-lg font-semibold mb-4">Showtimes</h3>
        {event.showtimes && event.showtimes.length > 0 ? (
          <ul className="space-y-3">
            {event.showtimes.map((s) => (
              <li key={s.id} className="text-sm border-b border-slate-200 pb-3 last:border-0 last:pb-0">
                <div className="font-medium portal-heading">{s.venue_name || "Venue TBD"}</div>
                {s.venue_address && (
                  <div className="portal-muted flex items-start gap-1.5 mt-0.5">
                    <MapPin size={13} className="mt-0.5 shrink-0" />
                    {s.venue_address}
                  </div>
                )}
                <div className="text-slate-700 mt-1">
                  {formatDateTime12h(s.starts_at)}
                  {s.ends_at ? ` → ${formatDateTime12h(s.ends_at)}` : ""}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-500 text-sm">No showtimes yet.</p>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-6">
        <h3 className="portal-heading text-lg font-semibold mb-4">Recent bookings</h3>
        {event.bookings && event.bookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-zinc-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 font-medium">Guest</th>
                  <th className="py-2 font-medium">Tickets</th>
                  <th className="py-2 font-medium">Convenience</th>
                  <th className="py-2 font-medium">Commission</th>
                  <th className="py-2 font-medium">Customer total</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {event.bookings.map((b: Record<string, unknown>) => (
                  <tr key={String(b.id)}>
                    <td className="py-3">
                      {String(b.guest_name || b.guest_email || "—")}
                    </td>
                    <td className="py-3">{String(b.ticket_qty ?? "—")}</td>
                    <td className="py-3">
                      ₹{Number(b.convenience_fee_total || 0).toFixed(2)}
                    </td>
                    <td className="py-3">₹{Number(b.commission_total || 0).toFixed(2)}</td>
                    <td className="py-3">₹{Number(b.grand_total || 0).toFixed(2)}</td>
                    <td className="py-3">{String(b.status || "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">No bookings yet.</p>
        )}
      </div>
    </div>
  );
}
