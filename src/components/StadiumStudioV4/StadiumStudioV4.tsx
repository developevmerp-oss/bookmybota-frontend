"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Stage, Layer, Rect, Circle, Line, Text, Group, Arc, Transformer, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import Konva from "konva";
import { toast } from "sonner";
import {
  BMSVenueArchetype,
  BMSSectionDefV4,
  BMSStageGroundDefV4,
  BMSAmenityPOIV4,
  BMSToolModeV4,
  StadiumSeatingConfigOutputV4,
  BMSSeatType,
} from "./types";
import { BMS_ARCHETYPE_PRESETS } from "./BMSArchetypePresets";
import {
  generateAllSeatsV4,
  computeBMSCapacitySummaryV4,
  expandRowRangeV4,
  GeneratedSeatV4,
} from "./SeatingGeneratorEngineV4";
import BMSArchetypeSelectorModal from "./BMSArchetypeSelectorModal";
import BMSBlueprintAutoDetectorModal from "./BMSBlueprintAutoDetectorModal";
import BMSV4Toolbar from "./BMSV4Toolbar";
import BMSV4LiveInspector from "./BMSV4LiveInspector";
import BMSV4MiniMap from "./BMSV4MiniMap";
import BMSSeatGridPainterModal from "../StadiumStudioV3/BMSSeatGridPainterModal";

export const CANVAS_W = 1600;
export const CANVAS_H = 1200;

interface StadiumStudioV4Props {
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

export default function StadiumStudioV4({
  eventId,
  ticketTypes = [],
  initialConfig,
  saving = false,
  onSave,
  onClose,
}: StadiumStudioV4Props) {
  // ── 1. ARCHETYPE & LAYOUT STATE ──
  const initialArch: BMSVenueArchetype = initialConfig?.archetype || "stadium";
  const [archetype, setArchetype] = useState<BMSVenueArchetype>(initialArch);
  const [venueName, setVenueName] = useState<string>(
    initialConfig?.venueName || initialConfig?.stadium_name || "Enterprise Event Arena"
  );

  const defaultData = BMS_ARCHETYPE_PRESETS[archetype];

  const [groundConfig, setGroundConfig] = useState<BMSStageGroundDefV4>(
    initialConfig?.groundConfig || defaultData.defaultGround
  );

  const [sections, setSections] = useState<BMSSectionDefV4[]>(
    initialConfig?.sections || defaultData.defaultSections
  );

  const [amenities, setAmenities] = useState<BMSAmenityPOIV4[]>(
    initialConfig?.amenities || defaultData.defaultAmenities
  );

  // ── 2. SELECTION & TOOL MODES ──
  const [toolMode, setToolMode] = useState<BMSToolModeV4>("select");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedAmenityId, setSelectedAmenityId] = useState<string | null>(null);
  const [isArchetypeModalOpen, setIsArchetypeModalOpen] = useState(false);
  const [painterSection, setPainterSection] = useState<BMSSectionDefV4 | null>(null);
  const [isBlueprintDetectorOpen, setIsBlueprintDetectorOpen] = useState(false);
  const [blueprintUrl, setBlueprintUrl] = useState<string | null>(
    initialConfig?.blueprintUrl || null
  );
  const [blueprintOpacity, setBlueprintOpacity] = useState<number>(
    initialConfig?.blueprintOpacity ?? 0.45
  );
  const [blueprintImg] = useImage(blueprintUrl || "", "anonymous");

