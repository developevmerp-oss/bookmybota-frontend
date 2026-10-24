import { formatMoney } from "@/lib/currencyFormat";
import { BOOKMYBOTA_LOGO_BASE64 } from "./bookmybotaLogoBase64";

export type TicketCardPdfAmountRow = {
  label: string;
  value: string;
  strong?: boolean;
};

export type TicketCardPdfOptions = {
  filenameTitle: string; // e.g. "Dining", "Movie", "Event"
  title: string;
  posterUrl?: string | null;
  tag?: string; // "Dine-in" | "M-Ticket" | "E-Ticket"
  categoryLabel?: string;
  whenLine?: string;
  venueLine?: string;
  offerLabel?: string;
  ticketCountLabel: string;
  primaryLabel: string;
  secondaryLabel?: string;
  bookingCode: string;
  qrValue?: string | null;
  showQr?: boolean;
  cancellationNote?: string;
  totalFormatted?: string;
  amountRows?: TicketCardPdfAmountRow[];
  logoUrl?: string;
};

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const fullUrl =
      url.startsWith("http") || url.startsWith("data:")
        ? url
        : typeof window !== "undefined"
        ? `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`
        : url;
    const res = await fetch(fullUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Builds a state-of-the-art PDF styled exactly like the BookMyBota ticket card
 * shown on screen (Image 2) with crisp base64 branding, balanced vertical ticket proportions,
 * clean perforations, and professional typography.
 */
export async function buildTicketCardPdf(options: TicketCardPdfOptions): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Page background: clean confirm page gray (#F2F2F2)
  doc.setFillColor(242, 242, 242);
  doc.rect(0, 0, pageW, pageH, "F");

  // Load assets in parallel
  const [posterData, qrDataUrl] = await Promise.all([
    options.posterUrl ? fetchAsDataUrl(options.posterUrl) : Promise.resolve(null),
    options.showQr && options.qrValue
      ? fetchAsDataUrl(
          `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&data=${encodeURIComponent(
            options.qrValue
          )}`
        )
      : Promise.resolve(null),
  ]);

  // Card geometry: 118mm width gives the exact vertical ticket proportions from Image 2
  const cardW = 118; // mm
  const cardX = (pageW - cardW) / 2; // centered (46mm margin on A4)
  const centerX = cardX + cardW / 2;

  // ── Top Brand Header ───────────────────────────────────────────────────────
  const headerTopY = 16;
  const logoW = 38;
  const logoH = 12.55; // Aspect ratio matches logo (~3.03:1)

  // Official BookMyBota Logo (left)
  try {
    doc.addImage(BOOKMYBOTA_LOGO_BASE64, "PNG", cardX, headerTopY, logoW, logoH);
  } catch {
    // safe fallback
  }

  // Right Header: Status Pill with vector green dot (no unicode glitch)
  const pillW = 28;
  const pillH = 6.2;
  const pillX = cardX + cardW - pillW;
  const pillY = headerTopY + 1;

  doc.setFillColor(232, 245, 233); // #E8F5E9
  doc.setDrawColor(200, 230, 201); // #C8E6C9
  doc.setLineWidth(0.25);
  doc.roundedRect(pillX, pillY, pillW, pillH, 1.5, 1.5, "FD");

  // Vector green circle bullet
  doc.setFillColor(46, 125, 50);
  doc.circle(pillX + 4.2, pillY + 3.1, 1, "F");

  // Status text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(46, 125, 50);
  doc.text("CONFIRMED", pillX + 6.8, pillY + 4.3);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(117, 117, 117);
  doc.text("Official Booking Pass", cardX + cardW, headerTopY + 11.5, { align: "right" });

  // ── Measure Exact Card Height (fits content like Image 2, no extra gap) ────
  const cardStartY = 35;
  const pad = 5.5;
  const posterW = 22;
  const posterH = 28;

  const topH = pad + posterH + pad;

  let middleH = 6.5 + 5.5 + 4.5; // ticketCountLabel + primaryLabel + secondaryLabel
  if (options.showQr && qrDataUrl) middleH += 38;
  middleH += 4.5 + 4.5; // booking ID + spacing
  if (options.cancellationNote) middleH += 7 + 4.5; // banner + spacing
  middleH += 4.5 + 3.8 + 5; // contact support rows

  let bottomH = 5.5;
  const hasAmount = Boolean(options.totalFormatted || options.amountRows?.length);
  if (hasAmount) {
    if (options.totalFormatted) bottomH += 5;
    if (options.amountRows?.length) bottomH += options.amountRows.length * 4.5;
    bottomH += 5;
  }
  bottomH += 8.6 + 3 + 4 + 4; // BookMyBota logo + confirmation line

  const totalCardH = topH + middleH + bottomH;

  // ── Draw Ticket Card Box ───────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(232, 232, 232); // #E8E8E8
  doc.setLineWidth(0.35);
  doc.roundedRect(cardX, cardStartY, cardW, totalCardH, 3.5, 3.5, "FD");

  // ── Section 1: Header (Poster + Title + Time + Venue + Tag) ────────────────
  let curY = cardStartY + pad;

  if (posterData) {
    try {
      doc.addImage(posterData, "JPEG", cardX + pad, curY, posterW, posterH);
      doc.setDrawColor(238, 238, 238);
      doc.setLineWidth(0.2);
      doc.roundedRect(cardX + pad, curY, posterW, posterH, 1.5, 1.5, "S");
    } catch {
      doc.setFillColor(243, 243, 243);
      doc.roundedRect(cardX + pad, curY, posterW, posterH, 1.5, 1.5, "F");
    }
  } else {
    doc.setFillColor(243, 243, 243);
    doc.roundedRect(cardX + pad, curY, posterW, posterH, 1.5, 1.5, "F");
  }

  const textLeft = cardX + pad + posterW + 3.5;
  const textMaxW = cardW - pad * 2 - posterW - 12;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(17, 17, 17);
  doc.text(options.title || "Booking", textLeft, curY + 4.5, { maxWidth: textMaxW });

  // Date & Time
  let detailY = curY + 10.5;
  if (options.whenLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(102, 102, 102);
    doc.text(options.whenLine, textLeft, detailY, { maxWidth: textMaxW });
    detailY += 4.5;
  }

  // Venue & Address
  if (options.venueLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(119, 119, 119);
    doc.text(options.venueLine, textLeft, detailY, { maxWidth: textMaxW });
    detailY += 4.5;
  }

  // Offer badge if any
  if (options.offerLabel) {
    doc.setFillColor(17, 17, 17);
    doc.roundedRect(textLeft, detailY - 3, 28, 4, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.text(options.offerLabel, textLeft + 2, detailY - 0.4, { maxWidth: 26 });
  }

  // Vertical Tag on top right edge (e.g. "Dine-in", "M-Ticket", "E-Ticket")
  const tagText = options.tag || (options.filenameTitle === "Dining" ? "Dine-in" : "M-Ticket");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(170, 170, 170);
  doc.text(tagText, cardX + cardW - 3.5, curY + 14, {
    align: "center",
    angle: 90,
  });

  curY = cardStartY + topH;

  // ── First Perforation (Notch Cutouts + Dashed Line) ────────────────────────
  const notch1Y = curY;
  const notchR = 3.5;

  doc.setFillColor(242, 242, 242);
  doc.circle(cardX, notch1Y, notchR, "F");
  doc.circle(cardX + cardW, notch1Y, notchR, "F");

  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.setDrawColor(232, 232, 232);
  doc.setLineWidth(0.25);
  doc.line(cardX + 4.5, notch1Y, cardX + cardW - 4.5, notch1Y);
  doc.setLineDashPattern([], 0);

  // ── Section 2: Middle Details (Exact Image 2 Layout) ───────────────────────
  curY += 6.5;

  // Guest / Ticket count
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(136, 136, 136);
  doc.text(options.ticketCountLabel || "1 Ticket", centerX, curY, { align: "center" });

  // Primary Label (RESERVATION / Screen Name)
  curY += 5.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(17, 17, 17);
  doc.text(options.primaryLabel || "RESERVATION", centerX, curY, { align: "center" });

  // Secondary Label (Guest Name / Seats)
  if (options.secondaryLabel) {
    curY += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(68, 68, 68);
    doc.text(options.secondaryLabel, centerX, curY, { align: "center" });
  }

  // QR Code (For Movies & Events, omitted for Dining)
  if (options.showQr && qrDataUrl) {
    curY += 3.5;
    const qrSize = 32;
    doc.addImage(qrDataUrl, "PNG", centerX - qrSize / 2, curY, qrSize, qrSize);
    curY += qrSize + 2;
  } else {
    curY += 1.5;
  }

  // BOOKING ID
  curY += 4.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(17, 17, 17);
  doc.text(`BOOKING ID: ${options.bookingCode}`, centerX, curY, { align: "center" });

  // Check-in window / Cancellation Banner (Full width light gray band matching Image 2)
  if (options.cancellationNote) {
    curY += 4.5;
    const bannerH = 7;
    doc.setFillColor(245, 245, 245);
    doc.rect(cardX, curY, cardW, bannerH, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(117, 117, 117);
    doc.text(options.cancellationNote, centerX, curY + 4.6, {
      align: "center",
      maxWidth: cardW - 8,
    });
    curY += bannerH;
  }

  // Contact support row
  curY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(51, 51, 51);
  doc.text("Contact support", centerX, curY, { align: "center" });

  curY += 3.8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(136, 136, 136);
  doc.text("support@bookmybota.com", centerX, curY, { align: "center" });

  curY += 5;

  // ── Second Perforation (Notch Cutouts + Dashed Line) ───────────────────────
  const notch2Y = curY;
  doc.setFillColor(242, 242, 242);
  doc.circle(cardX, notch2Y, notchR, "F");
  doc.circle(cardX + cardW, notch2Y, notchR, "F");

  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.setDrawColor(232, 232, 232);
  doc.setLineWidth(0.25);
  doc.line(cardX + 4.5, notch2Y, cardX + cardW - 4.5, notch2Y);
  doc.setLineDashPattern([], 0);

  // ── Section 3: Amount Breakdown (if present) & BookMyBota Logo Footer ──────
  curY += 5.5;

  if (options.totalFormatted) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(17, 17, 17);
    doc.text("Total Amount", cardX + pad, curY);
    doc.text(options.totalFormatted, cardX + cardW - pad, curY, { align: "right" });
    curY += 5;
  }

  if (options.amountRows?.length) {
    for (const row of options.amountRows) {
      doc.setFont("helvetica", row.strong ? "bold" : "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(row.strong ? 17 : 102, row.strong ? 17 : 102, row.strong ? 17 : 102);
      doc.text(row.label, cardX + pad, curY);
      doc.text(row.value, cardX + cardW - pad, curY, { align: "right" });
      curY += 4.5;
    }
  }

  if (hasAmount) {
    curY += 1.5;
    doc.setDrawColor(238, 238, 238);
    doc.setLineWidth(0.2);
    doc.line(cardX + pad, curY, cardX + cardW - pad, curY);
    curY += 4;
  }

  // Centered BookMyBota Official Logo in Card Footer
  const footerLogoW = 26;
  const footerLogoH = 8.6; // 26 / 3.02635
  try {
    doc.addImage(
      BOOKMYBOTA_LOGO_BASE64,
      "PNG",
      centerX - footerLogoW / 2,
      curY,
      footerLogoW,
      footerLogoH
    );
  } catch {
    // safe fallback
  }

  curY += footerLogoH + 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.2);
  doc.setTextColor(153, 153, 153);
  doc.text("BookMyBota · Official Booking Confirmation", centerX, curY, { align: "center" });

  // ── Document Sub-Footer ────────────────────────────────────────────────────
  const pageFooterY = cardStartY + totalCardH + 7;
  if (pageFooterY < pageH - 6) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(153, 153, 153);
    doc.text(
      "This is an electronically generated booking confirmation.",
      pageW / 2,
      pageFooterY,
      { align: "center" }
    );
  }

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
