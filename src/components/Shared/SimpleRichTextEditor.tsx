"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Code } from "lucide-react";

type SimpleRichTextEditorProps = {
  id?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
};

/** Lightweight contentEditable editor for partner policy text (bold / lists / etc.). */
export default function SimpleRichTextEditor({
  id,
  value,
  onChange,
  placeholder = "Write your policy…",
  minHeight = "180px",
  disabled = false,
}: SimpleRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [showSource, setShowSource] = useState(false);
  const [source, setSource] = useState("");
  const syncing = useRef(false);

  useEffect(() => {
    if (showSource) {
      setSource(value || "");
      return;
    }
    const el = editorRef.current;
    if (!el || syncing.current) return;
    if (el.innerHTML !== (value || "")) {
      el.innerHTML = value || "";
    }
  }, [value, showSource]);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    syncing.current = true;
    onChange(el.innerHTML);
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, [onChange]);

  const ensureCaretInEditor = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (sel.rangeCount > 0 && el.contains(sel.anchorNode)) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const exec = (cmd: string, val?: string) => {
    if (disabled) return;
    ensureCaretInEditor();
    document.execCommand(cmd, false, val);
    emitChange();
  };

  const applySource = () => {
    onChange(source);
    setShowSource(false);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-slate-100 bg-slate-50">
        {[
          ["bold", "B", "font-bold"],
          ["italic", "I", "italic"],
          ["underline", "U", "underline"],
        ].map(([cmd, label, cls]) => (
          <button
            key={cmd}
            type="button"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec(cmd)}
            className={`w-8 h-8 rounded-lg border border-slate-200 text-sm text-slate-800 hover:bg-white disabled:opacity-50 cursor-pointer ${cls}`}
            aria-label={cmd}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertUnorderedList")}
          className="px-2 h-8 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50 cursor-pointer"
        >
          • List
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec("insertOrderedList")}
          className="px-2 h-8 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50 cursor-pointer"
        >
          1. List
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowSource((s) => !s)}
          className="ml-auto inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50 cursor-pointer"
        >
          <Code size={14} />
          {showSource ? "Visual" : "HTML"}
        </button>
      </div>

      {showSource ? (
        <div className="p-3 space-y-2">
          <textarea
            id={id}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 min-h-[160px] focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            value={source}
            disabled={disabled}
            onChange={(e) => setSource(e.target.value)}
          />
          <button
            type="button"
            onClick={applySource}
            disabled={disabled}
            className="text-sm font-semibold text-rose-600 hover:text-rose-700 cursor-pointer disabled:opacity-50"
          >
            Apply HTML
          </button>
        </div>
      ) : (
        <div
          id={id}
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emitChange}
          data-placeholder={placeholder}
          className="simple-rte-body px-4 py-3 text-slate-800 text-sm leading-relaxed outline-none"
          style={{ minHeight }}
        />
      )}
    </div>
  );
}
