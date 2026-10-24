"use client";

import React, { useState } from "react";
import { X, Sparkles, Send, Wand2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { generateDraftFromTextPrompt } from "../utils/geometryEngine";
import { UniversalVenueObject } from "../types";

interface TextPromptLayoutModalProps {
  open: boolean;
  onClose: () => void;
  onApplyGeneratedLayout: (objects: UniversalVenueObject[], promptText: string) => void;
}

export default function TextPromptLayoutModal({
  open,
  onClose,
  onApplyGeneratedLayout,
}: TextPromptLayoutModalProps) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  if (!open) return null;

  const quickPrompts = [
    "Create an oval football stadium with a central football pitch, 4 seating stands, lower and upper tiers, VIP pavilion, and entry gates.",
    "Create a wedding banquet hall with a central bridal stage, 16 round tables, 10 seats per table, and a central dance floor.",
    "Create an auditorium with a speaker stage, fan-shaped curved rows, and approximately 25 seats per row.",
    "Create an indoor basketball arena with hardwood court and 2 grandstand bleachers.",
  ];

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("Please enter a venue description");
      return;
    }

    setGenerating(true);
    setTimeout(() => {
      try {
        const objects = generateDraftFromTextPrompt(prompt);
        onApplyGeneratedLayout(objects, prompt);
        toast.success(`Generated layout draft with ${objects.length} elements from prompt`);
        onClose();
      } catch (err: any) {
        toast.error("Failed to generate layout draft: " + err.message);
      } finally {
        setGenerating(false);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-white">Generate Venue Layout from Description</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            Describe the venue you want to build in plain English. The rule-based geometry engine will parse your requirements, stands, tables, stage, and gates, and construct a customizable draft layout.
          </p>

          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">
              Venue Description Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Create a wedding hall with a central stage, 16 round tables, 10 seats per table, and a central dance floor..."
              rows={4}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-purple-500 font-sans custom-scrollbar placeholder:text-slate-500"
            />
          </div>

          {/* Quick Examples */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Quick Starting Examples:
            </span>
            <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
              {quickPrompts.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => setPrompt(q)}
                  className="w-full text-left p-2 rounded-lg bg-slate-900/50 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-colors flex items-center justify-between group"
                >
                  <span className="truncate pr-2">{q}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-900/60 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Rule-based geometry generator • 100% offline &amp; private
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{generating ? "Generating Draft..." : "Generate Draft Layout"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
