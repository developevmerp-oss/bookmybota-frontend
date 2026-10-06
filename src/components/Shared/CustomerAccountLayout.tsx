"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  ChevronRight,
  Gift,
  HelpCircle,
  Lock,
  LogOut,
  Heart,
  Tag,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { logoutCustomer } from "@/lib/authSession";

const NAV = [
  { href: "/customer/profile", icon: User, label: "My Profile" },
  { href: "/customer/change-password", icon: Lock, label: "Change Password" },
  { href: "/customer/dashboard", icon: Calendar, label: "My Orders / Reservations" },
  { href: "/customer/favourite", icon: Heart, label: "My Favourite" },
  { href: "/customer/gift-cards", icon: Gift, label: "My Gift Cards" },
  { href: "/customer/help", icon: HelpCircle, label: "Help Centre" },
  { href: "#gift-cards", icon: Gift, label: "Gift Cards", soon: true, mobileOnly: true },
  { href: "/customer/offers", icon: Tag, label: "Offers" },
];

export default function CustomerAccountLayout({
  children,
  hideSidebarBelowLg = false,
}: {
  children: React.ReactNode;
  /** Hide left account nav below lg (used by mobile-native profile UI). */
  hideSidebarBelowLg?: boolean;
}) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  const displayName =
    user?.name?.trim() || user?.email?.split("@")[0] || "Guest";
  const displayEmail = user?.email || "";

  const handleLogout = () => {
    logoutCustomer(dispatch, { pathname: pathname || "/" });
    toast.success("Logged out successfully");
  };

  return (
    <div className="bg-[#f4f5f7] min-h-[calc(100vh-4rem)] py-4 sm:py-6 lg:py-8">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start">
          <aside
            className={`w-full lg:w-[260px] shrink-0 lg:sticky lg:top-40 lg:self-start${
              hideSidebarBelowLg ? " hidden lg:block" : ""
            }`}
          >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col h-fit">
              {/* Profile header — desktop left UI */}
              <div className="flex items-center gap-3 px-2 py-3 mb-2">
                <div className="w-12 h-12 rounded-full bg-[#F7E9FF] text-[#6900AA] flex items-center justify-center text-xl font-bold shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-black truncate leading-tight">
                    {displayName}
                  </p>
                  {displayEmail ? (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{displayEmail}</p>
                  ) : null}
                </div>
              </div>

              <nav className="flex flex-col gap-0.5">
                {NAV.map((item) => {
                  const active =
                    !item.soon &&
                    (pathname === item.href ||
                      (item.href !== "/customer/dashboard" &&
                        pathname.startsWith(item.href + "/")));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.soon ? "#" : item.href}
                      onClick={(e) => {
                        if (!item.soon) return;
                        e.preventDefault();
                        toast.message("Coming soon");
                      }}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-[#F7E9FF] text-[#6900AA]"
                          : "text-[#111111] hover:bg-slate-50"
                      }${item.mobileOnly ? " lg:hidden" : ""}`}
                    >
                      <Icon size={18} className={active ? "text-[#6900AA]" : "text-slate-500"} />
                      <span className="flex-1">{item.label}</span>
                      {item.soon ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F7E9FF] text-[#6900AA]">
                          Soon
                        </span>
                      ) : active ? (
                        <ChevronRight size={16} className="text-[#6900AA] shrink-0" />
                      ) : null}
                    </Link>
                  );
                })}
              </nav>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <LogOut size={18} />
                Log out
              </button>
            </div>
          </aside>

          <div className="flex-1 min-w-0 w-full">{children}</div>
        </div>
      </div>
    </div>
  );
}

export { NAV as CUSTOMER_ACCOUNT_NAV };
