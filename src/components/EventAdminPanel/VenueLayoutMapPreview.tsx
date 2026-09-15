"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, X, ZoomIn } from "lucide-react";
import { createPortal } from "react-dom";

type PreviewSeat = {
  x: number;
  y: number;
};

type PreviewLabel = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
};

type PreviewShape = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  text?: string;
};

type Props = {
  seats?: unknown[] | null;
  seatingConfig?: Record<string, unknown> | null;
  className?: string;
  height?: number;
  /** Cap drawn seats in compact strip; expanded view draws more. */
  maxSeats?: number;
  title?: string;
  /** Show expand / zoom controls (default true). */
  enableZoom?: boolean;
};

const MAX_PREVIEW_SEATS_COMPACT = 800;
const MAX_PREVIEW_SEATS_EXPANDED = 8000;

function asSeats(raw: unknown, maxSeats: number): PreviewSeat[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      return [];
    }
  }
  if (list.length === 0) return [];
  const step = list.length > maxSeats ? Math.ceil(list.length / maxSeats) : 1;
  const out: PreviewSeat[] = [];
  for (let i = 0; i < list.length; i += step) {
    const row = list[i] as Record<string, unknown>;
    const x = Number(row.coordinate_x);
    const y = Number(row.coordinate_y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ x, y });
  }
  return out;
}

function asLabels(config: Record<string, unknown> | null | undefined): PreviewLabel[] {
  const labels = config?.labels;
  if (!Array.isArray(labels)) return [];
  return labels
    .map((l) => {
      const row = l as Record<string, unknown>;
      return {
        text: String(row.text ?? ""),
        x: Number(row.x) || 0,
        y: Number(row.y) || 0,
        fontSize: Number(row.fontSize) || 14,
      };
    })
    .filter((l) => l.text);
}

function asShapes(config: Record<string, unknown> | null | undefined): PreviewShape[] {
  const shapes = config?.shapes;
  if (!Array.isArray(shapes)) return [];
  return shapes
    .map((s) => {
      const row = s as Record<string, unknown>;
      return {
        x: Number(row.x) || 0,
        y: Number(row.y) || 0,
        width: Number(row.width) || 0,
        height: Number(row.height) || 0,
        fill: String(row.fill || "#e2e8f0"),
        text: row.text != null ? String(row.text) : undefined,
      };
    })
    .filter((s) => s.width > 0 && s.height > 0);
}

