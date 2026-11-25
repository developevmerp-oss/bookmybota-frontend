import { formatTime12h, getVenueDateTimeParts } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import {
  buildTicketCardPdf,
  downloadPdfBlob,
  type TicketCardPdfAmountRow,
} from "./confirmationTicketPdf";

export type MovieTicketPdfBooking = {
  id: string;
  movie_title?: string;
  movie_poster?: string;
  cinema_image?: string;
  cinema_name?: string;
  cinema_address?: string;
  screen_name?: string;
  showtime_starts_at?: string;
  showtime_format?: string;
  showtime_language?: string;
  movie_certificate?: string;
  booking_code?: string;
  qr_code_token?: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  ticket_qty?: number;
  ticket_amount?: number | string;
  grand_total?: number | string;
  beverage_total?: number | string;
  convenience_fee_total?: number | string;
  discount_amount?: number | string | null;
  gift_card_amount?: number | string | null;
  promo_code?: string | null;
  seats?: Array<{
    seat_identifier?: string;
    tier_name?: string | null;
    unit_price?: number | string;
  }>;
  beverages?: Array<{
    id?: string;
    name: string;
    quantity: number;
    unit_price?: number | string;
    subtotal?: number | string;
  }>;
};

/** Formats showtime matching screen UI, e.g. "Wed, 25 Nov | 8:00 AM" */
function formatShowtimeMetaLine(startsAt?: string): string {
  if (!startsAt) return "—";
  const parts = getVenueDateTimeParts(startsAt);
  if (!parts) return formatTime12h(startsAt);
  const month = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 12)).toLocaleDateString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  const day = String(parts.d).padStart(2, "0");
  return `${parts.weekdayLong.slice(0, 3)}, ${day} ${month} | ${formatTime12h(startsAt)}`;
}

export async function buildMovieTicketPdf(booking: MovieTicketPdfBooking): Promise<Blob> {
  const tierMap = new Map<string, string[]>();
  for (const s of booking.seats || []) {
    let id = String(s.seat_identifier || "").trim();
    const tier = String(s.tier_name || "").trim();
    if (tier && id.toLowerCase().startsWith(tier.toLowerCase())) {
      id = id.slice(tier.length).replace(/^[\s\-_]+/, "").trim();
    }
    if (!tierMap.has(tier)) tierMap.set(tier, []);
    tierMap.get(tier)!.push(id || String(s.seat_identifier || "").trim());
  }
  const seatsLabel =
    Array.from(tierMap.entries())
      .map(([tier, list]) => {
        const formatted = list.filter(Boolean).join(", ");
        return tier ? `${tier} • ${formatted}` : formatted;
      })
      .filter(Boolean)
      .join("  •  ") || "—";

  const venueLine = [booking.cinema_name, booking.cinema_address]
    .filter(Boolean)
    .join(", ");

  const formatMeta = [booking.showtime_language, booking.showtime_format]
    .filter(Boolean)
    .join(", ");

  const qrRaw = booking.qr_code_token || booking.booking_code || booking.id;
  const bookingCode = booking.booking_code || booking.id.slice(0, 8).toUpperCase();
  const ticketCount = booking.ticket_qty || booking.seats?.length || 1;

  const seatGroups = new Map<string, { label: string; qty: number; unit: number }>();
  for (const seat of booking.seats || []) {
    const label = String(seat.tier_name || "Ticket").trim() || "Ticket";
    const unit = Number(seat.unit_price) || 0;
    const key = `${label.toLowerCase()}|${unit.toFixed(2)}`;
    const prev = seatGroups.get(key);
    if (prev) prev.qty += 1;
    else seatGroups.set(key, { label, qty: 1, unit });
  }
  const amountRows: TicketCardPdfAmountRow[] =
    seatGroups.size > 0
      ? [...seatGroups.values()].map((g) => ({
          label: `${g.label} × ${g.qty}`,
          labelDetail: `${formatMoney(g.unit)} each`,
          value: formatMoney(g.unit * g.qty),
        }))
      : [
          {
            label: "Net Ticket(s) Price",
            value: formatMoney(Number(booking.ticket_amount || booking.grand_total) || 0),
          },
        ];

  if (Number(booking.beverage_total) > 0) {
    amountRows.push({
      label: "Snacks & beverages",
      value: formatMoney(Number(booking.beverage_total) || 0),
    });
  }

  if (Number(booking.convenience_fee_total) > 0) {
    amountRows.push({
      label: "Convenience fee",
      value: formatMoney(Number(booking.convenience_fee_total) || 0),
    });
  }

  if (Number(booking.discount_amount) > 0) {
    amountRows.push({
      label: `Discount${booking.promo_code ? ` (${booking.promo_code})` : ""}`,
      value: `- ${formatMoney(Number(booking.discount_amount) || 0)}`,
      strong: true,
    });
  }

  if (Number(booking.gift_card_amount) > 0) {
    amountRows.push({
      label: "Gift Card",
      value: `- ${formatMoney(Number(booking.gift_card_amount) || 0)}`,
      strong: true,
    });
  }

  return buildTicketCardPdf({
    filenameTitle: "Movie",
    title: booking.movie_title || "Movie",
    posterUrl: booking.movie_poster || booking.cinema_image || null,
    tag: "M-Ticket",
    categoryLabel: formatMeta || undefined,
    whenLine: formatShowtimeMetaLine(booking.showtime_starts_at),
    venueLine: venueLine || undefined,
    offerLabel: booking.promo_code ? `Offer: ${booking.promo_code}` : undefined,
    ticketCountLabel: `${ticketCount} Ticket${ticketCount === 1 ? "" : "(s)"}`,
    primaryLabel: booking.screen_name || "SCREEN",
    secondaryLabel: seatsLabel,
    bookingCode,
    qrValue: qrRaw,
    showQr: true,
    totalFormatted: formatMoney(Number(booking.grand_total) || 0),
    totalNote:
      Number(booking.convenience_fee_total) > 0
        ? `Includes ${formatMoney(Number(booking.convenience_fee_total))} convenience fee & VAT`
        : undefined,
    amountRows,
  });
}

export { downloadPdfBlob };
