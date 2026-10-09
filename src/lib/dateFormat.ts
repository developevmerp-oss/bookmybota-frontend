/**
 * Project-wide date/time display helpers.
 *
 * Storage/API: ISO 8601 UTC.
 * Scheduled times (reservation, showtime, event start): Africa/Addis_Ababa (venue).
 * Instant / audit times (created_at, booked on, checked out): browser local timezone.
 *
 * Display shapes:
 * - Customer: "22 April 2014" + "5:00 PM"
 * - Compact admin: MM-DD-YYYY via formatDate / formatDateTime12h (local)
 */

const DISPLAY_LOCALE = "en-US";

/** BookMyBota venue / product timezone (Ethiopia, no DST). */
export const APP_VENUE_TZ = "Africa/Addis_Ababa";

/** Full English month names for customer-facing dates ("22 April 2014"). */
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatPartsCustomer(y: number, m: number, d: number): string {
  const month = MONTHS_LONG[m - 1];
  if (!month) return "—";
  return `${d} ${month} ${y}`;
}

function toValidDate(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** True when the string carries an explicit zone (Z or ±HH:MM). */
function hasExplicitZone(s: string): boolean {
  const t = s.trim();
  return /Z$/i.test(t) || /[+-]\d{2}:\d{2}$/.test(t);
}

type ZonedYmdHm = {
  y: number;
  m: number;
  d: number;
  hour: number;
  minute: number;
  weekday: string;
};

function zonedParts(d: Date, timeZone: string): ZonedYmdHm | null {
  try {
    const parts = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(d);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value;
    const y = Number(get("year"));
    const m = Number(get("month"));
    const day = Number(get("day"));
    let hour = Number(get("hour"));
    const minute = Number(get("minute"));
    const weekday = get("weekday") || "";
    if (!y || !m || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null;
    if (hour === 24) hour = 0;
    return { y, m, d: day, hour, minute, weekday };
  } catch {
    return null;
  }
}

function formatHour12(hour24: number, minute: number): string {
  const d = new Date(2000, 0, 1, hour24, minute);
  return d.toLocaleTimeString(DISPLAY_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Calendar Y-M-D from date-only or naive datetime strings (no zone shift). */
function parseWallCalendarParts(value: string | Date): { y: number; m: number; d: number } | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [yyyy, mm, dd] = trimmed.split("-").map(Number);
      if (!yyyy || !mm || !dd) return null;
      return { y: yyyy, m: mm, d: dd };
    }
    if (!hasExplicitZone(trimmed)) {
      const wall = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T]\d{2}:\d{2}/);
      if (wall) {
        return { y: Number(wall[1]), m: Number(wall[2]), d: Number(wall[3]) };
      }
    }
  }
  return null;
}

function parseWallTimeParts(value: string): { hour: number; minute: number } | null {
  const trimmed = value.trim();
  if (hasExplicitZone(trimmed)) return null;
  const wall = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/
  );
  if (!wall) return null;
  const hour = Number(wall[4]);
  const minute = Number(wall[5]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/** Resolve scheduled-time parts: venue TZ for zoned ISO, else wall digits. */
function scheduledParts(value: string | Date): ZonedYmdHm | null {
  if (typeof value === "string") {
    const wallCal = parseWallCalendarParts(value);
    const wallTime = parseWallTimeParts(value);
    if (wallCal && !hasExplicitZone(value.trim())) {
      return {
        ...wallCal,
        hour: wallTime?.hour ?? 0,
        minute: wallTime?.minute ?? 0,
        weekday: "",
      };
    }
  }
  const d = toValidDate(value);
  if (!d) return null;
  return zonedParts(d, APP_VENUE_TZ);
}

/** Resolve instant parts in the browser's local timezone. */
function localParts(value: string | Date): ZonedYmdHm | null {
  const d = toValidDate(value);
  if (!d) return null;
  return {
    y: d.getFullYear(),
    m: d.getMonth() + 1,
    d: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    weekday: d.toLocaleDateString(DISPLAY_LOCALE, { weekday: "long" }),
  };
}

// ── Scheduled / venue-facing (reservation, showtime, event start) ────────────

/** MM-DD-YYYY (compact admin lists — local calendar for instants, wall for date-only) */
export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const wall = typeof value === "string" ? parseWallCalendarParts(value) : null;
  if (wall && typeof value === "string" && !hasExplicitZone(value.trim())) {
    return `${pad2(wall.m)}-${pad2(wall.d)}-${wall.y}`;
  }
  const parts = localParts(value);
  if (!parts) return "—";
  return `${pad2(parts.m)}-${pad2(parts.d)}-${parts.y}`;
}

