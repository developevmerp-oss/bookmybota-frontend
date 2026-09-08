"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  useGetArtistMyInquiriesQuery,
  useUpdateArtistMyInquiryMutation,
  type ArtistBookingInquiry,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatDate, formatDateTime12h, formatHm12h } from "@/lib/dateFormat";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "metric-warning",
  ACCEPTED: "metric-positive",
  DECLINED: "bg-rose-50 text-rose-700",
  CANCELLED: "bg-muted text-muted-foreground",
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
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="org-section-label mb-2">Bookings</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Booking inquiries
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5">
            Booking requests from customers. Accept or decline — they also get an email.
          </p>
        </div>
        {pending.length > 0 ? (
          <span className="metric-warning px-3 py-1.5 rounded-full text-xs font-bold w-fit">
            {pending.length} pending
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground py-10 text-center text-sm">Loading inquiries…</p>
      ) : inquiries.length === 0 ? (
        <div className="org-card p-10 text-center text-muted-foreground text-sm">
          No inquiries yet. Customers can request you from your public profile.
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inq) => {
            const busy = updating && busyId === inq.id;
            return (
              <div key={inq.id} className="org-card p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground text-lg">{inq.contact_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {inq.contact_email} · {inq.contact_phone}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
                      STATUS_STYLE[inq.status] || STATUS_STYLE.PENDING
                    }`}
                  >
                    {inq.status}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Date:</span>{" "}
                    <strong className="text-foreground">{formatDate(inq.event_date)}</strong>
                    {inq.event_time ? ` · ${formatHm12h(inq.event_time)}` : ""}
                  </p>
                  {inq.event_type ? (
                    <p>
                      <span className="text-muted-foreground">Type:</span> {inq.event_type}
                    </p>
                  ) : null}
                  {inq.event_location ? (
                    <p className="sm:col-span-2">
                      <span className="text-muted-foreground">Location:</span> {inq.event_location}
                    </p>
                  ) : null}
                  {inq.message ? (
                    <p className="sm:col-span-2 rounded-xl bg-muted/50 border border-border px-3 py-2">
                      {inq.message}
                    </p>
                  ) : null}
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    Received {formatDateTime12h(inq.created_at)}
                  </p>
                </div>

                {inq.status === "PENDING" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respond(inq, "ACCEPTED")}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-success text-white text-sm font-semibold disabled:opacity-50"
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => respond(inq, "DECLINED")}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
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
