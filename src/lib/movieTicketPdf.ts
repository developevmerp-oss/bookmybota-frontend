import { formatDateCustomer, formatTime12h } from "@/lib/dateFormat";
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
  discount_amount?: number | string;
  promo_code?: string;
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

function formatLongDate(value?: string) {
  if (!value) return "—";
  const normalized = String(value).includes("T") ? value : String(value).replace(" ", "T");
  const label = formatDateCustomer(normalized);
  const time = formatTime12h(normalized);
  return `${label} · ${time}`;
}

export async function buildMovieTicketPdf(booking: MovieTicketPdfBooking): Promise<Blob> {
  const seatsLabel =
    (booking.seats || [])
      .map((s) => s.seat_identifier)
      .filter(Boolean)
      .join(", ") || "—";

  const venueLine = [booking.cinema_name, booking.cinema_address]
    .filter(Boolean)
    .join(", ");

  const formatMeta = [booking.showtime_format, booking.showtime_language]
    .filter(Boolean)
    .join(", ");

  const qrRaw = booking.qr_code_token || booking.booking_code || booking.id;
  const bookingCode = booking.booking_code || booking.id.slice(0, 8).toUpperCase();
  const ticketCount = booking.ticket_qty || booking.seats?.length || 1;

  const amountRows: TicketCardPdfAmountRow[] = [
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
      value: `− ${formatMoney(Number(booking.discount_amount) || 0)}`,
      strong: true,
    });
  }

  return buildTicketCardPdf({
    filenameTitle: "Movie",
    title: booking.movie_title || "Movie",
    posterUrl: booking.movie_poster || booking.cinema_image || null,
    tag: "M-Ticket",
    whenLine: formatLongDate(booking.showtime_starts_at),
    venueLine: venueLine || formatMeta,
    offerLabel: booking.promo_code ? `Offer: ${booking.promo_code}` : undefined,
    ticketCountLabel: `${ticketCount} Ticket${ticketCount === 1 ? "" : "(s)"}`,
    primaryLabel: booking.screen_name || "SCREEN",
    secondaryLabel: seatsLabel,
    bookingCode,
    qrValue: qrRaw,
    showQr: true,
    cancellationNote: "Cancellation unavailable : cut-off time of 20 minutes before showtime has passed",
    totalFormatted: formatMoney(Number(booking.grand_total) || 0),
    amountRows,
  });
}

export { downloadPdfBlob };
