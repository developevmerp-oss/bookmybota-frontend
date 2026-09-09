"use client";

import AuthGate from "@/components/Shared/AuthGate";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";

export default function MovieLoginPage() {
  return (
    <AuthGate mode="guest" guestRoles={["movie_admin"]}>
      <PartnerLoginForm
        expectedRole="movie_admin"
        title="Movie Login"
        subtitle="Sign in to manage your cinema listings"
        showCustomerLink={false}
        registerHref="/movie/register"
        registerPrompt="New cinema partner?"
        registerLinkText="Register here"
        sideImageSrc="/login/panel-movie.png"
      />
    </AuthGate>
  );
}
