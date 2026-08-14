"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Bookmark,
  Calendar,
  ChevronRight,
  Headphones,
  HelpCircle,
  Lock,
  LogOut,
  Phone,
  Tag,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetCustomerBookingsQuery,
  useGetCustomerEventBookingsQuery,
  useGetCustomerProfileQuery,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { clearCredentials, loadFromStorage } from "@/features/auth/authSlice";

const SETTINGS_LINKS = [
  {
    href: "/customer/profile",
    icon: User,
    title: "Edit Profile",
    subtitle: "Update your personal information",
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
    subtitle: "View your upcoming and past bookings",
  },
  {
    href: "/customer/help",
    icon: HelpCircle,
    title: "Help Centre",
    subtitle: "FAQs and find solutions to common queries",
  },
  {
    href: "/offers",
    icon: Tag,
    title: "Offers",
    subtitle: "Deals and promo codes",
    soon: true,
  },
  {
    href: "#",
    icon: Bell,
    title: "Preferences",
    subtitle: "Manage notifications and privacy",
    soon: true,
  },
];

function formatMemberSince(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function CustomerSettingsPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const customerId = user?.customer_id || "";

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

  const { data: profile } = useGetCustomerProfileQuery(customerId, { skip: !customerId });
  const { data: diningBookings = [] } = useGetCustomerBookingsQuery(customerId, { skip: !customerId });
  const { data: eventBookings = [] } = useGetCustomerEventBookingsQuery(customerId, { skip: !customerId });

  const totalBookings = diningBookings.length + eventBookings.length;
  const displayName = profile?.name || user?.name || user?.email?.split("@")[0] || "Guest";
  const email = profile?.email || user?.email || "";
  const phone = profile?.phone || user?.phone || "";
  const initial = displayName.charAt(0).toUpperCase();

  const handleLogout = () => {
    dispatch(clearCredentials());
    localStorage.removeItem("token_customer");
    localStorage.removeItem("user_customer");
    window.dispatchEvent(new Event("auth_changed"));
    router.push("/login");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] pt-24 text-center text-slate-500">Loading...</div>
    );
  }

  return (
    <div className=" bg-[#f4f5f7] pt-10 pb-16">
      <div className="max-w-5xl mx-auto px-4 ">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-[#1B5E3B]">My Account</h1>
            <p className="text-slate-500 mt-1">Manage your account and preferences</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-600 bg-white text-sm font-semibold text-red-600 hover:bg-red-100 cursor-pointer shrink-0"
          >
            <LogOut size={16} /> Log Out
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 md:divide-x md:divide-slate-200">
            <div className="flex items-center gap-4 md:pr-6">
              <div className="w-16 h-16 rounded-full bg-[#E8F5EE] text-[#1B5E3B] flex items-center justify-center text-2xl font-bold shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[#1B5E3B] text-lg truncate">{displayName}</p>
                {email && <p className="text-sm text-slate-600 truncate">{email}</p>}
                {phone && (
                  <p className="text-sm text-slate-600 mt-0.5 flex items-center gap-1.5">
                    <Phone size={13} className="text-slate-400 shrink-0" />
                    {phone}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 md:px-6">
              <div className="w-11 h-11 rounded-full bg-[#E8F5EE] text-[#1B5E3B] flex items-center justify-center shrink-0">
                <Calendar size={18} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Member Since</p>
                <p className="font-bold text-[#1B5E3B]">{formatMemberSince(profile?.created_at)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 md:pl-6">
              <div className="w-11 h-11 rounded-full bg-[#E8F5EE] text-[#1B5E3B] flex items-center justify-center shrink-0">
                <Bookmark size={18} />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Bookings</p>
                <p className="font-bold text-[#1B5E3B]">
                  {totalBookings} {totalBookings === 1 ? "Booking" : "Bookings"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-extrabold text-[#1B5E3B] mb-4">Account Settings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {SETTINGS_LINKS.map((item) => (
            <Link
              key={item.title}
              href={item.soon ? "#" : item.href}
              onClick={(e) => {
                if (item.soon) {
                  e.preventDefault();
                  toast.message("Coming soon");
                }
              }}
              className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 hover:border-[#1B5E3B]/30 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#E8F5EE] text-[#1B5E3B] flex items-center justify-center shrink-0">
                <item.icon size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 flex items-center gap-2">
                  {item.title}
                  {item.title === "Offers" && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#E8F5EE] text-[#1B5E3B]">
                      Soon
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
              </div>
              <ChevronRight size={18} className="text-slate-300 shrink-0" />
            </Link>
          ))}
        </div>

        <div className="rounded-2xl bg-[#a8edc8] px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white text-[#1B5E3B] flex items-center justify-center shrink-0">
            <Headphones size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900">Need help?</p>
            <p className="text-sm text-slate-600">
              Our support team is here to help you with any questions or concerns.
            </p>
          </div>
          <Link
            href="/customer/help"
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-[#1B5E3B] bg-white text-sm font-semibold text-green-800 hover:bg-white/80 shrink-0"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
