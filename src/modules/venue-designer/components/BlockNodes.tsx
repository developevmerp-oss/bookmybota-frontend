"use client";

import React, { useMemo, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Text } from "react-konva";
import type Konva from "konva";
import { SeatType, UniversalSeat, UniversalVenueObject } from "../types";
import { generateSeatsForObject, standPriceText } from "../utils/geometryEngine";
import { polyBounds, polyCentroid, rotatePoints } from "../utils/blockGeometry";
import { StandSeats, tint } from "./CanvasElements";

/** Seats of a block are drawn once the canvas is zoomed in this far (or the block is selected / focused) */
export const BLOCK_SEAT_ZOOM = 0.8;

export function isPolygonShape(o: UniversalVenueObject): boolean {
  return o.type === "shape" && o.shapeKind === "polygon" && !!o.points && o.points.length >= 6;
}

interface HandlesProps {
  obj: UniversalVenueObject;
  scale: number;
  onBegin: () => void;
  onChange: (points: number[]) => void;
}

/** Corner handles (drag to move, double-click to remove) and edge dots (click to add a corner) */
function PolygonHandles({ obj, scale, onBegin, onChange }: HandlesProps) {
  const pts = obj.points || [];
  const n = pts.length / 2;
  const r = 6 / scale;
  const mid = 4.5 / scale;
  return (
    <>
      {Array.from({ length: n }).map((_, i) => {
        const j = (i + 1) % n;
        const mx = (pts[i * 2] + pts[j * 2]) / 2;
        const my = (pts[i * 2 + 1] + pts[j * 2 + 1]) / 2;
        return (
          <Circle
            key={`mid-${i}`}
            x={mx}
            y={my}
            radius={mid}
            fill="#ffffff"
            stroke="#e11d48"
            strokeWidth={1.2 / scale}
            opacity={0.85}
            onMouseDown={(e) => {
              e.cancelBubble = true;
            }}
            onClick={(e) => {
              e.cancelBubble = true;
              onBegin();
              const next = pts.slice();
              next.splice((i + 1) * 2, 0, mx, my);
              onChange(next);
            }}
          />
        );
      })}
      {Array.from({ length: n }).map((_, i) => (
        <Circle
          key={`pt-${i}`}
          x={pts[i * 2]}
          y={pts[i * 2 + 1]}
          radius={r}
          fill="#e11d48"
          stroke="#ffffff"
          strokeWidth={1.5 / scale}
          draggable
          onMouseDown={(e) => {
            e.cancelBubble = true;
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            onBegin();
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const next = pts.slice();
            next[i * 2] = e.target.x();
            next[i * 2 + 1] = e.target.y();
            onChange(next);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
          }}
          onDblClick={(e) => {
            e.cancelBubble = true;
            if (n <= 3) return;
            onBegin();
            const next = pts.slice();
            next.splice(i * 2, 2);
            onChange(next);
          }}
        />
      ))}
    </>
  );
}

interface BlockShapeProps {
  obj: UniversalVenueObject;
  seatTypes: SeatType[];
  selected: boolean;
  scale: number;
  dimmed: boolean;
  focused: boolean;
  draggable: boolean;
  activeSeatKeys?: string[];
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onBegin: () => void;
  onPoints: (points: number[]) => void;
  onZoom: () => void;
  onSeatClick: (seat: UniversalSeat, additive: boolean) => void;
}

