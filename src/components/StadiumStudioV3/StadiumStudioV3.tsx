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
  Grid,
  Star,
  Armchair,
  DoorOpen,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  BMSBlockDef,
  BMSTierDef,
  StadiumSeatingConfigOutputV3,
  BMSToolMode,
} from "./types";
import {
  BackgroundPlanDef,
  StadiumGroundConfigV2,
  StadiumElementDefV2,
} from "../StadiumStudioV2/types";
import BackgroundPlanLayer from "../StadiumStudioV2/BackgroundPlanLayer";
import PolygonDrawingTool from "../StadiumStudioV2/PolygonDrawingTool";
import CornerAlignPad from "../StadiumStudioV2/CornerAlignPad";
import { HistoryManager } from "../StadiumStudioV2/HistoryManager";
import BMSRevenueSummaryBar from "./BMSRevenueSummaryBar";
import BMSSeatGridPainterModal from "./BMSSeatGridPainterModal";
import BMSMiniMap from "./BMSMiniMap";
import { generateAllStadiumSeatsV3, generateBlockSeatsV3 } from "./SeatingGeneratorEngineV3";

export const CANVAS_W = 1600;
export const CANVAS_H = 1200;

interface StadiumStudioV3Props {
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
  onSave?: (output: StadiumSeatingConfigOutputV3, seatsJson: any[]) => Promise<void>;
  onClose?: () => void;
}

