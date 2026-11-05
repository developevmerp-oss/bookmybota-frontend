"use client";

import { blockLabelMetrics } from "../utils/blockGeometry";
import React, { useMemo } from "react";
import Konva from "konva";
import { Circle, Ellipse, Group, Line, Rect, Shape, Text } from "react-konva";
import { SeatType, UniversalSeat, UniversalVenueObject } from "../types";
import {
  generateSeatsForObject,
  gridStandSize,
  rowLabelColumns,
  standHeadingAnchor,
  standHeadingText,
  standPriceText,
  usesLabelColumns,
} from "../utils/geometryEngine";
import { measureText, textFontStyle } from "../utils/textMeasure";

/** "#16a34a" + 0.18 -> "rgba(22,163,74,0.18)". Other colour formats are returned unchanged. */
export function tint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Dark text on light fills, white text on dark fills */
function readableTextOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return "#0f172a";
  const n = parseInt(m[1], 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

interface ShapeNodeProps {
  obj: UniversalVenueObject;
  selected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}

/** A free shape or ready-made venue element: rectangle, circle, triangle, diamond, line or curve, with an optional label */
export function ShapeNode({ obj, selected, draggable, onSelect, onDragEnd }: ShapeNodeProps) {
  const w = Math.max(2, obj.width);
  const h = Math.max(2, obj.height);
  const fill = obj.color;
  const stroke = selected ? "#e11d48" : obj.strokeColor || "rgba(15, 23, 42, 0.35)";
  const strokeWidth = obj.strokeWidth ?? 1.5;
  const opacity = obj.opacity ?? 0.95;
  const kind = obj.shapeKind || "rect";
  const label = obj.label || "";
  const labelColor = obj.textColor || readableTextOn(fill);
  const fontSize = obj.fontSize || 12;

  let body: React.ReactNode;
  if (kind === "icon") {
    // A sign: white badge with a coloured border, the symbol inside, and a caption underneath
    const glyph = obj.iconGlyph || "❓";
    body = (
      <>
        <Rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          cornerRadius={Math.min(12, h / 3)}
          fill="#ffffff"
          stroke={selected ? "#e11d48" : obj.color || "#94a3b8"}
          strokeWidth={2}
          shadowColor="#0f172a"
          shadowBlur={6}
          shadowOpacity={0.12}
        />
        <Text x={-w / 2} y={-h * 0.31} width={w} height={h * 0.7} text={glyph} align="center" fontSize={h * 0.58} listening={false} />
      </>
    );
  } else if (kind === "curve") {
    // Curved screen / arc: the middle bows up by `curveDepth` of the height, with a soft glow cone below it
    const depth = Math.min(1, Math.max(0.05, obj.curveDepth ?? 1));
    const ctrlY = h / 2 - depth * 2 * h;
    const line = Math.max(2, obj.strokeWidth ?? 5);
    const glow = Math.max(60, h * 1.6);
    body = (
      <>
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            ctx.moveTo(-w / 2, h / 2);
            ctx.quadraticCurveTo(0, ctrlY, w / 2, h / 2);
            ctx.lineTo(w / 2 + w * 0.04, h / 2 + glow);
            ctx.lineTo(-w / 2 - w * 0.04, h / 2 + glow);
            ctx.closePath();
            ctx.fillShape(shape);
          }}
          fillLinearGradientStartPoint={{ x: 0, y: -h / 2 }}
          fillLinearGradientEndPoint={{ x: 0, y: h / 2 + glow }}
          fillLinearGradientColorStops={[0, tint(fill, 0.28), 1, tint(fill, 0)]}
          listening={false}
        />
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            ctx.moveTo(-w / 2, h / 2);
            ctx.quadraticCurveTo(0, ctrlY, w / 2, h / 2);
            ctx.strokeShape(shape);
          }}
          stroke={fill}
          strokeWidth={line}
          lineCap="round"
          opacity={opacity}
          listening={false}
        />
        {/* Click target: the line itself is too thin to hit */}
        <Rect x={-w / 2} y={-h / 2 - 6} width={w} height={h + 16} fill="rgba(0,0,0,0.001)" />
      </>
    );
  } else if (kind === "ellipse") {
    body = <Ellipse x={0} y={0} radiusX={w / 2} radiusY={h / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
  } else if (kind === "triangle") {
    body = <Line points={[0, -h / 2, w / 2, h / 2, -w / 2, h / 2]} closed fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
  } else if (kind === "diamond") {
    body = <Line points={[0, -h / 2, w / 2, 0, 0, h / 2, -w / 2, 0]} closed fill={fill} stroke={stroke} strokeWidth={strokeWidth} opacity={opacity} />;
  } else {
    body = (
      <Rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill={fill}
        cornerRadius={kind === "line" ? 2 : obj.cornerRadius ?? 6}
        stroke={stroke}
        strokeWidth={kind === "line" ? Math.min(strokeWidth, 1) : strokeWidth}
        opacity={opacity}
      />
    );
  }

  const labelY = kind === "curve" ? h / 2 + 10 : -fontSize / 2;
  return (
    <Group
      x={obj.x}
      y={obj.y}
      rotation={obj.rotation || 0}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
    >
      {body}
      {selected && (
        <Rect
          x={-w / 2 - 4}
          y={-h / 2 - 6}
          width={w + 8}
          height={h + (kind === "curve" ? 22 : kind === "icon" ? 24 : 12)}
          stroke="#e11d48"
          strokeWidth={1.5}
          dash={[6, 4]}
          listening={false}
        />
      )}
      {label && kind === "icon" && (
        <Text
          x={-Math.max(w, 96) / 2}
          y={h / 2 + 4}
          width={Math.max(w, 96)}
          text={label}
          align="center"
          fill="#475569"
          fontFamily="sans-serif"
          fontStyle="bold"
          fontSize={fontSize > 12 ? fontSize : 10}
          listening={false}
        />
      )}
      {label && kind !== "line" && kind !== "icon" && (
        <Text
          x={-w / 2}
          y={labelY}
          width={w}
          text={label}
          align="center"
          fill={kind === "curve" ? obj.textColor || "#64748b" : labelColor}
          fontFamily="sans-serif"
          fontStyle={kind === "curve" ? "italic" : "bold"}
          fontSize={fontSize}
          listening={false}
        />
      )}
    </Group>
  );
}

