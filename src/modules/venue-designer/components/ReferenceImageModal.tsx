"use client";

import React, { useRef } from "react";
import { X, Upload, FileImage, Trash2, Sliders } from "lucide-react";
import { toast } from "sonner";

interface ReferenceImageModalProps {
  open: boolean;
  onClose: () => void;
  blueprintUrl: string | null;
  blueprintOpacity: number;
  onSetBlueprintUrl: (url: string | null) => void;
  onSetBlueprintOpacity: (opacity: number) => void;
}

export default function ReferenceImageModal({
  open,
  onClose,
  blueprintUrl,
  blueprintOpacity,
  onSetBlueprintUrl,
  onSetBlueprintOpacity,
}: ReferenceImageModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Please upload an image file (PNG, JPG, WebP) or floor plan");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      onSetBlueprintUrl(dataUrl);
      onSetBlueprintOpacity(0.4);
      toast.success("Reference floor plan loaded as background layer");
      onClose();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <FileImage className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Reference Blueprint &amp; Floor Plan</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Upload Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-red-500 rounded-xl p-6 text-center cursor-pointer transition-all bg-slate-900/40 hover:bg-slate-900/80 group"
          >
            <Upload className="w-8 h-8 mx-auto text-slate-500 group-hover:text-red-400 transition-colors mb-2" />
            <p className="font-bold text-sm text-slate-200">
              {blueprintUrl ? "Replace Reference Image" : "Upload Floor Plan or Blueprint"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Supports PNG, JPG, WebP images. Calibrate opacity to trace sections on canvas.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Opacity Control */}
          {blueprintUrl && (
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Background Opacity</span>
                  <span className="font-mono font-bold text-white">
                    {Math.round(blueprintOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={blueprintOpacity}
                  onChange={(e) => onSetBlueprintOpacity(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
              </div>

              <button
                onClick={() => {
                  onSetBlueprintUrl(null);
                  toast.info("Removed reference image");
                }}
                className="w-full py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove Reference Image</span>
              </button>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-900/60 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
