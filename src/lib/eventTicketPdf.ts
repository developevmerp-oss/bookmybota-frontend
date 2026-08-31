import type { jsPDF } from "jspdf";
import { formatTime12h } from "@/lib/dateFormat";
import { formatMoney } from "@/lib/currencyFormat";
import {
  formatDeliveryAddress,
  normalizeTicketMode,
  ticketModeHeaderTag,
  ticketModeLabel,
} from "@/lib/eventTicketMode";
import { eventBookingQrValue } from "@/lib/eventScanToken";

const BRAND: [number, number, number] = [105, 0, 170];
const BRAND_DARK: [number, number, number] = [87, 0, 142];
const BRAND_LIGHT: [number, number, number] = [247, 233, 255];
const BRAND_TINT: [number, number, number] = [251, 246, 255];
const SLATE_900: [number, number, number] = [15, 23, 42];
const SLATE_800: [number, number, number] = [30, 41, 59];
const SLATE_600: [number, number, number] = [71, 85, 105];
const SLATE_400: [number, number, number] = [148, 163, 184];
const SLATE_50: [number, number, number] = [248, 250, 252];
const GREEN: [number, number, number] = [46, 125, 50];
const GREEN_BG: [number, number, number] = [232, 245, 233];
const BORDER: [number, number, number] = [226, 232, 240];
const PAGE_BG: [number, number, number] = [241, 242, 245];
const WHITE: [number, number, number] = [255, 255, 255];

const CARD_MARGIN = 16;
const CARD_PAD = 14;
const HEADER_H = 16;
const POSTER_W = 30;
const POSTER_H = 38;
const QR_SIZE = 46;
const QR_PAD = 10;

export type EventTicketPdfBooking = {
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

type PdfAssets = {
  posterData: string | null;
  qrDataUrl: string | null;
  ticketLabel: string;
  venue: string;
  displayCode: string;
  modeLabel: string;
};

type LayoutCtx = {
  contentX: number;
  contentW: number;
  cardX: number;
  cardW: number;
  cardTop: number;
};

function formatLongDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  return `${date}, ${weekday}`;
}

function formatShortDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatBookedOn(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `Booked ${date}, ${time}`;
}

export function shortBookingCode(id: string) {
  const compact = id.replace(/-/g, "").toUpperCase();
  return `BMB-${compact.slice(0, 8)}-${compact.slice(8, 12)}`;
}

export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function lineCount(doc: jsPDF, text: string, maxWidth: number): number {
  return Math.max(doc.splitTextToSize(text || "—", maxWidth).length, 1);
}

function drawWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const lines = doc.splitTextToSize(text || "—", maxWidth);
  lines.forEach((line: string, i: number) => doc.text(line, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function drawHRule(doc: jsPDF, x1: number, x2: number, y: number, dashed = false) {
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern(dashed ? [1.2, 1.2] : [], 0);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
}

function imageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

function drawPerforation(doc: jsPDF, cardX: number, cardW: number, y: number) {
  const notchR = 2.5;
  const midY = y + 5;

  doc.setFillColor(...PAGE_BG);
  doc.circle(cardX, midY, notchR, "F");
  doc.circle(cardX + cardW, midY, notchR, "F");

  doc.setDrawColor(...SLATE_400);
  doc.setLineWidth(0.35);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(cardX + notchR + 2, midY, cardX + cardW - notchR - 2, midY);
  doc.setLineDashPattern([], 0);
}

function drawCodeBadge(doc: jsPDF, code: string, x: number, y: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const padX = 5;
  const padY = 3;
  const textW = doc.getTextWidth(code);
  const badgeW = textW + padX * 2;
  const badgeH = 8;
  const badgeY = y;

  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, badgeY, badgeW, badgeH, 2, 2, "FD");

  doc.setTextColor(...BRAND);
  doc.text(code, x + padX, badgeY + 5.5);
  return badgeY + badgeH;
}

function measureEventHeader(
  doc: jsPDF,
  booking: EventTicketPdfBooking,
  assets: PdfAssets,
  contentW: number,
  hasPoster: boolean
) {
  const textW = hasPoster ? contentW - POSTER_W - 12 : contentW;
  doc.setFontSize(16);
  let h = 8 + lineCount(doc, booking.event_name || "Event", textW) * 5.6;
  if (assets.venue) {
    doc.setFontSize(9);
    h += 3 + lineCount(doc, assets.venue, textW) * 4.2;
  }
  h += 10;
  return Math.max(h, POSTER_H + 4);
}

function calcInfoGridHeight(
  doc: jsPDF,
  booking: EventTicketPdfBooking,
  assets: PdfAssets,
  contentW: number
) {
  const colW = contentW / 2 - 18;
  doc.setFontSize(9.5);
  const cells = [
    formatLongDate(booking.starts_at),
    booking.starts_at ? `${formatTime12h(booking.starts_at)} Onwards` : "—",
    assets.ticketLabel,
    assets.modeLabel,
  ];
  let maxBottom = 44;
  cells.forEach((value, i) => {
    const row = Math.floor(i / 2);
    const cellY = 6 + row * 22 + 5;
    const lines = lineCount(doc, value, colW);
    maxBottom = Math.max(maxBottom, cellY + lines * 4.5);
  });
  return maxBottom + 12;
}

function measureOrderSection(booking: EventTicketPdfBooking) {
  let h = 8 + 8;
  h += (booking.items?.length || 0) * 7 + 7;
  if (Number(booking.discount_amount) > 0) h += 7;
  return h + 6 + 20;
}

function measureQrSection(
  doc: jsPDF,
  mode: ReturnType<typeof normalizeTicketMode>,
  booking: EventTicketPdfBooking,
  contentW: number
) {
  if (mode === "PHYSICAL_DELIVERY") {
    doc.setFontSize(9);
    const addrH = lineCount(doc, formatDeliveryAddress(booking) || "Delivery address on file", contentW - 20) * 4.2;
    return QR_PAD * 2 + 12 + addrH + 14;
  }
  const textW = contentW - QR_PAD * 2 - QR_SIZE - 14;
  doc.setFontSize(9);
  const bodyLines = mode === "BOX_OFFICE" ? 3 : 2;
  const textBlockH = 12 + bodyLines * 4.2 + 12;
  return QR_PAD * 2 + Math.max(QR_SIZE + 4, textBlockH);
}

function measureFooterSection() {
  return 22;
}

function measureCardHeight(
  doc: jsPDF,
  booking: EventTicketPdfBooking,
  assets: PdfAssets,
  contentW: number,
  hasPoster: boolean,
  mode: ReturnType<typeof normalizeTicketMode>
) {
  let h = HEADER_H + CARD_PAD;
  h += measureEventHeader(doc, booking, assets, contentW, hasPoster);
  if (booking.guest_name?.trim()) h += 20;
  h += 8 + calcInfoGridHeight(doc, booking, assets, contentW);
  h += 8 + measureOrderSection(booking);
  h += 14;
  h += measureQrSection(doc, mode, booking, contentW);
  h += CARD_PAD + measureFooterSection();
  return h + 6;
}

function drawCardHeader(doc: jsPDF, ctx: LayoutCtx) {
  const { cardX, cardW, cardTop, contentX, contentW } = ctx;

  doc.setFillColor(...BRAND);
  doc.roundedRect(cardX, cardTop, cardW, HEADER_H, 4, 4, "F");
  doc.rect(cardX, cardTop + HEADER_H - 4, cardW, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text("Book My Bota", contentX, cardTop + 10.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(230, 210, 255);
  doc.text("Official Event Ticket", contentX + contentW, cardTop + 10.5, { align: "right" });
}

function drawInfoGrid(
  doc: jsPDF,
  booking: EventTicketPdfBooking,
  assets: PdfAssets,
  ctx: LayoutCtx,
  y: number
): number {
  const { contentX, contentW } = ctx;
  const colW = contentW / 2;
  const cells = [
    { label: "Date", value: formatLongDate(booking.starts_at) },
    {
      label: "Time",
      value: booking.starts_at ? `${formatTime12h(booking.starts_at)} Onwards` : "—",
    },
    { label: "Tickets", value: assets.ticketLabel },
    { label: "Ticket mode", value: assets.modeLabel },
  ];

  let maxBottom = y + 44;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  cells.forEach((cell, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = contentX + col * colW + (col === 0 ? 6 : 14);
    const w = colW - 18;
    const cellY = y + row * 22 + 6;
    doc.setFontSize(9.5);
    const endY = drawWrappedText(doc, cell.value, x, cellY + 5, w, 4.5);
    maxBottom = Math.max(maxBottom, endY);
  });

  const gridH = maxBottom - y + 8;

  doc.setFillColor(...SLATE_50);
  doc.roundedRect(contentX, y, contentW, gridH, 2, 2, "F");

  cells.forEach((cell, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = contentX + col * colW + (col === 0 ? 6 : 14);
    const w = colW - 18;
    const cellY = y + row * 22 + 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_400);
    doc.text(cell.label.toUpperCase(), x, cellY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...SLATE_900);
    drawWrappedText(doc, cell.value, x, cellY + 5, w, 4.5);

    if (col === 0) {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.2);
      doc.line(contentX + colW, y + 4, contentX + colW, y + gridH - 4);
    }
    if (row === 0 && gridH > 44) {
      drawHRule(doc, contentX + 4, contentX + contentW - 4, y + 22, false);
    }
  });

  return y + gridH + 4;
}

function drawGuestRow(doc: jsPDF, booking: EventTicketPdfBooking, ctx: LayoutCtx, y: number): number {
  const guest = booking.guest_name?.trim();
  if (!guest) return y;

  const { contentX, contentW } = ctx;
  const rowH = 16;

  doc.setFillColor(...BRAND_TINT);
  doc.setDrawColor(...BRAND_LIGHT);
  doc.setLineWidth(0.3);
  doc.roundedRect(contentX, y, contentW, rowH, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE_400);
  doc.text("GUEST", contentX + 6, y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_900);
  doc.text(guest, contentX + 6, y + 12.5);

  if (booking.guest_phone?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SLATE_600);
    doc.text(booking.guest_phone.trim(), contentX + contentW - 6, y + 12.5, { align: "right" });
  }

  return y + rowH + 8;
}

