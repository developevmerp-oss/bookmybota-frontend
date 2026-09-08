"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage, setCredentials } from "@/features/auth/authSlice";
import { useGetBusinessSettingsQuery } from "@/services/api";
import SessionGuard from "@/components/Shared/SessionGuard";
import { clearSessionForRole, readSessionForRole } from "@/lib/authStorage";
import {
  LayoutDashboard,
  BarChart3,
  CalendarDays,
  LogOut,
  Menu,
  X,
  CalendarCheck,
  Tag,
  Wallet,
  QrCode,
  Megaphone,
  ChevronDown,
  LayoutGrid,
  CheckCircle2,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/organizer", icon: LayoutDashboard },
  { name: "My Events", href: "/organizer/events", icon: CalendarDays },
  { name: "Bookings", href: "/organizer/bookings", icon: CalendarCheck },
  { name: "Scan Tickets", href: "/organizer/scan", icon: QrCode },
  { name: "Ticket Stats", href: "/organizer/tickets", icon: BarChart3 },
  { name: "Offers", href: "/organizer/offers", icon: Tag },
  { name: "Promotions", href: "/organizer/promotions", icon: Megaphone },
  { name: "Ledger", href: "/organizer/ledger", icon: Wallet },
];

function OrganizerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const bizId = user?.business_id ?? "";
  const { data: settings } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const organizerName = settings?.name || "Event Organizer";
  const displayName =
    user?.name?.trim() ||
    user?.email?.split("@")[0] ||
    organizerName;
  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (displayName.slice(0, 2) || "OR").toUpperCase();
  }, [displayName]);

  const pageTitle = useMemo(() => {
    if (pathname.startsWith("/organizer/profile") || pathname.startsWith("/organizer/change-password")) {
      return "Profile";
    }
    const match = navigation.find((n) =>
      n.href === "/organizer" ? pathname === "/organizer" : pathname === n.href || pathname.startsWith(`${n.href}/`)
    );
    return match?.name || "Organizer Panel";
  }, [pathname]);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const isNavActive = (href: string) => {
    if (href === "/organizer") return pathname === "/organizer";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = () => {
    clearSessionForRole("event_admin");
    router.push("/");
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="admin-sidebar-nav flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-0.5">
      <p className="px-3 pt-2 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Workspace
      </p>
      {navigation.map((item) => {
        const isActive = isNavActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            className={`org-nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-sm font-medium ${
              isActive ? "is-active" : ""
            }`}
          >
            <Icon size={16} className="shrink-0" strokeWidth={isActive ? 2.25 : 2} />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-background admin-dashboard-layout organizer-shell">
      <aside className="admin-sidebar w-64 fixed inset-y-0 left-0 z-40 hidden md:flex flex-col overflow-hidden">
        <Link
          href="/organizer/profile"
          className="p-4 border-b border-[var(--sidebar-border)] block hover:bg-muted/60 transition-colors shrink-0"
          title="Open profile"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
              {initials.charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground" title={organizerName}>
                {organizerName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Event organizer</p>
            </div>
          </div>
        </Link>

        <NavLinks />

        <div className="p-3 border-t border-[var(--sidebar-border)] shrink-0">
          <div className="rounded-xl border border-[var(--sidebar-border)] bg-muted/40 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                All account details are complete. You&apos;re ready to publish.
              </p>
            </div>
            <div className="h-1.5 rounded-full bg-success/20 overflow-hidden">
              <div className="h-full w-full rounded-full bg-success" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-success">Organizer health</p>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-[oklch(0.18_0.02_260_/_0.35)] backdrop-blur-sm"
          />
          <div className="admin-sidebar relative w-72 bg-card border-r border-border h-full flex flex-col overflow-hidden shadow-card">
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                  {initials.charAt(0)}
                </span>
                <span className="truncate font-bold text-sm">{organizerName}</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
              >
                <X size={20} />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 md:ml-64 relative min-w-0">
        <header className="h-16 sm:h-[4.5rem] glass-panel border-b border-border flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-semibold text-foreground truncate">
                {pageTitle}
              </h1>
              <p className="text-xs text-muted-foreground truncate hidden sm:block">{todayLabel}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/organizer"
              className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Dashboard"
            >
              <LayoutGrid size={16} />
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 py-1.5 hover:bg-muted/60 transition-colors"
              >
                <span className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                  {initials}
                </span>
                <span className="hidden sm:block text-left min-w-0">
                  <span className="block text-sm font-semibold text-foreground truncate max-w-[140px]">
                    {displayName}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">Organizer</span>
                </span>
                <ChevronDown size={14} className="text-muted-foreground shrink-0" />
              </button>

              {profileOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    aria-label="Close profile menu"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-card shadow-card z-50 py-1 overflow-hidden">
                    <Link
                      href="/organizer/profile"
                      onClick={() => setProfileOpen(false)}
                      className="block px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      Profile
                    </Link>
                    <Link
                      href="/organizer/change-password"
                      onClick={() => setProfileOpen(false)}
                      className="block px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      Change password
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm font-medium text-destructive hover:bg-muted flex items-center gap-2"
                    >
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-8">{children}</div>
      </main>
    </div>
  );
}

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const isLoginPage = pathname === "/organizer/login";
  const isPublicLanding =
    pathname === "/organizer" || pathname === "/organizer/register" || isLoginPage;
  const isEventAdmin = user?.role === "event_admin";

  useEffect(() => {
    if (isLoginPage) {
      setCheckingAuth(false);
      return;
    }

    const organizer = readSessionForRole("event_admin");
    if (organizer) {
      dispatch(setCredentials({ user: organizer.user, token: organizer.token }));
    } else {
      dispatch(loadFromStorage());
    }

    if (!organizer && !isPublicLanding) {
      router.replace("/organizer/login");
      return;
    }

    setCheckingAuth(false);
  }, [dispatch, router, isPublicLanding, isLoginPage, pathname]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground font-medium">
        Loading...
      </div>
    );
  }

  if (!isEventAdmin) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return (
    <SessionGuard>
      <OrganizerShell>{children}</OrganizerShell>
    </SessionGuard>
  );
}
