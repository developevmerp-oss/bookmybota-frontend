"use client";
import React, { useState, useEffect } from "react";
import { Stage, Layer, Rect, Circle, Text, Group } from "react-konva";
import { toast } from "sonner";
import { Save, PlusSquare, MousePointer2, Trash2 } from "lucide-react";
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
};

type VenueAdapter = {
  sections?: Array<{ id: string; name: string; capacity?: number }>;
  initialSeats?: Seat[];
  initialConfig?: { labels?: Label[]; shapes?: Shape[] };
  saving?: boolean;
  onSave: (
    payload: { seating_config: { canvasWidth: number; canvasHeight: number; labels: Label[]; shapes: Shape[] }; seats: Seat[] },
    options?: { publish?: boolean }
  ) => Promise<void>;
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
  const [mode, setMode] = useState<"select" | "add_seat" | "add_label" | "add_shape" | "bulk_seats">("select");
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [moveEntireSection, setMoveEntireSection] = useState(false);

  const [bulkRows, setBulkRows] = useState(5);
  const [bulkCols, setBulkCols] = useState(10);
  const [bulkSection, setBulkSection] = useState("General");
  const [bulkTicketType, setBulkTicketType] = useState("");
  const [bulkShape, setBulkShape] = useState<"grid" | "curve" | "circle">("grid");
  const [bulkRotation, setBulkRotation] = useState(0);
  const [bulkCurveAngle, setBulkCurveAngle] = useState(180);
  const [zoomScale, setZoomScale] = useState(1);
  const venueHydratedRef = React.useRef(false);

  useEffect(() => {
    if (venueAdapter) {
      if (venueHydratedRef.current) return;
      venueHydratedRef.current = true;
      if (venueAdapter.initialSeats?.length) {
        setSeats(
          venueAdapter.initialSeats.map((s: Seat) => ({
            ...s,
            internalId: s.internalId || s.id || Math.random().toString(36).substr(2, 9),
            coordinate_x: Number(s.coordinate_x),
            coordinate_y: Number(s.coordinate_y),
            grid_id: s.grid_id || s.section_name,
          }))
        );
      }
      if (venueAdapter.initialConfig?.labels) setLabels(venueAdapter.initialConfig.labels);
      if (venueAdapter.initialConfig?.shapes) setShapes(venueAdapter.initialConfig.shapes);
      return;
    }
    if (layoutData?.data) {
      if (layoutData.data.seats) {
        setSeats(
          layoutData.data.seats.map((s: any) => ({
            ...s,
            internalId: s.id,
            coordinate_x: Number(s.coordinate_x),
            coordinate_y: Number(s.coordinate_y),
            grid_id: s.grid_id || s.section_name,
          }))
        );
      }
      if (layoutData.data.seating_config?.labels) {
        setLabels(layoutData.data.seating_config.labels);
      }
      if (layoutData.data.seating_config?.shapes) {
        setShapes(layoutData.data.seating_config.shapes);
      }
    }
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
  
  const handleDragEndShape = (e: any, shapeId: string) => {
    setShapes(shapes.map(s => s.id === shapeId ? { ...s, x: e.target.x(), y: e.target.y() } : s));
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

  const generateFootballStadium = () => {
    const pitchShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'rect',
      x: 1200,
      y: 1000,
      width: 800,
      height: 400,
      fill: "#22c55e",
      text: "FOOTBALL PITCH",
    };
    
    let newSeats: Seat[] = [];
    const spacing = 30;
    
    const generateStand = (startX: number, startY: number, rows: number, cols: number, section: string, isCurve = false, rotation = 0) => {
      const gridId = Math.random().toString(36).substr(2, 9);
      for (let r = 0; r < rows; r++) {
        const rowChar = String.fromCharCode(65 + (r % 26)); 
        for (let c = 0; c < cols; c++) {
          let cx = 0;
          let cy = 0;
          
          if (isCurve) {
            const baseRadius = Math.max(cols * 12, 100); 
            const rowRadius = baseRadius + (r * spacing);
            const sweepAngle = Math.PI; // 180 degrees
            const startA = 0;
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

    // North Stand
    generateStand(1240, 650, 10, 24, "North Stand", false, 0);
    // South Stand (Rotated 180)
    generateStand(1960, 1750, 10, 24, "South Stand", false, 180);
    
    // West Stand (Curve)
    // Base radius is 18 * 12 = 216. Center = 1200, 1200. startX/Y = Center + 216 = 1416
    generateStand(1416, 1416, 10, 18, "West Stand", true, 90);
    // East Stand (Curve)
    // Center = 2000, 1200. startX = 2216, startY = 1416
    generateStand(2216, 1416, 10, 18, "East Stand", true, 270);

    setShapes(prev => [...prev, pitchShape]);
    setSeats(prev => [...prev, ...newSeats]);
    setZoomScale(0.3); // Zoom out so they can see it
    toast.success("Generated Football Stadium Template!");
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
        seating_config: { canvasWidth: 3200, canvasHeight: 2400, labels, shapes },
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
        <div className="flex gap-3">
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
            <PlusSquare size={16} /> Add Text Label
          </button>
          <button 
            onClick={() => setMode("add_shape")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${mode === "add_shape" ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
          >
            <PlusSquare size={16} /> Add Stage Element
          </button>
          <div className="w-px h-8 bg-slate-300 mx-2"></div>
          <select 
            onChange={(e) => {
              if (e.target.value === "stadium") generateFootballStadium();
              else if (e.target.value === "comedy") generateComedyClub();
              else if (e.target.value === "theater") generateTheater();
              else if (e.target.value === "arena") generateArena();
              else if (e.target.value === "concert") generateConcertHall();
              else if (e.target.value === "conference") generateConference();
              else if (e.target.value === "fashion") generateFashionShow();
              e.target.value = "";
            }}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 focus:outline-none cursor-pointer"
          >
            <option value="">✨ Add Template...</option>
            <option value="stadium">🏟️ Football Stadium</option>
            <option value="theater">🎭 Classic Theater</option>
            <option value="comedy">🎤 Comedy Club</option>
            <option value="arena">🥊 Arena (In-The-Round)</option>
            <option value="concert">🎸 Large Concert Hall</option>
            <option value="conference">🏫 Conference / Seminar</option>
            <option value="fashion">✨ Fashion Show Runway</option>
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
          {venueAdapter && (
            <button onClick={() => void handleSave(true)} disabled={isSaving} className="btn-primary flex items-center gap-2">
              {isSaving ? "Submitting..." : "Submit to venue"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas Area */}
        <div className="flex-1 bg-slate-100 relative overflow-auto p-8 cursor-crosshair">
          <div className="bg-white border border-slate-200 shadow-md mx-auto origin-top-left" style={{ width: 3200 * zoomScale, height: 2400 * zoomScale }}>
            <Stage width={3200 * zoomScale} height={2400 * zoomScale} scaleX={zoomScale} scaleY={zoomScale} onClick={handleStageClick}>
              <Layer>
                {shapes.map(shape => {
                  const isSelected = shape.id === selectedShapeId;
                  return (
                    <React.Fragment key={shape.id}>
                      <Rect
                        x={shape.x}
                        y={shape.y}
                        width={shape.width}
                        height={shape.height}
                        fill={shape.fill}
                        stroke={isSelected ? "#f43f5e" : "#cbd5e1"}
                        strokeWidth={isSelected ? 2 : 1}
                        draggable={mode === "select"}
                        onDragEnd={(e) => handleDragEndShape(e, shape.id)}
                        onClick={() => {
                          if (mode === "select") {
                            setSelectedShapeId(shape.id);
                            setSelectedLabelId(null);
                            setSelectedSeatId(null);
                          }
                        }}
                        onTap={() => {
                          if (mode === "select") {
                            setSelectedShapeId(shape.id);
                            setSelectedLabelId(null);
                            setSelectedSeatId(null);
                          }
                        }}
                      />
                      {shape.text && (
                        <Text
                          text={shape.text}
                          x={shape.x + shape.width / 2}
                          y={shape.y + shape.height / 2}
                          offsetX={shape.width / 2}
                          offsetY={10} // approx half of 20px font
                          align="center"
                          verticalAlign="middle"
                          width={shape.width}
                          fontSize={20}
                          fontStyle="bold"
                          fill="#475569" // slate-600
                          listening={false} // pass clicks through to rect
                        />
                      )}
                    </React.Fragment>
                  );
                })}
                {(() => {
                  const renderSeat = (seat: Seat, isDraggable: boolean, dx: number = 0, dy: number = 0) => {
                    const isSelected = seat.internalId === selectedSeatId;
                    const tt = ticketTypes.find((t: any) => t.id === seat.ticket_type_id);
                    const color = isSelected ? "#f43f5e" : (tt ? "#3b82f6" : "#cbd5e1");
                    
                    return (
                      <Group
                        key={seat.internalId}
                        id={seat.internalId}
                        x={seat.coordinate_x + dx}
                        y={seat.coordinate_y + dy}
                        draggable={isDraggable && mode === "select"}
                        onDragEnd={isDraggable ? ((e) => handleDragEnd(e, seat.internalId)) : undefined}
                        onClick={() => {
                          if (mode === "select") {
                            setSelectedSeatId(seat.internalId);
                            setSelectedLabelId(null);
                            setSelectedShapeId(null);
                          }
                        }}
                        onTap={() => {
                          if (mode === "select") {
                            setSelectedSeatId(seat.internalId);
                            setSelectedLabelId(null);
                            setSelectedShapeId(null);
                          }
                        }}
                      >
                        <Circle
                          radius={12}
                          fill={seat.status === 'AVAILABLE' ? color : "#ef4444"}
                          stroke={isSelected ? "#000" : "#94a3b8"}
                          strokeWidth={isSelected ? 2 : 1}
                        />
                        <Text 
                          x={-12}
                          y={-5}
                          width={24}
                          text={seat.seat_label}
                          fontSize={10}
                          fontStyle="bold"
                          fill={(seat.status === 'AVAILABLE' && !isSelected && !tt) ? "#475569" : "#ffffff"}
                          align="center"
                          verticalAlign="middle"
                          listening={false}
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
                      text={label.text}
                      x={label.x}
                      y={label.y}
                      fontSize={label.fontSize}
                      fill={isSelected ? "#f43f5e" : "#334155"}
                      draggable={mode === "select"}
                      onDragEnd={(e) => handleDragEndLabel(e, label.id)}
                      onClick={() => {
                        if (mode === "select") {
                          setSelectedLabelId(label.id);
                          setSelectedSeatId(null);
                          setSelectedShapeId(null);
                        }
                      }}
                      onTap={() => {
                        if (mode === "select") {
                          setSelectedLabelId(label.id);
                          setSelectedSeatId(null);
                          setSelectedShapeId(null);
                        }
                      }}
                    />
                  )
                })}
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
