type SeatLike = {
  coordinate_x?: number;
  coordinate_y?: number;
  color?: string | null;
  section_name?: string | null;
  status?: string | null;
};

type ShapeLike = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  text?: string;
  rotation?: number;
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
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  for (const label of labels) {
    const x = Number(label.x) || 0;
    const y = Number(label.y) || 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + 40);
    maxY = Math.max(maxY, y + 20);
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
      {shapes.map((shape, idx) => (
        <g key={`shape-${idx}`}>
          <rect
            x={Number(shape.x) || 0}
            y={Number(shape.y) || 0}
            width={Number(shape.width) || 0}
            height={Number(shape.height) || 0}
            fill={normalizeHex(shape.fill) || "#475569"}
            rx={4}
            transform={
              shape.rotation
                ? `rotate(${shape.rotation} ${(Number(shape.x) || 0) + (Number(shape.width) || 0) / 2} ${(Number(shape.y) || 0) + (Number(shape.height) || 0) / 2})`
                : undefined
            }
          />
          {shape.text ? (
            <text
              x={(Number(shape.x) || 0) + (Number(shape.width) || 0) / 2}
              y={(Number(shape.y) || 0) + (Number(shape.height) || 0) / 2}
              fill="#e2e8f0"
              fontSize={Math.max(10, Math.min(18, (Number(shape.width) || 80) / 10))}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {shape.text}
            </text>
          ) : null}
        </g>
      ))}
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
      {labels.map((label, idx) => (
        <text
          key={`label-${idx}`}
          x={Number(label.x) || 0}
          y={Number(label.y) || 0}
          fill="#334155"
          fontSize={Number(label.fontSize) || 14}
          fontWeight={600}
          transform={label.rotation ? `rotate(${label.rotation} ${Number(label.x) || 0} ${Number(label.y) || 0})` : undefined}
        >
          {label.text || ""}
        </text>
      ))}
    </svg>
  );
}
