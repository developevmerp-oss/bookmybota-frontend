"use client";
import { Users, Store, CalendarCheck, TrendingUp } from 'lucide-react';
import { useGetAdminStatsQuery } from '@/services/api';

export default function GlobalDashboard() {
  const { data: stats, isLoading } = useGetAdminStatsQuery();

  if (isLoading) return <div className="text-white p-10 text-center">Loading live metrics...</div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="glass-panel p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-rose-500/10 rounded-lg text-rose-500"><CalendarCheck size={24} /></div>
            <h3 className="text-zinc-400 font-medium">Total Bookings</h3>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.total_bookings}</p>
          <p className="text-xs text-green-400 mt-2">Live from Database</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500"><Users size={24} /></div>
            <h3 className="text-zinc-400 font-medium">Active Users</h3>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.active_users}</p>
          <p className="text-xs text-green-400 mt-2">Live from Database</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500"><Store size={24} /></div>
            <h3 className="text-zinc-400 font-medium">Active Businesses</h3>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.active_businesses}</p>
          <p className="text-xs text-green-400 mt-2">Live from Database</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-white/5">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-500/10 rounded-lg text-green-500"><TrendingUp size={24} /></div>
            <h3 className="text-zinc-400 font-medium">Platform Revenue</h3>
          </div>
          <p className="text-3xl font-bold text-white">${stats?.platform_revenue?.toFixed(2)}</p>
          <p className="text-xs text-green-400 mt-2">Calculated in real-time</p>
        </div>
      </div>

      <div className="glass-panel p-8 rounded-2xl border border-white/5">
        <h2 className="text-xl font-semibold text-white mb-6">Recent Platform Activity</h2>
        <div className="space-y-4">
          <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-sm text-white">System is fully operational.</p>
              <p className="text-xs text-zinc-500 mt-1">Metrics above are dynamically fetched from your PostgreSQL database.</p>
            </div>
            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-lg uppercase tracking-wider">Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
