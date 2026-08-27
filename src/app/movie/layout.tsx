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
  Clapperboard,
  Film,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorPlay,
  User,
  X,
} from "lucide-react";

function MovieShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const bizId = user?.business_id ?? "";
  const { data: settings } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const cinemaName = settings?.name || "Movie Admin";

  const navigation = [
    { name: "Dashboard", href: "/movie/dashboard", icon: LayoutDashboard },
    { name: "Screens & Layouts", href: "/movie/screens", icon: MonitorPlay },
    { name: "Movies", href: "/movie/movies", icon: Film },
    { name: "Showtimes", href: "/movie/showtimes", icon: Clapperboard },
    { name: "Profile", href: "/movie/profile", icon: User },
    { name: "Change Password", href: "/movie/change-password", icon: KeyRound },
  ];

  const isNavActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const handleLogout = () => {
    clearSessionForRole("movie_admin");
    router.push("/movie");
  };

  return (
    <div className="min-h-screen flex bg-background admin-dashboard-layout">
      <aside className="admin-sidebar w-64 glass-panel border-r border-white/5 fixed inset-y-0 left-0 z-40 hidden md:flex flex-col overflow-hidden">
        <Link
          href="/movie/profile"
          className="p-5 border-b border-white/5 block hover:bg-white/[0.03] transition-colors shrink-0"
          title="Open profile"
        >
          <h2
            className="text-xl font-bold text-white flex items-center gap-2 min-w-0"
            title={cinemaName}
          >
            <span className="bg-fuchsia-600 p-1.5 rounded-lg text-white shrink-0">
              <Film size={20} />
            </span>
            <span className="truncate text-lg font-bold">{cinemaName}</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-2">Profile · Movie Admin</p>
        </Link>
        <nav className="admin-sidebar-nav flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 space-y-1">
          {navigation.map((item) => {
            const isActive = isNavActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent"
                }`}
              >
                <Icon size={16} className="shrink-0" />
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
          <div className="admin-sidebar relative w-64 bg-zinc-950 border-r border-white/10 h-full flex flex-col p-4 overflow-hidden">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <Link
                href="/movie/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="text-lg font-bold text-white flex items-center gap-2 truncate min-w-0"
              >
                <span className="bg-fuchsia-600 p-1.5 rounded-lg text-white shrink-0">
                  <Film size={18} />
                </span>
                <span className="truncate">{cinemaName}</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="admin-sidebar-nav flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-1 pr-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = isNavActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      isActive
                        ? "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white border border-transparent"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
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
              {navigation.find((n) => isNavActive(n.href))?.name || "Movie Admin Panel"}
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </header>
        <div className="p-4 sm:p-8">{children}</div>
      </main>
    </div>
  );
}

export default function MovieLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const isLoginPage = pathname === "/movie/login";
  const isPublicLanding =
    pathname === "/movie" || pathname === "/movie/register" || isLoginPage;
  const isMovieAdmin = user?.role === "movie_admin";

  useEffect(() => {
    if (isLoginPage) {
      setCheckingAuth(false);
      return;
    }

    const movieSession = readSessionForRole("movie_admin");
    if (movieSession) {
      dispatch(setCredentials({ user: movieSession.user, token: movieSession.token }));
    } else {
      dispatch(loadFromStorage());
    }

    if (!movieSession && !isPublicLanding) {
      router.replace("/movie/login");
      return;
    }

    setCheckingAuth(false);
  }, [dispatch, router, isPublicLanding, isLoginPage, pathname]);

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

  if (!isMovieAdmin) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return (
    <SessionGuard>
      <MovieShell>{children}</MovieShell>
    </SessionGuard>
  );
}
