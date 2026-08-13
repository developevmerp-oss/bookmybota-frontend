"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useGetOrganizerEventsQuery } from "@/services/api";
import { contractStatusLabel, organizerWorkflowLabel } from "@/lib/contractPlaceholders";
const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Pending", value: "PENDING_APPROVAL" },
  { label: "Approved", value: "APPROVED" },
  { label: "Live", value: "LIVE" },
  { label: "Closed", value: "CLOSED" },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING_APPROVAL: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    APPROVED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    LIVE: "bg-green-500/10 text-green-400 border-green-500/20",
    DRAFT: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    CLOSED: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  return map[status] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
}

export default function OrganizerEventsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const queryArg = useMemo(
    () => ({
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    [search, statusFilter]
  );
  const { data: events = [], isLoading } = useGetOrganizerEventsQuery(queryArg);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="portal-heading text-2xl font-bold">My Events</h2>
          <p className="portal-muted mt-1">
            Create events, upload posters & documents, submit for review, then sign the platform contract.
          </p>
        </div>
        <Link href="/organizer/events/new" className="btn-primary inline-flex items-center gap-2 w-fit">
          <Plus size={18} /> Create event
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event name..."
            className="input-field pl-9 w-full"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || "all"}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                statusFilter === f.value
                  ? "bg-violet-500/10 text-violet-400 border-violet-500/30"
                  : "text-zinc-400 border-white/10 hover:bg-white/5"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-zinc-500">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-zinc-500 mb-4">No events yet.</p>
            <Link href="/organizer/events/new" className="text-violet-400 hover:text-violet-300 text-sm font-medium">
              Create your first event →
            </Link>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400 text-sm">
              <tr>
                <th className="px-6 py-4 font-medium">Event</th>
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Contract</th>
                <th className="px-6 py-4 font-medium">Visible</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      href={`/organizer/events/${event.id}`}
                      className="font-medium portal-table-link hover:text-violet-600"
                    >
                      {event.name}
                    </Link>
                    {event.rejection_reason && (
                      <p className="text-xs text-rose-400/80 mt-0.5 line-clamp-1">
                        Rejected: {event.rejection_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 portal-table-muted">{event.category_name || "—"}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${statusBadge(event.status)}`}
                    >
                      {organizerWorkflowLabel(event)}
                    </span>
                  </td>
                  <td className="px-6 py-4 portal-table-muted text-sm">
                    {event.contract
                      ? contractStatusLabel(event.contract.status)
                      : "Waiting for Super Admin"}
                  </td>
                  <td className="px-6 py-4 text-zinc-400 text-sm">
                    {event.is_visible ? "Yes" : "No"}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <Link
                      href={`/organizer/events/${event.id}`}
                      className="text-sm text-violet-400 hover:text-violet-300"
                    >
                      {event.status === "DRAFT" || event.status === "PENDING_APPROVAL"
                        ? "Edit"
                        : "View"}
                    </Link>
                    {event.contract && (
                      <Link
                        href={`/organizer/events/${event.id}/contract`}
                        className="text-sm text-violet-600 hover:text-violet-800 font-medium"
                      >
                        {event.contract.organizer_signed_at ? "View contract" : "Sign contract →"}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
