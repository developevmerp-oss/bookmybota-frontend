"use client";

import React, { useState } from "react";
import { X, Sparkles, Check, Building, Trophy, Film, Music, Wine, Users, Layers } from "lucide-react";
import { UNIVERSAL_TEMPLATES, UniversalTemplateDef } from "../templates/universalTemplates";

interface TemplatePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: UniversalTemplateDef) => void;
}

export default function TemplatePickerModal({
  open,
  onClose,
  onSelectTemplate,
}: TemplatePickerModalProps) {
  const [filterType, setFilterType] = useState<string>("all");

  if (!open) return null;

  const categories = [
    { id: "all", label: "All Venues" },
    { id: "stadium", label: "Stadiums & Arenas" },
    { id: "performance", label: "Theatres & Concerts" },
    { id: "hospitality", label: "Weddings & Banquets" },
    { id: "cinema", label: "Cinemas & Auditoriums" },
  ];

  const filtered = UNIVERSAL_TEMPLATES.filter((t) => {
    if (filterType === "all") return true;
    if (filterType === "stadium") return t.venueType.includes("stadium") || t.venueType.includes("arena");
    if (filterType === "performance") return t.venueType === "theatre" || t.venueType === "concert_hall";
    if (filterType === "hospitality") return t.venueType === "wedding_hall" || t.venueType === "restaurant";
    if (filterType === "cinema") return t.venueType === "cinema" || t.venueType === "auditorium";
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/60">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Choose a Universal Venue Template</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select any pre-modeled venue layout as a starting foundation. Fully editable after loading.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="px-6 py-2.5 bg-slate-900/40 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterType(c.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                filterType === c.id
                  ? "bg-red-600 text-white shadow-sm"
                  : "bg-slate-800/80 text-slate-400 hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 custom-scrollbar">
          {filtered.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => {
                onSelectTemplate(tmpl);
                onClose();
              }}
              className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-850 hover:border-red-500/60 cursor-pointer transition-all flex flex-col justify-between group shadow-sm hover:shadow-red-950/20"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                    {tmpl.badge}
                  </span>
                  <span className="text-[11px] font-mono text-amber-400 font-bold">
                    {tmpl.objects.length} Elements
                  </span>
                </div>
                <h3 className="font-bold text-sm text-white group-hover:text-red-400 transition-colors">
                  {tmpl.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                  {tmpl.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Click to load</span>
                <span className="text-red-400 font-bold group-hover:translate-x-0.5 transition-transform">
                  Load Template →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
