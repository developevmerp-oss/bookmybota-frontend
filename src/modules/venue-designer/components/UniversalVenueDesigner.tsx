"use client";

import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Stage, Layer, Rect, Circle, Line, Text, Group, Shape } from "react-konva";
import Konva from "konva";
import { toast } from "sonner";
import {
  Compass,
  Layers,
  DoorOpen,
  Users,
  Sliders,
  Plus,
  Trash2,
  Copy,
  Save,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  DollarSign,
  Grid,
  CheckCircle2,
  Sparkles,
  Eye,
  AlertTriangle,
  FolderOpen,
  Wand2,
  ShieldCheck,
  Tag,
  CircleDot,
  Square,
  HelpCircle,
  Menu,
  Shapes,
  Armchair,
  BookmarkPlus,
  FilePlus2,
  X,
} from "lucide-react";
import {
  VenueType,
  ObjectType,
  UniversalVenueObject,
  UniversalVenueLayout,
  LayoutCategory,
  LayoutStandardTemplate,
  LAYOUT_CATEGORIES,
  RowConfig,
  SeatOverride,
  SeatType,
  UniversalSeat,
  ShapePreset,
} from "../types";
import { UNIVERSAL_TEMPLATES } from "../templates/universalTemplates";
import {
  generateSeatsForObject,
  computeLayoutCapacity,
  validateLayout,
  buildRows,
  gridStandSize,
  layoutBounds,
  resolveRows,
} from "../utils/geometryEngine";
import {
  BASIC_SHAPES,
  DEFAULT_SEAT_TYPES,
  ELEMENT_PRESETS,
  ICON_PRESETS,
  type IconPreset,
  categoryForVenueType,
  venueTypeForCategory,
} from "../utils/presets";
import RowsEditor from "./RowsEditor";
import SeatTypesPanel from "./SeatTypesPanel";
import SeatEditorPanel from "./SeatEditorPanel";
import SaveTemplateModal from "./SaveTemplateModal";
import { RowLabelGutter, ShapeNode, StandHeading, StandSeats, TextNode, standPriceLabel, tint } from "./CanvasElements";
import DraftNumberInput from "./DraftNumberInput";
import { BlockLayer, PolygonDrawOverlay, PolygonShapesLayer, SeatBoxOverlay, isPolygonShape } from "./BlockNodes";
import SeatPicker from "./SeatPicker";
import BlockInspector from "./BlockInspector";
import { BLOCK_PRESETS, GROUND_PRESETS, polyBounds, recentre, rotatePoints, type BlockPreset, type GroundPreset } from "../utils/blockGeometry";
import { measureText } from "../utils/textMeasure";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import TemplatePickerModal from "./TemplatePickerModal";
import TextPromptLayoutModal from "./TextPromptLayoutModal";
import CustomerPreviewModal from "./CustomerPreviewModal";
import {
  saveDraftLayoutApi,
  publishLayoutApi,
  listStandardTemplatesApi,
  saveStandardTemplateApi,
  updateStandardTemplateApi,
  deleteStandardTemplateApi,
} from "../services/venueDesignerApi";

export const CANVAS_W = 1600;
export const CANVAS_H = 1200;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

interface UniversalVenueDesignerProps {
  initialLayout?: UniversalVenueLayout;
  onSave?: (layout: UniversalVenueLayout) => Promise<void> | void;
}

