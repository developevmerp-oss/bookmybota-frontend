"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/currencyFormat";
import { useMapZoom } from "@/components/venue/useMapZoom";

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
  const [fit, setFit] = useState(1);
  const hasCenteredRef = useRef(false);
  const { zoom: userZoom, controls } = useMapZoom(boxRef);
  const zoom = fit * userZoom;
  const fy = (y: number) => (plan.flip ? plan.height - y : y);
  const W = plan.width * S;
  const H = plan.height * S;
  const { actualW, actualH } = useMemo(() => {
    let maxW = W;
    let maxH = H;
    for (const s of list) {
      maxW = Math.max(maxW, Number(s.coordinate_x) * S + SEAT);
      maxH = Math.max(maxH, fy(Number(s.coordinate_y)) * S + SEAT);
    }
    for (const r of rowTags) {
      maxW = Math.max(maxW, r.x * S + 20);
      maxH = Math.max(maxH, fy(r.y) * S + 20);
    }
    if (plan.stage) {
      const sy = plan.flip ? fy(plan.stage.y + plan.stage.h) : plan.stage.y;
      maxW = Math.max(maxW, (plan.stage.x + plan.stage.w) * S + 20);
      maxH = Math.max(maxH, (sy + plan.stage.h) * S + 20);
    }
    return { actualW: maxW, actualH: maxH };
  }, [W, H, list, rowTags, plan.flip, plan.height, plan.stage]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const doFit = () => {
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if (vw < 40 || vh < 40) return;
      const pad = vw >= 640 ? 48 : 24;
      // On mobile, frame the stage + center stalls cleanly (like Movie Classic View)
      // while allowing pinch/slide to reach outer wings or zoom in/out.
      const focusW = vw < 640 && plan.stage
        ? Math.min(actualW, Math.max(plan.stage.w * S * 1.65, 720))
        : actualW;
      const nextFit = Math.min(1, (vw - pad) / focusW, vw < 640 ? 1 : (vh - pad) / actualH);
      setFit(Math.max(0.2, Math.round(nextFit * 1000) / 1000));
    };
    doFit();
    const ro = new ResizeObserver(doFit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [actualW, actualH, plan.stage]);

  // Center horizontally & show the stage cleanly at the top once fit is applied
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
      if (!hasCenteredRef.current) {
        el.scrollTop = 0;
        hasCenteredRef.current = true;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [fit, actualW, actualH]);

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
      <div className="relative min-h-0 flex-1"><div ref={boxRef} className="h-full overflow-auto bg-white">
        <div className="min-h-full min-w-full w-max flex items-center justify-center p-2 sm:p-4">
          <div style={{ width: actualW * zoom, height: actualH * zoom }} className="shrink-0">
            <div style={{ width: actualW, height: actualH, transform: `scale(${zoom})`, transformOrigin: "0 0" }} className="relative">
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
              const rawNo = String(s.seat_label).replace(/^0+(?=\d)/, "");
              const paddedNo = /^\d+$/.test(rawNo) ? rawNo.padStart(2, "0") : rawNo;
              return (
                <button
                  key={String(s.id)}
                  type="button"
                  title={`${tierOf(String(s.section_name))} · ${s.row_label}${rawNo}`}
                  onClick={() => toggle(s)}
                  disabled={!free && !picked}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[7px] text-[10px] font-semibold transition-[border-color,transform,background-color] duration-150"
                  style={{
                    left: Number(s.coordinate_x) * S,
                    top: fy(Number(s.coordinate_y)) * S,
                    width: SEAT,
                    height: SEAT,
                    // Movie Classic View palette: #7B61FF selected, #4B5563 available, #E0E0E0 booked
                    background: picked ? "#7B61FF" : "#ffffff",
                    color: picked ? "#ffffff" : free ? "#1E293B" : "#C4C4C4",
                    border: `1px solid ${picked ? "#7B61FF" : free ? "#4B5563" : "#E0E0E0"}`,
                    boxShadow: picked ? "0 0 0 3px rgba(123,97,255,0.22), 0 0 12px 3px rgba(123,97,255,0.4)" : undefined,
                    cursor: free || picked ? "pointer" : "not-allowed",
                  }}
                >
                  {!free && !picked ? <span aria-hidden>×</span> : paddedNo}
                </button>
              );
            })}

            {plan.stage && (() => {
              const stageTop = (plan.flip ? fy(plan.stage.y + plan.stage.h) : plan.stage.y) * S;
              const stageLeft = plan.stage.x * S;
              const stageW = plan.stage.w * S;
              const stageH = plan.stage.h * S;
              return (
                <>
                  <div
                    className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-medium tracking-wide text-slate-400"
                    style={{ left: stageLeft + stageW / 2, top: Math.max(2, stageTop - 18) }}
                  >
                    All eyes this way please
                  </div>
                  <div
                    className="absolute flex items-center justify-center rounded-xl bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-600/40 text-lg font-extrabold tracking-[0.4em] text-white shadow-md"
                    style={{ left: stageLeft, top: stageTop, width: stageW, height: stageH }}
                  >
                    {plan.stage.label || "STAGE"}
                  </div>
                </>
              );
            })()}
          </div>
          </div>
        </div>
      </div>
      {controls}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded-[4px] border border-[#4B5563] bg-white" /> Available</span>
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded-[4px] border border-[#7B61FF] bg-[#7B61FF] shadow-[0_0_0_2px_rgba(123,97,255,0.22)]" /> Selected</span>
        <span className="flex items-center gap-1.5"><i className="flex size-3.5 items-center justify-center rounded-[4px] border border-[#E0E0E0] bg-white text-[10px] leading-none font-medium text-[#C4C4C4] not-italic">×</i> Sold / held</span>
      </div>
    </div>
  );
}