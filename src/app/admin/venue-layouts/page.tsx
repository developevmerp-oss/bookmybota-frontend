"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import {
  useConfirmAdminVenueLayoutLiveMutation,
  useGetAdminVenueLayoutRequestsQuery,
  useMarkAdminVenueLayoutVisitCompleteMutation,
  type VenueLayoutRequest,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatDateTime12h } from "@/lib/dateFormat";

const TABS = [
  { id: "visit_requests", label: "Visit requests" },
  { id: "needs_action", label: "Needs action" },
  { id: "in_builder", label: "In builder" },
  { id: "submitted", label: "Submitted" },
  { id: "published", label: "Published" },
  { id: "rejected", label: "Rejected" },
] as const;

const TAB_STYLES: Record<string, string> = {
  visit_requests: "bg-violet-50 text-violet-700 border-violet-200",
  needs_action: "bg-amber-50 text-amber-700 border-amber-200",
  in_builder: "bg-sky-50 text-sky-700 border-sky-200",
  submitted: "bg-violet-50 text-violet-700 border-violet-200",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

const TAB_LABELS: Record<string, string> = {
  visit_requests: "Visit pending",
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

function actionLabel(tab: string, canBuild: boolean) {
  if (tab === "visit_requests") return "View request";
  if (!canBuild) return "View request";
  if (tab === "published") return "View layout";
  if (tab === "rejected") return "Revise layout";
  if (tab === "submitted") return "Open layout";
  return "Build layout";
}

function isCinemaRequest(moduleKey?: string | null) {
  return String(moduleKey || "").toLowerCase() === "cinema";
}

function formatLocation(request: VenueLayoutRequest) {
  return [request.venue_address, request.city_name, request.country_name].filter(Boolean).join(", ");
}

function canOpenBuilder(request: VenueLayoutRequest) {
  if (isCinemaRequest(request.partner_module)) return true;
  return request.visit_status === "VISIT_COMPLETE";
}

function AdminVenueLayoutsPage() {
  const searchParams = useSearchParams();
  const businessId = searchParams.get("business_id") || "";
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("visit_requests");
  const [partnerFilter, setPartnerFilter] = useState<"all" | "venue" | "cinema">("all");
  const [visitModalId, setVisitModalId] = useState<string | null>(null);
  const [visitedPerson, setVisitedPerson] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const { data: requests = [], isLoading, refetch } = useGetAdminVenueLayoutRequestsQuery({
    tab,
    ...(businessId ? { business_id: businessId } : {}),
  });
  const [markVisitComplete, { isLoading: completingVisit }] =
    useMarkAdminVenueLayoutVisitCompleteMutation();
  const [confirmLive, { isLoading: confirmingLive }] = useConfirmAdminVenueLayoutLiveMutation();

  const visibleRequests = requests.filter((request) => {
    if (partnerFilter === "all") return true;
    const cinema = isCinemaRequest(request.partner_module);
    return partnerFilter === "cinema" ? cinema : !cinema;
  });

  const closeVisitModal = () => {
    setVisitModalId(null);
    setVisitedPerson("");
    setVisitNotes("");
  };

  const handleVisitComplete = async () => {
    if (!visitModalId) return;
    if (!visitedPerson.trim()) {
      toast.error("Enter the visited person name.");
      return;
    }
    if (!visitNotes.trim()) {
      toast.error("Enter visit notes.");
      return;
    }
    try {
      await markVisitComplete({
        id: visitModalId,
        visited_person: visitedPerson.trim(),
        visit_notes: visitNotes.trim(),
      }).unwrap();
      toast.success("Site visit marked complete.");
      closeVisitModal();
      void refetch();
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to mark visit complete"));
    }
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Venue & cinema layouts</h2>
        <p className="text-sm text-slate-500 mt-1">
          Venue partners request a site visit first. Record who visited and notes, then build and
          publish seating layout options for the partner to approve.
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
            {tab === "visit_requests"
              ? " New venue visit requests appear here after a partner submits the form."
              : ""}
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleRequests.map((request) => {
              const zones = specZones(request.spec_json);
              const workflow = request.workflow_tab || tab;
              const rejection = request.rejection_reason || request.review_comments;
              const cinema = isCinemaRequest(request.partner_module);
              const visitComplete = request.visit_status === "VISIT_COMPLETE";
              const builderReady = canOpenBuilder(request);
              const location = formatLocation(request);
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
                    {location ? <p className="text-xs text-slate-500 mt-1">{location}</p> : null}
                    {visitComplete && (request.visit_person || request.visit_notes) ? (
                      <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                        {request.visit_person ? (
                          <p>
                            <span className="font-semibold text-slate-600">Visited by:</span>{" "}
                            {request.visit_person}
                          </p>
                        ) : null}
                        {request.visit_notes ? (
                          <p>
                            <span className="font-semibold text-slate-600">Notes:</span>{" "}
                            {request.visit_notes}
                          </p>
                        ) : null}
                        {request.visit_completed_at ? (
                          <p className="text-slate-400">
                            Visit completed {formatDateTime12h(request.visit_completed_at)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {request.sent_to_venue_at ? (
                      <p className="text-sm text-violet-700 mt-2">
                        <span className="font-semibold">Sent to venue:</span>{" "}
                        {formatDateTime12h(request.sent_to_venue_at)}
                      </p>
                    ) : null}
                    {request.live_published_at ? (
                      <p className="text-sm text-emerald-700 mt-2">
                        <span className="font-semibold">Published live:</span>{" "}
                        {formatDateTime12h(request.live_published_at)}
                      </p>
                    ) : null}
                    {zones.length > 0 && (
                      <p className="text-xs text-slate-400 mt-2">
                        {zones.map((zone) => `${zone.name || "Zone"} (${zone.capacity || 0})`).join(" · ")}
                      </p>
                    )}
                    {workflow === "rejected" && rejection && (
                      <p className="text-sm text-rose-600 mt-2">Rejected reason: {rejection}</p>
                    )}
                    {Number(request.live_pending_count || 0) > 0 && request.live_pending_template_name ? (
                      <p className="text-sm text-violet-700 mt-2 font-medium">
                        Venue requested go live: {request.live_pending_template_name}
                      </p>
                    ) : null}
                    {Number(request.draft_count || 0) > 0 ? (
                      <p className="text-sm text-sky-700 mt-2">
                        {request.draft_count} draft layout option{request.draft_count === 1 ? "" : "s"} ready to publish
                      </p>
                    ) : null}
                    {Number(request.submitted_count || 0) > 0 ? (
                      <p className="text-sm text-violet-700 mt-2">
                        {request.submitted_count} layout option{request.submitted_count === 1 ? "" : "s"} with venue for review
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[0.6875rem] font-bold border ${TAB_STYLES[workflow] || TAB_STYLES.needs_action}`}
                    >
                      {workflow === "published" && request.live_published_at
                        ? `Published ${formatDateTime12h(request.live_published_at)}`
                        : visitComplete
                          ? "Visit complete"
                          : TAB_LABELS[workflow] || workflow.replaceAll("_", " ")}
                    </span>
                    {workflow === "visit_requests" && !visitComplete ? (
                      <button
                        type="button"
                        disabled={completingVisit}
                        onClick={() => {
                          setVisitModalId(request.id);
                          setVisitedPerson("");
                          setVisitNotes("");
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} />
                        Visit complete
                      </button>
                    ) : null}
                    {Number(request.live_pending_count || 0) > 0 && request.live_pending_template_id ? (
                      <button
                        type="button"
                        disabled={confirmingLive}
                        onClick={async () => {
                          try {
                            await confirmLive({
                              id: request.id,
                              template_id: request.live_pending_template_id!,
                            }).unwrap();
                            toast.success("Layout published live for the venue.");
                            void refetch();
                          } catch (err: unknown) {
                            toast.error(extractApiError(err, "Failed to publish layout live"));
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {confirmingLive ? "Publishing…" : "Publish live"}
                      </button>
                    ) : null}
                    {builderReady && Number(request.draft_count || 0) > 0 ? (
                      <Link
                        href={`/admin/venue-layouts/${request.id}?publish=1`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700"
                      >
                        Publish to venue
                        <ArrowRight size={14} />
                      </Link>
                    ) : null}
                    {builderReady ? (
                      <Link
                        href={`/admin/venue-layouts/${request.id}`}
                        className="btn-primary inline-flex items-center gap-2 text-sm py-2 px-4"
                      >
                        {actionLabel(workflow, builderReady)}
                        <ArrowRight size={14} />
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400 max-w-[10rem]">
                        Mark visit complete to build layout
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {visitModalId ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Complete site visit</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Record who visited the venue and notes before building the layout.
                </p>
              </div>
              <button
                type="button"
                onClick={closeVisitModal}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Visited person <span className="text-rose-500">*</span>
              </label>
              <input
                value={visitedPerson}
                onChange={(e) => setVisitedPerson(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                placeholder="Team member who visited"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Visit notes <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm min-h-[100px]"
                placeholder="Survey findings, seating observations, access notes…"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={closeVisitModal}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completingVisit}
                onClick={() => void handleVisitComplete()}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {completingVisit ? "Saving..." : "Mark visit complete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
