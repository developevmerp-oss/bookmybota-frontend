"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import { Stage, Layer, Rect, Circle, Line, Text, Group, Shape, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
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
  FileImage,
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
} from "lucide-react";
import {
  VenueType,
  ObjectType,
  UniversalVenueObject,
  UniversalVenueLayout,
} from "../types";
import { UNIVERSAL_TEMPLATES } from "../templates/universalTemplates";
import {
  generateSeatsForObject,
  computeLayoutCapacity,
  validateLayout,
} from "../utils/geometryEngine";
import TemplatePickerModal from "./TemplatePickerModal";
import ReferenceImageModal from "./ReferenceImageModal";
import TextPromptLayoutModal from "./TextPromptLayoutModal";
import CustomerPreviewModal from "./CustomerPreviewModal";
import { saveDraftLayoutApi, publishLayoutApi } from "../services/venueDesignerApi";

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
    initialLayout?.name || "New Universal Venue"
  );
  const [venueType, setVenueType] = useState<VenueType>(
    initialLayout?.venueType || "stadium_football"
  );
  const [layoutVersion, setLayoutVersion] = useState<number>(
    initialLayout?.version || 1
  );
  const [layoutStatus, setLayoutStatus] = useState<"DRAFT" | "PUBLISHED" | "ARCHIVED">(
    initialLayout?.status || "DRAFT"
  );

  // Objects list (stands, stages, tables, gates)
  const [objects, setObjects] = useState<UniversalVenueObject[]>(
    initialLayout?.objects || UNIVERSAL_TEMPLATES[0].objects
  );

  // Reference blueprint layer
  const [blueprintUrl, setBlueprintUrl] = useState<string | null>(
    initialLayout?.blueprintUrl || null
  );
  const [blueprintOpacity, setBlueprintOpacity] = useState<number>(
    initialLayout?.blueprintOpacity ?? 0.35
  );
  const [blueprintImg] = useImage(blueprintUrl || "", "anonymous");

  // Selection & UI Modes
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    objects[0]?.id || null
  );
  const [toolMode, setToolMode] = useState<"select" | "pan">("select");
  const [gridSnap, setGridSnap] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(20);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Modals
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [isTextPromptModalOpen, setIsTextPromptModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Canvas Stage controls
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState<number>(0.85);
  const [stagePos, setStagePos] = useState<{ x: number; y: number }>({ x: 60, y: 30 });

  // History stack for Undo/Redo
  const [history, setHistory] = useState<UniversalVenueObject[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const pushHistorySnapshot = useCallback(() => {
    const clone = JSON.parse(JSON.stringify(objects));
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), clone]);
    setHistoryIndex((prev) => prev + 1);
  }, [objects, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const target = history[historyIndex - 1];
      setObjects(JSON.parse(JSON.stringify(target)));
      setHistoryIndex((prev) => prev - 1);
      toast.info("Undo change");
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const target = history[historyIndex + 1];
      setObjects(JSON.parse(JSON.stringify(target)));
      setHistoryIndex((prev) => prev + 1);
      toast.info("Redo change");
    }
  };

  // Zoom controls
  const handleZoomIn = () => setScale((s) => Math.min(3, s + 0.15));
  const handleZoomOut = () => setScale((s) => Math.max(0.3, s - 0.15));
  const handleResetZoom = () => {
    setScale(0.85);
    setStagePos({ x: 60, y: 30 });
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
    const clampedScale = Math.max(0.25, Math.min(3.5, newScale));

    setScale(clampedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    });
  };

  // Compute live layout capacity & financial potential
  const metrics = useMemo(() => computeLayoutCapacity(objects), [objects]);

  // Validation report
  const validation = useMemo(() => validateLayout(objects), [objects]);

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
        name: `Text Label ${count}`,
        type: "text_label",
        x: CX,
        y: CY,
        width: 200,
        height: 30,
        rotation: 0,
        color: "#ffffff",
        label: "VIP CONCOURSE AREA",
        fontSize: 14,
      };
    }

    setObjects((prev) => [...prev, newObj]);
    setSelectedObjectId(newId);
    toast.success(`Added ${newObj.name}`);
  };

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

  // ── 4. SAVE & PUBLISH HANDLERS ──
  const buildCurrentLayoutObject = (status: "DRAFT" | "PUBLISHED"): UniversalVenueLayout => {
    return {
      id: layoutId,
      name: layoutName,
      venueType,
      version: layoutVersion,
      status,
      canvasWidth: CANVAS_W,
      canvasHeight: CANVAS_H,
      gridSnap,
      gridSize,
      blueprintUrl,
      blueprintOpacity,
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

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-white select-none overflow-hidden relative font-sans">
      {/* ── TOP TOOLBAR ── */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 shadow-lg">
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
            className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-red-500 w-52"
            placeholder="Venue Layout Name"
          />

          {/* Status Badge */}
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              layoutStatus === "PUBLISHED"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            }`}
          >
            {layoutStatus} (v{layoutVersion})
          </span>
        </div>

        {/* Quick Actions (Templates, Reference, AI Prompt, Preview) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Templates</span>
          </button>

          <button
            onClick={() => setIsBlueprintModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors"
          >
            <FileImage className="w-3.5 h-3.5 text-blue-400" />
            <span>Reference Image</span>
          </button>

          <button
            onClick={() => setIsTextPromptModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/70 text-purple-200 border border-purple-500/30 font-semibold text-xs transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Prompt</span>
          </button>

          <button
            onClick={() => setIsPreviewModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 font-bold text-xs transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span>Customer Preview</span>
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          {/* Save & Publish Buttons */}
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs transition-colors disabled:opacity-50"
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
      <div className="bg-slate-900/70 border-b border-slate-800 px-4 py-1.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-2">
          {/* Tool Modes */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800">
            <button
              onClick={() => setToolMode("select")}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                toolMode === "select" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              Select
            </button>
            <button
              onClick={() => setToolMode("pan")}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                toolMode === "pan" ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"
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
                ? "bg-slate-800 border-red-500 text-white"
                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <Grid className="w-3 h-3 text-red-400" />
            <span>Snap Grid ({gridSize}px)</span>
          </button>
        </div>

        {/* Viewport Zoom & History */}
        <div className="flex items-center gap-3">
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
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
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
        <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 overflow-hidden">
          {/* Quick Add Palette */}
          <div className="p-3 border-b border-slate-800 space-y-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Add Venue Elements
            </span>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleAddObject("curved_stand")}
                className="flex items-center gap-1.5 p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-[11px] font-medium text-slate-200 hover:text-white transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                <span className="truncate">Curved Stand</span>
              </button>

              <button
                onClick={() => handleAddObject("grid_stand")}
                className="flex items-center gap-1.5 p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-[11px] font-medium text-slate-200 hover:text-white transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-sm bg-blue-500 shrink-0" />
                <span className="truncate">Grid Stand</span>
              </button>

              <button
                onClick={() => handleAddObject("general_admission")}
                className="flex items-center gap-1.5 p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-[11px] font-medium text-slate-200 hover:text-white transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
                <span className="truncate">GA Standing</span>
              </button>

              <button
                onClick={() => handleAddObject("table_round")}
                className="flex items-center gap-1.5 p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-[11px] font-medium text-slate-200 hover:text-white transition-colors"
              >
                <CircleDot className="w-3 h-3 text-pink-400 shrink-0" />
                <span className="truncate">Round Table</span>
              </button>

              <button
                onClick={() => handleAddObject("table_rect")}
                className="flex items-center gap-1.5 p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-[11px] font-medium text-slate-200 hover:text-white transition-colors"
              >
                <Square className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="truncate">Rect Table</span>
              </button>

              <button
                onClick={() => handleAddObject("stage")}
                className="flex items-center gap-1.5 p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-[11px] font-medium text-slate-200 hover:text-white transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-sm bg-red-600 shrink-0" />
                <span className="truncate">Main Stage</span>
              </button>

              <button
                onClick={() => handleAddObject("sports_court")}
                className="flex items-center gap-1.5 p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-[11px] font-medium text-slate-200 hover:text-white transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-sm bg-green-600 shrink-0" />
                <span className="truncate">Sports Turf</span>
              </button>

              <button
                onClick={() => handleAddObject("gate")}
                className="flex items-center gap-1.5 p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left text-[11px] font-medium text-slate-200 hover:text-white transition-colors"
              >
                <DoorOpen className="w-3 h-3 text-purple-400 shrink-0" />
                <span className="truncate">Entrance Gate</span>
              </button>
            </div>
          </div>

          {/* Objects Tree Hierarchy */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Layout Elements ({objects.length})
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {objects.map((obj) => {
              const isSelected = selectedObjectId === obj.id;
              return (
                <div
                  key={obj.id}
                  onClick={() => setSelectedObjectId(obj.id)}
                  className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? "bg-slate-800 border-red-500 shadow-sm ring-1 ring-red-500/30"
                      : "bg-slate-950/60 border-slate-800 hover:bg-slate-850 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: obj.color }}
                    />
                    <span className="text-xs font-bold text-white truncate max-w-[130px]">
                      {obj.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">
                    {obj.type.replace("_", " ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER COLUMN: INTERACTIVE CANVAS */}
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
            onWheel={handleWheel}
            onClick={(e) => {
              if (e.target === e.target.getStage()) {
                setSelectedObjectId(null);
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
                fill="#070a13"
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

              {/* Uploaded Blueprint Image */}
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
                        stroke={isSelected ? "#ffffff" : "#22c55e"}
                        strokeWidth={isSelected ? 3 : 1.5}
                        shadowBlur={isSelected ? 14 : 6}
                        shadowOpacity={0.4}
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

            {/* Stands & Seating Elements Layer */}
            <Layer>
              {objects
                .filter((o) => o.type !== "stage" && o.type !== "sports_court" && o.type !== "gate")
                .map((obj) => {
                  const isSelected = selectedObjectId === obj.id;

                  // 1. Curved Stand (Arc Wedge)
                  if (obj.type === "curved_stand") {
                    const innerR = obj.innerRadius || 220;
                    const outerR = obj.outerRadius || 340;
                    const startAng = ((obj.startAngle || 0) * Math.PI) / 180;
                    const endAng = (((obj.startAngle || 0) + (obj.sweepAngle || 90)) * Math.PI) / 180;

                    const midAng = ((obj.startAngle || 0) + (obj.sweepAngle || 90) / 2) * Math.PI / 180;
                    const midR = (innerR + outerR) / 2;
                    const lx = obj.x + midR * Math.cos(midAng);
                    const ly = obj.y + midR * Math.sin(midAng);

                    return (
                      <Group
                        key={obj.id}
                        onClick={() => setSelectedObjectId(obj.id)}
                      >
                        <Shape
                          x={obj.x}
                          y={obj.y}
                          sceneFunc={(context, shape) => {
                            context.beginPath();
                            context.arc(0, 0, outerR, startAng, endAng, false);
                            context.arc(0, 0, innerR, endAng, startAng, true);
                            context.closePath();
                            context.fillStrokeShape(shape);
                          }}
                          fill={isSelected ? "#e11d48" : obj.color}
                          stroke={isSelected ? "#ffffff" : "#0f172a"}
                          strokeWidth={isSelected ? 3 : 1.5}
                          opacity={0.88}
                        />
                        <Text
                          x={lx - 75}
                          y={ly - 10}
                          width={150}
                          text={obj.name.toUpperCase()}
                          fill="#ffffff"
                          fontStyle="bold"
                          fontSize={11}
                          align="center"
                          listening={false}
                        />
                        <Text
                          x={lx - 75}
                          y={ly + 6}
                          width={150}
                          text={`${obj.price || 0} ETB`}
                          fill="#fef08a"
                          fontFamily="monospace"
                          fontSize={10}
                          align="center"
                          listening={false}
                        />
                      </Group>
                    );
                  }

                  // 2. Grid Stand & GA Standing
                  if (obj.type === "grid_stand" || obj.type === "general_admission") {
                    return (
                      <Group
                        key={obj.id}
                        x={obj.x}
                        y={obj.y}
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
                          fill={isSelected ? "#e11d48" : obj.color}
                          cornerRadius={8}
                          stroke={isSelected ? "#ffffff" : "#0f172a"}
                          strokeWidth={isSelected ? 3 : 1.5}
                          opacity={0.88}
                        />
                        <Text
                          x={-obj.width / 2}
                          y={-10}
                          width={obj.width}
                          text={obj.name.toUpperCase()}
                          fill="#ffffff"
                          fontStyle="bold"
                          fontSize={11}
                          align="center"
                        />
                        <Text
                          x={-obj.width / 2}
                          y={6}
                          width={obj.width}
                          text={
                            obj.type === "general_admission"
                              ? `${obj.standingCapacity} Standing • ${obj.price || 0} ETB`
                              : `${obj.price || 0} ETB`
                          }
                          fill="#fef08a"
                          fontFamily="monospace"
                          fontSize={10}
                          align="center"
                        />
                      </Group>
                    );
                  }

                  // 3. Tables (Round & Rectangular)
                  if (obj.type === "table_round") {
                    const radius = obj.width / 2;
                    const seats = generateSeatsForObject(obj);
                    return (
                      <Group
                        key={obj.id}
                        x={obj.x}
                        y={obj.y}
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
                          fill={isSelected ? "#e11d48" : obj.color}
                          stroke={isSelected ? "#ffffff" : "#0f172a"}
                          strokeWidth={isSelected ? 2.5 : 1}
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
                            radius={4}
                            fill="#ffffff"
                            stroke="#0f172a"
                            strokeWidth={0.8}
                          />
                        ))}
                      </Group>
                    );
                  }

                  return null;
                })}
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
                        stroke={isSelected ? "#ffffff" : "#0f172a"}
                        strokeWidth={isSelected ? 2.5 : 1}
                        shadowBlur={6}
                        shadowOpacity={0.4}
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
          </Stage>
        </div>

        {/* RIGHT COLUMN: PARAMETRIC OBJECT INSPECTOR */}
        <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-red-400" />
              <span className="font-bold text-xs uppercase tracking-wide text-slate-200">
                Object Properties
              </span>
            </div>

            {selectedObject && (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDuplicate}
                  className="p-1 text-slate-400 hover:text-white"
                  title="Duplicate Object"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-1 text-red-400 hover:text-red-300"
                  title="Delete Object"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {selectedObject ? (
            <div className="p-4 space-y-4 text-xs">
              {/* Name */}
              <div>
                <label className="text-slate-400 block mb-1">Element Name</label>
                <input
                  type="text"
                  value={selectedObject.name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setObjects((prev) =>
                      prev.map((o) => (o.id === selectedObject.id ? { ...o, name: val } : o))
                    );
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Color & Price */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Color</label>
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
                    <span className="font-mono text-slate-300 text-[11px]">{selectedObject.color}</span>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Ticket Price (ETB)</label>
                  <input
                    type="number"
                    value={selectedObject.price || 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setObjects((prev) =>
                        prev.map((o) => (o.id === selectedObject.id ? { ...o, price: val } : o))
                      );
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-emerald-400 font-bold"
                  />
                </div>
              </div>

              {/* Curved Stand Geometry */}
              {selectedObject.type === "curved_stand" && (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                  <span className="font-bold text-[11px] text-purple-300 block">
                    Curved Sector Arc
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Inner Radius</span>
                      <input
                        type="number"
                        value={selectedObject.innerRadius || 220}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 100;
                          setObjects((prev) =>
                            prev.map((o) => (o.id === selectedObject.id ? { ...o, innerRadius: val } : o))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Outer Radius</span>
                      <input
                        type="number"
                        value={selectedObject.outerRadius || 360}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 200;
                          setObjects((prev) =>
                            prev.map((o) => (o.id === selectedObject.id ? { ...o, outerRadius: val } : o))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Start Angle (°)</span>
                      <input
                        type="number"
                        value={selectedObject.startAngle || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setObjects((prev) =>
                            prev.map((o) => (o.id === selectedObject.id ? { ...o, startAngle: val } : o))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Sweep Angle (°)</span>
                      <input
                        type="number"
                        value={selectedObject.sweepAngle || 90}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 90;
                          setObjects((prev) =>
                            prev.map((o) => (o.id === selectedObject.id ? { ...o, sweepAngle: val } : o))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Row & Seat Count */}
              {(selectedObject.type === "curved_stand" || selectedObject.type === "grid_stand") && (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                  <span className="font-bold text-[11px] text-blue-300 block">
                    Rows &amp; Seats Configuration
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Start Row</span>
                      <input
                        type="text"
                        value={selectedObject.rowStart || "A"}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setObjects((prev) =>
                            prev.map((o) => (o.id === selectedObject.id ? { ...o, rowStart: val } : o))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">End Row</span>
                      <input
                        type="text"
                        value={selectedObject.rowEnd || "J"}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setObjects((prev) =>
                            prev.map((o) => (o.id === selectedObject.id ? { ...o, rowEnd: val } : o))
                          );
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold text-center"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block">Seats Per Row</span>
                    <input
                      type="number"
                      value={selectedObject.seatsPerRow || 24}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 10;
                        setObjects((prev) =>
                          prev.map((o) => (o.id === selectedObject.id ? { ...o, seatsPerRow: val } : o))
                        );
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Table Seat Count */}
              {(selectedObject.type === "table_round" || selectedObject.type === "table_rect") && (
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                  <span className="font-bold text-[11px] text-pink-300 block">
                    Table Setup
                  </span>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Seats Around Table</span>
                    <input
                      type="number"
                      value={selectedObject.tableSeatCount || 8}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 4;
                        setObjects((prev) =>
                          prev.map((o) => (o.id === selectedObject.id ? { ...o, tableSeatCount: val } : o))
                        );
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-pink-400 font-bold"
                    />
                  </div>
                </div>
              )}

              {/* GA Standing Capacity */}
              {selectedObject.type === "general_admission" && (
                <div>
                  <label className="text-slate-400 block mb-1">Standing Capacity</label>
                  <input
                    type="number"
                    value={selectedObject.standingCapacity || 1000}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 100;
                      setObjects((prev) =>
                        prev.map((o) => (o.id === selectedObject.id ? { ...o, standingCapacity: val } : o))
                      );
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-emerald-400 font-bold"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500 space-y-2">
              <Layers className="w-8 h-8 mx-auto text-slate-600" />
              <p className="font-medium text-xs">No Element Selected</p>
              <p className="text-[11px] text-slate-600">
                Click any element on canvas or select from the left sidebar to edit its properties.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM METRICS & VALIDATION BAR ── */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
        <div className="flex items-center gap-5 font-mono text-[11px]">
          <div>
            <span className="text-slate-400">Total Capacity: </span>
            <span className="font-bold text-amber-300">
              {metrics.totalCapacity.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Seated: </span>
            <span className="font-bold text-blue-300">
              {metrics.seatedCapacity.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Standing: </span>
            <span className="font-bold text-emerald-300">
              {metrics.standingCapacity.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Tables: </span>
            <span className="font-bold text-pink-300">{metrics.totalTables}</span>
          </div>
          <div>
            <span className="text-slate-400">Est. Revenue: </span>
            <span className="font-bold text-emerald-400">
              {metrics.estimatedRevenue.toLocaleString()} ETB
            </span>
          </div>
        </div>

        {/* Validation indicator */}
        <div className="flex items-center gap-2">
          {validation.isValid ? (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Geometry Verified</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium" title={validation.warnings.join(", ")}>
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
          setSelectedObjectId(tmpl.objects[0]?.id || null);
          toast.success(`Loaded template: ${tmpl.name}`);
        }}
      />

      <ReferenceImageModal
        open={isBlueprintModalOpen}
        onClose={() => setIsBlueprintModalOpen(false)}
        blueprintUrl={blueprintUrl}
        blueprintOpacity={blueprintOpacity}
        onSetBlueprintUrl={setBlueprintUrl}
        onSetBlueprintOpacity={setBlueprintOpacity}
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
      />
    </div>
  );
}