/** Reservation / showtime date in venue TZ: "22 April 2014" */
export function formatDateCustomer(value?: string | Date | null): string {
  if (!value) return "—";
  const wall = typeof value === "string" ? parseWallCalendarParts(value) : null;
  if (wall && typeof value === "string" && !hasExplicitZone(value.trim())) {
    return formatPartsCustomer(wall.y, wall.m, wall.d);
  }
  const parts = scheduledParts(value);
  if (!parts) return "—";
  return formatPartsCustomer(parts.y, parts.m, parts.d);
}

/**
 * Customer panel from UTC calendar day (gift card expiry).
 * Example: 2014-04-23T23:59:59.999Z → "23 April 2014"
 */
export function formatDateCustomerUtc(value?: string | Date | null): string {
  if (!value) return "—";
  const d = toValidDate(value);
  if (!d) return "—";
  return formatPartsCustomer(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Weekday for scheduled time in venue TZ, e.g. "Monday" */
export function formatWeekdayCustomer(value?: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!hasExplicitZone(trimmed)) {
      const wall = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (wall) {
        const d = new Date(Number(wall[1]), Number(wall[2]) - 1, Number(wall[3]));
        if (!Number.isNaN(d.getTime())) {
          return d.toLocaleDateString(DISPLAY_LOCALE, { weekday: "long" });
        }
      }
    }
  }
  const parts = scheduledParts(value);
  if (!parts) return "";
  if (parts.weekday) return parts.weekday;
  const d = new Date(parts.y, parts.m - 1, parts.d);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(DISPLAY_LOCALE, { weekday: "long" });
}

/** Date + weekday for reservation cards. */
export function formatBookingDateParts(value?: string | Date | null): {
  date: string;
  weekday: string;
} {
  return {
    date: formatDateCustomer(value),
    weekday: formatWeekdayCustomer(value),
  };
}

/** MM-DD-YYYY, h:mm AM/PM — browser local (admin / partner audit lists) */
export function formatDateTime12h(value?: string | Date | null): string {
  if (!value) return "—";
  const parts = localParts(value);
  if (!parts) return "—";
  const time = formatHour12(parts.hour, parts.minute);
  return `${pad2(parts.m)}-${pad2(parts.d)}-${parts.y}, ${time}`;
}

/** Scheduled: "22 April 2014, 5:00 PM" in venue TZ */
export function formatDateTimeCustomer(value?: string | Date | null): string {
  if (!value) return "—";
  const date = formatDateCustomer(value);
  const time = formatTime12h(value);
  if (date === "—" && time === "—") return "—";
  if (date === "—") return time;
  if (time === "—") return date;
  return `${date}, ${time}`;
}

/** Scheduled time h:mm AM/PM in venue TZ (ISO with Z) or wall digits (naive) */
export function formatTime12h(value?: string | Date | null): string {
  if (!value) return "—";
  if (typeof value === "string") {
    const wall = parseWallTimeParts(value);
    if (wall) return formatHour12(wall.hour, wall.minute);
  }
  const parts = scheduledParts(value);
  if (!parts) return "—";
  return formatHour12(parts.hour, parts.minute);
}

/** Venue calendar YYYY-MM-DD for "today" comparisons (showtimes / preferred time). */
export function venueDateStr(now: Date = new Date()): string {
  const parts = zonedParts(now, APP_VENUE_TZ);
  if (!parts) return "";
  return `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}`;
}

/**
 * True when venue "now" is at/after a stored showtime wall clock
 * (naive TIMESTAMP digits = Africa/Addis_Ababa).
 */
