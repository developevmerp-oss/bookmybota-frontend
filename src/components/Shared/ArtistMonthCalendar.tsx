"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

type Props = {
  /** Dates marked free (YYYY-MM-DD) */
  freeDates: string[];
  /** Dates already booked */
  bookedDates?: string[];
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
  /** When true, clicking a free/open day toggles selection for artist editing */
  mode?: "view" | "pick" | "toggle";
  className?: string;
};

export default function ArtistMonthCalendar({
  freeDates,
  bookedDates = [],
  selectedDate = null,
  onSelectDate,
  mode = "pick",
  className = "",
}: Props) {
  const today = ymd(new Date());
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const freeSet = useMemo(() => new Set(freeDates), [freeDates]);
  const bookedSet = useMemo(() => new Set(bookedDates), [bookedDates]);

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const list: Array<{ date: string; inMonth: boolean; day: number } | null> = [];
    for (let i = 0; i < startPad; i++) list.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = ymd(new Date(cursor.year, cursor.month, day));
      list.push({ date, inMonth: true, day });
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [cursor]);

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-bold text-slate-800">{monthLabel(cursor.year, cursor.month)}</p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wide text-slate-400 py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} className="aspect-square" />;
          const isPast = cell.date < today;
          const isFree = freeSet.has(cell.date);
          const isBooked = bookedSet.has(cell.date);
          const isSelected = selectedDate === cell.date;
          const clickable =
            Boolean(onSelectDate) &&
            !isPast &&
            (mode === "toggle" || (mode === "pick" && isFree && !isBooked) || mode === "view");

          let cls =
            "aspect-square rounded-xl text-sm font-semibold flex items-center justify-center border transition-colors ";
          if (isPast) cls += "border-transparent text-slate-300 bg-slate-50 cursor-default";
          else if (isBooked) cls += "border-rose-200 bg-rose-50 text-rose-700 cursor-default";
          else if (isSelected) cls += "border-violet-500 bg-violet-600 text-white shadow-sm";
          else if (isFree) cls += "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
          else if (mode === "toggle")
            cls += "border-slate-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50";
          else cls += "border-transparent text-slate-400 bg-slate-50 cursor-default";

          return (
            <button
              key={cell.date}
              type="button"
              disabled={!clickable}
              onClick={() => onSelectDate?.(cell.date)}
              className={cls}
              title={
                isBooked
                  ? "Booked"
                  : isFree
                    ? "Available"
                    : mode === "toggle"
                      ? "Click to mark free"
                      : undefined
              }
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-medium text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-300" /> Free
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-50 border border-rose-200" /> Booked
        </span>
        {mode === "toggle" ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-white border border-slate-200" /> Click to add
          </span>
        ) : null}
      </div>
    </div>
  );
}
