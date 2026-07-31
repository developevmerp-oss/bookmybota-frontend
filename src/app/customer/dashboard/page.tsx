"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  XCircle,
  User,
  ChevronRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useGetCustomerBookingsQuery, useCancelBookingMutation, Booking } from "@/services/api";
import { useAppSelector, useAppDispatch } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";

type FilterTab = "all" | "upcoming" | "past" | "cancelled";

function isUpcoming(b: Booking) {
  return new Date(b.booking_time) > new Date() && b.status === "CONFIRMED";
}

function statusStyles(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
    case "CANCELLED":
      return "bg-rose-500/10 text-rose-500 border-rose-500/20";
    case "COMPLETED":
      return "bg-sky-500/10 text-sky-600 border-sky-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
  }
}

export default function CustomerDashboard() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [filter, setFilter] = useState<FilterTab>("all");

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
  const { data: bookings = [], isLoading } = useGetCustomerBookingsQuery(customerId, {
    skip: !customerId,
  });
  const [cancelBooking] = useCancelBookingMutation();

  const counts = useMemo(() => {
    const upcoming = bookings.filter(isUpcoming).length;
    const cancelled = bookings.filter((b) => b.status === "CANCELLED").length;
    const past = bookings.filter((b) => !isUpcoming(b) && b.status !== "CANCELLED").length;
    return { all: bookings.length, upcoming, past, cancelled };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    switch (filter) {
      case "upcoming":
        return bookings.filter(isUpcoming);
      case "cancelled":
        return bookings.filter((b) => b.status === "CANCELLED");
      case "past":
        return bookings.filter((b) => !isUpcoming(b) && b.status !== "CANCELLED");
      default:
        return bookings;
    }
  }, [bookings, filter]);

  const handleCancel = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to cancel this reservation?")) return;
    try {
      await cancelBooking({ id }).unwrap();
      toast.success("Reservation cancelled");
    } catch {
      toast.error("Failed to cancel reservation");
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background pt-24 text-center text-muted-foreground">
        Loading Dashboard...
      </div>
    );
  }

  const welcomeName = user.name || user.email?.split("@")[0] || "there";
  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "upcoming", label: "Upcoming" },
    { key: "past", label: "Past" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="min-h-screen bg-background pt-10 pb-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome back, {welcomeName}!
            </h1>
            <p className="text-muted-foreground">
              Manage your reservations and view your dining history.
            </p>
          </div>
          <Link
            href="/customer/profile"
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border border-border bg-white hover:bg-accent transition-colors text-foreground"
          >
            <User size={16} /> Edit Profile
          </Link>
        </div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          <Filter size={16} className="text-muted-foreground shrink-0" />
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                filter === tab.key
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-white text-muted-foreground border-border hover:border-rose-300 hover:text-foreground"
              }`}
            >
              {tab.label} ({counts[tab.key]})
            </button>
          ))}
        </div>

        {filteredBookings.length === 0 ? (
          <div className="glass-panel p-8 rounded-2xl text-center border border-border">
            <Calendar className="mx-auto text-muted-foreground mb-3" size={32} />
            <p className="text-muted-foreground mb-4">
              {filter === "all"
                ? "You have no reservations yet."
                : `No ${filter} reservations.`}
            </p>
            <button onClick={() => router.push("/")} className="btn-primary inline-block">
              Find a Table
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredBookings.map((b) => {
              const upcoming = isUpcoming(b);
              return (
                <Link
                  key={b.id}
                  href={`/customer/bookings/${b.id}`}
                  className={`glass-panel p-5 sm:p-6 rounded-2xl border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-rose-300 hover:shadow-md transition-all group ${
                    !upcoming ? "opacity-90" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-foreground group-hover:text-rose-700 transition-colors">
                        {b.business_name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusStyles(b.status)}`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin size={14} /> {b.business_address || "Address missing"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(b.booking_time).toLocaleString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      {b.guests != null && (
                        <span className="text-xs">{b.guests} guests</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {b.table_number && (
                      <span className="px-3 py-1 bg-accent/40 border border-border rounded-lg text-sm text-muted-foreground">
                        Table {b.table_number}
                      </span>
                    )}
                    {upcoming && (
                      <button
                        onClick={(e) => handleCancel(b.id, e)}
                        className="flex items-center gap-1.5 text-sm text-rose-500 hover:text-rose-400 px-3 py-2 border border-rose-500/20 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <XCircle size={15} /> Cancel
                      </button>
                    )}
                    <ChevronRight
                      size={18}
                      className="text-slate-300 group-hover:text-rose-500 transition-colors"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
