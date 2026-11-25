"use client";

import { useMemo, useRef } from "react";
import ClassicSeatMap from "@/components/venue/ClassicSeatMap";
import { useMapZoom } from "@/components/venue/useMapZoom";

/**
 * Customer seat picker for auditorium / theatre layouts: the same classic grid the movie panel uses.
 * Seats keep the spacing and gaps the admin drew on the layout; row letters on both sides; fits any screen width.
 * Selection rules stay with the parent (onSeatsSelected receives the full new selection, like the map viewer).
 */
export default function EventClassicSeatPicker({
  seats,
  selected,
  maxSelectable,
  onSeatsSelected,
  className = "",
}: {
  seats: any[];
  selected: any[];
  maxSelectable?: number;
  onSeatsSelected: (seats: any[]) => void;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { zoom: userZoom, controls } = useMapZoom(wrapRef);
  const selectedIds = useMemo(() => new Set(selected.map((s) => String(s.id))), [selected]);
  const real = useMemo(() => seats.filter((s) => s && s.row_label != null && s.seat_label != null), [seats]);

  const toggle = (seat: any) => {
    if (String(seat.status || "").toUpperCase() !== "AVAILABLE" && !selectedIds.has(String(seat.id))) return;
    const id = String(seat.id);
    let next: any[];
    if (selectedIds.has(id)) next = selected.filter((s) => String(s.id) !== id);
    else if (maxSelectable && selected.length >= maxSelectable) next = [seat];
    else next = [...selected, seat];
    onSeatsSelected(next);
  };

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      <div ref={wrapRef} className="relative min-h-0 flex-1 touch-pan-x touch-pan-y [&_*]:touch-pan-x [&_*]:touch-pan-y">
        {controls}
        <ClassicSeatMap
          userZoom={userZoom}
          seats={real}
          heightClass="h-full"
          className="!rounded-none !border-0"
          screenLabel="Stage this way"
          merged
          stage
          seatMarker={(seat: any) => {
            const picked = selectedIds.has(String(seat.id));
            const free = String(seat.status || "").toUpperCase() === "AVAILABLE";
            if (picked) return { fill: "#6900AA", stroke: "#4c0080", strokeWidth: 2, cursor: "pointer", onClick: () => toggle(seat), title: `${seat.row_label}${seat.seat_label} — selected` };
            if (!free) return { fill: "#e5e7eb", stroke: "#e5e7eb", cursor: "not-allowed", title: "Not available" };
            return { stroke: "#22c55e", cursor: "pointer", onClick: () => toggle(seat), title: `${seat.row_label}${seat.seat_label}` };
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded border-2 border-green-500 bg-white" /> Available</span>
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded bg-[#6900AA]" /> Selected</span>
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded bg-slate-200" /> Sold / held</span>
      </div>
    </div>
  );
}
