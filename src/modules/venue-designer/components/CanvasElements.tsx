"use client";

import React, { useMemo } from "react";
import { Circle, Ellipse, Group, Line, Rect, Text } from "react-konva";
import { SeatType, UniversalVenueObject } from "../types";
import { generateSeatsForObject } from "../utils/geometryEngine";

interface ShapeNodeProps {
  obj: UniversalVenueObject;
  selected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}

/** A free shape or ready-made venue element: rectangle, circle, triangle, diamond or line, with an optional label */
export function ShapeNode({ obj, selected, draggable, onSelect, onDragEnd }: ShapeNodeProps) {
  const w = Math.max(2, obj.width);
  const h = Math.max(2, obj.height);
  const fill = obj.color;
  const stroke = selected ? "#ffffff" : obj.strokeColor || "#0f172a";
  const strokeWidth = selected ? 3 : obj.strokeWidth ?? 1.5;
  const opacity = obj.opacity ?? 0.92;
  const kind = obj.shapeKind || "rect";

  let body: React.ReactNode;
  if (kind === "ellipse") {
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

  const label = obj.label || "";
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
      {label && kind !== "line" && (
        <Text
          x={-w / 2}
          y={-(obj.fontSize || 12) / 2}
          width={w}
          text={label}
          align="center"
          fill={obj.textColor || "#ffffff"}
          fontFamily="sans-serif"
          fontStyle="bold"
          fontSize={obj.fontSize || 12}
          listening={false}
        />
      )}
    </Group>
  );
}

interface StandSeatsProps {
  obj: UniversalVenueObject;
  seatTypes: SeatType[];
  /** Subtract this from every seat position (used when the parent group is already moved to the stand) */
  offsetX?: number;
  offsetY?: number;
}

/** The real seats of a stand as coloured dots, with the row name at the start of each row */
export function StandSeats({ obj, seatTypes, offsetX = 0, offsetY = 0 }: StandSeatsProps) {
  const seats = useMemo(() => generateSeatsForObject(obj, seatTypes), [obj, seatTypes]);

  const rowStarts = useMemo(() => {
    const first = new Map<string, { x: number; y: number }>();
    seats.forEach((s) => {
      if (!first.has(s.rowLabel)) first.set(s.rowLabel, { x: s.x, y: s.y });
    });
    return Array.from(first.entries());
  }, [seats]);

  // Dots stay readable on big stands and cheap on huge ones
  const radius = seats.length > 1500 ? 2.5 : 4.5;
  const showRowLabels = obj.type === "grid_stand" || seats.length < 1200;

  return (
    <Group listening={false}>
      {seats.map((s, i) => (
        <Circle key={`${s.id}#${i}`} x={s.x - offsetX} y={s.y - offsetY} radius={radius} fill={s.color || obj.color} stroke="#0f172a" strokeWidth={0.6} />
      ))}
      {showRowLabels &&
        rowStarts.map(([label, pos]) => (
          <Text
            key={`label-${label}`}
            x={pos.x - offsetX - (obj.type === "grid_stand" ? 26 : 22)}
            y={pos.y - offsetY - 5}
            width={20}
            text={label}
            align="right"
            fill="#cbd5e1"
            fontSize={9}
            fontStyle="bold"
          />
        ))}
    </Group>
  );
}
