"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  HelpCircle,
  Home,
  Lock,
  LogOut,
  Tag,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch } from "@/lib/hooks";
import { clearCredentials } from "@/features/auth/authSlice";

const NAV = [
  { href: "/customer/settings", icon: Home, label: "Overview" },
  { href: "/customer/profile", icon: User, label: "Edit Profile" },
  { href: "/customer/change-password", icon: Lock, label: "Change Password" },
  { href: "/customer/dashboard", icon: Calendar, label: "My Orders / Reservations" },
  { href: "/customer/help", icon: HelpCircle, label: "Help Centre" },
  { href: "/offers", icon: Tag, label: "Offers", soon: true },
];

export default function CustomerAccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const handleLogout = () => {
    dispatch(clearCredentials());
    localStorage.removeItem("token_customer");
    localStorage.removeItem("user_customer");
    window.dispatchEvent(new Event("auth_changed"));
    router.push("/login");
  };

  return (
    <div className="bg-[#f4f5f7] min-h-[calc(100vh-4rem)] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <aside className="w-full lg:w-[260px] shrink-0 lg:mt-23">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col h-fit">
              <nav className="flex flex-col gap-1">
                {NAV.map((item) => {
                  const active = !item.soon && pathname === item.href;
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
                      }`}
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
