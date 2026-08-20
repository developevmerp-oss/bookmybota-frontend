"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage, setCredentials } from "@/features/auth/authSlice";
import { useGetBusinessSettingsQuery } from "@/services/api";
import SessionGuard from "@/components/Shared/SessionGuard";
import { clearSessionForRole, readSessionForRole } from "@/lib/authStorage";
import {
  LayoutDashboard,
  CalendarCheck,
  LayoutGrid,
  Clock,
  Settings,
  LogOut,
  Menu,
  X,
  Star,
  Megaphone,
  KeyRound,
  QrCode,
} from "lucide-react";

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const bizId = user?.business_id ?? "";
  const { data: settings } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const businessName = settings?.name || "Venue Admin";

  const isLoginPage = pathname === "/business/login";
  const isPublicLanding =
    pathname === "/business" || pathname === "/business/register" || isLoginPage;
  const isBusinessAdmin = user?.role === "business_admin";

  useEffect(() => {
    if (isLoginPage) {
      setCheckingAuth(false);
      return;
    }

    const dining = readSessionForRole("business_admin");
    if (dining) {
      dispatch(setCredentials({ user: dining.user, token: dining.token }));
    } else {
      dispatch(loadFromStorage());
    }

    if (!dining && !isPublicLanding) {
      router.replace("/business/login");
      return;
    }

    setCheckingAuth(false);
  }, [dispatch, router, isPublicLanding, isLoginPage, pathname]);

  const navigation = [
    { name: "Global Settings", href: "/business", icon: LayoutDashboard },
    { name: "Bookings Manager", href: "/business/bookings", icon: CalendarCheck },
    { name: "Scan guest QR", href: "/business/scan", icon: QrCode },
    { name: "Table Management", href: "/business/tables", icon: LayoutGrid },
    { name: "Analytics", href: "/business/analytics", icon: Clock },
    { name: "Profile Editor", href: "/business/profile", icon: Settings },
    { name: "Reviews", href: "/business/reviews", icon: Star },
    { name: "Promotions", href: "/business/promotions", icon: Megaphone },
    { name: "Change Password", href: "/business/change-password", icon: KeyRound },
  ];

  const handleLogout = () => {
    clearSessionForRole("business_admin");
    router.push("/business/login");
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">
        Loading...
      </div>
    );
  }

  if (!isBusinessAdmin) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <SessionGuard>
    <div className="min-h-screen flex bg-background admin-dashboard-layout">
      <aside className="w-64 glass-panel border-r border-white/5 fixed h-full z-40 hidden md:flex flex-col">
        <div className="p-6 border-b border-white/5">
          <h2
            className="text-xl font-bold text-white flex items-center gap-2 min-w-0"
            title={businessName}
          >
            <span className="bg-rose-600 p-1.5 rounded-lg text-white shrink-0">
              <Settings size={20} />
            </span>
            <span className="truncate text-lg font-bold">{businessName}</span>
          </h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive
                    ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
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
          <div className="relative w-64 bg-zinc-950 border-r border-white/10 h-full flex flex-col p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-8">
              <h2
                className="text-lg font-bold text-white flex items-center gap-2 truncate"
                title={businessName}
              >
                <span className="bg-rose-600 p-1.5 rounded-lg text-white shrink-0">
                  <Settings size={18} />
                </span>
                <span className="truncate">{businessName}</span>
              </h2>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      isActive
                        ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
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
              className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg sm:text-xl font-semibold text-white truncate">
              {navigation.find((n) => n.href === pathname)?.name || "Business Panel"}
            </h1>
          </div>
          <div className="flex items-center gap-4">
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
    </SessionGuard>
  );
}
