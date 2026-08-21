"use client";

import ChangePasswordForm from "@/components/Shared/ChangePasswordForm";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";

export default function CustomerChangePasswordPage() {
  return (
    <CustomerAccountLayout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-lg">
        <ChangePasswordForm variant="light" />
      </div>
    </CustomerAccountLayout>
  );
}
