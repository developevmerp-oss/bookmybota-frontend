"use client";
import React from "react";
import { Group, Line, Circle, Text } from "react-konva";

interface PolygonDrawingToolProps {
  isDrawing: boolean;
  points: number[]; // [x1, y1, x2, y2, ...]
  cursorPos: { x: number; y: number } | null;
  onClosePolygon: () => void;
}

export default function PolygonDrawingTool({
  isDrawing,
  points,
  cursorPos,
  onClosePolygon,
}: PolygonDrawingToolProps) {
  if (!isDrawing || points.length === 0) return null;

  const numVertices = points.length / 2;
  const startX = points[0];
  const startY = points[1];
  const lastX = points[points.length - 2];
  const lastY = points[points.length - 1];

  // Preview line from last vertex to current cursor position
  const previewPoints = cursorPos ? [lastX, lastY, cursorPos.x, cursorPos.y] : [];

  // Check if cursor is close to start vertex (snap threshold = 20px)
  const isCloseToStart =
    cursorPos &&
    numVertices >= 3 &&
    Math.hypot(cursorPos.x - startX, cursorPos.y - startY) < 22;

  return (
    <Group listening={false}>
      {/* Existing confirmed polygon edges */}
      {points.length >= 4 && (
        <Line
          points={points}
          stroke="#f59e0b"
          strokeWidth={3}
          lineCap="round"
          lineJoin="round"
          dash={[8, 4]}
        />
      )}

      {/* Floating preview line to cursor */}
      {previewPoints.length === 4 && (
        <Line
          points={previewPoints}
          stroke={isCloseToStart ? "#10b981" : "#f59e0b"}
          strokeWidth={2.5}
          lineCap="round"
          dash={[4, 4]}
        />
      )}

      {/* Vertex markers */}
      {Array.from({ length: numVertices }).map((_, i) => {
        const vx = points[i * 2];
        const vy = points[i * 2 + 1];
        const isFirst = i === 0;

        return (
          <Group key={`vertex-${i}`}>
            <Circle
              x={vx}
              y={vy}
              radius={isFirst ? (isCloseToStart ? 10 : 7) : 5}
              fill={isFirst ? (isCloseToStart ? "#10b981" : "#f59e0b") : "#ffffff"}
              stroke="#0f172a"
              strokeWidth={2}
            />
            {isFirst && (
              <Circle
                x={vx}
                y={vy}
                radius={16}
                stroke={isCloseToStart ? "#10b981" : "#f59e0b"}
                strokeWidth={1.5}
                dash={[3, 3]}
              />
            )}
          </Group>
        );
      })}

      {/* Helper tooltip near cursor */}
      {cursorPos && (
        <Group x={cursorPos.x + 15} y={cursorPos.y - 30}>
          <Text
            text={
              isCloseToStart
                ? "🎯 Click start point to Close Stand!"
                : numVertices >= 3
                ? `Point ${numVertices + 1} • Press Enter or click start to close • Esc to cancel`
                : `Click point ${numVertices + 1} to build polygon`
            }
            fontSize={11}
            fontStyle="bold"
            fill={isCloseToStart ? "#34d399" : "#fde047"}
            shadowColor="#000000"
            shadowBlur={4}
          />
        </Group>
      )}
    </Group>
  );
}
