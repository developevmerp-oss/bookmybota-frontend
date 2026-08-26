"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Gift,
  HelpCircle,
  Lock,
  LogOut,
  Tag,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch } from "@/lib/hooks";
import { logoutCustomer } from "@/lib/authSession";

const NAV = [
  { href: "/customer/profile", icon: User, label: "My Profile" },
  { href: "/customer/change-password", icon: Lock, label: "Change Password" },
  { href: "/customer/dashboard", icon: Calendar, label: "My Orders / Reservations" },
  { href: "/customer/gift-cards", icon: Gift, label: "My Gift Cards" },
  { href: "/customer/help", icon: HelpCircle, label: "Help Centre" },
  { href: "#gift-cards", icon: Gift, label: "Gift Cards", soon: true, mobileOnly: true },
  { href: "/offers", icon: Tag, label: "Offers", soon: true },
];

export default function CustomerAccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  const handleLogout = () => {
    logoutCustomer(dispatch, { pathname: pathname || "/" });
    toast.success("Logged out successfully");
  };

  return (
    <div className="bg-[#f4f5f7] min-h-[calc(100vh-4rem)] py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <aside className="w-full lg:w-[260px] shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col h-fit">
              <h1 className="px-3 pt-2 pb-3 text-3xl border-b border-slate-200 mb-3 font-extrabold text-[#111111]">My Account</h1>
              <nav className="flex flex-col gap-1">
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
                          : "text-slate-700 hover:bg-slate-50"
                      }${item.mobileOnly ? " lg:hidden" : ""}`}
                    >
                      <Icon size={18} className={active ? "text-[#6900AA]" : "text-slate-500"} />
                      <span className="flex-1">{item.label}</span>
                      {item.soon && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F7E9FF] text-[#6900AA]">
                          Soon
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              <button
                type="button"
                onClick={handleLogout}
                className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 cursor-pointer"
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
