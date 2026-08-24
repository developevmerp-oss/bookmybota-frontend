"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  CreditCard,
  FileText,
  Users,
  LogOut,
  Settings,
  Menu,
  X,
  Megaphone,
  CalendarDays,
  Percent,
  UtensilsCrossed,
  ListChecks,
  ChefHat,
  FileSignature,
  Wallet,
  MapPin,
  Map,
  Tag,
  Mic2,
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
  KeyRound,
} from "lucide-react";
import AuthGate from "@/components/Shared/AuthGate";
import SessionGuard from "@/components/Shared/SessionGuard";
import { clearSessionForRole } from "@/lib/authStorage";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";

const SIDEBAR_COLLAPSE_KEY = "admin_sidebar_collapsed";

function AdminProfileMenu({
  displayName,
  initial,
  onLogout,
}: {
  displayName: string;
  initial: string;
  onLogout: () => void;
}) {
  return (
    <div className="relative group">
      <Link
        href="/admin/profile"
        className="inline-flex h-9 sm:h-10 items-center gap-1.5 pl-1 pr-2.5 sm:pr-3 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors relative z-10"
        aria-label={displayName}
      >
        <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600 text-white text-xs sm:text-sm font-semibold flex items-center justify-center">
          {initial}
        </span>
        <span className="hidden sm:inline text-sm font-medium text-slate-800 max-w-[110px] truncate">
          {displayName}
        </span>
      </Link>
      <div className="absolute right-0 top-full pt-1 w-56 z-[60] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
        <div className="rounded-xl border border-rose-100 bg-white shadow-lg py-1.5 overflow-hidden">
          <Link
            href="/admin/profile"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-rose-50 transition-colors"
          >
            <UserRound size={16} className="text-slate-500" />
            My Profile
          </Link>
          <Link
            href="/admin/profile?tab=password"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-rose-50 transition-colors"
          >
            <KeyRound size={16} className="text-slate-500" />
            Change Password
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
      if (stored === "1") setSidebarCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const navigation = [
    { name: "Global Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Dining Businesses", href: "/admin/businesses/dining", icon: UtensilsCrossed },
    { name: "Dining Masters", href: "/admin/dining-masters", icon: ChefHat },
    { name: "City Masters", href: "/admin/cities", icon: MapPin },
    { name: "Location Hierarchy", href: "/admin/geo", icon: MapPin },
    { name: "Event Organizers", href: "/admin/businesses/event", icon: Store },
    { name: "Venue Partners", href: "/admin/businesses/venue", icon: Store },
    { name: "Artist Partners", href: "/admin/businesses/artist", icon: Mic2 },
    { name: "Venue Layouts", href: "/admin/venue-layouts", icon: Map },
    { name: "Event Layouts", href: "/admin/event-layouts", icon: Map },
    { name: "Events", href: "/admin/events", icon: CalendarDays },
    { name: "Event Contracts", href: "/admin/event-contracts", icon: FileSignature },
    { name: "Event Masters", href: "/admin/event-masters", icon: ListChecks },
    { name: "Partner Documents", href: "/admin/partner-documents", icon: FileText },
    { name: "Fees & Commission", href: "/admin/commission", icon: Percent },
    { name: "Organizer Payouts", href: "/admin/organizer-payouts", icon: Wallet },
    { name: "Subscription & Billing", href: "/admin/billing", icon: CreditCard },
    { name: "Marketing Plans", href: "/admin/marketing", icon: Megaphone },
    { name: "Platform Offers", href: "/admin/platform-offers", icon: Tag },
    { name: "Content Management", href: "/admin/content", icon: FileText },
    { name: "Customers", href: "/admin/customers", icon: Users },
    { name: "Profile", href: "/admin/profile", icon: UserRound },
  ];

  const isNavActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const currentNavName =
    navigation.find((n) => isNavActive(n.href) && n.href !== "/admin")?.name ||
    (pathname === "/admin" ? "Global Dashboard" : "Admin Panel");

  const handleLogout = () => {
    clearSessionForRole("super_admin");
    router.push("/");
  };

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "Admin";
  const initial = displayName.charAt(0).toUpperCase();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const sidebarWidthClass = sidebarCollapsed
    ? "sm:w-[4.25rem] lg:w-[4.5rem]"
    : "sm:w-[15rem] lg:w-[16rem] 2xl:w-[18rem]";
  const mainMarginClass = sidebarCollapsed
    ? "sm:ml-[4.25rem] lg:ml-[4.5rem]"
    : "sm:ml-[15rem] lg:ml-[16rem] 2xl:ml-[18rem]";

  const renderNavLinks = (onNavigate?: () => void, collapsed = false) =>
    navigation.map((item) => {
      const isActive = isNavActive(item.href);
      const Icon = item.icon;
      return (
        <Link
          key={item.name}
          href={item.href}
          title={collapsed ? item.name : undefined}
          onClick={onNavigate}
          className={`flex items-center rounded-xl transition-colors border ${
            collapsed ? "justify-center px-[0.65rem] py-[0.65rem]" : "gap-[0.75rem] px-[0.75rem] py-[0.6rem]"
          } ${
            isActive
              ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
              : "text-zinc-400 hover:bg-white/5 hover:text-white border-transparent"
          }`}
        >
          <Icon size={16} className="shrink-0" />
          {!collapsed && <span className="font-medium text-sm leading-snug">{item.name}</span>}
        </Link>
      );
    });

  return (
    <AuthGate mode="require" roles={["super_admin"]}>
      <SessionGuard>
        <div className="min-h-screen flex bg-background admin-dashboard-layout super-admin-shell">
          <aside
            className={`admin-sidebar ${sidebarWidthClass} glass-panel border-r border-white/5 fixed inset-y-0 left-0 z-40 hidden sm:flex flex-col overflow-hidden transition-[width] duration-200`}
          >
            <div
              className={`border-b border-white/5 shrink-0 ${
                sidebarCollapsed
                  ? "px-[0.5rem] py-[0.85rem] flex items-center justify-center"
                  : "px-[1rem] py-[1rem] lg:px-[1.25rem] lg:py-[1.15rem]"
              }`}
            >
              {sidebarCollapsed ? (
                <span className="bg-rose-600 p-[0.4rem] rounded-lg text-white" title="Super Admin">
                  <Settings size={18} />
                </span>
              ) : (
                <h2 className="text-lg lg:text-xl 2xl:text-2xl font-bold text-white flex items-center gap-[0.5rem] min-w-0">
                  <span className="bg-rose-600 p-[0.4rem] rounded-lg text-white shrink-0">
                    <Settings size={20} />
                  </span>
                  <span className="truncate">Super Admin</span>
                </h2>
              )}
            </div>
            <nav
              className={`admin-sidebar-nav flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-[0.75rem] space-y-[0.25rem] ${
                sidebarCollapsed ? "px-[0.5rem]" : ""
              }`}
            >
              {renderNavLinks(undefined, sidebarCollapsed)}
            </nav>
          </aside>

          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 sm:hidden flex">
              <div
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              />
              <div className="admin-sidebar relative w-[16.5rem] max-w-[85vw] bg-zinc-950 border-r border-white/10 h-full flex flex-col p-[1rem] animate-fadeIn overflow-hidden">
                <div className="flex items-center justify-between mb-[1rem] shrink-0">
                  <h2 className="text-lg font-bold text-white flex items-center gap-[0.5rem] truncate">
                    <span className="bg-rose-600 p-[0.4rem] rounded-lg text-white shrink-0">
                      <Settings size={18} />
                    </span>
                    Super Admin
                  </h2>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-[0.4rem] text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
                <nav className="admin-sidebar-nav flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-[0.25rem] pr-[0.25rem]">
                  {renderNavLinks(() => setMobileMenuOpen(false))}
                </nav>
              </div>
            </div>
          )}

          <main className={`flex-1 min-w-0 ${mainMarginClass} relative transition-[margin] duration-200`}>
            <header className="min-h-[3.5rem] sm:min-h-[4rem] lg:min-h-[4.5rem] 2xl:min-h-[5rem] glass-panel border-b border-white/5 flex items-center justify-between px-[0.75rem] sm:px-[1.25rem] lg:px-[1.5rem] 2xl:px-[2rem] sticky top-0 z-30">
              <div className="flex items-center gap-[0.75rem] min-w-0">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="sm:hidden p-[0.5rem] text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                  aria-label="Open menu"
                >
                  <Menu size={22} />
                </button>
                <button
                  type="button"
                  onClick={toggleSidebarCollapsed}
                  className="hidden sm:inline-flex p-[0.5rem] text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                  aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
                </button>
                <h1 className="text-lg sm:text-xl lg:text-[1.375rem] 2xl:text-[1.5rem] font-semibold text-white truncate">
                  {currentNavName}
                </h1>
              </div>
              <div className="flex items-center gap-[0.5rem] sm:gap-[0.75rem] shrink-0">
                <AdminProfileMenu
                  displayName={displayName}
                  initial={initial}
                  onLogout={handleLogout}
                />
              </div>
            </header>

            <div className="admin-page-content w-full p-[0.75rem] sm:p-[1.25rem] lg:p-[1.5rem] 2xl:p-[2rem]">
              {children}
            </div>
          </main>
        </div>
      </SessionGuard>
    </AuthGate>
  );
}
