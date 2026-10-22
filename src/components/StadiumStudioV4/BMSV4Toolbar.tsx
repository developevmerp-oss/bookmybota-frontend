"use client";

import React from "react";
import {
  MousePointer2,
  Hand,
  Plus,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  RotateCcw,
  Building2,
  DoorOpen,
  Armchair,
  Users,
  Grid,
  Layers,
  Sparkles,
} from "lucide-react";
import { BMSToolModeV4, BMSVenueArchetype } from "./types";
import { BMS_ARCHETYPE_PRESETS } from "./BMSArchetypePresets";

interface BMSV4ToolbarProps {
  toolMode: BMSToolModeV4;
  setToolMode: (mode: BMSToolModeV4) => void;
  archetype: BMSVenueArchetype;
  onOpenArchetypeModal: () => void;
  onOpenBlueprintDetector: () => void;
  hasBlueprint: boolean;
  blueprintOpacity: number;
  setBlueprintOpacity: (val: number) => void;
  onAddSection: (type: "seated_grid" | "curved_stand" | "general_admission" | "table_cluster") => void;
  onAddAmenity: (type: "gate" | "restroom" | "food_beverage" | "sound_booth" | "emergency_exit") => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  saving: boolean;
  onSave: () => void;
}

export default function BMSV4Toolbar({
  toolMode,
  setToolMode,
  archetype,
  onOpenArchetypeModal,
  onOpenBlueprintDetector,
  hasBlueprint,
  blueprintOpacity,
  setBlueprintOpacity,
  onAddSection,
  onAddAmenity,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  saving,
  onSave,
}: BMSV4ToolbarProps) {
  const currentArchetypeData = BMS_ARCHETYPE_PRESETS[archetype];

  return (
    <div className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-white shrink-0 select-none">
      {/* Left: Archetype selector button & Mode controls */}
      <div className="flex items-center gap-3">
        {/* AI Blueprint Auto-Detector Button */}
        <button
          type="button"
          onClick={onOpenBlueprintDetector}
          className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-rose-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-purple-950/40 border border-purple-400/30 transition-all cursor-pointer group"
          title="Upload venue blueprint image/PDF to auto-detect and draw stands"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
          <span>✨ Auto-Draw Blueprint</span>
        </button>

        {/* Blueprint Opacity Slider if active */}
        {hasBlueprint && (
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-[11px]">
            <span className="text-slate-400">Blueprint:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={blueprintOpacity}
              onChange={(e) => setBlueprintOpacity(parseFloat(e.target.value))}
              className="w-16 accent-rose-500 cursor-pointer"
              title={`Blueprint opacity: ${Math.round(blueprintOpacity * 100)}%`}
            />
            <span className="font-mono text-slate-300 w-7 text-right">
              {Math.round(blueprintOpacity * 100)}%
            </span>
          </div>
        )}

        <div className="h-6 w-px bg-slate-800" />

        <button
          type="button"
          onClick={onOpenArchetypeModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-rose-500/40 hover:border-rose-500 text-xs font-bold text-white transition-all shadow-sm group"
        >
          <span className="text-base">{currentArchetypeData.icon}</span>
          <div className="text-left">
            <span className="text-[9px] uppercase tracking-wider block text-rose-400 font-extrabold leading-none">
              Archetype:
            </span>
            <span className="group-hover:text-rose-300">{currentArchetypeData.title}</span>
          </div>
          <span className="text-[10px] text-slate-500 ml-1">▼</span>
        </button>

        <div className="h-6 w-px bg-slate-800" />

        {/* Pointer / Pan Mode */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setToolMode("select")}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              toolMode === "select" ? "bg-rose-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
            title="Select & Move Objects"
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Select</span>
          </button>
          <button
            type="button"
            onClick={() => setToolMode("pan")}
            className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              toolMode === "pan" ? "bg-rose-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
            title="Pan Canvas"
          >
            <Hand className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pan</span>
          </button>
        </div>

        <div className="h-6 w-px bg-slate-800" />

        {/* Quick Add Elements dropdown */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAddSection("seated_grid")}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            title="Add Seated Section (Grid)"
          >
            <Armchair className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden md:inline">+ Grid Stand</span>
          </button>

          <button
            type="button"
            onClick={() => onAddSection("curved_stand")}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            title="Add Concentric Curved Stand"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">+ Curved Stand</span>
          </button>

          <button
            type="button"
            onClick={() => onAddSection("general_admission")}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            title="Add General Admission Standing Zone"
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">+ GA Standing</span>
          </button>

          <button
            type="button"
            onClick={() => onAddAmenity("gate")}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            title="Add Turnstile Gate POI"
          >
            <DoorOpen className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden lg:inline">+ Gate</span>
          </button>
        </div>
      </div>

      {/* Right: History, Zoom, Save */}
      <div className="flex items-center gap-2.5">
        {/* Undo / Redo */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
          <button
            type="button"
            onClick={onZoomOut}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onResetZoom}
            className="px-2 text-slate-300 font-bold hover:text-white"
            title="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Save Layout Button */}
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-rose-950/50 disabled:opacity-50 transition-all cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Saving Live..." : "Save Layout Live"}</span>
        </button>
      </div>
    </div>
  );
}
