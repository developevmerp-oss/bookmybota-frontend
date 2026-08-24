"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useForm, useFieldArray, useFormContext, FormProvider } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ImagePlus, Plus, Trash2, Upload, FileText, AlertCircle, ChevronLeft, ChevronRight, CalendarDays, MapPin, Search, Check } from "lucide-react";
import { toast } from "sonner";
import {
  useGetBusinessTypesQuery,
  useGetEventMastersQuery,
  useGetCitiesQuery,
  useUploadImageMutation,
  useSearchOrganizerVenuesQuery,
  useGetOrganizerVenueLayoutsQuery,
  useGetOrganizerVenueLayoutQuery,
  useSearchOrganizerArtistsQuery,
  type CityMaster,
  type EventDocumentUpload,
  type EventFormPayload,
  type OrganizerEvent,
  type OrganizerVenueSearchResult,
  type OrganizerArtistSearchResult,
} from "@/services/api";
import { fuzzyFilter } from "@/lib/fuzzySearch";

const VenueLayoutMapPreview = dynamic(
  () => import("@/components/EventAdminPanel/VenueLayoutMapPreview"),
  {
    ssr: false,
    loading: () => <p className="text-xs text-emerald-800">Loading seating map…</p>,
  }
);
import { parseEventLanguages, LANGUAGE_OPTIONS, AGE_GROUP_OPTIONS } from "@/lib/eventValidation";
import {
  eventDraftSchema,
  eventSubmitSchema,
  validateRequiredDocuments,
  getCompletedEventStepIds,
  computeDurationMinutesFromShowtimes,
  type EventFormValues,
  defaultEventFormValues,
  defaultVenue,
  defaultArtist,
  EVENT_LINEUP_ROLES,
  isArtistLineupRole,
  normalizeLineupRole,
  showtimeToIso,
  isShowtimePersistable,
} from "@/lib/eventFormSchema";
import {
  TICKET_MODE_OPTIONS,
  normalizeAllowedTicketModes,
  type TicketDeliveryMode,
} from "@/lib/eventTicketMode";
import {
  formatDate,
  formatDateTime12h,
  formatTime12h,
  inferDurationType,
  toDateInput,
  toDatetimeLocal,
  toTimeInput,
} from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";
import ImageCropPicker, { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import EventStepperNav, {
  EVENT_STEPPER_STEPS,
  type EventStepperStepId,
} from "@/components/EventAdminPanel/EventStepperNav";

function normalizeFormDocuments(docs?: EventDocumentUpload[] | string[]): EventDocumentUpload[] {
  if (!docs?.length) return [];
  if (typeof docs[0] === "string") {
    return (docs as string[]).map((url, i) => ({ document_type_id: -(i + 1), url }));
  }
  return docs as EventDocumentUpload[];
}

function parseEventTerms(raw?: OrganizerEvent["terms_points"]): {
  selected: Array<{ id: number; text: string }>;
  custom: string[];
} {
  const selected: Array<{ id: number; text: string }> = [];
  const custom: string[] = [];
  if (!raw) return { selected, custom };
  for (const item of raw.selected || []) {
    if (typeof item === "string") {
      const text = item.trim();
      if (text) custom.push(text);
      continue;
    }
    const id = Number(item.id);
    const text = String(item.text || "").trim();
    if (Number.isFinite(id) && id > 0 && text) selected.push({ id, text });
    else if (text) custom.push(text);
  }
  for (const line of raw.custom || []) {
    const text = String(line || "").trim();
    if (text) custom.push(text);
  }
  return { selected, custom };
}

function ticketsForShow(
  event: OrganizerEvent,
  showId: string,
  showIndex: number
): EventFormValues["showtimes"][number]["ticket_types"] {
  const all = event.ticket_types || [];
  const nested = (event.showtimes?.find((s) => s.id === showId)?.ticket_types || []).map((t) => ({
    ticket_type: t.ticket_type,
    total_count: Number(t.total_count),
    price: Number(t.price),
    max_per_order: Math.max(1, Number((t as { max_per_order?: number }).max_per_order) || 10),
  }));
  if (nested.length) return nested;
  const scoped = all.filter((t) => t.showtime_id === showId).map((t) => ({
    ticket_type: t.ticket_type,
    total_count: Number(t.total_count),
    price: Number(t.price),
    max_per_order: Math.max(1, Number((t as { max_per_order?: number }).max_per_order) || 10),
  }));
  if (scoped.length) return scoped;
  const unscoped = all.filter((t) => !t.showtime_id).map((t) => ({
    ticket_type: t.ticket_type,
    total_count: Number(t.total_count),
    price: Number(t.price),
    max_per_order: Math.max(1, Number((t as { max_per_order?: number }).max_per_order) || 10),
  }));
  if (showIndex === 0 && unscoped.length) return unscoped;
  return [{ ticket_type: "", total_count: 100, price: 0, max_per_order: 10 }];
}

function eventToValues(event?: OrganizerEvent | null): EventFormValues {
  if (!event) return defaultEventFormValues();
  const gallery = Array.isArray(event.gallery_images) ? event.gallery_images : [];
  return {
    name: event.name || "",
    category_type_id: event.category_type_id ?? null,
    genres: event.genres || [],
    poster_horizontal_url: event.poster_horizontal_url || "",
    poster_vertical_url: event.poster_vertical_url || "",
    gallery_images: gallery,
    youtube_url: event.youtube_url || "",
    languages: parseEventLanguages(event.language),
    about_event: event.about_event || "",
    age_group: event.age_group || "",
    duration_minutes: event.duration_minutes ?? null,
    allowed_ticket_modes: normalizeAllowedTicketModes(event.allowed_ticket_modes),
    artists:
      event.artists?.map((a, i) => ({
        artist_source:
          a.artist_source === "registered"
            ? "registered"
            : a.artist_source === "auto_registered"
              ? "auto_registered"
              : "external",
        artist_business_id: a.artist_business_id || null,
        name: a.name || "",
        role_title: normalizeLineupRole(a.role_title),
        description: a.description || "",
        image_url: a.image_url || a.artist_business_image || "",
        sort_order: a.sort_order ?? i,
      })) || [],
    showtimes:
      event.showtimes?.map((s, i) => {
        const durationType =
          s.duration_type || inferDurationType(s.starts_at, s.ends_at || s.starts_at);
        return {
          venue_name: s.venue_name || "",
          venue_address: s.venue_address || "",
          city_id: s.city_id ?? null,
          venue_source:
            s.venue_source === "registered"
              ? "registered"
              : s.venue_source === "auto_registered"
                ? "auto_registered"
                : "manual",
          venue_business_id: s.venue_business_id || null,
          venue_layout_template_id: s.venue_layout_template_id || null,
          layout_mode:
            s.layout_mode === "standard" || s.layout_mode === "custom"
              ? s.layout_mode
              : s.venue_layout_template_id
                ? "standard"
                : "none",
          custom_layout_name: s.custom_layout_name || "",
          custom_layout_type: s.custom_layout_type || "custom",
          custom_layout_capacity: s.custom_layout_capacity ?? null,
          custom_layout_notes: s.custom_layout_notes || "",
          custom_layout_images: Array.isArray((s as { custom_layout_images?: string[] }).custom_layout_images)
            ? ((s as { custom_layout_images?: string[] }).custom_layout_images || [])
            : [],
          location_id: (s as { location_id?: number | null }).location_id ?? null,
          venue_proposal: (s as { venue_proposal?: unknown }).venue_proposal || null,
          duration_type: durationType,
          event_date: toDateInput(s.starts_at),
          start_time: toTimeInput(s.starts_at),
          end_time: toTimeInput(s.ends_at || s.starts_at),
          starts_at: toDatetimeLocal(s.starts_at),
          ends_at: toDatetimeLocal(s.ends_at),
          ticket_types: ticketsForShow(event, s.id, i),
        };
      }) || [defaultVenue()],
  };
}

function CityLocationFields({
  index,
  readOnly,
  cities,
  labelClass,
  inputClass,
  errorClass,
}: {
  index: number;
  readOnly: boolean;
  cities: CityMaster[];
  labelClass: string;
  inputClass: string;
  errorClass: string;
}) {
  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EventFormValues>();
  const cityId = watch(`showtimes.${index}.city_id`);
  const [countryFilter, setCountryFilter] = useState("");

  const countries = useMemo(() => {
    const set = new Set<string>();
    for (const c of cities) {
      const country = (c.country || "").trim();
      if (country) set.add(country);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cities]);

  const filteredCities = useMemo(() => {
    return cities.filter((c) => {
      if (countryFilter && (c.country || "").trim() !== countryFilter) return false;
      return true;
    });
  }, [cities, countryFilter]);

  useEffect(() => {
    if (cityId == null) return;
    const selected = cities.find((c) => c.id === cityId);
    if (!selected) return;
    if (selected.country && !countryFilter) setCountryFilter(selected.country.trim());
  }, [cityId, cities]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
      <div>
        <label className={labelClass}>Country</label>
        <select
          disabled={readOnly}
          className={inputClass}
          value={countryFilter}
          onChange={(e) => {
            setCountryFilter(e.target.value);
            setValue(`showtimes.${index}.city_id`, null, { shouldDirty: true });
            setValue(`showtimes.${index}.location_id`, null, { shouldDirty: true });
          }}
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>City</label>
        <select
          disabled={readOnly}
          className={inputClass}
          value={cityId ?? ""}
          onChange={(e) => {
            const next = e.target.value === "" ? null : Number(e.target.value);
            setValue(`showtimes.${index}.city_id`, next, { shouldDirty: true, shouldValidate: true });
            setValue(`showtimes.${index}.location_id`, null, { shouldDirty: true });
            const selected = cities.find((c) => c.id === next);
            if (selected?.country) setCountryFilter(selected.country.trim());
          }}
        >
          <option value="">Select city</option>
          {filteredCities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.state ? `, ${c.state}` : ""}
              {c.country ? ` (${c.country})` : ""}
            </option>
          ))}
        </select>
        {errors.showtimes?.[index]?.city_id && (
          <p className={errorClass}>{errors.showtimes[index]?.city_id?.message}</p>
        )}
      </div>
    </div>
  );
}

