"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Loader2, Mail, MapPin, Phone, Tag, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  useGetVenueMyInquiriesQuery,
  useUpdateVenueMyInquiryMutation,
  type VenueBookingInquiry,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatDate, formatDateTime12h, formatHm12h } from "@/lib/dateFormat";

const STATUS_STYLE: Record<string, string> = {
  PENDING: "metric-warning",
  ACCEPTED: "metric-positive",
  DECLINED: "bg-rose-50 text-rose-700",
  CANCELLED: "bg-muted text-muted-foreground",
};

function displayOrDash(value: string | number | null | undefined): string {
  if (value == null) return "-";
  if (typeof value === "number") return String(value);
  const t = value.trim();
  return t || "-";
}

export default function VenueInquiriesPage() {
  const { data: inquiries = [], isLoading } = useGetVenueMyInquiriesQuery();
  const [updateInquiry, { isLoading: updating }] = useUpdateVenueMyInquiryMutation();
  const [busyId, setBusyId] = useState<string | null>(null);

  const pending = useMemo(
    () => inquiries.filter((i) => i.status === "PENDING"),
    [inquiries]
  );

  const respond = async (inquiry: VenueBookingInquiry, status: "ACCEPTED" | "DECLINED") => {
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
    <div className="w-full max-w-[1600px] mx-auto space-y-4">
      {pending.length > 0 ? (
        <div className="flex justify-end">
          <span className="metric-warning px-3 py-1.5 rounded-full text-xs font-bold w-fit shrink-0">
            {pending.length} pending
          </span>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-muted-foreground py-10 text-center text-sm">Loading inquiries…</p>
      ) : inquiries.length === 0 ? (
        <div className="org-card p-8 sm:p-10 text-center text-muted-foreground text-sm">
          No inquiries yet. Mark free days on your availability calendar so customers can request your venue.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {inquiries.map((inq) => {
            const busy = updating && busyId === inq.id;
            return (
              <article key={inq.id} className="org-card p-4 space-y-3 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground text-base truncate">
                      {displayOrDash(inq.contact_name)}
                    </p>
                    <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                        <Mail size={13} className="shrink-0 text-primary" aria-hidden />
                        <span className="truncate">{displayOrDash(inq.contact_email)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={13} className="shrink-0 text-primary" aria-hidden />
                        {displayOrDash(inq.contact_phone)}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0 ${
                      STATUS_STYLE[inq.status] || STATUS_STYLE.PENDING
                    }`}
                  >
                    {inq.status}
                  </span>
                </div>

                <div className="flex flex-col gap-2 text-sm text-foreground w-full">
                  <div className="flex items-start gap-2 w-full min-w-0">
                    <CalendarDays size={14} className="text-primary mt-0.5 shrink-0" aria-hidden />
                    <strong className="font-semibold min-w-0 break-words">
                      {inq.event_date
                        ? `${formatDate(inq.event_date)}${inq.event_time ? ` · ${formatHm12h(inq.event_time)}` : ""}`
                        : "-"}
                    </strong>
                  </div>
                  <div className="flex items-start gap-2 w-full min-w-0">
                    <Tag size={14} className="text-primary mt-0.5 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">{displayOrDash(inq.event_type)}</span>
                  </div>
                  <div className="flex items-start gap-2 w-full min-w-0">
                    <Users size={14} className="text-primary mt-0.5 shrink-0" aria-hidden />
                    <span>{displayOrDash(inq.guest_count)}</span>
                  </div>
                  <div className="flex items-start gap-2 w-full min-w-0">
                    <MapPin size={14} className="text-primary mt-0.5 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">{displayOrDash(inq.event_location)}</span>
                  </div>
                  <p className="rounded-xl bg-muted/50 border border-border px-3 py-2 line-clamp-4">
                    {displayOrDash(inq.message)}
                  </p>
                  <p className="text-xs text-muted-foreground">
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
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
