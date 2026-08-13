"use client";

import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";

export default function BusinessLandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
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

      <div
        className="relative flex items-center justify-center flex-1 min-h-screen pt-20"
        style={{ background: "linear-gradient(135deg, #18181b 0%, #27272a 50%, #09090b 100%)" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&q=80)" }}
        />
        <div className="absolute inset-0 bg-black/40" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center flex flex-col items-center">
          <h1
            className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6"
            style={{ color: "#ffffff" }}
          >
            Partner with Book My Bota <br />
            and grow your business
          </h1>

          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-8 backdrop-blur-md">
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
              %
            </span>
            <span className="text-xs font-medium" style={{ color: "#ffffff" }}>
              0% commission for 1st month! Only valid for new restaurant partners
            </span>
          </div>

          <Link
            href="/business/register"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-xl text-base shadow-xl hover:scale-105 active:scale-95 transition-all duration-300"
          >
            Register your Business
          </Link>
        </div>
      </div>
    </div>
  );
}
