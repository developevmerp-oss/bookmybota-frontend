"use client";
import React, { useState, useEffect } from "react";
import { Stage, Layer, Circle, Text, Rect, Group } from "react-konva";
import { useGetEventLayoutQuery } from "@/services/api";

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
};

export default function VenueLayoutViewer({
  layoutData,
  ticketTypes,
  onSeatsSelected,
  maxSelectable = 10,
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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        // The original canvas is 800x600. We add a little padding (e.g. 40px)
        const scaleX = (clientWidth - 40) / 800;
        const scaleY = (clientHeight - 40) / 600;
        setScale(Math.min(scaleX, scaleY, 1)); // don't scale up past 1x, just scale down if needed
      }
    };
    
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

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
    if (seat.status !== "AVAILABLE") return; // cannot select booked seats

    setSelectedSeatIds((prev) => {
      const isSelected = prev.includes(seat.id);
      let newSelection = [];
      if (isSelected) {
        newSelection = prev.filter((id) => id !== seat.id);
      } else {
        if (prev.length >= maxSelectable) return prev; // limit reached
        newSelection = [...prev, seat.id];
      }
      
      const selectedSeats = seats.filter(s => newSelection.includes(s.id));
      onSeatsSelected(selectedSeats);
      return newSelection;
    });
  };

  const handleShapeClick = (shape: any) => {
    if (!shape.ticket_type_id) return;
    
    if (selectedSeatIds.length >= maxSelectable) return;
    
    const dummyId = `zone-${shape.id}-${Date.now()}`;
    const dummySeat: Seat = {
      id: dummyId,
      internalId: dummyId,
      ticket_type_id: shape.ticket_type_id,
      section_name: shape.text || "General Admission",
      row_label: "GA",
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

  if (!layoutData?.data?.seats || seats.length === 0) return null; // Fallback to generic quantity selection if no layout

  return (
    <div className="flex flex-col h-full w-full bg-slate-50">
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden p-4 cursor-crosshair flex justify-center items-center"
      >
        <div 
          style={{ width: 800 * scale, height: 600 * scale }}
          className="relative"
        >
          <Stage 
            width={800 * scale} 
            height={600 * scale} 
            scaleX={scale} 
            scaleY={scale}
          >
            <Layer>
              {shapes.map(shape => (
                <React.Fragment key={shape.id}>
                  <Rect
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    fill={shape.fill}
                    stroke="#cbd5e1"
                    strokeWidth={1}
                    onMouseEnter={(e) => {
                      if (shape.ticket_type_id) {
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = "pointer";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (shape.ticket_type_id) {
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = "default";
                      }
                    }}
                    onClick={() => handleShapeClick(shape)}
                    onTap={() => handleShapeClick(shape)}
                  />
                  {shape.text && (
                    <Text
                      text={shape.text}
                      x={shape.x + shape.width / 2}
                      y={shape.y + shape.height / 2}
                      offsetX={shape.width / 2}
                      offsetY={10}
                      align="center"
                      verticalAlign="middle"
                      width={shape.width}
                      fontSize={20}
                      fontStyle="bold"
                      fill="#475569"
                      listening={false}
                    />
                  )}
                </React.Fragment>
              ))}
              {seats.map((seat) => {
                const isSelected = selectedSeatIds.includes(seat.id);
                const isAvailable = seat.status === "AVAILABLE";
                const tt = ticketTypes.find((t: any) => t.id === seat.ticket_type_id);
                
                let fill = "#e2e8f0"; // slate-200 for unavailable
                let stroke = "#cbd5e1"; // slate-300
                let strokeWidth = 1;
                let opacity = 0.5;

                if (isSelected) {
                  fill = "#e11d48"; // rose-600
                  stroke = "#fff";
                  strokeWidth = 2;
                  opacity = 1;
                } else if (isAvailable) {
                  fill = tt ? "#3b82f6" : "#94a3b8"; // blue-500
                  stroke = tt ? "#1e40af" : "#64748b"; // blue-800
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
                    onClick={() => handleSeatClick(seat)}
                    onTap={() => handleSeatClick(seat)}
                  >
                    <Circle
                      radius={12}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                    />
                    <Text 
                      x={-12}
                      y={-5}
                      width={24}
                      text={seat.seat_label}
                      fontSize={10}
                      fontStyle="bold"
                      fill={(isAvailable && !isSelected && !tt) ? "#64748b" : "#ffffff"}
                      align="center"
                      verticalAlign="middle"
                      listening={false}
                    />
                  </Group>
                );
              })}
              {labels.map((label) => (
                <Text
                  key={label.id}
                  text={label.text}
                  x={label.x}
                  y={label.y}
                  fontSize={label.fontSize}
                  fill="#334155" // darker color for customer view
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>
      
      {/* Legend */}
      <div className="py-3 px-4 bg-white/80 backdrop-blur border-t border-slate-200 flex flex-wrap gap-6 text-xs font-semibold text-slate-600 justify-center shrink-0">
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-500 border border-blue-800" /> Available</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-rose-600 border-2 border-white ring-1 ring-slate-200 shadow-sm" /> Selected</div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-slate-200 border border-slate-300 opacity-60" /> Unavailable</div>
      </div>
    </div>
  );
}
