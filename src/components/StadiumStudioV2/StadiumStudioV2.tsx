"use client";
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Stage, Layer, Rect, Text, Group, Transformer, Circle, Line, Ellipse, Arc } from "react-konva";
import Konva from "konva";
import {
  MousePointer2,
  PenTool,
  Hand,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Plus,
  Trash2,
  Save,
  Image as ImageIcon,
  Lock,
  Unlock,
  Sliders,
  ChevronDown,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Layers,
  Crosshair,
  RotateCcw,
  Copy,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  StadiumBlockDefV2,
  StadiumElementDefV2,
  StadiumGroundConfigV2,
  BackgroundPlanDef,
  StadiumSeatingConfigOutputV2,
  StudioToolMode,
  StadiumTierDefV2,
} from "./types";
import BackgroundPlanLayer from "./BackgroundPlanLayer";
import PolygonDrawingTool from "./PolygonDrawingTool";
import CornerAlignPad from "./CornerAlignPad";
import { HistoryManager } from "./HistoryManager";
import { generateAllStadiumSeats, generateBlockSeats } from "./SeatingGeneratorEngine";

export const CANVAS_W = 1600;
export const CANVAS_H = 1200;

interface StadiumStudioV2Props {
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
  onSave?: (output: StadiumSeatingConfigOutputV2, seatsJson: any[]) => Promise<void>;
  onClose?: () => void;
}

