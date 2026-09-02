"use client";

import { useEffect, useMemo } from "react";
import type { BusinessType } from "@/services/api";

export type PartnerModule = "dining" | "event" | "venue" | "artist" | "cinema" | "combined";

interface PartnerTypeFieldsProps {
  /** dining | event | venue | artist = fixed module; combined = Restaurant, Bar + Event + Venue + Artist */
  partnerType: PartnerModule;
  businessTypes: BusinessType[];
  parentTypeId: string;
  venueTypeId: string;
  onParentTypeIdChange: (id: string) => void;
  onVenueTypeIdChange: (id: string) => void;
  variant?: "light" | "dark";
}

const labelClass = {
  light: "block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2",
  dark: "block text-sm font-medium text-zinc-400 mb-2",
};

const selectClass = {
  light:
    "w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6900AA] focus:border-[#6900AA] text-sm disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed",
  dark: "w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 appearance-none disabled:opacity-50 disabled:cursor-not-allowed",
};

function isEventParentType(type: BusinessType | undefined) {
  return type?.module_key === "event";
}

function isCinemaParentType(type: BusinessType | undefined) {
  return type?.module_key === "cinema";
}

/** Parent + subtype dropdowns. Event parent → subtype disabled. */
export default function PartnerTypeFields({
  partnerType,
  businessTypes,
  parentTypeId,
  venueTypeId,
  onParentTypeIdChange,
  onVenueTypeIdChange,
  variant = "dark",
}: PartnerTypeFieldsProps) {
  const fixedEvent = partnerType === "event";
  const fixedCinema = partnerType === "cinema";
  const fixedVenue = partnerType === "venue";
  const fixedArtist = partnerType === "artist";

  const diningParents = useMemo(
    () =>
      businessTypes.filter(
        (t) =>
          t.module_key === "dining" &&
          (t.parent_type_id === null || t.parent_type_id === undefined)
      ),
    [businessTypes]
  );

  const eventParents = useMemo(
    () =>
      businessTypes.filter(
        (t) =>
          t.module_key === "event" &&
          (t.parent_type_id === null || t.parent_type_id === undefined)
      ),
    [businessTypes]
  );

  const venueParents = useMemo(
    () =>
      businessTypes.filter(
        (t) =>
          t.module_key === "venue" &&
          (t.parent_type_id === null || t.parent_type_id === undefined)
      ),
    [businessTypes]
  );

  const artistParents = useMemo(
    () =>
      businessTypes.filter(
        (t) =>
          t.module_key === "artist" &&
          (t.parent_type_id === null || t.parent_type_id === undefined)
      ),
    [businessTypes]
  );

  const cinemaParents = useMemo(
    () =>
      businessTypes.filter(
        (t) =>
          t.module_key === "cinema" &&
          (t.parent_type_id === null || t.parent_type_id === undefined)
      ),
    [businessTypes]
  );

  const parentOptions = useMemo(() => {
    if (partnerType === "combined") {
      return [...diningParents, ...eventParents, ...venueParents, ...artistParents, ...cinemaParents];
    }
    if (partnerType === "event") return eventParents;
    if (partnerType === "cinema") return cinemaParents;
    if (partnerType === "venue") return venueParents;
    if (partnerType === "artist") return artistParents;
    return diningParents;
  }, [partnerType, diningParents, eventParents, venueParents, artistParents, cinemaParents]);

  const selectedParent = useMemo(
    () => parentOptions.find((t) => String(t.id) === parentTypeId),
    [parentOptions, parentTypeId]
  );

  const isEventSelected = fixedEvent || isEventParentType(selectedParent);
  const isCinemaSelected = fixedCinema || isCinemaParentType(selectedParent);
  const isVenueSelected = fixedVenue || selectedParent?.module_key === "venue";
  const isArtistSelected = fixedArtist || selectedParent?.module_key === "artist";
  const needsSubtype = !isEventSelected && !isCinemaSelected;

  const subtypeModule = isArtistSelected ? "artist" : isVenueSelected ? "venue" : "dining";

  const venueTypes = useMemo(() => {
    if (!needsSubtype || !parentTypeId) return [];
    const parentId = parseInt(parentTypeId, 10);
    return businessTypes.filter(
      (t) => t.module_key === subtypeModule && t.parent_type_id === parentId
    );
  }, [businessTypes, parentTypeId, needsSubtype, subtypeModule]);

  useEffect(() => {
    if (!(fixedEvent || fixedCinema || fixedVenue || fixedArtist)) return;
    const fixedParents = fixedEvent
      ? eventParents
      : fixedCinema
        ? cinemaParents
        : fixedArtist
          ? artistParents
          : venueParents;
    if (fixedParents.length === 1 && parentTypeId !== String(fixedParents[0].id)) {
      onParentTypeIdChange(String(fixedParents[0].id));
    }
  }, [
    fixedEvent,
    fixedCinema,
    fixedVenue,
    fixedArtist,
    eventParents,
    cinemaParents,
    venueParents,
    artistParents,
    parentTypeId,
    onParentTypeIdChange,
  ]);

  useEffect(() => {
    if ((isEventSelected || isCinemaSelected) && venueTypeId !== "") {
      onVenueTypeIdChange("");
    }
  }, [isEventSelected, isCinemaSelected, venueTypeId, onVenueTypeIdChange]);

  useEffect(() => {
    if (fixedEvent || fixedCinema || fixedVenue || fixedArtist) return;
    if (parentTypeId && !parentOptions.some((p) => String(p.id) === parentTypeId)) {
      onParentTypeIdChange("");
      if (venueTypeId !== "") onVenueTypeIdChange("");
    }
  }, [fixedEvent, fixedCinema, fixedVenue, fixedArtist, parentTypeId, parentOptions, venueTypeId, onParentTypeIdChange, onVenueTypeIdChange]);

  useEffect(() => {
    if (isEventSelected || isCinemaSelected || !parentTypeId) return;
    if (venueTypeId && !venueTypes.some((v) => String(v.id) === venueTypeId)) {
      onVenueTypeIdChange("");
    }
  }, [isEventSelected, isCinemaSelected, parentTypeId, venueTypeId, venueTypes, onVenueTypeIdChange]);

  const parentLabel =
    partnerType === "event"
      ? "Event Parent Name"
      : partnerType === "cinema"
        ? "Cinema Parent Name"
        : partnerType === "venue"
          ? "Venue Parent Name"
          : partnerType === "artist"
            ? "Artist Parent Name"
            : "Parent Name";
  const parentHint =
    partnerType === "combined"
      ? "e.g. Restaurant, Bar, Event, Venue, Artist, Cinema"
      : partnerType === "event"
        ? "e.g. Event"
        : partnerType === "cinema"
          ? "e.g. Cinema"
          : partnerType === "venue"
            ? "e.g. Venue"
            : partnerType === "artist"
              ? "e.g. Artist"
              : "e.g. Restaurant, Bar";
  const subtypeLabel = isArtistSelected ? "Artist Type" : "Venue Type";
  const venueHint = isEventSelected
    ? "Not required — pick Comedy / Music / Concert when creating events"
    : isCinemaSelected
      ? "Not required — pick Multiplex / Single Screen when listing movies"
      : isArtistSelected
      ? "e.g. Artist → Singer"
      : isVenueSelected
        ? "e.g. Venue → Banquet Hall"
        : "e.g. Restaurant → Cafe";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
      <div>
        <label className={labelClass[variant]}>
          {parentLabel} <span className="text-rose-500">*</span>
        </label>
        <select
          value={parentTypeId}
          onChange={(e) => {
            onParentTypeIdChange(e.target.value);
            onVenueTypeIdChange("");
          }}
          className={selectClass[variant]}
          required
        >
          <option value="" disabled>
            Select parent category
          </option>
          {parentOptions.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
        <p className={`mt-1 text-xs ${variant === "dark" ? "text-zinc-500" : "text-slate-400"}`}>
          {parentHint}
        </p>
      </div>

      <div>
        <label className={labelClass[variant]}>
          {subtypeLabel}
          {needsSubtype ? <span className="text-rose-500"> *</span> : null}
        </label>
        <select
          value={venueTypeId}
          onChange={(e) => onVenueTypeIdChange(e.target.value)}
          className={selectClass[variant]}
          required={needsSubtype}
          disabled={isEventSelected || !parentTypeId}
        >
          <option value="" disabled>
            {isEventSelected
              ? "Not applicable for event organizers"
              : parentTypeId
                ? `Select ${isArtistSelected ? "artist" : "venue"} type`
                : "Choose parent first"}
          </option>
          {needsSubtype &&
            venueTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
        </select>
        <p className={`mt-1 text-xs ${variant === "dark" ? "text-zinc-500" : "text-slate-400"}`}>
          {venueHint}
        </p>
      </div>
    </div>
  );
}

/** Helper for forms using combined parent dropdown */
export function resolvePartnerFromParentId(
  businessTypes: BusinessType[],
  parentTypeId: string
): { partner_type: "dining" | "event" | "venue" | "artist" | "cinema"; type_id: number } | null {
  if (!parentTypeId) return null;
  const parent = businessTypes.find((t) => String(t.id) === parentTypeId);
  if (!parent) return null;
  if (parent.module_key === "event") {
    return { partner_type: "event", type_id: parent.id };
  }
  if (parent.module_key === "cinema") {
    return { partner_type: "cinema", type_id: parent.id };
  }
  if (parent.module_key === "venue") {
    return { partner_type: "venue", type_id: parent.id };
  }
  if (parent.module_key === "artist") {
    return { partner_type: "artist", type_id: parent.id };
  }
  return null;
}
