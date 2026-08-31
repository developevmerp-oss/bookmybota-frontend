"use client";
import React, { useState, useEffect, useRef } from "react";
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
}: {
  layoutData: any;
  ticketTypes: any[];
  onSeatsSelected: (seats: Seat[]) => void;
  maxSelectable?: number;
  initialSelectedSeats?: any[];
}) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>(
    initialSelectedSeats.map(s => s.id)
  );
  const [activeBoxInfo, setActiveBoxInfo] = useState<Shape | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  const canvasWidth = layoutData?.data?.seating_config?.canvasWidth || 3200;
  const canvasHeight = layoutData?.data?.seating_config?.canvasHeight || 2400;

  const backgroundImageUrl = layoutData?.data?.seating_config?.bgImageUrl || null;
  const [bgImage] = useImage(backgroundImageUrl || "");

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const scaleX = (clientWidth - 32) / canvasWidth;
        const scaleY = (clientHeight - 32) / canvasHeight;
        const fitScale = Math.min(scaleX, scaleY, 1);
        setScale(Math.max(0.2, fitScale));
      }
    };
    
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [canvasWidth, canvasHeight]);

  useEffect(() => {
    if (layoutData?.data?.seats) {
      setSeats(
        layoutData.data.seats.map((s: any) => ({
          ...s,
          coordinate_x: Number(s.coordinate_x),
          coordinate_y: Number(s.coordinate_y),
        }))
      );
    }
    if (layoutData?.data?.seating_config?.labels) {
      setLabels(layoutData.data.seating_config.labels);
    }
    if (layoutData?.data?.seating_config?.shapes) {
      setShapes(layoutData.data.seating_config.shapes);
    }
  }, [layoutData]);

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

  if (!layoutData?.data?.seats || seats.length === 0) return null;

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-slate-900 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4 cursor-grab flex justify-center items-center relative bg-slate-950"
      >
        {/* Zoom Controls Overlay */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-1.5 shadow-lg">
          <button 
            onClick={() => setScale(s => Math.max(0.15, s - 0.05))} 
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-800 rounded-lg text-slate-200 font-bold transition-colors"
          >
            -
          </button>
          <span className="text-xs font-mono text-slate-300 px-1">{Math.round(scale * 100)}%</span>
          <button 
            onClick={() => setScale(s => Math.min(1.5, s + 0.05))} 
            className="w-8 h-8 flex items-center justify-center hover:bg-slate-800 rounded-lg text-slate-200 font-bold transition-colors"
          >
            +
          </button>
        </div>

        <div style={{ width: canvasWidth * scale, height: canvasHeight * scale }} className="relative origin-top-left">
          <Stage 
            width={canvasWidth * scale} 
            height={canvasHeight * scale} 
            scaleX={scale} 
            scaleY={scale}
            onDblClick={(e) => {
              if (e.target === e.target.getStage()) {
                setScale(s => s > 0.65 ? 0.4 : 0.95);
              }
            }}
          >
            <Layer>
              {bgImage && (
                <KonvaImage
                  image={bgImage}
                  x={0}
                  y={0}
                  width={canvasWidth}
                  height={canvasHeight}
                  listening={false}
                />
              )}
              {/* Shapes / VIP Boxes / Stage */}
              {shapes.map(shape => {
                const isBox = shape.text?.includes("DIAMOND") || shape.text?.includes("BOX");
                return (
                  <Group
                    key={shape.id}
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
              {seats.map((seat) => {
                const isSelected = selectedSeatIds.includes(seat.id);
                const isAvailable = seat.status === "AVAILABLE";
                const categoryColor = getSeatColorBySection(seat.section_name);
                
                let fill = "#334155"; // Unavailable
                let stroke = "#475569";
                let strokeWidth = 1;
                let opacity = 0.4;

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
                    key={seat.id}
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
              {labels.map((label) => (
                <Text
                  key={label.id}
                  text={label.text}
                  x={label.x}
                  y={label.y}
                  rotation={label.rotation || 0}
                  fontSize={label.fontSize || 16}
                  fontStyle="bold"
                  fill="#f1f5f9"
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>

      {/* Side Info Panel for Diamond Boxes */}
      <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-5 flex flex-col justify-between shrink-0">
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

        {/* Legend */}
        <div className="border-t border-slate-800 pt-4 mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-cyan-500" /> Platinum</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-500" /> Gold</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-pink-500" /> Dress Circle</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500" /> Lower Balcony</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-violet-500" /> Upper Balcony</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500" /> Selected</div>
        </div>
      </div>
    </div>
  );
}

