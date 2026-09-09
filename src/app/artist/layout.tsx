"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage, setCredentials } from "@/features/auth/authSlice";
import { useGetBusinessSettingsQuery } from "@/services/api";
import AuthGate from "@/components/Shared/AuthGate";
import PartnerProfileHoverMenu from "@/components/Shared/PartnerProfileHoverMenu";
import { clearSessionForRole, readSessionForRole } from "@/lib/authStorage";
import { isComedyArtistSlug } from "@/lib/artistMeta";
import {
  Inbox,
  Laugh,
  Menu,
  Mic2,
  Ticket,
  User,
  X,
} from "lucide-react";

const navigation = [
  { name: "Profile", href: "/artist/profile", icon: User },
  { name: "Inquiries", href: "/artist/inquiries", icon: Inbox },
  { name: "Claim Events", href: "/artist/claim-events", icon: Ticket },
];

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  "/artist/profile": {
    title: "Artist profile",
    subtitle: "Basic details, gallery, social links, and media for your public page.",
  },
  "/artist/inquiries": {
    title: "Customer inquiries",
    subtitle: "Booking requests from customers. You also get an email for each new inquiry.",
  },
  "/artist/claim-events": {
    title: "Claim events",
    subtitle: "Link events that list you to your verified artist profile.",
  },
  "/artist/change-password": {
    title: "Change password",
    subtitle: "Update the password for your artist partner login.",
  },
};

function ArtistShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const bizId = user?.business_id ?? "";
  const { data: settings } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const artistName = settings?.name || "Artist partner";
  const isComedian = isComedyArtistSlug(settings?.venue_type_slug);
  const BrandIcon = isComedian ? Laugh : Mic2;
  const roleLabel = settings?.venue_type_name?.trim() || "Artist partner";
  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || artistName;
  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (displayName.slice(0, 2) || "AR").toUpperCase();
  }, [displayName]);

  const { title: pageTitle, subtitle: pageSubtitle } = useMemo(() => {
    const key = Object.keys(pageMeta).find(
      (href) => pathname === href || pathname.startsWith(`${href}/`)
    );
    if (key) return pageMeta[key];
    const nav = navigation.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
    return { title: nav?.name || "Artist panel", subtitle: "" };
  }, [pathname]);

  const isNavActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const handleLogout = () => {
    clearSessionForRole("artist_admin");
    router.push("/artist");
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
    <AuthGate mode="require" roles={["artist_admin"]}>
      <div className="min-h-screen flex bg-background admin-dashboard-layout partner-shell">
        <aside className="admin-sidebar w-64 fixed inset-y-0 left-0 z-40 hidden md:flex flex-col overflow-hidden">
          <Link
            href="/artist/profile"
            className="p-4 border-b border-[var(--sidebar-border)] block hover:bg-muted/60 transition-colors shrink-0"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <BrandIcon size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground" title={artistName}>
                  {artistName}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate" title={roleLabel}>
                  {roleLabel}
                </p>
              </div>
            </div>
          </Link>

          <NavLinks />
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
                    <BrandIcon size={16} />
                  </span>
                  <span className="truncate font-bold text-sm">{artistName}</span>
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
                {pageSubtitle ? (
                  <p className="text-xs text-muted-foreground line-clamp-2 hidden sm:block max-w-2xl">
                    {pageSubtitle}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <PartnerProfileHoverMenu
                displayName={displayName}
                email={user?.email}
                initials={initials}
                roleLabel="Artist"
                profileHref="/artist/profile"
                changePasswordHref="/artist/change-password"
                onLogout={handleLogout}
              />
            </div>
          </header>

          <div className="p-3 sm:p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </AuthGate>
  );
}

export default function ArtistLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const isLoginPage = pathname === "/artist/login";
  const isPublicLanding = pathname === "/artist" || pathname === "/artist/register" || isLoginPage;
  const isArtistAdmin = user?.role === "artist_admin";

  useEffect(() => {
    if (isLoginPage) {
      setCheckingAuth(false);
      return;
    }

    const artist = readSessionForRole("artist_admin");
    if (artist) {
      dispatch(setCredentials({ user: artist.user, token: artist.token }));
    } else {
      dispatch(loadFromStorage());
    }

    if (!artist && !isPublicLanding) {
      router.replace("/artist/login");
      return;
    }

    setCheckingAuth(false);
  }, [dispatch, router, isPublicLanding, isLoginPage, pathname]);

  if (isLoginPage || pathname === "/artist/register") {
    return <>{children}</>;
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground font-medium">
        Loading...
      </div>
    );
  }

  if (!isArtistAdmin) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return <ArtistShell>{children}</ArtistShell>;
}
