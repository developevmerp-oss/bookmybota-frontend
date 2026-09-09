"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import { CheckCircle, CheckCircle2, Clapperboard, Clock, Edit3, Eye, Layers, Plus, RefreshCw, X } from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import {
  useApproveVenueLayoutTemplateMutation,
  usePublishVenueLayoutTemplateMutation,
  useCreateCinemaScreenMutation,
  useCreateVenueLayoutRequestMutation,
  useGetCinemaScreensQuery,
  useGetVenueLayoutTemplatesQuery,
  useGetVenueLayoutTemplateQuery,
  useRejectVenueLayoutTemplateMutation,
  useRejectAllVenueLayoutTemplatesMutation,
  useUpdateCinemaScreenMutation,
  useUpdateCinemaScreenLayoutMutation,
  type CinemaScreen,
  type VenueLayoutTemplate,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";

const VenueLayoutBuilder = dynamic(
  () => import("@/components/EventAdminPanel/VenueLayoutBuilder"),
  { ssr: false, loading: () => <p className="p-8 text-center text-zinc-400">Loading layout editor…</p> }
);
import {
  cinemaScreenFormSchema,
  emptyCinemaScreenFormValues,
  layoutRejectReasonSchema,
  type CinemaScreenFormValues,
  type LayoutRejectReasonValues,
} from "@/lib/moviePartnerFormSchemas";

const fieldErrorClass = "mt-1.5 text-xs text-rose-400 font-medium";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

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
  | "shortlisted"
  | "awaiting_live"
  | "approved"
  | "rejected";

