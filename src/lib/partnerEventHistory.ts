import type { OrganizerEvent, PublicEvent } from "@/services/api";

export type PartnerEventWithMeta = {
  event: PublicEvent;
  /** True when the event still has an upcoming showtime in our system. */
  live: boolean;
};

const STORAGE_KEY = "bmb_partner_event_history_v1";
const MAX_PER_PARTNER = 40;

type PartnerKind = "artist" | "venue";

type HistoryStore = {
  artists: Record<string, PublicEvent[]>;
  venues: Record<string, PublicEvent[]>;
};

function emptyStore(): HistoryStore {
  return { artists: {}, venues: {} };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function showtimeDay(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Classify from public list fields (no detail). */
export function isPublicEventLive(event: PublicEvent): boolean {
  const status = String(event.status || "").toUpperCase();
  if (status === "CLOSED" || status === "CANCELLED" || status === "REJECTED") return false;
  if (!event.next_showtime) return status === "LIVE" || status === "APPROVED" || !status;
  const day = showtimeDay(event.next_showtime);
  if (!day) return true;
  return day.getTime() >= startOfToday().getTime();
}

/** Prefer showtimes from event detail when available. */
export function isEventLiveFromDetail(
  detail: OrganizerEvent | null | undefined,
  fallback: PublicEvent
): boolean {
  const shows = detail?.showtimes || [];
  if (shows.length > 0) {
    const today = startOfToday();
    return shows.some((s) => {
      const day = showtimeDay(s.ends_at || s.starts_at);
      return day != null && day.getTime() >= today.getTime();
    });
  }
  const status = String(detail?.status || fallback.status || "").toUpperCase();
  if (status === "CLOSED" || status === "CANCELLED" || status === "REJECTED") return false;
  return isPublicEventLive(fallback);
}

export function splitLiveAndPast(items: PartnerEventWithMeta[]): {
  live: PublicEvent[];
  past: PublicEvent[];
} {
  const live: PublicEvent[] = [];
  const past: PublicEvent[] = [];
  for (const item of items) {
    if (item.live) live.push(item.event);
    else past.push(item.event);
  }
  const byShow = (a: PublicEvent, b: PublicEvent) => {
    const ta = a.next_showtime ? Date.parse(a.next_showtime) : 0;
    const tb = b.next_showtime ? Date.parse(b.next_showtime) : 0;
    return ta - tb;
  };
  live.sort(byShow);
  past.sort((a, b) => byShow(b, a));
  return { live, past };
}

function readStore(): HistoryStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<HistoryStore>;
    return {
      artists: parsed.artists && typeof parsed.artists === "object" ? parsed.artists : {},
      venues: parsed.venues && typeof parsed.venues === "object" ? parsed.venues : {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: HistoryStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota / private mode
  }
}

function mergeEventLists(existing: PublicEvent[], incoming: PublicEvent[]): PublicEvent[] {
  const byId = new Map<string, PublicEvent>();
  for (const event of existing) {
    if (event?.id) byId.set(String(event.id), event);
  }
  for (const event of incoming) {
    if (!event?.id) continue;
    const id = String(event.id);
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, event);
      continue;
    }
    const prevTs = prev.next_showtime ? Date.parse(prev.next_showtime) : 0;
    const nextTs = event.next_showtime ? Date.parse(event.next_showtime) : 0;
    byId.set(id, nextTs >= prevTs ? { ...prev, ...event } : { ...event, ...prev });
  }
  return Array.from(byId.values())
    .sort((a, b) => {
      const ta = a.next_showtime ? Date.parse(a.next_showtime) : 0;
      const tb = b.next_showtime ? Date.parse(b.next_showtime) : 0;
      return tb - ta;
    })
    .slice(0, MAX_PER_PARTNER);
}

/** Persist events we already loaded for a partner so past ones remain visible later. */
export function rememberPartnerEvents(
  kind: PartnerKind,
  partnerId: string,
  events: PublicEvent[]
): void {
  const id = String(partnerId || "").trim();
  if (!id || events.length === 0) return;
  const store = readStore();
  const bucket = kind === "artist" ? store.artists : store.venues;
  bucket[id] = mergeEventLists(bucket[id] || [], events);
  writeStore(store);
}

export function readPartnerEvents(kind: PartnerKind, partnerId: string): PublicEvent[] {
  const id = String(partnerId || "").trim();
  if (!id) return [];
  const store = readStore();
  const bucket = kind === "artist" ? store.artists : store.venues;
  return Array.isArray(bucket[id]) ? bucket[id] : [];
}

/** Merge live API matches with remembered history; classify live vs past on the client. */
export function mergePartnerEventItems(
  kind: PartnerKind,
  partnerId: string,
  current: PartnerEventWithMeta[]
): PartnerEventWithMeta[] {
  const remembered = readPartnerEvents(kind, partnerId);
  const byId = new Map<string, PublicEvent>();
  for (const event of remembered) {
    byId.set(String(event.id), event);
  }
  for (const item of current) {
    byId.set(String(item.event.id), item.event);
  }

  const currentLive = new Map(
    current.map((item) => [String(item.event.id), item.live] as const)
  );

  const finalItems: PartnerEventWithMeta[] = Array.from(byId.values()).map((event) => {
    const id = String(event.id);
    const fromCurrent = currentLive.get(id);
    const live =
      fromCurrent != null
        ? Boolean(fromCurrent) && isPublicEventLive(event)
        : isPublicEventLive(event);
    return { event, live };
  });

  rememberPartnerEvents(
    kind,
    partnerId,
    finalItems.map((i) => i.event)
  );

  return finalItems.sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1;
    const ta = a.event.next_showtime ? Date.parse(a.event.next_showtime) : 0;
    const tb = b.event.next_showtime ? Date.parse(b.event.next_showtime) : 0;
    return a.live ? ta - tb : tb - ta;
  });
}
