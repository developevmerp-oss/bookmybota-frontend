"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage, setCredentials } from "@/features/auth/authSlice";
import { useGetBusinessSettingsQuery } from "@/services/api";
import SessionGuard from "@/components/Shared/SessionGuard";
import PartnerProfileHoverMenu from "@/components/Shared/PartnerProfileHoverMenu";
import { clearSessionForRole, readSessionForRole } from "@/lib/authStorage";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import {
  LayoutDashboard,
  CalendarCheck,
  LayoutGrid,
  BarChart3,
  Clock,
  User,
  Menu,
  X,
  Star,
  Megaphone,
  QrCode,
  Tag,
  BadgePercent,
  Wallet,
  UtensilsCrossed,
} from "lucide-react";

type NavIcon = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

type NavLink = {
  name: string;
  href: string;
  icon: NavIcon;
};

type NavSection = {
  id: string;
  label: string;
  items: NavLink[];
};

function BusinessShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const bizId = user?.business_id ?? "";
  const { data: settings } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const businessName = settings?.name || "Venue Admin";
  const displayName = user?.name?.trim() || businessName;
  const initial = (displayName.charAt(0) || "V").toUpperCase();
  const logoSrc = settings?.logo_url ? resolveMediaUrl(settings.logo_url) : "";

  const sections: NavSection[] = [
    {
      id: "venue",
      label: "Venue",
      items: [
        { name: "Dashboard", href: "/business", icon: LayoutDashboard },
        { name: "Tables", href: "/business/tables", icon: LayoutGrid },
        { name: "Analytics", href: "/business/analytics", icon: Clock },
      ],
    },
    {
      id: "operations",
      label: "Operations",
      items: [
        { name: "Bookings", href: "/business/bookings", icon: CalendarCheck },
        { name: "Scan guest QR", href: "/business/scan", icon: QrCode },
      ],
    },
    {
      id: "marketing",
      label: "Marketing",
      items: [
        { name: "Offers", href: "/business/offers", icon: BadgePercent },
        { name: "Offer Redemptions", href: "/business/offer-redemptions", icon: Tag },
        { name: "Reviews", href: "/business/reviews", icon: Star },
        { name: "Promotions", href: "/business/promotions", icon: Megaphone },
      ],
    },
    {
      id: "finance",
      label: "Finance",
      items: [
        { name: "Gift Card Settlements", href: "/business/settlements", icon: Wallet },
        { name: "Accounting & Taxes", href: "/business/accounting", icon: BarChart3 },
      ],
    },
  ];

  const profileLink: NavLink = { name: "Profile", href: "/business/profile", icon: User };

  const allLinks = [...sections.flatMap((s) => s.items), profileLink];

  const isNavActive = (href: string) => {
    if (href === "/business") return pathname === "/business";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = () => {
    clearSessionForRole("business_admin");
    router.push("/business");
  };

  const pageTitle =
    allLinks.find((n) => isNavActive(n.href))?.name || "Business Panel";

  const renderLink = (item: NavLink, onNavigate?: () => void) => {
    const isActive = isNavActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={`org-nav-item relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
          isActive ? "is-active" : ""
        }`}
      >
        <Icon size={15} className="shrink-0" strokeWidth={isActive ? 2.25 : 2} />
        <span className="truncate leading-snug">{item.name}</span>
      </Link>
    );
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="admin-sidebar-nav flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-0.5">
      {sections.map((section, index) => (
        <div
          key={section.id}
          className={index === 0 ? "" : "pt-1.5 mt-1.5 border-t border-[var(--sidebar-border)]"}
        >
          <p className="px-2.5 pt-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {section.label}
          </p>
          <div className="space-y-0.5">{section.items.map((item) => renderLink(item, onNavigate))}</div>
        </div>
      ))}
      <div className="pt-1.5 mt-1.5 border-t border-[var(--sidebar-border)] space-y-0.5">
        {renderLink(profileLink, onNavigate)}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-background admin-dashboard-layout partner-shell">
      <aside className="admin-sidebar w-64 fixed inset-y-0 left-0 z-40 hidden md:flex flex-col overflow-hidden border-r border-[var(--sidebar-border)] bg-[var(--sidebar,#fff)]">
        <div className="px-3 py-3 lg:px-3.5 border-b border-[var(--sidebar-border)] shrink-0">
          <Link
            href="/business/profile"
            className="flex items-center gap-2 min-w-0 rounded-lg hover:bg-muted/60 transition-colors -mx-0.5 px-0.5 py-0.5"
            title="Open profile"
          >
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt=""
                className="w-8 h-8 rounded-lg object-cover border border-border shrink-0 bg-white"
              />
            ) : (
              <span className="bg-rose-600 p-1.5 rounded-lg text-white shrink-0">
                <UtensilsCrossed size={16} />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-foreground" title={businessName}>
                {businessName}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Dining Admin</p>
            </div>
          </Link>
        </div>
        <NavLinks />
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="admin-sidebar relative w-72 max-w-[85vw] bg-card border-r border-border h-full flex flex-col overflow-hidden shadow-lg">
            <div className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0">
              <Link
                href="/business/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 min-w-0"
              >
                {logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoSrc}
                    alt=""
                    className="w-8 h-8 rounded-lg object-cover border border-border shrink-0 bg-white"
                  />
                ) : (
                  <span className="bg-rose-600 p-1.5 rounded-lg text-white shrink-0">
                    <UtensilsCrossed size={16} />
                  </span>
                )}
                <span className="truncate font-bold text-sm text-foreground">{businessName}</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 md:ml-64 relative min-w-0">
        <header className="h-12 sm:h-14 glass-panel border-b border-border flex items-center justify-between px-3 sm:px-5 sticky top-0 z-30">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-sm sm:text-base lg:text-lg font-semibold text-foreground truncate min-w-0">
              {pageTitle}
            </h1>
          </div>
          <PartnerProfileHoverMenu
            displayName={displayName}
            email={user?.email}
            initials={initial}
            roleLabel="Dining Admin"
            profileHref="/business/profile"
            changePasswordHref="/business/change-password"
            onLogout={handleLogout}
          />
        </header>
        <div className="p-4 sm:p-8">{children}</div>
      </main>
    </div>
  );
}

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [checkingAuth, setCheckingAuth] = useState(true);

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
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return (
    <SessionGuard>
      <BusinessShell>{children}</BusinessShell>
    </SessionGuard>
  );
}
