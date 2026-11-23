"use client";

import { useMemo, useState } from "react";
import ClassicSeatMap from "@/components/venue/ClassicSeatMap";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import { Ban, Check, Clapperboard, Clock, Eye, FilePlus2, MonitorPlay, Plus, RefreshCw, X } from "lucide-react";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { useAppSelector } from "@/lib/hooks";
import {
  useApproveVenueLayoutTemplateMutation,
  useCreateCinemaScreenMutation,
  useCreateVenueLayoutRequestMutation,
  useGetCinemaScreensQuery,
  useGetVenueLayoutTemplateQuery,
  useGetVenueLayoutTemplatesQuery,
  usePublishVenueLayoutTemplateMutation,
  useRejectVenueLayoutTemplateMutation,
  useUpdateCinemaScreenSeatStatusesMutation,
  type CinemaScreen,
  type VenueLayoutTemplate,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { CINEMA_SCREEN_TYPES } from "@/lib/cinemaScreenTypes";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";
import { buildCinemaSeatTypeZones, CINEMA_SEAT_TYPE_FIELDS, seatTypesTotal } from "@/lib/cinemaSeatTypes";
import {
  cinemaScreenFormSchema,
  emptyCinemaScreenFormValues,
  layoutRejectReasonSchema,
  type CinemaScreenFormValues,
  type LayoutRejectReasonValues,
} from "@/lib/moviePartnerFormSchemas";

const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-500/20";
const labelCls = "block text-xs font-semibold text-slate-600 mb-1";
const errCls = "mt-1 text-xs text-rose-600 font-medium";
const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#e11d48] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#be123c] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

const SCREEN_TYPES = CINEMA_SCREEN_TYPES;

type LayoutPhase = "none" | "draft" | "awaiting_admin" | "ready_to_approve" | "shortlisted" | "awaiting_live" | "approved" | "rejected";

function resolveLayoutPhase(screen: CinemaScreen): LayoutPhase {
  if (screen.layout_is_default && (screen.venue_layout_template_id || screen.layout_template_id)) return "approved";
  if (Number(screen.awaiting_live_count || 0) > 0) return "awaiting_live";
  if (Number(screen.pending_options_count || 0) > 0) return "ready_to_approve";
  if (Number(screen.shortlisted_options_count || 0) > 0) return "shortlisted";
  if (screen.pending_template_id) return "ready_to_approve";
  const reqStatus = String(screen.layout_request_status || "").toUpperCase();
  if (reqStatus === "REJECTED") return "rejected";
  if (reqStatus === "DRAFT") return "draft";
  if (reqStatus === "SUBMITTED" || reqStatus === "UNDER_REVIEW" || reqStatus === "APPROVED") return "awaiting_admin";
  return "none";
}

const PHASE_META: Record<LayoutPhase, { label: string; hint: string; badge: string }> = {
  none: { label: "No layout yet", hint: "Request a seat layout from the admin team.", badge: "bg-slate-100 text-slate-600 border-slate-200" },
  draft: { label: "Draft request", hint: "Finish and send this request.", badge: "bg-slate-100 text-slate-700 border-slate-200" },
  awaiting_admin: {
    label: "Request sent",
    hint: "The admin team is building this screen's seat map. You will be asked to approve it here.",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  ready_to_approve: { label: "Ready to review", hint: "A layout is waiting for your approval.", badge: "bg-sky-50 text-sky-700 border-sky-200" },
  shortlisted: { label: "Approved", hint: "Approved. Send it live.", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  awaiting_live: { label: "Going live", hint: "Approved. The admin team will confirm before it goes live.", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  approved: { label: "Live", hint: "This layout is live on the screen.", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  rejected: { label: "Rejected", hint: "The last layout was rejected. Send a new request.", badge: "bg-rose-50 text-rose-700 border-rose-200" },
};

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} max-h-[92vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 space-y-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function CinemaScreensPage() {
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";

  const { data: screens = [], isLoading, refetch } = useGetCinemaScreensQuery(bizId, { skip: !bizId });
  const { data: layoutOptions = [] } = useGetVenueLayoutTemplatesQuery(bizId, { skip: !bizId });
  const [createScreen, { isLoading: creating }] = useCreateCinemaScreenMutation();
  const [createLayoutRequest, { isLoading: sendingRequest }] = useCreateVenueLayoutRequestMutation();
  const [approveLayout, { isLoading: approving }] = useApproveVenueLayoutTemplateMutation();
  const [publishLayout, { isLoading: publishing }] = usePublishVenueLayoutTemplateMutation();
  const [rejectLayout, { isLoading: rejecting }] = useRejectVenueLayoutTemplateMutation();

  const [tab, setTab] = useState<"active" | "admin">("active");
  const [addOpen, setAddOpen] = useState(false);
  const [requestScreenId, setRequestScreenId] = useState<string | null | "pick">(null);
  const [requestNotes, setRequestNotes] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);
  const [requestPicked, setRequestPicked] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [viewingTemplateId, setViewingTemplateId] = useState<string | null>(null);
  const [previewScreenId, setPreviewScreenId] = useState<string | null>(null);
  const [damageMode, setDamageMode] = useState(false);

  const { data: viewingLayout } = useGetVenueLayoutTemplateQuery(
    { bizId, templateId: viewingTemplateId || "" },
    { skip: !bizId || !viewingTemplateId }
  );

  const {
    register: registerScreen,
    handleSubmit: handleScreenSubmit,
    reset: resetScreenForm,
    watch: watchScreen,
    formState: { errors: screenErrors },
  } = useForm<CinemaScreenFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(cinemaScreenFormSchema) as any,
    defaultValues: emptyCinemaScreenFormValues(),
    mode: "onSubmit",
  });
  const assignedSeats =
    (Number(watchScreen("regular_seats")) || 0) + (Number(watchScreen("recliner_seats")) || 0) + (Number(watchScreen("couple_seats")) || 0);
  const totalCapacity = Number(watchScreen("capacity")) || 0;
  const remainingSeats = totalCapacity - assignedSeats;

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

  const phaseOf = useMemo(() => new Map(screens.map((s) => [s.id, resolveLayoutPhase(s)])), [screens]);
  const activeScreens = screens.filter((s) => phaseOf.get(s.id) === "approved");
  const hasLiveLayoutFor = (opt: VenueLayoutTemplate) =>
    screens.some((s) => phaseOf.get(s.id) === "approved" && !!s.hall_id && s.hall_id === opt.hall_id);

  // Layouts the admin team provided that are still waiting on this cinema
  const waitingOptions = layoutOptions.filter(
    (o) => o.status === "PUBLISHED" && !o.is_default && !o.venue_live_requested_at && !hasLiveLayoutFor(o)
  );
  const goingLiveOptions = layoutOptions.filter((o) => o.status === "PUBLISHED" && !o.is_default && !!o.venue_live_requested_at);
  const requestScreens = screens.filter((s) => {
    const p = phaseOf.get(s.id);
    return p === "none" || p === "draft" || p === "awaiting_admin" || p === "rejected";
  });
  const adminCount = waitingOptions.length + goingLiveOptions.length;

  const previewScreen = screens.find((s) => s.id === previewScreenId) || null;
  const requestScreen = requestScreenId && requestScreenId !== "pick" ? screens.find((s) => s.id === requestScreenId) || null : null;

  const onCreate = async (values: CinemaScreenFormValues) => {
    if (!bizId) return;
    try {
      const seatTypes = {
        regular: Number(values.regular_seats) || 0,
        recliner: Number(values.recliner_seats) || 0,
        couple: Number(values.couple_seats) || 0,
      };
      const res = await createScreen({
        bizId,
        name: values.name.trim(),
        screen_type: values.screen_type,
        capacity: Number(values.capacity) || seatTypesTotal(seatTypes),
        description: values.description?.trim() || undefined,
        seat_types_json: seatTypes,
      }).unwrap();
      toast.success((res as { message?: string })?.message || "Screen created");
      resetScreenForm(emptyCinemaScreenFormValues());
      setAddOpen(false);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to create screen"));
    }
  };

  const openRequest = (screenId: string | "pick") => {
    setRequestNotes("");
    setRequestPicked(screenId === "pick" ? requestScreens[0]?.id || screens[0]?.id || "" : screenId);
    setRequestScreenId(screenId);
  };

  const submitRequest = async () => {
    const target = screens.find((s) => s.id === (requestScreenId === "pick" ? requestPicked : requestScreenId));
    if (!bizId || !target?.hall_id) {
      toast.error("Pick a screen first. (A screen needs to be created before it can get a layout.)");
      return;
    }
    const notes = requestNotes.trim();
    if (!notes) {
      toast.error("Add a short note so the admin team knows what you need.");
      return;
    }
    const cap = Number(target.capacity) || 100;
    const rawTypes = (target.seat_types_json || {}) as Record<string, unknown>;
    const seatTypes = {
      regular: Number(rawTypes.regular) || 0,
      recliner: Number(rawTypes.recliner) || 0,
      couple: Number(rawTypes.couple) || 0,
    };
    const zones =
      seatTypesTotal(seatTypes) > 0
        ? buildCinemaSeatTypeZones(seatTypes)
        : [
            { name: "Regular", capacity: Math.max(1, Math.round(cap * 0.7)), seat_type: "regular" as const },
            { name: "Recliner", capacity: Math.max(1, Math.round(cap * 0.2)), seat_type: "recliner" as const },
            { name: "Couple", capacity: Math.max(1, Math.round(cap * 0.1)), seat_type: "couple" as const },
          ];
    const phase = resolveLayoutPhase(target);
    try {
      const res = await createLayoutRequest({
        bizId,
        ...(phase === "draft" && target.layout_request_id ? { request_id: target.layout_request_id } : {}),
        hall_id: target.hall_id,
        hall_name: target.name,
        hall_capacity: cap,
        layout_name: `${target.name} seating`,
        layout_type: "theater",
        capacity: cap,
        is_indoor: true,
        spec_json: {
          hall_name: target.name,
          hall_capacity: cap,
          zones,
          seat_types: seatTypes,
          notes,
          intake_mode: "structured_request",
        },
        submit_now: true,
      }).unwrap();
      toast.success((res as { message?: string })?.message || "Layout request sent");
      setRequestScreenId(null);
      setRequestNotes("");
      setTab("admin");
      refetch();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to send the layout request"));
    }
  };

  /** Approve a layout the admin team provided. It is sent for go-live straight away (they confirm). */
  const approveOption = async (opt: VenueLayoutTemplate) => {
    if (!bizId) return;
    try {
      if (!opt.venue_approved_at) await approveLayout({ bizId, templateId: opt.id }).unwrap();
      await publishLayout({ bizId, templateId: opt.id }).unwrap();
      toast.success("Layout approved and live on the screen.");
      setViewingTemplateId(null);
    } catch (err) {
      toast.error(extractApiError(err, "Could not approve this layout"));
    } finally {
      await refetch();
    }
  };

  const onReject = async (values: LayoutRejectReasonValues) => {
    if (!bizId || !rejectId) return;
    try {
      const res = await rejectLayout({ bizId, templateId: rejectId, reason: values.reason.trim() }).unwrap();
      toast.success((res as { message?: string })?.message || "Layout rejected");
      setRejectId(null);
      setViewingTemplateId(null);
      resetRejectForm({ reason: "" });
      refetch();
    } catch (err) {
      toast.error(extractApiError(err, "Reject failed"));
    }
  };

  if (!bizId) return <p className="text-slate-500">Cinema business not linked to this account.</p>;

  const tabBtn = (id: "active" | "admin", label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px cursor-pointer ${
        tab === id ? "border-[#e11d48] text-[#e11d48]" : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {label} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{count}</span>
    </button>
  );

  const optionCard = (opt: VenueLayoutTemplate, state: "waiting" | "approved" | "going_live") => (
    <div key={opt.id} className={`${card} overflow-hidden flex flex-col`}>
      <div className="p-3 border-b border-slate-100 bg-slate-50">
        <ClassicSeatMap seats={opt.seats_json} heightClass="h-40" fitAll />
      </div>
      <div className="p-4 flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{opt.name}</p>
            <p className="text-xs text-slate-500">
              {opt.hall_name || "Screen"} · {opt.seat_count ?? 0} seats · capacity {opt.capacity}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${
              state === "going_live"
                ? "bg-purple-50 text-purple-700 border-purple-200"
                : state === "approved"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {state === "going_live" ? "Approved" : state === "approved" ? "Approved" : "Needs your approval"}
          </span>
        </div>
        <div className="mt-auto flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button type="button" className={btnSecondary} onClick={() => setViewingTemplateId(opt.id)}>
            <Eye size={13} /> View
          </button>
          {state === "going_live" && (
            <button type="button" className={btnPrimary} disabled={publishing} onClick={() => approveOption(opt)}>
              <Check size={13} /> {publishing ? "Going live…" : "Go live now"}
            </button>
          )}
          {state !== "going_live" && (
            <>
              <button type="button" className={btnPrimary} disabled={approving || publishing} onClick={() => approveOption(opt)}>
                <Check size={13} /> {approving || publishing ? "Working…" : "Approve"}
              </button>
              <button
                type="button"
                className={btnDanger}
                disabled={rejecting}
                onClick={() => {
                  resetRejectForm({ reason: "" });
                  setRejectId(opt.id);
                }}
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Clapperboard size={20} className="text-[#e11d48]" /> Screens &amp; layouts
          </h2>
        </div>
        <div className="flex gap-2">
          <button type="button" className={btnSecondary} onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Add screen
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        {tabBtn("active", "Active layouts", activeScreens.length)}
        {tabBtn("admin", "Layout approvals", adminCount)}
      </div>

      {isLoading ? (
        <AdminListShimmer rows={4} columns={4} showToolbar={false} />
      ) : tab === "active" ? (
        activeScreens.length === 0 ? (
          <div className={`${card} p-10 text-center text-slate-500`}>
            <MonitorPlay size={36} className="mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-slate-700">No live layout yet</p>
            <p className="text-sm mt-1">
              {screens.length === 0
                ? "Add a screen, then request its layout."
                : adminCount > 0
                  ? "You have layouts waiting for approval under Layout approvals."
                  : "Approve the layout the admin team sends and it goes live here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {activeScreens.map((screen) => (
              <div key={screen.id} className={`${card} p-4 flex flex-col gap-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base font-extrabold text-slate-900 truncate">{screen.name}</p>
                    <p className="text-xs text-slate-500">
                      {(screen.screen_type || "standard").toUpperCase()} · capacity {screen.capacity} · {Number(screen.layout_seat_count || 0)} seats mapped
                      {screen.layout_name ? ` · ${screen.layout_name}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">
                    Live
                  </span>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-2">
                  <ClassicSeatMap seats={screen.layout_seats_json} heightClass="h-44" fitAll />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnPrimary}
                    onClick={() => {
                      setDamageMode(false);
                      setPreviewScreenId(screen.id);
                    }}
                  >
                    <Eye size={13} /> View layout
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => {
                      setDamageMode(true);
                      setPreviewScreenId(screen.id);
                    }}
                    title="Mark seats that are broken or unusable. They disappear from every show and from the customer seat map."
                  >
                    <Ban size={13} /> Damaged seats
                    {damagedCount(screen) > 0 ? <span className="rounded-full bg-rose-100 px-1.5 text-[10px] font-bold text-rose-700">{damagedCount(screen)}</span> : null}
                  </button>
                  <a href="/movie/shows" className={btnSecondary}>
                    Shows &amp; seats
                  </a>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">Waiting for your approval</h3>
            {waitingOptions.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing to approve right now.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {waitingOptions.map((opt) => optionCard(opt, opt.venue_approved_at ? "approved" : "waiting"))}
              </div>
            )}
          </section>

          {goingLiveOptions.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <Clock size={14} className="text-purple-500" /> Approved — send these live
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{goingLiveOptions.map((opt) => optionCard(opt, "going_live"))}</div>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">Screens without a live layout</h3>
            {requestScreens.length === 0 ? (
              <p className="text-sm text-slate-500">Every screen has a live layout.</p>
            ) : (
              <div className={`${card} divide-y divide-slate-100`}>
                {requestScreens.map((screen) => {
                  const phase = phaseOf.get(screen.id) || "none";
                  const meta = PHASE_META[phase];
                  return (
                    <div key={screen.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-900">{screen.name}</p>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.badge}`}>{meta.label}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{meta.hint}</p>
                        {phase === "rejected" && (screen.latest_rejection_reason || screen.pending_rejection_reason) && (
                          <p className="text-xs text-rose-600 mt-0.5">Reason: {screen.latest_rejection_reason || screen.pending_rejection_reason}</p>
                        )}
                      </div>
                      {phase !== "awaiting_admin" && (
                        <button type="button" className={btnPrimary} onClick={() => openRequest(screen.id)} disabled={!screen.hall_id}>
                          {phase === "draft" ? "Continue request" : phase === "rejected" ? "Request again" : "Request layout"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {addOpen && (
        <Modal title="Add screen" onClose={() => setAddOpen(false)}>
          <form onSubmit={handleScreenSubmit(onCreate)} className="space-y-3" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Screen name *</label>
                <input className={inputCls} placeholder="Screen 1 / IMAX" {...registerScreen("name")} />
                {screenErrors.name && <p className={errCls}>{screenErrors.name.message}</p>}
              </div>
              <div>
                <label className={labelCls}>Screen type</label>
                <select className={inputCls} {...registerScreen("screen_type")}>
                  {SCREEN_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Expected capacity (total seats) *</label>
                <input className={inputCls} type="number" min={1} {...registerScreen("capacity")} />
                {screenErrors.capacity && <p className={errCls}>{screenErrors.capacity.message}</p>}
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input className={inputCls} {...registerScreen("description")} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {CINEMA_SEAT_TYPE_FIELDS.map((field) => {
                const name = field.key === "regular" ? "regular_seats" : field.key === "recliner" ? "recliner_seats" : "couple_seats";
                return (
                  <div key={field.key}>
                    <label className={labelCls}>{field.label}</label>
                    <input className={inputCls} type="number" min={0} placeholder="0" {...registerScreen(name)} />
                    {screenErrors[name] && <p className={errCls}>{screenErrors[name]?.message}</p>}
                  </div>
                );
              })}
            </div>
            <p className={`text-xs ${remainingSeats === 0 && assignedSeats > 0 ? "text-emerald-600" : remainingSeats < 0 ? "text-rose-600" : "text-slate-500"}`}>
              Total capacity {totalCapacity || 0}. Assigned {assignedSeats}
              {totalCapacity > 0
                ? remainingSeats === 0
                  ? " — all seats assigned."
                  : remainingSeats > 0
                    ? ` — ${remainingSeats} still to assign across Regular / Recliner / Couple.`
                    : ` — over by ${Math.abs(remainingSeats)}. Reduce seat type counts.`
                : ". Enter total capacity first, then split it into Regular, Recliner and Couple."}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={btnSecondary} onClick={() => setAddOpen(false)}>
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={creating}>
                {creating ? "Creating…" : "Create screen"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {requestScreenId && (
        <Modal title={requestScreen ? `Request layout — ${requestScreen.name}` : "Request a layout"} onClose={() => setRequestScreenId(null)}>
          {requestScreenId === "pick" && (
            <div>
              <label className={labelCls}>Screen</label>
              <select className={inputCls} value={requestPicked} onChange={(e) => setRequestPicked(e.target.value)}>
                {screens.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({(s.screen_type || "standard").toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelCls}>Notes for the admin team *</label>
            <textarea
              className={`${inputCls} min-h-[110px]`}
              placeholder="Describe the layout you need: rows, aisles, recliner or couple seats, wheelchair spots…"
              value={requestNotes}
              onChange={(e) => setRequestNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setRequestScreenId(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={sendingRequest}
              onClick={() => {
                if (!requestNotes.trim()) {
                  toast.error("Add a short note so the admin team knows what you need.");
                  return;
                }
                setConfirmSend(true);
              }}
            >
              {sendingRequest ? "Sending…" : "Send request"}
            </button>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmSend}
        theme="light"
        variant="warning"
        title="Request this layout?"
        body="Are you sure you want to request this layout? Once sent, the request cannot be deleted. The admin team will build the layout and send it back for your approval."
        confirmLabel="Yes, send request"
        busy={sendingRequest}
        onCancel={() => setConfirmSend(false)}
        onConfirm={async () => {
          await submitRequest();
          setConfirmSend(false);
        }}
      />

      {rejectId && (
        <Modal title="Reject this layout" onClose={() => setRejectId(null)}>
          <form onSubmit={handleRejectSubmit(onReject)} className="space-y-3" noValidate>
            <div>
              <label className={labelCls}>Tell the admin team why *</label>
              <textarea className={`${inputCls} min-h-[96px]`} placeholder="Explain what is wrong with this layout…" {...registerReject("reason")} />
              {rejectErrors.reason && <p className={errCls}>{rejectErrors.reason.message}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setRejectId(null)}>
                Cancel
              </button>
              <button type="submit" className={btnDanger} disabled={rejecting}>
                {rejecting ? "Rejecting…" : "Reject layout"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {previewScreen && (
        <DamagedSeatsModal
          key={`${previewScreen.id}-${damageMode}`}
          bizId={bizId}
          screen={previewScreen}
          startInDamageMode={damageMode}
          onClose={() => setPreviewScreenId(null)}
        />
      )}

      {viewingLayout && (
        <Modal title={viewingLayout.name} onClose={() => setViewingTemplateId(null)} wide>
          <p className="text-xs text-slate-500 -mt-2">
            {viewingLayout.hall_name || "Screen"} · {viewingLayout.seat_count || 0} seats mapped · capacity {viewingLayout.capacity}
          </p>
          <ClassicSeatMap seats={viewingLayout.seats_json} heightClass="h-[420px]" />
          {!viewingLayout.is_default && !viewingLayout.venue_live_requested_at && viewingLayout.status === "PUBLISHED" && (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={btnDanger}
                onClick={() => {
                  resetRejectForm({ reason: "" });
                  setRejectId(viewingLayout.id);
                }}
              >
                Reject
              </button>
              <button type="button" className={btnPrimary} disabled={approving || publishing} onClick={() => approveOption(viewingLayout)}>
                <Check size={13} /> {approving || publishing ? "Working…" : "Approve"}
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

type LayoutSeatRecord = Record<string, unknown>;

const seatKeyOf = (seat: LayoutSeatRecord, idx: number) => {
  const id = String(seat.id || seat.internalId || "").trim();
  const row = String(seat.row_label || seat.row || "").trim();
  const num = String(seat.seat_label || seat.label || "").trim();
  return id || (row || num ? `${row}-${num}` : `seat-${idx}`);
};
const seatNameOf = (seat: LayoutSeatRecord) => `${String(seat.row_label || seat.row || "")}${String(seat.seat_label || seat.label || "")}`;
const seatStatusOf = (seat: LayoutSeatRecord) => String(seat.status || "AVAILABLE").toUpperCase();

function damagedCount(screen: CinemaScreen): number {
  return Array.isArray(screen.layout_seats_json)
    ? (screen.layout_seats_json as LayoutSeatRecord[]).filter((seat) => seatStatusOf(seat) === "BLOCKED").length
    : 0;
}

/**
 * The live layout of a screen. Pick seats and mark them damaged (or repaired): a damaged seat cannot be booked for any show,
 * and the customer seat map shows it as unavailable. Every change is saved in the screen's audit history.
 */
function DamagedSeatsModal({ bizId, screen, startInDamageMode, onClose }: { bizId: string; screen: CinemaScreen; startInDamageMode: boolean; onClose: () => void }) {
  const [updateSeats, { isLoading: saving }] = useUpdateCinemaScreenSeatStatusesMutation();
  const seats = useMemo(() => (Array.isArray(screen.layout_seats_json) ? (screen.layout_seats_json as LayoutSeatRecord[]) : []), [screen.layout_seats_json]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [damageMode, setDamageMode] = useState(startInDamageMode);

  const byKey = useMemo(() => new Map(seats.map((seat, i) => [seatKeyOf(seat, i), seat])), [seats]);
  const damaged = seats.filter((seat) => seatStatusOf(seat) === "BLOCKED").length;
  const pickedSeats = Array.from(picked)
    .map((k) => byKey.get(k))
    .filter(Boolean) as LayoutSeatRecord[];
  const toDamage = pickedSeats.filter((seat) => seatStatusOf(seat) !== "BLOCKED").length;
  const toRepair = pickedSeats.filter((seat) => seatStatusOf(seat) === "BLOCKED").length;

  const apply = async (status: "BLOCKED" | "AVAILABLE") => {
    const chosen = pickedSeats.filter((seat) => (status === "BLOCKED" ? seatStatusOf(seat) !== "BLOCKED" : seatStatusOf(seat) === "BLOCKED"));
    if (chosen.length === 0) return;
    try {
      const res = await updateSeats({
        bizId,
        screenId: screen.id,
        seats: chosen.map((seat) => ({ seat_key: String(seat.id || seat.internalId || `${seat.row_label}-${seat.seat_label}`), status })),
        note: note.trim() || undefined,
      }).unwrap();
      toast.success(
        status === "BLOCKED"
          ? `${chosen.length} seat${chosen.length === 1 ? "" : "s"} marked damaged. They are hidden from booking everywhere.`
          : res.message || "Seats repaired"
      );
      setPicked(new Set());
      setNote("");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update seats"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 shadow-2xl p-4 sm:p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 truncate">{screen.name} layout</h3>
            <p className="text-xs text-slate-500">
              {screen.layout_name ? `${screen.layout_name} · ` : ""}
              {seats.length} seats · {damaged} damaged
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-600">
            {damageMode
              ? "Tap the seats that are broken or unusable, then mark them damaged. Tap damaged seats to repair them."
              : "This is the live layout. Use Mark damaged seats when a seat is broken."}
          </p>
          <button
            type="button"
            className={damageMode ? btnPrimary : btnSecondary}
            onClick={() => {
              setDamageMode((v) => !v);
              setPicked(new Set());
            }}
          >
            <Ban size={13} /> {damageMode ? "Done picking" : "Mark damaged seats"}
          </button>
        </div>

        <ClassicSeatMap
          seats={seats as never}
          heightClass="h-[min(56vh,480px)]"
          seatMarker={(raw, idx) => {
            const seat = raw as unknown as LayoutSeatRecord;
            const key = seatKeyOf(seat, idx);
            const status = seatStatusOf(seat);
            const isPicked = picked.has(key);
            const sold = status === "BOOKED" || status === "RESERVED";
            return {
              fill: isPicked ? "#e11d48" : status === "BLOCKED" ? "#f97316" : sold ? "#94a3b8" : "",
              stroke: isPicked ? "#9f1239" : status === "BLOCKED" ? "#c2410c" : "#ffffff",
              strokeWidth: isPicked ? 3 : status === "BLOCKED" ? 2 : undefined,
              cursor: damageMode && !sold ? "pointer" : "default",
              title: `${seatNameOf(seat) || key} · ${status === "BLOCKED" ? "Damaged" : sold ? "Sold" : "Available"}`,
              onClick:
                damageMode && !sold
                  ? () =>
                      setPicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                  : undefined,
            };
          }}
        />

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-500" /> Available</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-orange-500" /> Damaged</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-rose-600" /> Picked</span>
        </div>

        {damageMode && (
          <div className="rounded-xl border border-slate-200 p-3 space-y-2.5">
            <p className="text-sm font-semibold text-slate-900">
              {picked.size === 0 ? "No seats picked yet" : `${picked.size} seat${picked.size === 1 ? "" : "s"} picked`}
              {picked.size > 0 && (
                <span className="font-normal text-slate-500">
                  {" "}
                  — {pickedSeats.slice(0, 10).map(seatNameOf).join(", ")}
                  {pickedSeats.length > 10 ? ` +${pickedSeats.length - 10}` : ""}
                </span>
              )}
            </p>
            <input
              className={inputCls}
              placeholder="What is wrong? For example: broken recliner (saved in the audit)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} disabled={saving || toDamage === 0} onClick={() => apply("BLOCKED")}>
                <Ban size={13} /> Mark {toDamage > 0 ? toDamage : ""} damaged
              </button>
              <button type="button" className={btnSecondary} disabled={saving || toRepair === 0} onClick={() => apply("AVAILABLE")}>
                <Check size={13} /> Repaired {toRepair > 0 ? toRepair : ""}
              </button>
              <button type="button" className={btnSecondary} disabled={picked.size === 0} onClick={() => setPicked(new Set())}>
                Clear
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