function BlockShape({
  obj,
  seatTypes,
  selected,
  scale,
  dimmed,
  focused,
  draggable,
  activeSeatKeys,
  onSelect,
  onDragEnd,
  onBegin,
  onPoints,
  onZoom,
  onSeatClick,
}: BlockShapeProps) {
  const pts = obj.points || [];
  const count = useMemo(() => generateSeatsForObject(obj, seatTypes).length, [obj, seatTypes]);
  const showSeats = selected || focused || scale >= BLOCK_SEAT_ZOOM;
  // Row names only for the block being worked on, so they do not run into the next block's seats
  const seatObj = useMemo(() => (selected || focused ? obj : { ...obj, showRowLabels: false }), [obj, selected, focused]);
  const shown = useMemo(() => rotatePoints(pts, obj.rotation || 0), [pts, obj.rotation]);
  const c = useMemo(() => polyCentroid(shown), [shown]);
  const b = useMemo(() => polyBounds(shown), [shown]);
  const price = standPriceText(obj, seatTypes);
  const fontSize = Math.max(11, Math.min(26, (b.maxX - b.minX) / 9));

  return (
    <Group
      x={obj.x}
      y={obj.y}
      draggable={draggable && !dimmed}
      opacity={dimmed ? 0.22 : 1}
      listening={!dimmed}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={onSelect}
      onDblClick={(e) => {
        e.cancelBubble = true;
        onZoom();
      }}
      onDblTap={onZoom}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        onDragEnd(e.target.x(), e.target.y());
      }}
    >
      <Group rotation={obj.rotation || 0}>
      <Line
        points={pts}
        closed
        fill={selected ? "rgba(225,29,72,0.10)" : tint(obj.color, showSeats ? 0.08 : 0.55)}
        stroke={selected ? "#e11d48" : tint(obj.color, 0.9)}
        strokeWidth={selected ? 2.5 : 1.5}
        lineJoin="round"
      />
      </Group>
      {showSeats ? (
        <StandSeats
          obj={seatObj}
          seatTypes={seatTypes}
          offsetX={obj.x}
          offsetY={obj.y}
          selectedKeys={selected ? activeSeatKeys : undefined}
          onSeatClick={onSeatClick}
          showRemoved={selected}
        />
      ) : null}
      {!showSeats && (
        <Group listening={false}>
          <Text
            x={c.x - (b.maxX - b.minX) / 2}
            y={c.y - fontSize * 0.9}
            width={b.maxX - b.minX}
            align="center"
            text={obj.name.toUpperCase()}
            fontSize={fontSize}
            fontStyle="bold"
            fill="#ffffff"
          />
          <Text
            x={c.x - (b.maxX - b.minX) / 2}
            y={c.y + fontSize * 0.2}
            width={b.maxX - b.minX}
            align="center"
            text={`${count} seats${price ? `  ${price}` : ""}`}
            fontSize={Math.max(9, fontSize * 0.5)}
            fill="#ffffff"
            opacity={0.9}
          />
        </Group>
      )}
      {showSeats && obj.showTierHeading !== false && (
        <Text
          x={c.x - (b.maxX - b.minX) / 2}
          y={b.minY - 20}
          width={b.maxX - b.minX}
          align="center"
          text={`${obj.level ? `${obj.level.toUpperCase()}  ·  ` : ""}${obj.name.toUpperCase()}`}
          fontSize={12}
          fontStyle="bold"
          fill="#334155"
          listening={false}
        />
      )}
      {selected && draggable && (
        <Group rotation={obj.rotation || 0}>
          <PolygonHandles obj={obj} scale={scale} onBegin={onBegin} onChange={onPoints} />
        </Group>
      )}
    </Group>
  );
}

interface PolygonShapeProps {
  obj: UniversalVenueObject;
  selected: boolean;
  scale: number;
  draggable: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onBegin: () => void;
  onPoints: (points: number[]) => void;
}

function PolygonShape({ obj, selected, scale, draggable, onSelect, onDragEnd, onBegin, onPoints }: PolygonShapeProps) {
  const pts = obj.points || [];
  const c = useMemo(() => polyCentroid(pts), [pts]);
  const b = useMemo(() => polyBounds(pts), [pts]);
  const w = b.maxX - b.minX;
  return (
    <Group
      x={obj.x}
      y={obj.y}
      rotation={obj.rotation || 0}
      draggable={draggable}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={onSelect}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        onDragEnd(e.target.x(), e.target.y());
      }}
    >
      <Line
        points={pts}
        closed
        fill={obj.color}
        opacity={obj.opacity ?? 0.95}
        stroke={selected ? "#e11d48" : "rgba(15,23,42,0.35)"}
        strokeWidth={selected ? 2.5 : 1.2}
        lineJoin="round"
      />
      {obj.label ? (
        <Text
          x={c.x - w / 2}
          y={c.y - (obj.fontSize || 14) / 2}
          width={w}
          align="center"
          text={obj.label}
          fontSize={obj.fontSize || 14}
          fontStyle="bold"
          fill={obj.textColor || "#ffffff"}
          listening={false}
        />
      ) : null}
      {selected && draggable && <PolygonHandles obj={obj} scale={scale} onBegin={onBegin} onChange={onPoints} />}
    </Group>
  );
}

interface LayerCommon {
  objects: UniversalVenueObject[];
  selectedId: string | null;
  scale: number;
  draggable: boolean;
  onSelect: (id: string) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onBegin: () => void;
  onPoints: (id: string, points: number[]) => void;
}

/** Ground, pitch and stage shapes drawn as polygons. Sits under the seats. */
export function PolygonShapesLayer({ objects, selectedId, scale, draggable, onSelect, onDragEnd, onBegin, onPoints }: LayerCommon) {
  const list = objects.filter(isPolygonShape);
  if (list.length === 0) return null;
  return (
    <Layer>
      {list.map((obj) => (
        <PolygonShape
          key={obj.id}
          obj={obj}
          selected={selectedId === obj.id}
          scale={scale}
          draggable={draggable}
          onSelect={() => onSelect(obj.id)}
          onDragEnd={(x, y) => onDragEnd(obj.id, x, y)}
          onBegin={onBegin}
          onPoints={(pts) => onPoints(obj.id, pts)}
        />
      ))}
    </Layer>
  );
}

interface BlockLayerProps extends LayerCommon {
  seatTypes: SeatType[];
  levelFilter: string;
  focusId: string | null;
  activeSeatKeys: string[];
  onZoom: (id: string) => void;
  onSeatClick: (obj: UniversalVenueObject, seat: UniversalSeat, additive: boolean) => void;
}

