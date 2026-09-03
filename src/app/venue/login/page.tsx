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
        showCustomerLink={false}
        registerHref="/venue/register"
        registerPrompt="Haven't registered your venue yet?"
        registerLinkText="Register here"
        hint={
          <span className="text-sm text-slate-500">
            Already registered? Sign in with the email and password sent by Super Admin.
          </span>
        }
      />
    </AuthGate>
  );
}
