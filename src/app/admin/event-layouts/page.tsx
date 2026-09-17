"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useGetAdminEventLayoutRequestsQuery, type AdminEventLayoutRequest } from "@/services/api";
import { formatDateTime12h } from "@/lib/dateFormat";

const TABS = [
  { id: "needs_action", label: "Needs action" },
  { id: "in_builder", label: "In builder" },
  { id: "awaiting_organizer", label: "Awaiting organizer" },
  { id: "change_requested", label: "Changes requested" },
  { id: "fulfilled", label: "Fulfilled" },
  { id: "rejected", label: "Rejected" },
] as const;

const TAB_STYLES: Record<string, string> = {
  needs_action: "bg-amber-50 text-amber-700 border-amber-200",
  in_builder: "bg-sky-50 text-sky-700 border-sky-200",
  awaiting_organizer: "bg-violet-50 text-violet-700 border-violet-200",
  change_requested: "bg-orange-50 text-orange-700 border-orange-200",
  fulfilled: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

const TAB_LABELS: Record<string, string> = {
  needs_action: "Needs action",
  in_builder: "In builder",
  awaiting_organizer: "Awaiting organizer",
  change_requested: "Changes requested",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
};

function actionLabel(tab: string) {
  if (tab === "fulfilled") return "View layout";
  if (tab === "rejected") return "View request";
  if (tab === "awaiting_organizer") return "View options";
  if (tab === "change_requested") return "Revise layout";
  if (tab === "in_builder") return "Continue building";
  return "Build layout";
}

function formatLocation(request: AdminEventLayoutRequest) {
  return [request.showtime_venue_address, request.city_name, request.city_state, request.city_country]
    .filter(Boolean)
    .join(", ");
}

function proposedCount(request: AdminEventLayoutRequest) {
  if (Array.isArray(request.proposed_template_ids)) return request.proposed_template_ids.length;
  if (Array.isArray(request.proposed_templates)) return request.proposed_templates.length;
  return 0;
}

export default function AdminEventLayoutsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("needs_action");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const { data: requests = [], isLoading } = useGetAdminEventLayoutRequestsQuery({
    tab,
    ...(search ? { q: search } : {}),
  });

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Event layouts</h2>
        <p className="text-sm text-slate-500 mt-1">
          Organizers request a custom seating layout for an event. Build one or more options in the
          studio, then send them for the organizer to confirm before the event contract.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border ${
              tab === item.id
                ? "bg-rose-50 text-rose-600 border-rose-200"
                : "border-slate-200 text-slate-500"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form
        className="relative w-full sm:w-80"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search event, organizer, venue…"
        />
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {isLoading ? (
          <p className="p-8 text-center text-slate-400">Loading event layout requests…</p>
        ) : requests.length === 0 ? (
          <p className="p-8 text-center text-slate-500">
            No layout requests in this view.
            {tab === "needs_action"
              ? " New custom layout requests appear here after an organizer submits an event."
              : ""}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => {
              const workflow = request.workflow_tab || tab;
              const location = formatLocation(request);
              const venueLabel =
                request.venue_partner_name ||
                request.venue_name ||
                request.showtime_venue_name ||
                "Venue";
              const optionsProposed = proposedCount(request);
              const draftCount = Number(request.draft_count || 0);
              const builtCount = Number(request.built_count || 0);
              return (
                <div
                  key={request.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold uppercase tracking-wider border bg-slate-50 text-slate-600 border-slate-200">
                        Event layout
                      </span>
                      <p className="text-slate-900 font-semibold">{request.layout_name}</p>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {request.event_name || "Event"} · {request.organizer_name || "Organizer"} ·{" "}
                      {venueLabel} · {request.layout_type || "custom"}
                      {typeof request.capacity === "number" && request.capacity > 0
                        ? ` · capacity ${request.capacity}`
                        : ""}
                    </p>
                    {location ? <p className="text-xs text-slate-500 mt-1">{location}</p> : null}
                    {request.showtime_starts_at ? (
                      <p className="text-xs text-slate-500 mt-1">
                        Showtime: {formatDateTime12h(request.showtime_starts_at)}
                      </p>
                    ) : null}
                    {request.notes ? (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                        <span className="font-semibold text-slate-600">Notes:</span> {request.notes}
                      </p>
                    ) : null}
                    {request.organizer_change_notes ? (
                      <p className="text-sm text-orange-700 mt-2">
                        Change request: {request.organizer_change_notes}
                      </p>
                    ) : null}
                    {draftCount > 0 ? (
                      <p className="text-sm text-sky-700 mt-2">
                        {draftCount} draft layout option{draftCount === 1 ? "" : "s"} ready to send
                      </p>
                    ) : null}
                    {builtCount > 0 && draftCount === 0 ? (
                      <p className="text-sm text-violet-700 mt-2">
                        {builtCount} layout option{builtCount === 1 ? "" : "s"} built for this event
                      </p>
                    ) : null}
                    {optionsProposed > 0 ? (
                      <p className="text-sm text-violet-700 mt-2">
                        {optionsProposed} option{optionsProposed === 1 ? "" : "s"} sent to organizer
                        {request.fulfilled_template_name
                          ? ` · primary: ${request.fulfilled_template_name}`
                          : ""}
                      </p>
                    ) : null}
                    {workflow === "fulfilled" && request.fulfilled_template_name ? (
                      <p className="text-sm text-emerald-700 mt-2 font-medium">
                        Fulfilled with: {request.fulfilled_template_name}
                        {request.fulfilled_template_capacity != null
                          ? ` (${request.fulfilled_template_capacity} seats)`
                          : ""}
                      </p>
                    ) : null}
                    {workflow === "rejected" && request.rejection_reason ? (
                      <p className="text-sm text-rose-600 mt-2">
                        Rejected reason: {request.rejection_reason}
                      </p>
                    ) : null}
                    {request.event_status ? (
                      <p className="text-xs text-slate-400 mt-2">
                        Event status: {String(request.event_status).replaceAll("_", " ")}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[0.6875rem] font-bold border ${
                        TAB_STYLES[workflow] || TAB_STYLES.needs_action
                      }`}
                    >
                      {TAB_LABELS[workflow] || workflow.replaceAll("_", " ")}
                    </span>
                    {(workflow === "needs_action" ||
                      workflow === "in_builder" ||
                      workflow === "change_requested") &&
                    draftCount > 0 ? (
                      <Link
                        href={`/admin/event-layouts/${request.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
                      >
                        Send to organizer
                        <ArrowRight size={14} />
                      </Link>
                    ) : null}
                    <Link
                      href={`/admin/event-layouts/${request.id}`}
                      className="btn-primary inline-flex items-center gap-2 text-sm py-2 px-4"
                    >
                      {actionLabel(workflow)}
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
