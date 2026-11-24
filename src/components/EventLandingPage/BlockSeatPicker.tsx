"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, Armchair, X } from "lucide-react";

const Stadium3DView = dynamic(() => import("@/components/EventLandingPage/StadiumModelView"), {
  ssr: false,
  loading: () => <div className="flex h-56 items-center justify-center bg-[#0b1224] text-sm text-slate-400">Loading 3D view…</div>,
});

/**
 * Customer seat picking for stadiums and auditoriums that are drawn as blocks.
 * 1) the whole venue with its blocks, coloured by price category;
 * 2) tap a block to see its rows and seats in the classic grid;
 * 3) a "view from your seat" picture and distances for the chosen seat.
 */

type EventSeat = {
  id: string;
  ticket_type_id?: string | null;
  section_name?: string;
  row_label?: string;
  seat_label?: string;
  coordinate_x?: number | string;
  coordinate_y?: number | string;
  status?: string;
  block_id?: string | null;
  tier_id?: string | null;
};

type BlockObj = {
  id: string;
  name: string;
  color?: string;
  level?: string;
  price?: number;
  x: number;
  y: number;
  points: number[];
};

const METRES_PER_PX = 105 / 500; // a 500 px pitch stands for a 105 m pitch

/** Two colours only: the lower / inner stand and the upper / outer stand */
function tierColor(b: { level?: string; id: string }): string {
  return /lower|inner|premium|corporate/i.test(String(b.level || "")) ? "#7c3aed" : "#2563eb";
}

function num(v: unknown): number {
  return Number(v) || 0;
}

function money(n: number): string {
  return `${Math.round(n).toLocaleString()} ETB`;
}

