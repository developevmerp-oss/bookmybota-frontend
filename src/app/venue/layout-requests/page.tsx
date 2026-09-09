"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  ClipboardList,
  Eye,
  MapPin,
  ScrollText,
  Sparkles,
  X,
} from "lucide-react";
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
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  REQUESTED_LIVE: "bg-sky-50 text-sky-700 border-sky-200",
  REJECTED_ALL: "bg-rose-50 text-rose-700 border-rose-200",
  LIVE_CONFIRMED: "bg-primary-soft text-primary border-primary/20",
  LIVE_DECLINED: "bg-amber-50 text-amber-700 border-amber-200",
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
    () => layoutOptions.some((o) => o.is_default || !!o.venue_live_requested_at),
    [layoutOptions]
  );

  const liveCount = useMemo(
    () => layoutOptions.filter((o) => o.is_default && o.status === "PUBLISHED").length,
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

  const layoutSummary =
    awaitingConfirmation.length > 0
      ? "Your go-live request is with BookMyBota. No further approve/reject actions until they confirm."
      : pendingLayoutOptions.length > 0
        ? `${pendingLayoutOptions.length} option${pendingLayoutOptions.length === 1 ? "" : "s"} waiting for review. Approve the ones you like, then request one to go live.`
        : shortlistedLayoutOptions.length > 0
          ? `${shortlistedLayoutOptions.length} approved option${shortlistedLayoutOptions.length === 1 ? "" : "s"} — pick one and request it to go live.`
          : layoutOptions.length > 0
            ? "Review your layout options below."
            : "Super Admin will send layout options here after the site visit and layout build.";

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4 sm:space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Site visits", value: requests.length, hint: openVisitRequest ? "1 pending" : "None pending" },
          { label: "Layout options", value: layoutOptions.length, hint: `${pendingLayoutOptions.length} to review` },
          { label: "Approved", value: shortlistedLayoutOptions.length, hint: "Ready for go-live" },
          { label: "Live layouts", value: liveCount, hint: liveCount ? "Published" : "Not live yet" },
        ].map((stat) => (
          <div key={stat.label} className="org-card px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{stat.hint}</p>
          </div>
        ))}
      </div>

      {/* Top: site visit + requests */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <section className="org-card overflow-hidden xl:col-span-5">
          <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-primary-soft/60 to-transparent">
            <div className="flex items-center gap-2.5">
              <span className="h-9 w-9 rounded-xl bg-primary text-primary-foreground inline-flex items-center justify-center shrink-0">
                <MapPin size={18} />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-foreground">Request a site visit</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  BookMyBota surveys your venue and builds seating layouts.
                </p>
              </div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              We use your{" "}
              <Link href="/venue/profile" className="text-primary hover:opacity-80 font-semibold">
                venue profile
              </Link>{" "}
              for name, address, and contact details.
            </p>

            <div className="rounded-2xl border border-border bg-muted/40 p-4 flex gap-3">
              <span className="h-10 w-10 rounded-xl bg-card border border-border inline-flex items-center justify-center text-primary shrink-0">
                <Building2 size={18} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{venueName}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{venueTypeLabel || "Venue"}</p>
                <p className="text-sm text-muted-foreground mt-1.5 flex items-start gap-1.5">
                  <MapPin size={14} className="shrink-0 mt-0.5 text-primary" />
                  <span>{venueAddress}</span>
                </p>
              </div>
            </div>

            {openVisitRequest ? (
              <div className="rounded-xl border border-primary/25 bg-primary-soft px-4 py-3 text-sm text-primary leading-relaxed">
                You already have a pending site visit request. BookMyBota will visit your venue and mark it
                complete when done.
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                No layout details needed here — our team surveys on site after you request a visit.
              </div>
            )}

            <button
              type="button"
              disabled={submitting || !!openVisitRequest}
              onClick={() => void requestSiteVisit()}
              className="btn-primary w-full sm:w-auto disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Request site visit"}
            </button>
          </div>
        </section>

        <section className="org-card overflow-hidden xl:col-span-7">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-9 w-9 rounded-xl bg-muted inline-flex items-center justify-center text-foreground shrink-0">
                <ClipboardList size={18} />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-foreground">Existing requests</h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  Track site-visit status for this venue
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-muted-foreground shrink-0 tabular-nums">
              {requests.length} total
            </span>
          </div>
          <div className="p-4 sm:p-5 max-h-[340px] overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Loading requests…</p>
            ) : requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                <p className="text-sm text-muted-foreground">No layout requests yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use Request site visit to get started.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {requests.map((request) => (
                  <article
                    key={request.id}
                    className="rounded-2xl border border-border bg-card p-4 space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
                        {request.layout_name}
                      </p>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          STATUS_STYLES[request.status] || STATUS_STYLES.DRAFT
                        }`}
                      >
                        {request.status.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(request.hall_name || venueName)} · Site visit
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {request.status !== "DRAFT" ? (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            VISIT_STATUS_STYLES[request.visit_status || "PENDING"] ||
                            VISIT_STATUS_STYLES.PENDING
                          }`}
                        >
                          {(request.visit_status || "PENDING") === "VISIT_COMPLETE"
                            ? "Visit complete"
                            : "Visit pending"}
                        </span>
                      ) : null}
                    </div>
                    {request.visit_status === "VISIT_COMPLETE" ? (
                      <p className="text-xs text-emerald-700">
                        Visit complete — layout building in progress.
                      </p>
                    ) : request.status !== "DRAFT" ? (
                      <p className="text-xs text-violet-700">
                        Waiting for BookMyBota to complete the survey.
                      </p>
                    ) : null}
                    {request.review_comments ? (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                        Admin: {request.review_comments}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Layout options — full width */}
      <section className="org-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="h-9 w-9 rounded-xl bg-primary-soft text-primary inline-flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-base font-bold text-foreground">
                Layout options from Super Admin
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{layoutSummary}</p>
            </div>
          </div>
          {pendingLayoutOptions.length > 0 && !reviewLocked ? (
            <button
              type="button"
              disabled={rejectingAll}
              onClick={() => {
                setRejectAllOpen(true);
                setRejectReason("");
              }}
              className="shrink-0 px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-sm font-semibold hover:bg-rose-50 disabled:opacity-50"
            >
              Reject all ({pendingLayoutOptions.length})
            </button>
          ) : null}
        </div>

        <div className="p-4 sm:p-5">
          {loadingOptions ? (
            <p className="text-sm text-muted-foreground py-10 text-center">Loading layout options…</p>
          ) : layoutOptions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
              <p className="font-medium text-foreground">No layout options yet</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
                After your site visit, BookMyBota will create and submit layout options for you to compare
                and approve.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
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
                  <article
                    key={option.id}
                    className={`rounded-2xl border overflow-hidden flex flex-col bg-card shadow-sm transition-shadow hover:shadow-md ${
                      live
                        ? "border-sky-300 ring-1 ring-sky-100"
                        : awaitingLive
                          ? "border-primary/30 ring-1 ring-primary/10"
                          : shortlisted
                            ? "border-emerald-300 ring-1 ring-emerald-100"
                            : rejected
                              ? "border-rose-200"
                              : waiting
                                ? "border-amber-200"
                                : "border-border"
                    }`}
                  >
                    <div className="p-3 bg-muted/50 border-b border-border">
                      <LayoutSeatPreview
                        seats={option.seats_json}
                        config={option.seating_config}
                        heightClass="h-44"
                      />
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
                            Option {index + 1}
                          </p>
                          <p className="font-semibold text-foreground truncate mt-0.5">{option.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {option.hall_name || "Hall"} · {option.layout_type}
                            {option.seat_count ? ` · ${option.seat_count} seats` : ""}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-md border ${
                            live
                              ? "bg-sky-50 text-sky-700 border-sky-200"
                              : awaitingLive
                                ? "bg-primary-soft text-primary border-primary/20"
                                : shortlisted
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : rejected
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : waiting
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-slate-50 text-slate-600 border-slate-200"
                          }`}
                        >
                          {live
                            ? "Live"
                            : awaitingLive
                              ? "Awaiting"
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
                        <p className="text-xs text-rose-600 line-clamp-2 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-2">
                          {option.rejection_reason}
                        </p>
                      ) : null}

                      {awaitingLive ? (
                        <p className="text-xs text-primary">
                          BookMyBota will confirm before this layout goes live.
                        </p>
                      ) : null}

                      <div className="flex flex-wrap gap-2 mt-auto pt-1">
                        <button
                          type="button"
                          onClick={() => setViewingId(option.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted"
                        >
                          <Eye size={14} className="text-primary" /> View full
                        </button>
                        {!reviewLocked && waiting ? (
                          <>
                            <button
                              type="button"
                              disabled={approving}
                              onClick={async () => {
                                try {
                                  await approveLayout({ bizId, templateId: option.id }).unwrap();
                                  toast.success(
                                    "Layout approved. You can approve more options, then request one to go live."
                                  );
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
                              className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50 disabled:opacity-50"
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
                                  toast.success(
                                    "Go-live request sent. BookMyBota will confirm before it publishes."
                                  );
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
                              className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Activity log — full width */}
      <section className="org-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-muted inline-flex items-center justify-center text-foreground shrink-0">
              <ScrollText size={18} />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">Activity log</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Approve, reject, and go-live steps — newest first
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {activityLogs.length} entries
          </span>
        </div>
        <div className="p-4 sm:p-5">
          {loadingLogs ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading activity…</p>
          ) : activityLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">No activity yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                When you approve, reject, or request go live, it appears here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {activityLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-border bg-muted/20 px-4 py-3.5 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                        LOG_ACTION_STYLES[entry.action] ||
                        "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {LOG_ACTION_LABELS[entry.action] || entry.action}
                    </span>
                    {entry.created_at ? (
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime12h(entry.created_at)}
                      </span>
                    ) : null}
                  </div>
                  {entry.template_name ? (
                    <p className="text-sm font-semibold text-foreground">{entry.template_name}</p>
                  ) : null}
                  {entry.message ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{entry.message}</p>
                  ) : null}
                  {entry.actor_label ? (
                    <p className="text-xs text-muted-foreground">By {entry.actor_label}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {viewingId ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setViewingId(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  Option {layoutOptions.findIndex((o) => o.id === viewingId) + 1} of {layoutOptions.length}
                </p>
                <h3 className="font-display text-lg font-bold text-foreground">
                  {viewingLayout?.name || "Layout option"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {viewingLayout?.hall_name || "Hall"} · {viewingLayout?.layout_type || ""} ·{" "}
                  {viewingLayout?.seat_count || 0} seats
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingId(null)}
                className="h-8 w-8 rounded-full border border-border text-muted-foreground inline-flex items-center justify-center hover:bg-muted"
              >
                <X size={16} />
              </button>
            </div>
            {loadingView ? (
              <p className="text-muted-foreground py-10 text-center text-sm">Loading layout…</p>
            ) : (
              <LayoutSeatPreview
                seats={viewingLayout?.seats_json}
                config={viewingLayout?.seating_config}
                heightClass="h-[480px]"
              />
            )}
            {viewingLayout?.rejection_reason ? (
              <p className="text-sm text-rose-600 mt-4">
                Rejected reason: {viewingLayout.rejection_reason}
              </p>
            ) : null}
            {viewingLayout &&
            viewingLayout.status === "PUBLISHED" &&
            !viewingLayout.is_default &&
            !reviewLocked ? (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
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
                  className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-sm font-medium hover:bg-rose-50"
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
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setRejectAllOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">Reject all layout options</h3>
                <p className="text-sm text-muted-foreground mt-1.5">
                  This rejects all {pendingLayoutOptions.length} options waiting for approval. Super Admin
                  can revise and send new options.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectAllOpen(false)}
                className="h-8 w-8 rounded-full border border-border text-muted-foreground inline-flex items-center justify-center hover:bg-muted"
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
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {rejectingAll ? "Rejecting..." : "Reject all with notes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectingId ? (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setRejectingId(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">Reject layout option</h3>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Add a reason so Super Admin can revise this option.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                className="h-8 w-8 rounded-full border border-border text-muted-foreground inline-flex items-center justify-center hover:bg-muted"
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
                    await rejectLayout({
                      bizId,
                      templateId: rejectingId,
                      reason: rejectReason.trim(),
                    }).unwrap();
                    toast.success("Layout option rejected.");
                    setRejectingId(null);
                    setRejectReason("");
                  } catch (err: unknown) {
                    toast.error(extractApiError(err, "Failed to reject layout"));
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
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
