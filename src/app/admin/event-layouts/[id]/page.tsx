"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  useGetAdminEventLayoutRequestQuery,
  useReviewAdminEventLayoutRequestMutation,
  useFulfillAdminEventLayoutRequestMutation,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";

export default function AdminEventLayoutDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  const { data: request, isLoading, refetch } = useGetAdminEventLayoutRequestQuery(id, { skip: !id });
  const [reviewRequest, { isLoading: reviewing }] = useReviewAdminEventLayoutRequestMutation();
  const [fulfillRequest, { isLoading: fulfilling }] = useFulfillAdminEventLayoutRequestMutation();

  const [rejectReason, setRejectReason] = useState("");
  const [fulfillNotes, setFulfillNotes] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [applyToEvent, setApplyToEvent] = useState(true);

  const busy = reviewing || fulfilling;
  const canAct = request && ["SUBMITTED", "UNDER_REVIEW"].includes(String(request.status));

  const startReview = async () => {
    try {
      await reviewRequest({ id, status: "UNDER_REVIEW" }).unwrap();
      toast.success("Marked as under review");
      refetch();
    } catch (e) {
      toast.error(extractApiError(e));
    }
  };

  const reject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    try {
      await reviewRequest({ id, status: "REJECTED", rejection_reason: rejectReason.trim() }).unwrap();
      toast.success("Request rejected");
      refetch();
    } catch (e) {
      toast.error(extractApiError(e));
    }
  };

  const fulfill = async () => {
    try {
      const res = await fulfillRequest({
        id,
        fulfilled_template_id: templateId || null,
        apply_to_event: Boolean(templateId) && applyToEvent,
        notes: fulfillNotes.trim() || undefined,
      }).unwrap();
      toast.success(res.message || "Request fulfilled");
      refetch();
    } catch (e) {
      toast.error(extractApiError(e));
    }
  };

  if (isLoading) {
    return <p className="text-zinc-400 p-8">Loading request…</p>;
  }

  if (!request) {
    return (
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-3">
        <p className="text-zinc-300">Event layout request not found.</p>
        <Link href="/admin/event-layouts" className="text-rose-500">
          Back to requests
        </Link>
      </div>
    );
  }

  const layouts = request.published_layouts || [];

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href="/admin/event-layouts"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft size={14} /> Back to event layout requests
        </Link>
        <h1 className="text-2xl font-bold text-white mt-3">{request.layout_name}</h1>
        <p className="text-zinc-400 mt-1">
          Status: <span className="text-white font-medium">{request.status}</span>
        </p>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Request details</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <p className="text-zinc-300">
            Event:{" "}
            <Link href={`/admin/events/${request.event_id}`} className="text-rose-400 hover:underline">
              {request.event_name || request.event_id}
            </Link>
          </p>
          <p className="text-zinc-300">Organizer: {request.organizer_name || "—"}</p>
          <p className="text-zinc-300">
            Venue: {request.venue_partner_name || request.venue_name || request.showtime_venue_name || "—"}
          </p>
          <p className="text-zinc-300">Type: {request.layout_type || "custom"}</p>
          <p className="text-zinc-300">Capacity: {request.capacity ?? 0}</p>
          <p className="text-zinc-300">Event status: {request.event_status || "—"}</p>
        </div>
        {request.notes && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Organizer notes</p>
            <p className="text-sm text-zinc-200 whitespace-pre-wrap">{request.notes}</p>
          </div>
        )}
        {request.rejection_reason && (
          <p className="text-sm text-rose-400">Rejection reason: {request.rejection_reason}</p>
        )}
        {request.fulfilled_template_name && (
          <p className="text-sm text-emerald-400">
            Fulfilled with template: {request.fulfilled_template_name}
            {request.fulfilled_template_capacity != null ? ` (${request.fulfilled_template_capacity} seats)` : ""}
          </p>
        )}
      </div>

      {canAct && (
        <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Admin actions</h2>

          {request.status === "SUBMITTED" && (
            <button
              type="button"
              disabled={busy}
              onClick={startReview}
              className="btn-secondary text-sm py-2 px-4"
            >
              Start review
            </button>
          )}

          <div className="space-y-3 border-t border-white/10 pt-4">
            <p className="text-sm font-medium text-white">Fulfill request</p>
            {layouts.length > 0 ? (
              <div>
                <label className="portal-label block text-sm mb-1.5">Attach published venue layout</label>
                <select
                  className="input-field w-full"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  <option value="">No template (mark fulfilled only)</option>
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.is_default ? " (default)" : ""}
                      {l.capacity ? ` · ${l.capacity}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                {request.venue_business_id
                  ? "No published layouts on this venue partner yet. You can still mark fulfilled, or build a layout under Venue Layouts first."
                  : "No registered venue on this request. Mark fulfilled after building seats on the event layout builder if needed."}
              </p>
            )}

            {templateId && (
              <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={applyToEvent}
                  onChange={(e) => setApplyToEvent(e.target.checked)}
                />
                Apply template seats to the event seating map
              </label>
            )}

            <div>
              <label className="portal-label block text-sm mb-1.5">Admin notes (optional)</label>
              <textarea
                className="input-field w-full"
                rows={2}
                value={fulfillNotes}
                onChange={(e) => setFulfillNotes(e.target.value)}
                placeholder="Internal note appended to the request"
              />
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={fulfill}
              className="btn-primary text-sm py-2 px-4"
            >
              {fulfilling ? "Fulfilling…" : "Mark fulfilled"}
            </button>
          </div>

          <div className="space-y-3 border-t border-white/10 pt-4">
            <p className="text-sm font-medium text-white">Reject request</p>
            <textarea
              className="input-field w-full"
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason shown to the organizer context / audit"
            />
            <button
              type="button"
              disabled={busy}
              onClick={reject}
              className="btn-secondary text-sm py-2 px-4 text-rose-400 border-rose-500/30"
            >
              Reject request
            </button>
          </div>
        </div>
      )}

      {!canAct && (
        <p className="text-sm text-zinc-500">
          This request is closed ({request.status}). Open the{" "}
          <Link href={`/admin/events/${request.event_id}`} className="text-rose-400 hover:underline">
            event detail
          </Link>{" "}
          for more context.
        </p>
      )}
    </div>
  );
}
