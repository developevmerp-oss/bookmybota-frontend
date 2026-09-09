"use client";

import AuthGate from "@/components/Shared/AuthGate";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";

export default function BusinessLoginPage() {
  return (
    <AuthGate mode="guest" guestRoles={["business_admin"]}>
      <PartnerLoginForm
        expectedRole="business_admin"
        title="Dining Login"
        subtitle="Sign in to manage your restaurant"
        showCustomerLink={false}
        registerHref="/business/register"
        registerPrompt="New dining partner?"
        registerLinkText="Register here"
        sideImageSrc="/login/panel-dining.jpg"
      />
    </AuthGate>
  );
}
