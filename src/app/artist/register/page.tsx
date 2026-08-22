"use client";

import Link from "next/link";
import { Mic2 } from "lucide-react";
import PartnerOnboardForm from "@/components/DiningAdminPanel/PartnerOnboardForm";

export default function ArtistRegisterPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="bg-[#6900AA] p-2 rounded-lg group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(105,0,170,0.35)]">
                <Mic2 size={24} className="text-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight">
                <span className="text-[#111111]">Book My </span>
                <span className="text-[#6900AA]">Bota</span>
              </span>
            </Link>
            <div className="flex gap-4 items-center">
              <Link
                href="/artist/login"
                className="px-5 py-2 rounded-full border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 hover:text-slate-900 transition-all text-sm"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full flex justify-center px-4 pt-28 pb-16">
        <div className="w-full max-w-[680px]">
          <PartnerOnboardForm
            partnerType="artist"
            variant="light"
            mode="create"
            backHref="/artist/login"
            title="Register as Artist"
            subtitle="Create your artist profile. A temporary password is auto-generated; login details are emailed after Super Admin approval."
            successDetail="Your account is disabled until a Super Admin enables it. You will not be able to log in until then. Redirecting…"
          />
        </div>
      </main>
    </div>
  );
}
