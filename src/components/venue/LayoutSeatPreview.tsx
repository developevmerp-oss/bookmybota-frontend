type SeatLike = {
  coordinate_x?: number;
  coordinate_y?: number;
};

type ShapeLike = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
};

function asSeats(value: unknown): SeatLike[] {
  return Array.isArray(value) ? (value as SeatLike[]) : [];
}

function asShapes(value: unknown): ShapeLike[] {
  if (Array.isArray(value)) return value as ShapeLike[];
  if (value && typeof value === "object" && Array.isArray((value as { shapes?: unknown }).shapes)) {
    return (value as { shapes: ShapeLike[] }).shapes;
  }
  return [];
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
  const shapes = asShapes(config);
  if (!seatList.length && !shapes.length) {
    return (
      <div className={`rounded-lg border border-white/10 bg-white/40 ${heightClass} flex items-center justify-center text-[11px] text-zinc-500 ${className}`}>
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
  const pad = 24;
  const width = Math.max(maxX - minX + pad * 2, 80);
  const height = Math.max(maxY - minY + pad * 2, 80);
  const radius = Math.max(1.4, Math.min(width, height) / 90);

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${width} ${height}`}
      className={`w-full ${heightClass} rounded-lg border border-white/10 bg-white ${className}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {shapes.map((shape, idx) => (
        <rect
          key={`shape-${idx}`}
          x={Number(shape.x) || 0}
          y={Number(shape.y) || 0}
          width={Number(shape.width) || 0}
          height={Number(shape.height) || 0}
          fill={shape.fill || "#475569"}
          rx={4}
        />
      ))}
      {seatList.map((seat, idx) => (
        <circle
          key={`seat-${idx}`}
          cx={Number(seat.coordinate_x) || 0}
          cy={Number(seat.coordinate_y) || 0}
          r={radius}
          fill="#64748b"
        />
      ))}
    </svg>
  );
}
