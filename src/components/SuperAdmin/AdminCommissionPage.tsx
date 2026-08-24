"use client";
import { useState } from 'react';
import { useGetCommissionLedgerQuery } from '@/services/api';
import { formatDate } from '@/lib/dateFormat';
import { formatMoney } from '@/lib/currencyFormat';
import { AdminListShimmer } from '@/components/Shared/Shimmer';

const money = formatMoney;

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
    return <AdminListShimmer rows={6} columns={8} showToolbar showTabs={false} />;
  }

  const rows = data?.rows || [];
  const totals = data?.totals;

  return (
    <div className="w-full">
      <div className="admin-list-toolbar">
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
          <div className="text-[0.625rem] text-zinc-500 mt-1">From customers</div>
        </div>
        <div className="glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wider">Commission</div>
          <div className="text-2xl font-bold text-violet-400 mt-1">
            {money(totals?.commission_total)}
          </div>
          <div className="text-[0.625rem] text-zinc-500 mt-1">From organizers</div>
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

      {rows.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/5 text-center py-10 text-zinc-500">
          No fee data yet. Bookings will appear once customers purchase tickets.
        </div>
      ) : (
        <>
          <div className="admin-card-grid">
            {rows.map((row, idx) => (
              <article key={idx} className="admin-data-card">
                <div className="admin-data-card-header">
                  {groupBy === 'event' && (
                    <p className="admin-data-card-title">{row.event_name}</p>
                  )}
                  {groupBy === 'business' && (
                    <p className="admin-data-card-title">{row.organizer_name || '—'}</p>
                  )}
                  {groupBy === 'date' && (
                    <p className="admin-data-card-title">
                      {row.booking_date ? formatDate(row.booking_date) : '—'}
                    </p>
                  )}
                </div>
                <div className="admin-data-card-body">
                  {groupBy === 'event' && (
                    <>
                      <div className="admin-data-card-row">
                        <span className="admin-data-card-label">Organizer</span>
                        <div className="admin-data-card-value">{row.organizer_name || '—'}</div>
                      </div>
                      <div className="admin-data-card-row">
                        <span className="admin-data-card-label">Rates</span>
                        <div className="admin-data-card-value text-sm">
                          {Number(row.convenience_fee_percent || 0).toFixed(2)}% convenience
                          <div className="text-xs text-zinc-500">
                            {Number(row.commission_percent || 0).toFixed(2)}% commission
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Tickets</span>
                    <div className="admin-data-card-value">{row.tickets_sold}</div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Ticket $</span>
                    <div className="admin-data-card-value">{money(row.ticket_amount)}</div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Convenience</span>
                    <div className="admin-data-card-value text-amber-400">{money(row.convenience_fee_total)}</div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Commission</span>
                    <div className="admin-data-card-value text-violet-400">{money(row.commission_total)}</div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Platform</span>
                    <div className="admin-data-card-value text-rose-400 font-medium">
                      {money(row.platform_earned)}
                    </div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Org payout</span>
                    <div className="admin-data-card-value text-emerald-400">{money(row.organizer_payout)}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="admin-table-desktop glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
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
                            <div>{Number(row.convenience_fee_percent || 0).toFixed(2)}% convenience</div>
                            <div className="text-xs text-zinc-500">
                              {Number(row.commission_percent || 0).toFixed(2)}% commission
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
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
