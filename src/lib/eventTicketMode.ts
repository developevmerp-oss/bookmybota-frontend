export type TicketDeliveryMode = "M_TICKET" | "BOX_OFFICE" | "PHYSICAL_DELIVERY";

export type TicketModeOption = {
  id: TicketDeliveryMode;
  label: string;
  shortLabel: string;
  description: string;
  recommended?: boolean;
};

export const TICKET_MODE_OPTIONS: TicketModeOption[] = [
  {
    id: "M_TICKET",
    label: "M-Ticket",
    shortLabel: "M-Ticket",
    description: "QR on your phone, My Bookings, and email. No physical ticket needed.",
    recommended: true,
  },
  {
    id: "BOX_OFFICE",
    label: "Box office pickup",
    shortLabel: "Box office",
    description: "Collect printed tickets at the venue box office before the show.",
  },
  {
    id: "PHYSICAL_DELIVERY",
    label: "Physical delivery",
    shortLabel: "Delivery",
    description: "Printed tickets couriered to your delivery address.",
  },
];

export function normalizeTicketMode(value?: string | null): TicketDeliveryMode {
  const v = (value || "").trim().toUpperCase();
  if (v === "BOX_OFFICE" || v === "PHYSICAL_DELIVERY") return v;
  return "M_TICKET";
}

const MODE_IDS = new Set<TicketDeliveryMode>(TICKET_MODE_OPTIONS.map((o) => o.id));

/** Event-allowed modes; empty/invalid → all three (legacy events when reading). */
export function normalizeAllowedTicketModes(
  raw?: string[] | null,
  options?: { expandEmpty?: boolean }
): TicketDeliveryMode[] {
  const list = Array.isArray(raw)
    ? raw
        .map((v) => String(v || "").trim().toUpperCase())
        .filter((v): v is TicketDeliveryMode => MODE_IDS.has(v as TicketDeliveryMode))
    : [];
  const unique = [...new Set(list)];
  if (unique.length === 0) {
    return options?.expandEmpty === false ? [] : TICKET_MODE_OPTIONS.map((o) => o.id);
  }
  return TICKET_MODE_OPTIONS.map((o) => o.id).filter((id) => unique.includes(id));
}

export function ticketModeOptionsForEvent(allowed?: string[] | null): TicketModeOption[] {
  const allowedIds = new Set(normalizeAllowedTicketModes(allowed));
  return TICKET_MODE_OPTIONS.filter((o) => allowedIds.has(o.id));
}

/** Prefer M-Ticket when available, else first allowed mode. */
export function defaultTicketModeForEvent(allowed?: string[] | null): TicketDeliveryMode {
  const options = ticketModeOptionsForEvent(allowed);
  return options.find((o) => o.id === "M_TICKET")?.id ?? options[0]?.id ?? "M_TICKET";
}

export function ticketModeLabel(mode?: string | null): string {
  const id = normalizeTicketMode(mode);
  return TICKET_MODE_OPTIONS.find((o) => o.id === id)?.label ?? "M-Ticket";
}

export function ticketModeHeaderTag(mode?: string | null): string {
  const id = normalizeTicketMode(mode);
  if (id === "BOX_OFFICE") return "Box Office";
  if (id === "PHYSICAL_DELIVERY") return "Home Delivery";
  return "M-Ticket";
}

export function ticketModeConfirmNote(mode?: string | null): string {
  const id = normalizeTicketMode(mode);
  if (id === "BOX_OFFICE") {
    return "No online payment required. Collect your tickets at the venue box office using your booking ID.";
  }
  if (id === "PHYSICAL_DELIVERY") {
    return "No online payment required. Printed tickets will be delivered to your address.";
  }
  return "No online payment required. Confirm to receive your M-Ticket instantly.";
}

export type DeliveryAddressFields = {
  delivery_address_line?: string | null;
  delivery_city?: string | null;
  delivery_notes?: string | null;
};

export function formatDeliveryAddress(fields: DeliveryAddressFields): string {
  const parts = [
    fields.delivery_address_line?.trim(),
    fields.delivery_city?.trim(),
    fields.delivery_notes?.trim(),
  ].filter(Boolean);
  return parts.join(", ");
}

export function ticketModeDetailBullets(mode: TicketDeliveryMode): string[] {
  switch (mode) {
    case "BOX_OFFICE":
      return [
        "Collect printed ticket(s) from the venue box office before the event.",
        "Carry your booking ID, a valid photo ID, and the phone number used while booking.",
        "Box office counters usually open 60–90 minutes before showtime.",
        "A confirmation email with pickup details is sent after booking.",
      ];
    case "PHYSICAL_DELIVERY":
      return [
        "Printed ticket(s) are dispatched to the delivery address you provide.",
        "Delivery typically takes 3–5 business days within city limits.",
        "Ensure someone is available to receive the courier at the address.",
        "You can track delivery status from My Bookings once dispatched.",
      ];
    default:
      return [
        "Access ticket(s) anytime from My Bookings on Book My Bota.",
        "Show the Entry QR at the venue gate — it is unique to your booking.",
        "No physical ticket(s) are required. Confirmation is also emailed to you.",
      ];
  }
}

export function ticketModeConfirmationTitle(mode?: string | null): string {
  const id = normalizeTicketMode(mode);
  if (id === "BOX_OFFICE") return "Box office pickup confirmed";
  if (id === "PHYSICAL_DELIVERY") return "Home delivery confirmed";
  return "M-Ticket confirmed";
}

export function ticketModeConfirmationMessage(mode?: string | null): string {
  const id = normalizeTicketMode(mode);
  if (id === "BOX_OFFICE") {
    return "Collect your printed tickets at the venue box office before the show.";
  }
  if (id === "PHYSICAL_DELIVERY") {
    return "Printed tickets will be couriered to your delivery address.";
  }
  return "Your M-Ticket is ready — show the Entry QR at the venue gate.";
}

export function ticketModeDownloadHint(mode?: string | null): string {
  const id = normalizeTicketMode(mode);
  if (id === "BOX_OFFICE") {
    return "Download your booking PDF with pickup details and backup QR.";
  }
  if (id === "PHYSICAL_DELIVERY") {
    return "Download your booking PDF with delivery details and booking reference.";
  }
  return "Save the PDF to your phone so the Entry QR is ready at the gate.";
}
