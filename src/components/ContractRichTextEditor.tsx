"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Code, Plus } from "lucide-react";
import {
  CONTRACT_DYNAMIC_FIELDS,
  htmlFromTokenChips,
  htmlWithTokenChips,
} from "@/lib/contractPlaceholdersShared";

interface ContractRichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function ContractRichTextEditor({
  value,
  onChange,
  placeholder = "Enter contract terms, clauses, and responsibilities…",
  minHeight = "280px",
}: ContractRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showSource, setShowSource] = useState(false);
  const [source, setSource] = useState("");
  const [fieldOpen, setFieldOpen] = useState(false);
  const syncing = useRef(false);

  useEffect(() => {
    if (showSource) {
      setSource(htmlFromTokenChips(value));
      return;
    }
    const el = editorRef.current;
    if (!el || syncing.current) return;
    const display = htmlWithTokenChips(htmlFromTokenChips(value));
    if (el.innerHTML !== display) {
      el.innerHTML = display || "";
    }
  }, [value, showSource]);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    syncing.current = true;
    onChange(htmlFromTokenChips(el.innerHTML));
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, [onChange]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    emitChange();
  };

  const insertField = (token: string) => {
    const field = CONTRACT_DYNAMIC_FIELDS.find((f) => f.token === token);
    if (!field || !editorRef.current) return;
    editorRef.current.focus();
    const chip = `<span class="contract-token-chip" data-token="${token}" contenteditable="false">${field.label}</span>&nbsp;`;
    document.execCommand("insertHTML", false, chip);
    setFieldOpen(false);
    emitChange();
  };

  const applySource = () => {
    onChange(source);
    setShowSource(false);
  };

  return (
    <div className="contract-editor rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-200 bg-slate-50">
        <div className="relative">
          <button
            type="button"
            onClick={() => setFieldOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            <Plus size={14} /> Insert Dynamic Field
          </button>
          {fieldOpen && (
            <div className="absolute left-0 top-full mt-1 z-20 w-56 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg py-1">
              {CONTRACT_DYNAMIC_FIELDS.map((f) => (
                <button
                  key={f.token}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50"
                  onClick={() => insertField(f.token)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowSource((s) => !s)}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-white"
        >
          <Code size={14} /> {showSource ? "Visual editor" : "Source Code (HTML)"}
        </button>
      </div>

      {!showSource && (
        <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-slate-100 bg-white">
          {[
            ["bold", "B"],
            ["italic", "I"],
            ["underline", "U"],
          ].map(([cmd, label]) => (
            <button
              key={cmd}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec(cmd)}
              className="w-8 h-8 rounded border border-slate-200 text-sm font-semibold hover:bg-slate-50"
            >
              {label}
            </button>
          ))}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} className="px-2 h-8 rounded border border-slate-200 text-xs hover:bg-slate-50">• List</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")} className="px-2 h-8 rounded border border-slate-200 text-xs hover:bg-slate-50">1. List</button>
        </div>
      )}

      {showSource ? (
        <div className="p-3 space-y-2">
          <textarea
            className="input-field w-full font-mono text-xs min-h-[280px]"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <button type="button" onClick={applySource} className="text-sm text-emerald-700 font-medium">
            Apply HTML
          </button>
        </div>
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          data-placeholder={placeholder}
          className="contract-editor-body px-4 py-3 text-slate-800 text-sm leading-relaxed outline-none"
          style={{ minHeight }}
        />
      )}
    </div>
  );
}
