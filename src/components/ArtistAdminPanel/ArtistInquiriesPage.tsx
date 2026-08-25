"use client";

import { useMemo, useState } from "react";
import { Check, Inbox, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  useGetArtistMyInquiriesQuery,
  useUpdateArtistMyInquiryMutation,
  type ArtistBookingInquiry,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatDate, formatDateTime12h } from "@/lib/dateFormat";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  ACCEPTED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  DECLINED: "bg-rose-50 text-rose-800 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function ArtistInquiriesPage() {
  const { data: inquiries = [], isLoading } = useGetArtistMyInquiriesQuery();
  const [updateInquiry, { isLoading: updating }] = useUpdateArtistMyInquiryMutation();
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = useMemo(
    () => inquiries.filter((i) => i.status === "PENDING"),
    [inquiries]
  );

  const respond = async (inquiry: ArtistBookingInquiry, status: "ACCEPTED" | "DECLINED") => {
    setBusyId(inquiry.id);
    try {
      await updateInquiry({ inquiryId: inquiry.id, status }).unwrap();
      toast.success(status === "ACCEPTED" ? "Inquiry accepted. Customer emailed." : "Inquiry declined.");
    } catch (err) {
      toast.error(extractApiError(err, "Could not update inquiry"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="portal-heading text-2xl font-bold flex items-center gap-2">
          <Inbox className="text-violet-500" /> Booking inquiries
        </h2>
        <p className="portal-muted text-sm mt-1">
          Requests from customers who picked one of your free dates. Accept or decline — they also get an email.
        </p>
        {pending.length > 0 ? (
          <p className="text-sm text-amber-700 mt-2 font-semibold">{pending.length} pending</p>
        ) : null}
      </div>

      {isLoading ? (
        <p className="portal-muted py-10 text-center">Loading inquiries…</p>
      ) : inquiries.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center portal-muted">
          No inquiries yet. Mark free days on your availability calendar so customers can request you.
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => {
            const busy = updating && busyId === inq.id;
            return (
              <div key={inq.id} className="glass-panel rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold portal-heading text-lg">{inq.contact_name}</p>
                    <p className="text-sm portal-muted">
                      {inq.contact_email} · {inq.contact_phone}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${
                      STATUS_STYLE[inq.status] || STATUS_STYLE.PENDING
                    }`}
                  >
                    {inq.status}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <p>
                    <span className="portal-muted">Date:</span>{" "}
                    <strong>{formatDate(inq.event_date)}</strong>
                    {inq.event_time ? ` · ${inq.event_time}` : ""}
                  </p>
                  {inq.event_type ? (
                    <p>
                      <span className="portal-muted">Type:</span> {inq.event_type}
                    </p>
                  ) : null}
                  {inq.event_location ? (
                    <p className="sm:col-span-2">
                      <span className="portal-muted">Location:</span> {inq.event_location}
                    </p>
                  ) : null}
                  {inq.message ? (
                    <p className="sm:col-span-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                      {inq.message}
                    </p>
                  ) : null}
                  <p className="sm:col-span-2 text-xs portal-muted">
                    Received {formatDateTime12h(inq.created_at)}
                  </p>
                </div>

                {inq.status === "PENDING" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respond(inq, "ACCEPTED")}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respond(inq, "DECLINED")}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-700 text-sm font-semibold hover:bg-rose-50 disabled:opacity-50"
                    >
                      <X size={14} /> Decline
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
