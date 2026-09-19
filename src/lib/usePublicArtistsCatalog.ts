"use client";

import { useEffect, useMemo, useState } from "react";
import {
  api,
  useGetPublicEventsQuery,
  useGetPublicRegisteredArtistsQuery,
  type PublicEvent,
  type PublicRegisteredPartner,
} from "@/services/api";
import { useAppDispatch } from "@/lib/hooks";
import { rememberPartnerEvents } from "@/lib/partnerEventHistory";

export type DirectoryArtist = PublicRegisteredPartner & {
  partner_source?: string | null;
  is_partner_authorized?: boolean | null;
  /** Lineup role used as type when business type is missing */
  role_title?: string | null;
};

export type EventArtistProfile = {
  id: string;
  name: string;
  description?: string | null;
  cover_image_url?: string | null;
  type_name?: string | null;
  role_title?: string | null;
  partner_source: "event_auto" | "external" | "onboarded";
  is_partner_authorized: boolean;
  events: PublicEvent[];
};

const EMPTY: DirectoryArtist[] = [];
const EMPTY_EVENTS: PublicEvent[] = [];

function slugifyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeArtistName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNamesClose(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.length - shorter.length > 2) return false;
  let i = 0;
  let j = 0;
  let misses = 0;
  while (i < longer.length && j < shorter.length) {
    if (longer[i] === shorter[j]) {
      i += 1;
      j += 1;
    } else {
      misses += 1;
      i += 1;
      if (misses > 2) return false;
    }
  }
  return misses + (longer.length - i) <= 2;
}

