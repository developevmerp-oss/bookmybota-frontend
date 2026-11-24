"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Read-only "classic" seat map for the admin panels: the same look as the customer's classic view.
 * Seats sit where they really are on the saved layout, grouped under their seat type, with row letters
 * on both sides. Pass seatMarker to colour or click seats (damaged seats, picked seats).
 */

type SeatLike = {
  coordinate_x?: number;
  coordinate_y?: number;
  color?: string | null;
  section_name?: string | null;
  status?: string | null;
  row_label?: string | null;
  seat_label?: string | null;
};

export type ClassicSeatMarker = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  title?: string;
  cursor?: string;
  onClick?: () => void;
};

const SEAT = 34;
const PITCH = 44;
const LABEL_COL = 28;
const LABEL_GAP = 14;

function asSeats(value: unknown): SeatLike[] {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as SeatLike[]) : [];
}

/** True when seats sit in straight horizontal rows (auditorium / cinema). Fan or curved layouts return false. */
export function isStraightRowLayout(value: unknown): boolean {
  const list = asSeats(value);
  if (list.length === 0) return false;
  const groups = new Map<string, number[]>();
  list.forEach((s) => {
    const k = `${String(s.section_name || "")}|${String(s.row_label || "")}`;
    groups.set(k, [...(groups.get(k) || []), Number(s.coordinate_y) || 0]);
  });
  let flat = 0;
  groups.forEach((ys) => {
    if (Math.max(...ys) - Math.min(...ys) <= 8) flat += 1;
  });
  return flat / groups.size >= 0.9;
}

function tierColor(seat: SeatLike): string {
  const c = typeof seat.color === "string" ? seat.color.trim() : "";
  if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c;
  const n = String(seat.section_name || "").toLowerCase();
  if (n.includes("recliner") || n.includes("vip")) return "#db2777";
  if (n.includes("couple")) return "#dc2626";
  if (n.includes("prime") || n.includes("premium")) return "#2563eb";
  return "#16a34a";
}

