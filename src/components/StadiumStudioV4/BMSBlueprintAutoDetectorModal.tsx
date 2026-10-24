"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  Sparkles,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Scan,
  Compass,
  Layers,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import {
  BMSVenueArchetype,
  BMSSectionDefV4,
  BMSStageGroundDefV4,
  BMSAmenityPOIV4,
} from "./types";
import { BMS_ARCHETYPE_PRESETS } from "./BMSArchetypePresets";

import { analyzeBlueprintImage } from "@/lib/blueprintVisionEngine";

interface BMSBlueprintAutoDetectorModalProps {
  open: boolean;
  onClose: () => void;
  onApplyLayout: (data: {
    archetype: BMSVenueArchetype;
    blueprintUrl: string;
    groundConfig: BMSStageGroundDefV4;
    sections: BMSSectionDefV4[];
    amenities: BMSAmenityPOIV4[];
  }) => void;
}

export default function BMSBlueprintAutoDetectorModal({
  open,
  onClose,
  onApplyLayout,
}: BMSBlueprintAutoDetectorModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>("");
  const [detectedArchetype, setDetectedArchetype] = useState<BMSVenueArchetype>("stadium");
  const [confidence, setConfidence] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/") && selected.type !== "application/pdf") {
      toast.error("Please upload an image file (PNG, JPG, WebP) or a PDF blueprint.");
      return;
    }

    setFile(selected);
    const objectUrl = URL.createObjectURL(selected);
    setPreviewUrl(objectUrl);
  };

  const handleStartAutoDetect = async () => {
    if (!previewUrl) {
      toast.error("Please select a blueprint image or PDF first.");
      return;
    }

    setIsScanning(true);
    setScanStep("Scanning blueprint pixel matrix & color vectors...");

    try {
      await new Promise((r) => setTimeout(r, 400));
      setScanStep("Analyzing geometric center focal point (pitch, court, stage)...");

      const result = await analyzeBlueprintImage(previewUrl);

      await new Promise((r) => setTimeout(r, 600));
      setScanStep(
        result.detectionMetrics.pitchFound
          ? `Detected central ${result.detectionMetrics.pitchType} turf. Tracing concentric bowl contours...`
          : "Analyzing architectural edge vectors & concentric seating boundaries..."
      );

      await new Promise((r) => setTimeout(r, 600));
      setScanStep(
        `Synthesized ${result.sections.length} tailored stand sectors (~${result.detectionMetrics.estimatedSeats.toLocaleString()} seats)...`
      );

      await new Promise((r) => setTimeout(r, 400));

      setDetectedArchetype(result.archetype);
      setConfidence(result.confidence);
      setIsScanning(false);

      onApplyLayout({
        archetype: result.archetype,
        blueprintUrl: previewUrl,
        groundConfig: result.groundConfig,
        sections: result.sections,
        amenities: result.amenities,
      });

      toast.success(
        `Auto-drawn dynamic ${result.detectionMetrics.bowlShape.replace(/_/g, " ")} layout directly from your blueprint image!`
      );
      onClose();
    } catch (err: any) {
      setIsScanning(false);
      toast.error(err?.message || "Failed to analyze blueprint");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-gradient-to-r from-purple-600 to-rose-600 text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                AI Blueprint Auto-Detector
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload any architectural blueprint (PNG, JPG, PDF) to auto-detect and draw the stadium layout.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Upload Area */}
          {!previewUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-rose-500/70 bg-slate-950/50 hover:bg-slate-950/80 rounded-2xl p-8 text-center cursor-pointer transition-all group"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-800 group-hover:bg-rose-500/10 border border-slate-700 group-hover:border-rose-500/30 flex items-center justify-center mx-auto text-slate-400 group-hover:text-rose-400 transition-colors">
                <Upload className="w-8 h-8" />
              </div>
              <h3 className="mt-4 font-bold text-white text-base">
                Click to upload venue blueprint
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Supports architectural CAD plans in PNG, JPG, WebP, SVG, and PDF
              </p>
              <span className="inline-block mt-3 px-3 py-1 rounded-full bg-slate-800 text-[11px] font-mono text-slate-300">
                Max file size: 25 MB
              </span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Uploaded Blueprint"
                  className="max-h-full max-w-full object-contain"
                />

                {/* Scanning Laser Beam Effect when active */}
                {isScanning && (
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-rose-500/20 to-transparent animate-pulse pointer-events-none border-b-2 border-rose-500" />
                )}

                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  className="absolute top-3 right-3 px-2.5 py-1 bg-black/70 hover:bg-black text-white text-xs font-semibold rounded-lg border border-slate-700 backdrop-blur-sm"
                >
                  Change File
                </button>
              </div>

              {/* Status Message */}
              {isScanning && (
                <div className="bg-slate-950/80 border border-purple-500/30 p-4 rounded-xl flex items-center gap-3">
                  <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-white block">AI Auto-Detector in Progress</span>
                    <span className="text-slate-400 font-mono">{scanStep}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Feature Highlights */}
          <div className="grid grid-cols-3 gap-3 text-[11px]">
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-slate-300">
              <Scan className="w-4 h-4 text-rose-400 mb-1.5" />
              <span className="font-bold block text-white">Contour Detection</span>
              Traces concentric bowl arcs & irregular bleachers.
            </div>
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-slate-300">
              <Compass className="w-4 h-4 text-purple-400 mb-1.5" />
              <span className="font-bold block text-white">Focal Auto-Centering</span>
              Positions soccer turf, stage, or screen at exact focal.
            </div>
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-slate-300">
              <Layers className="w-4 h-4 text-emerald-400 mb-1.5" />
              <span className="font-bold block text-white">Locked Reference Layer</span>
              Keeps blueprint aligned under vector stands for review.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!previewUrl || isScanning}
            onClick={handleStartAutoDetect}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-rose-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-bold flex items-center gap-2 shadow-lg shadow-rose-950/50 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isScanning ? "Analyzing..." : "Auto-Detect & Draw Layout"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