function artistNamesMatch(a: string, b: string) {
  const left = normalizeArtistName(a);
  const right = normalizeArtistName(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const lp = left.split(" ").filter(Boolean);
  const rp = right.split(" ").filter(Boolean);
  if (lp.length >= 2 && rp.length >= 2) {
    const lastL = lp[lp.length - 1];
    const lastR = rp[rp.length - 1];
    if (lastL === lastR && firstNamesClose(lp[0], rp[0])) return true;
  }
  return false;
}

/** Stable id for external artists that have no business row. */
export function externalArtistId(name: string) {
  const slug = slugifyName(name) || "artist";
  return `ext-${slug}`;
}

export function isExternalArtistId(id: string) {
  return String(id || "").startsWith("ext-");
}

/** Match a public event lineup row to an artist by business id and/or name. */
export function lineupRowMatchesArtist(
  artistId: string,
  artistName: string | null | undefined,
  row: {
    artist_business_id?: string | null;
    name?: string | null;
    artist_business_name?: string | null;
  }
): boolean {
  if (row.artist_business_id != null && String(row.artist_business_id) === String(artistId)) {
    return true;
  }

  const rowName = String(row.name || row.artist_business_name || "").trim();
  if (!rowName) return false;

  if (isExternalArtistId(artistId) && externalArtistId(rowName) === String(artistId)) {
    return true;
  }

  const target = (artistName || "").trim();
  if (!target) return false;

  if (artistNamesMatch(target, rowName)) return true;
  const businessName = String(row.artist_business_name || "").trim();
  if (businessName && artistNamesMatch(target, businessName)) return true;
  return false;
}

export function isRegisteredDirectoryArtist(artist: {
  partner_source?: string | null;
  is_partner_authorized?: boolean | null;
}): boolean {
  if (artist.is_partner_authorized === false) return false;
  const source = String(artist.partner_source || "onboarded").toLowerCase();
  return source !== "event_auto" && source !== "external";
}

function preferLonger(a?: string | null, b?: string | null) {
  const left = (a || "").trim();
  const right = (b || "").trim();
  if (!left) return right || null;
  if (!right) return left;
  return right.length > left.length ? right : left;
}

/**
 * Merge onboarded registered artists with artists appearing on public live events
 * (auto-registered / external). No backend changes — uses existing public APIs.
 */
export function usePublicArtistsCatalog(opts?: { q?: string; city?: string }) {
  const dispatch = useAppDispatch();
  const q = (opts?.q || "").trim().toLowerCase();
  const city = (opts?.city || "").trim();
  const hasCity = Boolean(city) && city !== "All Cities";

  const registeredQuery = useGetPublicRegisteredArtistsQuery(
    hasCity ? { city } : q ? { q } : undefined
  );
  const registeredAllQuery = useGetPublicRegisteredArtistsQuery(
    q ? { q } : undefined,
    { skip: !hasCity }
  );
  const { data: publicEventsData, isLoading: eventsLoading } = useGetPublicEventsQuery();
  const publicEvents = publicEventsData ?? EMPTY_EVENTS;

  const [eventArtists, setEventArtists] = useState<DirectoryArtist[]>(EMPTY);
  const [eventProfiles, setEventProfiles] = useState<Record<string, EventArtistProfile>>({});
  const [eventArtistsLoading, setEventArtistsLoading] = useState(true);

  const publicEventsKey = useMemo(
    () => publicEvents.map((e) => e.id).join("|"),
    [publicEvents]
  );

  useEffect(() => {
    const events = publicEventsData ?? EMPTY_EVENTS;
    if (events.length === 0) {
      setEventArtists(EMPTY);
      setEventProfiles({});
      setEventArtistsLoading(false);
      return;
    }

    let cancelled = false;
    setEventArtistsLoading(true);

    (async () => {
      const byId = new Map<string, DirectoryArtist>();
      const profiles = new Map<string, EventArtistProfile>();

      const chunkSize = 8;
      for (let i = 0; i < events.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = events.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (event) => {
            try {
              const detail = await dispatch(
                api.endpoints.getPublicEvent.initiate(event.id, { forceRefetch: false })
              ).unwrap();

              for (const row of detail.artists || []) {
                const name = String(row.name || row.artist_business_name || "").trim();
                if (!name) continue;

                const businessId = row.artist_business_id
                  ? String(row.artist_business_id)
                  : "";
                const id = businessId || externalArtistId(name);
                const partnerSourceRaw = String(
                  row.artist_partner_source || row.artist_source || ""
                ).toLowerCase();
                const partner_source: EventArtistProfile["partner_source"] =
                  partnerSourceRaw === "onboarded" || row.artist_source === "registered"
                    ? "onboarded"
                    : partnerSourceRaw === "event_auto" ||
                        row.artist_source === "auto_registered"
                      ? "event_auto"
                      : "external";

                const image = row.image_url || row.artist_business_image || null;
                const description = row.description || null;
                const role = row.role_title || null;
                const authorized =
                  row.artist_is_authorized !== false && partner_source === "onboarded";

                const existing = byId.get(id);
                byId.set(id, {
                  id,
                  name: existing?.name || name,
                  description: preferLonger(existing?.description, description),
                  cover_image_url: existing?.cover_image_url || image || null,
                  city_name: existing?.city_name || event.city_name || null,
                  type_name: existing?.type_name || role || "Artist",
                  role_title: existing?.role_title || role,
                  partner_source:
                    existing && isRegisteredDirectoryArtist(existing)
                      ? existing.partner_source
                      : partner_source,
                  is_partner_authorized: authorized,
                });

                const profile = profiles.get(id);
                const nextEvents = profile?.events?.some((e) => e.id === event.id)
                  ? profile.events
                  : [...(profile?.events || []), event];
                profiles.set(id, {
                  id,
                  name: profile?.name || name,
                  description: preferLonger(profile?.description, description),
                  cover_image_url: profile?.cover_image_url || image || null,
                  type_name: profile?.type_name || role || "Artist",
                  role_title: profile?.role_title || role,
                  partner_source:
                    profile && profile.partner_source === "onboarded"
                      ? "onboarded"
                      : partner_source,
                  is_partner_authorized: authorized,
                  events: nextEvents.sort((a, b) => {
                    const ta = a.next_showtime
                      ? Date.parse(a.next_showtime)
                      : Number.POSITIVE_INFINITY;
                    const tb = b.next_showtime
                      ? Date.parse(b.next_showtime)
                      : Number.POSITIVE_INFINITY;
                    return ta - tb;
                  }),
                });
              }
            } catch {
              // skip failed event detail
            }
          })
        );
      }

      if (cancelled) return;
      setEventArtists(Array.from(byId.values()));
      const profileMap = Object.fromEntries(profiles.entries());
      setEventProfiles(profileMap);
      for (const profile of profiles.values()) {
        rememberPartnerEvents("artist", profile.id, profile.events || []);
      }
      setEventArtistsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, publicEventsData, publicEventsKey]);

  const registered =
    hasCity && (registeredQuery.data?.length ?? 0) === 0 && registeredAllQuery.data
      ? registeredAllQuery.data
      : registeredQuery.data ?? EMPTY;

  const merged = useMemo(() => {
    const map = new Map<string, DirectoryArtist>();

    for (const a of registered) {
      map.set(String(a.id), {
        ...a,
        partner_source: a.partner_source || "onboarded",
        is_partner_authorized: a.is_partner_authorized ?? true,
      });
    }

    for (const a of eventArtists) {
      const id = String(a.id);
      const existing = map.get(id);
      if (existing && isRegisteredDirectoryArtist(existing)) {
        // Keep registered record; still enrich image/description if empty
        map.set(id, {
          ...existing,
          description: preferLonger(existing.description, a.description),
          cover_image_url: existing.cover_image_url || a.cover_image_url,
          type_name: existing.type_name || a.type_name,
        });
        continue;
      }
      // Prefer linking name-only event artists onto a registered artist with the same name
      if (!existing) {
        const regMatch = Array.from(map.values()).find(
          (r) => isRegisteredDirectoryArtist(r) && artistNamesMatch(r.name, a.name)
        );
        if (regMatch) {
          map.set(String(regMatch.id), {
            ...regMatch,
            description: preferLonger(regMatch.description, a.description),
            cover_image_url: regMatch.cover_image_url || a.cover_image_url,
            type_name: regMatch.type_name || a.type_name,
          });
          continue;
        }
        map.set(id, a);
      }
    }

    let list = Array.from(map.values());

    if (q) {
      list = list.filter((a) => {
        const hay = `${a.name} ${a.type_name || ""} ${a.description || ""} ${a.role_title || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (hasCity) {
      const cityLower = city.toLowerCase();
      const cityFiltered = list.filter((a) => {
        const place = `${a.city_name || ""} ${a.city_state || ""}`.toLowerCase();
        return place.includes(cityLower);
      });
      // If city filter empties the list, keep all (same preferCityOrAll spirit for event-sourced)
      if (cityFiltered.length > 0) list = cityFiltered;
    }

    list.sort((a, b) => {
      const ar = isRegisteredDirectoryArtist(a) ? 0 : 1;
      const br = isRegisteredDirectoryArtist(b) ? 0 : 1;
      if (ar !== br) return ar - br;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [registered, eventArtists, q, city, hasCity]);

  /** Profiles keyed by business id and by registered name matches. */
  const eventProfilesResolved = useMemo(() => {
    const out: Record<string, EventArtistProfile> = { ...eventProfiles };

    for (const reg of registered) {
      const regId = String(reg.id);
      if (!normalizeArtistName(reg.name)) continue;

      const matchedEvents: PublicEvent[] = [];
      let seed: EventArtistProfile | null = out[regId] || null;

      for (const profile of Object.values(eventProfiles)) {
        if (!artistNamesMatch(reg.name, profile.name)) continue;
        seed = seed || profile;
        for (const ev of profile.events) {
          if (!matchedEvents.some((e) => e.id === ev.id)) matchedEvents.push(ev);
        }
      }

      if (matchedEvents.length === 0 && !seed) continue;

      matchedEvents.sort((a, b) => {
        const ta = a.next_showtime ? Date.parse(a.next_showtime) : Number.POSITIVE_INFINITY;
        const tb = b.next_showtime ? Date.parse(b.next_showtime) : Number.POSITIVE_INFINITY;
        return ta - tb;
      });

      out[regId] = {
        id: regId,
        name: reg.name,
        description: preferLonger(reg.description, seed?.description),
        cover_image_url: reg.cover_image_url || seed?.cover_image_url || null,
        type_name: reg.type_name || seed?.type_name || "Artist",
        role_title: seed?.role_title || null,
        partner_source: "onboarded",
        is_partner_authorized: true,
        events: matchedEvents.length ? matchedEvents : seed?.events || [],
      };
    }

    return out;
  }, [eventProfiles, registered]);

  const isLoading =
    registeredQuery.isLoading ||
    (hasCity && (registeredQuery.data?.length ?? 0) === 0 && registeredAllQuery.isLoading) ||
    eventsLoading ||
    eventArtistsLoading;

  const usedCityFallback =
    hasCity &&
    !registeredQuery.isLoading &&
    (registeredQuery.data?.length ?? 0) === 0 &&
    (registeredAllQuery.data?.length ?? 0) > 0;

  return {
    artists: merged,
    eventProfiles: eventProfilesResolved,
    isLoading,
    usedCityFallback,
  };
}

export function useEventArtistProfile(artistId: string) {
  const { eventProfiles, isLoading } = usePublicArtistsCatalog();
  const profile = eventProfiles[artistId] || null;
  return { profile, isLoading };
}