function drawQrSection(
  doc: jsPDF,
  booking: EventTicketPdfBooking,
  assets: PdfAssets,
  ctx: LayoutCtx,
  y: number
): number {
  const { contentX, contentW } = ctx;
  const mode = normalizeTicketMode(booking.ticket_mode);
  const boxH = measureQrSection(doc, mode, booking, contentW);

  doc.setFillColor(...BRAND_TINT);
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.4);
  doc.roundedRect(contentX, y, contentW, boxH, 3, 3, "FD");

  if (mode === "PHYSICAL_DELIVERY") {
    const ix = contentX + QR_PAD;
    const iy = y + QR_PAD;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...SLATE_900);
    doc.text("Home delivery", ix, iy + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SLATE_600);
    drawWrappedText(
      doc,
      formatDeliveryAddress(booking) || "Delivery address on file",
      ix,
      iy + 10,
      contentW - QR_PAD * 2,
      4.2
    );
    drawCodeBadge(doc, assets.displayCode, ix, y + boxH - QR_PAD - 8);
    return y + boxH;
  }

  const qrX = contentX + QR_PAD;
  const qrY = y + (boxH - QR_SIZE) / 2;

  if (assets.qrDataUrl) {
    try {
      doc.setFillColor(...WHITE);
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.25);
      doc.roundedRect(qrX - 2, qrY - 2, QR_SIZE + 4, QR_SIZE + 4, 2, 2, "FD");
      doc.addImage(assets.qrDataUrl, "PNG", qrX, qrY, QR_SIZE, QR_SIZE);
    } catch {
      /* skip */
    }
  }

  const textX = qrX + QR_SIZE + 12;
  const textW = contentW - (textX - contentX) - QR_PAD;
  const textY = y + QR_PAD + 4;

  const qrTitle = mode === "BOX_OFFICE" ? "Box office pickup" : "Entry QR";
  const qrBody =
    mode === "BOX_OFFICE"
      ? "Collect printed tickets at the venue box office. Bring your booking code and a valid photo ID."
      : "Show this QR at the venue entrance. One scan per booking — save this PDF on your phone.";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...SLATE_900);
  doc.text(qrTitle, textX, textY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_600);
  const bodyEnd = drawWrappedText(doc, qrBody, textX, textY + 6, textW, 4.2);

  drawCodeBadge(doc, assets.displayCode, textX, Math.max(bodyEnd + 4, y + boxH - QR_PAD - 8));

  return y + boxH;
}

