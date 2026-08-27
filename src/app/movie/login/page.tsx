"use client";

import AuthGate from "@/components/Shared/AuthGate";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";

export default function MovieLoginPage() {
  return (
    <AuthGate mode="guest" guestRoles={["movie_admin"]}>
      <PartnerLoginForm
        expectedRole="movie_admin"
        title="Movie Admin Login"
        subtitle="Sign in to manage your cinema listings"
        hint={
          <span>
            Need access?{" "}
            <a href="/movie/register" className="text-violet-700 font-semibold hover:underline">
              Register your cinema
            </a>{" "}
            or ask Super Admin to approve your account.
          </span>
        }
      />
    </AuthGate>
  );
}
