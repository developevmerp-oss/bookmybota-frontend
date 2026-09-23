"use client";
import { useEffect, useMemo, useState, type ComponentType } from "react";
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
  Gift,
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
  KeyRound,
  Clapperboard,
  Film,
  ChevronDown,
  Layers,
  LayoutGrid,
} from "lucide-react";
import AuthGate from "@/components/Shared/AuthGate";
import SessionGuard from "@/components/Shared/SessionGuard";
import { clearSessionForRole } from "@/lib/authStorage";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";

const SIDEBAR_COLLAPSE_KEY = "admin_sidebar_collapsed";
const SIDEBAR_GROUPS_KEY = "admin_sidebar_groups";

type NavIcon = ComponentType<{ size?: number; className?: string }>;

type NavLinkItem = {
  type: "link";
  name: string;
  href: string;
  icon: NavIcon;
};

type NavGroupItem = {
  type: "group";
  id: string;
  name: string;
  icon: NavIcon;
  children: Array<{ name: string; href: string; icon: NavIcon }>;
};

type NavItem = NavLinkItem | NavGroupItem;

const navigation: NavItem[] = [
  { type: "link", name: "Global Dashboard", href: "/admin", icon: LayoutDashboard },
  { type: "link", name: "Dining Businesses", href: "/admin/businesses/dining", icon: UtensilsCrossed },
  { type: "link", name: "Event Organizers", href: "/admin/businesses/event", icon: Store },
  { type: "link", name: "Venue Partners", href: "/admin/businesses/venue", icon: Store },
  { type: "link", name: "Artist Partners", href: "/admin/businesses/artist", icon: Mic2 },
  { type: "link", name: "Cinema Partners", href: "/admin/businesses/cinema", icon: Clapperboard },
  { type: "link", name: "Movies", href: "/admin/movies", icon: Film },
  { type: "link", name: "Events", href: "/admin/events", icon: CalendarDays },
  { type: "link", name: "Event Contracts", href: "/admin/event-contracts", icon: FileSignature },
  { type: "link", name: "Movie Contracts", href: "/admin/movie-contracts", icon: FileSignature },
  {
    type: "group",
    id: "master-setting",
    name: "Master Setting",
    icon: Layers,
    children: [
      { name: "Dining Masters", href: "/admin/dining-masters", icon: ChefHat },
      { name: "City Masters", href: "/admin/cities", icon: MapPin },
      { name: "Location Hierarchy", href: "/admin/geo", icon: MapPin },
      { name: "Movie Masters", href: "/admin/movie-masters", icon: ListChecks },
      { name: "Event Masters", href: "/admin/event-masters", icon: ListChecks },
      { name: "Partner Documents", href: "/admin/partner-documents", icon: FileText },
    ],
  },
  {
    type: "group",
    id: "layouts",
    name: "Layouts",
    icon: LayoutGrid,
    children: [
      { name: "Venue & Cinema Layouts", href: "/admin/venue-layouts", icon: Map },
      { name: "Event Layouts", href: "/admin/event-layouts", icon: Map },
    ],
  },
  { type: "link", name: "BookMyBota Revenue", href: "/admin/revenue", icon: Percent },
  { type: "link", name: "Partner Payouts", href: "/admin/organizer-payouts", icon: Wallet },
  { type: "link", name: "Subscription & Billing", href: "/admin/billing", icon: CreditCard },
  { type: "link", name: "Marketing Plans", href: "/admin/marketing", icon: Megaphone },
  { type: "link", name: "Platform Offers", href: "/admin/platform-offers", icon: Tag },
  { type: "link", name: "Gift Cards", href: "/admin/gift-cards", icon: Gift },
  { type: "link", name: "Gift Card Ledger", href: "/admin/gift-card-settlements", icon: Wallet },
  { type: "link", name: "Customers", href: "/admin/customers", icon: Users },
  { type: "link", name: "Profile", href: "/admin/profile", icon: UserRound },
];