export default function ClassicSeatMap({
  seats,
  seatMarker,
  heightClass = "h-[min(62vh,560px)]",
  className = "",
  fitAll = false,
  screenLabel = "All eyes this way please",
  merged = false,
  stage = false,
}: {
  screenLabel?: string;
  /** Auditorium style: all seat blocks side by side on shared rows, keeping aisles but trimming wide empty space */
  merged?: boolean;
  /** Draw a stage block instead of the cinema screen arc */
  stage?: boolean;
  /** Shrink the whole map to fit the box (previews on cards) instead of scrolling */
  fitAll?: boolean;
  seats?: unknown;
  seatMarker?: (seat: SeatLike, index: number) => ClassicSeatMarker | null | undefined;
  heightClass?: string;
  className?: string;
}) {
  const list = useMemo(() => asSeats(seats), [seats]);

  const layout = useMemo(() => {
    if (list.length === 0) return null;
    const xs = list.map((s) => Number(s.coordinate_x) || 0);
    const minX = Math.min(...xs);

    // Real seat step on this layout: the smallest gap between neighbours in a row
    const byLine = new Map<string, number[]>();
    list.forEach((s) => {
      const k = `${String(s.section_name || "")}|${String(s.row_label || "")}|${Math.round((Number(s.coordinate_y) || 0) / 12)}`;
      byLine.set(k, [...(byLine.get(k) || []), Number(s.coordinate_x) || 0]);
    });
    let step = Infinity;
    byLine.forEach((arr) => {
      arr.sort((a, b) => a - b);
      for (let i = 1; i < arr.length; i++) {
        const d = arr[i] - arr[i - 1];
        if (d > 5) step = Math.min(step, d);
      }
    });
    if (!Number.isFinite(step)) step = 30;
    const scale = PITCH / step;

    type Row = { label: string; y: number; gap?: number; seats: Array<{ seat: SeatLike; index: number; left: number }> };
    const sections = new Map<string, { name: string; minY: number; rows: Map<string, Row> }>();
    list.forEach((seat, index) => {
      const name = String(seat.section_name || "Seats").trim() || "Seats";
      const y = Number(seat.coordinate_y) || 0;
      const sec = sections.get(name) || { name, minY: y, rows: new Map<string, Row>() };
      sec.minY = Math.min(sec.minY, y);
      const label = String(seat.row_label || "").trim();
      const rk = `${label}|${Math.round(y / 12)}`;
      const row = sec.rows.get(rk) || { label, y, seats: [] };
      row.seats.push({ seat, index, left: Math.round(((Number(seat.coordinate_x) || 0) - minX) * scale) });
      sec.rows.set(rk, row);
      sections.set(name, sec);
    });

    const ordered = Array.from(sections.values())
      .sort((a, b) => a.minY - b.minY)
      .map((sec) => ({
        name: sec.name,
        rows: Array.from(sec.rows.values())
          .sort((a, b) => a.y - b.y)
          .map((r) => ({ ...r, seats: r.seats.sort((a, b) => a.left - b.left) })),
      }));
    // Keep the empty bands between row groups, as drawn on the layout
    let rowStep = Infinity;
    ordered.forEach((sec) => {
      for (let i = 1; i < sec.rows.length; i++) {
        const d = sec.rows[i].y - sec.rows[i - 1].y;
        if (d > 4) rowStep = Math.min(rowStep, d);
      }
    });
    if (Number.isFinite(rowStep)) {
      ordered.forEach((sec) => {
        for (let i = 1; i < sec.rows.length; i++) {
          const d = sec.rows[i].y - sec.rows[i - 1].y;
          if (d > rowStep * 1.5) sec.rows[i].gap = Math.round(((d - rowStep) / rowStep) * (SEAT + 8));
        }
      });
    }
    const width = Math.max(...list.map((s) => Math.round(((Number(s.coordinate_x) || 0) - minX) * scale))) + SEAT;
    return { sections: ordered, width };
  }, [list]);

  const mergedLayout = useMemo(() => {
    if (!merged || list.length === 0) return null;
    const num = (v: unknown) => Number(v) || 0;
    const xsAll = Array.from(new Set(list.map((s) => Math.round(num(s.coordinate_x))))).sort((a, b) => a - b);
    // seat step = smallest gap between neighbours of one row of one block
    const lines = new Map<string, number[]>();
    list.forEach((s) => {
      const k = `${String(s.section_name || "")}|${String(s.row_label || "")}|${Math.round(num(s.coordinate_y) / 6)}`;
      lines.set(k, [...(lines.get(k) || []), num(s.coordinate_x)]);
    });
    let step = Infinity;
    lines.forEach((arr) => {
      arr.sort((a, b) => a - b);
      for (let i = 1; i < arr.length; i++) {
        const d = arr[i] - arr[i - 1];
        if (d > 5) step = Math.min(step, d);
      }
    });
    if (!Number.isFinite(step)) step = 30;
    const scale = PITCH / step;
    // columns = blocks separated by an aisle wider than ~1.8 seats
    const cols: { min: number; max: number }[] = [];
    xsAll.forEach((x) => {
      const last = cols[cols.length - 1];
      if (last && x - last.max <= step * 1.8) last.max = x;
      else cols.push({ min: x, max: x });
    });
    const AISLE = 26;
    const colLeft: number[] = [];
    let cursor = 0;
    cols.forEach((c) => {
      colLeft.push(cursor);
      cursor += (LABEL_COL + LABEL_GAP) * 2 + Math.round((c.max - c.min) * scale) + SEAT + AISLE;
    });
    const width = cursor - AISLE;
    // rows = seats whose y is within about half a row step of each other
    const ys = Array.from(new Set(list.map((s) => Math.round(num(s.coordinate_y))))).sort((a, b) => a - b);
    // row step = smallest vertical gap between two seats of the same column of the same block
    const colsByX = new Map<string, number[]>();
    list.forEach((s) => {
      const k = `${String(s.section_name || "")}|${Math.round(num(s.coordinate_x))}`;
      colsByX.set(k, [...(colsByX.get(k) || []), num(s.coordinate_y)]);
    });
    let rowStep = Infinity;
    colsByX.forEach((arr) => {
      arr.sort((a, b) => a - b);
      for (let i = 1; i < arr.length; i++) {
        const d = arr[i] - arr[i - 1];
        if (d > 4) rowStep = Math.min(rowStep, d);
      }
    });
    if (!Number.isFinite(rowStep)) rowStep = 30;
    const bands: number[] = [];
    ys.forEach((y) => {
      const last = bands[bands.length - 1];
      if (last !== undefined && y - last < rowStep * 0.6) return;
      bands.push(y);
    });
    type Cell = { seat: SeatLike; index: number; left: number };
    const rows = bands.map((by) => ({
      y: by,
      gap: 0,
      cells: cols.map(() => [] as Cell[]),
      labels: cols.map(() => ""),
    }));
    list.forEach((seat, index) => {
      const y = num(seat.coordinate_y);
      let bi = 0;
      for (let i = 0; i < bands.length; i++) if (Math.abs(bands[i] - y) < Math.abs(bands[bi] - y)) bi = i;
      const x = Math.round(num(seat.coordinate_x));
      const ci = cols.findIndex((c) => x >= c.min && x <= c.max);
      if (ci < 0) return;
      rows[bi].cells[ci].push({ seat, index, left: Math.round((x - cols[ci].min) * scale) });
      if (!rows[bi].labels[ci]) rows[bi].labels[ci] = String(seat.row_label || "").trim();
    });
    rows.forEach((r) => r.cells.forEach((c) => c.sort((a, b) => a.left - b.left)));
    rows.forEach((r) => {
      const any = r.labels.find(Boolean) || "";
      r.labels = r.labels.map((l, i) => l || (r.cells[i].length ? any : ""));
    });
    const tidy = rows.filter((r) => r.cells.some((c) => c.length > 0));
    const seqLabel = (n: number) => {
      let out = "";
      let v = n;
      do {
        out = String.fromCharCode(65 + (v % 26)) + out;
        v = Math.floor(v / 26) - 1;
      } while (v >= 0);
      return out;
    };
    const stored = tidy.map((r) => r.labels.find(Boolean) || "");
    const repeats = new Set(stored.filter(Boolean)).size < stored.filter(Boolean).length;
    if (repeats) tidy.forEach((r, i) => { r.labels = r.labels.map((l, ci) => (r.cells[ci].length ? seqLabel(i) : l)); });
    for (let i = 1; i < tidy.length; i++) {
      const d = tidy[i].y - tidy[i - 1].y;
      if (d > rowStep * 1.5) tidy[i].gap = Math.round(((d - rowStep) / rowStep) * (SEAT + 8));
    }
    return { rows: tidy, cols: cols.map((c, i) => ({ left: colLeft[i], inner: Math.round((c.max - c.min) * scale) + SEAT })), width };
  }, [list, merged]);

  const boxRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const innerRef = useRef<HTMLDivElement>(null);
  const contentW = mergedLayout ? mergedLayout.width + 32 : layout ? layout.width + (LABEL_COL + LABEL_GAP) * 2 + 32 : 0;
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !contentW) return;
    const fit = () => {
      const byWidth = (el.clientWidth - 8) / contentW;
      const contentH = innerRef.current?.scrollHeight || 0;
      const byHeight = fitAll && contentH ? (el.clientHeight - 8) / contentH : Infinity;
      setZoom(Math.min(1, Math.max(fitAll ? 0.05 : merged ? 0.55 : 0.22, Math.min(byWidth, byHeight))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [contentW, fitAll, layout, mergedLayout, merged]);

  if (mergedLayout) {
    return (
      <div ref={boxRef} className={`${heightClass} ${fitAll ? "overflow-hidden" : "overflow-auto"} rounded-xl border border-slate-200 bg-white ${className}`}>
        <div style={{ width: contentW * zoom, minHeight: 1 }} className="mx-auto">
          <div ref={innerRef} style={{ width: contentW, transform: `scale(${zoom})`, transformOrigin: "0 0" }} className="px-4 pb-6 pt-4">
            {stage ? (
              <div className="mx-auto mb-6 flex h-14 items-center justify-center rounded-lg bg-slate-700 text-xs font-bold tracking-[0.35em] text-white shadow-md" style={{ width: Math.min(mergedLayout.width * 0.5, 520) }}>
                STAGE
              </div>
            ) : (
              <div className="mx-auto mb-5 text-center" style={{ width: mergedLayout.width * 0.6 }}>
                <svg viewBox="0 0 400 26" className="h-8 w-full" aria-hidden>
                  <path d="M4 20 Q200 -6 396 20 L396 24 Q200 0 4 24 Z" fill="#ddd6fe" stroke="#c4b5fd" />
                </svg>
                <p className="text-[10px] tracking-wide text-slate-500">{screenLabel}</p>
              </div>
            )}
            <div className="space-y-2">
              {mergedLayout.rows.map((row, ri) => (
                <div key={ri} className="relative" style={{ height: SEAT, marginTop: row.gap ? row.gap + 8 : undefined, width: mergedLayout.width }}>
                  {row.cells.map((cells, ci) =>
                    cells.length === 0 ? null : (
                      <div key={ci} className="absolute top-0" style={{ left: mergedLayout.cols[ci].left, height: SEAT }}>
                        <span className="absolute top-0 flex items-center justify-center text-sm font-bold text-slate-600" style={{ left: 0, width: LABEL_COL, height: SEAT }}>
                          {row.labels[ci]}
                        </span>
                        <div className="absolute top-0" style={{ left: LABEL_COL + LABEL_GAP, width: mergedLayout.cols[ci].inner, height: SEAT }}>
                          {cells.map(({ seat, index, left }) => {
                            const marker = seatMarker?.(seat, index) || undefined;
                            const base = tierColor(seat);
                            const filled = Boolean(marker?.fill);
                            return (
                              <button
                                key={index}
                                type="button"
                                title={marker?.title || `${row.labels[ci]}${seat.seat_label ?? ""}`}
                                onClick={marker?.onClick}
                                tabIndex={marker?.onClick ? 0 : -1}
                                className="absolute top-0 flex items-center justify-center rounded-md text-[11px] font-semibold"
                                style={{
                                  left,
                                  width: SEAT,
                                  height: SEAT,
                                  background: filled ? marker?.fill : "#ffffff",
                                  color: filled ? "#ffffff" : "#334155",
                                  border: `${marker?.strokeWidth ? Math.min(3, marker.strokeWidth) : 1.5}px solid ${marker?.stroke && marker.stroke !== "#ffffff" ? marker.stroke : filled ? marker?.fill : base}`,
                                  cursor: marker?.onClick ? "pointer" : "default",
                                }}
                              >
                                {String(seat.seat_label ?? "")}
                              </button>
                            );
                          })}
                        </div>
                        <span className="absolute top-0 flex items-center justify-center text-sm font-bold text-slate-600" style={{ left: LABEL_COL + LABEL_GAP * 2 + mergedLayout.cols[ci].inner, width: LABEL_COL, height: SEAT }}>
                          {row.labels[ci]}
                        </span>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!layout) {
    return (
      <div className={`flex ${heightClass} items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 ${className}`}>
        No seats yet
      </div>
    );
  }

  return (
    <div ref={boxRef} className={`${heightClass} ${fitAll ? "overflow-hidden" : "overflow-auto"} rounded-xl border border-slate-200 bg-white ${className}`}>
      <div style={{ width: contentW * zoom, minHeight: 1 }} className="mx-auto">
        <div ref={innerRef} style={{ width: contentW, transform: `scale(${zoom})`, transformOrigin: "0 0" }} className="px-4 pb-6 pt-4">
          {/* Screen */}
          <div className="mx-auto mb-5 text-center" style={{ width: layout.width * 0.8 }}>
            <svg viewBox="0 0 400 26" className="h-8 w-full" aria-hidden>
              <path d="M4 20 Q200 -6 396 20 L396 24 Q200 0 4 24 Z" fill="#ddd6fe" stroke="#c4b5fd" />
            </svg>
            <p className="text-[10px] tracking-wide text-slate-500">{screenLabel}</p>
          </div>

          {layout.sections.map((sec) => (
            <div key={sec.name} className="mb-5">
              <div className="mb-2 flex items-center gap-3" style={{ marginLeft: LABEL_COL + LABEL_GAP, width: layout.width }}>
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{sec.name}</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="space-y-2">
                {sec.rows.map((row, ri) => (
                  <div key={`${sec.name}-${row.label}-${ri}`} className="flex items-center" style={row.gap ? { marginTop: row.gap + 8 } : undefined}>
                    <span className="shrink-0 text-center text-sm font-bold text-slate-600" style={{ width: LABEL_COL, marginRight: LABEL_GAP }}>
                      {row.label}
                    </span>
                    <div className="relative shrink-0" style={{ width: layout.width, height: SEAT }}>
                      {row.seats.map(({ seat, index, left }) => {
                        const marker = seatMarker?.(seat, index) || undefined;
                        const base = tierColor(seat);
                        const filled = Boolean(marker?.fill);
                        const num = String(seat.seat_label ?? "");
                        return (
                          <button
                            key={`${index}`}
                            type="button"
                            title={marker?.title || `${row.label}${num}`}
                            onClick={marker?.onClick}
                            tabIndex={marker?.onClick ? 0 : -1}
                            className="absolute top-0 flex items-center justify-center rounded-md text-[11px] font-semibold"
                            style={{
                              left,
                              width: SEAT,
                              height: SEAT,
                              background: filled ? marker?.fill : "#ffffff",
                              color: filled ? "#ffffff" : "#334155",
                              border: `${marker?.strokeWidth ? Math.min(3, marker.strokeWidth) : 1.5}px solid ${marker?.stroke && marker.stroke !== "#ffffff" ? marker.stroke : filled ? marker?.fill : base}`,
                              cursor: marker?.onClick ? "pointer" : "default",
                            }}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                    <span className="shrink-0 text-center text-sm font-bold text-slate-600" style={{ width: LABEL_COL, marginLeft: LABEL_GAP }}>
                      {row.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
