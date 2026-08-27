"use client";

import PartnerOnboardForm from "@/components/DiningAdminPanel/PartnerOnboardForm";

export default function BusinessRegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <main className="w-full flex justify-center px-4 pt-8 sm:pt-10 pb-16">
        <div className="w-full max-w-[680px]">
          <PartnerOnboardForm
            partnerType="combined"
            variant="light"
            mode="create"
            backHref="/business"
            title="Register Business"
            subtitle="Create your business profile. A temporary password is auto-generated; login details are emailed after Super Admin approval."
            successDetail="Your account is disabled until a Super Admin enables it. You will not be able to log in until then. Redirecting…"
          />
        </div>
      </main>
    </div>
  );
}
