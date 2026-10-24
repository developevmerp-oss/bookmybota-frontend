"use client";

import React, { useState, useMemo } from "react";
import { X, Smartphone, Monitor, CheckCircle2, DollarSign, Users, Info } from "lucide-react";
import { UniversalVenueObject, UniversalSeat } from "../types";
import { generateSeatsForObject, computeLayoutCapacity } from "../utils/geometryEngine";

interface CustomerPreviewModalProps {
  open: boolean;
  onClose: () => void;
  layoutName: string;
  objects: UniversalVenueObject[];
}

export default function CustomerPreviewModal({
  open,
  onClose,
  layoutName,
  objects,
}: CustomerPreviewModalProps) {
  const [deviceMode, setDeviceMode] = useState<"desktop" | "mobile">("desktop");
  const [selectedSeat, setSelectedSeat] = useState<UniversalSeat | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  // Compute all physical seats
  const allSeats = useMemo(() => {
    const list: UniversalSeat[] = [];
    objects.forEach((obj) => {
      const s = generateSeatsForObject(obj);
      list.push(...s);
    });
    return list;
  }, [objects]);

  const metrics = useMemo(() => computeLayoutCapacity(objects), [objects]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className={`bg-slate-950 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl transition-all ${
          deviceMode === "mobile"
            ? "w-[420px] h-[780px] ring-8 ring-slate-800 rounded-[38px]"
            : "w-[94vw] max-w-6xl h-[88vh]"
        }`}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-xs uppercase tracking-wider border border-emerald-500/30">
              Customer Live Preview
            </span>
            <span className="font-bold text-white text-sm truncate max-w-xs">{layoutName}</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Viewport switch */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setDeviceMode("desktop")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                  deviceMode === "desktop" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop</span>
              </button>
              <button
                onClick={() => setDeviceMode("mobile")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors ${
                  deviceMode === "mobile" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Legend Bar */}
        <div className="px-5 py-2 bg-slate-900/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-slate-300">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-emerald-400/50" />
              <span className="text-slate-300">Selected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-slate-600" />
              <span className="text-slate-400">Sold / Unavailable</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
            <span>Total Seats: <strong className="text-white">{metrics.seatedCapacity.toLocaleString()}</strong></span>
            <span>Standing: <strong className="text-emerald-400">{metrics.standingCapacity.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden relative bg-slate-950">
          {/* Visual SVG Map */}
          <div className="flex-1 overflow-auto p-6 flex items-center justify-center relative">
            <div className="relative border border-slate-800 rounded-xl bg-slate-900/40 p-4 shadow-inner min-w-[700px] min-h-[500px] flex items-center justify-center">
              <svg width="760" height="540" viewBox="0 0 1600 1200" className="w-full h-full">
                {/* Render Stages / Sports Courts */}
                {objects
                  .filter((o) => o.type === "stage" || o.type === "sports_court")
                  .map((obj) => (
                    <g key={obj.id}>
                      <rect
                        x={obj.x - obj.width / 2}
                        y={obj.y - obj.height / 2}
                        width={obj.width}
                        height={obj.height}
                        fill={obj.color}
                        rx="12"
                        stroke="#22c55e"
                        strokeWidth="2"
                        opacity="0.85"
                      />
                      <text
                        x={obj.x}
                        y={obj.y + 4}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="18"
                        fontWeight="bold"
                      >
                        {obj.name.toUpperCase()}
                      </text>
                    </g>
                  ))}

                {/* Render General Admission Zones */}
                {objects
                  .filter((o) => o.type === "general_admission")
                  .map((obj) => (
                    <g key={obj.id}>
                      <rect
                        x={obj.x - obj.width / 2}
                        y={obj.y - obj.height / 2}
                        width={obj.width}
                        height={obj.height}
                        fill={obj.color}
                        rx="8"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        opacity="0.75"
                      />
                      <text
                        x={obj.x}
                        y={obj.y - 6}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="16"
                        fontWeight="bold"
                      >
                        {obj.name}
                      </text>
                      <text
                        x={obj.x}
                        y={obj.y + 16}
                        textAnchor="middle"
                        fill="#fef08a"
                        fontSize="14"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {obj.standingCapacity?.toLocaleString()} Standing • {obj.price} ETB
                      </text>
                    </g>
                  ))}

                {/* Render Physical Seats */}
                {allSeats.map((seat) => {
                  const isSelected = selectedSeat?.id === seat.id;
                  return (
                    <circle
                      key={seat.id}
                      cx={seat.x}
                      cy={seat.y}
                      r={isSelected ? 6.5 : 4.5}
                      fill={isSelected ? "#10b981" : "#3b82f6"}
                      stroke={isSelected ? "#ffffff" : "#0f172a"}
                      strokeWidth={isSelected ? 2 : 0.8}
                      className="cursor-pointer hover:fill-emerald-400 transition-all"
                      onClick={() => setSelectedSeat(seat)}
                    />
                  );
                })}

                {/* Render Gates */}
                {objects
                  .filter((o) => o.type === "gate")
                  .map((obj) => (
                    <g key={obj.id}>
                      <rect
                        x={obj.x - 45}
                        y={obj.y - 12}
                        width="90"
                        height="24"
                        fill="#7c3aed"
                        rx="6"
                        stroke="#ffffff"
                        strokeWidth="1"
                      />
                      <text
                        x={obj.x}
                        y={obj.y + 4}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="bold"
                      >
                        {obj.name}
                      </text>
                    </g>
                  ))}
              </svg>
            </div>
          </div>

          {/* Seat Inspector Floating Drawer */}
          {selectedSeat && (
            <div className="absolute bottom-4 right-4 bg-slate-900 border border-slate-700 rounded-xl p-4 w-72 shadow-2xl text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm">Selected Seat</span>
                <button
                  onClick={() => setSelectedSeat(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 text-slate-300 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Seat ID:</span>
                  <span className="font-bold text-white">{selectedSeat.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Row:</span>
                  <span className="font-bold text-white">{selectedSeat.rowLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Seat No:</span>
                  <span className="font-bold text-white">{selectedSeat.seatNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Price:</span>
                  <span className="font-bold text-emerald-400">{selectedSeat.price} ETB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">
                    AVAILABLE
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  alert(`Holding seat ${selectedSeat.id} for 10 minutes`);
                }}
                className="w-full py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 text-white font-bold rounded-lg transition-all shadow-md"
              >
                Simulate Book Seat ({selectedSeat.price} ETB)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
