"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, MapPin, ScrollText, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import {
  useApproveVenueLayoutTemplateMutation,
  usePublishVenueLayoutTemplateMutation,
  useCreateVenueLayoutRequestMutation,
  useGetBusinessSettingsQuery,
  useGetVenueLayoutRequestsQuery,
  useGetVenueLayoutTemplateQuery,
  useGetVenueLayoutTemplateLogsQuery,
  useGetVenueLayoutTemplatesQuery,
  useRejectVenueLayoutTemplateMutation,
  useRejectAllVenueLayoutTemplatesMutation,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";
import { buildVenueMetaSnapshot } from "@/lib/venueLayoutRequestHelpers";
import { venueTypeDisplayName } from "@/lib/venuePartnerInfo";
import { formatDateTime12h } from "@/lib/dateFormat";
import type { VenueLayoutTemplateLog } from "@/services/api";

const LOG_ACTION_LABELS: Record<VenueLayoutTemplateLog["action"], string> = {
  APPROVED: "Approved layout",
  REJECTED: "Rejected layout",
  REQUESTED_LIVE: "Requested go live",
  REJECTED_ALL: "Rejected all layouts",
  LIVE_CONFIRMED: "Layout published live",
  LIVE_DECLINED: "Go live declined",
};

const LOG_ACTION_STYLES: Record<VenueLayoutTemplateLog["action"], string> = {
  APPROVED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  REJECTED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  REQUESTED_LIVE: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  REJECTED_ALL: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  LIVE_CONFIRMED: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  LIVE_DECLINED: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  SUBMITTED: "bg-amber-50 text-amber-700 border-amber-200",
  UNDER_REVIEW: "bg-sky-50 text-sky-700 border-sky-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  ARCHIVED: "bg-slate-50 text-slate-500 border-slate-200",
};

