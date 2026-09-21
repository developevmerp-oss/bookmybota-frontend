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
  if (!value || typeof value !== "object") return {};
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
}: {
  seats?: unknown;
  config?: unknown;
  className?: string;
  heightClass?: string;
}) {
  const seatList = asSeats(seats);
  const cfg = asConfig(config);
  const shapes = asShapes(cfg);
  const labels = asLabels(cfg);
  const sectionColors = cfg.sectionColors || {};

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
