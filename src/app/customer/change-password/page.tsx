"use client";

import ChangePasswordForm from "@/components/Shared/ChangePasswordForm";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";

export default function CustomerChangePasswordPage() {
  return (
    <CustomerAccountLayout>
      <div className="mb-6">
        <h1 className="text-[32px] leading-tight font-extrabold text-[#111111]">Change Password</h1>
        <p className="text-slate-500 mt-1">Update your account password</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-lg">
        <ChangePasswordForm variant="light" />
      </div>
    </CustomerAccountLayout>
  );
}
