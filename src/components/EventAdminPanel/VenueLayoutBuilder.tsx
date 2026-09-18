"use client";
import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from "react";
import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import { toast } from "sonner";
import { 
  Save, PlusSquare, MousePointer2, Trash2, Eraser, Undo2, Redo2, RotateCcw,
  Hand, ZoomIn, ZoomOut, Maximize2, Minimize2, SlidersHorizontal, X
} from "lucide-react";
import { useGetOrganizerEventQuery, useUpdateEventLayoutMutation, useGetEventLayoutQuery } from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";

type Seat = {
  id?: string;
  internalId: string; // for new seats before save
  ticket_type_id: string | null;
  section_name: string;
  row_label: string;
  seat_label: string;
  coordinate_x: number;
  coordinate_y: number;
  status: string;
  grid_id?: string;
  /** Per-seat display color (row/seat selection). Falls back to sectionColors / defaults. */
  color?: string | null;
};

type Label = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  rotation?: number;
};

type Shape = {
  id: string;
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  text?: string; // Text to overlay on shape
  ticket_type_id?: string; // For General Admission / Section zones
  rotation?: number;
  opacity?: number;
};

type VenueAdapter = {
  sections?: Array<{ id: string; name: string; capacity?: number; price?: number }>;
  initialSeats?: Seat[];
  initialConfig?: {
    labels?: Label[];
    shapes?: Shape[];
    bgImageUrl?: string | null;
    sectionColors?: Record<string, string>;
  };
  maxCapacity?: number;
  saving?: boolean;
  onSave: (
    payload: {
      seating_config: {
        canvasWidth: number;
        canvasHeight: number;
        labels: Label[];
        shapes: Shape[];
        bgImageUrl?: string | null;
        sectionColors?: Record<string, string>;
      };
      seats: Seat[];
    },
    options?: { publish?: boolean; saveAsNew?: boolean }
  ) => Promise<void>;
  onBlankPage?: () => void;
  hideSubmitToVenue?: boolean;
};

type HistorySnapshot = {
  seats: Seat[];
  labels: Label[];
  shapes: Shape[];
  bgImageUrl?: string | null;
  sectionColors?: Record<string, string>;
};

const SECTION_COLOR_PRESETS = [
  "#3b82f6",
  "#16a34a",
  "#dc2626",
  "#f59e0b",
  "#9333ea",
  "#06b6d4",
  "#ec4899",
  "#f97316",
  "#6366f1",
  "#0284c7",
  "#a855f7",
  "#64748b",
];

function defaultSectionColor(sectionName: string): string {
  const name = (sectionName || "").toLowerCase();
  if (name.includes("vip") || name.includes("premium")) return "#f59e0b";
  if (name.includes("category 1") || name.includes("cat 1")) return "#dc2626";
  if (name.includes("category 2") || name.includes("cat 2") || name.includes("east stand")) return "#2563eb";
  if (name.includes("category 3") || name.includes("cat 3") || name.includes("west stand")) return "#16a34a";
  if (name.includes("away")) return "#9333ea";
  if (name.includes("south")) return "#f97316";
  if (name.includes("platinum")) return "#06b6d4";
  if (name.includes("gold")) return "#a855f7";
  if (name.includes("dress")) return "#ec4899";
  if (name.includes("upper balcony")) return "#8b5cf6";
  if (name.includes("recliner")) return "#0284c7";
  if (name.includes("prime")) return "#3b82f6";
  if (name.includes("classic")) return "#6366f1";
  return "#3b82f6";
}

