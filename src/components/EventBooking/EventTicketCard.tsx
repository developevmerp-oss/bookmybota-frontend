"use client";

import type { ReactNode } from "react";
import {
  Calendar,
  Check,
  Clock,
  Copy,
  MapPin,
  Package,
  Phone,
  Smartphone,
  Ticket,
  User,
} from "lucide-react";
import { formatDateCustomer, formatTime12h, formatInstantLocalDateTime } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import { shortBookingCode } from "@/lib/eventTicketPdf";
import { eventBookingQrValue } from "@/lib/eventScanToken";
import {
  formatDeliveryAddress,
  normalizeTicketMode,
  ticketModeHeaderTag,
  ticketModeLabel,
  type TicketDeliveryMode,
} from "@/lib/eventTicketMode";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export type EventTicketCardBooking = {
  id: string;
  event_name?: string;
  venue_name?: string;
  venue_address?: string;
  starts_at?: string;
  created_at?: string;
  grand_total?: number | string;
  convenience_fee_total?: number | string;
  discount_amount?: number | string;
  qr_code?: string;
  qr_payload?: string;
  ticket_qty?: number;
  ticket_mode?: string;
  guest_name?: string;
  guest_phone?: string;
  delivery_address_line?: string | null;
  delivery_city?: string | null;
  delivery_notes?: string | null;
  items?: Array<{
    id?: string;
    ticket_type?: string;
    qty?: number;
    unit_price?: number | string;
  }>;
};

type Props = {
  booking: EventTicketCardBooking;
  posterUrl?: string | null;
  onCopyCode?: () => void;
  className?: string;
  variant?: "default" | "confirmation";
  children?: ReactNode;
};

function ConfirmationDetailCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon size={15} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-medium text-slate-500 leading-tight">{label}</p>
        <p className="mt-0.5 text-[0.875rem] sm:text-[0.9375rem] font-semibold text-slate-900 break-words leading-snug">
          {value}
        </p>
      </div>
    </div>
  );
}

function ConfirmationQrPanel({
  mode,
  booking,
  displayCode,
  venue,
  onCopyCode,
}: {
  mode: TicketDeliveryMode;
  booking: EventTicketCardBooking;
  displayCode: string;
  venue: string;
  onCopyCode?: () => void;
}) {
  const qrData = eventBookingQrValue(booking);
  const deliveryText = formatDeliveryAddress(booking);

  if (mode === "PHYSICAL_DELIVERY") {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center px-2">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F7E9FF] text-[#6900AA]">
          <Package size={28} />
        </span>
        <p className="mt-4 text-[0.9375rem] font-bold text-slate-900">Home delivery</p>
        <p className="mt-2 text-[0.8125rem] text-slate-500 leading-relaxed max-w-[14rem]">
          Printed tickets will be couriered to your address. Track status in My Bookings.
        </p>
        {deliveryText && (
          <p className="mt-3 text-[0.8125rem] font-semibold text-slate-800 leading-snug">{deliveryText}</p>
        )}
        <BookingCodePill code={displayCode} onCopy={onCopyCode} />
      </div>
    );
  }

  if (mode === "BOX_OFFICE") {
    return (
      <div className="flex h-full flex-col items-center text-center px-2">
        <p className="text-[0.9375rem] font-bold text-slate-900">Box office pickup</p>
        <p className="mt-2 text-[0.8125rem] text-slate-500 leading-relaxed">
          Show your booking ID and photo ID at the venue box office.
        </p>
        {venue && (
          <p className="mt-3 text-[0.8125rem] font-semibold text-slate-800 flex items-start gap-1.5 text-left w-full max-w-[15rem]">
            <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
            <span>{venue}</span>
          </p>
        )}
        <BookingCodePill code={displayCode} onCopy={onCopyCode} />
        {qrData && (
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(qrData)}`}
            alt="Backup QR code"
            className="mt-4 h-28 w-28 rounded-lg border border-slate-200 bg-white p-1"
          />
        )}
      </div>
    );
  }

  if (!qrData) return null;

  return (
    <div className="flex h-full flex-col items-center text-center">
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&data=${encodeURIComponent(qrData)}`}
        alt="Entry QR code"
        className="h-[9.5rem] w-[9.5rem] sm:h-[10.5rem] sm:w-[10.5rem] rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm"
      />
      <p className="mt-4 text-[0.9375rem] font-bold text-slate-900">Entry QR</p>
      {onCopyCode ? (
        <button
          type="button"
          onClick={onCopyCode}
          className="mt-1 font-mono text-[0.8125rem] font-bold text-slate-700 hover:text-[#6900AA] cursor-pointer"
        >
          {displayCode}
        </button>
      ) : (
        <p className="mt-1 font-mono text-[0.8125rem] font-bold text-slate-700">{displayCode}</p>
      )}
      <p className="mt-3 max-w-[15rem] text-[0.75rem] sm:text-[0.8125rem] text-slate-500 leading-relaxed">
        Show this QR code at the venue entrance for admission.
      </p>
    </div>
  );
}

