"use client";

import AuthGate from "@/components/Shared/AuthGate";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";

export default function VenueLoginPage() {
  return (
    <AuthGate mode="guest" guestRoles={["venue_admin"]}>
      <PartnerLoginForm
        expectedRole="venue_admin"
        title="Venue Login"
        subtitle="Sign in to manage layouts and claim events"
        hint={
          <span>
            Need access? Ask Super Admin to onboard your venue partner account.
          </span>
        }
      />
    </AuthGate>
  );
}
