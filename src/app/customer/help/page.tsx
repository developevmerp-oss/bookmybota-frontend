"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Ticket, ChevronRight } from "lucide-react";
import { useGetCustomerBookingsQuery } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";

const FAQ_CATEGORIES = [
  {
    title: "Bookings & Reservations",
    items: [
      {
        q: "How do I book a table?",
        a: "Open a restaurant, tap Book a Table, choose date, time and guests, then confirm.",
      },
      {
        q: "Can I cancel a reservation?",
        a: "Yes. Go to My Bookings, open the booking, and tap Cancel if it is still upcoming.",
      },
      {
        q: "How do I book event tickets?",
        a: "Open an event, tap Book tickets, choose a showtime and quantities, review the convenience fee, then confirm.",
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        q: "How do I update my profile?",
        a: "Open Profile from the header or Settings and edit your name, phone, or email.",
      },
      {
        q: "I did not receive an OTP",
        a: "Demo OTP is currently 123456. Real SMS OTP will be enabled later.",
      },
    ],
  },
];

export default function CustomerHelpPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [findQuery, setFindQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

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

  const customerId = user?.customer_id ?? "";
  const { data: bookings = [] } = useGetCustomerBookingsQuery(customerId, { skip: !customerId });

  const foundBookings = useMemo(() => {
    const q = findQuery.trim().toLowerCase();
    if (!q) return [];
    return bookings.filter((b) => {
      const phone = (b.guest_phone || b.customer_phone || "").toLowerCase();
      const name = (b.guest_name || b.customer_name || "").toLowerCase();
      const biz = (b.business_name || "").toLowerCase();
      const id = b.id.toLowerCase();
      return phone.includes(q) || name.includes(q) || biz.includes(q) || id.includes(q);
    });
  }, [bookings, findQuery]);

  if (!user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#f4f5f7] flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <CustomerAccountLayout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 mb-8">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Ticket size={18} className="text-rose-600" /> Find your ticket
          </h2>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              placeholder="Search by phone, name, restaurant, or booking ID"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            />
          </div>
          {findQuery.trim() && (
            <div className="space-y-2">
              {foundBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching bookings found.</p>
              ) : (
                foundBookings.slice(0, 5).map((b) => (
                  <Link
                    key={b.id}
                    href={`/customer/bookings/${b.id}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-rose-300 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{b.business_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(b.booking_time).toLocaleString()} · {b.status}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {FAQ_CATEGORIES.map((cat) => (
            <section key={cat.title}>
              <h2 className="font-semibold text-foreground mb-3">{cat.title}</h2>
              <div className="glass-panel rounded-2xl border border-border divide-y divide-border overflow-hidden">
                {cat.items.map((item) => {
                  const key = `${cat.title}-${item.q}`;
                  const open = openFaq === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setOpenFaq(open ? null : key)}
                      className="w-full text-left p-4 hover:bg-accent/40 transition-colors cursor-pointer"
                    >
                      <p className="text-sm font-medium text-foreground">{item.q}</p>
                      {open && (
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{item.a}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
    </CustomerAccountLayout>
  );
}