  // ── 3. ZOOM & PAN STATE ──
  const [zoom, setZoom] = useState(0.85);
  const [stagePos, setStagePos] = useState({ x: 40, y: 30 });
  const [stageDimensions, setStageDimensions] = useState({ width: 1200, height: 800 });

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // ── 4. UNDO / REDO HISTORY ──
  const [history, setHistory] = useState<Array<{ sections: BMSSectionDefV4[]; amenities: BMSAmenityPOIV4[] }>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushHistorySnapshot = useCallback(() => {
    setHistory((prev) => {
      const upToCurrent = prev.slice(0, historyIndex + 1);
      return [...upToCurrent, { sections: JSON.parse(JSON.stringify(sections)), amenities: JSON.parse(JSON.stringify(amenities)) }];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [sections, amenities, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const target = history[historyIndex - 1];
      setSections(target.sections);
      setAmenities(target.amenities);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const target = history[historyIndex + 1];
      setSections(target.sections);
      setAmenities(target.amenities);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // ── 5. RESPONSIVE CONTAINER RESIZE ──
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setStageDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // ── 6. ATTACH TRANSFORMER TO SELECTED NODE ──
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    const stage = stageRef.current;
    if (selectedSectionId) {
      const node = stage.findOne(`#sec_${selectedSectionId}`);
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer()?.batchDraw();
        return;
      }
    }
    if (selectedAmenityId) {
      const node = stage.findOne(`#amen_${selectedAmenityId}`);
      if (node) {
        trRef.current.nodes([node]);
        trRef.current.getLayer()?.batchDraw();
        return;
      }
    }
    trRef.current.nodes([]);
    trRef.current.getLayer()?.batchDraw();
  }, [selectedSectionId, selectedAmenityId]);

  // ── 7. CAPACITY & FINANCIAL METRICS ──
  const capacitySummary = useMemo(() => {
    return computeBMSCapacitySummaryV4(sections, ticketTypes);
  }, [sections, ticketTypes]);

  // ── 8. ARCHETYPE SWITCHER HANDLER ──
  const handleSelectArchetype = (newArch: BMSVenueArchetype) => {
    pushHistorySnapshot();
    const preset = BMS_ARCHETYPE_PRESETS[newArch];
    setArchetype(newArch);
    setGroundConfig(preset.defaultGround);
    setSections(preset.defaultSections);
    setAmenities(preset.defaultAmenities);
    setSelectedSectionId(null);
    setSelectedAmenityId(null);
    setIsArchetypeModalOpen(false);
    toast.success(`Loaded ${preset.title} Blueprint Template`);
  };

  // ── 9. QUICK ADD ELEMENTS ──
  const handleAddSection = (type: "seated_grid" | "curved_stand" | "general_admission" | "table_cluster") => {
    pushHistorySnapshot();
    const id = `sec_${Date.now()}`;
    const nextCount = sections.length + 1;

    let newSec: BMSSectionDefV4;
    if (type === "curved_stand") {
      newSec = {
        id,
        name: `Curved Stand ${nextCount}`,
        code: `SEC-${nextCount}`,
        sectionType: "curved_stand",
        color: "#f59e0b",
        x: CANVAS_W / 2,
        y: CANVAS_H / 2,
        width: 400,
        height: 120,
        rotation: 0,
        shape: "arc",
        innerRadius: 220,
        outerRadius: 320,
        startAngle: 0,
        sweepAngle: 80,
        rowStart: "A",
        rowEnd: "H",
        seatsPerRow: 20,
      };
    } else if (type === "general_admission") {
      newSec = {
        id,
        name: `General Admission Lawn ${nextCount}`,
        code: `GA-${nextCount}`,
        sectionType: "general_admission",
        color: "#10b981",
        x: CANVAS_W / 2,
        y: 400,
        width: 500,
        height: 160,
        rotation: 0,
        shape: "rectangle",
        standingCapacity: 500,
      };
    } else if (type === "table_cluster") {
      newSec = {
        id,
        name: `Banquet Table Hall ${nextCount}`,
        code: `BQ-${nextCount}`,
        sectionType: "table_cluster",
        color: "#6366f1",
        x: CANVAS_W / 2,
        y: CANVAS_H / 2,
        width: 600,
        height: 400,
        rotation: 0,
        shape: "rectangle",
        tables: [
          { id: `tbl_${Date.now()}_1`, tableNumber: "T-01", shape: "round", x: CANVAS_W / 2 - 100, y: CANVAS_H / 2, radius: 45, seatCount: 8 },
          { id: `tbl_${Date.now()}_2`, tableNumber: "T-02", shape: "round", x: CANVAS_W / 2 + 100, y: CANVAS_H / 2, radius: 45, seatCount: 8 },
        ],
      };
    } else {
      newSec = {
        id,
        name: `Seated Grid Stand ${nextCount}`,
        code: `SEC-${nextCount}`,
        sectionType: "seated_grid",
        color: "#3b82f6",
        x: CANVAS_W / 2,
        y: 450,
        width: 520,
        height: 160,
        rotation: 0,
        shape: "rectangle",
        rowStart: "A",
        rowEnd: "F",
        seatsPerRow: 18,
        aisleGaps: [6, 12],
      };
    }

    setSections((prev) => [...prev, newSec]);
    setSelectedSectionId(id);
    setSelectedAmenityId(null);
    toast.success(`Added ${newSec.name}`);
  };

  const handleAddAmenity = (type: "gate" | "restroom" | "food_beverage" | "sound_booth" | "emergency_exit") => {
    pushHistorySnapshot();
    const id = `amen_${Date.now()}`;
    const labels: Record<string, string> = {
      gate: "Turnstile Gate",
      restroom: "Restrooms",
      food_beverage: "F&B Snack Counter",
      sound_booth: "FOH Sound Console",
      emergency_exit: "Emergency Exit",
    };
    const newAmenity: BMSAmenityPOIV4 = {
      id,
      type,
      label: `${labels[type] || "Amenity"} ${amenities.length + 1}`,
      x: CANVAS_W / 2 + (Math.random() * 200 - 100),
      y: CANVAS_H / 2 + (Math.random() * 200 - 100),
    };
    setAmenities((prev) => [...prev, newAmenity]);
    setSelectedAmenityId(id);
    setSelectedSectionId(null);
    toast.success(`Added ${newAmenity.label}`);
  };

  // ── 10. SAVE COMPLETE BOOKMYSHOW LAYOUT ──
  const handleSaveLayout = async () => {
    if (!onSave) {
      toast.info("Layout preview saved locally");
      return;
    }

    try {
      const generatedSeats = generateAllSeatsV4(sections, ticketTypes);
      const configOutput: StadiumSeatingConfigOutputV4 = {
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

      await onSave(configOutput, generatedSeats);
      toast.success(
        `Saved Universal BMS Layout! Generated ${generatedSeats.length} individual seats (${capacitySummary.totalCapacity.toLocaleString()} total capacity)`
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to save layout");
    }
  };

  const selectedSection = useMemo(
    () => sections.find((s) => s.id === selectedSectionId) || null,
    [sections, selectedSectionId]
  );

  const selectedAmenity = useMemo(
    () => amenities.find((a) => a.id === selectedAmenityId) || null,
    [amenities, selectedAmenityId]
  );

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-white select-none overflow-hidden">
      {/* ── TOP LIVE METRICS & CAPACITY BAR ── */}
      <div className="h-12 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-md bg-gradient-to-r from-red-600 to-rose-600 text-white font-extrabold text-[11px] uppercase tracking-wider shadow-sm flex items-center gap-1.5">
            <span>🎟️ PRO STUDIO V4</span>
            <span className="opacity-70 text-[9px]">Universal BMS</span>
          </span>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-slate-500 font-semibold">Venue:</span>
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              className="bg-transparent font-bold text-white hover:bg-slate-800/50 px-2 py-0.5 rounded border border-transparent focus:border-rose-500 focus:bg-slate-950 focus:outline-none"
            />
          </div>
        </div>

        {/* Live Box-Office Stats */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Total Capacity:</span>
            <span className="font-bold text-amber-400">{capacitySummary.totalCapacity.toLocaleString()}</span>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Seated:</span>
            <span className="font-bold text-blue-400">{capacitySummary.seatedCapacity.toLocaleString()}</span>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Standing (GA):</span>
            <span className="font-bold text-emerald-400">{capacitySummary.standingCapacity.toLocaleString()}</span>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Est. Box Office:</span>
            <span className="font-bold text-rose-400">
              ${capacitySummary.totalGrossRevenue.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* ── TOOLBAR RIBBON ── */}
      <BMSV4Toolbar
        toolMode={toolMode}
        setToolMode={setToolMode}
        archetype={archetype}
        onOpenArchetypeModal={() => setIsArchetypeModalOpen(true)}
        onOpenBlueprintDetector={() => setIsBlueprintDetectorOpen(true)}
        hasBlueprint={Boolean(blueprintUrl)}
        blueprintOpacity={blueprintOpacity}
        setBlueprintOpacity={setBlueprintOpacity}
        onAddSection={handleAddSection}
        onAddAmenity={handleAddAmenity}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(2.5, z + 0.1))}
        onZoomOut={() => setZoom((z) => Math.max(0.3, z - 0.1))}
        onResetZoom={() => {
          setZoom(0.85);
          setStagePos({ x: 40, y: 30 });
        }}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        saving={saving}
        onSave={handleSaveLayout}
      />

      {/* ── MAIN WORKSPACE (CANVAS + INSPECTOR) ── */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        {/* Konva Stage Canvas */}
        <div
          ref={containerRef}
          className="flex-1 h-full bg-slate-950 relative overflow-hidden cursor-default"
          style={{ cursor: toolMode === "pan" ? "grab" : "default" }}
        >
          <Stage
            ref={stageRef}
            width={stageDimensions.width}
            height={stageDimensions.height}
            scaleX={zoom}
            scaleY={zoom}
            x={stagePos.x}
            y={stagePos.y}
            draggable={toolMode === "pan"}
            onDragEnd={(e) => {
              if (e.target === stageRef.current) {
                setStagePos({ x: e.target.x(), y: e.target.y() });
              }
            }}
            onMouseDown={(e) => {
              if (e.target === stageRef.current) {
                setSelectedSectionId(null);
                setSelectedAmenityId(null);
              }
            }}
          >
            <Layer>
              {/* Canvas Background Boundary */}
              <Rect
                x={0}
                y={0}
                width={CANVAS_W}
                height={CANVAS_H}
                fill="#030712"
                stroke="#1f2937"
                strokeWidth={2}
                cornerRadius={12}
                shadowBlur={30}
                shadowColor="rgba(0,0,0,0.8)"
              />

              {/* Background Blueprint Plan Image if loaded */}
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

              {/* 1. Ground / Pitch / Stage / Screen Center Focal */}
              <Group
                x={groundConfig.x}
                y={groundConfig.y}
                offsetX={groundConfig.width / 2}
                offsetY={groundConfig.height / 2}
                draggable={toolMode === "select"}
                onDragEnd={(e) => {
                  pushHistorySnapshot();
                  setGroundConfig((prev) => ({
                    ...prev,
                    x: Math.round(e.target.x() + prev.width / 2),
                    y: Math.round(e.target.y() + prev.height / 2),
                  }));
                }}
              >
                <Rect
                  width={groundConfig.width}
                  height={groundConfig.height}
                  fill={groundConfig.color || "#15803d"}
                  stroke="#38a169"
                  strokeWidth={3}
                  cornerRadius={groundConfig.type === "screen" ? 4 : 16}
                  shadowBlur={16}
                  shadowColor={groundConfig.color || "#15803d"}
                  shadowOpacity={0.4}
                />
                <Text
                  text={groundConfig.label}
                  fontSize={12}
                  fontStyle="bold"
                  fill="#ffffff"
                  align="center"
                  verticalAlign="middle"
                  width={groundConfig.width}
                  height={groundConfig.height}
                />
              </Group>

              {/* 2. Render Sections (Seated Grids, Curved Stands, GA Pits, Tables) */}
              {sections.map((sec) => {
                const isSelected = selectedSectionId === sec.id;

                // 2A. General Admission Standing Zone
                if (sec.sectionType === "general_admission") {
                  return (
                    <Group
                      key={sec.id}
                      id={`sec_${sec.id}`}
                      x={sec.x}
                      y={sec.y}
                      offsetX={sec.width / 2}
                      offsetY={sec.height / 2}
                      draggable={toolMode === "select"}
                      onClick={() => {
                        if (toolMode === "select") {
                          setSelectedSectionId(sec.id);
                          setSelectedAmenityId(null);
                        }
                      }}
                      onDragEnd={(e) => {
                        pushHistorySnapshot();
                        setSections((prev) =>
                          prev.map((s) =>
                            s.id === sec.id
                              ? {
                                  ...s,
                                  x: Math.round(e.target.x() + s.width / 2),
                                  y: Math.round(e.target.y() + s.height / 2),
                                }
                              : s
                          )
                        );
                      }}
                    >
                      <Rect
                        width={sec.width}
                        height={sec.height}
                        fill={`${sec.color}22`}
                        stroke={isSelected ? "#ffffff" : sec.color}
                        strokeWidth={isSelected ? 3 : 2}
                        dash={[6, 4]}
                        cornerRadius={12}
                      />
                      <Text
                        text={`${sec.name}\n(GA Standing Pool: ${sec.standingCapacity || 500} Cap)`}
                        fontSize={13}
                        fontStyle="bold"
                        fill="#ffffff"
                        align="center"
                        verticalAlign="middle"
                        width={sec.width}
                        height={sec.height}
                      />
                    </Group>
                  );
                }

                // 2B. Banquet Table Cluster
                if (sec.sectionType === "table_cluster") {
                  return (
                    <Group
                      key={sec.id}
                      id={`sec_${sec.id}`}
                      x={0}
                      y={0}
                      onClick={() => {
                        if (toolMode === "select") {
                          setSelectedSectionId(sec.id);
                          setSelectedAmenityId(null);
                        }
                      }}
                    >
                      {(sec.tables || []).map((tbl) => {
                        const count = tbl.seatCount || 8;
                        const r = tbl.radius || 45;
                        return (
                          <Group
                            key={tbl.id}
                            x={tbl.x}
                            y={tbl.y}
                            draggable={toolMode === "select"}
                            onDragEnd={(e) => {
                              pushHistorySnapshot();
                              const newX = Math.round(e.target.x());
                              const newY = Math.round(e.target.y());
                              setSections((prev) =>
                                prev.map((s) =>
                                  s.id === sec.id
                                    ? {
                                        ...s,
                                        tables: (s.tables || []).map((t) =>
                                          t.id === tbl.id ? { ...t, x: newX, y: newY } : t
                                        ),
                                      }
                                    : s
                                )
                              );
                            }}
                          >
                            <Circle
                              radius={r}
                              fill="#1e1b4b"
                              stroke={isSelected ? "#ffffff" : "#6366f1"}
                              strokeWidth={2}
                            />
                            <Text
                              text={tbl.tableNumber}
                              fontSize={10}
                              fontStyle="bold"
                              fill="#ffffff"
                              align="center"
                              verticalAlign="middle"
                              offsetX={r}
                              offsetY={10}
                              width={r * 2}
                              height={20}
                            />
                            {/* Chair dots around table */}
                            {Array.from({ length: count }).map((_, cIdx) => {
                              const ang = (cIdx / count) * 2 * Math.PI - Math.PI / 2;
                              const cx = (r + 14) * Math.cos(ang);
                              const cy = (r + 14) * Math.sin(ang);
                              return (
                                <Circle
                                  key={cIdx}
                                  x={cx}
                                  y={cy}
                                  radius={6}
                                  fill="#818cf8"
                                  stroke="#312e81"
                                  strokeWidth={1}
                                />
                              );
                            })}
                          </Group>
                        );
                      })}
                    </Group>
                  );
                }

                // 2C. Concentric Curved Stand (Arc)
                if (sec.sectionType === "curved_stand") {
                  const rows = expandRowRangeV4(sec.rowStart, sec.rowEnd);
                  const seatsPerRow = sec.seatsPerRow || 24;
                  const innerR = sec.innerRadius || 210;
                  const outerR = sec.outerRadius || 310;
                  const startAng = sec.startAngle || 0;
                  const sweepAng = sec.sweepAngle || 90;
                  const radialStep = rows.length > 1 ? (outerR - innerR) / (rows.length - 1) : 0;

                  return (
                    <Group
                      key={sec.id}
                      id={`sec_${sec.id}`}
                      draggable={toolMode === "select"}
                      onClick={() => {
                        if (toolMode === "select") {
                          setSelectedSectionId(sec.id);
                          setSelectedAmenityId(null);
                        }
                      }}
                    >
                      {/* Arc Boundary Guide */}
                      <Arc
                        x={sec.x}
                        y={sec.y}
                        innerRadius={innerR - 10}
                        outerRadius={outerR + 10}
                        angle={sweepAng}
                        rotation={startAng}
                        fill={`${sec.color}15`}
                        stroke={isSelected ? "#ffffff" : `${sec.color}88`}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                      />

                      {/* Concentric Row Seats */}
                      {rows.map((rowLetter, rIdx) => {
                        const currentR = innerR + rIdx * radialStep;
                        return Array.from({ length: seatsPerRow }).map((_, sIdx) => {
                          const t = seatsPerRow > 1 ? sIdx / (seatsPerRow - 1) : 0.5;
                          const angleDeg = startAng + t * sweepAng;
                          const angleRad = (angleDeg * Math.PI) / 180;
                          const sx = sec.x + currentR * Math.cos(angleRad);
                          const sy = sec.y + currentR * Math.sin(angleRad);

                          return (
                            <Circle
                              key={`${rowLetter}_${sIdx + 1}`}
                              x={sx}
                              y={sy}
                              radius={4.5}
                              fill={sec.color}
                              stroke="#0f172a"
                              strokeWidth={1}
                            />
                          );
                        });
                      })}
                    </Group>
                  );
                }

                // 2D. Seated Grid (Orthogonal rows & columns)
                const rows = expandRowRangeV4(sec.rowStart, sec.rowEnd);
                const seatsPerRow = sec.seatsPerRow || 20;
                const aisleGaps = sec.aisleGaps || [];
                const rowHeight = rows.length > 1 ? (sec.height - 20) / (rows.length - 1) : 0;
                const baseColW = sec.width / (seatsPerRow + aisleGaps.length * 1.5);

                return (
                  <Group
                    key={sec.id}
                    id={`sec_${sec.id}`}
                    x={sec.x}
                    y={sec.y}
                    offsetX={sec.width / 2}
                    offsetY={sec.height / 2}
                    rotation={sec.rotation || 0}
                    draggable={toolMode === "select"}
                    onClick={() => {
                      if (toolMode === "select") {
                        setSelectedSectionId(sec.id);
                        setSelectedAmenityId(null);
                      }
                    }}
                    onDragEnd={(e) => {
                      pushHistorySnapshot();
                      setSections((prev) =>
                        prev.map((s) =>
                          s.id === sec.id
                            ? {
                                ...s,
                                x: Math.round(e.target.x() + s.width / 2),
                                y: Math.round(e.target.y() + s.height / 2),
                              }
                            : s
                        )
                      );
                    }}
                  >
                    <Rect
                      width={sec.width}
                      height={sec.height}
                      fill={`${sec.color}18`}
                      stroke={isSelected ? "#ffffff" : sec.color}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      cornerRadius={8}
                    />
                    <Text
                      text={`${sec.name} (${rows.length * seatsPerRow} Seats)`}
                      x={10}
                      y={-18}
                      fontSize={11}
                      fontStyle="bold"
                      fill={sec.color}
                    />

                    {/* Seats Matrix rendering */}
                    {rows.map((rowLetter, rIdx) => {
                      const cy = 10 + rIdx * rowHeight;
                      let extraAisle = 0;
                      return Array.from({ length: seatsPerRow }).map((_, sIdx) => {
                        const seatNum = sIdx + 1;
                        if (aisleGaps.includes(seatNum)) {
                          extraAisle += baseColW * 1.5;
                        }
                        const cx = 15 + sIdx * baseColW + extraAisle;
                        return (
                          <Circle
                            key={`${rowLetter}_${seatNum}`}
                            x={cx}
                            y={cy}
                            radius={4.5}
                            fill={sec.color}
                            stroke="#0f172a"
                            strokeWidth={1}
                          />
                        );
                      });
                    })}
                  </Group>
                );
              })}

              {/* 3. Amenities & POIs (Gates, Restrooms, F&B, Emergency Exits) */}
              {amenities.map((amen) => {
                const isSelected = selectedAmenityId === amen.id;
                const colors: Record<string, string> = {
                  gate: "#a855f7",
                  restroom: "#06b6d4",
                  food_beverage: "#f97316",
                  bar: "#eab308",
                  sound_booth: "#ef4444",
                  emergency_exit: "#22c55e",
                  first_aid: "#ec4899",
                  merch_stand: "#3b82f6",
                };
                const bg = colors[amen.type] || "#a855f7";

                return (
                  <Group
                    key={amen.id}
                    id={`amen_${amen.id}`}
                    x={amen.x}
                    y={amen.y}
                    draggable={toolMode === "select"}
                    onClick={() => {
                      if (toolMode === "select") {
                        setSelectedAmenityId(amen.id);
                        setSelectedSectionId(null);
                      }
                    }}
                    onDragEnd={(e) => {
                      pushHistorySnapshot();
                      setAmenities((prev) =>
                        prev.map((a) =>
                          a.id === amen.id
                            ? { ...a, x: Math.round(e.target.x()), y: Math.round(e.target.y()) }
                            : a
                        )
                      );
                    }}
                  >
                    <Rect
                      offsetX={50}
                      offsetY={16}
                      width={100}
                      height={32}
                      fill={bg}
                      stroke={isSelected ? "#ffffff" : "#000000"}
                      strokeWidth={isSelected ? 2.5 : 1}
                      cornerRadius={6}
                      shadowBlur={8}
                      shadowColor={bg}
                      shadowOpacity={0.6}
                    />
                    <Text
                      text={amen.label}
                      offsetX={50}
                      offsetY={10}
                      width={100}
                      height={20}
                      fontSize={9}
                      fontStyle="bold"
                      fill="#ffffff"
                      align="center"
                      verticalAlign="middle"
                    />
                  </Group>
                );
              })}

              {/* Transformer for Resizing / Rotating */}
              <Transformer
                ref={trRef}
                rotateEnabled={true}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 40 || newBox.height < 30) return oldBox;
                  return newBox;
                }}
              />
            </Layer>
          </Stage>

          {/* Radar Mini-Map in bottom left */}
          <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
            <BMSV4MiniMap
              sections={sections}
              groundConfig={groundConfig}
              canvasW={CANVAS_W}
              canvasH={CANVAS_H}
              onNavigate={(targetX, targetY) => {
                if (!stageRef.current) return;
                const w = stageDimensions.width;
                const h = stageDimensions.height;
                setStagePos({
                  x: -(targetX * zoom) + w / 2,
                  y: -(targetY * zoom) + h / 2,
                });
              }}
            />
          </div>
        </div>

        {/* ── CONTEXTUAL LIVE INSPECTOR (RIGHT PANEL) ── */}
        <BMSV4LiveInspector
          selectedSection={selectedSection}
          selectedAmenity={selectedAmenity}
          groundConfig={groundConfig}
          ticketTypes={ticketTypes}
          onUpdateSection={(updated) => {
            if (!selectedSectionId) return;
            pushHistorySnapshot();
            setSections((prev) =>
              prev.map((s) => (s.id === selectedSectionId ? { ...s, ...updated } : s))
            );
          }}
          onDeleteSection={(sectionId) => {
            pushHistorySnapshot();
            setSections((prev) => prev.filter((s) => s.id !== sectionId));
            setSelectedSectionId(null);
            toast.info("Deleted section");
          }}
          onUpdateAmenity={(updated) => {
            if (!selectedAmenityId) return;
            pushHistorySnapshot();
            setAmenities((prev) =>
              prev.map((a) => (a.id === selectedAmenityId ? { ...a, ...updated } : a))
            );
          }}
          onDeleteAmenity={(amenityId) => {
            pushHistorySnapshot();
            setAmenities((prev) => prev.filter((a) => a.id !== amenityId));
            setSelectedAmenityId(null);
            toast.info("Deleted POI");
          }}
          onUpdateGround={(updated) => {
            pushHistorySnapshot();
            setGroundConfig((prev) => ({ ...prev, ...updated }));
          }}
          onOpenPainter={(sec) => setPainterSection(sec)}
        />
      </div>

      {/* ── ARCHETYPE SELECTION MODAL ── */}
      <BMSArchetypeSelectorModal
        open={isArchetypeModalOpen}
        currentArchetype={archetype}
        onSelect={handleSelectArchetype}
        onClose={() => setIsArchetypeModalOpen(false)}
      />

      {/* ── SEAT MATRIX PAINTER MODAL ── */}
      {painterSection && (
        <BMSSeatGridPainterModal
          isOpen={Boolean(painterSection)}
          tierIndex={0}
          block={{
            id: painterSection.id,
            name: painterSection.name,
            color: painterSection.color,
            x: painterSection.x,
            y: painterSection.y,
            width: painterSection.width,
            height: painterSection.height,
            rotation: painterSection.rotation,
            shape: (painterSection.shape as any) || "rectangle",
            capacity: 0,
            tiers: [
              {
                id: painterSection.id,
                name: painterSection.name,
                ticket_type_id: painterSection.ticketTypeId || "",
                color: painterSection.color,
                row_start: painterSection.rowStart || "A",
                row_end: painterSection.rowEnd || "J",
                seats_per_row: painterSection.seatsPerRow || 20,
              },
            ],
          }}
          ticketTypes={ticketTypes}
          onClose={() => setPainterSection(null)}
          onSaveTier={(updatedTier) => {
            pushHistorySnapshot();
            setSections((prev) =>
              prev.map((s) =>
                s.id === painterSection.id
                  ? {
                      ...s,
                      rowStart: updatedTier.row_start,
                      rowEnd: updatedTier.row_end,
                      seatsPerRow: updatedTier.seats_per_row,
                    }
                  : s
              )
            );
            setPainterSection(null);
            toast.success("Applied custom seat matrix");
          }}
        />
      )}

      {/* ── AI BLUEPRINT AUTO-DETECTOR MODAL ── */}
      <BMSBlueprintAutoDetectorModal
        open={isBlueprintDetectorOpen}
        onClose={() => setIsBlueprintDetectorOpen(false)}
        onApplyLayout={({ archetype: newArch, blueprintUrl: bUrl, groundConfig: newGround, sections: newSecs, amenities: newAmens }) => {
          pushHistorySnapshot();
          setArchetype(newArch);
          setBlueprintUrl(bUrl);
          setBlueprintOpacity(0.45);
          setGroundConfig(newGround);
          setSections(newSecs);
          setAmenities(newAmens);
          setSelectedSectionId(null);
          setSelectedAmenityId(null);
        }}
      />
    </div>
  );
}
