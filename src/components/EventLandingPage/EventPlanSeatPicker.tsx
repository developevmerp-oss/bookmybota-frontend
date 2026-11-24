"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/currencyFormat";

/**
 * Customer seat picker that draws an auditorium exactly as the admin laid it out: every seat sits at its saved
 * coordinates (straight rows, angled side wings, split rows), with the stage, light/sound boxes, tier names with
 * prices, divider lines and the row letters at both ends of each row. Selection rules stay with the parent.
 */

export type SeatPlan = {
  width: number;
  height: number;
  /** Turn the plan upside down (top becomes bottom) so the stage is drawn at the top; numbering still runs left to right */
  flip?: boolean;
  stage?: { x: number; y: number; w: number; h: number; label?: string };
  bars?: Array<{ label: string; x: number; y: number; w: number; h: number }>;
  tiers?: Array<{ name: string; x: number; y: number }>;
  lines?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
};

type Seat = any;
const S = 1.25; // plan units -> px
const SEAT = 28;

const tierOf = (n: string) => String(n || "").replace(/\s+(left|right|center|centre|middle)$/i, "").trim();

export default function EventPlanSeatPicker({
  plan,
  seats,
  selected,
  maxSelectable,
  onSeatsSelected,
  ticketTypes,
}: {
  plan: SeatPlan;
  seats: Seat[];
  selected: Seat[];
  maxSelectable?: number;
  onSeatsSelected: (seats: Seat[]) => void;
  ticketTypes: any[];
}) {
  const selectedIds = useMemo(() => new Set(selected.map((s) => String(s.id))), [selected]);
  const list = useMemo(() => seats.filter((s) => s && s.coordinate_x != null && s.coordinate_y != null && s.row_label != null), [seats]);

  const priceOf = useMemo(() => {
    const m = new Map<string, number>();
    ticketTypes.forEach((t) => m.set(String(t?.ticket_type_id ?? t?.id ?? ""), Number(t?.price) || 0));
    return m;
  }, [ticketTypes]);

  const tierPrice = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((s) => {
      const t = tierOf(String(s.section_name)).toLowerCase();
      if (!m.has(t) && s.ticket_type_id != null && priceOf.has(String(s.ticket_type_id))) m.set(t, priceOf.get(String(s.ticket_type_id)) as number);
    });
    return m;
  }, [list, priceOf]);

  // row letters at the two ends of each row (tier + letter)
  const rowTags = useMemo(() => {
    const groups = new Map<string, Seat[]>();
    list.forEach((s) => {
      const k = `${tierOf(String(s.section_name))}|${s.row_label}`;
      groups.set(k, [...(groups.get(k) || []), s]);
    });
    const out: { x: number; y: number; t: string }[] = [];
    groups.forEach((arr) => {
      arr.sort((a, b) => Number(a.coordinate_x) - Number(b.coordinate_x));
      const first = arr[0], last = arr[arr.length - 1];
      const near = (a: Seat, b: Seat, dir: number) => {
        const dx = Number(a.coordinate_x) - Number(b.coordinate_x);
        const dy = Number(a.coordinate_y) - Number(b.coordinate_y);
        const len = Math.hypot(dx, dy) || 1;
        return { x: Number(a.coordinate_x) + (dx / len) * 30 * dir, y: Number(a.coordinate_y) + (dy / len) * 30 * dir };
      };
      const second = arr[1] || first;
      const prev = arr[arr.length - 2] || last;
      const l = near(first, second, 1);
      const r = near(last, prev, 1);
      out.push({ ...l, t: String(first.row_label) }, { ...r, t: String(last.row_label) });
    });
    return out;
  }, [list]);

  const boxRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const fy = (y: number) => (plan.flip ? plan.height - y : y);
  const W = plan.width * S;
  const H = plan.height * S;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => setZoom(Math.min(1, Math.max(0.5, (el.clientWidth - 8) / W)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);

  const toggle = (seat: Seat) => {
    const id = String(seat.id);
    const free = String(seat.status || "").toUpperCase() === "AVAILABLE";
    if (!free && !selectedIds.has(id)) return;
    let next: Seat[];
    if (selectedIds.has(id)) next = selected.filter((s) => String(s.id) !== id);
    else if (maxSelectable && selected.length >= maxSelectable) next = [seat];
    else next = [...selected, seat];
    onSeatsSelected(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div ref={boxRef} className="min-h-0 flex-1 overflow-auto bg-slate-50">
        <div style={{ width: W * zoom, height: H * zoom }} className="mx-auto">
          <div style={{ width: W, height: H, transform: `scale(${zoom})`, transformOrigin: "0 0" }} className="relative">
            <svg className="pointer-events-none absolute inset-0" width={W} height={H}>
              {(plan.lines || []).map((l, i) => (
                <line key={i} x1={l.x1 * S} y1={fy(l.y1) * S} x2={l.x2 * S} y2={fy(l.y2) * S} stroke="#94a3b8" strokeWidth={3} strokeLinecap="round" />
              ))}
            </svg>

            {(plan.bars || []).map((b) => (
              <div key={b.label} className="absolute flex items-center justify-center rounded bg-slate-300 text-[11px] font-bold tracking-wider text-slate-600" style={{ left: b.x * S, top: (plan.flip ? fy(b.y + b.h) : b.y) * S, width: b.w * S, height: b.h * S }}>
                {b.label}
              </div>
            ))}

            {(plan.tiers || []).map((t) => {
              const price = tierPrice.get(t.name.toLowerCase());
              return (
                <div key={t.name} className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-sm font-extrabold uppercase tracking-wide text-slate-700" style={{ left: t.x * S, top: fy(t.y) * S }}>
                  {t.name}
                  {price != null ? <span className="ml-2 text-[#6900AA]">{formatMoney(price, { compact: true })}</span> : null}
                </div>
              );
            })}

            {rowTags.map((r, i) => (
              <span key={i} className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center text-sm font-extrabold text-slate-600" style={{ left: r.x * S, top: fy(r.y) * S }}>
                {r.t}
              </span>
            ))}

            {list.map((s) => {
              const picked = selectedIds.has(String(s.id));
              const free = String(s.status || "").toUpperCase() === "AVAILABLE";
              return (
                <button
                  key={String(s.id)}
                  type="button"
                  title={`${tierOf(String(s.section_name))} · ${s.row_label}${s.seat_label}`}
                  onClick={() => toggle(s)}
                  disabled={!free && !picked}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md text-[11px] font-semibold"
                  style={{
                    left: Number(s.coordinate_x) * S,
                    top: fy(Number(s.coordinate_y)) * S,
                    width: SEAT,
                    height: SEAT,
                    background: picked ? "#6900AA" : free ? "#ffffff" : "#e5e7eb",
                    color: picked ? "#fff" : free ? "#334155" : "#cbd5e1",
                    border: `${picked ? 2 : 1.5}px solid ${picked ? "#4c0080" : free ? "#22c55e" : "#e5e7eb"}`,
                    cursor: free || picked ? "pointer" : "not-allowed",
                  }}
                >
                  {String(s.seat_label).replace(/^0+(?=\d)/, "")}
                </button>
              );
            })}

            {plan.stage && (
              <div className="absolute flex items-center justify-center rounded-md bg-slate-700 text-lg font-extrabold tracking-[0.4em] text-white shadow-md" style={{ left: plan.stage.x * S, top: (plan.flip ? fy(plan.stage.y + plan.stage.h) : plan.stage.y) * S, width: plan.stage.w * S, height: plan.stage.h * S }}>
                {plan.stage.label || "STAGE"}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded border-2 border-green-500 bg-white" /> Available</span>
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded bg-[#6900AA]" /> Selected</span>
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded bg-slate-200" /> Sold / held</span>
      </div>
    </div>
  );
}