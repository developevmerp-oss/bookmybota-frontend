"use client";
import React from "react";
import { Maximize2, RotateCcw, RotateCw, Compass } from "lucide-react";
import { StadiumBlockDefV2 } from "./types";
import { toast } from "sonner";

export interface CornerAlignPadProps {
  block: StadiumBlockDefV2;
  pitchX: number;
  pitchY: number;
  pitchW: number;
  pitchH: number;
  onUpdate: (updatedBlock: StadiumBlockDefV2) => void;
}

export type StadiumDirection = "TL" | "TR" | "BR" | "BL" | "N" | "S" | "E" | "W";

export function calculateCornerAlignment(
  block: StadiumBlockDefV2,
  dir: StadiumDirection,
  pitchX: number,
  pitchY: number,
  pitchW: number,
  pitchH: number
): Partial<StadiumBlockDefV2> {
  const isArc = block.shape === "arc";
  const halfPitchW = pitchW / 2;
  const halfPitchH = pitchH / 2;
  const bw = block.width || 240;
  const bh = block.height || 100;
  const gap = 35;

  if (isArc) {
    // 0° = East, 90° = South, 180° = West, 270° = North
    const arcAngles: Record<StadiumDirection, { start: number; sweep: number }> = {
      TL: { start: 202.5, sweep: 45 },
      TR: { start: 292.5, sweep: 45 },
      BR: { start: 22.5, sweep: 45 },
      BL: { start: 112.5, sweep: 45 },
      N:  { start: 247.5, sweep: 45 },
      E:  { start: 337.5, sweep: 45 },
      S:  { start: 67.5, sweep: 45 },
      W:  { start: 157.5, sweep: 45 },
    };
    const cfg = arcAngles[dir];
    const baseInR = block.innerRadius || 260;
    const baseOutR = block.outerRadius || 335;

    return {
      startAngle: cfg.start,
      sweepAngle: cfg.sweep,
      innerRadius: baseInR,
      outerRadius: baseOutR,
      width: baseOutR * 2,
      height: baseOutR * 2,
      stadiumCenterX: pitchX,
      stadiumCenterY: pitchY,
      x: pitchX,
      y: pitchY,
    };
  }

  // Non-Arc (Rectangle, Pill, Curved, Oval, Polygon)
  switch (dir) {
    case "TL": // Top-Left Corner (NW)
      return {
        rotation: 315, // -45°
        x: Math.round(pitchX - halfPitchW * 0.95 - bw / 2),
        y: Math.round(pitchY - halfPitchH * 0.95 - bh / 2),
      };
    case "TR": // Top-Right Corner (NE)
      return {
        rotation: 45,
        x: Math.round(pitchX + halfPitchW * 0.95 - bw / 2),
        y: Math.round(pitchY - halfPitchH * 0.95 - bh / 2),
      };
    case "BR": // Bottom-Right Corner (SE)
      return {
        rotation: 135,
        x: Math.round(pitchX + halfPitchW * 0.95 - bw / 2),
        y: Math.round(pitchY + halfPitchH * 0.95 - bh / 2),
      };
    case "BL": // Bottom-Left Corner (SW)
      return {
        rotation: 225,
        x: Math.round(pitchX - halfPitchW * 0.95 - bw / 2),
        y: Math.round(pitchY + halfPitchH * 0.95 - bh / 2),
      };
    case "N": // North (Top)
      return {
        rotation: 0,
        x: Math.round(pitchX - bw / 2),
        y: Math.round(pitchY - halfPitchH - bh - gap),
      };
    case "S": // South (Bottom)
      return {
        rotation: 0,
        x: Math.round(pitchX - bw / 2),
        y: Math.round(pitchY + halfPitchH + gap),
      };
    case "W": // West (Left)
      return {
        rotation: 90,
        x: Math.round(pitchX - halfPitchW - bw / 2 - gap),
        y: Math.round(pitchY - bh / 2),
      };
    case "E": // East (Right)
      return {
        rotation: 90,
        x: Math.round(pitchX + halfPitchW + gap),
        y: Math.round(pitchY - bh / 2),
      };
  }
}

