"use client";

import { useEffect, useMemo, useState } from "react";
import ClassicSeatMap from "@/components/venue/ClassicSeatMap";
import { DetailFormShimmer } from "@/components/Shared/Shimmer";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { ArrowLeft, Maximize2, PenTool, X } from "lucide-react";
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

import { layoutToVenueTemplate, seatCountsBySection } from "@/modules/venue-designer/utils/toVenueTemplate";
import type { UniversalVenueLayout } from "@/modules/venue-designer/types";

const UniversalVenueDesigner = dynamic(
  () => import("@/modules/venue-designer").then((mod) => mod.UniversalVenueDesigner),
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

export default function AdminVenueLayoutBuilderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = String(params.id || "");
  const { data: request, isLoading, refetch } = useGetAdminVenueLayoutRequestQuery(id, { skip: !id, refetchOnMountOrArgChange: true });
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
  const [designerOpen, setDesignerOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(true);

  // Lock page scroll while the full-screen designer is open
  useEffect(() => {
    if (!designerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [designerOpen]);

  const handleSaveTemplatePayload = async (payload: {
    seating_config: { canvasWidth: number; canvasHeight: number; labels: unknown[]; shapes: unknown[]; bgImageUrl?: string | null };
    seats: unknown[];
  }) => {
    const saved = await saveTemplate({
      id,
      name: optionName || activeTemplate?.name || request?.layout_name || "Layout option",
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
  };

  useEffect(() => {
    if (searchParams.get("design") === "1") setDesignerOpen(true);
  }, [searchParams]);

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
  const sourceSeats = useMemo(() => {
    if (creatingNew) return [];
    const raw = activeTemplate?.seats_json || request?.template_seats || [];
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
  }, [creatingNew, activeTemplate?.seats_json, request?.template_seats]);

  const sourceConfig = useMemo(() => {
    if (creatingNew) return {};
    const raw = activeTemplate?.seating_config || request?.template_seating_config || {};
    if (typeof raw === "string") {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  }, [creatingNew, activeTemplate?.seating_config, request?.template_seating_config]);

  // Reopen what was drawn in the designer; a layout built in the classic editor opens blank in the designer
  const designerInitial = useMemo(() => {
    const raw = (sourceConfig as { universal_layout?: UniversalVenueLayout }).universal_layout;
    return raw && Array.isArray(raw.objects) ? raw : undefined;
  }, [sourceConfig]);

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

  if (isLoading) return <DetailFormShimmer />;
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

  const partnerKind = String(request.partner_module || "").toLowerCase();
  const backHref =
    request.business_id && ["cinema", "venue"].includes(partnerKind)
      ? `/admin/businesses/${partnerKind}/${request.business_id}?tab=layouts`
      : "/admin/venue-layouts";
  const backLabel = backHref.startsWith("/admin/businesses") ? `${partnerKind} partner` : "venue layouts";
  const reqSections = Array.isArray((request.spec_json as { sections?: unknown } | undefined)?.sections)
    ? ((request.spec_json as { sections: Array<{ seat_type: string; name: string; seats: number }> }).sections)
    : [];
  const optionTitle = optionName || activeTemplate?.name || request.layout_name;
  const hasVisit = request.visit_status === "VISIT_COMPLETE" && (request.visit_person || request.visit_notes);
  const hasProfile = Boolean(request.venue_meta && Object.values(request.venue_meta as Record<string, unknown>).some((v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)));
  const builtInOldEditor = sourceSeats.length > 0 && !designerInitial;
  const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
  const label = "text-[11px] font-bold uppercase tracking-wider text-slate-500";

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
            <ArrowLeft size={16} /> Back to {backLabel}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 break-words">{request.layout_name}</h1>
            <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase text-slate-700">
              {request.status.replaceAll("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {request.venue_name} · {request.hall_name || "Screen"} · {request.layout_type} · capacity {request.capacity}
          </p>
          {location ? <p className="text-xs text-slate-500 mt-0.5">{location}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDesignerOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-rose-500"
          >
            <PenTool size={16} /> {sourceSeats.length > 0 ? "Edit layout" : "Build layout"}
          </button>
          {submittableTemplates.length > 0 ? (
            <button
              type="button"
              disabled={publishing}
              onClick={() => void handlePublishAllDrafts()}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {publishing ? "Publishing…" : `Publish to venue (${submittableTemplates.length})`}
            </button>
          ) : null}
        </div>
      </div>

      {liveRequestTemplate ? (
        <div className="rounded-2xl border border-violet-300 bg-violet-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-violet-900">Venue requested go live</p>
            <p className="text-sm text-violet-800 mt-0.5">
              <strong>{liveRequestTemplate.name}</strong> — confirm to publish it, or decline so the venue can pick another option.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
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
              className="rounded-xl border border-violet-300 px-4 py-2 text-sm text-violet-800 hover:bg-violet-100 disabled:opacity-50"
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
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {confirmingLive ? "Confirming…" : "Confirm & publish live"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Brief: only what was actually provided */}
      {hasVisit || notes || sections.length > 0 || reqSections.length > 0 || hasProfile || images.length > 0 ? (
        <div className={`${card} p-4 sm:p-5`}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {hasVisit ? (
              <div>
                <p className={label}>Site visit</p>
                <div className="mt-1.5 space-y-1 text-sm text-slate-800">
                  <p>
                    <span className="text-slate-500">By</span> <span className="font-semibold">{request.visit_person || "—"}</span>
                    {request.visit_completed_at ? <span className="text-slate-500"> · {formatDateTime12h(request.visit_completed_at)}</span> : null}
                  </p>
                  {request.visit_notes ? <p className="whitespace-pre-line text-slate-600">{request.visit_notes}</p> : null}
                </div>
              </div>
            ) : null}
            {notes ? (
              <div>
                <p className={label}>Notes</p>
                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-700">{notes}</p>
              </div>
            ) : null}
            {reqSections.length > 0 ? (
              <div>
                <p className={label}>Sections</p>
                <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
                  {reqSections.map((x, i) => (
                    <li key={i}>
                      <span className="font-semibold">{x.name}</span> <span className="text-slate-500">· {x.seat_type} · {x.seats} seats</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {sections.length > 0 ? (
              <div>
                <p className={label}>Requested seating types</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {sections.map((s) => (
                    <span key={s.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                      <strong>{s.name}</strong> · {s.capacity} seats
                    </span>
                  ))}
                </div>
                {isCinemaModule(request.partner_module) ? (
                  <p className="mt-2 text-[11px] text-amber-700">Seat counts per type must match before publishing.</p>
                ) : null}
              </div>
            ) : null}
          </div>
          {hasProfile || images.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
              {hasProfile ? (
                <VenueProfileLayoutSummary
                  compact
                  hideWhenEmpty
                  venueMeta={request.venue_meta}
                  venueTypeSlug={request.venue_type_slug}
                  venueTypeName={request.venue_type_name}
                  specSnapshot={venueMetaSnapshot}
                />
              ) : null}
              {images.length > 0 ? (
                <div>
                  <p className={label}>Reference images</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {images.map((url, idx) => (
                      <a key={`${url}-${idx}`} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`Reference ${idx + 1}`} className="h-16 w-24 rounded-lg border border-slate-200 object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Layout preview */}
        <section className={`${card} p-4 sm:p-5 min-w-0`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <label className={label} htmlFor="layout-option-name">Layout option name</label>
              <input
                id="layout-option-name"
                value={optionTitle}
                onChange={(e) => setOptionName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                placeholder="Layout option A"
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {activeTemplate ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{optionStatusLabel(activeTemplate)}</span>
              ) : null}
              <span>{sourceSeats.length} seats · {Array.isArray(sourceConfig.shapes) ? sourceConfig.shapes.length : 0} stage elements</span>
            </div>
          </div>

          <div
            onClick={() => setDesignerOpen(true)}
            className="group relative mt-4 cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 hover:border-rose-300"
            title="Open in the designer"
          >
            {sourceSeats.length > 0 ? (
              <ClassicSeatMap seats={sourceSeats} heightClass="h-80 sm:h-[30rem]" />
            ) : (
              <div className="flex h-72 flex-col items-center justify-center gap-3 text-center px-6">
                <PenTool className="text-slate-400" size={30} />
                <p className="text-sm font-semibold text-slate-700">Nothing drawn yet</p>
                <p className="text-xs text-slate-500 max-w-sm">Open the designer to place rows, blocks, tables and the stage, then save the draft.</p>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-xl">
                <Maximize2 size={16} /> Open designer
              </span>
            </div>
          </div>
          {builtInOldEditor ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This option was drawn in the older editor. The designer opens it as a blank canvas; saving there replaces these seats.
            </p>
          ) : null}
        </section>

        {/* Options + send */}
        <aside className="space-y-4 lg:sticky lg:top-4 h-fit">
          <div className={`${card} p-4 space-y-3`}>
            <div className="flex items-center justify-between">
              <p className={label}>Layout options</p>
              <button
                type="button"
                onClick={() => {
                  setCreatingNew(true);
                  setActiveTemplateId(null);
                  setOptionName(`${request.layout_name} option ${templates.length + 1}`);
                  setDesignerOpen(true);
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-500"
              >
                + New option
              </button>
            </div>

            {submittableTemplates.length > 0 ? (
              <div className="flex gap-3 text-xs">
                <button type="button" onClick={selectAllSubmittable} className="font-semibold text-rose-600">Select all drafts</button>
                {selectedTemplateIds.length > 0 ? (
                  <button type="button" onClick={clearSelection} className="text-slate-500">Clear</button>
                ) : null}
              </div>
            ) : null}

            {templates.length === 0 ? (
              <p className="text-sm text-slate-500">Saved options appear here.</p>
            ) : (
              <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                {templates.map((item: VenueLayoutTemplate) => {
                  const submittable = canSubmitTemplate(item);
                  const checked = selectedTemplateIds.includes(item.id);
                  const isActive = selectedId === item.id;
                  const count = Array.isArray(item.seats_json)
                    ? item.seats_json.length
                    : typeof item.seats_json === "string"
                      ? (() => { try { return JSON.parse(item.seats_json).length; } catch { return 0; } })()
                      : 0;
                  return (
                    <div key={item.id} className={`rounded-xl border p-2.5 ${isActive ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-white"}`}>
                      <div className="flex items-start gap-2">
                        {submittable ? (
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTemplateSelection(item.id)}
                            className="mt-1 h-4 w-4 accent-rose-600 shrink-0"
                            aria-label={`Select ${item.name}`}
                          />
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setCreatingNew(false);
                            setActiveTemplateId(item.id);
                            setOptionName(item.name);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <LayoutSeatPreview seats={item.seats_json} config={item.seating_config} heightClass="h-20" />
                          <p className="mt-1.5 truncate text-sm font-semibold text-slate-900">{item.name}</p>
                          <p className="text-[11px] text-slate-500">{count} seats · {optionStatusLabel(item)}</p>
                          {item.status === "REJECTED" && item.rejection_reason ? (
                            <p className="mt-1 line-clamp-2 text-[11px] text-rose-600">{item.rejection_reason}</p>
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
              className="w-full rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              {publishing ? "Publishing…" : `Publish to venue${selectedTemplateIds.length ? ` (${selectedTemplateIds.length})` : ""}`}
            </button>
            <p className="text-center text-[11px] text-slate-500">Tick the options to send. The venue sees every ticked option.</p>
          </div>

          <div className={`${card} p-4 space-y-2`}>
            <p className={label}>Not right? Send it back</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="min-h-[70px] w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none"
              placeholder="Comments for the venue admin"
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
              className="w-full rounded-xl border border-rose-200 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              Reject with comments
            </button>
          </div>
        </aside>
      </div>

      {designerOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[70] flex h-screen w-screen flex-col bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-slate-900">{optionTitle}</p>
              <p className="truncate text-[11px] text-slate-500">
                {request.hall_name || "Screen"} · capacity {request.capacity}
                {zones.length > 0 ? ` · requested: ${zones.map((z) => `${z.name} ${z.capacity}`).join(", ")}` : ""} · use Save to keep it
              </p>
            </div>
            <button type="button" onClick={() => setDesignerOpen(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">
              <X size={14} /> Close
            </button>
          </div>
          {!creatingNew && sourceSeats.length > 0 && zones.reduce((a, z) => a + (Number(z.capacity) || 0), 0) > 0 && sourceSeats.length !== zones.reduce((a, z) => a + (Number(z.capacity) || 0), 0) ? (
            <div className="flex flex-wrap items-center gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs text-amber-900">
              <span>
                This saved option has <b>{sourceSeats.length}</b> seats, but the request asks for <b>{zones.reduce((a, z) => a + (Number(z.capacity) || 0), 0)}</b>. It may be an older layout.
              </span>
              <button
                type="button"
                className="cursor-pointer rounded-lg bg-white px-3 py-1 font-bold text-amber-900 shadow-sm hover:bg-amber-50"
                onClick={() => {
                  setCreatingNew(true);
                  setActiveTemplateId(null);
                  setOptionName(`${request.layout_name} option ${templates.length + 1}`);
                  toast.info("Blank layout ready. Draw it, or pick a template.");
                }}
              >
                Start a blank layout instead
              </button>
            </div>
          ) : null}
          {hasVisit || sections.length > 0 || reqSections.length > 0 || notes ? (
            <div className="border-b border-slate-200 bg-amber-50/70 px-4 py-2 text-xs text-slate-700">
              <button type="button" onClick={() => setBriefOpen((v) => !v)} className="font-bold text-amber-800">
                Brief {briefOpen ? "▲" : "▼"}
              </button>
              {briefOpen ? (
                <div className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto">
                  {sections.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">Requested seats:</span>
                      {sections.map((z) => (
                        <span key={z.id} className="rounded-md border border-amber-300 bg-white px-2 py-0.5 font-semibold">{z.name}: {z.capacity}</span>
                      ))}
                    </div>
                  ) : null}
                  {reqSections.length > 0 ? (
                    <p>
                      <span className="font-semibold">Sections:</span>{" "}
                      {reqSections.map((x) => `${x.name} (${x.seat_type} ${x.seats})`).join(", ")}
                    </p>
                  ) : null}
                  {hasVisit && request.visit_notes ? (
                    <p className="whitespace-pre-line"><span className="font-semibold">Visit notes{request.visit_person ? ` (${request.visit_person})` : ""}:</span> {request.visit_notes}</p>
                  ) : null}
                  {notes ? <p className="whitespace-pre-line"><span className="font-semibold">Notes:</span> {notes}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            <UniversalVenueDesigner
              key={creatingNew ? "new-option" : activeTemplateId || "current"}
              initialLayout={designerInitial}
              onSave={async (layout) => {
                const payload = layoutToVenueTemplate({ ...layout, name: optionName || layout.name } as UniversalVenueLayout);
                if (payload.seats.length === 0) {
                  toast.error("Add some seats before saving, so the layout has something to book.");
                  return;
                }
                const counts = seatCountsBySection(payload.seats);
                const wanted = zones.filter((z) => Number(z.capacity) > 0);
                if (wanted.length > 0) {
                  const diff = wanted
                    .filter((z) => (counts[String(z.name)] || 0) !== Number(z.capacity))
                    .map((z) => `${z.name}: ${counts[String(z.name)] || 0} of ${z.capacity}`);
                  if (diff.length > 0) toast.info(`Saved. Seat counts differ from the request (${diff.join(", ")}). Fix this before publishing.`);
                }
                await handleSaveTemplatePayload(payload);
                setDesignerOpen(false);
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
