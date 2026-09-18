"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Settings,
  CalendarCheck,
  Users,
  TrendingUp,
  Save,
  Clock,
  Info,
  Zap,
  Coffee,
  Sun,
  Sunset,
  Moon,
  UtensilsCrossed,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetBusinessSettingsQuery,
  useGetBusinessBookingsQuery,
  useUpdateBusinessSettingsMutation,
  useGetBusinessOperatingDatesQuery,
  useUpsertBusinessOperatingDateMutation,
  type DiningMealsConfig,
  type BusinessOperatingDate,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import BusinessLandingPage from "@/components/DiningAdminPanel/BusinessLandingPage";
import { extractApiError } from "@/lib/apiErrors";

const MEAL_KEYS = ["breakfast", "lunch", "dinner"] as const;

const MEAL_META: Record<
  string,
  { Icon: typeof Sun; row: string; iconBg: string; iconColor: string }
> = {
  breakfast: {
    Icon: Coffee,
    row: "border-slate-200",
    iconBg: "bg-rose-100",
    iconColor: "text-rose-500",
  },
  lunch: {
    Icon: Sun,
    row: "border-slate-200",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-500",
  },
  dinner: {
    Icon: Moon,
    row: "border-slate-200",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-500",
  },
};

const DEFAULT_MEALS: DiningMealsConfig = {
  breakfast: { open: "08:00", close: "11:00", active: true },
  lunch: { open: "11:30", close: "16:00", active: true },
  dinner: { open: "17:00", close: "23:00", active: true },
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthBounds(year: number, month: number) {
  const from = `${year}-${pad2(month + 1)}-01`;
  const last = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${pad2(month + 1)}-${pad2(last)}`;
  return { from, to };
}

function formatSelectedLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toMinutes(hm: string): number {
  const [h, m] = (hm || "00:00").slice(0, 5).split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function fromMinutes(total: number): string {
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(wrapped / 60))}:${pad2(wrapped % 60)}`;
}

function formatHmLabel(hm: string): string {
  const [h, m] = (hm || "00:00").slice(0, 5).split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${pad2(m)} ${period}`;
}

function isSameDayWindow(open: string, close: string): boolean {
  return Boolean(open && close && close > open);
}

function clampHmToWindow(hm: string, open: string, close: string): string {
  if (!isSameDayWindow(open, close)) return (hm || open).slice(0, 5);
  const mins = toMinutes(hm);
  return fromMinutes(Math.min(toMinutes(close), Math.max(toMinutes(open), mins)));
}

function clampMealsToWindow(
  meals: DiningMealsConfig,
  open: string,
  close: string
): DiningMealsConfig {
  if (!isSameDayWindow(open, close)) return meals;
  const clampOne = (meal: DiningMealsConfig["breakfast"]) => {
    let from = clampHmToWindow(meal.open, open, close);
    let to = clampHmToWindow(meal.close, open, close);
    if (toMinutes(from) >= toMinutes(to)) {
      const next = Math.min(toMinutes(close), toMinutes(from) + 30);
      if (next > toMinutes(from)) to = fromMinutes(next);
      else {
        from = open.slice(0, 5);
        to = fromMinutes(Math.min(toMinutes(close), toMinutes(open) + 60));
      }
    }
    return { ...meal, open: from, close: to };
  };
  return {
    breakfast: clampOne(meals.breakfast),
    lunch: clampOne(meals.lunch),
    dinner: clampOne(meals.dinner),
  };
}

function mealFitsWindow(
  meal: DiningMealsConfig["breakfast"],
  open: string,
  close: string
): boolean {
  if (!isSameDayWindow(open, close)) return true;
  const from = toMinutes(meal.open);
  const to = toMinutes(meal.close);
  return from >= toMinutes(open) && to <= toMinutes(close) && from < to;
}

/** Suggest breakfast / lunch / dinner slices inside the day window. */
function suggestMealsForWindow(open: string, close: string, prev: DiningMealsConfig): DiningMealsConfig {
  if (!isSameDayWindow(open, close)) return clampMealsToWindow(prev, open, close);
  const start = toMinutes(open);
  const end = toMinutes(close);
  const span = end - start;
  if (span < 90) {
    return {
      breakfast: { ...prev.breakfast, open, close, active: true },
      lunch: { ...prev.lunch, open, close, active: false },
      dinner: { ...prev.dinner, open, close, active: false },
    };
  }
  const third = Math.floor(span / 3);
  const bEnd = start + Math.max(60, third);
  const lStart = Math.min(end - 60, bEnd);
  const lEnd = Math.min(end, lStart + Math.max(60, third));
  const dStart = Math.min(end - 60, lEnd);
  return {
    breakfast: {
      ...prev.breakfast,
      open: fromMinutes(start),
      close: fromMinutes(Math.min(end, bEnd)),
      active: true,
    },
    lunch: {
      ...prev.lunch,
      open: fromMinutes(lStart),
      close: fromMinutes(lEnd),
      active: span >= 180,
    },
    dinner: {
      ...prev.dinner,
      open: fromMinutes(dStart),
      close: fromMinutes(end),
      active: span >= 240,
    },
  };
}

/** Soft corner wave — decorative only. */
function SoftWave({ color, id }: { color: string; id: string }) {
  const gradId = `wave-${id}`;
  return (
    <svg
      viewBox="0 0 160 70"
      className="absolute -right-1 bottom-0 w-[58%] max-w-[150px] h-[58px] opacity-70 pointer-events-none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0" />
          <stop offset="40%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.32" />
        </linearGradient>
      </defs>
      <path
        d="M0 52 C28 48, 36 28, 58 32 C80 36, 88 54, 110 42 C128 32, 140 24, 160 28 L160 70 L0 70 Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M0 52 C28 48, 36 28, 58 32 C80 36, 88 54, 110 42 C128 32, 140 24, 160 28"
        fill="none"
        stroke={color}
        strokeOpacity="0.35"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Toggle({
  on,
  onToggle,
  tone = "rose",
}: {
  on: boolean;
  onToggle: () => void;
  tone?: "rose" | "emerald";
}) {
  const onClass = tone === "emerald" ? "bg-emerald-500" : "bg-rose-600";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        on
          ? `${onClass} ${tone === "emerald" ? "focus-visible:ring-emerald-400" : "focus-visible:ring-rose-400"}`
          : "bg-slate-300 focus-visible:ring-slate-300"
      }`}
    >
      <span
        className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out ${
          on ? "translate-x-[1.375rem]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function MonthCalendar({
  year,
  month,
  selectedDate,
  byDate,
  onSelect,
  onPrev,
  onNext,
}: {
  year: number;
  month: number;
  selectedDate: string;
  byDate: Map<string, BusinessOperatingDate>;
  onSelect: (dateKey: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = toDateKey(new Date());
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const title = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="size-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <button
          type="button"
          onClick={onNext}
          className="size-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50 cursor-pointer"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day == null) return <span key={`e-${idx}`} />;
          const key = `${year}-${pad2(month + 1)}-${pad2(day)}`;
          const row = byDate.get(key);
          const selected = key === selectedDate;
          const isToday = key === todayKey;
          const open = row?.is_open === true;
          const closed = row?.is_open === false;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`aspect-square rounded-xl text-xs font-semibold cursor-pointer border transition-colors ${
                selected
                  ? "bg-rose-500 text-white border-rose-500"
                  : open
                    ? "bg-emerald-50 text-emerald-800 border-emerald-100 hover:bg-emerald-100"
                    : closed
                      ? "bg-slate-200/80 text-slate-500 border-slate-200 hover:bg-slate-200"
                      : "bg-white text-slate-700 border-transparent hover:bg-slate-100"
              } ${isToday && !selected ? "ring-1 ring-rose-300" : ""}`}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] font-semibold text-slate-500 pt-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-emerald-200" /> Open
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-slate-300" /> Closed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-white border border-slate-200" /> Unset
        </span>
      </div>
    </div>
  );
}

