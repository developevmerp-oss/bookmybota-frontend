"use client";

import AuthGate from "@/components/Shared/AuthGate";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";

export default function VenueLoginPage() {
  return (
    <AuthGate mode="guest" guestRoles={["venue_admin"]}>
      <PartnerLoginForm
        expectedRole="venue_admin"
        title="Venue Login"
        subtitle="Sign in to manage your venue and bookings"
        showCustomerLink={false}
        registerHref="/venue/register"
        registerPrompt="Haven't registered your venue yet?"
        registerLinkText="Register here"
        sideImageSrc="/login/panel-venue.jpg"
      />
    </AuthGate>
  );
}
