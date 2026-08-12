"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Calendar,
  HelpCircle,
  Tag,
  Settings,
  ChevronRight,
  LogOut,
  Lock,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { clearCredentials, loadFromStorage } from "@/features/auth/authSlice";

const SETTINGS_LINKS = [
  {
    href: "/customer/profile",
    icon: User,
    title: "Edit Profile",
    subtitle: "Name, phone, email",
  },
  {
    href: "/customer/change-password",
    icon: Lock,
    title: "Change Password",
    subtitle: "Update your account password",
  },
  {
    href: "/customer/dashboard",
    icon: Calendar,
    title: "My Orders / Reservations",
    subtitle: "Upcoming and past bookings",
  },
  {
    href: "/customer/help",
    icon: HelpCircle,
    title: "Help Centre",
    subtitle: "FAQs and find your ticket",
  },
  {
    href: "/offers",
    icon: Tag,
    title: "Offers",
    subtitle: "Deals and promo codes",
    soon: true,
  },
];

export default function CustomerSettingsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    if (user === null) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem("user_customer") : null;
    if (!stored) {
      router.push("/login");
      return;
    }
    const parsed = JSON.parse(stored);
    if (parsed.role !== "customer") router.push("/");
  }, [user, router]);

  const handleLogout = () => {
    dispatch(clearCredentials());
    localStorage.removeItem("token_customer");
    localStorage.removeItem("user_customer");
    window.dispatchEvent(new Event("auth_changed"));
    router.push("/login");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background pt-24 text-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const displayName = user.name || user.email?.split("@")[0] || "Guest";

  return (
    <div className="min-h-screen bg-background pt-10 pb-16">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Settings size={28} className="text-rose-600" /> Settings
          </h1>
          <p className="text-muted-foreground">Manage your account and preferences.</p>
        </div>

        <div className="glass-panel rounded-2xl border border-border p-5 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-xl font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-foreground text-lg">{displayName}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {user.phone && <p className="text-sm text-muted-foreground">{user.phone}</p>}
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-border divide-y divide-border overflow-hidden mb-6">
          {SETTINGS_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.soon ? "#" : item.href}
              onClick={(e) => {
                if (item.soon) e.preventDefault();
              }}
              className={`flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors ${
                item.soon ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <item.icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground flex items-center gap-2">
                  {item.title}
                  {item.soon && (
                    <span className="text-[10px] uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">
                      Soon
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
              {!item.soon && <ChevronRight size={16} className="text-slate-300" />}
            </Link>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 font-medium text-sm transition-colors cursor-pointer"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>
    </div>
  );
}
