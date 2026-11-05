"use client";

import React, { useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { LAYOUT_CATEGORIES, LayoutCategory } from "../types";

interface SaveTemplateModalProps {
  open: boolean;
  defaultName: string;
  defaultCategory: LayoutCategory;
  elementCount: number;
  capacity: number;
  saving: boolean;
  onClose: () => void;
  onSave: (input: { name: string; description: string; category: LayoutCategory; isShared: boolean }) => void;
}

/** Save the current layout as a standard template other layouts can start from */
export default function SaveTemplateModal(props: SaveTemplateModalProps) {
  if (!props.open) return null;
  // Remount on each open so the form starts from the current layout
  return <SaveTemplateForm key={`${props.defaultName}-${props.defaultCategory}`} {...props} />;
}

function SaveTemplateForm({
  defaultName,
  defaultCategory,
  elementCount,
  capacity,
  saving,
  onClose,
  onSave,
}: SaveTemplateModalProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<LayoutCategory>(defaultCategory);
  const [isShared, setIsShared] = useState(false);
  const [touched, setTouched] = useState(false);

  const nameError = !name.trim() ? "Give the template a name." : name.trim().length > 160 ? "Keep the name under 160 characters." : "";

  const submit = () => {
    setTouched(true);
    if (nameError) return;
    onSave({ name: name.trim(), description: description.trim(), category, isShared });
  };

  const input =
    "w-full bg-white border border-slate-300 rounded px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-red-500";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" style={{ background: "rgba(2, 6, 23, 0.75)" }}>
      <div role="dialog" aria-modal="true" aria-label="Save as standard layout" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Save className="w-4 h-4 text-amber-600" /> Save as standard layout
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {elementCount} element{elementCount === 1 ? "" : "s"} · {capacity.toLocaleString()} capacity · seat types included
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 text-xs">
          <div>
            <label className="text-slate-500 block mb-1" htmlFor="tmpl-name">
              Template name
            </label>
            <input id="tmpl-name" value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="e.g. 200-seat cinema hall" autoFocus />
            {touched && nameError && <p className="text-red-500 mt-1">{nameError}</p>}
          </div>

          <div>
            <label className="text-slate-500 block mb-1" htmlFor="tmpl-category">
              Category
            </label>
            <select id="tmpl-category" value={category} onChange={(e) => setCategory(e.target.value as LayoutCategory)} className={input}>
              {LAYOUT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-500 block mb-1" htmlFor="tmpl-desc">
              Description (optional)
            </label>
            <textarea id="tmpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={input} placeholder="When should this layout be used?" />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} className="mt-0.5 accent-red-600" />
            <span className="text-slate-700">
              Share with everyone who uses the layout designer
              <span className="block text-slate-500">Others can start new layouts from it. Only you can delete it.</span>
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-bold disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? "Saving…" : "Save template"}
          </button>
        </div>
      </div>
    </div>
  );
}
