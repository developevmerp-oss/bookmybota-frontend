"use client";
import React from "react";
import { formatMoney } from "@/lib/currencyFormat";
import { Users, Ticket, IndianRupee, Layers, DoorOpen } from "lucide-react";
import { BMSBlockDef } from "./types";

interface BMSRevenueSummaryBarProps {
  blocks: BMSBlockDef[];
  ticketTypes: Array<{
    id: string;
    name: string;
    price?: number;
  }>;
}

export default function BMSRevenueSummaryBar({
  blocks,
  ticketTypes,
}: BMSRevenueSummaryBarProps) {
  // Compute total capacity and gross potential box office value
  let totalSeats = 0;
  let totalGrossValue = 0;
  const categoryBreakdown: Record<string, { name: string; color: string; seats: number; price: number }> = {};

  blocks.forEach((block) => {
    const isStanding = block.stand_type === "standing";
    if (isStanding) {
      totalSeats += block.capacity || 0;
      const matchedTt = ticketTypes.find((t) => t.id === block.ticket_type_id);
      const price = block.price || matchedTt?.price || 0;
      totalGrossValue += (block.capacity || 0) * price;
    } else {
      (block.tiers || []).forEach((tier) => {
        const s = String(tier.row_start || "A").toUpperCase().charCodeAt(0);
        const e = String(tier.row_end || "J").toUpperCase().charCodeAt(0);
        const rowCount = isNaN(s) || isNaN(e) || e < s ? 1 : e - s + 1;
        const spr = Number(tier.seats_per_row) || 20;
        let tierSeats = rowCount * spr;
        if (tier.row_gaps) tierSeats -= tier.row_gaps.length * spr;
        if (tier.excluded_seats) tierSeats -= tier.excluded_seats.length;

        totalSeats += tierSeats;
        const matchedTt = ticketTypes.find((t) => t.id === tier.ticket_type_id);
        const price = tier.price || matchedTt?.price || 0;
        totalGrossValue += tierSeats * price;

        const catKey = tier.ticket_type_id || "unassigned";
        const catName = matchedTt?.name || tier.name || "General";
        if (!categoryBreakdown[catKey]) {
          categoryBreakdown[catKey] = {
            name: catName,
            color: tier.color || block.color,
            seats: 0,
            price,
          };
        }
        categoryBreakdown[catKey].seats += tierSeats;
      });
    }
  });

  return (
    <div className="h-10 px-4 bg-slate-900/95 border-b border-slate-800/80 flex items-center justify-between text-xs gap-3 shrink-0 overflow-x-auto select-none">
      {/* Left: Capacity & Gross Valuation */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-semibold text-slate-400">Total Capacity:</span>
          <span className="font-mono font-black text-amber-300 text-xs">
            {totalSeats.toLocaleString()}
          </span>
        </div>

        <div className="h-3 w-px bg-slate-800" />

        <div className="flex items-center gap-1.5 text-slate-300">
          <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[11px] font-semibold text-slate-400">Box-Office Potential:</span>
          <span className="font-mono font-black text-emerald-300 text-xs">
            {formatMoney(totalGrossValue)}
          </span>
        </div>

        <div className="h-3 w-px bg-slate-800" />

        <div className="flex items-center gap-1.5 text-slate-300">
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[11px] font-semibold text-slate-400">Stands:</span>
          <span className="font-mono font-black text-sky-300 text-xs">
            {blocks.length} sections
          </span>
        </div>
      </div>

      {/* Right: Category Breakdown Rail */}
      <div className="flex items-center gap-1.5 shrink-0">
        {Object.values(categoryBreakdown).slice(0, 5).map((cat, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-700/60 bg-slate-800/80 text-[10px] font-medium"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: cat.color }}
            />
            <span className="text-slate-200 truncate max-w-[80px]" title={cat.name}>
              {cat.name}
            </span>
            <span className="font-mono text-amber-300 font-bold">
              {cat.seats.toLocaleString()}
            </span>
            {cat.price > 0 && (
              <span className="text-slate-400 font-mono text-[9px]">
                ({formatMoney(cat.price)})
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
