"use client";
import React from "react";
import { BMSBlockDef } from "./types";
import { StadiumGroundConfigV2 } from "../StadiumStudioV2/types";

interface BMSMiniMapProps {
  blocks: BMSBlockDef[];
  groundConfig: StadiumGroundConfigV2;
  canvasW?: number;
  canvasH?: number;
  onNavigate?: (x: number, y: number) => void;
}

export default function BMSMiniMap({
  blocks,
  groundConfig,
  canvasW = 1600,
  canvasH = 1200,
  onNavigate,
}: BMSMiniMapProps) {
  const mapW = 160;
  const mapH = 120;
  const scaleX = mapW / canvasW;
  const scaleY = mapH / canvasH;

  const pitchX = (groundConfig.x ?? canvasW / 2) * scaleX;
  const pitchY = (groundConfig.y ?? canvasH / 2) * scaleY;
  const pitchW = (groundConfig.width ?? 440) * scaleX;
  const pitchH = (groundConfig.height ?? 290) * scaleY;

  return (
    <div
      onClick={(e) => {
        if (!onNavigate) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        const targetCanvasX = clickX / scaleX;
        const targetCanvasY = clickY / scaleY;
        onNavigate(targetCanvasX, targetCanvasY);
      }}
      className="w-40 h-30 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden cursor-crosshair relative p-1 group"
      title="Stadium Radar Mini-Map (Click to navigate)"
    >
      <div className="w-full h-full relative bg-[#070b12] rounded-xl overflow-hidden">
        {/* Central Pitch */}
        <div
          className="absolute rounded border border-white/40"
          style={{
            left: `${pitchX - pitchW / 2}px`,
            top: `${pitchY - pitchH / 2}px`,
            width: `${pitchW}px`,
            height: `${pitchH}px`,
            backgroundColor: groundConfig.turf_color || "#166534",
          }}
        />

        {/* Stadium Blocks */}
        {blocks.map((b) => {
          const isArc = b.shape === "arc";
          const bx = (b.x || b.stadiumCenterX || canvasW / 2) * scaleX;
          const by = (b.y || b.stadiumCenterY || canvasH / 2) * scaleY;
          const bw = (b.width || 200) * scaleX;
          const bh = (b.height || 100) * scaleY;

          return (
            <div
              key={b.id}
              className="absolute rounded-sm opacity-80 transition-opacity hover:opacity-100"
              style={{
                left: `${bx - bw / 2}px`,
                top: `${by - bh / 2}px`,
                width: `${Math.max(4, bw)}px`,
                height: `${Math.max(3, bh)}px`,
                backgroundColor: b.color || "#f59e0b",
                transform: `rotate(${b.rotation || 0}deg)`,
              }}
            />
          );
        })}

        {/* Radar Label */}
        <div className="absolute top-1 left-1.5 text-[8px] font-mono font-bold text-slate-400 bg-slate-900/90 px-1 rounded">
          RADAR
        </div>
      </div>
    </div>
  );
}