export function isVenueWallTimeReached(
  value?: string | Date | null,
  now: Date = new Date()
): boolean {
  if (value == null || value === "") return false;
  const target = scheduledParts(value);
  const nowParts = zonedParts(now, APP_VENUE_TZ);
  if (!target || !nowParts) return false;
  const targetRank = Date.UTC(
    target.y,
    target.m - 1,
    target.d,
    target.hour,
    target.minute,
    0
  );
  const nowRank = Date.UTC(
    nowParts.y,
    nowParts.m - 1,
    nowParts.d,
    nowParts.hour,
    nowParts.minute,
    0
  );
  return nowRank >= targetRank;
}

/** Convert stored HH:mm (24h) to 12-hour display, e.g. "18:57" → "6:57 PM" */
export function formatHm12h(hm?: string | null): string {
  if (!hm?.trim()) return "";
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!match) return hm.trim();
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return hm.trim();
  return formatHour12(hours, minutes);
}

// ── Instant / audit (created_at, booked on, checked out) — browser local ─────

/** Local calendar date: "22 April 2014" */
export function formatInstantLocalDate(value?: string | Date | null): string {
  if (!value) return "—";
  const parts = localParts(value);
  if (!parts) return "—";
  return formatPartsCustomer(parts.y, parts.m, parts.d);
}

/** Local time: "2:41 PM" */
export function formatInstantLocalTime(value?: string | Date | null): string {
  if (!value) return "—";
  const parts = localParts(value);
  if (!parts) return "—";
  return formatHour12(parts.hour, parts.minute);
}

/** Local date + time: "22 April 2014, 2:41 PM" */
export function formatInstantLocalDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const date = formatInstantLocalDate(value);
  const time = formatInstantLocalTime(value);
  if (date === "—" && time === "—") return "—";
  if (date === "—") return time;
  if (time === "—") return date;
  return `${date}, ${time}`;
}

// ── Form helpers (browser local wall clock ↔ ISO) ────────────────────────────

/** Convert ISO / Date to `datetime-local` input value (YYYY-MM-DDTHH:mm) */
export function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Convert `datetime-local` value to ISO string for API */
export function fromDatetimeLocal(val: string): string {
  if (!val) return "";
  return new Date(val).toISOString();
}

export function fromDateAndTime(dateYmd: string, timeHm: string): string {
  if (!dateYmd || !timeHm) return "";
  const normalized = normalizeTimeToHm(timeHm);
  if (!normalized) return "";
  return fromDatetimeLocal(`${dateYmd}T${normalized}`);
}

export function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Alias for settlement / API date-only params */
export function toDateOnlyParam(value?: string | Date | null): string {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return toDateInput(String(value));
}

export function toTimeInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Normalize any time string to `HH:mm` (drops seconds). Empty if invalid. */
export function normalizeTimeToHm(raw?: string | null): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?/);
  if (!m) return "";
  const h = Math.min(23, Math.max(0, Number.parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, Number.parseInt(m[2], 10)));
  if (Number.isNaN(h) || Number.isNaN(min)) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function inferDurationType(
  startsAt?: string | null,
  endsAt?: string | null
): "ONE_DAY" | "MULTI_DAY" {
  if (!startsAt || !endsAt) return "ONE_DAY";
  const a = new Date(startsAt);
  const b = new Date(endsAt);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "ONE_DAY";
  return a.toDateString() === b.toDateString() ? "ONE_DAY" : "MULTI_DAY";
}

export type ShowtimeEndValidation = "ok" | "missing_start" | "before_start" | "same_as_start";

/** Validate end vs start for a single showtime row */
export function validateShowtimeEnd(startsAt: string, endsAt: string): ShowtimeEndValidation {
  if (!endsAt) return "ok";
  if (!startsAt) return "missing_start";
  const startMs = new Date(startsAt).getTime();
  const endMs = new Date(endsAt).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return "ok";
  if (endMs < startMs) return "before_start";
  if (endMs === startMs) return "same_as_start";
  return "ok";
}

export function showtimeEndErrorMessage(result: ShowtimeEndValidation): string | null {
  switch (result) {
    case "before_start":
      return "End date & time cannot be before the start date & time.";
    case "same_as_start":
      return "End date & time cannot be the same as the start. Please set a later end time.";
    case "missing_start":
      return "Set the start date & time before choosing an end time.";
    default:
      return null;
  }
}
