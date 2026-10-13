"use client";

type GuestTableAnimationProps = {
  count: number;
};

/** Top-down wooden table + chairs that grow with guest count. */
const CHAIR_SIZE = 36;
/** Center-to-center spacing along a side (chairs + matching plates). */
const PITCH = 56;
/** Clear gap between table outer edge and chair (toward-table edge). */
const TABLE_GAP = 14;
/** Padding from table corner to first/last seat center along an edge. */
const CORNER = 40;
const MIN_TABLE = 96;
const PLATE_SIZE = 13;
const PLATE_R = PLATE_SIZE / 2;
/** Inward distance from table edge to plate center. */
const PLATE_INSET = 18;
const MAX_TOP = 3;
const MAX_END = 2;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const DURATION = "650ms";

const WOOD = {
  light: "#C18A51",
  mid: "#B77A43",
  deep: "#85502C",
  dark: "#61391F",
  edge: "#4D2B19",
  grain: "#D7A16A",
  grainDark: "#5D351D",
};

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

/**
 * Top-down wooden chair.
 * Local coords: backrest at TOP (away), seat toward BOTTOM (toward table when rotate=0 on bottom side).
 */
function ChairGlyph({ uid }: { uid: string }) {
  const woodId = `gt-wood-${uid}`;
  const seatId = `gt-seat-${uid}`;

  return (
    <svg viewBox="0 0 40 40" width={CHAIR_SIZE} height={CHAIR_SIZE} fill="none" aria-hidden>
      <defs>
        <linearGradient id={woodId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#B77A43" />
          <stop offset="55%" stopColor="#85502C" />
          <stop offset="100%" stopColor="#61391F" />
        </linearGradient>
        <linearGradient id={seatId} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#C18A51" />
          <stop offset="100%" stopColor="#754322" />
        </linearGradient>
      </defs>

      {/* Rear posts */}
      <circle cx="11" cy="8" r="3" fill="#754322" stroke="#4D2B19" strokeWidth="1.1" />
      <circle cx="29" cy="8" r="3" fill="#61391F" stroke="#4D2B19" strokeWidth="1.1" />

      {/* Curved backrest (outer / away from table) */}
      <path
        d="M8 24 V14 C8 7 13.5 3.5 20 3.5 S32 7 32 14 V24"
        stroke={`url(#${woodId})`}
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 24 V14 C8 7 13.5 3.5 20 3.5 S32 7 32 14 V24"
        stroke="#4D2B19"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M11.5 10 C14.5 7.2 17 6 20 6 C23 6 25.5 7.2 28.5 10 L28 13 C25.2 10.8 22.8 10 20 10 C17.2 10 14.8 10.8 12 13 Z"
        fill={`url(#${woodId})`}
        stroke="#57321D"
        strokeWidth="0.9"
      />
      <path
        d="M12 14.5 C15 13.2 17.5 12.6 20 12.6 C22.5 12.6 25 13.2 28 14.5 L27.5 16.8 C25 15.8 22.5 15.3 20 15.3 C17.5 15.3 15 15.8 12.5 16.8 Z"
        fill="#9C6135"
        stroke="#57321D"
        strokeWidth="0.8"
      />
      <path
        d="M11 11.5 C14.5 8 17.5 6.5 20 6.5 C22.5 6.5 25.5 8 29 11.5"
        stroke="#E0A56B"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
        fill="none"
      />

      {/* Seat — faces table (bottom of glyph) */}
      <path
        d="M9 16.5 C12.5 15 16 14.2 20 14.2 C24 14.2 27.5 15 31 16.5 L30 30 C26.5 32.5 23 33.5 20 33.5 C17 33.5 13.5 32.5 10 30 Z"
        fill={`url(#${seatId})`}
        stroke="#4D2B19"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 30 C13.5 32.2 16.5 33.2 20 33.2 C23.5 33.2 26.5 32.2 30 30 L29.5 32.5 C26 34.5 23 35.2 20 35.2 C17 35.2 14 34.5 10.5 32.5 Z"
        fill="#6C3F23"
        stroke="#4D2B19"
        strokeWidth="0.9"
      />
      <path d="M12 19 C16 17.8 24 17.8 28 19" stroke="#D7A16A" strokeWidth="1.3" opacity="0.6" fill="none" />
      <path d="M13 23.5 C17 22.5 23 22.5 27 23.5" stroke="#5D351D" strokeWidth="1" opacity="0.28" fill="none" />
      <path d="M14 27.5 C18 26.8 22 26.8 26 27.5" stroke="#5D351D" strokeWidth="1" opacity="0.22" fill="none" />

      {/* Front legs near table */}
      <ellipse cx="13.5" cy="33.5" rx="2.6" ry="2" fill="#A66A38" stroke="#4D2B19" strokeWidth="0.9" />
      <ellipse cx="26.5" cy="33.5" rx="2.6" ry="2" fill="#85502C" stroke="#4D2B19" strokeWidth="0.9" />
    </svg>
  );
}

function Seat({
  x,
  y,
  rotate,
  visible,
  uid,
}: {
  x: number;
  y: number;
  rotate: number;
  visible: boolean;
  uid: string;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: x - CHAIR_SIZE / 2,
        top: y - CHAIR_SIZE / 2,
        width: CHAIR_SIZE,
        height: CHAIR_SIZE,
        transform: `rotate(${rotate}deg) scale(${visible ? 1 : 0.35})`,
        transformOrigin: "center center",
        opacity: visible ? 1 : 0,
        transition: `left ${DURATION} ${EASE}, top ${DURATION} ${EASE}, transform ${DURATION} ${EASE}, opacity 380ms ease`,
        pointerEvents: "none",
        filter: visible ? "drop-shadow(0 2px 3px rgba(77, 43, 25, 0.25))" : "none",
      }}
    >
      <ChairGlyph uid={uid} />
    </div>
  );
}

