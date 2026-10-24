"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Stage, Layer, Rect, Circle, Line, Text, Group, Arc, Transformer, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import Konva from "konva";
import { toast } from "sonner";
import {
  Building2,
  Layers,
  DoorOpen,
  Users,
  Compass,
  Sliders,
  Plus,
  Trash2,
  Save,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileImage,
  Tag,
  CheckCircle2,
  DollarSign,
  Grid,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import {
  BMSVenueArchetype,
  BMSSectionDefV4,
  BMSStageGroundDefV4,
  BMSAmenityPOIV4,
  StadiumSeatingConfigOutputV4,
  GeneratedSeatV4,
} from "./types";
import { MASTER_VENUE_TEMPLATES } from "./masterVenueTemplates";
import {
  generateAllSeatsV4,
  computeBMSCapacitySummaryV4,
  expandRowRangeV4,
} from "../StadiumStudioV4/SeatingGeneratorEngineV4";
import BMSV4MiniMap from "../StadiumStudioV4/BMSV4MiniMap";

export const CANVAS_W = 1600;
export const CANVAS_H = 1200;

interface StadiumStudioV6Props {
  eventId?: string;
  isVenueRequest?: boolean;
  isEventOrgRequest?: boolean;
  ticketTypes?: Array<{
    id: string;
    name: string;
    ticket_type?: string;
    price?: number;
    total_count?: number;
  }>;
  initialConfig?: any;
  saving?: boolean;
  onSave?: (output: StadiumSeatingConfigOutputV4, seatsJson: any[]) => Promise<void>;
  onClose?: () => void;
}

export default function StadiumStudioV6({
  eventId,
  ticketTypes = [],
  initialConfig,
  saving = false,
  onSave,
  onClose,
}: StadiumStudioV6Props) {
  // ── 1. ACTIVE MASTER VENUE STATE ──
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("addis_ababa_stadium");

  const activeTemplate = MASTER_VENUE_TEMPLATES[selectedTemplateKey] || MASTER_VENUE_TEMPLATES.addis_ababa_stadium;

  const [venueName, setVenueName] = useState<string>(
    initialConfig?.venueName || initialConfig?.stadium_name || activeTemplate.name
  );
  const [archetype, setArchetype] = useState<BMSVenueArchetype>(
    initialConfig?.archetype || activeTemplate.archetype
  );
  const [groundConfig, setGroundConfig] = useState<BMSStageGroundDefV4>(
    initialConfig?.groundConfig || activeTemplate.groundConfig
  );
  const [sections, setSections] = useState<BMSSectionDefV4[]>(
    initialConfig?.sections || activeTemplate.sections
  );
  const [amenities, setAmenities] = useState<BMSAmenityPOIV4[]>(
    initialConfig?.amenities || activeTemplate.amenities
  );

  // Blueprint background tracing layer
  const [blueprintUrl, setBlueprintUrl] = useState<string | null>(
    initialConfig?.blueprintUrl || null
  );
  const [blueprintOpacity, setBlueprintOpacity] = useState<number>(
    initialConfig?.blueprintOpacity ?? 0.35
  );
  const [blueprintImg] = useImage(blueprintUrl || "", "anonymous");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active selection
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    sections[0]?.id || null
  );
  const [selectedAmenityId, setSelectedAmenityId] = useState<string | null>(null);

  // Canvas Viewport & Tooling
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState<number>(0.9);
  const [stagePos, setStagePos] = useState<{ x: number; y: number }>({ x: 80, y: 30 });
  const [toolMode, setToolMode] = useState<"select" | "pan">("select");

  // History Stack
  const [history, setHistory] = useState<Array<{
    sections: BMSSectionDefV4[];
    amenities: BMSAmenityPOIV4[];
    groundConfig: BMSStageGroundDefV4;
  }>>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const pushHistorySnapshot = useCallback(() => {
    const nextSnapshot = {
      sections: JSON.parse(JSON.stringify(sections)),
      amenities: JSON.parse(JSON.stringify(amenities)),
      groundConfig: JSON.parse(JSON.stringify(groundConfig)),
    };
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), nextSnapshot]);
    setHistoryIndex((prev) => prev + 1);
  }, [sections, amenities, groundConfig, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const target = history[historyIndex - 1];
      setSections(JSON.parse(JSON.stringify(target.sections)));
      setAmenities(JSON.parse(JSON.stringify(target.amenities)));
      setGroundConfig(JSON.parse(JSON.stringify(target.groundConfig)));
      setHistoryIndex((prev) => prev - 1);
      toast.info("Undo change");
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const target = history[historyIndex + 1];
      setSections(JSON.parse(JSON.stringify(target.sections)));
      setAmenities(JSON.parse(JSON.stringify(target.amenities)));
      setGroundConfig(JSON.parse(JSON.stringify(target.groundConfig)));
      setHistoryIndex((prev) => prev + 1);
      toast.info("Redo change");
    }
  };

  // Switch Master Venue Template
  const handleLoadMasterTemplate = (templateKey: string) => {
    const tmpl = MASTER_VENUE_TEMPLATES[templateKey];
    if (!tmpl) return;
    pushHistorySnapshot();
    setSelectedTemplateKey(templateKey);
    setVenueName(tmpl.name);
    setArchetype(tmpl.archetype);
    setGroundConfig(tmpl.groundConfig);
    setSections(tmpl.sections);
    setAmenities(tmpl.amenities);
    setSelectedSectionId(tmpl.sections[0]?.id || null);
    setSelectedAmenityId(null);
    toast.success(`Loaded Master Blueprint: ${tmpl.name}`);
  };

  // Zoom controls
  const handleZoomIn = () => setScale((s) => Math.min(3, s + 0.15));
  const handleZoomOut = () => setScale((s) => Math.max(0.3, s - 0.15));
  const handleResetZoom = () => {
    setScale(0.9);
    setStagePos({ x: 80, y: 30 });
  };

  // Compute all physical seats
  const allGeneratedSeats = useMemo(() => {
    return generateAllSeatsV4(sections, ticketTypes);
  }, [sections, ticketTypes]);

  // Group seats by section for Konva rendering
  const seatsBySection = useMemo(() => {
    const map = new Map<string, GeneratedSeatV4[]>();
    for (const seat of allGeneratedSeats) {
      const list = map.get(seat.section_id) || [];
      list.push(seat);
      map.set(seat.section_id, list);
    }
    return map;
  }, [allGeneratedSeats]);

  // Real-time capacity and gross metrics
  const capacitySummary = useMemo(() => {
    return computeBMSCapacitySummaryV4(sections, ticketTypes);
  }, [sections, ticketTypes]);

  // Selected section object
  const selectedSection = useMemo(() => {
    return sections.find((s) => s.id === selectedSectionId) || null;
  }, [sections, selectedSectionId]);

  // Add new Section
  const handleAddSection = (type: "curved_stand" | "seated_grid" | "general_admission") => {
    pushHistorySnapshot();
    const count = sections.length + 1;
    const newId = `sec_ops_${Date.now()}`;

    let newSec: BMSSectionDefV4;
    if (type === "curved_stand") {
      newSec = {
        id: newId,
        name: `Curved Stand ${count}`,
        code: `SEC-${count}`,
        sectionType: "curved_stand",
        color: "#8b5cf6",
        x: 800,
        y: 600,
        width: 400,
        height: 120,
        rotation: 0,
        shape: "arc",
        innerRadius: 240,
        outerRadius: 360,
        startAngle: 0,
        sweepAngle: 90,
        rowStart: "A",
        rowEnd: "J",
        seatsPerRow: 24,
        gateEntrance: `Turnstile Gate ${count}`,
        price: 300,
      };
    } else if (type === "general_admission") {
      newSec = {
        id: newId,
        name: `General Admission Standing Zone ${count}`,
        code: `GA-${count}`,
        sectionType: "general_admission",
        color: "#10b981",
        x: 800,
        y: 500,
        width: 450,
        height: 150,
        rotation: 0,
        shape: "rectangle",
        standingCapacity: 1000,
        gateEntrance: `Concourse Gate ${count}`,
        price: 200,
      };
    } else {
      newSec = {
        id: newId,
        name: `Seated Grid Stand ${count}`,
        code: `SEC-${count}`,
        sectionType: "seated_grid",
        color: "#3b82f6",
        x: 800,
        y: 500,
        width: 480,
        height: 160,
        rotation: 0,
        shape: "rectangle",
        rowStart: "A",
        rowEnd: "H",
        seatsPerRow: 20,
        aisleGaps: [10],
        gateEntrance: `Gate ${count}`,
        price: 350,
      };
    }

    setSections((prev) => [...prev, newSec]);
    setSelectedSectionId(newId);
    toast.success(`Added ${newSec.name}`);
  };

  // Add Turnstile Gate POI
  const handleAddGate = () => {
    pushHistorySnapshot();
    const count = amenities.filter((a) => a.type === "gate").length + 1;
    const newAm: BMSAmenityPOIV4 = {
      id: `amen_gate_${Date.now()}`,
      type: "gate",
      label: `Turnstile Gate ${count}`,
      x: 800,
      y: 180,
    };
    setAmenities((prev) => [...prev, newAm]);
    setSelectedAmenityId(newAm.id);
    setSelectedSectionId(null);
    toast.success(`Added ${newAm.label}`);
  };

  // Blueprint background upload
  const handleUploadBlueprint = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setBlueprintUrl(dataUrl);
      setBlueprintOpacity(0.4);
      toast.success("Blueprint background reference loaded");
    };
    reader.readAsDataURL(file);
  };

  // Save Master Venue Layout
  const handleSaveMasterLayout = async () => {
    if (!onSave) {
      toast.info("Master Layout preview saved locally");
      return;
    }
    try {
      const outputConfig: StadiumSeatingConfigOutputV4 = {
        layout_mode: "universal_bms",
        version: "v4",
        archetype,
        venueName,
        canvasWidth: CANVAS_W,
        canvasHeight: CANVAS_H,
        groundConfig,
        sections,
        amenities,
        blueprintUrl,
        blueprintOpacity,
        metadata: {
          totalCapacity: capacitySummary.totalCapacity,
          seatedCapacity: capacitySummary.seatedCapacity,
          standingCapacity: capacitySummary.standingCapacity,
          estimatedGrossRevenue: capacitySummary.totalGrossRevenue,
          lastEditedAt: new Date().toISOString(),
        },
      };

      await onSave(outputConfig, allGeneratedSeats);
      toast.success(
        `Published Master Venue "${venueName}"! (${capacitySummary.totalCapacity.toLocaleString()} total capacity across ${sections.length} stands)`
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to save Master Venue layout");
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-white select-none overflow-hidden relative font-sans">
      {/* ── TOP OPERATIONAL HEADER: BOOKMYSHOW VENUE OPS ── */}
      <div className="bg-gradient-to-r from-red-950 via-slate-900 to-slate-950 border-b border-red-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 shadow-xl shadow-red-950/20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-600/30 border border-red-500/40 text-red-200 font-black tracking-wide uppercase text-[10px]">
            <Building2 className="w-3.5 h-3.5 text-red-400" />
            <span>PART 1: MASTER VENUE OPS</span>
          </div>

          {/* Master Venue Selector Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium text-[11px]">Venue Template:</span>
            <select
              value={selectedTemplateKey}
              onChange={(e) => handleLoadMasterTemplate(e.target.value)}
              className="bg-slate-900 border border-red-500/40 rounded px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-red-400 cursor-pointer"
            >
              {Object.entries(MASTER_VENUE_TEMPLATES).map(([key, tmpl]) => (
                <option key={key} value={key}>
                  {tmpl.name} ({tmpl.totalCapacity.toLocaleString()} Cap)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live Operational Metrics */}
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Total Capacity:</span>
            <span className="font-bold text-amber-300">
              {capacitySummary.totalCapacity.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Stands:</span>
            <span className="font-bold text-blue-300">{sections.length}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800">
            <DoorOpen className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">Gates:</span>
            <span className="font-bold text-purple-300">
              {amenities.filter((a) => a.type === "gate").length}
            </span>
          </div>

          <button
            onClick={handleSaveMasterLayout}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-bold text-xs bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-md shadow-red-900/30 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Saving Master..." : "Publish Master Blueprint"}</span>
          </button>
        </div>
      </div>

      {/* ── TOOLBAR: SEATLAYER-STYLE PARAMETRIC ACTIONS ── */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          {/* Quick Add Stand Buttons */}
          <button
            onClick={() => handleAddSection("curved_stand")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-medium text-[11px] transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-purple-400" />
            <span>+ Add Curved Stand</span>
          </button>

          <button
            onClick={() => handleAddSection("seated_grid")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-medium text-[11px] transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            <span>+ Add Grid Stand</span>
          </button>

          <button
            onClick={() => handleAddSection("general_admission")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-medium text-[11px] transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>+ Add GA Standing</span>
          </button>

          <button
            onClick={handleAddGate}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-medium text-[11px] transition-colors"
          >
            <DoorOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span>+ Add Turnstile Gate</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Blueprint Reference Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium text-[11px] border border-slate-700"
          >
            <FileImage className="w-3.5 h-3.5 text-amber-400" />
            <span>{blueprintUrl ? "Change Blueprint" : "Upload Blueprint Guide"}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadBlueprint}
          />

          {blueprintUrl && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              <span>Opacity:</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={blueprintOpacity}
                onChange={(e) => setBlueprintOpacity(parseFloat(e.target.value))}
                className="w-16 h-1 bg-slate-700 rounded cursor-pointer accent-red-500"
              />
            </div>
          )}
        </div>

        {/* Viewport & Navigation Tools */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 rounded border border-slate-800 p-0.5">
            <button
              onClick={() => setToolMode("select")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                toolMode === "select" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Select
            </button>
            <button
              onClick={() => setToolMode("pan")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                toolMode === "pan" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Pan
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 rounded border border-slate-800 px-1 py-0.5">
            <button onClick={handleZoomOut} className="p-1 hover:text-white text-slate-400">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[10px] w-10 text-center text-slate-300">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={handleZoomIn} className="p-1 hover:text-white text-slate-400">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleResetZoom} className="p-1 hover:text-white text-slate-400">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN WORKSPACE: 3-COLUMN BOOKMYSHOW OPS LAYOUT ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT COLUMN: MASTER STANDS NAVIGATOR */}
        <div className="w-72 bg-slate-900/95 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-400" />
              <span className="font-bold text-xs uppercase tracking-wide text-slate-200">
                Stands &amp; Gates ({sections.length})
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {capacitySummary.totalCapacity.toLocaleString()} cap
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {sections.map((sec, idx) => {
              const isSelected = selectedSectionId === sec.id;
              const rows = expandRowRangeV4(sec.rowStart, sec.rowEnd);
              const seatsCount =
                sec.sectionType === "general_admission"
                  ? sec.standingCapacity || 0
                  : rows.length * (sec.seatsPerRow || 20);

              return (
                <div
                  key={sec.id}
                  onClick={() => {
                    setSelectedSectionId(sec.id);
                    setSelectedAmenityId(null);
                  }}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-slate-800 border-red-500 shadow-sm"
                      : "bg-slate-950/60 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: sec.color }}
                      />
                      <span className="font-bold text-xs text-white truncate max-w-[140px]">
                        {sec.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-amber-300">
                      {seatsCount.toLocaleString()} seats
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="capitalize">
                      {sec.sectionType === "curved_stand"
                        ? "Curved Arc"
                        : sec.sectionType === "general_admission"
                        ? "GA Standing"
                        : "Grid Stand"}
                    </span>
                    <span className="truncate max-w-[110px] text-purple-300">
                      {sec.gateEntrance || "No gate assigned"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Venue Info Footer */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400">
            <div className="flex items-center justify-between mb-1">
              <span>Template:</span>
              <span className="text-white font-medium">{activeTemplate.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Category:</span>
              <span className="text-emerald-400 font-bold uppercase">{archetype}</span>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: KONVA INTERACTIVE CANVAS */}
        <div className="flex-1 bg-slate-950 relative overflow-hidden">
          <Stage
            ref={stageRef}
            width={typeof window !== "undefined" ? window.innerWidth - 650 : 1000}
            height={typeof window !== "undefined" ? window.innerHeight - 150 : 800}
            scaleX={scale}
            scaleY={scale}
            x={stagePos.x}
            y={stagePos.y}
            draggable={toolMode === "pan"}
            onClick={(e) => {
              if (e.target === e.target.getStage()) {
                setSelectedSectionId(null);
                setSelectedAmenityId(null);
              }
            }}
          >
            {/* Background & Blueprint Layer */}
            <Layer>
              <Rect
                x={0}
                y={0}
                width={CANVAS_W}
                height={CANVAS_H}
                fill="#020617"
                stroke="#1e293b"
                strokeWidth={2}
              />

              {/* Grid dots */}
              {Array.from({ length: 40 }).map((_, i) =>
                Array.from({ length: 30 }).map((_, j) => (
                  <Circle
                    key={`dot_${i}_${j}`}
                    x={i * 40}
                    y={j * 40}
                    radius={1}
                    fill="#334155"
                    opacity={0.3}
                  />
                ))
              )}

              {/* Uploaded Blueprint Reference */}
              {blueprintImg && (
                <KonvaImage
                  image={blueprintImg}
                  x={0}
                  y={0}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  opacity={blueprintOpacity}
                  listening={false}
                />
              )}
            </Layer>

            {/* Center Ground / Pitch Layer */}
            <Layer>
              <Group
                x={groundConfig.x}
                y={groundConfig.y}
                draggable={toolMode === "select"}
                onDragEnd={(e) => {
                  pushHistorySnapshot();
                  setGroundConfig((prev) => ({
                    ...prev,
                    x: e.target.x(),
                    y: e.target.y(),
                  }));
                }}
              >
                <Rect
                  x={0}
                  y={0}
                  width={groundConfig.width}
                  height={groundConfig.height}
                  fill={groundConfig.color || "#15803d"}
                  cornerRadius={10}
                  stroke="#22c55e"
                  strokeWidth={2}
                  shadowColor="#15803d"
                  shadowBlur={10}
                  shadowOpacity={0.4}
                />
                <Text
                  x={0}
                  y={groundConfig.height / 2 - 8}
                  width={groundConfig.width}
                  text={groundConfig.label}
                  align="center"
                  fill="#ffffff"
                  fontFamily="sans-serif"
                  fontStyle="bold"
                  fontSize={13}
                  opacity={0.9}
                />
              </Group>
            </Layer>

            {/* Stands & Generated Physical Seats Layer */}
            <Layer>
              {sections.map((sec) => {
                const isSelected = selectedSectionId === sec.id;
                const seats = seatsBySection.get(sec.id) || [];

                return (
                  <Group
                    key={sec.id}
                    onClick={() => {
                      setSelectedSectionId(sec.id);
                      setSelectedAmenityId(null);
                    }}
                  >
                    {/* Render Individual Seats */}
                    {seats.map((seat: GeneratedSeatV4) => (
                      <Circle
                        key={seat.id}
                        x={seat.coordinate_x}
                        y={seat.coordinate_y}
                        radius={isSelected ? 4.2 : 3.5}
                        fill={isSelected ? "#f43f5e" : sec.color}
                        stroke="#0f172a"
                        strokeWidth={0.8}
                        opacity={0.9}
                      />
                    ))}

                    {/* Stand Label */}
                    <Text
                      x={sec.x - 80}
                      y={
                        sec.sectionType === "curved_stand"
                          ? sec.y - (sec.innerRadius || 200) - 18
                          : sec.y - 20
                      }
                      text={sec.name}
                      fill="#ffffff"
                      fontFamily="sans-serif"
                      fontSize={11}
                      fontStyle="bold"
                      align="center"
                      width={160}
                      listening={false}
                    />
                  </Group>
                );
              })}
            </Layer>

            {/* Turnstile Gates & Concourse POIs Layer */}
            <Layer>
              {amenities.map((am) => {
                const isSelected = selectedAmenityId === am.id;
                return (
                  <Group
                    key={am.id}
                    x={am.x}
                    y={am.y}
                    draggable={toolMode === "select"}
                    onClick={() => {
                      setSelectedAmenityId(am.id);
                      setSelectedSectionId(null);
                    }}
                    onDragEnd={(e) => {
                      pushHistorySnapshot();
                      const nx = e.target.x();
                      const ny = e.target.y();
                      setAmenities((prev) =>
                        prev.map((a) => (a.id === am.id ? { ...a, x: nx, y: ny } : a))
                      );
                    }}
                  >
                    <Rect
                      x={-45}
                      y={-12}
                      width={90}
                      height={24}
                      fill={am.type === "gate" ? "#7c3aed" : "#0284c7"}
                      cornerRadius={6}
                      stroke={isSelected ? "#f43f5e" : "#ffffff"}
                      strokeWidth={isSelected ? 2 : 1}
                      shadowBlur={6}
                      shadowOpacity={0.4}
                    />
                    <Text
                      x={-45}
                      y={-6}
                      width={90}
                      text={am.label}
                      fill="#ffffff"
                      fontSize={9}
                      fontStyle="bold"
                      align="center"
                    />
                  </Group>
                );
              })}
            </Layer>
          </Stage>

          {/* MiniMap */}
          <BMSV4MiniMap
            canvasW={CANVAS_W}
            canvasH={CANVAS_H}
            groundConfig={groundConfig}
            sections={sections}
            onNavigate={(nx, ny) => {
              setStagePos({
                x: -nx * scale + (window.innerWidth - 650) / 2,
                y: -ny * scale + (window.innerHeight - 150) / 2,
              });
            }}
          />
        </div>

        {/* RIGHT COLUMN: PARAMETRIC STAND INSPECTOR */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-red-400" />
              <span className="font-bold text-xs uppercase tracking-wide text-slate-200">
                Stand Parameters
              </span>
            </div>
            {selectedSection && (
              <button
                onClick={() => {
                  pushHistorySnapshot();
                  setSections((prev) => prev.filter((s) => s.id !== selectedSection.id));
                  setSelectedSectionId(null);
                  toast.info("Deleted Stand");
                }}
                className="text-red-400 hover:text-red-300 p-1"
                title="Delete Stand"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {selectedSection ? (
            <div className="p-4 space-y-4 text-xs">
              {/* Stand Name */}
              <div>
                <label className="text-slate-400 block mb-1">Stand Name</label>
                <input
                  type="text"
                  value={selectedSection.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSections((prev) =>
                      prev.map((s) => (s.id === selectedSection.id ? { ...s, name: val } : s))
                    );
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-red-500 font-bold"
                />
              </div>

              {/* Gate Entrance Route */}
              <div>
                <label className="text-slate-400 block mb-1">Turnstile Entrance Gate</label>
                <input
                  type="text"
                  value={selectedSection.gateEntrance || ""}
                  placeholder="e.g. Turnstile Gate 3 & 4"
                  onChange={(e) => {
                    const val = e.target.value;
                    setSections((prev) =>
                      prev.map((s) => (s.id === selectedSection.id ? { ...s, gateEntrance: val } : s))
                    );
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-purple-300 focus:outline-none focus:border-purple-500 font-medium"
                />
              </div>

              {/* Geometry Type */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Type</label>
                  <select
                    value={selectedSection.sectionType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setSections((prev) =>
                        prev.map((s) => (s.id === selectedSection.id ? { ...s, sectionType: val } : s))
                      );
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="curved_stand">Curved Arc</option>
                    <option value="seated_grid">Seated Grid</option>
                    <option value="general_admission">GA Standing</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedSection.color}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSections((prev) =>
                          prev.map((s) => (s.id === selectedSection.id ? { ...s, color: val } : s))
                        );
                      }}
                      className="w-8 h-8 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="font-mono text-slate-300">{selectedSection.color}</span>
                  </div>
                </div>
              </div>

              {/* Parametric Curve Settings (if Curved) */}
              {selectedSection.sectionType === "curved_stand" && (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2.5">
                  <span className="font-bold text-[11px] text-purple-300 block">
                    Curved Arc Geometry
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Inner Radius</span>
                      <input
                        type="number"
                        value={selectedSection.innerRadius || 210}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 100;
                          setSections((prev) =>
                            prev.map((s) => (s.id === selectedSection.id ? { ...s, innerRadius: val } : s))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Outer Radius</span>
                      <input
                        type="number"
                        value={selectedSection.outerRadius || 320}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 200;
                          setSections((prev) =>
                            prev.map((s) => (s.id === selectedSection.id ? { ...s, outerRadius: val } : s))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Start Angle (°)</span>
                      <input
                        type="number"
                        value={selectedSection.startAngle || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setSections((prev) =>
                            prev.map((s) => (s.id === selectedSection.id ? { ...s, startAngle: val } : s))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Sweep Angle (°)</span>
                      <input
                        type="number"
                        value={selectedSection.sweepAngle || 90}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 90;
                          setSections((prev) =>
                            prev.map((s) => (s.id === selectedSection.id ? { ...s, sweepAngle: val } : s))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Rows & Columns Definition */}
              {selectedSection.sectionType !== "general_admission" ? (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2.5">
                  <span className="font-bold text-[11px] text-blue-300 block">
                    Rows &amp; Seats Layout
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Start Row</span>
                      <input
                        type="text"
                        value={selectedSection.rowStart || "A"}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setSections((prev) =>
                            prev.map((s) => (s.id === selectedSection.id ? { ...s, rowStart: val } : s))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">End Row</span>
                      <input
                        type="text"
                        value={selectedSection.rowEnd || "J"}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setSections((prev) =>
                            prev.map((s) => (s.id === selectedSection.id ? { ...s, rowEnd: val } : s))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-center font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">Seats Per Row</span>
                    <input
                      type="number"
                      value={selectedSection.seatsPerRow || 24}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 10;
                        setSections((prev) =>
                          prev.map((s) => (s.id === selectedSection.id ? { ...s, seatsPerRow: val } : s))
                        );
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Standing Capacity</span>
                  <input
                    type="number"
                    value={selectedSection.standingCapacity || 1000}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 100;
                      setSections((prev) =>
                        prev.map((s) =>
                          s.id === selectedSection.id ? { ...s, standingCapacity: val } : s
                        )
                      );
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-emerald-400 font-bold"
                  />
                </div>
              )}

              {/* Pricing & Category Tier */}
              <div>
                <label className="text-slate-400 block mb-1">Base Price (ETB)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={selectedSection.price || 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setSections((prev) =>
                        prev.map((s) => (s.id === selectedSection.id ? { ...s, price: val } : s))
                      );
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-emerald-400 font-bold focus:outline-none focus:border-emerald-500 pl-7"
                  />
                  <span className="absolute left-2.5 top-1.5 text-slate-500 font-bold">ETB</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500 space-y-2">
              <ShieldCheck className="w-8 h-8 mx-auto text-slate-600" />
              <p className="font-medium text-xs">No Stand Selected</p>
              <p className="text-[11px] text-slate-600">
                Click any stand on the canvas or select from the left navigator to inspect its parameters.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
