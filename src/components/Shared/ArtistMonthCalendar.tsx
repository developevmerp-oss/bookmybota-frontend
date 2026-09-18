"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FREE_BG = "#E9D5FF";
const FREE_TEXT = "#57008E";
const SELECTED_BG = "#6900AA";
const BOOKED_BG = "#F43F5E";

const BOOKING_OPEN_BG = "#F3E8FF";
const BOOKING_OPEN_TEXT = "#4C1D95";
const BOOKING_SELECTED_BG = "#7C3AED";
const BOOKING_UNAVAILABLE_BG = "#F3F4F6";
const BOOKING_UNAVAILABLE_TEXT = "#D1D5DB";
const BOOKING_GREEN = "#22C55E";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function monthLabelUpper(year: number, month: number): string {
  return monthLabel(year, month).toUpperCase();
}

type Cell = { date: string; inMonth: boolean; day: number };

type Props = {
  /** Dates marked free (YYYY-MM-DD) */
  freeDates: string[];
  /** Dates already booked */
  bookedDates?: string[];
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
  /** When true, clicking a free/open day toggles selection for artist editing */
  mode?: "view" | "pick" | "toggle";
  /** Visual only. "glass" is the artist booking calendar look. "booking" matches venue free-dates UI. */
  variant?: "default" | "glass" | "booking";
  title?: string;
  subtitle?: string;
  className?: string;
};

