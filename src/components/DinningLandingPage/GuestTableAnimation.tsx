"use client";

type GuestTableAnimationProps = {
  count: number;
};

const CHAIR = 32;
const PITCH = 54;
const TABLE_GAP = 20;
const CORNER = 30;
const MIN_TABLE = 86;
const MAX_TOP = 3;
const MAX_END = 2;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const DURATION = "700ms";

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

function ChairGlyph() {
  return (
    <svg viewBox="0 0 40 42" width={CHAIR} height={CHAIR} fill="none" aria-hidden>
      <path
        fill="#2C3348"
        d="M8 40c-2.2 0-4-1.6-4-4.2V18C4 8.8 12.2 3 20 3s16 5.8 16 15v17.8c0 2.6-1.8 4.2-4 4.2h-3.2c-1.4 0-2.3-1.2-2.3-2.6V21.4c0-5-2.8-7.2-6.5-7.2s-6.5 2.2-6.5 7.2v16c0 1.4-.9 2.6-2.3 2.6H8Z"
      />
      <path
        fill="#3D4660"
        d="M11.2 38.2V21.2c0-6.2 3.6-9.4 8.8-9.4s8.8 3.2 8.8 9.4v17"
        opacity="0.35"
      />
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
        width: CHAIR,
        height: CHAIR,
        transform: `translate(${x - CHAIR / 2}px, ${y - CHAIR / 2}px) rotate(${rotate}deg) scale(${visible ? 1 : 0.45})`,
        opacity: visible ? 1 : 0,
        transition: `transform ${DURATION} ${EASE}, opacity 400ms ease`,
        willChange: "transform, opacity",
        pointerEvents: "none",
      }}
    >
      <ChairGlyph />
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
  const sceneW = maxW + (CHAIR + TABLE_GAP) * 2 + 16;
  const sceneH = maxH + (CHAIR + TABLE_GAP) * 2 + 16;
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

  const leftX = tableLeft - TABLE_GAP - CHAIR / 2;
  const rightX = tableRight + TABLE_GAP + CHAIR / 2;
  const topY = tableTop - TABLE_GAP - CHAIR / 2;
  const bottomY = tableBottom + TABLE_GAP + CHAIR / 2;

  const radius = n <= 2 ? MIN_TABLE / 2 : 18;

  return (
    <div className="w-full flex justify-center py-2 sm:py-3 select-none" aria-hidden="true">
      <div className="relative max-w-full overflow-visible" style={{ width: sceneW, height: sceneH }}>
        <div
          className="absolute"
          style={{
            left: "50%",
            top: "50%",
            width: tableW,
            height: tableH,
            transform: "translate(-50%, -50%)",
            borderRadius: radius,
            background: "linear-gradient(180deg, #F8E7CC 0%, #E9CBA6 52%, #D9B48A 100%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -8px 12px rgba(160,110,50,0.12), 0 10px 22px rgba(160,120,70,0.22)",
            transition: `width ${DURATION} ${EASE}, height ${DURATION} ${EASE}, border-radius ${DURATION} ${EASE}`,
            willChange: "width, height",
          }}
        />

        {Array.from({ length: MAX_END }).map((_, i) => (
          <Seat key={`l-${i}`} x={leftX} y={leftYs[i] ?? cy} rotate={-90} visible={i < left} />
        ))}
        {Array.from({ length: MAX_END }).map((_, i) => (
          <Seat key={`r-${i}`} x={rightX} y={rightYs[i] ?? cy} rotate={90} visible={i < right} />
        ))}
        {Array.from({ length: MAX_TOP }).map((_, i) => (
          <Seat key={`t-${i}`} x={topXs[i] ?? cx} y={topY} rotate={0} visible={i < top} />
        ))}
        {Array.from({ length: MAX_TOP }).map((_, i) => (
          <Seat key={`b-${i}`} x={bottomXs[i] ?? cx} y={bottomY} rotate={180} visible={i < bottom} />
        ))}
      </div>
    </div>
  );
}
