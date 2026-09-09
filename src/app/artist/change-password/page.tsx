"use client";

import ChangePasswordForm from "@/components/Shared/ChangePasswordForm";

export default function ArtistChangePasswordPage() {
  return (
    <div className="w-full max-w-[1600px] mx-auto">
      <div className="org-card p-4 sm:p-6 max-w-xl">
        <ChangePasswordForm variant="portal" />
      </div>
    </div>
  );
}