const VISIT_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-violet-50 text-violet-700 border-violet-200",
  VISIT_COMPLETE: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function VenueLayoutRequestsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id ?? "";
  const { data: settings } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const { data: requests = [], isLoading, refetch } = useGetVenueLayoutRequestsQuery(bizId, { skip: !bizId });
  const { data: layoutOptions = [], isLoading: loadingOptions } = useGetVenueLayoutTemplatesQuery(bizId, {
    skip: !bizId,
  });
  const { data: activityLogs = [], isLoading: loadingLogs } = useGetVenueLayoutTemplateLogsQuery(bizId, {
    skip: !bizId,
  });
  const [createRequest, { isLoading: submitting }] = useCreateVenueLayoutRequestMutation();
  const [approveLayout, { isLoading: approving }] = useApproveVenueLayoutTemplateMutation();
  const [publishLayout, { isLoading: publishing }] = usePublishVenueLayoutTemplateMutation();
  const [rejectLayout, { isLoading: rejecting }] = useRejectVenueLayoutTemplateMutation();
  const [rejectAllLayouts, { isLoading: rejectingAll }] = useRejectAllVenueLayoutTemplatesMutation();

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectAllOpen, setRejectAllOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const { data: viewingLayout, isFetching: loadingView } = useGetVenueLayoutTemplateQuery(
    { bizId, templateId: viewingId || "" },
    { skip: !bizId || !viewingId }
  );

  const venueName = settings?.name?.trim() || "Your venue";
  const venueTypeLabel = venueTypeDisplayName(settings?.venue_type_slug, settings?.venue_type_name);
  const venueAddress = [settings?.address?.trim(), settings?.city_name?.trim()]
    .filter(Boolean)
    .join(", ") || "Address not set";

  const openVisitRequest = useMemo(
    () =>
      requests.find(
        (r) =>
          r.status !== "DRAFT" &&
          r.status !== "REJECTED" &&
          r.status !== "ARCHIVED" &&
          (r.visit_status || "PENDING") !== "VISIT_COMPLETE"
      ),
    [requests]
  );

  const pendingLayoutOptions = useMemo(
    () =>
      layoutOptions.filter(
        (o) =>
          o.status === "PUBLISHED" &&
          !o.is_default &&
          !o.venue_approved_at &&
          !o.venue_live_requested_at
      ),
    [layoutOptions]
  );

  const shortlistedLayoutOptions = useMemo(
    () =>
      layoutOptions.filter(
        (o) =>
          o.status === "PUBLISHED" &&
          !o.is_default &&
          !!o.venue_approved_at &&
          !o.venue_live_requested_at
      ),
    [layoutOptions]
  );

  const awaitingConfirmation = useMemo(
    () => layoutOptions.filter((o) => !!o.venue_live_requested_at && !o.is_default),
    [layoutOptions]
  );

  const reviewLocked = useMemo(
    () =>
      layoutOptions.some((o) => o.is_default || !!o.venue_live_requested_at),
    [layoutOptions]
  );

  const requestSiteVisit = async () => {
    if (!bizId) {
      toast.error("Missing venue session. Please sign in again.");
      return;
    }
    if (openVisitRequest) {
      toast.error("You already have a pending site visit request.");
      return;
    }
    if (!settings?.name?.trim()) {
      toast.error("Please complete your venue profile name first.");
      return;
    }
    try {
      await createRequest({
        bizId,
        hall_name: venueName,
        hall_description: venueAddress,
        hall_capacity: 1,
        is_indoor: true,
        layout_name: `${venueName} layout site visit`,
        layout_type: "theater",
        capacity: 1,
        spec_json: {
          intake_mode: "site_visit_request",
          venue_meta_snapshot: buildVenueMetaSnapshot(settings),
          venue_type_slug: settings?.venue_type_slug || null,
          venue_type_name: venueTypeLabel,
        },
        submit_now: true,
      }).unwrap();
      toast.success("Site visit request submitted. BookMyBota team will contact you to schedule the visit.");
      void refetch();
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to submit site visit request"));
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Layout site visit</h2>
        <p className="text-zinc-400 mt-1">
          Request BookMyBota to visit your venue and create the seating layout. No layout details are
          needed here — our team will survey on site.
        </p>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Request a site visit</h3>
          <p className="text-sm text-zinc-400">
            We use your{" "}
            <Link href="/venue/profile" className="text-amber-400 hover:text-amber-300 font-medium">
              venue profile
            </Link>{" "}
            for venue name, address, and contact details.
          </p>

          <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 space-y-2 text-sm">
            <p className="text-white font-medium">{venueName}</p>
            <p className="text-zinc-400">{venueTypeLabel}</p>
            <p className="text-zinc-400 flex items-start gap-2">
              <MapPin size={14} className="shrink-0 mt-0.5" />
              {venueAddress}
            </p>
          </div>

          {openVisitRequest ? (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-violet-200">
              You already have a pending site visit request. BookMyBota team will visit your venue
              and mark it complete when done.
            </div>
          ) : null}

          <button
            type="button"
            disabled={submitting || !!openVisitRequest}
            onClick={() => void requestSiteVisit()}
            className="btn-primary disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Request site visit"}
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
          <div>
            <h3 className="text-lg font-semibold text-white">Layout options from Super Admin</h3>
            <p className="text-sm text-zinc-400 mt-1">
              {awaitingConfirmation.length > 0
                ? "Your go-live request is with BookMyBota. No further approve/reject actions until they confirm."
                : pendingLayoutOptions.length > 0
                  ? `${pendingLayoutOptions.length} option${pendingLayoutOptions.length === 1 ? "" : "s"} waiting for review. Approve the ones you like, then request one to go live.`
                  : shortlistedLayoutOptions.length > 0
                    ? `${shortlistedLayoutOptions.length} approved option${shortlistedLayoutOptions.length === 1 ? "" : "s"} — pick one and request it to go live.`
                    : layoutOptions.length > 0
                      ? "Review your layout options below."
                      : "Super Admin will send layout options here after the site visit and layout build."}
            </p>
          </div>
          {pendingLayoutOptions.length > 0 && !reviewLocked ? (
            <button
              type="button"
              disabled={rejectingAll}
              onClick={() => {
                setRejectAllOpen(true);
                setRejectReason("");
              }}
              className="shrink-0 px-4 py-2 rounded-xl border border-rose-300 text-rose-400 text-sm font-semibold hover:bg-rose-500/10 disabled:opacity-50"
            >
              Reject all ({pendingLayoutOptions.length})
            </button>
          ) : null}
        </div>

        {loadingOptions ? (
          <p className="text-zinc-400">Loading layout options...</p>
        ) : layoutOptions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/30 p-10 text-center">
            <p className="text-zinc-400">No layout options yet.</p>
            <p className="text-sm text-zinc-500 mt-2">
              After your site visit, BookMyBota will create and submit multiple layout options for you
              to compare and approve.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {layoutOptions.map((option, index) => {
              const waiting =
                option.status === "PUBLISHED" &&
                !option.is_default &&
                !option.venue_approved_at &&
                !option.venue_live_requested_at;
              const shortlisted =
                option.status === "PUBLISHED" &&
                !option.is_default &&
                !!option.venue_approved_at &&
                !option.venue_live_requested_at;
              const awaitingLive = !!option.venue_live_requested_at && !option.is_default;
              const rejected = option.status === "REJECTED";
              const live = option.is_default && option.status === "PUBLISHED";
              return (
                <div
                  key={option.id}
                  className={`rounded-2xl border overflow-hidden flex flex-col ${
                    live
                      ? "border-sky-500/40 bg-sky-950/20"
                      : awaitingLive
                        ? "border-violet-500/40 bg-violet-950/20"
                      : shortlisted
                        ? "border-emerald-500/40 bg-emerald-950/20"
                      : rejected
                        ? "border-rose-500/30 bg-rose-950/10"
                        : waiting
                          ? "border-amber-500/30 bg-zinc-900/50"
                          : "border-white/10 bg-zinc-900/40"
                  }`}
                >
                  <div className="p-3 border-b border-white/5 bg-black/20">
                    <LayoutSeatPreview
                      seats={option.seats_json}
                      config={option.seating_config}
                      heightClass="h-36"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide text-amber-400/90">
                          Option {index + 1}
                        </p>
                        <p className="font-semibold text-white truncate">{option.name}</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {option.hall_name || "Hall"} · {option.layout_type}
                          {option.seat_count ? ` · ${option.seat_count} seats` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-md border ${
                          live
                            ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                            : awaitingLive
                              ? "bg-violet-500/15 text-violet-300 border-violet-500/30"
                            : shortlisted
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : rejected
                              ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                              : waiting
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                        }`}
                      >
                        {live
                          ? "Live in system"
                          : awaitingLive
                            ? "Awaiting confirmation"
                          : shortlisted
                            ? "Approved"
                            : rejected
                              ? "Rejected"
                              : waiting
                                ? "Pending"
                                : option.status}
                      </span>
                    </div>

                    {rejected && option.rejection_reason ? (
                      <p className="text-xs text-rose-300/90 line-clamp-2">{option.rejection_reason}</p>
                    ) : null}

                    {awaitingLive ? (
                      <p className="text-xs text-violet-300/90">
                        BookMyBota will confirm before this layout goes live.
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-2 mt-auto pt-1">
                      <button
                        type="button"
                        onClick={() => setViewingId(option.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 text-sm text-zinc-200 hover:bg-white/10"
                      >
                        <Eye size={14} /> View full
                      </button>
                      {!reviewLocked && waiting ? (
                        <>
                          <button
                            type="button"
                            disabled={approving}
                            onClick={async () => {
                              try {
                                await approveLayout({ bizId, templateId: option.id }).unwrap();
                                toast.success("Layout approved. You can approve more options, then request one to go live.");
                              } catch (err: unknown) {
                                toast.error(extractApiError(err, "Failed to approve layout"));
                              }
                            }}
                            className="btn-primary text-sm py-2 px-3 disabled:opacity-50"
                          >
                            {approving ? "…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            disabled={rejecting}
                            onClick={() => {
                              setRejectingId(option.id);
                              setRejectReason("");
                            }}
                            className="px-3 py-2 rounded-xl border border-rose-400/40 text-rose-300 text-sm hover:bg-rose-500/10 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                      {!reviewLocked && shortlisted ? (
                        <>
                          <button
                            type="button"
                            disabled={publishing}
                            onClick={async () => {
                              try {
                                await publishLayout({ bizId, templateId: option.id }).unwrap();
                                toast.success("Go-live request sent. BookMyBota will confirm before it publishes.");
                              } catch (err: unknown) {
                                toast.error(extractApiError(err, "Failed to request go live"));
                              }
                            }}
                            className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold disabled:opacity-50"
                          >
                            {publishing ? "…" : "Request go live"}
                          </button>
                          <button
                            type="button"
                            disabled={rejecting}
                            onClick={() => {
                              setRejectingId(option.id);
                              setRejectReason("");
                            }}
                            className="px-3 py-2 rounded-xl border border-rose-400/40 text-rose-300 text-sm hover:bg-rose-500/10 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ScrollText size={18} className="text-zinc-400" />
            <h3 className="text-lg font-semibold text-white">Activity log</h3>
          </div>
          <span className="text-xs text-zinc-500">{activityLogs.length} entries</span>
        </div>
        <p className="text-sm text-zinc-400 mb-4">
          Every approve, reject, and go-live step is recorded here in order (newest first).
        </p>
        {loadingLogs ? (
          <p className="text-zinc-400">Loading activity...</p>
        ) : activityLogs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/30 p-8 text-center">
            <p className="text-zinc-400">No activity yet.</p>
            <p className="text-sm text-zinc-500 mt-1">
              When you approve, reject, or request a layout to go live, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {activityLogs.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex gap-4 py-4 ${index < activityLogs.length - 1 ? "border-b border-white/10" : ""}`}
              >
                <div className="shrink-0 w-2 mt-2 rounded-full bg-white/10 self-stretch min-h-[2.5rem]" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                        LOG_ACTION_STYLES[entry.action] || "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                      }`}
                    >
                      {LOG_ACTION_LABELS[entry.action] || entry.action}
                    </span>
                    {entry.created_at ? (
                      <span className="text-xs text-zinc-500">{formatDateTime12h(entry.created_at)}</span>
                    ) : null}
                  </div>
                  {entry.template_name ? (
                    <p className="text-sm font-medium text-white">{entry.template_name}</p>
                  ) : null}
                  {entry.message ? (
                    <p className="text-sm text-zinc-400 mt-1 whitespace-pre-line">{entry.message}</p>
                  ) : null}
                  {entry.actor_label ? (
                    <p className="text-xs text-zinc-500 mt-1">By {entry.actor_label}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-white">Existing requests</h3>
          <span className="text-xs text-zinc-500">{requests.length} total</span>
        </div>
        {isLoading ? (
          <p className="text-zinc-400">Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="text-zinc-500">No layout requests yet. Use the button above to request a site visit.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="rounded-xl border border-white/10 bg-white/50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-white font-semibold">{request.layout_name}</p>
                    <p className="text-sm text-zinc-400 mt-1">
                      {(request.hall_name || venueName)} · Site visit request
                    </p>
                    {request.visit_status === "VISIT_COMPLETE" ? (
                      <p className="text-xs text-emerald-600 mt-2">
                        BookMyBota team has completed the site visit. Layout building is in progress.
                      </p>
                    ) : request.status !== "DRAFT" ? (
                      <p className="text-xs text-violet-400 mt-2">
                        Waiting for BookMyBota team to visit your venue and complete the survey.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {request.status !== "DRAFT" ? (
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                          VISIT_STATUS_STYLES[request.visit_status || "PENDING"] || VISIT_STATUS_STYLES.PENDING
                        }`}
                      >
                        {(request.visit_status || "PENDING") === "VISIT_COMPLETE"
                          ? "Visit complete"
                          : "Visit pending"}
                      </span>
                    ) : null}
                    <span
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                        STATUS_STYLES[request.status] || STATUS_STYLES.DRAFT
                      }`}
                    >
                      {request.status.replaceAll("_", " ")}
                    </span>
                  </div>
                </div>
                {request.review_comments ? (
                  <p className="text-sm text-amber-600 mt-3">Admin comment: {request.review_comments}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingId ? (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setViewingId(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-950 border border-white/10 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-400">
                  Option {layoutOptions.findIndex((o) => o.id === viewingId) + 1} of {layoutOptions.length}
                </p>
                <h3 className="text-lg font-semibold text-white">{viewingLayout?.name || "Layout option"}</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {viewingLayout?.hall_name || "Hall"} · {viewingLayout?.layout_type || ""} ·{" "}
                  {viewingLayout?.seat_count || 0} seats
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingId(null)}
                className="h-8 w-8 rounded-full border border-white/10 text-zinc-300 inline-flex items-center justify-center hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
            {loadingView ? (
              <p className="text-zinc-400 py-10 text-center">Loading layout...</p>
            ) : (
              <LayoutSeatPreview
                seats={viewingLayout?.seats_json}
                config={viewingLayout?.seating_config}
                heightClass="h-[480px]"
              />
            )}
            {viewingLayout?.rejection_reason ? (
              <p className="text-sm text-rose-400 mt-4">Rejected reason: {viewingLayout.rejection_reason}</p>
            ) : null}
            {viewingLayout &&
            viewingLayout.status === "PUBLISHED" &&
            !viewingLayout.is_default &&
            !reviewLocked ? (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10">
                {!viewingLayout.venue_approved_at ? (
                  <button
                    type="button"
                    disabled={approving}
                    onClick={async () => {
                      try {
                        await approveLayout({ bizId, templateId: viewingLayout.id }).unwrap();
                        toast.success("Layout approved.");
                        setViewingId(null);
                      } catch (err: unknown) {
                        toast.error(extractApiError(err, "Failed to approve layout"));
                      }
                    }}
                    className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
                  >
                    Approve this option
                  </button>
                ) : !viewingLayout.venue_live_requested_at ? (
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={async () => {
                      try {
                        await publishLayout({ bizId, templateId: viewingLayout.id }).unwrap();
                        toast.success("Go-live request sent to BookMyBota.");
                        setViewingId(null);
                      } catch (err: unknown) {
                        toast.error(extractApiError(err, "Failed to request go live"));
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    Request go live
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setRejectingId(viewingLayout.id);
                    setRejectReason("");
                  }}
                  className="px-4 py-2 rounded-xl border border-rose-400/40 text-rose-300 text-sm"
                >
                  Reject this option
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {rejectAllOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setRejectAllOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-white/10 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Reject all layout options</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  This rejects all {pendingLayoutOptions.length} options waiting for approval. Super Admin
                  can revise and send new options.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectAllOpen(false)}
                className="h-8 w-8 rounded-full border border-white/10 text-zinc-300 inline-flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input-field min-h-[120px]"
              placeholder="Why are none of these layouts acceptable?"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setRejectAllOpen(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectingAll}
                onClick={async () => {
                  if (!rejectReason.trim()) {
                    toast.error("Rejection reason is required.");
                    return;
                  }
                  try {
                    const res = await rejectAllLayouts({
                      bizId,
                      reason: rejectReason.trim(),
                    }).unwrap();
                    toast.success(res.message || "All layout options rejected.");
                    setRejectAllOpen(false);
                    setRejectReason("");
                  } catch (err: unknown) {
                    toast.error(extractApiError(err, "Failed to reject layouts"));
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm disabled:opacity-50"
              >
                {rejectingAll ? "Rejecting..." : "Reject all with notes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectingId ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setRejectingId(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-white/10 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Reject layout option</h3>
                <p className="text-sm text-zinc-400 mt-1">Add a reason so Super Admin can revise this option.</p>
              </div>
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                className="h-8 w-8 rounded-full border border-white/10 text-zinc-300 inline-flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input-field min-h-[120px]"
              placeholder="Why is this layout rejected?"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setRejectingId(null)} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                disabled={rejecting}
                onClick={async () => {
                  if (!rejectReason.trim()) {
                    toast.error("Rejection reason is required.");
                    return;
                  }
                  try {
                    await rejectLayout({ bizId, templateId: rejectingId, reason: rejectReason.trim() }).unwrap();
                    toast.success("Layout option rejected.");
                    setRejectingId(null);
                    setRejectReason("");
                  } catch (err: unknown) {
                    toast.error(extractApiError(err, "Failed to reject layout"));
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm disabled:opacity-50"
              >
                {rejecting ? "Rejecting..." : "Reject with reason"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
