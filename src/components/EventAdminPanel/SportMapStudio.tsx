"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Copy, Eye, Landmark, Plus, Save, Trash2, Users, X } from "lucide-react";
import { useGetEventLayoutQuery, useUpdateEventLayoutMutation } from "@/services/api";
import {
  DEFAULT_CATEGORIES,
  blockOutline,
  newId,
  rectOutline,
  sampleSportLayout,
  sportRowLabel,
  type SportConfig,
  type SportObject,
} from "@/lib/sportZoom";

const SportZoomSeatPicker = dynamic(() => import("@/components/EventLandingPage/SportZoomSeatPicker"), { ssr: false });

const emptyConfig = (): SportConfig => ({
  layout_mode: "sport_zoom",
  canvas: { w: 1600, h: 1100 },
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  objects: [],
});

const MAX_ROWS = 80;
const MAX_PER_ROW = 120;
const MAX_STANDING = 3000;
const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-[#6900AA]";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500";

export default function SportMapStudio({ eventId }: { eventId: string }) {
  const { data: layoutData, isLoading } = useGetEventLayoutQuery(eventId, { skip: !eventId });
  const [saveLayout, { isLoading: saving }] = useUpdateEventLayoutMutation();

  const [cfg, setCfg] = useState<SportConfig>(emptyConfig);
  const [selId, setSelId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const loaded = useRef(false);

  // load the saved layout once
  useEffect(() => {
    if (loaded.current || isLoading) return;
    const saved = (layoutData as any)?.data?.seating_config ?? (layoutData as any)?.seating_config;
    loaded.current = true;
    if (saved?.layout_mode === "sport_zoom" && Array.isArray(saved.objects)) setCfg({ ...emptyConfig(), ...saved });
  }, [layoutData, isLoading]);

  const update = (fn: (c: SportConfig) => SportConfig) => {
    setCfg((c) => fn(c));
    setDirty(true);
  };
  const patch = (id: string, p: Partial<SportObject>) => update((c) => ({ ...c, objects: c.objects.map((o) => (o.id === id ? { ...o, ...p } : o)) }));

  const sel = cfg.objects.find((o) => o.id === selId) || null;
  const firstCat = cfg.categories[0]?.id;

  const add = (type: SportObject["type"]) => {
    const nudge = (cfg.objects.length % 8) * 70; // new objects land beside the last ones, not on top of them
    const base = { id: newId(type), x: cfg.canvas.w / 2 + nudge - 245, y: cfg.canvas.h / 2 + nudge - 245, rotation: 0 };
    let o: SportObject;
    if (type === "block")
      o = { ...base, type, name: `Block ${cfg.objects.filter((x) => x.type === "block").length + 1}`, category_id: firstCat, w: 400, h: 120, rows: 10, seats_per_row: 14, row_start: "A", row_dir: 1, curve: 0 };
    else if (type === "standing")
      o = { ...base, type, name: `Standing ${cfg.objects.filter((x) => x.type === "standing").length + 1}`, category_id: cfg.categories[cfg.categories.length - 1]?.id, w: 360, h: 100, capacity: 300 };
    else if (type === "pitch") o = { ...base, type, name: "PITCH", w: 520, h: 300 };
    else o = { ...base, type, name: "STAGE", w: 300, h: 80 };
    update((c) => ({ ...c, objects: [...c.objects, o] }));
    setSelId(o.id);
  };

  const duplicate = () => {
    if (!sel) return;
    const copy = { ...sel, id: newId(sel.type), name: `${sel.name} copy`, x: sel.x + 40, y: sel.y + 40 };
    update((c) => ({ ...c, objects: [...c.objects, copy] }));
    setSelId(copy.id);
  };
  const remove = () => {
    if (!sel) return;
    update((c) => ({ ...c, objects: c.objects.filter((o) => o.id !== sel.id) }));
    setSelId(null);
  };

  // drag on the canvas
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const toMap = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const onDown = (e: React.PointerEvent, o: SportObject) => {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = toMap(e);
    drag.current = { id: o.id, dx: o.x - p.x, dy: o.y - p.y };
    setSelId(o.id);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = toMap(e);
    const { id, dx, dy } = drag.current;
    const nx = Math.round(Math.min(cfg.canvas.w, Math.max(0, p.x + dx)) / 5) * 5;
    const ny = Math.round(Math.min(cfg.canvas.h, Math.max(0, p.y + dy)) / 5) * 5;
    update((c) => ({
      ...c,
      objects: c.objects.map((o) => {
        if (o.id !== id) return o;
        const dx = nx - o.x;
        const dy = ny - o.y;
        return { ...o, x: nx, y: ny, ...(o.arc ? { arc: { ...o.arc, cx: o.arc.cx + dx, cy: o.arc.cy + dy } } : {}) };
      }),
    }));
  };
  const onUp = () => {
    drag.current = null;
  };

  const totals = useMemo(() => {
    let seats = 0;
    let standing = 0;
    cfg.objects.forEach((o) => {
      if (o.type === "block") seats += (o.rows || 0) * (o.seats_per_row || 0);
      if (o.type === "standing") standing += o.capacity || 0;
    });
    return { seats, standing };
  }, [cfg.objects]);

  const problems = useMemo(() => {
    const out: string[] = [];
    const ids = new Set(cfg.categories.map((c) => c.id));
    cfg.objects.forEach((o) => {
      if ((o.type === "block" || o.type === "standing") && (!o.category_id || !ids.has(o.category_id))) out.push(`"${o.name}" needs a price category.`);
      if (o.type === "block" && ((o.rows || 0) < 1 || (o.seats_per_row || 0) < 1)) out.push(`"${o.name}" needs rows and seats.`);
      if (o.type === "standing" && (o.capacity || 0) < 1) out.push(`"${o.name}" needs a capacity.`);
    });
    if (!cfg.objects.some((o) => o.type === "block" || o.type === "standing")) out.push("Add at least one block or standing zone.");
    if (cfg.categories.some((c) => !c.name.trim())) out.push("Every category needs a name.");
    return out;
  }, [cfg]);

  const save = async () => {
    if (problems.length) return toast.error(problems[0]);
    try {
      const res: any = await saveLayout({ eventId, seating_config: cfg, seats: undefined as any }).unwrap();
      if (res?.sport_zoom_error) toast.error(res.sport_zoom_error);
      else toast.success(res?.message || "Layout saved.");
      setDirty(false);
    } catch (e: any) {
      toast.error(e?.data?.error || e?.message || "Could not save the layout.");
    }
  };

  
  return (
    <div className="flex h-full min-h-[720px] flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-slate-900">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <p className="text-sm font-extrabold">Sport map studio</p>
          <p className="text-xs text-slate-500">{totals.seats.toLocaleString()} seats · {totals.standing.toLocaleString()} standing places · {cfg.objects.length} objects</p>
        </div>
        <button type="button" onClick={() => add("block")} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white"><Plus className="size-3.5" /> Block</button>
        <button type="button" onClick={() => add("standing")} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white"><Users className="size-3.5" /> Standing zone</button>
        <button type="button" onClick={() => add("pitch")} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">Pitch</button>
        <button type="button" onClick={() => add("stage")} className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold">Stage</button>
        <button
          type="button"
          onClick={() => {
            if (cfg.objects.length && !window.confirm("Replace the current layout with the sample stadium?")) return;
            setCfg(sampleSportLayout());
            setSelId(null);
            setDirty(true);
          }}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold"
        >
          <Landmark className="size-3.5" /> Sample stadium
        </button>
        <button type="button" onClick={() => setPreview(true)} disabled={!cfg.objects.length} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#6900AA] px-3 py-2 text-xs font-bold text-[#6900AA] disabled:opacity-40"><Eye className="size-3.5" /> Preview</button>
        <button type="button" onClick={save} disabled={saving} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#6900AA] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"><Save className="size-3.5" /> {saving ? "Saving…" : dirty ? "Save layout" : "Saved"}</button>
      </div>

      {problems.length ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{problems[0]}{problems.length > 1 ? ` (+${problems.length - 1} more)` : ""}</p> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[1fr_20rem]">
        {/* canvas */}
        <div className="min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          <svg ref={svgRef} viewBox={`0 0 ${cfg.canvas.w} ${cfg.canvas.h}`} className="h-full w-full touch-none" onPointerMove={onMove} onPointerUp={onUp} onPointerDown={() => setSelId(null)}>
            <defs>
              <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#e2e8f0" strokeWidth="1" /></pattern>
            </defs>
            <rect width={cfg.canvas.w} height={cfg.canvas.h} fill="#f1f5f9" />
            <rect width={cfg.canvas.w} height={cfg.canvas.h} fill="url(#grid)" />
            {[...cfg.objects].sort((a, b) => (a.type === "ground" ? 0 : a.type === "pitch" ? 1 : 2) - (b.type === "ground" ? 0 : b.type === "pitch" ? 1 : 2)).map((o) => {
              const on = o.id === selId;
              if (o.type === "block")
                return (
                  <g key={o.id} onPointerDown={(e) => onDown(e, o)} style={{ cursor: "move" }}>
                    <polygon points={blockOutline(o)} fill="#ede9fe" stroke={on ? "#f97316" : "#7c3aed"} strokeWidth={on ? 4 : 1.6} />
                    <text x={o.x} y={o.y - 1} textAnchor="middle" fontSize={Math.max(11, Math.min(Math.min(o.w, o.h) * 0.2, 22))} fontWeight={800} fill="#4c1d95" pointerEvents="none">{o.name}</text>
                    <text x={o.x} y={o.y + 14} textAnchor="middle" fontSize={11} fill="#4c1d95" opacity={0.8} pointerEvents="none">{(o.rows || 0) * (o.seats_per_row || 0)} seats</text>
                  </g>
                );
              if (o.type === "standing")
                return (
                  <g key={o.id} onPointerDown={(e) => onDown(e, o)} style={{ cursor: "move" }}>
                    <polygon points={rectOutline(o)} fill="#ede9fe" stroke={on ? "#f97316" : "#7c3aed"} strokeWidth={on ? 4 : 1.6} strokeDasharray="8 5" />
                    <text x={o.x} y={o.y - 2} textAnchor="middle" fontSize={18} fontWeight={800} fill="#4c1d95" pointerEvents="none">{o.name}</text>
                    <text x={o.x} y={o.y + 16} textAnchor="middle" fontSize={12} fill="#4c1d95" opacity={0.8} pointerEvents="none">Standing · {o.capacity}</text>
                  </g>
                );
              return (
                <g key={o.id} onPointerDown={(e) => onDown(e, o)} style={{ cursor: "move" }}>
                  <polygon points={rectOutline(o)} fill={o.type === "ground" ? "#dcfce7" : o.type === "pitch" ? "#bbf7d0" : "#cbd5e1"} stroke={on ? "#f97316" : o.type === "stage" ? "#64748b" : "#16a34a"} strokeWidth={on ? 4 : 2} />
                  <text x={o.x} y={o.y} textAnchor="middle" dominantBaseline="central" fontSize={22} fontWeight={800} fill={o.type === "stage" ? "#334155" : "#16a34a"} opacity={0.8} pointerEvents="none">{o.name}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* properties */}
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          {sel ? (
            <section className="space-y-3 rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold capitalize">{sel.type === "standing" ? "Standing zone" : sel.type}</p>
                <div className="flex gap-1">
                  <button type="button" aria-label="Duplicate" onClick={duplicate} className="cursor-pointer rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"><Copy className="size-4" /></button>
                  <button type="button" aria-label="Delete" onClick={remove} className="cursor-pointer rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 className="size-4" /></button>
                </div>
              </div>
              <div><label className={labelCls}>Name</label><input className={inputCls} value={sel.name} onChange={(e) => patch(sel.id, { name: e.target.value })} /></div>

              {sel.type === "block" || sel.type === "standing" ? (
                <div>
                  <label className={labelCls}>Price category</label>
                  <select className={inputCls} value={sel.category_id || ""} onChange={(e) => patch(sel.id, { category_id: e.target.value })}>
                    <option value="">Choose…</option>
                    {cfg.categories.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.price} ETB</option>)}
                  </select>
                </div>
              ) : null}

              {sel.type === "block" ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelCls}>Rows</label><input type="number" min={1} max={MAX_ROWS} className={inputCls} value={sel.rows ?? 1} onChange={(e) => patch(sel.id, { rows: clampN(Number(e.target.value), 1, MAX_ROWS) })} /></div>
                    <div><label className={labelCls}>Seats per row</label><input type="number" min={1} max={MAX_PER_ROW} className={inputCls} value={sel.seats_per_row ?? 1} onChange={(e) => patch(sel.id, { seats_per_row: clampN(Number(e.target.value), 1, MAX_PER_ROW) })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelCls}>First row letter</label><input maxLength={1} className={inputCls} value={sel.row_start || "A"} onChange={(e) => patch(sel.id, { row_start: (e.target.value.toUpperCase().replace(/[^A-Z]/g, "") || "A").slice(0, 1) })} /></div>
                    <div><label className={labelCls}>Row A is on</label>
                      <select className={inputCls} value={sel.row_dir === -1 ? "-1" : "1"} onChange={(e) => patch(sel.id, { row_dir: e.target.value === "-1" ? -1 : 1 })}>
                        <option value="1">Top edge</option>
                        <option value="-1">Bottom edge</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">Rows: {sportRowLabel(0, sel.row_start)}, {sportRowLabel(1, sel.row_start)} … {sportRowLabel(Math.max(0, (sel.rows || 1) - 1), sel.row_start)} · {(sel.rows || 0) * (sel.seats_per_row || 0)} seats</p>
                  <div className={sel.arc ? "hidden" : ""}><label className={labelCls}>Curve ({(sel.curve || 0).toFixed(2)})</label><input type="range" min={-1} max={1} step={0.05} className="w-full" value={sel.curve || 0} onChange={(e) => patch(sel.id, { curve: Number(e.target.value) })} /></div>
                </>
              ) : null}

              {sel.type === "standing" ? (
                <div><label className={labelCls}>Capacity (places)</label><input type="number" min={1} max={MAX_STANDING} className={inputCls} value={sel.capacity ?? 1} onChange={(e) => patch(sel.id, { capacity: clampN(Number(e.target.value), 1, MAX_STANDING) })} /></div>
              ) : null}

              {sel.arc ? <p className="text-[11px] text-slate-500">This is a curved stand: drag it to move it. Its rows follow the curve.</p> : null}
              <div className={sel.arc ? "hidden" : "grid grid-cols-3 gap-2"}>
                <div><label className={labelCls}>Width</label><input type="number" min={40} max={1600} className={inputCls} value={Math.round(sel.w)} onChange={(e) => patch(sel.id, { w: clampN(Number(e.target.value), 40, 1600) })} /></div>
                <div><label className={labelCls}>Height</label><input type="number" min={40} max={1100} className={inputCls} value={Math.round(sel.h)} onChange={(e) => patch(sel.id, { h: clampN(Number(e.target.value), 40, 1100) })} /></div>
                <div><label className={labelCls}>Turn °</label><input type="number" min={-180} max={180} className={inputCls} value={Math.round(sel.rotation || 0)} onChange={(e) => patch(sel.id, { rotation: clampN(Number(e.target.value), -180, 180) })} /></div>
              </div>
            </section>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">Click an object on the map to edit it, or add a block above. Drag objects to move them.</p>
          )}

          <section className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-extrabold">Price categories</p>
              <button type="button" onClick={() => update((c) => ({ ...c, categories: [...c.categories, { id: newId("cat"), name: `Category ${c.categories.length + 1}`, color: "#16a34a", price: 1000 }] }))} className="cursor-pointer text-xs font-bold text-[#6900AA]">+ Add</button>
            </div>
            {cfg.categories.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_5.5rem_1.5rem] items-center gap-2">
                <input className={inputCls} value={c.name} onChange={(e) => update((s) => ({ ...s, categories: s.categories.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)) }))} />
                <input type="number" min={0} className={inputCls} value={c.price} onChange={(e) => update((s) => ({ ...s, categories: s.categories.map((x) => (x.id === c.id ? { ...x, price: Math.max(0, Number(e.target.value) || 0) } : x)) }))} />
                <button
                  type="button"
                  aria-label="Remove category"
                  onClick={() => {
                    if (cfg.objects.some((o) => o.category_id === c.id)) return toast.error("This category is used by a block or zone. Change those first.");
                    update((s) => ({ ...s, categories: s.categories.filter((x) => x.id !== c.id) }));
                  }}
                  className="cursor-pointer text-slate-400 hover:text-rose-600"
                ><X className="size-4" /></button>
              </div>
            ))}
            <p className="text-[11px] text-slate-500">Price in ETB. Each category becomes a ticket type when you save.</p>
          </section>
        </div>
      </div>

      {preview ? (
        <div className="fixed inset-0 z-[300] flex flex-col bg-black/70 p-3 sm:p-6">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[#0b0f17]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
              <p className="text-sm font-extrabold">Customer preview <span className="font-normal text-slate-400">(sample seats, nothing is saved)</span></p>
              <button type="button" onClick={() => setPreview(false)} className="cursor-pointer rounded-lg border border-white/30 px-3 py-1 text-sm font-bold">Close</button>
            </div>
            <div className="min-h-0 flex-1">
              <SportZoomSeatPicker config={cfg} onSeatsSelected={() => {}} maxSelectable={4} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