export default function BlockSeatPicker({
  layoutData,
  ticketTypes,
  onSeatsSelected,
  initialSelectedSeats = [],
  maxSelectable = 10,
}: {
  layoutData: any;
  ticketTypes: any[];
  onSeatsSelected: (seats: any[]) => void;
  initialSelectedSeats?: any[];
  maxSelectable?: number;
}) {
  const data = layoutData?.data ?? layoutData ?? {};
  const cfg = data.seating_config || {};
  const objects: any[] = cfg.universal_layout?.objects || [];
  const seats: EventSeat[] = Array.isArray(data.seats) ? data.seats : [];
  const apiTypes: any[] = Array.isArray(data.ticket_types) && data.ticket_types.length ? data.ticket_types : ticketTypes || [];

  const blocks: BlockObj[] = useMemo(
    () => objects.filter((o) => o.type === "block" && Array.isArray(o.points) && o.points.length >= 6),
    [objects]
  );
  const ground = objects.find((o) => o.id === "shp_pill_ground" || /ground/i.test(String(o.name)));
  const pitch = objects.find((o) => o.id === "shp_pitch" || /pitch/i.test(String(o.name)));

  const typeById = useMemo(() => new Map(apiTypes.map((t) => [String(t.id), t])), [apiTypes]);
  const seatsByBlock = useMemo(() => {
    const m = new Map<string, EventSeat[]>();
    seats.forEach((s) => {
      const k = String(s.block_id || "");
      if (!k) return;
      m.set(k, [...(m.get(k) || []), s]);
    });
    return m;
  }, [seats]);

  const [selected, setSelected] = useState<EventSeat[]>(() =>
    seats.filter((s) => initialSelectedSeats.some((i: any) => String(i.id || i.seat_identifier) === String(s.id)))
  );
  const [blockId, setBlockId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [showView, setShowView] = useState(true);

  useEffect(() => {
    const ids = new Set(initialSelectedSeats.map((i: any) => String(i.id || i.seat_identifier)));
    setSelected(seats.filter((s) => ids.has(String(s.id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelectedSeats.length]);

  const blockInfo = (b: BlockObj) => {
    const list = seatsByBlock.get(b.id) || [];
    const free = list.filter((s) => String(s.status || "AVAILABLE").toUpperCase() === "AVAILABLE").length;
    const tt = typeById.get(String(list[0]?.ticket_type_id || ""));
    return { total: list.length, free, ticketTypeId: String(list[0]?.ticket_type_id || ""), price: num(tt?.price), type: String(tt?.ticket_type || b.level || "") };
  };

  // Categories: one per ticket type used by the blocks
  const categories = useMemo(() => {
    const m = new Map<string, { id: string; name: string; price: number; color: string }>();
    blocks.forEach((b) => {
      const list = seatsByBlock.get(b.id) || [];
      const id = String(list[0]?.ticket_type_id || "");
      if (!id || m.has(id)) return;
      const tt = typeById.get(id);
      m.set(id, { id, name: String(tt?.ticket_type || b.level || "Seats"), price: num(tt?.price), color: tierColor(b) });
    });
    return Array.from(m.values()).sort((a, b) => b.price - a.price);
  }, [blocks, seatsByBlock, typeById]);

  // Drawing bounds
  const bounds = useMemo(() => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    blocks.forEach((b) => {
      for (let i = 0; i + 1 < b.points.length; i += 2) {
        const x = b.x + b.points[i];
        const y = b.y + b.points[i + 1];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    });
    if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1600, h: 1200 };
    const pad = 30;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }, [blocks]);

  const poly = (o: any) => {
    const pts: string[] = [];
    for (let i = 0; i + 1 < o.points.length; i += 2) pts.push(`${o.x + o.points[i]},${o.y + o.points[i + 1]}`);
    return pts.join(" ");
  };
  const centroid = (b: BlockObj) => {
    let sx = 0,
      sy = 0,
      n = 0;
    for (let i = 0; i + 1 < b.points.length; i += 2) {
      sx += b.points[i];
      sy += b.points[i + 1];
      n += 1;
    }
    return { x: b.x + sx / n, y: b.y + sy / n };
  };

  const block = blocks.find((b) => b.id === blockId) || null;
  const info = block ? blockInfo(block) : null;

  const rows = useMemo(() => {
    if (!block) return [] as Array<{ label: string; seats: EventSeat[] }>;
    const m = new Map<string, EventSeat[]>();
    (seatsByBlock.get(block.id) || []).forEach((s) => m.set(String(s.row_label), [...(m.get(String(s.row_label)) || []), s]));
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, list]) => ({ label, seats: list.sort((a, b) => num(a.seat_label) - num(b.seat_label)) }));
  }, [block, seatsByBlock]);

  const toggle = (s: EventSeat) => {
    const isSel = selected.some((x) => x.id === s.id);
    let next: EventSeat[];
    if (isSel) next = selected.filter((x) => x.id !== s.id);
    else if (selected.length >= maxSelectable) next = [...selected.slice(1), s];
    else next = [...selected, s];
    setSelected(next);
    onSeatsSelected(next);
  };

  const lastSeat = selected[selected.length - 1] || null;
  useEffect(() => {
    if (!selected.length) return;
    const t = setTimeout(() => {
      document.querySelectorAll("[data-seat-grid] [data-yours]").forEach((el, i) => {
        if (i === 0) (el as HTMLElement).scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    }, 60);
    return () => clearTimeout(t);
  }, [selected.length, blockId]);
  const total = selected.reduce((a, s) => a + num(typeById.get(String(s.ticket_type_id))?.price), 0);

  /** View from a seat: distances and a perspective picture of the pitch */
  const seatView = useMemo(() => {
    if (!lastSeat || !pitch) return null;
    const cx = pitch.x;
    const cy = pitch.y;
    const sx = num(lastSeat.coordinate_x);
    const sy = num(lastSeat.coordinate_y);
    const level = String(lastSeat.tier_id || "").toLowerCase();
    const height = level === "lower" ? 5 : 16;
    const dx = (sx - cx) * METRES_PER_PX;
    const dy = (sy - cy) * METRES_PER_PX;
    const toCentre = Math.round(Math.hypot(dx, dy));
    const halfL = 52.5;
    const goals = [
      Math.hypot(dx + halfL, dy),
      Math.hypot(dx - halfL, dy),
    ];
    const toGoal = Math.round(Math.min(...goals));
    // camera looks at the centre spot
    const len = Math.hypot(dx, dy) || 1;
    const fx = -dx / len;
    const fy = -dy / len;
    const rx = -fy;
    const ry = fx;
    const W = 360;
    const H = 220;
    const horizon = H * 0.38;
    const F = 250;
    const project = (px: number, py: number) => {
      const ddx = px - dx;
      const ddy = py - dy;
      const z = Math.max(1.5, ddx * fx + ddy * fy);
      const x = ddx * rx + ddy * ry;
      return [W / 2 + (F * x) / z, horizon + (F * height) / z] as const;
    };
    const P = (px: number, py: number) => project(px, py).map((v) => v.toFixed(1)).join(",");
    const pitchPts = [P(-52.5, -34), P(52.5, -34), P(52.5, 34), P(-52.5, 34)].join(" ");
    const circle: string[] = [];
    for (let a = 0; a < 360; a += 15) circle.push(P(9.15 * Math.cos((a * Math.PI) / 180), 9.15 * Math.sin((a * Math.PI) / 180)));
    const lines = [
      [P(0, -34), P(0, 34)],
      [P(-52.5, -20.16), P(-36, -20.16), P(-36, 20.16), P(-52.5, 20.16)],
      [P(52.5, -20.16), P(36, -20.16), P(36, 20.16), P(52.5, 20.16)],
    ];
    const tier = level === "lower" ? "Lower tier" : "Upper tier";
    return { toCentre, toGoal, height, W, H, horizon, pitchPts, circle: circle.join(" "), lines, tier };
  }, [lastSeat, pitch]);

  if (blocks.length === 0) {
    return <div className="flex h-full items-center justify-center p-6 text-sm text-slate-500">This layout has no sections to show.</div>;
  }

  const sheet = (
    <div className="flex h-full min-h-0 flex-col">
      {!block ? (
        <div className="p-5 text-center text-slate-500">
          <Armchair className="mx-auto mb-2 size-8 text-slate-300" />
          <p className="text-base font-bold text-white">Choose a section</p>
          <p className="mt-1 text-sm">Tap a block on the map. Colours show the price category.</p>
          {selected.length > 0 ? (
            <p className="mt-4 rounded-xl bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-900">
              {selected.length} seat{selected.length === 1 ? "" : "s"} selected · {money(total)}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <button type="button" onClick={() => { setBlockId(null); setShowView(false); }} className="mb-1 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800">
                <ArrowLeft size={13} /> All sections
              </button>
              <p className="text-2xl font-extrabold text-white">{block.name}</p>
              <p className="text-sm text-slate-500">
                {info?.type} · <b className="text-white">{money(info?.price || 0)}</b> per seat · {info?.free} of {info?.total} free
              </p>
            </div>
            <button type="button" onClick={() => setBlockId(null)} aria-label="Close" className="cursor-pointer rounded-full p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden">
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
            <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-white/5 px-2 py-1.5">
                <p className="text-base font-extrabold text-white">{info?.free ?? 0}</p>
                <p className="text-slate-400">free</p>
              </div>
              <div className="rounded-lg bg-rose-950/60 px-2 py-1.5">
                <p className="text-base font-extrabold text-rose-300">{(info?.total ?? 0) - (info?.free ?? 0)}</p>
                <p className="text-rose-300/80">booked</p>
              </div>
              <div className="rounded-lg bg-orange-500/15 px-2 py-1.5">
                <p className="text-base font-extrabold text-orange-300">{selected.filter((x) => String(x.block_id) === block.id).length}</p>
                <p className="text-orange-300/80">yours</p>
              </div>
            </div>
            {selected.some((x) => String(x.block_id) === block.id) ? (
              <p className="mb-3 rounded-lg bg-orange-500/10 px-3 py-2 text-center text-xs font-semibold text-orange-200">
                Your seats here: {selected.filter((x) => String(x.block_id) === block.id).map((x) => `${x.row_label}${x.seat_label}`).join(", ")}
              </p>
            ) : null}
            <div className="space-y-1.5" data-seat-grid>
              {(() => {
                const maxCols = Math.max(1, ...rows.map((r) => r.seats.length));
                return rows.map((r) => (
                  <div key={r.label} className="flex items-center gap-1.5">
                    <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-400">{r.label}</span>
                    <div className="grid min-w-0 flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))` }}>
                      {r.seats.map((s) => {
                        const free = String(s.status || "AVAILABLE").toUpperCase() === "AVAILABLE";
                        const isSel = selected.some((x) => x.id === s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            data-yours={isSel ? "1" : undefined}
                            disabled={!free && !isSel}
                            onClick={() => toggle(s)}
                            title={`${block.name} · row ${r.label} · seat ${s.seat_label}`}
                            className={`flex aspect-square min-w-0 items-center justify-center rounded-md border text-[11px] font-semibold transition-colors ${
                              isSel
                                ? "cursor-pointer border-orange-400 bg-orange-500 text-white"
                                : free
                                  ? "cursor-pointer border-white/20 bg-white/10 text-slate-100 hover:border-white"
                                  : "cursor-not-allowed border-rose-500/50 bg-rose-950/60 text-rose-300"
                            }`}
                          >
                            {free || isSel ? s.seat_label : "×"}
                          </button>
                        );
                      })}
                    </div>
                    <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-400">{r.label}</span>
                  </div>
                ));
              })()}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="size-3.5 rounded border border-white/30 bg-white/10" /> Free</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-3.5 rounded bg-orange-500" /> Your seats</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-3.5 rounded bg-rose-950 border border-rose-500/60" /> Booked</span>
            </div>
          </div>
        </>
      )}

      {/* View from your seat */}
      {lastSeat && seatView ? (
        <div className="border-t border-white/10 bg-[#0b0f17] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold text-white">
                {lastSeat.section_name} · Row {lastSeat.row_label} · Seat {lastSeat.seat_label}
              </p>
              <p className="text-xs text-slate-500">{seatView.tier}</p>
            </div>
            <button type="button" onClick={() => setShowView((v) => !v)} className="shrink-0 cursor-pointer rounded-lg border border-[#6900AA]/40 bg-white px-3 py-1.5 text-xs font-bold text-[#6900AA] hover:bg-purple-50">
              {showView ? "Hide view" : "View from seat"}
            </button>
          </div>
          {showView ? (
            <Stadium3DView booked={seats.filter((x) => String(x.status || "AVAILABLE").toUpperCase() !== "AVAILABLE") as any} selected={selected as any} model={String(cfg.stadium_model || "football")} seats={seats as any} seat={lastSeat as any} className="mt-2 h-56 rounded-xl sm:h-64 lg:h-72" />
          ) : null}
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white/5 px-2 py-2">
              <p className="text-lg font-extrabold text-white">{seatView.toCentre} m</p>
              <p className="text-[10px] text-slate-500">to the centre spot</p>
            </div>
            <div className="rounded-lg bg-white/5 px-2 py-2">
              <p className="text-lg font-extrabold text-white">{seatView.toGoal} m</p>
              <p className="text-[10px] text-slate-500">to the nearest goal</p>
            </div>
            <div className="rounded-lg bg-white/5 px-2 py-2">
              <p className="text-lg font-extrabold text-white">{seatView.height} m</p>
              <p className="text-[10px] text-slate-500">above the pitch</p>
            </div>
          </div>
        </div>
      ) : null}

      {selected.length > 0 ? (
        <div className="border-t border-white/10 bg-[#111826] px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-300">{selected.length} of {maxSelectable} seats</span>
            <span className="text-lg font-extrabold text-white">{money(total)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[#0b0f17] text-slate-100 lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Price categories */}
        <div className="flex gap-2 overflow-x-auto border-b border-white/10 bg-[#111826] px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-bold sm:text-sm ${category === null ? "border-white bg-white text-slate-900" : "border-white/15 bg-white/5 text-slate-300"}`}
          >
            All sections
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(category === c.id ? null : c.id)}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold sm:text-sm ${category === c.id ? "border-white bg-white text-slate-900" : "border-white/15 bg-white/5 text-slate-200"}`}
            >
              <span className="size-2.5 rounded-full" style={{ background: c.color }} />
              {c.name} <span className={category === c.id ? "text-white/80" : "text-slate-400"}>{money(c.price)}</span>
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 p-2 sm:p-4">
          <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} className="h-full w-full" style={{ background: "#0b0f17" }} role="group" aria-label="Stadium sections">
            {ground ? <polygon points={poly(ground)} fill="#14532d" /> : null}
            {pitch ? <polygon points={poly(pitch)} fill="#1f7a3a" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2" /> : null}
            {blocks.map((b) => {
              const bi = blockInfo(b);
              const dim = category !== null && bi.ticketTypeId !== category;
              const isSel = blockId === b.id;
              const c = centroid(b);
              const soldOut = bi.total > 0 && bi.free === 0;
              const picked = selected.filter((x) => String(x.block_id) === b.id).length;
              const hasPick = picked > 0;
              return (
                <g
                  key={b.id}
                  onClick={() => {
                    if (!dim) setBlockId(b.id);
                  }}
                  className={dim ? "opacity-25" : "cursor-pointer"}
                >
                  <polygon
                    points={poly(b)}
                    fill={soldOut ? "#334155" : hasPick ? tierColor(b) : tierColor(b)}
                    fillOpacity={isSel ? 1 : 0.8}
                    stroke={isSel ? "#ffffff" : "#0b0f17"}
                    strokeWidth={isSel ? 5 : 3}
                  />
                  <text x={c.x} y={c.y} textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="800" fill="#ffffff" style={{ pointerEvents: "none" }}>
                    {b.name.replace(/^(Lower|Upper)\s*/i, (m) => (/lower/i.test(m) ? "L" : "U"))}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Side panel on large screens */}
      <aside className="hidden h-full w-[30rem] shrink-0 flex-col overflow-hidden border-l border-white/10 bg-[#111826] lg:flex" aria-label="Section and seats">
        {sheet}
      </aside>

      {/* Bottom sheet on phones and tablets */}
      <div
        className={`fixed inset-x-0 bottom-20 z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#111826] text-slate-100 shadow-[0_-12px_40px_rgba(0,0,0,0.6)] transition-transform duration-200 lg:hidden ${
          block || selected.length > 0 ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {sheet}
      </div>
    </div>
  );
}
