"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, Clapperboard, Eye, Plus, RefreshCw } from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import {
  useApproveVenueLayoutTemplateMutation,
  useCreateCinemaScreenMutation,
  useCreateVenueLayoutRequestMutation,
  useGetCinemaScreensQuery,
  useGetVenueLayoutTemplatesQuery,
  useRejectVenueLayoutTemplateMutation,
  useUpdateCinemaScreenMutation,
  type CinemaScreen,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";

const SCREEN_TYPES = [
  { value: "standard", label: "Standard" },
  { value: "imax", label: "IMAX" },
  { value: "4dx", label: "4DX" },
  { value: "other", label: "Other" },
];

type LayoutPhase =
  | "none"
  | "draft"
  | "awaiting_admin"
  | "ready_to_approve"
  | "approved"
  | "rejected";

function resolveLayoutPhase(screen: CinemaScreen): LayoutPhase {
  if (screen.layout_is_default && (screen.venue_layout_template_id || screen.layout_template_id)) {
    return "approved";
  }
  if (screen.pending_template_id) {
    return "ready_to_approve";
  }
  const reqStatus = String(screen.layout_request_status || "").toUpperCase();
  if (reqStatus === "REJECTED") return "rejected";
  if (reqStatus === "DRAFT") return "draft";
  if (reqStatus === "SUBMITTED" || reqStatus === "UNDER_REVIEW" || reqStatus === "APPROVED") {
    return "awaiting_admin";
  }
  return "none";
}

const PHASE_META: Record<
  LayoutPhase,
  { label: string; hint: string; badgeClass: string }
