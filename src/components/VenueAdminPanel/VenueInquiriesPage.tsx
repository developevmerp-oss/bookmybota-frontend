"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Loader2, Mail, MapPin, Phone, Tag, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  useGetVenueMyInquiriesQuery,
  useGetVenueMySlotsQuery,
  useUpdateVenueMyInquiryMutation,
  type VenueBookingInquiry,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatDate, formatDateTime12h, formatHm12h } from "@/lib/dateFormat";
import ArtistMonthCalendar from "@/components/Shared/ArtistMonthCalendar";

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

function InquiryCard({
  inq,
  busy,
  onAccept,
  onDecline,
}: {
  inq: VenueBookingInquiry;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <article className="org-card p-4 space-y-3 min-w-0">
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
            onClick={onAccept}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-success text-white text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDecline}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            <X size={14} /> Decline
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default function VenueInquiriesPage() {
  const { data: inquiries = [], isLoading: loadingInquiries } = useGetVenueMyInquiriesQuery();
  const { data: slots = [], isLoading: loadingSlots } = useGetVenueMySlotsQuery();
  const [updateInquiry, { isLoading: updating }] = useUpdateVenueMyInquiryMutation();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const pending = useMemo(
    () => inquiries.filter((i) => i.status === "PENDING"),
    [inquiries]
  );

  const freeDates = useMemo(
    () => slots.filter((s) => !s.is_booked).map((s) => s.slot_date),
    [slots]
  );
  const bookedDates = useMemo(
    () => slots.filter((s) => s.is_booked).map((s) => s.slot_date),
    [slots]
  );

  const pendingDates = useMemo(() => {
    const set = new Set<string>();
    for (const i of inquiries) {
      if (i.status === "PENDING" && i.event_date) set.add(i.event_date);
    }
    return [...set];
  }, [inquiries]);

  const dateLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    const pendingCountByDate = new Map<string, number>();
    for (const i of inquiries) {
      if (!i.event_date) continue;
      if (i.status === "ACCEPTED") {
        labels[i.event_date] = (i.contact_name || "Booked").trim().slice(0, 12);
      } else if (i.status === "PENDING") {
        pendingCountByDate.set(i.event_date, (pendingCountByDate.get(i.event_date) || 0) + 1);
      }
    }
    for (const [date, count] of pendingCountByDate) {
      if (!labels[date]) {
        labels[date] = count > 1 ? `${count} req` : "1 req";
      }
    }
    return labels;
  }, [inquiries]);

  const filteredInquiries = useMemo(() => {
    if (!selectedDate) return inquiries;
    return inquiries.filter((i) => i.event_date === selectedDate);
  }, [inquiries, selectedDate]);

  const selectedPendingCount = useMemo(
    () => filteredInquiries.filter((i) => i.status === "PENDING").length,
    [filteredInquiries]
  );

  const respond = async (inquiry: VenueBookingInquiry, status: "ACCEPTED" | "DECLINED") => {
    setBusyId(inquiry.id);
    try {
      await updateInquiry({ inquiryId: inquiry.id, status }).unwrap();
      toast.success(
        status === "ACCEPTED"
          ? "Inquiry accepted. This date is now blocked on your calendar."
          : "Inquiry declined."
      );
      if (status === "ACCEPTED" && inquiry.event_date) {
        setSelectedDate(inquiry.event_date);
      }
    } catch (err) {
      toast.error(extractApiError(err, "Could not update inquiry"));
    } finally {
      setBusyId(null);
    }
  };

  const isLoading = loadingInquiries || loadingSlots;

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Pick a date on the calendar to review inquiries for that day. Accepting one request blocks
          the date.
        </p>
        {pending.length > 0 ? (
          <span className="metric-warning px-3 py-1.5 rounded-full text-xs font-bold w-fit shrink-0">
            {pending.length} pending
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground py-10 text-center text-sm">Loading inquiries…</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-4 lg:gap-5 items-start">
          <div className="space-y-3 min-w-0">
            <ArtistMonthCalendar
              freeDates={freeDates}
              bookedDates={bookedDates}
              pendingDates={pendingDates}
              dateLabels={dateLabels}
              selectedDate={selectedDate}
              onSelectDate={(date) =>
                setSelectedDate((prev) => (prev === date ? null : date))
              }
              mode="view"
              variant="default"
            />
            {selectedDate ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
                <span className="font-semibold text-foreground">
                  {formatDate(selectedDate)}
                  {selectedPendingCount > 0
                    ? ` · ${selectedPendingCount} pending`
                    : bookedDates.includes(selectedDate)
                      ? " · booked"
                      : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Show all inquiries
                </button>
              </div>
            ) : null}
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-foreground">
                {selectedDate
                  ? `Inquiries for ${formatDate(selectedDate)}`
                  : "All inquiries"}
              </h2>
              <span className="text-xs text-muted-foreground">
                {filteredInquiries.length} shown
              </span>
            </div>

            {filteredInquiries.length === 0 ? (
              <div className="org-card p-8 text-center text-muted-foreground text-sm">
                {selectedDate
                  ? "No inquiries for this date."
                  : "No inquiries yet. Mark free days on Availability so customers can request your venue."}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:gap-4 max-h-[min(72vh,820px)] overflow-y-auto pr-1">
                {filteredInquiries.map((inq) => {
                  const busy = updating && busyId === inq.id;
                  return (
                    <InquiryCard
                      key={inq.id}
                      inq={inq}
                      busy={busy}
                      onAccept={() => void respond(inq, "ACCEPTED")}
                      onDecline={() => void respond(inq, "DECLINED")}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