const BASE_SEAT = 14; // size of a standard seat at the default seat gap

/** "07" style seat number */
function seatNumberText(seat: UniversalSeat): string {
  const n = seat.seatNumber || "";
  return /^\d$/.test(n) ? `0${n}` : n;
}

/** One seat, drawn the way a booking app shows it: outlined, tinted, shaped by seat type, number inside */
function SeatMark({ seat, x, y, color, showNumber }: { seat: UniversalSeat; x: number; y: number; color: string; showNumber: boolean }) {
  const S = seat.size || BASE_SEAT;
  const k = S / BASE_SEAT;
  const shape = seat.shape || "square";
  const fill = tint(color, 0.16);
  const fontSize = Math.max(5, S * 0.46);
  const text = showNumber && S >= 10 ? seatNumberText(seat) : "";
  const number = (w: number) =>
    text ? (
      <Text x={-w / 2} y={-fontSize / 2 + 0.5} width={w} text={text} align="center" fill={color} fontSize={fontSize} fontStyle="bold" listening={false} />
    ) : null;

  if (shape === "round") {
    return (
      <Group x={x} y={y}>
        <Circle radius={S / 2 + 0.5 * k} fill={fill} stroke={color} strokeWidth={1.5 * k} />
        {number(S)}
      </Group>
    );
  }
  if (shape === "wheelchair") {
    const r = S / 2 + 1.5 * k;
    return (
      <Group x={x} y={y}>
        <Circle radius={r} fill={color} />
        <Text x={-r} y={-5.5 * k} width={r * 2} text="♿" align="center" fill="#ffffff" fontSize={11 * k} listening={false} />
      </Group>
    );
  }
  if (shape === "recliner") {
    const natural = S * 1.45;
    const w = seat.slotWidth ? Math.min(natural, Math.max(S, seat.slotWidth - 4)) : natural;
    return (
      <Group x={x} y={y}>
        <Rect x={-w / 2} y={-S / 2} width={w} height={S} cornerRadius={4 * k} fill={fill} stroke={color} strokeWidth={1.4 * k} />
        <Rect x={-w / 2} y={-S / 2} width={w} height={4 * k} cornerRadius={2 * k} fill={color} />
        <Rect x={-w / 2 - 2 * k} y={-S / 2 + 4 * k} width={3 * k} height={S - 5 * k} cornerRadius={1.5 * k} fill={color} />
        <Rect x={w / 2 - 1 * k} y={-S / 2 + 4 * k} width={3 * k} height={S - 5 * k} cornerRadius={1.5 * k} fill={color} />
        {number(w)}
      </Group>
    );
  }
  if (shape === "couple") {
    const natural = S * 1.9;
    const w = seat.slotWidth ? Math.min(natural, Math.max(S, seat.slotWidth - 4)) : natural;
    return (
      <Group x={x} y={y}>
        <Rect x={-w / 2} y={-S / 2} width={w} height={S} cornerRadius={5 * k} fill={fill} stroke={color} strokeWidth={1.4 * k} />
        <Line points={[0, -S / 2 + 2 * k, 0, S / 2 - 2 * k]} stroke={color} strokeWidth={1 * k} />
        <Rect x={-w / 2} y={-S / 2} width={w} height={3.5 * k} cornerRadius={2 * k} fill={color} />
        {number(w)}
      </Group>
    );
  }
  return (
    <Group x={x} y={y}>
      <Rect x={-S / 2} y={-S / 2} width={S} height={S} cornerRadius={3 * k} fill={fill} stroke={color} strokeWidth={1.4 * k} />
      {number(S)}
    </Group>
  );
}

