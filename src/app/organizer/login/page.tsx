"use client";

import AuthGate from "@/components/Shared/AuthGate";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";

export default function OrganizerLoginPage() {
  return (
    <AuthGate mode="guest" guestRoles={["event_admin"]}>
      <PartnerLoginForm
        expectedRole="event_admin"
        title="Event Login"
        subtitle="Sign in to create and manage your events"
        showCustomerLink={false}
        registerHref="/organizer/register"
        registerPrompt="New organizer?"
        registerLinkText="Register here"
        sideImageSrc="/login/panel-event.jpg"
      />
    </AuthGate>
  );
}
