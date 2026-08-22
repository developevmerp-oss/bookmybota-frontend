"use client";

import Link from "next/link";
import AuthGate from "@/components/Shared/AuthGate";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";

export default function ArtistLoginPage() {
  return (
    <AuthGate mode="guest" guestRoles={["artist_admin"]}>
      <PartnerLoginForm
        expectedRole="artist_admin"
        title="Artist Login"
        subtitle="Sign in to manage your artist profile"
        hint={
          <span>
            New artist?{" "}
            <Link href="/artist/register" className="text-[#6900AA] font-semibold hover:underline">
              Register here
            </Link>
          </span>
        }
      />
    </AuthGate>
  );
}
