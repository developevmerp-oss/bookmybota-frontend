"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateArtistMySlotsMutation,
  useDeleteArtistMySlotMutation,
  useGetArtistMySlotsQuery,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import ArtistMonthCalendar from "@/components/Shared/ArtistMonthCalendar";
import { formatDate } from "@/lib/dateFormat";
import {
  emptyPartnerAvailabilityRangeValues,
  partnerAvailabilityRangeSchema,
  type PartnerAvailabilityRangeValues,
} from "@/lib/partnerAvailabilityFormSchema";

const fieldErrorClass = "mt-1.5 text-xs text-rose-500 font-medium";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

function todayYmd(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
}

/** Inclusive YYYY-MM-DD range → list of dates (skips nothing; caller filters past/booked). */
function datesInRange(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return [];
  if (from > to) return [];
  const out: string[] = [];
  const cur = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export default function ArtistAvailabilityPage() {
  const { data: slots = [], isLoading } = useGetArtistMySlotsQuery();
  const [createSlots, { isLoading: creating }] = useCreateArtistMySlotsMutation();
  const [deleteSlot, { isLoading: deleting }] = useDeleteArtistMySlotMutation();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PartnerAvailabilityRangeValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(partnerAvailabilityRangeSchema) as any,
    defaultValues: emptyPartnerAvailabilityRangeValues(),
    mode: "onSubmit",
  });

  const rangeFrom = watch("range_from");
  const rangeTo = watch("range_to");

  const freeDates = useMemo(
    () => slots.filter((s) => !s.is_booked).map((s) => s.slot_date),
    [slots]
  );
  const bookedDates = useMemo(
    () => slots.filter((s) => s.is_booked).map((s) => s.slot_date),
    [slots]
  );
  const slotByDate = useMemo(() => {
    const map = new Map<string, (typeof slots)[number]>();
    for (const s of slots) map.set(s.slot_date, s);
    return map;
  }, [slots]);

  const minDate = todayYmd();

  const upcoming = useMemo(
    () =>
      [...slots]
        .sort((a, b) => a.slot_date.localeCompare(b.slot_date))
        .filter((s) => s.slot_date >= minDate),
    [slots, minDate]
  );

  const rangePreviewCount = useMemo(() => {
    if (!rangeFrom || !rangeTo) return 0;
    const all = datesInRange(rangeFrom, rangeTo).filter((d) => d >= minDate);
    return all.filter((d) => !slotByDate.has(d)).length;
  }, [rangeFrom, rangeTo, minDate, slotByDate]);

  const onToggleDate = async (date: string) => {
    const existing = slotByDate.get(date);
    if (existing?.is_booked) {
      toast.error("This date is booked and cannot be changed.");
      return;
    }
    try {
      if (existing) {
        const res = await deleteSlot(existing.id).unwrap();
        toast.success(res.message || "Date removed from your free calendar.");
      } else {
        const res = await createSlots({ dates: [date] }).unwrap();
        if (res.length === 0) toast.message("That date was already free.");
        else toast.success((res as { message?: string } & typeof res).message || "Date marked as free.");
      }
    } catch (err) {
      toast.error(extractApiError(err, "Could not update calendar"));
    }
  };

  const onAddRange = async (values: PartnerAvailabilityRangeValues) => {
    const from = values.range_from;
    const to = values.range_to;

    const candidates = datesInRange(from, to).filter((d) => d >= minDate);
    if (candidates.length === 0) {
      toast.error("No future dates in that range.");
      return;
    }

    const addable = candidates.filter((d) => !slotByDate.has(d));

    if (addable.length === 0) {
      toast.message("All days in that range are already on your calendar.");
      return;
    }

    if (addable.length > 90) {
      toast.error("Please add at most 90 days at a time.");
      return;
    }

    try {
      const res = await createSlots({ dates: addable }).unwrap();
      if (res.length === 0) {
        toast.message("Those dates were already free.");
      } else {
        toast.success(
          (res as { message?: string } & typeof res).message ||
            `${res.length} free day${res.length === 1 ? "" : "s"} added (${formatDate(from)} → ${formatDate(to)}).`
        );
      }
      reset(emptyPartnerAvailabilityRangeValues());
    } catch (err) {
      toast.error(extractApiError(err, "Could not add date range"));
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <p className="org-section-label mb-2">Calendar</p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Availability calendar
        </h2>
        <p className="text-muted-foreground text-sm mt-1.5">
          Click days one by one, or add a date range in one step. Customers see free dates on your
          public profile and can send booking inquiries.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground py-10 text-center">Loading calendar…</p>
      ) : (
        <div className="space-y-6">
          <form
            onSubmit={handleSubmit(onAddRange)}
            className="org-card p-5 space-y-4"
            noValidate
          >
            <div>
              <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                <Plus size={16} className="text-primary" />
                Add multiple free days
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Choose a From and To date to mark every day in that range as free (skips days you
                already added).
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
                  From <RequiredMark />
                </label>
                <input
                  type="date"
                  min={minDate}
                  {...register("range_from", {
                    onChange: (e) => {
                      const v = e.target.value as string;
                      if (rangeTo && v && rangeTo < v) setValue("range_to", v);
                    },
                  })}
                  className="input-field"
                />
                {errors.range_from && <p className={fieldErrorClass}>{errors.range_from.message}</p>}
              </div>
              <div>
                <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
                  To <RequiredMark />
                </label>
                <input
                  type="date"
                  min={rangeFrom || minDate}
                  {...register("range_to")}
                  className="input-field"
                />
                {errors.range_to && <p className={fieldErrorClass}>{errors.range_to.message}</p>}
              </div>
              <div className="sm:col-span-2 lg:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl btn-primary text-sm disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  Add range
                  {rangePreviewCount > 0 ? ` (${rangePreviewCount})` : ""}
                </button>
                {(rangeFrom || rangeTo) && (
                  <button
                    type="button"
                    onClick={() => reset(emptyPartnerAvailabilityRangeValues())}
                    className="text-sm font-medium text-slate-500 hover:text-slate-800"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Or click days on the calendar</p>
              <ArtistMonthCalendar
                freeDates={freeDates}
                bookedDates={bookedDates}
                mode="toggle"
                onSelectDate={onToggleDate}
              />
            </div>

            <div className="org-card p-5 space-y-3">
              <h3 className="font-display font-semibold text-foreground">Upcoming free days</h3>
              {(creating || deleting) && (
                <p className="text-xs text-primary flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> Saving…
                </p>
              )}
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No free days yet. Add a date range above or click dates on the calendar.
                </p>
              ) : (
                <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {upcoming.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {formatDate(s.slot_date)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.is_booked
                            ? "Booked"
                            : s.start_time && s.end_time
                              ? `${s.start_time} – ${s.end_time}`
                              : "Full day available"}
                        </p>
                      </div>
                      {!s.is_booked ? (
                        <button
                          type="button"
                          onClick={() => onToggleDate(s.slot_date)}
                          className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                          title="Remove"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
