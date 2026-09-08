"use client";

import ChangePasswordForm from "@/components/Shared/ChangePasswordForm";

export default function ArtistChangePasswordPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="org-section-label mb-2">Account</p>
        <h2 className="font-display text-2xl font-bold text-foreground tracking-tight">Change password</h2>
        <p className="text-sm text-muted-foreground mt-1.5">Update the password for your artist partner login.</p>
      </div>
      <div className="org-card p-5 sm:p-6">
        <ChangePasswordForm variant="portal" />
      </div>
    </div>
  );
}
