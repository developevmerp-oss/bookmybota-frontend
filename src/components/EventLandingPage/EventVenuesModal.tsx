"use client";

import { useMemo } from "react";
import { X } from "lucide-react";
import { formatTime12h } from "@/lib/dateFormat";

export type VenueShowtimeRow = {
  id: string;
  venue_name?: string;
  venue_address?: string;
  city_name?: string | null;
  starts_at: string;
  venue_is_authorized?: boolean;
  venue_source?: string;
};

type VenueEntry = {
  key: string;
  name: string;
  address?: string;
  city: string;
  starts_at: string;
  mapsUrl: string;
  unauthorized?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  showtimes: VenueShowtimeRow[];
};

function formatVenueDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function EventVenuesModal({ open, onClose, showtimes }: Props) {
  const cities = useMemo(() => {
    const venueMap = new Map<string, VenueEntry>();
    for (const s of showtimes) {
      const name = (s.venue_name || "").trim();
      if (!name) continue;
      const address = (s.venue_address || "").trim();
      const city = (s.city_name || "").trim() || "Other";
      const key = `${city}|${name}|${address}`;
      const existing = venueMap.get(key);
      if (!existing || new Date(s.starts_at).getTime() < new Date(existing.starts_at).getTime()) {
        const mapsQuery = [name, address].filter(Boolean).join(", ");
        venueMap.set(key, {
          key,
          name,
          address: address || undefined,
          city,
          starts_at: s.starts_at,
          mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`,
          unauthorized:
            s.venue_source === "auto_registered" ||
            s.venue_is_authorized === false,
        });
      }
    }

    const byCity = new Map<string, VenueEntry[]>();
    for (const v of venueMap.values()) {
      const list = byCity.get(v.city) || [];
      list.push(v);
      byCity.set(v.city, list);
    }

    return [...byCity.entries()]
      .map(([city, venues]) => ({
        city,
        venues: venues.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.city.localeCompare(b.city));
  }, [showtimes]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/55"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-venues-title"
        className="relative w-full sm:max-w-[32rem] max-h-[90vh] sm:max-h-[85vh] overflow-hidden rounded-t-[1rem] sm:rounded-[1rem] bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-slate-100 shrink-0">
          <h2 id="event-venues-title" className="text-[1.375rem] sm:text-[1.5rem] font-extrabold text-[#1A1A1A]">
            Venues
          </h2>
          <button
            type="button"
            aria-label="Close venues"
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-[#E8E8E8] text-[#555] hover:bg-[#ddd] flex items-center justify-center cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 sm:px-6 py-4 space-y-5">
          {cities.length === 0 ? (
            <p className="text-[0.9375rem] text-slate-500 py-6 text-center">No venues listed.</p>
          ) : (
            cities.map(({ city, venues }) => (
              <section key={city} className="pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                <h3 className="text-[1rem] sm:text-[1.0625rem] font-bold text-[#1A1A1A] mb-3">
                  {city} ({venues.length} venue{venues.length === 1 ? "" : "s"})
                </h3>
                <ul className="space-y-4">
                  {venues.map((v) => (
                    <li key={v.key}>
                      <p className="text-[0.9375rem] sm:text-[1rem] font-bold text-[#1A1A1A]">{v.name}</p>
                      <p className="mt-1 text-[0.8125rem] sm:text-[0.875rem] text-slate-500">
                        {formatVenueDate(v.starts_at)}
                        {v.starts_at ? ` | ${formatTime12h(v.starts_at)}` : ""}
                      </p>
                      {v.address && (
                        <p className="mt-1.5 text-[0.875rem] sm:text-[0.9375rem] text-[#4A4A4A] leading-relaxed whitespace-pre-wrap">
                          {v.address}
                        </p>
                      )}
                      {v.unauthorized && (
                        <p className="mt-1 text-[0.6875rem] text-slate-400">
                          Not platform-authorized
                        </p>
                      )}
                      <a
                        href={v.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-[0.875rem] font-semibold hover:underline"
                        style={{ color: "#6900AA" }}
                      >
                        View On Maps
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