> = {
  none: {
    label: "No layout",
    hint: "Request a seat layout from Super Admin.",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
  },
  draft: {
    label: "Draft request",
    hint: "Finish and submit this request to Super Admin.",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  },
  awaiting_admin: {
    label: "Awaiting layout",
    hint: "Super Admin is building this screen’s seat map. You’ll see Review layout when it’s ready.",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  ready_to_approve: {
    label: "Ready to approve",
    hint: "Super Admin published a layout. Review and approve it.",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  approved: {
    label: "Layout ready",
    hint: "Approved seat map is linked to this screen.",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rejected: {
    label: "Rejected",
    hint: "Previous layout was rejected. Submit a new request.",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
};

export default function CinemaScreensPage() {
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";
  const { data: screens = [], isLoading, refetch } = useGetCinemaScreensQuery(bizId, {
    skip: !bizId,
  });
  const { data: layoutOptions = [] } = useGetVenueLayoutTemplatesQuery(bizId, { skip: !bizId });
  const [createScreen, { isLoading: creating }] = useCreateCinemaScreenMutation();
  const [updateScreen, { isLoading: updating }] = useUpdateCinemaScreenMutation();
  const [createLayoutRequest, { isLoading: submittingLayout }] = useCreateVenueLayoutRequestMutation();
  const [approveLayout, { isLoading: approving }] = useApproveVenueLayoutTemplateMutation();
  const [rejectLayout, { isLoading: rejecting }] = useRejectVenueLayoutTemplateMutation();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [name, setName] = useState("");
  const [screenType, setScreenType] = useState("standard");
  const [capacity, setCapacity] = useState("200");
  const [description, setDescription] = useState("");
  const [layoutScreenId, setLayoutScreenId] = useState<string | null>(null);
  const [previewScreenId, setPreviewScreenId] = useState<string | null>(null);
  const [reviewScreenId, setReviewScreenId] = useState<string | null>(null);

  const selectedScreen = useMemo(
    () => screens.find((s) => s.id === layoutScreenId) || null,
    [screens, layoutScreenId]
  );
  const previewScreen = useMemo(
    () => screens.find((s) => s.id === previewScreenId) || null,
    [screens, previewScreenId]
  );
  const reviewScreen = useMemo(
    () => screens.find((s) => s.id === reviewScreenId) || null,
    [screens, reviewScreenId]
  );

  const resetForm = () => {
    setName("");
    setScreenType("standard");
    setCapacity("200");
    setDescription("");
  };

  const onCreate = async () => {
    if (!bizId) return;
    if (!name.trim()) {
      toast.error("Screen name is required");
      return;
    }
    try {
      await createScreen({
        bizId,
        name: name.trim(),
        screen_type: screenType,
        capacity: Number(capacity) || 0,
        description: description.trim() || undefined,
      }).unwrap();
      toast.success("Screen created");
      resetForm();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to create screen"));
    }
  };

  const toggleActive = async (screen: CinemaScreen) => {
    if (!bizId) return;
    try {
      await updateScreen({
        bizId,
        screenId: screen.id,
        body: { is_active: !screen.is_active },
      }).unwrap();
      toast.success(screen.is_active ? "Screen disabled" : "Screen enabled");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update screen"));
    }
  };

  const submitLayout = async (submitNow: boolean) => {
    if (!bizId || !selectedScreen?.hall_id) {
      toast.error("This screen is missing a linked hall. Recreate the screen.");
      return;
    }
    const cap = Number(selectedScreen.capacity) || Number(capacity) || 100;
    const phase = resolveLayoutPhase(selectedScreen);
    try {
      await createLayoutRequest({
        bizId,
        ...(phase === "draft" && selectedScreen.layout_request_id
          ? { request_id: selectedScreen.layout_request_id }
          : {}),
        hall_id: selectedScreen.hall_id,
        hall_name: selectedScreen.name,
        hall_capacity: cap,
        layout_name: `${selectedScreen.name} seating`,
        layout_type: "theater",
        capacity: cap,
        is_indoor: true,
        spec_json: {
          hall_name: selectedScreen.name,
          hall_capacity: cap,
          zones: [
            { name: "Premium", capacity: Math.max(1, Math.round(cap * 0.3)) },
            { name: "Regular", capacity: Math.max(1, Math.round(cap * 0.7)) },
          ],
          notes: `Cinema screen layout for ${selectedScreen.name}`,
          intake_mode: "structured_request",
        },
        submit_now: submitNow,
      }).unwrap();
      toast.success(submitNow ? "Layout request submitted to Super Admin" : "Layout draft saved");
      setLayoutScreenId(null);
      refetch();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to submit layout request"));
    }
  };

  if (!bizId) {
    return <p className="text-zinc-400">Cinema business not linked to this account.</p>;
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Clapperboard size={20} className="text-fuchsia-400" /> Screens & layouts
        </h2>
        <p className="text-sm text-zinc-400 mt-1">
          Create screens, request a seat layout once, then track progress. When Super Admin publishes
          a map, review it here and approve.
        </p>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-5 space-y-4">
        <h3 className="text-white font-semibold">Add screen</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="portal-label">Screen name *</label>
            <input
              className="input-field"
              placeholder="Screen 1 / IMAX"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="portal-label">Screen type</label>
            <select
              className="input-field"
              value={screenType}
              onChange={(e) => setScreenType(e.target.value)}
            >
              {SCREEN_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="portal-label">Expected capacity</label>
            <input
              className="input-field"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div>
            <label className="portal-label">Notes</label>
            <input
              className="input-field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} /> {creating ? "Creating…" : "Create screen"}
        </button>
      </div>

      {layoutOptions.filter((opt) => opt.status === "PUBLISHED" && !opt.is_default).length > 0 && (
        <div className="glass-panel rounded-2xl border border-amber-500/20 p-5 space-y-3">
          <h3 className="text-white font-semibold">Layouts waiting for your approval</h3>
          <p className="text-sm text-zinc-400">
            Use <span className="text-zinc-200 font-medium">Review layout</span> on the matching
            screen below, or approve from here.
          </p>
          {layoutOptions
            .filter((opt) => opt.status === "PUBLISHED" && !opt.is_default)
            .map((opt) => (
              <div
                key={opt.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-white/10 p-3"
              >
                <div>
                  <p className="text-white text-sm font-medium">{opt.name}</p>
                  <p className="text-xs text-zinc-500">
                    {opt.hall_name || "Screen"} · capacity {opt.capacity} · {opt.seat_count ?? 0} seats
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={approving}
                    onClick={async () => {
                      try {
                        await approveLayout({ bizId, templateId: opt.id }).unwrap();
                        toast.success("Layout approved for this screen");
                        refetch();
                      } catch (err) {
                        toast.error(extractApiError(err, "Approve failed"));
                      }
                    }}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={rejecting}
                    onClick={() => {
                      setRejectId(opt.id);
                      setRejectReason("");
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {rejectId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 space-y-3">
            <h3 className="text-white font-semibold">Reject layout</h3>
            <textarea
              className="input-field min-h-[88px]"
              placeholder="Reason for Super Admin"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setRejectId(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary bg-rose-600 hover:bg-rose-500"
                disabled={rejecting || !rejectReason.trim()}
                onClick={async () => {
                  try {
                    await rejectLayout({
                      bizId,
                      templateId: rejectId,
                      reason: rejectReason.trim(),
                    }).unwrap();
                    toast.success("Layout rejected");
                    setRejectId(null);
                    refetch();
                  } catch (err) {
                    toast.error(extractApiError(err, "Reject failed"));
                  }
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        {isLoading ? (
          <p className="p-8 text-center text-zinc-400">Loading screens…</p>
        ) : screens.length === 0 ? (
          <p className="p-8 text-center text-zinc-500">No screens yet. Create Screen 1 to get started.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {screens.map((screen) => {
              const phase = resolveLayoutPhase(screen);
              const meta = PHASE_META[phase];
              const seatCount =
                phase === "approved"
                  ? Number(screen.layout_seat_count || 0)
                  : phase === "ready_to_approve"
                    ? Number(screen.pending_seat_count || 0)
                    : 0;

              return (
                <div
                  key={screen.id}
                  className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-white font-semibold">{screen.name}</p>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.badgeClass}`}
                      >
                        {phase === "approved" ? <CheckCircle size={12} /> : null}
                        {meta.label}
                      </span>
                      {!screen.is_active && (
                        <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-white/10">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400">
                      {(screen.screen_type || "standard").toUpperCase()} · capacity {screen.capacity}
                      {seatCount > 0 ? ` · ${seatCount} seats mapped` : ""}
                      {screen.layout_name ? ` · ${screen.layout_name}` : ""}
                    </p>
                    <p className="text-xs text-zinc-500">{meta.hint}</p>
                    {phase === "rejected" && (screen.latest_rejection_reason || screen.pending_rejection_reason) && (
                      <p className="text-xs text-rose-400">
                        Reason: {screen.latest_rejection_reason || screen.pending_rejection_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {phase === "none" && (
                      <button
                        type="button"
                        onClick={() => setLayoutScreenId(screen.id)}
                        className="btn-primary text-sm"
                        disabled={!screen.hall_id}
                      >
                        Request layout
                      </button>
                    )}

                    {phase === "draft" && (
                      <button
                        type="button"
                        onClick={() => setLayoutScreenId(screen.id)}
                        className="btn-primary text-sm"
                        disabled={!screen.hall_id}
                      >
                        Continue request
                      </button>
                    )}

                    {phase === "awaiting_admin" && (
                      <button
                        type="button"
                        disabled
                        title="Layout request sent. Super Admin is building the seat map for this screen. When they publish it, this becomes Review layout."
                        className="px-3 py-2 rounded-xl text-sm border border-amber-500/30 bg-amber-500/10 text-amber-300 cursor-help"
                      >
                        Awaiting layout
                      </button>
                    )}

                    {phase === "ready_to_approve" && (
                      <button
                        type="button"
                        onClick={() => setReviewScreenId(screen.id)}
                        className="btn-primary text-sm inline-flex items-center gap-1.5"
                      >
                        <Eye size={14} /> Review layout
                      </button>
                    )}

                    {phase === "approved" && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPreviewScreenId(screen.id)}
                          className="btn-primary text-sm inline-flex items-center gap-1.5"
                        >
                          <Eye size={14} /> View layout
                        </button>
                        <button
                          type="button"
                          onClick={() => setLayoutScreenId(screen.id)}
                          className="btn-secondary text-sm inline-flex items-center gap-1.5"
                          disabled={!screen.hall_id}
                          title="Ask Super Admin for an updated seat map"
                        >
                          <RefreshCw size={14} /> Request update
                        </button>
                      </>
                    )}

                    {phase === "rejected" && (
                      <button
                        type="button"
                        onClick={() => setLayoutScreenId(screen.id)}
                        className="btn-primary text-sm inline-flex items-center gap-1.5"
                        disabled={!screen.hall_id}
                      >
                        <RefreshCw size={14} /> Request again
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleActive(screen)}
                      disabled={updating}
                      className="px-3 py-2 rounded-xl text-sm border border-white/10 text-zinc-300 hover:bg-white/5"
                    >
                      {screen.is_active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedScreen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 space-y-4">
            <h3 className="text-white font-semibold">
              {resolveLayoutPhase(selectedScreen) === "draft"
                ? "Continue layout request"
                : resolveLayoutPhase(selectedScreen) === "approved"
                  ? "Request layout update"
                  : resolveLayoutPhase(selectedScreen) === "rejected"
                    ? "Request layout again"
                    : "Request layout"}{" "}
              — {selectedScreen.name}
            </h3>
            <p className="text-sm text-zinc-400">
              This sends a theater layout request to Super Admin. After they publish a seat map,
              you will see <span className="text-zinc-200">Review layout</span> on this screen.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setLayoutScreenId(null)}>
                Cancel
              </button>
              {resolveLayoutPhase(selectedScreen) === "draft" && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={submittingLayout}
                  onClick={() => submitLayout(false)}
                >
                  Save draft
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                disabled={submittingLayout}
                onClick={() => submitLayout(true)}
              >
                {submittingLayout ? "Submitting…" : "Submit to Super Admin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewScreen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-white font-semibold">Layout — {previewScreen.name}</h3>
                <p className="text-sm text-zinc-400 mt-1">
                  {previewScreen.layout_name || "Approved layout"} ·{" "}
                  {Number(previewScreen.layout_seat_count || 0)} seats
                </p>
              </div>
              <button type="button" className="btn-secondary text-sm" onClick={() => setPreviewScreenId(null)}>
                Close
              </button>
            </div>
            <LayoutSeatPreview
              seats={previewScreen.layout_seats_json}
              config={previewScreen.layout_seating_config}
              heightClass="h-64"
              className="bg-zinc-900"
            />
          </div>
        </div>
      )}

      {reviewScreen && reviewScreen.pending_template_id && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-5 space-y-4">
            <div>
              <h3 className="text-white font-semibold">Review layout — {reviewScreen.name}</h3>
              <p className="text-sm text-zinc-400 mt-1">
                {reviewScreen.pending_template_name || "Published layout"} ·{" "}
                {Number(reviewScreen.pending_seat_count || 0)} seats · capacity{" "}
                {reviewScreen.pending_template_capacity ?? reviewScreen.capacity}
              </p>
            </div>
            <LayoutSeatPreview
              seats={reviewScreen.pending_seats_json}
              config={reviewScreen.pending_seating_config}
              heightClass="h-64"
              className="bg-zinc-900"
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setReviewScreenId(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={rejecting}
                onClick={() => {
                  setRejectId(reviewScreen.pending_template_id!);
                  setRejectReason("");
                  setReviewScreenId(null);
                }}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={approving}
                onClick={async () => {
                  try {
                    await approveLayout({
                      bizId,
                      templateId: reviewScreen.pending_template_id!,
                    }).unwrap();
                    toast.success("Layout approved for this screen");
                    setReviewScreenId(null);
                    refetch();
                  } catch (err) {
                    toast.error(extractApiError(err, "Approve failed"));
                  }
                }}
              >
                {approving ? "Approving…" : "Approve layout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