export default function VenueLayoutBuilder({
  eventId,
  venueAdapter,
}: {
  eventId?: string;
  venueAdapter?: VenueAdapter;
}) {
  const skipEvent = !eventId;
  const { data: eventDetails, isLoading: eventLoading } = useGetOrganizerEventQuery(eventId || "", { skip: skipEvent });
  const { data: layoutData, isLoading: layoutLoading, refetch } = useGetEventLayoutQuery(eventId || "", { skip: skipEvent });
  const [saveLayout, { isLoading: isEventSaving }] = useUpdateEventLayoutMutation();
  const isSaving = Boolean(venueAdapter?.saving) || isEventSaving;

  const maxCapacity = useMemo(() => {
    if (typeof venueAdapter?.maxCapacity === "number" && venueAdapter.maxCapacity > 0) {
      return venueAdapter.maxCapacity;
    }
    const layoutCap = (layoutData as any)?.max_capacity ?? (layoutData as any)?.data?.max_capacity;
    if (typeof layoutCap === "number" && layoutCap > 0) {
      return layoutCap;
    }
    return 0;
  }, [venueAdapter?.maxCapacity, layoutData]);

  const [seats, setSeats] = useState<Seat[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [bgImage] = useImage(bgImageUrl || "");
  const [mode, setMode] = useState<"select" | "pan" | "add_seat" | "add_label" | "add_shape" | "bulk_seats" | "eraser">("select");
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [moveEntireSection, setMoveEntireSection] = useState(false);
  const [sectionColors, setSectionColors] = useState<Record<string, string>>({});

  // Undo / Redo History Stack
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [bulkRows, setBulkRows] = useState(5);
  const [bulkCols, setBulkCols] = useState(10);
  const [bulkSection, setBulkSection] = useState("General");
  const [bulkColor, setBulkColor] = useState("#3b82f6");
  const [bulkTicketType, setBulkTicketType] = useState("");
  const [bulkStartRow, setBulkStartRow] = useState("A");
  const [bulkShape, setBulkShape] = useState<"grid" | "curve" | "circle">("grid");
  const [bulkRotation, setBulkRotation] = useState(0);
  const [bulkCurveAngle, setBulkCurveAngle] = useState(180);
  const [applyEntireRow, setApplyEntireRow] = useState(true);

  // Zoom & Pan Interactive State
  const [zoomScale, setZoomScale] = useState(0.48);
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const didInitialFitRef = useRef(false);

  const venueHydratedRef = React.useRef(false);
  const trRef = useRef<any>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const pendingScrollRef = useRef<{ scrollLeft: number; scrollTop: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const isPanningRef = useRef(false);
  const didPanRef = useRef(false);
  const zoomScaleRef = useRef(zoomScale);

  useEffect(() => {
    zoomScaleRef.current = zoomScale;
  }, [zoomScale]);

  // Synchronously update scroll position after DOM re-renders with new canvas scale
  useLayoutEffect(() => {
    if (pendingScrollRef.current && canvasScrollRef.current) {
      const { scrollLeft, scrollTop } = pendingScrollRef.current;
      canvasScrollRef.current.scrollLeft = Math.max(0, scrollLeft);
      canvasScrollRef.current.scrollTop = Math.max(0, scrollTop);
      pendingScrollRef.current = null;
    }
  }, [zoomScale]);

  // Native non-passive wheel listener for smooth, cursor-centered zoom
  useEffect(() => {
    const container = canvasScrollRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const stageEl = canvasWrapperRef.current;
      if (!stageEl) return;

      const currentScale = zoomScaleRef.current;
      const containerRect = container.getBoundingClientRect();
      const stageRect = stageEl.getBoundingClientRect();

      // Mouse position relative to the visible container viewport:
      const mouseViewportX = e.clientX - containerRect.left;
      const mouseViewportY = e.clientY - containerRect.top;

      // Mouse position relative to the stage top-left:
      const mouseOnStageX = e.clientX - stageRect.left;
      const mouseOnStageY = e.clientY - stageRect.top;

      // Coordinate in unscaled canvas space (0..3200, 0..2400):
      const contentX = mouseOnStageX / currentScale;
      const contentY = mouseOnStageY / currentScale;

      // Calculate new scale with smooth step
      // deltaY < 0 = scroll up = zoom in (+15%), deltaY > 0 = scroll down = zoom out (-15%)
      const factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
      const newScale = Math.min(Math.max(Number((currentScale * factor).toFixed(3)), 0.15), 4.0);

      if (Math.abs(newScale - currentScale) < 0.001) return;

      // New pixel offset within the stage canvas after scaling:
      const newMouseOnStageX = contentX * newScale;
      const newMouseOnStageY = contentY * newScale;

      // Target scroll position so the content point stays precisely under the mouse cursor:
      const targetScrollLeft = stageEl.offsetLeft + newMouseOnStageX - mouseViewportX;
      const targetScrollTop = stageEl.offsetTop + newMouseOnStageY - mouseViewportY;

      pendingScrollRef.current = {
        scrollLeft: targetScrollLeft,
        scrollTop: targetScrollTop,
      };

      setZoomScale(newScale);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Spacebar and Esc key listener for pan mode and fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        return;
      }
      const activeTag = (document.activeElement?.tagName || "").toLowerCase();
      if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Global mouse move & mouse up listeners for smooth panning
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current || !panStartRef.current || !canvasScrollRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      if (Math.hypot(dx, dy) > 4) {
        didPanRef.current = true;
      }
      canvasScrollRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      canvasScrollRef.current.scrollTop = panStartRef.current.scrollTop - dy;
    };

    const handleMouseUp = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        panStartRef.current = null;
        setIsPanning(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const fitToScreen = useCallback((instant: boolean | React.SyntheticEvent = false) => {
    const isInstant = instant === true;
    const container = canvasScrollRef.current;
    if (!container) return;

    // Calculate actual bounding box of all elements on the canvas
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (const s of seats) {
      if (s.coordinate_x < minX) minX = s.coordinate_x;
      if (s.coordinate_x > maxX) maxX = s.coordinate_x;
      if (s.coordinate_y < minY) minY = s.coordinate_y;
      if (s.coordinate_y > maxY) maxY = s.coordinate_y;
    }
    for (const sh of shapes) {
      if (sh.x < minX) minX = sh.x;
      if (sh.x + sh.width > maxX) maxX = sh.x + sh.width;
      if (sh.y < minY) minY = sh.y;
      if (sh.y + sh.height > maxY) maxY = sh.y + sh.height;
    }
    for (const l of labels) {
      if (l.x < minX) minX = l.x;
      if (l.x + 120 > maxX) maxX = l.x + 120;
      if (l.y < minY) minY = l.y;
      if (l.y + 40 > maxY) maxY = l.y + 40;
    }

    const hasContent = isFinite(minX) && isFinite(minY);
    const pad = 48;
    const bMinX = hasContent ? Math.max(0, minX - pad) : 200;
    const bMinY = hasContent ? Math.max(0, minY - pad) : 100;
    const bMaxX = hasContent ? Math.min(3200, maxX + pad) : 3000;
    const bMaxY = hasContent ? Math.min(2400, maxY + pad) : 2300;

    const contentWidth = Math.max(bMaxX - bMinX, 300);
    const contentHeight = Math.max(bMaxY - bMinY, 300);
    const centerX = (bMinX + bMaxX) / 2;
    const centerY = (bMinY + bMaxY) / 2;

    const availW = Math.max(container.clientWidth - 24, 200);
    const availH = Math.max(container.clientHeight - 24, 200);

    const scaleX = availW / contentWidth;
    const scaleY = availH / contentHeight;
    const idealScale = Math.min(scaleX, scaleY);
    const targetScale = Math.min(Math.max(Number(idealScale.toFixed(2)), 0.18), 1.8);

    setZoomScale(targetScale);

    const applyScroll = () => {
      if (!canvasScrollRef.current) return;
      const c = canvasScrollRef.current;
      const targetScrollLeft = Math.max(0, Math.round(centerX * targetScale - c.clientWidth / 2));
      const targetScrollTop = Math.max(0, Math.round(centerY * targetScale - c.clientHeight / 2));

      if (isInstant) {
        c.scrollLeft = targetScrollLeft;
        c.scrollTop = targetScrollTop;
      } else {
        c.scrollTo({
          left: targetScrollLeft,
          top: targetScrollTop,
          behavior: "smooth",
        });
      }
    };

    setTimeout(applyScroll, 20);
    setTimeout(applyScroll, 100);
  }, [seats, shapes, labels]);

  // Automatically fit content to screen upon initial load/hydration
  useEffect(() => {
    if ((seats.length > 0 || shapes.length > 0) && !didInitialFitRef.current) {
      didInitialFitRef.current = true;
      const t = setTimeout(() => {
        fitToScreen(true);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [seats.length, shapes.length, fitToScreen]);

  const focusOnSection = useCallback((sectionName: string) => {
    const sectionSeats = seats.filter(s => (s.section_name || "").toLowerCase() === sectionName.toLowerCase());
    if (sectionSeats.length === 0) return;

    const minX = Math.min(...sectionSeats.map(s => s.coordinate_x));
    const maxX = Math.max(...sectionSeats.map(s => s.coordinate_x));
    const minY = Math.min(...sectionSeats.map(s => s.coordinate_y));
    const maxY = Math.max(...sectionSeats.map(s => s.coordinate_y));

    const secWidth = Math.max(maxX - minX, 120);
    const secHeight = Math.max(maxY - minY, 120);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const container = canvasScrollRef.current;
    const availW = container ? container.clientWidth - 160 : 800;
    const availH = container ? container.clientHeight - 160 : 600;

    const idealScale = Math.min(Math.max(Math.min(availW / secWidth, availH / secHeight) * 0.75, 0.8), 2.5);
    const targetScale = Number(idealScale.toFixed(2));
    setZoomScale(targetScale);

    setTimeout(() => {
      if (canvasScrollRef.current && canvasWrapperRef.current) {
        const c = canvasScrollRef.current;
        const w = canvasWrapperRef.current;
        const scrollLeft = w.offsetLeft + centerX * targetScale - c.clientWidth / 2;
        const scrollTop = w.offsetTop + centerY * targetScale - c.clientHeight / 2;
        c.scrollTo({
          left: Math.max(0, scrollLeft),
          top: Math.max(0, scrollTop),
          behavior: "smooth",
        });
      }
    }, 60);

    toast.info(`Focused on ${sectionName} (${sectionSeats.length} seats)`);
  }, [seats]);

  const focusOnShape = useCallback((shapeId: string) => {
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) return;

    const centerX = shape.x + shape.width / 2;
    const centerY = shape.y + shape.height / 2;
    const targetScale = 1.35;
    setZoomScale(targetScale);

    setTimeout(() => {
      if (canvasScrollRef.current && canvasWrapperRef.current) {
        const c = canvasScrollRef.current;
        const w = canvasWrapperRef.current;
        const scrollLeft = w.offsetLeft + centerX * targetScale - c.clientWidth / 2;
        const scrollTop = w.offsetTop + centerY * targetScale - c.clientHeight / 2;
        c.scrollTo({
          left: Math.max(0, scrollLeft),
          top: Math.max(0, scrollTop),
          behavior: "smooth",
        });
      }
    }, 60);

    toast.info(`Focused on ${shape.text || 'Stage element'}`);
  }, [shapes]);

  const focusOnSeatsView = useCallback(() => {
    const targetScale = 1.75;
    setZoomScale(targetScale);
    toast.info("Seat-by-seat inspection view (175%)");
  }, []);

  const handleToggleZoomOnSection = (seat: Seat) => {
    if (zoomScale > 1.2) {
      // Zoom out to overview
      fitToScreen();
      toast.info("Zoomed out to overview");
    } else {
      // Focus on this section
      focusOnSection(seat.section_name || "General");
    }
  };

  const handleToggleZoomOnShape = (shape: Shape) => {
    if (zoomScale > 1.2) {
      fitToScreen();
      toast.info("Zoomed out to overview");
    } else {
      focusOnShape(shape.id);
    }
  };

  const availableSections = useMemo(() => {
    const map = new Map<string, number>();
    for (const seat of seats) {
      const name = seat.section_name || "General";
      map.set(name, (map.get(name) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [seats]);

  const availableStages = useMemo(() => {
    return shapes.filter(s => s.text && (s.text.includes("STAGE") || s.text.includes("PITCH") || s.text.includes("RUNWAY") || s.text.includes("BOX")));
  }, [shapes]);

  // Sync Konva Transformer with the selected Shape or Label node
  useEffect(() => {
    if (trRef.current) {
      const stage = trRef.current.getStage();
      if (!stage) return;

      if (mode !== "select") {
        trRef.current.nodes([]);
        trRef.current.getLayer()?.batchDraw();
        return;
      }

      let selectedNode: any = null;
      if (selectedShapeId) {
        selectedNode = stage.findOne(`#shape-${selectedShapeId}`);
      } else if (selectedLabelId) {
        selectedNode = stage.findOne(`#label-${selectedLabelId}`);
      }

      if (selectedNode) {
        trRef.current.nodes([selectedNode]);
        trRef.current.getLayer()?.batchDraw();
      } else {
        trRef.current.nodes([]);
        trRef.current.getLayer()?.batchDraw();
      }
    }
  }, [selectedShapeId, selectedLabelId, mode, shapes, labels]);

  const pushSnapshot = (
    newSeats: Seat[],
    newLabels: Label[],
    newShapes: Shape[],
    newBg?: string | null,
    newSectionColors?: Record<string, string>
  ) => {
    const finalBg = newBg !== undefined ? newBg : bgImageUrl;
    const finalColors = newSectionColors !== undefined ? newSectionColors : sectionColors;
    const snap: HistorySnapshot = {
      seats: newSeats,
      labels: newLabels,
      shapes: newShapes,
      bgImageUrl: finalBg,
      sectionColors: finalColors,
    };
    setHistory((prev) => {
      const sliced = historyIndex >= 0 ? prev.slice(0, historyIndex + 1) : [];
      const nextHistory = [...sliced, snap].slice(-30);
      setHistoryIndex(nextHistory.length - 1);
      return nextHistory;
    });
    setSeats(newSeats);
    setLabels(newLabels);
    setShapes(newShapes);
    if (newBg !== undefined) setBgImageUrl(newBg);
    if (newSectionColors !== undefined) setSectionColors(newSectionColors);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      const snap = history[prevIdx];
      setHistoryIndex(prevIdx);
      setSeats(snap.seats);
      setLabels(snap.labels);
      setShapes(snap.shapes);
      setBgImageUrl(snap.bgImageUrl || null);
      setSectionColors(snap.sectionColors || {});
      setSelectedSeatId(null);
      setSelectedSeatIds([]);
      setSelectedLabelId(null);
      setSelectedShapeId(null);
      toast.info("Undo");
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      const snap = history[nextIdx];
      setHistoryIndex(nextIdx);
      setSeats(snap.seats);
      setLabels(snap.labels);
      setShapes(snap.shapes);
      setBgImageUrl(snap.bgImageUrl || null);
      setSectionColors(snap.sectionColors || {});
      setSelectedSeatId(null);
      setSelectedSeatIds([]);
      setSelectedLabelId(null);
      setSelectedShapeId(null);
      toast.info("Redo");
    }
  };

  const handleClearCanvas = () => {
    const bookedSeats = seats.filter(s => s.status && s.status !== "AVAILABLE");
    if (bookedSeats.length > 0) {
      toast.error(`Cannot clear canvas: ${bookedSeats.length} seat(s) already have customer bookings!`);
      return;
    }
    if (seats.length === 0 && labels.length === 0 && shapes.length === 0 && !bgImageUrl) return;
    pushSnapshot([], [], [], null, {});
    setSelectedSeatIds([]);
    setSelectedSeatId(null);
    setSelectedLabelId(null);
    setSelectedShapeId(null);
    toast.success("Canvas cleared (Click Undo to restore)");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keybindings if typing in input/textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (isCtrlOrCmd && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (isCtrlOrCmd && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history, historyIndex]);

  useEffect(() => {
    let initSeats: Seat[] = [];
    let initLabels: Label[] = [];
    let initShapes: Shape[] = [];
    let initBg: string | null = null;
    let initColors: Record<string, string> = {};

    if (venueAdapter) {
      if (venueHydratedRef.current) return;
      venueHydratedRef.current = true;
      if (venueAdapter.initialSeats?.length) {
        initSeats = venueAdapter.initialSeats.map((s: Seat) => ({
          ...s,
          internalId: s.internalId || s.id || Math.random().toString(36).substr(2, 9),
          coordinate_x: Number(s.coordinate_x),
          coordinate_y: Number(s.coordinate_y),
          grid_id: s.grid_id || s.section_name,
        }));
      }
      if (venueAdapter.initialConfig?.labels) initLabels = venueAdapter.initialConfig.labels;
      if (venueAdapter.initialConfig?.shapes) initShapes = venueAdapter.initialConfig.shapes;
      if (venueAdapter.initialConfig?.bgImageUrl) initBg = venueAdapter.initialConfig.bgImageUrl;
      if (venueAdapter.initialConfig?.sectionColors) initColors = { ...venueAdapter.initialConfig.sectionColors };
    } else if (layoutData?.data) {
      if (layoutData.data.seats) {
        initSeats = layoutData.data.seats.map((s: any) => ({
          ...s,
          internalId: s.id,
          coordinate_x: Number(s.coordinate_x),
          coordinate_y: Number(s.coordinate_y),
          grid_id: s.grid_id || s.section_name,
        }));
      }
      if (layoutData.data.seating_config?.labels) initLabels = layoutData.data.seating_config.labels;
      if (layoutData.data.seating_config?.shapes) initShapes = layoutData.data.seating_config.shapes;
      if (layoutData.data.seating_config?.bgImageUrl) initBg = layoutData.data.seating_config.bgImageUrl;
      if (layoutData.data.seating_config?.sectionColors) {
        initColors = { ...layoutData.data.seating_config.sectionColors };
      }
    } else {
      return;
    }

    setSeats(initSeats);
    setLabels(initLabels);
    setShapes(initShapes);
    setBgImageUrl(initBg);
    setSectionColors(initColors);
    setHistory([
      {
        seats: initSeats,
        labels: initLabels,
        shapes: initShapes,
        bgImageUrl: initBg,
        sectionColors: initColors,
      },
    ]);
    setHistoryIndex(0);
  }, [layoutData, venueAdapter]);

  const ticketTypes = useMemo(() => {
    if (venueAdapter?.sections?.length) {
      return venueAdapter.sections.map((section) => ({
        id: section.id,
        ticket_type: section.name,
        total_count: section.capacity || 99999,
        price: Number(section.price) || Number((section as { price?: number }).price) || 0,
      }));
    }
    return eventDetails?.ticket_types || [];
  }, [venueAdapter?.sections, eventDetails?.ticket_types]);

  const zoneProgress = useMemo(() => {
    const normalizeZoneKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

    const zones = ticketTypes
      .map((t: { id: string; ticket_type: string; total_count?: number }) => ({
        id: String(t.id),
        name: String(t.ticket_type || ""),
        capacity: Number(t.total_count) || 0,
      }))
      .filter((z: { name: string; capacity: number }) => z.name && z.capacity > 0 && z.capacity < 99999);
    if (zones.length === 0) return [] as Array<{ id: string; name: string; capacity: number; mapped: number }>;

    return zones.map((zone: { id: string; name: string; capacity: number }) => {
      const keys = new Set([normalizeZoneKey(zone.name), normalizeZoneKey(zone.id)]);
      const mapped = seats.filter((s) => {
        const section = normalizeZoneKey(s.section_name);
        const typeId = String(s.ticket_type_id || "");
        if (typeId && (typeId === zone.id || normalizeZoneKey(typeId) === normalizeZoneKey(zone.name))) {
          return true;
        }
        return [...keys].some((k) => k && (section === k || section.includes(k) || k.includes(section)));
      }).length;
      return { ...zone, mapped };
    });
  }, [ticketTypes, seats]);

  const assignTicketType = (typeId: string) => {
    setBulkTicketType(typeId);
    const match = ticketTypes.find((t: { id: string }) => String(t.id) === String(typeId));
    if (match?.ticket_type) {
      setBulkSection(String(match.ticket_type));
    }
  };

  if (!skipEvent && (eventLoading || layoutLoading)) return <div className="p-8 text-center text-zinc-400">Loading editor...</div>;
  if (!skipEvent && !eventDetails) return <div className="p-8 text-center text-rose-500">Event not found.</div>;

  const handleStageMouseDown = (e: any) => {
    const isBg = e.target === e.target.getStage();
    const isMiddleClick = e.evt.button === 1;
    if (isBg || isSpacePressed || mode === "pan" || isMiddleClick) {
      isPanningRef.current = true;
      setIsPanning(true);
      didPanRef.current = false;
      if (canvasScrollRef.current) {
        panStartRef.current = {
          x: e.evt.clientX,
          y: e.evt.clientY,
          scrollLeft: canvasScrollRef.current.scrollLeft,
          scrollTop: canvasScrollRef.current.scrollTop,
        };
      }
    }
  };

  const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === canvasScrollRef.current || isSpacePressed || mode === "pan" || e.button === 1) {
      isPanningRef.current = true;
      setIsPanning(true);
      didPanRef.current = false;
      if (canvasScrollRef.current) {
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: canvasScrollRef.current.scrollLeft,
          scrollTop: canvasScrollRef.current.scrollTop,
        };
      }
    }
  };

  const handleStageClick = (e: any) => {
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    const clickedOnEmpty = e.target === e.target.getStage();
    
    // Calculate correct position taking zoom scale into account
    const getScaledPos = () => {
      const stage = e.target.getStage();
      const pointer = stage.getPointerPosition();
      const transform = stage.getAbsoluteTransform().copy();
      transform.invert();
      return transform.point(pointer);
    };

    if (clickedOnEmpty && mode === "add_seat") {
      const pos = getScaledPos();
      const newSeat: Seat = {
        internalId: Math.random().toString(36).substr(2, 9),
        ticket_type_id: null,
        section_name: "General",
        row_label: "A",
        seat_label: `${seats.length + 1}`,
        coordinate_x: pos.x,
        coordinate_y: pos.y,
        status: "AVAILABLE",
      };
      setSeats([...seats, newSeat]);
    } else if (clickedOnEmpty && mode === "add_label") {
      const pos = getScaledPos();
      const newLabel: Label = {
        id: Math.random().toString(36).substr(2, 9),
        text: "TEXT",
        x: pos.x,
        y: pos.y,
        fontSize: 24,
      };
      setLabels([...labels, newLabel]);
    } else if (clickedOnEmpty && mode === "add_shape") {
      const pos = getScaledPos();
      const newShape: Shape = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'rect',
        x: pos.x,
        y: pos.y,
        width: 300,
        height: 100,
        fill: "#e2e8f0", // slate-200
        text: "STAGE",
      };
      setShapes([...shapes, newShape]);
    } else if (clickedOnEmpty) {
      setSelectedSeatId(null);
      setSelectedSeatIds([]);
      setSelectedLabelId(null);
      setSelectedShapeId(null);
    }
  };

  const handleDragEndLabel = (e: any, labelId: string) => {
    setLabels(labels.map(l => l.id === labelId ? { ...l, x: e.target.x(), y: e.target.y() } : l));
  };

  const handleTransformEndLabel = (e: any, labelId: string) => {
    const node = e.target;
    const rotation = Math.round(node.rotation());
    const scaleX = node.scaleX();
    node.scaleX(1);
    node.scaleY(1);

    const label = labels.find(l => l.id === labelId);
    if (!label) return;

    const newFontSize = Math.max(10, Math.round((label.fontSize || 16) * scaleX));

    setLabels(labels.map(l => l.id === labelId ? {
      ...l,
      x: Math.round(node.x()),
      y: Math.round(node.y()),
      rotation: rotation,
      fontSize: newFontSize,
    } : l));
  };
  
  const handleDragEndShape = (e: any, shapeId: string) => {
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) return;
    const newX = e.target.x() - shape.width / 2;
    const newY = e.target.y() - shape.height / 2;
    setShapes(shapes.map(s => s.id === shapeId ? { ...s, x: newX, y: newY } : s));
  };

  const handleTransformEndShape = (e: any, shapeId: string) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const rotation = Math.round(node.rotation());

    node.scaleX(1);
    node.scaleY(1);

    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) return;

    const newWidth = Math.max(20, Math.round(shape.width * scaleX));
    const newHeight = Math.max(20, Math.round(shape.height * scaleY));
    const newCenterX = node.x();
    const newCenterY = node.y();

    setShapes(shapes.map(s => s.id === shapeId ? {
      ...s,
      x: Math.round(newCenterX - newWidth / 2),
      y: Math.round(newCenterY - newHeight / 2),
      width: newWidth,
      height: newHeight,
      rotation: rotation,
    } : s));
  };

  const handleDragEnd = (e: any, internalId: string) => {
    const oldSeat = seats.find(s => s.internalId === internalId);
    if (!oldSeat) return;

    const dx = e.target.x() - oldSeat.coordinate_x;
    const dy = e.target.y() - oldSeat.coordinate_y;

    if (moveEntireSection && oldSeat.section_name) {
      setSeats(seats.map(s => {
        if (s.section_name === oldSeat.section_name) {
          return {
            ...s,
            coordinate_x: s.coordinate_x + dx,
            coordinate_y: s.coordinate_y + dy,
          };
        }
        return s;
      }));
      toast.success(`Moved entire section: ${oldSeat.section_name}`);
    } else {
      setSeats(seats.map((seat) => {
        if (seat.internalId === internalId) {
          return {
            ...seat,
            coordinate_x: e.target.x(),
            coordinate_y: e.target.y(),
          };
        }
        return seat;
      }));
    }
  };

  const nextRowLabel = (start: string, index: number): string => {
    const s = String(start || "A").trim() || "A";
    if (/^[A-Za-z]$/.test(s)) {
      let n = s.toUpperCase().charCodeAt(0) - 65 + index;
      let result = "";
      while (n >= 0) {
        result = String.fromCharCode(65 + (n % 26)) + result;
        n = Math.floor(n / 26) - 1;
      }
      return result;
    }
    if (/^\d+$/.test(s)) {
      return String(Number(s) + index);
    }
    const m = s.match(/^(.*?)(\d+)$/);
    if (m) {
      return `${m[1]}${Number(m[2]) + index}`;
    }
    return index === 0 ? s : `${s}${index + 1}`;
  };

  const rowRenameFromRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedSeatId) {
      rowRenameFromRef.current = null;
      return;
    }
    const seat = seats.find((s) => s.internalId === selectedSeatId);
    rowRenameFromRef.current = seat?.row_label ?? null;
  }, [selectedSeatId]);

  const renameSelectedRow = (newRowName: string, opts?: { silent?: boolean }) => {
    const selectedSeat = seats.find((s) => s.internalId === selectedSeatId);
    if (!selectedSeat) return;
    const next = String(newRowName || "").trim();
    if (!next) {
      if (!opts?.silent) toast.error("Enter a row name (e.g. A, B, 1, VIP-1).");
      return;
    }
    if (selectedSeat.status && selectedSeat.status !== "AVAILABLE") {
      if (!opts?.silent) toast.error("Cannot rename a booked seat's row.");
      return;
    }
    const oldRow = rowRenameFromRef.current ?? selectedSeat.row_label;
    const section = selectedSeat.section_name;
    if (applyEntireRow) {
      const locked = seats.some(
        (s) =>
          s.section_name === section &&
          s.row_label === oldRow &&
          s.status &&
          s.status !== "AVAILABLE"
      );
      if (locked) {
        if (!opts?.silent) toast.error("This row has booked seats — row name is locked.");
        return;
      }
      setSeats((prev) =>
        prev.map((s) => {
          if (s.internalId === selectedSeatId) return { ...s, row_label: next };
          if (s.section_name === section && s.row_label === oldRow) {
            return { ...s, row_label: next };
          }
          return s;
        })
      );
      rowRenameFromRef.current = next;
      if (!opts?.silent) toast.success(`Row renamed to "${next}" for the whole row.`);
    } else {
      setSeats((prev) => prev.map((s) => (s.internalId === selectedSeatId ? { ...s, row_label: next } : s)));
      rowRenameFromRef.current = next;
    }
  };

  const resolveSeatColor = (seat: Seat | string) => {
    if (typeof seat === "string") {
      const key = String(seat || "General").trim() || "General";
      return sectionColors[key] || defaultSectionColor(key);
    }
    if (seat.color && /^#?[0-9a-fA-F]{3,8}$/.test(seat.color.trim())) {
      return seat.color.startsWith("#") ? seat.color : `#${seat.color}`;
    }
    const key = String(seat.section_name || "General").trim() || "General";
    return sectionColors[key] || defaultSectionColor(key);
  };

  const getActiveSelectionIds = () => {
    if (selectedSeatIds.length > 0) return selectedSeatIds;
    if (selectedSeatId) return [selectedSeatId];
    return [] as string[];
  };

  const selectSeat = (seatId: string, multi: boolean) => {
    setSelectedLabelId(null);
    setSelectedShapeId(null);
    if (multi) {
      setSelectedSeatIds((prev) => {
        const exists = prev.includes(seatId);
        const next = exists ? prev.filter((id) => id !== seatId) : [...prev, seatId];
        setSelectedSeatId(next[next.length - 1] || null);
        return next;
      });
      return;
    }
    setSelectedSeatId(seatId);
    setSelectedSeatIds([seatId]);
  };

  const selectEntireRow = () => {
    const primary = seats.find((s) => s.internalId === selectedSeatId);
    if (!primary) return;
    const ids = seats
      .filter(
        (s) =>
          (s.section_name || "") === (primary.section_name || "") &&
          (s.row_label || "") === (primary.row_label || "")
      )
      .map((s) => s.internalId);
    setSelectedSeatIds(ids);
    setSelectedSeatId(primary.internalId);
    toast.success(`Selected row ${primary.row_label} (${ids.length} seats)`);
  };

  const selectEntireSectionSeats = () => {
    const primary = seats.find((s) => s.internalId === selectedSeatId);
    if (!primary) return;
    const ids = seats
      .filter((s) => (s.section_name || "") === (primary.section_name || ""))
      .map((s) => s.internalId);
    setSelectedSeatIds(ids);
    setSelectedSeatId(primary.internalId);
    toast.success(`Selected section ${primary.section_name} (${ids.length} seats)`);
  };

  const setColorForSelection = (color: string) => {
    const ids = getActiveSelectionIds();
    if (ids.length === 0) return;

    // "Apply to entire section" → color every seat in that section (+ keep section default map)
    if (moveEntireSection && selectedSeatId) {
      const primary = seats.find((s) => s.internalId === selectedSeatId);
      if (primary?.section_name) {
        const sectionName = primary.section_name;
        setSeats((prev) =>
          prev.map((s) => (s.section_name === sectionName ? { ...s, color } : s))
        );
        setSectionColors((prev) => ({ ...prev, [sectionName]: color }));
        toast.success(`Applied color to entire section "${sectionName}"`);
        return;
      }
    }

    // Otherwise only the selected seats / row
    setSeats((prev) =>
      prev.map((s) => (ids.includes(s.internalId) ? { ...s, color } : s))
    );
    toast.success(
      ids.length === 1
        ? "Applied color to selected seat"
        : `Applied color to ${ids.length} selected seats`
    );
  };

  const updateSelectedSeat = (field: keyof Seat, value: string) => {
    const ids = getActiveSelectionIds();
    if (ids.length === 0) return;

    const locked = seats.find(
      (s) =>
        ids.includes(s.internalId) &&
        s.status &&
        s.status !== "AVAILABLE" &&
        (field === "row_label" || field === "seat_label" || field === "section_name" || field === "ticket_type_id")
    );
    if (locked) {
      toast.error(
        `Cannot edit ${field.replace("_", " ")}: Seat ${locked.row_label}-${locked.seat_label} already has customer bookings!`
      );
      return;
    }

    if (moveEntireSection && selectedSeatId && ids.length <= 1) {
      const selectedSeat = seats.find((s) => s.internalId === selectedSeatId);
      if (selectedSeat && selectedSeat.section_name) {
        const oldName = selectedSeat.section_name;
        setSeats(
          seats.map((s) => (s.section_name === oldName ? { ...s, [field]: value } : s))
        );
        if (field === "section_name" && value && value !== oldName) {
          setSectionColors((prev) => {
            const next = { ...prev };
            if (prev[oldName]) {
              next[value] = prev[oldName];
              delete next[oldName];
            }
            return next;
          });
        }
        return;
      }
    }

    setSeats(seats.map((s) => (ids.includes(s.internalId) ? { ...s, [field]: value } : s)));
  };

  const deleteSelectedSeat = () => {
    const ids = getActiveSelectionIds();
    if (ids.length === 0) return;

    const booked = seats.filter(
      (s) => ids.includes(s.internalId) && s.status && s.status !== "AVAILABLE"
    );
    if (booked.length > 0) {
      toast.error(`Cannot delete: ${booked.length} selected seat(s) are already booked/reserved.`);
      return;
    }

    if (moveEntireSection && ids.length <= 1 && selectedSeatId) {
      const selectedSeat = seats.find((s) => s.internalId === selectedSeatId);
      if (selectedSeat) {
        const groupId = selectedSeat.grid_id || selectedSeat.section_name;
        if (groupId) {
          const bookedInGroup = seats.filter(
            (s) => (s.grid_id || s.section_name) === groupId && s.status && s.status !== "AVAILABLE"
          );
          if (bookedInGroup.length > 0) {
            toast.error(
              `Cannot delete entire section: ${bookedInGroup.length} seat(s) are already booked/reserved!`
            );
            return;
          }
          setSeats(seats.filter((s) => (s.grid_id || s.section_name) !== groupId));
          setSelectedSeatId(null);
          setSelectedSeatIds([]);
          toast.success("Deleted entire grid!");
          return;
        }
      }
    }

    setSeats(seats.filter((s) => !ids.includes(s.internalId)));
    setSelectedSeatId(null);
    setSelectedSeatIds([]);
    toast.success(ids.length > 1 ? `Removed ${ids.length} seats` : "Seat removed");
  };

  const deleteSelectedLabel = () => {
    if (!selectedLabelId) return;
    setLabels(labels.filter(l => l.id !== selectedLabelId));
    setSelectedLabelId(null);
  };

  const deleteSelectedShape = () => {
    if (!selectedShapeId) return;
    setShapes(shapes.filter(s => s.id !== selectedShapeId));
    setSelectedShapeId(null);
  };

  const rotateSelectedSection = (angleDegrees: number) => {
    if (!selectedSeatId) return;
    const selectedSeat = seats.find(s => s.internalId === selectedSeatId);
    if (!selectedSeat) return;
    const groupId = selectedSeat.grid_id || selectedSeat.section_name;
    
    const groupSeats = seats.filter(s => (s.grid_id || s.section_name) === groupId);
    if (groupSeats.length === 0) return;

    const minX = Math.min(...groupSeats.map(s => s.coordinate_x));
    const maxX = Math.max(...groupSeats.map(s => s.coordinate_x));
    const minY = Math.min(...groupSeats.map(s => s.coordinate_y));
    const maxY = Math.max(...groupSeats.map(s => s.coordinate_y));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const angleRad = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);

    setSeats(seats.map(s => {
      if ((s.grid_id || s.section_name) === groupId) {
        const dx = s.coordinate_x - centerX;
        const dy = s.coordinate_y - centerY;
        return {
          ...s,
          coordinate_x: centerX + (dx * cos - dy * sin),
          coordinate_y: centerY + (dx * sin + dy * cos),
        };
      }
      return s;
    }));
    toast.success(`Rotated section by ${angleDegrees}°`);
  };

  const generateBulkGrid = () => {
    const offset = Math.min((seats.length % 500) * 0.5, 200);
    const startX = 1600 + offset;
    const startY = 1200 + offset;
    const spacingX = 30;
    const spacingY = 30;
    const gridId = Math.random().toString(36).substr(2, 9);

    let newSeats: Seat[] = [];
    let seatCounter = seats.length + 1;

    for (let r = 0; r < bulkRows; r++) {
      const rowChar = nextRowLabel(bulkStartRow, r);
      for (let c = 0; c < bulkCols; c++) {
        let cx = 0;
        let cy = 0;

        if (bulkShape === "curve" || bulkShape === "circle") {
          const isCircle = bulkShape === "circle";
          const baseRadius = Math.max(bulkCols * 12, 100); 
          const rowRadius = baseRadius + (r * spacingY);
          
          const sweepAngle = isCircle ? (Math.PI * 2) : (bulkCurveAngle * Math.PI) / 180;
          let startAngle = (Math.PI - sweepAngle) / 2;
          if (isCircle) startAngle = 0;

          const angleStep = isCircle ? (sweepAngle / bulkCols) : (sweepAngle / Math.max(1, bulkCols - 1));
          const angle = startAngle + (c * angleStep);
          const rotatedAngle = angle + (bulkRotation * Math.PI) / 180;
          
          cx = startX + (rowRadius * Math.cos(rotatedAngle)) - baseRadius; 
          cy = startY + (rowRadius * Math.sin(rotatedAngle)) - baseRadius;
        } else {
          const px = c * spacingX;
          const py = r * spacingY;
          if (bulkRotation !== 0) {
            const angleRad = (bulkRotation * Math.PI) / 180;
            cx = startX + px * Math.cos(angleRad) - py * Math.sin(angleRad);
            cy = startY + px * Math.sin(angleRad) + py * Math.cos(angleRad);
          } else {
            cx = startX + px;
            cy = startY + py;
          }
        }

        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: bulkTicketType || null,
          section_name: bulkSection,
          row_label: rowChar,
          seat_label: `${c + 1}`,
          coordinate_x: cx,
          coordinate_y: cy,
          status: "AVAILABLE",
          grid_id: gridId,
          color: bulkColor || defaultSectionColor(bulkSection),
        });
        seatCounter++;
      }
    }
    setSeats([...seats, ...newSeats]);
    setSectionColors((prev) => ({
      ...prev,
      [bulkSection.trim() || "General"]: bulkColor || defaultSectionColor(bulkSection),
    }));
    setMode("select");
    toast.success(`Added ${bulkRows * bulkCols} seats in "${bulkSection}"!`);
  };

  const generateTheater = () => {
    const stageShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'rect',
      x: 1200,
      y: 900,
      width: 800,
      height: 200,
      fill: "#334155", // slate-700
      text: "THEATER STAGE",
    };
    
    let newSeats: Seat[] = [];
    const spacing = 30;
    
    const generateStand = (startX: number, startY: number, rows: number, cols: number, section: string, rotation = 0) => {
      const gridId = Math.random().toString(36).substr(2, 9);
      for (let r = 0; r < rows; r++) {
        const rowChar = String.fromCharCode(65 + (r % 26)); 
        for (let c = 0; c < cols; c++) {
          const px = c * spacing;
          const py = r * spacing;
          const angleRad = (rotation * Math.PI) / 180;
          const cx = startX + px * Math.cos(angleRad) - py * Math.sin(angleRad);
          const cy = startY + px * Math.sin(angleRad) + py * Math.cos(angleRad);

          newSeats.push({
            internalId: Math.random().toString(36).substr(2, 9),
            ticket_type_id: null,
            section_name: section,
            row_label: rowChar,
            seat_label: `${c + 1}`,
            coordinate_x: cx,
            coordinate_y: cy,
            status: "AVAILABLE",
            grid_id: gridId,
          });
        }
      }
    };

    generateStand(1390, 1200, 15, 14, "Center Stalls", 0);
    generateStand(1120, 1200, 15, 8, "Left Stalls", 15);
    generateStand(1860, 1140, 15, 8, "Right Stalls", -15);
    generateStand(1240, 1750, 8, 24, "Balcony", 0);

    setShapes(prev => [...prev, stageShape]);
    setSeats(prev => [...prev, ...newSeats]);
    setZoomScale(0.4); 
    toast.success("Generated Classic Theater Template!");
  };

  const generateComedyClub = () => {
    const stageShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'rect',
      x: 1400,
      y: 1100,
      width: 400,
      height: 150,
      fill: "#eab308", // yellow-500
      text: "STAGE",
    };
    
    let newSeats: Seat[] = [];
    const spacing = 35;
    
    const generateTable = (startX: number, startY: number, section: string, rot = 0) => {
      const gridId = Math.random().toString(36).substr(2, 9);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const px = c * spacing;
          const py = r * spacing;
          const angleRad = (rot * Math.PI) / 180;
          const cx = startX + px * Math.cos(angleRad) - py * Math.sin(angleRad);
          const cy = startY + px * Math.sin(angleRad) + py * Math.cos(angleRad);
          newSeats.push({
            internalId: Math.random().toString(36).substr(2, 9),
            ticket_type_id: null,
            section_name: section,
            row_label: "Tbl",
            seat_label: `${r*3 + c + 1}`,
            coordinate_x: cx,
            coordinate_y: cy,
            status: "AVAILABLE",
            grid_id: gridId,
          });
        }
      }
    };

    generateTable(1350, 1350, "Table 1", 10);
    generateTable(1550, 1370, "Table 2", 0);
    generateTable(1750, 1350, "Table 3", -10);

    generateTable(1300, 1450, "Table 4", 15);
    generateTable(1550, 1480, "Table 5", 0);
    generateTable(1800, 1450, "Table 6", -15);
    
    const gaShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'rect',
      x: 1300,
      y: 1600,
      width: 600,
      height: 150,
      fill: "#e2e8f0", 
      text: "STANDING / BAR (Link to GA)",
    };

    setShapes(prev => [...prev, stageShape, gaShape]);
    setSeats(prev => [...prev, ...newSeats]);
    setZoomScale(0.6); 
    toast.success("Generated Comedy Club Template!");
  };

  const generateArena = () => {
    const stageShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'rect',
      x: 1500,
      y: 1100,
      width: 200,
      height: 200,
      fill: "#ef4444", 
      text: "CENTER STAGE",
    };
    
    let newSeats: Seat[] = [];
    const spacing = 30;
    
    const generateStand = (startX: number, startY: number, rows: number, cols: number, section: string, rotation = 0) => {
      const gridId = Math.random().toString(36).substr(2, 9);
      for (let r = 0; r < rows; r++) {
        const rowChar = String.fromCharCode(65 + (r % 26)); 
        for (let c = 0; c < cols; c++) {
          const px = c * spacing;
          const py = r * spacing;
          const angleRad = (rotation * Math.PI) / 180;
          const cx = startX + px * Math.cos(angleRad) - py * Math.sin(angleRad);
          const cy = startY + px * Math.sin(angleRad) + py * Math.cos(angleRad);
          newSeats.push({
            internalId: Math.random().toString(36).substr(2, 9),
            ticket_type_id: null,
            section_name: section,
            row_label: rowChar,
            seat_label: `${c + 1}`,
            coordinate_x: cx,
            coordinate_y: cy,
            status: "AVAILABLE",
            grid_id: gridId,
          });
        }
      }
    };

    generateStand(1300, 750, 10, 20, "North Stand", 0);
    generateStand(1900, 1650, 10, 20, "South Stand", 180);
    generateStand(1450, 915, 10, 20, "West Stand", 90);
    generateStand(1750, 1485, 10, 20, "East Stand", 270);

    setShapes(prev => [...prev, stageShape]);
    setSeats(prev => [...prev, ...newSeats]);
    setZoomScale(0.4); 
    toast.success("Generated Arena Template!");
  };

  const generateConcertHall = () => {
    const stageShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'rect',
      x: 1200,
      y: 600,
      width: 800,
      height: 300,
      fill: "#10b981", 
      text: "MAIN STAGE",
    };
    
    const gaShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'rect',
      x: 1200,
      y: 950,
      width: 800,
      height: 300,
      fill: "#e2e8f0", 
      text: "STANDING / PIT (Link to GA)",
    };

    let newSeats: Seat[] = [];
    const spacing = 30;
    
    const generateStand = (startX: number, startY: number, rows: number, cols: number, section: string, isCurve = false, curveAngle = 180, rotation = 0) => {
      const gridId = Math.random().toString(36).substr(2, 9);
      for (let r = 0; r < rows; r++) {
        const rowChar = String.fromCharCode(65 + (r % 26)); 
        for (let c = 0; c < cols; c++) {
          let cx = 0;
          let cy = 0;
          
          if (isCurve) {
            const baseRadius = 400; // Large sweeping curve
            const rowRadius = baseRadius + (r * spacing);
            const sweepAngle = (curveAngle * Math.PI) / 180;
            const startA = (Math.PI - sweepAngle) / 2;
            const angle = startA + (c / Math.max(1, cols - 1)) * sweepAngle;
            const rotatedAngle = angle + (rotation * Math.PI) / 180;
            cx = startX + (rowRadius * Math.cos(rotatedAngle)) - baseRadius; 
            cy = startY + (rowRadius * Math.sin(rotatedAngle)) - baseRadius;
          } else {
            const px = c * spacing;
            const py = r * spacing;
            const angleRad = (rotation * Math.PI) / 180;
            cx = startX + px * Math.cos(angleRad) - py * Math.sin(angleRad);
            cy = startY + px * Math.sin(angleRad) + py * Math.cos(angleRad);
          }

          newSeats.push({
            internalId: Math.random().toString(36).substr(2, 9),
            ticket_type_id: null,
            section_name: section,
            row_label: rowChar,
            seat_label: `${c + 1}`,
            coordinate_x: cx,
            coordinate_y: cy,
            status: "AVAILABLE",
            grid_id: gridId,
          });
        }
      }
    };

    generateStand(1165, 1300, 15, 30, "Lower Reserved", false, 0, 0);
    
    // Curved balcony embracing the lower reserved
    // Center of curve = 1600, 1100. startX/Y = Center + baseRadius = 1600 + 400 = 2000, 1100 + 400 = 1500.
    // Wait, radius is drawn differently. Just use absolute center.
    // I'll just draw a straight upper balcony, much simpler and safer mathematically.
    generateStand(1015, 1800, 15, 40, "Upper Balcony", false, 0, 0);

    setShapes(prev => [...prev, stageShape, gaShape]);
    setSeats(prev => [...prev, ...newSeats]);
    setZoomScale(0.4); 
    toast.success("Generated Concert Hall Template!");
  };

  const generateConference = () => {
    const stageShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'rect',
      x: 1400,
      y: 800,
      width: 400,
      height: 150,
      fill: "#3b82f6", // blue-500
      text: "SPEAKER PODIUM",
    };
    
    let newSeats: Seat[] = [];
    const spacing = 35;
    
    const generateStand = (startX: number, startY: number, rows: number, cols: number, section: string, rotation = 0) => {
      const gridId = Math.random().toString(36).substr(2, 9);
      for (let r = 0; r < rows; r++) {
        const rowChar = String.fromCharCode(65 + (r % 26)); 
        for (let c = 0; c < cols; c++) {
          const px = c * spacing;
          const py = r * spacing;
          const angleRad = (rotation * Math.PI) / 180;
          const cx = startX + px * Math.cos(angleRad) - py * Math.sin(angleRad);
          const cy = startY + px * Math.sin(angleRad) + py * Math.cos(angleRad);
          newSeats.push({
            internalId: Math.random().toString(36).substr(2, 9),
            ticket_type_id: null,
            section_name: section,
            row_label: rowChar,
            seat_label: `${c + 1}`,
            coordinate_x: cx,
            coordinate_y: cy,
            status: "AVAILABLE",
            grid_id: gridId,
          });
        }
      }
    };

    generateStand(1025, 1100, 25, 15, "Left Block", 0);
    generateStand(1650, 1100, 25, 15, "Right Block", 0);

    setShapes(prev => [...prev, stageShape]);
    setSeats(prev => [...prev, ...newSeats]);
    setZoomScale(0.4); 
    toast.success("Generated Conference Template!");
  };

  const generateFashionShow = () => {
    const stageShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'rect',
      x: 1500,
      y: 800,
      width: 200,
      height: 800,
      fill: "#f43f5e", 
      text: "RUNWAY",
    };
    
    let newSeats: Seat[] = [];
    const spacing = 30;
    
    const generateStand = (startX: number, startY: number, rows: number, cols: number, section: string, rotation = 0) => {
      const gridId = Math.random().toString(36).substr(2, 9);
      for (let r = 0; r < rows; r++) {
        const rowChar = String.fromCharCode(65 + (r % 26)); 
        for (let c = 0; c < cols; c++) {
          const px = c * spacing;
          const py = r * spacing;
          const angleRad = (rotation * Math.PI) / 180;
          const cx = startX + px * Math.cos(angleRad) - py * Math.sin(angleRad);
          const cy = startY + px * Math.sin(angleRad) + py * Math.cos(angleRad);
          newSeats.push({
            internalId: Math.random().toString(36).substr(2, 9),
            ticket_type_id: null,
            section_name: section,
            row_label: rowChar,
            seat_label: `${c + 1}`,
            coordinate_x: cx,
            coordinate_y: cy,
            status: "AVAILABLE",
            grid_id: gridId,
          });
        }
      }
    };

    generateStand(1450, 825, 4, 25, "Left Runway", 90);
    generateStand(1750, 1575, 4, 25, "Right Runway", 270);
    generateStand(1480, 1650, 4, 8, "End of Runway VIP", 0);

    setShapes(prev => [...prev, stageShape]);
    setSeats(prev => [...prev, ...newSeats]);
    setZoomScale(0.4); 
    toast.success("Generated Fashion Show Template!");
  };

  const generateCinemaMultiplex = () => {
    const screenShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'rect',
      x: 1050,
      y: 750,
      width: 1100,
      height: 60,
      fill: "#0284c7",
      text: "CINEMA SCREEN (All eyes this way)",
    };

    const newLabels: Label[] = [
      { id: Math.random().toString(36).substr(2, 9), text: "₹410 RECLINER ROWS", x: 1480, y: 880, fontSize: 16 },
      { id: Math.random().toString(36).substr(2, 9), text: "₹300 PRIME ROWS", x: 1500, y: 1080, fontSize: 16 },
      { id: Math.random().toString(36).substr(2, 9), text: "₹280 CLASSIC PLUS ROWS", x: 1460, y: 1480, fontSize: 16 },
    ];

    let newSeats: Seat[] = [];
    const spacingX = 36;
    const spacingY = 36;
    const reclinerSpacingX = 44;
    const reclinerSpacingY = 46;

    // 1. RECLINER ROWS (A-B)
    const gridRecliner = Math.random().toString(36).substr(2, 9);
    // Row A (24 seats)
    for (let c = 0; c < 24; c++) {
      newSeats.push({
        internalId: Math.random().toString(36).substr(2, 9),
        ticket_type_id: null,
        section_name: "Recliner",
        row_label: "A",
        seat_label: `${c + 1}`.padStart(2, "0"),
        coordinate_x: 1100 + c * reclinerSpacingX,
        coordinate_y: 930,
        status: "AVAILABLE",
        grid_id: gridRecliner,
      });
    }
    // Row B (18 seats centered)
    for (let c = 0; c < 18; c++) {
      newSeats.push({
        internalId: Math.random().toString(36).substr(2, 9),
        ticket_type_id: null,
        section_name: "Recliner",
        row_label: "B",
        seat_label: `${c + 1}`.padStart(2, "0"),
        coordinate_x: 1232 + c * reclinerSpacingX,
        coordinate_y: 930 + reclinerSpacingY,
        status: "AVAILABLE",
        grid_id: gridRecliner,
      });
    }

    // 2. PRIME ROWS (C-H)
    const gridPrime = Math.random().toString(36).substr(2, 9);
    // Row C (Full continuous 28 seats)
    for (let c = 0; c < 28; c++) {
      newSeats.push({
        internalId: Math.random().toString(36).substr(2, 9),
        ticket_type_id: null,
        section_name: "Prime",
        row_label: "C",
        seat_label: `${c + 1}`.padStart(2, "0"),
        coordinate_x: 1110 + c * spacingX,
        coordinate_y: 1130,
        status: "AVAILABLE",
        grid_id: gridPrime,
      });
    }

    // Rows D to H with Left block (01-06), Center block (07-10/12), Right block (13-18/21-25)
    const primeRows = ["D", "E", "F", "G", "H"];
    primeRows.forEach((rLabel, rIdx) => {
      const yPos = 1130 + (rIdx + 1) * spacingY;
      
      // Left Block (01-06)
      for (let c = 0; c < 6; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "Prime",
          row_label: rLabel,
          seat_label: `${c + 1}`.padStart(2, "0"),
          coordinate_x: 1110 + c * spacingX,
          coordinate_y: yPos,
          status: "AVAILABLE",
          grid_id: gridPrime,
        });
      }

      // Middle Block
      const midCols = (rLabel === "D" || rLabel === "E") ? [7, 8, 9, 10] : [7, 8, 9];
      midCols.forEach((seatNum, idx) => {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "Prime",
          row_label: rLabel,
          seat_label: `${seatNum}`.padStart(2, "0"),
          coordinate_x: 1390 + idx * spacingX,
          coordinate_y: yPos,
          status: "AVAILABLE",
          grid_id: gridPrime,
        });
      });

      // Additional center-right block for F, G, H
      if (rLabel === "E" || rLabel === "F" || rLabel === "G" || rLabel === "H") {
        const subCols = rLabel === "H" ? [10, 11, 12] : [11, 12, 13, 14];
        const startSubX = rLabel === "H" ? 1730 : 1700;
        subCols.forEach((seatNum, idx) => {
          newSeats.push({
            internalId: Math.random().toString(36).substr(2, 9),
            ticket_type_id: null,
            section_name: "Prime",
            row_label: rLabel,
            seat_label: `${seatNum}`.padStart(2, "0"),
            coordinate_x: startSubX + idx * spacingX,
            coordinate_y: yPos,
            status: "AVAILABLE",
            grid_id: gridPrime,
          });
        });
      }

      // Right Block
      const rightCols = rLabel === "D" ? [21, 22, 23, 24, 25] : rLabel === "H" ? [13, 14, 15, 16] : [15, 16, 17, 18, 19, 20];
      const startRightX = rLabel === "D" ? 1860 : 1910;
      rightCols.forEach((seatNum, idx) => {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "Prime",
          row_label: rLabel,
          seat_label: `${seatNum}`.padStart(2, "0"),
          coordinate_x: startRightX + idx * spacingX,
          coordinate_y: yPos,
          status: "AVAILABLE",
          grid_id: gridPrime,
        });
      });
    });

    // 3. CLASSIC PLUS ROWS (I-J)
    const gridClassic = Math.random().toString(36).substr(2, 9);
    ["I", "J"].forEach((rLabel, rIdx) => {
      const yPos = 1530 + rIdx * spacingY;
      
      // Block 1 (01-07)
      for (let c = 0; c < 7; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "Classic Plus",
          row_label: rLabel,
          seat_label: `${c + 1}`.padStart(2, "0"),
          coordinate_x: 1110 + c * spacingX,
          coordinate_y: yPos,
          status: "AVAILABLE",
          grid_id: gridClassic,
        });
      }

      // Block 2 (08-14)
      for (let c = 7; c < 14; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "Classic Plus",
          row_label: rLabel,
          seat_label: `${c + 1}`.padStart(2, "0"),
          coordinate_x: 1400 + (c - 7) * spacingX,
          coordinate_y: yPos,
          status: "AVAILABLE",
          grid_id: gridClassic,
        });
      }

      // Block 3 (15-21)
      for (let c = 14; c < 21; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "Classic Plus",
          row_label: rLabel,
          seat_label: `${c + 1}`.padStart(2, "0"),
          coordinate_x: 1680 + (c - 14) * spacingX,
          coordinate_y: yPos,
          status: "AVAILABLE",
          grid_id: gridClassic,
        });
      }

      // Block 4 (22-28)
      for (let c = 21; c < 28; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "Classic Plus",
          row_label: rLabel,
          seat_label: `${c + 1}`.padStart(2, "0"),
          coordinate_x: 1960 + (c - 21) * spacingX,
          coordinate_y: yPos,
          status: "AVAILABLE",
          grid_id: gridClassic,
        });
      }
    });

    pushSnapshot(newSeats, newLabels, [screenShape]);
    setZoomScale(0.45);
    toast.success("Loaded Cinema Multiplex Template!");
  };

  const generateClassicFootballLayout = () => {
    let newShapes: Shape[] = [];
    let newLabels: Label[] = [];
    let newSeats: Seat[] = [];

    // Background layers: grass → road → inner grass → concourse
    newShapes.push(
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 350, y: 50, width: 2500, height: 1900, fill: "#4ade80", text: "" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 420, y: 110, width: 2360, height: 1780, fill: "#6b7280", text: "" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 470, y: 150, width: 2260, height: 1700, fill: "#16a34a", text: "" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 510, y: 180, width: 2180, height: 1640, fill: "#cbd5e1", text: "" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 540, y: 205, width: 2120, height: 1590, fill: "#1e293b", text: "" },
      // Red running track
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 920, y: 560, width: 1360, height: 880, fill: "#991b1b", text: "" },
      // Field grass surround
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1020, y: 640, width: 1160, height: 720, fill: "#15803d", text: "" }
    );

    // Pitch stripes
    for (let s = 0; s < 9; s++) {
      newShapes.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'rect',
        x: 1100 + s * 100,
        y: 710,
        width: 100,
        height: 580,
        fill: s % 2 === 0 ? "#16a34a" : "#15803d",
        text: ""
      });
    }

    // Pitch markings
    newShapes.push(
      // Outer pitch line (white border)
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1100, y: 710, width: 1000, height: 580, fill: "transparent", text: "" },
      // Halfway line
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1598, y: 710, width: 4, height: 580, fill: "#ffffff", text: "" },
      // Center spot
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1596, y: 996, width: 8, height: 8, fill: "#ffffff", text: "" },
      // Left penalty box
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1100, y: 830, width: 160, height: 340, fill: "transparent", text: "" },
      // Left 6-yard box
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1100, y: 910, width: 60, height: 180, fill: "transparent", text: "" },
      // Right penalty box
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1940, y: 830, width: 160, height: 340, fill: "transparent", text: "" },
      // Right 6-yard box
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 2040, y: 910, width: 60, height: 180, fill: "transparent", text: "" },
      // Goals
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1060, y: 950, width: 40, height: 100, fill: "#ffffff", text: "" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 2100, y: 950, width: 40, height: 100, fill: "#ffffff", text: "" }
    );

    // Stand shape zones
    const standDefs = [
      { x: 540, y: 205, width: 2120, height: 340, fill: "#1e40af", text: "NORTH STAND" },      // North
      { x: 540, y: 1455, width: 2120, height: 340, fill: "#7c3aed", text: "SOUTH STAND" },     // South
      { x: 540, y: 545, width: 370, height: 910, fill: "#b45309", text: "WEST STAND" },        // West
      { x: 2290, y: 545, width: 370, height: 910, fill: "#065f46", text: "EAST STAND" },       // East
      { x: 540, y: 205, width: 370, height: 340, fill: "#dc2626", text: "VIP NW" },            // VIP NW corner
      { x: 2290, y: 205, width: 370, height: 340, fill: "#dc2626", text: "VIP NE" },           // VIP NE corner
      { x: 540, y: 1455, width: 370, height: 340, fill: "#dc2626", text: "VIP SW" },           // VIP SW corner
      { x: 2290, y: 1455, width: 370, height: 340, fill: "#dc2626", text: "VIP SE" },          // VIP SE corner
    ];
    standDefs.forEach(sd => {
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', ...sd });
    });

    // Seats - North Stand
    const northGridId = Math.random().toString(36).substr(2, 9);
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 60; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "North Stand",
          row_label: String.fromCharCode(65 + r),
          seat_label: `${c + 1}`,
          coordinate_x: 600 + c * 33,
          coordinate_y: 225 + r * 28,
          status: "AVAILABLE",
          grid_id: northGridId,
        });
      }
    }

    // Seats - South Stand
    const southGridId = Math.random().toString(36).substr(2, 9);
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 60; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "South Stand",
          row_label: String.fromCharCode(65 + r),
          seat_label: `${c + 1}`,
          coordinate_x: 600 + c * 33,
          coordinate_y: 1475 + r * 28,
          status: "AVAILABLE",
          grid_id: southGridId,
        });
      }
    }

    // Seats - West Stand
    const westGridId = Math.random().toString(36).substr(2, 9);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 28; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "West Stand",
          row_label: String.fromCharCode(65 + r),
          seat_label: `${c + 1}`,
          coordinate_x: 558 + r * 32,
          coordinate_y: 565 + c * 30,
          status: "AVAILABLE",
          grid_id: westGridId,
        });
      }
    }

    // Seats - East Stand
    const eastGridId = Math.random().toString(36).substr(2, 9);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 28; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "East Stand",
          row_label: String.fromCharCode(65 + r),
          seat_label: `${c + 1}`,
          coordinate_x: 2308 + r * 32,
          coordinate_y: 565 + c * 30,
          status: "AVAILABLE",
          grid_id: eastGridId,
        });
      }
    }

    // Labels
    newLabels.push(
      { id: Math.random().toString(36).substr(2, 9), text: "CLASSIC\nFOOTBALL\nSTADIUM", x: 80, y: 100, fontSize: 28 },
      { id: Math.random().toString(36).substr(2, 9), text: "LEGEND\n🟦 North Stand\n🟪 South Stand\n🟫 West Stand\n🟩 East Stand\n🟥 VIP Corners", x: 80, y: 260, fontSize: 13 },
      { id: Math.random().toString(36).substr(2, 9), text: "     N\n  W 🧭 E\n     S", x: 2820, y: 1750, fontSize: 22 }
    );

    pushSnapshot(newSeats, newLabels, newShapes);
    setZoomScale(0.42);
    toast.success("Generated Classic Football Layout!");
  };

  const generateEthiopiaFootballStadium = () => {
    let newShapes: Shape[] = [];
    let newLabels: Label[] = [];
    let newSeats: Seat[] = [];

    // 1. Title, Information & Legend Cards (Left Side)
    newLabels.push(
      { id: Math.random().toString(36).substr(2, 9), text: "ETHIOPIA\nFOOTBALL STADIUM\nLAYOUT MAP", x: 120, y: 130, fontSize: 26 },
      {
        id: Math.random().toString(36).substr(2, 9),
        text: "STADIUM INFORMATION\n\nStadium Name : Addis Ababa Stadium\nLocation     : Addis Ababa, Ethiopia\nCapacity     : 62,000 Seats\nPitch Size   : 105m x 68m\nSurface      : Natural Grass",
        x: 120,
        y: 280,
        fontSize: 13,
      },
      {
        id: Math.random().toString(36).substr(2, 9),
        text: "SECTOR LEGEND\n\n🟨 VIP / PREMIUM (VIP A-D)\n🟥 CATEGORY 1 (North/South)\n🟦 CATEGORY 2 (North/East)\n🟩 CATEGORY 3 (West/South)\n🟪 AWAY FANS (West Stand)\n♿ DISABLED SEATING",
        x: 120,
        y: 480,
        fontSize: 13,
      },
      {
        id: Math.random().toString(36).substr(2, 9),
        text: "FACILITIES & GATES\n\n🚪 GATES 1 to 7\n👔 TEAM A & B DRESSING ROOMS\n⚖️ REFEREE ROOM\n🚶 PLAYER TUNNEL\n🚑 MEDICAL & TOILETS",
        x: 120,
        y: 700,
        fontSize: 13,
      },
      {
        id: Math.random().toString(36).substr(2, 9),
        text: "     N\n  W 🧭 E\n     S",
        x: 2780,
        y: 1750,
        fontSize: 22,
      }
    );

    // 2. Outer Landscaped Grass, Perimeter Access Road & Stadium Bowl
    newShapes.push(
      // LAYER 1: Outer natural grass
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 340, y: 20, width: 2520, height: 1960, fill: "#4ade80", text: "" },
      // LAYER 2: Asphalt perimeter access road (grey ring)
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 450, y: 90, width: 2300, height: 1820, fill: "#6b7280", text: "" },
      // LAYER 3: Inner grass strip between road and stadium wall
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 495, y: 130, width: 2210, height: 1740, fill: "#16a34a", text: "" },
      // LAYER 4: Stadium outer concrete wall (light grey border)
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 535, y: 155, width: 2130, height: 1690, fill: "#cbd5e1", text: "" },
      // LAYER 5: Stadium inner concourse floor (dark)
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 560, y: 175, width: 2080, height: 1650, fill: "#1e293b", text: "" },
      // Red Athletic Running Track
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1010, y: 620, width: 1180, height: 760, fill: "#991b1b", text: "" },
      // Inner Field Grass Surround
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1140, y: 700, width: 920, height: 600, fill: "#15803d", text: "" }
    );

    // Football Pitch - Alternating Grass Lawn Stripes
    for (let s = 0; s < 8; s++) {
      newShapes.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'rect',
        x: 1240 + s * 90,
        y: 780,
        width: 90,
        height: 440,
        fill: s % 2 === 0 ? "#16a34a" : "#15803d",
        text: ""
      });
    }

    // Football Pitch - White Line Markings & Goals
    newShapes.push(
      // Outer Boundary Line
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1240, y: 780, width: 720, height: 440, fill: "transparent", text: "" },
      // Halfway Line
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1599, y: 780, width: 2, height: 440, fill: "#ffffff", text: "" },
      // Center Kickoff Circle
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1530, y: 930, width: 140, height: 140, fill: "transparent", text: "" },
      // Center Kickoff Spot
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1597, y: 997, width: 6, height: 6, fill: "#ffffff", text: "" },
      // Left Penalty Box (18-yard box)
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1240, y: 880, width: 130, height: 240, fill: "transparent", text: "" },
      // Left Goal Box (6-yard box)
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1240, y: 935, width: 50, height: 130, fill: "transparent", text: "" },
      // Left Penalty Spot
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1330, y: 997, width: 6, height: 6, fill: "#ffffff", text: "" },
      // Right Penalty Box (18-yard box)
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1830, y: 880, width: 130, height: 240, fill: "transparent", text: "" },
      // Right Goal Box (6-yard box)
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1910, y: 935, width: 50, height: 130, fill: "transparent", text: "" },
      // Right Penalty Spot
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1864, y: 997, width: 6, height: 6, fill: "#ffffff", text: "" },
      // Left Goalpost Net
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1215, y: 960, width: 25, height: 80, fill: "rgba(255,255,255,0.2)", text: "" },
      // Right Goalpost Net
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1960, y: 960, width: 25, height: 80, fill: "rgba(255,255,255,0.2)", text: "" },
      // Pitch Dimension Badge
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1510, y: 800, width: 180, height: 36, fill: "rgba(0,0,0,0.35)", text: "105m x 68m" }
    );

    // Stand Title Header Pills
    newShapes.push(
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1475, y: 155, width: 250, height: 44, fill: "#14532d", text: "NORTH STAND" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1475, y: 1640, width: 250, height: 44, fill: "#14532d", text: "SOUTH STAND" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 600, y: 940, width: 44, height: 180, fill: "#14532d", text: "WEST STAND" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 2555, y: 940, width: 44, height: 180, fill: "#14532d", text: "EAST STAND" }
    );

    const centerX = 1600;
    const centerY = 1000;

    // ==========================================
    // 3. WEST STAND (Curved Green W1 to W18 + Purple Away Strip)
    // ==========================================
    const BW = 76;
    const BH = 64;
    for (let r = 0; r < 9; r++) {
      const angleDeg = 152 + r * 7.8;
      const rad = (angleDeg * Math.PI) / 180;
      const rot = Math.round(angleDeg - 180);

      // Col 1 (Outer Green: W1, W3, W5, W7, W9, W11, W13, W15, W17)
      const r1 = 760;
      const x1 = Math.round(centerX + r1 * Math.cos(rad) - BW / 2);
      const y1 = Math.round(centerY + r1 * Math.sin(rad) - BH / 2);
      const wName1 = `W${r * 2 + 1}`;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: x1, y: y1, width: BW, height: BH, fill: "#16a34a", text: wName1, rotation: rot });

      // Col 2 (Inner Green: W2, W4, W6, W8, W10, W12, W14, W16, W18)
      const r2 = 680;
      const x2 = Math.round(centerX + r2 * Math.cos(rad) - BW / 2);
      const y2 = Math.round(centerY + r2 * Math.sin(rad) - BH / 2);
      const wName2 = `W${r * 2 + 2}`;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: x2, y: y2, width: BW, height: BH, fill: "#16a34a", text: wName2, rotation: rot });

      // Away Fans Strip (Purple)
      const r3 = 600;
      const x3 = Math.round(centerX + r3 * Math.cos(rad) - (BW - 12) / 2);
      const y3 = Math.round(centerY + r3 * Math.sin(rad) - BH / 2);
      const awayName = `AWAY ${r + 1}`;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: x3, y: y3, width: BW - 12, height: BH, fill: "#9333ea", text: awayName, rotation: rot });
    }

    // ==========================================
    // 4. EAST STAND (Curved Blue E1 to E18)
    // ==========================================
    for (let r = 0; r < 9; r++) {
      const angleDeg = -28 + r * 7.8;
      const rad = (angleDeg * Math.PI) / 180;
      const rot = Math.round(angleDeg);

      // Col 1 (Inner Blue: E1, E3, E5... E17)
      const r1 = 680;
      const x1 = Math.round(centerX + r1 * Math.cos(rad) - BW / 2);
      const y1 = Math.round(centerY + r1 * Math.sin(rad) - BH / 2);
      const eName1 = `E${r * 2 + 1}`;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: x1, y: y1, width: BW, height: BH, fill: "#2563eb", text: eName1, rotation: rot });

      // Col 2 (Outer Blue: E2, E4, E6... E18)
      const r2 = 760;
      const x2 = Math.round(centerX + r2 * Math.cos(rad) - BW / 2);
      const y2 = Math.round(centerY + r2 * Math.sin(rad) - BH / 2);
      const eName2 = `E${r * 2 + 2}`;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: x2, y: y2, width: BW, height: BH, fill: "#2563eb", text: eName2, rotation: rot });
    }

    // ==========================================
    // 5. NORTH STAND (Top)
    // ==========================================
    // Center Red Category 1 (N9 to N18 Row 1, N19 to N28 Row 2)
    for (let i = 0; i < 10; i++) {
      const bx = 1250 + i * 70;
      // Row 1
      const nName1 = `N${9 + i}`;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: bx, y: 215, width: 66, height: 60, fill: "#dc2626", text: nName1 });

      // Row 2
      const nName2 = `N${19 + i}`;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: bx, y: 280, width: 66, height: 60, fill: "#dc2626", text: nName2 });
    }

    // North Left Wing Category 2 Blue (N1 to N4 Row 1, N5 to N8 Row 2)
    for (let i = 0; i < 4; i++) {
      const bx = 940 + i * 74;
      const by1 = 250 + (3 - i) * 12;
      const nName1 = `N${1 + i}`;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: bx, y: by1, width: 70, height: 60, fill: "#2563eb", text: nName1 });

      const by2 = 315 + (3 - i) * 12;
      const nName2 = `N${5 + i}`;
      const bx2 = 980 + i * 64;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: bx2, y: by2, width: 64, height: 60, fill: "#2563eb", text: nName2 });
    }

    // North Right Wing Category 2 Blue (N29 to N32 Row 1, N33 to N36 Row 2)
    for (let i = 0; i < 4; i++) {
      const bx = 1960 + i * 74;
      const by1 = 250 + i * 12;
      const nName1 = `N${29 + i}`;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: bx, y: by1, width: 70, height: 60, fill: "#2563eb", text: nName1 });

      const by2 = 315 + i * 12;
      const nName2 = `N${33 + i}`;
      const bx2 = 1960 + i * 64;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: bx2, y: by2, width: 64, height: 60, fill: "#2563eb", text: nName2 });
    }

    // VIP Section (VIP A, VIP B, VIP C, VIP D & Lounge)
    const vips = ["VIP A", "VIP B", "VIP C", "VIP D"];
    vips.forEach((vName, idx) => {
      const bx = 1345 + idx * 130;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: bx, y: 350, width: 124, height: 60, fill: "#f59e0b", text: vName });
    });
    newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1505, y: 415, width: 190, height: 36, fill: "#fbbf24", text: "VIP LOUNGE" });

    // ==========================================
    // 6. SOUTH STAND (Bottom)
    // ==========================================
    // Facilities
    newShapes.push(
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1310, y: 1250, width: 160, height: 52, fill: "#1e3a8a", text: "TEAM A DRESSING ROOM" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1480, y: 1250, width: 100, height: 52, fill: "#f59e0b", text: "REFEREE ROOM" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1590, y: 1250, width: 80, height: 100, fill: "#7c3aed", text: "TUNNEL" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1680, y: 1250, width: 160, height: 52, fill: "#1e3a8a", text: "TEAM B DRESSING ROOM" }
    );

    // South Left Wing (S1-S5, S11-S15, S21-S25)
    for (let c = 0; c < 5; c++) {
      // Row 1: Orange S1-S5
      const sName1 = `S${1 + c}`;
      const bx1 = 1040 + c * 106;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: bx1, y: 1315, width: 100, height: 68, fill: "#f97316", text: sName1 });

      // Row 2: Orange S11-S15
      const sName2 = `S${11 + c}`;
      const bx2 = 1010 + c * 112;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: bx2, y: 1390, width: 106, height: 70, fill: "#f97316", text: sName2 });

      // Row 3: Green S21-S25
      const sName3 = `S${21 + c}`;
      const bx3 = 980 + c * 118;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: bx3, y: 1468, width: 112, height: 74, fill: "#16a34a", text: sName3 });
    }

    // South Right Wing (S6-S10, S16-S20, S26-S30)
    for (let c = 0; c < 5; c++) {
      // Row 1: Orange S6-S10
      const sName1 = `S${6 + c}`;
      const bx1 = 1710 + c * 106;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: bx1, y: 1315, width: 100, height: 68, fill: "#f97316", text: sName1 });

      // Row 2: Orange S16-S20
      const sName2 = `S${16 + c}`;
      const bx2 = 1710 + c * 112;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: bx2, y: 1390, width: 106, height: 70, fill: "#f97316", text: sName2 });

      // Row 3: Green S26-S30
      const sName3 = `S${26 + c}`;
      const bx3 = 1710 + c * 118;
      newShapes.push({ id: Math.random().toString(36).substr(2, 9), type: 'rect', x: bx3, y: 1468, width: 112, height: 74, fill: "#16a34a", text: sName3 });
    }

    // ==========================================
    // 7. GATES (Entrance & Exits)
    // ==========================================
    newShapes.push(
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1510, y: 1710, width: 180, height: 54, fill: "#15803d", text: "GATE 1 - MAIN ENTRANCE" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 820, y: 1590, width: 110, height: 46, fill: "#15803d", text: "GATE 2" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 530, y: 990, width: 110, height: 46, fill: "#15803d", text: "GATE 3" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 860, y: 160, width: 110, height: 46, fill: "#15803d", text: "GATE 4" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 2230, y: 160, width: 110, height: 46, fill: "#15803d", text: "GATE 5" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 2560, y: 990, width: 110, height: 46, fill: "#15803d", text: "GATE 6" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 2270, y: 1590, width: 110, height: 46, fill: "#15803d", text: "GATE 7" }
    );

    pushSnapshot(newSeats, newLabels, newShapes, null);
    setZoomScale(0.42);
    toast.success("Loaded Ethiopia Football Stadium Layout!");
  };

  const generateEthiopiaFullSeatingStadium = () => {
    let newShapes: Shape[] = [];
    let newLabels: Label[] = [];
    let newSeats: Seat[] = [];

    // 1. Title, Specifications & Ticketing Legend (Left Side)
    newLabels.push(
      { id: Math.random().toString(36).substr(2, 9), text: "ETHIOPIA NATIONAL STADIUM\nFULL SEATING & GROUND LAYOUT", x: 60, y: 80, fontSize: 24 },
      {
        id: Math.random().toString(36).substr(2, 9),
        text: "STADIUM SPECIFICATIONS\n\nStadium : Addis Ababa National Stadium\nStandard: FIFA & CAF Category 4 Ground\nCapacity: ~62,000 Spectator Bowl\nPitch   : 105m x 68m Natural Hybrid Grass\nTrack   : 400m Olympic Tartan Athletics Ring",
        x: 60,
        y: 200,
        fontSize: 12,
      },
      {
        id: Math.random().toString(36).substr(2, 9),
        text: "TICKETING SECTORS\n\n🟨 VIP Presidential Box (Center West)\n🟥 Category 1 (North Stand & West Lower)\n🟦 Category 2 (East Grandstand Upper & Lower)\n🟩 Category 3 (West Stand Upper Tier)\n🟧 South Stand (General Supporters)\n🟪 Away Supporters Section (South-East)",
        x: 60,
        y: 400,
        fontSize: 12,
      },
      {
        id: Math.random().toString(36).substr(2, 9),
        text: "FACILITIES & GATES\n\n🚪 Gate 1: VIP & Presidential Protocol\n🚪 Gate 2: North Stand Entrance\n🚪 Gate 3: East Grandstand Entrance\n🚪 Gate 4: South General Turnstiles\n🚪 Gate 5: Away Supporters Turnstiles\n💡 4x High-Mast LED Floodlight Towers\n📺 2x Ultra HD Stadium Scoreboards",
        x: 60,
        y: 600,
        fontSize: 12,
      },
      {
        id: Math.random().toString(36).substr(2, 9),
        text: "     N\n  W 🧭 E\n     S",
        x: 2980,
        y: 1950,
        fontSize: 22,
      }
    );

    // 2. Outer Stadium Grounds, Concourse & Olympic Running Track
    newShapes.push(
      // Outer landscaped green grounds
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 260, y: 40, width: 2680, height: 2320, fill: "#15803d", text: "" },
      // Stadium Outer Concourse / Concrete Ring
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 340, y: 90, width: 2520, height: 2220, fill: "#334155", text: "" },
      // Inner Stadium Bowl Floor
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 370, y: 120, width: 2460, height: 2160, fill: "#0f172a", text: "" },
      // Red Tartan Athletics Running Track (Surrounding Pitch)
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 960, y: 740, width: 1280, height: 920, fill: "#991b1b", text: "" },
      // Track inner red lane
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1040, y: 800, width: 1120, height: 800, fill: "#b91c1c", text: "" },
      // Inner Field Grass Apron
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1160, y: 890, width: 880, height: 620, fill: "#14532d", text: "" }
    );

    // 3. Football Pitch - 10 Alternating Lawn Mow Stripes (105m x 68m)
    for (let s = 0; s < 10; s++) {
      newShapes.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'rect',
        x: 1240 + s * 72,
        y: 970,
        width: 72,
        height: 460,
        fill: s % 2 === 0 ? "#16a34a" : "#15803d",
        text: ""
      });
    }

    // 4. Football Pitch - White Markings, Spots, Arcs & Goal Nets
    newShapes.push(
      // Outer Boundary Line
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1240, y: 970, width: 720, height: 460, fill: "transparent", text: "" },
      // Halfway Line
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1599, y: 970, width: 2, height: 460, fill: "#ffffff", text: "" },
      // Center Kickoff Circle
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1530, y: 1130, width: 140, height: 140, fill: "transparent", text: "" },
      // Center Kickoff Spot
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1597, y: 1197, width: 6, height: 6, fill: "#ffffff", text: "" },
      // Left Penalty Box (18-yard box)
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1240, y: 1070, width: 130, height: 260, fill: "transparent", text: "" },
      // Left Goal Box (6-yard box)
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1240, y: 1135, width: 50, height: 130, fill: "transparent", text: "" },
      // Left Penalty Spot
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1330, y: 1197, width: 6, height: 6, fill: "#ffffff", text: "" },
      // Right Penalty Box (18-yard box)
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1830, y: 1070, width: 130, height: 260, fill: "transparent", text: "" },
      // Right Goal Box (6-yard box)
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1910, y: 1135, width: 50, height: 130, fill: "transparent", text: "" },
      // Right Penalty Spot
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1864, y: 1197, width: 6, height: 6, fill: "#ffffff", text: "" },
      // Left Goalpost Net
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1215, y: 1160, width: 25, height: 80, fill: "rgba(255,255,255,0.3)", text: "" },
      // Right Goalpost Net
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1960, y: 1160, width: 25, height: 80, fill: "rgba(255,255,255,0.3)", text: "" },
      // Pitch Dimension Badge
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1510, y: 985, width: 180, height: 32, fill: "rgba(0,0,0,0.45)", text: "PITCH: 105m x 68m" }
    );

    // 5. Dugouts, Technical Area & Player Tunnel
    newShapes.push(
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1350, y: 1445, width: 150, height: 38, fill: "#1e3a8a", text: "HOME TEAM BENCH" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1550, y: 1448, width: 100, height: 32, fill: "#475569", text: "4TH OFFICIAL / VAR" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1700, y: 1445, width: 150, height: 38, fill: "#7f1d1d", text: "AWAY TEAM BENCH" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1565, y: 1485, width: 70, height: 65, fill: "#7c3aed", text: "TUNNEL" }
    );

    // 6. Stand Headers & Architectural Backdrops
    newShapes.push(
      // North Stand Backdrop
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 940, y: 200, width: 1320, height: 500, fill: "#1e293b", text: "" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1460, y: 210, width: 280, height: 40, fill: "#b91c1c", text: "NORTH STAND (HOME END)" },

      // South Stand Backdrops
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 940, y: 1700, width: 880, height: 500, fill: "#1e293b", text: "" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1220, y: 1710, width: 320, height: 40, fill: "#ea580c", text: "SOUTH STAND - GENERAL SUPPORTERS" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1830, y: 1700, width: 430, height: 500, fill: "#2e1065", text: "" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1875, y: 1710, width: 240, height: 40, fill: "#7e22ce", text: "AWAY SUPPORTERS" },

      // West Stand Backdrops
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 420, y: 680, width: 500, height: 1040, fill: "#1e293b", text: "" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 530, y: 690, width: 280, height: 40, fill: "#14532d", text: "WEST MAIN GRANDSTAND" },
      // VIP Box Plaque
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 440, y: 1040, width: 460, height: 260, fill: "#78350f", text: "" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 550, y: 1045, width: 240, height: 35, fill: "#d97706", text: "👑 VIP PRESIDENTIAL BOX" },

      // East Stand Backdrops
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 2280, y: 680, width: 500, height: 1040, fill: "#1e293b", text: "" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 2390, y: 690, width: 280, height: 40, fill: "#1d4ed8", text: "EAST GRANDSTAND" }
    );

    // 7. REAL INTERACTIVE SEATS ACROSS ALL 4 STANDS
    // A) NORTH STAND (HOME END) - Red Category 1 (12 rows x 42 seats = 504 seats)
    const northGridId = Math.random().toString(36).substr(2, 9);
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 42; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "North Stand - Home End",
          row_label: String.fromCharCode(65 + r),
          seat_label: `${c + 1}`,
          coordinate_x: 965 + c * 30,
          coordinate_y: 270 + r * 34,
          status: "AVAILABLE",
          grid_id: northGridId,
        });
      }
    }

    // B) SOUTH STAND - GENERAL SUPPORTERS (Orange, 10 rows x 26 seats = 260 seats)
    const southGenGridId = Math.random().toString(36).substr(2, 9);
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 26; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "South Stand - General",
          row_label: String.fromCharCode(65 + r),
          seat_label: `${c + 1}`,
          coordinate_x: 965 + c * 32,
          coordinate_y: 1775 + r * 40,
          status: "AVAILABLE",
          grid_id: southGenGridId,
        });
      }
    }

    // C) SOUTH STAND - AWAY SUPPORTERS (Purple, 10 rows x 13 seats = 130 seats)
    const southAwayGridId = Math.random().toString(36).substr(2, 9);
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 13; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "Away Supporters Section",
          row_label: String.fromCharCode(65 + r),
          seat_label: `${c + 1}`,
          coordinate_x: 1850 + c * 31,
          coordinate_y: 1775 + r * 40,
          status: "AVAILABLE",
          grid_id: southAwayGridId,
        });
      }
    }

    // D) WEST STAND - VIP PRESIDENTIAL BOX (Gold Amber, 5 rows x 12 seats = 60 seats)
    const westVipGridId = Math.random().toString(36).substr(2, 9);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 12; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "VIP Presidential Box",
          row_label: String.fromCharCode(65 + r),
          seat_label: `${c + 1}`,
          coordinate_x: 470 + c * 34,
          coordinate_y: 1095 + r * 38,
          status: "AVAILABLE",
          grid_id: westVipGridId,
        });
      }
    }

    // E) WEST STAND - LOWER TIER (Red Cat 1, 8 rows x 12 seats = 96 seats)
    const westLowerGridId = Math.random().toString(36).substr(2, 9);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 12; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "Category 1 - West Stand Lower",
          row_label: String.fromCharCode(65 + r),
          seat_label: `${c + 1}`,
          coordinate_x: 470 + c * 34,
          coordinate_y: 745 + r * 35,
          status: "AVAILABLE",
          grid_id: westLowerGridId,
        });
      }
    }

    // F) WEST STAND - UPPER TIER (Green Cat 3, 9 rows x 12 seats = 108 seats)
    const westUpperGridId = Math.random().toString(36).substr(2, 9);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 12; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "Category 3 - West Stand Upper",
          row_label: String.fromCharCode(65 + r),
          seat_label: `${c + 1}`,
          coordinate_x: 470 + c * 34,
          coordinate_y: 1335 + r * 35,
          status: "AVAILABLE",
          grid_id: westUpperGridId,
        });
      }
    }

    // G) EAST STAND - LOWER TIER (Royal Blue Cat 2, 12 rows x 12 seats = 144 seats)
    const eastLowerGridId = Math.random().toString(36).substr(2, 9);
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 12; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "Category 2 - East Stand Lower",
          row_label: String.fromCharCode(65 + r),
          seat_label: `${c + 1}`,
          coordinate_x: 2340 + c * 34,
          coordinate_y: 745 + r * 38,
          status: "AVAILABLE",
          grid_id: eastLowerGridId,
        });
      }
    }

    // H) EAST STAND - UPPER TIER (Royal Blue Cat 2, 12 rows x 12 seats = 144 seats)
    const eastUpperGridId = Math.random().toString(36).substr(2, 9);
    for (let r = 0; r < 12; r++) {
      for (let c = 0; c < 12; c++) {
        newSeats.push({
          internalId: Math.random().toString(36).substr(2, 9),
          ticket_type_id: null,
          section_name: "Category 2 - East Stand Upper",
          row_label: String.fromCharCode(65 + r),
          seat_label: `${c + 1}`,
          coordinate_x: 2340 + c * 34,
          coordinate_y: 1245 + r * 38,
          status: "AVAILABLE",
          grid_id: eastUpperGridId,
        });
      }
    }

    // 8. Stadium Atmosphere: Scoreboards, Floodlights, Gates
    newShapes.push(
      // Ultra HD LED Stadium Scoreboards
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1350, y: 100, width: 500, height: 75, fill: "#020617", text: "⚽ ETHIOPIA NATIONAL STADIUM ⚽\n[ HOME  0 - 0  AWAY ]  |  45:00" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1350, y: 2225, width: 500, height: 60, fill: "#020617", text: "ADDIS ABABA STADIUM  •  CAF / FIFA CERTIFIED" },

      // High-Mast Floodlight Towers at 4 corners
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 440, y: 150, width: 110, height: 110, fill: "#475569", text: "💡 TOWER 1\n(NW LIGHTS)" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 2650, y: 150, width: 110, height: 110, fill: "#475569", text: "💡 TOWER 2\n(NE LIGHTS)" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 440, y: 2130, width: 110, height: 110, fill: "#475569", text: "💡 TOWER 3\n(SW LIGHTS)" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 2650, y: 2130, width: 110, height: 110, fill: "#475569", text: "💡 TOWER 4\n(SE LIGHTS)" },

      // Stadium Entry Gates
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 340, y: 1165, width: 70, height: 90, fill: "#15803d", text: "GATE 1\n(VIP)" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1540, y: 110, width: 120, height: 65, fill: "#15803d", text: "GATE 2 (NORTH)" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 2790, y: 1165, width: 70, height: 90, fill: "#15803d", text: "GATE 3\n(EAST)" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 1320, y: 2215, width: 120, height: 65, fill: "#15803d", text: "GATE 4 (SOUTH)" },
      { id: Math.random().toString(36).substr(2, 9), type: 'rect', x: 2000, y: 2215, width: 120, height: 65, fill: "#7c3aed", text: "GATE 5 (AWAY)" }
    );

    pushSnapshot(newSeats, newLabels, newShapes, null);
    setZoomScale(0.38);
    toast.success("Loaded Ethiopia Football Ground & Seating Layout!");
  };

  const generateGrandAmphitheatre = () => {
    // 1. Stage at bottom
    const stageShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'rect',
      x: 1320,
      y: 1550,
      width: 560,
      height: 110,
      fill: "#f8fafc",
      text: "STAGE",
    };

    // 2. Tier labels + info card (Diamond Box LEFT/RIGHT labels added later after box positions are known)
    const newLabels: Label[] = [
      { id: Math.random().toString(36).substr(2, 9), text: "STAGE",         x: 1570, y: 1590, fontSize: 20 },
      { id: Math.random().toString(36).substr(2, 9), text: "PLATINUM",      x: 1545, y: 1390, fontSize: 16 },
      { id: Math.random().toString(36).substr(2, 9), text: "GOLD",          x: 1575, y: 1050, fontSize: 16 },
      { id: Math.random().toString(36).substr(2, 9), text: "DRESS CIRCLE",  x: 1520, y:  760, fontSize: 16 },
      { id: Math.random().toString(36).substr(2, 9), text: "LOWER BALCONY", x: 1510, y:  540, fontSize: 16 },
      { id: Math.random().toString(36).substr(2, 9), text: "UPPER BALCONY", x: 1510, y:  330, fontSize: 16 },
      {
        id: Math.random().toString(36).substr(2, 9),
        text: "For Each Diamond Box\n• Select 1 seat / ticket to view Diamond Box availability\n• Accommodates 5 people\n• Exclusive access to your personal diamond lounge\n• An ensuite, private powder room\n• Personalised service\n• Specially curated, pre-order food\n  & beverages menu (a la carte menu\n  also available in the lounge)\n• Complimentary high-speed Wi-Fi\n• Personalised reminders at the\n  start of the show and at the end\n  of intermission",
        x: 2380,
        y: 280,
        fontSize: 13,
      },
    ];

    let newSeats: Seat[] = [];
    let newShapes: Shape[] = [stageShape];

    const centerX = 1600;
    const centerY = 1750;

    // Helper to generate concentric curved tiers with Left, Center, Right sub-blocks and radial aisles
    const generateCurvedTier = (
      baseRadius: number,
      rowCount: number,
      seatsPerRow: number,
      sectionPrefix: string,
      startAngleDeg: number,
      endAngleDeg: number,
      aisleGaps: number[] = []
    ) => {
      const gridId = Math.random().toString(36).substr(2, 9);
      const rowSpacing = 28;

      for (let r = 0; r < rowCount; r++) {
        const radius = baseRadius + r * rowSpacing;
        const rowChar = String.fromCharCode(65 + (r % 26));

        for (let c = 0; c < seatsPerRow; c++) {
          if (aisleGaps.includes(c)) continue; // skip radial aisle gaps

          const t = c / Math.max(1, seatsPerRow - 1);
          const angleDeg = startAngleDeg + t * (endAngleDeg - startAngleDeg);
          const angleRad = (angleDeg * Math.PI) / 180;

          const cx = centerX + radius * Math.cos(angleRad);
          const cy = centerY + radius * Math.sin(angleRad);

          // Sub-section name according to Left, Center, Right partitions
          let subSection = `${sectionPrefix} Center`;
          if (c < aisleGaps[0]) subSection = `${sectionPrefix} Left`;
          else if (aisleGaps.length > 1 && c > aisleGaps[1]) subSection = `${sectionPrefix} Right`;

          newSeats.push({
            internalId: Math.random().toString(36).substr(2, 9),
            ticket_type_id: null,
            section_name: subSection,
            row_label: rowChar,
            seat_label: `${c + 1}`.padStart(2, "0"),
            coordinate_x: cx,
            coordinate_y: cy,
            status: "AVAILABLE",
            grid_id: gridId,
          });
        }
      }
    };

    // 1. Platinum (Closest to Stage: 6 rows) — 84° span
    generateCurvedTier(240, 6, 28, "Platinum", 228, 312, [8, 19]);

    // 2. Gold (Middle Tier: 8 rows)
    // Arc angles tightened — 96° span (was 120°) so seating stays compact and leaves wing space for boxes
    generateCurvedTier(440, 8, 34, "Gold", 222, 318, [10, 23]);

    // 3. Dress Circle (Third Tier: 7 rows)
    // Arc angles tightened — 108° span (was 130°)
    generateCurvedTier(700, 7, 38, "Dress Circle", 216, 324, [11, 26]);

    // 4. Lower Balcony (Fourth Tier: 7 rows)
    // Arc angles tightened — 116° span (was 136°)
    generateCurvedTier(930, 7, 44, "Lower Balcony", 212, 328, [13, 30]);

    // 5. Upper Balcony (Top Tier: 8 rows)
    // Arc angles tightened — 124° span (was 140°)
    generateCurvedTier(1160, 8, 48, "Upper Balcony", 208, 332, [14, 33]);

    // 3. Diamond VIP Boxes: 18 Boxes (9 on Left, 9 on Right)
    // Box dimensions: 82 width x 58 height
    const BW = 82;
    const BH = 58;

    // LEFT WING BOXES (Box 01 to 03, 06 to 07, 11 to 14)
    // Coords positioned mathematically outside the seating arc boundary at every tier level
    const leftBoxes = [
      // Row 1 (near stage level) — 3 boxes side-by-side: Inner, Mid, Outer
      { name: "DIAMOND\nBOX 01", x: 1600 - 450, y: 1530 }, // Inner (closest to stage)
      { name: "DIAMOND\nBOX 06", x: 1600 - 550, y: 1530 }, // Mid
      { name: "DIAMOND\nBOX 11", x: 1600 - 650, y: 1530 }, // Outer

      // Row 2 (beside Gold level) — 3 boxes: Inner, Mid, Outer
      { name: "DIAMOND\nBOX 02", x: 1600 - 510, y: 1320 }, // Inner
      { name: "DIAMOND\nBOX 07", x: 1600 - 610, y: 1320 }, // Mid
      { name: "DIAMOND\nBOX 12", x: 1600 - 710, y: 1320 }, // Outer

      // Row 3 (beside Dress Circle level) — 2 boxes: Inner, Outer
      { name: "DIAMOND\nBOX 03", x: 1600 - 640, y: 1110 }, // Inner
      { name: "DIAMOND\nBOX 13", x: 1600 - 740, y: 1110 }, // Outer

      // Row 4 (beside Balcony level) — 1 box: Outer wing
      { name: "DIAMOND\nBOX 14", x: 560,        y:  898 }, // Outer
    ];

    leftBoxes.forEach((box) => {
      newShapes.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'rect',
        x: box.x,
        y: box.y,
        width: BW,
        height: BH,
        fill: "#475569",
        text: box.name,
      });
    });

    // RIGHT WING BOXES (Box 18, 10, 04, 17, 09, 05, 08, 16, 15)
    // Symmetrical to left wing with flipped X coordinates
    const rightBoxes = [
      // Row 1 (near stage level) — 3 boxes: Inner, Mid, Outer
      { name: "DIAMOND\nBOX 18", x: 1600 + 450 - BW, y: 1530 },
      { name: "DIAMOND\nBOX 10", x: 1600 + 550 - BW, y: 1530 },
      { name: "DIAMOND\nBOX 04", x: 1600 + 650 - BW, y: 1530 },

      // Row 2 (beside Gold level) — 3 boxes: Inner, Mid, Outer
      { name: "DIAMOND\nBOX 17", x: 1600 + 510 - BW, y: 1320 },
      { name: "DIAMOND\nBOX 09", x: 1600 + 610 - BW, y: 1320 },
      { name: "DIAMOND\nBOX 05", x: 1600 + 710 - BW, y: 1320 },

      // Row 3 (beside Dress Circle level) — 2 boxes: Inner, Outer
      { name: "DIAMOND\nBOX 08", x: 1600 + 640 - BW, y: 1110 },
      { name: "DIAMOND\nBOX 16", x: 1600 + 740 - BW, y: 1110 },

      // Row 4 (beside Balcony level) — 1 box: Outer wing
      { name: "DIAMOND\nBOX 15", x: 3200 - 560  - BW, y:  898 },
    ];

    rightBoxes.forEach((box) => {
      newShapes.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'rect',
        x: box.x,
        y: box.y,
        width: BW,
        height: BH,
        fill: "#475569",
        text: box.name,
      });
    });

    // "DIAMOND BOX LEFT / RIGHT" title labels — placed at ROW 1 level, just outside boxes
    newLabels.push(
      { id: Math.random().toString(36).substr(2, 9), text: "DIAMOND BOX\nLEFT",  x: 960,  y: 1492, fontSize: 14 },
      { id: Math.random().toString(36).substr(2, 9), text: "DIAMOND BOX\nRIGHT", x: 2060, y: 1492, fontSize: 14 },
    );

    pushSnapshot(newSeats, newLabels, newShapes, null);
    setZoomScale(0.48);
    toast.success("Loaded Grand Theatre Template!");
  };

  const handleSave = async (publish = false, saveAsNew = false) => {
    if (maxCapacity > 0 && seats.length > maxCapacity) {
      toast.error(
        `Validation Failed: Total seats placed (${seats.length}) exceeds the maximum room/screen capacity (${maxCapacity}). Please remove ${seats.length - maxCapacity} seat(s).`
      );
      return;
    }

    if (!venueAdapter) {
      for (const tt of ticketTypes) {
        const assignedSeatsCount = seats.filter(s => s.ticket_type_id === tt.id).length;
        if (assignedSeatsCount > tt.total_count) {
          toast.error(`Validation Failed: You assigned ${assignedSeatsCount} seats to '${tt.ticket_type}', but its total capacity is only ${tt.total_count}. Please update the event ticket capacity or remove some seats.`);
          return;
        }
      }
    }

    try {
      const payload = {
        seating_config: {
          canvasWidth: 3200,
          canvasHeight: 2400,
          labels,
          shapes,
          bgImageUrl: bgImageUrl || undefined,
          sectionColors,
        },
        seats: seats.map((s) => ({
          id: typeof s.id === "string" && !s.id.startsWith("0.") ? s.id : undefined,
          internalId: s.internalId,
          ticket_type_id: s.ticket_type_id || null,
          section_name: s.section_name,
          row_label: s.row_label,
          seat_label: s.seat_label,
          coordinate_x: Number(s.coordinate_x) || 0,
          coordinate_y: Number(s.coordinate_y) || 0,
          status: s.status || "AVAILABLE",
          grid_id: s.grid_id || s.section_name,
          color: s.color || null,
        })),
      };
      if (venueAdapter) {
        await venueAdapter.onSave(payload, { publish, saveAsNew });
        return;
      }
      if (!eventId) return;
      await saveLayout({
        eventId,
        ...payload,
      }).unwrap();
      toast.success("Layout saved successfully!");
      refetch();
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to save layout."));
    }
  };

  const selectedSeat = seats.find(s => s.internalId === selectedSeatId);
  const selectedLabel = labels.find(l => l.id === selectedLabelId);
  const selectedShape = shapes.find(s => s.id === selectedShapeId);

  return (
    <div className={`flex flex-col min-h-0 bg-white shadow-sm transition-all ${
      isFullscreen 
        ? "fixed inset-0 z-[999] w-screen h-screen rounded-none" 
        : "h-full w-full flex-1 border border-slate-200 rounded-2xl overflow-hidden"
    }`}>
      {/* Toolbar — shrink-0 so tools stay visible when canvas fills the studio */}
      <div className="shrink-0 z-30 flex flex-col gap-2 p-3 sm:p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex flex-wrap items-center gap-2">
          <button 
            type="button"
            onClick={() => setMode("select")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "select" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          >
            <MousePointer2 size={16} /> Select
          </button>
          <button 
            type="button"
            onClick={() => setMode("pan")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "pan" ? "bg-rose-50 text-rose-600 border-rose-200 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
            title="Pan layout (or hold Spacebar + drag, or middle-click drag)"
          >
            <Hand size={16} /> Pan
          </button>
          <button 
            type="button"
            onClick={() => setMode("add_seat")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "add_seat" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          >
            <PlusSquare size={16} /> Add Single Seat
          </button>
          <button 
            type="button"
            onClick={() => setMode("bulk_seats")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "bulk_seats" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          >
            <PlusSquare size={16} /> Add Grid
          </button>
          <button 
            type="button"
            onClick={() => setMode("add_label")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "add_label" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          >
            <PlusSquare size={16} /> Add Text
          </button>
          <button 
            type="button"
            onClick={() => setMode("add_shape")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "add_shape" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          >
            <PlusSquare size={16} /> Add Stage Element
          </button>
          <button 
            type="button"
            onClick={() => setMode("eraser")}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "eraser" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          >
            <Eraser size={16} /> Eraser
          </button>

          <div className="hidden sm:block w-px h-8 bg-slate-300 mx-1" />

          {/* Undo / Redo & Clear History Controls */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <button 
              type="button"
              onClick={handleUndo} 
              disabled={historyIndex <= 0}
              className="p-1.5 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent rounded text-slate-700 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button 
              type="button"
              onClick={handleRedo} 
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent rounded text-slate-700 transition-colors"
              title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            >
              <Redo2 size={16} />
            </button>
            <button 
              type="button"
              onClick={handleClearCanvas}
              disabled={seats.length === 0 && labels.length === 0 && shapes.length === 0 && !bgImageUrl}
              className="p-1.5 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent rounded text-slate-500 transition-colors"
              title="Clear Canvas"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          <div className="hidden sm:block w-px h-8 bg-slate-300 mx-1" />

          <select 
            onChange={(e) => {
              if (e.target.value === "classic_football") generateClassicFootballLayout();
              else if (e.target.value === "ethiopia_stadium") generateEthiopiaFootballStadium();
              else if (e.target.value === "ethiopia_football_seats") generateEthiopiaFullSeatingStadium();
              else if (e.target.value === "amphitheatre") generateGrandAmphitheatre();
              else if (e.target.value === "cinema") generateCinemaMultiplex();
              else if (e.target.value === "theater") generateTheater();
              else if (e.target.value === "comedy") generateComedyClub();
              else if (e.target.value === "arena") generateArena();
              else if (e.target.value === "concert") generateConcertHall();
              else if (e.target.value === "conference") generateConference();
              else if (e.target.value === "fashion") generateFashionShow();
              e.target.value = "";
            }}
            className="px-3 sm:px-4 py-2 rounded-lg text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 focus:outline-none cursor-pointer shadow-sm hover:bg-emerald-100 transition-colors"
          >
            <option value="">✨ Add Template...</option>
            <optgroup label="🏟️ Stadiums & Sports">
              <option value="classic_football">⚽ Classic Football Stadium (4 Straight Stands)</option>
              <option value="ethiopia_stadium">🇪🇹 Ethiopia Football Stadium (Addis Ababa Stadium)</option>
              <option value="ethiopia_football_seats">🇪🇹⚽ Ethiopia Football Ground & Seating Stadium (Full Bowl)</option>
              <option value="arena">🥊 Arena (In-The-Round)</option>
            </optgroup>
            <optgroup label="🎭 Theatres & Auditoriums">
              <option value="amphitheatre">🎭 Grand Theatre & Diamond VIP Boxes (Exact NMACC Layout)</option>
              <option value="theater">🏛️ Classic Proscenium Theater</option>
              <option value="concert">🎸 Large Concert Hall</option>
            </optgroup>
            <optgroup label="🎬 Cinema & Screenings">
              <option value="cinema">🎬 Cinema Multiplex (Recliner, Prime, Classic)</option>
            </optgroup>
            <optgroup label="🎤 Clubs & Events">
              <option value="comedy">🎤 Comedy Club Tables & GA Bar</option>
              <option value="fashion">✨ Fashion Show Runway</option>
              <option value="conference">🏫 Conference / Seminar Hall</option>
            </optgroup>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Live Capacity Indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
            maxCapacity > 0 && seats.length > maxCapacity
              ? "bg-rose-50 text-rose-700 border-rose-300 animate-pulse"
              : "bg-white text-slate-700 border-slate-200 shadow-sm"
          }`}>
            <span>🪑 Seats: <strong>{seats.length}</strong></span>
            {selectedSeatIds.length > 1 && (
              <span className="text-rose-600 font-semibold">· {selectedSeatIds.length} selected</span>
            )}
            {maxCapacity > 0 && (
              <>
                <span className="text-slate-400">/</span>
                <span>Max: <strong>{maxCapacity}</strong></span>
              </>
            )}
            {maxCapacity > 0 && seats.length > maxCapacity && (
              <span className="text-rose-600 font-bold ml-1">(!Exceeds Cap)</span>
            )}
          </div>

          {zoneProgress.length > 0 && (
            <div className="flex items-center gap-1.5 max-w-full overflow-x-auto">
              {zoneProgress.map((zone) => {
                const ok = zone.mapped === zone.capacity;
                const over = zone.mapped > zone.capacity;
                return (
                  <span
                    key={zone.id}
                    className={`shrink-0 px-2 py-1 rounded-md border text-[11px] font-semibold ${
                      over
                        ? "bg-rose-50 text-rose-700 border-rose-300"
                        : ok
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : "bg-amber-50 text-amber-800 border-amber-300"
                    }`}
                    title={`Requested by partner: ${zone.capacity} ${zone.name} seats`}
                  >
                    {zone.name} {zone.mapped}/{zone.capacity}
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-1">
            <button type="button" onClick={() => setZoomScale(s => Math.max(0.15, Number((s - 0.1).toFixed(2))))} className="px-2 py-1 hover:bg-slate-100 rounded text-slate-600 font-bold">-</button>
            <span className="text-xs font-semibold text-slate-600 min-w-[44px] text-center">{Math.round(zoomScale * 100)}%</span>
            <button type="button" onClick={() => setZoomScale(s => Math.min(4.0, Number((s + 0.1).toFixed(2))))} className="px-2 py-1 hover:bg-slate-100 rounded text-slate-600 font-bold">+</button>
          </div>

          {/* Properties Toggle & Fullscreen Toggle */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowProperties(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                showProperties
                  ? "bg-rose-50 text-rose-700 border-rose-300 shadow-inner"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
              title={showProperties ? "Hide properties panel to maximize canvas" : "Open properties panel"}
            >
              <SlidersHorizontal size={14} />
              <span>{showProperties ? "Hide Panel" : "Properties"}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsFullscreen(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors ${
                isFullscreen
                  ? "bg-rose-600 text-white border-rose-600 shadow-sm hover:bg-rose-700"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
              title={isFullscreen ? "Exit Fullscreen (Esc)" : "Full Window"}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span className="hidden sm:inline">{isFullscreen ? "Exit" : "Expand"}</span>
            </button>
          </div>

          <button type="button" onClick={() => void handleSave(false)} disabled={isSaving} className="btn-secondary flex items-center gap-2">
            <Save size={16} /> {isSaving ? "Saving..." : venueAdapter ? "Save layout" : "Save Layout"}
          </button>
          {venueAdapter?.hideSubmitToVenue ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave(false, true)}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors flex items-center gap-2"
              title="Keep the current option and also save this canvas as another option"
            >
              <PlusSquare size={16} /> Save as new option
            </button>
          ) : null}
          {venueAdapter?.onBlankPage ? (
            <button
              type="button"
              onClick={() => {
                setSeats([]);
                setLabels([]);
                setShapes([]);
                setSectionColors({});
                setSelectedSeatId(null);
                setSelectedSeatIds([]);
                setHistory([{ seats: [], labels: [], shapes: [], bgImageUrl: null, sectionColors: {} }]);
                setHistoryIndex(0);
                venueAdapter.onBlankPage?.();
                toast.info("Blank page ready — build another option, then Save as new option.");
              }}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Add blank page
            </button>
          ) : null}
          {venueAdapter && !venueAdapter.hideSubmitToVenue ? (
            <button type="button" onClick={() => void handleSave(true)} disabled={isSaving} className="btn-primary flex items-center gap-2">
              {isSaving ? "Submitting..." : "Submit to venue"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Canvas Area with Floating Navigation Dock */}
        <div className="flex-1 relative overflow-hidden flex flex-col bg-slate-100">
          {/* Top-Left Shortcut Guide & Seat Hover Details Badge */}
          <div className="absolute top-4 left-6 z-20 pointer-events-none flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white/90 text-[11px] font-medium shadow-md flex items-center gap-2 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>🖱️ <strong>Wheel:</strong> Zoom at cursor</span>
              <span className="text-white/40">•</span>
              <span>🖐️ <strong>Space+Drag / Middle click:</strong> Pan</span>
              <span className="text-white/40">•</span>
              <span>🔍 <strong>Double-click:</strong> Focus</span>
            </span>
            {hoveredSeat && (
              <span className="px-3 py-1 rounded-full bg-rose-600 backdrop-blur-md text-white text-[11px] font-bold shadow-lg border border-rose-400/50 flex items-center gap-1.5 animate-in fade-in">
                <span>Section: <strong>{hoveredSeat.section_name}</strong></span>
                <span className="text-white/40">•</span>
                <span>Row: <strong>{hoveredSeat.row_label}</strong></span>
                <span className="text-white/40">•</span>
                <span>Seat: <strong>{hoveredSeat.seat_label}</strong></span>
              </span>
            )}
          </div>

          <div 
            ref={canvasScrollRef} 
            onMouseDown={handleContainerMouseDown}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            className={`flex-1 overflow-auto p-2 select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
              isPanning 
                ? "cursor-grabbing" 
                : (isSpacePressed || mode === "pan") 
                ? "cursor-grab" 
                : mode === "select" 
                ? "cursor-default" 
                : mode === "eraser" 
                ? "cursor-pointer" 
                : "cursor-crosshair"
            }`}
          >
            <div 
              ref={canvasWrapperRef}
              className="bg-white border border-slate-200 shadow-xl origin-top-left relative inline-block" 
              style={{ width: 3200 * zoomScale, height: 2400 * zoomScale }}
            >
              <Stage 
                ref={stageRef}
                width={3200 * zoomScale} 
                height={2400 * zoomScale} 
                scaleX={zoomScale} 
                scaleY={zoomScale} 
                onMouseDown={handleStageMouseDown}
                onClick={handleStageClick}
                onDblClick={(e) => {
                  if (e.target === e.target.getStage()) {
                    if (zoomScale > 0.9) fitToScreen();
                    else setZoomScale(1.75);
                  }
                }}
              >
              <Layer>
                {bgImage && (
                  <KonvaImage
                    image={bgImage}
                    x={0}
                    y={0}
                    width={3200}
                    height={2133}
                    listening={false}
                  />
                )}
                {shapes.map(shape => {
                  const isSelected = shape.id === selectedShapeId;
                  const isBox = shape.text?.includes("DIAMOND") || shape.text?.includes("BOX");
                  return (
                    <Group
                      key={shape.id}
                      id={`shape-${shape.id}`}
                      x={shape.x + shape.width / 2}
                      y={shape.y + shape.height / 2}
                      offsetX={shape.width / 2}
                      offsetY={shape.height / 2}
                      rotation={shape.rotation || 0}
                      draggable={mode === "select"}
                      onDragEnd={(e) => handleDragEndShape(e, shape.id)}
                      onTransformEnd={(e) => handleTransformEndShape(e, shape.id)}
                      onDblClick={() => handleToggleZoomOnShape(shape)}
                      onDblTap={() => handleToggleZoomOnShape(shape)}
                      onClick={() => {
                        if (mode === "eraser") {
                          setShapes(shapes.filter(s => s.id !== shape.id));
                          if (selectedShapeId === shape.id) setSelectedShapeId(null);
                          return;
                        }
                        if (mode === "select") {
                          setSelectedShapeId(shape.id);
                          setSelectedLabelId(null);
                          setSelectedSeatId(null);
                        }
                      }}
                      onTap={() => {
                        if (mode === "eraser") {
                          setShapes(shapes.filter(s => s.id !== shape.id));
                          if (selectedShapeId === shape.id) setSelectedShapeId(null);
                          return;
                        }
                        if (mode === "select") {
                          setSelectedShapeId(shape.id);
                          setSelectedLabelId(null);
                          setSelectedSeatId(null);
                        }
                      }}
                    >
                      {(() => {
                        const isBlock = shape.text && (shape.text.startsWith("N") || shape.text.startsWith("W") || shape.text.startsWith("E") || shape.text.startsWith("S") || shape.text.startsWith("VIP") || shape.text.startsWith("AWAY"));
                        const isCircle = shape.width === shape.height && shape.fill === "transparent";
                        return (
                          <Rect
                            x={0}
                            y={0}
                            width={shape.width}
                            height={shape.height}
                            fill={bgImage ? (isSelected ? "rgba(244, 63, 94, 0.25)" : "rgba(255, 255, 255, 0.01)") : shape.fill}
                            stroke={isSelected ? "#f43f5e" : (bgImage ? "rgba(255, 255, 255, 0.25)" : (isBlock || shape.fill === "transparent" ? "#ffffff" : "rgba(255,255,255,0.25)"))}
                            strokeWidth={isSelected ? 3 : (shape.fill === "transparent" ? 2 : (isBlock ? 1.5 : 1))}
                            cornerRadius={isBox ? 8 : (isCircle ? shape.width / 2 : (shape.width > 500 && shape.height > 500 ? 300 : 3))}
                            perfectDrawEnabled={false}
                            shadowForStrokeEnabled={false}
                          />
                        );
                      })()}
                      {shape.text && !bgImage && (() => {
                        const isBlock = shape.text.startsWith("N") || shape.text.startsWith("W") || shape.text.startsWith("E") || shape.text.startsWith("S") || shape.text.startsWith("VIP") || shape.text.startsWith("AWAY");
                        return (
                          <Text
                            text={shape.text}
                            x={0}
                            y={0}
                            width={shape.width}
                            height={shape.height}
                            align="center"
                            verticalAlign="middle"
                            fontSize={
                              shape.text.includes("STAND") ? 16
                              : shape.text.includes("PITCH") ? 15
                              : shape.text.includes("GATE") || shape.text.includes("TEAM") || shape.text.includes("PLAYER") || shape.text.includes("REFEREE") ? 11
                              : isBlock ? 16
                              : 13
                            }
                            fontStyle="bold"
                            fill={
                              shape.fill === "#f8fafc" || shape.fill === "#ffffff" || shape.fill === "#fbbf24" ? "#1e293b"
                              : "#ffffff"
                            }
                            listening={false}
                            wrap="word"
                            perfectDrawEnabled={false}
                          />
                        );
                      })()}
                    </Group>
                  );
                })}
                {(() => {
                  const renderSeat = (seat: Seat, isDraggable: boolean, dx: number = 0, dy: number = 0) => {
                    const isSelected =
                      seat.internalId === selectedSeatId || selectedSeatIds.includes(seat.internalId);
                    const color = resolveSeatColor(seat);
      
      return (
        <Group
          key={seat.internalId}
          id={seat.internalId}
          x={seat.coordinate_x + dx}
          y={seat.coordinate_y + dy}
          draggable={isDraggable && mode === "select" && selectedSeatIds.length <= 1}
          onDragEnd={isDraggable ? ((e) => handleDragEnd(e, seat.internalId)) : undefined}
          onMouseEnter={() => setHoveredSeat(seat)}
          onMouseLeave={() => setHoveredSeat((prev) => (prev?.internalId === seat.internalId ? null : prev))}
          onDblClick={() => handleToggleZoomOnSection(seat)}
          onDblTap={() => handleToggleZoomOnSection(seat)}
          onClick={(e) => {
            if (mode === "eraser") {
              if (seat.status && seat.status !== "AVAILABLE") {
                toast.error(`Cannot erase seat ${seat.row_label}-${seat.seat_label}: already booked/reserved.`);
                return;
              }
              setSeats(prev => prev.filter(s => s.internalId !== seat.internalId));
              if (selectedSeatId === seat.internalId) setSelectedSeatId(null);
              setSelectedSeatIds((prev) => prev.filter((id) => id !== seat.internalId));
              return;
            }
            if (mode === "select") {
              const multi = Boolean(e.evt?.ctrlKey || e.evt?.metaKey || e.evt?.shiftKey);
              selectSeat(seat.internalId, multi);
            }
          }}
          onTap={(e) => {
            if (mode === "eraser") {
              if (seat.status && seat.status !== "AVAILABLE") {
                toast.error(`Cannot erase seat ${seat.row_label}-${seat.seat_label}: already booked/reserved.`);
                return;
              }
              setSeats(prev => prev.filter(s => s.internalId !== seat.internalId));
              if (selectedSeatId === seat.internalId) setSelectedSeatId(null);
              setSelectedSeatIds((prev) => prev.filter((id) => id !== seat.internalId));
              return;
            }
            if (mode === "select") {
              const multi = Boolean(e.evt?.ctrlKey || e.evt?.metaKey || e.evt?.shiftKey);
              selectSeat(seat.internalId, multi);
            }
          }}
        >
          <Circle
            radius={11}
            fill={
              seat.status && seat.status !== "AVAILABLE"
                ? (isSelected ? "#be123c" : "#991b1b")
                : (isSelected ? "#f43f5e" : color)
            }
            stroke={isSelected ? "#fbbf24" : (seat.status && seat.status !== "AVAILABLE" ? "#fca5a5" : "#ffffff")}
            strokeWidth={isSelected ? 3 : (seat.status && seat.status !== "AVAILABLE" ? 2 : 1.5)}
            dash={seat.status && seat.status !== "AVAILABLE" ? [3, 2] : undefined}
            perfectDrawEnabled={false}
            shadowForStrokeEnabled={false}
          />
          <Text 
            x={-11}
            y={-5}
            width={22}
            text={seat.seat_label}
            fontSize={9}
            fontStyle="bold"
            fill="#ffffff"
            align="center"
            verticalAlign="middle"
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>
      );
    };

                  if (moveEntireSection) {
                    const groups = Array.from(new Set(seats.map(s => s.grid_id || s.section_name || '')));
                    return groups.map(groupId => {
                      const groupSeats = seats.filter(s => (s.grid_id || s.section_name || '') === groupId);
                      if (!groupId) {
                        return groupSeats.map(seat => renderSeat(seat, true));
                      }
                      return (
                        <Group
                          key={`group-${groupId}`}
                          draggable={mode === "select"}
                          onDragEnd={(e) => {
                            const dx = e.target.x();
                            const dy = e.target.y();
                            if (dx === 0 && dy === 0) return;
                            setSeats(seats.map(s => {
                              if ((s.grid_id || s.section_name || '') === groupId) {
                                return {
                                  ...s,
                                  coordinate_x: s.coordinate_x + dx,
                                  coordinate_y: s.coordinate_y + dy,
                                };
                              }
                              return s;
                            }));
                            e.target.x(0);
                            e.target.y(0);
                          }}
                        >
                          {groupSeats.map(seat => renderSeat(seat, false))}
                        </Group>
                      );
                    });
                  } else {
                    return seats.map(seat => renderSeat(seat, true));
                  }
                })()}
                {labels.map((label) => {
                  const isSelected = label.id === selectedLabelId;
                  return (
                    <Text
                      key={label.id}
                      id={`label-${label.id}`}
                      text={label.text}
                      x={label.x}
                      y={label.y}
                      rotation={label.rotation || 0}
                      fontSize={label.fontSize}
                      fill={isSelected ? "#f43f5e" : "#334155"}
                      fontStyle="bold"
                      draggable={mode === "select"}
                      onDragEnd={(e) => handleDragEndLabel(e, label.id)}
                      onTransformEnd={(e) => handleTransformEndLabel(e, label.id)}
                      onClick={() => {
                        if (mode === "eraser") {
                          setLabels(labels.filter(l => l.id !== label.id));
                          if (selectedLabelId === label.id) setSelectedLabelId(null);
                          return;
                        }
                        if (mode === "select") {
                          setSelectedLabelId(label.id);
                          setSelectedSeatId(null);
                          setSelectedShapeId(null);
                        }
                      }}
                      onTap={() => {
                        if (mode === "eraser") {
                          setLabels(labels.filter(l => l.id !== label.id));
                          if (selectedLabelId === label.id) setSelectedLabelId(null);
                          return;
                        }
                        if (mode === "select") {
                          setSelectedLabelId(label.id);
                          setSelectedSeatId(null);
                          setSelectedShapeId(null);
                        }
                      }}
                    />
                  );
                })}

                {/* On-Canvas Rotation & Transformation Handles */}
                {mode === "select" && (
                  <Transformer
                    ref={trRef}
                    rotateEnabled={true}
                    enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                    anchorFill="#ffffff"
                    anchorStroke="#f43f5e"
                    anchorSize={9}
                    anchorCornerRadius={2}
                    borderStroke="#f43f5e"
                    borderStrokeWidth={1.5}
                    borderDash={[4, 4]}
                    boundBoxFunc={(oldBox, newBox) => {
                      if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) {
                        return oldBox;
                      }
                      return newBox;
                    }}
                  />
                )}
              </Layer>
            </Stage>
          </div>
        </div>

        {/* Floating Zoom & Section Navigation Dock */}
        <div className="absolute bottom-6 right-6 z-20 flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-2xl rounded-2xl p-2 text-slate-700 select-none">
          {/* Section / Stage Quick Selector */}
          {(availableSections.length > 0 || availableStages.length > 0) && (
            <div className="flex items-center gap-1.5 pr-2 border-r border-slate-200">
              <span className="text-[11px] font-semibold text-slate-400 pl-1 uppercase tracking-wide">Focus:</span>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  if (val === "__fit__") fitToScreen();
                  else if (val === "__seats__") focusOnSeatsView();
                  else if (val.startsWith("shape:")) focusOnShape(val.replace("shape:", ""));
                  else if (val.startsWith("sec:")) focusOnSection(val.replace("sec:", ""));
                  e.target.value = "";
                }}
                className="text-xs font-semibold bg-slate-100 hover:bg-slate-200/80 text-slate-700 py-1 px-2.5 rounded-lg border border-slate-300/80 cursor-pointer outline-none transition-colors max-w-[170px]"
                defaultValue=""
              >
                <option value="" disabled>Select section / stage...</option>
                <option value="__fit__">🔍 Fit Layout</option>
                <option value="__seats__">🪑 Seat-by-Seat (175%)</option>
                {availableStages.length > 0 && (
                  <optgroup label="🎭 Stage & Elements">
                    {availableStages.map(s => (
                      <option key={s.id} value={`shape:${s.id}`}>
                        {s.text?.replace("\n", " ") || "Stage"}
                      </option>
                    ))}
                  </optgroup>
                )}
                {availableSections.length > 0 && (
                  <optgroup label="🪑 Sections">
                    {availableSections.map(sec => (
                      <option key={sec.name} value={`sec:${sec.name}`}>
                        {sec.name} ({sec.count} seats)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          {/* Pan Tool Toggle */}
          <button
            type="button"
            onClick={() => setMode(m => m === "pan" ? "select" : "pan")}
            className={`p-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
              mode === "pan" 
                ? "bg-rose-500 text-white border-rose-600 shadow-sm" 
                : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
            }`}
            title="Pan Mode (or hold Spacebar + Drag)"
          >
            <Hand size={15} />
            <span className="hidden sm:inline">Pan</span>
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => {
              setZoomScale(s => Math.max(0.15, Number((s / 1.2).toFixed(3))));
            }}
            className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-xl text-slate-700 transition-colors"
            title="Zoom Out (Mouse wheel down)"
          >
            <ZoomOut size={16} />
          </button>

          {/* Zoom Preset Selector */}
          <select
            value={Math.round(zoomScale * 100)}
            onChange={(e) => setZoomScale(Number(e.target.value) / 100)}
            className="text-xs font-mono font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 py-1 px-1.5 rounded-lg border border-slate-200 outline-none cursor-pointer transition-colors text-center"
          >
            <option value={25}>25%</option>
            <option value={40}>40%</option>
            <option value={50}>50%</option>
            <option value={75}>75%</option>
            <option value={100}>100%</option>
            <option value={125}>125%</option>
            <option value={150}>150%</option>
            <option value={175}>175%</option>
            <option value={200}>200%</option>
            <option value={250}>250%</option>
            <option value={300}>300%</option>
            <option value={350}>350%</option>
            <option value={400}>400%</option>
            {![25, 40, 50, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400].includes(Math.round(zoomScale * 100)) && (
              <option value={Math.round(zoomScale * 100)}>{Math.round(zoomScale * 100)}%</option>
            )}
          </select>

          {/* Zoom In */}
          <button
            type="button"
            onClick={() => {
              setZoomScale(s => Math.min(4.0, Number((s * 1.2).toFixed(3))));
            }}
            className="p-1.5 hover:bg-slate-100 active:bg-slate-200 rounded-xl text-slate-700 transition-colors"
            title="Zoom In (Mouse wheel up)"
          >
            <ZoomIn size={16} />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-0.5" />

          {/* Fit to Screen */}
          <button
            type="button"
            onClick={fitToScreen}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl text-slate-700 transition-colors flex items-center gap-1"
            title="Fit Entire Layout to Screen"
          >
            <Maximize2 size={13} /> Fit
          </button>

          {/* 1:1 Reset */}
          <button
            type="button"
            onClick={() => setZoomScale(1)}
            className={`px-2 py-1 text-xs font-mono font-semibold rounded-xl transition-colors ${
              Math.round(zoomScale * 100) === 100
                ? "bg-rose-100 text-rose-700 font-bold"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
            title="Actual Size (100%)"
          >
            100%
          </button>

          {/* Seat Inspection Preset */}
          <button
            type="button"
            onClick={focusOnSeatsView}
            className={`px-2.5 py-1 text-xs font-semibold rounded-xl transition-colors ${
              zoomScale >= 1.6 && zoomScale <= 2.2
                ? "bg-emerald-500 text-white shadow-sm font-bold"
                : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
            }`}
            title="Zoom in to inspect individual seat numbers and rows"
          >
            🪑 Seat View
          </button>
        </div>
      </div>

        {/* Properties Panel */}
        {showProperties && (
          <div className="w-80 border-l border-slate-200 bg-white p-5 overflow-y-auto shrink-0 shadow-lg animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-rose-500" />
                Properties
              </h3>
              <button
                type="button"
                onClick={() => setShowProperties(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Hide Properties"
              >
                <X size={16} />
              </button>
            </div>
          
          {mode === "bulk_seats" ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 mb-2">Generate a grid of seats automatically.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Rows</label>
                  <input type="number" min={1} value={bulkRows} onChange={(e) => setBulkRows(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Columns</label>
                  <input type="number" min={1} value={bulkCols} onChange={(e) => setBulkCols(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Section Name</label>
                {ticketTypes.length > 0 ? (
                  <select
                    value={bulkSection}
                    onChange={(e) => {
                      setBulkSection(e.target.value);
                      const match = ticketTypes.find(
                        (t: { ticket_type: string; id: string }) =>
                          String(t.ticket_type) === e.target.value || String(t.id) === e.target.value
                      );
                      if (match) setBulkTicketType(String(match.id));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                  >
                    <option value="General">General</option>
                    {ticketTypes.map((t: { id: string; ticket_type: string; total_count?: number }) => (
                      <option key={t.id} value={t.ticket_type}>
                        {t.ticket_type}
                        {Number(t.total_count) > 0 && Number(t.total_count) < 99999
                          ? ` (need ${t.total_count})`
                          : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="text" value={bulkSection} onChange={(e) => setBulkSection(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Starting row name</label>
                <input
                  type="text"
                  value={bulkStartRow}
                  onChange={(e) => setBulkStartRow(e.target.value)}
                  placeholder="A  or  1  or  VIP-1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Rows auto-name from this: A→B→C, or 1→2→3, or VIP-1→VIP-2.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Section Color</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value={bulkColor}
                    onChange={(e) => setBulkColor(e.target.value)}
                    className="h-10 w-12 rounded border border-slate-300 cursor-pointer bg-white"
                    title="Pick section color"
                  />
                  <input
                    type="text"
                    value={bulkColor}
                    onChange={(e) => setBulkColor(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SECTION_COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => setBulkColor(c)}
                      className={`h-6 w-6 rounded-full border-2 ${
                        bulkColor.toLowerCase() === c.toLowerCase()
                          ? "border-slate-900 scale-110"
                          : "border-white shadow"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Each section can use a different color so VIP / stalls / balcony stay easy to spot.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Layout Shape</label>
                  <select value={bulkShape} onChange={(e) => setBulkShape(e.target.value as any)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none">
                    <option value="grid">Straight Grid</option>
                    <option value="curve">Curved Arc</option>
                    <option value="circle">Full Circle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Rotation (deg)</label>
                  <input type="number" value={bulkRotation} onChange={(e) => setBulkRotation(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
                </div>
              </div>
              {bulkShape === "curve" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Curve Angle (deg)</label>
                  <input type="number" value={bulkCurveAngle} onChange={(e) => setBulkCurveAngle(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Ticket Type (Pricing Zone)</label>
                <select
                  value={bulkTicketType}
                  onChange={(e) => assignTicketType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                >
                  <option value="">-- None --</option>
                  {ticketTypes.map((t: any) => {
                    const prog = zoneProgress.find((z) => z.id === String(t.id) || z.name === t.ticket_type);
                    const need = Number(t.total_count) > 0 && Number(t.total_count) < 99999 ? Number(t.total_count) : 0;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.ticket_type}
                        {need ? ` · ${prog?.mapped ?? 0}/${need}` : ""}
                        {t.price ? ` (Birr ${t.price})` : ""}
                      </option>
                    );
                  })}
                </select>
                {zoneProgress.length > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Counts above are requested by the partner. Match section name + ticket type when generating seats.
                  </p>
                )}
              </div>
              <button onClick={generateBulkGrid} className="btn-primary w-full mt-4">Generate Layout</button>
            </div>
          ) : selectedLabel ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Text Label</label>
                <input type="text" value={selectedLabel.text} onChange={(e) => setLabels(labels.map(l => l.id === selectedLabel.id ? { ...l, text: e.target.value } : l))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Font Size</label>
                <input type="number" value={selectedLabel.fontSize} onChange={(e) => setLabels(labels.map(l => l.id === selectedLabel.id ? { ...l, fontSize: Number(e.target.value) } : l))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
              </div>

              {/* Rotation for Text Label */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-slate-600">Rotation</label>
                  <span className="text-xs font-mono font-bold text-slate-500">{selectedLabel.rotation || 0}°</span>
                </div>
                <input 
                  type="range" 
                  min={-180} 
                  max={180} 
                  step={5} 
                  value={selectedLabel.rotation || 0} 
                  onChange={(e) => setLabels(labels.map(l => l.id === selectedLabel.id ? { ...l, rotation: Number(e.target.value) } : l))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500" 
                />
                <div className="grid grid-cols-5 gap-1 mt-2">
                  <button 
                    onClick={() => setLabels(labels.map(l => l.id === selectedLabel.id ? { ...l, rotation: ((l.rotation || 0) - 90 + 360) % 360 } : l))}
                    className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    title="Rotate Left 90°"
                  >
                    ↺ 90°
                  </button>
                  <button 
                    onClick={() => setLabels(labels.map(l => l.id === selectedLabel.id ? { ...l, rotation: (l.rotation || 0) - 15 } : l))}
                    className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    title="Rotate Left 15°"
                  >
                    ↺ 15°
                  </button>
                  <button 
                    onClick={() => setLabels(labels.map(l => l.id === selectedLabel.id ? { ...l, rotation: 0 } : l))}
                    className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    title="Reset 0°"
                  >
                    0°
                  </button>
                  <button 
                    onClick={() => setLabels(labels.map(l => l.id === selectedLabel.id ? { ...l, rotation: (l.rotation || 0) + 15 } : l))}
                    className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    title="Rotate Right 15°"
                  >
                    ↻ 15°
                  </button>
                  <button 
                    onClick={() => setLabels(labels.map(l => l.id === selectedLabel.id ? { ...l, rotation: ((l.rotation || 0) + 90) % 360 } : l))}
                    className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    title="Rotate Right 90°"
                  >
                    ↻ 90°
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button onClick={deleteSelectedLabel} className="w-full py-2 bg-rose-50 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-100 flex items-center justify-center gap-2">
                  <Trash2 size={16} /> Remove Label
                </button>
              </div>
            </div>
          ) : selectedShape ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Element Label</label>
                <input type="text" value={selectedShape.text || ""} onChange={(e) => setShapes(shapes.map(s => s.id === selectedShape.id ? { ...s, text: e.target.value } : s))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Width</label>
                  <input type="number" value={selectedShape.width} onChange={(e) => setShapes(shapes.map(s => s.id === selectedShape.id ? { ...s, width: Number(e.target.value) } : s))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Height</label>
                  <input type="number" value={selectedShape.height} onChange={(e) => setShapes(shapes.map(s => s.id === selectedShape.id ? { ...s, height: Number(e.target.value) } : s))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
                </div>
              </div>

              {/* Rotation for Stage / Shape Element */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-slate-600">Rotation</label>
                  <span className="text-xs font-mono font-bold text-slate-500">{selectedShape.rotation || 0}°</span>
                </div>
                <input 
                  type="range" 
                  min={-180} 
                  max={180} 
                  step={5} 
                  value={selectedShape.rotation || 0} 
                  onChange={(e) => setShapes(shapes.map(s => s.id === selectedShape.id ? { ...s, rotation: Number(e.target.value) } : s))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-500" 
                />
                <div className="grid grid-cols-5 gap-1 mt-2">
                  <button 
                    onClick={() => setShapes(shapes.map(s => s.id === selectedShape.id ? { ...s, rotation: ((s.rotation || 0) - 90 + 360) % 360 } : s))}
                    className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    title="Rotate Left 90°"
                  >
                    ↺ 90°
                  </button>
                  <button 
                    onClick={() => setShapes(shapes.map(s => s.id === selectedShape.id ? { ...s, rotation: (s.rotation || 0) - 15 } : s))}
                    className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    title="Rotate Left 15°"
                  >
                    ↺ 15°
                  </button>
                  <button 
                    onClick={() => setShapes(shapes.map(s => s.id === selectedShape.id ? { ...s, rotation: 0 } : s))}
                    className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    title="Reset 0°"
                  >
                    0°
                  </button>
                  <button 
                    onClick={() => setShapes(shapes.map(s => s.id === selectedShape.id ? { ...s, rotation: (s.rotation || 0) + 15 } : s))}
                    className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    title="Rotate Right 15°"
                  >
                    ↻ 15°
                  </button>
                  <button 
                    onClick={() => setShapes(shapes.map(s => s.id === selectedShape.id ? { ...s, rotation: ((s.rotation || 0) + 90) % 360 } : s))}
                    className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded"
                    title="Rotate Right 90°"
                  >
                    ↻ 90°
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Color (Hex)</label>
                  <input type="text" value={selectedShape.fill} onChange={(e) => setShapes(shapes.map(s => s.id === selectedShape.id ? { ...s, fill: e.target.value } : s))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-1">Link to Ticket Type (Zone)</label>
                  <select 
                    value={selectedShape.ticket_type_id || ""}
                    onChange={(e) => setShapes(shapes.map(s => s.id === selectedShape.id ? { ...s, ticket_type_id: e.target.value } : s))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                  >
                    <option value="">-- No Ticket Type --</option>
                    {ticketTypes.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.ticket_type}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <button onClick={deleteSelectedShape} className="w-full py-2 bg-rose-50 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-100 flex items-center justify-center gap-2">
                  <Trash2 size={16} /> Remove Element
                </button>
              </div>
            </div>
          ) : selectedSeat ? (
            <div className="space-y-4">
              {selectedSeatIds.length > 1 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  <strong>{selectedSeatIds.length} seats</strong> selected · edits apply to all selected
                  seats. Tip: Ctrl/Cmd+click to add seats.
                </div>
              )}
              {selectedSeat.status && selectedSeat.status !== "AVAILABLE" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>🔒 Seat {selectedSeat.row_label}-{selectedSeat.seat_label} is Booked</span>
                  </div>
                  <p className="text-amber-700">
                    This seat already has customer bookings. Tier, row, seat label, and deletion are locked to protect tickets.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={selectEntireRow}
                  className="px-2 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Select row {selectedSeat.row_label}
                </button>
                <button
                  type="button"
                  onClick={selectEntireSectionSeats}
                  className="px-2 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Select section
                </button>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Ticket Type (Pricing Zone)</label>
                <select 
                  value={selectedSeat.ticket_type_id || ""}
                  disabled={Boolean(selectedSeat.status && selectedSeat.status !== "AVAILABLE")}
                  onChange={(e) => {
                    const typeId = e.target.value;
                    const match = ticketTypes.find((t: { id: string }) => String(t.id) === String(typeId));
                    const sectionName = match?.ticket_type ? String(match.ticket_type) : undefined;
                    setSeats((prev) =>
                      prev.map((s) =>
                        s.internalId === selectedSeatId
                          ? {
                              ...s,
                              ticket_type_id: typeId || null,
                              ...(sectionName ? { section_name: sectionName } : {}),
                            }
                          : s
                      )
                    );
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  <option value="">-- Select Type --</option>
                  {ticketTypes.map((t: any) => {
                    const prog = zoneProgress.find((z) => z.id === String(t.id) || z.name === t.ticket_type);
                    const need = Number(t.total_count) > 0 && Number(t.total_count) < 99999 ? Number(t.total_count) : 0;
                    return (
                      <option key={t.id} value={t.id}>
                        {t.ticket_type}
                        {need ? ` · ${prog?.mapped ?? 0}/${need}` : ""}
                        {t.price ? ` (Birr ${t.price})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  {moveEntireSection ? "Section color" : "Color (selected seats only)"}
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value={resolveSeatColor(selectedSeat)}
                    onChange={(e) => setColorForSelection(e.target.value)}
                    className="h-10 w-12 rounded border border-slate-300 cursor-pointer bg-white"
                  />
                  <span
                    className="h-8 flex-1 rounded-lg border border-slate-200"
                    style={{ backgroundColor: resolveSeatColor(selectedSeat) }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SECTION_COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => setColorForSelection(c)}
                      className={`h-6 w-6 rounded-full border-2 ${
                        resolveSeatColor(selectedSeat).toLowerCase() === c.toLowerCase()
                          ? "border-slate-900 scale-110"
                          : "border-white shadow"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  {moveEntireSection
                    ? "Applies to the whole section."
                    : "Only selected seats/row change. Check “Apply changes to entire section” for the full section."}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Section name</label>
                <input
                  type="text"
                  value={selectedSeat.section_name}
                  disabled={Boolean(selectedSeat.status && selectedSeat.status !== "AVAILABLE")}
                  onChange={(e) => updateSelectedSeat("section_name", e.target.value)}
                  placeholder="e.g. Couple"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Row name</label>
                <input
                  type="text"
                  value={selectedSeat.row_label}
                  disabled={Boolean(selectedSeat.status && selectedSeat.status !== "AVAILABLE")}
                  onChange={(e) => updateSelectedSeat("row_label", e.target.value)}
                  onBlur={(e) => {
                    if (applyEntireRow) renameSelectedRow(e.target.value.trim());
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      renameSelectedRow((e.target as HTMLInputElement).value.trim());
                    }
                  }}
                  placeholder="e.g. A, B, 1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
                <div className="flex items-center gap-2 mt-2 bg-slate-50 p-2 rounded border border-slate-200">
                  <input
                    type="checkbox"
                    id="applyEntireRow"
                    checked={applyEntireRow}
                    onChange={(e) => setApplyEntireRow(e.target.checked)}
                    className="rounded text-rose-500 focus:ring-rose-500"
                  />
                  <label htmlFor="applyEntireRow" className="text-xs font-semibold text-slate-700 cursor-pointer">
                    Apply row name to entire row (same section)
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["A", "B", "C", "D", "E", "F", "1", "2", "3"].map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      disabled={Boolean(selectedSeat.status && selectedSeat.status !== "AVAILABLE")}
                      onClick={() => renameSelectedRow(hint)}
                      className="px-2 py-1 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:border-rose-200 disabled:opacity-40"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 bg-slate-50 p-2 rounded border border-slate-200">
                <input 
                  type="checkbox" 
                  id="moveEntireSection" 
                  checked={moveEntireSection} 
                  onChange={(e) => setMoveEntireSection(e.target.checked)}
                  className="rounded text-rose-500 focus:ring-rose-500"
                />
                <label htmlFor="moveEntireSection" className="text-xs font-semibold text-slate-700 cursor-pointer">
                  Apply section moves / ticket type to entire section
                </label>
              </div>
              {moveEntireSection && (
                <div className="pt-3 pb-2 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-600 mb-2">Rotate Entire Section</label>
                  <div className="grid grid-cols-4 gap-1">
                    <button onClick={() => rotateSelectedSection(-90)} className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded">↺ 90°</button>
                    <button onClick={() => rotateSelectedSection(-15)} className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded">↺ 15°</button>
                    <button onClick={() => rotateSelectedSection(15)} className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded">↻ 15°</button>
                    <button onClick={() => rotateSelectedSection(90)} className="py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded">↻ 90°</button>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Seat Number / Label</label>
                <input
                  type="text"
                  value={selectedSeat.seat_label}
                  disabled={Boolean(selectedSeat.status && selectedSeat.status !== "AVAILABLE") || selectedSeatIds.length > 1}
                  onChange={(e) => updateSelectedSeat("seat_label", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                />
                {selectedSeatIds.length > 1 && (
                  <p className="text-[11px] text-slate-500 mt-1">Seat labels stay unique — edit one seat at a time for labels.</p>
                )}
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-3">
                  Status: <span className="text-slate-800 font-semibold">{selectedSeat.status}</span>
                  {selectedSeatIds.length > 1 ? ` · ${selectedSeatIds.length} selected` : ""}
                </p>
                <button
                  onClick={deleteSelectedSeat}
                  disabled={Boolean(selectedSeat.status && selectedSeat.status !== "AVAILABLE")}
                  className={`w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    selectedSeat.status && selectedSeat.status !== "AVAILABLE"
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                      : "bg-rose-50 text-rose-600 hover:bg-rose-100"
                  }`}
                  title={selectedSeat.status && selectedSeat.status !== "AVAILABLE" ? "Booked seats cannot be deleted" : "Remove seat"}
                >
                  <Trash2 size={16} />{" "}
                  {selectedSeat.status && selectedSeat.status !== "AVAILABLE"
                    ? "Seat Locked (Booked)"
                    : selectedSeatIds.length > 1
                      ? `Remove ${selectedSeatIds.length} Seats`
                      : "Remove Seat"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">
              Select a seat or label on the canvas, or click a toolbar action.
              <span className="block mt-2 text-xs text-slate-400">
                Multi-select: Ctrl/Cmd+click seats, or use Select row / Select section after picking one seat.
              </span>
            </p>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
