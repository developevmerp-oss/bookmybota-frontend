"use client";

import AuthGate from "@/components/Shared/AuthGate";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";

export default function ArtistLoginPage() {
  return (
    <AuthGate mode="guest" guestRoles={["artist_admin"]}>
      <PartnerLoginForm
        expectedRole="artist_admin"
        title="Artist Admin Login"
        subtitle="Sign in to manage your artist profile"
        showCustomerLink={false}
        registerHref="/artist/register"
        registerPrompt="New artist?"
        registerLinkText="Register here"
        sideImageSrc="/login/panel-artist.png"
        sideImageLabel="Artist portal"
        sideImageCaption="Update your profile, mark free dates, and respond to booking inquiries in one place."
      />
    </AuthGate>
  );
}
