"use client";

type GuestTableAnimationProps = {
  count: number;
};

/** Dribbble-style top-down table reservation (shot 3791049). */
const CHAIR_W = 34;
const CHAIR_H = 28;
const PITCH = 52;
const TABLE_GAP = 10;
const CORNER = 28;
const MIN_TABLE = 88;
const MAX_TOP = 3;
const MAX_END = 2;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const DURATION = "650ms";

const TABLE_YELLOW = "#F5C518";
const CHAIR_FILL = "#5B5FBF";
const CHAIR_STROKE = "#2F3270";
const PLATE = "#FFFFFF";

function layout(n: number) {
  const guests = Math.max(1, Math.min(10, n));
  const map: Record<number, { left: number; right: number; top: number; bottom: number }> = {
    1: { left: 0, right: 1, top: 0, bottom: 0 },
    2: { left: 1, right: 1, top: 0, bottom: 0 },
    3: { left: 1, right: 1, top: 1, bottom: 0 },
    4: { left: 1, right: 1, top: 1, bottom: 1 },
    5: { left: 1, right: 1, top: 2, bottom: 1 },
    6: { left: 1, right: 1, top: 2, bottom: 2 },
    7: { left: 2, right: 1, top: 2, bottom: 2 },
    8: { left: 2, right: 2, top: 2, bottom: 2 },
    9: { left: 2, right: 2, top: 3, bottom: 2 },
    10: { left: 2, right: 2, top: 3, bottom: 3 },
  };
  return map[guests];
}

function sideSize(chairCount: number) {
  if (chairCount <= 1) return MIN_TABLE;
  return 2 * CORNER + (chairCount - 1) * PITCH;
}

function evenCenters(count: number, mid: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [mid];
  const span = (count - 1) * PITCH;
  const start = mid - span / 2;
  return Array.from({ length: count }, (_, i) => start + i * PITCH);
}

/** Top-down chair: rounded seat + arched backrest (open side faces table). */
function ChairGlyph() {
  return (
    <svg viewBox="0 0 40 36" width={CHAIR_W} height={CHAIR_H} fill="none" aria-hidden>
      {/* Outer backrest arch */}
      <path
        d="M6 30V14C6 6.5 12.2 2 20 2s14 4.5 14 12v16"
        stroke={CHAIR_STROKE}
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Seat pad */}
      <rect x="9" y="14" width="22" height="18" rx="6" fill={CHAIR_FILL} stroke={CHAIR_STROKE} strokeWidth="1.6" />
    </svg>
  );
}

function Seat({
  x,
  y,
  rotate,
  visible,
}: {
  x: number;
  y: number;
  rotate: number;
  visible: boolean;
}) {
  return (
    <div
      className="absolute top-0 left-0"
      style={{
        width: CHAIR_W,
        height: CHAIR_H,
        transform: `translate(${x - CHAIR_W / 2}px, ${y - CHAIR_H / 2}px) rotate(${rotate}deg) scale(${visible ? 1 : 0.35})`,
        opacity: visible ? 1 : 0,
        transition: `transform ${DURATION} ${EASE}, opacity 380ms ease`,
        willChange: "transform, opacity",
        pointerEvents: "none",
      }}
    >
      <ChairGlyph />
    </div>
  );
}

function Plate({ x, y, visible }: { x: number; y: number; visible: boolean }) {
  return (
    <div
      className="absolute rounded-full"
      style={{
        width: 14,
        height: 14,
        left: x - 7,
        top: y - 7,
        background: PLATE,
        boxShadow: "0 0 0 1.5px rgba(47,50,112,0.12)",
        opacity: visible ? 1 : 0,
        transform: `scale(${visible ? 1 : 0.4})`,
        transition: `transform ${DURATION} ${EASE}, opacity 380ms ease`,
        pointerEvents: "none",
      }}
    />
  );
}