function EventTicketCardConfirmation({
  booking,
  posterUrl,
  onCopyCode,
  className = "",
  children,
}: Omit<Props, "variant">) {
  const displayCode = shortBookingCode(booking.id);
  const venue = [booking.venue_name, booking.venue_address].filter(Boolean).join(", ");
  const ticketMode = normalizeTicketMode(booking.ticket_mode);
  const guestName = booking.guest_name?.trim() || "—";
  const contact = booking.guest_phone?.trim() || "—";
  const ticketTypeDisplay = booking.items?.length
    ? [...new Set(booking.items.map((i) => i.ticket_type || "Ticket"))].join(", ")
    : booking.ticket_qty
      ? `${booking.ticket_qty} ticket${booking.ticket_qty === 1 ? "" : "s"}`
      : "—";

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`.trim()}
    >
      {/* Row 1: event image + QR / barcode */}
      <div className="relative flex flex-col items-stretch gap-0 sm:flex-row sm:items-stretch">
        <div className="relative min-h-[14rem] min-w-0 flex-1 self-stretch w-full sm:min-h-0 sm:max-w-none lg:max-w-[38rem]">
          <div className="absolute inset-5">
            {posterUrl ? (
              <img
                src={resolveMediaUrl(posterUrl)}
                alt={booking.event_name || "Event"}
                className="h-full w-full rounded-xl object-cover bg-slate-100"
              />
            ) : (
              <div className="h-full w-full rounded-xl bg-gradient-to-br from-slate-100 to-slate-50" />
            )}
          </div>
        </div>

        <div className="relative sm:w-[min(100%,17rem)] sm:shrink-0 md:w-[18rem] lg:w-[19rem]">
          <div
            className="hidden sm:block absolute left-0 top-5 bottom-5 w-px border-l border-dashed border-slate-300"
            aria-hidden
          />
          <span
            className="hidden sm:block absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-white border border-slate-200"
            aria-hidden
          />
          <span
            className="hidden sm:block absolute -left-2.5 -bottom-2.5 h-5 w-5 rounded-full bg-white border border-slate-200"
            aria-hidden
          />
          <div className="border-t border-dashed border-slate-300 px-5 py-6 sm:border-t-0 sm:px-6 sm:py-8 sm:pl-8">
            <ConfirmationQrPanel
              mode={ticketMode}
              booking={booking}
              displayCode={displayCode}
              venue={venue}
              onCopyCode={onCopyCode}
            />
          </div>
        </div>
      </div>

      {/* Row 2: event info + details */}
      <div className="border-t border-dashed border-slate-300 px-5 py-5 sm:px-6 sm:py-6 lg:px-8">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-2.5 py-1 text-[0.6875rem] font-semibold text-[#2E7D32]">
          <Check size={12} strokeWidth={3} />
          Booking Confirmed
        </span>
        <h2 className="mt-3 text-[1.25rem] sm:text-[1.375rem] lg:text-[1.5rem] font-extrabold leading-snug text-slate-900">
          {booking.event_name}
        </h2>
        {venue && (
          <p className="mt-2 flex items-start gap-1.5 text-[0.875rem] text-slate-500">
            <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
            <span>{venue}</span>
          </p>
        )}
        <div className="mt-5 grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-5">
          <ConfirmationDetailCell icon={User} label="Guest Name" value={guestName} />
          <ConfirmationDetailCell icon={Ticket} label="Ticket Type" value={ticketTypeDisplay} />
          <ConfirmationDetailCell icon={Phone} label="Contact" value={contact} />
          <ConfirmationDetailCell
            icon={Smartphone}
            label="Ticket Mode"
            value={ticketModeLabel(ticketMode)}
          />
          <ConfirmationDetailCell
            icon={Calendar}
            label="Date"
            value={formatLongDate(booking.starts_at)}
          />
          <ConfirmationDetailCell
            icon={Clock}
            label="Time"
            value={booking.starts_at ? `${formatTime12h(booking.starts_at)} onwards` : "—"}
          />
        </div>
      </div>

      <div className="border-t border-slate-200 px-5 py-5 sm:px-6 sm:py-6 lg:px-8">
        <p className="text-[0.9375rem] sm:text-[1rem] font-bold text-slate-900">Order Summary</p>
        <div className="mt-4 space-y-2.5">
          {booking.items?.map((item) => (
            <div
              key={item.id || `${item.ticket_type}-${item.qty}`}
              className="flex items-start justify-between gap-4 text-[0.875rem] text-slate-600"
            >
              <span className="min-w-0">
                {item.ticket_type} × {item.qty}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                {formatMoney(Number(item.unit_price) * Number(item.qty))}
              </span>
            </div>
          ))}
          <div className="flex items-start justify-between gap-4 text-[0.875rem] text-slate-600">
            <span>Convenience Fee</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-800">
              {formatMoney(booking.convenience_fee_total)}
            </span>
          </div>
          {Number(booking.discount_amount) > 0 && (
            <div className="flex items-start justify-between gap-4 text-[0.875rem] text-[#57008E]">
              <span>Promo discount</span>
              <span className="shrink-0 font-semibold tabular-nums">
                −{formatMoney(booking.discount_amount)}
              </span>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-slate-100 px-4 py-3.5 sm:px-5">
          <span className="text-[0.9375rem] font-bold text-slate-900">Amount Paid</span>
          <span className="shrink-0 text-[1.125rem] sm:text-[1.25rem] font-extrabold tabular-nums text-slate-900">
            {formatMoney(booking.grand_total)}
          </span>
        </div>
      </div>

      {children ? (
        <div className="border-t border-slate-200 px-5 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</div>
      ) : null}

      <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-[0.6875rem] text-slate-400 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="min-w-0 break-all sm:truncate" title={booking.id}>
            Booking ID: {booking.id}
          </p>
          {formatBookedOn(booking.created_at) && (
            <p className="shrink-0 sm:text-right">{formatBookedOn(booking.created_at)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatLongDate(value?: string) {
  if (!value) return "—";
  return formatDateCustomer(value);
}

function formatBookedOn(value?: string) {
  if (!value) return "";
  const label = formatInstantLocalDateTime(value);
  return label === "—" ? "" : `Booked on ${label}`;
}

function TicketPerforation() {
  return (
    <div className="relative h-5 flex items-center" aria-hidden>
      <span className="absolute -left-2.5 h-5 w-5 rounded-full bg-[#F5F5F5] border border-slate-200" />
      <span className="absolute -right-2.5 h-5 w-5 rounded-full bg-[#F5F5F5] border border-slate-200" />
      <div className="mx-3 flex-1 border-t border-dashed border-slate-300" />
    </div>
  );
}

function BookingCodePill({
  code,
  onCopy,
}: {
  code: string;
  onCopy?: () => void;
}) {
  if (onCopy) {
    return (
      <button
        type="button"
        onClick={onCopy}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#E8D4FF] bg-[#FBF6FF] px-3 py-1.5 font-mono text-xs font-bold text-[#6900AA] cursor-pointer transition hover:bg-[#F7E9FF] hover:border-[#D4B3FF]"
      >
        <Copy size={12} />
        {code}
      </button>
    );
  }
  return (
    <p className="mt-3 inline-flex rounded-lg border border-[#E8D4FF] bg-[#FBF6FF] px-3 py-1.5 font-mono text-xs font-bold text-[#6900AA]">
      {code}
    </p>
  );
}

function FulfillmentBlock({
  mode,
  booking,
  displayCode,
  venue,
  onCopyCode,
}: {
  mode: TicketDeliveryMode;
  booking: EventTicketCardBooking;
  displayCode: string;
  venue: string;
  onCopyCode?: () => void;
}) {
  const qrData = eventBookingQrValue(booking);
  const deliveryText = formatDeliveryAddress(booking);

  if (mode === "PHYSICAL_DELIVERY") {
    return (
      <div className="px-4 sm:px-6 pb-5 sm:pb-6">
        <div className="rounded-2xl border border-[#E8D4FF] bg-gradient-to-br from-[#FBF6FF] to-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F7E9FF] text-[#6900AA] shadow-inner shrink-0">
              <Package size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">Home delivery</p>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                Printed tickets will be couriered to your address. Track status in My Bookings once
                dispatched.
              </p>
              {deliveryText && (
                <p className="mt-2.5 text-sm font-semibold text-slate-800 leading-snug">{deliveryText}</p>
              )}
              <BookingCodePill code={displayCode} onCopy={onCopyCode} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "BOX_OFFICE") {
    return (
      <div className="px-4 sm:px-6 pb-5 sm:pb-6 space-y-3">
        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
          <p className="text-sm font-bold text-amber-950">Collect at box office</p>
          <p className="mt-1 text-sm text-amber-900/90 leading-relaxed">
            Show your booking ID and photo ID at the venue box office to collect printed tickets.
          </p>
          {venue && (
            <p className="mt-2.5 text-sm font-semibold text-amber-950 flex items-start gap-1.5">
              <MapPin size={14} className="mt-0.5 shrink-0" />
              <span>{venue}</span>
            </p>
          )}
          <BookingCodePill code={displayCode} onCopy={onCopyCode} />
        </div>
        {qrData && (
          <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(qrData)}`}
              alt="Booking QR code"
              className="h-[5.75rem] w-[5.75rem] sm:h-24 sm:w-24 shrink-0 rounded-xl border-2 border-white bg-white shadow-md ring-1 ring-slate-100"
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-bold text-slate-900">Backup QR</p>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                Optional — show this QR if the box office requests digital verification.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!qrData) return null;

  return (
    <div className="px-4 sm:px-6 pb-5 sm:pb-6">
      <div className="rounded-2xl border border-[#E8D4FF] bg-gradient-to-br from-[#FBF6FF] via-white to-[#F7E9FF]/30 p-5 shadow-sm">
        <div className="flex items-start gap-4 sm:gap-5">
          <div className="shrink-0 rounded-xl bg-white p-1.5 shadow-md ring-1 ring-[#E8D4FF]/60">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(qrData)}`}
              alt="Ticket QR code"
              className="h-[5.75rem] w-[5.75rem] sm:h-24 sm:w-24 rounded-lg"
            />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Smartphone size={15} className="text-[#6900AA]" />
              Entry QR
            </p>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">
              Show this QR at the venue entrance. One scan per booking — keep it ready on your phone
              or in the downloaded PDF.
            </p>
            <BookingCodePill code={displayCode} onCopy={onCopyCode} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventTicketCard({
  booking,
  posterUrl,
  onCopyCode,
  className = "",
  variant = "default",
  children,
}: Props) {
  if (variant === "confirmation") {
    return (
      <EventTicketCardConfirmation
        booking={booking}
        posterUrl={posterUrl}
        onCopyCode={onCopyCode}
        className={className}
      >
        {children}
      </EventTicketCardConfirmation>
    );
  }

  const displayCode = shortBookingCode(booking.id);
  const venue = [booking.venue_name, booking.venue_address].filter(Boolean).join(", ");
  const ticketMode = normalizeTicketMode(booking.ticket_mode);
  const ticketLabel = booking.items?.length
    ? booking.items.map((i) => `${i.ticket_type || "Ticket"} × ${i.qty}`).join(", ")
    : booking.ticket_qty
      ? `${booking.ticket_qty}`
      : "—";
  const guestName = booking.guest_name?.trim();

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-purple-500/[0.06] ring-1 ring-slate-100 ${className}`.trim()}
    >
      <div className="h-1.5 bg-gradient-to-r from-[#57008E] via-[#6900AA] to-[#8B2FC9]" />

      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#6900AA] to-[#57008E] px-4 py-2.5 sm:px-6">
        <p className="text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-white/95">
          Book My Bota · Official Ticket
        </p>
        <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-white/90">
          {ticketModeHeaderTag(ticketMode)}
        </span>
      </div>

      <div className="flex gap-4 p-4 sm:gap-5 sm:p-6">
        {posterUrl ? (
          <img
            src={resolveMediaUrl(posterUrl)}
            alt={booking.event_name || "Event"}
            className="aspect-[3/4] w-[5rem] shrink-0 rounded-xl object-cover bg-slate-100 shadow-md ring-1 ring-slate-200/80 sm:w-[5.75rem]"
          />
        ) : (
          <div className="aspect-[3/4] w-[5rem] shrink-0 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-inner sm:w-[5.75rem]" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold leading-snug text-slate-900 sm:text-xl">
            {booking.event_name}
          </h2>
          {venue && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm leading-snug text-slate-500">
              <MapPin size={14} className="mt-0.5 shrink-0 text-[#6900AA]" />
              <span>{venue}</span>
            </p>
          )}
          <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-2.5 py-1 text-xs font-semibold text-[#2E7D32]">
            <Check size={12} strokeWidth={3} />
            Confirmed
          </span>
        </div>
      </div>

      {guestName && (
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-xl bg-[#FBF6FF]/80 px-4 py-3 sm:mx-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F7E9FF] text-[#6900AA]">
            <User size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-[0.625rem] font-medium uppercase tracking-wide text-slate-400">Guest</p>
            <p className="text-sm font-bold text-slate-900">{guestName}</p>
          </div>
          {booking.guest_phone?.trim() && (
            <p className="ml-auto shrink-0 text-xs font-medium text-slate-500">{booking.guest_phone}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 border-y border-slate-100 sm:grid-cols-4">
        {[
          { label: "Date", value: formatLongDate(booking.starts_at) },
          {
            label: "Time",
            value: booking.starts_at ? `${formatTime12h(booking.starts_at)} Onwards` : "—",
          },
          { label: "Tickets", value: ticketLabel },
          { label: "Ticket mode", value: ticketModeLabel(ticketMode) },
        ].map((col, i, arr) => (
          <div
            key={col.label}
            className={`min-w-0 px-3 py-4 sm:px-5 ${
              i < arr.length - 1 ? "border-r border-slate-100" : ""
            } ${i >= 2 ? "border-t border-slate-100 sm:border-t-0" : ""}`}
          >
            <p className="text-[0.625rem] font-medium uppercase tracking-wide text-slate-400">
              {col.label}
            </p>
            <p className="mt-1 break-words text-sm font-semibold leading-snug text-slate-900">
              {col.value}
            </p>
          </div>
        ))}
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <p className="mb-3 text-sm font-bold text-slate-900">Order summary</p>
        <div className="space-y-2">
          {booking.items?.map((item) => (
            <div
              key={item.id || `${item.ticket_type}-${item.qty}`}
              className="flex items-start justify-between gap-4 text-sm text-slate-600"
            >
              <span className="min-w-0">
                {item.ticket_type} × {item.qty}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                {formatMoney(Number(item.unit_price) * Number(item.qty))}
              </span>
            </div>
          ))}
          <div className="flex items-start justify-between gap-4 text-sm text-slate-600">
            <span>Convenience Fee</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-800">
              {formatMoney(booking.convenience_fee_total)}
            </span>
          </div>
          {Number(booking.discount_amount) > 0 && (
            <div className="flex items-start justify-between gap-4 text-sm text-[#57008E]">
              <span>Promo discount</span>
              <span className="shrink-0 font-semibold tabular-nums">
                −{formatMoney(booking.discount_amount)}
              </span>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-4 border-t border-dashed border-slate-200 pt-3">
          <span className="text-sm font-bold text-slate-900">Amount paid</span>
          <span className="shrink-0 text-xl font-extrabold tabular-nums text-[#6900AA]">
            {formatMoney(booking.grand_total)}
          </span>
        </div>
      </div>

      <TicketPerforation />

      <FulfillmentBlock
        mode={ticketMode}
        booking={booking}
        displayCode={displayCode}
        venue={venue}
        onCopyCode={onCopyCode}
      />

      <div className="grid grid-cols-1 items-start gap-1 border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-400 sm:grid-cols-[1fr_auto] sm:gap-4 sm:px-6">
        <p className="min-w-0 break-all sm:truncate" title={booking.id}>
          Booking ID: {booking.id}
        </p>
        {formatBookedOn(booking.created_at) && (
          <p className="shrink-0 whitespace-nowrap sm:text-right">{formatBookedOn(booking.created_at)}</p>
        )}
      </div>
    </div>
  );
}