function drawTicketContent(
  doc: jsPDF,
  booking: EventTicketPdfBooking,
  assets: PdfAssets,
  ctx: LayoutCtx
) {
  const { contentX, contentW, cardTop } = ctx;
  let y = cardTop + HEADER_H + CARD_PAD;

  const hasPoster = Boolean(assets.posterData);
  const headerTextX = hasPoster ? contentX + POSTER_W + 12 : contentX;
  const headerTextW = hasPoster ? contentW - POSTER_W - 12 : contentW;
  const headerTop = y;

  if (assets.posterData) {
    try {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.25);
      doc.roundedRect(contentX, y, POSTER_W, POSTER_H, 2.5, 2.5, "S");
      doc.addImage(
        assets.posterData,
        imageFormat(assets.posterData),
        contentX,
        y,
        POSTER_W,
        POSTER_H
      );
    } catch {
      /* skip */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND);
  doc.text(ticketModeHeaderTag(normalizeTicketMode(booking.ticket_mode)).toUpperCase(), headerTextX, y + 4);

  doc.setFontSize(16);
  doc.setTextColor(...SLATE_900);
  const titleEnd = drawWrappedText(
    doc,
    booking.event_name || "Event",
    headerTextX,
    y + 10,
    headerTextW,
    5.6
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_600);
  const venueEnd = assets.venue
    ? drawWrappedText(doc, assets.venue, headerTextX, titleEnd + 3, headerTextW, 4.2)
    : titleEnd;

  const badgeY = venueEnd + 5;
  doc.setFillColor(...GREEN_BG);
  doc.roundedRect(headerTextX, badgeY, 32, 7.5, 3.75, 3.75, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GREEN);
  doc.text("Confirmed", headerTextX + 5, badgeY + 5.2);

  y = Math.max(badgeY + 14, headerTop + POSTER_H + 6);
  drawHRule(doc, contentX, contentX + contentW, y);
  y += 10;

  y = drawGuestRow(doc, booking, ctx, y);
  y = drawInfoGrid(doc, booking, assets, ctx, y);
  drawHRule(doc, contentX, contentX + contentW, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...SLATE_900);
  doc.text("Order summary", contentX, y);
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  booking.items?.forEach((item) => {
    const label = `${item.ticket_type || "Ticket"}  ×  ${item.qty}`;
    doc.setTextColor(...SLATE_600);
    doc.text(label, contentX, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...SLATE_800);
    doc.text(formatMoney(Number(item.unit_price) * Number(item.qty)), contentX + contentW, y, {
      align: "right",
    });
    doc.setFont("helvetica", "normal");
    y += 7;
  });

  doc.setTextColor(...SLATE_600);
  doc.text("Convenience fee", contentX, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...SLATE_800);
  doc.text(formatMoney(booking.convenience_fee_total), contentX + contentW, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 7;

  if (Number(booking.discount_amount) > 0) {
    doc.setTextColor(...BRAND);
    doc.text("Promo discount", contentX, y);
    doc.setFont("helvetica", "bold");
    doc.text(`−${formatMoney(booking.discount_amount)}`, contentX + contentW, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 7;
  }

  y += 4;
  drawHRule(doc, contentX, contentX + contentW, y, true);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_900);
  doc.text("Amount paid", contentX, y + 2);
  doc.setFontSize(18);
  doc.setTextColor(...BRAND);
  doc.text(formatMoney(booking.grand_total), contentX + contentW, y + 2, { align: "right" });
  y += 20;

  drawPerforation(doc, ctx.cardX, ctx.cardW, y);
  y += 14;

  y = drawQrSection(doc, booking, assets, ctx, y);
  y += CARD_PAD;

  const footerH = measureFooterSection();
  doc.setFillColor(...SLATE_50);
  doc.rect(contentX, y, contentW, footerH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...BRAND);
  doc.text(assets.displayCode, contentX + 6, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_400);
  doc.text(`Ref: ${booking.id}`, contentX + 6, y + 14);

  const bookedOn = formatBookedOn(booking.created_at);
  if (bookedOn) {
    doc.text(bookedOn, contentX + contentW - 6, y + 8, { align: "right" });
  }
  doc.text(formatShortDate(booking.starts_at), contentX + contentW - 6, y + 14, { align: "right" });
}

export async function buildEventTicketPdf(
  booking: EventTicketPdfBooking,
  options?: { posterUrl?: string | null }
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");

  const qrRaw = eventBookingQrValue(booking);
  const qrUrl = qrRaw
    ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&data=${encodeURIComponent(qrRaw)}`
    : null;
  const [posterData, qrDataUrl] = await Promise.all([
    options?.posterUrl ? urlToDataUrl(options.posterUrl) : Promise.resolve(null),
    qrUrl ? urlToDataUrl(qrUrl) : Promise.resolve(null),
  ]);

  const ticketLabel = booking.items?.length
    ? booking.items.map((i) => `${i.ticket_type || "Ticket"} × ${i.qty}`).join(", ")
    : "—";

  const mode = normalizeTicketMode(booking.ticket_mode);
  const assets: PdfAssets = {
    posterData,
    qrDataUrl,
    ticketLabel,
    venue: [booking.venue_name, booking.venue_address].filter(Boolean).join(", "),
    displayCode: shortBookingCode(booking.id),
    modeLabel: ticketModeLabel(mode),
  };

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const cardW = pageW - CARD_MARGIN * 2;
  const contentX = CARD_MARGIN + CARD_PAD;
  const contentW = cardW - CARD_PAD * 2;
  const cardTop = 18;

  const cardH = measureCardHeight(doc, booking, assets, contentW, Boolean(posterData), mode);
  const cardX = CARD_MARGIN;

  doc.setFillColor(...PAGE_BG);
  doc.rect(0, 0, pageW, pageH, "F");

  doc.setFillColor(...WHITE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.5);
  doc.roundedRect(cardX, cardTop, cardW, cardH, 5, 5, "FD");

  doc.setDrawColor(220, 220, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(cardX + 1.5, cardTop + 1.5, cardW - 3, cardH - 3, 4, 4, "S");

  const ctx: LayoutCtx = { contentX, contentW, cardX, cardW, cardTop };
  drawCardHeader(doc, ctx);
  drawTicketContent(doc, booking, assets, ctx);

  const footerY = cardTop + cardH + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...SLATE_400);
  doc.text(
    "Non-transferable · Present valid ID if requested · bookmybota.com",
    pageW / 2,
    footerY,
    { align: "center", maxWidth: cardW }
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