export default function UniversalVenueDesigner({
  initialLayout,
  onSave,
}: UniversalVenueDesignerProps) {
  // ── 1. CORE LAYOUT STATE ──
  const [layoutId, setLayoutId] = useState<string>(
    initialLayout?.id || `layout_${Date.now()}`
  );
  const [layoutName, setLayoutName] = useState<string>(
    initialLayout?.name || "Untitled layout"
  );
  const [venueType, setVenueType] = useState<VenueType>(
    initialLayout?.venueType || "custom"
  );
  const [layoutVersion, setLayoutVersion] = useState<number>(
    initialLayout?.version || 1
  );
  const [layoutStatus, setLayoutStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">(
    initialLayout?.status || "DRAFT"
  );

  // Seat types (name, colour, price) shared by every row of this layout
  const [seatTypes, setSeatTypes] = useState<SeatType[]>(
    initialLayout?.seatTypes && initialLayout.seatTypes.length > 0
      ? initialLayout.seatTypes
      : DEFAULT_SEAT_TYPES
  );
  const [category, setCategory] = useState<LayoutCategory>(
    initialLayout?.category || categoryForVenueType(initialLayout?.venueType || "custom")
  );

  // Objects list (stands, stages, tables, gates)
  const [objects, setObjects] = useState<UniversalVenueObject[]>(
    initialLayout?.objects || []
  );


  // Selection & UI Modes
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    objects[0]?.id || null
  );
  const [toolMode, setToolMode] = useState<"select" | "pan">("select");
  // Stadium blocks: which stand is shown, the block zoomed in on, and the polygon being drawn
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const [boxSelect, setBoxSelect] = useState(false);
  const [drawing, setDrawing] = useState<{ kind: "block" | "ground"; points: number[] } | null>(null);
  const [gridSnap, setGridSnap] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(20);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modals
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isTextPromptModalOpen, setIsTextPromptModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isSaveTemplateOpen, setIsSaveTemplateOpen] = useState(false);
  const [isBlankConfirmOpen, setIsBlankConfirmOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<LayoutStandardTemplate[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"properties" | "seatTypes" | "spacing">("properties");
  // Seats picked on the canvas, for editing one by one
  const [seatSel, setSeatSel] = useState<{ objId: string; keys: string[] } | null>(null);

  // Canvas Stage controls
  const stageRef = useRef<Konva.Stage>(null);
  const canvasBoxRef = useRef<HTMLDivElement>(null);
  const deleteSelectedRef = useRef<() => void>(() => {});
  /** Id of a text just added, so its words box is focused for typing */
  const focusTextRef = useRef<string | null>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 900, h: 600 });
  const [scale, setScale] = useState<number>(0.85);
  const [stagePos, setStagePos] = useState<{ x: number; y: number }>({ x: 60, y: 30 });

  // Undo / redo: `past` holds the states before each change, `future` the ones that were undone
  const [past, setPast] = useState<UniversalVenueObject[][]>([]);
  const [future, setFuture] = useState<UniversalVenueObject[][]>([]);

  /** Call right before changing `objects`, so the change can be undone */
  const pushHistorySnapshot = useCallback(() => {
    const clone = JSON.parse(JSON.stringify(objects));
    setPast((prev) => [...prev.slice(-99), clone]);
    setFuture([]);
  }, [objects]);

  const handleUndo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [...prev, JSON.parse(JSON.stringify(objects))]);
    setObjects(JSON.parse(JSON.stringify(previous)));
    toast.info("Undo change");
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setFuture((prev) => prev.slice(0, -1));
    setPast((prev) => [...prev, JSON.parse(JSON.stringify(objects))]);
    setObjects(JSON.parse(JSON.stringify(next)));
    toast.info("Redo change");
  };

  // Zoom controls
  /** Zoom around the middle of the visible canvas, so what you are looking at stays in view */
  const zoomBy = (factor: number) => {
    const next = Math.max(0.2, Math.min(3.5, scale * factor));
    const cx = stageSize.w / 2;
    const cy = stageSize.h / 2;
    const worldX = (cx - stagePos.x) / scale;
    const worldY = (cy - stagePos.y) / scale;
    setScale(next);
    setStagePos({ x: cx - worldX * next, y: cy - worldY * next });
  };
  const handleZoomIn = () => zoomBy(1.2);
  const handleZoomOut = () => zoomBy(1 / 1.2);
  /** Fit the whole canvas inside the visible area, centred */
  const fitToView = useCallback((w: number, h: number) => {
    const next = Math.max(0.25, Math.min(1.2, Math.min(w / CANVAS_W, h / CANVAS_H) * 0.96));
    setScale(next);
    setStagePos({ x: (w - CANVAS_W * next) / 2, y: (h - CANVAS_H * next) / 2 });
  }, []);
  /** Zoom onto the elements themselves so seats are big enough to read */
  const fitToContent = (list: UniversalVenueObject[], w = stageSize.w, h = stageSize.h) => {
    const box = layoutBounds(list, seatTypes);
    if (!box) {
      fitToView(w, h);
      return;
    }
    const bw = Math.max(120, box.maxX - box.minX);
    const bh = Math.max(120, box.maxY - box.minY);
    const next = Math.max(0.25, Math.min(1.6, Math.min((w - 90) / bw, (h - 90) / bh)));
    setScale(next);
    setStagePos({
      x: (w - bw * next) / 2 - box.minX * next,
      y: (h - bh * next) / 2 - box.minY * next,
    });
  };
  const handleResetZoom = () => fitToContent(objects);

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
    const clampedScale = Math.max(0.2, Math.min(3.5, newScale));

    setScale(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  };

  // Compute live layout capacity & financial potential
  const metrics = useMemo(() => computeLayoutCapacity(objects, seatTypes), [objects, seatTypes]);

  // Validation report
  const validation = useMemo(() => validateLayout(objects, seatTypes), [objects, seatTypes]);

  // How many rows / tables use each seat type
  const seatTypeUsage = useMemo(() => {
    const usage: Record<string, number> = {};
    objects.forEach((o) => {
      if (o.type === "curved_stand" || o.type === "grid_stand") {
        resolveRows(o).forEach((r) => {
          const id = r.seatTypeId || o.seatTypeId;
          if (id) usage[id] = (usage[id] || 0) + 1;
        });
      } else if (o.seatTypeId) {
        usage[o.seatTypeId] = (usage[o.seatTypeId] || 0) + 1;
      }
    });
    return usage;
  }, [objects]);

  // Keep the canvas exactly as big as the space between the two side panels
  useEffect(() => {
    const el = canvasBoxRef.current;
    if (!el) return;
    let fitted = false;
    const measure = () => {
      const w = Math.max(300, el.clientWidth);
      const h = Math.max(300, el.clientHeight);
      setStageSize({ w, h });
      // Start with the whole canvas in view
      if (!fitted) {
        fitted = true;
        fitToView(w, h);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitToView]);

  // Load the user's saved standard layouts whenever the template picker opens
  useEffect(() => {
    if (!isTemplateModalOpen) return;
    let cancelled = false;
    setSavedLoading(true);
    setSavedError(null);
    listStandardTemplatesApi().then((res) => {
      if (cancelled) return;
      setSavedTemplates(res.data);
      setSavedError(res.error || null);
      setSavedLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isTemplateModalOpen]);

  // Selected object
  const selectedObject = useMemo(() => {
    return objects.find((o) => o.id === selectedObjectId) || null;
  }, [objects, selectedObjectId]);

  // ── 3. ADD OBJECT HANDLERS ──
  const handleAddObject = (type: ObjectType) => {
    pushHistorySnapshot();
    const count = objects.filter((o) => o.type === type).length + 1;
    const newId = `obj_${type}_${Date.now()}`;

    let newObj: UniversalVenueObject;

    if (type === "curved_stand") {
      newObj = {
        id: newId,
        name: `Curved Stand ${count}`,
        type: "curved_stand",
        x: CX,
        y: CY,
        width: 400,
        height: 140,
        rotation: 0,
        color: "#8b5cf6",
        innerRadius: 220,
        outerRadius: 360,
        startAngle: 0,
        sweepAngle: 90,
        rowStart: "A",
        rowEnd: "L",
        seatsPerRow: 28,
        aisleGaps: [9, 19],
        price: 350,
        rows: buildRows("A", 8, 28, seatTypes[0]?.id, [9, 10, 9]),
      };
    } else if (type === "grid_stand") {
      newObj = {
        id: newId,
        name: `Grid Stand ${count}`,
        type: "grid_stand",
        x: CX,
        y: CY - 200,
        width: 480,
        height: 160,
        rotation: 0,
        color: "#3b82f6",
        rowStart: "A",
        rowEnd: "J",
        seatsPerRow: 22,
        aisleGaps: [11],
        price: 300,
        rows: buildRows("A", 10, 22, seatTypes[0]?.id, [11, 11]),
      };
    } else if (type === "general_admission") {
      newObj = {
        id: newId,
        name: `Standing Zone ${count}`,
        type: "general_admission",
        x: CX,
        y: CY + 180,
        width: 460,
        height: 140,
        rotation: 0,
        color: "#10b981",
        standingCapacity: 1000,
        price: 200,
      };
    } else if (type === "table_round") {
      newObj = {
        id: newId,
        name: `Round Table ${count}`,
        type: "table_round",
        x: CX,
        y: CY,
        width: 70,
        height: 70,
        rotation: 0,
        color: "#ec4899",
        tableShape: "round",
        tableSeatCount: 10,
        price: 800,
      };
    } else if (type === "table_rect") {
      newObj = {
        id: newId,
        name: `Long Table ${count}`,
        type: "table_rect",
        x: CX,
        y: CY,
        width: 180,
        height: 60,
        rotation: 0,
        color: "#0284c7",
        tableShape: "rectangle",
        tableSeatCount: 10,
        price: 600,
      };
    } else if (type === "stage") {
      newObj = {
        id: newId,
        name: `Main Stage ${count}`,
        type: "stage",
        x: CX,
        y: 180,
        width: 460,
        height: 90,
        rotation: 0,
        color: "#991b1b",
      };
    } else if (type === "sports_court") {
      newObj = {
        id: newId,
        name: `Sports Turf / Court ${count}`,
        type: "sports_court",
        x: CX,
        y: CY,
        width: 360,
        height: 230,
        rotation: 0,
        color: "#15803d",
      };
    } else if (type === "gate") {
      newObj = {
        id: newId,
        name: `Turnstile Gate ${count}`,
        type: "gate",
        x: CX,
        y: 120,
        width: 90,
        height: 24,
        rotation: 0,
        color: "#7c3aed",
        gateNumber: String(count),
        gateType: "entry",
      };
    } else {
      newObj = {
        id: newId,
        name: `Text ${count}`,
        type: "text_label",
        x: CX,
        y: CY,
        width: 120,
        height: 22,
        rotation: 0,
        color: "#0f172a",
        textColor: "#0f172a",
        label: "Your text",
        fontSize: 18,
        textBold: true,
        textAlign: "center",
      };
      const box = measureText(newObj);
      newObj.width = box.width;
      newObj.height = box.height;
      focusTextRef.current = newId;
    }

    setObjects((prev) => [...prev, newObj]);
    setSelectedObjectId(newId);
    if (type === "text_label") setInspectorTab("properties");
    toast.success(`Added ${newObj.name}`);
  };

  const activeSeatKeys = seatSel && seatSel.objId === selectedObjectId ? seatSel.keys : [];

  /** Click on a seat: pick it (Shift / Ctrl adds to the picked seats) */
  const handleSeatClick = (obj: UniversalVenueObject, seat: UniversalSeat, additive: boolean) => {
    if (!seat.slotKey) return;
    const key = seat.slotKey;
    setSelectedObjectId(obj.id);
    setInspectorTab("properties");
    setSeatSel((prev) => {
      const same = prev && prev.objId === obj.id ? prev.keys : [];
      if (!additive) return { objId: obj.id, keys: [key] };
      return { objId: obj.id, keys: same.includes(key) ? same.filter((k) => k !== key) : [...same, key] };
    });
  };

  /** Change the picked seats; `null` clears every change on them */
  const applySeatPatch = (patch: Partial<SeatOverride> | null) => {
    const target = objects.find((o) => o.id === selectedObjectId);
    if (!target || activeSeatKeys.length === 0) return;
    pushHistorySnapshot();
    const next: Record<string, SeatOverride> = { ...(target.seatOverrides || {}) };
    activeSeatKeys.forEach((key) => {
      if (patch === null) {
        delete next[key];
        return;
      }
      const merged: Record<string, unknown> = { ...(next[key] || {}), ...patch };
      Object.keys(merged).forEach((k) => merged[k] === undefined && delete merged[k]);
      if (Object.keys(merged).length === 0) delete next[key];
      else next[key] = merged as SeatOverride;
    });
    setObjects((prev) =>
      prev.map((o) => (o.id === target.id ? { ...o, seatOverrides: Object.keys(next).length ? next : undefined } : o))
    );
  };

  // Every seat of the selected stand, including ones taken out, so the editor can name them
  const pickedSeats = useMemo(() => {
    const target = objects.find((o) => o.id === selectedObjectId);
    if (!target || activeSeatKeys.length === 0) return [];
    const wanted = new Set(activeSeatKeys);
    return generateSeatsForObject(target, seatTypes, { includeRemoved: true }).filter((s) => s.slotKey && wanted.has(s.slotKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, selectedObjectId, seatSel, seatTypes]);

  /** Patch the selected element */
  const patchSelected = (patch: Partial<UniversalVenueObject>) => {
    if (!selectedObject) return;
    setObjects((prev) => prev.map((o) => (o.id === selectedObject.id ? { ...o, ...patch } : o)));
  };

  const handleRowsChange = (rows: RowConfig[]) => patchSelected({ rows });

  // Live seats of the selected block, for picking many at once; the box tool ends when the selection changes
  const selectedSeatList = useMemo(
    () =>
      selectedObject && (selectedObject.type === "block" || selectedObject.type === "grid_stand" || selectedObject.type === "curved_stand")
        ? generateSeatsForObject(selectedObject, seatTypes)
        : [],
    [selectedObject, seatTypes]
  );
  useEffect(() => {
    setBoxSelect(false);
  }, [selectedObjectId]);

  /** Removing a seat type sends its rows back to the stand colour */
  const handleSeatTypesChange = (next: SeatType[]) => {
    const keep = new Set(next.map((t) => t.id));
    setSeatTypes(next);
    setObjects((prev) =>
      prev.map((o) => {
        let changed = false;
        let rows = o.rows;
        if (o.rows) {
          rows = o.rows.map((r) => {
            if (r.seatTypeId && !keep.has(r.seatTypeId)) {
              changed = true;
              return { ...r, seatTypeId: undefined };
            }
            return r;
          });
        }
        const seatTypeId = o.seatTypeId && !keep.has(o.seatTypeId) ? undefined : o.seatTypeId;
        if (seatTypeId !== o.seatTypeId) changed = true;
        return changed ? { ...o, rows, seatTypeId } : o;
      })
    );
  };

  /** Add a block of seats: `rows` rows of `seats` seats, optionally set to one seat type */
  const handleAddSeatBlock = (opts: { seatTypeId?: string; rows?: number; seats?: number; label?: string } = {}) => {
    pushHistorySnapshot();
    const count = objects.filter((o) => o.type === "grid_stand").length + 1;
    const rows = opts.rows ?? 5;
    const seatsPerRow = opts.seats ?? 12;
    const typeId = opts.seatTypeId ?? seatTypes[0]?.id;
    const newId = `obj_grid_stand_${Date.now()}`;
    const stacked = objects.filter((o) => o.type === "grid_stand").length * 40;
    const newObj: UniversalVenueObject = {
      id: newId,
      name: opts.label ? `${opts.label} ${count}` : `Seat block ${count}`,
      type: "grid_stand",
      x: CX,
      y: CY - 100 + stacked,
      width: 480,
      height: 160,
      rotation: 0,
      color: seatTypes.find((t) => t.id === typeId)?.color || "#16a34a",
      seatTypeId: typeId,
      rows: buildRows("A", rows, seatsPerRow, typeId),
      price: seatTypes.find((t) => t.id === typeId)?.price || 300,
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedObjectId(newId);
    setInspectorTab("properties");
    toast.success(`Added ${newObj.name}. Change rows and seats on the right.`);
  };

  /** Add a sign such as washroom, exit or no smoking */
  const handleAddIcon = (icon: IconPreset) => {
    pushHistorySnapshot();
    const newId = `obj_icon_${Date.now()}`;
    const newObj: UniversalVenueObject = {
      id: newId,
      name: icon.name,
      type: "shape",
      shapeKind: "icon",
      iconGlyph: icon.glyph,
      x: CX,
      y: CY,
      width: 48,
      height: 48,
      rotation: 0,
      color: icon.color,
      label: icon.name,
      fontSize: 10,
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedObjectId(newId);
    setInspectorTab("properties");
    toast.success(`Added ${icon.name}`);
  };

  /** Add a free shape or a ready-made venue element */
  const handleAddShape = (preset: ShapePreset) => {
    pushHistorySnapshot();
    const count = objects.filter((o) => o.type === "shape" && o.name.startsWith(preset.name)).length + 1;
    const newId = `obj_shape_${Date.now()}`;
    const newObj: UniversalVenueObject = {
      id: newId,
      name: count > 1 ? `${preset.name} ${count}` : preset.name,
      type: "shape",
      shapeKind: preset.shapeKind,
      x: CX,
      y: CY,
      width: preset.width,
      height: preset.height,
      rotation: 0,
      color: preset.color,
      label: preset.label,
      fontSize: preset.shapeKind === "curve" ? 13 : 12,
      opacity: 0.95,
      ...(preset.shapeKind === "curve" ? { curveDepth: 1, strokeWidth: 5 } : {}),
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedObjectId(newId);
    setInspectorTab("properties");
    toast.success(`Added ${newObj.name}`);
  };

  // ── Stadium blocks ──
  const levels = useMemo(() => {
    const found: string[] = [];
    objects.forEach((o) => {
      if (o.type === "block" && o.level && !found.includes(o.level)) found.push(o.level);
    });
    return found;
  }, [objects]);

  /** Add a block from a ready-made shape. It goes to the stand currently shown. */
  const handleAddBlock = (preset: BlockPreset) => {
    pushHistorySnapshot();
    const shape = preset.build();
    const typeId = seatTypes[0]?.id;
    const count = objects.filter((o) => o.type === "block").length + 1;
    const newId = `obj_block_${Date.now()}`;
    const newObj: UniversalVenueObject = {
      id: newId,
      name: `Block ${count}`,
      type: "block",
      x: CX,
      y: CY,
      width: 200,
      height: 120,
      rotation: 0,
      color: seatTypes.find((t) => t.id === typeId)?.color || "#16a34a",
      seatTypeId: typeId,
      price: seatTypes.find((t) => t.id === typeId)?.price || 300,
      points: shape.points,
      blockRowMode: shape.rowMode,
      blockArcCenter: shape.arcCenter,
      level: levelFilter !== "all" ? levelFilter : levels[0] || "Lower stand",
      seatSpacing: 18,
      rowSpacing: 22,
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedObjectId(newId);
    setInspectorTab("properties");
    toast.success(`Added ${newObj.name}. Drag its corners to reshape it.`);
  };

  /** Add a ground, pitch or stage as an editable polygon */
  const handleAddGround = (preset: GroundPreset) => {
    pushHistorySnapshot();
    const newId = `obj_shape_${Date.now()}`;
    const newObj: UniversalVenueObject = {
      id: newId,
      name: preset.name,
      type: "shape",
      shapeKind: "polygon",
      points: preset.build(),
      x: CX,
      y: CY,
      width: 200,
      height: 120,
      rotation: 0,
      color: preset.color,
      label: preset.label,
      textColor: preset.labelColor,
      fontSize: 18,
      opacity: 0.95,
    };
    setObjects((prev) => [...prev, newObj]);
    setSelectedObjectId(newId);
    setInspectorTab("properties");
    toast.success(`Added ${preset.name}`);
  };

  const startDrawing = (kind: "block" | "ground") => {
    setSelectedObjectId(null);
    setDrawing({ kind, points: [] });
  };

  const finishDrawing = () => {
    const d = drawing;
    setDrawing(null);
    if (!d || d.points.length < 6) {
      if (d) toast.info("Place at least 3 corners to make a shape.");
      return;
    }
    pushHistorySnapshot();
    const r = recentre(d.points);
    const typeId = seatTypes[0]?.id;
    const newId = `obj_${d.kind === "block" ? "block" : "shape"}_${Date.now()}`;
    const base = { id: newId, x: Math.round(r.cx), y: Math.round(r.cy), width: 200, height: 120, rotation: 0, points: r.points };
    const newObj: UniversalVenueObject =
      d.kind === "block"
        ? {
            ...base,
            name: `Block ${objects.filter((o) => o.type === "block").length + 1}`,
            type: "block",
            color: seatTypes.find((t) => t.id === typeId)?.color || "#16a34a",
            seatTypeId: typeId,
            price: seatTypes.find((t) => t.id === typeId)?.price || 300,
            blockRowMode: "straight",
            level: levelFilter !== "all" ? levelFilter : levels[0] || "Lower stand",
            seatSpacing: 18,
            rowSpacing: 22,
          }
        : { ...base, name: "Custom shape", type: "shape", shapeKind: "polygon", color: "#15803d", label: "GROUND", fontSize: 18, opacity: 0.95 };
    setObjects((prev) => [...prev, newObj]);
    setSelectedObjectId(newId);
    setInspectorTab("properties");
  };

  /** Zoom the canvas onto one block so its seats fill the view */
  const zoomToObject = (id: string) => {
    const o = objects.find((x) => x.id === id);
    if (!o || !o.points) return;
    const b = polyBounds(rotatePoints(o.points, o.rotation || 0));
    const bw = Math.max(120, b.maxX - b.minX + 80);
    const bh = Math.max(120, b.maxY - b.minY + 80);
    const next = Math.max(0.3, Math.min(2.4, Math.min(stageSize.w / bw, stageSize.h / bh)));
    const cx = o.x + (b.minX + b.maxX) / 2;
    const cy = o.y + (b.minY + b.maxY) / 2;
    setScale(next);
    setStagePos({ x: stageSize.w / 2 - cx * next, y: stageSize.h / 2 - cy * next });
    setFocusBlockId(id);
    setSelectedObjectId(id);
  };

  // Enter finishes and Escape cancels a polygon being drawn
  useEffect(() => {
    if (!drawing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawing(null);
      if (e.key === "Enter") finishDrawing();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawing]);

  // Delete / Backspace removes the selected element (not while typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (!selectedObjectId) return;
      e.preventDefault();
      deleteSelectedRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedObjectId]);

  // Duplicate selected object
  const handleDuplicate = () => {
    if (!selectedObject) return;
    pushHistorySnapshot();
    const newId = `obj_${selectedObject.type}_${Date.now()}`;
    const duplicate: UniversalVenueObject = {
      ...JSON.parse(JSON.stringify(selectedObject)),
      id: newId,
      name: `${selectedObject.name} (Copy)`,
      x: selectedObject.x + 30,
      y: selectedObject.y + 30,
    };
    setObjects((prev) => [...prev, duplicate]);
    setSelectedObjectId(newId);
    toast.success(`Duplicated ${selectedObject.name}`);
  };

  // Delete selected object
  const handleDelete = () => {
    if (!selectedObject) return;
    pushHistorySnapshot();
    setObjects((prev) => prev.filter((o) => o.id !== selectedObject.id));
    setSelectedObjectId(null);
    toast.info("Deleted object");
  };

  // Delete takes out the picked seats when there are any, otherwise the whole element
  deleteSelectedRef.current = () => (activeSeatKeys.length > 0 ? applySeatPatch({ removed: true }) : handleDelete());

  // ── 4. SAVE & PUBLISH HANDLERS ──
  const buildCurrentLayoutObject = (status: "DRAFT" | "PUBLISHED"): UniversalVenueLayout => {
    return {
      id: layoutId,
      name: layoutName,
      venueType,
      category,
      seatTypes,
      version: layoutVersion,
      status,
      canvasWidth: CANVAS_W,
      canvasHeight: CANVAS_H,
      gridSnap,
      gridSize,
      blueprintUrl: null,
      blueprintOpacity: 0.35,
      objects,
      metadata: {
        totalCapacity: metrics.totalCapacity,
        seatedCapacity: metrics.seatedCapacity,
        standingCapacity: metrics.standingCapacity,
        totalTables: metrics.totalTables,
        totalGates: metrics.totalGates,
        estimatedRevenue: metrics.estimatedRevenue,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      const layoutObj = buildCurrentLayoutObject("DRAFT");
      if (onSave) {
        await onSave(layoutObj);
      } else {
        await saveDraftLayoutApi(layoutObj);
      }
      setLayoutStatus("DRAFT");
      toast.success("Draft layout saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validation.isValid) {
      toast.error("Please resolve layout validation warnings before publishing.");
      return;
    }

    setIsSaving(true);
    try {
      const layoutObj = buildCurrentLayoutObject("PUBLISHED");
      if (onSave) {
        await onSave(layoutObj);
      } else {
        await publishLayoutApi(layoutId, layoutObj);
      }
      setLayoutStatus("PUBLISHED");
      setLayoutVersion((v) => v + 1);
      toast.success(`Published Universal Venue Layout (v${layoutVersion})!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to publish layout");
    } finally {
      setIsSaving(false);
    }
  };

  /** Start again from an empty white page */
  const startBlankLayout = () => {
    pushHistorySnapshot();
    setLayoutId(`layout_${Date.now()}`);
    setLayoutName("Untitled layout");
    setLayoutVersion(1);
    setLayoutStatus("DRAFT");
    setObjects([]);
    setSeatTypes(DEFAULT_SEAT_TYPES);
    setSelectedObjectId(null);
    setInspectorTab("properties");
    toast.success("Blank layout ready. Add seating, shapes and elements from the left.");
  };

  const handleNewBlank = () => {
    if (objects.length === 0) {
      startBlankLayout();
      return;
    }
    setIsBlankConfirmOpen(true);
  };

  // ── Block size, spacing and arrangement ──
  const clampNum = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

  /** How much a block's width grows per pixel of seat gap (rows with wide seats and aisles count for more) */
  const gridWidthCoeff = (obj: UniversalVenueObject) =>
    Math.max(1, (gridStandSize({ ...obj, seatSpacing: 100 }, seatTypes).width - 64) / 100);
  const seatGapForWidth = (obj: UniversalVenueObject, width: number) =>
    clampNum(Math.round(((width - 64) / gridWidthCoeff(obj)) * 10) / 10, 12, 52);
  const rowGapForHeight = (obj: UniversalVenueObject, height: number) => {
    const gaps = Math.max(1, resolveRows(obj).length - 1);
    return clampNum(Math.round(((height - 40) / gaps) * 10) / 10, 14, 70);
  };

  const patchObject = (id: string, patch: Partial<UniversalVenueObject>) =>
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  /** Give every seat block the selected block's seat gap and row gap, so seats are the same size everywhere */
  const matchSeatSize = (source: UniversalVenueObject) => {
    pushHistorySnapshot();
    setObjects((prev) =>
      prev.map((o) =>
        o.type === "grid_stand" ? { ...o, seatSpacing: source.seatSpacing || 18, rowSpacing: source.rowSpacing || 22 } : o
      )
    );
    toast.success("All blocks now use the same seat size");
  };

  /** Stretch or shrink every block's seat gap so all blocks are as wide as the selected one */
  const matchBlockWidth = (source: UniversalVenueObject) => {
    pushHistorySnapshot();
    const width = gridStandSize(source, seatTypes).width;
    setObjects((prev) =>
      prev.map((o) => (o.type === "grid_stand" && o.id !== source.id ? { ...o, seatSpacing: seatGapForWidth(o, width) } : o))
    );
    toast.success("All blocks now match this block's width");
  };

  const [spacingForm, setSpacingForm] = useState({ screenGap: 50, blockGap: 70, seatGap: 18, rowGap: 22 });

  const applyGapsToAll = () => {
    pushHistorySnapshot();
    setObjects((prev) =>
      prev.map((o) => (o.type === "grid_stand" ? { ...o, seatSpacing: spacingForm.seatGap, rowSpacing: spacingForm.rowGap } : o))
    );
    toast.success("Seat gap and row gap applied to every block");
  };

  /** Stack the seat blocks under the screen with the chosen distances, centred on it */
  const arrangeBlocks = () => {
    const stands = objects.filter((o) => o.type === "grid_stand").sort((a, b) => a.y - b.y);
    if (stands.length === 0) {
      toast.error("Add a seat block first");
      return;
    }
    pushHistorySnapshot();
    const screen =
      objects.find((o) => o.type === "shape" && /screen/i.test(o.name)) ||
      objects.find((o) => o.type === "shape" && o.shapeKind === "curve");
    const centerX = screen ? screen.x : stands[0].x;
    // Bottom of the screen: its arc, caption and a little glow
    let cursor = screen ? screen.y + screen.height / 2 + (screen.shapeKind === "curve" ? 26 : 12) : stands[0].y - 80;
    cursor += spacingForm.screenGap;
    const positions = new Map<string, { x: number; y: number }>();
    stands.forEach((stand) => {
      const f = gridStandSize(stand, seatTypes);
      const headingSpace = stand.showTierHeading === false ? 8 : 34;
      const top = cursor + headingSpace;
      positions.set(stand.id, { x: centerX, y: Math.round(top + f.height / 2) });
      cursor = top + f.height + spacingForm.blockGap;
    });
    setObjects((prev) => prev.map((o) => (positions.has(o.id) ? { ...o, ...positions.get(o.id)! } : o)));
    toast.success("Blocks arranged under the screen");
  };

  const handleSaveTemplate = async (input: {
    name: string;
    description: string;
    category: LayoutCategory;
    isShared: boolean;
  }) => {
    if (objects.length === 0) {
      toast.error("Add at least one element before saving a template.");
      return;
    }
    setSavingTemplate(true);
    const res = await saveStandardTemplateApi({
      name: input.name,
      description: input.description,
      category: input.category,
      isShared: input.isShared,
      canvasWidth: CANVAS_W,
      canvasHeight: CANVAS_H,
      objects,
      seatTypes,
      capacity: metrics.totalCapacity,
    });
    setSavingTemplate(false);
    if (!res.success) {
      toast.error(res.error || "Could not save the template");
      return;
    }
    setIsSaveTemplateOpen(false);
    toast.success(`Saved “${input.name}” as a standard layout`);
  };

  const handleUseSavedTemplate = (tmpl: LayoutStandardTemplate) => {
    pushHistorySnapshot();
    // Fresh ids so two layouts built from the same template never share element ids
    const stamp = Date.now();
    const loaded = (tmpl.objects_json || []).map((o, i) => ({
      ...JSON.parse(JSON.stringify(o)),
      id: `${o.id}_${stamp}_${i}`,
    })) as UniversalVenueObject[];
    setObjects(loaded);
    fitToContent(loaded);
    setSeatTypes(tmpl.seat_types_json?.length ? tmpl.seat_types_json : DEFAULT_SEAT_TYPES);
    setCategory(tmpl.category);
    setVenueType(venueTypeForCategory(tmpl.category));
    setLayoutName(tmpl.name);
    setSelectedObjectId(loaded[0]?.id || null);
    toast.success(`Loaded “${tmpl.name}”`);
  };

  const handleDeleteSavedTemplate = async (tmpl: LayoutStandardTemplate) => {
    const res = await deleteStandardTemplateApi(tmpl.id);
    if (!res.success) {
      toast.error(res.error || "Could not delete the template");
      return;
    }
    setSavedTemplates((prev) => prev.filter((t) => t.id !== tmpl.id));
    toast.success("Template deleted");
  };

  const handleToggleShareSaved = async (tmpl: LayoutStandardTemplate) => {
    const res = await updateStandardTemplateApi(tmpl.id, { isShared: !tmpl.is_shared });
    if (!res.success || !res.data) {
      toast.error(res.error || "Could not update sharing");
      return;
    }
    setSavedTemplates((prev) => prev.map((t) => (t.id === tmpl.id ? { ...t, is_shared: res.data!.is_shared } : t)));
    toast.success(res.data.is_shared ? "Shared with everyone" : "Now private");
  };

  return (
    <div className="venue-designer-root w-full h-full flex flex-col bg-white text-slate-900 select-none overflow-hidden relative font-sans">
      {/* ── TOP TOOLBAR ── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-xs uppercase tracking-wider shadow-sm">
            <Compass className="w-4 h-4" />
            <span>Universal Venue Designer</span>
          </div>

          {/* Editable Layout Name */}
          <input
            type="text"
            value={layoutName}
            onChange={(e) => setLayoutName(e.target.value)}
            className="bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-red-500 w-52"
            placeholder="Venue Layout Name"
          />

          {/* Layout category */}
          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value as LayoutCategory;
              setCategory(next);
              setVenueType(venueTypeForCategory(next));
            }}
            className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:border-red-500"
            aria-label="Layout category"
          >
            {LAYOUT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          {/* Status Badge */}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              layoutStatus === "PUBLISHED"
                ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                : "bg-amber-500/20 text-amber-600 border border-amber-500/30"
            }`}
          >
            {layoutStatus} (v{layoutVersion})
          </span>
        </div>

        {/* Quick Actions (Templates, AI Prompt, Preview) */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewBlank}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs transition-colors"
          >
            <FilePlus2 className="w-3.5 h-3.5 text-sky-600" />
            <span>New blank page</span>
          </button>

          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
            <span>Templates</span>
          </button>

          <button
            onClick={() => setIsSaveTemplateOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs transition-colors"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-emerald-600" />
            <span>Save as template</span>
          </button>

          <button
            onClick={() => setIsTextPromptModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/70 text-purple-600 border border-purple-500/30 font-semibold text-xs transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5 text-purple-600" />
            <span>AI Prompt</span>
          </button>

          <button
            onClick={() => setIsPreviewModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-600 border border-emerald-500/40 font-bold text-xs transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-600" />
            <span>Customer Preview</span>
          </button>

          <div className="h-4 w-px bg-slate-100 mx-1" />

          {/* Save & Publish Buttons */}
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>

          <button
            onClick={handlePublish}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 text-white font-bold text-xs shadow-md shadow-red-950/40 transition-all active:scale-95 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Publish Layout</span>
          </button>
        </div>
      </div>

      {/* ── SECONDARY CANVAS TOOLBAR ── */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-1.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          {/* Tool Modes */}
          <div className="flex items-center bg-white p-0.5 rounded border border-slate-200">
            <button
              onClick={() => setToolMode("select")}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                toolMode === "select" ? "bg-red-600 text-white" : "text-slate-500 hover:text-white"
              }`}
            >
              Select
            </button>
            <button
              onClick={() => setToolMode("pan")}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                toolMode === "pan" ? "bg-red-600 text-white" : "text-slate-500 hover:text-white"
              }`}
            >
              Pan
            </button>
          </div>

          {/* Grid Snap Toggle */}
          <button
            onClick={() => setGridSnap(!gridSnap)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium transition-colors ${
              gridSnap
                ? "bg-slate-100 border-red-500 text-slate-900"
                : "bg-white border-slate-200 text-slate-500 hover:text-slate-900"
            }`}
          >
            <Grid className="w-3 h-3 text-red-500" />
            <span>Snap Grid ({gridSize}px)</span>
          </button>
        </div>

        {/* Viewport Zoom & History */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white rounded border border-slate-200 px-1 py-0.5">
            <button onClick={handleZoomOut} className="p-1 hover:text-slate-900 text-slate-500">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[10px] w-10 text-center text-slate-700">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={handleZoomIn} className="p-1 hover:text-slate-900 text-slate-500">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={handleResetZoom} className="p-1 hover:text-slate-900 text-slate-500">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={past.length === 0}
              className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={future.length === 0}
              className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── WORKSPACE (3-COLUMN LAYOUT) ── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT COLUMN: OBJECTS TOOLBOX & HIERARCHY */}
        <div className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          {/* Add seats */}
          <div className="p-3 border-b border-slate-200 space-y-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Armchair className="w-3 h-3" /> Add seats
            </span>
            <button
              onClick={() => handleAddSeatBlock()}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-bold shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Add seat block (rows)
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleAddSeatBlock({ rows: 1, seats: 1, label: "Single seat" })}
                className="p-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700"
              >
                + Single seat
              </button>
              <button
                onClick={() => handleAddObject("curved_stand")}
                className="p-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700"
              >
                + Curved block
              </button>
            </div>
            <span className="text-[10px] text-slate-500 block pt-1">Quick add by seat type</span>
            <div className="flex flex-wrap gap-1.5">
              {seatTypes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleAddSeatBlock({ seatTypeId: t.id, rows: t.shape === "couple" || t.shape === "recliner" ? 3 : 5, seats: t.shape === "couple" ? 6 : t.shape === "recliner" ? 8 : 12, label: `${t.name} rows` })}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-semibold hover:bg-slate-50"
                  style={{ borderColor: t.color, color: t.color }}
                  title={`Add ${t.name} seats · ETB ${t.price}`}
                  aria-label={`Add ${t.name} seats`}
                >
                  <Plus className="w-3 h-3" /> {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Other areas */}
          <div className="p-3 border-b border-slate-200 space-y-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Areas &amp; tables
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { type: "general_admission", label: "Standing area", dot: "bg-emerald-500" },
                  { type: "table_round", label: "Round table", dot: "bg-pink-500" },
                  { type: "table_rect", label: "Long table", dot: "bg-cyan-500" },
                  { type: "stage", label: "Main stage", dot: "bg-red-600" },
                  { type: "sports_court", label: "Sports turf", dot: "bg-green-600" },
                  { type: "gate", label: "Entrance gate", dot: "bg-purple-500" },
                ] as const
              ).map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleAddObject(item.type)}
                  className="flex items-center gap-1.5 p-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-left text-[11px] font-medium text-slate-700 hover:text-slate-900 transition-colors"
                >
                  <div className={`w-2.5 h-2.5 rounded-sm ${item.dot} shrink-0`} />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stadium: blocks, levels and ground shapes */}
          <div className="px-3 py-2 border-b border-slate-200 space-y-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Shapes className="w-3 h-3" /> Stadium blocks
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {BLOCK_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleAddBlock(preset)}
                  className="p-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-left text-[11px] font-medium text-slate-700 hover:text-slate-900 transition-colors truncate"
                >
                  {preset.name}
                </button>
              ))}
              <button
                onClick={() => startDrawing("block")}
                className="col-span-2 p-2 rounded bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold transition-colors"
              >
                Draw a block corner by corner
              </button>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block pt-1">Ground &amp; stage</span>
            <div className="grid grid-cols-2 gap-1.5">
              {GROUND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleAddGround(preset)}
                  className="flex items-center gap-1.5 p-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-left text-[11px] font-medium text-slate-700 hover:text-slate-900 transition-colors"
                >
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: preset.color }} />
                  <span className="truncate">{preset.name}</span>
                </button>
              ))}
              <button
                onClick={() => startDrawing("ground")}
                className="col-span-2 p-2 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-700 transition-colors"
              >
                Draw a custom shape
              </button>
            </div>
          </div>

          {/* Shapes & ready-made elements (kept in the palette block above via portal-free sibling) */}
          <div className="px-3 py-2 border-b border-slate-200 space-y-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Shapes className="w-3 h-3" /> Shapes
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {BASIC_SHAPES.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleAddShape(preset)}
                  className="flex items-center gap-1.5 p-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-left text-[11px] font-medium text-slate-700 hover:text-slate-900 transition-colors"
                >
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: preset.color }} />
                  <span className="truncate">{preset.name}</span>
                </button>
              ))}
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 pt-1">
              <Armchair className="w-3 h-3" /> Venue elements
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {ELEMENT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleAddShape(preset)}
                  className="flex items-center gap-1.5 p-2 rounded bg-white hover:bg-slate-100 border border-slate-200 text-left text-[11px] font-medium text-slate-700 hover:text-slate-900 transition-colors"
                >
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: preset.color }} />
                  <span className="truncate">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Free text */}
          <div className="px-3 py-2 border-b border-slate-200 space-y-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Text</span>
            <button
              onClick={() => handleAddObject("text_label")}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700"
              aria-label="Add text"
            >
              <Plus className="w-3.5 h-3.5" /> Add text
            </button>
            <p className="text-[10px] text-slate-500">Put any words on the layout, then drag them where you want. Edit the words, size and colour on the right.</p>
          </div>

          {/* Signs and symbols */}
          <div className="px-3 py-2 border-b border-slate-200 space-y-2 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Signs &amp; icons</span>
            <div className="grid grid-cols-5 gap-1.5">
              {ICON_PRESETS.map((icon) => (
                <button
                  key={icon.id}
                  onClick={() => handleAddIcon(icon)}
                  title={icon.name}
                  aria-label={`Add ${icon.name} icon`}
                  className="h-9 rounded border border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 text-lg leading-none flex items-center justify-center"
                >
                  {icon.glyph}
                </button>
              ))}
            </div>
          </div>

          {/* Objects Tree Hierarchy */}
          <div className="p-3 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Layout Elements ({objects.length})
            </span>
          </div>

          <div className="p-2 space-y-1.5 shrink-0">
            {objects.map((obj) => {
              const isSelected = selectedObjectId === obj.id;
              return (
                <div
                  key={obj.id}
                  onClick={() => setSelectedObjectId(obj.id)}
                  className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? "bg-slate-100 border-red-500 shadow-sm ring-1 ring-red-500/30"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: obj.color }}
                    />
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
                      {obj.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    {obj.type.replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER COLUMN: INTERACTIVE CANVAS */}
        <div ref={canvasBoxRef} className="flex-1 min-w-0 bg-slate-100 relative overflow-hidden">
          <Stage
            ref={stageRef}
            width={stageSize.w}
            height={stageSize.h}
            scaleX={scale}
            scaleY={scale}
            x={stagePos.x}
            y={stagePos.y}
            draggable={!boxSelect}
            onDragEnd={(e) => {
              // Only the stage itself: elements dragged inside it report their own position
              if (e.target === e.target.getStage()) setStagePos({ x: e.target.x(), y: e.target.y() });
            }}
            onWheel={handleWheel}
            onClick={(e) => {
              if (e.target === e.target.getStage()) {
                setSelectedObjectId(null);
              }
            }}
          >
            {/* Background layer: never a click target, so clicking empty canvas deselects */}
            <Layer listening={false}>
              <Rect
                x={0}
                y={0}
                width={CANVAS_W}
                height={CANVAS_H}
                fill="#ffffff"
                stroke="#e2e8f0"
                strokeWidth={2}
                shadowColor="#0f172a"
                shadowBlur={18}
                shadowOpacity={0.08}
              />

              {/* Grid dots */}
              {Array.from({ length: 40 }).map((_, i) =>
                Array.from({ length: 30 }).map((_, j) => (
                  <Circle
                    key={`dot_${i}_${j}`}
                    x={i * 40}
                    y={j * 40}
                    radius={1}
                    fill="#cbd5e1"
                    opacity={0.7}
                  />
                ))
              )}

            </Layer>

            {/* Stages & Sports Courts Layer */}
            <Layer>
              {objects
                .filter((o) => o.type === "stage" || o.type === "sports_court")
                .map((obj) => {
                  const isSelected = selectedObjectId === obj.id;
                  return (
                    <Group
                      key={obj.id}
                      x={obj.x}
                      y={obj.y}
                      rotation={obj.rotation || 0}
                      draggable={toolMode === "select"}
                      onClick={() => setSelectedObjectId(obj.id)}
                      onDragEnd={(e) => {
                        pushHistorySnapshot();
                        let nx = e.target.x();
                        let ny = e.target.y();
                        if (gridSnap) {
                          nx = Math.round(nx / gridSize) * gridSize;
                          ny = Math.round(ny / gridSize) * gridSize;
                        }
                        setObjects((prev) =>
                          prev.map((o) => (o.id === obj.id ? { ...o, x: nx, y: ny } : o))
                        );
                      }}
                    >
                      <Rect
                        x={-obj.width / 2}
                        y={-obj.height / 2}
                        width={obj.width}
                        height={obj.height}
                        fill={obj.color}
                        cornerRadius={8}
                        stroke={isSelected ? "#e11d48" : "rgba(15, 23, 42, 0.25)"}
                        strokeWidth={isSelected ? 3 : 1.5}
                      />
                      <Text
                        x={-obj.width / 2}
                        y={-6}
                        width={obj.width}
                        text={obj.name.toUpperCase()}
                        align="center"
                        fill="#ffffff"
                        fontFamily="sans-serif"
                        fontStyle="bold"
                        fontSize={12}
                      />
                    </Group>
                  );
                })}
            </Layer>

            {/* Free shapes & venue elements */}
            <Layer>
              {objects
                .filter((o) => o.type === "shape" && !isPolygonShape(o))
                .map((obj) => (
                  <ShapeNode
                    key={obj.id}
                    obj={obj}
                    selected={selectedObjectId === obj.id}
                    draggable={toolMode === "select"}
                    onSelect={() => setSelectedObjectId(obj.id)}
                    onDragEnd={(x, y) => {
                      pushHistorySnapshot();
                      const nx = gridSnap ? Math.round(x / gridSize) * gridSize : x;
                      const ny = gridSnap ? Math.round(y / gridSize) * gridSize : y;
                      setObjects((prev) => prev.map((o) => (o.id === obj.id ? { ...o, x: nx, y: ny } : o)));
                    }}
                  />
                ))}
            </Layer>

            <PolygonShapesLayer
              objects={objects}
              selectedId={selectedObjectId}
              scale={scale}
              draggable={toolMode === "select" && !drawing}
              onSelect={(id) => setSelectedObjectId(id)}
              onDragEnd={(id, x, y) => {
                pushHistorySnapshot();
                patchObject(id, { x: gridSnap ? Math.round(x / gridSize) * gridSize : x, y: gridSnap ? Math.round(y / gridSize) * gridSize : y });
              }}
              onBegin={pushHistorySnapshot}
              onPoints={(id, points) => patchObject(id, { points })}
            />

            {/* Stands & Seating Elements Layer */}
            <Layer>
              {/* Row names: one column at the far left and right of the whole layout */}
              <RowLabelGutter objects={objects} seatTypes={seatTypes} />
              {objects
                .filter((o) => o.type !== "stage" && o.type !== "sports_court" && o.type !== "gate" && o.type !== "shape" && o.type !== "block")
                .map((obj) => {
                  const isSelected = selectedObjectId === obj.id;

                  // 1. Curved Stand (Arc Wedge)
                  if (obj.type === "curved_stand") {
                    const innerR = obj.innerRadius || 220;
                    const outerR = obj.outerRadius || 340;
                    const startAng = ((obj.startAngle || 0) * Math.PI) / 180;
                    const endAng = (((obj.startAngle || 0) + (obj.sweepAngle || 90)) * Math.PI) / 180;

                    const midAng = ((obj.startAngle || 0) + (obj.rotation || 0) + (obj.sweepAngle || 90) / 2) * Math.PI / 180;
                    const midR = (innerR + outerR) / 2;
                    const lx = obj.x + (outerR + 24) * Math.cos(midAng);
                    const ly = obj.y + (outerR + 24) * Math.sin(midAng);
                    void midR;

                    return (
                      <Group
                        key={obj.id}
                        onClick={() => setSelectedObjectId(obj.id)}
                      >
                        <Shape
                          x={obj.x}
                          y={obj.y}
                          rotation={obj.rotation || 0}
                          sceneFunc={(context, shape) => {
                            context.beginPath();
                            context.arc(0, 0, outerR, startAng, endAng, false);
                            context.arc(0, 0, innerR, endAng, startAng, true);
                            context.closePath();
                            context.fillStrokeShape(shape);
                          }}
                          fill={isSelected ? "rgba(225, 29, 72, 0.08)" : tint(obj.color, 0.07)}
                          stroke={isSelected ? "#e11d48" : tint(obj.color, 0.45)}
                          strokeWidth={isSelected ? 2.5 : 1}
                        />
                        <StandSeats
                          obj={obj}
                          seatTypes={seatTypes}
                          selectedKeys={selectedObjectId === obj.id ? activeSeatKeys : undefined}
                          onSeatClick={(seat, additive) => handleSeatClick(obj, seat, additive)}
                          showRemoved={selectedObjectId === obj.id}
                        />
                        <Text
                          x={lx - 90}
                          y={ly - 12}
                          width={180}
                          text={obj.name.toUpperCase()}
                          fill="#334155"
                          fontStyle="bold"
                          fontSize={12}
                          align="center"
                          listening={false}
                        />
                        <Text
                          x={lx - 90}
                          y={ly + 3}
                          width={180}
                          text={standPriceLabel(obj, seatTypes)}
                          fill="#64748b"
                          fontSize={10}
                          align="center"
                          listening={false}
                        />
                      </Group>
                    );
                  }

                  // 2. Grid Stand & GA Standing
                  if (obj.type === "grid_stand" || obj.type === "general_admission") {
                    const frame =
                      obj.type === "grid_stand" ? gridStandSize(obj, seatTypes) : { width: obj.width, height: obj.height };
                    return (
                      <Group
                        key={obj.id}
                        x={obj.x}
                        y={obj.y}
                        rotation={obj.type === "grid_stand" ? 0 : obj.rotation || 0}
                        draggable={toolMode === "select"}
                        onClick={() => setSelectedObjectId(obj.id)}
                        onDragEnd={(e) => {
                          pushHistorySnapshot();
                          let nx = e.target.x();
                          let ny = e.target.y();
                          if (gridSnap) {
                            nx = Math.round(nx / gridSize) * gridSize;
                            ny = Math.round(ny / gridSize) * gridSize;
                          }
                          setObjects((prev) =>
                            prev.map((o) => (o.id === obj.id ? { ...o, x: nx, y: ny } : o))
                          );
                        }}
                      >
                        <Rect
                          x={0}
                          y={0}
                          offsetX={frame.width / 2}
                          offsetY={frame.height / 2}
                          rotation={obj.type === "grid_stand" ? obj.rotation || 0 : 0}
                          width={frame.width}
                          height={frame.height}
                          fill={obj.type === "grid_stand" ? tint(obj.color, 0.05) : tint(obj.color, 0.85)}
                          cornerRadius={10}
                          stroke={isSelected ? "#e11d48" : obj.type === "grid_stand" ? "rgba(15, 23, 42, 0.1)" : tint(obj.color, 0.6)}
                          strokeWidth={isSelected ? 2.5 : 1.2}
                        />
                        {obj.type === "grid_stand" && (
                          <StandSeats
                            obj={obj}
                            seatTypes={seatTypes}
                            offsetX={obj.x}
                            offsetY={obj.y}
                            selectedKeys={selectedObjectId === obj.id ? activeSeatKeys : undefined}
                            onSeatClick={(seat, additive) => handleSeatClick(obj, seat, additive)}
                            showRemoved={selectedObjectId === obj.id}
                          />
                        )}
                        {obj.type === "grid_stand" ? (
                          <StandHeading
                            obj={obj}
                            seatTypes={seatTypes}
                            editable={isSelected && toolMode === "select"}
                            onMove={(dx, dy) => {
                              pushHistorySnapshot();
                              patchObject(obj.id, { headingOffsetX: dx, headingOffsetY: dy });
                            }}
                          />
                        ) : (
                          <>
                            <Text
                              x={-frame.width / 2}
                              y={-10}
                              width={frame.width}
                              text={obj.name.toUpperCase()}
                              fill="#ffffff"
                              fontStyle="bold"
                              fontSize={11}
                              align="center"
                            />
                            <Text
                              x={-frame.width / 2}
                              y={6}
                              width={frame.width}
                              text={`${obj.standingCapacity} Standing • ${obj.price || 0} ETB`}
                              fill="#fef08a"
                              fontSize={10}
                              align="center"
                            />
                          </>
                        )}
                      </Group>
                    );
                  }

                  // 3. Tables (Round & Rectangular)
                  if (obj.type === "table_round") {
                    const radius = obj.width / 2;
                    const seats = generateSeatsForObject(obj, seatTypes);
                    return (
                      <Group
                        key={obj.id}
                        x={obj.x}
                        y={obj.y}
                        rotation={obj.rotation || 0}
                        draggable={toolMode === "select"}
                        onClick={() => setSelectedObjectId(obj.id)}
                        onDragEnd={(e) => {
                          pushHistorySnapshot();
                          setObjects((prev) =>
                            prev.map((o) => (o.id === obj.id ? { ...o, x: e.target.x(), y: e.target.y() } : o))
                          );
                        }}
                      >
                        <Circle
                          x={0}
                          y={0}
                          radius={radius}
                          fill={tint(obj.color, 0.85)}
                          stroke={isSelected ? "#e11d48" : obj.color}
                          strokeWidth={isSelected ? 3 : 1.4}
                        />
                        <Text
                          x={-radius}
                          y={-6}
                          width={radius * 2}
                          text={obj.name}
                          align="center"
                          fill="#ffffff"
                          fontSize={9}
                          fontStyle="bold"
                        />
                        {/* Render table chairs */}
                        {seats.map((st) => (
                          <Circle
                            key={st.id}
                            x={st.x - obj.x}
                            y={st.y - obj.y}
                            radius={5}
                            fill={tint(st.color || obj.color, 0.16)}
                            stroke={st.color || obj.color}
                            strokeWidth={1.4}
                          />
                        ))}
                      </Group>
                    );
                  }

                  return null;
                })}
            </Layer>

            {/* Free text */}
            <Layer>
              {objects
                .filter((o) => o.type === "text_label")
                .map((obj) => (
                  <TextNode
                    key={obj.id}
                    obj={obj}
                    selected={selectedObjectId === obj.id}
                    draggable={toolMode === "select"}
                    onSelect={() => setSelectedObjectId(obj.id)}
                    onDragEnd={(x, y) => {
                      pushHistorySnapshot();
                      const nx = gridSnap ? Math.round(x / gridSize) * gridSize : x;
                      const ny = gridSnap ? Math.round(y / gridSize) * gridSize : y;
                      setObjects((prev) => prev.map((o) => (o.id === obj.id ? { ...o, x: nx, y: ny } : o)));
                    }}
                  />
                ))}
            </Layer>

            {/* Resize handles on the border of the selected seat block */}
            <Layer>
              {selectedObject &&
                selectedObject.type === "grid_stand" &&
                toolMode === "select" &&
                (() => {
                  const f = gridStandSize(selectedObject, seatTypes);
                  const right = selectedObject.x + f.width / 2;
                  const bottom = selectedObject.y + f.height / 2;
                  const R = Math.max(5, 7 / Math.max(scale, 0.4));
                  const id = selectedObject.id;
                  const rowsCount = resolveRows(selectedObject).length;
                  const cursorOn = (c: string) => (e: Konva.KonvaEventObject<MouseEvent>) => {
                    const box = e.target.getStage()?.container();
                    if (box) box.style.cursor = c;
                  };
                  const cursorOff = (e: Konva.KonvaEventObject<MouseEvent>) => {
                    const box = e.target.getStage()?.container();
                    if (box) box.style.cursor = "default";
                  };
                  const handleProps = {
                    width: R * 2,
                    height: R * 2,
                    cornerRadius: 3,
                    fill: "#ffffff",
                    stroke: "#e11d48",
                    strokeWidth: 2,
                    draggable: true,
                    onMouseLeave: cursorOff,
                    onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => {
                      e.cancelBubble = true;
                      pushHistorySnapshot();
                    },
                  };
                  return (
                    <>
                      {/* right edge: wider or narrower (seat gap) */}
                      <Rect
                        {...handleProps}
                        x={right - R}
                        y={selectedObject.y - R}
                        onMouseEnter={cursorOn("ew-resize")}
                        onDragMove={(e) => {
                          e.cancelBubble = true;
                          e.target.y(selectedObject.y - R);
                          const width = Math.max(120, 2 * (e.target.x() + R - selectedObject.x));
                          patchObject(id, { seatSpacing: seatGapForWidth(selectedObject, width) });
                        }}
                      />
                      {/* bottom edge: taller or shorter (row gap) */}
                      {rowsCount > 1 && (
                        <Rect
                          {...handleProps}
                          x={selectedObject.x - R}
                          y={bottom - R}
                          onMouseEnter={cursorOn("ns-resize")}
                          onDragMove={(e) => {
                            e.cancelBubble = true;
                            e.target.x(selectedObject.x - R);
                            const height = Math.max(60, 2 * (e.target.y() + R - selectedObject.y));
                            patchObject(id, { rowSpacing: rowGapForHeight(selectedObject, height) });
                          }}
                        />
                      )}
                      {/* corner: both at once */}
                      <Rect
                        {...handleProps}
                        x={right - R}
                        y={bottom - R}
                        onMouseEnter={cursorOn("nwse-resize")}
                        onDragMove={(e) => {
                          e.cancelBubble = true;
                          const width = Math.max(120, 2 * (e.target.x() + R - selectedObject.x));
                          const height = Math.max(60, 2 * (e.target.y() + R - selectedObject.y));
                          patchObject(id, {
                            seatSpacing: seatGapForWidth(selectedObject, width),
                            ...(rowsCount > 1 ? { rowSpacing: rowGapForHeight(selectedObject, height) } : {}),
                          });
                        }}
                      />
                    </>
                  );
                })()}
            </Layer>

            {/* Entrance / Exit Gates Layer */}
            <Layer>
              {objects
                .filter((o) => o.type === "gate")
                .map((obj) => {
                  const isSelected = selectedObjectId === obj.id;
                  return (
                    <Group
                      key={obj.id}
                      x={obj.x}
                      y={obj.y}
                      rotation={obj.rotation || 0}
                      draggable={toolMode === "select"}
                      onClick={() => setSelectedObjectId(obj.id)}
                      onDragEnd={(e) => {
                        pushHistorySnapshot();
                        setObjects((prev) =>
                          prev.map((o) => (o.id === obj.id ? { ...o, x: e.target.x(), y: e.target.y() } : o))
                        );
                      }}
                    >
                      <Rect
                        x={-obj.width / 2}
                        y={-obj.height / 2}
                        width={obj.width}
                        height={obj.height}
                        fill={obj.color}
                        cornerRadius={5}
                        stroke={isSelected ? "#e11d48" : "rgba(15, 23, 42, 0.25)"}
                        strokeWidth={isSelected ? 2.5 : 1}
                      />
                      <Text
                        x={-obj.width / 2}
                        y={-5}
                        width={obj.width}
                        text={obj.name}
                        fill="#ffffff"
                        fontSize={9}
                        fontStyle="bold"
                        align="center"
                      />
                    </Group>
                  );
                })}
            </Layer>
            <BlockLayer
              objects={objects}
              seatTypes={seatTypes}
              selectedId={selectedObjectId}
              scale={scale}
              draggable={toolMode === "select" && !drawing}
              levelFilter={levelFilter}
              focusId={focusBlockId}
              activeSeatKeys={activeSeatKeys}
              onSelect={(id) => setSelectedObjectId(id)}
              onDragEnd={(id, x, y) => {
                pushHistorySnapshot();
                patchObject(id, { x: gridSnap ? Math.round(x / gridSize) * gridSize : x, y: gridSnap ? Math.round(y / gridSize) * gridSize : y });
              }}
              onBegin={pushHistorySnapshot}
              onPoints={(id, points) => patchObject(id, { points })}
              onZoom={(id) => zoomToObject(id)}
              onSeatClick={(obj, seat, additive) => handleSeatClick(obj, seat, additive)}
            />
            <SeatBoxOverlay
              active={boxSelect && !!selectedObject}
              width={CANVAS_W}
              height={CANVAS_H}
              scale={scale}
              seats={selectedSeatList}
              onPick={(keys, additive) => {
                if (!selectedObject) return;
                setSeatSel((prev) => {
                  const base = additive && prev && prev.objId === selectedObject.id ? prev.keys : [];
                  return { objId: selectedObject.id, keys: Array.from(new Set([...base, ...keys])) };
                });
              }}
            />
            <PolygonDrawOverlay
              active={!!drawing}
              width={CANVAS_W}
              height={CANVAS_H}
              scale={scale}
              points={drawing?.points || []}
              onAdd={(x, y) => setDrawing((d) => (d ? { ...d, points: [...d.points, x, y] } : d))}
              onFinish={() => finishDrawing()}
            />
          </Stage>

          {/* Stadium: pick the stand to work on, and a hint while drawing */}
          {(levels.length > 0 || drawing || focusBlockId) && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/95 border border-slate-200 rounded-lg shadow px-1.5 py-1 text-[11px] z-10">
              {drawing ? (
                <>
                  <span className="px-2 font-bold text-slate-700">
                    Click to place corners ({drawing.points.length / 2}). Double-click or press Enter to finish, Esc to cancel.
                  </span>
                  <button onClick={() => finishDrawing()} className="px-2 py-1 rounded bg-red-600 text-white font-bold">Finish</button>
                  <button onClick={() => setDrawing(null)} className="px-2 py-1 rounded border border-slate-300 font-bold text-slate-700">Cancel</button>
                </>
              ) : (
                <>
                  {levels.length > 0 && (
                    <>
                      <button
                        onClick={() => setLevelFilter("all")}
                        className={`px-2 py-1 rounded font-bold ${levelFilter === "all" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                      >
                        All stands
                      </button>
                      {levels.map((l) => (
                        <button
                          key={l}
                          onClick={() => setLevelFilter(l)}
                          className={`px-2 py-1 rounded font-bold ${levelFilter === l ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                        >
                          {l}
                        </button>
                      ))}
                    </>
                  )}
                  {focusBlockId && (
                    <button
                      onClick={() => {
                        setFocusBlockId(null);
                        fitToContent(objects);
                      }}
                      className="px-2 py-1 rounded bg-red-600 text-white font-bold"
                    >
                      ← Back to all blocks
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {selectedObject && toolMode === "select" && (() => {
            // Floating cancel button at the top-right corner of the selected element
            const box = layoutBounds([selectedObject], seatTypes);
            if (!box) return null;
            const left = stagePos.x + (box.maxX + 8) * scale;
            const top = stagePos.y + (box.minY - 8) * scale;
            if (left < 0 || top < 0 || left > stageSize.w || top > stageSize.h) return null;
            return (
              <>
                <button
                  onClick={handleDuplicate}
                  title="Copy this element"
                  aria-label="Copy selected element"
                  className="absolute z-10 w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-700 hover:bg-slate-900 text-white shadow-md flex items-center justify-center border-2 border-white"
                  style={{ left: left - 30, top }}
                >
                  <Copy className="w-3 h-3" />
                </button>
                <button
                  onClick={handleDelete}
                  title="Remove this element"
                  aria-label="Remove selected element"
                  className="absolute z-10 w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-md flex items-center justify-center border-2 border-white"
                  style={{ left, top }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            );
          })()}

          {objects.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="pointer-events-auto max-w-sm rounded-2xl border border-slate-200 bg-white/95 p-6 text-center shadow-xl">
                <FilePlus2 className="w-8 h-8 mx-auto text-sky-600 mb-2" />
                <h3 className="text-sm font-bold text-slate-900">Blank page</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Build your layout by hand. Click “Add seat block” on the left to place rows of seats, then add a screen, shapes and icons, and set colours and seat types on the right. Or start from a ready-made layout.
                </p>
                <button
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-bold"
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Choose a template
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PARAMETRIC OBJECT INSPECTOR */}
        <div className="w-96 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="flex border-b border-slate-200 shrink-0">
            {(
              [
                { id: "properties", label: "Properties" },
                { id: "seatTypes", label: `Seat types (${seatTypes.length})` },
                { id: "spacing", label: "Spacing" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setInspectorTab(tab.id)}
                className={`flex-1 py-2 text-[11px] font-bold border-b-2 transition-colors ${
                  inspectorTab === tab.id ? "border-red-500 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {inspectorTab === "seatTypes" && (
            <SeatTypesPanel seatTypes={seatTypes} usage={seatTypeUsage} onChange={handleSeatTypesChange} />
          )}

          {inspectorTab === "spacing" && (
            <div className="p-4 space-y-4 text-xs">
              <div>
                <span className="font-bold text-[11px] text-sky-700 block">Distance between blocks and screen</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Set the distances in pixels, then press Arrange. Every seat block is stacked under the screen, centred on it.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-slate-500">
                  Screen to first block
                  <DraftNumberInput
                    min={0}
                    max={2000}
                    value={spacingForm.screenGap}
                    onCommit={(n) => setSpacingForm((f) => ({ ...f, screenGap: Math.round(n) }))}
                    className="w-full mt-0.5 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-[11px]"
                    aria-label="Screen to first block distance"
                  />
                </label>
                <label className="text-[10px] text-slate-500">
                  Between blocks
                  <DraftNumberInput
                    min={0}
                    max={2000}
                    value={spacingForm.blockGap}
                    onCommit={(n) => setSpacingForm((f) => ({ ...f, blockGap: Math.round(n) }))}
                    className="w-full mt-0.5 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-[11px]"
                    aria-label="Distance between blocks"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={arrangeBlocks}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 text-white text-[11px] font-bold"
              >
                Arrange blocks under the screen
              </button>

              <div className="border-t border-slate-200 pt-3 space-y-2">
                <span className="font-bold text-[11px] text-sky-700 block">Seat gap and row gap for every block</span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-slate-500">
                    Seat gap
                    <DraftNumberInput
                      min={12}
                      max={52}
                      decimals={1}
                      value={spacingForm.seatGap}
                      onCommit={(n) => setSpacingForm((f) => ({ ...f, seatGap: clampNum(n, 12, 52) }))}
                      className="w-full mt-0.5 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-[11px]"
                      aria-label="Seat gap for all blocks"
                    />
                  </label>
                  <label className="text-[10px] text-slate-500">
                    Row gap
                    <DraftNumberInput
                      min={14}
                      max={70}
                      decimals={1}
                      value={spacingForm.rowGap}
                      onCommit={(n) => setSpacingForm((f) => ({ ...f, rowGap: clampNum(n, 14, 70) }))}
                      className="w-full mt-0.5 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-[11px]"
                      aria-label="Row gap for all blocks"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={applyGapsToAll}
                  className="w-full py-1.5 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700"
                >
                  Apply to every block
                </button>
              </div>
            </div>
          )}

          {inspectorTab === "properties" && (<>
          <div className="p-3 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-red-500" />
              <span className="font-bold text-xs uppercase tracking-wide text-slate-700">
                Object Properties
              </span>
            </div>

            {selectedObject && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDuplicate}
                  className="p-1 text-slate-500 hover:text-slate-900"
                  title="Duplicate Object"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-1 text-red-500 hover:text-red-500"
                  title="Delete Object"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {selectedObject ? (
            <div className="p-4 space-y-4 text-xs">
              {(selectedObject.type === "block" || selectedObject.type === "grid_stand" || selectedObject.type === "curved_stand") && (
                <SeatPicker
                  seats={selectedSeatList}
                  pickedCount={activeSeatKeys.length}
                  boxMode={boxSelect}
                  onToggleBox={() => setBoxSelect((v) => !v)}
                  onPick={(keys) => setSeatSel({ objId: selectedObject.id, keys })}
                />
              )}
              {activeSeatKeys.length > 0 && pickedSeats.length > 0 && (
                <SeatEditorPanel
                  seats={pickedSeats}
                  seatTypes={seatTypes}
                  onType={(id) => applySeatPatch({ seatTypeId: id, color: undefined })}
                  onColor={(color) => applySeatPatch({ color })}
                  onResetLook={() => applySeatPatch({ seatTypeId: undefined, color: undefined })}
                  onRemove={() => applySeatPatch({ removed: true })}
                  onRestore={() => applySeatPatch({ removed: undefined })}
                  onClear={() => setSeatSel(null)}
                />
              )}

              {(selectedObject.type === "block" || isPolygonShape(selectedObject)) && (
                <BlockInspector
                  obj={selectedObject}
                  seatTypes={seatTypes}
                  levels={levels.length > 0 ? levels : ["Lower stand", "Upper stand"]}
                  onPatch={patchSelected}
                  onZoom={() => zoomToObject(selectedObject.id)}
                />
              )}

              {/* Name */}
              <div>
                <label className="text-slate-500 block mb-1">Element Name</label>
                <input
                  type="text"
                  value={selectedObject.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setObjects((prev) =>
                      prev.map((o) => (o.id === selectedObject.id ? { ...o, name: val } : o))
                    );
                  }}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-bold focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Color & Price */}
              {selectedObject.type !== "text_label" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-500 block mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedObject.color}
                      onChange={(e) => {
                        const val = e.target.value;
                        setObjects((prev) =>
                          prev.map((o) => (o.id === selectedObject.id ? { ...o, color: val } : o))
                        );
                      }}
                      className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="font-mono text-slate-700 text-[11px]">{selectedObject.color}</span>
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 block mb-1">Ticket Price (ETB)</label>
                  <input
                    type="number"
                    value={selectedObject.price || 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setObjects((prev) =>
                        prev.map((o) => (o.id === selectedObject.id ? { ...o, price: val } : o))
                      );
                    }}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-emerald-600 font-bold"
                  />
                </div>
              </div>
              )}

              {/* Text settings */}
              {selectedObject.type === "text_label" && (() => {
                const patchText = (patch: Partial<UniversalVenueObject>) => {
                  const merged = { ...selectedObject, ...patch };
                  const box = measureText(merged);
                  patchSelected({ ...patch, width: box.width, height: box.height });
                };
                const toggle = "flex-1 py-1 rounded border text-[11px] font-bold";
                const on = "bg-slate-800 text-white border-slate-800";
                const off = "bg-white text-slate-700 border-slate-300";
                return (
                  <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2.5">
                    <span className="font-bold text-[11px] text-slate-700 block">Text</span>
                    <textarea
                      ref={(el) => {
                        if (el && focusTextRef.current === selectedObject.id) {
                          focusTextRef.current = null;
                          el.focus();
                          el.select();
                        }
                      }}
                      rows={3}
                      value={selectedObject.label || ""}
                      onChange={(e) => patchText({ label: e.target.value })}
                      placeholder="Type your text here (Enter for a new line)"
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-slate-900 text-[12px] focus:outline-none focus:border-red-500"
                      aria-label="Text"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Size</span>
                        <DraftNumberInput
                          value={selectedObject.fontSize || 16}
                          min={6}
                          max={120}
                          onCommit={(n) => patchText({ fontSize: Math.round(n) })}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-[11px]"
                          aria-label="Text size"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Colour</span>
                        <input
                          type="color"
                          value={selectedObject.textColor || selectedObject.color || "#0f172a"}
                          onChange={(e) => patchSelected({ textColor: e.target.value, color: e.target.value })}
                          className="w-full h-7 rounded border-0 bg-transparent cursor-pointer"
                          aria-label="Text colour"
                        />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => patchText({ textBold: selectedObject.textBold === false })}
                        className={toggle + " " + (selectedObject.textBold !== false ? on : off)}
                        aria-label="Bold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => patchText({ textItalic: !selectedObject.textItalic })}
                        className={toggle + " italic " + (selectedObject.textItalic ? on : off)}
                        aria-label="Italic"
                      >
                        I
                      </button>
                      {(["left", "center", "right"] as const).map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => patchText({ textAlign: a })}
                          className={toggle + " capitalize " + ((selectedObject.textAlign || "center") === a ? on : off)}
                          aria-label={"Align " + a}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500">Drag the text on the canvas to move it, or set X / Y below.</p>
                  </div>
                );
              })()}

              {/* Curved Stand Geometry */}
              {selectedObject.type === "curved_stand" && (
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                  <span className="font-bold text-[11px] text-purple-600 block">
                    Curved Sector Arc
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Inner Radius</span>
                      <input
                        type="number"
                        value={selectedObject.innerRadius || 220}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 100;
                          setObjects((prev) =>
                            prev.map((o) => (o.id === selectedObject.id ? { ...o, innerRadius: val } : o))
                          );
                        }}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Outer Radius</span>
                      <input
                        type="number"
                        value={selectedObject.outerRadius || 360}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 200;
                          setObjects((prev) =>
                            prev.map((o) => (o.id === selectedObject.id ? { ...o, outerRadius: val } : o))
                          );
                        }}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Start Angle (°)</span>
                      <input
                        type="number"
                        value={selectedObject.startAngle || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setObjects((prev) =>
                            prev.map((o) => (o.id === selectedObject.id ? { ...o, startAngle: val } : o))
                          );
                        }}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Sweep Angle (°)</span>
                      <input
                        type="number"
                        value={selectedObject.sweepAngle || 90}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 90;
                          setObjects((prev) =>
                            prev.map((o) => (o.id === selectedObject.id ? { ...o, sweepAngle: val } : o))
                          );
                        }}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Rows: any row name, seat count and seat type */}
              {(selectedObject.type === "curved_stand" || selectedObject.type === "grid_stand") && (
                <>
                  <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedObject.showRowLabels !== false}
                      onChange={(e) => patchSelected({ showRowLabels: e.target.checked })}
                      className="mt-0.5 accent-red-600"
                      aria-label="Show row names"
                    />
                    <span className="text-[11px] text-slate-700">
                      <span className="font-bold">Show row names</span>
                      <span className="block text-slate-500">
                        Letters like A, B, C beside each row. Customers see them too. Turn off to hide them everywhere.
                      </span>
                    </span>
                  </label>
                  {selectedObject.type === "grid_stand" && (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
                      <span className="font-bold text-[11px] text-slate-700 block">Block size &amp; spacing</span>
                      <p className="text-[10px] text-slate-500">
                        Drag the square handles on the block&apos;s border to resize it, or type the values here.
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { key: "seatSpacing", label: "Seat gap", def: 18, min: 12, max: 52, step: 1 },
                            { key: "rowSpacing", label: "Row gap", def: 22, min: 14, max: 70, step: 1 },
                            { key: "aisleWidth", label: "Aisle width", def: 1.2, min: 0.4, max: 4, step: 0.1 },
                          ] as const
                        ).map((f) => (
                          <label key={f.key} className="text-[10px] text-slate-500">
                            {f.label}
                            <DraftNumberInput
                              min={f.min}
                              max={f.max}
                              step={f.step}
                              decimals={1}
                              value={selectedObject[f.key] ?? f.def}
                              onCommit={(n) => patchSelected({ [f.key]: clampNum(n, f.min, f.max) })}
                              className="w-full mt-0.5 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-[11px]"
                              aria-label={f.label}
                            />
                          </label>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[10px] text-slate-500">
                          Block width
                          <DraftNumberInput
                            min={60}
                            max={5000}
                            value={gridStandSize(selectedObject, seatTypes).width}
                            onCommit={(n) => patchSelected({ seatSpacing: seatGapForWidth(selectedObject, n) })}
                            className="w-full mt-0.5 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-[11px]"
                            aria-label="Block width"
                          />
                        </label>
                        <label className="text-[10px] text-slate-500">
                          Block height
                          <DraftNumberInput
                            min={20}
                            max={5000}
                            value={gridStandSize(selectedObject, seatTypes).height}
                            onCommit={(n) => patchSelected({ rowSpacing: rowGapForHeight(selectedObject, n) })}
                            className="w-full mt-0.5 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-[11px]"
                            aria-label="Block height"
                          />
                        </label>
                      </div>
                      <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedObject.showSeatNumbers !== false}
                          onChange={(e) => patchSelected({ showSeatNumbers: e.target.checked })}
                          className="accent-red-600"
                          aria-label="Show seat numbers"
                        />
                        Show seat numbers inside the seats
                      </label>
                      <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedObject.showTierHeading !== false}
                          onChange={(e) => patchSelected({ showTierHeading: e.target.checked })}
                          className="accent-red-600"
                          aria-label="Show price heading"
                        />
                        Show price and name above the block
                      </label>
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-0.5">Row names (A, B, C) are shown</span>
                        <select
                          value={selectedObject.rowLabelPlacement || "layout"}
                          onChange={(e) => patchSelected({ rowLabelPlacement: e.target.value as "layout" | "block" })}
                          className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-[11px]"
                          aria-label="Row names position"
                        >
                          <option value="layout">In a column at the far left and right of the layout</option>
                          <option value="block">Right beside this block</option>
                        </select>
                      </div>
                      {selectedObject.showTierHeading !== false && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-2">
                          <span className="font-bold text-[11px] text-slate-700 block">Text above the block</span>
                          <input
                            type="text"
                            value={selectedObject.headingText || ""}
                            onChange={(e) => patchSelected({ headingText: e.target.value })}
                            placeholder="Automatic: price and block name"
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 text-[11px]"
                            aria-label="Text above the block"
                          />
                          <p className="text-[10px] text-slate-500">Drag the text on the canvas while this block is selected, or use the boxes.</p>
                          <div className="grid grid-cols-3 gap-2">
                            <label className="text-[10px] text-slate-500">
                              Left / right
                              <DraftNumberInput
                                min={-1500}
                                max={1500}
                                value={selectedObject.headingOffsetX || 0}
                                onCommit={(n) => patchSelected({ headingOffsetX: Math.round(n) })}
                                className="w-full mt-0.5 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-[11px]"
                                aria-label="Text above block, left or right"
                              />
                            </label>
                            <label className="text-[10px] text-slate-500">
                              Up / down
                              <DraftNumberInput
                                min={-1500}
                                max={1500}
                                value={selectedObject.headingOffsetY || 0}
                                onCommit={(n) => patchSelected({ headingOffsetY: Math.round(n) })}
                                className="w-full mt-0.5 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-[11px]"
                                aria-label="Text above block, up or down"
                              />
                            </label>
                            <label className="text-[10px] text-slate-500">
                              Size
                              <DraftNumberInput
                                min={6}
                                max={60}
                                value={selectedObject.headingFontSize || 12}
                                onCommit={(n) => patchSelected({ headingFontSize: Math.round(n) })}
                                className="w-full mt-0.5 bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-[11px]"
                                aria-label="Text above block size"
                              />
                            </label>
                          </div>
                          <div className="flex gap-1.5">
                            {(["left", "center", "right"] as const).map((a) => (
                              <button
                                key={a}
                                type="button"
                                onClick={() => patchSelected({ headingAlign: a, headingOffsetX: 0 })}
                                className={
                                  "flex-1 py-1 rounded border text-[11px] font-semibold capitalize " +
                                  ((selectedObject.headingAlign || "center") === a
                                    ? "bg-slate-800 text-white border-slate-800"
                                    : "bg-white text-slate-700 border-slate-300")
                                }
                              >
                                {a}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => patchSelected({ headingOffsetX: 0, headingOffsetY: 0, headingAlign: "center", headingText: "" })}
                              className="flex-1 py-1 rounded border border-slate-300 bg-white text-[11px] font-semibold text-slate-700"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => matchSeatSize(selectedObject)}
                          className="py-1.5 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700"
                        >
                          Use this seat size for all blocks
                        </button>
                        <button
                          type="button"
                          onClick={() => matchBlockWidth(selectedObject)}
                          className="py-1.5 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700"
                        >
                          Make all blocks this wide
                        </button>
                        <button
                          type="button"
                          onClick={handleDuplicate}
                          className="py-1.5 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700"
                        >
                          Copy this block
                        </button>
                      </div>
                    </div>
                  )}
                  <RowsEditor obj={selectedObject} seatTypes={seatTypes} onChange={handleRowsChange} />
                </>
              )}

              {/* Seat type for tables */}
              {(selectedObject.type === "table_round" || selectedObject.type === "table_rect") && (
                <div>
                  <label className="text-slate-500 block mb-1">Seat type</label>
                  <select
                    value={selectedObject.seatTypeId || ""}
                    onChange={(e) => patchSelected({ seatTypeId: e.target.value || undefined })}
                    className="w-full bg-white border border-slate-300 rounded px-2 py-1.5 text-slate-900"
                    aria-label="Table seat type"
                  >
                    <option value="">Element colour and price</option>
                    {seatTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.price} ETB
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Table Seat Count */}
              {(selectedObject.type === "table_round" || selectedObject.type === "table_rect") && (
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                  <span className="font-bold text-[11px] text-pink-600 block">
                    Table Setup
                  </span>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Seats Around Table</span>
                    <input
                      type="number"
                      value={selectedObject.tableSeatCount || 8}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 4;
                        setObjects((prev) =>
                          prev.map((o) => (o.id === selectedObject.id ? { ...o, tableSeatCount: val } : o))
                        );
                      }}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-pink-600 font-bold"
                    />
                  </div>
                </div>
              )}

              {/* GA Standing Capacity */}
              {selectedObject.type === "general_admission" && (
                <div>
                  <label className="text-slate-500 block mb-1">Standing Capacity</label>
                  <input
                    type="number"
                    value={selectedObject.standingCapacity || 1000}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 100;
                      setObjects((prev) =>
                        prev.map((o) => (o.id === selectedObject.id ? { ...o, standingCapacity: val } : o))
                      );
                    }}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-emerald-600 font-bold"
                  />
                </div>
              )}

              {/* Shape settings */}
              {selectedObject.type === "shape" && (
                <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                  <span className="font-bold text-[11px] text-sky-600 block">Shape</span>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Kind</span>
                    <select
                      value={selectedObject.shapeKind || "rect"}
                      onChange={(e) => patchSelected({ shapeKind: e.target.value as UniversalVenueObject["shapeKind"] })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                    >
                      <option value="rect">Rectangle</option>
                      <option value="ellipse">Circle / Oval</option>
                      <option value="triangle">Triangle</option>
                      <option value="diamond">Diamond</option>
                      <option value="line">Line / Wall</option>
                      <option value="curve">Curve / Arc</option>
                      <option value="icon">Icon / Sign</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Width</span>
                      <DraftNumberInput
                        min={2}
                        max={4000}
                        value={selectedObject.width}
                        onCommit={(n) => patchSelected({ width: Math.round(n) })}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                        aria-label="Shape width"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Height</span>
                      <DraftNumberInput
                        min={2}
                        max={4000}
                        value={selectedObject.height}
                        onCommit={(n) => patchSelected({ height: Math.round(n) })}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                        aria-label="Shape height"
                      />
                    </div>
                  </div>
                  {selectedObject.shapeKind === "icon" && (
                    <div>
                      <span className="text-[10px] text-slate-500 block">Icon</span>
                      <select
                        value={selectedObject.iconGlyph || ""}
                        onChange={(e) => {
                          const next = ICON_PRESETS.find((i) => i.glyph === e.target.value);
                          patchSelected({ iconGlyph: e.target.value, ...(next ? { color: next.color } : {}) });
                        }}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                        aria-label="Icon"
                      >
                        {ICON_PRESETS.map((i) => (
                          <option key={i.id} value={i.glyph}>
                            {i.glyph} {i.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {selectedObject.shapeKind === "curve" && (
                    <div>
                      <span className="text-[10px] text-slate-500 block">
                        Curve depth {Math.round((selectedObject.curveDepth ?? 1) * 100)}%
                      </span>
                      <input
                        type="range"
                        min={5}
                        max={100}
                        value={Math.round((selectedObject.curveDepth ?? 1) * 100)}
                        onChange={(e) => patchSelected({ curveDepth: parseInt(e.target.value, 10) / 100 })}
                        className="w-full accent-red-500"
                        aria-label="Curve depth"
                      />
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-slate-500 block">Text on shape</span>
                    <input
                      type="text"
                      value={selectedObject.label || ""}
                      onChange={(e) => patchSelected({ label: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900"
                      aria-label="Shape text"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Text colour</span>
                      <input
                        type="color"
                        value={selectedObject.textColor || "#ffffff"}
                        onChange={(e) => patchSelected({ textColor: e.target.value })}
                        className="w-full h-7 rounded border-0 bg-transparent cursor-pointer"
                        aria-label="Text colour"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Text size</span>
                      <input
                        type="number"
                        min={6}
                        max={72}
                        value={selectedObject.fontSize || 12}
                        onChange={(e) => patchSelected({ fontSize: Math.max(6, parseInt(e.target.value, 10) || 12) })}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                        aria-label="Text size"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Border colour</span>
                      <input
                        type="color"
                        value={selectedObject.strokeColor || "#0f172a"}
                        onChange={(e) => patchSelected({ strokeColor: e.target.value })}
                        className="w-full h-7 rounded border-0 bg-transparent cursor-pointer"
                        aria-label="Border colour"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Border width</span>
                      <input
                        type="number"
                        min={0}
                        max={12}
                        value={selectedObject.strokeWidth ?? 1.5}
                        onChange={(e) => patchSelected({ strokeWidth: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                        aria-label="Border width"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Position, rotation and see-through for every element */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                <span className="font-bold text-[11px] text-slate-700 block">Position &amp; look</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 block">X</span>
                    <input
                      type="number"
                      value={Math.round(selectedObject.x)}
                      onChange={(e) => patchSelected({ x: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                      aria-label="Position X"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Y</span>
                    <input
                      type="number"
                      value={Math.round(selectedObject.y)}
                      onChange={(e) => patchSelected({ y: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                      aria-label="Position Y"
                    />
                  </div>
                  {(
                    <div>
                      <span className="text-[10px] text-slate-500 block">Rotate °</span>
                      <input
                        type="number"
                        value={Math.round(selectedObject.rotation || 0)}
                        onChange={(e) => patchSelected({ rotation: parseInt(e.target.value, 10) || 0 })}
                        className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono"
                        aria-label="Rotation"
                      />
                    </div>
                  )}
                </div>
                {selectedObject.type === "shape" && (
                  <div>
                    <span className="text-[10px] text-slate-500 block">
                      Opacity {Math.round((selectedObject.opacity ?? 0.92) * 100)}%
                    </span>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={Math.round((selectedObject.opacity ?? 0.92) * 100)}
                      onChange={(e) => patchSelected({ opacity: parseInt(e.target.value, 10) / 100 })}
                      className="w-full accent-red-500"
                      aria-label="Opacity"
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500 space-y-2">
              <Layers className="w-8 h-8 mx-auto text-slate-400" />
              <p className="font-medium text-xs">No Element Selected</p>
              <p className="text-[11px] text-slate-400">
                Click any element on canvas or select from the left sidebar to edit its properties.
              </p>
            </div>
          )}
          </>)}
        </div>
      </div>

      {/* ── BOTTOM METRICS & VALIDATION BAR ── */}
      <div className="bg-white border-t border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-5 font-mono text-[11px]">
          <div>
            <span className="text-slate-500">Total Capacity: </span>
            <span className="font-bold text-amber-600">
              {metrics.totalCapacity.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Seated: </span>
            <span className="font-bold text-blue-600">
              {metrics.seatedCapacity.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Standing: </span>
            <span className="font-bold text-emerald-600">
              {metrics.standingCapacity.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Tables: </span>
            <span className="font-bold text-pink-600">{metrics.totalTables}</span>
          </div>
          <div>
            <span className="text-slate-500">Est. Revenue: </span>
            <span className="font-bold text-emerald-600">
              {metrics.estimatedRevenue.toLocaleString()} ETB
            </span>
          </div>
        </div>

        {/* Validation indicator */}
        <div className="flex items-center gap-2">
          {validation.isValid ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Geometry Verified</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium" title={validation.warnings.join(", ")}>
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{validation.warnings.length} Warning(s)</span>
            </span>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}
      <TemplatePickerModal
        open={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSelectTemplate={(tmpl) => {
          pushHistorySnapshot();
          setVenueType(tmpl.venueType);
          setLayoutName(tmpl.name);
          setObjects(tmpl.objects);
          fitToContent(tmpl.objects);
          setCategory(categoryForVenueType(tmpl.venueType));
          setSelectedObjectId(tmpl.objects[0]?.id || null);
          toast.success(`Loaded template: ${tmpl.name}`);
        }}
        savedTemplates={savedTemplates}
        savedLoading={savedLoading}
        savedError={savedError}
        onBlank={handleNewBlank}
        onSelectSaved={handleUseSavedTemplate}
        onDeleteSaved={handleDeleteSavedTemplate}
        onToggleShareSaved={handleToggleShareSaved}
      />

      <ConfirmDialog
        open={isBlankConfirmOpen}
        title="Start a blank page?"
        body="This clears every element on the canvas and resets the seat types. Save a template first if you want to reuse this layout."
        confirmLabel="Clear and start blank"
        danger
        theme="light"
        onCancel={() => setIsBlankConfirmOpen(false)}
        onConfirm={() => {
          setIsBlankConfirmOpen(false);
          startBlankLayout();
        }}
      />

      <SaveTemplateModal
        open={isSaveTemplateOpen}
        defaultName={layoutName}
        defaultCategory={category}
        elementCount={objects.length}
        capacity={metrics.totalCapacity}
        saving={savingTemplate}
        onClose={() => setIsSaveTemplateOpen(false)}
        onSave={handleSaveTemplate}
      />

      <TextPromptLayoutModal
        open={isTextPromptModalOpen}
        onClose={() => setIsTextPromptModalOpen(false)}
        onApplyGeneratedLayout={(generatedObjs, promptText) => {
          pushHistorySnapshot();
          setObjects(generatedObjs);
          setSelectedObjectId(generatedObjs[0]?.id || null);
        }}
      />

      <CustomerPreviewModal
        open={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        layoutName={layoutName}
        objects={objects}
        seatTypes={seatTypes}
      />
    </div>
  );
}
