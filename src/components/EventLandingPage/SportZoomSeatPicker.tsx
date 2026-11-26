"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Minus, Plus, Maximize2, Users, Box } from "lucide-react";
import { arcPoint, blockOutline, blockSeatPoint, rectOutline, rowLabelOf, type SportConfig, type SportObject } from "@/lib/sportZoom";

const Stadium3DView = dynamic(() => import("@/components/EventLandingPage/StadiumModelView"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-[#0b1224] text-sm text-slate-400">Loading 3D view…</div>,
});

/**
 * Customer seat picker for the "sport_zoom" layout: one flat stadium map (light theme, one colour for every stand).
 * Tap a stand to zoom into it, pick seats (row letters at both ends of every row) or choose a quantity for a standing zone.
 */

type Seat = {
  id: string;
  ticket_type_id?: string | null;
  section_name?: string;
  row_label?: string;
  seat_label?: string;
  status?: string;
  block_id?: string | null;
};

type VB = { x: number; y: number; w: number; h: number };

const C = {
  bg: "#f1f5f9",
  ground: "#eef6ee",
  groundLine: "#b7d8b9",
  pitch: "#d9ecd9",
  pitchLine: "#6fa874",
  block: "#eef1f6",
  blockLine: "#94a3b8",
  blockText: "#334155",
  // seat colours: the same as the Addis Soul Night / movie seat maps
  seat: "#ffffff",
  seatLine: "#4B5563",
  seatText: "#334155",
  booked: "#ffffff",
  bookedLine: "#E0E0E0",
  bookedText: "#cbd5e1",
  picked: "#7B61FF",
  pickedLine: "#7B61FF",
  sold: "#e5e7eb",
  soldLine: "#cbd5e1",
  accent: "#7B61FF",
};

/** the picked stand grows a little so its seats have room */
const POP = 1.28;

/** distance between neighbouring seats along a row and from row to row, in map units */
function seatSteps(o: SportObject): { along: number; across: number } {
  const rows = o.rows || 0;
  const per = o.seats_per_row || 0;
  const a = blockSeatPoint(o, 0, 0);
  const b = blockSeatPoint(o, 0, Math.min(1, per - 1));
  const c = blockSeatPoint(o, Math.min(1, rows - 1), 0);
  return { along: Math.hypot(a.x - b.x, a.y - b.y) || 6, across: Math.hypot(a.x - c.x, a.y - c.y) || 6 };
}
const seatStep = (o: SportObject) => {
  const st = seatSteps(o);
  return Math.min(st.along, st.across);
};

/**
 * A stand with many thin rows (30 rows squeezed into a narrow curved stand) is drawn deeper once it is opened,
 * so every row gets room for its letter and its seats. Only the opened stand changes; the full map stays as drawn.
 */
function expandedOf(o: SportObject): SportObject {
  if (o.type !== "block") return o;
  const st = seatSteps(o);
  const ex = Math.min(3.2, Math.max(1, st.along / st.across));
  if (ex < 1.15) return o;
  const e: SportObject = o.arc ? { ...o, arc: { ...o.arc, r1: o.arc.r0 + (o.arc.r1 - o.arc.r0) * ex } } : { ...o, h: o.h * ex };
  const pts = blockOutline(e).split(" ").map((q) => q.split(",").map(Number));
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { ...e, x: (x0 + x1) / 2, y: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

/** the opened stand grows so its seats stay readable, the more rows and seats it has the more it grows */
const popOf = (o: SportObject) => Math.min(2.6, Math.max(POP, 5 / seatStep(o)));

const money = (n: number) => `${Math.round(n).toLocaleString()} ETB`;
const isFree = (s: Seat) => String(s.status || "AVAILABLE").toUpperCase() === "AVAILABLE";

/** Local demo seats for the admin preview (no database) */
export function demoSeats(cfg: SportConfig): Seat[] {
  const out: Seat[] = [];
  let n = 0;
  cfg.objects.forEach((o) => {
    if (o.type === "block") {
      for (let r = 0; r < (o.rows || 0); r++)
        for (let s = 0; s < (o.seats_per_row || 0); s++) {
          n++;
          out.push({ id: `demo_${n}`, block_id: o.id, section_name: o.name, row_label: rowLabelOf(o, r), seat_label: String(s + 1), status: (r * 7 + s * 3) % 11 === 0 ? "BOOKED" : "AVAILABLE", ticket_type_id: o.category_id });
        }
    } else if (o.type === "standing") {
      for (let s = 0; s < (o.capacity || 0); s++) {
        n++;
        out.push({ id: `demo_${n}`, block_id: o.id, section_name: o.name, row_label: "GA", seat_label: String(s + 1), status: s < (o.capacity || 0) * 0.1 ? "BOOKED" : "AVAILABLE", ticket_type_id: o.category_id });
      }
    }
  });
  return out;
}

export default function SportZoomSeatPicker({
  layoutData,
  config: configProp,
  seats: seatsProp,
  onSeatsSelected,
  initialSelectedSeats = [],
  maxSelectable = 10,
}: {
  layoutData?: any;
  /** Admin preview: use this layout instead of the saved one */
  config?: SportConfig;
  seats?: Seat[];
  ticketTypes?: any[];
  onSeatsSelected: (seats: any[]) => void;
  initialSelectedSeats?: any[];
  maxSelectable?: number;
  onContinue?: () => void;
}) {
  const data = layoutData?.data ?? layoutData ?? {};
  const cfg: SportConfig | null = configProp || (data.seating_config?.layout_mode === "sport_zoom" ? data.seating_config : null);
  const seats: Seat[] = useMemo(() => seatsProp || (Array.isArray(data.seats) ? data.seats : cfg ? demoSeats(cfg) : []), [seatsProp, data.seats, cfg]);

  const canvas = cfg?.canvas || { w: 1600, h: 1100 };

  /** the stadium itself, with a margin: where "show everything" and the first view point */
  const home: VB = useMemo(() => {
    const os = cfg?.objects || [];
    if (!os.length) return { x: 0, y: 0, w: canvas.w, h: canvas.h };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    os.forEach((o) => {
      const half = o.rotation ? Math.hypot(o.w, o.h) / 2 : 0;
      const hw = o.rotation ? half : o.w / 2;
      const hh = o.rotation ? half : o.h / 2;
      x0 = Math.min(x0, o.x - hw); x1 = Math.max(x1, o.x + hw);
      y0 = Math.min(y0, o.y - hh); y1 = Math.max(y1, o.y + hh);
    });
    const pad = Math.max(x1 - x0, y1 - y0) * 0.04;
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  }, [cfg, canvas.w, canvas.h]);

  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 480 });
  const [measured, setMeasured] = useState(false);
  const [vb, setVb] = useState<VB>(home);
  const vbRef = useRef<VB>(home);
  vbRef.current = vb;
  const animRef = useRef<number | null>(null); // timed move (tap a stand)
  const glideRef = useRef<number | null>(null); // smooth zoom (wheel, + / −)
  const targetRef = useRef<VB | null>(null);

  const [selected, setSelected] = useState<Seat[]>(() => seats.filter((s) => initialSelectedSeats.some((i: any) => String(i.id || i.seat_identifier) === String(s.id))));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [liveOpen, setLiveOpen] = useState(false);

  // measure the map box
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth < 50 || el.clientHeight < 50) return;
      setSize({ w: el.clientWidth, h: el.clientHeight });
      setMeasured(true);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** viewBox with the same aspect as the box, centred on the wanted rectangle */
  const fitBox = useCallback(
    (r: VB): VB => {
      const aspect = size.w / size.h;
      let w = r.w;
      let h = r.h;
      if (w / h < aspect) w = h * aspect;
      else h = w / aspect;
      return { x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2, w, h };
    },
    [size.w, size.h]
  );

  const homeFit = useMemo(() => fitBox(home), [fitBox, home]);

  const stopMotion = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (glideRef.current) cancelAnimationFrame(glideRef.current);
    animRef.current = null;
    glideRef.current = null;
    targetRef.current = null;
  }, []);

  /** keep the zoom between "a few seats fill the screen" and "a bit more than the whole stadium", and the stadium on screen */
  const clampVb = useCallback(
    (r: VB): VB => {
      const minW = Math.max(24, homeFit.w / 70);
      const maxW = homeFit.w * 1.4;
      const w = Math.min(maxW, Math.max(minW, r.w));
      const h = w * (size.h / size.w);
      const cx = Math.min(home.x + home.w * 1.05, Math.max(home.x - home.w * 0.05, r.x + r.w / 2));
      const cy = Math.min(home.y + home.h * 1.05, Math.max(home.y - home.h * 0.05, r.y + r.h / 2));
      return { x: cx - w / 2, y: cy - h / 2, w, h };
    },
    [homeFit.w, home, size.w, size.h]
  );

  const animateTo = useCallback(
    (target: VB, ms = 520) => {
      stopMotion();
      const from = vbRef.current;
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        const v = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e };
        vbRef.current = v;
        setVb(v);
        animRef.current = k < 1 ? requestAnimationFrame(step) : null;
      };
      animRef.current = requestAnimationFrame(step);
    },
    [stopMotion]
  );

  /** ease the view towards targetRef (used by wheel and the + / − buttons, so repeated steps feel continuous) */
  const glide = useCallback(() => {
    if (glideRef.current) return;
    const tick = () => {
      const t = targetRef.current;
      if (!t) {
        glideRef.current = null;
        return;
      }
      const v = vbRef.current;
      const k = 0.22;
      const close = Math.abs(t.w - v.w) < t.w * 0.002 && Math.abs(t.x - v.x) < t.w * 0.002 && Math.abs(t.y - v.y) < t.w * 0.002;
      const n = close ? t : { x: v.x + (t.x - v.x) * k, y: v.y + (t.y - v.y) * k, w: v.w + (t.w - v.w) * k, h: v.h + (t.h - v.h) * k };
      vbRef.current = n;
      setVb(n);
      if (close) {
        targetRef.current = null;
        glideRef.current = null;
      } else glideRef.current = requestAnimationFrame(tick);
    };
    glideRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => () => stopMotion(), [stopMotion]);

  // first view once the box is measured
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && measured) {
      fitted.current = true;
      const v = fitBox(home);
      vbRef.current = v;
      setVb(v);
    }
  }, [measured, fitBox, home]);

  const reset = () => {
    setActiveId(null);
    animateTo(fitBox(home));
  };

  const scale = size.w / vb.w; // screen px per map unit

  /** zoom by `factor` keeping the map point under (fx, fy) (fractions of the box) where it is */
  const zoomBy = (factor: number, fx: number, fy: number, instant = false) => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    const base = targetRef.current || vbRef.current;
    const ax = base.x + base.w * fx;
    const ay = base.y + base.h * fy;
    const nw = base.w / factor;
    const nh = nw * (size.h / size.w);
    const next = clampVb({ x: ax - nw * fx, y: ay - nh * fy, w: nw, h: nh });
    if (instant) {
      targetRef.current = null;
      vbRef.current = next;
      setVb(next);
    } else {
      targetRef.current = next;
      glide();
    }
  };

  // wheel / trackpad zoom around the cursor
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = Math.exp(-Math.max(-120, Math.min(120, dy)) * 0.0022);
      zoomBy(factor, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h, clampVb]);

  // drag to move, pinch to zoom, tap to pick
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: false, startX: 0, startY: 0, pinch: 0 });
  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) gesture.current = { moved: false, startX: e.clientX, startY: e.clientY, pinch: 0 };
    if (pointers.current.size === 2) {
      stopMotion();
      const [a, b] = Array.from(pointers.current.values());
      gesture.current.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      gesture.current.moved = true;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId);
    const el = boxRef.current;
    if (!p || !el) return;
    const rect = el.getBoundingClientRect();
    if (pointers.current.size === 2) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = Array.from(pointers.current.values());
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.current.pinch > 0 && d > 0) zoomBy(d / gesture.current.pinch, ((a.x + b.x) / 2 - rect.left) / rect.width, ((a.y + b.y) / 2 - rect.top) / rect.height, true);
      gesture.current.pinch = d;
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!gesture.current.moved && Math.hypot(e.clientX - gesture.current.startX, e.clientY - gesture.current.startY) > 6) {
      gesture.current.moved = true;
      stopMotion();
    }
    if (gesture.current.moved) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const v = vbRef.current;
      const n = clampVb({ x: v.x - (dx / rect.width) * v.w, y: v.y - (dy / rect.height) * v.h, w: v.w, h: v.h });
      vbRef.current = n;
      setVb(n);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const wasTap = !gesture.current.moved && pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current.pinch = 0;
    if (!wasTap) return;
    const hit = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest("[data-hit]") as HTMLElement | null;
    if (!hit) return;
    const kind = hit.dataset.hit;
    const id = hit.dataset.id || "";
    if (kind === "seat") {
      const seat = seatById.get(id);
      if (seat) toggleSeat(seat);
    } else if (kind === "block" || kind === "standing") focusObject(id);
  };
  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
  };

  const objects = cfg?.objects || [];
  const categories = cfg?.categories || [];
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const objById = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects]);
  const shown = useMemo(() => new Map(objects.map((o) => [o.id, expandedOf(o)])), [objects]);

  const seatById = useMemo(() => new Map(seats.map((s) => [String(s.id), s])), [seats]);
  const seatsByBlock = useMemo(() => {
    const m = new Map<string, Map<string, Seat>>();
    seats.forEach((s) => {
      const k = String(s.block_id || "");
      if (!k) return;
      let g = m.get(k);
      if (!g) m.set(k, (g = new Map()));
      g.set(`${s.row_label}|${s.seat_label}`, s);
    });
    return m;
  }, [seats]);
  const freeByBlock = useMemo(() => {
    const m = new Map<string, number>();
    seats.forEach((s) => {
      if (isFree(s)) m.set(String(s.block_id), (m.get(String(s.block_id)) || 0) + 1);
    });
    return m;
  }, [seats]);
  const totalByBlock = useMemo(() => {
    const m = new Map<string, number>();
    seats.forEach((s) => m.set(String(s.block_id), (m.get(String(s.block_id)) || 0) + 1));
    return m;
  }, [seats]);

  const selectedIds = useMemo(() => new Set(selected.map((s) => String(s.id))), [selected]);

  // follow the page when it clears or changes the seats (Clear all, Change seats …)
  const parentKey = initialSelectedSeats.map((i: any) => String(i.id || i.seat_identifier)).sort().join("|");
  useEffect(() => {
    const mine = selected.map((s) => String(s.id)).sort().join("|");
    if (mine === parentKey) return;
    const ids = new Set(parentKey ? parentKey.split("|") : []);
    setSelected(seats.filter((s) => ids.has(String(s.id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentKey]);

  const lastSeat = selected[selected.length - 1] || null;
  useEffect(() => {
    if (!selected.length) setLiveOpen(false);
  }, [selected.length]);

  const commit = (next: Seat[]) => {
    setSelected(next);
    onSeatsSelected(next);
  };

  /** `k` free seats side by side in one row that include `seat` (as many as fit if the row is broken up) */
  const runFor = (seat: Seat, k: number, taken: Set<string>): Seat[] => {
    const g = seatsByBlock.get(String(seat.block_id));
    const o = objById.get(String(seat.block_id));
    if (!g || !o || o.type !== "block") return [seat];
    const row = String(seat.row_label);
    const n = Number(seat.seat_label);
    const per = o.seats_per_row || 0;
    const at = (num: number) => g.get(`${row}|${num}`);
    const ok = (num: number) => {
      const t = at(num);
      return !!t && isFree(t) && !taken.has(String(t.id));
    };
    const take = (from: number, to: number) => {
      const out: Seat[] = [];
      for (let i = from; i <= to; i++) out.push(at(i) as Seat);
      return out;
    };
    for (let start = n; start >= Math.max(1, n - k + 1); start--) {
      const end = start + k - 1;
      if (end > per) continue;
      let all = true;
      for (let i = start; i <= end; i++) if (!ok(i)) { all = false; break; }
      if (all) return take(start, end);
    }
    let a = n;
    let b = n;
    while (ok(a - 1)) a--;
    while (ok(b + 1)) b++;
    const from = Math.max(a, Math.min(n, b - k + 1));
    return take(from, Math.min(b, from + k - 1));
  };

  const toggleSeat = (seat: Seat) => {
    const id = String(seat.id);
    if (selectedIds.has(id)) {
      setNote("");
      return commit(selected.filter((x) => String(x.id) !== id));
    }
    if (!isFree(seat)) return;
    const want = Math.max(1, maxSelectable || 1);
    const sameBlock = selected.length > 0 && selected.every((x) => String(x.block_id) === String(seat.block_id));
    // another stand, or a full set already: start again so the new seats replace the old ones
    const fresh = !sameBlock || selected.length >= want;
    const base = fresh ? [] : selected;
    const need = want - base.length;
    const run = runFor(seat, need, new Set(base.map((x) => String(x.id))));
    setNote(run.length < need ? `Only ${run.length} seat${run.length === 1 ? "" : "s"} side by side here — tap another row for the rest.` : "");
    commit([...base, ...run]);
  };

  const focusObject = (id: string) => {
    const base = objById.get(id);
    if (!base) return;
    const o = shown.get(id) || base;
    setActiveId(id);
    if (o.type === "block") {
      const pop = o !== base ? 1.06 : popOf(o);
      // the whole stand in view, wide or tall
      const whole = Math.max(o.w, o.h * (size.w / size.h)) * pop * (size.w < 600 ? 0.72 : 1.04);
      // never zoom out so far that the row letters or seats get cramped: a very big stand is panned instead
      const st = seatSteps(o);
      const readable = size.w * Math.min(st.across / 14, st.along / 10) * (1 / pop) * pop;
      const reach = Math.max(Math.min(whole, readable), Math.max(24, homeFit.w / 70));
      animateTo(fitBox({ x: o.x - reach / 2, y: o.y - (reach * (size.h / size.w)) / 2, w: reach, h: reach * (size.h / size.w) }));
    } else animateTo(fitBox({ x: base.x - base.w * 0.75, y: base.y - base.h * 1.6, w: base.w * 1.5, h: base.h * 3.2 }));
  };

  // standing zones: a quantity, not a seat
  const zoneSelected = (zoneId: string) => selected.filter((s) => String(s.block_id) === zoneId);
  const zoneAdd = (zoneId: string) => {
    const base = selected.filter((x) => String(x.block_id) === zoneId); // picking here replaces seats chosen elsewhere
    if (maxSelectable && base.length >= maxSelectable) return setNote(`You can pick up to ${maxSelectable} tickets.`);
    const g = seatsByBlock.get(zoneId);
    if (!g) return;
    const next = Array.from(g.values())
      .filter((x) => isFree(x) && !base.some((y) => String(y.id) === String(x.id)))
      .sort((x, y) => Number(x.seat_label) - Number(y.seat_label))[0];
    if (!next) return setNote("No more standing places left in this zone.");
    setNote("");
    commit([...base, next]);
  };
  const zoneRemove = (zoneId: string) => {
    const mine = zoneSelected(zoneId);
    if (!mine.length) return;
    const last = mine[mine.length - 1];
    commit(selected.filter((s) => String(s.id) !== String(last.id)));
  };

  const priceOfSeat = (s: Seat) => {
    const o = objById.get(String(s.block_id));
    const c = o?.category_id ? catById.get(o.category_id) : null;
    if (c) return c.price;
    const t = (data.ticket_types || []).find((x: any) => String(x.id) === String(s.ticket_type_id));
    return Number(t?.price) || 0;
  };
  const total = selected.reduce((a, s) => a + priceOfSeat(s), 0);
  const freeInCategory = (catId: string) => objects.filter((o) => o.category_id === catId).reduce((a, o) => a + (freeByBlock.get(o.id) || 0), 0);

  const summary = useMemo(() => {
    const m = new Map<string, { title: string; count: number; seats: string[]; standing: boolean; price: number }>();
    selected.forEach((s) => {
      const o = objById.get(String(s.block_id));
      const standing = o?.type === "standing";
      const key = standing ? `z:${s.block_id}` : `b:${s.block_id}:${s.row_label}`;
      const cur = m.get(key) || { title: standing ? String(o?.name) : `${o?.name || s.section_name} · Row ${s.row_label}`, count: 0, seats: [], standing, price: 0 };
      cur.count += 1;
      cur.seats.push(String(s.seat_label));
      cur.price += priceOfSeat(s);
      m.set(key, cur);
    });
    return Array.from(m.values()).map((l) => ({ title: l.title, text: l.standing ? `${l.count} ticket${l.count === 1 ? "" : "s"}` : `Seat ${l.seats.join(", ")}`, price: l.price }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, objById]);

  if (!cfg) return <div className="flex h-full items-center justify-center bg-white p-6 text-sm text-slate-500">This layout is not ready yet.</div>;

  const active = activeId ? objById.get(activeId) || null : null;
  const activeBlockId = active && active.type === "block" ? active.id : null;
  const viewBox = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

  const renderBlock = (orig: SportObject) => {
    const picked = activeId === orig.id;
    const o = picked ? shown.get(orig.id) || orig : orig; // the opened stand is drawn deeper when it has very many rows
    const free = freeByBlock.get(o.id) || 0;
    const sold = (totalByBlock.get(o.id) || 0) > 0 && free === 0;
    const dim = (category !== null && o.category_id !== category) || (activeBlockId !== null && !picked);
    const pop = o !== orig ? 1.06 : popOf(o);
    const showSeats = picked && Math.max(o.w, o.h) * pop * scale > 140;
    const rows = o.rows || 0;
    const per = o.seats_per_row || 0;
    const p00 = blockSeatPoint(o, 0, 0);
    const p01 = blockSeatPoint(o, 0, Math.min(1, per - 1));
    const p10 = blockSeatPoint(o, Math.min(1, rows - 1), 0);
    const along = Math.hypot(p00.x - p01.x, p00.y - p01.y) || 6;
    const across = Math.hypot(p00.x - p10.x, p00.y - p10.y) || 6;
    const step = Math.min(along, across);
    const r = Math.max(1, step * 0.36);
    const g = seatsByBlock.get(o.id);
    const showNum = r * pop * scale >= 5.5;
    // name sits in the middle of the stand and is sized to fit inside it
    const mid = o.arc ? arcPoint(o.arc, (o.arc.r0 + o.arc.r1) / 2, (o.arc.a0 + o.arc.a1) / 2) : { x: o.x, y: o.y };
    const avail = o.arc ? ((o.arc.r1 - o.arc.r0) * (Math.abs((o.arc.a0 + o.arc.a1) / 2) < 35 ? 0.9 : 1.5)) : o.w * 0.9;
    const titleSize = Math.max(9, Math.min(22, avail / (Math.max(4, o.name.length) * 0.58), Math.min(o.w, o.h) * 0.3));
    return (
      <g key={o.id} opacity={dim ? 0.3 : 1} transform={picked ? `translate(${o.x} ${o.y}) scale(${pop}) translate(${-o.x} ${-o.y})` : undefined}>
        <polygon
          points={blockOutline(o)}
          fill={sold ? C.sold : picked ? "#ffffff" : C.block}
          fillOpacity={1}
          stroke={picked ? C.accent : sold ? C.soldLine : C.blockLine}
          strokeWidth={picked ? 1.2 : 1.6}
          strokeLinejoin="round"
          data-hit={showSeats ? undefined : "block"}
          data-id={o.id}
          style={{ cursor: "pointer" }}
        />
        {!showSeats ? (
          <g pointerEvents="none" textAnchor="middle" fill={sold ? "#64748b" : C.blockText}>
            <text x={mid.x} y={mid.y} dominantBaseline="central" fontSize={titleSize} fontWeight={800}>{o.name}</text>
            {sold ? <text x={mid.x} y={mid.y + titleSize * 0.95} fontSize={titleSize * 0.6} opacity={0.85}>Sold out</text> : null}
          </g>
        ) : (
          <g>
            {Array.from({ length: rows }, (_, ri) => {
              const label = rowLabelOf(o, ri);
              // row letters appear only once the map is zoomed in far enough to read them (about 11 px between rows)
              const gapPx = across * pop * scale;
              if (gapPx < 11) return null;
              const a = blockSeatPoint(o, ri, 0);
              const b = blockSeatPoint(o, ri, Math.max(0, per - 1));
              const a1 = blockSeatPoint(o, ri, Math.min(1, per - 1));
              const b1 = blockSeatPoint(o, ri, Math.max(0, per - 2));
              const da = Math.hypot(a.x - a1.x, a.y - a1.y) || 1;
              const db = Math.hypot(b.x - b1.x, b.y - b1.y) || 1;
              // letters keep a steady size on screen (about 11 px), but never wider than the space between two rows
              const unit = 1 / (pop * scale);
              const fs = Math.min(11, Math.max(5, (gapPx * 0.9) / Math.max(1, label.length * 0.62))) * unit;
              const off = along * 0.9 + fs * 0.6 * Math.max(1, label.length);
              return (
                <g key={ri} pointerEvents="none" fill={C.blockText} fontSize={fs} fontWeight={800} textAnchor="middle" dominantBaseline="central">
                  <text x={a.x + ((a.x - a1.x) / da) * off} y={a.y + ((a.y - a1.y) / da) * off}>{label}</text>
                  <text x={b.x + ((b.x - b1.x) / db) * off} y={b.y + ((b.y - b1.y) / db) * off}>{label}</text>
                </g>
              );
            })}
            {Array.from({ length: rows }, (_, ri) =>
              Array.from({ length: per }, (_, si) => {
                const seat = g?.get(`${rowLabelOf(o, ri)}|${si + 1}`);
                if (!seat) return null;
                const p = blockSeatPoint(o, ri, si);
                const picked = selectedIds.has(String(seat.id));
                const open = isFree(seat);
                return (
                  <g key={`${ri}-${si}`}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={r}
                      fill={picked ? C.picked : open ? C.seat : C.booked}
                      stroke={picked ? C.pickedLine : open ? C.seatLine : C.bookedLine}
                      strokeWidth={Math.max(0.35, r * 0.16)}
                    />
                    {showNum ? (
                      <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={r * 0.95} fontWeight={700} fill={picked ? "#fff" : open ? C.seatText : C.bookedText} pointerEvents="none">
                        {open || picked ? seat.seat_label : "×"}
                      </text>
                    ) : null}
                    {/* generous invisible tap target */}
                    <circle cx={p.x} cy={p.y} r={Math.max(r * 1.05, Math.min(9 / (scale * pop), step * 0.5))} fill="transparent" data-hit="seat" data-id={seat.id} style={{ cursor: open || picked ? "pointer" : "not-allowed" }} />
                  </g>
                );
              })
            )}
          </g>
        )}
      </g>
    );
  };

  const chipCls = (on: boolean, empty: boolean) =>
    `inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold sm:text-sm ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"} ${empty ? "opacity-60" : ""}`;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-white text-slate-900 lg:flex-row">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* price categories */}
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button type="button" onClick={() => setCategory(null)} className={chipCls(category === null, false)}>All sections</button>
          {categories.map((c) => {
            const left = freeInCategory(c.id);
            return (
              <button key={c.id} type="button" onClick={() => setCategory(category === c.id ? null : c.id)} className={chipCls(category === c.id, left === 0)}>
                {c.name} <span className={category === c.id ? "text-white/80" : "text-slate-500"}>{left === 0 ? "Sold out" : money(c.price)}</span>
              </button>
            );
          })}
        </div>

        {/* map */}
        <div
          ref={boxRef}
          className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
          style={{ touchAction: "none", background: C.bg }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="block">
            {objects.filter((o) => o.type === "ground").map((o) => (
              <polygon key={o.id} points={rectOutline(o)} fill={C.ground} stroke={C.groundLine} strokeWidth={2} pointerEvents="none" />
            ))}
            {objects.filter((o) => o.type === "pitch").map((o) => (
              <g key={o.id} pointerEvents="none">
                <polygon points={rectOutline(o)} fill={C.pitch} stroke={C.pitchLine} strokeWidth={2.5} />
                <line x1={o.x} y1={o.y - o.h / 2} x2={o.x} y2={o.y + o.h / 2} stroke={C.pitchLine} strokeWidth={1.6} opacity={0.6} />
                {o.w / o.h > 0.4 && o.w / o.h < 2.5 ? <circle cx={o.x} cy={o.y} r={Math.min(o.w, o.h) * 0.16} fill="none" stroke={C.pitchLine} strokeWidth={1.6} opacity={0.6} /> : null}
                <text x={o.x} y={o.y} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(o.h * 0.11, 26)} fontWeight={800} fill={C.pitchLine} opacity={0.7}>{o.name}</text>
              </g>
            ))}
            {objects.filter((o) => o.type === "stage").map((o) => (
              <g key={o.id} pointerEvents="none">
                <polygon points={rectOutline(o)} fill="#cbd5e1" stroke="#64748b" strokeWidth={2} />
                <text x={o.x} y={o.y} textAnchor="middle" dominantBaseline="central" fontSize={22} fontWeight={800} fill="#334155" letterSpacing={4}>{o.name}</text>
              </g>
            ))}
            {objects.filter((o) => o.type === "standing").map((o) => {
              const free = freeByBlock.get(o.id) || 0;
              const picked = zoneSelected(o.id).length;
              const dim = category !== null && o.category_id !== category;
              const fs = Math.max(13, Math.min(o.h * 0.3, 26));
              return (
                <g key={o.id} opacity={dim ? 0.3 : 1}>
                  <polygon points={rectOutline(o)} fill={free === 0 ? C.sold : C.block} stroke={activeId === o.id || picked ? C.accent : C.blockLine} strokeWidth={activeId === o.id || picked ? 3 : 1.6} strokeDasharray="8 5" data-hit="standing" data-id={o.id} style={{ cursor: "pointer" }} />
                  <g pointerEvents="none" textAnchor="middle" fill={free === 0 ? "#64748b" : C.blockText}>
                    <text x={o.x} y={o.y - 2} fontSize={fs} fontWeight={800}>{o.name}</text>
                    <text x={o.x} y={o.y + fs * 0.95} fontSize={fs * 0.66} opacity={0.85}>{free === 0 ? "Sold out" : "Standing"}{picked ? ` · ${picked} yours` : ""}</text>
                  </g>
                </g>
              );
            })}
            {objects.filter((o) => o.type === "block" && o.id !== activeId).map(renderBlock)}
            {objects.filter((o) => o.type === "block" && o.id === activeId).map(renderBlock)}
          </svg>

          {/* zoom buttons */}
          <div className="pointer-events-auto absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.6, 0.5, 0.5)} className="flex size-10 cursor-pointer items-center justify-center text-slate-700 hover:bg-slate-100"><Plus className="size-4" /></button>
            <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.6, 0.5, 0.5)} className="flex size-10 cursor-pointer items-center justify-center border-t border-slate-200 text-slate-700 hover:bg-slate-100"><Minus className="size-4" /></button>
            <button type="button" aria-label="Show the whole stadium" onClick={reset} className="flex size-10 cursor-pointer items-center justify-center border-t border-slate-200 text-slate-700 hover:bg-slate-100"><Maximize2 className="size-4" /></button>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] text-slate-600 shadow-sm">
            <span className="flex items-center gap-1"><i className="size-3 rounded-full border-[1.5px] border-[#4B5563] bg-white" /> Available</span>
            <span className="flex items-center gap-1"><i className="size-3 rounded-full bg-[#7B61FF]" /> Selected</span>
            <span className="flex items-center gap-1"><i className="size-3 rounded-full border-[1.5px] border-[#E0E0E0] bg-white" /> Unavailable</span>
          </div>
          <p className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1 text-[11px] text-slate-600 shadow-sm">
            {active ? `${active.name} — drag to move, pinch or + / − to zoom` : "Tap a stand to see its seats"}
          </p>
        </div>
      </div>

      {/* panel: zone quantity, chosen seats, total */}
      <aside className="flex max-h-[38%] w-full shrink-0 flex-col overflow-y-auto border-t border-slate-200 bg-white lg:max-h-none lg:w-80 lg:border-l lg:border-t-0">
        {active && active.type === "standing" ? (
          <div className={`border-b border-slate-200 p-4 ${selected.length > 0 ? "hidden lg:block" : ""}`}>
            <p className="text-lg font-extrabold">{active.name}</p>
            <p className="text-xs text-slate-500">Standing · {money(catById.get(active.category_id || "")?.price || 0)} per ticket · {freeByBlock.get(active.id) || 0} left</p>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-sm text-slate-600"><Users className="size-4" /> Tickets</span>
              <div className="flex items-center gap-3">
                <button type="button" aria-label="Fewer tickets" onClick={() => zoneRemove(active.id)} disabled={!zoneSelected(active.id).length} className="flex size-9 cursor-pointer items-center justify-center rounded-lg bg-white text-slate-800 shadow-sm disabled:opacity-40"><Minus className="size-4" /></button>
                <span className="w-6 text-center text-lg font-extrabold">{zoneSelected(active.id).length}</span>
                <button type="button" aria-label="More tickets" onClick={() => zoneAdd(active.id)} className="flex size-9 cursor-pointer items-center justify-center rounded-lg bg-[#6900AA] text-white"><Plus className="size-4" /></button>
              </div>
            </div>
          </div>
        ) : active && active.type === "block" ? (
          <div className={`border-b border-slate-200 p-4 ${selected.length > 0 ? "hidden lg:block" : ""}`}>
            <p className="text-lg font-extrabold">{active.name}</p>
            <p className="text-xs text-slate-500">
              {catById.get(active.category_id || "")?.name} · <b className="text-slate-900">{money(catById.get(active.category_id || "")?.price || 0)}</b> per seat · {freeByBlock.get(active.id) || 0} of {totalByBlock.get(active.id) || 0} available
            </p>
            <p className="mt-2 text-[11px] text-slate-400">Zoom in on the map and tap a seat to pick it.</p>
          </div>
        ) : (
          <div className="border-b border-slate-200 p-4 text-center text-sm text-slate-500">
            <p className="font-bold text-slate-900">Choose a section</p>
            <p className="mt-1 text-xs">Tap a stand or standing zone on the map.</p>
          </div>
        )}

        {selected.length > 0 ? (
          <div className="px-4 pt-3">
            <button type="button" onClick={() => setLiveOpen(true)} className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#6900AA] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#55008a]">
              <Box className="size-4" /> Live stadium view
            </button>
          </div>
        ) : null}

        {note ? <p className="mx-4 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{note}</p> : null}

        <div className="flex-1 p-4">
          {summary.length ? (
            <ul className="space-y-2 text-sm">
              {summary.map((l, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-lg bg-slate-100 px-3 py-2">
                  <span className="min-w-0"><b className="block truncate text-slate-900">{l.title}</b><span className="text-xs text-slate-500">{l.text}</span></span>
                  <span className="shrink-0 text-sm font-bold text-slate-900">{money(l.price)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-xs text-slate-400">No seats chosen yet.</p>
          )}
        </div>

        <div className="hidden items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 lg:flex">
          <span className="text-sm text-slate-600">{selected.length} of {maxSelectable} {selected.length === 1 ? "ticket" : "tickets"}</span>
          <span className="text-lg font-extrabold text-slate-900">{money(total)}</span>
        </div>
      </aside>

      {liveOpen && lastSeat ? (
        <div className="fixed inset-x-0 top-0 z-[200] flex h-[100dvh] flex-col bg-black">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b0f17] px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold sm:text-base">Live stadium view</p>
              <p className="truncate text-[11px] text-slate-400">{lastSeat.section_name} · Row {lastSeat.row_label} · Seat {lastSeat.seat_label} — drag to look around</p>
            </div>
            <button type="button" onClick={() => setLiveOpen(false)} className="shrink-0 cursor-pointer rounded-lg border border-white/30 px-4 py-1.5 text-sm font-bold hover:bg-white/10">Close</button>
          </div>
          <div className="relative min-h-0 flex-1">
            <Stadium3DView booked={seats.filter((x) => !isFree(x)) as any} selected={selected as any} model={String((cfg as any).stadium_model || "football")} seats={seats as any} seat={lastSeat as any} className="h-full w-full" />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-[#0b0f17] px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="text-xs text-slate-400">{selected.length} of {maxSelectable} seats selected</p>
              <p className="text-xl font-extrabold">{money(total)}</p>
            </div>
            <button type="button" onClick={() => setLiveOpen(false)} className="shrink-0 cursor-pointer rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900">Back to the map</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
