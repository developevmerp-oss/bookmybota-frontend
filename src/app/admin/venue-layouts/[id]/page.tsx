"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  useConfirmAdminVenueLayoutLiveMutation,
  useDeclineAdminVenueLayoutLiveMutation,
  useGetAdminVenueLayoutRequestQuery,
  usePublishAdminVenueLayoutTemplatesMutation,
  useReviewAdminVenueLayoutRequestMutation,
  useSaveAdminVenueLayoutTemplateMutation,
  type VenueLayoutTemplate,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatDateTime12h } from "@/lib/dateFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";
import VenueProfileLayoutSummary from "@/components/venue/VenueProfileLayoutSummary";

const VenueLayoutBuilder = dynamic(
  () => import("@/components/EventAdminPanel/VenueLayoutBuilder"),
  { ssr: false }
);

function specZones(spec: Record<string, unknown> | undefined) {
  const raw = spec?.zones;
  if (!Array.isArray(raw)) return [] as Array<{ name?: string; capacity?: number }>;
  return raw as Array<{ name?: string; capacity?: number }>;
}

function specImages(spec: Record<string, unknown> | undefined) {
  const raw = spec?.reference_images;
  if (!Array.isArray(raw)) return [] as string[];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => resolveMediaUrl(item));
}

function optionStatusLabel(item: VenueLayoutTemplate) {
  if (item.is_default) return "Live in venue";
  if (item.venue_live_requested_at) return "Venue requested go live";
  if (item.venue_approved_at) return "Venue approved";
  if (item.status === "PUBLISHED") return "Sent to venue";
  if (item.status === "REJECTED") return "Rejected";
  return "Draft";
}

function canSubmitTemplate(item: VenueLayoutTemplate) {
  return !item.is_default && (item.status === "DRAFT" || item.status === "REJECTED");
}

function isCinemaModule(moduleKey?: string | null) {
  return String(moduleKey || "").toLowerCase() === "cinema";
}

function formatLocation(parts: { address?: string | null; city?: string | null; country?: string | null }) {
  return [parts.address, parts.city, parts.country].filter(Boolean).join(", ");
}

function mapSeatsFromJson(sourceSeats: unknown[]) {
  return sourceSeats.map((seat, idx) => {
    const row = seat as Record<string, unknown>;
    return {
      id: String(row.id || `seat-${idx}`),
      internalId: String(row.internalId || row.id || `seat-${idx}`),
      ticket_type_id: (row.ticket_type_id as string) || null,
      section_name: String(row.section_name || "General"),
      row_label: String(row.row_label || "A"),
      seat_label: String(row.seat_label || `${idx + 1}`),
      coordinate_x: Number(row.coordinate_x) || 0,
      coordinate_y: Number(row.coordinate_y) || 0,
      status: String(row.status || "AVAILABLE"),
      grid_id: row.grid_id ? String(row.grid_id) : undefined,
    };
  });
}

export default function AdminVenueLayoutBuilderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params.id || "");
  const { data: request, isLoading, refetch } = useGetAdminVenueLayoutRequestQuery(id, { skip: !id });
  const [reviewRequest, { isLoading: reviewing }] = useReviewAdminVenueLayoutRequestMutation();
  const [saveTemplate, { isLoading: saving }] = useSaveAdminVenueLayoutTemplateMutation();
  const [publishTemplates, { isLoading: publishing }] = usePublishAdminVenueLayoutTemplatesMutation();
  const [confirmLive, { isLoading: confirmingLive }] = useConfirmAdminVenueLayoutLiveMutation();
  const [declineLive, { isLoading: decliningLive }] = useDeclineAdminVenueLayoutLiveMutation();
  const [rejectReason, setRejectReason] = useState("");
  const [optionName, setOptionName] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [localTemplates, setLocalTemplates] = useState<VenueLayoutTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  useEffect(() => {
    if (request?.templates) {
      setLocalTemplates(request.templates);
    }
  }, [request?.templates]);

  const zones = useMemo(() => specZones(request?.spec_json), [request]);
  const images = useMemo(() => specImages(request?.spec_json), [request]);
  const notes = typeof request?.spec_json?.notes === "string" ? request.spec_json.notes : "";
  const venueMetaSnapshot = request?.spec_json?.venue_meta_snapshot as Record<string, unknown> | undefined;
  const templates = localTemplates;

  const submittableTemplates = useMemo(
    () => templates.filter((item) => canSubmitTemplate(item)),
    [templates]
  );

  const liveRequestTemplate = useMemo(
    () => templates.find((item) => item.venue_live_requested_at && !item.is_default),
    [templates]
  );

  useEffect(() => {
    if (searchParams.get("publish") !== "1" || submittableTemplates.length === 0) return;
    setSelectedTemplateIds(submittableTemplates.map((item) => item.id));
  }, [searchParams, submittableTemplates]);

  const sections = zones.map((zone, idx) => ({
    id: zone.name || `zone-${idx + 1}`,
    name: zone.name || `Zone ${idx + 1}`,
    capacity: Number(zone.capacity) || 0,
  }));

  const activeTemplate = creatingNew
    ? undefined
    : templates.find((item) => item.id === activeTemplateId) || (!activeTemplateId ? templates[0] : undefined);
  const selectedId = creatingNew ? null : activeTemplate?.id || null;
  const sourceSeats = creatingNew
    ? []
    : ((activeTemplate?.seats_json || request?.template_seats || []) as Array<Record<string, unknown>>);
  const sourceConfig = creatingNew
    ? {}
    : ((activeTemplate?.seating_config || request?.template_seating_config || {}) as {
        labels?: unknown[];
        shapes?: unknown[];
      });

  const initialSeats = Array.isArray(sourceSeats) ? mapSeatsFromJson(sourceSeats) : [];

  const visitGate =
    request && !isCinemaModule(request.partner_module) && request.visit_status !== "VISIT_COMPLETE";

  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId) ? prev.filter((tid) => tid !== templateId) : [...prev, templateId]
    );
  };

  const selectAllSubmittable = () => {
    setSelectedTemplateIds(submittableTemplates.map((item) => item.id));
  };

  const clearSelection = () => setSelectedTemplateIds([]);

  const handlePublishSelected = async () => {
    if (selectedTemplateIds.length === 0) {
      toast.error("Select at least one layout option to publish.");
      return;
    }
    try {
      const res = await publishTemplates({ id, template_ids: selectedTemplateIds }).unwrap();
      const publishedIds = new Set((res.data || []).map((item) => item.id));
      setLocalTemplates((prev) =>
        prev.map((item) =>
          publishedIds.has(item.id) ? { ...item, status: "PUBLISHED" as const, rejection_reason: null } : item
        )
      );
      setSelectedTemplateIds([]);
      toast.success(res.message || "Layouts published to venue.");
      void refetch();
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to publish layouts"));
    }
  };

  const handlePublishAllDrafts = async () => {
    if (submittableTemplates.length === 0) {
      toast.error("Save at least one draft layout before publishing.");
      return;
    }
    const ids = submittableTemplates.map((item) => item.id);
    setSelectedTemplateIds(ids);
    try {
      const res = await publishTemplates({ id, template_ids: ids }).unwrap();
      const publishedIds = new Set((res.data || []).map((item) => item.id));
      setLocalTemplates((prev) =>
        prev.map((item) =>
          publishedIds.has(item.id) ? { ...item, status: "PUBLISHED" as const, rejection_reason: null } : item
        )
      );
      setSelectedTemplateIds([]);
      toast.success(res.message || "All draft layouts published to venue.");
      void refetch();
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to publish layouts"));
    }
  };

  if (isLoading) return <div className="p-10 text-center text-zinc-400">Loading layout request...</div>;
  if (!request) {
    return (
      <div className="p-10 text-center">
        <p className="text-zinc-400 mb-4">Layout request not found.</p>
        <Link href="/admin/venue-layouts" className="text-rose-500">Back to requests</Link>
      </div>
    );
  }

  const location = formatLocation({
    address: request.venue_address,
    city: request.city_name,
    country: request.country_name,
  });

  if (visitGate) {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4 p-10 text-center">
        <Link href="/admin/venue-layouts" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft size={16} /> Back to venue layouts
        </Link>
        <h1 className="text-2xl font-bold text-white mt-4">Site visit not complete</h1>
        <p className="text-zinc-400">
          Mark the site visit complete with visited person and notes before building the layout for{" "}
          <strong className="text-white">{request.venue_name}</strong>.
        </p>
        {location ? <p className="text-sm text-zinc-500">{location}</p> : null}
        <Link href="/admin/venue-layouts?tab=visit_requests" className="btn-primary inline-flex mt-4">
          Go to visit requests
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link href="/admin/venue-layouts" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft size={16} /> Back to venue layouts
          </Link>
          <h1 className="text-2xl font-bold text-white mt-3">{request.layout_name}</h1>
          <p className="text-zinc-400 mt-1">
            {request.venue_name} · {request.hall_name || "Hall"} · {request.layout_type} · capacity {request.capacity}
          </p>
          {location ? <p className="text-sm text-zinc-500 mt-1">{location}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="px-3 py-1 rounded-lg text-xs font-bold border border-white/10 text-zinc-300">
            {request.status.replaceAll("_", " ")}
          </span>
          {submittableTemplates.length > 0 ? (
            <button
              type="button"
              disabled={publishing}
              onClick={() => void handlePublishAllDrafts()}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {publishing ? "Publishing…" : `Publish to venue (${submittableTemplates.length})`}
            </button>
          ) : null}
        </div>
      </div>

      {request.visit_status === "VISIT_COMPLETE" && (request.visit_person || request.visit_notes) ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-400/90">Site visit record</p>
          <p className="text-sm text-zinc-400 mt-1">
            Use these notes while building the seating layout for this venue.
          </p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {request.visit_person ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Visited by</p>
                <p className="text-white font-medium mt-0.5">{request.visit_person}</p>
              </div>
            ) : null}
            {request.visit_completed_at ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Visit completed</p>
                <p className="text-white font-medium mt-0.5">{formatDateTime12h(request.visit_completed_at)}</p>
              </div>
            ) : null}
          </div>
          {request.visit_notes ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Visit notes</p>
              <p className="text-sm text-zinc-200 whitespace-pre-line">{request.visit_notes}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {liveRequestTemplate ? (
        <div className="rounded-2xl border border-violet-300/40 bg-violet-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-violet-900">Venue requested go live</p>
            <p className="text-sm text-violet-800 mt-1">
              <strong>{liveRequestTemplate.name}</strong> — confirm to publish this layout in the system,
              or decline so the venue can pick another option.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              disabled={decliningLive}
              onClick={async () => {
                try {
                  await declineLive({ id, template_id: liveRequestTemplate.id }).unwrap();
                  toast.success("Go-live request declined.");
                  void refetch();
                } catch (err: unknown) {
                  toast.error(extractApiError(err, "Failed to decline go-live request"));
                }
              }}
              className="px-4 py-2 rounded-xl border border-violet-300 text-violet-800 text-sm hover:bg-violet-100 disabled:opacity-50"
            >
              {decliningLive ? "Declining…" : "Decline"}
            </button>
            <button
              type="button"
              disabled={confirmingLive}
              onClick={async () => {
                try {
                  await confirmLive({ id, template_id: liveRequestTemplate.id }).unwrap();
                  toast.success("Layout confirmed and is now live for the venue.");
                  void refetch();
                } catch (err: unknown) {
                  toast.error(extractApiError(err, "Failed to confirm layout"));
                }
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {confirmingLive ? "Confirming…" : "Confirm & publish live"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_280px] gap-6">
        <aside className="glass-panel rounded-2xl border border-white/10 p-5 space-y-4 h-fit">
          <div>
            <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-2">Layout option name</label>
            <input
              value={optionName || activeTemplate?.name || request.layout_name}
              onChange={(e) => setOptionName(e.target.value)}
              className="input-field"
              placeholder="Theater option A"
            />
            <p className="text-xs text-zinc-500 mt-1">Save multiple options, then select which to send to the venue.</p>
            <button
              type="button"
              onClick={() => {
                setCreatingNew(true);
                setActiveTemplateId(null);
                setOptionName(`${request.layout_name} option ${templates.length + 1}`);
              }}
              className="mt-2 text-sm text-amber-400 hover:text-amber-300"
            >
              + Start another layout option
            </button>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Venue notes</p>
            <p className="text-sm text-zinc-300 whitespace-pre-line">{notes || "No extra notes."}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <VenueProfileLayoutSummary
              compact
              venueMeta={request.venue_meta}
              venueTypeSlug={request.venue_type_slug}
              venueTypeName={request.venue_type_name}
              specSnapshot={venueMetaSnapshot}
            />
          </div>
          {request.visit_status === "VISIT_COMPLETE" && (request.visit_person || request.visit_notes) ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-2">
              <p className="text-xs uppercase tracking-wide text-emerald-400/90 font-semibold">Site visit</p>
              {request.visit_person ? (
                <p className="text-sm text-zinc-200">
                  <span className="text-zinc-500">Visited by:</span> {request.visit_person}
                </p>
              ) : null}
              {request.visit_notes ? (
                <p className="text-xs text-zinc-400 whitespace-pre-line line-clamp-6">{request.visit_notes}</p>
              ) : null}
            </div>
          ) : null}
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Requested zones</p>
            <div className="space-y-2">
              {sections.length ? (
                sections.map((section) => (
                  <div key={section.id} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                    <p className="text-white font-medium">{section.name}</p>
                    <p className="text-zinc-500 text-xs">Capacity {section.capacity}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-500">No zones provided.</p>
              )}
            </div>
          </div>
          {images.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Reference images</p>
              <div className="grid grid-cols-2 gap-2">
                {images.map((url, idx) => (
                  <a key={`${url}-${idx}`} href={url} target="_blank" rel="noreferrer">
                    <img
                      src={url}
                      alt={`Reference ${idx + 1}`}
                      className="h-20 w-full object-cover rounded-lg border border-white/10"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input-field min-h-[80px]"
              placeholder="Rejection comments for venue admin"
            />
            <button
              type="button"
              disabled={reviewing}
              onClick={async () => {
                if (!rejectReason.trim()) return toast.error("Add a comment before rejecting.");
                try {
                  await reviewRequest({ id, status: "REJECTED", review_comments: rejectReason }).unwrap();
                  toast.success("Request rejected. Venue admin can revise and resubmit.");
                  refetch();
                } catch (err: unknown) {
                  toast.error(extractApiError(err, "Failed to reject request"));
                }
              }}
              className="w-full px-4 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              Reject with comments
            </button>
          </div>
        </aside>

        <div className="min-h-[720px]">
          <VenueLayoutBuilder
            key={creatingNew ? "new-option" : activeTemplateId || selectedId || "empty"}
            venueAdapter={{
              sections,
              initialSeats,
              initialConfig: {
                labels: Array.isArray(sourceConfig.labels) ? (sourceConfig.labels as never[]) : [],
                shapes: Array.isArray(sourceConfig.shapes) ? (sourceConfig.shapes as never[]) : [],
              },
              saving,
              hideSubmitToVenue: true,
              onSave: async (payload) => {
                const saved = await saveTemplate({
                  id,
                  name: optionName || request.layout_name,
                  template_id: creatingNew ? undefined : selectedId || undefined,
                  save_as_new: creatingNew || !selectedId,
                  seating_config: payload.seating_config,
                  seats: payload.seats,
                  publish: false,
                }).unwrap();
                const merged: VenueLayoutTemplate = {
                  ...saved,
                  seats_json: payload.seats,
                  seating_config: payload.seating_config,
                };
                setLocalTemplates((prev) => {
                  const idx = prev.findIndex((item) => item.id === merged.id);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = merged;
                    return next;
                  }
                  return [merged, ...prev];
                });
                setCreatingNew(false);
                setActiveTemplateId(merged.id);
                setOptionName(merged.name);
                setSelectedTemplateIds((prev) =>
                  prev.includes(merged.id) ? prev : [...prev, merged.id]
                );
                toast.success("Layout saved as draft. Select it in Saved options and submit to venue.");
                void refetch();
              },
              onBlankPage: () => {
                setCreatingNew(true);
                setActiveTemplateId(null);
                setOptionName(`${request.layout_name} option ${templates.length + 1}`);
                toast.info("Blank page ready — start building your layout.");
              },
            }}
          />
        </div>

        <aside className="glass-panel rounded-2xl border border-white/10 p-5 space-y-3 h-fit xl:sticky xl:top-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Saved options</p>
            <p className="text-xs text-zinc-400 mt-1">
              Check the layouts to send. Venue admin will see all selected options.
            </p>
          </div>

          {submittableTemplates.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={selectAllSubmittable}
                className="text-amber-400 hover:text-amber-300 font-medium"
              >
                Select all drafts
              </button>
              {selectedTemplateIds.length > 0 ? (
                <button type="button" onClick={clearSelection} className="text-zinc-500 hover:text-zinc-300">
                  Clear
                </button>
              ) : null}
            </div>
          ) : null}

          {templates.length === 0 ? (
            <p className="text-sm text-zinc-500">Save layout to add an option here.</p>
          ) : (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {templates.map((item: VenueLayoutTemplate) => {
                const submittable = canSubmitTemplate(item);
                const checked = selectedTemplateIds.includes(item.id);
                const isActive = selectedId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      isActive ? "border-amber-400 bg-amber-500/10" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {submittable ? (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTemplateSelection(item.id)}
                          className="mt-1 h-4 w-4 accent-amber-500 shrink-0"
                          aria-label={`Select ${item.name}`}
                        />
                      ) : (
                        <span className="mt-1 w-4 shrink-0" />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingNew(false);
                          setActiveTemplateId(item.id);
                          setOptionName(item.name);
                        }}
                        className="flex-1 text-left min-w-0"
                      >
                        <LayoutSeatPreview
                          seats={item.seats_json}
                          config={item.seating_config}
                          heightClass="h-24"
                        />
                        <p className="text-sm font-medium text-white mt-2 truncate">{item.name}</p>
                        <p className="text-[0.6875rem] text-zinc-400 mt-0.5">{optionStatusLabel(item)}</p>
                        {item.status === "REJECTED" && item.rejection_reason ? (
                          <p className="text-[0.6875rem] text-rose-400 mt-1 line-clamp-2">{item.rejection_reason}</p>
                        ) : null}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            disabled={publishing || selectedTemplateIds.length === 0}
            onClick={() => void handlePublishSelected()}
            className="w-full btn-primary py-2.5 text-sm disabled:opacity-50"
          >
            {publishing
              ? "Publishing..."
              : `Publish to venue${selectedTemplateIds.length ? ` (${selectedTemplateIds.length})` : ""}`}
          </button>
          <p className="text-[0.65rem] text-zinc-500 text-center">
            Check draft layouts on the right, or use Publish to venue in the page header to send all drafts.
          </p>
        </aside>
      </div>
    </div>
  );
}
