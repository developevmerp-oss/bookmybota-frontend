/**
 * Project-wide date/time display helpers.
 *
 * Storage/API: ISO 8601 UTC.
 * Every user-facing clock (customer, admin, superadmin) is Africa/Addis_Ababa.
 * That includes showtimes and audit times (created_at, booked on, checked out).
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

/** Resolve an instant in Ethiopia, not the viewer's computer timezone. */
function localParts(value: string | Date): ZonedYmdHm | null {
  const d = toValidDate(value);
  if (!d) return null;
  return zonedParts(d, APP_VENUE_TZ);
}

/** Ethiopia calendar + clock for a stored value (naive strings keep their digits). */
export function getVenueDateTimeParts(value?: string | Date | null): {
  y: number;
  m: number;
  d: number;
  dateKey: string;
  hour: number;
  minute: number;
  weekdayLong: string;
} | null {
  if (value == null || value === "") return null;
  const parts = scheduledParts(value);
  if (!parts) return null;
  let weekdayLong = parts.weekday;
  if (!weekdayLong) {
    const d = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 12));
    weekdayLong = d.toLocaleDateString(DISPLAY_LOCALE, {
      weekday: "long",
      timeZone: "UTC",
    });
  }
  return {
    y: parts.y,
    m: parts.m,
    d: parts.d,
    dateKey: `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}`,
    hour: parts.hour,
    minute: parts.minute,
    weekdayLong,
  };
}

// ── Scheduled / venue-facing (reservation, showtime, event start) ────────────

/** MM-DD-YYYY (admin lists — Ethiopia for instants, wall digits for date-only) */
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

/** MM-DD-YYYY, h:mm AM/PM in Ethiopia (admin / partner lists) */
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

/** Venue wall-clock HH:mm (24h) for "now" comparisons (showtime scheduling). */
export function venueTimeStr(now: Date = new Date()): string {
  const parts = zonedParts(now, APP_VENUE_TZ);
  if (!parts) return "";
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** Add calendar days to a venue YYYY-MM-DD (Ethiopia product calendar). */
export function venueCalendarAddDays(ymd: string, days: number): string {
  const match = String(ymd).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return ymd;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function venueYmdToUtcDate(ymd: string): Date | null {
  const match = String(ymd).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}

/** Weekday / month labels for a venue calendar date (display only). */
export function venueDateLabels(ymd: string): {
  weekdayShort: string;
  monthName: string;
  dayNumber: string;
} {
  const match = String(ymd).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dayNumber = match ? match[3] : "";
  const dt = venueYmdToUtcDate(ymd);
  if (!dt) {
    return { weekdayShort: "", monthName: "", dayNumber };
  }
  return {
    weekdayShort: dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    monthName: dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
    dayNumber,
  };
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

const DEFAULT_SHOW_DURATION_MINUTES = 120;

/** Add minutes to a venue wall clock; returns naive `YYYY-MM-DDTHH:mm:ss`. */
export function addMinutesToVenueWall(
  value: string | Date,
  minutes: number
): string | null {
  const parts = scheduledParts(value);
  if (!parts) return null;
  const ms =
    Date.UTC(parts.y, parts.m - 1, parts.d, parts.hour, parts.minute, 0) +
    minutes * 60_000;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/**
 * True when the show is finished (past ends_at, or starts_at + duration).
 * Used to hide completed slots even if the API still returns them.
 */
export function isMovieShowEnded(opts: {
  starts_at?: string | Date | null;
  ends_at?: string | Date | null;
  duration_minutes?: number | null;
  booking_state?: string | null;
  is_ended?: boolean | null;
  now?: Date;
}): boolean {
  if (opts.booking_state === "ENDED" || opts.is_ended) return true;
  const now = opts.now ?? new Date();
  if (opts.ends_at) {
    return isVenueWallTimeReached(opts.ends_at, now);
  }
  if (!opts.starts_at) return false;
  const mins =
    opts.duration_minutes && opts.duration_minutes > 0
      ? opts.duration_minutes
      : DEFAULT_SHOW_DURATION_MINUTES;
  const endWall = addMinutesToVenueWall(opts.starts_at, mins);
  if (!endWall) return false;
  return isVenueWallTimeReached(endWall, now);
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

// ── Instant / audit (created_at, booked on, checked out) — Ethiopia ──────────

/** Ethiopia calendar date: "22 April 2014" */
export function formatInstantLocalDate(value?: string | Date | null): string {
  if (!value) return "—";
  const parts = localParts(value);
  if (!parts) return "—";
  return formatPartsCustomer(parts.y, parts.m, parts.d);
}

/** Ethiopia time: "2:41 PM" */
export function formatInstantLocalTime(value?: string | Date | null): string {
  if (!value) return "—";
  const parts = localParts(value);
  if (!parts) return "—";
  return formatHour12(parts.hour, parts.minute);
}

/** Ethiopia date + time: "22 April 2014, 2:41 PM" */
export function formatInstantLocalDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const date = formatInstantLocalDate(value);
  const time = formatInstantLocalTime(value);
  if (date === "—" && time === "—") return "—";
  if (date === "—") return time;
  if (time === "—") return date;
  return `${date}, ${time}`;
}

// ── Form helpers (Ethiopia wall clock ↔ UTC ISO) ─────────────────────────────

/** Convert ISO / Date to `datetime-local` value in Ethiopia (YYYY-MM-DDTHH:mm) */
export function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const parts = getVenueDateTimeParts(iso);
  if (!parts) return "";
  return `${parts.dateKey}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

/** Convert a `datetime-local` value typed as Ethiopia time to a UTC ISO string */
export function fromDatetimeLocal(val: string): string {
  if (!val) return "";
  const match = val.trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (!match) return "";
  const d = new Date(`${match[1]}T${match[2]}:00+03:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
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
  const parts = getVenueDateTimeParts(s);
  return parts?.dateKey || "";
}

/** Alias for settlement / API date-only params */
export function toDateOnlyParam(value?: string | Date | null): string {
  if (!value) return "";
  return toDateInput(value instanceof Date ? value.toISOString() : String(value));
}

export function toTimeInput(iso?: string | null): string {
  if (!iso) return "";
  const parts = getVenueDateTimeParts(iso);
  if (!parts) return "";
  return `${pad2(parts.hour)}:${pad2(parts.minute)}`;
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
  const a = getVenueDateTimeParts(startsAt);
  const b = getVenueDateTimeParts(endsAt);
  if (!a || !b) return "ONE_DAY";
  return a.dateKey === b.dateKey ? "ONE_DAY" : "MULTI_DAY";
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
