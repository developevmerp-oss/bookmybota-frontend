"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, ImagePlus, Plus, Trash2, Upload, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import {
  useApproveVenueLayoutTemplateMutation,
  useCreateVenueLayoutRequestMutation,
  useGetVenueLayoutRequestsQuery,
  useGetVenueLayoutTemplateQuery,
  useGetVenueLayoutTemplatesQuery,
  useRejectVenueLayoutTemplateMutation,
  useUploadImageMutation,
  type VenueLayoutRequest,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { extractUploadUrl, resolveMediaUrl } from "@/lib/mediaUrl";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";

type ZoneRow = { name: string; capacity: string };
type SaveMode = "draft" | "submit" | null;

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  SUBMITTED: "bg-amber-50 text-amber-700 border-amber-200",
  UNDER_REVIEW: "bg-sky-50 text-sky-700 border-sky-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  ARCHIVED: "bg-slate-50 text-slate-500 border-slate-200",
};

const emptyForm = {
  hallName: "",
  hallDescription: "",
  hallCapacity: "300",
  layoutName: "",
  layoutType: "theater",
  capacity: "300",
  notes: "",
  isIndoor: true,
};

function zoneTotal(zones: ZoneRow[]) {
  return zones.reduce((sum, zone) => sum + (Number(zone.capacity) || 0), 0);
}

function requestZones(spec: Record<string, unknown> | undefined) {
  const raw = spec?.zones;
  if (!Array.isArray(raw)) return [] as Array<{ name?: string; capacity?: number }>;
  return raw as Array<{ name?: string; capacity?: number }>;
}

function specString(spec: Record<string, unknown> | undefined, key: string) {
  const value = spec?.[key];
  return typeof value === "string" ? value : "";
}

function specImages(spec: Record<string, unknown> | undefined) {
  const raw = spec?.reference_images;
  if (!Array.isArray(raw)) return [] as string[];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => resolveMediaUrl(item));
}

