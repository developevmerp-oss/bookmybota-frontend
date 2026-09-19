"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { FaMapMarkerAlt } from "react-icons/fa";
import {
  useGetBusinessesPagedQuery,
  useGetPublicEventsQuery,
  useGetPublicRegisteredArtistsQuery,
  useGetPublicRegisteredVenuesQuery,
} from "@/services/api";

export type CityModuleKey = "events" | "dining" | "artists" | "venues";

type CityLocationEmptyStateProps = {
  city: string;
  /**
   * When true, parent is already showing global / all-cities data because
   * this city has no results for the current surface.
   */
  forceShow?: boolean;
  /** Optional: highlight which surface the user is on (still lists all missing). */
  currentModule?: CityModuleKey;
  className?: string;
};

const MODULE_LABELS: Record<CityModuleKey, string> = {
  events: "Events",
  dining: "Dining",
  artists: "Artists",
  venues: "Venues",
};

const MODULE_KEYS: CityModuleKey[] = ["events", "dining", "artists", "venues"];

export function openCitySelect() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("open_city_select"));
}

export function clearSelectedCity() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("selected_city");
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("city")) {
      url.searchParams.delete("city");
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, "", next);
    }
  } catch {
    // ignore URL parse errors
  }
  window.dispatchEvent(new Event("selected_city_changed"));
}

function formatList(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

/**
 * Banner when a selected city has no (or incomplete) catalog coverage and the
 * page may be showing global / all-cities results.
 */
export default function CityLocationEmptyState({
  city,
  forceShow = false,
  currentModule,
  className = "",
}: CityLocationEmptyStateProps) {
  const cityName = city.trim();
  const hasCity = Boolean(cityName) && cityName !== "All Cities";
  const [dismissed, setDismissed] = useState(false);

  // Reset close state when city changes so a new empty city always shows the banner.
  useEffect(() => {
    setDismissed(false);
  }, [cityName]);

  const skip = !hasCity;

  const { data: cityEvents, isLoading: eventsLoading } = useGetPublicEventsQuery(
    { city: cityName },
    { skip }
  );
  const { data: cityDining, isLoading: diningLoading } = useGetBusinessesPagedQuery(
    { module: "dining", city: cityName, page: 1, limit: 1 },
    { skip }
  );
  const { data: cityArtists, isLoading: artistsLoading } = useGetPublicRegisteredArtistsQuery(
    { city: cityName },
    { skip }
  );
  const { data: cityVenues, isLoading: venuesLoading } = useGetPublicRegisteredVenuesQuery(
    { city: cityName },
    { skip }
  );

  const availability = useMemo(() => {
    const eventsEmpty = !eventsLoading && (cityEvents?.length ?? 0) === 0;
    const diningEmpty =
      !diningLoading &&
      (cityDining?.items?.length ?? 0) === 0 &&
      (cityDining?.meta?.total ?? 0) === 0;
    const artistsEmpty = !artistsLoading && (cityArtists?.length ?? 0) === 0;
    const venuesEmpty = !venuesLoading && (cityVenues?.length ?? 0) === 0;

    return {
      events: !eventsEmpty,
      dining: !diningEmpty,
      artists: !artistsEmpty,
      venues: !venuesEmpty,
      ready: !eventsLoading && !diningLoading && !artistsLoading && !venuesLoading,
    };
  }, [
    cityEvents,
    cityDining,
    cityArtists,
    cityVenues,
    eventsLoading,
    diningLoading,
    artistsLoading,
    venuesLoading,
  ]);

  const missingModules = useMemo(
    () => MODULE_KEYS.filter((k) => !availability[k]),
    [availability]
  );
  const availableModules = useMemo(
    () => MODULE_KEYS.filter((k) => availability[k]),
    [availability]
  );

  const allMissing = availability.ready
    ? missingModules.length === MODULE_KEYS.length
    : Boolean(forceShow);
  const someMissing =
    availability.ready &&
    missingModules.length > 0 &&
    missingModules.length < MODULE_KEYS.length;

  // forceShow = parent already using global data for an empty city — show immediately.
  const shouldShow =
    hasCity && !dismissed && (forceShow || (availability.ready && missingModules.length > 0));

  if (!shouldShow) return null;

  const missingLabels = missingModules.map((k) => MODULE_LABELS[k]);
  const availableLabels = availableModules.map((k) => MODULE_LABELS[k]);

  const headline =
    someMissing
      ? `Some experiences aren’t in ${cityName} yet.`
      : forceShow && currentModule && availability.ready && !allMissing
        ? `No ${MODULE_LABELS[currentModule].toLowerCase()} in ${cityName} right now.`
        : "Nothing available near you right now.";

  // Dynamic line: which modules are showing all-cities / global data.
  const subtext = (() => {
    if (someMissing) {
      const fromAll = `Showing ${formatList(missingLabels)} from all cities.`;
      const inCity =
        availableLabels.length > 0
          ? ` ${formatList(availableLabels)} available in ${cityName}.`
          : "";
      return `${fromAll}${inCity}`;
    }
    if (allMissing || forceShow) {
      if (availability.ready && missingLabels.length > 0) {
        return `Here’s what else you can explore. Showing ${formatList(missingLabels)} from all cities.`;
      }
      return "Here’s what else you can explore.";
    }
    return "Here’s what else you can explore.";
  })();

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[#F5D0D6] bg-[#FFF5F5] ${className}`}
      role="status"
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute top-2.5 right-2.5 z-20 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-white/80 hover:text-slate-800 cursor-pointer"
        aria-label="Close"
      >
        <X size={16} />
      </button>

      <div className="relative z-10 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-5 md:px-6 md:py-5 pr-10 sm:pr-16">
        <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFE4E8] text-[#E11D48] sm:h-12 sm:w-12">
            <FaMapMarkerAlt size={20} aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#0F172A] sm:text-base md:text-[17px]">
              {headline}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:text-sm">{subtext}</p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center sm:gap-2.5">
          <button
            type="button"
            onClick={openCitySelect}
            className="inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm cursor-pointer hover:border-slate-300 sm:w-auto sm:min-w-[10.5rem]"
            aria-label="Change city"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <FaMapMarkerAlt size={13} className="shrink-0 text-slate-700" />
              <span className="truncate">{cityName}</span>
            </span>
            <ChevronDown size={14} className="shrink-0 text-slate-500" />
          </button>
          <button
            type="button"
            onClick={clearSelectedCity}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-[#E11D48] bg-white px-4 text-sm font-bold text-[#E11D48] cursor-pointer hover:bg-[#FFF1F2] sm:w-auto"
          >
            Clear City
          </button>
        </div>
      </div>
    </div>
  );
}
