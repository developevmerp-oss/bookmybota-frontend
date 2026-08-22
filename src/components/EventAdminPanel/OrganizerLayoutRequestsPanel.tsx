"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import {
  useGetOrganizerEventQuery,
  useReviewOrganizerEventLayoutRequestMutation,
} from "@/services/api";

export default function OrganizerLayoutRequestsPanel({ eventId }: { eventId: string }) {
  const { data: event, isLoading } = useGetOrganizerEventQuery(eventId);
  const [review, { isLoading: reviewing }] = useReviewOrganizerEventLayoutRequestMutation();
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const requests = (event?.layout_requests || []).filter((r) => r.status !== "DRAFT");

  const onReview = async (id: string, action: "approve" | "request_changes") => {
    try {
      await review({
        id,
        action,
        notes: notesById[id] || "",
      }).unwrap();
      toast.success(action === "approve" ? "Layout approved" : "Change request sent");
    } catch (err) {
      toast.error((err as { data?: { error?: string } })?.data?.error || "Review failed");
    }
  };

  if (isLoading) {
    return <p className="text-sm text-zinc-400">Loading layout requests…</p>;
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
        No custom layout requests for this event yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Custom layout approvals</h2>
      <p className="text-sm text-zinc-400">
        When platform sends a built layout, approve it or request changes before final contract.
      </p>
      {requests.map((r) => (
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
          {r.status === "PENDING_ORGANIZER_APPROVAL" && (
            <div className="space-y-2">
              <textarea
                className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-sm text-white"
                rows={2}
                placeholder="Notes (required for change request)"
                value={notesById[r.id] || ""}
                onChange={(e) => setNotesById((prev) => ({ ...prev, [r.id]: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => onReview(r.id, "approve")}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm text-white"
                >
                  Approve layout
                </button>
                <button
                  type="button"
                  disabled={reviewing}
                  onClick={() => onReview(r.id, "request_changes")}
                  className="rounded-lg bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-sm text-white"
                >
                  Request changes
                </button>
              </div>
            </div>
          )}
          {r.organizer_change_notes && (
            <p className="text-sm text-amber-200">Change notes: {r.organizer_change_notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}