function drawMap(
  canvas: HTMLCanvasElement,
  opts: {
    seats: PreviewSeat[];
    labels: PreviewLabel[];
    shapes: PreviewShape[];
    canvasW: number;
    canvasH: number;
    cssWidth: number;
    cssHeight: number;
    userScale: number;
    offsetX: number;
    offsetY: number;
  }
) {
  const {
    seats,
    labels,
    shapes,
    canvasW,
    canvasH,
    cssWidth,
    cssHeight,
    userScale,
    offsetX,
    offsetY,
  } = opts;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const fit = Math.min(cssWidth / canvasW, cssHeight / canvasH);
  const scale = fit * userScale;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1 / scale;
  ctx.strokeRect(0, 0, canvasW, canvasH);

  for (const shape of shapes) {
    ctx.fillStyle = shape.fill || "#e2e8f0";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1 / scale;
    ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
    ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    if (shape.text) {
      ctx.fillStyle = "#475569";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(shape.text, shape.x + shape.width / 2, shape.y + shape.height / 2);
    }
  }

  const radius = Math.max(3, Math.min(10, 10));
  for (const seat of seats) {
    ctx.beginPath();
    ctx.arc(seat.x, seat.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#3b82f6";
    ctx.fill();
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 1 / scale;
    ctx.stroke();
  }

  for (const label of labels) {
    ctx.fillStyle = "#334155";
    ctx.font = `${label.fontSize}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(label.text, label.x, label.y);
  }

  ctx.restore();
}

function MapCanvas({
  seatsRaw,
  seatingConfig,
  height,
  maxSeats,
  className = "",
}: {
  seatsRaw?: unknown[] | null;
  seatingConfig?: Record<string, unknown> | null;
  height: number;
  maxSeats: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userScale, setUserScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const scaleRef = useRef(userScale);
  const offsetRef = useRef(offset);

  useEffect(() => {
    scaleRef.current = userScale;
  }, [userScale]);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const seats = useMemo(() => asSeats(seatsRaw, maxSeats), [seatsRaw, maxSeats]);
  const labels = useMemo(() => asLabels(seatingConfig), [seatingConfig]);
  const shapes = useMemo(() => asShapes(seatingConfig), [seatingConfig]);
  const canvasW = Number(seatingConfig?.canvasWidth) || 3200;
  const canvasH = Number(seatingConfig?.canvasHeight) || 2400;
  const totalSeatCount = Array.isArray(seatsRaw) ? seatsRaw.length : 0;

  const fitOffset = useCallback(
    (cssWidth: number, cssHeight: number, scale: number) => {
      const fit = Math.min(cssWidth / canvasW, cssHeight / canvasH);
      const drawnW = canvasW * fit * scale;
      const drawnH = canvasH * fit * scale;
      return {
        x: (cssWidth - drawnW) / 2,
        y: (cssHeight - drawnH) / 2,
      };
    },
    [canvasW, canvasH]
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const cssWidth = Math.max(container.clientWidth, 120);
    const cssHeight = Math.max(height, 120);
    drawMap(canvas, {
      seats,
      labels,
      shapes,
      canvasW,
      canvasH,
      cssWidth,
      cssHeight,
      userScale: scaleRef.current,
      offsetX: offsetRef.current.x,
      offsetY: offsetRef.current.y,
    });
  }, [seats, labels, shapes, canvasW, canvasH, height]);

  // Center map on first layout / size change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cssWidth = Math.max(container.clientWidth, 120);
    const next = fitOffset(cssWidth, height, 1);
    setUserScale(1);
    setOffset(next);
  }, [canvasW, canvasH, height, fitOffset, seatsRaw]);

  useEffect(() => {
    redraw();
  }, [redraw, userScale, offset]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const current = scaleRef.current;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const next = Math.min(Math.max(Number((current * factor).toFixed(3)), 0.25), 4);
      const ox = offsetRef.current.x;
      const oy = offsetRef.current.y;
      const cssWidth = Math.max(container.clientWidth, 120);
      const fit = Math.min(cssWidth / canvasW, height / canvasH);
      // Keep point under cursor stable
      const contentX = (mx - ox) / (fit * current);
      const contentY = (my - oy) / (fit * current);
      const newOx = mx - contentX * fit * next;
      const newOy = my - contentY * fit * next;
      setUserScale(next);
      setOffset({ x: newOx, y: newOy });
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [canvasW, canvasH, height]);

  useEffect(() => {
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [redraw]);

  const zoomBy = (factor: number) => {
    const container = containerRef.current;
    if (!container) return;
    const cssWidth = Math.max(container.clientWidth, 120);
    const next = Math.min(Math.max(Number((scaleRef.current * factor).toFixed(3)), 0.25), 4);
    setUserScale(next);
    setOffset(fitOffset(cssWidth, height, next));
  };

  const resetView = () => {
    const container = containerRef.current;
    if (!container) return;
    const cssWidth = Math.max(container.clientWidth, 120);
    setUserScale(1);
    setOffset(fitOffset(cssWidth, height, 1));
  };

  if (seats.length === 0 && shapes.length === 0) {
    return (
      <div
        className={`rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-8 text-center text-xs text-slate-500 ${className}`}
      >
        This published layout has no seat map drawn yet.
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.2)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-50"
            aria-label="Zoom out"
          >
            <Minus size={14} />
          </button>
          <span className="min-w-[3.25rem] text-center text-xs font-semibold text-slate-600 tabular-nums">
            {Math.round(userScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(1.2)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-50"
            aria-label="Zoom in"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50"
          >
            Fit
          </button>
        </div>
        <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
          <ZoomIn size={12} /> Scroll to zoom · drag to pan
        </p>
      </div>

      <div
        ref={containerRef}
        className={`overflow-hidden rounded-lg border border-slate-200 bg-slate-50 touch-none ${
          isPanning ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ height }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          setIsPanning(true);
          panStart.current = {
            x: e.clientX,
            y: e.clientY,
            ox: offsetRef.current.x,
            oy: offsetRef.current.y,
          };
        }}
        onPointerMove={(e) => {
          if (!panStart.current) return;
          const dx = e.clientX - panStart.current.x;
          const dy = e.clientY - panStart.current.y;
          setOffset({ x: panStart.current.ox + dx, y: panStart.current.oy + dy });
        }}
        onPointerUp={() => {
          setIsPanning(false);
          panStart.current = null;
        }}
        onPointerCancel={() => {
          setIsPanning(false);
          panStart.current = null;
        }}
      >
        <canvas ref={canvasRef} />
      </div>

      {totalSeatCount > seats.length ? (
        <p className="text-[11px] text-emerald-800/80">
          Showing {seats.length} of {totalSeatCount} seats in this preview.
        </p>
      ) : null}
    </div>
  );
}

/** Read-only seating map with zoom/pan for organizers picking a published venue layout. */
export default function VenueLayoutMapPreview({
  seats: seatsRaw,
  seatingConfig,
  className = "",
  height = 280,
  maxSeats = MAX_PREVIEW_SEATS_COMPACT,
  title = "Seating layout",
  enableZoom = true,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  if (!enableZoom) {
    return (
      <MapCanvas
        seatsRaw={seatsRaw}
        seatingConfig={seatingConfig}
        height={height}
        maxSeats={maxSeats}
        className={className}
      />
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700"
        >
          <Maximize2 size={13} /> Open full map
        </button>
      </div>

      <MapCanvas
        seatsRaw={seatsRaw}
        seatingConfig={seatingConfig}
        height={height}
        maxSeats={maxSeats}
      />

      {mounted &&
        expanded &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col p-2 sm:p-4">
            <div className="flex items-center justify-between gap-3 pb-3 px-1 text-white border-b border-white/10 mb-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Full seating map
                </p>
                <h3 className="text-lg font-bold truncate">{title}</h3>
                <p className="text-xs text-zinc-300">Zoom and pan — same as Super Admin layout view</p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold border border-white/10"
              >
                <X size={16} /> Close
              </button>
            </div>
            <div className="flex-1 min-h-0 bg-white rounded-2xl overflow-hidden border border-slate-200 p-3 sm:p-4">
              <MapCanvas
                seatsRaw={seatsRaw}
                seatingConfig={seatingConfig}
                height={typeof window !== "undefined" ? Math.max(window.innerHeight - 140, 420) : 560}
                maxSeats={MAX_PREVIEW_SEATS_EXPANDED}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