interface StandSeatsProps {
  obj: UniversalVenueObject;
  seatTypes: SeatType[];
  /** Seats currently picked for editing (their slot keys) */
  selectedKeys?: string[];
  /** Click on a seat; `additive` is true with Shift / Ctrl / Cmd */
  onSeatClick?: (seat: UniversalSeat, additive: boolean) => void;
  /** Draw seats that were taken out as dashed outlines so they can be brought back */
  showRemoved?: boolean;
  /** Subtract this from every seat position (used when the parent group is already moved to the stand) */
  offsetX?: number;
  offsetY?: number;
}

/**
 * The real seats of a stand. Row names sit in a column at the left and right edge of the block
 * (not hugging the seats), and each seat shows its number, when those options are on.
 */
export function StandSeats({ obj, seatTypes, offsetX = 0, offsetY = 0, selectedKeys, onSeatClick, showRemoved }: StandSeatsProps) {
  const seats = useMemo(
    () => generateSeatsForObject(obj, seatTypes, { includeRemoved: !!showRemoved }),
    [obj, seatTypes, showRemoved]
  );
  const picked = useMemo(() => new Set(selectedKeys || []), [selectedKeys]);

  const rowEnds = useMemo(() => {
    const ends = new Map<string, { first: UniversalSeat; last: UniversalSeat; second?: UniversalSeat; beforeLast?: UniversalSeat }>();
    seats.forEach((s) => {
      const cur = ends.get(s.rowLabel);
      if (!cur) ends.set(s.rowLabel, { first: s, last: s });
      else {
        if (!cur.second) cur.second = s;
        cur.beforeLast = cur.last;
        cur.last = s;
      }
    });
    return Array.from(ends.entries());
  }, [seats]);

  const frame = useMemo(() => (obj.type === "grid_stand" && !obj.rotation ? gridStandSize(obj, seatTypes) : null), [obj, seatTypes]);
  // Grid blocks normally keep their row names in the shared left/right columns (see RowLabelGutter)
  const showRowLabels = obj.showRowLabels !== false && !usesLabelColumns(obj) && (obj.type === "grid_stand" || seats.length < 1200);
  const showNumbers = obj.showSeatNumbers !== false;
  const dense = seats.length > 1500;

  return (
    <Group listening={!!onSeatClick}>
      {seats.map((s, i) => {
        const x = s.x - offsetX;
        const y = s.y - offsetY;
        const isPicked = !!s.slotKey && picked.has(s.slotKey);
        const S = s.size || BASE_SEAT;
        const w = S * (s.widthFactor || 1);
        return (
          <Group
            key={`${s.id}#${i}`}
            onClick={
              onSeatClick
                ? (e) => {
                    e.cancelBubble = true;
                    onSeatClick(s, !!(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey));
                  }
                : undefined
            }
            onTap={onSeatClick ? () => onSeatClick(s, false) : undefined}
            onMouseEnter={
              onSeatClick
                ? (e) => {
                    const c = e.target.getStage()?.container();
                    if (c) c.style.cursor = "pointer";
                  }
                : undefined
            }
            onMouseLeave={
              onSeatClick
                ? (e) => {
                    const c = e.target.getStage()?.container();
                    if (c) c.style.cursor = "default";
                  }
                : undefined
            }
          >
            {s.removed ? (
              <Rect x={x - S / 2} y={y - S / 2} width={S} height={S} cornerRadius={3} stroke="#94a3b8" strokeWidth={1} dash={[3, 3]} fill="rgba(148,163,184,0.08)" />
            ) : dense ? (
              <Circle x={x} y={y} radius={2.5} fill={s.color || obj.color} />
            ) : (
              <SeatMark seat={s} x={x} y={y} color={s.color || obj.color} showNumber={showNumbers} />
            )}
            {isPicked && (
              <Rect x={x - w / 2 - 3} y={y - S / 2 - 3} width={w + 6} height={S + 6} cornerRadius={6} stroke="#e11d48" strokeWidth={2} listening={false} />
            )}
          </Group>
        );
      })}
      {showRowLabels &&
        rowEnds.map(([label, { first, last, second, beforeLast }]) => {
          const y = first.y - offsetY - 5;
          if (frame) {
            // Grid blocks: a label column at the block's left and right edge, in line whatever each row's length
            const cx = obj.x - offsetX;
            return (
              <Group key={`label-${label}`} listening={false}>
                <Text x={cx - frame.width / 2 - 26} y={y} width={22} text={label} align="right" fill="#475569" fontSize={11} fontStyle="bold" />
                <Text x={cx + frame.width / 2 + 4} y={y} width={22} text={label} align="left" fill="#475569" fontSize={11} fontStyle="bold" />
              </Group>
            );
          }
          // Curved blocks: at the two ends of each arc, a little way off the seats
          const size = first.size || BASE_SEAT;
          const lm = obj.type === "block" ? blockLabelMetrics(obj, size) : null;
          const reach = lm ? lm.reach : (size * (first.widthFactor || 1)) / 2 + size * 0.9;
          const fs = lm ? lm.fs : Math.max(10, size * 0.9);
          const at = (seat: UniversalSeat, other: UniversalSeat | undefined, key: string) => {
            let dx = other ? seat.x - other.x : -1;
            let dy = other ? seat.y - other.y : 0;
            const len = Math.hypot(dx, dy) || 1;
            dx /= len;
            dy /= len;
            return (
              <Text
                key={key}
                x={seat.x - offsetX + dx * reach - 14}
                y={seat.y - offsetY + dy * reach - fs / 2}
                width={28}
                text={label}
                align="center"
                fill="#475569"
                fontSize={fs}
                fontStyle="bold"
                listening={false}
              />
            );
          };
          return (
            <Group key={`label-${label}`} listening={false}>
              {at(first, second, "s")}
              {last !== first && at(last, beforeLast, "e")}
            </Group>
          );
        })}
    </Group>
  );
}

