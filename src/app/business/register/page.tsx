"use client";

import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import PartnerOnboardForm from "@/components/PartnerOnboardForm";

export default function BusinessRegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="bg-rose-600 p-2 rounded-lg group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(225,29,72,0.5)]">
                <UtensilsCrossed size={24} className="text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-800">Book My Bota</span>
            </Link>
            <div className="flex gap-4 items-center">
              <Link
                href="/login"
                className="px-5 py-2 rounded-full border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 hover:text-slate-900 transition-all text-sm"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-28 pb-16">
        <PartnerOnboardForm
          partnerType="combined"
          variant="light"
          mode="create"
          backHref="/business"
          title="Register Business"
          subtitle="Create your business profile. A temporary password is auto-generated; login details are emailed after Super Admin approval."
          successDetail="Your account is disabled until a Super Admin enables it. You will not be able to log in until then. Redirecting…"
        />
      </main>
    </div>
  );
}
