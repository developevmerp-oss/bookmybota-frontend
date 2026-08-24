"use client";
import { Users, Store, CalendarCheck, TrendingUp } from 'lucide-react';
import { useGetAdminStatsQuery } from '@/services/api';

export default function GlobalDashboard() {
  const { data: stats, isLoading } = useGetAdminStatsQuery();

  if (isLoading) return <div className="text-white p-[2rem] sm:p-[2.5rem] text-center text-sm sm:text-base">Loading live metrics...</div>;

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[0.75rem] sm:gap-[1rem] lg:gap-[1.25rem] 2xl:gap-[1.5rem] mb-[1.25rem] sm:mb-[1.5rem] lg:mb-[2rem]">
        <div className="glass-panel p-[1rem] sm:p-[1.25rem] lg:p-[1.5rem] rounded-2xl border border-white/5">
          <div className="flex items-center gap-[0.75rem] sm:gap-[1rem] mb-[0.75rem] sm:mb-[1rem]">
            <div className="p-[0.65rem] bg-rose-500/10 rounded-lg text-rose-500"><CalendarCheck size={22} /></div>
            <h3 className="text-zinc-400 font-medium text-sm sm:text-base">Total Bookings</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{stats?.total_bookings}</p>
          <p className="text-xs text-green-400 mt-[0.5rem]">Live from Database</p>
        </div>

        <div className="glass-panel p-[1rem] sm:p-[1.25rem] lg:p-[1.5rem] rounded-2xl border border-white/5">
          <div className="flex items-center gap-[0.75rem] sm:gap-[1rem] mb-[0.75rem] sm:mb-[1rem]">
            <div className="p-[0.65rem] bg-blue-500/10 rounded-lg text-blue-500"><Users size={22} /></div>
            <h3 className="text-zinc-400 font-medium text-sm sm:text-base">Active Users</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{stats?.active_users}</p>
          <p className="text-xs text-green-400 mt-[0.5rem]">Live from Database</p>
        </div>

        <div className="glass-panel p-[1rem] sm:p-[1.25rem] lg:p-[1.5rem] rounded-2xl border border-white/5">
          <div className="flex items-center gap-[0.75rem] sm:gap-[1rem] mb-[0.75rem] sm:mb-[1rem]">
            <div className="p-[0.65rem] bg-purple-500/10 rounded-lg text-purple-500"><Store size={22} /></div>
            <h3 className="text-zinc-400 font-medium text-sm sm:text-base">Active Businesses</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">{stats?.active_businesses}</p>
          <p className="text-xs text-green-400 mt-[0.5rem]">Live from Database</p>
        </div>

        <div className="glass-panel p-[1rem] sm:p-[1.25rem] lg:p-[1.5rem] rounded-2xl border border-white/5">
          <div className="flex items-center gap-[0.75rem] sm:gap-[1rem] mb-[0.75rem] sm:mb-[1rem]">
            <div className="p-[0.65rem] bg-green-500/10 rounded-lg text-green-500"><TrendingUp size={22} /></div>
            <h3 className="text-zinc-400 font-medium text-sm sm:text-base">Platform Revenue</h3>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white">${stats?.platform_revenue?.toFixed(2)}</p>
          <p className="text-xs text-green-400 mt-[0.5rem]">Calculated in real-time</p>
        </div>
      </div>

      <div className="glass-panel p-[1rem] sm:p-[1.5rem] lg:p-[2rem] rounded-2xl border border-white/5">
        <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-white mb-[1rem] sm:mb-[1.5rem]">Recent Platform Activity</h2>
        <div className="space-y-[0.75rem] sm:space-y-[1rem]">
          <div className="p-[0.75rem] sm:p-[1rem] bg-white/5 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-[0.75rem]">
            <div className="min-w-0">
              <p className="text-sm text-white">System is fully operational.</p>
              <p className="text-xs text-zinc-500 mt-[0.25rem]">Metrics above are dynamically fetched from your PostgreSQL database.</p>
            </div>
            <span className="px-[0.75rem] py-[0.25rem] bg-green-500/20 text-green-400 text-xs font-bold rounded-lg uppercase tracking-wider w-fit">Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
