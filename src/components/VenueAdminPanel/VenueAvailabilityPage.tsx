"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { CalendarDays, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateVenueMySlotsMutation,
  useDeleteVenueMySlotMutation,
  useGetVenueMySlotsQuery,
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

export default function VenueAvailabilityPage() {
  const { data: slots = [], isLoading } = useGetVenueMySlotsQuery();
  const [createSlots, { isLoading: creating }] = useCreateVenueMySlotsMutation();
  const [deleteSlot, { isLoading: deleting }] = useDeleteVenueMySlotMutation();

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

  const upcomingFree = useMemo(() => upcoming.filter((s) => !s.is_booked), [upcoming]);
  const upcomingBooked = useMemo(() => upcoming.filter((s) => s.is_booked), [upcoming]);

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

  if (isLoading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto py-16 text-center text-muted-foreground text-sm">
        Loading calendar…
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Free days", value: freeDates.length, hint: "Open for inquiries" },
          { label: "Booked", value: bookedDates.length, hint: "Cannot be changed" },
          { label: "Upcoming free", value: upcomingFree.length, hint: "From today onward" },
          { label: "Upcoming booked", value: upcomingBooked.length, hint: "Confirmed holds" },
        ].map((stat) => (
          <div key={stat.label} className="org-card px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Calendar column */}
        <div className="xl:col-span-7 space-y-4">
          <section className="org-card overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-border flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="h-9 w-9 rounded-xl bg-primary-soft text-primary inline-flex items-center justify-center shrink-0">
                  <CalendarDays size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-foreground">Availability calendar</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click a day to mark free or remove it.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Free
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Booked
                </span>
              </div>
            </div>
            <div className="p-4 sm:p-5">
              {(creating || deleting) && (
                <p className="text-xs text-primary flex items-center gap-1.5 mb-3">
                  <Loader2 size={12} className="animate-spin" /> Saving…
                </p>
              )}
              <ArtistMonthCalendar
                freeDates={freeDates}
                bookedDates={bookedDates}
                mode="toggle"
                onSelectDate={onToggleDate}
              />
            </div>
          </section>
        </div>

        {/* Side panel — range + list */}
        <div className="xl:col-span-5 space-y-4">
          <form
            onSubmit={handleSubmit(onAddRange)}
            className="org-card overflow-hidden"
            noValidate
          >
            <div className="px-4 sm:px-5 py-3.5 border-b border-border bg-gradient-to-r from-primary-soft/50 to-transparent">
              <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                <Plus size={16} className="text-primary" />
                Add free days by range
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Marks each day in the range as free (skips days already on your calendar).
              </p>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  {errors.range_from && (
                    <p className={fieldErrorClass}>{errors.range_from.message}</p>
                  )}
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
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl btn-primary text-sm disabled:opacity-50"
                >
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add range
                  {rangePreviewCount > 0 ? ` (${rangePreviewCount})` : ""}
                </button>
                {(rangeFrom || rangeTo) && (
                  <button
                    type="button"
                    onClick={() => reset(emptyPartnerAvailabilityRangeValues())}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground px-2 py-2"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </form>

          <section className="org-card overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-border flex items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-bold text-foreground">Upcoming free days</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Remove a day anytime if it is not booked.
                </p>
              </div>
              <span className="text-xs font-semibold text-muted-foreground tabular-nums shrink-0">
                {upcomingFree.length}
              </span>
            </div>
            <div className="p-3 sm:p-4 max-h-[min(28rem,55vh)] overflow-y-auto">
              {upcomingFree.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">No free days yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add a date range or click days on the calendar.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {upcomingFree.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{formatDate(s.slot_date)}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.start_time && s.end_time
                            ? `${s.start_time} – ${s.end_time}`
                            : "Full day available"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleDate(s.slot_date)}
                        className="p-2 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 shrink-0"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {upcomingBooked.length > 0 ? (
            <section className="org-card overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-border">
                <h3 className="font-display text-base font-bold text-foreground">Upcoming booked</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Locked — cannot be removed here.</p>
              </div>
              <ul className="p-3 sm:p-4 space-y-2 max-h-48 overflow-y-auto">
                {upcomingBooked.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-rose-100 bg-rose-50/50 px-3 py-2.5"
                  >
                    <p className="text-sm font-semibold text-foreground">{formatDate(s.slot_date)}</p>
                    <p className="text-xs text-rose-600 font-medium mt-0.5">Booked</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
