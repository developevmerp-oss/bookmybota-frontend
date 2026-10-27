"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import PaymentSuccessView from "@/components/Shared/PaymentSuccessView";
import { ConfirmationPageUI1Shimmer } from "@/components/Shared/Shimmer";
import {
  paymentSuccessCopy,
  sanitizePaymentSuccessNext,
  type BookingPaymentModule,
} from "@/lib/paymentSuccess";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const moduleParam = searchParams.get("module");
  const bookingId = searchParams.get("id");
  const nextRaw = searchParams.get("next");

  const nextHref = useMemo(() => {
    const safe = sanitizePaymentSuccessNext(nextRaw);
    if (safe) return safe;
    if (moduleParam === "movies" && bookingId) {
      return `/movies/booking-confirmation/${bookingId}`;
    }
    if (moduleParam === "events" && bookingId) {
      return `/customer/event-bookings/confirmation?id=${bookingId}`;
    }
    if (moduleParam === "dining" && bookingId) {
      return `/customer/bookings/confirmation?id=${bookingId}`;
    }
    return "/";
  }, [nextRaw, moduleParam, bookingId]);

  const copy = paymentSuccessCopy(moduleParam);

  return (
    <PaymentSuccessView
      module={moduleParam as BookingPaymentModule | null}
      bookingId={bookingId}
      nextHref={nextHref}
      title={copy.title}
      subtitle={copy.subtitle}
      nextLabel={copy.nextLabel}
    />
  );
}

export default function BookingPaymentSuccessPage() {
  return (
    <Suspense
      fallback={<ConfirmationPageUI1Shimmer />}
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
