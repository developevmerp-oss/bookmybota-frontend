"use client";

import AuthGate from "@/components/Shared/AuthGate";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";

export default function ArtistLoginPage() {
  return (
    <AuthGate mode="guest" guestRoles={["artist_admin"]}>
      <PartnerLoginForm
        expectedRole="artist_admin"
        title="Artist Login"
        subtitle="Sign in to manage your artist profile"
        showCustomerLink={false}
        registerHref="/artist/register"
        registerPrompt="New artist?"
        registerLinkText="Register here"
      />
    </AuthGate>
  );
}
