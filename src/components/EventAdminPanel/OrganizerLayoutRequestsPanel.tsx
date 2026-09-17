"use client";

import React, { useState } from "react";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import {
  useGetOrganizerEventQuery,
  useReviewOrganizerEventLayoutRequestMutation,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";

export default function OrganizerLayoutRequestsPanel({ eventId }: { eventId: string }) {
  const { data: event, isLoading } = useGetOrganizerEventQuery(eventId);
  const [review, { isLoading: reviewing }] = useReviewOrganizerEventLayoutRequestMutation();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [changeNotes, setChangeNotes] = useState<Record<string, string>>({});

  const requests = (event?.layout_requests || []).filter((r) => r.status !== "DRAFT");

  if (isLoading) {
    return <p className="text-sm text-zinc-400">Loading layout requests…</p>;
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
        No custom layout requests for this event yet. Review options appear on the event Preview step
        after Super Admin sends them.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Custom layout approvals</h2>
      <p className="text-sm text-zinc-400">
        Preview each map, Approve options you like, Reject others, then Go live on one — same as venue
        layout review. Prefer using the event Preview step.
      </p>
      {requests.map((r) => {
        const proposed = r.proposed_templates || [];
        const pending = String(r.status) === "PENDING_ORGANIZER_APPROVAL";
        return (
          <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-white">{r.layout_name}</p>
                <p className="text-xs text-zinc-400">
                  {r.venue_name || "Venue"} · {r.layout_type} · capacity {r.capacity}
                </p>
              </div>
              <span className="text-xs rounded-full px-2 py-1 bg-white/10 text-zinc-200">{r.status}</span>
            </div>
            {r.notes && <p className="text-sm text-zinc-300 whitespace-pre-wrap">{r.notes}</p>}

            {proposed.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3">
                {proposed.map((opt, index) => {
                  const rejected = String(opt.status) === "REJECTED";
                  const shortlisted = Boolean(opt.venue_approved_at) && !rejected;
                  return (
                    <article
                      key={opt.id}
                      className={`rounded-xl border overflow-hidden ${
                        shortlisted
                          ? "border-emerald-500/40"
                          : rejected
                            ? "border-rose-500/40"
                            : "border-white/10"
                      }`}
                    >
                      <div className="p-2 bg-black/30">
                        <LayoutSeatPreview
                          seats={opt.seats_json}
                          config={opt.seating_config}
                          heightClass="h-36"
                        />
                      </div>
                      <div className="p-3 space-y-2">
                        <p className="text-sm font-medium text-white">
                          Option {index + 1}: {opt.name}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {opt.seat_count ?? opt.capacity ?? 0} seats
                          {shortlisted ? " · Approved" : rejected ? " · Rejected" : " · Pending"}
                        </p>
                        {pending && !rejected && (
                          <div className="flex flex-wrap gap-2">
                            {!shortlisted ? (
                              <button
                                type="button"
                                disabled={reviewing}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white"
                                onClick={async () => {
                                  try {
                                    await review({
                                      id: r.id,
                                      action: proposed.length === 1 ? "go_live" : "approve_option",
                                      selected_template_id: opt.id,
                                    }).unwrap();
                                    toast.success(
                                      proposed.length === 1 ? "Layout is live" : "Option approved"
                                    );
                                  } catch (err) {
                                    toast.error(extractApiError(err, "Failed"));
                                  }
                                }}
                              >
                                {proposed.length === 1 ? "Approve & go live" : "Approve"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={reviewing}
                                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs text-white"
                                onClick={async () => {
                                  try {
                                    await review({
                                      id: r.id,
                                      action: "go_live",
                                      selected_template_id: opt.id,
                                    }).unwrap();
                                    toast.success("Layout is live");
                                  } catch (err) {
                                    toast.error(extractApiError(err, "Failed"));
                                  }
                                }}
                              >
                                Go live
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={reviewing}
                              className="rounded-lg border border-rose-400/40 px-3 py-1.5 text-xs text-rose-300"
                              onClick={() => {
                                setRejectId(opt.id);
                                setRejectReason("");
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {pending && (
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/10">
                <input
                  className="flex-1 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white"
                  placeholder="Notes for Super Admin change request"
                  value={changeNotes[r.id] || ""}
                  onChange={(e) => setChangeNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                />
                <button
                  type="button"
                  disabled={reviewing}
                  className="rounded-lg bg-amber-600 px-3 py-2 text-sm text-white"
                  onClick={async () => {
                    const notes = String(changeNotes[r.id] || "").trim();
                    if (!notes) {
                      toast.error("Notes are required");
                      return;
                    }
                    try {
                      await review({ id: r.id, action: "request_changes", notes }).unwrap();
                      toast.success("Change request sent");
                    } catch (err) {
                      toast.error(extractApiError(err, "Failed"));
                    }
                  }}
                >
                  Request changes
                </button>
              </div>
            )}

            {r.status === "FULFILLED" && (r.fulfilled_template_name || proposed[0]?.name) && (
              <p className="text-sm text-emerald-300">
                Live layout: {r.fulfilled_template_name || proposed[0]?.name}
              </p>
            )}
            {r.organizer_change_notes && (
              <p className="text-sm text-amber-200">Change notes: {r.organizer_change_notes}</p>
            )}
          </div>
        );
      })}

      {rejectId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 w-full max-w-md space-y-3">
            <p className="font-medium text-white flex items-center gap-2">
              <Eye size={16} /> Reject layout option
            </p>
            <textarea
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm text-zinc-300"
                onClick={() => setRejectId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewing}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white"
                onClick={async () => {
                  if (!rejectReason.trim()) {
                    toast.error("Reason required");
                    return;
                  }
                  const req = requests.find((r) =>
                    (r.proposed_templates || []).some((t) => t.id === rejectId)
                  );
                  if (!req) return;
                  try {
                    await review({
                      id: req.id,
                      action: "reject_option",
                      selected_template_id: rejectId,
                      notes: rejectReason.trim(),
                    }).unwrap();
                    toast.success("Option rejected");
                    setRejectId(null);
                  } catch (err) {
                    toast.error(extractApiError(err, "Failed"));
                  }
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
