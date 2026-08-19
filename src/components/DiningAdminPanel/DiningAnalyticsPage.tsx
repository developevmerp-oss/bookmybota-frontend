"use client";
import { useEffect } from 'react';
import { TrendingUp, Users, Calendar, AlertTriangle } from 'lucide-react';
import { useGetAnalyticsQuery, useGetBusinessBookingsQuery } from '@/services/api';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { loadFromStorage } from '@/features/auth/authSlice';

export default function AnalyticsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => { dispatch(loadFromStorage()); }, [dispatch]);

  const bizId = user?.business_id ?? '';
  const { data: stats, isLoading } = useGetAnalyticsQuery(bizId, { skip: !bizId });
  const { data: bookingsData } = useGetBusinessBookingsQuery(bizId, { skip: !bizId });
  const allBookings = bookingsData?.items ?? [];

  if (isLoading || !user) return <div className="text-white p-10 text-center">Loading Analytics...</div>;

  const onlineCount = stats?.sources?.find((s) => s.booking_source === 'ONLINE')?.count || 0;
  const walkinCount = stats?.sources?.find((s) => s.booking_source === 'WALK_IN')?.count || 0;
  const cancelledCount = stats?.statuses?.find((s) => s.status === 'CANCELLED')?.count || 0;
  const cancellationRate = stats?.total_bookings ? Math.round((cancelledCount / stats.total_bookings) * 100) : 0;

  const recentBookings = allBookings.slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
          <p className="text-zinc-400">Track your venue's performance and booking trends.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 text-white/5 group-hover:text-rose-500/10 transition-colors"><TrendingUp size={100} /></div>
          <p className="text-zinc-400 text-sm font-medium mb-1">Total Bookings</p>
          <p className="text-4xl font-bold text-white">{stats?.total_bookings}</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 text-white/5 group-hover:text-blue-500/10 transition-colors"><Calendar size={100} /></div>
          <p className="text-zinc-400 text-sm font-medium mb-1">Online Reservations</p>
          <p className="text-4xl font-bold text-white">{onlineCount}</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 text-white/5 group-hover:text-purple-500/10 transition-colors"><Users size={100} /></div>
          <p className="text-zinc-400 text-sm font-medium mb-1">Walk-ins</p>
          <p className="text-4xl font-bold text-white">{walkinCount}</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 text-white/5 group-hover:text-rose-500/10 transition-colors"><AlertTriangle size={100} /></div>
          <p className="text-zinc-400 text-sm font-medium mb-1">Cancellation Rate</p>
          <p className="text-4xl font-bold text-white">{cancellationRate}%</p>
          <p className="text-xs text-zinc-500 mt-2">{cancelledCount} total cancellations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Booking Sources */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5">
          <h3 className="text-lg font-bold text-white mb-6">Booking Sources</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-400">Online Platform</span>
                <span className="text-white font-medium">{onlineCount}</span>
              </div>
              <div className="w-full bg-zinc-850 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${stats?.total_bookings ? (onlineCount / stats.total_bookings) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-400">Manual Walk-ins</span>
                <span className="text-white font-medium">{walkinCount}</span>
              </div>
              <div className="w-full bg-zinc-850 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${stats?.total_bookings ? (walkinCount / stats.total_bookings) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Live Booking Feed */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5">
          <h3 className="text-lg font-bold text-white mb-6">Live Booking Feed</h3>
          {recentBookings.length === 0 ? (
            <div className="text-center text-zinc-500 py-10">No recent bookings</div>
          ) : (
            <div className="space-y-4">
              {recentBookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl border border-white/5">
                  <div>
                    <h3 className="text-white font-medium">{b.customer_name}</h3>
                    <p className="text-sm text-zinc-400">{new Date(b.booking_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${b.booking_source === 'ONLINE' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>{b.booking_source}</span>
                    <span className="text-xs text-zinc-500">{b.table_number ? `Table ${b.table_number}` : 'Unassigned'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