function resolveLayoutPhase(screen: CinemaScreen): LayoutPhase {
  if (screen.layout_is_default && (screen.venue_layout_template_id || screen.layout_template_id)) {
    return "approved";
  }
  if (Number(screen.awaiting_live_count || 0) > 0) {
    return "awaiting_live";
  }
  if (Number(screen.pending_options_count || 0) > 0) {
    return "ready_to_approve";
  }
  if (Number(screen.shortlisted_options_count || 0) > 0) {
    return "shortlisted";
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
    label: "Ready to review",
    hint: "Super Admin published layout option(s). Review and approve the ones you like.",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  shortlisted: {
    label: "Options approved",
    hint: "Pick an approved layout and request it to go live.",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  awaiting_live: {
    label: "Awaiting go-live",
    hint: "Go-live request sent. Super Admin will confirm before publishing.",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
  },
  approved: {
    label: "Layout ready",
    hint: "Approved seat map is active on this screen.",
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
  const [publishLayout, { isLoading: publishing }] = usePublishVenueLayoutTemplateMutation();
  const [rejectLayout, { isLoading: rejecting }] = useRejectVenueLayoutTemplateMutation();
  const [rejectAllLayouts, { isLoading: rejectingAll }] = useRejectAllVenueLayoutTemplatesMutation();
  const [updateScreenLayout, { isLoading: isUpdatingScreenLayout }] = useUpdateCinemaScreenLayoutMutation();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectAllScreenId, setRejectAllScreenId] = useState<string | null>(null);
  const [viewingTemplateId, setViewingTemplateId] = useState<string | null>(null);

  const [layoutScreenId, setLayoutScreenId] = useState<string | null>(null);
  const [previewScreenId, setPreviewScreenId] = useState<string | null>(null);
  const [reviewScreenId, setReviewScreenId] = useState<string | null>(null);
  const [editingScreenId, setEditingScreenId] = useState<string | null>(null);

  const { data: viewingLayout } = useGetVenueLayoutTemplateQuery(
    { bizId, templateId: viewingTemplateId || "" },
    { skip: !bizId || !viewingTemplateId }
  );

  const {
    register: registerScreen,
    handleSubmit: handleScreenSubmit,
    reset: resetScreenForm,
    getValues: getScreenValues,
    formState: { errors: screenErrors },
  } = useForm<CinemaScreenFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(cinemaScreenFormSchema) as any,
    defaultValues: emptyCinemaScreenFormValues(),
    mode: "onSubmit",
  });

  const {
    register: registerReject,
    handleSubmit: handleRejectSubmit,
    reset: resetRejectForm,
    formState: { errors: rejectErrors },
  } = useForm<LayoutRejectReasonValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(layoutRejectReasonSchema) as any,
    defaultValues: { reason: "" },
    mode: "onSubmit",
  });

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
  const editingScreen = useMemo(
    () => screens.find((s) => s.id === editingScreenId) || null,
    [screens, editingScreenId]
  );

  const screenLayoutOptions = useMemo(() => {
    if (!reviewScreen) return [];
    return layoutOptions.filter(
      (o) =>
        (reviewScreen.hall_id && o.hall_id === reviewScreen.hall_id) ||
        (reviewScreen.layout_request_id && o.request_id === reviewScreen.layout_request_id) ||
        (reviewScreen.pending_template_id && o.id === reviewScreen.pending_template_id)
    );
  }, [layoutOptions, reviewScreen]);

  const pendingScreenOptions = useMemo(
    () =>
      screenLayoutOptions.filter(
        (o) =>
          o.status === "PUBLISHED" &&
          !o.is_default &&
          !o.venue_approved_at &&
          !o.venue_live_requested_at
      ),
    [screenLayoutOptions]
  );

  const shortlistedScreenOptions = useMemo(
    () =>
      screenLayoutOptions.filter(
        (o) =>
          o.status === "PUBLISHED" &&
          !o.is_default &&
          !!o.venue_approved_at &&
          !o.venue_live_requested_at
      ),
    [screenLayoutOptions]
  );

  const screenAwaitingLive = useMemo(
    () => screenLayoutOptions.filter((o) => !!o.venue_live_requested_at && !o.is_default),
    [screenLayoutOptions]
  );

  const screenReviewLocked = useMemo(
    () => screenLayoutOptions.some((o) => o.is_default || !!o.venue_live_requested_at),
    [screenLayoutOptions]
  );

  const editingTemplate = useMemo(() => {
    if (!editingScreen) return null;
    const tId = editingScreen.venue_layout_template_id || editingScreen.layout_template_id;
    return layoutOptions.find((t) => t.id === tId) || null;
  }, [editingScreen, layoutOptions]);

  const editingInitialSeats = useMemo(() => {
    if (!editingScreen) return [];
    const raw = editingTemplate?.seats_json ?? editingScreen.layout_seats_json;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  }, [editingScreen, editingTemplate]);

  const editingInitialConfig = useMemo(() => {
    if (!editingScreen) return undefined;
    const raw = editingTemplate?.seating_config ?? editingScreen.layout_seating_config;
    if (raw && typeof raw === "object") return raw;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, [editingScreen, editingTemplate]);

  const openRejectModal = (templateId: string) => {
    setRejectId(templateId);
    setRejectAllScreenId(null);
    resetRejectForm({ reason: "" });
  };

  const onCreate = async (values: CinemaScreenFormValues) => {
    if (!bizId) return;
    try {
      const res = await createScreen({
        bizId,
        name: values.name.trim(),
        screen_type: values.screen_type,
        capacity: Number(values.capacity) || 0,
        description: values.description?.trim() || undefined,
      }).unwrap();
      toast.success((res as { message?: string })?.message || "Screen created");
      resetScreenForm(emptyCinemaScreenFormValues());
    } catch (err) {
      toast.error(extractApiError(err, "Failed to create screen"));
    }
  };

  const onReject = async (values: LayoutRejectReasonValues) => {
    if (!bizId) return;
    try {
      if (rejectAllScreenId) {
        const screenToReject = screens.find((s) => s.id === rejectAllScreenId);
        await rejectAllLayouts({
          bizId,
          hall_id: screenToReject?.hall_id || undefined,
          request_id: screenToReject?.layout_request_id || undefined,
          reason: values.reason.trim(),
        }).unwrap();
        toast.success("All pending layout options rejected.");
        setRejectAllScreenId(null);
      } else if (rejectId) {
        const res = await rejectLayout({
          bizId,
          templateId: rejectId,
          reason: values.reason.trim(),
        }).unwrap();
        toast.success((res as { message?: string })?.message || "Layout rejected");
        setRejectId(null);
      }
      resetRejectForm({ reason: "" });
      refetch();
    } catch (err) {
      toast.error(extractApiError(err, "Reject failed"));
    }
  };

  const handleApproveOption = async (templateId: string) => {
    if (!bizId) return;
    try {
      await approveLayout({ bizId, templateId }).unwrap();
      toast.success("Layout approved. You can approve more options, then request one to go live.");
      refetch();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to approve layout"));
    }
  };

  const handleRequestGoLive = async (templateId: string) => {
    if (!bizId) return;
    try {
      await publishLayout({ bizId, templateId }).unwrap();
      toast.success("Go-live request sent. Super Admin will confirm before this layout goes live.");
      refetch();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to request go live"));
    }
  };

  const toggleActive = async (screen: CinemaScreen) => {
    if (!bizId) return;
    try {
      const res = await updateScreen({
        bizId,
        screenId: screen.id,
        body: { is_active: !screen.is_active },
      }).unwrap();
      toast.success(
        (res as { message?: string })?.message ||
          (screen.is_active ? "Screen disabled" : "Screen enabled")
      );
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update screen"));
    }
  };

  const submitLayout = async (submitNow: boolean) => {
    if (!bizId || !selectedScreen?.hall_id) {
      toast.error("This screen is missing a linked hall. Recreate the screen.");
      return;
    }
    const formCapacity = Number(getScreenValues("capacity")) || 0;
    const cap = Number(selectedScreen.capacity) || formCapacity || 100;
    const phase = resolveLayoutPhase(selectedScreen);
    try {
      const res = await createLayoutRequest({
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
      toast.success(
        (res as { message?: string })?.message ||
          (submitNow ? "Layout request submitted to Super Admin" : "Layout draft saved")
      );
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

      <form
        onSubmit={handleScreenSubmit(onCreate)}
        className="glass-panel rounded-2xl border border-white/10 p-5 space-y-4"
        noValidate
      >
        <h3 className="text-white font-semibold">Add screen</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="portal-label">
              Screen name <RequiredMark />
            </label>
            <input
              className="input-field"
              placeholder="Screen 1 / IMAX"
              {...registerScreen("name")}
            />
            {screenErrors.name && <p className={fieldErrorClass}>{screenErrors.name.message}</p>}
          </div>
          <div>
            <label className="portal-label">Screen type</label>
            <select className="input-field" {...registerScreen("screen_type")}>
              {SCREEN_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {screenErrors.screen_type && (
              <p className={fieldErrorClass}>{screenErrors.screen_type.message}</p>
            )}
          </div>
          <div>
            <label className="portal-label">
              Expected capacity <RequiredMark />
            </label>
            <input
              className="input-field"
              type="number"
              min={1}
              {...registerScreen("capacity")}
            />
            {screenErrors.capacity && (
              <p className={fieldErrorClass}>{screenErrors.capacity.message}</p>
            )}
          </div>
          <div>
            <label className="portal-label">Notes</label>
            <input className="input-field" {...registerScreen("description")} />
          </div>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} /> {creating ? "Creating…" : "Create screen"}
        </button>
      </form>

      {layoutOptions.filter(
        (opt) =>
          opt.status === "PUBLISHED" &&
          !opt.is_default &&
          !opt.venue_approved_at &&
          !opt.venue_live_requested_at &&
          !layoutOptions.some((o) => o.is_default || o.venue_live_requested_at)
      ).length > 0 && (
        <div className="glass-panel rounded-2xl border border-amber-500/20 p-5 space-y-3">
          <h3 className="text-white font-semibold">Layouts waiting for your approval</h3>
          <p className="text-sm text-zinc-400">
            Approve options you like, then use <span className="text-zinc-200 font-medium">Request go live</span> on
            one — BookMyBota must confirm before it publishes.
          </p>
          {layoutOptions
            .filter(
              (opt) =>
                opt.status === "PUBLISHED" &&
                !opt.is_default &&
                !opt.venue_approved_at &&
                !opt.venue_live_requested_at &&
                !layoutOptions.some((o) => o.is_default || o.venue_live_requested_at)
            )
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
                        const res = await approveLayout({ bizId, templateId: opt.id }).unwrap();
                        toast.success(
                          (res as { message?: string })?.message ||
                            "Layout approved — pick one to make public when ready."
                        );
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
                    onClick={() => openRejectModal(opt.id)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {layoutOptions.filter(
        (opt) =>
          opt.status === "PUBLISHED" &&
          !opt.is_default &&
          opt.venue_approved_at &&
          !opt.venue_live_requested_at &&
          !layoutOptions.some((o) => o.is_default || o.venue_live_requested_at)
      ).length > 0 && (
        <div className="glass-panel rounded-2xl border border-sky-500/20 p-5 space-y-3">
          <h3 className="text-white font-semibold">Approved — request one to go live</h3>
          {layoutOptions
            .filter(
              (opt) =>
                opt.status === "PUBLISHED" &&
                !opt.is_default &&
                opt.venue_approved_at &&
                !opt.venue_live_requested_at &&
                !layoutOptions.some((o) => o.is_default || o.venue_live_requested_at)
            )
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
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold disabled:opacity-50"
                  disabled={publishing}
                  onClick={async () => {
                    try {
                      const res = await publishLayout({ bizId, templateId: opt.id }).unwrap();
                      toast.success(
                        (res as { message?: string })?.message || "Go-live request sent to BookMyBota"
                      );
                      refetch();
                    } catch (err) {
                      toast.error(extractApiError(err, "Publish failed"));
                    }
                  }}
                >
                  Request go live
                </button>
              </div>
            ))}
        </div>
      )}

      {(rejectId || rejectAllScreenId) && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleRejectSubmit(onReject)}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 space-y-3"
            noValidate
          >
            <h3 className="text-white font-semibold">
              {rejectAllScreenId ? "Reject all options for this screen" : "Reject layout option"}
            </h3>
            <div>
              <label className="portal-label">
                {rejectAllScreenId ? "Tell Super Admin why none of these layout options work" : "Reason for Super Admin"} <RequiredMark />
              </label>
              <textarea
                className="input-field min-h-[88px]"
                placeholder={rejectAllScreenId ? "Explain what changes are needed across the layout options..." : "Explain why this layout option is rejected..."}
                {...registerReject("reason")}
              />
              {rejectErrors.reason && (
                <p className={fieldErrorClass}>{rejectErrors.reason.message}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setRejectId(null);
                  setRejectAllScreenId(null);
                  resetRejectForm({ reason: "" });
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary bg-rose-600 hover:bg-rose-500"
                disabled={rejecting || rejectingAll}
              >
                {rejecting || rejectingAll ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </form>
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
                        <Eye size={14} /> Review layout{Number(screen.total_reviewable_options_count || 0) > 1 ? ` (${screen.total_reviewable_options_count} options)` : ""}
                      </button>
                    )}

                    {phase === "shortlisted" && (
                      <button
                        type="button"
                        onClick={() => setReviewScreenId(screen.id)}
                        className="btn-primary text-sm inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500"
                      >
                        <Eye size={14} /> Choose live layout{Number(screen.shortlisted_options_count || 0) > 0 ? ` (${screen.shortlisted_options_count} approved)` : ""}
                      </button>
                    )}

                    {phase === "awaiting_live" && (
                      <button
                        type="button"
                        onClick={() => setReviewScreenId(screen.id)}
                        className="px-3 py-2 rounded-xl text-sm border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 inline-flex items-center gap-1.5"
                      >
                        <Clock size={14} /> Awaiting confirmation
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
                          onClick={() => setEditingScreenId(screen.id)}
                          className="btn-secondary text-sm inline-flex items-center gap-1.5"
                          title="Move or adjust seats, rows, or customize layout for this screen"
                        >
                          <Edit3 size={14} /> Edit layout
                        </button>
                        <button
                          type="button"
                          onClick={() => setLayoutScreenId(screen.id)}
                          className="px-3 py-2 rounded-xl text-sm border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 inline-flex items-center gap-1.5"
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

      {/* Full View Modal for a single template */}
      {viewingLayout && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-5xl bg-zinc-950 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="font-bold text-lg sm:text-xl text-white">{viewingLayout.name}</h3>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  {viewingLayout.hall_name || "Screen"} · {viewingLayout.layout_type} · {viewingLayout.seat_count || 0} seats mapped · capacity {viewingLayout.capacity}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingTemplateId(null)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-zinc-900/90 p-4">
              <LayoutSeatPreview
                seats={viewingLayout.seats_json}
                config={viewingLayout.seating_config}
                heightClass="h-[440px]"
                className="bg-zinc-900"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setViewingTemplateId(null)}
              >
                Close
              </button>
              {!viewingLayout.is_default && !viewingLayout.venue_live_requested_at && !viewingLayout.venue_approved_at && viewingLayout.status === "PUBLISHED" && (
                <>
                  <button
                    type="button"
                    disabled={approving}
                    onClick={async () => {
                      await handleApproveOption(viewingLayout.id);
                      setViewingTemplateId(null);
                    }}
                    className="btn-primary text-sm"
                  >
                    {approving ? "Approving…" : "Approve this option"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectId(viewingLayout.id);
                      setViewingTemplateId(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-rose-400/40 text-rose-300 text-sm hover:bg-rose-500/10"
                  >
                    Reject
                  </button>
                </>
              )}
              {!viewingLayout.is_default && !viewingLayout.venue_live_requested_at && !!viewingLayout.venue_approved_at && viewingLayout.status === "PUBLISHED" && (
                <>
                  <button
                    type="button"
                    disabled={publishing}
                    onClick={async () => {
                      await handleRequestGoLive(viewingLayout.id);
                      setViewingTemplateId(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold"
                  >
                    {publishing ? "…" : "Request go live"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectId(viewingLayout.id);
                      setViewingTemplateId(null);
                    }}
                    className="px-4 py-2 rounded-xl border border-rose-400/40 text-rose-300 text-sm hover:bg-rose-500/10"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multi-Layout Review Modal for Selected Screen */}
      {reviewScreen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-5xl bg-zinc-950 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-white font-bold text-lg sm:text-xl">
                    Layout options — {reviewScreen.name}
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded bg-zinc-800 text-zinc-300 font-mono">
                    Capacity {reviewScreen.capacity}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 mt-1">
                  {screenAwaitingLive.length > 0
                    ? "Your go-live request has been submitted to Super Admin. Awaiting confirmation."
                    : pendingScreenOptions.length > 0
                      ? `${pendingScreenOptions.length} option${pendingScreenOptions.length === 1 ? "" : "s"} waiting for your review. Approve the ones you like, then request one to go live.`
                      : shortlistedScreenOptions.length > 0
                        ? `${shortlistedScreenOptions.length} approved option${shortlistedScreenOptions.length === 1 ? "" : "s"} — choose your preferred layout and request it to go live.`
                        : screenLayoutOptions.length > 0
                          ? "Review your layout options below."
                          : "Super Admin has not published layout options for this screen yet."}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {pendingScreenOptions.length > 0 && !screenReviewLocked && (
                  <button
                    type="button"
                    disabled={rejectingAll}
                    onClick={() => {
                      setRejectAllScreenId(reviewScreen.id);
                      resetRejectForm({ reason: "" });
                    }}
                    className="px-3.5 py-1.5 rounded-xl border border-rose-400/40 text-rose-300 text-xs font-semibold hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    Reject all ({pendingScreenOptions.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setReviewScreenId(null)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Status notice */}
            {screenAwaitingLive.length > 0 && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-950/30 px-4 py-3 text-xs sm:text-sm text-purple-300 flex items-center gap-2">
                <Clock size={16} className="shrink-0 text-purple-400" />
                <span>
                  Go-live request has been submitted to Super Admin. Once Super Admin confirms, this layout will become active in the system.
                </span>
              </div>
            )}

            {/* Options list */}
            {screenLayoutOptions.length === 0 ? (
              reviewScreen.pending_template_id ? (
                // Fallback single option if screenLayoutOptions has not yet populated
                <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-6 text-center space-y-4">
                  <p className="text-sm text-zinc-300 font-semibold">{reviewScreen.pending_template_name || "Screen Layout"}</p>
                  <LayoutSeatPreview
                    seats={reviewScreen.pending_seats_json}
                    config={reviewScreen.pending_seating_config}
                    heightClass="h-56"
                    className="bg-zinc-900"
                  />
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => openRejectModal(reviewScreen.pending_template_id!)}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-sm"
                      onClick={() => handleApproveOption(reviewScreen.pending_template_id!)}
                    >
                      Approve layout
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-zinc-400 text-sm">
                  No layout options available yet for this screen.
                </div>
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {screenLayoutOptions.map((option, index) => {
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
                            ? "border-purple-500/40 bg-purple-950/20"
                            : shortlisted
                              ? "border-emerald-500/40 bg-emerald-950/20"
                              : rejected
                                ? "border-rose-500/30 bg-rose-950/10"
                                : waiting
                                  ? "border-amber-500/30 bg-zinc-900/60"
                                  : "border-white/10 bg-zinc-900/40"
                      }`}
                    >
                      <div className="p-3 border-b border-white/5 bg-black/30">
                        <LayoutSeatPreview
                          seats={option.seats_json}
                          config={option.seating_config}
                          heightClass="h-40"
                          className="bg-zinc-900"
                        />
                      </div>
                      <div className="p-4 flex-1 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                              Option {index + 1}
                            </p>
                            <p className="font-semibold text-white truncate text-base">{option.name}</p>
                            <p className="text-xs text-zinc-400 mt-1">
                              {option.seat_count ? `${option.seat_count} seats mapped` : "Seats mapped"} · capacity {option.capacity}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                              live
                                ? "bg-sky-500/15 text-sky-300 border-sky-500/30"
                                : awaitingLive
                                  ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
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

                        {rejected && option.rejection_reason && (
                          <p className="text-xs text-rose-300 line-clamp-2 bg-rose-950/40 p-2 rounded-lg border border-rose-900/40">
                            Reason: {option.rejection_reason}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-white/5">
                          <button
                            type="button"
                            onClick={() => setViewingTemplateId(option.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-zinc-300 hover:text-white hover:bg-white/5"
                          >
                            <Eye size={13} /> View full
                          </button>
                          {!screenReviewLocked && waiting && (
                            <>
                              <button
                                type="button"
                                disabled={approving}
                                onClick={() => handleApproveOption(option.id)}
                                className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                              >
                                {approving ? "…" : "Approve"}
                              </button>
                              <button
                                type="button"
                                disabled={rejecting}
                                onClick={() => openRejectModal(option.id)}
                                className="px-3 py-1.5 rounded-xl border border-rose-400/40 text-rose-300 text-xs hover:bg-rose-500/10 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {!screenReviewLocked && shortlisted && (
                            <>
                              <button
                                type="button"
                                disabled={publishing}
                                onClick={() => handleRequestGoLive(option.id)}
                                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold disabled:opacity-50"
                              >
                                {publishing ? "…" : "Request go live"}
                              </button>
                              <button
                                type="button"
                                disabled={rejecting}
                                onClick={() => openRejectModal(option.id)}
                                className="px-3 py-1.5 rounded-xl border border-rose-400/40 text-rose-300 text-xs hover:bg-rose-500/10 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-white/10">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setReviewScreenId(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editingScreen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-2 sm:p-4">
          <div className="w-full h-full max-w-7xl bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-3 bg-zinc-900 text-white border-b border-zinc-800">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <span>🎬 Customizing Layout: {editingScreen.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                    Max Capacity: {editingScreen.capacity}
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Move, add or adjust seats. Seat count cannot exceed screen capacity ({editingScreen.capacity}) and booked seats are locked.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingScreenId(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              >
                Close Editor
              </button>
            </div>
            <div className="flex-1 overflow-hidden relative">
              <VenueLayoutBuilder
                key={`screen-builder-${editingScreen.id}`}
                venueAdapter={{
                  initialSeats: editingInitialSeats,
                  initialConfig: editingInitialConfig,
                  maxCapacity: Number(editingScreen.capacity) || 0,
                  saving: isUpdatingScreenLayout,
                  hideSubmitToVenue: true,
                  onSave: async (payload) => {
                    try {
                      await updateScreenLayout({
                        bizId,
                        screenId: editingScreen.id,
                        seating_config: payload.seating_config,
                        seats: payload.seats,
                      }).unwrap();
                      toast.success("Screen layout customized and saved successfully!");
                      setEditingScreenId(null);
                      refetch();
                    } catch (err) {
                      toast.error(extractApiError(err, "Failed to save screen layout."));
                    }
                  },
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

