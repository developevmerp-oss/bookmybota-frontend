import { formatMoney } from "@/lib/currencyFormat";
import { BOOKMYBOTA_LOGO_BASE64 } from "./bookmybotaLogoBase64";

export type TicketCardPdfAmountRow = {
  label: string;
  value: string;
  strong?: boolean;
  /** Unit price under the line, e.g. "350 ETB each". */
  labelDetail?: string;
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
  /** Optional third line (e.g. guest name when seats are shown). */
  tertiaryLabel?: string;
  bookingCode: string;
  qrValue?: string | null;
  showQr?: boolean;
  cancellationNote?: string;
  totalFormatted?: string;
  /** Under Total Amount, e.g. "Includes 80.50 ETB convenience fee & VAT". */
  totalNote?: string;
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
 * object-fit: cover into a fixed PDF box so posters are not stretched.
 * Returns a JPEG data URL cropped to targetW:targetH.
 */
export async function coverCropImageForPdf(
  dataUrl: string,
  targetW: number,
  targetH: number,
  outPx = 420
): Promise<string | null> {
  if (typeof window === "undefined" || !dataUrl) return null;
  const ratio = targetW / Math.max(targetH, 0.01);
  const outW = Math.max(1, Math.round(outPx * ratio));
  const outH = Math.max(1, outPx);

  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (!iw || !ih) {
          resolve(null);
          return;
        }
        const scale = Math.max(outW / iw, outH / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (outW - dw) / 2;
        const dy = (outH - dh) / 2;
        ctx.fillStyle = "#F3F3F3";
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, dx, dy, dw, dh);
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
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

  // Card geometry: 118mm width gives the exact vertical ticket proportions from Image 2
  const cardW = 118; // mm
  const cardX = (pageW - cardW) / 2; // centered (46mm margin on A4)
  const centerX = cardX + cardW / 2;

  // ── Measure Exact Card Height (fits content like Image 2, no extra gap) ────
  const cardStartY = 16;
  const pad = 5.5;
  /** Match on-screen ticket poster aspect (2:3) — cover-crop, never stretch. */
  const posterW = 20;
  const posterH = 30;

  // Load assets in parallel (poster cover-cropped to poster box)
  const [posterRaw, qrDataUrl] = await Promise.all([
    options.posterUrl ? fetchAsDataUrl(options.posterUrl) : Promise.resolve(null),
    options.showQr && options.qrValue
      ? fetchAsDataUrl(
          `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=8&data=${encodeURIComponent(
            options.qrValue
          )}`
        )
      : Promise.resolve(null),
  ]);
  const posterData = posterRaw
    ? (await coverCropImageForPdf(posterRaw, posterW, posterH)) || posterRaw
    : null;

  // Estimate Header Details Height to ensure topH dynamically encloses all text
  const textMaxW = cardW - pad * 2 - posterW - 12;
  const estimatedTitleLines = Math.max(1, Math.ceil(doc.getTextWidth(options.title || "Booking") / textMaxW));
  let estimatedHeaderContentH = 4.5 + estimatedTitleLines * 4.2;
  if (options.categoryLabel) estimatedHeaderContentH += 4.2;
  if (options.whenLine) estimatedHeaderContentH += 4.2;
  if (options.venueLine) {
    const venueEstLines = Math.max(1, Math.ceil(doc.getTextWidth(options.venueLine) / textMaxW));
    estimatedHeaderContentH += venueEstLines * 3.3 + 1;
  }
  if (options.offerLabel) estimatedHeaderContentH += 5.5;

  const topH = Math.max(pad + posterH + pad, pad + estimatedHeaderContentH + pad);

  const primaryText = String(options.primaryLabel || "RESERVATION").trim() || "RESERVATION";
  const primaryLen = primaryText.length;
  const primaryFontSize = primaryLen > 28 ? 10 : primaryLen > 16 ? 11.5 : 13.5;
  const primaryMaxW = cardW - pad * 2;
  const primaryCharsPerLine = Math.max(12, Math.floor(primaryMaxW / (primaryFontSize * 0.42)));
  const primaryLines = Math.max(1, Math.ceil(primaryLen / primaryCharsPerLine));
  const primaryLineStep = primaryFontSize * 0.38 + 0.8;
  // Balanced: count → stand → seats with even gaps (not cramped, not sparse)
  const primaryBlockH = 5 + (primaryLines - 1) * primaryLineStep;

  let middleH = 6 + primaryBlockH; // after cut + ticketCount + primary
  if (options.secondaryLabel) middleH += 4.2 + 3.2; // gap to seats + seat line
  if (options.tertiaryLabel) middleH += 3.8;
  if (options.showQr && qrDataUrl) middleH += 5 + 32 + 2; // gap + QR + pad
  else middleH += 2;
  middleH += 4.5 + 4.5; // booking ID + spacing
  if (options.cancellationNote) middleH += 7 + 4.5; // banner + spacing
  middleH += 4.5 + 3.8 + 2; // contact support row (with telephone icon) + spacing

  let bottomH = 5.5;
  const hasAmount = Boolean(options.totalFormatted || options.amountRows?.length);
  if (hasAmount) {
    if (options.totalFormatted) bottomH += 5;
    if (options.totalNote) bottomH += 4;
    if (options.amountRows?.length) {
      for (const row of options.amountRows) {
        bottomH += row.labelDetail ? 7.6 : 4.5;
      }
    }
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
      doc.setFillColor(243, 243, 243);
      doc.roundedRect(cardX + pad, curY, posterW, posterH, 1.5, 1.5, "F");
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

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(17, 17, 17);
  const titleLines = doc.splitTextToSize(options.title || "Booking", textMaxW);
  doc.text(titleLines, textLeft, curY + 4.5);
  let detailY = curY + 4.5 + titleLines.length * 4.2;

  // Category / formatMeta (e.g. "English, 2D") matching on-screen UI
  if (options.categoryLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(119, 119, 119);
    doc.text(options.categoryLabel, textLeft, detailY, { maxWidth: textMaxW });
    detailY += 4.2;
  }

  // Date & Time (e.g. "Wed, 25 Nov | 8:00 AM")
  if (options.whenLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(102, 102, 102);
    doc.text(options.whenLine, textLeft, detailY, { maxWidth: textMaxW });
    detailY += 4.2;
  }

  // Venue & Address
  if (options.venueLine) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(119, 119, 119);
    const venueLines = doc.splitTextToSize(options.venueLine, textMaxW);
    doc.text(venueLines, textLeft, detailY);
    detailY += venueLines.length * 3.3 + 1;
  }

  // Offer badge if any
  if (options.offerLabel) {
    detailY += 1.5;
    const badgeW = Math.min(36, doc.getTextWidth(options.offerLabel) + 4);
    doc.setFillColor(17, 17, 17);
    doc.roundedRect(textLeft, detailY - 3, badgeW, 4.2, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.8);
    doc.text(options.offerLabel, textLeft + 2, detailY - 0.2, { maxWidth: badgeW - 4 });
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
  curY += 6;

  // Ticket count
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(136, 136, 136);
  doc.text(options.ticketCountLabel || "1 Ticket", centerX, curY, { align: "center" });

  // Primary label (stand / screen) — scale & wrap for long names
  curY += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(primaryFontSize);
  doc.setTextColor(17, 17, 17);
  const primaryWrapped = doc.splitTextToSize(primaryText.toUpperCase(), primaryMaxW);
  doc.text(primaryWrapped, centerX, curY, { align: "center", lineHeightFactor: 1.15 });
  if (primaryWrapped.length > 1) {
    curY += (primaryWrapped.length - 1) * primaryLineStep;
  }

  // Seats — even gap under stand (not cramped)
  if (options.secondaryLabel) {
    curY += 4.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(68, 68, 68);
    doc.text(options.secondaryLabel, centerX, curY, { align: "center" });
  }

  if (options.tertiaryLabel) {
    curY += 3.8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(85, 85, 85);
    doc.text(options.tertiaryLabel, centerX, curY, { align: "center" });
  }

  // QR Code (For Movies & Events, omitted for Dining)
  if (options.showQr && qrDataUrl) {
    curY += 5;
    const qrSize = 32;
    doc.addImage(qrDataUrl, "PNG", centerX - qrSize / 2, curY, qrSize, qrSize);
    curY += qrSize + 2;
  } else {
    curY += 2;
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

  // Contact support row (matching on-screen UI with phone glyph + "Contact support")
  curY += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(51, 51, 51);
  doc.text("Contact support", centerX, curY, { align: "center" });

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
    curY += options.totalNote ? 3.6 : 5;
    if (options.totalNote) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(119, 119, 119);
      const noteLines = doc.splitTextToSize(options.totalNote, cardW - pad * 2 - 28);
      doc.text(noteLines, cardX + pad, curY);
      curY += Math.max(1, noteLines.length) * 3.2 + 2;
    }
  }

  if (options.amountRows?.length) {
    for (const row of options.amountRows) {
      doc.setFont("helvetica", row.strong ? "bold" : "normal");
      doc.setFontSize(7.2);
      doc.setTextColor(row.strong ? 17 : 102, row.strong ? 17 : 102, row.strong ? 17 : 102);
      doc.text(row.label, cardX + pad, curY);
      doc.text(row.value, cardX + cardW - pad, curY, { align: "right" });
      curY += row.labelDetail ? 3.4 : 4.5;
      if (row.labelDetail) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.2);
        doc.setTextColor(136, 136, 136);
        doc.text(row.labelDetail, cardX + pad, curY);
        curY += 4.2;
      }
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