function flatNavLinks() {
  return navigation.flatMap((item) =>
    item.type === "link" ? [item] : item.children.map((c) => ({ ...c, type: "link" as const }))
  );
}

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
        className="inline-flex h-8 sm:h-9 items-center gap-1.5 pl-1 pr-2 sm:pr-2.5 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors relative z-10"
        aria-label={displayName}
      >
        <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-rose-600 text-white text-xs font-semibold flex items-center justify-center">
          {initial}
        </span>
        <span className="hidden md:inline text-sm font-medium text-slate-800 max-w-[90px] lg:max-w-[120px] truncate">
          {displayName}
        </span>
      </Link>
      <div className="absolute right-0 top-full pt-1 w-52 sm:w-56 z-[60] opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:visible group-focus-within:pointer-events-auto transition-all duration-200">
        <div className="rounded-xl border border-rose-100 bg-white shadow-lg py-1.5 overflow-hidden">
          <Link
            href="/admin/profile"
            className="flex items-center gap-2 px-4 py-2.5 sm:py-2 text-sm font-medium text-slate-800 hover:bg-rose-50 transition-colors"
          >
            <UserRound size={16} className="text-slate-500" />
            My Profile
          </Link>
          <Link
            href="/admin/profile?tab=password"
            className="flex items-center gap-2 px-4 py-2.5 sm:py-2 text-sm font-medium text-slate-800 hover:bg-rose-50 transition-colors"
          >
            <KeyRound size={16} className="text-slate-500" />
            Change Password
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-4 py-2.5 sm:py-2 text-sm font-medium text-red-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "master-setting": true,
    layouts: true,
  });

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
      if (stored === "1") setSidebarCollapsed(true);
      const groupsRaw = localStorage.getItem(SIDEBAR_GROUPS_KEY);
      if (groupsRaw) {
        const parsed = JSON.parse(groupsRaw) as Record<string, boolean>;
        if (parsed && typeof parsed === "object") {
          setOpenGroups((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const isNavActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const activeGroupIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of navigation) {
      if (item.type !== "group") continue;
      if (item.children.some((c) => isNavActive(c.href))) ids.push(item.id);
    }
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!activeGroupIds.length) return;
    setOpenGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of activeGroupIds) {
        if (!next[id]) {
          next[id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeGroupIds]);

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

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const allLinks = useMemo(() => flatNavLinks(), []);

  const currentNavName =
    allLinks.find((n) => isNavActive(n.href) && n.href !== "/admin")?.name ||
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
    : "sm:w-[14.5rem] md:w-[15rem] lg:w-[15.5rem] xl:w-[16rem]";
  const mainMarginClass = sidebarCollapsed
    ? "sm:ml-[4.25rem] lg:ml-[4.5rem]"
    : "sm:ml-[14.5rem] md:ml-[15rem] lg:ml-[15.5rem] xl:ml-[16rem]";

  const linkClass = (isActive: boolean, collapsed: boolean, nested = false) =>
    `relative flex items-center rounded-lg transition-colors border ${
      collapsed
        ? "justify-center px-2.5 py-2"
        : nested
          ? "gap-2.5 pl-8 pr-2.5 py-1.5"
          : "gap-2.5 px-2.5 py-1.5"
    } ${
      isActive
        ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
        : "text-zinc-400 hover:bg-white/5 hover:text-white border-transparent"
    }`;

  const renderLink = (
    item: { name: string; href: string; icon: NavIcon },
    opts: { onNavigate?: () => void; collapsed?: boolean; nested?: boolean }
  ) => {
    const isActive = isNavActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={opts.collapsed ? item.name : undefined}
        onClick={opts.onNavigate}
        className={linkClass(isActive, Boolean(opts.collapsed), opts.nested)}
      >
        <Icon size={15} className="shrink-0" />
        {!opts.collapsed && (
          <span className="font-medium text-[13px] leading-snug truncate">{item.name}</span>
        )}
      </Link>
    );
  };

  const renderNav = (onNavigate?: () => void, collapsed = false) =>
    navigation.map((item) => {
      if (item.type === "link") {
        return renderLink(item, { onNavigate, collapsed });
      }

      const groupActive = item.children.some((c) => isNavActive(c.href));
      const isOpen = Boolean(openGroups[item.id]) || groupActive;
      const GroupIcon = item.icon;

      if (collapsed) {
        return (
          <div key={item.id} className="space-y-0.5 pt-1.5 mt-1.5 border-t border-white/5">
            {item.children.map((child) => renderLink(child, { onNavigate, collapsed: true }))}
          </div>
        );
      }

      return (
        <div key={item.id} className="pt-1.5 mt-1.5 border-t border-white/5">
          <button
            type="button"
            onClick={() => toggleGroup(item.id)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
              groupActive
                ? "text-rose-400"
                : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
            }`}
            aria-expanded={isOpen}
          >
            <GroupIcon size={15} className="shrink-0" />
            <span className="flex-1 text-left text-[11px] font-bold uppercase tracking-wider truncate">
              {item.name}
            </span>
            <ChevronDown
              size={14}
              className={`shrink-0 transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`}
            />
          </button>
          {isOpen && (
            <div className="mt-0.5 space-y-0.5">
              {item.children.map((child) =>
                renderLink(child, { onNavigate, collapsed: false, nested: true })
              )}
            </div>
          )}
        </div>
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
                  ? "px-2 py-3 flex items-center justify-center"
                  : "px-3 py-3 lg:px-3.5"
              }`}
            >
              {sidebarCollapsed ? (
                <span className="bg-rose-600 p-1.5 rounded-lg text-white" title="Super Admin">
                  <Settings size={16} />
                </span>
              ) : (
                <h2 className="text-base font-bold text-white flex items-center gap-2 min-w-0">
                  <span className="bg-rose-600 p-1.5 rounded-lg text-white shrink-0">
                    <Settings size={16} />
                  </span>
                  <span className="truncate">Super Admin</span>
                </h2>
              )}
            </div>
            <nav
              className={`admin-sidebar-nav flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 space-y-0.5 ${
                sidebarCollapsed ? "px-1.5" : ""
              }`}
            >
              {renderNav(undefined, sidebarCollapsed)}
            </nav>
          </aside>

          {mobileMenuOpen && (
            <div className="fixed inset-0 z-50 sm:hidden flex">
              <div
                onClick={() => setMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              />
              <div className="admin-sidebar relative w-[16rem] max-w-[85vw] bg-zinc-950 border-r border-white/10 h-full flex flex-col p-3 animate-fadeIn overflow-hidden">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <h2 className="text-base font-bold text-white flex items-center gap-2 truncate">
                    <span className="bg-rose-600 p-1.5 rounded-lg text-white shrink-0">
                      <Settings size={16} />
                    </span>
                    Super Admin
                  </h2>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
                <nav className="admin-sidebar-nav flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-0.5 pr-1">
                  {renderNav(() => setMobileMenuOpen(false))}
                </nav>
              </div>
            </div>
          )}

          <main className={`flex-1 min-w-0 ${mainMarginClass} relative transition-[margin] duration-200`}>
            <header className="h-11 sm:h-12 lg:h-14 glass-panel border-b border-white/5 flex items-center justify-between px-2.5 sm:px-4 lg:px-5 sticky top-0 z-30">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="sm:hidden p-2 -ml-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                  aria-label="Open menu"
                >
                  <Menu size={20} />
                </button>
                <button
                  type="button"
                  onClick={toggleSidebarCollapsed}
                  className="hidden sm:inline-flex p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                  aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
                <h1 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate min-w-0">
                  {currentNavName}
                </h1>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <AdminProfileMenu
                  displayName={displayName}
                  initial={initial}
                  onLogout={handleLogout}
                />
              </div>
            </header>

            <div className="admin-page-content w-full p-2.5 sm:p-3 md:p-4 lg:p-5 max-w-[100vw] overflow-x-hidden">
              {children}
            </div>
          </main>
        </div>
      </SessionGuard>
    </AuthGate>
  );
}
