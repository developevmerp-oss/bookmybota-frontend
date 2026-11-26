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
      <div className="relative min-h-0 flex-1 touch-pan-x touch-pan-y [&_*]:touch-pan-x [&_*]:touch-pan-y">
        {controls}
        <ClassicSeatMap
          scrollBoxRef={wrapRef}
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
            if (picked) return { fill: "#7B61FF", stroke: "#7B61FF", strokeWidth: 1, cursor: "pointer", onClick: () => toggle(seat), title: `${seat.row_label}${seat.seat_label} — selected` };
            if (!free) return { fill: "#ffffff", stroke: "#E0E0E0", cursor: "not-allowed", title: "Not available" };
            return { stroke: "#4B5563", cursor: "pointer", onClick: () => toggle(seat), title: `${seat.row_label}${seat.seat_label}` };
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded-[4px] border border-[#4B5563] bg-white" /> Available</span>
        <span className="flex items-center gap-1.5"><i className="size-3.5 rounded-[4px] border border-[#7B61FF] bg-[#7B61FF] shadow-[0_0_0_2px_rgba(123,97,255,0.22)]" /> Selected</span>
        <span className="flex items-center gap-1.5"><i className="flex size-3.5 items-center justify-center rounded-[4px] border border-[#E0E0E0] bg-white text-[10px] leading-none font-medium text-[#C4C4C4] not-italic">×</i> Sold / held</span>
      </div>
    </div>
  );
}
