"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";
import { homePathForRole, readSessionForRole } from "@/lib/authStorage";
import images from "@/Images";

const logoSrc = typeof images.logo === "string" ? images.logo : images.logo.src;

export default function BusinessLandingPage() {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (!loginOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLoginOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [loginOpen]);

  const openLogin = () => {
    const session = readSessionForRole("business_admin");
    if (session) {
      router.push(homePathForRole("business_admin"));
      return;
    }
    setLoginOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center min-h-20 py-2">
            <Link href="/" className="flex items-center gap-2 group">
              <img
                src={logoSrc}
                alt="Book My Bota"
                className="h-15 xl:h-20 pt-2 w-auto object-contain object-left group-hover:opacity-90 transition-opacity"
              />
            </Link>
            <button
              type="button"
              onClick={openLogin}
              className="px-5 py-2 rounded-full border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 hover:text-slate-900 transition-all text-sm cursor-pointer"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      <div
        className="relative flex items-center justify-center flex-1 min-h-screen pt-28"
        style={{ background: "linear-gradient(135deg, #18181b 0%, #27272a 50%, #09090b 100%)" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&q=80)" }}
        />
        <div className="absolute inset-0 bg-black/40" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center flex flex-col items-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6 text-white">
            Partner with Book My Bota <br />
            and grow your business
          </h1>

          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-8 backdrop-blur-md">
            <span className="w-5 h-5 rounded-full bg-[#6900AA] text-white text-xs font-bold flex items-center justify-center">
              %
            </span>
            <span className="text-xs font-medium text-white">
              0% commission for 1st month! Only valid for new restaurant partners
            </span>
          </div>

          <Link
            href="/business/register"
            className="bg-[#6900AA] hover:bg-[#57008E] text-white font-bold px-8 py-4 rounded-xl text-base shadow-xl hover:scale-105 active:scale-95 transition-all duration-300"
          >
            Register your Business
          </Link>
        </div>
      </div>

      {loginOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
          onClick={() => setLoginOpen(false)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-login-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLoginOpen(false)}
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              aria-label="Close login"
            >
              <X size={18} />
            </button>
            <PartnerLoginForm
              variant="embedded"
              expectedRole="business_admin"
              title="Dining Admin Login"
              titleId="partner-login-title"
              subtitle="Sign in to manage your restaurant"
              showCustomerLink={false}
              hint={
                <p className="text-[10px] text-slate-400">
                  Dining admins: name@bookmybota.com / Admin@123
                </p>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