/** The heading above a grid block: price and name, with a thin line under it. Drag the text to move it when `editable`. */
export function StandHeading({
  obj,
  seatTypes,
  editable = false,
  onMove,
}: {
  obj: UniversalVenueObject;
  seatTypes: SeatType[];
  editable?: boolean;
  /** New offsets (pixels from the normal place) after the text was dragged */
  onMove?: (offsetX: number, offsetY: number) => void;
}) {
  const f = gridStandSize(obj, seatTypes);
  const text = standHeadingText(obj, seatTypes);
  const fontSize = obj.headingFontSize || 12;
  const align = obj.headingAlign || "center";
  const anchor = standHeadingAnchor(obj, f.width, f.height);
  const box = useMemo(() => {
    const probe = new Konva.Text({ text, fontSize, fontStyle: "bold" });
    const size = { w: Math.ceil(probe.width()) + 8, h: Math.ceil(probe.height()) + 4 };
    probe.destroy();
    return size;
  }, [text, fontSize]);
  if (obj.showTierHeading === false) return null;
  // The group sits at the text's anchor point; the text hangs off it according to its alignment
  const left = align === "left" ? 0 : align === "right" ? -box.w : -box.w / 2;
  return (
    <Group>
      <Line points={[-f.width / 2, -f.height / 2 - 8, f.width / 2, -f.height / 2 - 8]} stroke="#cbd5e1" strokeWidth={1} listening={false} />
      <Group
        x={anchor.x}
        y={anchor.y}
        listening={editable}
        draggable={editable}
        onDragStart={(e) => {
          e.cancelBubble = true;
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          const base = standHeadingAnchor({ ...obj, headingOffsetX: 0, headingOffsetY: 0 }, f.width, f.height);
          onMove?.(Math.round(e.target.x() - base.x), Math.round(e.target.y() - base.y));
        }}
        onMouseEnter={(e) => {
          const c = e.target.getStage()?.container();
          if (editable && c) c.style.cursor = "move";
        }}
        onMouseLeave={(e) => {
          const c = e.target.getStage()?.container();
          if (c) c.style.cursor = "default";
        }}
      >
        {editable && (
          <Rect x={left - 2} y={-2} width={box.w + 4} height={box.h + 2} stroke="#e11d48" strokeWidth={1} dash={[4, 3]} cornerRadius={4} fill="rgba(225,29,72,0.04)" />
        )}
        <Text x={left + 4} y={0} text={text} align={align} fill="#334155" fontSize={fontSize} fontStyle="bold" />
      </Group>
    </Group>
  );
}

