"use client";

import AuthGate from "@/components/Shared/AuthGate";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";

export default function AdminLoginPage() {
  return (
    <AuthGate mode="guest" guestRoles={["super_admin"]}>
      <PartnerLoginForm
        expectedRole="super_admin"
        title="Super Admin Login"
        subtitle="Sign in with your admin credentials"
        hint={
          <>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
              Super Admin Default
            </p>
            <p className="text-xs text-slate-600 font-mono">admin@reserve.com / Admin@123</p>
          </>
        }
      />
    </AuthGate>
  );
}