export default function VenueLayoutRequestsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id ?? "";
  const { data: requests = [], isLoading } = useGetVenueLayoutRequestsQuery(bizId, { skip: !bizId });
  const { data: layoutOptions = [], isLoading: loadingOptions } = useGetVenueLayoutTemplatesQuery(bizId, { skip: !bizId });
  const [createRequest] = useCreateVenueLayoutRequestMutation();
  const [approveLayout, { isLoading: approving }] = useApproveVenueLayoutTemplateMutation();
  const [rejectLayout, { isLoading: rejecting }] = useRejectVenueLayoutTemplateMutation();
  const [uploadImage, { isLoading: uploadingImage }] = useUploadImageMutation();

  const [hallName, setHallName] = useState(emptyForm.hallName);
  const [hallDescription, setHallDescription] = useState(emptyForm.hallDescription);
  const [hallCapacity, setHallCapacity] = useState(emptyForm.hallCapacity);
  const [layoutName, setLayoutName] = useState(emptyForm.layoutName);
  const [layoutType, setLayoutType] = useState(emptyForm.layoutType);
  const [capacity, setCapacity] = useState(emptyForm.capacity);
  const [zones, setZones] = useState<ZoneRow[]>([{ name: "", capacity: "" }]);
  const [notes, setNotes] = useState(emptyForm.notes);
  const [isIndoor, setIsIndoor] = useState(emptyForm.isIndoor);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<SaveMode>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { data: viewingLayout, isFetching: loadingView } = useGetVenueLayoutTemplateQuery(
    { bizId, templateId: viewingId || "" },
    { skip: !bizId || !viewingId }
  );

  const totalZoneCapacity = useMemo(() => zoneTotal(zones), [zones]);
  const busy = saveMode !== null;

  const resetForm = () => {
    setEditingRequestId(null);
    setHallName(emptyForm.hallName);
    setHallDescription(emptyForm.hallDescription);
    setHallCapacity(emptyForm.hallCapacity);
    setLayoutName(emptyForm.layoutName);
    setLayoutType(emptyForm.layoutType);
    setCapacity(emptyForm.capacity);
    setZones([{ name: "", capacity: "" }]);
    setNotes(emptyForm.notes);
    setIsIndoor(emptyForm.isIndoor);
    setReferenceImages([]);
  };

  const loadRequestIntoForm = (request: VenueLayoutRequest) => {
    const spec = request.spec_json || {};
    const zonesFromSpec = requestZones(spec).map((zone) => ({
      name: zone.name || "",
      capacity: String(zone.capacity || ""),
    }));
    setEditingRequestId(request.id);
    setHallName(request.hall_name || specString(spec, "hall_name") || "");
    setHallDescription(request.hall_description || specString(spec, "hall_description") || "");
    setHallCapacity(String(request.hall_capacity || spec.hall_capacity || request.capacity || ""));
    setLayoutName(request.layout_name || "");
    setLayoutType(request.layout_type || "theater");
    setCapacity(String(request.capacity || ""));
    setZones(zonesFromSpec.length ? zonesFromSpec : [{ name: "", capacity: "" }]);
    setNotes(specString(spec, "notes"));
    setIsIndoor(request.hall_is_indoor !== false && spec.is_indoor !== false);
    setReferenceImages(specImages(spec));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const buildSpec = () => ({
    hall_name: hallName.trim(),
    hall_description: hallDescription.trim(),
    hall_capacity: Number(hallCapacity) || Number(capacity) || 0,
    is_indoor: isIndoor,
    zones: zones
      .map((zone) => ({ name: zone.name.trim(), capacity: Number(zone.capacity) || 0 }))
      .filter((zone) => zone.name && zone.capacity > 0),
    notes: notes.trim(),
    reference_images: referenceImages
      .filter((url) => !url.startsWith("blob:"))
      .map((url) => resolveMediaUrl(url)),
    intake_mode: "structured_request",
  });

  const validate = (mode: SaveMode) => {
    if (!bizId) {
      toast.error("Missing venue session. Please sign in again.");
      return false;
    }
    if (!hallName.trim()) {
      toast.error("Hall name is required.");
      return false;
    }
    if (!layoutName.trim()) {
      toast.error("Layout name is required.");
      return false;
    }
    if (!Number(capacity) || Number(capacity) <= 0) {
      toast.error("Usable capacity must be greater than 0.");
      return false;
    }
    if (mode === "submit") {
      const filledZones = zones.filter((zone) => zone.name.trim() && Number(zone.capacity) > 0);
      if (filledZones.length === 0) {
        toast.error("Add at least one section or zone with seating capacity.");
        return false;
      }
    }
    return true;
  };

  const save = async (mode: "draft" | "submit") => {
    if (!validate(mode)) return;
    setSaveMode(mode);
    try {
      const payload = {
        bizId,
        hall_name: hallName,
        hall_description: hallDescription,
        hall_capacity: Number(hallCapacity) || Number(capacity),
        is_indoor: isIndoor,
        layout_name: layoutName,
        layout_type: layoutType,
        capacity: Number(capacity),
        spec_json: buildSpec(),
        submit_now: mode === "submit",
      };
      const saved = await createRequest({
        ...payload,
        ...(editingRequestId ? { request_id: editingRequestId } : {}),
      }).unwrap();
      if (mode === "draft") {
        setEditingRequestId(saved.id);
        toast.success("Draft saved. Fields are kept so you can continue and submit.");
      } else {
        toast.success("Layout request submitted for Super Admin review.");
        resetForm();
      }
    } catch (err: unknown) {
      toast.error(extractApiError(err, mode === "draft" ? "Failed to save draft" : "Failed to submit layout request"));
    } finally {
      setSaveMode(null);
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    const pending = list.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setReferenceImages((prev) => [...prev, ...pending.map((item) => item.preview)]);
    try {
      for (const item of pending) {
        const formData = new FormData();
        formData.append("image", item.file);
        const res = await uploadImage(formData).unwrap();
        const url = extractUploadUrl(res);
        if (!url) throw new Error("Upload returned no image URL.");
        setReferenceImages((prev) =>
          prev.map((entry) => (entry === item.preview ? url : entry))
        );
        URL.revokeObjectURL(item.preview);
      }
      toast.success(list.length === 1 ? "Reference image uploaded" : `${list.length} images uploaded`);
    } catch (err: unknown) {
      setReferenceImages((prev) => prev.filter((entry) => !pending.some((item) => item.preview === entry)));
      for (const item of pending) URL.revokeObjectURL(item.preview);
      toast.error(extractApiError(err, "Failed to upload reference image"));
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Layout requests</h2>
        <p className="text-zinc-400 mt-1">
          Describe the hall, add zones with seating capacity, and attach reference images. Super Admin uses this to build the reusable layout.
        </p>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {editingRequestId ? "Continue draft" : "New layout request"}
              </h3>
              <p className="text-sm text-zinc-400 mt-1">
                {editingRequestId
                  ? "Saved fields are loaded. Review them, then submit for Super Admin."
                  : "Fill hall details first, then add sections and images."}
              </p>
            </div>
            {editingRequestId && (
              <button type="button" onClick={resetForm} className="text-sm text-zinc-400 hover:text-amber-600">
                Start new
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-8">
          <section className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Hall details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Hall name *</label>
                <input value={hallName} onChange={(e) => setHallName(e.target.value)} className="input-field" placeholder="Main Hall" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Hall capacity</label>
                <input value={hallCapacity} onChange={(e) => setHallCapacity(e.target.value)} className="input-field" type="number" min="1" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">Hall description</label>
              <textarea
                value={hallDescription}
                onChange={(e) => setHallDescription(e.target.value)}
                className="input-field min-h-[88px] resize-y"
                rows={2}
                placeholder="Location inside the venue, access notes, or hall features"
              />
            </div>
          </section>

          <section className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Layout details</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Layout name *</label>
                <input value={layoutName} onChange={(e) => setLayoutName(e.target.value)} className="input-field" placeholder="Standard theater seating" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Layout type</label>
                <select value={layoutType} onChange={(e) => setLayoutType(e.target.value)} className="input-field portal-select">
                  <option value="theater">Theater</option>
                  <option value="banquet">Banquet</option>
                  <option value="standing">Standing</option>
                  <option value="conference">Conference</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Usable capacity *</label>
                <input value={capacity} onChange={(e) => setCapacity(e.target.value)} className="input-field" type="number" min="1" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsIndoor(true)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${isIndoor ? "bg-amber-50 text-amber-700 border-amber-200" : "border-white/10 text-zinc-400"}`}
              >
                Indoor venue
              </button>
              <button
                type="button"
                onClick={() => setIsIndoor(false)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${!isIndoor ? "bg-amber-50 text-amber-700 border-amber-200" : "border-white/10 text-zinc-400"}`}
              >
                Outdoor venue
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Sections or zones</h4>
                <p className="text-xs text-zinc-500 mt-1">Add each zone with its own seating capacity.</p>
              </div>
              {totalZoneCapacity > 0 && (
                <span className="text-xs font-medium text-zinc-400">Zone total: {totalZoneCapacity}</span>
              )}
            </div>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_160px_88px] gap-2 px-4 py-2 bg-white/5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <span>Zone name</span>
                <span>Seating capacity</span>
                <span />
              </div>
              <div className="divide-y divide-white/5">
                {zones.map((zone, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_160px_88px] gap-2 p-3 sm:px-4">
                    <input
                      value={zone.name}
                      onChange={(e) => setZones((prev) => prev.map((item, i) => (i === idx ? { ...item, name: e.target.value } : item)))}
                      className="input-field"
                      placeholder="e.g. VIP"
                    />
                    <input
                      value={zone.capacity}
                      onChange={(e) => setZones((prev) => prev.map((item, i) => (i === idx ? { ...item, capacity: e.target.value } : item)))}
                      className="input-field"
                      type="number"
                      min="1"
                      placeholder="Capacity"
                    />
                    <button
                      type="button"
                      disabled={zones.length === 1}
                      onClick={() => setZones((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))}
                      className="h-11 rounded-xl border border-white/10 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center"
                      title="Remove zone"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setZones((prev) => [...prev, { name: "", capacity: "" }])}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-white/20 text-sm font-medium text-zinc-300 hover:border-amber-400 hover:text-amber-600"
            >
              <Plus size={16} />
              Add zone
            </button>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Layout notes</h4>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field min-h-[110px] resize-y"
              rows={4}
              placeholder="Stage position, entry gates, wheelchair areas, blocked pillars, etc."
            />
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Reference layout images</h4>
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 px-4 py-8 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/40"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void uploadFiles(e.dataTransfer.files);
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={uploadingImage}
                onChange={(e) => {
                  const files = e.target.files;
                  e.target.value = "";
                  if (files) void uploadFiles(files);
                }}
              />
              <span className="h-10 w-10 rounded-full bg-amber-50 text-amber-600 inline-flex items-center justify-center">
                {uploadingImage ? <Upload size={18} className="animate-pulse" /> : <ImagePlus size={18} />}
              </span>
              <span className="text-sm font-medium text-white">
                {uploadingImage ? "Uploading images..." : "Click to upload or drag images here"}
              </span>
              <span className="text-xs text-zinc-500">JPG, PNG, or WebP. Add floor plans, photos, or sketches.</span>
            </label>
            {referenceImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {referenceImages.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative group rounded-xl overflow-hidden border border-white/10 bg-white">
                    <img src={resolveMediaUrl(url)} alt={`Reference ${idx + 1}`} className="w-full h-28 object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
                        setReferenceImages((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/70 text-white inline-flex items-center justify-center"
                      title="Remove image"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="px-6 py-4 border-t border-white/10 bg-white/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-zinc-500">
            <strong className="text-zinc-400">Save draft</strong> keeps the form filled so you can continue later.{" "}
            <strong className="text-zinc-400">Submit for review</strong> sends this same request to Super Admin.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={() => void save("draft")} className="btn-secondary disabled:opacity-50">
              {saveMode === "draft" ? "Saving draft..." : "Save draft"}
            </button>
            <button type="button" disabled={busy} onClick={() => void save("submit")} className="btn-primary disabled:opacity-50">
              {saveMode === "submit" ? "Submitting..." : editingRequestId ? "Submit this draft" : "Submit for review"}
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Layout options from Super Admin</h3>
            <p className="text-sm text-zinc-500 mt-1">View each option, then approve one or reject it with a reason.</p>
          </div>
        </div>
        {loadingOptions ? (
          <p className="text-zinc-400">Loading layout options...</p>
        ) : layoutOptions.length === 0 ? (
          <p className="text-zinc-500">No layout options yet. Super Admin will send options here after building your request.</p>
        ) : (
          <div className="space-y-3">
            {layoutOptions.map((option) => {
              const waiting = option.status === "PUBLISHED" && !option.is_default;
              const rejected = option.status === "REJECTED";
              return (
                <div
                  key={option.id}
                  className={`rounded-xl border p-4 ${
                    option.is_default
                      ? "border-emerald-300 bg-emerald-50/60"
                      : rejected
                        ? "border-rose-200 bg-rose-50/40"
                        : "border-white/10 bg-white/50"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                      <p className="text-white font-semibold">{option.name}</p>
                      <p className="text-sm text-zinc-400 mt-1">
                        {(option.hall_name || "Hall")} · {option.layout_type} · capacity {option.capacity}
                        {option.seat_count ? ` · ${option.seat_count} seats` : ""}
                      </p>
                      {rejected && option.rejection_reason && (
                        <p className="text-sm text-rose-600 mt-2">Rejected reason: {option.rejection_reason}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingId(option.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 text-sm text-zinc-200 hover:bg-white/10"
                      >
                        <Eye size={14} /> View
                      </button>
                      {option.is_default ? (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                          Approved system layout
                        </span>
                      ) : rejected ? (
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-bold border bg-rose-50 text-rose-700 border-rose-200">
                          Rejected
                        </span>
                      ) : waiting ? (
                        <>
                          <button
                            type="button"
                            disabled={approving}
                            onClick={async () => {
                              try {
                                await approveLayout({ bizId, templateId: option.id }).unwrap();
                                toast.success("Layout approved. It will now show across the system.");
                              } catch (err: unknown) {
                                toast.error(extractApiError(err, "Failed to approve layout"));
                              }
                            }}
                            className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
                          >
                            {approving ? "Approving..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            disabled={rejecting}
                            onClick={() => {
                              setRejectingId(option.id);
                              setRejectReason("");
                            }}
                            className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-sm hover:bg-rose-50 disabled:opacity-50"
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
          <h3 className="text-lg font-semibold text-white">Existing requests</h3>
          <span className="text-xs text-zinc-500">{requests.length} total</span>
        </div>
        {isLoading ? (
          <p className="text-zinc-400">Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="text-zinc-500">No layout requests yet. Save a draft or submit the form above.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const zonesInRequest = requestZones(request.spec_json);
              return (
                <div
                  key={request.id}
                  className={`rounded-xl border p-4 ${
                    editingRequestId === request.id
                      ? "border-amber-300 bg-amber-50/60"
                      : "border-white/10 bg-white/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-white font-semibold">{request.layout_name}</p>
                      <p className="text-sm text-zinc-400 mt-1">
                        {(request.hall_name || "Hall")} · {request.layout_type} · capacity {request.capacity}
                      </p>
                      {zonesInRequest.length > 0 && (
                        <p className="text-xs text-zinc-500 mt-2">
                          {zonesInRequest.map((zone) => `${zone.name || "Zone"} (${zone.capacity || 0})`).join(" · ")}
                        </p>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${STATUS_STYLES[request.status] || STATUS_STYLES.DRAFT}`}>
                      {request.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  {request.review_comments && (
                    <p className="text-sm text-amber-600 mt-3">Admin comment: {request.review_comments}</p>
                  )}
                  {(request.status === "DRAFT" || request.status === "REJECTED") && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => loadRequestIntoForm(request)}
                        className="text-sm font-medium text-amber-700 hover:text-amber-800"
                      >
                        {editingRequestId === request.id ? "Editing this draft" : "Continue editing"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewingId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setViewingId(null)}>
          <div className="w-full max-w-3xl rounded-2xl bg-zinc-950 border border-white/10 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{viewingLayout?.name || "Layout option"}</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {(viewingLayout?.hall_name || "Hall")} · {viewingLayout?.layout_type || ""} · {viewingLayout?.seat_count || 0} seats
                </p>
              </div>
              <button type="button" onClick={() => setViewingId(null)} className="h-8 w-8 rounded-full border border-white/10 text-zinc-300 inline-flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
            {loadingView ? (
              <p className="text-zinc-400 py-10 text-center">Loading layout...</p>
            ) : (
              <LayoutSeatPreview
                seats={viewingLayout?.seats_json}
                config={viewingLayout?.seating_config}
                heightClass="h-[420px]"
              />
            )}
            {viewingLayout?.rejection_reason && (
              <p className="text-sm text-rose-400 mt-4">Rejected reason: {viewingLayout.rejection_reason}</p>
            )}
          </div>
        </div>
      )}

      {rejectingId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setRejectingId(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-white/10 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Reject layout option</h3>
                <p className="text-sm text-zinc-400 mt-1">Add a reason so Super Admin can revise this option.</p>
              </div>
              <button type="button" onClick={() => setRejectingId(null)} className="h-8 w-8 rounded-full border border-white/10 text-zinc-300 inline-flex items-center justify-center">
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
      )}
    </div>
  );
}