function VenueNameSearchField({
  index,
  readOnly,
  labelClass,
  inputClass,
  errorClass,
  onAddNewVenue,
  onVenueSelected,
  onSearchAgain,
}: {
  index: number;
  readOnly: boolean;
  labelClass: string;
  inputClass: string;
  errorClass: string;
  onAddNewVenue: (name: string) => void;
  onVenueSelected: () => void;
  onSearchAgain: () => void;
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EventFormValues>();
  const cityId = watch(`showtimes.${index}.city_id`);
  const venueBusinessId = watch(`showtimes.${index}.venue_business_id`);
  const venueName = watch(`showtimes.${index}.venue_name`) || "";
  const [debouncedQ, setDebouncedQ] = useState("");
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(venueName.trim()), 250);
    return () => clearTimeout(t);
  }, [venueName]);

  const { data: allVenues = [], isFetching } = useSearchOrganizerVenuesQuery(
    { city_id: cityId ?? undefined },
    { skip: readOnly }
  );

  const venues = useMemo(
    () =>
      fuzzyFilter(allVenues, debouncedQ, ["name", "address", "city_name", "city_state"], {
        limit: 30,
        threshold: 0.45,
      }),
    [allVenues, debouncedQ]
  );

  const clearVenueSelection = () => {
    setValue(`showtimes.${index}.venue_business_id`, null, { shouldDirty: true });
    setValue(`showtimes.${index}.venue_source`, "manual", { shouldDirty: true });
    setValue(`showtimes.${index}.venue_layout_template_id`, null, { shouldDirty: true });
    const mode = watch(`showtimes.${index}.layout_mode`);
    if (mode === "standard") {
      setValue(`showtimes.${index}.layout_mode`, "none", { shouldDirty: true });
    }
  };

  const applyVenue = (venue: OrganizerVenueSearchResult) => {
    const verified =
      venue.is_partner_authorized !== false &&
      venue.partner_source !== "event_auto" &&
      venue.approval_status === "APPROVED";
    setValue(`showtimes.${index}.venue_business_id`, venue.id, { shouldDirty: true, shouldValidate: true });
    setValue(`showtimes.${index}.venue_source`, verified ? "registered" : "auto_registered", {
      shouldDirty: true,
    });
    setValue(`showtimes.${index}.venue_name`, venue.name, { shouldDirty: true, shouldValidate: true });
    setValue(`showtimes.${index}.venue_address`, venue.address || "", { shouldDirty: true });
    setValue(
      `showtimes.${index}.city_id`,
      venue.city_id != null ? venue.city_id : null,
      { shouldDirty: true, shouldValidate: true }
    );
    if (verified) {
      const hasPublished =
        Boolean(venue.default_layout_id) ||
        (typeof venue.published_layout_count === "number" && venue.published_layout_count > 0);
      if (hasPublished) {
        setValue(`showtimes.${index}.layout_mode`, "standard", { shouldDirty: true });
        setValue(
          `showtimes.${index}.venue_layout_template_id`,
          venue.default_layout_id || null,
          { shouldDirty: true }
        );
      }
    }
    setShowResults(false);
    onVenueSelected();
  };

  const { onChange: onVenueNameChange, ...venueNameReg } = register(`showtimes.${index}.venue_name`);

  return (
    <div>
      <label className={labelClass}>Venue name</label>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          disabled={readOnly}
          className={`${inputClass} pl-9`}
          placeholder="Search or type venue name — e.g. tagor hall"
          {...venueNameReg}
          onFocus={() => setShowResults(true)}
          onChange={(e) => {
            onVenueNameChange(e);
            if (venueBusinessId) clearVenueSelection();
            onSearchAgain();
            setShowResults(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setShowResults(false), 150);
          }}
        />
      </div>
      <p className="text-xs text-slate-500 mt-1">
        Search existing venues and select one. If not found, use Add venue to enter details.
      </p>
      {errors.showtimes?.[index]?.venue_name && (
        <p className={errorClass}>{errors.showtimes[index]?.venue_name?.message}</p>
      )}

      {venueBusinessId && !readOnly && (
        <button
          type="button"
          onClick={() => {
            clearVenueSelection();
            onSearchAgain();
            setShowResults(true);
          }}
          className="mt-1.5 text-xs text-slate-600 hover:text-rose-600"
        >
          Change venue
        </button>
      )}

      {showResults && !readOnly && debouncedQ.length >= 2 && !venueBusinessId && (
        <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
          {isFetching && <p className="px-3 py-2 text-xs text-slate-500">Searching…</p>}
          {!isFetching && venues.length === 0 && (
            <div className="px-3 py-3 space-y-2">
              <p className="text-xs text-slate-500">
                No matching venues for &quot;{debouncedQ}&quot;.
              </p>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onAddNewVenue(debouncedQ);
                  setShowResults(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700"
              >
                <Plus size={14} />
                Add &quot;{debouncedQ}&quot; as new venue
              </button>
            </div>
          )}
          {venues.map((v) => {
            const selected = venueBusinessId === v.id;
            const verified =
              v.is_partner_authorized !== false &&
              v.partner_source !== "event_auto" &&
              v.approval_status === "APPROVED";
            return (
              <button
                key={v.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyVenue(v)}
                className={`w-full text-left px-3 py-2 hover:bg-violet-50 transition-colors ${
                  selected ? "bg-violet-50" : ""
                }`}
              >
                <p className="text-sm font-medium text-slate-800">{v.name}</p>
                <p className="text-xs text-slate-500">
                  {[v.city_name, v.city_state].filter(Boolean).join(", ") || "City not set"}
                  {typeof v.published_layout_count === "number" && verified
                    ? ` · ${v.published_layout_count} published layout${v.published_layout_count === 1 ? "" : "s"}`
                    : ""}
                </p>
                <p className={`text-[11px] mt-0.5 ${verified ? "text-emerald-700" : "text-amber-700"}`}>
                  {verified ? "Verified partner" : "In system — not platform-authorized"}
                  {verified && v.default_layout_name ? ` · Default: ${v.default_layout_name}` : ""}
                </p>
              </button>
            );
          })}
          {!isFetching && venues.length > 0 && (
            <div className="px-3 py-2 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onAddNewVenue(debouncedQ);
                  setShowResults(false);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:text-violet-900"
              >
                <Plus size={13} />
                Not listed? Add &quot;{debouncedQ}&quot; as new venue
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SeatingLayoutFields({
  index,
  readOnly,
  labelClass,
  inputClass,
  errorClass,
}: {
  index: number;
  readOnly: boolean;
  labelClass: string;
  inputClass: string;
  errorClass: string;
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EventFormValues>();
  const venueSource = watch(`showtimes.${index}.venue_source`) || "manual";
  const venueBusinessId = watch(`showtimes.${index}.venue_business_id`);
  const isRegisteredPartner = venueSource === "registered" && Boolean(venueBusinessId);
  const layoutMode = watch(`showtimes.${index}.layout_mode`) || "none";
  const layoutId = watch(`showtimes.${index}.venue_layout_template_id`);

  const { data: layoutData, isFetching: layoutsFetching } = useGetOrganizerVenueLayoutsQuery(
    venueBusinessId!,
    {
      skip: readOnly || !venueBusinessId || !isRegisteredPartner,
    }
  );

  const selectedLayout = useMemo(
    () => (layoutData?.layouts || []).find((l) => l.id === layoutId) || null,
    [layoutData?.layouts, layoutId]
  );

  const {
    data: templateDetail,
    isLoading: templateLoading,
    isFetching: templateFetching,
    isError: templateError,
    error: templateErrorObj,
  } = useGetOrganizerVenueLayoutQuery(
    { businessId: venueBusinessId!, templateId: layoutId! },
    {
      skip:
        readOnly ||
        !venueBusinessId ||
        !layoutId ||
        !isRegisteredPartner ||
        layoutMode !== "standard",
    }
  );
  const showTemplateLoading = (templateLoading || templateFetching) && !templateDetail;

  /** Prefer default published layout when switching to Standard. */
  useEffect(() => {
    if (readOnly || !isRegisteredPartner || layoutMode !== "standard") return;
    if (layoutId) return;
    const layouts = layoutData?.layouts || [];
    if (!layouts.length) return;
    const preferred = layouts.find((l) => l.is_default) || layouts[0];
    if (preferred?.id) {
      setValue(`showtimes.${index}.venue_layout_template_id`, preferred.id, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [readOnly, isRegisteredPartner, layoutMode, layoutId, layoutData?.layouts, index, setValue]);

  /** Unregistered / auto venues cannot create layouts — customers book by ticket type (default). */
  useEffect(() => {
    if (isRegisteredPartner || readOnly) return;
    if (layoutMode !== "none") {
      setValue(`showtimes.${index}.layout_mode`, "none", { shouldDirty: true });
    }
    setValue(`showtimes.${index}.venue_layout_template_id`, null, { shouldDirty: true });
    setValue(`showtimes.${index}.custom_layout_name`, "", { shouldDirty: true });
    setValue(`showtimes.${index}.custom_layout_notes`, "", { shouldDirty: true });
    setValue(`showtimes.${index}.custom_layout_images` as never, [] as never, { shouldDirty: true });
  }, [isRegisteredPartner, readOnly, layoutMode, index, setValue]);

  const setLayoutMode = (next: "none" | "standard" | "custom") => {
    if (!isRegisteredPartner && next !== "none") return;
    setValue(`showtimes.${index}.layout_mode`, next, { shouldDirty: true, shouldValidate: true });
    if (next !== "standard") {
      setValue(`showtimes.${index}.venue_layout_template_id`, null, { shouldDirty: true });
    }
    if (next !== "custom") {
      setValue(`showtimes.${index}.custom_layout_name`, "", { shouldDirty: true });
      setValue(`showtimes.${index}.custom_layout_notes`, "", { shouldDirty: true });
    } else if (!watch(`showtimes.${index}.custom_layout_name`)) {
      const venueName = watch(`showtimes.${index}.venue_name`) || "Venue";
      setValue(`showtimes.${index}.custom_layout_name`, `${venueName} custom layout`, { shouldDirty: true });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div>
        <p className={labelClass}>Seating layout</p>
        <p className="text-xs text-slate-500 mb-2">
          {isRegisteredPartner
            ? "Optional. Choose a published venue layout, request a custom one, or skip for now."
            : "Layouts are only available for verified registered venues. New venues use the default booking flow — customers pick ticket types without a seat map."}
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className={`inline-flex items-center gap-2 ${!isRegisteredPartner ? "opacity-100" : ""}`}>
            <input
              type="radio"
              disabled={readOnly}
              checked={layoutMode === "none" || !isRegisteredPartner}
              onChange={() => setLayoutMode("none")}
            />
            None (default booking)
          </label>
          <label
            className={`inline-flex items-center gap-2 ${!isRegisteredPartner ? "opacity-50" : ""}`}
            title={!isRegisteredPartner ? "Only for verified registered venues" : undefined}
          >
            <input
              type="radio"
              disabled={readOnly || !isRegisteredPartner}
              checked={isRegisteredPartner && layoutMode === "standard"}
              onChange={() => setLayoutMode("standard")}
            />
            Standard (published layout)
          </label>
          <label
            className={`inline-flex items-center gap-2 ${!isRegisteredPartner ? "opacity-50" : ""}`}
            title={!isRegisteredPartner ? "Only for verified registered venues" : undefined}
          >
            <input
              type="radio"
              disabled={readOnly || !isRegisteredPartner}
              checked={isRegisteredPartner && layoutMode === "custom"}
              onChange={() => setLayoutMode("custom")}
            />
            Custom request
          </label>
        </div>
        {!isRegisteredPartner && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
            This venue is not a verified partner, so seating layouts cannot be created. Customers will book using the
            default ticket-type flow (no seat selection map).
          </p>
        )}
      </div>

      {isRegisteredPartner && layoutMode === "standard" && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Published layouts for this venue</label>
            <p className="text-xs text-slate-500 mb-2">
              Pick a layout below. Customers will use this seating map when booking (after you save the event).
            </p>
            {layoutsFetching && (
              <p className="text-xs text-slate-500 mb-2">Loading venue layouts…</p>
            )}
            {(layoutData?.layouts || []).length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-2 mb-2">
                {(layoutData?.layouts || []).map((l) => {
                  const active = layoutId === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      disabled={readOnly}
                      onClick={() =>
                        setValue(`showtimes.${index}.venue_layout_template_id`, l.id, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                        active
                          ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-200"
                          : "border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/40"
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                        {active ? <Check size={14} className="text-emerald-600 shrink-0" /> : null}
                        {l.name}
                        {l.is_default ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {l.capacity ? `${l.capacity} seats` : "Capacity not set"}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <select
              disabled={readOnly || !venueBusinessId}
              className={inputClass}
              value={layoutId || ""}
              onChange={(e) =>
                setValue(`showtimes.${index}.venue_layout_template_id`, e.target.value || null, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
            >
              <option value="">Select published layout</option>
              {(layoutData?.layouts || []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.is_default ? " (default)" : ""}
                  {l.capacity ? ` · ${l.capacity} seats` : ""}
                </option>
              ))}
            </select>
            {errors.showtimes?.[index]?.venue_layout_template_id && (
              <p className={errorClass}>{errors.showtimes[index]?.venue_layout_template_id?.message}</p>
            )}
          </div>

          {selectedLayout && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 space-y-3">
              <div>
                <p className="text-sm font-semibold text-emerald-900">{selectedLayout.name}</p>
                <p className="text-xs text-emerald-800">
                  {selectedLayout.capacity ? `${selectedLayout.capacity} seats · ` : ""}
                  Preview of this venue&apos;s published layout (read-only).
                </p>
              </div>
              {showTemplateLoading ? (
                <p className="text-xs text-emerald-800">Loading seating map…</p>
              ) : templateError ? (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  Could not load this seating map.
                  {" "}
                  {(templateErrorObj as { data?: { error?: string } })?.data?.error ||
                    "Try selecting the layout again."}
                </p>
              ) : (
                <VenueLayoutMapPreview
                  seats={templateDetail?.seats_json}
                  seatingConfig={
                    (templateDetail?.seating_config as Record<string, unknown> | null | undefined) ?? null
                  }
                  height={260}
                />
              )}
            </div>
          )}
          {!selectedLayout && (layoutData?.layouts || []).length === 0 && venueBusinessId && !layoutsFetching && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No published layouts for this venue yet. Ask the venue admin / Super Admin to publish one, or use
              None / Custom request.
            </p>
          )}
        </div>
      )}

      {isRegisteredPartner && layoutMode === "custom" && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Layout name</label>
            <input
              disabled={readOnly}
              className={inputClass}
              {...register(`showtimes.${index}.custom_layout_name`)}
              placeholder="Festival floor plan"
            />
            {errors.showtimes?.[index]?.custom_layout_name && (
              <p className={errorClass}>{errors.showtimes[index]?.custom_layout_name?.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Layout type</label>
            <select
              disabled={readOnly}
              className={inputClass}
              {...register(`showtimes.${index}.custom_layout_type`)}
            >
              <option value="custom">Custom</option>
              <option value="theater">Theater</option>
              <option value="banquet">Banquet</option>
              <option value="standing">Standing</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Expected capacity</label>
            <input
              disabled={readOnly}
              type="number"
              min={0}
              className={inputClass}
              {...register(`showtimes.${index}.custom_layout_capacity`, {
                setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
              })}
              placeholder="e.g. 500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Notes / requirements</label>
            <textarea
              disabled={readOnly}
              rows={2}
              className={inputClass}
              {...register(`showtimes.${index}.custom_layout_notes`)}
              placeholder="Sections, VIP areas, stage position, accessibility…"
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Reference images (URLs, one per line)</label>
            <textarea
              disabled={readOnly}
              rows={3}
              className={inputClass}
              placeholder="https://…/layout-ref-1.jpg"
              value={((watch(`showtimes.${index}.custom_layout_images`) as string[] | undefined) || []).join("\n")}
              onChange={(e) => {
                const urls = e.target.value
                  .split("\n")
                  .map((u) => u.trim())
                  .filter(Boolean);
                setValue(`showtimes.${index}.custom_layout_images` as never, urls as never, {
                  shouldDirty: true,
                });
              }}
            />
          </div>
          <p className="sm:col-span-2 text-xs text-slate-500">
            Saved with the draft. Submitted to the platform when you submit the event for approval.
          </p>
        </div>
      )}
    </div>
  );
}

function VenueBlock({
  index,
  readOnly,
  canRemove,
  onRemove,
  cities,
  hostingType = "single",
}: {
  index: number;
  readOnly: boolean;
  canRemove: boolean;
  onRemove: () => void;
  cities: CityMaster[];
  hostingType?: "single" | "tour";
}) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EventFormValues>();
  const {
    fields: ticketFields,
    append,
    remove,
  } = useFieldArray({ control, name: `showtimes.${index}.ticket_types` });

  const durationType =
    hostingType === "single" ? "ONE_DAY" : watch(`showtimes.${index}.duration_type`) || "ONE_DAY";

  useEffect(() => {
    if (hostingType === "single") {
      setValue(`showtimes.${index}.duration_type`, "ONE_DAY", { shouldDirty: true });
    }
  }, [hostingType, index, setValue]);

  const eventDate = watch(`showtimes.${index}.event_date`);
  const startTime = watch(`showtimes.${index}.start_time`);
  const endTime = watch(`showtimes.${index}.end_time`);
  const startsAt = watch(`showtimes.${index}.starts_at`);
  const endsAt = watch(`showtimes.${index}.ends_at`);
  const venueBusinessId = watch(`showtimes.${index}.venue_business_id`);
  const venueName = watch(`showtimes.${index}.venue_name`) || "";
  const venueAddress = watch(`showtimes.${index}.venue_address`) || "";
  const cityId = watch(`showtimes.${index}.city_id`);
  const venueSource = watch(`showtimes.${index}.venue_source`) || "manual";
  const [addingNewVenue, setAddingNewVenue] = useState(false);
  const [addModeInitialized, setAddModeInitialized] = useState(false);

  useEffect(() => {
    if (addModeInitialized) return;
    if (!venueBusinessId && venueName.trim() && (venueAddress.trim() || cityId != null)) {
      setAddingNewVenue(true);
    }
    setAddModeInitialized(true);
  }, [addModeInitialized, venueBusinessId, venueName, venueAddress, cityId]);

  const showManualVenueFields = addingNewVenue && !venueBusinessId;
  const isVerifiedSelected = Boolean(venueBusinessId && venueSource === "registered");
  /** City master is required; show when adding new venue, or when selected venue has no city yet. */
  const showCityFields =
    showManualVenueFields ||
    (Boolean(venueName.trim()) && cityId == null) ||
    (Boolean(venueBusinessId) && !isVerifiedSelected && cityId == null);
  const labelClass = "portal-label block text-sm font-semibold mb-1.5";
  const errorClass = "text-rose-600 text-xs mt-1";
  const inputClass = "input-field w-full";

  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">Venue {index + 1}</p>
        {!readOnly && canRemove && (
          <button type="button" onClick={onRemove} className="p-1.5 text-slate-400 hover:text-rose-600">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <VenueNameSearchField
            index={index}
            readOnly={readOnly}
            labelClass={labelClass}
            inputClass={inputClass}
            errorClass={errorClass}
            onAddNewVenue={(name) => {
              setValue(`showtimes.${index}.venue_name`, name, { shouldDirty: true, shouldValidate: true });
              setValue(`showtimes.${index}.venue_source`, "manual", { shouldDirty: true });
              setValue(`showtimes.${index}.venue_business_id`, null, { shouldDirty: true });
              setValue(`showtimes.${index}.city_id`, null, { shouldDirty: true });
              setAddingNewVenue(true);
            }}
            onVenueSelected={() => setAddingNewVenue(false)}
            onSearchAgain={() => setAddingNewVenue(false)}
          />
        </div>

        {venueBusinessId && (
          <div className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
            <p className="text-sm font-medium text-slate-800">{venueName}</p>
            {venueAddress && <p className="text-xs text-slate-600 mt-0.5">{venueAddress}</p>}
            <p className={`text-[11px] mt-1 ${isVerifiedSelected ? "text-emerald-700" : "text-amber-700"}`}>
              {isVerifiedSelected ? "Verified partner venue selected" : "Venue in system — not platform-authorized"}
            </p>
          </div>
        )}

        {showManualVenueFields && (
          <>
            <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2">
              <p className="text-sm font-semibold text-violet-900">
                Add new venue{venueName.trim() ? `: ${venueName.trim()}` : ""}
              </p>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setAddingNewVenue(false)}
                  className="text-xs text-slate-600 hover:text-rose-600 shrink-0"
                >
                  Cancel
                </button>
          )}
        </div>
            <div className="sm:col-span-2">
          <label className={labelClass}>Venue address</label>
              <input
                disabled={readOnly}
                className={inputClass}
                {...register(`showtimes.${index}.venue_address`)}
                placeholder="Full address"
              />
        </div>
          </>
        )}

        {showCityFields && (
          <div className="sm:col-span-2 space-y-1">
            {!showManualVenueFields && cityId == null && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Select city from the admin city master to continue.
              </p>
            )}
            <CityLocationFields
              index={index}
              readOnly={readOnly}
              cities={cities}
              labelClass={labelClass}
              inputClass={inputClass}
              errorClass={errorClass}
            />
          </div>
        )}
      </div>

      <SeatingLayoutFields
        index={index}
        readOnly={readOnly}
        labelClass={labelClass}
        inputClass={inputClass}
        errorClass={errorClass}
      />

      <div>
        <p className={labelClass}>Event schedule</p>
        {hostingType === "tour" ? (
          <div className="flex flex-wrap gap-4 text-sm mb-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                disabled={readOnly}
                checked={durationType === "ONE_DAY"}
                onChange={() => setValue(`showtimes.${index}.duration_type`, "ONE_DAY", { shouldDirty: true })}
              />
              One day stop
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                disabled={readOnly}
                checked={durationType === "MULTI_DAY"}
                onChange={() => setValue(`showtimes.${index}.duration_type`, "MULTI_DAY", { shouldDirty: true })}
              />
              Multiple day stop
            </label>
          </div>
        ) : (
          <p className="text-xs text-slate-500 mb-3">
            Single events use one date with start and end time. Duration is calculated automatically for customers.
          </p>
        )}
      </div>

      {durationType === "ONE_DAY" ? (
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Date (mm-dd-yyyy)</label>
            <input disabled={readOnly} type="date" className={inputClass} {...register(`showtimes.${index}.event_date`)} />
            {eventDate && <p className="text-xs text-slate-600 mt-1">{formatDate(eventDate)}</p>}
          </div>
          <div>
            <label className={labelClass}>Start time</label>
            <input disabled={readOnly} type="time" className={inputClass} {...register(`showtimes.${index}.start_time`)} />
            {startTime && eventDate && (
              <p className="text-xs text-slate-600 mt-1">{formatTime12h(`${eventDate}T${startTime}`)}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>End time</label>
            <input disabled={readOnly} type="time" className={inputClass} {...register(`showtimes.${index}.end_time`)} />
            {endTime && eventDate && (
              <p className="text-xs text-slate-600 mt-1">{formatTime12h(`${eventDate}T${endTime}`)}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Start date & time</label>
            <input disabled={readOnly} type="datetime-local" className={inputClass} {...register(`showtimes.${index}.starts_at`)} />
            {startsAt && <p className="text-xs text-slate-600 mt-1">{formatDateTime12h(startsAt)}</p>}
          </div>
          <div>
            <label className={labelClass}>End date & time</label>
            <input disabled={readOnly} type="datetime-local" className={inputClass} {...register(`showtimes.${index}.ends_at`)} />
            {endsAt && <p className="text-xs text-slate-600 mt-1">{formatDateTime12h(endsAt)}</p>}
          </div>
        </div>
      )}

      <div className="space-y-3 pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Ticket types for this venue</p>
          {!readOnly && (
            <button
              type="button"
              onClick={() => append({ ticket_type: "", total_count: 100, price: 0, max_per_order: 10 })}
              className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
            >
              <Plus size={14} /> Add type
            </button>
          )}
        </div>
        {ticketFields.map((field, ti) => (
          <div key={field.id} className="grid sm:grid-cols-5 gap-3 items-start">
            <div className="sm:col-span-2">
              <label className={labelClass}>Type name</label>
              <input
                disabled={readOnly}
                className={inputClass}
                {...register(`showtimes.${index}.ticket_types.${ti}.ticket_type`)}
                placeholder="General, VIP..."
              />
            </div>
            <div>
              <label className={labelClass}>Total seats</label>
              <input
                disabled={readOnly}
                type="number"
                min={1}
                className={inputClass}
                {...register(`showtimes.${index}.ticket_types.${ti}.total_count`, { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className={labelClass}>Max / order</label>
              <input
                disabled={readOnly}
                type="number"
                min={1}
                className={inputClass}
                {...register(`showtimes.${index}.ticket_types.${ti}.max_per_order`, { valueAsNumber: true })}
                title="Maximum tickets of this type a customer can buy in one purchase"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={labelClass}>Price (ETB)</label>
                <input
                  disabled={readOnly}
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  {...register(`showtimes.${index}.ticket_types.${ti}.price`, { valueAsNumber: true })}
                />
              </div>
              {!readOnly && ticketFields.length > 1 && (
                <button type="button" onClick={() => remove(ti)} className="p-2.5 text-slate-400 hover:text-rose-600 self-end">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArtistBlock({
  index,
  readOnly,
  onRemove,
}: {
  index: number;
  readOnly: boolean;
  onRemove: () => void;
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<EventFormValues>();
  const businessId = watch(`artists.${index}.artist_business_id`);
  const personName = watch(`artists.${index}.name`) || "";
  const imageUrl = watch(`artists.${index}.image_url`) || "";
  const artistSource = watch(`artists.${index}.artist_source`) || "external";
  const lineupRole = normalizeLineupRole(watch(`artists.${index}.role_title`));
  const isArtistRole = isArtistLineupRole(lineupRole);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();
  const labelClass = "portal-label block text-sm font-semibold mb-1.5";
  const errorClass = "text-rose-600 text-xs mt-1";
  const inputClass = "input-field w-full";
  const isRegistered = Boolean(businessId) && artistSource === "registered";

  const roleLabels = {
    Artist: {
      card: `Artist ${index + 1}`,
      name: "Artist name",
      namePlaceholder: "Search or type artist name",
      nameHelp: "Select an existing artist from results, or type a new name to auto-register on save.",
      picture: "Artist picture",
      pictureHelpRegistered: "Photo loaded from the registered artist profile. You can replace it for this event.",
      pictureHelpManual: "Not registered yet — upload a picture manually for the lineup.",
      descriptionPlaceholder: "Optional bio or notes",
      autoRegisterNote:
        "This artist will be auto-registered when you save. Customers will see a small note that they are not platform-authorized. Add a picture below if you have one.",
    },
    Guest: {
      card: `Guest ${index + 1}`,
      name: "Guest name",
      namePlaceholder: "Enter guest name",
      nameHelp: "Guests are listed on this event only — they are not registered as platform artists.",
      picture: "Guest picture",
      pictureHelpRegistered: "",
      pictureHelpManual: "Upload a picture for the guest (optional).",
      descriptionPlaceholder: "Optional short intro for the guest",
      autoRegisterNote: "",
    },
    "Chief Guest": {
      card: `Chief Guest ${index + 1}`,
      name: "Chief guest name",
      namePlaceholder: "Enter chief guest name",
      nameHelp: "Chief guests are listed on this event only — they are not registered as platform artists.",
      picture: "Chief guest picture",
      pictureHelpRegistered: "",
      pictureHelpManual: "Upload a picture for the chief guest (optional).",
      descriptionPlaceholder: "Optional short intro for the chief guest",
      autoRegisterNote: "",
    },
  } as const;
  const copy = roleLabels[lineupRole];

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(personName.trim()), 250);
    return () => clearTimeout(t);
  }, [personName]);

  const { data: allPartners = [], isFetching } = useSearchOrganizerArtistsQuery(undefined, {
    skip: readOnly || !isArtistRole,
  });

  const partners = useMemo(
    () => fuzzyFilter(allPartners, debouncedQ, ["name", "description", "type_name", "city_name"], { limit: 25 }),
    [allPartners, debouncedQ]
  );

  const clearArtistSelection = () => {
    setValue(`artists.${index}.artist_business_id`, null, { shouldDirty: true });
    setValue(`artists.${index}.artist_source`, "external", { shouldDirty: true });
  };

  const onLineupRoleChange = (next: string) => {
    const role = normalizeLineupRole(next);
    setValue(`artists.${index}.role_title`, role, { shouldDirty: true, shouldValidate: true });
    if (role !== "Artist") {
      clearArtistSelection();
      setShowResults(false);
    }
  };

  const applyPartner = (artist: OrganizerArtistSearchResult) => {
    const verified =
      artist.is_partner_authorized !== false && artist.partner_source !== "event_auto";
    setValue(`artists.${index}.artist_business_id`, artist.id, { shouldDirty: true, shouldValidate: true });
    setValue(`artists.${index}.artist_source`, verified ? "registered" : "auto_registered", {
      shouldDirty: true,
    });
    setValue(`artists.${index}.name`, artist.name, { shouldDirty: true, shouldValidate: true });
    setValue(`artists.${index}.description`, artist.description || "", { shouldDirty: true });
    setValue(`artists.${index}.image_url`, artist.cover_image_url || "", { shouldDirty: true });
    setShowResults(false);
  };

  const uploadPersonPhoto = async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await uploadImage(formData).unwrap();
      if (res.url) {
        setValue(`artists.${index}.image_url`, res.url, { shouldDirty: true });
      }
    } catch {
      toast.error("Failed to upload picture");
    }
  };

  const { onChange: onPersonNameChange, ...personNameReg } = register(`artists.${index}.name`);

  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">{copy.card}</p>
        {!readOnly && (
          <button type="button" onClick={onRemove} className="p-1.5 text-slate-400 hover:text-rose-600">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={labelClass}>
            Add as <span className="text-rose-500">*</span>
          </label>
          <select
            disabled={readOnly}
            className={inputClass}
            value={lineupRole}
            onChange={(e) => onLineupRoleChange(e.target.value)}
          >
            {EVENT_LINEUP_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          {errors.artists?.[index]?.role_title && (
            <p className={errorClass}>{errors.artists[index]?.role_title?.message}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>
            {copy.name} <span className="text-rose-500">*</span>
          </label>
          {isArtistRole ? (
            <>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  disabled={readOnly}
                  className={`${inputClass} pl-9`}
                  placeholder={copy.namePlaceholder}
                  {...personNameReg}
                  onFocus={() => setShowResults(true)}
                  onChange={(e) => {
                    onPersonNameChange(e);
                    if (businessId) clearArtistSelection();
                    setShowResults(true);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setShowResults(false), 150);
                  }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">{copy.nameHelp}</p>
              {businessId && !readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    clearArtistSelection();
                    setShowResults(true);
                  }}
                  className="mt-1.5 text-xs text-slate-600 hover:text-rose-600"
                >
                  Clear selection — add as new artist
                </button>
              )}
              {showResults && !readOnly && debouncedQ.length >= 2 && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm">
                  {isFetching && <p className="px-3 py-2 text-xs text-slate-500">Searching…</p>}
                  {!isFetching && partners.length === 0 && (
                    <p className="px-3 py-2 text-xs text-slate-500">
                      No matches — continue to add &quot;{debouncedQ}&quot; as a new artist.
                    </p>
                  )}
                  {partners.map((a) => {
                    const verified =
                      a.is_partner_authorized !== false && a.partner_source !== "event_auto";
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => applyPartner(a)}
                        className={`w-full text-left px-3 py-2 hover:bg-violet-50 flex items-center gap-3 ${
                          businessId === a.id ? "bg-violet-50" : ""
                        }`}
                      >
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-slate-200 shrink-0">
                          {a.cover_image_url ? (
                            <img src={a.cover_image_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-sm font-bold text-slate-500">
                              {a.name.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800">{a.name}</p>
                          <p className="text-xs text-slate-500">
                            {[a.type_name, a.city_name].filter(Boolean).join(" · ") || "Artist"}
                          </p>
                          <p className={`text-[11px] ${verified ? "text-emerald-700" : "text-amber-700"}`}>
                            {verified ? "Verified partner" : "In system — not platform-authorized"}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <input
                disabled={readOnly}
                className={inputClass}
                placeholder={copy.namePlaceholder}
                {...personNameReg}
                onChange={onPersonNameChange}
              />
              <p className="text-xs text-slate-500 mt-1">{copy.nameHelp}</p>
            </>
          )}
          {errors.artists?.[index]?.name && (
            <p className={errorClass}>{errors.artists[index]?.name?.message}</p>
          )}
        </div>

        {isArtistRole && !businessId && copy.autoRegisterNote && (
          <p className="sm:col-span-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {copy.autoRegisterNote}
          </p>
        )}

        <div className="sm:col-span-2">
          <label className={labelClass}>
            {copy.picture}{" "}
            {isArtistRole && isRegistered ? (
              <span className="text-slate-400 font-normal">(from profile)</span>
            ) : null}
          </label>
          <CroppedImageField
            value={imageUrl}
            aspect={1}
            disabled={readOnly || uploading}
            previewClassName="w-28 h-28 rounded-xl"
            emptyClassName="flex flex-col items-center justify-center h-28 w-28 rounded-xl border border-dashed border-slate-300 hover:border-violet-400"
            onRemove={() => setValue(`artists.${index}.image_url`, "", { shouldDirty: true })}
            onCroppedFile={(file) => void uploadPersonPhoto(file)}
            emptyContent={
              <>
                <ImagePlus className="text-slate-400 mb-1" size={22} />
                <span className="text-[10px] portal-muted text-center px-1">
                  {isArtistRole && isRegistered ? "Add / replace photo" : "Upload photo"}
                </span>
              </>
            }
          />
          <p className="text-xs text-slate-500 mt-1">
            {isArtistRole && isRegistered ? copy.pictureHelpRegistered : copy.pictureHelpManual}
          </p>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Short description</label>
          <textarea
            disabled={readOnly}
            rows={2}
            className={inputClass}
            {...register(`artists.${index}.description`)}
            placeholder={copy.descriptionPlaceholder}
          />
        </div>
      </div>
    </div>
  );
}

interface EventFormProps {
  event?: OrganizerEvent | null;
  readOnly?: boolean;
  canSubmit?: boolean;
  onSaveDraft: (payload: EventFormPayload) => Promise<void>;
  onSubmitForApproval: (payload: EventFormPayload) => Promise<void>;
  saving?: boolean;
  submitting?: boolean;
}

export default function EventForm({
  event,
  readOnly = false,
  canSubmit = !event || event.status === "DRAFT",
  onSaveDraft,
  onSubmitForApproval,
  saving = false,
  submitting = false,
}: EventFormProps) {
  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const { data: cities = [] } = useGetCitiesQuery();
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();
  const [documents, setDocuments] = useState<EventDocumentUpload[]>(() =>
    normalizeFormDocuments(event?.documents)
  );
  const initialTerms = parseEventTerms(event?.terms_points);
  const [selectedTerms, setSelectedTerms] = useState(initialTerms.selected);
  const [customTerms, setCustomTerms] = useState<string[]>(initialTerms.custom);
  const [customTermDraft, setCustomTermDraft] = useState("");
  const [hostingType, setHostingType] = useState<"single" | "tour">(
    (event?.showtimes?.length || 0) > 1 ? "tour" : "single"
  );
  const [stepId, setStepId] = useState<EventStepperStepId>(event ? "details" : "type");
  const [visitedSteps, setVisitedSteps] = useState<EventStepperStepId[]>(() =>
    event ? EVENT_STEPPER_STEPS.map((s) => s.id) : []
  );

  const categories = useMemo(
    () => businessTypes.filter((t) => t.module_key === "event" && t.parent_type_id),
    [businessTypes]
  );

  const methods = useForm<EventFormValues>({
    defaultValues: eventToValues(event),
    resolver: yupResolver(eventDraftSchema),
    mode: "onBlur",
  });
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    getValues,
    trigger,
    formState: { errors },
  } = methods;

  const categoryTypeId = watch("category_type_id");
  const genres = watch("genres") || [];
  const languages = watch("languages") || [];
  const posterHorizontal = watch("poster_horizontal_url");
  const posterVertical = watch("poster_vertical_url");
  const galleryImages = watch("gallery_images") || [];
  const allowedTicketModes = watch("allowed_ticket_modes") || [];
  const watchedValues = watch();

  const { data: masters, isLoading: mastersLoading } = useGetEventMastersQuery(categoryTypeId!, {
    skip: !categoryTypeId,
  });

  const completedStepIds = useMemo(() => {
    return getCompletedEventStepIds({
      hostingType,
      values: watchedValues,
      documents,
      requiredDocumentIds: (masters?.documents || []).filter((d) => d.is_required).map((d) => d.id),
      genresConfigured: (masters?.genres?.length || 0) > 0,
    });
  }, [hostingType, watchedValues, documents, masters?.documents, masters?.genres]);

  const toggleTicketMode = (mode: TicketDeliveryMode) => {
    if (readOnly) return;
    const current = getValues("allowed_ticket_modes") || [];
    const next = current.includes(mode)
      ? current.filter((m) => m !== mode)
      : [...current, mode];
    setValue("allowed_ticket_modes", next, { shouldDirty: true, shouldValidate: true });
  };

  const {
    fields: showtimeFields,
    append: appendShowtime,
    remove: removeShowtime,
  } = useFieldArray({ control, name: "showtimes" });

  const {
    fields: artistFields,
    append: appendArtist,
    remove: removeArtist,
  } = useFieldArray({ control, name: "artists" });

  useEffect(() => {
    if (event) {
      reset(eventToValues(event));
      setDocuments(normalizeFormDocuments(event.documents));
      const terms = parseEventTerms(event.terms_points);
      setSelectedTerms(terms.selected);
      setCustomTerms(terms.custom);
    }
  }, [event?.id, event?.updated_at, reset, event]);

  useEffect(() => {
    if (!masters?.genres?.length) return;
    const allowed = new Set(masters.genres.map((g) => g.name));
    const current = getValues("genres") || [];
    const filtered = current.filter((g) => allowed.has(g));
    if (filtered.length !== current.length) {
      setValue("genres", filtered);
    }
  }, [categoryTypeId, masters?.genres, getValues, setValue]);

  const buildPayload = (values: EventFormValues, opts?: { forDraft?: boolean }): EventFormPayload => {
    const draftMode = opts?.forDraft === true;
    const rawShowtimes = values.showtimes || [];
    const persistableShowtimes = draftMode
      ? rawShowtimes.filter(isShowtimePersistable)
      : rawShowtimes;
    const showtimes = persistableShowtimes.map((s, stopIndex) => {
      const range = showtimeToIso(s);
      const venueSource =
        s.venue_business_id && s.venue_source === "registered"
          ? "registered"
          : s.venue_business_id && s.venue_source === "auto_registered"
            ? "auto_registered"
            : "manual";
      const canUseLayouts = venueSource === "registered" && Boolean(s.venue_business_id);
      const layoutMode =
        canUseLayouts && (s.layout_mode === "standard" || s.layout_mode === "custom")
          ? s.layout_mode
          : "none";
      const originalIndex = rawShowtimes.indexOf(s);
      const stopOrderIndex = originalIndex >= 0 ? originalIndex : stopIndex;
      return {
        venue_name: s.venue_name.trim() || (draftMode ? "Venue TBD" : s.venue_name.trim()),
        venue_address: s.venue_address?.trim() || "",
        city_id: s.city_id ?? null,
        venue_source: venueSource as "manual" | "registered" | "auto_registered",
        venue_business_id: s.venue_business_id || null,
        venue_layout_template_id: layoutMode === "standard" ? s.venue_layout_template_id || null : null,
        layout_mode: layoutMode as "none" | "standard" | "custom",
        custom_layout_name: layoutMode === "custom" ? s.custom_layout_name?.trim() || null : null,
        custom_layout_type: layoutMode === "custom" ? s.custom_layout_type?.trim() || "custom" : null,
        custom_layout_capacity:
          layoutMode === "custom" && s.custom_layout_capacity != null
            ? Number(s.custom_layout_capacity)
            : null,
        custom_layout_notes: layoutMode === "custom" ? s.custom_layout_notes?.trim() || null : null,
        custom_layout_images:
          layoutMode === "custom" && Array.isArray(s.custom_layout_images)
            ? s.custom_layout_images.filter(Boolean)
            : [],
        location_id: null,
        tour_stop_order: hostingType === "tour" ? stopOrderIndex : null,
        venue_proposal: null,
        starts_at: range.starts_at,
        ends_at: range.ends_at,
        duration_type:
          hostingType === "single"
            ? "ONE_DAY"
            : ((s.duration_type === "MULTI_DAY" ? "MULTI_DAY" : "ONE_DAY") as "ONE_DAY" | "MULTI_DAY"),
        ticket_types: (s.ticket_types || []).map((t) => ({
          ticket_type: t.ticket_type.trim(),
          total_count: Number(t.total_count),
          price: Number(t.price),
          max_per_order: Math.max(1, Number(t.max_per_order) || 10),
        })),
      };
    });
    const ticket_types = showtimes.flatMap((s) => s.ticket_types);
    const draftArtists = (values.artists || []).filter((a) => a.name?.trim());
    const payload: EventFormPayload = {
      name: values.name.trim() || (draftMode ? "Untitled Event" : values.name.trim()),
      category_type_id: values.category_type_id,
      genres: values.genres || [],
      poster_horizontal_url: values.poster_horizontal_url || "",
      poster_vertical_url: values.poster_vertical_url || "",
      gallery_images: values.gallery_images || [],
      youtube_url: values.youtube_url?.trim() || "",
      documents: documents.filter((d) => d.document_type_id > 0 && d.url?.trim()),
      languages: values.languages || [],
      language: (values.languages || []).join(", "),
      about_event: values.about_event.trim(),
      age_group: values.age_group || "",
      duration_minutes: computeDurationMinutesFromShowtimes(values.showtimes) ?? values.duration_minutes ?? null,
      terms_points: {
        selected: selectedTerms,
        custom: customTerms.map((t) => t.trim()).filter(Boolean),
      },
      allowed_ticket_modes: normalizeAllowedTicketModes(values.allowed_ticket_modes),
      ticket_types,
      hosting_type: hostingType,
      tour_id: (event as { tour_id?: string | null } | undefined)?.tour_id || null,
      tour:
        hostingType === "tour"
          ? {
              id: (event as { tour_id?: string | null } | undefined)?.tour_id || null,
              name: values.name.trim() || "Untitled Event",
              description: values.about_event?.trim() || null,
              category_type_id: values.category_type_id,
              main_artist_name: null,
              poster_url: values.poster_horizontal_url || null,
            }
          : null,
      artists: (draftMode ? draftArtists : values.artists || []).map((a, i) => {
        const role = normalizeLineupRole(a.role_title);
        const isArtist = isArtistLineupRole(role);
        const source = isArtist
          ? a.artist_source === "registered"
            ? "registered"
            : a.artist_source === "auto_registered"
              ? "auto_registered"
              : "external"
          : "external";
        return {
          artist_source: source as "registered" | "external" | "auto_registered",
          artist_business_id:
            isArtist && (source === "registered" || source === "auto_registered")
              ? a.artist_business_id || null
              : null,
          name: a.name.trim(),
          role_title: role,
          description: a.description?.trim() || null,
          image_url: a.image_url?.trim() || null,
          documents: Array.isArray(a.documents) ? a.documents : [],
          auto_register_artist: isArtist && source === "external",
          sort_order: i,
        };
      }),
      showtimes,
    };
    return payload;
  };

  const toggleMasterTerm = (term: { id: number; text: string }) => {
    setSelectedTerms((prev) => {
      if (prev.some((t) => t.id === term.id)) return prev.filter((t) => t.id !== term.id);
      return [...prev, { id: term.id, text: term.text }];
    });
  };

  const addCustomTerm = () => {
    const text = customTermDraft.trim();
    if (!text) {
      toast.error("Enter a terms & conditions point");
      return;
    }
    if (customTerms.some((t) => t.toLowerCase() === text.toLowerCase())) {
      toast.error("That point is already added");
      return;
    }
    setCustomTerms((prev) => [...prev, text]);
    setCustomTermDraft("");
  };

  const validateMasters = (forSubmit: boolean) => {
    if (!forSubmit || !masters) return null;
    if (masters.genres.length > 0 && (!genres || genres.length === 0)) {
      return "Select at least one genre for this category.";
    }
    const requiredDocs = masters.documents.filter((d) => d.is_required);
    return validateRequiredDocuments(
      documents.filter((d) => d.document_type_id > 0),
      requiredDocs.map((d) => d.id),
      Object.fromEntries(requiredDocs.map((d) => [d.id, d.name]))
    );
  };

  const runSaveDraft = async () => {
    const values = getValues();
    const youtube = values.youtube_url?.trim();
    if (youtube) {
      try {
        await eventDraftSchema.validateAt("youtube_url", values);
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "message" in e ? String((e as Error).message) : "Invalid YouTube link";
        toast.error(msg);
        return;
      }
    }
    const payload = buildPayload(values, { forDraft: true });
    try {
      await onSaveDraft(payload);
    } catch (e) {
      toast.error(extractApiError(e, "Failed to save draft"));
    }
  };

  const runSubmit = async (values: EventFormValues) => {
    try {
      await eventSubmitSchema.validate(values, { abortEarly: true });
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as Error).message) : "Validation failed";
      toast.error(msg);
      return;
    }
    const masterErr = validateMasters(true);
    if (masterErr) {
      toast.error(masterErr);
      return;
    }
    const payload = buildPayload(values);
    try {
      await onSubmitForApproval(payload);
    } catch (e) {
      toast.error(extractApiError(e, "Failed to submit event"));
    }
  };

  const uploadCropped = async (file: File, onUrl: (url: string) => void) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await uploadImage(formData).unwrap();
      if (res.url) onUrl(res.url);
    } catch {
      toast.error(`Failed to upload ${file.name}`);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, documentTypeId: number) => {
    if (!e.target.files?.length || readOnly) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await uploadImage(formData).unwrap();
      if (res.url) {
        setDocuments((prev) => [
          ...prev.filter((d) => d.document_type_id !== documentTypeId),
          { document_type_id: documentTypeId, url: res.url },
        ]);
      }
    } catch {
      toast.error(`Failed to upload ${file.name}`);
    }
    e.target.value = "";
  };

  const toggleGenre = (name: string) => {
    if (readOnly) return;
    const next = genres.includes(name) ? genres.filter((g) => g !== name) : [...genres, name];
    setValue("genres", next, { shouldDirty: true });
  };

  const toggleLanguage = (name: string) => {
    if (readOnly) return;
    const next = languages.includes(name) ? languages.filter((l) => l !== name) : [...languages, name];
    setValue("languages", next, { shouldDirty: true });
  };

  const statusBanner = () => {
    if (!event?.status) return null;
    if (event.status === "PENDING_APPROVAL") {
      return (
        <div className="portal-banner-warning rounded-xl border p-4 flex gap-3 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <p className="font-medium">
            Submitted for Super Admin review. You can still edit details until it is approved.
          </p>
        </div>
      );
    }
    if (event.rejection_reason) {
      return (
        <div className="portal-banner-error rounded-xl border p-4 flex gap-3 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Event was rejected</p>
            <p className="mt-1">{event.rejection_reason}</p>
            <p className="portal-muted mt-2 text-xs">Update the details below and submit again.</p>
          </div>
        </div>
      );
    }
    if (event.status === "APPROVED" || event.status === "LIVE") {
      return (
        <div className="portal-banner-success rounded-xl border p-4 text-sm font-medium">
          This event is {event.status === "LIVE" ? "live" : "approved"}. Details are read-only here.
        </div>
      );
    }
    return null;
  };

  const labelClass = "portal-label block text-sm font-semibold mb-1.5";
  const errorClass = "text-rose-600 text-xs mt-1";
  const inputClass = "input-field w-full";

  const stepIndex = EVENT_STEPPER_STEPS.findIndex((s) => s.id === stepId);
  const isFirstStep = stepIndex <= 0;
  const isLastStep = stepId === "review";

  const markVisited = (id: EventStepperStepId) => {
    setVisitedSteps((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const goToStep = (id: EventStepperStepId) => {
    markVisited(stepId);
    setStepId(id);
  };

  const validateCurrentStep = async (): Promise<boolean> => {
    if (stepId === "type") {
      if (!hostingType) {
        toast.error("Choose Single Event or Tour to continue.");
        return false;
      }
      return true;
    }
    if (stepId === "details") {
      const ok = await trigger([
        "name",
        "category_type_id",
        "genres",
        "languages",
        "age_group",
        "about_event",
        "allowed_ticket_modes",
      ]);
      if (!ok) {
        toast.error("Please complete the required event details.");
        return false;
      }
      const values = getValues();
      if (!values.name?.trim()) {
        toast.error("Event name is required.");
        return false;
      }
      if (!values.category_type_id) {
        toast.error("Event category is required.");
        return false;
      }
      if (masters?.genres?.length && !(values.genres || []).length) {
        toast.error("Select at least one genre for this category.");
        return false;
      }
      if (!(values.languages || []).length) {
        toast.error("Select at least one language.");
        return false;
      }
      if (!(values.allowed_ticket_modes || []).length) {
        toast.error("Select at least one ticket delivery mode for customers.");
        return false;
      }
      return true;
    }
    if (stepId === "media") {
      const ok = await trigger(["poster_horizontal_url", "youtube_url"]);
      if (!ok || !getValues("poster_horizontal_url")?.trim()) {
        toast.error("Horizontal poster is required.");
        return false;
      }
      return true;
    }
    if (stepId === "venue") {
      const ok = await trigger(["showtimes"]);
      if (!ok) {
        toast.error("Please complete venue, city, schedule, and ticket details.");
        return false;
      }
      try {
        await eventSubmitSchema.validateAt("showtimes", getValues());
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "message" in e
            ? String((e as Error).message)
            : "Venue / ticket details are incomplete.";
        toast.error(msg);
        return false;
      }
      return true;
    }
    if (stepId === "artists") {
      const artists = getValues("artists") || [];
      if (!artists.length) return true;
      const ok = await trigger(["artists"]);
      if (!ok) {
        toast.error("Please complete artist details or remove incomplete entries.");
        return false;
      }
      try {
        await eventSubmitSchema.validateAt("artists", getValues());
      } catch (e: unknown) {
        const msg =
          e && typeof e === "object" && "message" in e
            ? String((e as Error).message)
            : "Artist details are incomplete.";
        toast.error(msg);
        return false;
      }
      return true;
    }
    if (stepId === "documents") {
      const masterErr = validateMasters(true);
      if (masterErr) {
        toast.error(masterErr);
        return false;
      }
      return true;
    }
    return true;
  };

  const goNext = async () => {
    const ok = await validateCurrentStep();
    if (!ok) return;
    markVisited(stepId);
    const next = EVENT_STEPPER_STEPS[stepIndex + 1];
    if (next) setStepId(next.id);
  };

  const goBack = () => {
    const prev = EVENT_STEPPER_STEPS[stepIndex - 1];
    if (prev) setStepId(prev.id);
  };

  const cityName = (id: number | null | undefined) =>
    cities.find((c) => c.id === id)?.name || "City not set";

  return (
    <FormProvider {...methods}>
      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        {statusBanner()}

        <EventStepperNav
          currentId={stepId}
          completedIds={completedStepIds}
          allowJump
          onStepClick={(id) => {
            goToStep(id);
          }}
        />

        {stepId === "type" && (
          <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-5">
            <div>
              <h3 className="portal-heading text-lg font-semibold">What would you like to host?</h3>
              <p className="portal-muted text-sm mt-1">
                Choose how this listing is structured. You can still save a draft at any later step.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  setHostingType("single");
                  const rows = getValues("showtimes") || [];
                  rows.forEach((_, i) => {
                    setValue(`showtimes.${i}.duration_type`, "ONE_DAY", { shouldDirty: true });
                  });
                }}
                className={`text-left rounded-2xl border p-5 transition-all ${
                  hostingType === "single"
                    ? "border-violet-500 bg-violet-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-violet-300"
                }`}
              >
                <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 inline-flex items-center justify-center mb-3">
                  <CalendarDays size={20} />
                </div>
                <p className="font-semibold text-slate-900">Single Event</p>
                <p className="text-sm text-slate-500 mt-1">
                  One concert, comedy show, sports match, or other event at one or more venues.
                </p>
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setHostingType("tour")}
                className={`text-left rounded-2xl border p-5 transition-all ${
                  hostingType === "tour"
                    ? "border-violet-500 bg-violet-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-violet-300"
                }`}
              >
                <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 inline-flex items-center justify-center mb-3">
                  <MapPin size={20} />
                </div>
                <p className="font-semibold text-slate-900">Tour</p>
                <p className="text-sm text-slate-500 mt-1">
                  Multiple city stops under one tour. For now, add each stop as a venue in the Venue step.
                </p>
              </button>
            </div>
            {hostingType === "tour" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1">
                <p className="font-medium">Tour mode</p>
                <p>
                  Saving creates/updates a <strong>tour</strong> record and links this event as its stop list.
                  Add each city stop in the Venue step (order is preserved).
                </p>
              </div>
            )}
          </section>
        )}

        {stepId === "details" && (
        <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-5">
          <h3 className="portal-heading text-lg font-semibold">Basic details</h3>

          <div>
            <label className={labelClass}>Event name <span className="text-rose-500">*</span></label>
            <input disabled={readOnly} {...register("name")} placeholder="e.g. Stand-up Comedy Night" className={inputClass} />
            {errors.name && <p className={errorClass}>{errors.name.message}</p>}
          </div>

          <div>
            <label className={labelClass}>Category <span className="text-rose-500">*</span></label>
            <select
              disabled={readOnly}
              className={inputClass}
              value={categoryTypeId ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setValue("category_type_id", val, { shouldDirty: true });
                setValue("genres", []);
                setDocuments([]);
              }}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.category_type_id && <p className={errorClass}>{errors.category_type_id.message}</p>}
          </div>

          <p className="text-xs text-slate-500 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            Event duration is calculated automatically from venue start and end times and shown to customers.
          </p>

          <div>
            <label className={labelClass}>
              Genres {masters?.genres?.length ? <span className="text-rose-500">*</span> : null}
            </label>
            {!categoryTypeId ? (
              <p className="portal-muted text-sm">Select a category to see available genres.</p>
            ) : mastersLoading ? (
              <p className="portal-muted text-sm">Loading genres...</p>
            ) : masters?.genres?.length ? (
              <div className="flex flex-wrap gap-2">
                {masters.genres.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleGenre(g.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      genres.includes(g.name)
                        ? "bg-violet-500/20 text-violet-700 border-violet-500/40"
                        : "portal-muted border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-amber-700 text-sm">No genres configured. Ask Super Admin to add genres.</p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Languages <span className="text-rose-500">*</span></label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleLanguage(l)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      languages.includes(l)
                        ? "bg-violet-500/20 text-violet-700 border-violet-500/40"
                        : "portal-muted border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {errors.languages && <p className={errorClass}>{errors.languages.message as string}</p>}
            </div>
            <div>
              <label className={labelClass}>Age group <span className="text-rose-500">*</span></label>
              <select disabled={readOnly} className={inputClass} {...register("age_group")}>
                <option value="">Select age group</option>
                {AGE_GROUP_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {errors.age_group && <p className={errorClass}>{errors.age_group.message}</p>}
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Ticket delivery modes for customers <span className="text-rose-500">*</span>
            </label>
            <p className="portal-muted text-xs mb-3">
              Choose which options buyers can select when purchasing tickets for this event.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {TICKET_MODE_OPTIONS.map((option) => {
                const selected = allowedTicketModes.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => toggleTicketMode(option.id)}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      selected
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                          selected
                            ? "border-violet-600 bg-violet-600 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {selected && <Check size={10} strokeWidth={3} />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">{option.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {errors.allowed_ticket_modes && (
              <p className={errorClass}>{errors.allowed_ticket_modes.message as string}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>About event <span className="text-rose-500">*</span></label>
            <textarea disabled={readOnly} rows={4} className={`${inputClass} resize-y min-h-[100px]`} {...register("about_event")} placeholder="Describe the event..." />
            {errors.about_event && <p className={errorClass}>{errors.about_event.message}</p>}
          </div>
        </section>
        )}

        {stepId === "media" && (
        <>
        <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-5">
          <h3 className="portal-heading text-lg font-semibold">Posters</h3>
          <p className="portal-muted text-xs">Drag a crop box on the photo, then save. You can edit or remove any image later.</p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Horizontal poster <span className="text-rose-500">*</span></label>
              <CroppedImageField
                value={posterHorizontal}
                aspect={16 / 9}
                disabled={readOnly || uploading}
                previewClassName="w-full h-36 rounded-xl"
                emptyClassName="flex flex-col items-center justify-center h-36 w-full rounded-xl border border-dashed border-slate-300 hover:border-violet-400"
                onRemove={() => setValue("poster_horizontal_url", "", { shouldDirty: true })}
                onCroppedFile={(file) => uploadCropped(file, (url) => setValue("poster_horizontal_url", url, { shouldDirty: true }))}
                emptyContent={
                  <>
                    <ImagePlus className="text-slate-400 mb-2" size={28} />
                    <span className="text-xs portal-muted">Add landscape poster</span>
                  </>
                }
              />
            </div>
            <div>
              <label className={labelClass}>Vertical poster</label>
              <CroppedImageField
                value={posterVertical}
                aspect={2 / 3}
                disabled={readOnly || uploading}
                previewClassName="w-[200px] h-48 rounded-xl"
                emptyClassName="flex flex-col items-center justify-center h-36 w-full max-w-[200px] rounded-xl border border-dashed border-slate-300 hover:border-violet-400"
                onRemove={() => setValue("poster_vertical_url", "", { shouldDirty: true })}
                onCroppedFile={(file) => uploadCropped(file, (url) => setValue("poster_vertical_url", url, { shouldDirty: true }))}
                emptyContent={
                  <>
                    <ImagePlus className="text-slate-400 mb-2" size={28} />
                    <span className="text-xs portal-muted">Add portrait poster</span>
                  </>
                }
              />
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
          <h3 className="portal-heading text-lg font-semibold">Gallery</h3>
          <p className="portal-muted text-sm">Photos customers will see on the event details page.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {galleryImages.map((url, i) => (
              <CroppedImageField
                key={`${url}-${i}`}
                value={url}
                aspect={4 / 3}
                disabled={readOnly || uploading}
                previewClassName="h-28 rounded-xl w-full"
                onRemove={() =>
                  setValue(
                    "gallery_images",
                    galleryImages.filter((_, idx) => idx !== i),
                    { shouldDirty: true }
                  )
                }
                onCroppedFile={(file) =>
                  uploadCropped(file, (next) =>
                    setValue(
                      "gallery_images",
                      galleryImages.map((u, idx) => (idx === i ? next : u)),
                      { shouldDirty: true }
                    )
                  )
                }
              />
            ))}
            {!readOnly && (
              <ImageCropPicker
                aspect={4 / 3}
                disabled={uploading}
                className="flex flex-col items-center justify-center h-28 rounded-xl border border-dashed border-slate-300 hover:border-violet-400"
                onCroppedFile={(file) =>
                  uploadCropped(file, (url) =>
                    setValue("gallery_images", [...galleryImages, url], { shouldDirty: true })
                  )
                }
              >
                <ImagePlus className="text-slate-400 mb-1" size={22} />
                <span className="text-[11px] portal-muted">Add photo</span>
              </ImageCropPicker>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
          <div>
            <h3 className="portal-heading text-lg font-semibold">YouTube video</h3>
            <p className="portal-muted text-sm mt-1">
              Optional. This plays as the second slide on the customer event page. Paste a YouTube watch, share, or Shorts link.
            </p>
          </div>
          <input
            disabled={readOnly}
            className={inputClass}
            placeholder="https://www.youtube.com/watch?v=..."
            {...register("youtube_url")}
          />
          {errors.youtube_url && <p className={errorClass}>{errors.youtube_url.message}</p>}
        </section>
        </>
        )}

        {stepId === "documents" && (
        <>
        <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
          <div>
            <h3 className="portal-heading text-lg font-semibold">Event-specific documents</h3>
            <p className="portal-muted text-sm mt-1">Upload documents required by Super Admin for each event.</p>
          </div>
          {!categoryTypeId ? (
            <p className="portal-muted text-sm">Select a category to see the document checklist.</p>
          ) : mastersLoading ? (
            <p className="portal-muted text-sm">Loading document requirements...</p>
          ) : masters?.documents?.length ? (
            <div className="space-y-4">
              {masters.documents.map((doc) => {
                const uploadedUrl = documents.find((d) => d.document_type_id === doc.id)?.url;
                return (
                  <div key={doc.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="portal-heading font-semibold">{doc.name}</span>
                        {doc.is_required && (
                          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">Required</span>
                        )}
                      </div>
                      {doc.description && <p className="portal-muted text-sm mt-1.5 leading-relaxed">{doc.description}</p>}
                    </div>
                    {uploadedUrl ? (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-200">
                        <FileText size={16} className="text-violet-600 shrink-0" />
                        <a href={uploadedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-800 truncate flex-1 hover:text-violet-700">View uploaded file</a>
                        {!readOnly && (
                          <button type="button" onClick={() => setDocuments((p) => p.filter((d) => d.document_type_id !== doc.id))} className="text-slate-400 hover:text-rose-600">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ) : (
                      !readOnly && (
                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-slate-300 text-sm portal-muted hover:border-violet-400 cursor-pointer">
                          <Upload size={16} /> Upload PDF or image
                          <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploading} onChange={(e) => handleDocumentUpload(e, doc.id)} />
                        </label>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-amber-700 text-sm">No document types configured yet.</p>
          )}
        </section>

        <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
          <div>
            <h3 className="portal-heading text-lg font-semibold">Customer terms &amp; conditions</h3>
            <p className="portal-muted text-sm mt-1">
              Tick Super Admin master points to show on this event. Extra points you add here stay on this event only — they are not saved to the Super Admin master list.
            </p>
          </div>
          {!categoryTypeId ? (
            <p className="portal-muted text-sm">Select a category to load the T&amp;C checklist.</p>
          ) : mastersLoading ? (
            <p className="portal-muted text-sm">Loading terms &amp; conditions...</p>
          ) : (
            <div className="space-y-4">
              {(masters?.terms?.length || selectedTerms.length) ? (
                <div className="space-y-2">
                  {(masters?.terms || []).map((term) => {
                    const checked = selectedTerms.some((t) => t.id === term.id);
                    return (
                      <label
                        key={term.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
                          checked ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-slate-50"
                        } ${readOnly ? "cursor-default" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 rounded border-slate-300"
                          checked={checked}
                          disabled={readOnly}
                          onChange={() => toggleMasterTerm({ id: term.id, text: term.text })}
                        />
                        <span className="text-sm text-slate-800 leading-relaxed">{term.text}</span>
                      </label>
                    );
                  })}
                  {selectedTerms
                    .filter((t) => !(masters?.terms || []).some((m) => m.id === t.id))
                    .map((term) => (
                      <label
                        key={`kept-${term.id}`}
                        className="flex items-start gap-3 p-3 rounded-xl border border-violet-300 bg-violet-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 rounded border-slate-300"
                          checked
                          disabled={readOnly}
                          onChange={() => toggleMasterTerm(term)}
                        />
                        <span className="text-sm text-slate-800 leading-relaxed">{term.text}</span>
                      </label>
                    ))}
                </div>
              ) : (
                <p className="portal-muted text-sm">No master T&amp;C points yet. You can still add event-specific points below.</p>
              )}

              <div className="pt-2 border-t border-slate-200 space-y-3">
                <p className="text-sm font-medium text-slate-700">Event-only T&amp;C points</p>
                {customTerms.length > 0 && (
                  <ul className="space-y-2">
                    {customTerms.map((line, idx) => (
                      <li
                        key={`${line}-${idx}`}
                        className="flex items-start gap-2 p-3 rounded-xl bg-white border border-slate-200"
                      >
                        <span className="flex-1 text-sm text-slate-800 leading-relaxed">{line}</span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => setCustomTerms((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-600"
                            aria-label="Remove custom T&C"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {!readOnly && (
                  <div className="flex gap-2">
                    <input
                      value={customTermDraft}
                      onChange={(e) => setCustomTermDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomTerm();
                        }
                      }}
                      placeholder="Add a point for this event only"
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={addCustomTerm}
                      className="px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 inline-flex items-center gap-1"
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
        </>
        )}

        {stepId === "venue" && (
        <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="portal-heading text-lg font-semibold">
              {hostingType === "tour" ? "Tour stops, timings & tickets" : "Venues, timings & tickets"}{" "}
              <span className="text-rose-500 text-sm">*</span>
            </h3>
            {!readOnly && (
              <button type="button" onClick={() => appendShowtime(defaultVenue())} className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1">
                <Plus size={14} /> Add venue
              </button>
            )}
          </div>
          <p className="portal-muted text-xs">
            {hostingType === "tour"
              ? "Add each tour city stop as a venue. Each stop has its own ticket types and show times. Dates display as MM-DD-YYYY."
              : "Each venue has its own ticket types and show times. City is selected from Admin city master. Dates display as MM-DD-YYYY."}
          </p>
          {showtimeFields.map((field, i) => (
            <VenueBlock
              key={field.id}
              index={i}
              readOnly={readOnly}
              canRemove={showtimeFields.length > 1}
              onRemove={() => removeShowtime(i)}
              cities={cities}
              hostingType={hostingType}
            />
          ))}
          {errors.showtimes && typeof errors.showtimes.message === "string" && (
            <p className={errorClass}>{errors.showtimes.message}</p>
          )}
        </section>
        )}

        {stepId === "artists" && (
        <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="portal-heading text-lg font-semibold">Event lineup</h3>
              <p className="portal-muted text-xs mt-1">
                Optional. Add artists, guests, or chief guests. For artists you can search partners or auto-register a new name.
              </p>
            </div>
        {!readOnly && (
              <button
                type="button"
                onClick={() => appendArtist({ ...defaultArtist(), sort_order: artistFields.length })}
                className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1"
              >
                <Plus size={14} /> Add person
              </button>
            )}
          </div>

          {artistFields.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm text-slate-600">No one added yet. You can continue without a lineup.</p>
            </div>
          )}

          {artistFields.map((field, i) => (
            <ArtistBlock key={field.id} index={i} readOnly={readOnly} onRemove={() => removeArtist(i)} />
          ))}
        </section>
        )}

        {stepId === "review" && (
          <section className="glass-panel rounded-2xl border border-white/5 p-6 space-y-6">
            <div>
              <h3 className="portal-heading text-lg font-semibold">Review & submit</h3>
              <p className="portal-muted text-sm mt-1">
                Confirm everything looks correct. You can go back to edit any step, save a draft, or submit for Super Admin approval.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Event</p>
                <p className="font-semibold text-slate-900">{watch("name") || "—"}</p>
                <p className="text-sm text-slate-600">
                  {categories.find((c) => c.id === categoryTypeId)?.name || "No category"}
                  {" · "}
                  {hostingType === "tour" ? "Tour" : "Single event"}
                </p>
                <p className="text-sm text-slate-600">
                  {(genres || []).join(", ") || "No genres"} · {(languages || []).join(", ") || "No languages"}
                </p>
                <p className="text-sm text-slate-600">
                  Age {watch("age_group") || "—"}
                  {(() => {
                    const mins = computeDurationMinutesFromShowtimes(watch("showtimes") || []);
                    return mins ? ` · ${mins} min` : "";
                  })()}
                </p>
                <p className="text-sm text-slate-600">
                  Ticket modes:{" "}
                  {(allowedTicketModes.length
                    ? TICKET_MODE_OPTIONS.filter((o) => allowedTicketModes.includes(o.id))
                    : TICKET_MODE_OPTIONS
                  )
                    .map((o) => o.label)
                    .join(", ") || "None selected"}
                </p>
                <button type="button" className="text-sm text-violet-700 font-medium" onClick={() => goToStep("details")}>
                  Edit details
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Media</p>
                <p className="text-sm text-slate-600">
                  Horizontal poster: {posterHorizontal ? "Uploaded" : "Missing"}
                </p>
                <p className="text-sm text-slate-600">
                  Vertical poster: {posterVertical ? "Uploaded" : "Optional / not set"}
                </p>
                <p className="text-sm text-slate-600">Gallery photos: {galleryImages.length}</p>
                <p className="text-sm text-slate-600">
                  YouTube: {watch("youtube_url")?.trim() ? "Linked" : "Not set"}
                </p>
                <button type="button" className="text-sm text-violet-700 font-medium" onClick={() => goToStep("media")}>
                  Edit media
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {hostingType === "tour" ? "Tour stops" : "Venues & tickets"}
                </p>
                {(watch("showtimes") || []).map((show, idx) => (
                  <div key={idx} className="rounded-lg bg-white border border-slate-200 px-3 py-2">
                    <p className="font-medium text-slate-900">
                      {show.venue_name || `Stop ${idx + 1}`} · {cityName(show.city_id)}
                      {show.venue_source === "registered"
                        ? " · Verified venue"
                        : show.venue_source === "auto_registered" || show.venue_business_id
                          ? " · In system (not authorized)"
                          : " · New venue (auto-register)"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Layout:{" "}
                      {show.layout_mode === "standard"
                        ? "Standard published"
                        : show.layout_mode === "custom"
                          ? `Custom request${show.custom_layout_name ? ` (${show.custom_layout_name})` : ""}`
                          : "None"}
                      {" · "}
                      {(show.ticket_types || []).length} ticket type(s)
                      {(show.ticket_types || [])
                        .filter((t) => t.ticket_type)
                        .map((t) => ` · ${t.ticket_type} (${t.total_count} @ ${t.price}, max ${t.max_per_order || 10}/order)`)
                        .join("")}
                    </p>
                  </div>
                ))}
                <button type="button" className="text-sm text-violet-700 font-medium" onClick={() => goToStep("venue")}>
                  Edit venue & tickets
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lineup</p>
                {(watch("artists") || []).length === 0 ? (
                  <p className="text-sm text-slate-600">No one added</p>
                ) : (
                  (watch("artists") || []).map((artist, idx) => (
                    <div key={idx} className="rounded-lg bg-white border border-slate-200 px-3 py-2">
                      <p className="font-medium text-slate-900">
                        {artist.name || `Person ${idx + 1}`}
                        {artist.role_title ? ` · ${artist.role_title}` : ""}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {artist.role_title === "Artist"
                          ? artist.artist_source === "registered"
                            ? "Registered artist partner"
                            : "Artist (auto-register / external)"
                          : "Event guest listing only"}
                      </p>
                    </div>
                  ))
                )}
                <button type="button" className="text-sm text-violet-700 font-medium" onClick={() => goToStep("artists")}>
                  Edit lineup
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents & T&amp;C</p>
                <p className="text-sm text-slate-600">
                  Uploaded documents: {documents.filter((d) => d.url).length}
                  {masters?.documents?.length
                    ? ` / ${masters.documents.length} listed for this category`
                    : ""}
                </p>
                <p className="text-sm text-slate-600">
                  T&amp;C points: {selectedTerms.length} master + {customTerms.length} custom
                </p>
                <button type="button" className="text-sm text-violet-700 font-medium" onClick={() => goToStep("documents")}>
                  Edit documents
                </button>
              </div>
            </div>
          </section>
        )}

        {!readOnly && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 sticky bottom-0 bg-background/95 backdrop-blur py-3 border-t border-white/10 z-10">
            <div className="flex flex-wrap gap-2">
              {!isFirstStep && (
                <button
                  type="button"
                  onClick={goBack}
                  className="btn-secondary px-4 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-1.5"
                >
                  <ChevronLeft size={16} /> Back
                </button>
              )}
            <button
              type="button"
              disabled={saving || submitting}
              onClick={runSaveDraft}
                className="btn-secondary px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save draft"}
            </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isLastStep ? (
                <button
                  type="button"
                  onClick={() => void goNext()}
                  className="btn-primary px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-1.5"
                >
                  Continue <ChevronRight size={16} />
                </button>
              ) : (
                canSubmit && (
              <button
                type="button"
                disabled={saving || submitting}
                onClick={handleSubmit(runSubmit)}
                className="btn-primary disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit for approval"}
              </button>
                )
              )}
            </div>
          </div>
        )}

        {readOnly && (
          <div className="flex flex-wrap gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={goBack}
                className="btn-secondary px-4 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-1.5"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
            {!isLastStep && (
              <button
                type="button"
                onClick={() => {
                  markVisited(stepId);
                  const next = EVENT_STEPPER_STEPS[stepIndex + 1];
                  if (next) setStepId(next.id);
                }}
                className="btn-primary px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-1.5"
              >
                Continue <ChevronRight size={16} />
              </button>
            )}
          </div>
        )}
      </form>
    </FormProvider>
  );
}
