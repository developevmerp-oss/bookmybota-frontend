"use client";
import { useState } from 'react';
import { useGetCommissionLedgerQuery } from '@/services/api';
import { formatDate } from '@/lib/dateFormat';

function money(v: number | string | undefined) {
  return `₹${Number(v || 0).toFixed(2)}`;
}

export default function AdminCommissionPage() {
  const [groupBy, setGroupBy] = useState<'event' | 'business' | 'date'>('event');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data, isLoading } = useGetCommissionLedgerQuery({
    group_by: groupBy,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  if (isLoading) {
    return <div className="text-white p-10 text-center">Loading Fees Ledger...</div>;
  }

  const rows = data?.rows || [];
  const totals = data?.totals;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Fees & Commission Ledger</h2>
          <p className="text-zinc-400">
            Convenience fee from customers + commission % from organizers (confirmed / used bookings).
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-zinc-900/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div className="flex gap-1">
            {(['event', 'business', 'date'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border capitalize ${
                  groupBy === g
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'text-zinc-400 border-white/10 hover:bg-white/5'
                }`}
              >
                By {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Ticket amount</div>
          <div className="text-2xl font-bold text-white mt-1">{money(totals?.ticket_amount)}</div>
        </div>
        <div className="glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Convenience fee</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {money(totals?.convenience_fee_total)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">From customers</div>
        </div>
        <div className="glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Commission</div>
          <div className="text-2xl font-bold text-violet-400 mt-1">
            {money(totals?.commission_total)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">From organizers</div>
        </div>
        <div className="glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Platform earned</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">
            {money(totals?.platform_earned)}
          </div>
        </div>
        <div className="glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Organizer payout</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {money(totals?.organizer_payout)}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-x-auto">
        <table className="w-full text-left min-w-[900px]">
          <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400 text-sm">
            <tr>
              {groupBy === 'event' && (
                <>
                  <th className="px-6 py-4 font-medium">Event</th>
                  <th className="px-6 py-4 font-medium">Organizer</th>
                  <th className="px-6 py-4 font-medium">Rates</th>
                </>
              )}
              {groupBy === 'business' && (
                <th className="px-6 py-4 font-medium">Organizer</th>
              )}
              {groupBy === 'date' && (
                <th className="px-6 py-4 font-medium">Date</th>
              )}
              <th className="px-6 py-4 font-medium">Tickets</th>
              <th className="px-6 py-4 font-medium">Ticket $</th>
              <th className="px-6 py-4 font-medium">Convenience</th>
              <th className="px-6 py-4 font-medium">Commission</th>
              <th className="px-6 py-4 font-medium">Platform</th>
              <th className="px-6 py-4 font-medium">Org payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-white/5 transition-colors">
                {groupBy === 'event' && (
                  <>
                    <td className="px-6 py-4 font-medium text-white">{row.event_name}</td>
                    <td className="px-6 py-4 text-zinc-400">{row.organizer_name || '—'}</td>
                    <td className="px-6 py-4 text-zinc-300 text-sm">
                      <div>₹{Number(row.convenience_fee_per_ticket || 0).toFixed(2)}/tkt</div>
                      <div className="text-xs text-zinc-500">
                        {Number(row.commission_percent || 0).toFixed(2)}%
                      </div>
                    </td>
                  </>
                )}
                {groupBy === 'business' && (
                  <td className="px-6 py-4 font-medium text-white">
                    {row.organizer_name || '—'}
                  </td>
                )}
                {groupBy === 'date' && (
                  <td className="px-6 py-4 font-medium text-white">
                    {row.booking_date ? formatDate(row.booking_date) : '—'}
                  </td>
                )}
                <td className="px-6 py-4 text-zinc-300">{row.tickets_sold}</td>
                <td className="px-6 py-4 text-zinc-300">{money(row.ticket_amount)}</td>
                <td className="px-6 py-4 text-amber-400">{money(row.convenience_fee_total)}</td>
                <td className="px-6 py-4 text-violet-400">{money(row.commission_total)}</td>
                <td className="px-6 py-4 text-rose-400 font-medium">
                  {money(row.platform_earned)}
                </td>
                <td className="px-6 py-4 text-emerald-400">{money(row.organizer_payout)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={groupBy === 'event' ? 9 : 7}
                  className="text-center py-10 text-zinc-500"
                >
                  No fee data yet. Bookings will appear once customers purchase tickets.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
