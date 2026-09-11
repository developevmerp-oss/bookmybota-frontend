import { formatTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";

const BRAND: [number, number, number] = [105, 0, 170];
const SLATE_900: [number, number, number] = [15, 23, 42];
const SLATE_600: [number, number, number] = [71, 85, 105];
const SLATE_400: [number, number, number] = [148, 163, 184];
const SLATE_50: [number, number, number] = [248, 250, 252];
const BORDER: [number, number, number] = [226, 232, 240];
const WHITE: [number, number, number] = [255, 255, 255];
const GREEN: [number, number, number] = [46, 125, 50];

export type MovieTicketPdfBooking = {
  id: string;
  movie_title?: string;
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
  grand_total?: number | string;
  seats?: Array<{
    seat_identifier?: string;
    tier_name?: string | null;
    unit_price?: number | string;
  }>;
};

function formatLongDate(value?: string) {
  if (!value) return "—";
  const normalized = String(value).includes("T") ? value : String(value).replace(" ", "T");
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildMovieTicketPdf(booking: MovieTicketPdfBooking): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const cardW = pageW - margin * 2;
  let y = 20;

  const qrRaw = booking.qr_code_token || booking.booking_code || booking.id;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(qrRaw)}`;
  const qrDataUrl = await fetchAsDataUrl(qrUrl);

  const venue = [booking.cinema_name, booking.screen_name, booking.cinema_address]
    .filter(Boolean)
    .join(" · ");
  const meta = [booking.showtime_format, booking.showtime_language, booking.movie_certificate]
    .filter(Boolean)
    .join(" · ");
  const seatsLabel =
    (booking.seats || [])
      .map((s) => s.seat_identifier)
      .filter(Boolean)
      .join(", ") || "—";

  doc.setFillColor(...SLATE_50);
  doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");

  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.roundedRect(margin, y, cardW, 240, 4, 4, "FD");

  doc.setFillColor(...BRAND);
  doc.roundedRect(margin, y, cardW, 18, 4, 4, "F");
  doc.rect(margin, y + 10, cardW, 8, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BookMyBota  ·  Official M-Ticket", margin + 8, y + 11);

  y += 28;
  doc.setTextColor(...SLATE_900);
  doc.setFontSize(16);
  doc.text(booking.movie_title || "Movie", margin + 8, y, { maxWidth: cardW - 16 });

  y += 8;
  if (meta) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SLATE_600);
    doc.text(meta, margin + 8, y);
    y += 6;
  }

  doc.setFontSize(9);
  doc.setTextColor(...SLATE_600);
  doc.text(venue || "Cinema TBA", margin + 8, y, { maxWidth: cardW - 16 });
  y += 6;
  doc.text(
    `${formatLongDate(booking.showtime_starts_at)}  ·  ${formatTime12h(booking.showtime_starts_at)}`,
    margin + 8,
    y
  );

  y += 12;
  doc.setDrawColor(...BORDER);
  doc.line(margin + 8, y, margin + cardW - 8, y);
  y += 10;

  const leftX = margin + 8;
  const rightX = margin + cardW / 2;
  const drawField = (label: string, value: string, x: number, yy: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_400);
    doc.text(label.toUpperCase(), x, yy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...SLATE_900);
    doc.text(value || "—", x, yy + 5, { maxWidth: cardW / 2 - 16 });
  };

  drawField("Guest", booking.guest_name || "Guest", leftX, y);
  drawField("Booking code", booking.booking_code || "—", rightX, y);
  y += 16;
  drawField("Seats", seatsLabel, leftX, y);
  drawField("Tickets", String(booking.ticket_qty || booking.seats?.length || 0), rightX, y);
  y += 16;
  drawField("Amount paid", formatMoney(Number(booking.grand_total) || 0), leftX, y);

  y += 20;
  if (qrDataUrl) {
    const qrSize = 48;
    const qrX = margin + (cardW - qrSize) / 2;
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(qrX - 4, y - 4, qrSize + 8, qrSize + 8, 3, 3, "FD");
    doc.addImage(qrDataUrl, "PNG", qrX, y, qrSize, qrSize);
    y += qrSize + 12;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_600);
  doc.text("Show this QR at the cinema gate for one-time entry.", pageW / 2, y, {
    align: "center",
  });
  y += 6;
  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.text("CONFIRMED", pageW / 2, y, { align: "center" });

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_400);
  doc.text(
    "Non-transferable · Present valid ID if requested · bookmybota.com",
    pageW / 2,
    y,
    { align: "center", maxWidth: cardW - 20 }
  );

  return doc.output("blob");
}

export function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
