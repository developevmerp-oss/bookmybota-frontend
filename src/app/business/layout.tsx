"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { useGetBusinessSettingsQuery } from "@/services/api";
import { 
  LayoutDashboard, 
  CalendarCheck, 
  LayoutGrid, 
  Clock, 
  Settings, 
  LogOut,
  Store,
  Menu,
  X,
  Star,
  Megaphone
} from "lucide-react";

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const bizId = user?.business_id ?? '';
  const { data: settings } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const businessName = settings?.name || 'Venue Admin';

  useEffect(() => {
    dispatch(loadFromStorage());
    setCheckingAuth(false);
  }, [dispatch]);

  const isBusinessAdmin = user?.role === 'business_admin';

  useEffect(() => {
    if (!checkingAuth && !isBusinessAdmin && pathname !== '/business') {
      router.push('/business');
    }
  }, [checkingAuth, isBusinessAdmin, pathname, router]);

  const navigation = [
    { name: 'Global Settings', href: '/business', icon: LayoutDashboard },
    { name: 'Bookings Manager', href: '/business/bookings', icon: CalendarCheck },
    { name: 'Table Management', href: '/business/tables', icon: LayoutGrid },
    { name: 'Analytics', href: '/business/analytics', icon: Clock },
    { name: 'Profile Editor', href: '/business/profile', icon: Settings },
    { name: 'Reviews', href: '/business/reviews', icon: Star },
    { name: 'Promotions', href: '/business/promotions', icon: Megaphone },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token_business_admin');
    localStorage.removeItem('user_business_admin');
    router.push('/login');
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">
        Loading...
      </div>
    );
  }

  // If not logged in as business admin, render content directly without sidebar dashboard UI
  if (!isBusinessAdmin) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div className="min-h-screen flex bg-background admin-dashboard-layout">
      {/* Sidebar */}
      <aside className="w-64 glass-panel border-r border-white/5 fixed h-full z-40 hidden md:flex flex-col">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 min-w-0" title={businessName}>
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
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={18} />
                <span className="font-medium text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div 
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          {/* Drawer Content */}
          <div className="relative w-64 bg-zinc-950 border-r border-white/10 h-full flex flex-col p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 truncate" title={businessName}>
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
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                        : 'text-zinc-400 hover:bg-white/5 hover:text-white'
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

      {/* Main Content */}
      <main className="flex-1 md:ml-64 relative">
        {/* Header */}
        <header className="h-20 glass-panel border-b border-white/5 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30">
           <div className="flex items-center gap-3 min-w-0">
             <button 
               onClick={() => setMobileMenuOpen(true)}
               className="md:hidden p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
             >
               <Menu size={24} />
             </button>
             <h1 className="text-lg sm:text-xl font-semibold text-white truncate">
                {navigation.find(n => n.href === pathname)?.name || 'Business Panel'}
             </h1>
           </div>
           <div className="flex items-center gap-4">
             <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all cursor-pointer">
               <LogOut size={16} />
               <span className="hidden sm:inline">Sign Out</span>
             </button>
           </div>
        </header>
        
        {/* Page Content */}
        <div className="p-4 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