export default function GuestTableAnimation({ count }: GuestTableAnimationProps) {
  const n = Math.max(1, Math.min(10, Number(count) || 1));
  const { left, right, top, bottom } = layout(n);

  const tableW = Math.max(sideSize(Math.max(top, bottom)), MIN_TABLE);
  const tableH = Math.max(sideSize(Math.max(left, right)), MIN_TABLE);

  const maxW = Math.max(sideSize(MAX_TOP), MIN_TABLE);
  const maxH = Math.max(sideSize(MAX_END), MIN_TABLE);
  const sceneW = maxW + (CHAIR_H + TABLE_GAP) * 2 + 28;
  const sceneH = maxH + (CHAIR_H + TABLE_GAP) * 2 + 28;
  const cx = sceneW / 2;
  const cy = sceneH / 2;

  const tableLeft = cx - tableW / 2;
  const tableRight = cx + tableW / 2;
  const tableTop = cy - tableH / 2;
  const tableBottom = cy + tableH / 2;

  const topXs = evenCenters(top, cx);
  const bottomXs = evenCenters(bottom, cx);
  const leftYs = evenCenters(left, cy);
  const rightYs = evenCenters(right, cy);

  // Chairs sit just outside the table; backrest faces outward
  const leftX = tableLeft - TABLE_GAP - CHAIR_H / 2 + 4;
  const rightX = tableRight + TABLE_GAP + CHAIR_H / 2 - 4;
  const topY = tableTop - TABLE_GAP - CHAIR_H / 2 + 4;
  const bottomY = tableBottom + TABLE_GAP + CHAIR_H / 2 - 4;

  // Plates sit inset from each chair along the table edge
  const plateInset = 18;
  const radius = n <= 2 ? 18 : 16;

  return (
    <div className="w-full flex justify-center py-3 sm:py-4 select-none" aria-hidden="true">
      <div className="relative max-w-full overflow-visible" style={{ width: sceneW, height: sceneH }}>
        {/* Yellow table */}
        <div
          className="absolute"
          style={{
            left: "50%",
            top: "50%",
            width: tableW,
            height: tableH,
            transform: "translate(-50%, -50%)",
            borderRadius: radius,
            background: TABLE_YELLOW,
            boxShadow: "0 8px 20px rgba(47, 50, 112, 0.12)",
            border: `2.5px solid ${CHAIR_STROKE}`,
            transition: `width ${DURATION} ${EASE}, height ${DURATION} ${EASE}, border-radius ${DURATION} ${EASE}`,
            willChange: "width, height",
          }}
        />

        {/* Place-setting plates */}
        {topXs.map((x, i) => (
          <Plate key={`pt-${i}`} x={x} y={tableTop + plateInset} visible={i < top} />
        ))}
        {bottomXs.map((x, i) => (
          <Plate key={`pb-${i}`} x={x} y={tableBottom - plateInset} visible={i < bottom} />
        ))}
        {leftYs.map((y, i) => (
          <Plate key={`pl-${i}`} x={tableLeft + plateInset} y={y} visible={i < left} />
        ))}
        {rightYs.map((y, i) => (
          <Plate key={`pr-${i}`} x={tableRight - plateInset} y={y} visible={i < right} />
        ))}

        {/* Chairs — rotate so open/seat side faces the table */}
        {Array.from({ length: MAX_END }).map((_, i) => (
          <Seat key={`l-${i}`} x={leftX} y={leftYs[i] ?? cy} rotate={90} visible={i < left} />
        ))}
        {Array.from({ length: MAX_END }).map((_, i) => (
          <Seat key={`r-${i}`} x={rightX} y={rightYs[i] ?? cy} rotate={-90} visible={i < right} />
        ))}
        {Array.from({ length: MAX_TOP }).map((_, i) => (
          <Seat key={`t-${i}`} x={topXs[i] ?? cx} y={topY} rotate={180} visible={i < top} />
        ))}
        {Array.from({ length: MAX_TOP }).map((_, i) => (
          <Seat key={`b-${i}`} x={bottomXs[i] ?? cx} y={bottomY} rotate={0} visible={i < bottom} />
        ))}
      </div>
    </div>
  );
}
