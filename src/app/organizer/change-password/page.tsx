"use client";

import ChangePasswordForm from "@/components/Shared/ChangePasswordForm";

export default function OrganizerChangePasswordPage() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="glass-panel rounded-2xl p-6">
        <ChangePasswordForm variant="portal" />
      </div>
    </div>
  );
}
