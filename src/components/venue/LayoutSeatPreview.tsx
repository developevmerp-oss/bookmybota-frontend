import { useState } from "react";

type SeatLike = {
  coordinate_x?: number;
  coordinate_y?: number;
  color?: string | null;
  section_name?: string | null;
  status?: string | null;
};

type ShapeLike = {
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  text?: string;
  rotation?: number;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
};

type LabelLike = {
  x?: number;
  y?: number;
  text?: string;
  fontSize?: number;
  rotation?: number;
};

type ConfigLike = {
  shapes?: ShapeLike[];
  labels?: LabelLike[];
  sectionColors?: Record<string, string>;
};

function asSeats(value: unknown): SeatLike[] {
  return Array.isArray(value) ? (value as SeatLike[]) : [];
}

function asConfig(value: unknown): ConfigLike {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? (parsed as ConfigLike) : {};
    } catch {
      return {};
    }
  }
  if (typeof value !== "object") return {};
  return value as ConfigLike;
}

function asShapes(config: ConfigLike): ShapeLike[] {
  return Array.isArray(config.shapes) ? config.shapes : [];
}

function asLabels(config: ConfigLike): LabelLike[] {
  return Array.isArray(config.labels) ? config.labels : [];
}

function normalizeHex(color: unknown): string | null {
  if (typeof color !== "string") return null;
  const raw = color.trim();
  if (!raw) return null;
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw;
  if (/^[0-9a-fA-F]{3,8}$/.test(raw)) return `#${raw}`;
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = normalizeHex(hex);
  if (!h) return null;
  const full =
    h.length === 4
      ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
      : h.slice(0, 7);
  const n = Number.parseInt(full.slice(1), 16);
  if (!Number.isFinite(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Match studio: dark text on light fills, light text on dark fills. */
function contrastTextColor(fill: string | undefined): string {
  const rgb = hexToRgb(fill || "#334155");
  if (!rgb) return "#f8fafc";
  const lum = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return lum > 0.55 ? "#1e293b" : "#f8fafc";
}

function defaultSectionColor(sectionName: string): string {
  const name = (sectionName || "").toLowerCase();
  if (name.includes("vip") || name.includes("premium")) return "#f59e0b";
  if (name.includes("category 1") || name.includes("cat 1")) return "#dc2626";
  if (name.includes("category 2") || name.includes("cat 2")) return "#2563eb";
  if (name.includes("category 3") || name.includes("cat 3")) return "#16a34a";
  if (name.includes("away")) return "#9333ea";
  if (name.includes("south")) return "#f97316";
  if (name.includes("platinum")) return "#06b6d4";
  if (name.includes("gold")) return "#a855f7";
  if (name.includes("recliner")) return "#0284c7";
  if (name.includes("prime")) return "#3b82f6";
  if (name.includes("classic")) return "#6366f1";
  return "#3b82f6";
}

function resolveSeatFill(seat: SeatLike, sectionColors?: Record<string, string>): string {
  if (seat.status && String(seat.status).toUpperCase() !== "AVAILABLE") {
    return "#991b1b";
  }
  const own = normalizeHex(seat.color);
  if (own) return own;
  const section = String(seat.section_name || "General").trim() || "General";
  const fromMap = sectionColors ? normalizeHex(sectionColors[section]) : null;
  if (fromMap) return fromMap;
  return defaultSectionColor(section);
}

/** Axis-aligned bounds of a possibly rotated rectangle. */
function rotatedRectBounds(x: number, y: number, w: number, h: number, rotationDeg = 0) {
  if (!rotationDeg) {
    return { minX: x, minY: y, maxX: x + w, maxY: y + h };
  }
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ].map(([px, py]) => {
    const dx = px - cx;
    const dy = py - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  });
  return {
    minX: Math.min(...corners.map((c) => c[0])),
    minY: Math.min(...corners.map((c) => c[1])),
    maxX: Math.max(...corners.map((c) => c[0])),
    maxY: Math.max(...corners.map((c) => c[1])),
  };
}

function ShapeVisual({ shape }: { shape: ShapeLike }) {
  const x = Number(shape.x) || 0;
  const y = Number(shape.y) || 0;
  const w = Math.max(0, Number(shape.width) || 0);
  const h = Math.max(0, Number(shape.height) || 0);
  const type = (shape.type || "rect").toLowerCase();
  const fill = normalizeHex(shape.fill) || shape.fill || "#475569";
  const stroke = normalizeHex(shape.stroke) || shape.stroke || "rgba(255,255,255,0.25)";
  const strokeWidth = Number(shape.strokeWidth) || 1;
  const opacity = typeof shape.opacity === "number" ? shape.opacity : 1;
  const rx =
    typeof shape.cornerRadius === "number"
      ? shape.cornerRadius
      : type === "roundrect" || type === "zone"
        ? 12
        : type === "stage" || type === "screen"
          ? 4
          : 4;

  const common = { fill, stroke, strokeWidth, opacity };

  if (type === "circle" || type === "ellipse") {
    return (
      <ellipse
        cx={x + w / 2}
        cy={y + h / 2}
        rx={w / 2}
        ry={h / 2}
        {...common}
      />
    );
  }

  if (type === "diamond") {
    const points = [
      `${x + w / 2},${y}`,
      `${x + w},${y + h / 2}`,
      `${x + w / 2},${y + h}`,
      `${x},${y + h / 2}`,
    ].join(" ");
    return <polygon points={points} {...common} />;
  }

  if (type === "triangle") {
    const points = [`${x + w / 2},${y}`, `${x + w},${y + h}`, `${x},${y + h}`].join(" ");
    return <polygon points={points} {...common} />;
  }

  return <rect x={x} y={y} width={w} height={h} rx={rx} ry={rx} {...common} />;
}

function MultilineSvgText({
  text,
  x,
  y,
  fontSize,
  fill,
  fontWeight = 700,
  /** Konva shape labels are centered; icon/text labels use top-left like Konva Text. */
  align = "center",
}: {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  fontWeight?: number;
  align?: "center" | "start";
}) {
  const lines = String(text).split("\n");
  const textAnchor = align === "center" ? "middle" : "start";
  const dominantBaseline = align === "center" ? "middle" : "text-before-edge";

  if (lines.length <= 1) {
    return (
      <text
        x={x}
        y={y}
        fill={fill}
        fontSize={fontSize}
        fontWeight={fontWeight}
        textAnchor={textAnchor}
        dominantBaseline={dominantBaseline}
      >
        {text}
      </text>
    );
  }

  const lineHeight = fontSize * 1.15;
  if (align === "center") {
    const startY = y - ((lines.length - 1) * lineHeight) / 2;
    return (
      <text
        x={x}
        y={startY}
        fill={fill}
        fontSize={fontSize}
        fontWeight={fontWeight}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {lines.map((line, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    );
  }

  return (
    <text
      x={x}
      y={y}
      fill={fill}
      fontSize={fontSize}
      fontWeight={fontWeight}
      textAnchor="start"
      dominantBaseline="text-before-edge"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

export default function LayoutSeatPreview({
  seats,
  config,
  className = "",
  heightClass = "h-28",
  selectedBlockId: controlledSelectedBlockId,
  onSelectBlock: controlledOnSelectBlock,
}: {
  seats?: unknown;
  config?: unknown;
  className?: string;
  heightClass?: string;
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string | null) => void;
}) {
  const [internalSelectedBlockId, setInternalSelectedBlockId] = useState<string | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const selectedBlockId = controlledSelectedBlockId !== undefined ? controlledSelectedBlockId : internalSelectedBlockId;
  const setSelectedBlockId = (id: string | null) => {
    setInternalSelectedBlockId(id);
    setSelectedTierId(null); // reset tier when block changes
    controlledOnSelectBlock?.(id);
  };

  const seatList = asSeats(seats);
  const cfg = asConfig(config);
  const shapes = asShapes(cfg);
  const labels = asLabels(cfg);
  const sectionColors = cfg.sectionColors || {};

  const hasStadiumBlocks = Array.isArray((cfg as any)?.blocks) && (cfg as any).blocks.length > 0;
  if ((cfg as any)?.layout_mode === "stadium" && hasStadiumBlocks || hasStadiumBlocks) {
    const stadiumCfg = cfg as any;
    const blocks: Array<{
      id: string;
      name: string;
      color: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      rotation?: number;
      capacity?: number;
      shape?: string;
      corner_radius?: number;
      tiers?: Array<{
        id?: string;
        name?: string;
        color?: string;
        row_start?: string;
        row_end?: string;
        seats_per_row?: number;
      }>;
    }> = Array.isArray(stadiumCfg.blocks) ? stadiumCfg.blocks : [];

    const elements: Array<{
      id: string;
      name: string;
      type: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      rotation?: number;
      color?: string;
    }> = Array.isArray(stadiumCfg.elements) ? stadiumCfg.elements : [];

    const stadiumName = stadiumCfg.stadium_name || "Sports Stadium";
    const pitchLabel = stadiumCfg.pitch_label || "PITCH";
    const ground = stadiumCfg.ground || {};
    const canvasW = Number(stadiumCfg.canvasWidth) || 1600;
    const canvasH = Number(stadiumCfg.canvasHeight) || 1200;

    const totalCap = blocks.reduce((acc, b) => {
      // Prefer tier-computed capacity (source of truth); fall back to b.capacity only when no tiers
      if (Array.isArray(b.tiers) && b.tiers.length > 0) {
        return (
          acc +
          b.tiers.reduce((tAcc: number, t) => {
            const rStart = (t.row_start || "A").charCodeAt(0);
            const rEnd = (t.row_end || "A").charCodeAt(0);
            const rCount = Math.max(1, rEnd - rStart + 1);
            const spr = Number(t.seats_per_row) || 0;
            return tAcc + rCount * spr;
          }, 0)
        );
      }
      if (b.capacity && Number(b.capacity) > 0) return acc + Number(b.capacity);
      return acc;
    }, 0);

    const pitchX = ground.x != null ? Number(ground.x) : canvasW * 0.22;
    const pitchY = ground.y != null ? Number(ground.y) : canvasH * 0.22;
    const pitchW = ground.width != null ? Number(ground.width) : canvasW * 0.56;
    const pitchH = ground.height != null ? Number(ground.height) : canvasH * 0.56;
    const turfColor = ground.turf_color || "#15803d";
    const isOval = ground.shape === "oval" || ground.shape === "capsule";

    // Compute bounding box
    let minX = pitchX;
    let minY = pitchY;
    let maxX = pitchX + pitchW;
    let maxY = pitchY + pitchH;

    for (const b of blocks as any[]) {
      if (b.shape === "arc") {
        const sCenterX = b.stadiumCenterX != null ? Number(b.stadiumCenterX) : canvasW / 2;
        const sCenterY = b.stadiumCenterY != null ? Number(b.stadiumCenterY) : canvasH / 2;
        const outerR = Number(b.outerRadius) || 450;
        minX = Math.min(minX, sCenterX - outerR - 20);
        maxX = Math.max(maxX, sCenterX + outerR + 20);
        minY = Math.min(minY, sCenterY - outerR - 20);
        maxY = Math.max(maxY, sCenterY + outerR + 20);
      } else {
        const bx = Number(b.x) || 0;
        const by = Number(b.y) || 0;
        const bw = Number(b.width) || 120;
        const bh = Number(b.height) || 80;
        minX = Math.min(minX, bx - 30);
        minY = Math.min(minY, by - 30);
        maxX = Math.max(maxX, bx + bw + 30);
        maxY = Math.max(maxY, by + bh + 30);
      }
    }

    const pad = 40;
    const vbX = Math.floor(Math.min(0, minX - pad));
    const vbY = Math.floor(Math.min(0, minY - pad));
    const vbW = Math.ceil(Math.max(canvasW, maxX + pad) - vbX);
    const vbH = Math.ceil(Math.max(canvasH, maxY + pad) - vbY);

    const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
      const rad = (angleDeg * Math.PI) / 180;
      return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad),
      };
    };

    const describeArcPath = (
      cx: number,
      cy: number,
      innerR: number,
      outerR: number,
      startAngle: number,
      sweepAngle: number
    ) => {
      const endAngle = startAngle + sweepAngle;
      const p1 = polarToCartesian(cx, cy, outerR, startAngle);
      const p2 = polarToCartesian(cx, cy, outerR, endAngle);
      const p3 = polarToCartesian(cx, cy, innerR, endAngle);
      const p4 = polarToCartesian(cx, cy, innerR, startAngle);

      const largeArcFlag = sweepAngle > 180 ? 1 : 0;

      return `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} L ${p3.x.toFixed(1)} ${p3.y.toFixed(1)} A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${p4.x.toFixed(1)} ${p4.y.toFixed(1)} Z`;
    };

    const selectedBlock = selectedBlockId ? blocks.find((b) => b.id === selectedBlockId) : null;
    const selectedTier = selectedBlock && selectedTierId
      ? (selectedBlock.tiers || []).find((t: any) => (t.id || t.name) === selectedTierId) || null
      : null;

    // ── LEVEL 3: Single-tier seat grid ───────────────────────────────────────
    if (selectedBlock && selectedTier) {
      const tierColor = (selectedTier as any).color || selectedBlock.color || "#3b82f6";
      const rStart = ((selectedTier as any).row_start || "A").charCodeAt(0);
      const rEnd   = ((selectedTier as any).row_end   || "A").charCodeAt(0);
      const rCount = Math.max(1, rEnd - rStart + 1);
      const spr    = Math.max(1, Number((selectedTier as any).seats_per_row) || 1);
      const tierSeatsTotal = rCount * spr;
      const rows = Array.from({ length: rCount }, (_, i) => String.fromCharCode(rStart + i));

      return (
        <div className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-slate-700 bg-slate-950 text-white flex flex-col ${className}`}>
          {/* Level-3 Header */}
          <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-900/95 border-b border-slate-800 z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedTierId(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              >
                <span>←</span>
                <span>Back to {selectedBlock.name}</span>
              </button>
              <div className="flex items-center gap-2 truncate">
                <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: tierColor }} />
                <h3 className="text-sm font-bold truncate text-white">{(selectedTier as any).name || "Tier"}</h3>
                <span className="text-xs text-slate-400 truncate">
                  Rows {(selectedTier as any).row_start}–{(selectedTier as any).row_end}
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 shrink-0">
              {tierSeatsTotal.toLocaleString()} seats
            </span>
          </div>

          {/* Seat Grid */}
          <div className="flex-1 min-h-0 overflow-auto p-4 flex flex-col items-center justify-start space-y-1">
            <div className="flex flex-col gap-1.5 items-center">
              {rows.map((rowLetter) => (
                <div key={rowLetter} className="flex items-center gap-1.5">
                  <span className="w-5 text-right font-bold text-[10px] text-slate-400 select-none">{rowLetter}</span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: spr }, (_, sIdx) => {
                      const seatNum = sIdx + 1;
                      return (
                        <div
                          key={seatNum}
                          title={`${selectedBlock.name} · ${(selectedTier as any).name || "Tier"} · Row ${rowLetter} · Seat ${seatNum}`}
                          className="w-4 h-4 rounded-sm text-[7px] font-semibold flex items-center justify-center border shadow-sm transition-transform hover:scale-125 cursor-pointer select-none"
                          style={{
                            backgroundColor: tierColor,
                            borderColor: "rgba(255,255,255,0.35)",
                            color: "#ffffff",
                          }}
                        >
                          {seatNum <= 99 ? seatNum : ""}
                        </div>
                      );
                    })}
                  </div>
                  <span className="w-5 text-left font-bold text-[10px] text-slate-400 select-none">{rowLetter}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // ── LEVEL 2: Tier picker ──────────────────────────────────────────────────
    if (selectedBlock) {
      const bColor = selectedBlock.color || "#3b82f6";
      const tiers = Array.isArray(selectedBlock.tiers) ? selectedBlock.tiers : [];
      // Prefer tier-computed capacity (source of truth); fall back to b.capacity only when no tiers
      const bCap =
        tiers.length > 0
          ? tiers.reduce((tAcc: number, t: any) => {
              const rStart = (t.row_start || "A").charCodeAt(0);
              const rEnd = (t.row_end || "A").charCodeAt(0);
              const rCount = Math.max(1, rEnd - rStart + 1);
              const spr = Number(t.seats_per_row) || 0;
              return tAcc + rCount * spr;
            }, 0)
          : Number(selectedBlock.capacity) || 0;

      return (
        <div className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-slate-700 bg-slate-950 text-white flex flex-col ${className}`}>
          {/* Level-2 Header */}
          <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2.5 bg-slate-900/95 border-b border-slate-800 z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedBlockId(null)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              >
                <span>←</span>
                <span>Back to Stadium</span>
              </button>
              <div className="flex items-center gap-2 truncate">
                <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: bColor }} />
                <h3 className="text-sm font-bold truncate text-white">{selectedBlock.name}</h3>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 shrink-0">
              {bCap.toLocaleString()} seats
            </span>
          </div>

          {/* Tier Cards */}
          <div className="flex-1 min-h-0 overflow-auto p-4 flex flex-col items-center justify-start gap-3">
            {tiers.length === 0 ? (
              <p className="text-xs text-slate-400 py-6">No tiers defined for this stand.</p>
            ) : (
              tiers.map((t: any, tIdx: number) => {
                const tierColor = t.color || bColor;
                const rStart = (t.row_start || "A").charCodeAt(0);
                const rEnd   = (t.row_end   || "A").charCodeAt(0);
                const rCount = Math.max(1, rEnd - rStart + 1);
                const spr    = Math.max(1, Number(t.seats_per_row) || 1);
                const tierSeats = rCount * spr;
                const tierId = t.id || t.name || `tier-${tIdx}`;

                return (
                  <button
                    key={tierId}
                    type="button"
                    onClick={() => setSelectedTierId(tierId)}
                    className="w-full max-w-sm text-left rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
                    style={{
                      borderColor: `${tierColor}55`,
                      backgroundColor: "#0f172a",
                    }}
                  >
                    <div className="flex items-center gap-3 p-3.5">
                      {/* Colour pill */}
                      <span
                        className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-inner"
                        style={{ backgroundColor: tierColor }}
                      >
                        {(t.name || `T${tIdx + 1}`).charAt(0).toUpperCase()}
                      </span>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{t.name || `Tier ${tIdx + 1}`}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Rows {t.row_start || "A"} – {t.row_end || "A"} &nbsp;·&nbsp; {spr} seats/row
                        </div>
                      </div>

                      {/* Seat count badge + arrow */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-lg border"
                          style={{
                            color: tierColor,
                            borderColor: `${tierColor}55`,
                            backgroundColor: `${tierColor}18`,
                          }}
                        >
                          {tierSeats.toLocaleString()} seats
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold">View Seats →</span>
                      </div>
                    </div>

                    {/* Mini seat preview bar */}
                    <div
                      className="h-1.5 rounded-b-xl"
                      style={{ backgroundColor: tierColor, opacity: 0.7 }}
                    />
                  </button>
                );
              })
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-emerald-950/60 bg-slate-950 text-white select-none ${className}`}
      >
        {/* Floating click instruction */}
        <div className="absolute top-2 right-3 z-10 pointer-events-none">
          <span className="text-[10px] font-semibold text-amber-300 bg-slate-950/90 px-2 py-0.5 rounded-md border border-amber-400/30 flex items-center gap-1 shadow-md">
            🔍 Click any stand to zoom in to seats
          </span>
        </div>
        {/* Top Info Bar */}
        <div className="absolute top-2 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-sm border border-slate-800 px-2.5 py-1 rounded-lg shadow-sm">
            <span className="text-xs">🏟️</span>
            <span className="text-xs font-bold text-amber-300 truncate max-w-[140px] sm:max-w-[200px]">
              {stadiumName}
            </span>
            <span className="text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded">
              Stadium
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-sm border border-slate-800 px-2.5 py-1 rounded-lg text-[10px] font-medium text-slate-300 shadow-sm">
            <span className="text-amber-400 font-bold">{totalCap.toLocaleString()}</span> seats
            <span className="text-slate-600">·</span>
            <span>{blocks.length} stands</span>
          </div>
        </div>

        {/* Stadium SVG Map */}
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Subtle grid background */}
          <defs>
            <pattern id="stadiumGrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
            </pattern>
            <linearGradient id="pitchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#166534" />
              <stop offset="50%" stopColor="#15803d" />
              <stop offset="100%" stopColor="#14532d" />
            </linearGradient>
          </defs>

          <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="#090d16" />
          <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="url(#stadiumGrid)" />

          {/* Central Pitch / Field */}
          <g>
            {isOval ? (
              <ellipse
                cx={pitchX + pitchW / 2}
                cy={pitchY + pitchH / 2}
                rx={pitchW / 2}
                ry={pitchH / 2}
                fill={turfColor || "url(#pitchGrad)"}
                stroke="#4ade80"
                strokeWidth="4"
                strokeOpacity="0.7"
              />
            ) : (
              <rect
                x={pitchX}
                y={pitchY}
                width={pitchW}
                height={pitchH}
                rx={ground.corner_radius || 24}
                fill={turfColor || "url(#pitchGrad)"}
                stroke="#4ade80"
                strokeWidth="4"
                strokeOpacity="0.7"
              />
            )}

            {ground.sport_type === "cricket" ? (
              <>
                {/* 30-yard inner circle for cricket */}
                <ellipse
                  cx={pitchX + pitchW / 2}
                  cy={pitchY + pitchH / 2}
                  rx={pitchW * 0.32}
                  ry={pitchH * 0.32}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeDasharray="8 6"
                  strokeOpacity="0.7"
                />
                {/* Central Cricket Pitch (Clay/Wicket) */}
                <rect
                  x={pitchX + pitchW / 2 - 16}
                  y={pitchY + pitchH / 2 - 42}
                  width={32}
                  height={84}
                  fill="#d97706"
                  stroke="#fbbf24"
                  strokeWidth="2"
                  rx={3}
                />
                <circle cx={pitchX + pitchW / 2} cy={pitchY + pitchH / 2 - 32} r={3.5} fill="#ffffff" />
                <circle cx={pitchX + pitchW / 2} cy={pitchY + pitchH / 2 + 32} r={3.5} fill="#ffffff" />
              </>
            ) : (
              <>
                {/* Football Pitch Markings: Center Circle & Halfway Line */}
                <circle
                  cx={pitchX + pitchW / 2}
                  cy={pitchY + pitchH / 2}
                  r={Math.min(pitchW, pitchH) * 0.16}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeOpacity="0.5"
                />
                <line
                  x1={pitchX + pitchW / 2}
                  y1={pitchY + 12}
                  x2={pitchX + pitchW / 2}
                  y2={pitchY + pitchH - 12}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeOpacity="0.5"
                  strokeDasharray="6 4"
                />
              </>
            )}

            {/* Pitch Label */}
            <text
              x={pitchX + pitchW / 2}
              y={ground.sport_type === "cricket" ? pitchY + pitchH / 2 + 65 : pitchY + pitchH / 2 + 6}
              fill="#dcfce7"
              fontSize={Math.max(14, Math.min(28, pitchW / 24))}
              fontWeight="800"
              letterSpacing="2"
              textAnchor="middle"
              dominantBaseline="middle"
              opacity="0.9"
            >
              {pitchLabel.toUpperCase()}
            </text>
          </g>

          {/* Stadium Elements (Stages, Screens, Dugouts) */}
          {elements.map((el) => {
            const ex = Number(el.x) || 0;
            const ey = Number(el.y) || 0;
            const ew = Number(el.width) || 80;
            const eh = Number(el.height) || 40;
            const rot = Number(el.rotation) || 0;
            return (
              <g
                key={el.id}
                transform={rot ? `rotate(${rot} ${ex + ew / 2} ${ey + eh / 2})` : undefined}
              >
                <rect
                  x={ex}
                  y={ey}
                  width={ew}
                  height={eh}
                  rx={6}
                  fill={el.color || "#475569"}
                  stroke="#94a3b8"
                  strokeWidth="2"
                />
                <text
                  x={ex + ew / 2}
                  y={ey + eh / 2 + 2}
                  fill="#ffffff"
                  fontSize={Math.max(10, Math.min(14, ew / 7))}
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {el.name}
                </text>
              </g>
            );
          })}

          {/* Stadium Stands / Blocks */}
          {(blocks as any[]).map((b) => {
            const bColor = b.color || "#3b82f6";
            // Prefer tier-computed capacity (source of truth); fall back to b.capacity only when no tiers
            const bCap =
              Array.isArray(b.tiers) && b.tiers.length > 0
                ? b.tiers.reduce((tAcc: number, t: any) => {
                    const rStart = (t.row_start || "A").charCodeAt(0);
                    const rEnd = (t.row_end || "A").charCodeAt(0);
                    const rCount = Math.max(1, rEnd - rStart + 1);
                    const spr = Number(t.seats_per_row) || 0;
                    return tAcc + rCount * spr;
                  }, 0)
                : Number(b.capacity) || 0;

            if (b.shape === "arc") {
              const sCenterX = b.stadiumCenterX != null ? Number(b.stadiumCenterX) : canvasW / 2;
              const sCenterY = b.stadiumCenterY != null ? Number(b.stadiumCenterY) : canvasH / 2;
              const innerR = Number(b.innerRadius) || 260;
              const outerR = Number(b.outerRadius) || 335;
              const startA = Number(b.startAngle) || 0;
              const sweepA = Number(b.sweepAngle) || 45;

              const d = describeArcPath(sCenterX, sCenterY, innerR, outerR, startA, sweepA);
              const midAngle = startA + sweepA / 2;
              const midR = (innerR + outerR) / 2;
              const labelPos = polarToCartesian(sCenterX, sCenterY, midR, midAngle);
              const rDiff = outerR - innerR;

              return (
                <g
                  key={b.id}
                  className="cursor-pointer transition-transform hover:opacity-95 hover:filter hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]"
                  onClick={() => setSelectedBlockId(b.id)}
                >
                  <title>{`${b.name} · ${bCap.toLocaleString()} seats · Click to zoom in to seats`}</title>
                  <path
                    d={d}
                    fill={bColor}
                    fillOpacity="0.88"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeOpacity="0.9"
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y - (bCap > 0 ? 7 : 0)}
                    fill="#ffffff"
                    fontSize={Math.max(10, Math.min(18, rDiff / 3.8))}
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
                  >
                    {b.name}
                  </text>
                  {bCap > 0 && (
                    <text
                      x={labelPos.x}
                      y={labelPos.y + 11}
                      fill="#fef08a"
                      fontSize={Math.max(8, Math.min(13, rDiff / 5.5))}
                      fontWeight="700"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
                    >
                      {bCap.toLocaleString()} seats
                    </text>
                  )}
                </g>
              );
            }

            const bx = Number(b.x) || 0;
            const by = Number(b.y) || 0;
            const bw = Number(b.width) || 120;
            const bh = Number(b.height) || 80;
            const rot = Number(b.rotation) || 0;

            return (
              <g
                key={b.id}
                transform={rot ? `rotate(${rot} ${bx + bw / 2} ${by + bh / 2})` : undefined}
                className="cursor-pointer transition-transform hover:opacity-95 hover:filter hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]"
                onClick={() => setSelectedBlockId(b.id)}
              >
                <title>{`${b.name} · ${bCap.toLocaleString()} seats · Click to zoom in to seats`}</title>
                <rect
                  x={bx}
                  y={by}
                  width={bw}
                  height={bh}
                  rx={b.corner_radius || 10}
                  fill={bColor}
                  fillOpacity="0.88"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeOpacity="0.9"
                />

                {/* Stand Name */}
                <text
                  x={bx + bw / 2}
                  y={by + bh / 2 - (bCap > 0 ? 8 : 0)}
                  fill="#ffffff"
                  fontSize={Math.max(11, Math.min(20, bw / 8))}
                  fontWeight="800"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
                >
                  {b.name}
                </text>

                {/* Stand Capacity */}
                {bCap > 0 && (
                  <text
                    x={bx + bw / 2}
                    y={by + bh / 2 + 12}
                    fill="#fef08a"
                    fontSize={Math.max(9, Math.min(14, bw / 11))}
                    fontWeight="700"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
                  >
                    {bCap.toLocaleString()} seats
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Bottom Stand Quick Badges */}
        {blocks.length > 0 && (
          <div className="absolute bottom-2 left-3 right-3 z-10 flex flex-wrap items-center gap-1.5 opacity-90">
            {blocks.slice(0, 6).map((b) => (
              <button
                type="button"
                key={b.id}
                onClick={() => setSelectedBlockId(b.id)}
                className="text-[9px] font-semibold px-2 py-0.5 rounded shadow-sm text-white hover:scale-105 transition-transform cursor-pointer border border-white/20"
                style={{ backgroundColor: b.color || "#3b82f6" }}
              >
                {b.name}
              </button>
            ))}
            {blocks.length > 6 && (
              <span className="text-[9px] text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded">
                +{blocks.length - 6} more
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!seatList.length && !shapes.length && !labels.length) {
    return (
      <div
        className={`rounded-lg border border-slate-200 bg-slate-50 ${heightClass} flex items-center justify-center text-[11px] text-slate-500 ${className}`}
      >
        No seats yet
      </div>
    );
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const seat of seatList) {
    const x = Number(seat.coordinate_x) || 0;
    const y = Number(seat.coordinate_y) || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  for (const shape of shapes) {
    const x = Number(shape.x) || 0;
    const y = Number(shape.y) || 0;
    const w = Number(shape.width) || 0;
    const h = Number(shape.height) || 0;
    const b = rotatedRectBounds(x, y, w, h, Number(shape.rotation) || 0);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  for (const label of labels) {
    const x = Number(label.x) || 0;
    const y = Number(label.y) || 0;
    const fs = Number(label.fontSize) || 14;
    const lines = String(label.text || "").split("\n");
    const tw = Math.max(...lines.map((l) => l.length), 1) * fs * 0.6;
    const th = lines.length * fs * 1.2;
    const b = rotatedRectBounds(x - tw / 2, y - th / 2, tw, th, Number(label.rotation) || 0);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  const pad = 24;
  const width = Math.max(maxX - minX + pad * 2, 80);
  const height = Math.max(maxY - minY + pad * 2, 80);
  const radius = Math.max(1.6, Math.min(width, height) / 85);

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${width} ${height}`}
      className={`w-full ${heightClass} rounded-lg border border-slate-200 bg-white ${className}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {shapes.map((shape, idx) => {
        const x = Number(shape.x) || 0;
        const y = Number(shape.y) || 0;
        const w = Number(shape.width) || 0;
        const h = Number(shape.height) || 0;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rotation = Number(shape.rotation) || 0;
        const fill = normalizeHex(shape.fill) || shape.fill || "#475569";
        const fontSize = Math.max(9, Math.min(18, Math.min(w, h) / 5));

        return (
          <g
            key={`shape-${idx}`}
            transform={rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined}
          >
            <ShapeVisual shape={shape} />
            {shape.text ? (
              <MultilineSvgText
                text={shape.text}
                x={cx}
                y={cy}
                fontSize={fontSize}
                fill={contrastTextColor(fill)}
              />
            ) : null}
          </g>
        );
      })}

      {seatList.map((seat, idx) => (
        <circle
          key={`seat-${idx}`}
          cx={Number(seat.coordinate_x) || 0}
          cy={Number(seat.coordinate_y) || 0}
          r={radius}
          fill={resolveSeatFill(seat, sectionColors)}
          stroke="#ffffff"
          strokeWidth={Math.max(0.3, radius / 8)}
        />
      ))}

      {labels.map((label, idx) => {
        const x = Number(label.x) || 0;
        const y = Number(label.y) || 0;
        const rotation = Number(label.rotation) || 0;
        const fontSize = Number(label.fontSize) || 14;
        return (
          <g
            key={`label-${idx}`}
            transform={rotation ? `rotate(${rotation} ${x} ${y})` : undefined}
          >
            <MultilineSvgText
              text={label.text || ""}
              x={x}
              y={y}
              fontSize={fontSize}
              fill="#334155"
              fontWeight={600}
              align="start"
            />
          </g>
        );
      })}
    </svg>
  );
}
