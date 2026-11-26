"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMoney } from "@/lib/currencyFormat";
import { useMapZoom } from "@/components/venue/useMapZoom";

/**
 * Classic customer view for curved / fan / any free-form seating layout.
 * Seats stay exactly where the admin placed them (so the curve is kept), scaled so every seat is a readable
 * button. The stage is always at the top and the seating below it (layouts drawn with the stage at the bottom
 * are flipped), with tier names + prices, row letters at the start of each row and an ENTRY / EXIT block.
 */

type Seat = any;
type Stage = { x: number; y: number; width: number; height: number; text?: string } | null;

const PAD = 70;

export default function EventGeoSeatPicker({
  seats,
  selected,
  maxSelectable,
  onSeatsSelected,
  ticketTypes,
    stage = null,
  decksConfig,
}: {
  seats: Seat[];
  selected: Seat[];
  maxSelectable?: number;
  onSeatsSelected: (seats: Seat[]) => void;
  ticketTypes: any[];
  stage?: Stage;
  /** Optional admin-defined decks: [{ label, tiers: [tier names] }]; otherwise tiers are split by distance from the stage */
  decksConfig?: Array<{ label?: string; tiers: string[] }>;
}) {
  const selectedIds = useMemo(() => new Set(selected.map((s) => String(s.id))), [selected]);

  const [deck, setDeck] = useState(0);

  const model = useMemo(() => {
    const list = seats.filter((s) => s && s.row_label != null && s.seat_label != null);
    if (list.length === 0) return null;
    const WEDGE = /\s+(left|right|center|centre|middle)$/i;
    const tierOf = (n: string) => (n || "Seats").replace(WEDGE, "").trim() || "Seats";
    const priceMap = new Map<string, number>();
    ticketTypes.forEach((t) => priceMap.set(String(t?.ticket_type_id ?? t?.id ?? ""), Number(t?.price) || 0));

    // tiers, nearest the stage first (by the distance the admin drew them from the stage)
    const stageC = stage ? { x: Number(stage.x) + (Number(stage.width) || 0) / 2, y: Number(stage.y) + (Number(stage.height) || 0) / 2 } : null;
    const byTier = new Map<string, Seat[]>();
    list.forEach((s) => byTier.set(tierOf(String(s.section_name || "")), [...(byTier.get(tierOf(String(s.section_name || ""))) || []), s]));
    const tiers = Array.from(byTier.entries())
      .map(([name, arr]) => {
        const cx = arr.reduce((n, s) => n + (Number(s.coordinate_x) || 0), 0) / arr.length;
        const cy = arr.reduce((n, s) => n + (Number(s.coordinate_y) || 0), 0) / arr.length;
        return { name, arr, dist: stageC ? Math.hypot(cx - stageC.x, cy - stageC.y) : -cy };
      })
      .sort((a, b) => a.dist - b.dist);

    const PITCH = 34;
    const GAP = 20;
    const ROW = 40;
    const SPAN = 1.5; // widest an arc may open (radians)
    type P = { s: Seat; x: number; y: number; deck: number };
    const pts: P[] = [];
    const tags: { x: number; y: number; t: string; deck: number }[] = [];
    const heads: { x: number; y: number; text: string; price?: number; deck: number }[] = [];
    const deckTop: number[] = [];

    const seqLabel = (n: number) => {
      let out = "";
      let v = n;
      do {
        out = String.fromCharCode(65 + (v % 26)) + out;
        v = Math.floor(v / 26) - 1;
      } while (v >= 0);
      return out;
    };
    let rowCounter = 0;
    const shown = new Map<string, string>(); // seat id -> row letter shown to the customer
    let prevOuter = 0;
    let cyAbs = 0; // y of the arcs' centre, set by the first tier
    // two decks when there are 3+ tiers: the tiers nearest the stage, and the ones behind them
    const lc = (x: string) => x.trim().toLowerCase();
    const configured = (decksConfig || []).filter((d) => Array.isArray(d?.tiers) && d.tiers.length > 0);
    let deckList: (typeof tiers)[] ;
    let deckLabels: string[] = [];
    if (configured.length >= 2) {
      const used = new Set<string>();
      deckList = configured.map((d) => {
        const names = d.tiers.map(lc);
        const found = tiers.filter((t) => names.includes(lc(t.name)));
        found.forEach((t) => used.add(t.name));
        return found.sort((a, b) => names.indexOf(lc(a.name)) - names.indexOf(lc(b.name)));
      });
      const rest = tiers.filter((t) => !used.has(t.name));
      if (rest.length) deckList[deckList.length - 1] = [...deckList[deckList.length - 1], ...rest];
      deckLabels = configured.map((d, i) => d.label || (i === 0 ? "Lower deck" : "Upper deck"));
      // keep the tiers in deck order so row letters run A.. through the lower deck first
      const order = deckList.flat();
      tiers.length = 0;
      order.forEach((t) => tiers.push(t));
    } else {
      const split = tiers.length >= 3 ? Math.ceil(tiers.length / 2) : tiers.length;
      deckList = tiers.length >= 3 ? [tiers.slice(0, split), tiers.slice(split)] : [tiers];
    }
    const activeDeck = Math.min(deck, deckList.length - 1);
    const deckOfTier = (name: string) => Math.max(0, deckList.findIndex((d) => d.some((t) => t.name === name)));
    tiers.forEach((tier, ti) => {
      const dk = deckOfTier(tier.name);
      const rowsMap = new Map<string, Seat[]>();
      tier.arr.forEach((s) => rowsMap.set(String(s.row_label), [...(rowsMap.get(String(s.row_label)) || []), s]));
      const rows = Array.from(rowsMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
        .map(([label, rs]) => {
          rs.sort((a, b) => Number(a.seat_label) - Number(b.seat_label));
          let L = 0;
          const us: number[] = [];
          rs.forEach((s, i) => {
            if (i > 0 && (String(s.section_name) !== String(rs[i - 1].section_name) || Number(s.seat_label) - Number(rs[i - 1].seat_label) > 1)) L += GAP;
            us.push(L + PITCH / 2);
            L += PITCH;
          });
          return { label, rs, us, L };
        });
      const firstL = rows[0]?.L || PITCH;
      const R0 = Math.max(prevOuter + (ti === 0 ? 0 : 78), firstL / SPAN);
      if (ti === 0) cyAbs = 150 - R0;
      rows.forEach((row, ri) => {
        const letter = seqLabel(rowCounter++);
        row.rs.forEach((s) => shown.set(String(s.id), letter));
        const R = R0 + ri * ROW;
        row.rs.forEach((s, i) => {
          const th = Math.PI / 2 + (row.L / 2 - row.us[i]) / R;
          pts.push({ s, x: R * Math.cos(th), y: cyAbs + R * Math.sin(th), deck: dk });
        });
        [-1, 1].forEach((side) => {
          const th = Math.PI / 2 - (side * (row.L / 2 + 22)) / R;
          tags.push({ x: R * Math.cos(th), y: cyAbs + R * Math.sin(th), t: letter, deck: dk });
        });
      });
      const first = tier.arr[0];
      heads.push({ x: 0, y: cyAbs + R0 - 40, text: tier.name, price: priceMap.get(String(first?.ticket_type_id ?? "")), deck: dk });
      if (deckTop[dk] === undefined) deckTop[dk] = cyAbs + R0 - 60;
      prevOuter = R0 + (rows.length - 1) * ROW + PITCH;
    });

    const stageTop = 150 - 175;
    const allY = [...pts.map((p) => p.y), ...tags.map((p) => p.y), stageTop];
    const allX = [...pts.map((p) => p.x), ...tags.map((p) => p.x)];
    const minY = Math.min(...allY), maxY = Math.max(...allY);
    const minX = Math.min(...allX), maxX = Math.max(...allX);
    const ox = 50 - minX, oy = 24 - minY;
    const width = maxX - minX + 100;
    const centerX = ox;
    const seatsBottom = Math.max(...pts.map((p) => p.y)) + oy;
    return {
      shown,
      pts: pts.map((p) => ({ ...p, x: p.x + ox, y: p.y + oy })),
      rowTags: tags.map((t) => ({ ...t, x: t.x + ox, y: t.y + oy })),
      tierLabels: heads.map((h) => ({ ...h, x: centerX, y: h.y + oy })),
      width,
      height: seatsBottom + 140,
      seatPx: 30,
      stageW: Math.min(Math.max(width * 0.3, 260), 460),
      stageTop: stageTop + oy,
      centerX,
      seatsBottom,
      deckTops: deckTop.map((t) => t + oy),
      decks: deckList.map((d, i) => ({ label: deckList.length === 1 ? "" : deckLabels[i] || (i === 0 ? "Lower deck" : "Upper deck"), names: d.map((t) => t.name).join(" · ") })),
      activeDeck,
    };
  }, [seats, stage, ticketTypes, deck, decksConfig]);

  const boxRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const { zoom: userZoom, controls } = useMapZoom(boxRef);
  const zoom = fit * userZoom;
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !model) return;
    const doFit = () => {
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      if (vw < 40 || vh < 40) return;
      // On mobile, frame the stage + center seats cleanly (matching EventPlanSeatPicker)
      // while allowing two-finger pinch/slide to zoom in, zoom out, or pan to outer wings.
      const focusW = vw < 640 ? Math.min(model.width, Math.max(model.stageW * 1.85, 720)) : model.width;
      const nextFit = Math.min(1, (vw - 24) / focusW, vw < 640 ? 1 : (vh - 24) / model.height);
      setFit(Math.max(0.2, Math.round(nextFit * 1000) / 1000));
    };
    doFit();
    const ro = new ResizeObserver(doFit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [model]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !model) return;
    const id = requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
      el.scrollTop = 0;
    });
    return () => cancelAnimationFrame(id);
  }, [fit, model]);

  const activeDeckIdx = model?.activeDeck ?? 0;
  useEffect(() => {
    if (!model) return;
    const top = model.deckTops[activeDeckIdx];
    if (top === undefined) return;
    boxRef.current?.scrollTo({ top: activeDeckIdx === 0 ? 0 : Math.max(0, (top - 70) * zoom), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDeckIdx]);

  if (!model) return <div className="flex h-full items-center justify-center text-sm text-slate-500">No seats yet</div>;

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
      {model.decks.length > 1 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2">
          {model.decks.map((d, i) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setDeck(i)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-left text-xs font-semibold transition ${model.activeDeck === i ? "border-[#6900AA] bg-[#6900AA] text-white" : "border-slate-300 bg-white text-slate-700 hover:border-[#6900AA]"}`}
            >
              {d.label}
              <span className={`ml-2 font-normal ${model.activeDeck === i ? "text-white/80" : "text-slate-500"}`}>{d.names}</span>
            </button>
          ))}
        </div>
      )}
      <div className="relative min-h-0 flex-1"><div ref={boxRef} className="h-full overflow-auto">
        <div className="min-h-full min-w-full w-max flex items-center justify-center p-2 sm:p-4">
          <div style={{ width: model.width * zoom, height: model.height * zoom }} className="shrink-0">
            <div style={{ width: model.width, height: model.height, transform: `scale(${zoom})`, transformOrigin: "0 0" }} className="relative">
            <div
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-[11px] tracking-wide text-slate-500"
              style={{ left: model.centerX, top: Math.max(8, model.stageTop - 22) }}
            >
              All eyes this way please
            </div>
            <div
              className="absolute flex h-16 items-center justify-center rounded-lg bg-slate-700 text-sm font-bold tracking-[0.4em] text-white shadow-md"
              style={{ left: model.centerX - model.stageW / 2, top: model.stageTop, width: model.stageW }}
            >
              STAGE
            </div>

            {model.tierLabels.map((l) => (
              <div key={l.text} style={{ ...( l.deck === model.activeDeck ? {} : { opacity: 0.35, filter: "blur(1.5px)" }), left: l.x, top: l.y }} className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-600">
                {l.text}
                {l.price != null ? <span className="ml-1.5 text-[#6900AA]">{formatMoney(l.price, { compact: true })}</span> : null}
              </div>
            ))}

            {model.rowTags.map((r, i) => (
              <span key={i} style={{ left: r.x, top: r.y, width: 16, height: 16, ...(r.deck !== model.activeDeck ? { opacity: 0.3, filter: "blur(1px)" } : {}) }} className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center text-[10px] font-bold text-slate-500">
                {r.t}
              </span>
            ))}

            {model.pts.map(({ s, x, y, deck: dk }) => {
              const picked = selectedIds.has(String(s.id));
              const dim = dk !== model.activeDeck;
              const free = String(s.status || "").toUpperCase() === "AVAILABLE";
              const rawNo = String(s.seat_label).replace(/^0+(?=\d)/, "");
              const paddedNo = /^\d+$/.test(rawNo) ? rawNo.padStart(2, "0") : rawNo;
              return (
                <button
                  key={String(s.id)}
                  type="button"
                  title={`${s.section_name} · ${model.shown.get(String(s.id)) ?? s.row_label}${rawNo}`}
                  onClick={() => toggle(s)}
                  disabled={(!free && !picked) || dk !== model.activeDeck}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[7px] text-[10px] font-semibold transition-[border-color,transform,background-color] duration-150"
                  style={{
                    left: x,
                    top: y,
                    width: model.seatPx,
                    height: model.seatPx,
                    // Movie Classic View palette: #7B61FF selected, #4B5563 available, #E0E0E0 booked
                    background: picked ? "#7B61FF" : "#ffffff",
                    color: picked ? "#ffffff" : free ? "#1E293B" : "#C4C4C4",
                    border: `1px solid ${picked ? "#7B61FF" : free ? "#4B5563" : "#E0E0E0"}`,
                    boxShadow: picked ? "0 0 0 3px rgba(123,97,255,0.22), 0 0 12px 3px rgba(123,97,255,0.4)" : undefined,
                    cursor: free || picked ? "pointer" : "not-allowed",
                    ...(dim ? { opacity: picked ? 0.9 : 0.3, filter: "blur(1.6px)", pointerEvents: "none" as const } : {}),
                  }}
                >
                  {!free && !picked ? <span aria-hidden>×</span> : paddedNo}
                </button>
              );
            })}

            <div
              className="absolute flex h-14 items-center justify-center rounded-lg bg-slate-200 text-sm font-bold tracking-[0.25em] text-slate-600"
              style={{ left: model.centerX - 130, top: model.seatsBottom + 40, width: 260 }}
            >
              ENTRY / EXIT
            </div>
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
