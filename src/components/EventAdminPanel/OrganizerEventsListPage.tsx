"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MoreVertical, Plus, Search } from "lucide-react";
import { useGetOrganizerEventsQuery } from "@/services/api";
import { contractStatusLabel, organizerWorkflowLabel } from "@/lib/contractPlaceholders";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Live", value: "LIVE" },
  { label: "Approved", value: "APPROVED" },
  { label: "Pending", value: "PENDING_APPROVAL" },
  { label: "Draft", value: "DRAFT" },
  { label: "Closed", value: "CLOSED" },
];

function statusPill(status: string) {
  const map: Record<string, string> = {
    PENDING_APPROVAL: "metric-warning",
    APPROVED: "metric-info",
    LIVE: "metric-positive",
    DRAFT: "bg-muted text-muted-foreground",
    CLOSED: "bg-rose-50 text-rose-700",
  };
  return map[status] || "bg-muted text-muted-foreground";
}

function formatEventDate(startsAt?: string | null, endsAt?: string | null): string {
  if (!startsAt) return "—";
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return "—";
  const startLabel = start.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (!endsAt) return startLabel;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return startLabel;
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return startLabel;
  const endLabel = end.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

function formatEventTime(startsAt?: string | null): string {
  if (!startsAt) return "";
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function OrganizerEventsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const queryArg = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    [search, statusFilter, page]
  );
  const { data, isLoading } = useGetOrganizerEventsQuery(queryArg);
  const events = data?.items ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-end">
        <Link href="/organizer/events/new" className="btn-primary inline-flex items-center gap-2 w-fit">
          <Plus size={18} /> Create event
        </Link>
      </div>

      <section className="org-card p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search events or venues"
              className="input-field w-full !pl-9 !py-2.5 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value;
              return (
                <button
                  key={f.value || "all"}
                  type="button"
                  onClick={() => {
                    setStatusFilter(f.value);
                    setPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="py-14 text-center text-muted-foreground text-sm">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-muted-foreground mb-3 text-sm">No events match this filter.</p>
            <Link href="/organizer/events/new" className="text-primary text-sm font-semibold hover:underline">
              Create your first event →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-left min-w-[780px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-3 py-3 font-semibold">Date</th>
                  <th className="px-3 py-3 font-semibold">Event</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Contract</th>
                  <th className="px-3 py-3 font-semibold">Visible</th>
                  <th className="px-3 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-3 py-4 whitespace-nowrap align-top">
                      <p className="text-sm font-semibold text-foreground">
                        {formatEventDate(event.event_starts_at, event.event_ends_at)}
                      </p>
                      {formatEventTime(event.event_starts_at) && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatEventTime(event.event_starts_at)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-4 align-top">
                      <Link
                        href={`/organizer/events/${event.id}`}
                        className="font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {event.name}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {event.category_name || "—"}
                      </p>
                      {event.rejection_reason && (
                        <p className="text-xs text-destructive mt-1 line-clamp-1">
                          Rejected: {event.rejection_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-4 align-top">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusPill(event.status)}`}
                      >
                        {organizerWorkflowLabel(event)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-sm text-muted-foreground align-top">
                      {event.contract
                        ? contractStatusLabel(event.contract.status, {
                            eventStatus: event.status,
                          })
                        : "Waiting for Super Admin"}
                    </td>
                    <td className="px-3 py-4 text-sm text-muted-foreground align-top">
                      {event.is_visible ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-4 text-right align-top">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/organizer/events/${event.id}`}
                          className="text-sm font-semibold text-primary hover:opacity-80"
                        >
                          {event.status === "DRAFT" || event.status === "PENDING_APPROVAL"
                            ? "Edit"
                            : "View"}
                        </Link>
                        {event.contract && (
                          <Link
                            href={`/organizer/events/${event.id}/contract`}
                            className="text-sm font-medium text-foreground/70 hover:text-primary"
                          >
                            {event.contract.organizer_signed_at ? "Contract" : "Sign →"}
                          </Link>
                        )}
                        <span className="text-muted-foreground/50 p-1" aria-hidden>
                          <MoreVertical size={16} />
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data?.meta && (
          <div className="pt-2 border-t border-border">
            <Pagination meta={data.meta} onPageChange={setPage} />
          </div>
        )}
      </section>
    </div>
  );
}