/** Stadium blocks. Click to select, double-click to zoom in and see the seats. */
export function BlockLayer({
  objects,
  seatTypes,
  selectedId,
  scale,
  draggable,
  levelFilter,
  focusId,
  activeSeatKeys,
  onSelect,
  onDragEnd,
  onBegin,
  onPoints,
  onZoom,
  onSeatClick,
}: BlockLayerProps) {
  const list = objects.filter((o) => o.type === "block" && o.points && o.points.length >= 6);
  if (list.length === 0) return null;
  return (
    <Layer>
      {list.map((obj) => (
        <BlockShape
          key={obj.id}
          obj={obj}
          seatTypes={seatTypes}
          selected={selectedId === obj.id}
          scale={scale}
          dimmed={levelFilter !== "all" && (obj.level || "") !== levelFilter && selectedId !== obj.id}
          focused={focusId === obj.id}
          draggable={draggable}
          activeSeatKeys={selectedId === obj.id ? activeSeatKeys : undefined}
          onSelect={() => onSelect(obj.id)}
          onDragEnd={(x, y) => onDragEnd(obj.id, x, y)}
          onBegin={onBegin}
          onPoints={(pts) => onPoints(obj.id, pts)}
          onZoom={() => onZoom(obj.id)}
          onSeatClick={(seat, additive) => onSeatClick(obj, seat, additive)}
        />
      ))}
    </Layer>
  );
}

interface DrawOverlayProps {
  active: boolean;
  width: number;
  height: number;
  scale: number;
  points: number[];
  onAdd: (x: number, y: number) => void;
  onFinish: () => void;
}

/** Click to place corners, double-click to finish. Only listens while the draw tool is on. */
export function PolygonDrawOverlay({ active, width, height, scale, points, onAdd, onFinish }: DrawOverlayProps) {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  if (!active) return null;
  const withHover = hover ? [...points, hover.x, hover.y] : points;
  const pointer = (node: Konva.Node | null) => node?.getLayer()?.getRelativePointerPosition() ?? null;
  return (
    <Layer>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="rgba(225,29,72,0.03)"
        onMouseMove={(e) => {
          const p = pointer(e.target);
          if (p) setHover({ x: p.x, y: p.y });
        }}
        onClick={(e) => {
          const p = pointer(e.target);
          if (p) onAdd(Math.round(p.x), Math.round(p.y));
        }}
        onTap={(e) => {
          const p = pointer(e.target);
          if (p) onAdd(Math.round(p.x), Math.round(p.y));
        }}
        onDblClick={onFinish}
        onDblTap={onFinish}
      />
      {withHover.length >= 4 && (
        <Line points={withHover} stroke="#e11d48" strokeWidth={2 / scale} dash={[8 / scale, 5 / scale]} fill="rgba(225,29,72,0.08)" closed={points.length >= 6} listening={false} />
      )}
      {Array.from({ length: points.length / 2 }).map((_, i) => (
        <Circle key={i} x={points[i * 2]} y={points[i * 2 + 1]} radius={5 / scale} fill="#e11d48" stroke="#ffffff" strokeWidth={1.5 / scale} listening={false} />
      ))}
    </Layer>
  );
}

interface SeatBoxOverlayProps {
  active: boolean;
  width: number;
  height: number;
  scale: number;
  seats: UniversalSeat[];
  onPick: (keys: string[], additive: boolean) => void;
}

/** Drag a rectangle over the canvas to pick every seat of the selected block inside it */
export function SeatBoxOverlay({ active, width, height, scale, seats, onPick }: SeatBoxOverlayProps) {
  const [box, setBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  if (!active) return null;
  const at = (node: Konva.Node | null) => node?.getLayer()?.getRelativePointerPosition() ?? null;
  const finish = (additive: boolean) => {
    if (!box) return;
    const x1 = Math.min(box.x1, box.x2);
    const x2 = Math.max(box.x1, box.x2);
    const y1 = Math.min(box.y1, box.y2);
    const y2 = Math.max(box.y1, box.y2);
    const keys = seats
      .filter((s) => s.slotKey && s.x >= x1 && s.x <= x2 && s.y >= y1 && s.y <= y2)
      .map((s) => s.slotKey as string);
    setBox(null);
    onPick(keys, additive);
  };
  return (
    <Layer>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="rgba(14,165,233,0.02)"
        onMouseDown={(e) => {
          const p = at(e.target);
          if (p) setBox({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
        }}
        onMouseMove={(e) => {
          const p = at(e.target);
          if (p && box) setBox({ ...box, x2: p.x, y2: p.y });
        }}
        onMouseUp={(e) => finish(!!(e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey))}
      />
      {box && (
        <Rect
          x={Math.min(box.x1, box.x2)}
          y={Math.min(box.y1, box.y2)}
          width={Math.abs(box.x2 - box.x1)}
          height={Math.abs(box.y2 - box.y1)}
          fill="rgba(14,165,233,0.15)"
          stroke="#0284c7"
          strokeWidth={1.5 / scale}
          dash={[6 / scale, 4 / scale]}
          listening={false}
        />
      )}
    </Layer>
  );
}
