"use client";
import React, { useState, useEffect, useRef } from "react";
import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Image as KonvaImage } from "react-konva";
import useImage from "use-image";
import { toast } from "sonner";
import { Save, PlusSquare, MousePointer2, Trash2, Eraser, Undo2, Redo2, RotateCcw } from "lucide-react";
import { useGetOrganizerEventQuery, useUpdateEventLayoutMutation, useGetEventLayoutQuery } from "@/services/api";

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
  sections?: Array<{ id: string; name: string; capacity?: number }>;
  initialSeats?: Seat[];
  initialConfig?: { labels?: Label[]; shapes?: Shape[]; bgImageUrl?: string | null };
  saving?: boolean;
  onSave: (
    payload: { seating_config: { canvasWidth: number; canvasHeight: number; labels: Label[]; shapes: Shape[]; bgImageUrl?: string | null }; seats: Seat[] },
    options?: { publish?: boolean }
  ) => Promise<void>;
  onBlankPage?: () => void;
  hideSubmitToVenue?: boolean;
};

type HistorySnapshot = {
  seats: Seat[];
  labels: Label[];
  shapes: Shape[];
  bgImageUrl?: string | null;
};

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

  const [seats, setSeats] = useState<Seat[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(null);
  const [bgImage] = useImage(bgImageUrl || "");
  const [mode, setMode] = useState<"select" | "add_seat" | "add_label" | "add_shape" | "bulk_seats" | "eraser">("select");
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [moveEntireSection, setMoveEntireSection] = useState(false);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [bulkRows, setBulkRows] = useState(5);
  const [bulkCols, setBulkCols] = useState(10);
  const [bulkSection, setBulkSection] = useState("General");
  const [bulkTicketType, setBulkTicketType] = useState("");
  const [bulkShape, setBulkShape] = useState<"grid" | "curve" | "circle">("grid");
  const [bulkRotation, setBulkRotation] = useState(0);
  const [bulkCurveAngle, setBulkCurveAngle] = useState(180);
  const [zoomScale, setZoomScale] = useState(1);
  const venueHydratedRef = React.useRef(false);
  const trRef = useRef<any>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);

  const handleToggleZoomOnSection = (seat: Seat) => {
    if (zoomScale > 0.8) {
      // Zoom out to overview
      setZoomScale(0.42);
      toast.info("Zoomed out to overview");
    } else {
      // Zoom in focused on this section
      const targetScale = 1.35;
      setZoomScale(targetScale);
      const sectionSeats = seats.filter(s => (s.section_name === seat.section_name && s.section_name) || s.internalId === seat.internalId);
      const avgX = sectionSeats.length ? sectionSeats.reduce((acc, s) => acc + s.coordinate_x, 0) / sectionSeats.length : seat.coordinate_x;
      const avgY = sectionSeats.length ? sectionSeats.reduce((acc, s) => acc + s.coordinate_y, 0) / sectionSeats.length : seat.coordinate_y;

      setTimeout(() => {
        if (canvasScrollRef.current) {
          const container = canvasScrollRef.current;
          const scrollLeft = avgX * targetScale - container.clientWidth / 2 + 32;
          const scrollTop = avgY * targetScale - container.clientHeight / 2 + 32;
          container.scrollTo({
            left: Math.max(0, scrollLeft),
            top: Math.max(0, scrollTop),
            behavior: "smooth",
          });
        }
      }, 50);

      toast.info(`Focused on ${seat.section_name || 'Section'} (Double click again to zoom out)`);
    }
  };

  const handleToggleZoomOnShape = (shape: Shape) => {
    if (zoomScale > 0.8) {
      setZoomScale(0.42);
      toast.info("Zoomed out to overview");
    } else {
      const targetScale = 1.35;
      setZoomScale(targetScale);
      const centerX = shape.x + shape.width / 2;
      const centerY = shape.y + shape.height / 2;

      setTimeout(() => {
        if (canvasScrollRef.current) {
          const container = canvasScrollRef.current;
          const scrollLeft = centerX * targetScale - container.clientWidth / 2 + 32;
          const scrollTop = centerY * targetScale - container.clientHeight / 2 + 32;
          container.scrollTo({
            left: Math.max(0, scrollLeft),
            top: Math.max(0, scrollTop),
            behavior: "smooth",
          });
        }
      }, 50);

      toast.info(`Focused on ${shape.text || 'Element'} (Double click again to zoom out)`);
    }
  };

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

  const pushSnapshot = (newSeats: Seat[], newLabels: Label[], newShapes: Shape[], newBg?: string | null) => {
    const finalBg = newBg !== undefined ? newBg : bgImageUrl;
    const snap: HistorySnapshot = { seats: newSeats, labels: newLabels, shapes: newShapes, bgImageUrl: finalBg };
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
      setSelectedSeatId(null);
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
      setSelectedSeatId(null);
      setSelectedLabelId(null);
      setSelectedShapeId(null);
      toast.info("Redo");
    }
  };

  const handleClearCanvas = () => {
    if (seats.length === 0 && labels.length === 0 && shapes.length === 0 && !bgImageUrl) return;
    pushSnapshot([], [], [], null);
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
    } else {
      return;
    }

    setSeats(initSeats);
    setLabels(initLabels);
    setShapes(initShapes);
    setBgImageUrl(initBg);
    setHistory([{ seats: initSeats, labels: initLabels, shapes: initShapes, bgImageUrl: initBg }]);
    setHistoryIndex(0);
  }, [layoutData, venueAdapter]);

  if (!skipEvent && (eventLoading || layoutLoading)) return <div className="p-8 text-center text-zinc-400">Loading editor...</div>;
  if (!skipEvent && !eventDetails) return <div className="p-8 text-center text-rose-500">Event not found.</div>;

  const ticketTypes = venueAdapter?.sections?.length
    ? venueAdapter.sections.map((section) => ({
        id: section.id,
        ticket_type: section.name,
        total_count: section.capacity || 99999,
        price: 0,
      }))
    : eventDetails?.ticket_types || [];

  const handleStageClick = (e: any) => {
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

  const updateSelectedSeat = (field: keyof Seat, value: string) => {
    if (moveEntireSection && selectedSeatId) {
      const selectedSeat = seats.find(s => s.internalId === selectedSeatId);
      if (selectedSeat && selectedSeat.section_name) {
        // Bulk update the field for the entire section
        setSeats(seats.map(s => s.section_name === selectedSeat.section_name ? { ...s, [field]: value } : s));
        return;
      }
    }
    setSeats(seats.map(s => s.internalId === selectedSeatId ? { ...s, [field]: value } : s));
  };

  const deleteSelectedSeat = () => {
    if (!selectedSeatId) return;

    if (moveEntireSection) {
      const selectedSeat = seats.find(s => s.internalId === selectedSeatId);
      if (selectedSeat) {
        const groupId = selectedSeat.grid_id || selectedSeat.section_name;
        if (groupId) {
          setSeats(seats.filter(s => (s.grid_id || s.section_name) !== groupId));
          setSelectedSeatId(null);
          toast.success("Deleted entire grid!");
          return;
        }
      }
    }

    setSeats(seats.filter(s => s.internalId !== selectedSeatId));
    setSelectedSeatId(null);
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
      const rowChar = String.fromCharCode(65 + (r % 26)); // A, B, C...
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
        });
        seatCounter++;
      }
    }
    setSeats([...seats, ...newSeats]);
    setMode("select");
    toast.success(`Added ${bulkRows * bulkCols} seats!`);
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

  const handleSave = async (publish = false) => {
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
        seating_config: { canvasWidth: 3200, canvasHeight: 2400, labels, shapes, bgImageUrl: bgImageUrl || undefined },
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
        })),
      };
      if (venueAdapter) {
        await venueAdapter.onSave(payload, { publish });
        toast.success(publish ? "Layout sent to the venue as an option." : "Layout option saved.");
        return;
      }
      if (!eventId) return;
      await saveLayout({
        eventId,
        ...payload,
      }).unwrap();
      toast.success("Layout saved successfully!");
      refetch();
    } catch (err: any) {
      toast.error(err?.data?.error || err?.message || "Failed to save layout.");
    }
  };

  const selectedSeat = seats.find(s => s.internalId === selectedSeatId);
  const selectedLabel = labels.find(l => l.id === selectedLabelId);
  const selectedShape = shapes.find(s => s.id === selectedShapeId);

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex gap-3 items-center flex-wrap">
          <button 
            onClick={() => setMode("select")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "select" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          >
            <MousePointer2 size={16} /> Select
          </button>
          <button 
            onClick={() => setMode("add_seat")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "add_seat" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          >
            <PlusSquare size={16} /> Add Single Seat
          </button>
          <button 
            onClick={() => setMode("bulk_seats")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "bulk_seats" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          >
            <PlusSquare size={16} /> Add Grid
          </button>
          <button 
            onClick={() => setMode("add_label")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "add_label" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          >
            <PlusSquare size={16} /> Add Text
          </button>
          <button 
            onClick={() => setMode("add_shape")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "add_shape" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          >
            <PlusSquare size={16} /> Add Stage Element
          </button>
          <button 
            onClick={() => setMode("eraser")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "eraser" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          >
            <Eraser size={16} /> Eraser
          </button>

          <div className="w-px h-8 bg-slate-300 mx-1"></div>

          {/* Undo / Redo & Clear History Controls */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <button 
              onClick={handleUndo} 
              disabled={historyIndex <= 0}
              className="p-1.5 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent rounded text-slate-700 transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button 
              onClick={handleRedo} 
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent rounded text-slate-700 transition-colors"
              title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            >
              <Redo2 size={16} />
            </button>
            <button 
              onClick={handleClearCanvas}
              disabled={seats.length === 0 && labels.length === 0 && shapes.length === 0 && !bgImageUrl}
              className="p-1.5 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent rounded text-slate-500 transition-colors"
              title="Clear Canvas"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          <div className="w-px h-8 bg-slate-300 mx-1"></div>

          <select 
            onChange={(e) => {
              if (e.target.value === "classic_football") generateClassicFootballLayout();
              else if (e.target.value === "ethiopia_stadium") generateEthiopiaFootballStadium();
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
            className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 focus:outline-none cursor-pointer shadow-sm hover:bg-emerald-100 transition-colors"
          >
            <option value="">✨ Add Template...</option>
            <optgroup label="🏟️ Stadiums & Sports">
              <option value="classic_football">⚽ Classic Football Stadium (4 Straight Stands)</option>
              <option value="ethiopia_stadium">🇪🇹 Ethiopia Football Stadium (Addis Ababa Stadium)</option>
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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
            <button onClick={() => setZoomScale(s => Math.max(0.1, s - 0.1))} className="px-2 py-1 hover:bg-slate-100 rounded text-slate-600 font-bold">-</button>
            <span className="text-xs font-semibold text-slate-600 min-w-[40px] text-center">{Math.round(zoomScale * 100)}%</span>
            <button onClick={() => setZoomScale(s => Math.min(3, s + 0.1))} className="px-2 py-1 hover:bg-slate-100 rounded text-slate-600 font-bold">+</button>
          </div>
          <button onClick={() => void handleSave(false)} disabled={isSaving} className="btn-secondary flex items-center gap-2">
            <Save size={16} /> {isSaving ? "Saving..." : venueAdapter ? "Save layout" : "Save Layout"}
          </button>
          {venueAdapter?.onBlankPage ? (
            <button
              type="button"
              onClick={() => venueAdapter.onBlankPage?.()}
              className="px-4 py-2 rounded-lg text-sm font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Add blank page
            </button>
          ) : null}
          {venueAdapter && !venueAdapter.hideSubmitToVenue ? (
            <button onClick={() => void handleSave(true)} disabled={isSaving} className="btn-primary flex items-center gap-2">
              {isSaving ? "Submitting..." : "Submit to venue"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div ref={canvasScrollRef} className="flex-1 bg-slate-100 relative overflow-auto p-8 cursor-crosshair">
          <div className="bg-white border border-slate-200 shadow-md mx-auto origin-top-left" style={{ width: 3200 * zoomScale, height: 2400 * zoomScale }}>
            <Stage 
              width={3200 * zoomScale} 
              height={2400 * zoomScale} 
              scaleX={zoomScale} 
              scaleY={zoomScale} 
              onClick={handleStageClick}
              onDblClick={(e) => {
                if (e.target === e.target.getStage()) {
                  setZoomScale(s => s > 0.8 ? 0.42 : 1.35);
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
                  const getSectionColor = (sectionName: string): string => {
                    const name = (sectionName || "").toLowerCase();
                    if (name.includes("vip") || name.includes("premium")) return "#f59e0b"; // Golden Amber
                    if (name.includes("category 1") || name.includes("cat 1")) return "#dc2626"; // Vibrant Red
                    if (name.includes("category 2") || name.includes("cat 2") || name.includes("east stand")) return "#2563eb"; // Royal Blue
                    if (name.includes("category 3") || name.includes("cat 3") || name.includes("west stand")) return "#16a34a"; // Stadium Green
                    if (name.includes("away")) return "#9333ea"; // Purple
                    if (name.includes("south")) return "#f97316"; // Orange
                    if (name.includes("platinum")) return "#06b6d4"; // Cyan
                    if (name.includes("gold")) return "#a855f7";     // Purple
                    if (name.includes("dress")) return "#ec4899";    // Pink
                    if (name.includes("upper balcony")) return "#8b5cf6";    // Violet
                    if (name.includes("recliner")) return "#0284c7"; // Sky Blue
                    if (name.includes("prime")) return "#3b82f6";    // Blue
                    if (name.includes("classic")) return "#6366f1";  // Indigo
                    return "#3b82f6";
                  };

                  const renderSeat = (seat: Seat, isDraggable: boolean, dx: number = 0, dy: number = 0) => {
                    const isSelected = seat.internalId === selectedSeatId;
                    const tt = ticketTypes.find((t: any) => t.id === seat.ticket_type_id);
                    const color = tt ? "#3b82f6" : getSectionColor(seat.section_name);
      
      return (
        <Group
          key={seat.internalId}
          id={seat.internalId}
          x={seat.coordinate_x + dx}
          y={seat.coordinate_y + dy}
          draggable={isDraggable && mode === "select"}
          onDragEnd={isDraggable ? ((e) => handleDragEnd(e, seat.internalId)) : undefined}
          onDblClick={() => handleToggleZoomOnSection(seat)}
          onDblTap={() => handleToggleZoomOnSection(seat)}
          onClick={() => {
            if (mode === "eraser") {
              setSeats(prev => prev.filter(s => s.internalId !== seat.internalId));
              if (selectedSeatId === seat.internalId) setSelectedSeatId(null);
              return;
            }
            if (mode === "select") {
              setSelectedSeatId(seat.internalId);
              setSelectedLabelId(null);
              setSelectedShapeId(null);
            }
          }}
          onTap={() => {
            if (mode === "eraser") {
              setSeats(prev => prev.filter(s => s.internalId !== seat.internalId));
              if (selectedSeatId === seat.internalId) setSelectedSeatId(null);
              return;
            }
            if (mode === "select") {
              setSelectedSeatId(seat.internalId);
              setSelectedLabelId(null);
              setSelectedShapeId(null);
            }
          }}
        >
          <Circle
            radius={11}
            fill={seat.status === 'AVAILABLE' ? (isSelected ? "#f43f5e" : color) : "#ef4444"}
            stroke={isSelected ? "#ffffff" : "#ffffff"}
            strokeWidth={isSelected ? 3 : 1.5}
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

        {/* Properties Panel */}
        <div className="w-80 border-l border-slate-200 bg-white p-6 overflow-y-auto">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Properties</h3>
          
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
                <input type="text" value={bulkSection} onChange={(e) => setBulkSection(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
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
                <select value={bulkTicketType} onChange={(e) => setBulkTicketType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none">
                  <option value="">-- None --</option>
                  {ticketTypes.map((t: any) => <option key={t.id} value={t.id}>{t.ticket_type} (Birr {t.price})</option>)}
                </select>
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
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Ticket Type (Pricing Zone)</label>
                <select 
                  value={selectedSeat.ticket_type_id || ""}
                  onChange={(e) => updateSelectedSeat("ticket_type_id", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                >
                  <option value="">-- Select Type --</option>
                  {ticketTypes.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.ticket_type} (Birr {t.price})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Section / Row</label>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={selectedSeat.section_name} onChange={(e) => updateSelectedSeat("section_name", e.target.value)} placeholder="Sec" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
                  <input type="text" value={selectedSeat.row_label} onChange={(e) => updateSelectedSeat("row_label", e.target.value)} placeholder="Row" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
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
                  Apply changes/moves to entire section
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
                <input type="text" value={selectedSeat.seat_label} onChange={(e) => updateSelectedSeat("seat_label", e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none" />
              </div>
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-3">Status: <span className="text-slate-800">{selectedSeat.status}</span></p>
                <button onClick={deleteSelectedSeat} className="w-full py-2 bg-rose-50 text-rose-600 rounded-lg text-sm font-medium hover:bg-rose-100 flex items-center justify-center gap-2">
                  <Trash2 size={16} /> Remove Seat
                </button>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Select a seat or label on the canvas, or click a toolbar action.</p>
          )}
        </div>
      </div>
    </div>
  );
}