/**
 * Row names for every grid block, in two columns at the far left and right of the whole layout
 * (the way a booking app lines them up), each at the height of its row.
 */
export function RowLabelGutter({ objects, seatTypes }: { objects: UniversalVenueObject[]; seatTypes: SeatType[] }) {
  const cols = useMemo(() => rowLabelColumns(objects, seatTypes), [objects, seatTypes]);
  if (!cols) return null;
  const W = 28;
  const strip = (cx: number) => (
    <Rect x={cx - W / 2} y={cols.top - 14} width={W} height={cols.bottom - cols.top + 28} cornerRadius={10} fill="#f1f5f9" listening={false} />
  );
  return (
    <Group listening={false}>
      {strip(cols.left)}
      {strip(cols.right)}
      {cols.entries.map((e) => (
        <Group key={e.key}>
          <Text x={cols.left - W / 2} y={e.y - 6} width={W} text={e.label} align="center" fill="#475569" fontSize={11} fontStyle="bold" />
          <Text x={cols.right - W / 2} y={e.y - 6} width={W} text={e.label} align="center" fill="#475569" fontSize={11} fontStyle="bold" />
        </Group>
      ))}
    </Group>
  );
}

interface TextNodeProps {
  obj: UniversalVenueObject;
  selected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}

/** Free text the admin typed onto the layout: any words, size, colour, bold / italic and alignment */
export function TextNode({ obj, selected, draggable, onSelect, onDragEnd }: TextNodeProps) {
  const size = useMemo(
    () => measureText(obj),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [obj.label, obj.fontSize, obj.textBold, obj.textItalic, obj.textAlign]
  );
  const w = size.width;
  const h = size.height;
  return (
    <Group
      x={obj.x}
      y={obj.y}
      rotation={obj.rotation || 0}
      draggable={draggable}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
      onMouseEnter={(e) => {
        const c = e.target.getStage()?.container();
        if (draggable && c) c.style.cursor = "move";
      }}
      onMouseLeave={(e) => {
        const c = e.target.getStage()?.container();
        if (c) c.style.cursor = "default";
      }}
    >
      {/* Slightly larger invisible box so thin text is easy to click and drag */}
      <Rect x={-w / 2 - 6} y={-h / 2 - 4} width={w + 12} height={h + 8} fill="rgba(0,0,0,0.001)" />
      <Text
        x={-w / 2}
        y={-h / 2}
        width={w}
        text={obj.label || " "}
        align={obj.textAlign || "center"}
        fill={obj.textColor || obj.color || "#0f172a"}
        fontFamily="sans-serif"
        fontStyle={textFontStyle(obj)}
        fontSize={obj.fontSize || 16}
        opacity={obj.opacity ?? 1}
        listening={false}
      />
      {selected && (
        <Rect x={-w / 2 - 6} y={-h / 2 - 4} width={w + 12} height={h + 8} stroke="#e11d48" strokeWidth={1.5} dash={[6, 4]} listening={false} />
      )}
    </Group>
  );
}

/** "ETB 200" or "ETB 200 - 800" across the seat types a stand uses */
export function standPriceLabel(obj: UniversalVenueObject, seatTypes: SeatType[]): string {
  return standPriceText(obj, seatTypes);
}
