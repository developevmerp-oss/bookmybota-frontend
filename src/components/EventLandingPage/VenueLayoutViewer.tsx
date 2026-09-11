"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Stage, Layer, Circle, Text, Rect, Group, Image as KonvaImage } from "react-konva";
import useImage from "use-image";

type Seat = {
  id: string;
  ticket_type_id: string;
  section_name: string;
  row_label: string;
  seat_label: string;
  coordinate_x: number;
  coordinate_y: number;
  status: string;
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
  text?: string;
  ticket_type_id?: string;
  rotation?: number;
  opacity?: number;
};

export default function VenueLayoutViewer({
  layoutData,
  ticketTypes,
  onSeatsSelected,
  maxSelectable = Number.MAX_SAFE_INTEGER,
  initialSelectedSeats = [],
  cinemaMode = false,
  hideSidePanel = false,
  customLegend,
}: {
  layoutData: any;
  ticketTypes: any[];
  onSeatsSelected: (seats: Seat[]) => void;
  maxSelectable?: number;
  initialSelectedSeats?: any[];
  cinemaMode?: boolean;
  hideSidePanel?: boolean;
  customLegend?: Array<{ name: string; color: string; price?: number }>;
}) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>(
    initialSelectedSeats.map((s: any) => s.id || s.seat_identifier || s.internalId)
  );
  const [activeBoxInfo, setActiveBoxInfo] = useState<Shape | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const scaleRef = useRef(scale);
  const pendingScrollRef = useRef<{ scrollLeft: number; scrollTop: number } | null>(null);

  const config =
    layoutData?.data?.seating_config ||
    layoutData?.seating_config ||
    layoutData?.layout_template?.seating_config ||
    {};
  const canvasWidth = config?.canvasWidth || 3200;
  const canvasHeight = config?.canvasHeight || 2400;

  const backgroundImageUrl = config?.bgImageUrl || null;
  const [bgImage] = useImage(backgroundImageUrl || "");

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    if (pendingScrollRef.current && containerRef.current) {
      const { scrollLeft, scrollTop } = pendingScrollRef.current;
      containerRef.current.scrollLeft = Math.max(0, scrollLeft);
      containerRef.current.scrollTop = Math.max(0, scrollTop);
      pendingScrollRef.current = null;
    }
  }, [scale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const stageEl = canvasWrapperRef.current;
      if (!stageEl) return;

      const currentScale = scaleRef.current;
      const containerRect = container.getBoundingClientRect();
      const stageRect = stageEl.getBoundingClientRect();

      const mouseViewportX = e.clientX - containerRect.left;
      const mouseViewportY = e.clientY - containerRect.top;

      const mouseOnStageX = e.clientX - stageRect.left;
      const mouseOnStageY = e.clientY - stageRect.top;

      const contentX = mouseOnStageX / currentScale;
      const contentY = mouseOnStageY / currentScale;

      const factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
      const newScale = Math.min(Math.max(Number((currentScale * factor).toFixed(3)), 0.15), 3.0);

      if (Math.abs(newScale - currentScale) < 0.001) return;

      const newMouseOnStageX = contentX * newScale;
      const newMouseOnStageY = contentY * newScale;

      const targetScrollLeft = stageEl.offsetLeft + newMouseOnStageX - mouseViewportX;
      const targetScrollTop = stageEl.offsetTop + newMouseOnStageY - mouseViewportY;

      pendingScrollRef.current = {
        scrollLeft: targetScrollLeft,
        scrollTop: targetScrollTop,
      };

      setScale(newScale);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    const rawSeats =
      layoutData?.data?.seats ||
      layoutData?.seats ||
      layoutData?.layout_template?.seats_json ||
      [];
    const rawConfig =
      layoutData?.data?.seating_config ||
      layoutData?.seating_config ||
      layoutData?.layout_template?.seating_config ||
      {};

    if (Array.isArray(rawSeats) && rawSeats.length > 0) {
      setSeats(
        rawSeats.map((s: any) => ({
          ...s,
          id: s.id || s.internalId || `${s.row_label || ""}${s.seat_label || ""}`,
          coordinate_x: Number(s.coordinate_x),
          coordinate_y: Number(s.coordinate_y),
        }))
      );
    }
    if (rawConfig?.labels && Array.isArray(rawConfig.labels)) {
      setLabels(rawConfig.labels);
    }
    if (rawConfig?.shapes && Array.isArray(rawConfig.shapes)) {
      setShapes(rawConfig.shapes);
    }
  }, [layoutData]);

  useEffect(() => {
    if (initialSelectedSeats) {
      const incomingIds = initialSelectedSeats.map((s: any) => s.id || s.seat_identifier || s.internalId);
      setSelectedSeatIds(incomingIds);
    }
  }, [initialSelectedSeats]);

  const boundingBox = useMemo(() => {
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
    for (const lb of labels) {
      if (lb.x < minX) minX = lb.x;
      if (lb.x > maxX) maxX = lb.x;
      if (lb.y < minY) minY = lb.y;
      if (lb.y > maxY) maxY = lb.y;
    }
    if (!isFinite(minX) || !isFinite(maxX) || maxX <= minX) {
      return { minX: 0, maxX: canvasWidth, minY: 0, maxY: canvasHeight, contentW: canvasWidth, contentH: canvasHeight };
    }
    const padX = 60;
    const padY = 60;
    return {
      minX: minX - padX,
      minY: minY - padY,
      maxX: maxX + padX,
      maxY: maxY + padY,
      contentW: maxX - minX + padX * 2,
      contentH: maxY - minY + padY * 2,
    };
  }, [seats, shapes, labels, canvasWidth, canvasHeight]);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (!clientWidth || !clientHeight) return;

        const scaleX = (clientWidth - 48) / boundingBox.contentW;
        const scaleY = (clientHeight - 48) / boundingBox.contentH;
        const fitScale = Math.min(scaleX, scaleY, 1.2);
        const resolvedScale = Math.max(0.25, Math.min(fitScale, 1.0));
        setScale(resolvedScale);
      }
    };
    
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [boundingBox]);

  const handleSeatClick = (seat: Seat) => {
    if (seat.status !== "AVAILABLE") return;

    setSelectedSeatIds((prev) => {
      const isSelected = prev.includes(seat.id);
      let newSelection = [];
      if (isSelected) {
        newSelection = prev.filter((id) => id !== seat.id);
      } else {
        if (prev.length >= maxSelectable) return prev;
        newSelection = [...prev, seat.id];
      }
      
      const selectedSeats = seats.filter(s => newSelection.includes(s.id));
      onSeatsSelected(selectedSeats);
      return newSelection;
    });
  };

  const handleShapeClick = (shape: Shape) => {
    // If it's a Diamond VIP Box
    if (shape.text?.includes("DIAMOND") || shape.text?.includes("BOX")) {
      setActiveBoxInfo(shape);
    }

    if (!shape.ticket_type_id) return;
    if (selectedSeatIds.length >= maxSelectable) return;
    
    const dummyId = `zone-${shape.id}-${Date.now()}`;
    const dummySeat: Seat = {
      id: dummyId,
      ticket_type_id: shape.ticket_type_id,
      section_name: shape.text || "VIP Zone",
      row_label: "VIP",
      seat_label: "Ticket",
      coordinate_x: 0,
      coordinate_y: 0,
      status: "AVAILABLE",
    };

    setSeats(prev => {
      const newSeats = [...prev, dummySeat];
      setSelectedSeatIds(prevIds => {
        const newIds = [...prevIds, dummyId];
        const selectedObjects = newSeats.filter(s => newIds.includes(s.id));
        onSeatsSelected(selectedObjects);
        return newIds;
      });
      return newSeats;
    });
  };

  const handleToggleZoomOnSection = (seat: Seat) => {
    if (scale > 0.65) {
      setScale(0.4);
    } else {
      const targetScale = 0.95;
      setScale(targetScale);
      const sectionSeats = seats.filter(s => (s.section_name === seat.section_name && s.section_name) || s.id === seat.id);
      const avgX = sectionSeats.length ? sectionSeats.reduce((acc, s) => acc + s.coordinate_x, 0) / sectionSeats.length : seat.coordinate_x;
      const avgY = sectionSeats.length ? sectionSeats.reduce((acc, s) => acc + s.coordinate_y, 0) / sectionSeats.length : seat.coordinate_y;

      setTimeout(() => {
        if (containerRef.current) {
          const container = containerRef.current;
          const scrollLeft = avgX * targetScale - container.clientWidth / 2;
          const scrollTop = avgY * targetScale - container.clientHeight / 2;
          container.scrollTo({
            left: Math.max(0, scrollLeft),
            top: Math.max(0, scrollTop),
            behavior: "smooth",
          });
        }
      }, 50);
    }
  };

  const handleToggleZoomOnShape = (shape: Shape) => {
    if (scale > 0.65) {
      setScale(0.4);
    } else {
      const targetScale = 0.95;
      setScale(targetScale);
      const centerX = shape.x + shape.width / 2;
      const centerY = shape.y + shape.height / 2;

      setTimeout(() => {
        if (containerRef.current) {
          const container = containerRef.current;
          const scrollLeft = centerX * targetScale - container.clientWidth / 2;
          const scrollTop = centerY * targetScale - container.clientHeight / 2;
          container.scrollTo({
            left: Math.max(0, scrollLeft),
            top: Math.max(0, scrollTop),
            behavior: "smooth",
          });
        }
      }, 50);
    }
  };

  // Color Palette per Tier matching reference layout image
  const getSeatColorBySection = (sectionName: string): string => {
    const name = (sectionName || "").toLowerCase();
    if (name.includes("platinum")) return "#06b6d4"; // Cyan
    if (name.includes("gold")) return "#a855f7";     // Purple
    if (name.includes("dress")) return "#ec4899";    // Pink
    if (name.includes("upper balcony")) return "#8b5cf6";    // Violet
    if (name.includes("recliner")) return "#0284c7"; // Sky Blue
    if (name.includes("prime")) return "#3b82f6";    // Blue
    if (name.includes("classic")) return "#6366f1";  // Indigo
    if (name.includes("vip") || name.includes("premium")) return "#f59e0b"; // Amber/Yellow
    if (name.includes("category 1") || name.includes("cat 1")) return "#dc2626"; // Red
    if (name.includes("category 2") || name.includes("cat 2") || name.includes("east stand")) return "#2563eb"; // Blue
    if (name.includes("category 3") || name.includes("cat 3") || name.includes("west stand")) return "#22c55e"; // Green
    if (name.includes("away")) return "#9333ea"; // Purple
    return "#3b82f6";                                // Blue default
  };

  if (seats.length === 0) return null;

  const shellClass = cinemaMode
    ? "flex flex-col md:flex-row h-full w-full bg-white text-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-200"
    : "flex flex-col md:flex-row h-full w-full bg-slate-900 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800";
  const canvasClass = cinemaMode
    ? "flex-1 overflow-auto p-4 cursor-grab flex justify-center items-center relative bg-[#F5F5F7]"
    : "flex-1 overflow-auto p-4 cursor-grab flex justify-center items-center relative bg-slate-950";
  const zoomBarClass = cinemaMode
    ? "absolute top-4 right-4 z-10 flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-1.5 shadow-md"
    : "absolute top-4 right-4 z-10 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1.5 shadow-lg";
  const zoomBtnClass = cinemaMode
    ? "w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-700 font-bold transition-colors"
    : "w-8 h-8 flex items-center justify-center hover:bg-slate-800 rounded-lg text-slate-200 font-bold transition-colors";
  const zoomLabelClass = cinemaMode
    ? "text-xs font-mono text-slate-600 px-1"
    : "text-xs font-mono text-slate-300 px-1";
  const sidePanelClass = cinemaMode
    ? "w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-slate-200 p-5 flex flex-col justify-between shrink-0"
    : "w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-5 flex flex-col justify-between shrink-0";

  return (
    <div className={shellClass}>
      {/* Canvas Area */}
      <div 
        ref={containerRef}
        className={canvasClass}
      >
        {/* Zoom Controls Overlay */}
        <div className={zoomBarClass}>
          <button 
            onClick={() => setScale(s => Math.max(0.15, s - 0.05))} 
            className={zoomBtnClass}
          >
            -
          </button>
          <span className={zoomLabelClass}>{Math.round(scale * 100)}%</span>
          <button 
            onClick={() => setScale(s => Math.min(1.5, s + 0.05))} 
            className={zoomBtnClass}
          >
            +
          </button>
        </div>

        <div 
          ref={canvasWrapperRef}
          style={{ width: boundingBox.contentW * scale, height: boundingBox.contentH * scale }} 
          className="relative origin-top-left inline-block"
        >
          <Stage 
            width={boundingBox.contentW * scale} 
            height={boundingBox.contentH * scale} 
            onDblClick={(e) => {
              if (e.target === e.target.getStage()) {
                setScale(s => s > 0.65 ? 0.4 : 0.95);
              }
            }}
          >
            <Layer
              scaleX={scale}
              scaleY={scale}
              x={-boundingBox.minX * scale}
              y={-boundingBox.minY * scale}
            >
              {bgImage && (
                <KonvaImage
                  image={bgImage}
                  x={boundingBox.minX}
                  y={boundingBox.minY}
                  width={boundingBox.contentW}
                  height={boundingBox.contentH}
                  listening={false}
                />
              )}
              {/* Shapes / VIP Boxes / Stage */}
              {shapes.map((shape, sIdx) => {
                const isBox = shape.text?.includes("DIAMOND") || shape.text?.includes("BOX");
                return (
                  <Group
                    key={shape.id || `shape-${shape.text || ''}-${sIdx}`}
                    x={shape.x + shape.width / 2}
                    y={shape.y + shape.height / 2}
                    offsetX={shape.width / 2}
                    offsetY={shape.height / 2}
                    rotation={shape.rotation || 0}
                    onDblClick={() => handleToggleZoomOnShape(shape)}
                    onDblTap={() => handleToggleZoomOnShape(shape)}
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
                          fill={bgImage ? "rgba(255, 255, 255, 0.01)" : (isBox ? "#475569" : shape.fill || "#334155")}
                          stroke={isBox ? "#e2e8f0" : (bgImage ? "rgba(255, 255, 255, 0.2)" : (isBlock || shape.fill === "transparent" ? "#ffffff" : "rgba(255,255,255,0.25)"))}
                          strokeWidth={isBox ? 2 : (shape.fill === "transparent" ? 2 : (isBlock ? 1.5 : 1))}
                          cornerRadius={isBox ? 8 : (isCircle ? shape.width / 2 : (shape.width > 500 && shape.height > 500 ? 300 : 3))}
                          perfectDrawEnabled={false}
                          shadowForStrokeEnabled={false}
                          onMouseEnter={(e) => {
                            const container = e.target.getStage()?.container();
                            if (container) container.style.cursor = "pointer";
                          }}
                          onMouseLeave={(e) => {
                            const container = e.target.getStage()?.container();
                            if (container) container.style.cursor = "default";
                          }}
                          onClick={() => handleShapeClick(shape)}
                          onTap={() => handleShapeClick(shape)}
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

              {/* Seats */}
              {seats.map((seat, sIdx) => {
                const isSelected = selectedSeatIds.includes(seat.id);
                const isAvailable = seat.status === "AVAILABLE";
                const categoryColor = getSeatColorBySection(seat.section_name);
                
                let fill = cinemaMode ? "#cbd5e1" : "#334155"; // Unavailable
                let stroke = cinemaMode ? "#94a3b8" : "#475569";
                let strokeWidth = 1;
                let opacity = cinemaMode ? 0.7 : 0.4;

                if (isSelected) {
                  fill = "#f43f5e"; // Rose-500
                  stroke = "#ffffff";
                  strokeWidth = 2;
                  opacity = 1;
                } else if (isAvailable) {
                  fill = categoryColor;
                  stroke = "#ffffff";
                  opacity = 1;
                }

                return (
                  <Group
                    key={seat.internalId || `${seat.section_name || ''}-${seat.row_label || ''}-${seat.seat_label || ''}-${seat.id || ''}-${sIdx}`}
                    x={seat.coordinate_x}
                    y={seat.coordinate_y}
                    opacity={opacity}
                    onMouseEnter={(e) => {
                      if (isAvailable) {
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = "pointer";
                      }
                    }}
                    onMouseLeave={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container) container.style.cursor = "default";
                    }}
                    onDblClick={() => handleToggleZoomOnSection(seat)}
                    onDblTap={() => handleToggleZoomOnSection(seat)}
                    onClick={() => handleSeatClick(seat)}
                    onTap={() => handleSeatClick(seat)}
                  >
                    <Circle
                      radius={12}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
                    />
                    <Text 
                      x={-12}
                      y={-5}
                      width={24}
                      text={seat.seat_label}
                      fontSize={10}
                      fontStyle="bold"
                      fill="#ffffff"
                      align="center"
                      verticalAlign="middle"
                      listening={false}
                      perfectDrawEnabled={false}
                    />
                  </Group>
                );
              })}

              {/* Text Labels */}
              {labels.map((label, lIdx) => (
                <Text
                  key={label.id || `label-${label.text || ''}-${lIdx}`}
                  text={label.text}
                  x={label.x}
                  y={label.y}
                  rotation={label.rotation || 0}
                  fontSize={label.fontSize || 16}
                  fontStyle="bold"
                  fill={cinemaMode ? "#334155" : "#f1f5f9"}
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>

      {/* Side Info Panel for Diamond Boxes or Cinema Overview */}
      {!hideSidePanel && (
        <div className={sidePanelClass}>
          <div>
            {cinemaMode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-[#F84464] animate-pulse" />
                  <h3 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                    Cinema Hall Map
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  Live layout configured for this screen. Pick up to {maxSelectable} seats directly on the map.
                </p>

                <div className="space-y-2 pt-3 border-t border-slate-200 text-xs">
                  <p className="text-slate-700 font-semibold mb-2">Seat Tiers & Pricing:</p>
                  {(customLegend && customLegend.length > 0 ? customLegend : [
                    { name: "Recliner", color: "#0284c7" },
                    { name: "Prime", color: "#3b82f6" },
                    { name: "Classic Plus", color: "#6366f1" },
                  ]).map((tier) => (
                    <div key={tier.name} className="flex items-center justify-between py-1 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: tier.color }} />
                        <span className="text-slate-800 font-medium">{tier.name}</span>
                      </div>
                      {tier.price != null && (
                        <span className="font-mono text-slate-500 font-bold">{tier.price} ETB</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-3 space-y-1.5 text-[11px] text-slate-500">
                  <p className="flex items-center gap-1.5">
                    <span className="text-[#F84464] font-bold">•</span> Double-click any section to zoom in
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="text-[#F84464] font-bold">•</span> Use +/- buttons or wheel to zoom
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="text-[#F84464] font-bold">•</span> Drag canvas to pan across screen
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                  <h3 className="text-sm font-bold tracking-wider text-amber-400 uppercase">
                    For Each Diamond Box
                  </h3>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed border-t border-slate-800 pt-4">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Select 1 seat / ticket to view Diamond Box availability
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Accommodates 5 people
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Exclusive access to your personal diamond lounge
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    An ensuite, private powder room
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Personalised service
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Specially curated food & beverages menu
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Complimentary high-speed Wi-Fi
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Personalised reminders at show start and intermission
                  </li>
                </ul>

                {activeBoxInfo && (
                  <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <p className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                      Selected: {activeBoxInfo.text}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Luxury Private Box • 5 Guests Capacity
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          {cinemaMode ? (
            <div className="border-t border-slate-200 pt-4 mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500" /> Selected</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-300" /> Sold / Reserved</div>
            </div>
          ) : (
            <div className="border-t border-slate-800 pt-4 mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-cyan-500" /> Platinum</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-500" /> Gold</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-pink-500" /> Dress Circle</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500" /> Lower Balcony</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-violet-500" /> Upper Balcony</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500" /> Selected</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

