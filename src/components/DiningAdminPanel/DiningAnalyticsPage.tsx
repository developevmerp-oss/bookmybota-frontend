"use client";
import { useEffect } from "react";
import Link from "next/link";
import {
  FaCalendarAlt,
  FaUserFriends,
  FaWalking,
  FaSearchMinus,
} from "react-icons/fa";
import { useGetAnalyticsQuery, useGetBusinessBookingsQuery } from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatDateTime12h } from "@/lib/dateFormat";

export default function AnalyticsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id ?? "";
  const { data: stats, isLoading } = useGetAnalyticsQuery(bizId, { skip: !bizId });
  const { data: bookingsData } = useGetBusinessBookingsQuery(bizId, { skip: !bizId });
  const allBookings = bookingsData?.items ?? [];

  if (isLoading || !user) {
    return <div className="text-slate-500 p-10 text-center">Loading Analytics...</div>;
  }

  const onlineCount = stats?.sources?.find((s) => s.booking_source === "ONLINE")?.count || 0;
  const walkinCount = stats?.sources?.find((s) => s.booking_source === "WALK_IN")?.count || 0;
  const cancelledCount = stats?.statuses?.find((s) => s.status === "CANCELLED")?.count || 0;
  const cancellationRate = stats?.total_bookings
    ? Math.round((cancelledCount / stats.total_bookings) * 100)
    : 0;

  const recentBookings = allBookings.slice(0, 5);

  const countCards = [
    {
      label: "Total Bookings",
      value: stats?.total_bookings ?? 0,
      icon: FaCalendarAlt,
      iconWrap: "bg-rose-50 text-[#e11d48]",
    },
    {
      label: "Online Reservations",
      value: onlineCount,
      icon: FaUserFriends,
      iconWrap: "bg-violet-50 text-violet-600",
    },
    {
      label: "Walk-ins",
      value: walkinCount,
      icon: FaWalking,
      iconWrap: "bg-orange-50 text-orange-500",
    },
    {
      label: "Cancellation Rate",
      value: `${cancellationRate}%`,
      icon: FaSearchMinus,
      iconWrap: "bg-sky-50 text-sky-600",
      hint: `${cancelledCount} total cancellations`,
    },
  ];

  return (
    <div className="-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8 animate-fadeIn">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Analytics Dashboard</h2>
          <p className="text-slate-500 mt-1">
            Track your venue&apos;s performance and booking trends.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {countCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-start gap-4"
              >
                <span
                  className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${card.iconWrap}`}
                >
                  <Icon size={18} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-xs font-semibold text-slate-500">{card.label}</p>
                  <p className="text-3xl font-bold text-slate-900 tabular-nums mt-1 leading-none">
                    {card.value}
                  </p>
                  {card.hint ? (
                    <p className="text-[11px] text-slate-400 mt-2">{card.hint}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Booking Sources</h3>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">Online Platform</span>
                  <span className="text-slate-800 font-semibold tabular-nums">{onlineCount}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-sky-500 h-2 rounded-full"
                    style={{
                      width: `${
                        stats?.total_bookings ? (onlineCount / stats.total_bookings) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">Manual Walk-ins</span>
                  <span className="text-slate-800 font-semibold tabular-nums">{walkinCount}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-violet-500 h-2 rounded-full"
                    style={{
                      width: `${
                        stats?.total_bookings ? (walkinCount / stats.total_bookings) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-slate-900">Live Booking Feed</h3>
              <Link
                href="/business/bookings"
                className="text-sm font-semibold text-sky-600 hover:text-sky-700 transition-colors"
              >
                View All
              </Link>
            </div>
            {recentBookings.length === 0 ? (
              <div className="text-center text-slate-400 py-10 text-sm">No recent bookings</div>
            ) : (
              <div className="space-y-3">
                {recentBookings.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-10 w-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                        <FaUserFriends size={16} />
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {b.customer_name}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatDateTime12h(b.booking_time)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                          b.booking_source === "ONLINE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-violet-50 text-violet-700 border border-violet-100"
                        }`}
                      >
                        {b.booking_source}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {b.table_number ? `Table ${b.table_number}` : "Unassigned"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
