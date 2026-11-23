"use client";

import { useMemo, useState } from "react";
import ClassicSeatMap from "@/components/venue/ClassicSeatMap";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, Hammer, Layers, Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import {
  useCreateAdminVenueLayoutRequestMutation,
  useDeleteAdminVenueLayoutRequestMutation,
  useGetAdminVenueLayoutRequestsQuery,
  useUnpublishAdminVenueLayoutMutation,
  useUpdateAdminVenueLayoutRequestMutation,
  useGetCinemaScreensQuery,
  useMarkAdminVenueLayoutVisitCompleteMutation,
  useGetAdminVenueLayoutRequestQuery,
  type VenueLayoutRequest,
} from "@/services/api";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import { CINEMA_SCREEN_TYPES } from "@/lib/cinemaScreenTypes";
import SeatSectionsEditor, { cleanSections, type SeatSection } from "@/components/SuperAdmin/SeatSectionsEditor";
import { formatDateTime12h } from "@/lib/dateFormat";

const card = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const input = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-rose-400";

/** The stages a layout goes through, from the site visit to going live */
const STAGES = ["Site visit", "Build in designer", "Sent to partner", "Live"] as const;

function stageOf(r: VenueLayoutRequest): { index: number; label: string; tone: string } {
  const n = (v: unknown) => Number(v) || 0;
  const x = r as VenueLayoutRequest & { approved_count?: number; rejected_count?: number };
  if (n(x.approved_count) > 0) return { index: 3, label: "Live", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (n(r.live_pending_count) > 0) return { index: 2, label: "Partner approved, going live", tone: "bg-purple-50 text-purple-700 border-purple-200" };
  if (n(r.submitted_count) > 0) return { index: 2, label: "Sent to partner", tone: "bg-sky-50 text-sky-700 border-sky-200" };
  if (n(x.rejected_count) > 0 || r.status === "REJECTED") return { index: 1, label: "Rejected, rebuild", tone: "bg-rose-50 text-rose-700 border-rose-200" };
  if (String(r.visit_status || "").toUpperCase() !== "VISIT_COMPLETE") {
    return { index: 0, label: "Site visit pending", tone: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  return n(r.draft_count) > 0
    ? { index: 1, label: "In builder", tone: "bg-purple-50 text-purple-700 border-purple-200" }
    : { index: 1, label: "Ready to build", tone: "bg-purple-50 text-purple-700 border-purple-200" };
}

function Stepper({ index }: { index: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px]" aria-label="Layout progress">
      {STAGES.map((label, i) => (
        <li key={label} className="flex items-center gap-1">
          <span
            className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
              i < index || index === 3 ? "bg-emerald-500 text-white" : i === index ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-500"
            }`}
          >
            {i < index || index === 3 ? "✓" : i + 1}
          </span>
          <span className={i === index ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</span>
          {i < STAGES.length - 1 && <span className="mx-1 text-slate-300">›</span>}
        </li>
      ))}
    </ol>
  );
}

/** Layouts of one partner: what exists, where each one is in the process, and a way to start a new one. */
export default function PartnerLayoutsTab({ businessId, isCinema }: { businessId: string; isCinema: boolean }) {
  const { data: requests = [], isLoading, refetch } = useGetAdminVenueLayoutRequestsQuery({ business_id: businessId });
  const { data: screens = [], refetch: refetchScreens } = useGetCinemaScreensQuery(businessId, { skip: !isCinema });
  const router = useRouter();
  const [createRequest, { isLoading: creating }] = useCreateAdminVenueLayoutRequestMutation();
  const [updateRequest, { isLoading: updating }] = useUpdateAdminVenueLayoutRequestMutation();
  const [deleteRequest, { isLoading: deleting }] = useDeleteAdminVenueLayoutRequestMutation();
  const [unpublishLayout, { isLoading: unpublishing }] = useUnpublishAdminVenueLayoutMutation();
  const [markVisit, { isLoading: visiting }] = useMarkAdminVenueLayoutVisitCompleteMutation();

  const [newOpen, setNewOpen] = useState(false);
  const [screenId, setScreenId] = useState("");
  const [newScreenName, setNewScreenName] = useState("");
  const [newScreenType, setNewScreenType] = useState("standard");
  const [newScreenCap, setNewScreenCap] = useState("");
  const [name, setName] = useState("");
  const [startVisitPerson, setStartVisitPerson] = useState("");
  const [startVisitNotes, setStartVisitNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState<VenueLayoutRequest | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("theater");
  const [editCap, setEditCap] = useState("");
  const [seatReg, setSeatReg] = useState("");
  const [seatRec, setSeatRec] = useState("");
  const [seatCpl, setSeatCpl] = useState("");
  const [editReg, setEditReg] = useState("");
  const [newSections, setNewSections] = useState<SeatSection[]>([]);
  const [editSections, setEditSections] = useState<SeatSection[]>([]);
  const [visitSections, setVisitSections] = useState<SeatSection[]>([]);
  const [editRec, setEditRec] = useState("");
  const [editCpl, setEditCpl] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPerson, setEditPerson] = useState("");
  const [editVisit, setEditVisit] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<VenueLayoutRequest | null>(null);
  const [liveBlock, setLiveBlock] = useState<VenueLayoutRequest | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<VenueLayoutRequest | null>(null);
  const [viewTemplateId, setViewTemplateId] = useState<string | null>(null);
  const { data: viewDetail, isFetching: viewLoading } = useGetAdminVenueLayoutRequestQuery(viewing?.id || "", { skip: !viewing });
  const [person, setPerson] = useState("");
  const [visitNotes, setVisitNotes] = useState("");

  const sorted = useMemo(
    () => [...requests].sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || ""))),
    [requests]
  );

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 5);
  const seatTypesOf = (a: string, b: string, c: string) => ({ regular: Number(a) || 0, recliner: Number(b) || 0, couple: Number(c) || 0 });
  const zonesOf = (r: VenueLayoutRequest): Array<{ name?: string; capacity?: number }> => {
    const z = (r.spec_json as { zones?: unknown } | undefined)?.zones;
    return Array.isArray(z) ? (z as Array<{ name?: string; capacity?: number }>) : [];
  };

  const sectionsOf = (r: VenueLayoutRequest): SeatSection[] => {
    const raw = (r.spec_json as { sections?: unknown } | undefined)?.sections;
    return Array.isArray(raw) ? (raw as SeatSection[]) : [];
  };
  const ADD_NEW = "__new__";
  const pickScreen = (id: string) => {
    setScreenId(id);
    const sc = screens.find((x) => x.id === id);
    if (sc) {
      setNewScreenName(sc.name || "");
      setNewScreenType(sc.screen_type || "standard");
      setNewScreenCap(String(sc.capacity ?? ""));
      const st = (sc.seat_types_json || {}) as { regular?: number; recliner?: number; couple?: number };
      setSeatReg(st.regular ? String(st.regular) : "");
      setSeatRec(st.recliner ? String(st.recliner) : "");
      setSeatCpl(st.couple ? String(st.couple) : "");
    } else {
      setNewScreenName("");
      setNewScreenType("standard");
      setNewScreenCap("");
      setSeatReg("");
      setSeatRec("");
      setSeatCpl("");
    }
  };
  const totalCap = Number(newScreenCap) || 0;
  const assigned = (Number(seatReg) || 0) + (Number(seatRec) || 0) + (Number(seatCpl) || 0);
  const remaining = totalCap - assigned;
  const addingScreen = isCinema && (screenId === ADD_NEW || screens.length === 0);
  const submitNew = async () => {
    if (isCinema && !addingScreen && !screenId) {
      toast.error("Pick a screen, or add a new one.");
      return;
    }
    if (addingScreen && (!newScreenName.trim() || !Number(newScreenCap))) {
      toast.error("Enter the new screen's name and capacity.");
      return;
    }
    if (isCinema && assigned > totalCap && totalCap > 0) {
      toast.error("Seat types add up to more than the screen capacity.");
      return;
    }
    if ((startVisitPerson.trim() && !startVisitNotes.trim()) || (!startVisitPerson.trim() && startVisitNotes.trim())) {
      toast.error("Enter both who visited and the visit notes, or leave both empty.");
      return;
    }
    const startVisitPersonUsed = Boolean(startVisitPerson.trim());
    try {
      const created = await createRequest({
        business_id: businessId,
        ...(addingScreen
          ? { new_screen: { name: newScreenName.trim(), screen_type: newScreenType, capacity: Number(newScreenCap) } }
          : screenId
            ? { screen_id: screenId }
            : {}),
        ...(name.trim() ? { layout_name: name.trim() } : {}),
        ...(startVisitPerson.trim() ? { visited_person: startVisitPerson.trim(), visit_notes: startVisitNotes.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(isCinema && (Number(seatReg) || Number(seatRec) || Number(seatCpl)) ? { seat_types: seatTypesOf(seatReg, seatRec, seatCpl) } : {}),
        ...(cleanSections(newSections).length ? { sections: cleanSections(newSections) } : {}),
      }).unwrap();
      toast.success(startVisitPerson.trim() ? "Layout started. You can build it now." : "Layout started. Record the site visit next.");
      setNewOpen(false);
      setScreenId("");
      setNewScreenName("");
      setNewScreenCap("");
      setName("");
      setStartVisitPerson("");
      setStartVisitNotes("");
      setNotes("");
      setSeatReg("");
      setSeatRec("");
      setSeatCpl("");
      setNewSections([]);
      void refetch();
      if (isCinema) void refetchScreens();
      // Visit already recorded: go straight to building it
      if (created?.id && startVisitPersonUsed) router.push(`/admin/venue-layouts/${created.id}?design=1`);
    } catch (err) {
      toast.error(extractApiError(err, "Could not start the layout"));
    }
  };

  const isLive = (r: VenueLayoutRequest) => Number((r as VenueLayoutRequest & { approved_count?: number }).approved_count) > 0;

  const openEdit = (r: VenueLayoutRequest) => {
    setEditing(r);
    setEditName(r.layout_name || "");
    setEditType(r.layout_type || "theater");
    setEditCap(String(r.capacity ?? ""));
    setEditNotes(typeof r.spec_json?.notes === "string" ? (r.spec_json.notes as string) : "");
    setEditPerson(r.visit_person || "");
    setEditVisit(r.visit_notes || "");
    const byName = (n: string) => String(zonesOf(r).find((z) => String(z.name).toLowerCase() === n)?.capacity ?? "");
    setEditReg(byName("regular"));
    setEditRec(byName("recliner"));
    setEditCpl(byName("couple"));
    setEditSections(sectionsOf(r));
  };

  const submitEdit = async () => {
    if (!editing) return;
    if (!editName.trim()) {
      toast.error("Enter a layout name.");
      return;
    }
    if ((editPerson.trim() && !editVisit.trim()) || (!editPerson.trim() && editVisit.trim())) {
      toast.error("Enter both who visited and the visit notes, or clear both.");
      return;
    }
    try {
      await updateRequest({
        id: editing.id,
        layout_name: editName.trim(),
        layout_type: editType.trim() || "theater",
        capacity: Number(editCap) || 0,
        notes: editNotes,
        ...(isCinema ? { seat_types: seatTypesOf(editReg, editRec, editCpl) } : {}),
        sections: cleanSections(editSections),
        visited_person: editPerson.trim(),
        visit_notes: editVisit.trim(),
      }).unwrap();
      toast.success("Layout updated.");
      setEditing(null);
      void refetch();
    } catch (err) {
      toast.error(extractApiError(err, "Could not update the layout"));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRequest(deleteTarget.id).unwrap();
      toast.success("Layout deleted.");
      setDeleteTarget(null);
      void refetch();
    } catch (err) {
      toast.error(extractApiError(err, "Could not delete the layout"));
    }
  };

  const confirmUnpublish = async () => {
    if (!liveBlock) return;
    try {
      await unpublishLayout(liveBlock.id).unwrap();
      toast.success("Layout unpublished. You can delete it now.");
      setLiveBlock(null);
      void refetch();
      if (isCinema) void refetchScreens();
    } catch (err) {
      toast.error(extractApiError(err, "Could not unpublish the layout"));
    }
  };

  const submitVisit = async () => {
    if (!visitId) return;
    if (!person.trim() || !visitNotes.trim()) {
      toast.error("Enter who visited and the visit notes.");
      return;
    }
    try {
      await markVisit({ id: visitId, visited_person: person.trim(), visit_notes: visitNotes.trim(), ...(cleanSections(visitSections).length ? { sections: cleanSections(visitSections) } : {}) }).unwrap();
      toast.success("Site visit recorded. You can build the layout now.");
      setVisitId(null);
      setPerson("");
      setVisitNotes("");
      setVisitSections([]);
      void refetch();
    } catch (err) {
      toast.error(extractApiError(err, "Could not record the visit"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Layers size={15} className="text-rose-500" /> Layouts
          </h2>
        </div>
        <button type="button" onClick={() => setNewOpen(true)} className="btn-primary !py-2 !px-3 text-sm inline-flex items-center gap-1.5">
          <Plus size={15} /> New layout
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading layouts…</p>
      ) : sorted.length === 0 ? (
        <div className={`${card} p-10 text-center text-slate-500`}>
          <Layers size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="font-semibold text-slate-700">No layouts yet</p>
          <p className="text-sm mt-1">Use New layout to start one, or wait for the cinema to request one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {sorted.map((r) => {
            const stage = stageOf(r);
            return (
              <div key={r.id} className={`${card} p-4 space-y-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{r.layout_name}</p>
                    <p className="text-xs text-slate-500">
                      {r.hall_name || "Screen"} · capacity {r.capacity}
                      {Number(r.draft_count) + Number(r.submitted_count) > 0 ? ` · ${Number(r.draft_count) + Number(r.submitted_count)} option(s) built` : ""}
                      {r.updated_at ? ` · updated ${formatDateTime12h(r.updated_at)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${stage.tone}`}>{stage.label}</span>
                    {(r.spec_json as { intake_mode?: string } | undefined)?.intake_mode === "structured_request" ? (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-700">Requested by cinema</span>
                    ) : null}
                  </div>
                </div>
                <Stepper index={stage.index} />
                {zonesOf(r).length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {zonesOf(r).map((z, i) => (
                      <span key={i} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {z.name}: {z.capacity}
                      </span>
                    ))}
                  </div>
                ) : null}
                {sectionsOf(r).length > 0 ? (
                  <p className="text-[11px] text-slate-600">
                    <b>Sections:</b>{" "}
                    {sectionsOf(r).map((x) => `${x.name} (${x.seat_type} ${x.seats})`).join(", ")}
                  </p>
                ) : null}
                {r.visit_notes ? (
                  <p className="text-xs text-slate-600 rounded-lg bg-slate-50 border border-slate-100 p-2">
                    <b>Visit{r.visit_person ? ` by ${r.visit_person}` : ""}:</b> {r.visit_notes}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  {stage.index === 0 && (
                    <button type="button" className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5" onClick={() => setVisitId(r.id)}>
                      <CalendarCheck size={13} /> Record site visit
                    </button>
                  )}
                  {stage.index === 1 && (
                    <Link href={`/admin/venue-layouts/${r.id}?design=1`} className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5">
                      <Hammer size={13} /> Build layout
                    </Link>
                  )}
                  {stage.index >= 2 && (
                    <button
                      type="button"
                      className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
                      onClick={() => {
                        setViewTemplateId(null);
                        setViewing(r);
                      }}
                    >
                      <Hammer size={13} /> Open layout
                    </button>
                  )}
                  <button type="button" className="btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5" onClick={() => openEdit(r)}>
                    <Pencil size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer"
                    onClick={() => (isLive(r) ? setLiveBlock(r) : setDeleteTarget(r))}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {newOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setNewOpen(false)}>
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900">New layout</h3>
              <button type="button" onClick={() => setNewOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            {isCinema && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Screen *</label>
                <select className={input} value={screens.length === 0 ? ADD_NEW : screenId} onChange={(e) => pickScreen(e.target.value)}>
                  <option value="">Pick a screen…</option>
                  {screens.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.capacity} seats)
                    </option>
                  ))}
                  <option value={ADD_NEW}>+ Add a new screen…</option>
                </select>
              </div>
            )}
            {isCinema ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Screen name *</label>
                    <input className={input} placeholder="Screen 1 / IMAX" value={newScreenName} disabled={!addingScreen} onChange={(e) => setNewScreenName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Screen type</label>
                    <select className={input} value={newScreenType} disabled={!addingScreen} onChange={(e) => setNewScreenType(e.target.value)}>
                      {CINEMA_SCREEN_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Expected capacity (total seats) *</label>
                    <input
                      className={input}
                      type="text"
                      inputMode="numeric"
                      value={newScreenCap}
                      disabled={!addingScreen}
                      onChange={(e) => setNewScreenCap(digits(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                    <input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Regular seats</label>
                    <input className={input} type="text" inputMode="numeric" placeholder="0" value={seatReg} onChange={(e) => setSeatReg(digits(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Recliner seats</label>
                    <input className={input} type="text" inputMode="numeric" placeholder="0" value={seatRec} onChange={(e) => setSeatRec(digits(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Couple seats</label>
                    <input className={input} type="text" inputMode="numeric" placeholder="0" value={seatCpl} onChange={(e) => setSeatCpl(digits(e.target.value))} />
                  </div>
                </div>
                <p className={`text-xs ${remaining === 0 && assigned > 0 ? "text-emerald-600" : remaining < 0 ? "text-rose-600" : "text-slate-500"}`}>
                  Total capacity {totalCap || 0}. Assigned {assigned}
                  {totalCap > 0
                    ? remaining === 0
                      ? " — all seats assigned."
                      : remaining > 0
                        ? ` — ${remaining} still to assign across Regular / Recliner / Couple.`
                        : ` — over by ${Math.abs(remaining)}. Reduce seat type counts.`
                    : ". Pick a screen or enter its capacity first."}
                </p>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Layout name</label>
                  <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Hall seating" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                  <textarea className={`${input} min-h-[60px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </>
            )}
            {isCinema ? <SeatSectionsEditor value={newSections} onChange={setNewSections} totals={{ regular: Number(seatReg) || 0, recliner: Number(seatRec) || 0, couple: Number(seatCpl) || 0 }} /> : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Visited by</label>
                <input className={input} placeholder="Who visited" value={startVisitPerson} onChange={(e) => setStartVisitPerson(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Visit notes</label>
                <input className={input} placeholder="Rows, aisles, recliners…" value={startVisitNotes} onChange={(e) => setStartVisitNotes(e.target.value)} />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 -mt-1">Fill both visit fields to mark the visit done and go straight to building the layout.</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary !py-2 !px-3 text-sm" onClick={() => setNewOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary !py-2 !px-3 text-sm" disabled={creating} onClick={submitNew}>
                {creating ? "Starting…" : "Start layout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900">Edit layout</h3>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close" className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            {isLive(editing) && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                This layout is live. Edits to these details apply now; to change the seats, unpublish it, edit the design, then send it again.
              </p>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Layout name *</label>
              <input className={input} value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Layout type</label>
                <select className={input} value={editType} onChange={(e) => setEditType(e.target.value)}>
                  <option value="theater">Theater</option>
                  <option value="custom">Custom</option>
                  <option value="stadium">Stadium</option>
                  <option value="banquet">Banquet</option>
                  <option value="standing">Standing</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Capacity</label>
                <input
                  className={input}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editCap}
                  onChange={(e) => setEditCap(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  aria-label="Capacity"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
              <textarea className={`${input} min-h-[60px]`} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            </div>
            {isCinema ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-bold text-slate-700">Seat types (optional)</p>
                <div className="grid grid-cols-3 gap-2">
                  <input className={input} type="text" inputMode="numeric" placeholder="Regular" aria-label="Regular seats" value={editReg} onChange={(e) => setEditReg(digits(e.target.value))} />
                  <input className={input} type="text" inputMode="numeric" placeholder="Recliner" aria-label="Recliner seats" value={editRec} onChange={(e) => setEditRec(digits(e.target.value))} />
                  <input className={input} type="text" inputMode="numeric" placeholder="Couple" aria-label="Couple seats" value={editCpl} onChange={(e) => setEditCpl(digits(e.target.value))} />
                </div>
              </div>
            ) : null}
            {isCinema ? <SeatSectionsEditor value={editSections} onChange={setEditSections} totals={{ regular: Number(editReg) || 0, recliner: Number(editRec) || 0, couple: Number(editCpl) || 0 }} /> : null}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-bold text-slate-700">Site visit</p>
              <input className={input} placeholder="Who visited" value={editPerson} onChange={(e) => setEditPerson(e.target.value)} />
              <textarea className={`${input} min-h-[60px]`} placeholder="Visit notes" value={editVisit} onChange={(e) => setEditVisit(e.target.value)} />
              <p className="text-[11px] text-slate-500">Clear both to mark the visit as pending again.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary !py-2 !px-3 text-sm" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary !py-2 !px-3 text-sm" disabled={updating} onClick={submitEdit}>
                {updating ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this layout?"
        body={`"${deleteTarget?.layout_name || "This layout"}" and every design option built for it will be deleted. This cannot be undone.`}
        confirmLabel="Delete layout"
        danger
        theme="light"
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      {liveBlock && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setLiveBlock(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-extrabold text-slate-900">This layout is live</h3>
            <p className="text-sm text-slate-600">
              &quot;{liveBlock.layout_name}&quot; is published and in use on its screen, so it can&apos;t be deleted directly. Unpublish it first. It goes back to a
              draft and the screen has no live layout until you publish one again. After that you can delete it.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary !py-2 !px-3 text-sm" onClick={() => setLiveBlock(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary !py-2 !px-3 text-sm inline-flex items-center gap-1.5" disabled={unpublishing} onClick={confirmUnpublish}>
                <Undo2 size={14} /> {unpublishing ? "Unpublishing…" : "Unpublish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {visitId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setVisitId(null)}>
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white border border-slate-200 p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-extrabold text-slate-900">Record site visit</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Who visited *</label>
              <input className={input} value={person} onChange={(e) => setPerson(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Visit notes *</label>
              <textarea className={`${input} min-h-[90px]`} value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} placeholder="Rows, aisles, recliners, wheelchair spots…" />
            </div>
            {isCinema ? (
              <SeatSectionsEditor
                value={visitSections}
                onChange={setVisitSections}
                totals={(() => {
                  const req = requests.find((x) => x.id === visitId);
                  const z = req ? zonesOf(req) : [];
                  const n = (k: string) => Number(z.find((a) => String(a.name).toLowerCase() === k)?.capacity) || 0;
                  return { regular: n("regular"), recliner: n("recliner"), couple: n("couple") };
                })()}
              />
            ) : null}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary !py-2 !px-3 text-sm" onClick={() => setVisitId(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary !py-2 !px-3 text-sm" disabled={visiting} onClick={submitVisit}>
                {visiting ? "Saving…" : "Save visit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setViewing(null)}>
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-base font-extrabold text-slate-900">{viewing.layout_name}</p>
                <p className="text-xs text-slate-500">{viewing.hall_name || "Screen"} · capacity {viewing.capacity}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="btn-primary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5"
                  onClick={() => router.push(`/admin/venue-layouts/${viewing.id}?design=1`)}
                >
                  <Pencil size={13} /> Edit
                </button>
                <button type="button" aria-label="Close" className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" onClick={() => setViewing(null)}>
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {(() => {
                const list = viewDetail?.templates || [];
                const active = list.find((t) => t.id === viewTemplateId) || list.find((t) => t.is_default) || list[0];
                if (viewLoading && !viewDetail) return <p className="py-16 text-center text-sm text-slate-500">Loading layout…</p>;
                if (!active) return <p className="py-16 text-center text-sm text-slate-500">No layout drawn yet. Click Edit to build it.</p>;
                return (
                  <div className="space-y-3">
                    {list.length > 1 ? (
                      <div className="flex flex-wrap gap-2">
                        {list.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setViewTemplateId(t.id)}
                            className={`rounded-lg border px-3 py-1 text-xs font-semibold ${t.id === active.id ? "border-rose-400 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600"}`}
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <ClassicSeatMap seats={active.seats_json} heightClass="h-[60vh]" />
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
