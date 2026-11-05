"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { X, Smartphone, Monitor, CheckCircle2, DollarSign, Users, Info } from "lucide-react";
import { UniversalVenueObject, UniversalSeat, SeatType } from "../types";
import {
  generateSeatsForObject,
  computeLayoutCapacity,
  gridStandSize,
  layoutBounds,
  rowLabelColumns,
  standHeadingAnchor,
  standHeadingText,
  standPriceText,
  usesLabelColumns,
} from "../utils/geometryEngine";
import { blockLabelMetrics, blockSeatSize, polyBounds, polyCentroid, rotatePoints } from "../utils/blockGeometry";

interface CustomerPreviewModalProps {
  open: boolean;
  onClose: () => void;
  layoutName: string;
  objects: UniversalVenueObject[];
  seatTypes?: SeatType[];
}

export default function CustomerPreviewModal({
  open,
  onClose,
  layoutName,
  objects,
  seatTypes,
}: CustomerPreviewModalProps) {
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const [selectedSeat, setSelectedSeat] = useState<UniversalSeat | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  // Compute all physical seats
  const allSeats = useMemo(() => {
    const list: UniversalSeat[] = [];
    objects.forEach((obj) => {
      const s = generateSeatsForObject(obj, seatTypes);
      list.push(...s);
    });
    return list;
  }, [objects, seatTypes]);

  const metrics = useMemo(() => computeLayoutCapacity(objects, seatTypes), [objects, seatTypes]);

  // Stadium blocks: customers see the blocks first and click one to see its seats
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  // Small seats open already zoomed in so each seat is easy to read and tap
  useEffect(() => {
    const b = blocks.find((x) => x.id === openBlockId);
    if (!b || !b.points) {
      setZoom(1);
      return;
    }
    const pb = polyBounds(b.points);
    const unitsAcross = pb.maxX - pb.minX + 100;
    const seatPx = (blockSeatSize(b) * 900) / unitsAcross;
    setZoom(Math.max(1, Math.min(3, +(26 / seatPx).toFixed(2))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBlockId]);
  const [levelView, setLevelView] = useState<string>("all");
  useEffect(() => {
    if (open) {
      setOpenBlockId(null);
      setLevelView("all");
      setSelectedSeat(null);
    }
  }, [open]);
  const blocks = useMemo(() => objects.filter((o) => o.type === "block" && o.points && o.points.length >= 6), [objects]);
  const blockLevels = useMemo(() => {
    const found: string[] = [];
    blocks.forEach((b) => {
      if (b.level && !found.includes(b.level)) found.push(b.level);
    });
    return found;
  }, [blocks]);
  const blockInfo = useMemo(() => {
    const info = new Map<string, { count: number; price: string }>();
    blocks.forEach((b) => {
      const seats = allSeats.filter((s) => s.sectionId === b.id);
      info.set(b.id, { count: seats.length, price: standPriceText(b, seatTypes) });
    });
    return info;
  }, [blocks, allSeats, seatTypes]);
  const openBlock = openBlockId ? blocks.find((b) => b.id === openBlockId) || null : null;
  // Overview shows blocks without seats; opening a block shows only that block's seats
  const visibleSeats = useMemo(() => {
    if (blocks.length === 0) return allSeats;
    const blockIds = new Set(blocks.map((b) => b.id));
    return allSeats.filter((s) => (blockIds.has(s.sectionId) ? s.sectionId === openBlockId : !openBlockId));
  }, [allSeats, blocks, openBlockId]);

  // Zoom the map onto the layout instead of the whole empty canvas
  const viewBox = useMemo(() => {
    if (openBlock && openBlock.points) {
      const pb = polyBounds(openBlock.points);
      const w = Math.max(220, pb.maxX - pb.minX + 100);
      const h = Math.max(160, pb.maxY - pb.minY + 100);
      return `${openBlock.x + pb.minX - 50} ${openBlock.y + pb.minY - 50} ${w} ${h}`;
    }
    const box = layoutBounds(objects, seatTypes);
    if (!box) return "0 0 1600 1200";
    const pad = 70;
    const w = Math.max(300, box.maxX - box.minX + pad * 2);
    const h = Math.max(220, box.maxY - box.minY + pad * 2);
    return `${box.minX - pad} ${box.minY - pad} ${w} ${h}`;
  }, [objects, seatTypes, openBlock]);

  // Smooth camera move: the map glides from the whole stadium into the block you tap (and back)
  // A turned block is shown upright: the whole map is spun the other way around the block while it is open
  const pivotRef = useRef({ x: 0, y: 0 });
  if (openBlock) pivotRef.current = { x: openBlock.x, y: openBlock.y };
  const targetRot = openBlock ? -(openBlock.rotation || 0) : 0;
  const targetVB = useMemo(() => [...viewBox.split(" ").map(Number), targetRot], [viewBox, targetRot]);
  const vbRef = useRef<number[] | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [openBlockId]);
  const [vb, setVb] = useState<number[] | null>(null);
  useEffect(() => {
    const from = vbRef.current;
    const to = targetVB;
    if (!from || !open) {
      vbRef.current = to;
      setVb(to);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 750);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const cur = from.map((f, i) => f + (to[i] - f) * e);
      vbRef.current = cur;
      setVb(cur);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [targetVB, open]);

  const ang = vb ? vb[4] || 0 : 0;
  const spin = (x: number, y: number): [number, number] => {
    if (!ang) return [x, y];
    const a = (ang * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const dx = x - pivotRef.current.x;
    const dy = y - pivotRef.current.y;
    return [pivotRef.current.x + dx * c - dy * s, pivotRef.current.y + dx * s + dy * c];
  };
  const viewSeats = useMemo(
    () =>
      ang
        ? visibleSeats.map((seat) => {
            const [x, y] = spin(seat.x, seat.y);
            return { ...seat, x, y };
          })
        : visibleSeats,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleSeats, ang]
  );

  // Seats fade in once the camera has mostly arrived
  const [seatsOn, setSeatsOn] = useState(false);
  useEffect(() => {
    setSeatsOn(false);
    if (!openBlockId) return;
    const t = setTimeout(() => setSeatsOn(true), 450);
    return () => clearTimeout(t);
  }, [openBlockId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.7)" }}
      onClick={onClose}
    >
      {/* Always-visible close button, also in the phone frame */}
      <button
        onClick={onClose}
        aria-label="Close preview"
        className="fixed top-4 right-4 z-[60] w-10 h-10 rounded-full bg-white text-slate-700 hover:text-slate-900 shadow-lg flex items-center justify-center"
      >
        <X className="w-5 h-5" />
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-2xl transition-all ${
          deviceMode === "mobile"
            ? "w-[420px] max-w-[94vw] h-[min(780px,calc(100vh-2rem))] ring-8 ring-slate-200 rounded-[38px]"
            : "w-[94vw] max-w-6xl h-[88vh]"
        }`}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 font-bold text-xs uppercase tracking-wider border border-emerald-500/30">
              Customer Live Preview
            </span>
            <span className="font-bold text-slate-900 text-sm truncate max-w-xs">{layoutName}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Viewport switch */}
            <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setDeviceMode("desktop")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                  deviceMode === "desktop" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop</span>
              </button>
              <button
                onClick={() => setDeviceMode("mobile")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                  deviceMode === "mobile" ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile</span>
              </button>
            </div>

            <button
              onClick={onClose}
              aria-label="Close preview"
              className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Legend Bar */}
        <div className="px-5 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-slate-700">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-emerald-400/50" />
              <span className="text-slate-700">Selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-slate-600" />
              <span className="text-slate-500">Sold / Unavailable</span>
            </div>
            {(seatTypes || []).map((t) => (
              <div key={t.id} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm border" style={{ borderColor: t.color, backgroundColor: `${t.color}2b` }} />
                <span className="text-slate-700">
                  {t.name} · ETB {t.price}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 text-slate-500 font-mono text-[11px]">
            <span>Total Seats: <strong className="text-slate-900">{metrics.seatedCapacity.toLocaleString()}</strong></span>
            <span>Standing: <strong className="text-emerald-600">{metrics.standingCapacity.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden relative bg-white">
          {/* Visual SVG Map */}
              {blocks.length > 0 && (
                <div className="absolute top-2 left-4 right-4 z-30 flex flex-wrap items-center gap-1 rounded-lg bg-white/95 px-1.5 py-1 shadow-sm border border-slate-200 text-[11px]">
                  {openBlock ? (
                    <>
                      <button onClick={() => { setOpenBlockId(null); setSelectedSeat(null); }} className="px-2.5 py-1 rounded-full bg-slate-800 text-white font-bold">
                        ← All blocks
                      </button>
                      <span className="px-2 font-bold text-slate-700">
                        {openBlock.level ? `${openBlock.level} · ` : ""}{openBlock.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setLevelView("all")} className={`px-2.5 py-1 rounded-full font-bold ${levelView === "all" ? "bg-slate-800 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>
                        All stands
                      </button>
                      {blockLevels.map((l) => (
                        <button key={l} onClick={() => setLevelView(l)} className={`px-2.5 py-1 rounded-full font-bold ${levelView === l ? "bg-slate-800 text-white" : "bg-white border border-slate-300 text-slate-600"}`}>
                          {l}
                        </button>
                      ))}
                      <span className="px-2 text-slate-500">Tap a block to see its seats</span>
                    </>
                  )}
                  {openBlock && (
                    <span className="ml-auto flex items-center gap-1">
                      <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} className="w-7 h-7 rounded-full border border-slate-300 bg-white font-bold text-slate-700" aria-label="Zoom out">−</button>
                      <span className="w-10 text-center font-mono text-slate-600">{Math.round(zoom * 100)}%</span>
                      <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="w-7 h-7 rounded-full border border-slate-300 bg-white font-bold text-slate-700" aria-label="Zoom in">+</button>
                    </span>
                  )}
                </div>
              )}
          <div ref={scrollRef} className={`flex-1 overflow-auto p-6 flex justify-center relative ${blocks.length > 0 ? "pt-16" : ""} ${openBlock ? "items-start" : "items-center"}`}>
            <div className={`relative border border-slate-200 rounded-xl bg-slate-50 p-4 shadow-inner flex justify-center ${blocks.length > 0 ? "flex-col items-stretch" : "items-center"} ${deviceMode === "mobile" ? "w-full" : openBlock ? "w-full max-w-[1000px] overflow-x-auto" : "min-w-[700px] min-h-[500px]"}`}>
              <svg width="760" height="540" viewBox={vb ? vb.slice(0, 4).join(" ") : viewBox} className={openBlock ? "w-full" : "w-full h-full"} style={openBlock && targetVB[3] ? { aspectRatio: `${targetVB[2]} / ${targetVB[3]}`, height: "auto", width: `${zoom * 100}%`, maxWidth: "none", alignSelf: "flex-start" } : undefined}>
                {/* Render Stages / Sports Courts */}
                {objects
                  .filter((o) => o.type === "stage" || o.type === "sports_court")
                  .map((obj) => (
                    <g key={obj.id}>
                      <rect
                        x={obj.x - obj.width / 2}
                        y={obj.y - obj.height / 2}
                        width={obj.width}
                        height={obj.height}
                        fill={obj.color}
                        rx="12"
                        stroke="#22c55e"
                        strokeWidth="2"
                        opacity="0.85"
                      />
                      <text
                        x={obj.x}
                        y={obj.y + 4}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="18"
                        fontWeight="bold"
                      >
                        {obj.name.toUpperCase()}
                      </text>
                    </g>
                  ))}

                {/* Render General Admission Zones */}
                {objects
                  .filter((o) => o.type === "general_admission")
                  .map((obj) => (
                    <g key={obj.id}>
                      <rect
                        x={obj.x - obj.width / 2}
                        y={obj.y - obj.height / 2}
                        width={obj.width}
                        height={obj.height}
                        fill={obj.color}
                        rx="8"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        opacity="0.75"
                      />
                      <text
                        x={obj.x}
                        y={obj.y - 6}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="16"
                        fontWeight="bold"
                      >
                        {obj.name}
                      </text>
                      <text
                        x={obj.x}
                        y={obj.y + 16}
                        textAnchor="middle"
                        fill="#fef08a"
                        fontSize="14"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {obj.standingCapacity?.toLocaleString()} Standing • {obj.price} ETB
                      </text>
                    </g>
                  ))}

                {/* Render free shapes and venue elements (screen, exits, restrooms ...) */}
                {objects
                  .filter((o) => o.type === "shape")
                  .map((obj) => {
                    const kind = obj.shapeKind || "rect";
                    const w = obj.width;
                    const h = obj.height;
                    const common = {
                      fill: obj.color,
                      stroke: obj.strokeColor || "#0f172a",
                      strokeWidth: obj.strokeWidth ?? 1.5,
                      opacity: obj.opacity ?? 0.92,
                    };
                    return (
                      <g key={obj.id} transform={`${ang ? `rotate(${ang} ${pivotRef.current.x} ${pivotRef.current.y}) ` : ""}translate(${obj.x} ${obj.y}) rotate(${obj.rotation || 0})`} style={{ opacity: openBlock ? 0.3 : 1, transition: "opacity .5s ease" }}>
                        {kind === "icon" ? (
                          <>
                            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={Math.min(12, h / 3)} fill="#ffffff" stroke={obj.color || "#94a3b8"} strokeWidth={2} />
                            <text x={0} y={h * 0.22} textAnchor="middle" fontSize={h * 0.58}>{obj.iconGlyph || "?"}</text>
                            {obj.label && (
                              <text x={0} y={h / 2 + 14} textAnchor="middle" fill="#475569" fontSize={10} fontWeight="bold">{obj.label}</text>
                            )}
                          </>
                        ) : kind === "curve" ? (
                          <>
                            <defs>
                              <linearGradient id={`glow-${obj.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={obj.color} stopOpacity="0.28" />
                                <stop offset="100%" stopColor={obj.color} stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            <path
                              d={`M ${-w / 2} ${h / 2} Q 0 ${h / 2 - Math.min(1, Math.max(0.05, obj.curveDepth ?? 1)) * 2 * h} ${w / 2} ${h / 2} L ${w / 2 + w * 0.04} ${h / 2 + Math.max(60, h * 1.6)} L ${-w / 2 - w * 0.04} ${h / 2 + Math.max(60, h * 1.6)} Z`}
                              fill={`url(#glow-${obj.id})`}
                            />
                            <path
                              d={`M ${-w / 2} ${h / 2} Q 0 ${h / 2 - Math.min(1, Math.max(0.05, obj.curveDepth ?? 1)) * 2 * h} ${w / 2} ${h / 2}`}
                              fill="none"
                              stroke={obj.color}
                              strokeWidth={Math.max(2, obj.strokeWidth ?? 5)}
                              strokeLinecap="round"
                            />
                          </>
                        ) : kind === "polygon" ? (
                          <polygon points={(obj.points || []).join(" ")} {...common} />
                        ) : kind === "ellipse" ? (
                          <ellipse rx={w / 2} ry={h / 2} {...common} />
                        ) : kind === "triangle" ? (
                          <polygon points={`0,${-h / 2} ${w / 2},${h / 2} ${-w / 2},${h / 2}`} {...common} />
                        ) : kind === "diamond" ? (
                          <polygon points={`0,${-h / 2} ${w / 2},0 0,${h / 2} ${-w / 2},0`} {...common} />
                        ) : (
                          <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={kind === "line" ? 2 : obj.cornerRadius ?? 6} {...common} />
                        )}
                        {obj.label && kind !== "line" && kind !== "icon" && (
                          <text
                            x={kind === "polygon" ? polyCentroid(obj.points || [0, 0]).x : 0}
                            y={kind === "polygon" ? polyCentroid(obj.points || [0, 0]).y + (obj.fontSize || 12) / 3 : kind === "curve" ? h / 2 + 22 : (obj.fontSize || 12) / 3}
                            textAnchor="middle"
                            fontStyle={kind === "curve" ? "italic" : undefined}
                            fill={obj.textColor || (kind === "curve" ? "#64748b" : "#ffffff")}
                            fontSize={obj.fontSize || 12}
                            fontWeight="bold"
                          >
                            {obj.label}
                          </text>
                        )}
                      </g>
                    );
                  })}

                {/* Stadium blocks: shapes with name and price; tap one to open its seats */}
                {blocks
                  .map((b) => {
                    const pts = (() => {
                      const flat = rotatePoints(b.points || [], b.rotation || 0).map((v, i) => (i % 2 === 0 ? v + b.x : v + b.y));
                      if (!ang) return flat;
                      const turned: number[] = [];
                      for (let i = 0; i + 1 < flat.length; i += 2) turned.push(...spin(flat[i], flat[i + 1]));
                      return turned;
                    })();
                    const c = polyCentroid(pts);
                    const pb = polyBounds(pts);
                    const info = blockInfo.get(b.id);
                    const faded = !openBlock && levelView !== "all" && b.level !== levelView;
                    const isOpen = openBlock?.id === b.id;
                    const others = !!openBlock && !isOpen;
                    const fs = Math.max(11, Math.min(26, (pb.maxX - pb.minX) / 9));
                    return (
                      <g
                        key={`block-${b.id}`}
                        opacity={faded ? 0.2 : 1}
                        style={{ cursor: isOpen || faded ? "default" : "pointer", transition: "opacity .5s ease" }}
                        onClick={() => {
                          if (!isOpen && !faded) {
                            setSelectedSeat(null);
                            setOpenBlockId(b.id);
                          }
                        }}
                      >
                        <polygon
                          points={pts.join(" ")}
                          style={{ transition: "fill .5s ease, stroke .5s ease" }}
                          fill={isOpen ? `${b.color}10` : others ? "#e2e8f0" : b.color}
                          fillOpacity={isOpen || others ? 1 : 0.85}
                          stroke={others ? "#cbd5e1" : b.color}
                          strokeWidth={isOpen ? 1.5 : 2}
                          strokeLinejoin="round"
                        />
                        {others && (
                          <text x={c.x} y={c.y + fs * 0.3} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#94a3b8" pointerEvents="none">
                            {b.name.toUpperCase()}
                          </text>
                        )}
                        {!openBlock && (
                          <g pointerEvents="none" textAnchor="middle" fill="#ffffff" fontWeight="bold">
                            <text x={c.x} y={c.y - fs * 0.1} fontSize={fs}>{b.name.toUpperCase()}</text>
                            <text x={c.x} y={c.y + fs * 0.95} fontSize={Math.max(9, fs * 0.55)} fontWeight="normal" opacity={0.92}>
                              {info ? `${info.count} seats${info.price ? ` · ${info.price}` : ""}` : ""}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                {/* Seats: shape and size follow the layout, seat numbers inside */}
                <g style={{ opacity: openBlock ? (seatsOn ? 1 : 0) : 1, transition: "opacity .45s ease" }}>
                {viewSeats.map((seat) => {
                  const owner = objects.find((o) => o.id === seat.sectionId);
                  const showNumber = owner?.showSeatNumbers !== false;
                  const isSelected = selectedSeat?.id === seat.id;
                  const color = isSelected ? "#10b981" : seat.color || "#16a34a";
                  const fill = isSelected ? "#10b981" : `${color}2b`;
                  const shape = seat.shape || "square";
                  const common = {
                    className: "cursor-pointer transition-all",
                    onClick: () => setSelectedSeat(seat),
                  };
                  const base = seat.size || 14;
                  const sz = isSelected ? base + 2 : base;
                  const k = sz / 14;
                  const fs = Math.max(2.5, sz * 0.5);
                  const numText = /^\d$/.test(seat.seatNumber) ? `0${seat.seatNumber}` : seat.seatNumber;
                  const number = (cx: number) =>
                    showNumber && (sz >= 10 || !!openBlock) ? (
                      <text x={cx} y={seat.y + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight="bold" fill={isSelected ? "#ffffff" : color} pointerEvents="none">
                        {numText}
                      </text>
                    ) : null;
                  if (shape === "round") {
                    return (
                      <g key={seat.id} {...common}>
                        <circle cx={seat.x} cy={seat.y} r={sz / 2 + 0.5 * k} fill={fill} stroke={color} strokeWidth={1.6 * k} />
                        {number(seat.x)}
                      </g>
                    );
                  }
                  if (shape === "wheelchair") {
                    return (
                      <g key={seat.id} {...common}>
                        <circle cx={seat.x} cy={seat.y} r={sz / 2 + 1.5 * k} fill={color} />
                        <text x={seat.x} y={seat.y + 4 * k} textAnchor="middle" fill="#ffffff" fontSize={11 * k}>♿</text>
                      </g>
                    );
                  }
                  const natural = sz * (shape === "couple" ? 1.9 : shape === "recliner" ? 1.45 : 1);
                  const w = seat.slotWidth && shape !== "square" ? Math.min(natural, Math.max(sz, seat.slotWidth - 4)) : natural;
                  return (
                    <g key={seat.id} {...common}>
                      <rect x={seat.x - w / 2} y={seat.y - sz / 2} width={w} height={sz} rx={(shape === "square" ? 3 : 5) * k} fill={fill} stroke={color} strokeWidth={1.4 * k} />
                      {shape !== "square" && <rect x={seat.x - w / 2} y={seat.y - sz / 2} width={w} height={4 * k} rx={2 * k} fill={color} />}
                      {shape === "couple" && <line x1={seat.x} y1={seat.y - sz / 2 + 2 * k} x2={seat.x} y2={seat.y + sz / 2 - 2 * k} stroke={color} strokeWidth={1 * k} />}
                      {number(seat.x)}
                    </g>
                  );
                })}
                </g>

                {/* Block headings: price and name, with a line under them */}
                {objects
                  .filter((o) => (o.type === "grid_stand" || o.type === "curved_stand") && o.showTierHeading !== false)
                  .map((obj) => {
                    const price = standPriceText(obj, seatTypes);
                    if (obj.type === "grid_stand") {
                      const f = gridStandSize(obj, seatTypes);
                      const anchor = standHeadingAnchor(obj, f.width, f.height);
                      const align = obj.headingAlign || "center";
                      const fs = obj.headingFontSize || 12;
                      return (
                        <g key={`${obj.id}-heading`}>
                          <text
                            x={obj.x + anchor.x}
                            y={obj.y + anchor.y + fs}
                            textAnchor={align === "left" ? "start" : align === "right" ? "end" : "middle"}
                            fontSize={fs}
                            fontWeight="bold"
                            fill="#334155"
                          >
                            {standHeadingText(obj, seatTypes)}
                          </text>
                          <line x1={obj.x - f.width / 2} y1={obj.y - f.height / 2 - 8} x2={obj.x + f.width / 2} y2={obj.y - f.height / 2 - 8} stroke="#cbd5e1" strokeWidth="1" />
                        </g>
                      );
                    }
                    const outer = obj.outerRadius || 340;
                    const mid = (((obj.startAngle || 0) + (obj.sweepAngle || 90) / 2) * Math.PI) / 180;
                    const lx = obj.x + (outer + 24) * Math.cos(mid);
                    const ly = obj.y + (outer + 24) * Math.sin(mid);
                    return (
                      <g key={`${obj.id}-heading`} textAnchor="middle">
                        <text x={lx} y={ly} fontSize="12" fontWeight="bold" fill="#334155">{obj.name.toUpperCase()}</text>
                        <text x={lx} y={ly + 14} fontSize="10" fill="#64748b">{price}</text>
                      </g>
                    );
                  })}

                {/* Row names in one column at the far left and right of the whole layout */}
                {(() => {
                  const cols = rowLabelColumns(objects, seatTypes);
                  if (!cols) return null;
                  return (
                    <g fill="#475569" fontSize="11" fontWeight="bold" textAnchor="middle">
                      {[cols.left, cols.right].map((cx) => (
                        <rect key={`strip-${cx}`} x={cx - 14} y={cols.top - 14} width={28} height={cols.bottom - cols.top + 28} rx={10} fill="#e2e8f0" />
                      ))}
                      {cols.entries.map((e) => (
                        <g key={e.key}>
                          <text x={cols.left} y={e.y + 4}>{e.label}</text>
                          <text x={cols.right} y={e.y + 4}>{e.label}</text>
                        </g>
                      ))}
                    </g>
                  );
                })()}

                {/* Row names of the opened stadium block: just beyond both ends of every row, along the row */}
                {openBlock &&
                  seatsOn &&
                  (() => {
                    const rows = new Map<string, UniversalSeat[]>();
                    viewSeats.forEach((seat) => {
                      const list = rows.get(seat.rowLabel);
                      if (list) list.push(seat);
                      else rows.set(seat.rowLabel, [seat]);
                    });
                    const out: React.ReactNode[] = [];
                    rows.forEach((list, label) => {
                      const size = list[0].size || 14;
                      const lm = blockLabelMetrics(openBlock, size);
                      const reach = lm.reach;
                      const fs = lm.fs;
                      const end = (seat: UniversalSeat, other: UniversalSeat | undefined, key: string) => {
                        let dx = other ? seat.x - other.x : -1;
                        let dy = other ? seat.y - other.y : 0;
                        const len = Math.hypot(dx, dy) || 1;
                        dx /= len;
                        dy /= len;
                        out.push(
                          <text key={`${key}-${label}`} x={seat.x + dx * reach} y={seat.y + dy * reach + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight="bold" fill="#475569" pointerEvents="none">
                            {label}
                          </text>
                        );
                      };
                      end(list[0], list[1], "a");
                      if (list.length > 1) end(list[list.length - 1], list[list.length - 2], "z");
                    });
                    return out;
                  })()}

                {/* Row names beside the block: curved stands, and grid blocks set to show them there */}
                {objects
                  .filter((o) => (o.type === "grid_stand" || o.type === "curved_stand") && o.showRowLabels !== false && !usesLabelColumns(o))
                  .flatMap((obj) => {
                    const mine = allSeats.filter((seat) => seat.sectionId === obj.id);
                    const ends = new Map<string, { first: (typeof mine)[number]; last: (typeof mine)[number] }>();
                    mine.forEach((seat) => {
                      const cur = ends.get(seat.rowLabel);
                      if (!cur) ends.set(seat.rowLabel, { first: seat, last: seat });
                      else cur.last = seat;
                    });
                    const frame = obj.type === "grid_stand" ? gridStandSize(obj, seatTypes) : null;
                    return Array.from(ends.entries()).map(([label, { first }]) => (
                      <g key={`${obj.id}-row-${label}`} fill="#475569" fontSize="11" fontWeight="bold">
                        {frame ? (
                          <>
                            <text x={obj.x - frame.width / 2 - 4} y={first.y + 4} textAnchor="end">{label}</text>
                            <text x={obj.x + frame.width / 2 + 4} y={first.y + 4} textAnchor="start">{label}</text>
                          </>
                        ) : (
                          <text x={first.x - ((first.size || 14) * (first.widthFactor || 1)) / 2 - 10} y={first.y + 4} textAnchor="end">{label}</text>
                        )}
                      </g>
                    ));
                  })}

                {/* Free text */}
                {objects
                  .filter((o) => o.type === "text_label")
                  .map((obj) => {
                    const lines = (obj.label || "").split("\n");
                    const align = obj.textAlign || "center";
                    const fs = obj.fontSize || 16;
                    const anchorX = align === "left" ? -obj.width / 2 + 1 : align === "right" ? obj.width / 2 - 1 : 0;
                    return (
                      <g key={obj.id} transform={`translate(${obj.x} ${obj.y}) rotate(${obj.rotation || 0})`}>
                        <text
                          textAnchor={align === "left" ? "start" : align === "right" ? "end" : "middle"}
                          fontFamily="sans-serif"
                          fontSize={fs}
                          fontWeight={obj.textBold !== false ? "bold" : "normal"}
                          fontStyle={obj.textItalic ? "italic" : "normal"}
                          fill={obj.textColor || obj.color || "#0f172a"}
                          opacity={obj.opacity ?? 1}
                        >
                          {lines.map((line, i) => (
                            <tspan key={i} x={anchorX} y={-obj.height / 2 + fs * 0.8 + i * fs}>
                              {line || " "}
                            </tspan>
                          ))}
                        </text>
                      </g>
                    );
                  })}

                {/* Render Gates */}
                {objects
                  .filter((o) => o.type === "gate")
                  .map((obj) => (
                    <g key={obj.id}>
                      <rect
                        x={obj.x - 45}
                        y={obj.y - 12}
                        width="90"
                        height="24"
                        fill="#7c3aed"
                        rx="6"
                        stroke="#ffffff"
                        strokeWidth="1"
                      />
                      <text
                        x={obj.x}
                        y={obj.y + 4}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="bold"
                      >
                        {obj.name}
                      </text>
                    </g>
                  ))}
              </svg>
            </div>
          </div>

          {/* Seat Inspector Floating Drawer */}
          {selectedSeat && (
            <div className="absolute bottom-4 right-4 bg-white border border-slate-300 rounded-xl p-4 w-72 shadow-2xl text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">Selected Seat</span>
                <button
                  onClick={() => setSelectedSeat(null)}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 text-slate-700 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Seat ID:</span>
                  <span className="font-bold text-slate-900">{selectedSeat.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Row:</span>
                  <span className="font-bold text-slate-900">{selectedSeat.rowLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Seat No:</span>
                  <span className="font-bold text-slate-900">{selectedSeat.seatNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Price:</span>
                  <span className="font-bold text-emerald-600">{selectedSeat.price} ETB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 font-bold text-[10px]">
                    AVAILABLE
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  alert(`Holding seat ${selectedSeat.id} for 10 minutes`);
                }}
                className="w-full py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 text-white font-bold rounded-lg transition-all shadow-md"
              >
                Simulate Book Seat ({selectedSeat.price} ETB)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