function Plate({ x, y, visible }: { x: number; y: number; visible: boolean }) {
  return (
    <div
      className="absolute"
      style={{
        left: x - PLATE_R,
        top: y - PLATE_R,
        width: PLATE_SIZE,
        height: PLATE_SIZE,
        opacity: visible ? 1 : 0,
        transform: `scale(${visible ? 1 : 0.4})`,
        transformOrigin: "center center",
        transition: `left ${DURATION} ${EASE}, top ${DURATION} ${EASE}, transform ${DURATION} ${EASE}, opacity 380ms ease`,
        pointerEvents: "none",
      }}
    >
      <svg viewBox="0 0 13 13" width={PLATE_SIZE} height={PLATE_SIZE} aria-hidden>
        <circle cx="6.5" cy="6.5" r="5.8" fill="#F7F0E6" stroke="#D4C4B0" strokeWidth="1" />
        <circle cx="6.5" cy="6.5" r="3.6" fill="#FFFCF7" stroke="#E8DCCE" strokeWidth="0.75" />
        <circle cx="6.5" cy="6.5" r="1.1" fill="#EDE3D6" opacity="0.7" />
      </svg>
    </div>
  );
}

function WoodenTable({
  left,
  top,
  width,
  height,
  radius,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
}) {
  const grainCount = Math.max(4, Math.round(Math.min(width, height) / 18));
  const woodId = "gt-table-wood";
  const edgeId = "gt-table-edge";

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        left,
        top,
        width,
        height,
        borderRadius: radius,
        boxShadow: "0 10px 22px rgba(77, 43, 25, 0.22), inset 0 1px 0 rgba(215, 161, 106, 0.35)",
        border: `2.5px solid ${WOOD.edge}`,
        boxSizing: "border-box",
        transition: `left ${DURATION} ${EASE}, top ${DURATION} ${EASE}, width ${DURATION} ${EASE}, height ${DURATION} ${EASE}, border-radius ${DURATION} ${EASE}`,
      }}
    >
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={woodId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={WOOD.light} />
            <stop offset="40%" stopColor={WOOD.mid} />
            <stop offset="100%" stopColor={WOOD.deep} />
          </linearGradient>
          <linearGradient id={edgeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(215,161,106,0.35)" />
            <stop offset="100%" stopColor="rgba(77,43,25,0.2)" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} rx={radius} fill={`url(#${woodId})`} />
        <rect width={width} height={height} rx={radius} fill={`url(#${edgeId})`} />
        {Array.from({ length: grainCount }).map((_, i) => {
          const y = ((i + 1) / (grainCount + 1)) * height;
          const wobble = (i % 2 === 0 ? 1 : -1) * (height * 0.015);
          return (
            <path
              key={i}
              d={`M ${width * 0.06} ${y} Q ${width * 0.35} ${y + wobble} ${width * 0.5} ${y} T ${width * 0.94} ${y}`}
              stroke={i % 2 === 0 ? WOOD.grain : WOOD.grainDark}
              strokeWidth={i % 3 === 0 ? 1.4 : 1}
              opacity={i % 2 === 0 ? 0.28 : 0.16}
              fill="none"
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function GuestTableAnimation({ count }: GuestTableAnimationProps) {
  const n = Math.max(1, Math.min(10, Number(count) || 1));
  const { left, right, top, bottom } = layout(n);

  const tableW = Math.max(sideSize(Math.max(top, bottom)), MIN_TABLE);
  const tableH = Math.max(sideSize(Math.max(left, right)), MIN_TABLE);

  const maxW = Math.max(sideSize(MAX_TOP), MIN_TABLE);
  const maxH = Math.max(sideSize(MAX_END), MIN_TABLE);
  const sidePad = CHAIR_SIZE + TABLE_GAP;
  const sceneW = maxW + sidePad * 2 + 16;
  const sceneH = maxH + sidePad * 2 + 16;
  const cx = sceneW / 2;
  const cy = sceneH / 2;

  // Same pixel origin for table, chairs, and plates (no % / translate centering)
  const tableLeft = cx - tableW / 2;
  const tableTop = cy - tableH / 2;
  const tableRight = tableLeft + tableW;
  const tableBottom = tableTop + tableH;

  const topXs = evenCenters(top, cx);
  const bottomXs = evenCenters(bottom, cx);
  const leftYs = evenCenters(left, cy);
  const rightYs = evenCenters(right, cy);

  /**
   * Chair glyph: seat at bottom (+Y). CSS positive rotate = clockwise.
   *   rotate(90):  seat → right  → use on LEFT  (seat toward table)
   *   rotate(-90): seat → left   → use on RIGHT (seat toward table)
   *   rotate(180): seat → up     → use on TOP
   *   rotate(0):   seat → down   → use on BOTTOM
   * Centers sit TABLE_GAP outside the table along the seat-facing edge.
   */
  const half = CHAIR_SIZE / 2;
  const leftX = tableLeft - TABLE_GAP - half;
  const rightX = tableRight + TABLE_GAP + half;
  const topY = tableTop - TABLE_GAP - half;
  const bottomY = tableBottom + TABLE_GAP + half;

  const radius = n <= 2 ? 18 : 16;

  return (
    <div className="w-full flex justify-center py-2 sm:py-3 select-none" aria-hidden="true">
      <div className="relative shrink-0 overflow-visible" style={{ width: sceneW, height: sceneH }}>
        <WoodenTable left={tableLeft} top={tableTop} width={tableW} height={tableH} radius={radius} />

        {/* Plates — always on the table, inset evenly from each edge */}
        {topXs.map((x, i) => (
          <Plate key={`pt-${i}`} x={x} y={tableTop + PLATE_INSET} visible={i < top} />
        ))}
        {bottomXs.map((x, i) => (
          <Plate key={`pb-${i}`} x={x} y={tableBottom - PLATE_INSET} visible={i < bottom} />
        ))}
        {leftYs.map((y, i) => (
          <Plate key={`pl-${i}`} x={tableLeft + PLATE_INSET} y={y} visible={i < left} />
        ))}
        {rightYs.map((y, i) => (
          <Plate key={`pr-${i}`} x={tableRight - PLATE_INSET} y={y} visible={i < right} />
        ))}

        {/* Chairs — seat faces table on every side */}
        {Array.from({ length: MAX_END }).map((_, i) => (
          <Seat
            key={`l-${i}`}
            uid={`l${i}`}
            x={leftX}
            y={leftYs[i] ?? cy}
            rotate={90}
            visible={i < left}
          />
        ))}
        {Array.from({ length: MAX_END }).map((_, i) => (
          <Seat
            key={`r-${i}`}
            uid={`r${i}`}
            x={rightX}
            y={rightYs[i] ?? cy}
            rotate={-90}
            visible={i < right}
          />
        ))}
        {Array.from({ length: MAX_TOP }).map((_, i) => (
          <Seat
            key={`t-${i}`}
            uid={`t${i}`}
            x={topXs[i] ?? cx}
            y={topY}
            rotate={180}
            visible={i < top}
          />
        ))}
        {Array.from({ length: MAX_TOP }).map((_, i) => (
          <Seat
            key={`b-${i}`}
            uid={`b${i}`}
            x={bottomXs[i] ?? cx}
            y={bottomY}
            rotate={0}
            visible={i < bottom}
          />
        ))}
      </div>
    </div>
  );
}
