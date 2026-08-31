"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  useGetAdminVenueLayoutRequestQuery,
  useReviewAdminVenueLayoutRequestMutation,
  useSaveAdminVenueLayoutTemplateMutation,
  type VenueLayoutTemplate,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
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
  if (item.is_default) return "Venue approved";
  if (item.status === "PUBLISHED") return "Sent to venue";
  if (item.status === "REJECTED") return "Rejected";
  return "Draft";
}

export default function AdminVenueLayoutBuilderPage() {
  const params = useParams();
  const id = String(params.id || "");
  const { data: request, isLoading, refetch } = useGetAdminVenueLayoutRequestQuery(id, { skip: !id });
  const [reviewRequest, { isLoading: reviewing }] = useReviewAdminVenueLayoutRequestMutation();
  const [saveTemplate, { isLoading: saving }] = useSaveAdminVenueLayoutTemplateMutation();
  const [rejectReason, setRejectReason] = useState("");
  const [optionName, setOptionName] = useState("");
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const zones = useMemo(() => specZones(request?.spec_json), [request]);
  const images = useMemo(() => specImages(request?.spec_json), [request]);
  const notes = typeof request?.spec_json?.notes === "string" ? request.spec_json.notes : "";
  const venueMetaSnapshot = request?.spec_json?.venue_meta_snapshot as
    | Record<string, unknown>
    | undefined;
  const templates = request?.templates ?? [];

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
    : ((activeTemplate?.seating_config || request?.template_seating_config || {}) as { labels?: unknown[]; shapes?: unknown[] });

  const initialSeats = Array.isArray(sourceSeats)
    ? sourceSeats.map((seat, idx) => ({
        id: String(seat.id || `seat-${idx}`),
        internalId: String(seat.internalId || seat.id || `seat-${idx}`),
        ticket_type_id: (seat.ticket_type_id as string) || null,
        section_name: String(seat.section_name || "General"),
        row_label: String(seat.row_label || "A"),
        seat_label: String(seat.seat_label || `${idx + 1}`),
        coordinate_x: Number(seat.coordinate_x) || 0,
        coordinate_y: Number(seat.coordinate_y) || 0,
        status: String(seat.status || "AVAILABLE"),
        grid_id: seat.grid_id ? String(seat.grid_id) : undefined,
      }))
    : [];

  if (isLoading) return <div className="p-10 text-center text-zinc-400">Loading layout request...</div>;
  if (!request) {
    return (
      <div className="p-10 text-center">
        <p className="text-zinc-400 mb-4">Layout request not found.</p>
        <Link href="/admin/venue-layouts" className="text-rose-500">Back to requests</Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/venue-layouts" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
            <ArrowLeft size={16} /> Back to venue layouts
          </Link>
          <h1 className="text-2xl font-bold text-white mt-3">{request.layout_name}</h1>
          <p className="text-zinc-400 mt-1">
            {request.venue_name} · {request.hall_name || "Hall"} · {request.layout_type} · capacity {request.capacity}
          </p>
        </div>
        <span className="px-3 py-1 rounded-lg text-xs font-bold border border-white/10 text-zinc-300">
          {request.status.replaceAll("_", " ")}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_260px] gap-6">
        <aside className="glass-panel rounded-2xl border border-white/10 p-5 space-y-4 h-fit">
          <div>
            <label className="block text-xs uppercase tracking-wide text-zinc-500 mb-2">Layout option name</label>
            <input
              value={optionName || activeTemplate?.name || request.layout_name}
              onChange={(e) => setOptionName(e.target.value)}
              className="input-field"
              placeholder="Theater option A"
            />
            <p className="text-xs text-zinc-500 mt-1">Save multiple options. The venue will approve one.</p>
            <button
              type="button"
              onClick={() => {
                setCreatingNew(true);
                setActiveTemplateId(null);
                setOptionName(`${request.layout_name} option ${templates.length + 1}`);
              }}
              className="mt-2 text-sm text-amber-700 hover:text-amber-800"
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
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Requested zones</p>
            <div className="space-y-2">
              {sections.length ? sections.map((section) => (
                <div key={section.id} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                  <p className="text-white font-medium">{section.name}</p>
                  <p className="text-zinc-500 text-xs">Capacity {section.capacity}</p>
                </div>
              )) : <p className="text-sm text-zinc-500">No zones provided.</p>}
            </div>
          </div>
          {images.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Reference images</p>
              <div className="grid grid-cols-2 gap-2">
                {images.map((url, idx) => (
                  <a key={`${url}-${idx}`} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt={`Reference ${idx + 1}`} className="h-20 w-full object-cover rounded-lg border border-white/10" />
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
            key={creatingNew ? "new-option" : selectedId || "new"}
            venueAdapter={{
              sections,
              initialSeats,
              initialConfig: {
                labels: Array.isArray(sourceConfig.labels) ? (sourceConfig.labels as never[]) : [],
                shapes: Array.isArray(sourceConfig.shapes) ? (sourceConfig.shapes as never[]) : [],
              },
              saving,
              onSave: async (payload, options) => {
                const saved = await saveTemplate({
                  id,
                  name: optionName || request.layout_name,
                  template_id: creatingNew ? undefined : selectedId || undefined,
                  save_as_new: creatingNew || !selectedId,
                  seating_config: payload.seating_config,
                  seats: payload.seats,
                  publish: Boolean(options?.publish),
                }).unwrap();
                setCreatingNew(false);
                setActiveTemplateId(saved.id);
                setOptionName(saved.name);
                refetch();
              },
            }}
          />
        </div>

        <aside className="glass-panel rounded-2xl border border-white/10 p-5 space-y-3 h-fit xl:sticky xl:top-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Saved options</p>
            <p className="text-xs text-zinc-500 mt-1">Click an option to load it on the canvas.</p>
          </div>
          {templates.length === 0 ? (
            <p className="text-sm text-zinc-500">Save layout to add an option here.</p>
          ) : (
            <div className="space-y-3">
              {templates.map((item: VenueLayoutTemplate) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCreatingNew(false);
                    setActiveTemplateId(item.id);
                    setOptionName(item.name);
                  }}
                  className={`w-full text-left rounded-xl border p-3 ${
                    selectedId === item.id
                      ? "border-amber-300 bg-amber-50"
                      : "border-white/10 bg-white/40 hover:border-amber-200"
                  }`}
                >
                  <LayoutSeatPreview seats={item.seats_json} config={item.seating_config} heightClass="h-24" />
                  <p className="text-sm font-medium text-slate-900 mt-2">{item.name}</p>
                  <p className="text-[0.6875rem] text-zinc-500 mt-0.5">{optionStatusLabel(item)}</p>
                  {item.status === "REJECTED" && item.rejection_reason && (
                    <p className="text-[0.6875rem] text-rose-600 mt-1 line-clamp-3">{item.rejection_reason}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
