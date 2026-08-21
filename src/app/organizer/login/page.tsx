"use client";

import AuthGate from "@/components/Shared/AuthGate";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";

export default function OrganizerLoginPage() {
  return (
    <AuthGate mode="guest" guestRoles={["event_admin"]}>
      <PartnerLoginForm
        expectedRole="event_admin"
        title="Event Organizer Login"
        subtitle="Sign in to manage your events"
      />
    </AuthGate>
  );
}
