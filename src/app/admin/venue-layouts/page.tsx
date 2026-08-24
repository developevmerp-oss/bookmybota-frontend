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

function AdminVenueLayoutsPage() {
  const searchParams = useSearchParams();
  const businessId = searchParams.get("business_id") || "";
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("needs_action");
  const { data: requests = [], isLoading } = useGetAdminVenueLayoutRequestsQuery({
    tab,
    ...(businessId ? { business_id: businessId } : {}),
  });

  return (
    <div className="w-full space-y-6">
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

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-zinc-400">Loading layout requests...</p>
        ) : requests.length === 0 ? (
          <p className="p-8 text-center text-zinc-500">No layout requests in this view.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {requests.map((request) => {
              const zones = specZones(request.spec_json);
              const workflow = request.workflow_tab || tab;
              const rejection = request.rejection_reason || request.review_comments;
              return (
                <div key={request.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-white font-semibold">{request.layout_name}</p>
                    <p className="text-sm text-zinc-400 mt-1">
                      {request.venue_name || "Venue"} · {request.hall_name || "Hall"} · {request.layout_type} · capacity {request.capacity}
                    </p>
                    {zones.length > 0 && (
                      <p className="text-xs text-zinc-500 mt-2">
                        {zones.map((zone) => `${zone.name || "Zone"} (${zone.capacity || 0})`).join(" · ")}
                      </p>
                    )}
                    {workflow === "rejected" && rejection && (
                      <p className="text-sm text-rose-400 mt-2">Rejected reason: {rejection}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-md text-[0.6875rem] font-bold border ${TAB_STYLES[workflow] || TAB_STYLES.needs_action}`}>
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

export default function AdminVenueLayoutsRoute() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-zinc-400">Loading venue layouts...</div>}>
      <AdminVenueLayoutsPage />
    </Suspense>
  );
}