export default function StadiumStudioV3({
  eventId,
  ticketTypes = [],
  initialConfig,
  saving = false,
  onSave,
  onClose,
}: StadiumStudioV3Props) {
  // ── 1. CORE STUDIO STATE ──
  const [toolMode, setToolMode] = useState<BMSToolMode>("select");
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

  const [blocks, setBlocks] = useState<BMSBlockDef[]>(
    Array.isArray(initialConfig?.blocks) ? initialConfig.blocks : []
  );

  const [elements, setElements] = useState<StadiumElementDefV2[]>(
    Array.isArray(initialConfig?.elements) ? initialConfig.elements : []
  );

  const [backgroundPlan, setBackgroundPlan] = useState<BackgroundPlanDef | undefined>(
    initialConfig?.backgroundPlan
  );

  // Selection & Inspector State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPlanSelected, setIsPlanSelected] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"stands" | "elements" | "pitch" | "blueprint">("stands");
  const [blueprintArchetype, setBlueprintArchetype] = useState<"football" | "circular">("football");
  const [blueprintTiers, setBlueprintTiers] = useState<1 | 2>(2);
  const [blueprintBowlRadius, setBlueprintBowlRadius] = useState<number>(350);

  // Seat Painter Modal State
  const [painterBlockId, setPainterBlockId] = useState<string | null>(null);
  const [painterTierIdx, setPainterTierIdx] = useState<number>(0);

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
  const history = useMemo(() => new HistoryManager(35), []);

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
      setBlocks(prev.blocks as BMSBlockDef[]);
      setElements(prev.elements);
      setGroundConfig(prev.groundConfig);
      setBackgroundPlan(prev.backgroundPlan);
      toast.info("Undo performed");
    }
  }, [history, blocks, elements, groundConfig, backgroundPlan]);

  const handleRedo = useCallback(() => {
    const next = history.redo({ blocks, elements, groundConfig, backgroundPlan });
    if (next) {
      setBlocks(next.blocks as BMSBlockDef[]);
      setElements(next.elements);
      setGroundConfig(next.groundConfig);
      setBackgroundPlan(next.backgroundPlan);
      toast.info("Redo performed");
    }
  }, [history, blocks, elements, groundConfig, backgroundPlan]);

  // Keyboard Shortcuts: Ctrl+Z, Ctrl+Y, V, P, H, Delete
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
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, drawingPoints, selectedId, pushHistorySnapshot]);

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
  }, [selectedId, toolMode, blocks]);

  // Wheel Zoom
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

  // Stage Click
  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (toolMode === "draw_polygon") {
      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const transform = stage.getAbsoluteTransform().copy().invert();
      const canvasPos = transform.point(pos);
      const cx = Math.round(canvasPos.x);
      const cy = Math.round(canvasPos.y);

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

    if (e.target === e.target.getStage()) {
      setSelectedId(null);
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

  // Finish polygon stand
  const finishPolygonStand = () => {
    if (drawingPoints.length < 6) {
      toast.error("A polygon needs at least 3 points!");
      return;
    }
    pushHistorySnapshot();
    const newStandId = `poly-stand-${Date.now()}`;
    const newBlock: BMSBlockDef = {
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
      gate_info: "Gate 4 Turnstile",
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

  // Selected Block
  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedId),
    [blocks, selectedId]
  );

  // Add Preset Stand
  const addPresetStand = (shape: BMSBlockDef["shape"]) => {
    pushHistorySnapshot();
    const newId = `stand-${Date.now()}`;
    const defaultColor = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"][
      blocks.length % 5
    ];

    if (shape === "arc") {
      const newArcBlock: BMSBlockDef = {
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
        startAngle: 202.5,
        sweepAngle: 45,
        width: 670,
        height: 670,
        rotation: 0,
        capacity: 200,
        stand_type: "seated",
        gate_info: "Turnstile Gate A",
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

    const newBlock: BMSBlockDef = {
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
      gate_info: "Turnstile Gate B",
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

  // Precision CAD Auto-Mapper from Blueprint
  const handleGenerateFromBlueprint = () => {
    pushHistorySnapshot();
    const px = groundConfig.x ?? CANVAS_W / 2;
    const py = groundConfig.y ?? CANVAS_H / 2;
    const pw = groundConfig.width ?? 440;
    const ph = groundConfig.height ?? 290;

    const newBlocks: BMSBlockDef[] = [];
    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#a855f7"];

    if (blueprintArchetype === "football") {
      const sideDepth = Math.max(80, Math.round(blueprintBowlRadius * 0.28));
      const cornerInnerR = Math.max(180, Math.round(Math.hypot(pw, ph) / 2 * 0.88));
      const cornerOuterR = cornerInnerR + sideDepth + 20;

      const standDefs = [
        {
          id: `stand-north-${Date.now()}`,
          name: "North Stand (Top)",
          color: colors[0],
          shape: "rectangle" as const,
          x: Math.round(px - pw / 2),
          y: Math.round(py - ph / 2 - sideDepth - 25),
          width: pw,
          height: sideDepth,
          rotation: 0,
          gate_info: "Gate 1 & 2 (North Upper/Lower)",
        },
        {
          id: `stand-south-${Date.now()}`,
          name: "South Stand (Bottom)",
          color: colors[1],
          shape: "rectangle" as const,
          x: Math.round(px - pw / 2),
          y: Math.round(py + ph / 2 + 25),
          width: pw,
          height: sideDepth,
          rotation: 0,
          gate_info: "Gate 5 & 6 (South Pavilion)",
        },
        {
          id: `stand-west-${Date.now()}`,
          name: "West Stand (Left - VIP)",
          color: colors[2],
          shape: "rectangle" as const,
          x: Math.round(px - pw / 2 - sideDepth - 25),
          y: Math.round(py - ph / 2),
          width: sideDepth,
          height: ph,
          rotation: 0,
          gate_info: "VIP Gate 3 (West Grandstand)",
        },
        {
          id: `stand-east-${Date.now()}`,
          name: "East Stand (Right)",
          color: colors[3],
          shape: "rectangle" as const,
          x: Math.round(px + pw / 2 + 25),
          y: Math.round(py - ph / 2),
          width: sideDepth,
          height: ph,
          rotation: 0,
          gate_info: "Gate 7 & 8 (East Concourse)",
        },
      ];

      const cornerDefs = [
        {
          id: `corner-nw-${Date.now()}`,
          name: "NW Corner Stand",
          color: colors[4],
          shape: "arc" as const,
          startAngle: 203,
          sweepAngle: 43,
          gate_info: "Gate 2B (NW Ramp)",
        },
        {
          id: `corner-ne-${Date.now()}`,
          name: "NE Corner Stand",
          color: colors[5],
          shape: "arc" as const,
          startAngle: 293,
          sweepAngle: 43,
          gate_info: "Gate 1B (NE Ramp)",
        },
        {
          id: `corner-se-${Date.now()}`,
          name: "SE Corner Stand",
          color: colors[6],
          shape: "arc" as const,
          startAngle: 23,
          sweepAngle: 43,
          gate_info: "Gate 6B (SE Ramp)",
        },
        {
          id: `corner-sw-${Date.now()}`,
          name: "SW Corner Stand",
          color: colors[7],
          shape: "arc" as const,
          startAngle: 113,
          sweepAngle: 43,
          gate_info: "Gate 5B (SW Ramp)",
        },
      ];

      standDefs.forEach((s) => {
        newBlocks.push({
          ...s,
          capacity: blueprintTiers === 2 ? 400 : 250,
          stand_type: "seated",
          tiers: blueprintTiers === 2 ? [
            {
              id: `t1-${s.id}`,
              name: "Lower Tier",
              color: s.color,
              ticket_type_id: ticketTypes[0]?.id || "",
              row_start: "A",
              row_end: "J",
              seats_per_row: 20,
              bestseller_seats: ["A-10", "A-11", "B-10", "B-11"],
              aisle_positions: [10],
            },
            {
              id: `t2-${s.id}`,
              name: "Upper Tier",
              color: "#38bdf8",
              ticket_type_id: ticketTypes[1]?.id || ticketTypes[0]?.id || "",
              row_start: "K",
              row_end: "T",
              seats_per_row: 20,
              aisle_positions: [10],
            },
          ] : [
            {
              id: `t1-${s.id}`,
              name: "Main Tier",
              color: s.color,
              ticket_type_id: ticketTypes[0]?.id || "",
              row_start: "A",
              row_end: "N",
              seats_per_row: 25,
              bestseller_seats: ["A-12", "A-13", "B-12", "B-13"],
              aisle_positions: [12],
            },
          ],
        });
      });

      cornerDefs.forEach((c) => {
        newBlocks.push({
          ...c,
          x: px,
          y: py,
          stadiumCenterX: px,
          stadiumCenterY: py,
          innerRadius: cornerInnerR,
          outerRadius: cornerOuterR,
          width: cornerOuterR * 2,
          height: cornerOuterR * 2,
          rotation: 0,
          capacity: blueprintTiers === 2 ? 300 : 180,
          stand_type: "seated",
          tiers: blueprintTiers === 2 ? [
            {
              id: `t1-${c.id}`,
              name: "Lower Tier",
              color: c.color,
              ticket_type_id: ticketTypes[0]?.id || "",
              row_start: "A",
              row_end: "H",
              seats_per_row: 18,
            },
            {
              id: `t2-${c.id}`,
              name: "Upper Tier",
              color: "#c084fc",
              ticket_type_id: ticketTypes[1]?.id || ticketTypes[0]?.id || "",
              row_start: "J",
              row_end: "R",
              seats_per_row: 18,
            },
          ] : [
            {
              id: `t1-${c.id}`,
              name: "Main Tier",
              color: c.color,
              ticket_type_id: ticketTypes[0]?.id || "",
              row_start: "A",
              row_end: "M",
              seats_per_row: 18,
            },
          ],
        });
      });
    } else {
      const bowlInnerR = Math.max(160, Math.round(Math.min(pw, ph) * 0.75));
      const bowlOuterR = bowlInnerR + Math.round(blueprintBowlRadius * 0.38);

      const sectors = [
        { name: "North Stand", deg: 248.5, color: colors[0], gate: "Gate 1 (North Turnstile)" },
        { name: "NE Corner", deg: 293.5, color: colors[1], gate: "Gate 2 (NE Concourse)" },
        { name: "East Stand", deg: 338.5, color: colors[2], gate: "Gate 3 (East Gate)" },
        { name: "SE Corner", deg: 23.5, color: colors[3], gate: "Gate 4 (SE Concourse)" },
        { name: "South Stand", deg: 68.5, color: colors[4], gate: "Gate 5 (South Pavilion)" },
        { name: "SW Corner", deg: 113.5, color: colors[5], gate: "Gate 6 (SW Concourse)" },
        { name: "West Stand", deg: 158.5, color: colors[6], gate: "Gate 7 (West VIP)" },
        { name: "NW Corner", deg: 203.5, color: colors[7], gate: "Gate 8 (NW Concourse)" },
      ];

      sectors.forEach((sec, idx) => {
        const secId = `sec-arc-${idx}-${Date.now()}`;
        newBlocks.push({
          id: secId,
          name: sec.name,
          color: sec.color,
          shape: "arc",
          x: px,
          y: py,
          stadiumCenterX: px,
          stadiumCenterY: py,
          innerRadius: bowlInnerR,
          outerRadius: bowlOuterR,
          startAngle: sec.deg,
          sweepAngle: 43,
          width: bowlOuterR * 2,
          height: bowlOuterR * 2,
          rotation: 0,
          capacity: blueprintTiers === 2 ? 350 : 200,
          stand_type: "seated",
          gate_info: sec.gate,
          tiers: blueprintTiers === 2 ? [
            {
              id: `t1-${secId}`,
              name: "Lower Tier",
              color: sec.color,
              ticket_type_id: ticketTypes[0]?.id || "",
              row_start: "A",
              row_end: "J",
              seats_per_row: 20,
              bestseller_seats: ["A-10", "B-10"],
            },
            {
              id: `t2-${secId}`,
              name: "Upper Tier",
              color: "#38bdf8",
              ticket_type_id: ticketTypes[1]?.id || ticketTypes[0]?.id || "",
              row_start: "K",
              row_end: "T",
              seats_per_row: 20,
            },
          ] : [
            {
              id: `t1-${secId}`,
              name: "Main Tier",
              color: sec.color,
              ticket_type_id: ticketTypes[0]?.id || "",
              row_start: "A",
              row_end: "M",
              seats_per_row: 20,
            },
          ],
        });
      });
    }

    setBlocks(newBlocks);
    setActiveTab("stands");
    toast.success(`BookMyShow CAD Auto-Mapper: Created ${newBlocks.length} symmetrical stadium sections!`);
  };

  // Save Layout
  const handleSaveLayout = async () => {
    if (!onSave) return;
    const generatedSeats = generateAllStadiumSeatsV3(blocks, CANVAS_W, CANVAS_H);

    const gateAssignments: Record<string, string> = {};
    let totalCap = 0;
    let totalValuation = 0;

    blocks.forEach((b) => {
      if (b.gate_info) gateAssignments[b.id] = b.gate_info;
      const bSeats = generateBlockSeatsV3(b, CANVAS_W, CANVAS_H);
      totalCap += b.stand_type === "standing" ? b.capacity : bSeats.length;

      const matchedTt = ticketTypes.find((t) => t.id === b.ticket_type_id);
      const pr = b.price || matchedTt?.price || 0;
      totalValuation += bSeats.length * pr;
    });

    const payload: StadiumSeatingConfigOutputV3 = {
      layout_mode: "stadium",
      studio_version: "3.0-bms",
      canvasWidth: CANVAS_W,
      canvasHeight: CANVAS_H,
      stadium_name: stadiumName,
      groundConfig,
      blocks,
      elements,
      backgroundPlan,
      bms_metadata: {
        total_gross_capacity: totalCap,
        estimated_gross_value: totalValuation,
        gate_assignments: gateAssignments,
      },
    };

    try {
      await onSave(payload, generatedSeats);
      toast.success(`BookMyShow V3 layout published with ${generatedSeats.length} seats!`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save layout.");
    }
  };

  const painterBlock = useMemo(
    () => blocks.find((b) => b.id === painterBlockId),
    [blocks, painterBlockId]
  );

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-white select-none overflow-hidden font-sans">
      {/* ── TOP STUDIO TOOLBAR ── */}
      <header className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 z-20">
        {/* Left: Branding & Stadium Name */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 px-3 py-1 rounded-xl text-white font-black text-xs tracking-wider shadow-md">
            <span>🎟️</span>
            <span>PRO STUDIO V3</span>
            <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-amber-200">BMS</span>
          </div>

          <input
            type="text"
            value={stadiumName}
            onChange={(e) => setStadiumName(e.target.value)}
            className="bg-slate-800/80 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-100 focus:outline-none focus:border-red-500 w-56 truncate"
            placeholder="Stadium Name"
          />
        </div>

        {/* Center: Tools (Select, Draw Polygon, Seat Painter, Pan) & History */}
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
            onClick={() => {
              if (selectedBlock) {
                setPainterBlockId(selectedBlock.id);
                setPainterTierIdx(0);
              } else if (blocks.length > 0) {
                setPainterBlockId(blocks[0].id);
                setPainterTierIdx(0);
              } else {
                toast.warning("Please select or add a stand first to paint its seat matrix!");
              }
            }}
            className="p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-all"
            title="Inspect & Paint BMS Seat Grid"
          >
            <Grid className="w-4 h-4 text-amber-400" />
            <span className="text-[11px]">Paint Seats</span>
          </button>

          <button
            type="button"
            onClick={() => setToolMode("pan")}
            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              toolMode === "pan"
                ? "bg-sky-500 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
            title="Pan / Drag Canvas (H)"
          >
            <Hand className="w-4 h-4" />
            <span className="text-[11px]">Pan</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Undo / Redo */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={!history.canUndo()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!history.canRedo()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Zoom & Save Action */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                const s = stageRef.current;
                if (!s) return;
                const newS = Math.min(zoomScale * 1.2, 3.5);
                setZoomScale(newS);
                s.scale({ x: newS, y: newS });
                s.batchDraw();
              }}
              className="p-1.5 rounded text-slate-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono font-bold text-slate-400 w-9 text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => {
                const s = stageRef.current;
                if (!s) return;
                const newS = Math.max(zoomScale / 1.2, 0.15);
                setZoomScale(newS);
                s.scale({ x: newS, y: newS });
                s.batchDraw();
              }}
              className="p-1.5 rounded text-slate-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={resetToFitView}
              className="p-1.5 rounded text-slate-400 hover:text-white"
              title="Fit to Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveLayout}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Publishing BMS V3...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Publish Layout</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── BMS REVENUE & COMMERCIAL SUMMARY BAR ── */}
      <BMSRevenueSummaryBar blocks={blocks} ticketTypes={ticketTypes} />

      {/* ── MAIN WORKSPACE ── */}
      <div className="flex-1 flex min-h-0 relative">
        {/* CANVAS CONTAINER */}
        <div
          ref={containerRef}
          className="flex-1 h-full bg-[#070b12] relative overflow-hidden cursor-default"
        >
          {/* KONVA CANVAS STAGE */}
          <Stage
            ref={stageRef}
            width={stageDimensions.width}
            height={stageDimensions.height}
            draggable={toolMode === "pan"}
            onWheel={handleWheel}
            onClick={handleStageClick}
            onTap={handleStageClick}
            onMouseMove={handleStageMouseMove}
          >
            {/* 1. BACKGROUND BLUEPRINT CAD LAYER */}
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

            {/* 2. CENTRAL GROUND / PITCH LAYER */}
            <Layer>
              <Group
                id="ground-pitch"
                x={groundConfig.x ?? CANVAS_W / 2}
                y={groundConfig.y ?? CANVAS_H / 2}
                rotation={groundConfig.rotation ?? 0}
                draggable={toolMode === "select"}
                onClick={() => {
                  if (toolMode === "select") {
                    setSelectedId("ground-pitch");
                    setIsPlanSelected(false);
                    setActiveTab("pitch");
                  }
                }}
                onDragEnd={(e) => {
                  pushHistorySnapshot();
                  setGroundConfig((prev) => ({
                    ...prev,
                    x: Math.round(e.target.x()),
                    y: Math.round(e.target.y()),
                  }));
                }}
              >
                {/* Athletic Track or outer perimeter */}
                {groundConfig.track_color && (
                  <Rect
                    x={-(groundConfig.width ?? 440) / 2 - 25}
                    y={-(groundConfig.height ?? 290) / 2 - 25}
                    width={(groundConfig.width ?? 440) + 50}
                    height={(groundConfig.height ?? 290) + 50}
                    cornerRadius={groundConfig.shape === "oval" ? 150 : 25}
                    fill={groundConfig.track_color}
                    opacity={0.85}
                  />
                )}

                {/* Main Pitch Turf */}
                {groundConfig.shape === "oval" ? (
                  <Ellipse
                    radiusX={(groundConfig.width ?? 440) / 2}
                    radiusY={(groundConfig.height ?? 290) / 2}
                    fill={groundConfig.turf_color || "#166534"}
                    stroke="#ffffff"
                    strokeWidth={2}
                    dash={[6, 4]}
                  />
                ) : (
                  <Rect
                    x={-(groundConfig.width ?? 440) / 2}
                    y={-(groundConfig.height ?? 290) / 2}
                    width={groundConfig.width ?? 440}
                    height={groundConfig.height ?? 290}
                    cornerRadius={8}
                    fill={groundConfig.turf_color || "#166534"}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                )}

                {/* Pitch Label */}
                <Text
                  text={groundConfig.pitch_label || "CENTRAL PITCH"}
                  fontSize={14}
                  fontStyle="bold"
                  fill="#ffffff"
                  align="center"
                  verticalAlign="middle"
                  width={groundConfig.width ?? 440}
                  offsetX={(groundConfig.width ?? 440) / 2}
                  offsetY={7}
                  opacity={0.8}
                />
              </Group>
            </Layer>

            {/* 3. STADIUM STANDS / SECTIONS LAYER */}
            <Layer>
              {blocks.map((block) => {
                const isSelected = selectedId === block.id;
                const isArc = block.shape === "arc";
                const isPolygon = block.shape === "polygon" && Array.isArray(block.points);

                if (isArc) {
                  const sCenterX = block.stadiumCenterX != null ? Number(block.stadiumCenterX) : CANVAS_W / 2;
                  const sCenterY = block.stadiumCenterY != null ? Number(block.stadiumCenterY) : CANVAS_H / 2;
                  const innerR = Number(block.innerRadius) || 200;
                  const outerR = Number(block.outerRadius) || 350;
                  const startA = Number(block.startAngle) || 0;
                  const sweepA = Number(block.sweepAngle) || 45;

                  return (
                    <Group
                      key={block.id}
                      id={block.id}
                      x={sCenterX}
                      y={sCenterY}
                      onClick={() => {
                        if (toolMode === "select") {
                          setSelectedId(block.id);
                          setIsPlanSelected(false);
                          setActiveTab("stands");
                        }
                      }}
                      onTap={() => {
                        if (toolMode === "select") {
                          setSelectedId(block.id);
                          setIsPlanSelected(false);
                          setActiveTab("stands");
                        }
                      }}
                    >
                      <Arc
                        innerRadius={innerR}
                        outerRadius={outerR}
                        angle={sweepA}
                        rotation={startA}
                        fill={block.color}
                        stroke={isSelected ? "#f59e0b" : "#ffffff"}
                        strokeWidth={isSelected ? 4 : 1.5}
                        opacity={0.85}
                      />
                      {/* Stand Label */}
                      <Text
                        text={block.name}
                        x={
                          (innerR + (outerR - innerR) / 2) *
                          Math.cos(((startA + sweepA / 2) * Math.PI) / 180) - 40
                        }
                        y={
                          (innerR + (outerR - innerR) / 2) *
                          Math.sin(((startA + sweepA / 2) * Math.PI) / 180) - 8
                        }
                        fontSize={11}
                        fontStyle="bold"
                        fill="#ffffff"
                        width={80}
                        align="center"
                      />
                    </Group>
                  );
                }

                if (isPolygon && block.points) {
                  return (
                    <Group
                      key={block.id}
                      id={block.id}
                      onClick={() => {
                        if (toolMode === "select") {
                          setSelectedId(block.id);
                          setIsPlanSelected(false);
                          setActiveTab("stands");
                        }
                      }}
                      onTap={() => {
                        if (toolMode === "select") {
                          setSelectedId(block.id);
                          setIsPlanSelected(false);
                          setActiveTab("stands");
                        }
                      }}
                    >
                      <Line
                        points={block.points}
                        closed
                        fill={block.color}
                        stroke={isSelected ? "#f59e0b" : "#ffffff"}
                        strokeWidth={isSelected ? 3.5 : 1.5}
                        opacity={0.85}
                      />
                      <Text
                        text={block.name}
                        x={block.points[0]}
                        y={block.points[1]}
                        fontSize={11}
                        fontStyle="bold"
                        fill="#ffffff"
                      />
                    </Group>
                  );
                }

                // Default Rectangular/Pill Stand
                return (
                  <Group
                    key={block.id}
                    id={block.id}
                    ref={(node) => {
                      if (isSelected) selectedNodeRef.current = node;
                    }}
                    x={block.x}
                    y={block.y}
                    width={block.width}
                    height={block.height}
                    rotation={block.rotation || 0}
                    draggable={toolMode === "select"}
                    onClick={() => {
                      if (toolMode === "select") {
                        setSelectedId(block.id);
                        setIsPlanSelected(false);
                        setActiveTab("stands");
                      }
                    }}
                    onTap={() => {
                      if (toolMode === "select") {
                        setSelectedId(block.id);
                        setIsPlanSelected(false);
                        setActiveTab("stands");
                      }
                    }}
                    onDragEnd={(e) => {
                      pushHistorySnapshot();
                      const nx = Math.round(e.target.x());
                      const ny = Math.round(e.target.y());
                      setBlocks((prev) =>
                        prev.map((b) => (b.id === block.id ? { ...b, x: nx, y: ny } : b))
                      );
                    }}
                    onTransformEnd={(e) => {
                      pushHistorySnapshot();
                      const node = e.target;
                      const scaleX = node.scaleX();
                      const scaleY = node.scaleY();
                      node.scaleX(1);
                      node.scaleY(1);

                      const nw = Math.max(40, Math.round(node.width() * scaleX));
                      const nh = Math.max(30, Math.round(node.height() * scaleY));
                      const nx = Math.round(node.x());
                      const ny = Math.round(node.y());
                      const nr = Math.round(node.rotation());

                      setBlocks((prev) =>
                        prev.map((b) =>
                          b.id === block.id
                            ? { ...b, x: nx, y: ny, width: nw, height: nh, rotation: nr }
                            : b
                        )
                      );
                    }}
                  >
                    <Rect
                      width={block.width}
                      height={block.height}
                      cornerRadius={block.shape === "pill" ? block.height / 2 : 6}
                      fill={block.color}
                      stroke={isSelected ? "#f59e0b" : "#ffffff"}
                      strokeWidth={isSelected ? 3 : 1.5}
                      opacity={0.88}
                      shadowColor="#000000"
                      shadowBlur={8}
                      shadowOpacity={0.4}
                    />

                    {/* Stand Header / Capacity */}
                    <Text
                      text={block.name}
                      fontSize={11}
                      fontStyle="bold"
                      fill="#ffffff"
                      x={6}
                      y={6}
                      width={block.width - 12}
                      ellipsis
                    />

                    {/* Gate badge */}
                    {block.gate_info && (
                      <Text
                        text={`🚪 ${block.gate_info}`}
                        fontSize={9}
                        fontStyle="bold"
                        fill="#e2e8f0"
                        x={6}
                        y={block.height - 18}
                        width={block.width - 12}
                        ellipsis
                      />
                    )}
                  </Group>
                );
              })}

              {/* Konva Transformer for Selection */}
              <Transformer
                ref={trRef}
                boundBoxFunc={(oldBox, newBox) => {
                  if (newBox.width < 30 || newBox.height < 20) return oldBox;
                  return newBox;
                }}
              />
            </Layer>

            {/* 4. POLYGON DRAWING TOOL IN PROGRESS */}
            <PolygonDrawingTool
              points={drawingPoints}
              cursorPos={cursorPos}
              onClosePolygon={finishPolygonStand}
            />
          </Stage>

          {/* BOTTOM-LEFT RADAR MINI-MAP */}
          <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2">
            <BMSMiniMap
              blocks={blocks}
              groundConfig={groundConfig}
              canvasW={CANVAS_W}
              canvasH={CANVAS_H}
              onNavigate={(targetX, targetY) => {
                if (!stageRef.current) return;
                const w = stageDimensions.width;
                const h = stageDimensions.height;
                const fitX = w / 2 - targetX * zoomScale;
                const fitY = h / 2 - targetY * zoomScale;
                stageRef.current.to({
                  x: fitX,
                  y: fitY,
                  duration: 0.3,
                  easing: Konva.Easings.EaseInOut,
                });
              }}
            />
          </div>
        </div>

        {/* RIGHT SIDEBAR / INSPECTOR PANEL */}
        <aside className="w-80 h-full bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 z-10">
          {/* TABS HEADER */}
          <div className="flex items-center border-b border-slate-800 bg-slate-950/60 text-xs font-bold text-slate-400">
            <button
              type="button"
              onClick={() => setActiveTab("stands")}
              className={`flex-1 py-2.5 text-center transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === "stands"
                  ? "border-red-500 text-white bg-slate-900"
                  : "border-transparent hover:text-slate-200"
              }`}
            >
              <Armchair className="w-3.5 h-3.5 text-red-400" />
              <span>Stands</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("blueprint")}
              className={`flex-1 py-2.5 text-center transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === "blueprint"
                  ? "border-red-500 text-white bg-slate-900"
                  : "border-transparent hover:text-slate-200"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
              <span>Blueprint</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pitch")}
              className={`flex-1 py-2.5 text-center transition-all border-b-2 flex items-center justify-center gap-1.5 ${
                activeTab === "pitch"
                  ? "border-red-500 text-white bg-slate-900"
                  : "border-transparent hover:text-slate-200"
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pitch</span>
            </button>
          </div>

          {/* TAB CONTENTS */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-slate-300">
            {/* ── TAB: STANDS ── */}
            {activeTab === "stands" && (
              <div className="space-y-4">
                {/* Stand Presets / Quick Add */}
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Add Stand Presets</span>
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => addPresetStand("rectangle")}
                      className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-center font-bold text-[11px] border border-slate-700/60"
                    >
                      Rectangle
                    </button>
                    <button
                      type="button"
                      onClick={() => addPresetStand("pill")}
                      className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-center font-bold text-[11px] border border-slate-700/60"
                    >
                      Pill
                    </button>
                    <button
                      type="button"
                      onClick={() => addPresetStand("arc")}
                      className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-center font-bold text-[11px] border border-slate-700/60"
                    >
                      Ring Arc
                    </button>
                  </div>
                </div>

                {/* Selected Stand Inspector */}
                {selectedBlock ? (
                  <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
                        <Armchair className="w-4 h-4 text-red-400" />
                        <span>{selectedBlock.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          pushHistorySnapshot();
                          setBlocks((p) => p.filter((b) => b.id !== selectedBlock.id));
                          setSelectedId(null);
                          toast.info("Stand deleted");
                        }}
                        className="text-slate-400 hover:text-red-400 p-1"
                        title="Delete Stand"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Paint Seats Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setPainterBlockId(selectedBlock.id);
                        setPainterTierIdx(0);
                      }}
                      className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-lg text-xs flex items-center justify-center gap-2 shadow-md"
                    >
                      <Grid className="w-4 h-4" />
                      <span>Inspect / Paint BMS Seat Grid</span>
                    </button>

                    {/* Stand Name & Color */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">Name</label>
                        <input
                          type="text"
                          value={selectedBlock.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBlocks((p) =>
                              p.map((b) => (b.id === selectedBlock.id ? { ...b, name: val } : b))
                            );
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">Color</label>
                        <input
                          type="color"
                          value={selectedBlock.color}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBlocks((p) =>
                              p.map((b) => (b.id === selectedBlock.id ? { ...b, color: val } : b))
                            );
                          }}
                          className="w-full h-7 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 mt-1 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* BMS Gate / Ingress Info */}
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <DoorOpen className="w-3 h-3 text-sky-400" />
                        <span>Ingress Gate / Turnstile</span>
                      </label>
                      <input
                        type="text"
                        value={selectedBlock.gate_info || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBlocks((p) =>
                            p.map((b) => (b.id === selectedBlock.id ? { ...b, gate_info: val } : b))
                          );
                        }}
                        placeholder="e.g. Gate 3 & 4 Turnstile"
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1 text-xs"
                      />
                    </div>

                    {/* Rotation & Position */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">Rotation</label>
                        <input
                          type="number"
                          value={selectedBlock.rotation || 0}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setBlocks((p) =>
                              p.map((b) => (b.id === selectedBlock.id ? { ...b, rotation: val } : b))
                            );
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400">Stand Type</label>
                        <select
                          value={selectedBlock.stand_type || "seated"}
                          onChange={(e) => {
                            const val = e.target.value as "seated" | "standing";
                            setBlocks((p) =>
                              p.map((b) => (b.id === selectedBlock.id ? { ...b, stand_type: val } : b))
                            );
                          }}
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1 text-xs"
                        >
                          <option value="seated">Seated (Grid)</option>
                          <option value="standing">General Admission (Standing)</option>
                        </select>
                      </div>
                    </div>

                    {/* 4-Corner Alignment Pad for fine nudging */}
                    <CornerAlignPad
                      block={selectedBlock as any}
                      groundConfig={groundConfig}
                      onUpdateBlock={(updated) => {
                        pushHistorySnapshot();
                        setBlocks((p) =>
                          p.map((b) => (b.id === selectedBlock.id ? { ...b, ...updated } : b))
                        );
                      }}
                    />
                  </div>
                ) : (
                  <div className="bg-slate-950/40 border border-dashed border-slate-800 p-6 rounded-xl text-center text-slate-500">
                    <Armchair className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-xs font-medium">No stand selected</p>
                    <p className="text-[10px] text-slate-600 mt-1">
                      Click any stand on the canvas or pick a preset above
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: BLUEPRINT / CAD ── */}
            {activeTab === "blueprint" && (
              <div className="space-y-4">
                {/* Upload Blueprint */}
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Blueprint Plan</span>
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const url = event.target?.result as string;
                        pushHistorySnapshot();
                        setBackgroundPlan({
                          url,
                          x: CANVAS_W / 2 - 400,
                          y: CANVAS_H / 2 - 300,
                          width: 800,
                          height: 600,
                          opacity: 0.5,
                          rotation: 0,
                          isLocked: false,
                        });
                        toast.success("Blueprint image loaded!");
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="w-full text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                  />

                  {backgroundPlan && (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Opacity</span>
                          <span>{Math.round((backgroundPlan.opacity || 0.5) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.05"
                          max="1"
                          step="0.05"
                          value={backgroundPlan.opacity || 0.5}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setBackgroundPlan((p) => (p ? { ...p, opacity: val } : undefined));
                          }}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setBackgroundPlan((p) =>
                              p ? { ...p, isLocked: !p.isLocked } : undefined
                            );
                          }}
                          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                        >
                          {backgroundPlan.isLocked ? (
                            <>
                              <Lock className="w-3.5 h-3.5 text-amber-400" />
                              <span>Locked</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3.5 h-3.5 text-slate-400" />
                              <span>Unlocked</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            pushHistorySnapshot();
                            setBackgroundPlan(undefined);
                            toast.info("Blueprint plan removed.");
                          }}
                          className="text-red-400 hover:text-red-300 text-[11px]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* CAD Symmetrical Precision Auto-Mapper */}
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                  <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>BMS Auto-Map Sections</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Instantly project 100% symmetrical stands matching your blueprint dimensions and central pitch.
                  </p>

                  <div className="space-y-2">
                    <label className="text-[10px] font-semibold text-slate-400">Layout Archetype</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBlueprintArchetype("football")}
                        className={`p-2 rounded-lg font-bold text-[11px] border transition-all text-center ${
                          blueprintArchetype === "football"
                            ? "bg-amber-500/20 border-amber-500 text-amber-300"
                            : "bg-slate-800/60 border-slate-700 text-slate-400"
                        }`}
                      >
                        ⚽ 4 Sides + 4 Corners
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlueprintArchetype("circular")}
                        className={`p-2 rounded-lg font-bold text-[11px] border transition-all text-center ${
                          blueprintArchetype === "circular"
                            ? "bg-amber-500/20 border-amber-500 text-amber-300"
                            : "bg-slate-800/60 border-slate-700 text-slate-400"
                        }`}
                      >
                        ⭕ 360° Oval Bowl
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400">Tiers</label>
                      <select
                        value={blueprintTiers}
                        onChange={(e) => setBlueprintTiers(Number(e.target.value) as 1 | 2)}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1 text-xs"
                      >
                        <option value={1}>1 Tier (Main)</option>
                        <option value={2}>2 Tiers (Lower & Upper)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400">Radius</label>
                      <input
                        type="number"
                        value={blueprintBowlRadius}
                        onChange={(e) => setBlueprintBowlRadius(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1 text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateFromBlueprint}
                    className="w-full py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-lg text-xs shadow-md"
                  >
                    Generate Symmetrical Layout
                  </button>
                </div>
              </div>
            )}

            {/* ── TAB: PITCH ── */}
            {activeTab === "pitch" && (
              <div className="space-y-4">
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Central Turf / Pitch</span>
                    <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-400">Pitch Label</label>
                    <input
                      type="text"
                      value={groundConfig.pitch_label || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGroundConfig((p) => ({ ...p, pitch_label: val }));
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400">Shape</label>
                      <select
                        value={groundConfig.shape || "rectangle"}
                        onChange={(e) => {
                          const val = e.target.value as "rectangle" | "oval";
                          setGroundConfig((p) => ({ ...p, shape: val }));
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1 text-xs"
                      >
                        <option value="rectangle">Rectangle (Soccer/Rugby)</option>
                        <option value="oval">Oval (Cricket/AFL)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400">Turf Color</label>
                      <input
                        type="color"
                        value={groundConfig.turf_color || "#166534"}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGroundConfig((p) => ({ ...p, turf_color: val }));
                        }}
                        className="w-full h-7 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 mt-1 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400">Width</label>
                      <input
                        type="number"
                        value={groundConfig.width || 440}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setGroundConfig((p) => ({ ...p, width: val }));
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400">Height</label>
                      <input
                        type="number"
                        value={groundConfig.height || 290}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setGroundConfig((p) => ({ ...p, height: val }));
                        }}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 mt-1 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── BMS DEEP SEAT GRID PAINTER MODAL ── */}
      {painterBlock && (
        <BMSSeatGridPainterModal
          isOpen={Boolean(painterBlockId)}
          onClose={() => setPainterBlockId(null)}
          block={painterBlock}
          tierIndex={painterTierIdx}
          ticketTypes={ticketTypes}
          onSaveTier={(updatedTier) => {
            pushHistorySnapshot();
            setBlocks((prev) =>
              prev.map((b) => {
                if (b.id !== painterBlock.id) return b;
                const newTiers = [...b.tiers];
                newTiers[painterTierIdx] = updatedTier;
                return { ...b, tiers: newTiers };
              })
            );
            toast.success("BMS Tier seat modifications saved!");
          }}
        />
      )}
    </div>
  );
}
