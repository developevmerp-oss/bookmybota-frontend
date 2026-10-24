"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import { Stage, Layer, Rect, Circle, Line, Text, Group, Shape, Image as KonvaImage } from "react-konva";
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
  DollarSign,
  Grid,
  ChevronLeft,
  Eye,
  CheckCircle2,
  Sparkles,
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
const CENTER_X = CANVAS_W / 2;
const CENTER_Y = CANVAS_H / 2;

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
  // ── 1. ACTIVE MASTER VENUE SELECTION ──
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

  // Background blueprint tracing layer
  const [blueprintUrl, setBlueprintUrl] = useState<string | null>(initialConfig?.blueprintUrl || null);
  const [blueprintOpacity, setBlueprintOpacity] = useState<number>(initialConfig?.blueprintOpacity ?? 0.35);
  const [blueprintImg] = useImage(blueprintUrl || "", "anonymous");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 2. VIEWPORT MODES (MACRO STADIUM VIEW vs DRILLDOWN STAND VIEW) ──
  // BookMyShow Style: Top level shows architectural Stand Sectors; clicking a stand drills down to seat grid!
  const [viewMode, setViewMode] = useState<"macro" | "drilldown">("macro");
  const [drilldownSectionId, setDrilldownSectionId] = useState<string | null>(null);
  const [hoveredSectionId, setHoveredSectionId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(sections[0]?.id || null);

  // Filter by price tier
  const [activePriceFilter, setActivePriceFilter] = useState<number | null>(null);

  // Canvas Stage & Zoom/Pan state
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState<number>(0.85);
  const [stagePos, setStagePos] = useState<{ x: number; y: number }>({ x: 60, y: 30 });
  const [toolMode, setToolMode] = useState<"select" | "pan">("select");

  // History stack
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
      setHistoryIndex((prev) => prev - 1);
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
    setViewMode("macro");
    setDrilldownSectionId(null);
    setScale(0.85);
    setStagePos({ x: 60, y: 30 });
    toast.success(`Loaded Master Blueprint: ${tmpl.name}`);
  };

  // Drilldown to specific stand
  const handleDrilldownStand = (secId: string) => {
    const sec = sections.find((s) => s.id === secId);
    if (!sec) return;
    setSelectedSectionId(secId);
    setDrilldownSectionId(secId);
    setViewMode("drilldown");

    // Center camera on the stand
    const targetX = sec.x || CENTER_X;
    const targetY = sec.y || CENTER_Y;
    setScale(1.6);
    setStagePos({
      x: -targetX * 1.6 + (typeof window !== "undefined" ? window.innerWidth - 650 : 1000) / 2,
      y: -targetY * 1.6 + (typeof window !== "undefined" ? window.innerHeight - 150 : 800) / 2,
    });
    toast.info(`Drilled down to ${sec.name}`);
  };

  const handleReturnToMacro = () => {
    setViewMode("macro");
    setDrilldownSectionId(null);
    setScale(0.85);
    setStagePos({ x: 60, y: 30 });
  };

  // Zoom controls
  const handleZoomIn = () => setScale((s) => Math.min(3, s + 0.15));
  const handleZoomOut = () => setScale((s) => Math.max(0.3, s - 0.15));
  const handleResetZoom = () => {
    setScale(0.85);
    setStagePos({ x: 60, y: 30 });
  };

  // Compute all physical seats
  const allGeneratedSeats = useMemo(() => {
    return generateAllSeatsV4(sections, ticketTypes);
  }, [sections, ticketTypes]);

  // Group seats by section
  const seatsBySection = useMemo(() => {
    const map = new Map<string, GeneratedSeatV4[]>();
    for (const seat of allGeneratedSeats) {
      const list = map.get(seat.section_id) || [];
      list.push(seat);
      map.set(seat.section_id, list);
    }
    return map;
  }, [allGeneratedSeats]);

  // Capacity and pricing summary
  const capacitySummary = useMemo(() => {
    return computeBMSCapacitySummaryV4(sections, ticketTypes);
  }, [sections, ticketTypes]);

  // Distinct price tiers
  const priceTiers = useMemo(() => {
    const prices = new Set<number>();
    sections.forEach((s) => {
      if (s.price && s.price > 0) prices.add(s.price);
    });
    return Array.from(prices).sort((a, b) => b - a);
  }, [sections]);

  // Selected section object
  const selectedSection = useMemo(() => {
    return sections.find((s) => s.id === selectedSectionId) || null;
  }, [sections, selectedSectionId]);

  // Add new stand
  const handleAddStand = (type: "curved_stand" | "seated_grid" | "general_admission") => {
    pushHistorySnapshot();
    const count = sections.length + 1;
    const newId = `sec_ops_${Date.now()}`;

    let newSec: BMSSectionDefV4;
    if (type === "curved_stand") {
      newSec = {
        id: newId,
        name: `Stand Sector ${count}`,
        code: `SEC-${count}`,
        sectionType: "curved_stand",
        color: "#f43f5e",
        x: CENTER_X,
        y: CENTER_Y,
        width: 400,
        height: 120,
        rotation: 0,
        shape: "arc",
        innerRadius: 230,
        outerRadius: 360,
        startAngle: (count * 45) % 360,
        sweepAngle: 60,
        rowStart: "A",
        rowEnd: "K",
        seatsPerRow: 26,
        gateEntrance: `Turnstile Gate ${count}`,
        price: 350,
      };
    } else if (type === "general_admission") {
      newSec = {
        id: newId,
        name: `Standing Lawn ${count}`,
        code: `GA-${count}`,
        sectionType: "general_admission",
        color: "#10b981",
        x: CENTER_X,
        y: 450,
        width: 460,
        height: 140,
        rotation: 0,
        shape: "rectangle",
        standingCapacity: 1500,
        gateEntrance: `Concourse Gate ${count}`,
        price: 200,
      };
    } else {
      newSec = {
        id: newId,
        name: `Seated Grid Tier ${count}`,
        code: `SEC-${count}`,
        sectionType: "seated_grid",
        color: "#3b82f6",
        x: CENTER_X,
        y: 480,
        width: 480,
        height: 160,
        rotation: 0,
        shape: "rectangle",
        rowStart: "A",
        rowEnd: "J",
        seatsPerRow: 22,
        aisleGaps: [11],
        gateEntrance: `Gate ${count}`,
        price: 400,
      };
    }

    setSections((prev) => [...prev, newSec]);
    setSelectedSectionId(newId);
    toast.success(`Added ${newSec.name}`);
  };

  // Upload blueprint reference
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

  // Save Master Venue
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
        `Published Master Venue "${venueName}"! (${capacitySummary.totalCapacity.toLocaleString()} seats across ${sections.length} stands)`
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to save Master Venue layout");
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-white select-none overflow-hidden relative font-sans">
      {/* ── TOP BANNER: BOOKMYSHOW STADIUM OPS HEADER ── */}
      <div className="bg-gradient-to-r from-red-950 via-slate-900 to-slate-950 border-b border-red-500/30 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 shadow-xl shadow-red-950/20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-600/30 border border-red-500/40 text-red-200 font-black tracking-wide uppercase text-[10px]">
            <Building2 className="w-3.5 h-3.5 text-red-400" />
            <span>BOOKMYSHOW STADIUM OPS (V6)</span>
          </div>

          {/* Master Venue Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium text-[11px]">Stadium Template:</span>
            <select
              value={selectedTemplateKey}
              onChange={(e) => handleLoadMasterTemplate(e.target.value)}
              className="bg-slate-900 border border-red-500/40 rounded px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-red-400 cursor-pointer"
            >
              {Object.entries(MASTER_VENUE_TEMPLATES).map(([key, tmpl]) => (
                <option key={key} value={key}>
                  {tmpl.name} ({tmpl.totalCapacity.toLocaleString()} Seats)
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
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Gross Potential:</span>
            <span className="font-bold text-emerald-300">
              {capacitySummary.totalGrossRevenue.toLocaleString()} ETB
            </span>
          </div>

          <button
            onClick={handleSaveMasterLayout}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-bold text-xs bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-md shadow-red-900/30 transition-all active:scale-95 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Publishing..." : "Publish Master Blueprint"}</span>
          </button>
        </div>
      </div>

      {/* ── SECONDARY TOOLBAR & BMS PRICE TIER FILTER ── */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-2">
          {viewMode === "drilldown" ? (
            <button
              onClick={handleReturnToMacro}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-colors shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Full Stadium Map</span>
            </button>
          ) : (
            <>
              {/* Stand Adders */}
              <button
                onClick={() => handleAddStand("curved_stand")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-medium text-[11px] transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-purple-400" />
                <span>+ Add Curved Stand</span>
              </button>

              <button
                onClick={() => handleAddStand("seated_grid")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-medium text-[11px] transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-blue-400" />
                <span>+ Add Grid Stand</span>
              </button>

              <button
                onClick={() => handleAddStand("general_admission")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 font-medium text-[11px] transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Add Standing Zone</span>
              </button>
            </>
          )}

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Blueprint reference */}
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
              <span>Guide Opacity:</span>
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

        {/* BMS Price Tier Filter Chips */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            Filter Price:
          </span>
          <button
            onClick={() => setActivePriceFilter(null)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
              activePriceFilter === null
                ? "bg-white text-slate-950"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            All
          </button>
          {priceTiers.map((p) => (
            <button
              key={p}
              onClick={() => setActivePriceFilter(activePriceFilter === p ? null : p)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                activePriceFilter === p
                  ? "bg-red-500 text-white shadow-sm ring-1 ring-white/50"
                  : "bg-slate-800/90 text-slate-300 hover:text-white"
              }`}
            >
              {p} ETB
            </button>
          ))}
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

      {/* ── WORKSPACE: 3-COLUMN BOOKMYSHOW STADIUM LAYOUT ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT COLUMN: STAND SECTOR NAVIGATOR */}
        <div className="w-72 bg-slate-900/95 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-400" />
              <span className="font-bold text-xs uppercase tracking-wide text-slate-200">
                Stadium Stands ({sections.length})
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              {capacitySummary.totalCapacity.toLocaleString()} seats
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {sections.map((sec) => {
              const isSelected = selectedSectionId === sec.id;
              const rows = expandRowRangeV4(sec.rowStart, sec.rowEnd);
              const seatsCount =
                sec.sectionType === "general_admission"
                  ? sec.standingCapacity || 0
                  : rows.length * (sec.seatsPerRow || 20);

              const matchesPrice = activePriceFilter === null || sec.price === activePriceFilter;

              return (
                <div
                  key={sec.id}
                  onClick={() => {
                    setSelectedSectionId(sec.id);
                  }}
                  onDoubleClick={() => handleDrilldownStand(sec.id)}
                  className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-slate-800 border-red-500 shadow-md ring-1 ring-red-500/40"
                      : "bg-slate-950/60 border-slate-800 hover:bg-slate-850 hover:border-slate-700"
                  } ${!matchesPrice ? "opacity-35" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                        style={{ backgroundColor: sec.color }}
                      />
                      <span className="font-bold text-xs text-white truncate max-w-[130px]">
                        {sec.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-emerald-400">
                      {sec.price ? `${sec.price} ETB` : "Free"}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-mono text-amber-300">
                      {seatsCount.toLocaleString()} capacity
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDrilldownStand(sec.id);
                      }}
                      className="text-purple-300 hover:text-white underline text-[10px]"
                    >
                      View Seat Grid →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Guidance */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400">
            <p className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>BookMyShow Macro View</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Double-click any stand to drill down into its seat matrix grid.
            </p>
          </div>
        </div>

        {/* CENTER COLUMN: THE AUTHENTIC BOOKMYSHOW STADIUM CANVAS */}
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
              }
            }}
          >
            {/* 1. Background & Blueprint Layer */}
            <Layer>
              {/* Stadium Dark Atmosphere */}
              <Rect
                x={0}
                y={0}
                width={CANVAS_W}
                height={CANVAS_H}
                fill="#070a13"
                stroke="#1e293b"
                strokeWidth={2}
              />

              {/* Blueprint Reference (if uploaded) */}
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

            {/* 2. Realistic Athletic Stadium Pitch & Track Layer */}
            <Layer>
              {/* Reddish/Terracotta Athletics Running Track Oval */}
              <Shape
                x={CENTER_X}
                y={CENTER_Y}
                sceneFunc={(context, shape) => {
                  context.beginPath();
                  // Draw outer running track ellipse
                  context.ellipse(0, 0, 310, 210, 0, 0, Math.PI * 2);
                  context.fillStrokeShape(shape);
                }}
                fill="#831843"
                stroke="#9d174d"
                strokeWidth={3}
                opacity={0.85}
              />

              {/* Running Track Lane Lines */}
              <Circle x={CENTER_X} y={CENTER_Y} radius={210} stroke="#fbcfe8" strokeWidth={0.6} opacity={0.3} />
              <Circle x={CENTER_X} y={CENTER_Y} radius={200} stroke="#fbcfe8" strokeWidth={0.6} opacity={0.3} />

              {/* Green Football Turf with grass stripes */}
              <Group x={CENTER_X - 170} y={CENTER_Y - 110}>
                {/* Grass base */}
                <Rect
                  x={0}
                  y={0}
                  width={340}
                  height={220}
                  fill="#15803d"
                  cornerRadius={6}
                  stroke="#22c55e"
                  strokeWidth={2}
                  shadowColor="#15803d"
                  shadowBlur={16}
                  shadowOpacity={0.4}
                />

                {/* Alternating grass stripe pattern */}
                {Array.from({ length: 10 }).map((_, i) => (
                  <Rect
                    key={`stripe_${i}`}
                    x={i * 34}
                    y={0}
                    width={17}
                    height={220}
                    fill="#166534"
                    opacity={0.35}
                    listening={false}
                  />
                ))}

                {/* White Pitch Markings: Outer boundary */}
                <Rect
                  x={15}
                  y={15}
                  width={310}
                  height={190}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  opacity={0.8}
                  listening={false}
                />

                {/* Halfway line */}
                <Line
                  points={[170, 15, 170, 205]}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  opacity={0.8}
                  listening={false}
                />

                {/* Center circle */}
                <Circle
                  x={170}
                  y={110}
                  radius={32}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  opacity={0.8}
                  listening={false}
                />
                <Circle x={170} y={110} radius={2.5} fill="#ffffff" listening={false} />

                {/* Left Penalty Box */}
                <Rect x={15} y={55} width={45} height={110} stroke="#ffffff" strokeWidth={1.5} opacity={0.8} listening={false} />
                <Rect x={15} y={80} width={18} height={60} stroke="#ffffff" strokeWidth={1.5} opacity={0.8} listening={false} />

                {/* Right Penalty Box */}
                <Rect x={280} y={55} width={45} height={110} stroke="#ffffff" strokeWidth={1.5} opacity={0.8} listening={false} />
                <Rect x={307} y={80} width={18} height={60} stroke="#ffffff" strokeWidth={1.5} opacity={0.8} listening={false} />

                {/* Turf Label */}
                <Text
                  x={0}
                  y={110 - 6}
                  width={340}
                  text="CENTER FOOTBALL TURF"
                  fill="#ffffff"
                  fontFamily="sans-serif"
                  fontStyle="bold"
                  fontSize={10}
                  align="center"
                  opacity={0.4}
                  listening={false}
                />
              </Group>
            </Layer>

            {/* 3. SOLID ARCHITECTURAL STAND SECTORS (THE BOOKMYSHOW EXPERIENCE) */}
            <Layer>
              {sections.map((sec) => {
                const isSelected = selectedSectionId === sec.id;
                const isHovered = hoveredSectionId === sec.id;
                const isDrilldown = drilldownSectionId === sec.id;
                const matchesPrice = activePriceFilter === null || sec.price === activePriceFilter;

                const innerR = sec.innerRadius || 220;
                const outerR = sec.outerRadius || 340;
                const startAngDeg = sec.startAngle || 0;
                const sweepAngDeg = sec.sweepAngle || 90;
                const startAngRad = (startAngDeg * Math.PI) / 180;
                const endAngRad = ((startAngDeg + sweepAngDeg) * Math.PI) / 180;

                // Center position of sector label
                const midAngRad = ((startAngDeg + sweepAngDeg / 2) * Math.PI) / 180;
                const midR = (innerR + outerR) / 2;
                const labelX = CENTER_X + midR * Math.cos(midAngRad);
                const labelY = CENTER_Y + midR * Math.sin(midAngRad);

                // Physical seats for drilldown view
                const seats = seatsBySection.get(sec.id) || [];

                return (
                  <Group
                    key={sec.id}
                    onClick={() => {
                      setSelectedSectionId(sec.id);
                    }}
                    onDblClick={() => handleDrilldownStand(sec.id)}
                    onMouseEnter={() => setHoveredSectionId(sec.id)}
                    onMouseLeave={() => setHoveredSectionId(null)}
                  >
                    {/* Architectural Sector Block (Solid Annular Wedge) */}
                    {sec.sectionType === "curved_stand" ? (
                      <Shape
                        x={CENTER_X}
                        y={CENTER_Y}
                        sceneFunc={(context, shape) => {
                          context.beginPath();
                          context.arc(0, 0, outerR, startAngRad, endAngRad, false);
                          context.arc(0, 0, innerR, endAngRad, startAngRad, true);
                          context.closePath();
                          context.fillStrokeShape(shape);
                        }}
                        fill={
                          isSelected
                            ? "#e11d48"
                            : isHovered
                            ? "#f43f5e"
                            : sec.color || "#3b82f6"
                        }
                        stroke={isSelected ? "#ffffff" : "#0f172a"}
                        strokeWidth={isSelected ? 3 : 1.5}
                        opacity={!matchesPrice ? 0.25 : isSelected || isHovered ? 1 : 0.88}
                        shadowColor={isSelected ? "#e11d48" : "#000000"}
                        shadowBlur={isSelected ? 16 : 6}
                        shadowOpacity={0.6}
                      />
                    ) : (
                      /* Rectangular Grid Stand Block */
                      <Rect
                        x={sec.x - sec.width / 2}
                        y={sec.y - sec.height / 2}
                        width={sec.width}
                        height={sec.height}
                        fill={isSelected ? "#e11d48" : sec.color || "#3b82f6"}
                        stroke={isSelected ? "#ffffff" : "#0f172a"}
                        strokeWidth={isSelected ? 3 : 1.5}
                        cornerRadius={8}
                        opacity={!matchesPrice ? 0.25 : 0.9}
                      />
                    )}

                    {/* Macro View: Solid Stand Label & Price Badge */}
                    {viewMode === "macro" && (
                      <Group x={labelX} y={labelY}>
                        {/* Stand Name */}
                        <Text
                          x={-80}
                          y={-14}
                          width={160}
                          text={sec.name.toUpperCase()}
                          fill="#ffffff"
                          fontFamily="sans-serif"
                          fontStyle="bold"
                          fontSize={11}
                          align="center"
                          shadowColor="#000000"
                          shadowBlur={4}
                          shadowOpacity={0.9}
                          listening={false}
                        />

                        {/* Price Badge */}
                        <Text
                          x={-80}
                          y={2}
                          width={160}
                          text={sec.price ? `${sec.price} ETB` : "GENERAL"}
                          fill="#fef08a"
                          fontFamily="monospace"
                          fontStyle="bold"
                          fontSize={10}
                          align="center"
                          shadowColor="#000000"
                          shadowBlur={4}
                          listening={false}
                        />

                        {/* Gate entrance */}
                        {sec.gateEntrance && (
                          <Text
                            x={-80}
                            y={16}
                            width={160}
                            text={sec.gateEntrance}
                            fill="#e2e8f0"
                            fontFamily="sans-serif"
                            fontSize={8}
                            align="center"
                            opacity={0.8}
                            listening={false}
                          />
                        )}
                      </Group>
                    )}

                    {/* Drilldown View: Render Physical Seats Grid if drilled down */}
                    {viewMode === "drilldown" && isDrilldown && (
                      <Group>
                        {seats.map((seat: GeneratedSeatV4) => (
                          <Circle
                            key={seat.id}
                            x={seat.coordinate_x}
                            y={seat.coordinate_y}
                            radius={4}
                            fill="#ffffff"
                            stroke="#0f172a"
                            strokeWidth={1}
                            shadowColor="#ffffff"
                            shadowBlur={4}
                            shadowOpacity={0.5}
                          />
                        ))}
                      </Group>
                    )}
                  </Group>
                );
              })}
            </Layer>

            {/* 4. Concourse Turnstile Gates Layer */}
            <Layer>
              {amenities
                .filter((a) => a.type === "gate")
                .map((am) => (
                  <Group key={am.id} x={am.x} y={am.y}>
                    <Rect
                      x={-40}
                      y={-11}
                      width={80}
                      height={22}
                      fill="#7c3aed"
                      cornerRadius={5}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      shadowBlur={6}
                      shadowOpacity={0.5}
                    />
                    <Text
                      x={-40}
                      y={-5}
                      width={80}
                      text={am.label}
                      fill="#ffffff"
                      fontSize={9}
                      fontStyle="bold"
                      align="center"
                    />
                  </Group>
                ))}
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

        {/* RIGHT COLUMN: BOOKMYSHOW PARAMETRIC STAND INSPECTOR */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-red-400" />
              <span className="font-bold text-xs uppercase tracking-wide text-slate-200">
                Stand Configuration
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
                <label className="text-slate-400 block mb-1">Stand / Sector Name</label>
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

              {/* Turnstile Gate */}
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

              {/* Ticket Price (ETB) */}
              <div>
                <label className="text-slate-400 block mb-1">Ticket Price (ETB)</label>
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

              {/* Geometry Type & Color */}
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
                  <label className="text-slate-400 block mb-1">Sector Color</label>
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
                    Curved Sector Dimensions
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Inner Radius</span>
                      <input
                        type="number"
                        value={selectedSection.innerRadius || 220}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 100;
                          setSections((prev) =>
                            prev.map((s) => (s.id === selectedSection.id ? { ...s, innerRadius: val } : s))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Outer Radius</span>
                      <input
                        type="number"
                        value={selectedSection.outerRadius || 340}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 200;
                          setSections((prev) =>
                            prev.map((s) => (s.id === selectedSection.id ? { ...s, outerRadius: val } : s))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
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
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
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
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Rows & Seats Configuration */}
              {selectedSection.sectionType !== "general_admission" ? (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2.5">
                  <span className="font-bold text-[11px] text-blue-300 block">
                    Rows &amp; Physical Seats
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
                        value={selectedSection.rowEnd || "L"}
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
                      value={selectedSection.seatsPerRow || 28}
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

              {/* Drilldown Action */}
              <button
                onClick={() => handleDrilldownStand(selectedSection.id)}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Drill Down into Seat Matrix</span>
              </button>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500 space-y-2">
              <Layers className="w-8 h-8 mx-auto text-slate-600" />
              <p className="font-medium text-xs">No Stand Selected</p>
              <p className="text-[11px] text-slate-600">
                Click any stand sector on the stadium map to inspect and edit its parameters.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
