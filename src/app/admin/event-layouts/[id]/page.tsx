"use client";

import { useEffect, useMemo, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Maximize2, X } from "lucide-react";
import { toast } from "sonner";
import {
  useFulfillAdminEventLayoutRequestMutation,
  useFulfillAdminEventLayoutRequestMutation,
  useGetAdminEventLayoutRequestQuery,
  useReviewAdminEventLayoutRequestMutation,
  useSaveAdminEventLayoutBuildMutation,
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

const VenueLayoutBuilder = dynamic(
  () => import("@/components/EventAdminPanel/VenueLayoutBuilder"),
  { ssr: false }
);

export default function AdminEventLayoutDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  const { data: request, isLoading, refetch } = useGetAdminEventLayoutRequestQuery(id, { skip: !id });
  const [reviewRequest, { isLoading: reviewing }] = useReviewAdminEventLayoutRequestMutation();
  const [saveTemplate, { isLoading: saving }] = useSaveAdminEventLayoutTemplateMutation();
  const [fulfillRequest, { isLoading: fulfilling }] = useFulfillAdminEventLayoutRequestMutation();
  const [saveBuild, { isLoading: saving }] = useSaveAdminEventLayoutBuildMutation();

  const [rejectReason, setRejectReason] = useState("");
  const [fulfillNotes, setFulfillNotes] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [applyToEvent, setApplyToEvent] = useState(true);
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [optionName, setOptionName] = useState("");

  const busy = reviewing || saving || fulfilling || saving;
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
  const layouts = request?.published_layouts || [];
  const ticketTypes = request?.ticket_types || [];
  const targetCapacity = Number(request?.target_capacity || request?.capacity) || 0;

  const sections = useMemo(() => {
    if (ticketTypes.length > 0) {
      return ticketTypes.map((t) => ({
        id: t.id,
        name: t.ticket_type,
        capacity: Number(t.total_count) || 0,
        price: Number(t.price) || 0,
      }));
    }
    return [{ id: "General", name: "General", capacity: targetCapacity || 0 }];
  }, [ticketTypes, targetCapacity]);

  const initialSeats = useMemo(() => {
    const tpl = (request?.templates || []).find((t) => t.id === request?.fulfilled_template_id) || request?.templates?.[0];
    const raw = tpl?.seats_json;
    if (!Array.isArray(raw)) return [];
    return raw.map((seat, idx) => {
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
  }, [request]);

  const initialConfig = useMemo(() => {
    const tpl = (request?.templates || []).find((t) => t.id === request?.fulfilled_template_id) || request?.templates?.[0];
    const cfg = (tpl?.seating_config || request?.event_seating_config || {}) as {
      labels?: unknown[];
      shapes?: unknown[];
      bgImageUrl?: string | null;
    };
    return {
      labels: Array.isArray(cfg.labels) ? (cfg.labels as never[]) : [],
      shapes: Array.isArray(cfg.shapes) ? (cfg.shapes as never[]) : [],
      bgImageUrl: cfg.bgImageUrl || null,
    };
  }, [request]);

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
        fulfilled_template_id: templateId || null,
        apply_to_event: applyToEvent,
        notes: fulfillNotes.trim() || undefined,
      }).unwrap();
      toast.success(res.message || "Layout options sent");
      refetch();
    } catch (e) {
      toast.error(extractApiError(e));
    }
  };

  const handleSaveStudio = async (payload: {
    seating_config: Record<string, unknown>;
    seats: unknown[];
  }) => {
    await saveBuild({
      id,
      name: optionName || request?.layout_name || "Event layout",
      template_id: request?.fulfilled_template_id || undefined,
      seating_config: payload.seating_config,
      seats: payload.seats,
    }).unwrap();
    toast.success("Event layout saved with full studio tools");
    setIsStudioOpen(false);
    refetch();
  };

  if (isLoading) {
    return <p className="text-zinc-400 p-6">Loading event layout request…</p>;
  }
  if (!request) {
    return <p className="text-rose-400 p-6">Event layout request not found.</p>;
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/event-layouts"
          className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">{request.layout_name || "Event layout request"}</h1>
          <p className="text-sm text-zinc-400">
            Status: {request.status}
            {targetCapacity > 0 ? ` · target ${targetCapacity} seats` : ""}
          </p>
        </div>
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
          <p className="text-zinc-300">Capacity: {request.capacity ?? targetCapacity ?? 0}</p>
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
        {ticketTypes.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Requested ticket / seating zones</p>
            <div className="flex flex-wrap gap-2">
              {ticketTypes.map((t) => (
                <span
                  key={t.id}
                  className="px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs font-semibold"
                >
                  {t.ticket_type}: {t.total_count} seats
                </span>
              ))}
            </div>
          </div>
        )}
        {request.notes && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Organizer notes</p>
            <p className="text-sm text-zinc-200 whitespace-pre-wrap">{request.notes}</p>
          </div>
        )}
      </div>

      {canAct && (
        <div className="glass-panel rounded-2xl border border-amber-500/20 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-white font-semibold">Build layout (same studio as venue & cinema)</h2>
              <p className="text-sm text-zinc-400 mt-1">
                Use Select, Pan, Add Seat, Add Grid, Text, Stage, Eraser, templates, colors, and capacity
                tracking — identical tools to Venue & Cinema Layouts.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2"
              onClick={() => {
                setOptionName(request.layout_name || "Event layout");
                if (request.status === "SUBMITTED") void startReview();
                setIsStudioOpen(true);
              }}
            >
              <Maximize2 size={16} /> Open full-screen studio
            </button>
          </div>
          <input
            className="input-field"
            value={optionName}
            onChange={(e) => setOptionName(e.target.value)}
            placeholder="Layout option name"
          />
        </div>
      )}

      {canAct && (
        <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Admin actions</h2>

          {request.status === "SUBMITTED" && (
            <button type="button" disabled={busy} onClick={startReview} className="btn-secondary text-sm py-2 px-4">
              Start review
            </button>
          )}

          <div className="space-y-3 border-t border-white/10 pt-4">
            <p className="text-sm font-medium text-white">Or fulfill with an existing published venue layout</p>
            {layouts.length > 0 ? (
              <div>
                <label className="portal-label block text-sm mb-1.5">Attach published venue layout</label>
                <select
                  className="input-field w-full"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  <option value="">No template (mark for organizer only)</option>
                  {layouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.is_default ? " (default)" : ""}
                      {l.capacity ? ` · ${l.capacity}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                No published venue layouts yet — use the studio above to build one.
              </p>
            )}

            {templateId && (
              <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={applyToEvent} onChange={(e) => setApplyToEvent(e.target.checked)} />
                Apply seats to event now
              </label>
            )}

            <textarea
              className="input-field min-h-[70px]"
              placeholder="Optional notes for organizer"
              value={fulfillNotes}
              onChange={(e) => setFulfillNotes(e.target.value)}
            />
            <button type="button" disabled={busy} onClick={fulfill} className="btn-primary text-sm py-2 px-4">
              {fulfilling ? "Sending…" : "Send to organizer"}
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

          <div className="space-y-2 border-t border-white/10 pt-4">
            <textarea
              className="input-field min-h-[70px]"
              placeholder="Rejection reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={reject}
              className="px-4 py-2 rounded-xl border border-rose-400/40 text-rose-300 hover:bg-rose-500/10 text-sm"
            >
              Reject request
            </button>
          </div>
        </div>
      )}

      {isStudioOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 p-2 sm:p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2 px-1">
            <div>
              <p className="text-white font-semibold">Full Screen Layout Studio — Event</p>
              <p className="text-xs text-zinc-400">
                Same tools as venue & cinema. Ticket zones show requested seat counts from the organizer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsStudioOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm inline-flex items-center gap-1.5"
            >
              <X size={16} /> Close Studio
            </button>
          </div>
          <div className="flex-1 min-h-0 bg-white rounded-2xl overflow-hidden">
            <VenueLayoutBuilder
              key={`event-studio-${id}`}
              venueAdapter={{
                sections,
                initialSeats,
                maxCapacity: targetCapacity || undefined,
                initialConfig,
                saving,
                hideSubmitToVenue: true,
                onSave: handleSaveStudio,
                onBlankPage: () => {
                  toast.info("Blank canvas — build seats with Add Grid / Add Seat / templates.");
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
