"use client";

import React, { useState } from "react";
import { X, Sparkles, Trash2, Share2, Lock, Loader2 } from "lucide-react";
import { UNIVERSAL_TEMPLATES, UniversalTemplateDef } from "../templates/universalTemplates";
import { LAYOUT_CATEGORIES, LayoutCategory, LayoutStandardTemplate } from "../types";
import { categoryForVenueType } from "../utils/presets";

interface TemplatePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: UniversalTemplateDef) => void;
  /** Standard layouts saved by users */
  savedTemplates?: LayoutStandardTemplate[];
  savedLoading?: boolean;
  savedError?: string | null;
  /** Start from an empty white page */
  onBlank?: () => void;
  onSelectSaved?: (template: LayoutStandardTemplate) => void;
  onDeleteSaved?: (template: LayoutStandardTemplate) => void;
  onToggleShareSaved?: (template: LayoutStandardTemplate) => void;
}

type Source = "built_in" | "mine" | "shared";

export default function TemplatePickerModal({
  open,
  onClose,
  onSelectTemplate,
  savedTemplates = [],
  savedLoading = false,
  savedError = null,
  onBlank,
  onSelectSaved,
  onDeleteSaved,
  onToggleShareSaved,
}: TemplatePickerModalProps) {
  const [source, setSource] = useState<Source>("built_in");
  const [category, setCategory] = useState<LayoutCategory | "all">("all");

  if (!open) return null;

  const mine = savedTemplates.filter((t) => t.is_owner);
  const shared = savedTemplates.filter((t) => !t.is_owner && t.is_shared);

  const builtIn = UNIVERSAL_TEMPLATES.filter(
    (t) => category === "all" || categoryForVenueType(t.venueType) === category
  );
  const savedList = (source === "mine" ? mine : shared).filter(
    (t) => category === "all" || t.category === category
  );

  const sourceTabs: Array<{ id: Source; label: string; count?: number }> = [
    { id: "built_in", label: "Built-in", count: UNIVERSAL_TEMPLATES.length },
    { id: "mine", label: "My saved layouts", count: mine.length },
    { id: "shared", label: "Shared by others", count: shared.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(2, 6, 23, 0.8)" }}>
      <div role="dialog" aria-modal="true" aria-label="Choose a layout template" className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <span>Start from a standard layout</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pick a built-in layout or one saved by you or your team. Everything stays editable after loading.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source tabs */}
        <div className="px-6 pt-3 bg-slate-50 flex items-center gap-1 shrink-0">
          {sourceTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSource(tab.id)}
              className={`px-3 py-1.5 rounded-t-lg text-xs font-bold border-b-2 transition-colors ${
                source === tab.id ? "border-red-500 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && <span className="ml-1.5 text-[10px] font-mono text-slate-500">{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
          {[{ value: "all" as const, label: "All categories" }, ...LAYOUT_CATEGORIES].map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                category === c.value ? "bg-red-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:text-white"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {source === "built_in" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {onBlank && (
                  <div
                    onClick={() => {
                      onBlank();
                      onClose();
                    }}
                    className="p-4 rounded-xl border-2 border-dashed border-slate-300 bg-white hover:border-red-400 cursor-pointer transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                        Start fresh
                      </span>
                      <h3 className="mt-2 font-bold text-sm text-slate-900 group-hover:text-red-600 transition-colors">Blank page</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        An empty white canvas. Add rows, seats, shapes and colours yourself.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-red-600 font-bold">Start blank →</div>
                  </div>
                )}
                {builtIn.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    onClick={() => {
                      onSelectTemplate(tmpl);
                      onClose();
                    }}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:border-red-500/60 cursor-pointer transition-all flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
                          {tmpl.badge}
                        </span>
                        <span className="text-[11px] font-mono text-amber-600 font-bold">{tmpl.objects.length} Elements</span>
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-red-500 transition-colors">{tmpl.name}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{tmpl.description}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Click to load</span>
                      <span className="text-red-500 font-bold group-hover:translate-x-0.5 transition-transform">Load Template →</span>
                    </div>
                  </div>
                ))}
              </div>
          ) : savedLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading saved layouts…
            </div>
          ) : savedError ? (
            <p className="text-center text-sm text-red-500 py-10">{savedError}</p>
          ) : savedList.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-500 space-y-1">
              <p>{source === "mine" ? "You have not saved a layout yet." : "Nobody has shared a layout yet."}</p>
              {source === "mine" && <p className="text-xs">Build a layout, then use “Save as template” to reuse it later.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedList.map((tmpl) => (
                <div key={tmpl.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:border-red-500/60 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300">
                        {LAYOUT_CATEGORIES.find((c) => c.value === tmpl.category)?.label || tmpl.category}
                      </span>
                      <span className="text-[11px] font-mono text-amber-600 font-bold">{tmpl.objects_json.length} Elements</span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900">{tmpl.name}</h3>
                    {tmpl.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{tmpl.description}</p>}
                    <p className="text-[11px] text-slate-500 mt-1 font-mono">{tmpl.capacity.toLocaleString()} capacity</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                    <button
                      onClick={() => {
                        onSelectSaved?.(tmpl);
                        onClose();
                      }}
                      className="text-red-500 font-bold hover:text-red-500"
                    >
                      Use this layout →
                    </button>
                    {tmpl.is_owner && (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => onToggleShareSaved?.(tmpl)}
                          className={`p-1.5 rounded ${tmpl.is_shared ? "text-emerald-600" : "text-slate-500 hover:text-slate-900"}`}
                          title={tmpl.is_shared ? "Shared with everyone. Click to make private" : "Private. Click to share"}
                          aria-label={tmpl.is_shared ? "Make private" : "Share with everyone"}
                        >
                          {tmpl.is_shared ? <Share2 className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => onDeleteSaved?.(tmpl)}
                          className="p-1.5 rounded text-red-500 hover:text-red-500"
                          title="Delete template"
                          aria-label={`Delete ${tmpl.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
