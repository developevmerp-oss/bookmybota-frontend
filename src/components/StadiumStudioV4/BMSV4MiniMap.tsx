"use client";

import React, { useRef } from "react";
import { BMSSectionDefV4, BMSStageGroundDefV4 } from "./types";

interface BMSV4MiniMapProps {
  sections: BMSSectionDefV4[];
  groundConfig: BMSStageGroundDefV4;
  canvasW: number;
  canvasH: number;
  onNavigate: (x: number, y: number) => void;
}

export default function BMSV4MiniMap({
  sections,
  groundConfig,
  canvasW,
  canvasH,
  onNavigate,
}: BMSV4MiniMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapW = 160;
  const mapH = 120;
  const scaleX = mapW / canvasW;
  const scaleY = mapH / canvasH;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const targetCanvasX = (clickX / mapW) * canvasW;
    const targetCanvasY = (clickY / mapH) * canvasH;
    onNavigate(targetCanvasX, targetCanvasY);
  };

  return (
    <div
      ref={mapRef}
      onClick={handleClick}
      className="relative rounded-xl bg-slate-950/85 border border-slate-800 shadow-2xl backdrop-blur-md overflow-hidden cursor-crosshair group transition-all hover:border-slate-700"
      style={{ width: mapW, height: mapH }}
      title="Click radar minimap to pan canvas"
    >
      {/* Background grid markings */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:20px_20px] opacity-20" />

      {/* Ground / Stage Center Focal */}
      <div
        className="absolute rounded border border-white/40 transition-all opacity-80"
        style={{
          left: (groundConfig.x - groundConfig.width / 2) * scaleX,
          top: (groundConfig.y - groundConfig.height / 2) * scaleY,
          width: groundConfig.width * scaleX,
          height: groundConfig.height * scaleY,
          backgroundColor: groundConfig.color || "#15803d",
        }}
      />

      {/* Sections & Stands */}
      {sections.map((sec) => (
        <div
          key={sec.id}
          className="absolute rounded-sm opacity-70 group-hover:opacity-90 transition-opacity"
          style={{
            left: (sec.x - sec.width / 2) * scaleX,
            top: (sec.y - sec.height / 2) * scaleY,
            width: Math.max(4, sec.width * scaleX),
            height: Math.max(4, sec.height * scaleY),
            backgroundColor: sec.color,
          }}
        />
      ))}

      {/* Radar Label */}
      <div className="absolute bottom-1 right-1 px-1 rounded bg-black/60 text-[8px] font-mono font-bold text-slate-400 uppercase tracking-widest pointer-events-none">
        BMS RADAR
      </div>
    </div>
  );
}
