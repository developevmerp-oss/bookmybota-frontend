"use client";

import { useEffect, useMemo, useRef } from "react";

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
  /** Cap drawn seats so large venue maps stay interactive in the admin form. */
  maxSeats?: number;
};

const MAX_PREVIEW_SEATS = 500;

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

/** Lightweight read-only seating map (canvas) for organizers picking a published venue layout. */
export default function VenueLayoutMapPreview({
  seats: seatsRaw,
  seatingConfig,
  className = "",
  height = 280,
  maxSeats = MAX_PREVIEW_SEATS,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const seats = useMemo(() => asSeats(seatsRaw, maxSeats), [seatsRaw, maxSeats]);
  const labels = useMemo(() => asLabels(seatingConfig), [seatingConfig]);
  const shapes = useMemo(() => asShapes(seatingConfig), [seatingConfig]);

  const canvasW = Number(seatingConfig?.canvasWidth) || 800;
  const canvasH = Number(seatingConfig?.canvasHeight) || 600;
  const totalSeatCount = Array.isArray(seatsRaw) ? seatsRaw.length : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = Math.max(container.clientWidth - 8, 120);
    const scale = Math.min(cssWidth / canvasW, height / canvasH, 1);
    const drawW = Math.max(1, Math.floor(canvasW * scale));
    const drawH = Math.max(1, Math.floor(canvasH * scale));

    canvas.width = Math.floor(drawW * dpr);
    canvas.height = Math.floor(drawH * dpr);
    canvas.style.width = `${drawW}px`;
    canvas.style.height = `${drawH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvasW, canvasH);

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

    const radius = Math.max(4, Math.min(10, 12));
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
  }, [seats, labels, shapes, canvasW, canvasH, height]);

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
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center"
        style={{ height }}
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
