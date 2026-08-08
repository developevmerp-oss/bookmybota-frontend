"use client";
import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Radio, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useGetAdminEventDetailQuery, useUpdateAdminEventMutation } from '@/services/api';
import { formatDateTime12h } from '@/lib/dateFormat';

export default function AdminEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: event, isLoading } = useGetAdminEventDetailQuery(id);
  const [updateEvent, { isLoading: isUpdating }] = useUpdateAdminEventMutation();
  const [convenienceFee, setConvenienceFee] = useState<string | null>(null);
  const [commissionPercent, setCommissionPercent] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const convenienceValue =
    convenienceFee ?? String(event?.convenience_fee_per_ticket ?? 0);
  const commissionValue =
    commissionPercent ?? String(event?.commission_percent ?? 0);

  const feePayload = () => ({
    convenience_fee_per_ticket: Number(convenienceValue) || 0,
    commission_percent: Number(commissionValue) || 0,
  });

  const handleAction = async (action: 'approve' | 'reject' | 'go_live' | 'close') => {
    try {
      await updateEvent({
        id,
        action,
        ...(action === 'approve' ? feePayload() : {}),
        ...(action === 'reject'
          ? { rejection_reason: rejectionReason.trim() || undefined }
          : {}),
      }).unwrap();
      toast.success('Event updated');
    } catch {
      toast.error('Update failed');
    }
  };

  const saveFees = async () => {
    try {
      await updateEvent({
        id,
        ...feePayload(),
      }).unwrap();
      toast.success('Fees saved');
    } catch {
      toast.error('Failed to save fees');
    }
  };

  if (isLoading) {
    return <div className="portal-muted p-10 text-center">Loading event...</div>;
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <p className="portal-muted mb-4">Event not found.</p>
        <Link href="/admin/events" className="text-rose-600 hover:text-rose-700">
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        href="/admin/events"
        className="inline-flex items-center gap-2 text-sm portal-muted hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to events
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="portal-heading text-2xl font-bold">{event.name}</h2>
          <p className="portal-muted mt-1">
            {event.organizer_name || 'Organizer'} · {event.category_name || 'Uncategorized'} ·{' '}
            {event.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {event.status === 'PENDING_APPROVAL' && (
            <>
              <button
                disabled={isUpdating}
                onClick={() => handleAction('approve')}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle size={16} /> Approve
              </button>
              <button
                disabled={isUpdating}
                onClick={() => handleAction('reject')}
                className="px-4 py-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-sm font-medium flex items-center gap-2"
              >
                <XCircle size={16} /> Reject
              </button>
            </>
          )}
          {event.status === 'APPROVED' && (
            <button
              disabled={isUpdating}
              onClick={() => handleAction('go_live')}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Radio size={16} /> Go Live
            </button>
          )}
          {event.status === 'LIVE' && (
            <button
              disabled={isUpdating}
              onClick={() => handleAction('close')}
              className="px-4 py-2 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 text-sm font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {event.status === 'PENDING_APPROVAL' && (
        <div className="glass-panel rounded-2xl border border-white/5 p-6">
          <label className="block text-sm font-medium text-zinc-400 mb-2">
            Rejection reason (shown to organizer if you reject)
          </label>
          <textarea
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g. Poster quality is low, please upload a clearer image..."
            className="input-field resize-y min-h-[80px] w-full"
          />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
          <h3 className="portal-heading text-lg font-semibold">Details</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="portal-muted">Language</dt>
              <dd className="text-slate-800">{event.language || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="portal-muted">Age group</dt>
              <dd className="text-slate-800">{event.age_group || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="portal-muted">Duration</dt>
              <dd className="text-slate-800">
                {event.duration_minutes ? `${event.duration_minutes} min` : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="portal-muted">Visible</dt>
              <dd className="text-slate-800">{event.is_visible ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
          {event.about_event && (
            <p className="portal-muted text-sm pt-2 border-t border-slate-200">
              {event.about_event}
            </p>
          )}
        </div>

        <div className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
          <h3 className="portal-heading text-lg font-semibold">Fees</h3>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Convenience fee (₹ / ticket)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={convenienceValue}
              onChange={(e) => setConvenienceFee(e.target.value)}
              className="input-field"
            />
            <p className="text-xs text-zinc-500 mt-1">Paid by the customer.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Commission (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={commissionValue}
              onChange={(e) => setCommissionPercent(e.target.value)}
              className="input-field"
            />
            <p className="text-xs text-zinc-500 mt-1">
              Taken from the organizer on ticket amount.
            </p>
          </div>
          <button
            disabled={isUpdating}
            onClick={saveFees}
            className="btn-primary w-full disabled:opacity-50"
          >
            Save fees
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-6">
        <h3 className="portal-heading text-lg font-semibold mb-4">Ticket types</h3>
        {event.ticket_types && event.ticket_types.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-400 border-b border-white/5">
              <tr>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 font-medium">Price</th>
                <th className="py-2 font-medium">Available</th>
                <th className="py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              {event.ticket_types.map((t) => (
                <tr key={t.id}>
                  <td className="py-3">{t.ticket_type}</td>
                  <td className="py-3">₹{Number(t.price).toFixed(2)}</td>
                  <td className="py-3">{t.available_count}</td>
                  <td className="py-3">{t.total_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-zinc-500 text-sm">No ticket types yet (partner will add).</p>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-6">
        <h3 className="portal-heading text-lg font-semibold mb-4">Showtimes</h3>
        {event.showtimes && event.showtimes.length > 0 ? (
          <ul className="space-y-3">
            {event.showtimes.map((s) => (
              <li key={s.id} className="text-sm portal-table-muted border-b border-slate-200 pb-3">
                <div className="font-medium portal-heading">{s.venue_name || 'Venue TBD'}</div>
                <div className="portal-muted">{s.venue_address}</div>
                <div className="text-slate-700 mt-1">
                  {formatDateTime12h(s.starts_at)}
                  {s.ends_at ? ` → ${formatDateTime12h(s.ends_at)}` : ''}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-zinc-500 text-sm">No showtimes yet.</p>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 p-6">
        <h3 className="portal-heading text-lg font-semibold mb-4">Recent bookings</h3>
        {event.bookings && event.bookings.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-400 border-b border-white/5">
              <tr>
                <th className="py-2 font-medium">Guest</th>
                <th className="py-2 font-medium">Tickets</th>
                <th className="py-2 font-medium">Convenience</th>
                <th className="py-2 font-medium">Commission</th>
                <th className="py-2 font-medium">Customer total</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              {event.bookings.map((b: any) => (
                <tr key={b.id}>
                  <td className="py-3">{b.guest_name || b.guest_email || '—'}</td>
                  <td className="py-3">{b.ticket_qty}</td>
                  <td className="py-3">₹{Number(b.convenience_fee_total || 0).toFixed(2)}</td>
                  <td className="py-3">₹{Number(b.commission_total || 0).toFixed(2)}</td>
                  <td className="py-3">₹{Number(b.grand_total || 0).toFixed(2)}</td>
                  <td className="py-3">{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-zinc-500 text-sm">No bookings yet.</p>
        )}
      </div>
    </div>
  );
}