function BusinessDashboard() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id ?? "";
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(toDateKey(now));
  const [dayOpen, setDayOpen] = useState(true);
  const [openTime, setOpenTime] = useState("09:00");
  const [closeTime, setCloseTime] = useState("22:00");
  const [mealPeriods, setMealPeriods] = useState<DiningMealsConfig>(DEFAULT_MEALS);
  const [selectedMeal, setSelectedMeal] = useState<(typeof MEAL_KEYS)[number]>("breakfast");
  const [graceTime, setGraceTime] = useState<number | "">(120);
  const [allocation, setAllocation] = useState<number | "">(50);

  const range = useMemo(() => monthBounds(calYear, calMonth), [calYear, calMonth]);

  const { data: settings, isLoading: settingsLoading } = useGetBusinessSettingsQuery(bizId, {
    skip: !bizId,
  });
  const { data: bookingsData, isLoading: bookingsLoading } = useGetBusinessBookingsQuery(bizId, {
    skip: !bizId,
  });
  const { data: operatingDates = [], isLoading: datesLoading } = useGetBusinessOperatingDatesQuery(
    { bizId, from: range.from, to: range.to },
    { skip: !bizId }
  );
  const allBookings = bookingsData?.items ?? [];
  const [updateSettings, { isLoading: saving }] = useUpdateBusinessSettingsMutation();
  const [upsertOperatingDate, { isLoading: savingDate }] = useUpsertBusinessOperatingDateMutation();

  const byDate = useMemo(() => {
    const map = new Map<string, BusinessOperatingDate>();
    for (const row of operatingDates) map.set(row.op_date, row);
    return map;
  }, [operatingDates]);

  useEffect(() => {
    if (settings) {
      setGraceTime(settings.grace_time_minutes ?? 120);
      setAllocation(settings.online_allocation_percentage ?? 50);
    }
  }, [settings]);

  useEffect(() => {
    const row = byDate.get(selectedDate);
    if (row) {
      const nextOpen = (row.open_time || "09:00").slice(0, 5);
      const nextClose = (row.close_time || "22:00").slice(0, 5);
      setDayOpen(!!row.is_open);
      setOpenTime(nextOpen);
      setCloseTime(nextClose);
      setMealPeriods(
        row.is_open
          ? clampMealsToWindow(row.meals || DEFAULT_MEALS, nextOpen, nextClose)
          : row.meals || DEFAULT_MEALS
      );
    } else {
      setDayOpen(true);
      setOpenTime("09:00");
      setCloseTime("22:00");
      setMealPeriods(clampMealsToWindow(DEFAULT_MEALS, "09:00", "22:00"));
    }
  }, [selectedDate, byDate]);

  const setDayHours = (nextOpen: string, nextClose: string) => {
    const open = (nextOpen || "09:00").slice(0, 5);
    const close = (nextClose || "22:00").slice(0, 5);
    setOpenTime(open);
    setCloseTime(close);
    setMealPeriods((prev) => clampMealsToWindow(prev, open, close));
  };

  const setMealField = (
    meal: (typeof MEAL_KEYS)[number],
    field: "open" | "close",
    value: string
  ) => {
    setMealPeriods((prev) => {
      const next = {
        ...prev,
        [meal]: {
          ...prev[meal],
          [field]: value.slice(0, 5),
        },
      };
      return clampMealsToWindow(next, openTime, closeTime);
    });
  };

  const bookingsOnSelectedDate = useMemo(() => {
    return allBookings.filter((b) => {
      if (!b.booking_time) return false;
      if (!["CONFIRMED", "ARRIVED"].includes(String(b.status || "").toUpperCase())) return false;
      const d = new Date(b.booking_time);
      if (Number.isNaN(d.getTime())) return false;
      return toDateKey(d) === selectedDate;
    });
  }, [allBookings, selectedDate]);

  const saveSettings = async () => {
    if (!bizId) return;
    try {
      await updateSettings({
        bizId,
        body: {
          grace_time_minutes: graceTime === "" ? 120 : graceTime,
          online_allocation_percentage: allocation === "" ? 50 : allocation,
        },
      }).unwrap();
      toast.success("Global settings saved.");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save settings"));
    }
  };

  const saveOperatingDate = useCallback(
    async (opts?: { copyToDays?: number }) => {
      if (!bizId) return;
      const wasOpen = byDate.get(selectedDate)?.is_open !== false;
      if (!dayOpen && wasOpen && bookingsOnSelectedDate.length > 0) {
        const ok = window.confirm(
          `Closing ${formatSelectedLabel(selectedDate)} will cancel ${bookingsOnSelectedDate.length} booking(s) and email those guests. Continue?`
        );
        if (!ok) return;
      }
      if (dayOpen && isSameDayWindow(openTime, closeTime) === false && openTime === closeTime) {
        toast.error("Opening and closing time cannot be the same.");
        return;
      }
      const mealsToSave = dayOpen
        ? clampMealsToWindow(mealPeriods, openTime, closeTime)
        : mealPeriods;
      try {
        const res = await upsertOperatingDate({
          bizId,
          body: {
            date: selectedDate,
            is_open: dayOpen,
            open_time: dayOpen ? openTime : null,
            close_time: dayOpen ? closeTime : null,
            meals: mealsToSave,
            copy_to_days: opts?.copyToDays,
          },
        }).unwrap();
        setMealPeriods(mealsToSave);
        toast.success(res.message || "Date saved.");
      } catch (err) {
        toast.error(extractApiError(err, "Failed to save operating date"));
      }
    },
    [
      bizId,
      byDate,
      selectedDate,
      dayOpen,
      bookingsOnSelectedDate.length,
      openTime,
      closeTime,
      mealPeriods,
      upsertOperatingDate,
    ]
  );

  const shiftMonth = (delta: number) => {
    const d = new Date(calYear, calMonth + delta, 1);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  const isLoading = settingsLoading || bookingsLoading || datesLoading;

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-2">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-rose-500/30 border-t-rose-500 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading Business Dashboard...</p>
        </div>
      </div>
    );
  }

  const gracePresets = [15, 30, 45, 60, 90, 120];
  const isClosed = !dayOpen;
  const allocValue = allocation === "" ? 50 : allocation;
  const activeMeal = mealPeriods[selectedMeal];
  const isMealActive = !!activeMeal?.active;

  const stats = [
    {
      id: "bookings",
      label: "Total Bookings",
      primary: String(allBookings.length),
      unit: "",
      Icon: CalendarCheck,
      wave: "#e11d48",
      iconWrap: "bg-rose-50 text-rose-500",
    },
    {
      id: "status",
      label: "Active Status",
      primary: "Online",
      unit: "",
      Icon: Users,
      wave: "#3b82f6",
      iconWrap: "bg-sky-50 text-sky-500",
      isStatus: true,
    },
    {
      id: "allocation",
      label: "Online Allocation",
      primary: String(allocation),
      unit: "%",
      Icon: TrendingUp,
      wave: "#22c55e",
      iconWrap: "bg-emerald-50 text-emerald-500",
    },
    {
      id: "grace",
      label: "Grace Period",
      primary: String(graceTime),
      unit: " min",
      Icon: Settings,
      wave: "#8b5cf6",
      iconWrap: "bg-violet-50 text-violet-500",
    },
  ];

  return (
    <div className="-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8 animate-fadeIn">
    <div className="max-w-7xl mx-auto space-y-6 pb-4">
      {/* KPI cards — minimal reference style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.Icon;
          return (
            <div
              key={stat.id}
              className="relative overflow-hidden rounded-2xl bg-white border border-slate-100/90 shadow-[0_4px_18px_rgba(15,23,42,0.035)] px-5 py-5 min-h-[138px]"
            >
              <SoftWave id={stat.id} color={stat.wave} />

              <div className="relative z-10 flex items-center gap-3">
                <span
                  className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${stat.iconWrap}`}
                >
                  <Icon size={16} strokeWidth={2} />
                </span>
                <h3 className="text-[13px] font-medium text-slate-500">{stat.label}</h3>
              </div>

              <div className="relative z-10 mt-5 pr-[30%]">
                {stat.isStatus ? (
                  <p className="text-[26px] leading-none font-bold text-emerald-500 flex items-center gap-2 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    Online
                  </p>
                ) : (
                  <p className="text-[26px] leading-none font-bold text-slate-800 tracking-tight whitespace-nowrap tabular-nums">
                    {stat.primary}
                    {stat.unit}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Previous layout: Global Settings | Operating Hours + Meal Periods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Global Settings — left column */}
      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6 flex flex-col">
        <div className="flex items-start gap-3">
          <span className="h-11 w-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Settings size={20} />
          </span>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Global Settings</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Configure automatic seat blocking guidelines and table distribution ceilings.
            </p>
          </div>
        </div>

        {/* Grace time */}
        <div className="rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock size={18} className="text-rose-500" />
              <label className="text-sm font-bold text-slate-800">
                Global Grace Time (Minutes)
              </label>
            </div>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-600 border border-rose-100 tabular-nums">
              {graceTime} mins
            </span>
          </div>

          <div className="relative">
            <input
              type="number"
              value={graceTime ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setGraceTime(val === "" ? "" : Number(val));
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 pr-14 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              min="0"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400 pointer-events-none">
              min
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <Zap size={12} className="text-rose-500" />
              Quick Presets
            </div>
            <div className="flex flex-wrap gap-2">
              {gracePresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setGraceTime(preset)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    graceTime === preset
                      ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {preset}m
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-slate-600 border border-slate-200 p-3.5 rounded-xl">
            <Info size={14} className="mt-0.5 text-rose-500 shrink-0" />
            <span>
              Tables will be blocked for this duration automatically. Allows a buffer for guests to
              arrive before releasing tables.
            </span>
          </div>
        </div>

        {/* Allocation */}
        <div className="rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Users size={18} className="text-rose-500" />
              <label className="text-sm font-bold text-slate-800">
                Online Table Allocation (%)
              </label>
            </div>
            <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 tabular-nums">
              {allocation}% Allocated
            </span>
          </div>

          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={allocValue}
              onChange={(e) => setAllocation(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-rose-600 bg-slate-200"
              style={{
                background: `linear-gradient(to right, #e11d48 0%, #e11d48 ${allocValue}%, #e2e8f0 ${allocValue}%, #e2e8f0 100%)`,
              }}
            />
            <div className="relative shrink-0">
              <input
                type="number"
                min="0"
                max="100"
                value={allocation ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setAllocation(val === "" ? "" : Math.min(100, Math.max(0, Number(val))));
                }}
                className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-7 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                %
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-slate-600 border border-slate-200 p-3.5 rounded-xl">
            <Info size={14} className="mt-0.5 text-rose-500 shrink-0" />
            <span>
              Maximum percentage of physical tables that can be booked online. Keep some inventory
              for walk-ins or manual bookings.
            </span>
          </div>
        </div>

        <div className="p-4 border border-slate-200 rounded-2xl flex gap-3">
          <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
          <div>
            <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">
              Onboarding Tip
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Ensure your operating times match when your kitchen is fully staffed. Setting
              allocation to 70% or more boosts your visibility on our customer platform.
            </p>
          </div>
        </div>
      </section>

      {/* Right column: Operating Hours + Meal Periods */}
      <div className="flex flex-col gap-6">
      {/* Operating Hours — calendar date-wise */}
      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-start gap-3">
          <span className="h-11 w-11 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </span>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Operating Hours</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Manage open and close by date. Closing a day cancels bookings and emails guests.
            </p>
          </div>
        </div>

        <MonthCalendar
          year={calYear}
          month={calMonth}
          selectedDate={selectedDate}
          byDate={byDate}
          onSelect={setSelectedDate}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
        />

        <p className="text-sm font-semibold text-slate-700">
          Selected: <span className="text-rose-600">{formatSelectedLabel(selectedDate)}</span>
          {bookingsOnSelectedDate.length > 0 ? (
            <span className="ml-2 text-amber-700 font-medium">
              · {bookingsOnSelectedDate.length} upcoming booking
              {bookingsOnSelectedDate.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </p>

        {!isClosed ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Sun size={16} className="text-amber-500" />
                Opening Time
              </div>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setDayHours(e.target.value, closeTime)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/15 focus:border-rose-500 cursor-pointer"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Sunset size={16} className="text-orange-500" />
                Closing Time
              </div>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setDayHours(openTime, e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/15 focus:border-rose-500 cursor-pointer"
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-medium text-slate-500 italic">
            Closed for business
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Toggle on={!isClosed} onToggle={() => setDayOpen((v) => !v)} tone="emerald" />
          <span className="text-sm font-semibold text-slate-800">
            {isClosed ? "Closed" : "Open"}
          </span>
          {!isClosed && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Open for bookings
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => void saveOperatingDate()}
            disabled={savingDate}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60 cursor-pointer"
          >
            <Save size={16} />
            {savingDate ? "Saving…" : "Save this date"}
          </button>
          <button
            type="button"
            onClick={() => void saveOperatingDate({ copyToDays: 7 })}
            disabled={savingDate}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
          >
            <Copy size={16} />
            Copy to next 7 days
          </button>
        </div>
      </section>

      {/* Meal Periods — constrained to opening / closing times */}
      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-start gap-3">
          <span className="h-11 w-11 rounded-full bg-violet-50 text-violet-500 flex items-center justify-center shrink-0">
            <UtensilsCrossed size={20} />
          </span>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Meal Periods Configuration</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Breakfast, lunch, and dinner for{" "}
              <span className="font-semibold text-slate-700">{formatSelectedLabel(selectedDate)}</span>
              {" "}must sit inside the opening hours above.
            </p>
          </div>
        </div>

        {isClosed ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-medium text-slate-500 italic">
            Day is closed — meal periods are not used.
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-sm text-violet-900">
              <p className="font-semibold">Operating window</p>
              <p className="mt-0.5 text-violet-800/90">
                {formatHmLabel(openTime)} – {formatHmLabel(closeTime)}
                {isSameDayWindow(openTime, closeTime)
                  ? ". Meal From / To are limited to this range."
                  : " (overnight). Meal times are kept as entered."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MEAL_KEYS.map((meal) => {
                const cfg = mealPeriods[meal];
                const meta = MEAL_META[meal] ?? MEAL_META.breakfast;
                const TabIcon = meta.Icon;
                const fits = mealFitsWindow(cfg, openTime, closeTime);
                const selected = selectedMeal === meal;
                return (
                  <button
                    key={meal}
                    type="button"
                    onClick={() => setSelectedMeal(meal)}
                    className={`text-left rounded-2xl border px-3.5 py-3 transition-colors cursor-pointer ${
                      selected
                        ? "border-rose-200 bg-rose-50/80"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold capitalize text-slate-800">
                        <TabIcon size={14} className={meta.iconColor} />
                        {meal}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                          cfg.active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {cfg.active ? "Active" : "Off"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-slate-600">
                      {formatHmLabel(cfg.open)} – {formatHmLabel(cfg.close)}
                    </p>
                    {!fits && cfg.active ? (
                      <p className="mt-1 text-[11px] font-semibold text-amber-700">
                        Outside opening hours
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {isMealActive ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    From
                  </div>
                  <input
                    type="time"
                    value={activeMeal.open}
                    min={isSameDayWindow(openTime, closeTime) ? openTime : undefined}
                    max={isSameDayWindow(openTime, closeTime) ? closeTime : undefined}
                    onChange={(e) => setMealField(selectedMeal, "open", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/15 focus:border-rose-500 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">
                    Earliest: {formatHmLabel(openTime)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    To
                  </div>
                  <input
                    type="time"
                    value={activeMeal.close}
                    min={isSameDayWindow(openTime, closeTime) ? openTime : undefined}
                    max={isSameDayWindow(openTime, closeTime) ? closeTime : undefined}
                    onChange={(e) => setMealField(selectedMeal, "close", e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/15 focus:border-rose-500 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-500">
                    Latest: {formatHmLabel(closeTime)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 px-5 py-8 text-center text-sm font-medium text-slate-500 italic">
                Disabled for bookings
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Toggle
                on={isMealActive}
                tone="emerald"
                onToggle={() =>
                  setMealPeriods((prev) => ({
                    ...prev,
                    [selectedMeal]: {
                      ...prev[selectedMeal],
                      active: !isMealActive,
                    },
                  }))
                }
              />
              <span className="text-sm font-semibold text-slate-800 capitalize">
                {selectedMeal}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                  isMealActive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-rose-50 text-rose-600 border-rose-100"
                }`}
              >
                {isMealActive ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  setMealPeriods(suggestMealsForWindow(openTime, closeTime, mealPeriods))
                }
                className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-800 hover:bg-violet-100 cursor-pointer"
              >
                Auto-fit meals to opening hours
              </button>
              <button
                type="button"
                onClick={() => void saveOperatingDate()}
                disabled={savingDate}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60 cursor-pointer"
              >
                <Save size={16} />
                {savingDate ? "Saving…" : "Save hours & meals"}
              </button>
            </div>
          </>
        )}
      </section>
      </div>
      </div>

      {/* Save global settings */}
      <div className="flex justify-end ">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn-primary flex items-center gap-2 text-sm px-7 py-3.5 font-bold rounded-xl shadow-lg hover:shadow-rose-600/25 hover:scale-[1.01] transition-all disabled:opacity-60 disabled:pointer-events-none"
        >
          <Save size={18} /> {saving ? "Saving Settings..." : "Save Global Settings"}
        </button>
      </div>
    </div>
    </div>
  );
}

export default function BusinessDashboardPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    dispatch(loadFromStorage());
    setCheckingAuth(false);
  }, [dispatch]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">
        Loading...
      </div>
    );
  }

  if (!user || user.role !== "business_admin") {
    return <BusinessLandingPage />;
  }

  return <BusinessDashboard />;
}