export default function ArtistMonthCalendar({
  freeDates,
  bookedDates = [],
  selectedDate = null,
  onSelectDate,
  mode = "pick",
  variant = "default",
  title,
  subtitle,
  className = "",
}: Props) {
  const today = ymd(new Date());
  const glass = variant === "glass";
  const booking = variant === "booking";
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
    const list: Array<Cell | null> = [];

    if (booking) {
      const prevMonthLast = new Date(cursor.year, cursor.month, 0).getDate();
      for (let i = startPad - 1; i >= 0; i--) {
        const day = prevMonthLast - i;
        const date = ymd(new Date(cursor.year, cursor.month - 1, day));
        list.push({ date, inMonth: false, day });
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const date = ymd(new Date(cursor.year, cursor.month, day));
        list.push({ date, inMonth: true, day });
      }
      let nextDay = 1;
      while (list.length % 7 !== 0) {
        const date = ymd(new Date(cursor.year, cursor.month + 1, nextDay));
        list.push({ date, inMonth: false, day: nextDay });
        nextDay += 1;
      }
      return list;
    }

    for (let i = 0; i < startPad; i++) list.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = ymd(new Date(cursor.year, cursor.month, day));
      list.push({ date, inMonth: true, day });
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [cursor, booking]);

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  };

  if (booking) {
    return (
      <div
        className={`rounded-2xl border border-[#EFEAF6] bg-white p-4 sm:p-5 shadow-[0_8px_28px_rgba(17,17,17,0.06)] ${className}`}
      >
        <div className="mb-4 flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="min-w-0 flex-1 text-center">
            <div className="inline-flex max-w-full items-center justify-center gap-1.5">
              <CalendarDays size={16} className="shrink-0 text-[#7C3AED]" strokeWidth={2} />
              <p className="truncate text-sm font-bold text-[#111111] sm:text-[15px]">
                {monthLabel(cursor.year, cursor.month)}
              </p>
            </div>
            <p className="mt-0.5 text-[11px] text-[#9CA3AF] sm:text-xs">
              Select a date to check availability
            </p>
          </div>

          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>

          <button
            type="button"
            onClick={goToday}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#F3E8FF] px-3 text-xs font-semibold text-[#7C3AED] hover:bg-[#EDE4F7] cursor-pointer"
          >
            <CalendarDays size={14} strokeWidth={2} />
            Today
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#B0A8BC]"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} className="aspect-square" />;

            const isPast = cell.date < today;
            const isFree = cell.inMonth && freeSet.has(cell.date);
            const isBooked = bookedSet.has(cell.date);
            const isSelected = selectedDate === cell.date;
            const clickable =
              Boolean(onSelectDate) &&
              cell.inMonth &&
              !isPast &&
              (mode === "toggle" || (mode === "pick" && isFree && !isBooked) || mode === "view");

            let cellClass =
              "relative aspect-square w-full rounded-xl text-sm font-semibold flex flex-col items-center justify-center transition-colors ";
            let style: CSSProperties | undefined;

            if (isSelected && isFree) {
              cellClass += "text-white cursor-pointer";
              style = { backgroundColor: BOOKING_SELECTED_BG };
            } else if (isFree && !isBooked) {
              cellClass += "cursor-pointer hover:brightness-95";
              style = { backgroundColor: BOOKING_OPEN_BG, color: BOOKING_OPEN_TEXT };
            } else if (mode === "toggle" && cell.inMonth && !isPast && !isBooked) {
              cellClass += "cursor-pointer hover:bg-[#F3E8FF]";
              style = { backgroundColor: BOOKING_UNAVAILABLE_BG, color: "#6B7280" };
            } else {
              cellClass += "cursor-default";
              style = {
                backgroundColor: BOOKING_UNAVAILABLE_BG,
                color: BOOKING_UNAVAILABLE_TEXT,
              };
            }

            return (
              <button
                key={`${cell.date}-${i}`}
                type="button"
                disabled={!clickable}
                onClick={() => onSelectDate?.(cell.date)}
                className={cellClass}
                style={style}
                title={
                  isBooked
                    ? "Booked"
                    : isSelected
                      ? "Selected"
                      : isFree
                        ? "Open for booking"
                        : undefined
                }
              >
                <span className="leading-none">{cell.day}</span>
                {isSelected && isFree ? (
                  <span
                    className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-white"
                    aria-hidden
                  />
                ) : isFree && !isBooked ? (
                  <span
                    className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: BOOKING_GREEN }}
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium text-[#6B7280]">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded"
              style={{ backgroundColor: BOOKING_UNAVAILABLE_BG }}
            />
            Unavailable
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded"
              style={{ backgroundColor: BOOKING_OPEN_BG }}
            />
            Available
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded"
              style={{ backgroundColor: BOOKING_SELECTED_BG }}
            />
            Selected
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "#DCFCE7" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: BOOKING_GREEN }}
              />
            </span>
            Open for booking
          </span>
        </div>
      </div>
    );
  }

  if (glass) {
    return (
      <div
        className={`rounded-[1.5rem] border border-[#F0EAF7] bg-white p-4 sm:p-5 shadow-[0_10px_30px_rgba(105,0,170,0.07)] ${className}`}
      >
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#111111]">{title}</h2>
            ) : null}
            {subtitle ? <p className="mt-1 text-sm text-[#8b8794]">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="h-8 w-8 rounded-full bg-[#F3F4F6] text-[#6b7280] hover:bg-[#E5E7EB] flex items-center justify-center cursor-pointer"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="h-8 w-8 rounded-full bg-[#F3F4F6] text-[#6b7280] hover:bg-[#E5E7EB] flex items-center justify-center cursor-pointer"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <p className="mb-3 text-center text-[11px] sm:text-xs font-bold tracking-[0.14em] text-[#1B1B3A]">
          {monthLabelUpper(cursor.year, cursor.month)}
        </p>

        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-semibold uppercase tracking-wide text-[#B0A8BC] py-1"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1.5">
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
              "mx-auto h-9 w-9 sm:h-10 sm:w-10 rounded-full text-sm flex items-center justify-center transition-all ";

            let style: CSSProperties | undefined;

            if (isPast) {
              cls += "font-normal text-[#D1D5DB] cursor-default";
            } else if (isBooked) {
              cls += "font-semibold text-white cursor-default";
              style = { backgroundColor: BOOKED_BG };
            } else if (isSelected) {
              cls += "font-bold text-white cursor-pointer ring-2 ring-offset-2 ring-[#C084FC] shadow-md";
              style = { backgroundColor: SELECTED_BG };
            } else if (isFree) {
              cls += "font-bold cursor-pointer hover:brightness-95";
              style = { backgroundColor: FREE_BG, color: FREE_TEXT };
            } else if (mode === "toggle") {
              cls += "font-semibold text-[#6900AA] hover:bg-[#F3E8FF] cursor-pointer";
            } else {
              cls += "font-normal text-[#D1D5DB] cursor-default";
            }

            return (
              <button
                key={cell.date}
                type="button"
                disabled={!clickable}
                onClick={() => onSelectDate?.(cell.date)}
                className={cls}
                style={style}
                title={
                  isBooked
                    ? "Booked"
                    : isSelected
                      ? "Selected"
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

        <div className="mt-4 pt-3 border-t border-[#F0EAF7] flex flex-wrap gap-4 text-[11px] font-medium text-[#8b8794]">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ backgroundColor: FREE_BG, border: `1px solid ${FREE_TEXT}` }}
            />
            Free
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-[#C084FC]"
              style={{ backgroundColor: SELECTED_BG }}
            />
            Selected
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: BOOKED_BG }} />
            Booked
          </span>
          {mode === "toggle" ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full border border-[#D1D5DB] bg-white" />
              Click to add
            </span>
          ) : null}
        </div>
      </div>
    );
  }

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
          <div
            key={d}
            className="text-center text-[10px] font-bold uppercase tracking-wide text-slate-400 py-1"
          >
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
          else if (isSelected)
            cls += "border-[#6900AA] bg-[#6900AA] text-white shadow-sm ring-2 ring-[#C084FC] ring-offset-1";
          else if (isFree)
            cls += "border-[#C084FC] bg-[#E9D5FF] text-[#57008E] hover:bg-[#DDD6FE]";
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
                  : isSelected
                    ? "Selected"
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
          <span className="w-3 h-3 rounded bg-[#E9D5FF] border border-[#C084FC]" /> Free
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#6900AA] border border-[#6900AA]" /> Selected
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
