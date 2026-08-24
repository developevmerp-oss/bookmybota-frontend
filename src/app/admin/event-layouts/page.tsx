"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useGetAdminEventLayoutRequestsQuery } from "@/services/api";

const TABS = [
  { id: "submitted", label: "Submitted" },
  { id: "under_review", label: "In review" },
  { id: "pending_organizer", label: "Awaiting organizer" },
  { id: "change_requested", label: "Changes requested" },
  { id: "fulfilled", label: "Fulfilled" },
  { id: "rejected", label: "Rejected" },
] as const;

const TAB_STYLES: Record<string, string> = {
  submitted: "bg-violet-50 text-violet-700 border-violet-200",
  under_review: "bg-sky-50 text-sky-700 border-sky-200",
  pending_organizer: "bg-amber-50 text-amber-700 border-amber-200",
  change_requested: "bg-orange-50 text-orange-700 border-orange-200",
  fulfilled: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

const TAB_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "In review",
  pending_organizer: "Awaiting organizer",
  change_requested: "Changes requested",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
};

function actionLabel(tab: string) {
  if (tab === "fulfilled") return "View";
  if (tab === "rejected") return "View";
  if (tab === "under_review") return "Fulfill / reject";
  return "Review";
}

export default function AdminEventLayoutsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("submitted");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const { data: requests = [], isLoading } = useGetAdminEventLayoutRequestsQuery({
    tab,
    ...(search ? { q: search } : {}),
  });

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                tab === item.id ? "bg-rose-50 text-rose-600 border-rose-200" : "border-white/10 text-zinc-400"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <form
          className="relative w-full sm:w-72"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q.trim());
          }}
        >
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            className="input-field w-full pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search event, organizer, layout…"
          />
        </form>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-zinc-400">Loading event layout requests…</p>
        ) : requests.length === 0 ? (
          <p className="p-8 text-center text-zinc-500">No event layout requests in this view.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {requests.map((request) => {
              const workflow = request.workflow_tab || tab;
              return (
                <div
                  key={request.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-white font-semibold">{request.layout_name}</p>
                    <p className="text-sm text-zinc-400 mt-1">
                      {request.event_name || "Event"} · {request.organizer_name || "Organizer"}
                      {" · "}
                      {request.venue_partner_name || request.venue_name || "Venue"}
                      {" · "}
                      {request.layout_type || "custom"}
                      {typeof request.capacity === "number" ? ` · capacity ${request.capacity}` : ""}
                    </p>
                    {workflow === "rejected" && request.rejection_reason && (
                      <p className="text-sm text-rose-400 mt-2">Rejected: {request.rejection_reason}</p>
                    )}
                    {workflow === "fulfilled" && request.fulfilled_template_name && (
                      <p className="text-sm text-emerald-400 mt-2">
                        Fulfilled with: {request.fulfilled_template_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[0.6875rem] font-bold border ${
                        TAB_STYLES[workflow] || TAB_STYLES.submitted
                      }`}
                    >
                      {TAB_LABELS[workflow] || workflow.replaceAll("_", " ")}
                    </span>
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