export default function CornerAlignPad({
  block,
  pitchX,
  pitchY,
  pitchW,
  pitchH,
  onUpdate,
}: CornerAlignPadProps) {
  const isArc = block.shape === "arc";
  const currentRot = isArc ? Math.round(block.startAngle ?? 0) : Math.round(block.rotation ?? 0);

  const handleAlign = (dir: StadiumDirection) => {
    const patch = calculateCornerAlignment(block, dir, pitchX, pitchY, pitchW, pitchH);
    onUpdate({
      ...block,
      ...patch,
    });
    const dirNames: Record<StadiumDirection, string> = {
      TL: "Top-Left (NW) Corner",
      TR: "Top-Right (NE) Corner",
      BR: "Bottom-Right (SE) Corner",
      BL: "Bottom-Left (SW) Corner",
      N: "North (Top) Stand",
      S: "South (Bottom) Stand",
      W: "West (Left) Stand",
      E: "East (Right) Stand",
    };
    toast.success(`Aligned ${block.name} to ${dirNames[dir]}!`);
  };

  const handleRotateDelta = (deltaDeg: number) => {
    if (isArc) {
      const nextStart = ((block.startAngle ?? 0) + deltaDeg + 3600) % 360;
      onUpdate({ ...block, startAngle: nextStart });
    } else {
      const nextRot = ((block.rotation ?? 0) + deltaDeg + 3600) % 360;
      onUpdate({ ...block, rotation: nextRot });
    }
  };

  const handleSetRotation = (deg: number) => {
    if (isArc) {
      onUpdate({ ...block, startAngle: deg % 360 });
    } else {
      onUpdate({ ...block, rotation: deg % 360 });
    }
  };

  return (
    <div className="p-3 bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-950 rounded-2xl border border-amber-400/30 shadow-lg space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] uppercase font-extrabold text-amber-400 tracking-wider flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-amber-400" />
          <span>4-Corner & Direction Pad</span>
        </label>
        <span className="text-[9px] font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40">
          AUTO-ALIGN
        </span>
      </div>

      <p className="text-[10px] text-slate-400 leading-snug">
        Click any corner to automatically rotate and adjust this stand around the pitch:
      </p>

      {/* 3x3 Interactive Matrix */}
      <div className="grid grid-cols-3 gap-1.5 pt-0.5">
        {/* Row 1: Top-Left (NW), North, Top-Right (NE) */}
        <button
          type="button"
          onClick={() => handleAlign("TL")}
          className="p-2 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400 text-slate-200 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm active:scale-95 group"
          title="Align to Top-Left Corner (auto rotates -45°/202.5° and hugs NW pitch corner)"
        >
          <span className="text-base group-hover:scale-125 transition-transform">↖️</span>
          <span>Top-Left</span>
          <span className="text-[8px] text-slate-400 font-normal">NW Corner</span>
        </button>

        <button
          type="button"
          onClick={() => handleAlign("N")}
          className="p-2 rounded-xl bg-slate-800/90 hover:bg-sky-500/20 border border-slate-700 hover:border-sky-400 text-slate-200 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm active:scale-95 group"
          title="Align to North (Top) Stand"
        >
          <span className="text-base group-hover:scale-125 transition-transform">⬆️</span>
          <span>North</span>
          <span className="text-[8px] text-slate-400 font-normal">Top Side</span>
        </button>

        <button
          type="button"
          onClick={() => handleAlign("TR")}
          className="p-2 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400 text-slate-200 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm active:scale-95 group"
          title="Align to Top-Right Corner (auto rotates 45°/292.5° and hugs NE pitch corner)"
        >
          <span className="text-base group-hover:scale-125 transition-transform">↗️</span>
          <span>Top-Right</span>
          <span className="text-[8px] text-slate-400 font-normal">NE Corner</span>
        </button>

        {/* Row 2: West, Pitch Snap, East */}
        <button
          type="button"
          onClick={() => handleAlign("W")}
          className="p-2 rounded-xl bg-slate-800/90 hover:bg-sky-500/20 border border-slate-700 hover:border-sky-400 text-slate-200 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm active:scale-95 group"
          title="Align to West (Left) Stand"
        >
          <span className="text-base group-hover:scale-125 transition-transform">⬅️</span>
          <span>West</span>
          <span className="text-[8px] text-slate-400 font-normal">Left Side</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (isArc) {
              onUpdate({
                ...block,
                stadiumCenterX: pitchX,
                stadiumCenterY: pitchY,
                x: pitchX,
                y: pitchY,
              });
              toast.success("Snapped arc stand to pitch center!");
            } else {
              onUpdate({
                ...block,
                x: pitchX - block.width / 2,
                y: pitchY - block.height / 2,
              });
              toast.success("Centered stand on pitch!");
            }
          }}
          className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[10px] flex flex-col items-center justify-center gap-0.5 transition-all shadow-md active:scale-95"
          title="Center stand relative to pitch"
        >
          <span className="text-base">🎯</span>
          <span className="leading-tight">Center Pitch</span>
          <span className="text-[8px] font-semibold opacity-80">Snap</span>
        </button>

        <button
          type="button"
          onClick={() => handleAlign("E")}
          className="p-2 rounded-xl bg-slate-800/90 hover:bg-sky-500/20 border border-slate-700 hover:border-sky-400 text-slate-200 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm active:scale-95 group"
          title="Align to East (Right) Stand"
        >
          <span className="text-base group-hover:scale-125 transition-transform">➡️</span>
          <span>East</span>
          <span className="text-[8px] text-slate-400 font-normal">Right Side</span>
        </button>

        {/* Row 3: Bottom-Left (SW), South, Bottom-Right (SE) */}
        <button
          type="button"
          onClick={() => handleAlign("BL")}
          className="p-2 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400 text-slate-200 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm active:scale-95 group"
          title="Align to Bottom-Left Corner (auto rotates 225°/112.5° and hugs SW pitch corner)"
        >
          <span className="text-base group-hover:scale-125 transition-transform">↙️</span>
          <span>Bottom-Left</span>
          <span className="text-[8px] text-slate-400 font-normal">SW Corner</span>
        </button>

        <button
          type="button"
          onClick={() => handleAlign("S")}
          className="p-2 rounded-xl bg-slate-800/90 hover:bg-sky-500/20 border border-slate-700 hover:border-sky-400 text-slate-200 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm active:scale-95 group"
          title="Align to South (Bottom) Stand"
        >
          <span className="text-base group-hover:scale-125 transition-transform">⬇️</span>
          <span>South</span>
          <span className="text-[8px] text-slate-400 font-normal">Bottom Side</span>
        </button>

        <button
          type="button"
          onClick={() => handleAlign("BR")}
          className="p-2 rounded-xl bg-slate-800/90 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-400 text-slate-200 text-[10px] font-bold flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm active:scale-95 group"
          title="Align to Bottom-Right Corner (auto rotates 135°/22.5° and hugs SE pitch corner)"
        >
          <span className="text-base group-hover:scale-125 transition-transform">↘️</span>
          <span>Bottom-Right</span>
          <span className="text-[8px] text-slate-400 font-normal">SE Corner</span>
        </button>
      </div>

      {/* Rotation Slider & Step Buttons */}
      <div className="pt-2 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
            <span>🔄</span> Stand Angle ({currentRot}°)
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleRotateDelta(-15)}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[9px] font-bold text-slate-300 transition-colors"
              title="Rotate -15°"
            >
              ↺ -15°
            </button>
            <button
              type="button"
              onClick={() => handleRotateDelta(15)}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[9px] font-bold text-slate-300 transition-colors"
              title="Rotate +15°"
            >
              ↻ +15°
            </button>
            <button
              type="button"
              onClick={() => handleRotateDelta(45)}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[9px] font-bold text-slate-300 transition-colors"
              title="Rotate +45°"
            >
              ↻ +45°
            </button>
            <button
              type="button"
              onClick={() => handleRotateDelta(90)}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[9px] font-bold text-slate-300 transition-colors"
              title="Rotate +90°"
            >
              ↻ +90°
            </button>
          </div>
        </div>

        <input
          type="range"
          min={0}
          max={360}
          value={currentRot}
          onChange={(e) => handleSetRotation(Number(e.target.value) || 0)}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />

        {/* Quick Orientation Buttons */}
        <div className="grid grid-cols-4 gap-1 pt-0.5">
          {[
            { label: "0° Flat", deg: 0 },
            { label: "45° Diag", deg: 45 },
            { label: "90° Vert", deg: 90 },
            { label: "180° Flip", deg: 180 },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleSetRotation(item.deg)}
              className={`py-1 px-1 rounded-md text-[9px] font-bold transition-all border ${
                currentRot === item.deg
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-sm"
                  : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
