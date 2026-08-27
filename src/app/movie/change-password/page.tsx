"use client";

import ChangePasswordForm from "@/components/Shared/ChangePasswordForm";

export default function MovieChangePasswordPage() {
  return (
    <div className="max-w-2xl mx-auto glass-panel rounded-2xl border border-white/10 p-6">
      <ChangePasswordForm variant="portal" />
    </div>
  );
}
