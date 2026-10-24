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
} from "../StadiumStudioV4/types";
import { BMS_ARCHETYPE_PRESETS } from "../StadiumStudioV4/BMSArchetypePresets";
import {
  generateAllSeatsV4,
  computeBMSCapacitySummaryV4,
  expandRowRangeV4,
  GeneratedSeatV4,
} from "../StadiumStudioV4/SeatingGeneratorEngineV4";
import BMSArchetypeSelectorModal from "../StadiumStudioV4/BMSArchetypeSelectorModal";
import BMSBlueprintAutoDetectorModal from "../StadiumStudioV4/BMSBlueprintAutoDetectorModal";
import BMSV4Toolbar from "../StadiumStudioV4/BMSV4Toolbar";
import BMSV4LiveInspector from "../StadiumStudioV4/BMSV4LiveInspector";
import BMSV4MiniMap from "../StadiumStudioV4/BMSV4MiniMap";
import BMSSeatGridPainterModal from "../StadiumStudioV3/BMSSeatGridPainterModal";

export const CANVAS_W = 1600;
export const CANVAS_H = 1200;

interface StadiumStudioV5Props {
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

export default function StadiumStudioV5({
  eventId,
  ticketTypes = [],
  initialConfig,
  saving = false,
  onSave,
  onClose,
}: StadiumStudioV5Props) {
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

  // ── 2. SEAT SELECTION & MODES ──
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedAmenityId, setSelectedAmenityId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<BMSToolModeV4>("select");

  // Modals
  const [isArchetypeModalOpen, setIsArchetypeModalOpen] = useState(false);
  const [isBlueprintDetectorOpen, setIsBlueprintDetectorOpen] = useState(false);
  const [blueprintUrl, setBlueprintUrl] = useState<string | null>(
    initialConfig?.blueprintUrl || null
  );
  const [blueprintOpacity, setBlueprintOpacity] = useState<number>(
    initialConfig?.blueprintOpacity ?? 0.45
  );
  const [blueprintImg] = useImage(blueprintUrl || "", "anonymous");

  // Custom seat painter modal
  const [painterSection, setPainterSection] = useState<BMSSectionDefV4 | null>(null);

  // Canvas Stage & Zoom/Pan state
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState<number>(1);
  const [stagePos, setStagePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // History for Undo/Redo
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

  // Switch Archetype Preset
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

  // Zoom controls
  const handleZoomIn = () => setScale((s) => Math.min(3, s + 0.15));
  const handleZoomOut = () => setScale((s) => Math.max(0.3, s - 0.15));
  const handleResetZoom = () => {
    setScale(1);
    setStagePos({ x: 0, y: 0 });
  };

  // Wheel zoom
  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.05;
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.25, Math.min(4, newScale));

    setScale(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
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

  // Capacity metrics
  const capacitySummary = useMemo(() => {
    return computeBMSCapacitySummaryV4(sections, ticketTypes);
  }, [sections, ticketTypes]);

  // Selected section object
  const selectedSection = useMemo(() => {
    return sections.find((s) => s.id === selectedSectionId) || null;
  }, [sections, selectedSectionId]);

  // Selected amenity object
  const selectedAmenity = useMemo(() => {
    return amenities.find((a) => a.id === selectedAmenityId) || null;
  }, [amenities, selectedAmenityId]);

  // Save layout live
  const handleSaveLive = async () => {
    if (!onSave) return;
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
      toast.success("Venue layout published successfully with AI Vision accuracy!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save layout.");
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none relative">
      {/* ── TOP BANNER: STUDIO V5 AI VISION ACTIVE ── */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-950 border-b border-purple-500/30 px-4 py-2 flex items-center justify-between text-xs text-white shrink-0 shadow-lg shadow-purple-950/20">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-sm">
            PRO STUDIO V5
          </span>
          <span className="font-bold text-slate-200">
            AI Vision Blueprint Engine
          </span>
          <span className="hidden md:inline text-slate-400 text-[11px]">
            • Auto-contour extraction, pixel-level pitch detection &amp; dynamic concourse synthesis
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono text-[11px]">
          <div>
            <span className="text-slate-400">Total Capacity: </span>
            <span className="font-bold text-amber-300">
              {capacitySummary.totalCapacity.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Seated: </span>
            <span className="font-bold text-blue-300">
              {capacitySummary.seatedCapacity.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Est. Revenue: </span>
            <span className="font-bold text-emerald-400">
              {capacitySummary.totalGrossRevenue > 0
                ? `${capacitySummary.totalGrossRevenue.toLocaleString()} ETB`
                : "ETB 0"}
            </span>
          </div>
        </div>
      </div>

      {/* ── PRIMARY V5 TOOLBAR ── */}
      <BMSV4Toolbar
        toolMode={toolMode}
        setToolMode={setToolMode}
        archetype={archetype}
        onOpenArchetypeModal={() => setIsArchetypeModalOpen(true)}
        onOpenBlueprintDetector={() => setIsBlueprintDetectorOpen(true)}
        hasBlueprint={Boolean(blueprintUrl)}
        blueprintOpacity={blueprintOpacity}
        setBlueprintOpacity={setBlueprintOpacity}
        onAddSection={(type) => {
          pushHistorySnapshot();
          const timestamp = Date.now();
          const newSec: BMSSectionDefV4 = {
            id: `sec_user_${timestamp}`,
            name: type === "curved_stand" ? "New Curved Stand" : "New Grid Stand",
            code: `SEC-${sections.length + 1}`,
            sectionType: type,
            color: type === "curved_stand" ? "#8B5CF6" : "#3B82F6",
            x: 800,
            y: 600,
            width: 280,
            height: 200,
            rotation: 0,
            shape: type === "curved_stand" ? "arc" : "rectangle",
            innerRadius: 280,
            outerRadius: 460,
            startAngle: 45,
            sweepAngle: 90,
            rowStart: "A",
            rowEnd: "J",
            seatsPerRow: 24,
            price: 250,
          };
          setSections((prev) => [...prev, newSec]);
          setSelectedSectionId(newSec.id);
          toast.success("Added new section");
        }}
        onAddAmenity={(type) => {
          pushHistorySnapshot();
          const newAm: BMSAmenityPOIV4 = {
            id: `amen_${Date.now()}`,
            type,
            label: type === "gate" ? "Main Entrance Gate" : "Concourse Service",
            x: 800,
            y: 300,
          };
          setAmenities((prev) => [...prev, newAm]);
          setSelectedAmenityId(newAm.id);
          toast.success("Added concourse amenity");
        }}
        zoom={scale}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
        saving={saving}
        onSave={handleSaveLive}
      />

      {/* ── WORKSPACE AREA ── */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 bg-slate-950 relative overflow-hidden">
          <Stage
            ref={stageRef}
            width={typeof window !== "undefined" ? window.innerWidth - 380 : 1200}
            height={typeof window !== "undefined" ? window.innerHeight - 150 : 800}
            scaleX={scale}
            scaleY={scale}
            x={stagePos.x}
            y={stagePos.y}
            draggable={toolMode === "pan"}
            onWheel={handleWheel}
            onClick={(e) => {
              if (e.target === e.target.getStage()) {
                setSelectedSectionId(null);
                setSelectedAmenityId(null);
              }
            }}
          >
            {/* Background Layer with Blueprint Overlay */}
            <Layer>
              <Rect
                x={0}
                y={0}
                width={CANVAS_W}
                height={CANVAS_H}
                fill="#020617"
                stroke="#1E293B"
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
                    opacity={0.35}
                  />
                ))
              )}

              {/* Blueprint Image as Konva Layer */}
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

            {/* Ground / Center Pitch Layer */}
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
                  fill={groundConfig.color || "#15803D"}
                  cornerRadius={12}
                  stroke="#22C55E"
                  strokeWidth={2}
                  shadowColor="#15803D"
                  shadowBlur={12}
                  shadowOpacity={0.4}
                />
                <Text
                  x={0}
                  y={groundConfig.height / 2 - 8}
                  width={groundConfig.width}
                  text={groundConfig.label}
                  align="center"
                  fill="#FFFFFF"
                  fontFamily="sans-serif"
                  fontStyle="bold"
                  fontSize={14}
                  opacity={0.9}
                />
              </Group>
            </Layer>

            {/* Stands & Generated Seats Layer */}
            <Layer>
              {sections.map((section) => {
                const isSelected = selectedSectionId === section.id;
                const seats = seatsBySection.get(section.id) || [];

                return (
                  <Group
                    key={section.id}
                    onClick={() => {
                      setSelectedSectionId(section.id);
                      setSelectedAmenityId(null);
                    }}
                  >
                    {/* Render Individual Seats */}
                    {seats.map((seat: GeneratedSeatV4) => (
                      <Circle
                        key={seat.id}
                        x={seat.coordinate_x}
                        y={seat.coordinate_y}
                        radius={seat.type === "vip" ? 4.5 : 3.5}
                        fill={
                          seat.type === "vip"
                            ? "#F59E0B"
                            : seat.type === "wheelchair"
                            ? "#06B6D4"
                            : isSelected
                            ? "#F43F5E"
                            : section.color
                        }
                        stroke="#0F172A"
                        strokeWidth={0.8}
                        opacity={seat.type === "blocked" ? 0.2 : 0.9}
                      />
                    ))}

                    {/* Section Label */}
                    <Text
                      x={section.x - 70}
                      y={section.y - (section.innerRadius || 100) - 20}
                      text={section.name}
                      fill="#FFFFFF"
                      fontFamily="sans-serif"
                      fontSize={11}
                      fontStyle="bold"
                      align="center"
                      width={140}
                      listening={false}
                    />
                  </Group>
                );
              })}
            </Layer>

            {/* Amenities & Gate POIs */}
            <Layer>
              {amenities.map((amenity) => {
                const isSelected = selectedAmenityId === amenity.id;
                return (
                  <Group
                    key={amenity.id}
                    x={amenity.x}
                    y={amenity.y}
                    draggable={toolMode === "select"}
                    onClick={() => {
                      setSelectedAmenityId(amenity.id);
                      setSelectedSectionId(null);
                    }}
                    onDragEnd={(e) => {
                      pushHistorySnapshot();
                      const nx = e.target.x();
                      const ny = e.target.y();
                      setAmenities((prev) =>
                        prev.map((a) => (a.id === amenity.id ? { ...a, x: nx, y: ny } : a))
                      );
                    }}
                  >
                    <Rect
                      x={-40}
                      y={-12}
                      width={80}
                      height={24}
                      fill={amenity.type === "gate" ? "#7C3AED" : "#0284C7"}
                      cornerRadius={6}
                      stroke={isSelected ? "#F43F5E" : "#FFFFFF"}
                      strokeWidth={isSelected ? 2 : 1}
                      shadowBlur={6}
                      shadowOpacity={0.4}
                    />
                    <Text
                      x={-40}
                      y={-6}
                      width={80}
                      text={amenity.label}
                      fill="#FFFFFF"
                      fontSize={9}
                      fontStyle="bold"
                      align="center"
                    />
                  </Group>
                );
              })}
            </Layer>
          </Stage>

          {/* Mini-Map */}
          <BMSV4MiniMap
            canvasW={CANVAS_W}
            canvasH={CANVAS_H}
            groundConfig={groundConfig}
            sections={sections}
            onNavigate={(nx, ny) => {
              setStagePos({
                x: -nx * scale + (window.innerWidth - 380) / 2,
                y: -ny * scale + (window.innerHeight - 150) / 2,
              });
            }}
          />
        </div>

        {/* ── RIGHT LIVE INSPECTOR ── */}
        <BMSV4LiveInspector
          selectedSection={selectedSection}
          selectedAmenity={selectedAmenity}
          groundConfig={groundConfig}
          ticketTypes={ticketTypes.map((t) => ({ id: t.id, name: t.name, price: t.price }))}
          onUpdateSection={(updated) => {
            pushHistorySnapshot();
            if (selectedSectionId) {
              setSections((prev) =>
                prev.map((s) => (s.id === selectedSectionId ? ({ ...s, ...updated } as BMSSectionDefV4) : s))
              );
            }
          }}
          onDeleteSection={(secId) => {
            pushHistorySnapshot();
            setSections((prev) => prev.filter((s) => s.id !== secId));
            setSelectedSectionId(null);
            toast.info("Deleted section");
          }}
          onUpdateAmenity={(updated) => {
            pushHistorySnapshot();
            if (selectedAmenityId) {
              setAmenities((prev) =>
                prev.map((a) => (a.id === selectedAmenityId ? ({ ...a, ...updated } as BMSAmenityPOIV4) : a))
              );
            }
          }}
          onDeleteAmenity={(amenId) => {
            pushHistorySnapshot();
            setAmenities((prev) => prev.filter((a) => a.id !== amenId));
            setSelectedAmenityId(null);
            toast.info("Deleted amenity");
          }}
          onUpdateGround={(updated) => {
            pushHistorySnapshot();
            setGroundConfig((prev) => ({ ...prev, ...updated }));
          }}
          onOpenPainter={(sec: BMSSectionDefV4) => setPainterSection(sec)}
        />
      </div>

      {/* ── MODALS ── */}
      <BMSArchetypeSelectorModal
        open={isArchetypeModalOpen}
        onClose={() => setIsArchetypeModalOpen(false)}
        currentArchetype={archetype}
        onSelect={handleSelectArchetype}
      />

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
