"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import AuthGate from "@/components/Shared/AuthGate";
import { clearSessionForRole } from "@/lib/authStorage";
import { KeyRound, LogOut, Menu, Mic2, User, X } from "lucide-react";

export default function ArtistLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (pathname === "/artist/login" || pathname === "/artist/register") {
    return <>{children}</>;
  }

  const navigation = [
    { name: "Profile", href: "/artist/profile", icon: User },
    { name: "Change Password", href: "/artist/change-password", icon: KeyRound },
  ];

  const isNavActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <AuthGate mode="require" roles={["artist_admin"]}>
      <div className="min-h-screen flex bg-background admin-dashboard-layout">
        <aside className="w-64 glass-panel border-r border-white/5 fixed h-full z-40 hidden md:flex flex-col">
          <div className="p-6 border-b border-white/5">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="bg-violet-600 p-1.5 rounded-lg text-white">
                <Mic2 size={20} />
              </span>
              Artist Admin
            </h2>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = isNavActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    isActive
                      ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  <span className="font-medium text-sm">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
            <div className="relative w-64 bg-zinc-950 border-r border-white/10 h-full flex flex-col p-6">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-bold text-white">Artist Admin</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
                >
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = isNavActive(item.href);
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                        isActive
                          ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                          : "text-zinc-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon size={18} />
                      <span className="font-medium text-sm">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        <main className="flex-1 md:ml-64 relative">
          <header className="h-20 glass-panel border-b border-white/5 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <Menu size={24} />
              </button>
              <h1 className="text-lg sm:text-xl font-semibold text-white truncate">
                {navigation.find((n) => isNavActive(n.href))?.name || "Artist Panel"}
              </h1>
            </div>
            <button
              onClick={() => {
                clearSessionForRole("artist_admin");
                router.push("/artist/login");
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 hover:text-violet-600 hover:bg-violet-50 border border-slate-200 transition-all"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </header>
          <div className="p-4 sm:p-8">{children}</div>
        </main>
      </div>
    </AuthGate>
  );
}
