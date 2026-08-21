"use client";

import AuthGate from "@/components/Shared/AuthGate";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";

export default function BusinessLoginPage() {
  return (
    <AuthGate mode="guest" guestRoles={["business_admin"]}>
      <PartnerLoginForm
        expectedRole="business_admin"
        title="Dining Admin Login"
        subtitle="Sign in to manage your restaurant"
        hint={
          <p className="text-[10px] text-slate-400">
            Dining admins: name@bookmybota.com / Admin@123
          </p>
        }
      />
    </AuthGate>
  );
}
