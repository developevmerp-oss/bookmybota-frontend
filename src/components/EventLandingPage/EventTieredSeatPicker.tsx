"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/currencyFormat";

/**
 * Classic customer seat view for curved / fan theatres: stage on top, the tiers below it nearest-first
 * (Platinum, Gold, ...), each tier with its price and straight rows A, B, C... with seats in number order.
 * Wedge names such as "Gold Left / Center / Right" are joined into one tier; an aisle is kept where a wedge ends.
 * Selection rules stay with the parent (same onSeatsSelected contract as the map viewer).
 */

const SEAT = 34;
const PITCH = 40;
const LABEL = 30;
const AISLE = 22;

const WEDGE = /\s+(left|right|center|centre|middle)$/i;
const tierOf = (name: string) => (name || "Seats").replace(WEDGE, "").trim() || "Seats";

type Seat = any;

export default function EventTieredSeatPicker({
  seats,
  selected,
  maxSelectable,
  onSeatsSelected,
  ticketTypes,
  stageCenter,
}: {
  seats: Seat[];
  selected: Seat[];
  maxSelectable?: number;
  onSeatsSelected: (seats: Seat[]) => void;
  ticketTypes: any[];
  /** Centre of the stage on the saved layout; tiers are listed nearest to it first */
  stageCenter?: { x: number; y: number } | null;
}) {
  const selectedIds = useMemo(() => new Set(selected.map((s) => String(s.id))), [selected]);

  const priceOf = useMemo(() => {
    const m = new Map<string, number>();
    ticketTypes.forEach((t) => m.set(String(t?.ticket_type_id ?? t?.id ?? ""), Number(t?.price) || 0));
    return (s: Seat) => m.get(String(s.ticket_type_id ?? "")) ?? null;
  }, [ticketTypes]);

  const tiers = useMemo(() => {
    const byTier = new Map<string, Seat[]>();
    seats.forEach((s) => {
      if (s?.row_label == null || s?.seat_label == null) return;
      const t = tierOf(String(s.section_name || ""));
      byTier.set(t, [...(byTier.get(t) || []), s]);
    });
    const out = Array.from(byTier.entries()).map(([name, list]) => {
      const rows = new Map<string, Seat[]>();
      list.forEach((s) => rows.set(String(s.row_label), [...(rows.get(String(s.row_label)) || []), s]));
      const sorted = Array.from(rows.entries())
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
        .map(([label, rs]) => ({
          label,
          seats: rs.sort((a, b) => Number(a.seat_label) - Number(b.seat_label)),
        }));
      const cx = list.reduce((n, s) => n + (Number(s.coordinate_x) || 0), 0) / list.length;
      const cy = list.reduce((n, s) => n + (Number(s.coordinate_y) || 0), 0) / list.length;
      const dist = stageCenter ? Math.hypot(cx - stageCenter.x, cy - stageCenter.y) : -cy;
      const price = priceOf(list[0]);
      return { name, rows: sorted, dist, price, color: list.find((s) => s.color)?.color as string | undefined };
    });
    return out.sort((a, b) => a.dist - b.dist);
  }, [seats, stageCenter, priceOf]);

  const widest = useMemo(() => {
    let w = 0;
    tiers.forEach((t) =>
      t.rows.forEach((r) => {
        let x = 0;
        r.seats.forEach((s, i) => {
          if (i > 0 && (String(s.section_name) !== String(r.seats[i - 1].section_name) || Number(s.seat_label) - Number(r.seats[i - 1].seat_label) > 1)) x += AISLE;
          x += PITCH;
        });
        w = Math.max(w, x);
      })
    );
    return w;
  }, [tiers]);

  const boxRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const contentW = widest + (LABEL + 12) * 2 + 32;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => setZoom(Math.min(1, Math.max(0.6, (el.clientWidth - 8) / contentW)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [contentW]);

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
      <div ref={boxRef} className="min-h-0 flex-1 overflow-auto">
        <div style={{ width: contentW * zoom }} className="mx-auto">
          <div style={{ width: contentW, transform: `scale(${zoom})`, transformOrigin: "0 0" }} className="px-4 pb-8 pt-4">
            <div className="mx-auto mb-6 flex h-14 items-center justify-center rounded-lg bg-slate-700 text-xs font-bold tracking-[0.35em] text-white shadow-md" style={{ width: Math.min(Math.max(widest * 0.55, 240), 560) }}>
              STAGE
            </div>
            {tiers.map((tier) => (
              <section key={tier.name} className="mb-6">
                <div className="mb-2 flex items-center gap-3" style={{ width: widest + (LABEL + 12) * 2 }}>
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    {tier.name}
                    {tier.price != null ? <span className="ml-2 font-bold text-[#6900AA]">{formatMoney(tier.price, { compact: true })}</span> : null}
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="space-y-2">
                  {tier.rows.map((row) => {
                    let x = 0;
                    const cells = row.seats.map((s, i) => {
                      if (i > 0 && (String(s.section_name) !== String(row.seats[i - 1].section_name) || Number(s.seat_label) - Number(row.seats[i - 1].seat_label) > 1)) x += AISLE;
                      const left = x;
                      x += PITCH;
                      return { s, left };
                    });
                    const rowW = x;
                    const pad = (widest - rowW) / 2;
                    return (
                      <div key={row.label} className="flex items-center">
                        <span className="shrink-0 text-center text-sm font-bold text-slate-600" style={{ width: LABEL, marginRight: 12 }}>
                          {row.label}
                        </span>
                        <div className="relative shrink-0" style={{ width: widest, height: SEAT }}>
                          {cells.map(({ s, left }) => {
                            const picked = selectedIds.has(String(s.id));
                            const free = String(s.status || "").toUpperCase() === "AVAILABLE";
                            return (
                              <button
                                key={String(s.id)}
                                type="button"
                                title={`${tier.name} · ${row.label}${s.seat_label}`}
                                onClick={() => toggle(s)}
                                disabled={!free && !picked}
                                className="absolute top-0 flex items-center justify-center rounded-md text-[11px] font-semibold"
                                style={{
                                  left: left + pad,
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
                        </div>
                        <span className="shrink-0 text-center text-sm font-bold text-slate-600" style={{ width: LABEL, marginLeft: 12 }}>
                          {row.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
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
