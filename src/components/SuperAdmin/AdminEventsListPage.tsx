"use client";

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Eye, EyeOff, XCircle, Radio, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetAdminEventsQuery,
  useUpdateAdminEventMutation,
  type AdminEvent,
} from '@/services/api';
import SearchInput from '@/components/Shared/SearchInput';
import Pagination from '@/components/Shared/Pagination';
import { AdminListShimmer } from '@/components/Shared/Shimmer';
import { PAGE_SIZE } from '@/lib/pagination';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING_APPROVAL' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Live', value: 'LIVE' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Closed', value: 'CLOSED' },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING_APPROVAL: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    APPROVED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    LIVE: 'bg-green-500/10 text-green-400 border-green-500/20',
    DRAFT: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    CLOSED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };
  return map[status] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
}

export default function AdminEventsPage() {
  const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL');
  const [selected, setSelected] = useState<AdminEvent | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const { data, isLoading, isFetching } = useGetAdminEventsQuery({
    page,
    limit,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const events = data?.items ?? [];
  const [updateEvent, { isLoading: isUpdating }] = useUpdateAdminEventMutation();

  const openDetail = (event: AdminEvent) => {
    setSelected(event);
    setRejectionReason('');
  };

  const handleAction = async (
    action: 'approve' | 'reject' | 'go_live' | 'close',
    eventId?: string
  ) => {
    const id = eventId || selected?.id;
    if (!id) return;
    try {
      const body: {
        id: string;
        action: typeof action;
        rejection_reason?: string;
      } = { id, action };
      if (action === 'reject') {
        body.rejection_reason = rejectionReason.trim() || undefined;
      }
      await updateEvent(body).unwrap();
      toast.success(
        action === 'approve'
          ? 'Event approved'
          : action === 'reject'
            ? 'Event rejected (back to draft)'
            : action === 'go_live'
              ? 'Event is now live'
              : 'Event closed'
      );
      if (selected?.id === id) setSelected(null);
    } catch {
      toast.error('Failed to update event');
    }
  };

  const toggleVisibility = async (event: AdminEvent) => {
    try {
      await updateEvent({
        id: event.id,
        is_visible: !event.is_visible,
      }).unwrap();
      toast.success(event.is_visible ? 'Hidden from customers' : 'Visible to customers');
    } catch {
      toast.error('Failed to update visibility');
    }
  };

  if (isLoading) {
    return <AdminListShimmer rows={6} columns={6} showTabs tabCount={6} showToolbar />;
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 lg:mb-5 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-xl bg-slate-100/80 p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              type="button"
              onClick={() => {
                setStatusFilter(f.value);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                statusFilter === f.value
                  ? "bg-white text-rose-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 sm:justify-end">
          <SearchInput
            className="w-full sm:max-w-xs lg:max-w-sm"
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search event or organizer"
          />
        </div>
      </div>

      {isFetching && !isLoading ? (
        <AdminListShimmer rows={limit > 10 ? 8 : 5} columns={6} showTabs={false} showToolbar={false} />
      ) : events.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/5 text-center py-10 text-zinc-500 text-base">
          No events found for this filter.
        </div>
      ) : (
        <>
          <div className="admin-card-grid">
            {events.map((event) => (
              <article key={event.id} className="admin-data-card">
                <div className="admin-data-card-header">
                  <div className="min-w-0">
                    <button
                      onClick={() => openDetail(event)}
                      className="admin-data-card-title text-left"
                    >
                      {event.name}
                    </button>
                    <p className="text-xs text-zinc-500 mt-0.5">{event.category_name || 'Uncategorized'}</p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-1 rounded-md text-[0.6875rem] font-bold uppercase tracking-wider border ${statusBadge(event.status)}`}
                  >
                    {event.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="admin-data-card-body">
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Organizer</span>
                    <div className="admin-data-card-value">{event.organizer_name || '—'}</div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Fees</span>
                    <div className="admin-data-card-value">
                      {Number(event.convenience_fee_percent || 0).toFixed(2)}% convenience
                      <div className="text-xs text-zinc-500">
                        {Number(event.commission_percent || 0).toFixed(2)}% commission
                      </div>
                    </div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Visible</span>
                    <div className="admin-data-card-value">
                      {event.is_visible ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>
                <div className="admin-data-card-actions">
                  <button
                    onClick={() => toggleVisibility(event)}
                    className="p-2 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50"
                    title="Toggle visibility"
                  >
                    {event.is_visible ? <Eye size={17} /> : <EyeOff size={17} />}
                  </button>
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="text-sm font-medium text-zinc-600 hover:text-rose-600 px-2 py-1"
                  >
                    Details
                  </Link>
                  {event.status === 'PENDING_APPROVAL' && (
                    <button
                      onClick={() => openDetail(event)}
                      className="text-sm font-medium text-green-600 hover:text-green-700 px-2 py-1"
                    >
                      Review
                    </button>
                  )}
                  {(event.status === 'PENDING_APPROVAL' || event.status === 'APPROVED') && (
                    <Link
                      href={`/admin/event-contracts/create?eventId=${event.id}`}
                      className="text-sm font-medium text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 px-2 py-1"
                    >
                      <FileSignature size={14} /> Create contract
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="admin-table-desktop glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base">
                <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400 text-sm">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Event</th>
                    <th className="px-5 py-3.5 font-semibold">Organizer</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 font-semibold">Fees</th>
                    <th className="px-5 py-3.5 font-semibold">Visible</th>
                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-4">
                        <button
                          onClick={() => openDetail(event)}
                          className="text-left font-semibold portal-table-link hover:text-rose-600"
                        >
                          {event.name}
                        </button>
                        <div className="text-xs portal-table-muted mt-0.5">
                          {event.category_name || 'Uncategorized'}
                        </div>
                      </td>
                      <td className="px-5 py-4 portal-table-muted">{event.organizer_name || '—'}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${statusBadge(event.status)}`}
                        >
                          {event.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm portal-table-muted">
                        <div>{Number(event.convenience_fee_percent || 0).toFixed(2)}% convenience</div>
                        <div className="text-xs">
                          {Number(event.commission_percent || 0).toFixed(2)}% commission
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => toggleVisibility(event)}
                          className="text-zinc-400 hover:text-white"
                          title="Toggle visibility"
                        >
                          {event.is_visible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </td>
                      <td className="px-5 py-4 text-right space-x-2">
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="text-zinc-400 hover:text-white text-sm"
                        >
                          Details
                        </Link>
                        {event.status === 'PENDING_APPROVAL' && (
                          <button
                            onClick={() => openDetail(event)}
                            className="text-green-400 hover:text-green-300 text-sm font-medium"
                          >
                            Review
                          </button>
                        )}
                        {(event.status === 'PENDING_APPROVAL' || event.status === 'APPROVED') && (
                          <Link
                            href={`/admin/event-contracts/create?eventId=${event.id}`}
                            className="text-emerald-400 hover:text-emerald-300 text-sm font-medium inline-flex items-center gap-1"
                          >
                            <FileSignature size={14} /> Create contract
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="admin-list-footer">
        <Pagination
          meta={
            data?.meta ?? {
              page,
              limit,
              total: 0,
              total_pages: 0,
              has_prev: false,
              has_next: false,
            }
          }
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
          disabled={isFetching}
        />
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-white/10 shadow-2xl relative">
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              ✕
            </button>
            <h2 className="portal-heading text-xl font-bold mb-1">{selected.name}</h2>
            <p className="portal-muted text-sm mb-6">
              {selected.organizer_name || 'Organizer'} · {selected.status}
            </p>

            {selected.status === 'PENDING_APPROVAL' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Rejection reason (if rejecting)
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Tell the organizer what needs to be fixed..."
                  className="input-field resize-y min-h-[80px]"
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-6">
              {selected.status === 'PENDING_APPROVAL' && (
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
                    className="px-4 py-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </>
              )}
              {(selected.status === 'APPROVED' || selected.status === 'LIVE') && (
                <>
                  {selected.status === 'APPROVED' && (
                    <button
                      disabled={isUpdating}
                      onClick={() => handleAction('go_live')}
                      className="px-4 py-2 rounded-xl border border-green-500/30 text-green-400 hover:bg-green-500/10 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                      <Radio size={16} /> Go Live
                    </button>
                  )}
                  {selected.status === 'LIVE' && (
                    <button
                      disabled={isUpdating}
                      onClick={() => handleAction('close')}
                      className="px-4 py-2 rounded-xl border border-zinc-500/30 text-zinc-300 hover:bg-white/5 text-sm font-medium disabled:opacity-50"
                    >
                      Close event
                    </button>
                  )}
                </>
              )}
              <Link
                href={`/admin/event-contracts/create?eventId=${selected.id}`}
                className="px-4 py-2 rounded-xl border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-sm font-medium flex items-center gap-2"
              >
                <FileSignature size={16} /> Create contract
              </Link>
              <Link
                href={`/admin/events/${selected.id}`}
                className="px-4 py-2 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 text-sm font-medium"
              >
                Full details
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
