"use client";

import React from "react";
import { X, CheckCircle2, Sparkles, Building2, Ticket, Users, Layers } from "lucide-react";
import { BMSVenueArchetype } from "./types";
import { BMS_ARCHETYPE_PRESETS } from "./BMSArchetypePresets";

interface BMSArchetypeSelectorModalProps {
  open: boolean;
  currentArchetype: BMSVenueArchetype;
  onSelect: (archetype: BMSVenueArchetype) => void;
  onClose: () => void;
}

export default function BMSArchetypeSelectorModal({
  open,
  currentArchetype,
  onSelect,
  onClose,
}: BMSArchetypeSelectorModalProps) {
  if (!open) return null;

  const archetypes: BMSVenueArchetype[] = [
    "stadium",
    "cinema",
    "concert_festival",
    "banquet",
    "auditorium",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-extrabold text-[10px] uppercase tracking-wider border border-rose-500/30">
                BookMyShow Universal Engine
              </span>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Choose Venue Archetype
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Select the physical venue format. The engine will instantly adapt the coordinate matrix, stage orientation, and seat generators.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Archetype Cards Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {archetypes.map((arch) => {
            const data = BMS_ARCHETYPE_PRESETS[arch];
            const isSelected = currentArchetype === arch;

            return (
              <div
                key={arch}
                onClick={() => onSelect(arch)}
                className={`relative group cursor-pointer p-5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-rose-950/20 border-rose-500/70 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/50"
                    : "bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/80"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-2xl shadow-inner">
                    {data.icon}
                  </div>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                      <CheckCircle2 className="w-3 h-3" /> Active Layout
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="font-bold text-white text-base group-hover:text-rose-300 transition-colors">
                    {data.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {data.subtitle}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Default Sections: {data.defaultSections.length}</span>
                  <span className="font-medium text-slate-400 group-hover:text-rose-400 transition-colors">
                    Load Blueprint Template &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>⚠️ Switching archetype replaces current canvas layout with the selected template.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
