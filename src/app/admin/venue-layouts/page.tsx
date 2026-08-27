"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useGetAdminVenueLayoutRequestsQuery } from "@/services/api";

const TABS = [
  { id: "needs_action", label: "Needs action" },
  { id: "in_builder", label: "In builder" },
  { id: "submitted", label: "Submitted" },
  { id: "published", label: "Published" },
  { id: "rejected", label: "Rejected" },
] as const;

const TAB_STYLES: Record<string, string> = {
  needs_action: "bg-amber-50 text-amber-700 border-amber-200",
  in_builder: "bg-sky-50 text-sky-700 border-sky-200",
  submitted: "bg-violet-50 text-violet-700 border-violet-200",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

const TAB_LABELS: Record<string, string> = {
  needs_action: "Needs action",
  in_builder: "In builder",
  submitted: "Submitted",
  published: "Published",
  rejected: "Rejected",
};

function specZones(spec: Record<string, unknown> | undefined) {
  const raw = spec?.zones;
  if (!Array.isArray(raw)) return [] as Array<{ name?: string; capacity?: number }>;
  return raw as Array<{ name?: string; capacity?: number }>;
}

function actionLabel(tab: string) {
  if (tab === "published") return "View layout";
  if (tab === "rejected") return "Revise layout";
  if (tab === "submitted") return "Open layout";
  return "Build layout";
}

function isCinemaRequest(moduleKey?: string | null) {
  return String(moduleKey || "").toLowerCase() === "cinema";
}

function AdminVenueLayoutsPage() {
  const searchParams = useSearchParams();
  const businessId = searchParams.get("business_id") || "";
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("needs_action");
  const [partnerFilter, setPartnerFilter] = useState<"all" | "venue" | "cinema">("all");
  const { data: requests = [], isLoading } = useGetAdminVenueLayoutRequestsQuery({
    tab,
    ...(businessId ? { business_id: businessId } : {}),
  });

  const visibleRequests = requests.filter((request) => {
    if (partnerFilter === "all") return true;
    const cinema = isCinemaRequest(request.partner_module);
    return partnerFilter === "cinema" ? cinema : !cinema;
  });

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Venue & cinema layouts</h2>
        <p className="text-sm text-slate-500 mt-1">
          Venue halls and cinema screens both send layout requests here. Cinema partners submit from{" "}
          <span className="font-medium text-slate-700">Movie Admin → Screens & Layouts</span>. Open a
          request, build the seat map, then publish for the partner to approve.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border ${
              tab === item.id ? "bg-rose-50 text-rose-600 border-rose-200" : "border-slate-200 text-slate-500"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "all", label: "All partners" },
            { id: "cinema", label: "Cinema screens" },
            { id: "venue", label: "Venue halls" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPartnerFilter(item.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              partnerFilter === item.id
                ? "bg-slate-900 text-white border-slate-900"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {isLoading ? (
          <p className="p-8 text-center text-slate-400">Loading layout requests...</p>
        ) : visibleRequests.length === 0 ? (
          <p className="p-8 text-center text-slate-500">
            No layout requests in this view.
            {partnerFilter === "cinema"
              ? " Cinema partners submit from Movie Admin → Screens & Layouts."
              : ""}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleRequests.map((request) => {
              const zones = specZones(request.spec_json);
              const workflow = request.workflow_tab || tab;
              const rejection = request.rejection_reason || request.review_comments;
              const cinema = isCinemaRequest(request.partner_module);
              return (
                <div
                  key={request.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[0.65rem] font-bold uppercase tracking-wider border ${
                          cinema
                            ? "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {cinema ? "Cinema screen" : "Venue hall"}
                      </span>
                      <p className="text-slate-900 font-semibold">{request.layout_name}</p>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      {request.venue_name || (cinema ? "Cinema" : "Venue")} ·{" "}
                      {request.hall_name || (cinema ? "Screen" : "Hall")} · {request.layout_type} ·
                      capacity {request.capacity}
                    </p>
                    {zones.length > 0 && (
                      <p className="text-xs text-slate-400 mt-2">
                        {zones.map((zone) => `${zone.name || "Zone"} (${zone.capacity || 0})`).join(" · ")}
                      </p>
                    )}
                    {workflow === "rejected" && rejection && (
                      <p className="text-sm text-rose-600 mt-2">Rejected reason: {rejection}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[0.6875rem] font-bold border ${TAB_STYLES[workflow] || TAB_STYLES.needs_action}`}
                    >
                      {TAB_LABELS[workflow] || workflow.replaceAll("_", " ")}
                    </span>
                    <Link
                      href={`/admin/venue-layouts/${request.id}`}
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

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading...</div>}>
      <AdminVenueLayoutsPage />
    </Suspense>
  );
}
