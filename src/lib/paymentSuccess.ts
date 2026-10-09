export type BookingPaymentModule = "movies" | "events" | "dining";

type PaymentSuccessOpts = {
  module: BookingPaymentModule;
  /** Absolute path to confirmation / booking details (must start with `/`). */
  next: string;
  bookingId?: string;
};

const MODULE_COPY: Record<
  BookingPaymentModule,
  { eyebrow: string; title: string; subtitle: string; nextLabel: string }
> = {
  movies: {
    eyebrow: "Movie booking",
    title: "Booking successful",
    subtitle: "Your seats are reserved. Continue to view your M-Ticket and booking details.",
    nextLabel: "View M-Ticket",
  },
  events: {
    eyebrow: "Event booking",
    title: "Booking successful",
    subtitle: "Your tickets are confirmed. Continue to view your booking and QR code.",
    nextLabel: "View tickets",
  },
  dining: {
    eyebrow: "Table booking",
    title: "Booking successful",
    subtitle: "Your table is confirmed. Continue to view your booking details.",
    nextLabel: "View booking",
  },
};

/** Build intermediate success URL shown after booking, before confirmation. */
export function paymentSuccessHref(opts: PaymentSuccessOpts): string {
  const params = new URLSearchParams();
  params.set("module", opts.module);
  params.set("next", opts.next);
  if (opts.bookingId) params.set("id", opts.bookingId);
  return `/booking/payment-success?${params.toString()}`;
}

export function paymentSuccessCopy(module: string | null | undefined) {
  if (module === "movies" || module === "events" || module === "dining") {
    return MODULE_COPY[module];
  }
  return {
    eyebrow: "Booking",
    title: "Booking successful",
    subtitle: "Your booking is confirmed. Continue to view the details.",
    nextLabel: "Continue",
  };
}

/** Only allow same-origin relative paths for the Next button. */
export function sanitizePaymentSuccessNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    /* keep raw */
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
  if (decoded.includes("://")) return null;
  return decoded;
}
