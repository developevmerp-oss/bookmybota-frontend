"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Clock } from "lucide-react";

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const PERIODS = ["AM", "PM"] as const;

const BRAND = "#6900AA";
const ITEM_H = 36;

function parseHm(value: string): { hour12: string; minute: string; period: "AM" | "PM" } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || "");
  if (!match) return { hour12: "12", minute: "00", period: "AM" };
  const h24 = Number(match[1]);
  const minute = match[2];
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour12: String(h12).padStart(2, "0"), minute, period };
}

function toHm24(hour12: string, minute: string, period: "AM" | "PM"): string {
  let h = Number(hour12) % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

function formatDisplay(value: string): string {
  if (!value) return "";
  const { hour12, minute, period } = parseHm(value);
  return `${hour12}:${minute} ${period}`;
}

function ScrollColumn({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly string[];
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const idx = Math.max(0, options.indexOf(value));
    el.scrollTop = idx * ITEM_H;
  }, [options, value]);

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label={ariaLabel}
      className="h-[216px] min-w-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#D8B4FE]"
    >
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <button
            key={opt}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onChange(opt)}
            className={`flex w-full items-center justify-center text-sm border-l-[3px] cursor-pointer transition-colors ${
              selected
                ? "font-semibold text-[#6900AA] bg-[#F7E9FF]"
                : "font-medium text-[#1B1B3A] hover:bg-[#F7E9FF] border-transparent"
            }`}
            style={{
              height: ITEM_H,
              ...(selected ? { borderLeftColor: BRAND } : undefined),
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export default function PreferredTimeSelect({ value, onChange, className = "" }: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const draft = parseHm(value);
  const [hour12, setHour12] = useState(draft.hour12);
  const [minute, setMinute] = useState(draft.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(draft.period);

  useEffect(() => {
    const next = parseHm(value);
    setHour12(next.hour12);
    setMinute(next.minute);
    setPeriod(next.period);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commit = (h: string, m: string, p: "AM" | "PM") => {
    setHour12(h);
    setMinute(m);
    setPeriod(p);
    onChange(toHm24(h, m, p));
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-[42px] w-full items-center justify-between gap-2 rounded-xl border bg-[#FAFAFA] px-3.5 text-sm transition-colors cursor-pointer ${
          open
            ? "border-[#6900AA] bg-white ring-2 ring-[#6900AA]/15"
            : "border-[#E5E7EB] hover:border-[#C4B5FD]"
        }`}
      >
        <span className={value ? "font-medium text-[#1B1B3A]" : "text-[#9CA3AF]"}>
          {value ? formatDisplay(value) : "HH : MM  AM/PM"}
        </span>
        <Clock size={15} className="shrink-0 text-[#6900AA]" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Select time"
          className="absolute left-0 right-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_12px_32px_rgba(105,0,170,0.12)]"
        >
          <div className="grid grid-cols-3 border-b border-[#F0EAF7] bg-[#FAFAFA] text-[10px] font-bold uppercase tracking-[0.12em] text-[#9CA3AF]">
            <span className="py-2 text-center">Hour</span>
            <span className="py-2 text-center border-x border-[#F0EAF7]">Minute</span>
            <span className="py-2 text-center">AM / PM</span>
          </div>
          <div className="flex divide-x divide-[#F0EAF7]">
            <ScrollColumn
              ariaLabel="Hour"
              options={HOURS}
              value={hour12}
              onChange={(h) => commit(h, minute, period)}
            />
            <ScrollColumn
              ariaLabel="Minute"
              options={MINUTES}
              value={minute}
              onChange={(m) => commit(hour12, m, period)}
            />
            <ScrollColumn
              ariaLabel="AM or PM"
              options={PERIODS}
              value={period}
              onChange={(p) => commit(hour12, minute, p as "AM" | "PM")}
            />
          </div>
        </div>
      ) : null}

      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="mt-1.5 text-[11px] font-semibold text-[#6900AA] hover:underline cursor-pointer"
        >
          Clear time
        </button>
      ) : null}
    </div>
  );
}