export default function StadiumStudioV2({
  eventId,
  ticketTypes = [],
  initialConfig,
  saving = false,
  onSave,
  onClose,
}: StadiumStudioV2Props) {
  // ── 1. CORE STUDIO STATE ──
  const [toolMode, setToolMode] = useState<StudioToolMode>("select");
  const [stadiumName, setStadiumName] = useState<string>(
    initialConfig?.stadium_name || "National Sports Stadium"
  );

  const [groundConfig, setGroundConfig] = useState<StadiumGroundConfigV2>(
    initialConfig?.groundConfig || {
      sport_type: "football",
      pitch_label: "FOOTBALL / SOCCER PITCH",
      turf_color: "#166534",
      track_color: "#7f1d1d",
      shape: "rectangle",
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      width: 440,
      height: 290,
      rotation: 0,
    }
  );

  const [blocks, setBlocks] = useState<StadiumBlockDefV2[]>(
    Array.isArray(initialConfig?.blocks) ? initialConfig.blocks : []
  );

  const [elements, setElements] = useState<StadiumElementDefV2[]>(
    Array.isArray(initialConfig?.elements) ? initialConfig.elements : []
  );

  const [backgroundPlan, setBackgroundPlan] = useState<BackgroundPlanDef | undefined>(
    initialConfig?.backgroundPlan
  );

  // Selection & UI State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isPlanSelected, setIsPlanSelected] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"stands" | "elements" | "pitch" | "blueprint">("stands");

  // Polygon Drawing in Progress
  const [drawingPoints, setDrawingPoints] = useState<number[]>([]);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Canvas Stage & Zoom/Pan state
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const selectedNodeRef = useRef<Konva.Node | null>(null);

  const [stageDimensions, setStageDimensions] = useState({ width: 1000, height: 700 });
  const [zoomScale, setZoomScale] = useState(0.5);

  // History Manager
  const history = useMemo(() => new HistoryManager(30), []);

  const pushHistorySnapshot = useCallback(() => {
    history.push({
      blocks,
      elements,
      groundConfig,
      backgroundPlan,
    });
  }, [history, blocks, elements, groundConfig, backgroundPlan]);

  const handleUndo = useCallback(() => {
    const prev = history.undo({ blocks, elements, groundConfig, backgroundPlan });
    if (prev) {
      setBlocks(prev.blocks);
      setElements(prev.elements);
      setGroundConfig(prev.groundConfig);
      setBackgroundPlan(prev.backgroundPlan);
      toast.info("Undo performed");
    }
  }, [history, blocks, elements, groundConfig, backgroundPlan]);

  const handleRedo = useCallback(() => {
    const next = history.redo({ blocks, elements, groundConfig, backgroundPlan });
    if (next) {
      setBlocks(next.blocks);
      setElements(next.elements);
      setGroundConfig(next.groundConfig);
      setBackgroundPlan(next.backgroundPlan);
      toast.info("Redo performed");
    }
  }, [history, blocks, elements, groundConfig, backgroundPlan]);

  // Keyboard Shortcuts: Ctrl+Z (Undo), Ctrl+Y (Redo), V (Select), P (Polygon), H (Hand), Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === "v") {
        setToolMode("select");
      } else if (e.key.toLowerCase() === "p") {
        setToolMode("draw_polygon");
      } else if (e.key.toLowerCase() === "h") {
        setToolMode("pan");
      } else if (e.key === "Escape") {
        if (drawingPoints.length > 0) {
          setDrawingPoints([]);
          setToolMode("select");
          toast.info("Polygon drawing cancelled.");
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId && selectedId !== "ground-pitch") {
          pushHistorySnapshot();
          setBlocks((prev) => prev.filter((b) => b.id !== selectedId));
          setSelectedId(null);
          toast.info("Stand deleted");
        } else if (selectedElementId) {
          pushHistorySnapshot();
          setElements((prev) => prev.filter((el) => el.id !== selectedElementId));
          setSelectedElementId(null);
          toast.info("Element deleted");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, drawingPoints, selectedId, selectedElementId, pushHistorySnapshot]);

  // Fit View
  const resetToFitView = useCallback(() => {
    const w = stageDimensions.width;
    const h = stageDimensions.height;
    const fitScale = Math.min((w - 60) / CANVAS_W, (h - 60) / CANVAS_H, 0.85);
    const fitX = (w - CANVAS_W * fitScale) / 2;
    const fitY = (h - CANVAS_H * fitScale) / 2;

    setZoomScale(fitScale);
    if (stageRef.current) {
      stageRef.current.to({
        x: fitX,
        y: fitY,
        scaleX: fitScale,
        scaleY: fitScale,
        duration: 0.25,
        easing: Konva.Easings.EaseInOut,
      });
    }
  }, [stageDimensions]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setStageDimensions({ width: el.clientWidth || 1000, height: el.clientHeight || 700 });
    };
    updateSize();
    const obs = new ResizeObserver(updateSize);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    resetToFitView();
  }, [resetToFitView]);

  // Connect Transformer
  useEffect(() => {
    if (!trRef.current) return;
    if (selectedNodeRef.current && toolMode === "select") {
      trRef.current.nodes([selectedNodeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    } else {
      trRef.current.nodes([]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, selectedElementId, toolMode, blocks, elements]);

  // Cursor-centered Wheel Zoom
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const scaleBy = 1.08;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const clampedScale = Math.max(0.15, Math.min(newScale, 3.5));

    setZoomScale(clampedScale);
    stage.scale({ x: clampedScale, y: clampedScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };
    stage.position(newPos);
    stage.batchDraw();
  };

  // ── STAGE CLICK / POLYGON DRAWING HANDLER ──
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    // If clicking on background when drawing polygon
    if (toolMode === "draw_polygon") {
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      // Transform viewport pos to canvas stage space
      const transform = stage.getAbsoluteTransform().copy().invert();
      const canvasPos = transform.point(pos);
      const cx = Math.round(canvasPos.x);
      const cy = Math.round(canvasPos.y);

      // Check if closing polygon (clicking near start vertex)
      if (drawingPoints.length >= 6) {
        const startX = drawingPoints[0];
        const startY = drawingPoints[1];
        if (Math.hypot(cx - startX, cy - startY) < 24) {
          finishPolygonStand();
          return;
        }
      }

      setDrawingPoints((prev) => [...prev, cx, cy]);
      return;
    }

    // If clicking on empty canvas, deselect
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
      setSelectedElementId(null);
      setIsPlanSelected(false);
      selectedNodeRef.current = null;
    }
  };

  const handleStageMouseMove = () => {
    if (toolMode === "draw_polygon" && drawingPoints.length > 0) {
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;
      const transform = stage.getAbsoluteTransform().copy().invert();
      const canvasPos = transform.point(pos);
      setCursorPos({ x: Math.round(canvasPos.x), y: Math.round(canvasPos.y) });
    }
  };

  // Close & finalize polygon stand
  const finishPolygonStand = () => {
    if (drawingPoints.length < 6) {
      toast.error("A polygon needs at least 3 points!");
      return;
    }
    pushHistorySnapshot();
    const newStandId = `poly-stand-${Date.now()}`;
    const newBlock: StadiumBlockDefV2 = {
      id: newStandId,
      name: `Corner Stand ${blocks.length + 1}`,
      color: "#8b5cf6",
      shape: "polygon",
      x: 0,
      y: 0,
      width: 200,
      height: 150,
      rotation: 0,
      capacity: 250,
      points: [...drawingPoints],
      stand_type: "seated",
      tiers: [
        {
          id: `tier-${Date.now()}`,
          name: "Standard Tier",
          ticket_type_id: ticketTypes[0]?.id || "",
          row_start: "A",
          row_end: "J",
          seats_per_row: 25,
          color: "#8b5cf6",
        },
      ],
    };

    setBlocks((prev) => [...prev, newBlock]);
    setDrawingPoints([]);
    setCursorPos(null);
    setToolMode("select");
    setSelectedId(newStandId);
    setActiveTab("stands");
    toast.success("Polygon Stand created successfully!");
  };

  // Selected Block & Capacity computation
  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedId),
    [blocks, selectedId]
  );

  const totalStadiumCapacity = useMemo(() => {
    return blocks.reduce((sum, b) => {
      const blockSeats = generateBlockSeats(b, CANVAS_W, CANVAS_H);
      return sum + (b.stand_type === "standing" ? b.capacity : blockSeats.length);
    }, 0);
  }, [blocks]);

  // ── ADD PRESET STANDS ──
  const addPresetStand = (shape: StadiumBlockDefV2["shape"]) => {
    pushHistorySnapshot();
    const newId = `stand-${Date.now()}`;
    const defaultColor = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"][
      blocks.length % 5
    ];

    if (shape === "arc") {
      const newArcBlock: StadiumBlockDefV2 = {
        id: newId,
        name: `Ring Arc Stand ${blocks.length + 1}`,
        color: defaultColor,
        shape: "arc",
        x: groundConfig.x ?? CANVAS_W / 2,
        y: groundConfig.y ?? CANVAS_H / 2,
        stadiumCenterX: groundConfig.x ?? CANVAS_W / 2,
        stadiumCenterY: groundConfig.y ?? CANVAS_H / 2,
        innerRadius: 260,
        outerRadius: 335,
        startAngle: 202.5, // NW Corner preset
        sweepAngle: 45,
        width: 670,
        height: 670,
        rotation: 0,
        capacity: 200,
        stand_type: "seated",
        tiers: [
          {
            id: `tier-${Date.now()}`,
            name: "Lower Tier",
            ticket_type_id: ticketTypes[0]?.id || "",
            row_start: "A",
            row_end: "J",
            seats_per_row: 20,
            color: defaultColor,
          },
        ],
      };
      setBlocks((p) => [...p, newArcBlock]);
      setSelectedId(newId);
      toast.success("Ring Arc stand added!");
      return;
    }

    // Default Rectangular/Pill stand
    const newBlock: StadiumBlockDefV2 = {
      id: newId,
      name: `Stand ${String.fromCharCode(65 + blocks.length)}`,
      color: defaultColor,
      shape: shape || "rectangle",
      x: (groundConfig.x ?? CANVAS_W / 2) - 130,
      y: (groundConfig.y ?? CANVAS_H / 2) - (groundConfig.height ?? 290) / 2 - 130,
      width: 260,
      height: 90,
      rotation: 0,
      capacity: 250,
      stand_type: "seated",
      tiers: [
        {
          id: `tier-${Date.now()}`,
          name: "Main Tier",
          ticket_type_id: ticketTypes[0]?.id || "",
          row_start: "A",
          row_end: "J",
          seats_per_row: 25,
          color: defaultColor,
        },
      ],
    };
    setBlocks((p) => [...p, newBlock]);
    setSelectedId(newId);
    toast.success(`${shape?.toUpperCase() || "Rect"} stand added!`);
  };

  // ── SAVE & PUBLISH HANDLER ──
  const handleSaveLayout = async () => {
    if (!onSave) return;
    const generatedSeats = generateAllStadiumSeats(blocks, CANVAS_W, CANVAS_H);

    const payload: StadiumSeatingConfigOutputV2 = {
      layout_mode: "stadium",
      studio_version: "2.0",
      canvasWidth: CANVAS_W,
      canvasHeight: CANVAS_H,
      stadium_name: stadiumName,
      groundConfig,
      blocks,
      elements,
      backgroundPlan,
    };

    try {
      await onSave(payload, generatedSeats);
      toast.success(`Stadium Studio V2 layout published with ${generatedSeats.length} seats!`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save layout.");
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-white select-none overflow-hidden font-sans">
      {/* ── TOP STUDIO TOOLBAR ── */}
      <header className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 z-20">
        {/* Left: Branding & Stadium Name */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 py-1 rounded-xl text-slate-950 font-black text-xs tracking-wider shadow-sm">
            <span>🏟️</span>
            <span>PRO STUDIO V2</span>
          </div>

          <input
            type="text"
            value={stadiumName}
            onChange={(e) => setStadiumName(e.target.value)}
            className="bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-100 focus:outline-none focus:border-amber-400 w-52 truncate"
            placeholder="Stadium Name"
          />
        </div>

        {/* Center: Tools (Select, Draw Polygon, Pan) & History (Undo, Redo) */}
        <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setToolMode("select")}
            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              toolMode === "select"
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title="Select & Move (V)"
          >
            <MousePointer2 className="w-4 h-4" />
            <span className="text-[11px]">Select</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setToolMode("draw_polygon");
              setSelectedId(null);
              toast.info("Click anywhere on canvas to start drawing polygon points!");
            }}
            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              toolMode === "draw_polygon"
                ? "bg-emerald-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title="Draw Irregular Polygon Stand (P)"
          >
            <PenTool className="w-4 h-4" />
            <span className="text-[11px]">Draw Polygon</span>
          </button>

          <button
            type="button"
            onClick={() => setToolMode("pan")}
            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              toolMode === "pan"
                ? "bg-sky-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title="Pan Canvas (H)"
          >
            <Hand className="w-4 h-4" />
            <span className="text-[11px]">Pan</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={handleUndo}
            disabled={!history.canUndo()}
            className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!history.canRedo()}
            className="p-1.5 text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-slate-800"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Add Stand, Blueprint Trigger & Save */}
        <div className="flex items-center gap-2">
          {/* Add Stand Menu */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-400 px-3 py-1.5 rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Stand</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-1.5 hidden group-hover:block z-50">
              <button
                type="button"
                onClick={() => addPresetStand("rectangle")}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded-lg font-semibold flex items-center gap-2"
              >
                <span>🔲</span> Rectangle Stand
              </button>
              <button
                type="button"
                onClick={() => addPresetStand("arc")}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded-lg font-semibold flex items-center gap-2"
              >
                <span>⭕</span> 360° Ring Arc Stand
              </button>
              <button
                type="button"
                onClick={() => addPresetStand("pill")}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded-lg font-semibold flex items-center gap-2"
              >
                <span>🏟️</span> Pill / Rounded Stand
              </button>
              <button
                type="button"
                onClick={() => {
                  setToolMode("draw_polygon");
                  toast.info("Click on canvas to draw polygon!");
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-emerald-400 hover:bg-emerald-950/40 rounded-lg font-bold flex items-center gap-2"
              >
                <span>📐</span> Custom Polygon Stand
              </button>
            </div>
          </div>

          {/* Background Blueprint Upload Trigger */}
          <button
            type="button"
            onClick={() => setActiveTab("blueprint")}
            className={`p-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
              backgroundPlan?.url
                ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
            title="Upload and align reference stadium blueprint / layout plan"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Blueprint</span>
            {backgroundPlan?.url && <span className="w-2 h-2 rounded-full bg-sky-400" />}
          </button>

          {/* Capacity Pill */}
          <div className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl text-xs font-mono font-bold text-amber-300">
            {totalStadiumCapacity.toLocaleString()} Seats
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSaveLayout}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 px-4 py-1.5 rounded-xl shadow-lg transition-all"
          >
            <Save className="w-4 h-4 text-slate-950" />
            <span>{saving ? "Publishing..." : "Save Layout"}</span>
          </button>
        </div>
      </header>

      {/* ── MAIN STUDIO BODY (CANVAS + SIDEBAR) ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas Container */}
        <div
          ref={containerRef}
          className="flex-1 h-full bg-[#070b12] relative overflow-hidden cursor-crosshair"
        >
          <Stage
            ref={stageRef}
            width={stageDimensions.width}
            height={stageDimensions.height}
            scaleX={zoomScale}
            scaleY={zoomScale}
            draggable={toolMode === "pan"}
            onWheel={handleWheel}
            onClick={handleStageClick}
            onTap={handleStageClick}
            onMouseMove={handleStageMouseMove}
          >
            {/* ── LAYER 1: REFERENCE BLUEPRINT PLAN ── */}
            <Layer id="blueprint-layer">
              <BackgroundPlanLayer
                plan={backgroundPlan}
                isSelected={isPlanSelected}
                onSelect={() => {
                  if (toolMode === "select" && !backgroundPlan?.isLocked) {
                    setIsPlanSelected(true);
                    setSelectedId(null);
                    setActiveTab("blueprint");
                  }
                }}
                onUpdate={(upPlan) => {
                  pushHistorySnapshot();
                  setBackgroundPlan(upPlan);
                }}
              />
            </Layer>

            {/* ── LAYER 2: SPORT GROUND PITCH ── */}
            <Layer id="pitch-layer">
              <Group
                x={groundConfig.x ?? CANVAS_W / 2}
                y={groundConfig.y ?? CANVAS_H / 2}
                offsetX={(groundConfig.width ?? 440) / 2}
                offsetY={(groundConfig.height ?? 290) / 2}
                rotation={groundConfig.rotation ?? 0}
                draggable={toolMode === "select"}
                ref={selectedId === "ground-pitch" ? (n) => { selectedNodeRef.current = n; } : undefined}
                onClick={() => {
                  if (toolMode === "select") {
                    setSelectedId("ground-pitch");
                    setSelectedElementId(null);
                    setIsPlanSelected(false);
                    setActiveTab("pitch");
                  }
                }}
                onDragEnd={(e) => {
                  const node = e.target;
                  pushHistorySnapshot();
                  setGroundConfig((p) => ({
                    ...p,
                    x: Math.round(node.x()),
                    y: Math.round(node.y()),
                  }));
                }}
              >
                {/* Outer Pitch Border */}
                <Rect
                  x={0}
                  y={0}
                  width={groundConfig.width ?? 440}
                  height={groundConfig.height ?? 290}
                  fill={groundConfig.turf_color || "#166534"}
                  stroke={selectedId === "ground-pitch" ? "#f59e0b" : "#ffffff"}
                  strokeWidth={selectedId === "ground-pitch" ? 4 : 2}
                  cornerRadius={18}
                  shadowColor="#000000"
                  shadowBlur={16}
                  shadowOpacity={0.6}
                />
                {/* Football Center Circle & Goal Lines */}
                <Circle
                  x={(groundConfig.width ?? 440) / 2}
                  y={(groundConfig.height ?? 290) / 2}
                  radius={48}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={2}
                />
                <Circle
                  x={(groundConfig.width ?? 440) / 2}
                  y={(groundConfig.height ?? 290) / 2}
                  radius={4}
                  fill="#ffffff"
                />
                <Line
                  points={[
                    (groundConfig.width ?? 440) / 2,
                    0,
                    (groundConfig.width ?? 440) / 2,
                    groundConfig.height ?? 290,
                  ]}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={2}
                />
                {/* Stand Label overlay */}
                <Text
                  text={groundConfig.pitch_label || "FOOTBALL PITCH"}
                  x={10}
                  y={(groundConfig.height ?? 290) / 2 - 8}
                  width={(groundConfig.width ?? 440) - 20}
                  align="center"
                  fontSize={13}
                  fontStyle="bold"
                  fill="rgba(255,255,255,0.85)"
                  listening={false}
                />
              </Group>
            </Layer>

            {/* ── LAYER 3: STADIUM STAND BLOCKS (Rectangles, Arcs, Polygons) ── */}
            <Layer id="stands-layer">
              {blocks.map((block) => {
                const isSelected = selectedId === block.id;
                const isArc = block.shape === "arc";
                const isPolygon = block.shape === "polygon" && Array.isArray(block.points);

                // ── Arc Render ──
                if (isArc) {
                  const sCenterX = block.stadiumCenterX ?? CANVAS_W / 2;
                  const sCenterY = block.stadiumCenterY ?? CANVAS_H / 2;
                  const startA = block.startAngle ?? 0;
                  const sweepA = block.sweepAngle ?? 45;
                  const inR = block.innerRadius ?? 260;
                  const outR = block.outerRadius ?? 335;

                  return (
                    <Group
                      key={block.id}
                      id={block.id}
                      ref={isSelected ? (n) => { selectedNodeRef.current = n; } : undefined}
                      x={sCenterX}
                      y={sCenterY}
                      draggable={toolMode === "select"}
                      onClick={() => {
                        if (toolMode === "select") {
                          setSelectedId(block.id);
                          setSelectedElementId(null);
                          setIsPlanSelected(false);
                          setActiveTab("stands");
                        }
                      }}
                      onDragEnd={(e) => {
                        const node = e.target;
                        pushHistorySnapshot();
                        setBlocks((prev) =>
                          prev.map((b) =>
                            b.id === block.id
                              ? {
                                  ...b,
                                  stadiumCenterX: Math.round(node.x()),
                                  stadiumCenterY: Math.round(node.y()),
                                  x: Math.round(node.x()),
                                  y: Math.round(node.y()),
                                }
                              : b
                          )
                        );
                      }}
                    >
                      <Arc
                        x={0}
                        y={0}
                        innerRadius={inR}
                        outerRadius={outR}
                        angle={sweepA}
                        rotation={startA}
                        fill={block.color}
                        stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.4)"}
                        strokeWidth={isSelected ? 4 : 1.5}
                        shadowColor={isSelected ? "#ffffff" : "#000000"}
                        shadowBlur={isSelected ? 16 : 6}
                      />
                    </Group>
                  );
                }

                // ── Polygon Render ──
                if (isPolygon && block.points) {
                  return (
                    <Group
                      key={block.id}
                      id={block.id}
                      ref={isSelected ? (n) => { selectedNodeRef.current = n; } : undefined}
                      draggable={toolMode === "select"}
                      onClick={() => {
                        if (toolMode === "select") {
                          setSelectedId(block.id);
                          setSelectedElementId(null);
                          setIsPlanSelected(false);
                          setActiveTab("stands");
                        }
                      }}
                      onDragEnd={(e) => {
                        const node = e.target;
                        pushHistorySnapshot();
                        const dx = Math.round(node.x());
                        const dy = Math.round(node.y());
                        node.position({ x: 0, y: 0 });
                        setBlocks((prev) =>
                          prev.map((b) => {
                            if (b.id !== block.id || !b.points) return b;
                            const translated = b.points.map((val, idx) =>
                              idx % 2 === 0 ? val + dx : val + dy
                            );
                            return { ...b, points: translated };
                          })
                        );
                      }}
                    >
                      <Line
                        points={block.points}
                        closed={true}
                        fill={block.color}
                        stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.5)"}
                        strokeWidth={isSelected ? 4 : 1.5}
                        shadowColor={isSelected ? "#ffffff" : "#000000"}
                        shadowBlur={isSelected ? 16 : 6}
                      />
                      <Text
                        text={block.name.toUpperCase()}
                        x={block.points[0]}
                        y={block.points[1]}
                        fontSize={11}
                        fontStyle="bold"
                        fill="#ffffff"
                        shadowColor="#000000"
                        shadowBlur={4}
                        listening={false}
                      />
                    </Group>
                  );
                }

                // ── Rectangle / Pill Render ──
                return (
                  <Group
                    key={block.id}
                    id={block.id}
                    ref={isSelected ? (n) => { selectedNodeRef.current = n; } : undefined}
                    x={block.x + block.width / 2}
                    y={block.y + block.height / 2}
                    offsetX={block.width / 2}
                    offsetY={block.height / 2}
                    rotation={block.rotation}
                    draggable={toolMode === "select"}
                    onClick={() => {
                      if (toolMode === "select") {
                        setSelectedId(block.id);
                        setSelectedElementId(null);
                        setIsPlanSelected(false);
                        setActiveTab("stands");
                      }
                    }}
                    onDragEnd={(e) => {
                      const node = e.target;
                      pushHistorySnapshot();
                      setBlocks((prev) =>
                        prev.map((b) =>
                          b.id === block.id
                            ? {
                                ...b,
                                x: Math.round(node.x() - b.width / 2),
                                y: Math.round(node.y() - b.height / 2),
                              }
                            : b
                        )
                      );
                    }}
                    onTransformEnd={(e) => {
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);
                      const nw = Math.max(50, Math.round(block.width * Math.abs(scaleX)));
                      const nh = Math.max(40, Math.round(block.height * Math.abs(scaleY)));
                      pushHistorySnapshot();
                      setBlocks((prev) =>
                        prev.map((b) =>
                          b.id === block.id
                            ? {
                                ...b,
                                x: Math.round(node.x() - nw / 2),
                                y: Math.round(node.y() - nh / 2),
                                width: nw,
                                height: nh,
                                rotation: Math.round(node.rotation()),
                              }
                            : b
                        )
                      );
                    }}
                  >
                    <Rect
                      x={0}
                      y={0}
                      width={block.width}
                      height={block.height}
                      fill={block.color}
                      stroke={isSelected ? "#ffffff" : "rgba(255,255,255,0.4)"}
                      strokeWidth={isSelected ? 4 : 1.5}
                      cornerRadius={block.shape === "pill" ? block.height / 2 : 12}
                      shadowColor={isSelected ? "#ffffff" : "#000000"}
                      shadowBlur={isSelected ? 16 : 6}
                    />
                    <Text
                      text={block.name.toUpperCase()}
                      x={4}
                      y={block.height * 0.25}
                      width={block.width - 8}
                      align="center"
                      fontSize={12}
                      fontStyle="bold"
                      fill="#ffffff"
                      shadowColor="#000000"
                      shadowBlur={4}
                      listening={false}
                    />
                  </Group>
                );
              })}

              {/* Active Polygon Drawing Layer */}
              <PolygonDrawingTool
                isDrawing={toolMode === "draw_polygon"}
                points={drawingPoints}
                cursorPos={cursorPos}
                onClosePolygon={finishPolygonStand}
              />

              {/* Global Transformer */}
              <Transformer
                ref={trRef}
                rotateEnabled={true}
                keepRatio={false}
                boundBoxFunc={(_, newBox) => ({
                  ...newBox,
                  width: Math.max(50, newBox.width),
                  height: Math.max(40, newBox.height),
                })}
              />
            </Layer>
          </Stage>

          {/* Floating Zoom Controls at Bottom Right */}
          <div className="absolute bottom-5 right-5 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700 shadow-2xl z-10">
            <button
              type="button"
              onClick={() => setZoomScale((s) => Math.min(s * 1.2, 3.5))}
              className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomScale((s) => Math.max(s / 1.2, 0.15))}
              className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetToFitView}
              className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800"
              title="Fit to Screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── RIGHT INSPECTOR & EDIT SIDEBAR ── */}
        <aside className="w-80 h-full bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 overflow-y-auto">
          {/* Sidebar Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("stands")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeTab === "stands"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Stands ({blocks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pitch")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeTab === "pitch"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Pitch
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("blueprint")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeTab === "blueprint"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Blueprint
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* ── TAB 1: STANDS & CORNER ALIGN PAD ── */}
            {activeTab === "stands" && (
              <>
                {selectedBlock ? (
                  <div className="space-y-4">
                    {/* Stand Name & Color */}
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Stand Name & Theme Color
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={selectedBlock.name}
                          onChange={(e) => {
                            setBlocks((prev) =>
                              prev.map((b) =>
                                b.id === selectedBlock.id ? { ...b, name: e.target.value } : b
                              )
                            );
                          }}
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                        />
                        <input
                          type="color"
                          value={selectedBlock.color}
                          onChange={(e) => {
                            setBlocks((prev) =>
                              prev.map((b) =>
                                b.id === selectedBlock.id ? { ...b, color: e.target.value } : b
                              )
                            );
                          }}
                          className="w-9 h-8.5 rounded-xl border border-slate-700 cursor-pointer bg-slate-800 p-1"
                        />
                      </div>
                    </div>

                    {/* 4-Corner Auto-Adjust & Rotation Pad */}
                    <CornerAlignPad
                      block={selectedBlock}
                      pitchX={groundConfig.x ?? CANVAS_W / 2}
                      pitchY={groundConfig.y ?? CANVAS_H / 2}
                      pitchW={groundConfig.width ?? 440}
                      pitchH={groundConfig.height ?? 290}
                      onUpdate={(up) => {
                        pushHistorySnapshot();
                        setBlocks((prev) => prev.map((b) => (b.id === up.id ? up : b)));
                      }}
                    />

                    {/* Delete Stand Button */}
                    <button
                      type="button"
                      onClick={() => {
                        pushHistorySnapshot();
                        setBlocks((prev) => prev.filter((b) => b.id !== selectedBlock.id));
                        setSelectedId(null);
                        toast.info("Stand removed");
                      }}
                      className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Stand</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-10 space-y-3">
                    <p className="text-xs text-slate-400">Click a stand on the canvas or add one:</p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => addPresetStand("rectangle")}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200"
                      >
                        + Add Rectangular Stand
                      </button>
                      <button
                        type="button"
                        onClick={() => addPresetStand("arc")}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-amber-400"
                      >
                        + Add 360° Ring Arc Stand
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setToolMode("draw_polygon");
                          toast.info("Click points on canvas to draw polygon!");
                        }}
                        className="py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-xs font-bold text-emerald-400"
                      >
                        + Draw Custom Polygon Stand
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── TAB 2: PITCH CONFIG ── */}
            {activeTab === "pitch" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Pitch Label
                  </label>
                  <input
                    type="text"
                    value={groundConfig.pitch_label}
                    onChange={(e) =>
                      setGroundConfig((p) => ({ ...p, pitch_label: e.target.value }))
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Width (px)
                    </label>
                    <input
                      type="number"
                      value={groundConfig.width ?? 440}
                      onChange={(e) =>
                        setGroundConfig((p) => ({ ...p, width: Number(e.target.value) || 440 }))
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Height (px)
                    </label>
                    <input
                      type="number"
                      value={groundConfig.height ?? 290}
                      onChange={(e) =>
                        setGroundConfig((p) => ({ ...p, height: Number(e.target.value) || 290 }))
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setGroundConfig((p) => ({
                      ...p,
                      x: CANVAS_W / 2,
                      y: CANVAS_H / 2,
                      rotation: 0,
                    }));
                    toast.success("Pitch centered!");
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl border border-slate-700 text-amber-400"
                >
                  🎯 Center Pitch on Canvas
                </button>
              </div>
            )}

            {/* ── TAB 3: REFERENCE BLUEPRINT PLAN ── */}
            {activeTab === "blueprint" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-extrabold text-sky-400 tracking-wider">
                    Stadium Layout Reference Blueprint
                  </label>
                  {backgroundPlan?.url && (
                    <button
                      type="button"
                      onClick={() =>
                        setBackgroundPlan((p) => p && { ...p, isLocked: !p.isLocked })
                      }
                      className="text-xs font-bold flex items-center gap-1 text-slate-400 hover:text-white"
                    >
                      {backgroundPlan.isLocked ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-400" /> Locked
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-slate-400" /> Unlocked
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-slate-400 block">
                    Upload Plan (PNG, JPG, SVG):
                  </label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = URL.createObjectURL(file);
                      setBackgroundPlan({
                        url,
                        name: file.name,
                        x: 100,
                        y: 100,
                        width: 1400,
                        height: 1000,
                        rotation: 0,
                        opacity: 0.5,
                        isLocked: false,
                      });
                      toast.success(`Loaded reference blueprint: ${file.name}`);
                    }}
                    className="text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-sky-500 file:text-slate-950 hover:file:bg-sky-400 cursor-pointer"
                  />
                </div>

                {backgroundPlan?.url && (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Blueprint Opacity:</span>
                        <span className="font-bold text-sky-400">
                          {Math.round((backgroundPlan.opacity ?? 0.5) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.05}
                        max={1}
                        step={0.05}
                        value={backgroundPlan.opacity ?? 0.5}
                        onChange={(e) =>
                          setBackgroundPlan((p) => p && { ...p, opacity: Number(e.target.value) })
                        }
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setBackgroundPlan(undefined)}
                      className="w-full py-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold hover:bg-rose-500/20"
                    >
                      Clear Blueprint
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
