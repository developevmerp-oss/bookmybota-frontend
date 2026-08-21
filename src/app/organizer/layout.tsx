"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "@/lib/hooks";
import { useGetBusinessSettingsQuery } from "@/services/api";
import AuthGate from "@/components/Shared/AuthGate";
import SessionGuard from "@/components/Shared/SessionGuard";
import { clearSessionForRole } from "@/lib/authStorage";
import {
  LayoutDashboard,
  BarChart3,
  CalendarDays,
  LogOut,
  Menu,
  X,
  CalendarCheck,
  Star,
  Tag,
  Wallet,
  User,
} from "lucide-react";

function OrganizerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const bizId = user?.business_id ?? "";
  const { data: settings } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const organizerName = settings?.name || "Event Organizer";

  const navigation = [
    { name: "Dashboard", href: "/organizer", icon: LayoutDashboard },
    { name: "My Events", href: "/organizer/events", icon: CalendarDays },
    { name: "Bookings", href: "/organizer/bookings", icon: CalendarCheck },
    { name: "Ticket Stats", href: "/organizer/tickets", icon: BarChart3 },
    { name: "Offers", href: "/organizer/offers", icon: Tag },
    { name: "Reviews", href: "/organizer/reviews", icon: Star },
    { name: "Ledger", href: "/organizer/ledger", icon: Wallet },
  ];

  const isNavActive = (href: string) => {
    if (href === "/organizer") return pathname === "/organizer";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = () => {
    clearSessionForRole("event_admin");
    router.push("/organizer/login");
  };

  return (
    <div className="min-h-screen flex bg-background admin-dashboard-layout">
      <aside className="w-64 glass-panel border-r border-white/5 fixed h-full z-40 hidden md:flex flex-col">
        <Link
          href="/organizer/profile"
          className="p-6 border-b border-white/5 block hover:bg-white/[0.03] transition-colors"
          title="Open profile"
        >
          <h2
            className="text-xl font-bold text-white flex items-center gap-2 min-w-0"
            title={organizerName}
          >
            <span className="bg-violet-600 p-1.5 rounded-lg text-white shrink-0">
              <User size={20} />
            </span>
            <span className="truncate text-lg font-bold">{organizerName}</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-2">Profile · Event Organizer</p>
        </Link>
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = isNavActive(item.href);
            const Icon = item.icon;
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
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="relative w-64 bg-zinc-950 border-r border-white/10 h-full flex flex-col p-6">
            <div className="flex items-center justify-between mb-8">
              <Link
                href="/organizer/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-bold text-white flex items-center gap-2 truncate min-w-0"
              >
                <span className="bg-violet-600 p-1.5 rounded-lg text-white shrink-0">
                  <User size={18} />
                </span>
                <span className="truncate">{organizerName}</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-2">
              {navigation.map((item) => {
                const isActive = isNavActive(item.href);
                const Icon = item.icon;
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
            <Link
              href="/organizer/profile"
              className={`flex items-center gap-2 max-w-[220px] px-2.5 py-1.5 rounded-xl border transition-colors shrink-0 ${
                pathname.startsWith("/organizer/profile") ||
                pathname.startsWith("/organizer/change-password")
                  ? "bg-violet-500/10 text-violet-300 border-violet-500/20"
                  : "text-zinc-300 border-white/10 hover:bg-white/5 hover:text-white"
              }`}
              title="Profile & password"
            >
              <span className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                {(organizerName || user?.email || "O").charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 text-left hidden sm:block">
                <span className="block text-sm font-medium truncate">{organizerName}</span>
                <span className="block text-[11px] text-zinc-500 truncate">{user?.email}</span>
              </span>
            </Link>
            <h1 className="text-lg sm:text-xl font-semibold text-white truncate">
              {pathname.startsWith("/organizer/profile")
                ? "Profile"
                : pathname.startsWith("/organizer/change-password")
                  ? "Profile"
                  : navigation.find((n) => isNavActive(n.href))?.name || "Organizer Panel"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all cursor-pointer"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-8">{children}</div>
      </main>
    </div>
  );
}

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/organizer/login") {
    return <>{children}</>;
  }

  return (
    <AuthGate mode="require" roles={["event_admin"]}>
      <SessionGuard>
        <OrganizerShell>{children}</OrganizerShell>
      </SessionGuard>
    </AuthGate>
  );
}
