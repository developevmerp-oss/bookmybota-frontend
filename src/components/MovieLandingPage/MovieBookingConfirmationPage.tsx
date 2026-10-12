"use client";

/**
 * Movie booking confirmation — swap UI by changing CONFIRMATION_UI_VERSION
 * in `@/components/Shared/Confirmation/confirmationUiVersion`
 * or by commenting/uncommenting the imports below.
 *
 * UI1 = BMS-style ticket + rating
 * UI2 = classic confirmation (dining/event-style layout)
 */
import ConfirmationPageUI1 from "@/components/Shared/Confirmation/ConfirmationPageUI1";
import ConfirmationPageUI2 from "@/components/Shared/Confirmation/ConfirmationPageUI2";
import { CONFIRMATION_UI_VERSION } from "@/components/Shared/Confirmation/confirmationUiVersion";

interface MovieBookingConfirmationPageProps {
  bookingId: string;
}

export default function MovieBookingConfirmationPage({
  bookingId,
}: MovieBookingConfirmationPageProps) {
  // --- comment / uncomment to force a UI (overrides version file) ---
  // return <ConfirmationPageUI1 bookingId={bookingId} />;
  // return <ConfirmationPageUI2 bookingId={bookingId} />;

  if (CONFIRMATION_UI_VERSION === 2) {
    return <ConfirmationPageUI2 bookingId={bookingId} />;
  }
  return <ConfirmationPageUI1 bookingId={bookingId} />;
}
