"use client";

import { Mail, MapPin, Phone, CalendarDays, Tag } from "lucide-react";
import { useGetArtistMyInquiriesQuery } from "@/services/api";
import { formatDate, formatDateTime12h, formatHm12h } from "@/lib/dateFormat";

function displayOrDash(value: string | null | undefined): string {
  const t = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  return t || "-";
}

export default function ArtistInquiriesPage() {
  const { data: inquiries = [], isLoading } = useGetArtistMyInquiriesQuery();

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4">
      {inquiries.length > 0 ? (
        <div className="flex justify-end">
          <span className="metric-warning px-3 py-1.5 rounded-full text-xs font-bold w-fit shrink-0">
            {inquiries.length} total
          </span>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-muted-foreground py-10 text-center text-sm">Loading inquiries…</p>
      ) : inquiries.length === 0 ? (
        <div className="org-card p-8 sm:p-10 text-center text-muted-foreground text-sm">
          No inquiries yet. Customers can request you from your public profile — you&apos;ll get an email when
          they do.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {inquiries.map((inq) => {
            const dateLabel = inq.event_date
              ? `${formatDate(inq.event_date)}${inq.event_time ? ` · ${formatHm12h(inq.event_time)}` : ""}`
              : "-";
            return (
              <article key={inq.id} className="org-card p-4 space-y-3 min-w-0">
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

                <div className="flex flex-col gap-2 text-sm text-foreground w-full">
                  <div className="flex items-start gap-2 w-full min-w-0">
                    <CalendarDays size={14} className="text-primary mt-0.5 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words font-semibold">{dateLabel}</span>
                  </div>
                  <div className="flex items-start gap-2 w-full min-w-0">
                    <Tag size={14} className="text-primary mt-0.5 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">{displayOrDash(inq.event_type)}</span>
                  </div>
                  <div className="flex items-start gap-2 w-full min-w-0">
                    <MapPin size={14} className="text-primary mt-0.5 shrink-0" aria-hidden />
                    <span className="min-w-0 break-words">{displayOrDash(inq.event_location)}</span>
                  </div>
                </div>

                <p className="rounded-xl bg-muted/50 border border-border px-3 py-2.5 text-sm text-foreground whitespace-pre-wrap line-clamp-4">
                  {displayOrDash(inq.message)}
                </p>

                <p className="text-xs text-muted-foreground">Received {formatDateTime12h(inq.created_at)}</p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
