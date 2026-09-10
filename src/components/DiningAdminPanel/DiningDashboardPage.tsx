"use client";
import { useState, useEffect } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetBusinessSettingsQuery,
  useGetBusinessBookingsQuery,
  useUpdateBusinessSettingsMutation,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import BusinessLandingPage from "@/components/DiningAdminPanel/BusinessLandingPage";

const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_SHORT: Record<(typeof DAY_KEYS)[number], string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

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

function BusinessDashboard() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id ?? "";

  const { data: settings, isLoading: settingsLoading } = useGetBusinessSettingsQuery(bizId, {
    skip: !bizId,
  });
  const { data: bookingsData, isLoading: bookingsLoading } = useGetBusinessBookingsQuery(bizId, {
    skip: !bizId,
  });
  const allBookings = bookingsData?.items ?? [];
  const [updateSettings, { isLoading: saving }] = useUpdateBusinessSettingsMutation();

  const [graceTime, setGraceTime] = useState<number | "">(120);
  const [allocation, setAllocation] = useState<number | "">(50);
  const [operatingHours, setOperatingHours] = useState({
    monday: { open: "09:00", close: "22:00", closed: false },
    tuesday: { open: "09:00", close: "22:00", closed: false },
    wednesday: { open: "09:00", close: "22:00", closed: false },
    thursday: { open: "09:00", close: "22:00", closed: false },
    friday: { open: "09:00", close: "23:00", closed: false },
    saturday: { open: "10:00", close: "23:00", closed: false },
    sunday: { open: "10:00", close: "21:00", closed: false },
  });

  const [mealPeriods, setMealPeriods] = useState({
    breakfast: { open: "08:00", close: "11:00", active: true },
    lunch: { open: "11:30", close: "16:00", active: true },
    dinner: { open: "17:00", close: "23:00", active: true },
  });

  const [selectedDay, setSelectedDay] = useState<(typeof DAY_KEYS)[number]>("monday");
  const [selectedMeal, setSelectedMeal] = useState<(typeof MEAL_KEYS)[number]>("breakfast");

  useEffect(() => {
    if (settings) {
      setGraceTime(settings.grace_time_minutes ?? 120);
      setAllocation(settings.online_allocation_percentage ?? 50);
      if (settings.operating_hours) {
        const { meals, ...hoursOnly } = settings.operating_hours as any;
        setOperatingHours(hoursOnly);
        if (meals) {
          setMealPeriods(meals);
        }
      }
    }
  }, [settings]);

  const saveSettings = async () => {
    if (!bizId) return;
    try {
      await updateSettings({
        bizId,
        body: {
          grace_time_minutes: graceTime === "" ? 120 : graceTime,
          online_allocation_percentage: allocation === "" ? 50 : allocation,
          operating_hours: {
            ...operatingHours,
            meals: mealPeriods,
          } as any,
        },
      }).unwrap();
      toast.success("Settings saved to database successfully!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleHoursChange = (day: string, field: string, value: any) => {
    setOperatingHours((prev) => ({
      ...prev,
      [day]: { ...prev[day as keyof typeof prev], [field]: value },
    }));
  };

  const isLoading = settingsLoading || bookingsLoading;

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
  const dayHours = operatingHours[selectedDay];
  const isClosed = !!dayHours?.closed;
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
      {/* Operating Hours — reference style */}
      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-start gap-3">
          <span className="h-11 w-11 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </span>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Operating Hours</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Define your standard opening and closing times.
            </p>
          </div>
        </div>

        {/* Day pills */}
        <div className="flex flex-wrap gap-2">
          {DAY_KEYS.map((day) => {
            const active = selectedDay === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`min-w-[3.25rem] px-3.5 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer border ${
                  active
                    ? "bg-rose-50 text-rose-600 border-rose-200"
                    : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/80"
                }`}
              >
                {DAY_SHORT[day]}
              </button>
            );
          })}
        </div>

        {!isClosed ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Sun size={16} className="text-amber-500" />
                Opening Time
              </div>
              <input
                type="time"
                value={dayHours.open}
                onChange={(e) => handleHoursChange(selectedDay, "open", e.target.value)}
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
                value={dayHours.close}
                onChange={(e) => handleHoursChange(selectedDay, "close", e.target.value)}
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
          <Toggle
            on={!isClosed}
            onToggle={() => handleHoursChange(selectedDay, "closed", !isClosed)}
            tone="emerald"
          />
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
      </section>

      {/* Meal Periods — tab style like Operating Hours */}
      <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex items-start gap-3">
          <span className="h-11 w-11 rounded-full bg-violet-50 text-violet-500 flex items-center justify-center shrink-0">
            <UtensilsCrossed size={20} />
          </span>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Meal Periods Configuration</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Define custom hours for Breakfast, Lunch, and Dinner timeslots.
            </p>
          </div>
        </div>

        {/* Meal tabs */}
        <div className="flex flex-wrap gap-2">
          {MEAL_KEYS.map((meal) => {
            const active = selectedMeal === meal;
            const meta = MEAL_META[meal] ?? MEAL_META.breakfast;
            const TabIcon = meta.Icon;
            return (
              <button
                key={meal}
                type="button"
                onClick={() => setSelectedMeal(meal)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold capitalize transition-all cursor-pointer border ${
                  active
                    ? "bg-rose-50 text-rose-600 border-rose-200"
                    : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/80"
                }`}
              >
                <TabIcon
                  size={14}
                  className={active ? "text-rose-500" : meta.iconColor}
                />
                {meal}
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
                onChange={(e) =>
                  setMealPeriods((prev) => ({
                    ...prev,
                    [selectedMeal]: {
                      ...prev[selectedMeal],
                      open: e.target.value,
                    },
                  }))
                }
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/15 focus:border-rose-500 cursor-pointer"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                To
              </div>
              <input
                type="time"
                value={activeMeal.close}
                onChange={(e) =>
                  setMealPeriods((prev) => ({
                    ...prev,
                    [selectedMeal]: {
                      ...prev[selectedMeal],
                      close: e.target.value,
                    },
                  }))
                }
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/15 focus:border-rose-500 cursor-pointer"
              />
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
      </section>
      </div>
      </div>

      {/* Save */}
      <div className="flex justify-end ">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn-primary flex items-center gap-2 text-sm px-7 py-3.5 font-bold rounded-xl shadow-lg hover:shadow-rose-600/25 hover:scale-[1.01] transition-all disabled:opacity-60 disabled:pointer-events-none"
        >
          <Save size={18} /> {saving ? "Saving Settings..." : "Save All Settings"}
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
