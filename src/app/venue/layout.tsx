"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage, setCredentials } from "@/features/auth/authSlice";
import { useGetBusinessSettingsQuery } from "@/services/api";
import AuthGate from "@/components/Shared/AuthGate";
import SessionGuard from "@/components/Shared/SessionGuard";
import { clearSessionForRole, readSessionForRole } from "@/lib/authStorage";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Inbox,
  KeyRound,
  LayoutGrid,
  LogOut,
  Menu,
  Ticket,
  User,
  X,
} from "lucide-react";

const navigation = [
  { name: "Profile", href: "/venue/profile", icon: User },
  { name: "Availability", href: "/venue/availability", icon: CalendarDays },
  { name: "Inquiries", href: "/venue/inquiries", icon: Inbox },
  { name: "Claim Events", href: "/venue/claim-events", icon: Ticket },
  { name: "Layout Requests", href: "/venue/layout-requests", icon: ClipboardList },
  { name: "Change Password", href: "/venue/change-password", icon: KeyRound },
];

function VenueShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const bizId = user?.business_id ?? "";
  const { data: settings } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const venueName = settings?.name || "Venue partner";
  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || venueName;
  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (displayName.slice(0, 2) || "VN").toUpperCase();
  }, [displayName]);

  const pageTitle = useMemo(
    () => navigation.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))?.name || "Venue Panel",
    [pathname]
  );

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

  const isNavActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const handleLogout = () => {
    clearSessionForRole("venue_admin");
    router.push("/venue");
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
    <AuthGate mode="require" roles={["venue_admin"]}>
      <SessionGuard>
        <div className="min-h-screen flex bg-background admin-dashboard-layout partner-shell">
          <aside className="admin-sidebar w-64 fixed inset-y-0 left-0 z-40 hidden md:flex flex-col overflow-hidden">
            <Link
              href="/venue/profile"
              className="p-4 border-b border-[var(--sidebar-border)] block hover:bg-muted/60 transition-colors shrink-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <Building2 size={18} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground" title={venueName}>
                    {venueName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Venue partner</p>
                </div>
              </div>
            </Link>

            <NavLinks />

            <div className="p-3 border-t border-[var(--sidebar-border)] shrink-0">
              <div className="rounded-xl border border-[var(--sidebar-border)] bg-muted/40 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Keep profile, availability, and documents up to date for bookings.
                  </p>
                </div>
                <div className="h-1.5 rounded-full bg-success/20 overflow-hidden">
                  <div className="h-full w-full rounded-full bg-success" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-success">Venue health</p>
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
                    <span className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <Building2 size={16} />
                    </span>
                    <span className="truncate font-bold text-sm">{venueName}</span>
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
                  href="/venue/profile"
                  className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Profile"
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
                      <span className="block text-[11px] text-muted-foreground">Venue</span>
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
                          href="/venue/profile"
                          onClick={() => setProfileOpen(false)}
                          className="block px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                        >
                          Profile
                        </Link>
                        <Link
                          href="/venue/change-password"
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
      </SessionGuard>
    </AuthGate>
  );
}

export default function VenueLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const isLoginPage = pathname === "/venue/login";
  const isPublicLanding = pathname === "/venue" || pathname === "/venue/register" || isLoginPage;
  const isVenueAdmin = user?.role === "venue_admin";

  useEffect(() => {
    if (isLoginPage) {
      setCheckingAuth(false);
      return;
    }

    const venue = readSessionForRole("venue_admin");
    if (venue) {
      dispatch(setCredentials({ user: venue.user, token: venue.token }));
    } else {
      dispatch(loadFromStorage());
    }

    if (!venue && !isPublicLanding) {
      router.replace("/venue/login");
      return;
    }

    setCheckingAuth(false);
  }, [dispatch, router, isPublicLanding, isLoginPage, pathname]);

  if (isLoginPage || pathname === "/venue/register") {
    return <>{children}</>;
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground font-medium">
        Loading...
      </div>
    );
  }

  if (!isVenueAdmin) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return <VenueShell>{children}</VenueShell>;
}
