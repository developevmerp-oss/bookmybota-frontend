"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Maximize2, X } from "lucide-react";
import { toast } from "sonner";
import {
  useFulfillAdminEventLayoutRequestMutation,
  useGetAdminEventLayoutRequestQuery,
  useReviewAdminEventLayoutRequestMutation,
  useSaveAdminEventLayoutTemplateMutation,
  type VenueLayoutTemplate,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";

const VenueLayoutBuilder = dynamic(
  () => import("@/components/EventAdminPanel/VenueLayoutBuilder"),
  { ssr: false }
);

function optionStatusLabel(item: VenueLayoutTemplate) {
  if (item.status === "PUBLISHED") return "Ready / sent";
  if (item.status === "REJECTED") return "Rejected";
  return "Draft";
}

function canSendTemplate(item: VenueLayoutTemplate) {
  return item.status === "DRAFT" || item.status === "PUBLISHED";
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
      color: typeof row.color === "string" && row.color.trim() ? String(row.color) : null,
    };
  });
}

export default function AdminEventLayoutDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  const { data: request, isLoading, refetch } = useGetAdminEventLayoutRequestQuery(id, { skip: !id });
  const [reviewRequest, { isLoading: reviewing }] = useReviewAdminEventLayoutRequestMutation();
  const [saveTemplate, { isLoading: saving }] = useSaveAdminEventLayoutTemplateMutation();
  const [fulfillRequest, { isLoading: fulfilling }] = useFulfillAdminEventLayoutRequestMutation();

  const [rejectReason, setRejectReason] = useState("");
  const [fulfillNotes, setFulfillNotes] = useState("");
  const [optionName, setOptionName] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [localTemplates, setLocalTemplates] = useState<VenueLayoutTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [showInlineBuilder, setShowInlineBuilder] = useState(false);
  const [seedFromVenue, setSeedFromVenue] = useState(false);
  const [studioNonce, setStudioNonce] = useState(0);

  const busy = reviewing || saving || fulfilling;
  const canBuild =
    request &&
    ["SUBMITTED", "UNDER_REVIEW", "ORGANIZER_CHANGE_REQUESTED"].includes(String(request.status));
  const canReject =
    request && ["SUBMITTED", "UNDER_REVIEW", "ORGANIZER_CHANGE_REQUESTED"].includes(String(request.status));

  useEffect(() => {
    if (!request?.templates) return;
    setLocalTemplates((prev) => {
      const serverIds = new Set((request.templates || []).map((t) => t.id));
      const extras = prev.filter((t) => !serverIds.has(t.id));
      return [...(request.templates || []), ...extras];
    });
  }, [request?.templates]);

  useEffect(() => {
    if (!request) return;
    setOptionName(request.layout_name || "Event layout option");
  }, [request?.id, request?.layout_name]);

  const templates = localTemplates;
  const publishedLayouts = request?.published_layouts || [];
  const sendable = useMemo(() => templates.filter((t) => canSendTemplate(t)), [templates]);
  const targetCapacity = useMemo(() => {
    const fromRequest = Number(request?.target_capacity ?? request?.capacity ?? 0) || 0;
    const fromTickets = Number(request?.ticket_seat_total ?? 0) || 0;
    return Math.max(fromRequest, fromTickets);
  }, [request?.target_capacity, request?.capacity, request?.ticket_seat_total]);
  const ticketTypes = request?.ticket_types || [];
  const sourceVenueLayout = request?.source_venue_layout || null;

  const activeTemplate = creatingNew
    ? undefined
    : templates.find((item) => item.id === activeTemplateId) || (!activeTemplateId ? templates[0] : undefined);
  const selectedId = creatingNew ? null : activeTemplate?.id || null;

  const seededSource = seedFromVenue && sourceVenueLayout ? sourceVenueLayout : null;
  const sourceSeats = creatingNew
    ? seededSource
      ? ((seededSource.seats_json || []) as Array<Record<string, unknown>>)
      : []
    : ((activeTemplate?.seats_json || []) as Array<Record<string, unknown>>);
  const sourceConfig = creatingNew
    ? seededSource
      ? ((seededSource.seating_config || {}) as {
          labels?: unknown[];
          shapes?: unknown[];
          bgImageUrl?: string | null;
          sectionColors?: Record<string, string>;
        })
      : ({} as {
          labels?: unknown[];
          shapes?: unknown[];
          bgImageUrl?: string | null;
          sectionColors?: Record<string, string>;
        })
    : ((activeTemplate?.seating_config || {}) as {
        labels?: unknown[];
        shapes?: unknown[];
        bgImageUrl?: string | null;
        sectionColors?: Record<string, string>;
      });
  const initialSeats = Array.isArray(sourceSeats) ? mapSeatsFromJson(sourceSeats) : [];

  const sections = useMemo(() => {
    if (ticketTypes.length > 0) {
      return ticketTypes.map((t) => ({
        // Must be the real event_ticket_types UUID — names like "Vip" break Go live inserts
        id: t.id,
        name: t.ticket_type,
        capacity: Number(t.total_count) || 0,
        price: Number(t.price) || 0,
      }));
    }
    const names = new Set<string>();
    for (const seat of initialSeats) {
      if (seat.section_name) names.add(seat.section_name);
    }
    if (names.size === 0) names.add("General");
    return [...names].map((name) => ({ id: name, name, capacity: 0 }));
  }, [initialSeats, ticketTypes]);

  const beginNewOption = (seed = false) => {
    const nextIndex = templates.length + 1;
    setCreatingNew(true);
    setActiveTemplateId(null);
    setSeedFromVenue(Boolean(seed));
    setOptionName(`${request?.layout_name || "Event layout"} option ${nextIndex}`);
    setStudioNonce((n) => n + 1);
  };

  const openStudio = (opts?: { createNew?: boolean; seed?: boolean }) => {
    if (opts?.createNew || templates.length === 0) {
      beginNewOption(Boolean(opts?.seed));
    } else {
      setCreatingNew(false);
      setSeedFromVenue(false);
      if (!activeTemplateId && templates[0]) {
        setActiveTemplateId(templates[0].id);
        setOptionName(templates[0].name);
      }
    }
    setIsLayoutModalOpen(true);
  };

  const handleSaveTemplatePayload = async (
    payload: {
      seating_config: {
        canvasWidth: number;
        canvasHeight: number;
        labels: unknown[];
        shapes: unknown[];
        bgImageUrl?: string | null;
        sectionColors?: Record<string, string>;
      };
      seats: unknown[];
    },
    options?: { publish?: boolean; saveAsNew?: boolean }
  ) => {
    const forceNew = Boolean(options?.saveAsNew) || creatingNew || !selectedId;
    const baseName =
      optionName || activeTemplate?.name || request?.layout_name || "Event layout option";
    const saveName =
      forceNew && !creatingNew && selectedId
        ? `${baseName} (option ${templates.length + 1})`
        : baseName;

    const saved = await saveTemplate({
      id,
      name: saveName,
      template_id: forceNew ? undefined : selectedId || undefined,
      save_as_new: forceNew,
      seating_config: payload.seating_config,
      seats: payload.seats,
    }).unwrap();
    const merged: VenueLayoutTemplate = {
      ...saved,
      seats_json: payload.seats,
      seating_config: payload.seating_config,
      seat_count: payload.seats.length,
    };
    setLocalTemplates((prev) => {
      const without = prev.filter((item) => item.id !== merged.id);
      return [merged, ...without];
    });
    setCreatingNew(false);
    setActiveTemplateId(merged.id);
    setOptionName(merged.name);
    setSelectedTemplateIds((prev) => (prev.includes(merged.id) ? prev : [...prev, merged.id]));
    toast.success(
      forceNew
        ? "New layout option added to Saved options."
        : "Layout option updated. Use “Save as new option” to keep another version."
    );
    void refetch();
  };

  const startReview = async () => {
    try {
      await reviewRequest({ id, status: "UNDER_REVIEW" }).unwrap();
      toast.success("Marked as under review");
      refetch();
    } catch (e) {
      toast.error(extractApiError(e));
    }
  };

  const reject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Rejection reason is required");
      return;
    }
    try {
      await reviewRequest({ id, status: "REJECTED", rejection_reason: rejectReason.trim() }).unwrap();
      toast.success("Request rejected");
      refetch();
    } catch (e) {
      toast.error(extractApiError(e));
    }
  };

  const toggleTemplate = (templateId: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId) ? prev.filter((x) => x !== templateId) : [...prev, templateId]
    );
  };

  const sendToOrganizer = async () => {
    if (selectedTemplateIds.length === 0) {
      toast.error("Select at least one layout option to send.");
      return;
    }
    try {
      const res = await fulfillRequest({
        id,
        fulfilled_template_ids: selectedTemplateIds,
        fulfilled_template_id: selectedTemplateIds.length === 1 ? selectedTemplateIds[0] : null,
        notes: fulfillNotes.trim() || undefined,
      }).unwrap();
      toast.success(res.message || "Layout options sent");
      refetch();
    } catch (e) {
      toast.error(extractApiError(e));
    }
  };

  if (isLoading) {
    return <p className="text-zinc-400 p-8">Loading request…</p>;
  }

  if (!request) {
    return (
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-3">
        <p className="text-zinc-300">Event layout request not found.</p>
        <Link href="/admin/event-layouts" className="text-rose-500">
          Back to requests
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/event-layouts"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
          >
            <ArrowLeft size={14} /> Back to event layout requests
          </Link>
          <h1 className="text-2xl font-bold text-white mt-3">{request.layout_name}</h1>
          <p className="text-zinc-400 mt-1">
            Status: <span className="text-white font-medium">{request.status}</span>
            {" · "}
            {request.event_name || "Event"} · {request.organizer_name || "Organizer"}
          </p>
        </div>
        {canBuild && (
          <div className="flex flex-wrap gap-2">
            {request.status === "SUBMITTED" && (
              <button type="button" disabled={busy} onClick={startReview} className="btn-secondary text-sm py-2 px-4">
                Start review
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => openStudio({ createNew: true, seed: Boolean(sourceVenueLayout) })}
              className="btn-primary text-sm py-2 px-4"
            >
              {templates.length > 0 ? "Add another layout" : "Create layout"}
            </button>
          </div>
        )}
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Request details</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <p className="text-zinc-300">
            Event:{" "}
            <Link href={`/admin/events/${request.event_id}`} className="text-rose-400 hover:underline">
              {request.event_name || request.event_id}
            </Link>
          </p>
          <p className="text-zinc-300">Organizer: {request.organizer_name || "—"}</p>
          <p className="text-zinc-300">
            Venue: {request.venue_partner_name || request.venue_name || request.showtime_venue_name || "—"}
          </p>
          <p className="text-zinc-300">Type: {request.layout_type || "custom"}</p>
          <p className="text-zinc-300">Event status: {request.event_status || "—"}</p>
          <p className="text-zinc-300">
            Target seats:{" "}
            <span className="text-white font-medium">
              {targetCapacity > 0 ? targetCapacity : "Not set"}
            </span>
            {ticketTypes.length > 0 ? ` · from ${ticketTypes.length} ticket type(s)` : ""}
          </p>
        </div>
        {ticketTypes.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Organizer ticket capacity</p>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm text-zinc-200">
              {ticketTypes.map((t) => (
                <li key={t.id} className="flex justify-between gap-3 rounded-lg bg-black/20 px-3 py-2">
                  <span>{t.ticket_type}</span>
                  <span className="text-white font-medium">{t.total_count} seats</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-zinc-400 mt-2">
              Build the custom map within this total ({targetCapacity} seats). Extra seats above the limit
              are blocked in the studio.
            </p>
          </div>
        )}
        {sourceVenueLayout && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-300 mb-1">Registered venue layout</p>
              <p className="text-sm text-emerald-50">
                {sourceVenueLayout.name}
                {sourceVenueLayout.seat_count != null
                  ? ` · ${sourceVenueLayout.seat_count} seats`
                  : sourceVenueLayout.capacity
                    ? ` · ${sourceVenueLayout.capacity} seats`
                    : ""}
              </p>
              <p className="text-xs text-emerald-200/80 mt-1">
                Start from this venue map, then customize for the event.
              </p>
            </div>
            {canBuild && (
              <button
                type="button"
                disabled={busy}
                onClick={() => openStudio({ createNew: true, seed: true })}
                className="btn-secondary text-sm py-2 px-3"
              >
                Customize from venue layout
              </button>
            )}
          </div>
        )}
        {request.notes && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Organizer notes</p>
            <p className="text-sm text-zinc-200 whitespace-pre-wrap">{request.notes}</p>
          </div>
        )}
        {request.organizer_change_notes && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="text-xs uppercase tracking-wide text-amber-300 mb-1">Organizer change request</p>
            <p className="text-sm text-amber-100 whitespace-pre-wrap">{request.organizer_change_notes}</p>
          </div>
        )}
      </div>

      {canBuild && (
        <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
          <div className="space-y-4">
            <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Layout studio</p>
                  <h2 className="text-xl font-bold text-white mt-1">
                    {optionName || activeTemplate?.name || request.layout_name}
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    {initialSeats.length} seats
                    {targetCapacity > 0 ? ` · target max ${targetCapacity}` : ""}
                    {" · "}Build options, then send for organizer Preview approval.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openStudio({ seed: creatingNew && Boolean(sourceVenueLayout) })}
                  className="btn-primary py-2.5 px-4 text-sm inline-flex items-center gap-2"
                >
                  <Maximize2 size={16} /> Open layout studio
                </button>
              </div>

              <div>
                <label className="portal-label block text-sm mb-1.5">Option name</label>
                <input
                  className="input-field w-full max-w-md"
                  value={optionName}
                  onChange={(e) => setOptionName(e.target.value)}
                  placeholder="Layout option name"
                />
              </div>

              <div
                onClick={() => openStudio({ seed: creatingNew && Boolean(sourceVenueLayout) })}
                className="group relative cursor-pointer rounded-2xl border border-white/10 bg-black/40 p-4 hover:border-rose-400/50 transition-all"
              >
                <LayoutSeatPreview seats={sourceSeats} config={sourceConfig} heightClass="h-64 sm:h-80" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                  <span className="px-4 py-2 rounded-xl bg-white text-slate-900 text-sm font-semibold">
                    Open full-screen studio
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowInlineBuilder((b) => !b)}
                className="text-sm text-rose-400 hover:text-rose-300"
              >
                {showInlineBuilder ? "Hide inline editor" : "Show inline editor"}
              </button>

              {showInlineBuilder && (
                <div className="min-h-[720px] rounded-2xl overflow-hidden border border-white/10">
                  <VenueLayoutBuilder
                    key={
                      creatingNew
                        ? `new-inline-${studioNonce}-${seedFromVenue ? "seeded" : "blank"}`
                        : `inline-${activeTemplateId || selectedId || "empty"}-${studioNonce}`
                    }
                    venueAdapter={{
                      sections,
                      initialSeats,
                      maxCapacity: targetCapacity > 0 ? targetCapacity : undefined,
                      initialConfig: {
                        labels: Array.isArray(sourceConfig.labels) ? (sourceConfig.labels as never[]) : [],
                        shapes: Array.isArray(sourceConfig.shapes) ? (sourceConfig.shapes as never[]) : [],
                        bgImageUrl: sourceConfig.bgImageUrl || null,
                        sectionColors: sourceConfig.sectionColors,
                      },
                      saving,
                      hideSubmitToVenue: true,
                      onSave: handleSaveTemplatePayload,
                      onBlankPage: () => {
                        beginNewOption(false);
                        toast.info("Blank page ready — build, then Save as new option.");
                      },
                    }}
                  />
                </div>
              )}
            </div>

            {publishedLayouts.length > 0 && (
              <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-white">Or attach an existing published venue layout</h3>
                <div className="space-y-2">
                  {publishedLayouts.map((l) => {
                    const checked = selectedTemplateIds.includes(l.id);
                    return (
                      <label
                        key={l.id}
                        className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${
                          checked ? "border-rose-400/50 bg-rose-500/10" : "border-white/10 bg-white/5"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggleTemplate(l.id)}
                        />
                        <span>
                          <span className="text-sm font-medium text-white">{l.name}</span>
                          <span className="block text-xs text-zinc-400 mt-0.5">
                            {l.capacity ? `${l.capacity} seats` : "Capacity not set"} · published venue layout
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <aside className="glass-panel rounded-2xl border border-white/10 p-5 space-y-3 h-fit xl:sticky xl:top-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Saved options ({templates.length})
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Select layout(s) to send. Organizer must approve on Preview before a contract can be created.
              </p>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => openStudio({ createNew: true })}
              className="w-full btn-secondary py-2 text-sm"
            >
              + Add another layout option
            </button>

            {templates.length === 0 ? (
              <p className="text-sm text-zinc-500">Create and save a layout to add an option here.</p>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {templates.map((item) => {
                  const checked = selectedTemplateIds.includes(item.id);
                  const isActive = selectedId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-3 ${
                        isActive ? "border-rose-400 bg-rose-500/10" : "border-white/10 bg-white/5"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTemplate(item.id)}
                          className="mt-1 h-4 w-4 accent-rose-500 shrink-0"
                          aria-label={`Select ${item.name}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setCreatingNew(false);
                            setSeedFromVenue(false);
                            setActiveTemplateId(item.id);
                            setOptionName(item.name);
                            setStudioNonce((n) => n + 1);
                          }}
                          className="flex-1 text-left min-w-0"
                        >
                          <LayoutSeatPreview
                            seats={item.seats_json}
                            config={item.seating_config}
                            heightClass="h-24"
                          />
                          <p className="text-sm font-medium text-white mt-2 truncate">{item.name}</p>
                          <p className="text-[0.6875rem] text-zinc-400 mt-0.5">
                            {optionStatusLabel(item)}
                            {item.capacity ? ` · ${item.capacity} seats` : ""}
                          </p>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedTemplateIds.length > 1 && (
              <p className="text-xs text-amber-300 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                Multiple options — organizer chooses one on Preview before contract.
              </p>
            )}
            {selectedTemplateIds.length === 1 && (
              <p className="text-xs text-zinc-400 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                Organizer approves this layout on Preview, then Super Admin can create the contract.
              </p>
            )}

            <div>
              <label className="portal-label block text-sm mb-1.5">Admin notes (optional)</label>
              <textarea
                className="input-field w-full"
                rows={2}
                value={fulfillNotes}
                onChange={(e) => setFulfillNotes(e.target.value)}
              />
            </div>

            <button
              type="button"
              disabled={busy || selectedTemplateIds.length === 0}
              onClick={() => void sendToOrganizer()}
              className="w-full btn-primary py-2.5 text-sm disabled:opacity-50"
            >
              {fulfilling
                ? "Sending…"
                : selectedTemplateIds.length > 1
                  ? `Send ${selectedTemplateIds.length} options to organizer`
                  : "Send layout to organizer"}
            </button>
            {sendable.length > 0 && (
              <button
                type="button"
                className="w-full text-xs text-zinc-400 hover:text-zinc-200"
                onClick={() => setSelectedTemplateIds(sendable.map((t) => t.id))}
              >
                Select all saved options
              </button>
            )}
          </aside>
        </div>
      )}

      {canReject && (
        <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-3">
          <p className="text-sm font-medium text-white">Reject request</p>
          <textarea
            className="input-field w-full"
            rows={2}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason shown in audit / organizer context"
          />
          <button
            type="button"
            disabled={busy}
            onClick={reject}
            className="btn-secondary text-sm py-2 px-4 text-rose-400 border-rose-500/30"
          >
            Reject request
          </button>
        </div>
      )}

      {!canBuild && (
        <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-2">
          <p className="text-sm text-zinc-400">
            This request is closed ({request.status}).
            {request.fulfilled_template_name
              ? ` Fulfilled with: ${request.fulfilled_template_name}.`
              : ""}
          </p>
          {request.proposed_templates && request.proposed_templates.length > 0 && (
            <ul className="text-sm text-zinc-300 space-y-1">
              {request.proposed_templates.map((t) => (
                <li key={t.id}>
                  {t.name}
                  {t.capacity != null ? ` · ${t.capacity} seats` : ""}
                </li>
              ))}
            </ul>
          )}
          <Link href={`/admin/events/${request.event_id}`} className="text-rose-400 hover:underline text-sm">
            Open event detail
          </Link>
        </div>
      )}

      {isLayoutModalOpen && canBuild && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col p-2 sm:p-4">
          <div className="flex items-center justify-between pb-3 px-2 text-white border-b border-white/10 mb-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-rose-400">Event layout studio</p>
              <h2 className="text-lg font-bold truncate">
                {optionName || activeTemplate?.name || request.layout_name}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsLayoutModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold inline-flex items-center gap-2"
            >
              <X size={16} /> Close studio
            </button>
          </div>
          <div className="flex-1 min-h-0 bg-white rounded-2xl overflow-hidden">
            <VenueLayoutBuilder
              key={
                creatingNew
                  ? `new-modal-${studioNonce}-${seedFromVenue ? "seeded" : "blank"}`
                  : `modal-${activeTemplateId || selectedId || "empty"}-${studioNonce}`
              }
              venueAdapter={{
                sections,
                initialSeats,
                maxCapacity: targetCapacity > 0 ? targetCapacity : undefined,
                initialConfig: {
                  labels: Array.isArray(sourceConfig.labels) ? (sourceConfig.labels as never[]) : [],
                  shapes: Array.isArray(sourceConfig.shapes) ? (sourceConfig.shapes as never[]) : [],
                  bgImageUrl: sourceConfig.bgImageUrl || null,
                  sectionColors: sourceConfig.sectionColors,
                },
                saving,
                hideSubmitToVenue: true,
                onSave: async (payload, options) => {
                  await handleSaveTemplatePayload(payload, options);
                  setIsLayoutModalOpen(false);
                },
                onBlankPage: () => {
                  beginNewOption(false);
                  toast.info("Blank page ready — build, then Save as new option.");
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
