import type { MovieShowtime } from "@/services/api";
import { formatDate, formatTime12h, venueDateStr, venueTimeStr } from "@/lib/dateFormat";

export function uniqueTrimmedStrings(values?: string[] | null): string[] {
  if (!values?.length) return [];
  return Array.from(
    new Set(values.map((v) => String(v || "").trim()).filter(Boolean))
  );
}

export function parseIsoDateAndHours(iso: string) {
  if (!iso) return { dateStr: "", timeStr: "", displayTime: "" };
  const str = String(iso).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) {
    const [, yr, mon, dy, hhStr, mmStr] = match;
    const h = parseInt(hhStr, 10);
    const minuteStr = mmStr || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return {
      dateStr: `${yr}-${mon}-${dy}`,
      timeStr: `${String(h).padStart(2, "0")}:${minuteStr}`,
      displayTime: `${String(h12).padStart(2, "0")}:${minuteStr} ${ampm}`,
    };
  }
  const dateObj = new Date(iso);
  if (isNaN(dateObj.getTime())) return { dateStr: "", timeStr: "", displayTime: "" };
  const h = dateObj.getHours();
  const minuteStr = String(dateObj.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dateStr: `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`,
    timeStr: `${String(h).padStart(2, "0")}:${minuteStr}`,
    displayTime: `${String(h12).padStart(2, "0")}:${minuteStr} ${ampm}`,
  };
}

export const SHOW_BUFFER_MINUTES = 20;
export const DEFAULT_DURATION_MINUTES = 120;

/** Default start HH:mm — 14:00 when future day; next 15‑min slot when scheduling today. */
export function defaultStartTimeForDate(showDate: string): string {
  const today = venueDateStr();
  if (!showDate || !today || showDate > today) return "14:00";
  const nowHm = venueTimeStr();
  if (!nowHm) return "14:00";
  const [hh, mm] = nowHm.split(":").map((n) => Number(n));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "14:00";
  // At least one minute ahead, then round up to the next 15-minute mark.
  let totalMins = hh * 60 + mm + 1;
  totalMins = Math.ceil(totalMins / 15) * 15;
  if (totalMins >= 24 * 60) totalMins = 23 * 60 + 45;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(totalMins / 60))}:${pad(totalMins % 60)}`;
}

/** Wall-clock rank from naive showtime string (venue local digits). */
export function wallMs(iso?: string | null): number | null {
  if (!iso) return null;
  const match = String(iso)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || "0")
  );
}

export function addMinutesWall(iso: string, minutes: number): string | null {
  const ms = wallMs(iso);
  if (ms == null) return null;
  const end = new Date(ms + minutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}:${pad(end.getUTCSeconds())}`;
}

export function effectiveShowEndIso(st: MovieShowtime): string | null {
  if (st.ends_at) return st.ends_at;
  const mins =
    st.movie_duration_minutes && st.movie_duration_minutes > 0
      ? st.movie_duration_minutes
      : DEFAULT_DURATION_MINUTES;
  return addMinutesWall(st.starts_at, mins + SHOW_BUFFER_MINUTES);
}

export function intervalsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const as = wallMs(aStart);
  const ae = wallMs(aEnd);
  const bs = wallMs(bStart);
  const be = wallMs(bEnd);
  if (as == null || ae == null || bs == null || be == null) return false;
  return as < be && bs < ae;
}

/** Active scheduled shows on the same screen that overlap [start, end). */
export function findScreenScheduleConflict(
  showtimes: MovieShowtime[],
  opts: {
    cinemaScreenId: string;
    startsAt: string;
    endsAt: string;
    excludeId?: string | null;
  }
): MovieShowtime | null {
  for (const st of showtimes) {
    if (opts.excludeId && st.id === opts.excludeId) continue;
    if (!st.is_active) continue;
    if (String(st.status || "SCHEDULED").toUpperCase() !== "SCHEDULED") continue;
    if (st.cinema_screen_id !== opts.cinemaScreenId) continue;
    const end = effectiveShowEndIso(st);
    if (!end) continue;
    if (intervalsOverlap(opts.startsAt, opts.endsAt, st.starts_at, end)) return st;
  }
  return null;
}

export function conflictingShowtimeIds(showtimes: MovieShowtime[]): Set<string> {
  const ids = new Set<string>();
  const active = showtimes.filter(
    (st) => st.is_active && String(st.status || "SCHEDULED").toUpperCase() === "SCHEDULED"
  );
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.cinema_screen_id !== b.cinema_screen_id) continue;
      const aEnd = effectiveShowEndIso(a);
      const bEnd = effectiveShowEndIso(b);
      if (!aEnd || !bEnd) continue;
      if (intervalsOverlap(a.starts_at, aEnd, b.starts_at, bEnd)) {
        ids.add(a.id);
        ids.add(b.id);
      }
    }
  }
  return ids;
}

const TIER_SORT_RANK: Record<string, number> = {
  regular: 0,
  recliner: 1,
  couple: 2,
  vip: 3,
  premium: 4,
};

export function sortedTierPricing(tiers: MovieShowtime["tier_pricing"] | undefined) {
  if (!tiers?.length) return [];
  return [...tiers].sort((a, b) => {
    const ra = TIER_SORT_RANK[String(a.tier_name || "").trim().toLowerCase()] ?? 50;
    const rb = TIER_SORT_RANK[String(b.tier_name || "").trim().toLowerCase()] ?? 50;
    if (ra !== rb) return ra - rb;
    return String(a.tier_name || "").localeCompare(String(b.tier_name || ""));
  });
}

export function displayScreenName(name?: string | null) {
  const raw = String(name || "Screen").trim();
  if (!raw) return "Screen";
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Local calendar YYYY-MM-DD — never use toISOString() (UTC shifts the day in ET). */
export function toYmdLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function shiftYmd(ymd: string, days: number): string {
  // Noon avoids DST / midnight edge cases when adding days
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  d.setDate(d.getDate() + days);
  return toYmdLocal(d);
}

export function formatTime(iso: string) {
  if (!iso) return "";
  const t = formatTime12h(iso);
  return t === "—" ? "" : t;
}

export function formatDateHeader(isoDateStr: string) {
  const d = new Date(isoDateStr + "T00:00:00");
  if (isNaN(d.getTime())) return formatDate(isoDateStr);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekday}, ${formatDate(isoDateStr)}`;
}
