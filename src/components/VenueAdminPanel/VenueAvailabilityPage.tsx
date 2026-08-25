"use client";

import { useMemo, useState } from "react";
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

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

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
        await deleteSlot(existing.id).unwrap();
        toast.success("Date removed from your free calendar.");
      } else {
        const res = await createSlots({ dates: [date] }).unwrap();
        if (res.length === 0) toast.message("That date was already free.");
        else toast.success("Date marked as free.");
      }
    } catch (err) {
      toast.error(extractApiError(err, "Could not update calendar"));
    }
  };

  const onAddRange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rangeFrom || !rangeTo) {
      toast.error("Choose both From and To dates.");
      return;
    }
    if (rangeFrom > rangeTo) {
      toast.error("From date must be on or before To date.");
      return;
    }

    const candidates = datesInRange(rangeFrom, rangeTo).filter((d) => d >= minDate);
    if (candidates.length === 0) {
      toast.error("No future dates in that range.");
      return;
    }

    // Skip dates already free or booked
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
          `${res.length} free day${res.length === 1 ? "" : "s"} added (${formatDate(rangeFrom)} → ${formatDate(rangeTo)}).`
        );
      }
      setRangeFrom("");
      setRangeTo("");
    } catch (err) {
      toast.error(extractApiError(err, "Could not add date range"));
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="portal-heading text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="text-violet-500" /> Venue availability
        </h2>
        <p className="portal-muted text-sm mt-1">
          Click days one by one, or add a date range in one step. Customers see free dates on your
          public profile and can send Venue booking inquiries.
        </p>
      </div>

      {isLoading ? (
        <p className="portal-muted py-10 text-center">Loading calendar…</p>
      ) : (
        <div className="space-y-6">
          <form
            onSubmit={onAddRange}
            className="glass-panel rounded-2xl p-5 space-y-4"
          >
            <div>
              <h3 className="portal-heading font-semibold flex items-center gap-2">
                <Plus size={16} className="text-violet-500" />
                Add multiple free days
              </h3>
              <p className="text-xs portal-muted mt-1">
                Choose a From and To date to mark every day in that range as free (skips days you
                already added).
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <label className="portal-label text-xs font-bold uppercase mb-1.5 block">
                  From
                </label>
                <input
                  type="date"
                  min={minDate}
                  value={rangeFrom}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRangeFrom(v);
                    if (rangeTo && v && rangeTo < v) setRangeTo(v);
                  }}
                  className="input-field"
                />
              </div>
              <div>
                <label className="portal-label text-xs font-bold uppercase mb-1.5 block">To</label>
                <input
                  type="date"
                  min={rangeFrom || minDate}
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="input-field"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={creating || !rangeFrom || !rangeTo}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
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
                    onClick={() => {
                      setRangeFrom("");
                      setRangeTo("");
                    }}
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

            <div className="glass-panel rounded-2xl p-5 space-y-3">
              <h3 className="portal-heading font-semibold">Upcoming free days</h3>
              {(creating || deleting) && (
                <p className="text-xs text-violet-500 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" /> Saving…
                </p>
              )}
              {upcoming.length === 0 ? (
                <p className="text-sm portal-muted">
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
                        <p className="text-xs portal-muted">
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
