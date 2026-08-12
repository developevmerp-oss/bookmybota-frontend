"use client";

import ChangePasswordForm from "@/components/ChangePasswordForm";

export default function AdminChangePasswordPage() {
  return (
    <div className="max-w-lg mx-auto">
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        <ChangePasswordForm variant="portal" />
      </div>
    </div>
  );
}
