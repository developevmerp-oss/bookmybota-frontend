"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useForm, useFieldArray, useFormContext, FormProvider } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ImagePlus, Plus, Trash2, Upload, FileText, AlertCircle, ChevronLeft, ChevronRight, CalendarDays, MapPin, Search, Check, Megaphone, X, Eye, HelpCircle, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import {
  useGetEventCategoriesQuery,
  useGetEventMastersQuery,
  useGetCitiesQuery,
  useUploadImageMutation,
  useSearchOrganizerVenuesQuery,
  useGetOrganizerVenueLayoutsQuery,
  useGetOrganizerVenueLayoutQuery,
  useSearchOrganizerArtistsQuery,
  useGetPublicMarketingPlansQuery,
  useReviewOrganizerEventLayoutRequestMutation,
  useGetOrganizerSupportContactQuery,
  type CityMaster,
  type EventDocumentMaster,
  type EventDocumentUpload,
  type EventFormPayload,
  type OrganizerEvent,
  type OrganizerVenueSearchResult,
  type OrganizerArtistSearchResult,
} from "@/services/api";
import { fuzzyFilter } from "@/lib/fuzzySearch";
import { formatMoneyDisplay } from "@/lib/currencyFormat";
import PlanInfoButton from "@/components/Shared/PlanInfoButton";
import { resolveMediaUrl, extractUploadUrl } from "@/lib/mediaUrl";
import SafeCoverImage, {
  ARTIST_IMAGE_FALLBACK_CLASS,
  ArtistImageFallback,
} from "@/components/Shared/SafeCoverImage";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";

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
  defaultTicketType,
  MAX_ABOUT_EVENT_CHARS,
  EVENT_LINEUP_ROLES,
  isArtistLineupRole,
  normalizeLineupRole,
  showtimeToIso,
  isShowtimePersistable,
} from "@/lib/eventFormSchema";
import { countChars, filterDocumentsByAppliesTo, resolveDocumentAppliesTo } from "@/lib/eventDocumentScope";
import {
  formatDate,
  formatDateTime12h,
  formatTime12h,
  inferDurationType,
  normalizeTimeToHm,
  toDateInput,
  toDatetimeLocal,
  toTimeInput,
} from "@/lib/dateFormat";
import { extractApiError } from "@/lib/apiErrors";
import {
  getTicketCapacitySummary,
  validateShowtimeTickets,
} from "@/lib/eventTicketLayoutValidation";
import ImageCropPicker, { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import EventStepperNav, {
  type EventStepperStepId,
} from "@/components/EventAdminPanel/EventStepperNav";
import EventFormCustomerPreview from "@/components/EventAdminPanel/EventFormCustomerPreview";
import {
  TICKET_MODE_OPTIONS,
  normalizeAllowedTicketModes,
  type TicketDeliveryMode,
} from "@/lib/eventTicketMode";
import {
  getEventStepperSteps,
  getSportExtraFields,
  getSportMeta,
  isSportMetaComplete,
  isSportsCategory,
  SPORT_GENDER_CATEGORIES,
  SPORT_MATCH_FORMATS,
  defaultSportMeta,
  type EventCategoryMeta,
  type SportMeta,
} from "@/lib/eventCategoryConfig";

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
  return [];
}

function eventToValues(event?: OrganizerEvent | null): EventFormValues {
  if (!event) return defaultEventFormValues();
  const gallery = Array.isArray(event.gallery_images) ? event.gallery_images : [];
  const promo = Array.isArray(event.promotions) ? event.promotions[0] : undefined;
  const promoStartRaw = promo?.start_date ? String(promo.start_date) : "";
  const promoStartDate = /^\d{4}-\d{2}-\d{2}/.test(promoStartRaw)
    ? promoStartRaw.slice(0, 10)
    : promoStartRaw
      ? (() => {
          const d = new Date(promoStartRaw);
          if (Number.isNaN(d.getTime())) return "";
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        })()
      : "";
  return {
    name: event.name || "",
    category_type_id: event.category_type_id ?? null,
    genres: event.genres || [],
    poster_horizontal_url: event.poster_horizontal_url || "",
    poster_vertical_url: event.poster_vertical_url || "",
    gallery_images: gallery,
    youtube_url: event.youtube_url || "",
    want_promotion: Boolean((promo as any)?.plan_id && promo?.title),
    promo_plan_id: (promo as any)?.plan_id != null ? String((promo as any).plan_id) : "",
    promo_title: promo?.title ? String(promo.title) : "",
    promo_banner_url: (promo as any)?.banner_image_url ? String((promo as any).banner_image_url) : "",
    promo_slider_accent_text: (promo as any)?.slider_accent_text
      ? String((promo as any).slider_accent_text)
      : "",
    promo_start_date: promoStartDate,
    promo_landing_slider: Boolean((promo as any)?.landing_slider),
    languages: parseEventLanguages(event.language),
    about_event: event.about_event || "",
    age_group: event.age_group || "",
    duration_minutes: event.duration_minutes ?? null,
    allowed_ticket_modes: normalizeAllowedTicketModes(event.allowed_ticket_modes),
    category_meta:
      event.category_meta && typeof event.category_meta === "object"
        ? (event.category_meta as EventCategoryMeta)
        : {},
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
        documents: Array.isArray((a as any).documents)
          ? (a as any).documents.map((d: any) => ({
              document_type_id: Number(d.document_type_id) || 0,
              url: String(d.url || ""),
              document_name: String(d.document_name || ""),
            }))
          : [],
        sort_order: a.sort_order ?? i,
      })) || [],
    showtimes:
      (event.showtimes?.map((s, i) => {
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
          layout_mode: (() => {
            const hasCustomReq = (event.layout_requests || []).some((r: any) =>
              ["SUBMITTED", "UNDER_REVIEW", "PENDING_ORGANIZER_APPROVAL", "FULFILLED", "ORGANIZER_CHANGE_REQUESTED"].includes(
                String(r.status)
              )
            );
            const isStadium = (event as any)?.seating_config?.layout_mode === "stadium";
            if (hasCustomReq || isStadium || s.layout_mode === "custom") {
              return "custom";
            }
            if (s.layout_mode === "standard" || s.venue_layout_template_id) {
              return "standard";
            }
            return "none";
          })(),
          custom_layout_name: s.custom_layout_name || "",
          custom_layout_type: s.custom_layout_type || "custom",
          custom_layout_capacity: s.custom_layout_capacity ?? null,
          custom_layout_notes: s.custom_layout_notes || "",
          custom_layout_images: Array.isArray((s as { custom_layout_images?: string[] }).custom_layout_images)
            ? ((s as { custom_layout_images?: string[] }).custom_layout_images || [])
            : [],
          location_id: (s as { location_id?: number | null }).location_id ?? null,
          venue_proposal: (() => {
            const raw = (s as { venue_proposal?: EventFormValues["showtimes"][number]["venue_proposal"] | string })
              .venue_proposal;
            const parsed =
              typeof raw === "string"
                ? (() => {
                    try {
                      return JSON.parse(raw) as EventFormValues["showtimes"][number]["venue_proposal"];
                    } catch {
                      return null;
                    }
                  })()
                : raw || null;
            if (!parsed || typeof parsed !== "object") return null;
            return {
              contact_name: String(parsed.contact_name || ""),
              contact_phone: String(parsed.contact_phone || ""),
              contact_email: String(parsed.contact_email || ""),
              capacity: parsed.capacity ?? null,
              facilities: Array.isArray(parsed.facilities) ? parsed.facilities : [],
              image_urls: Array.isArray(parsed.image_urls) ? parsed.image_urls : [],
              notes: String(parsed.notes || ""),
            };
          })(),
          duration_type: durationType,
          event_date: toDateInput(s.starts_at),
          start_time: toTimeInput(s.starts_at),
          // ONE_DAY end is derived from duration on save; avoid stale end_time causing before-start errors.
          end_time: durationType === "MULTI_DAY" ? toTimeInput(s.ends_at || s.starts_at) : "",
          starts_at: toDatetimeLocal(s.starts_at),
          ends_at: durationType === "MULTI_DAY" ? toDatetimeLocal(s.ends_at) : "",
          ticket_types: ticketsForShow(event, s.id, i),
        };
      }) as EventFormValues["showtimes"]) || [defaultVenue()],
  };
}

const HOUR_12_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

function parseYmdParts(ymd?: string | null): { y: string; m: string; d: string } {
  const s = String(ymd || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { y: s.slice(0, 4), m: s.slice(5, 7), d: s.slice(8, 10) };
  }
  return { y: "", m: "", d: "" };
}

function buildYmd(y: string, m: string, d: string): string {
  if (!/^\d{4}$/.test(y) || !m || !d) return "";
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) return "";
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return "";
  return `${y}-${m}-${d}`;
}

/** Event date: type or pick from calendar (stored as YYYY-MM-DD). */
function EventDateField({
  value,
  onChange,
  disabled,
  inputClass,
}: {
  value?: string | null;
  onChange: (ymd: string) => void;
  disabled?: boolean;
  inputClass: string;
}) {
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim()) ? String(value).trim() : "";

  return (
    <div className="space-y-1">
      <input
        type="date"
        disabled={disabled}
        className={`${inputClass} w-full`}
        value={ymd}
        onChange={(e) => onChange(e.target.value || "")}
      />
      {ymd ? <p className="text-xs text-slate-600">{formatDate(ymd)}</p> : null}
    </div>
  );
}

/** Calendar date as Day / Month / 4-digit Year (avoids native date year bugs). */
function DateYmdFields({
  value,
  onChange,
  disabled,
  inputClass,
}: {
  value?: string | null;
  onChange: (ymd: string) => void;
  disabled?: boolean;
  inputClass: string;
}) {
  const parsed = parseYmdParts(value);
  const [y, setY] = useState(parsed.y);
  const [m, setM] = useState(parsed.m);
  const [d, setD] = useState(parsed.d);

  useEffect(() => {
    const next = parseYmdParts(value);
    setY(next.y);
    setM(next.m);
    setD(next.d);
  }, [value]);

  const emit = (yy: string, mm: string, dd: string) => {
    if (/^\d{4}$/.test(yy) && mm && dd) {
      const built = buildYmd(yy, mm, dd);
      onChange(built);
      return;
    }
    if (!yy && !mm && !dd) onChange("");
  };

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <select
        disabled={disabled}
        aria-label="Day"
        className={`${inputClass} w-full`}
        value={d}
        onChange={(e) => {
          const dd = e.target.value;
          setD(dd);
          emit(y, m, dd);
        }}
      >
        <option value="">DD</option>
        {DAY_OPTIONS.map((day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ))}
      </select>
      <select
        disabled={disabled}
        aria-label="Month"
        className={`${inputClass} w-full`}
        value={m}
        onChange={(e) => {
          const mm = e.target.value;
          setM(mm);
          emit(y, mm, d);
        }}
      >
        <option value="">MM</option>
        {MONTH_OPTIONS.map((month) => (
          <option key={month} value={month}>
            {month}
          </option>
        ))}
      </select>
      <input
        disabled={disabled}
        type="text"
        inputMode="numeric"
        aria-label="Year (4 digits)"
        placeholder="YYYY"
        maxLength={4}
        className={`${inputClass} w-full`}
        value={y}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
          setY(digits);
          emit(digits, m, d);
        }}
      />
    </div>
  );
}

function splitHm12(hm?: string | null): { hour12: string; minute: string; ampm: "AM" | "PM" } {
  const normalized = normalizeTimeToHm(hm);
  if (!normalized) return { hour12: "", minute: "", ampm: "AM" };
  const [hStr, mStr] = normalized.split(":");
  const h24 = Number(hStr);
  const ampm: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return {
    hour12: String(h12).padStart(2, "0"),
    minute: mStr || "",
    ampm,
  };
}

function combineHm12(hour12: string, minute: string, ampm: "AM" | "PM"): string {
  if (!hour12 || !minute) return "";
  let h = Number(hour12) % 12;
  if (ampm === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

/** 12-hour clock with AM/PM (stored as HH:mm 24h). */
function TimeHmFields({
  value,
  onChange,
  disabled,
  inputClass,
}: {
  value?: string | null;
  onChange: (hm: string) => void;
  disabled?: boolean;
  inputClass: string;
}) {
  const { hour12, minute, ampm } = splitHm12(value);

  return (
    <div className="space-y-2 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <select
          disabled={disabled}
          aria-label="Hour"
          className={`${inputClass} min-w-[4.5rem] flex-1`}
          value={hour12}
          onChange={(e) => {
            const h = e.target.value;
            if (!h) {
              onChange("");
              return;
            }
            onChange(combineHm12(h, minute || "00", ampm));
          }}
        >
          <option value="">HH</option>
          {HOUR_12_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {Number(h)}
            </option>
          ))}
        </select>
        <span className="text-slate-500 font-semibold shrink-0">:</span>
        <select
          disabled={disabled}
          aria-label="Minute"
          className={`${inputClass} min-w-[4.5rem] flex-1`}
          value={minute}
          onChange={(e) => {
            const m = e.target.value;
            if (!m) {
              onChange("");
              return;
            }
            onChange(combineHm12(hour12 || "12", m, ampm));
          }}
        >
          <option value="">MM</option>
          {MINUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          disabled={disabled}
          aria-label="AM or PM"
          className={`${inputClass} min-w-[5rem]`}
          value={hour12 ? ampm : ""}
          onChange={(e) => {
            const next = e.target.value as "AM" | "PM" | "";
            if (!next) {
              onChange("");
              return;
            }
            onChange(combineHm12(hour12 || "12", minute || "00", next));
          }}
        >
          <option value="">AM/PM</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
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
    if (cityId == null) {
      setCountryFilter("");
      return;
    }
    const selected = cities.find((c) => c.id === cityId);
    if (!selected) return;
    if (selected.country) setCountryFilter(selected.country.trim());
  }, [cityId, cities]);

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
        <label className={labelClass}>City <span className="text-rose-500">*</span></label>
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
  onUnregisteredVenue,
  onVenueSelected,
  onRegisteredMatches,
}: {
  index: number;
  readOnly: boolean;
  labelClass: string;
  inputClass: string;
  errorClass: string;
  onUnregisteredVenue: (name: string) => void;
  onVenueSelected: () => void;
  onRegisteredMatches: () => void;
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

  // Auto-open manual venue form when the typed name is not registered.
  const onUnregisteredRef = useRef(onUnregisteredVenue);
  const onRegisteredMatchesRef = useRef(onRegisteredMatches);
  onUnregisteredRef.current = onUnregisteredVenue;
  onRegisteredMatchesRef.current = onRegisteredMatches;

  useEffect(() => {
    if (readOnly || venueBusinessId) return;
    if (debouncedQ.length < 2 || isFetching) return;
    if (venues.length === 0) {
      onUnregisteredRef.current(debouncedQ);
      setShowResults(false);
      return;
    }
    onRegisteredMatchesRef.current();
  }, [readOnly, venueBusinessId, debouncedQ, isFetching, venues.length]);

  const clearVenueSelection = () => {
    setValue(`showtimes.${index}.venue_business_id`, null, { shouldDirty: true });
    setValue(`showtimes.${index}.venue_source`, "manual", { shouldDirty: true });
    setValue(`showtimes.${index}.venue_layout_template_id`, null, { shouldDirty: true });
    setValue(`showtimes.${index}.venue_address`, "", { shouldDirty: true });
    setValue(`showtimes.${index}.city_id`, null, { shouldDirty: true });
    setValue(`showtimes.${index}.location_id`, null, { shouldDirty: true });
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
      // Preview-only: keep default layout id for map view; booking preference defaults to none.
      setValue(`showtimes.${index}.layout_mode`, "none", { shouldDirty: true });
      setValue(
        `showtimes.${index}.venue_layout_template_id`,
        venue.default_layout_id || null,
        { shouldDirty: false }
      );
    } else {
      setValue(`showtimes.${index}.layout_mode`, "none", { shouldDirty: true });
      setValue(`showtimes.${index}.venue_layout_template_id`, null, { shouldDirty: true });
    }
    setShowResults(false);
    onVenueSelected();
  };

  const { onChange: onVenueNameChange, ...venueNameReg } = register(`showtimes.${index}.venue_name`);

  return (
    <div>
      <label className={labelClass}>Venue name <span className="text-rose-500">*</span></label>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
        <input
          disabled={readOnly}
          className={`${inputClass} pl-9`}
          placeholder="Search registered venue or type a new venue name"
          {...venueNameReg}
          onFocus={() => setShowResults(true)}
          onChange={(e) => {
            onVenueNameChange(e);
            if (venueBusinessId) clearVenueSelection();
            setShowResults(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setShowResults(false), 150);
          }}
        />
        {showResults && !readOnly && debouncedQ.length >= 2 && !venueBusinessId && venues.length > 0 && (
          <div className="absolute z-30 left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 shadow-lg">
            {isFetching && <p className="px-3 py-2 text-xs text-slate-500">Searching…</p>}
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
                  className={`w-full text-left px-3 py-2 hover:bg-rose-50 transition-colors ${
                    selected ? "bg-rose-50" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-slate-800">{v.name}</p>
                  <p className="text-xs text-slate-500">
                    {[v.address, v.city_name, v.city_state].filter(Boolean).join(" · ") || "Address not set"}
                    {typeof v.published_layout_count === "number" && verified
                      ? ` · ${v.published_layout_count} live layout${v.published_layout_count === 1 ? "" : "s"}`
                      : ""}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${verified ? "text-emerald-700" : "text-amber-700"}`}>
                    {verified ? "Verified partner" : "In system — not platform-authorized"}
                    {verified && v.default_layout_name ? ` · Live: ${v.default_layout_name}` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-1">
        Search and select a registered venue. If the venue is not in the system, enter its details below.
      </p>
      {errors.showtimes?.[index]?.venue_name && (
        <p className={errorClass}>{errors.showtimes[index]?.venue_name?.message}</p>
      )}

      {venueBusinessId && !readOnly && (
        <button
          type="button"
          onClick={() => {
            clearVenueSelection();
            setShowResults(true);
          }}
          className="mt-1.5 text-xs text-slate-600 hover:text-rose-600"
        >
          Change venue
        </button>
      )}
    </div>
  );
}

function generateTicketTypesFromLayout(
  templateDetail: any,
  defaultCapacity?: number | null
): Array<{
  ticket_type: string;
  price: number;
  total_count: number;
  max_per_order: number;
}> {
  const cfg =
    typeof templateDetail?.seating_config === "string"
      ? (() => {
          try {
            return JSON.parse(templateDetail.seating_config);
          } catch {
            return {};
          }
        })()
      : templateDetail?.seating_config || {};

  const isStadium =
    cfg?.layout_mode === "stadium" ||
    (Array.isArray(cfg?.blocks) && cfg.blocks.length > 0);

  if (isStadium && Array.isArray(cfg.blocks) && cfg.blocks.length > 0) {
    const blocks = cfg.blocks as any[];
    return blocks.map((b: any, idx: number) => {
      // Prefer tier-computed capacity (source of truth); fall back to b.capacity only when no tiers
      let cap = 0;
      if (Array.isArray(b.tiers) && b.tiers.length > 0) {
        cap = b.tiers.reduce((sum: number, t: any) => {
          const rCount = Math.max(
            1,
            (t.row_end || "A").charCodeAt(0) - (t.row_start || "A").charCodeAt(0) + 1
          );
          return sum + rCount * (Number(t.seats_per_row) || 0);
        }, 0);
      }
      if (cap <= 0) {
        cap = Number(b.capacity) || 0;
      }
      const nl = String(b.name || "").toLowerCase();
      let maxOrder = 10;
      if (nl.includes("vip") || nl.includes("lounge") || nl.includes("box")) maxOrder = 6;
      else if (nl.includes("east") || nl.includes("west") || nl.includes("club") || nl.includes("prime")) maxOrder = 8;

      return {
        ticket_type: String(b.name || `Stand ${idx + 1}`).trim(),
        price: Number(b.price) || Number(b.tiers?.[0]?.price) || 500,
        total_count: Math.max(1, cap || 100),
        max_per_order: maxOrder,
      };
    });
  }

  // ── Non-stadium (flat floor plan) fallback ──
  const totalCap =
    Number(templateDetail?.capacity) || Number(defaultCapacity) || 500;
  const vipCap = Math.max(1, Math.round(totalCap * 0.15));
  const premCap = Math.max(1, Math.round(totalCap * 0.35));
  const genCap = Math.max(1, totalCap - vipCap - premCap);

  return [
    { ticket_type: "VIP", price: 1500, total_count: vipCap, max_per_order: 6 },
    { ticket_type: "Premium", price: 800, total_count: premCap, max_per_order: 8 },
    { ticket_type: "General Admission", price: 350, total_count: genCap, max_per_order: 10 },
  ];
}

function SeatingLayoutFields({
  index,
  readOnly,
  labelClass,
  inputClass,
}: {
  index: number;
  readOnly: boolean;
  labelClass: string;
  inputClass: string;
  errorClass: string;
}) {
  const { watch, setValue, register, getValues } = useFormContext<EventFormValues>();
  const venueSource = watch(`showtimes.${index}.venue_source`) || "manual";
  const venueBusinessId = watch(`showtimes.${index}.venue_business_id`);
  const isRegisteredPartner = venueSource === "registered" && Boolean(venueBusinessId);
  const layoutMode = watch(`showtimes.${index}.layout_mode`) || "none";
  const layoutId = watch(`showtimes.${index}.venue_layout_template_id`);

  const { data: layoutData, isFetching: layoutsFetching } = useGetOrganizerVenueLayoutsQuery(
    venueBusinessId!,
    {
      skip: !venueBusinessId || !isRegisteredPartner,
    }
  );

  const liveLayouts = useMemo(
    () => (layoutData?.layouts || []).filter((l) => Boolean(l.is_default) || String(l.status) === "PUBLISHED"),
    [layoutData?.layouts]
  );

  const previewLayoutId = layoutId || liveLayouts[0]?.id || null;

  const {
    data: templateDetail,
    isLoading: templateLoading,
    isFetching: templateFetching,
    isError: templateError,
  } = useGetOrganizerVenueLayoutQuery(
    { businessId: venueBusinessId!, templateId: previewLayoutId! },
    {
      skip: !venueBusinessId || !previewLayoutId || !isRegisteredPartner,
    }
  );
  const showTemplateLoading = (templateLoading || templateFetching) && !templateDetail;
  const previewLayout = liveLayouts.find((l) => l.id === previewLayoutId) || liveLayouts[0] || null;

  // Auto-generate ticket types from venue layout when layout details load if tickets are unconfigured
  const prevDetailIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (readOnly || !templateDetail || !templateDetail.id) return;
    if (prevDetailIdRef.current === templateDetail.id) return;
    prevDetailIdRef.current = templateDetail.id;

    const currentTickets = getValues("showtimes.0.ticket_types") || [];
    const isUnconfigured =
      currentTickets.length === 0 ||
      (currentTickets.length === 1 &&
        (!currentTickets[0]?.ticket_type || currentTickets[0]?.ticket_type === "General") &&
        (!currentTickets[0]?.price || Number(currentTickets[0]?.price) === 0) &&
        (!currentTickets[0]?.total_count || Number(currentTickets[0]?.total_count) <= 1));

    if (isUnconfigured) {
      const generated = generateTicketTypesFromLayout(templateDetail, templateDetail.capacity);
      if (generated && generated.length > 0) {
        setValue("showtimes.0.ticket_types", generated, { shouldDirty: true });
        const count = (getValues("showtimes") || []).length;
        for (let i = 1; i < count; i++) {
          setValue(`showtimes.${i}.ticket_types`, generated, { shouldDirty: false });
        }
        toast.success(
          `Auto-generated ${generated.length} ticket types matching layout capacity (${templateDetail.capacity || "stadium"} seats)`
        );
      }
    }
  }, [templateDetail, readOnly, getValues, setValue]);

  // Always sync layout_capacity_snapshot from the loaded template so the validator
  // can determine capacity even for stadium layouts (which compute it from tiers).
  useEffect(() => {
    if (!templateDetail || !templateDetail.id) return;

    const cfg =
      typeof templateDetail.seating_config === "string"
        ? (() => {
            try { return JSON.parse(templateDetail.seating_config); } catch { return {}; }
          })()
        : templateDetail.seating_config || {};

    const isStadium =
      cfg?.layout_mode === "stadium" ||
      (Array.isArray(cfg?.blocks) && (cfg as any).blocks.length > 0);

    let computedCap: number | null = null;

    if (isStadium && Array.isArray((cfg as any).blocks) && (cfg as any).blocks.length > 0) {
      // Sum capacity across all blocks; calculate from tiers when no explicit capacity
      computedCap = ((cfg as any).blocks as any[]).reduce((total: number, b: any) => {
        let cap = Number(b.capacity) || 0;
        if (cap <= 0 && Array.isArray(b.tiers)) {
          cap = b.tiers.reduce((s: number, t: any) => {
            const rCount = Math.max(
              1,
              (t.row_end || "A").charCodeAt(0) - (t.row_start || "A").charCodeAt(0) + 1
            );
            return s + rCount * (Number(t.seats_per_row) || 0);
          }, 0);
        }
        return total + cap;
      }, 0);
    }

    if (!computedCap || computedCap <= 0) {
      // Fallback for flat floor plans
      computedCap =
        Number(templateDetail.capacity) ||
        Number((templateDetail as any).seat_count) ||
        (Array.isArray((templateDetail as any).seats_json) ? (templateDetail as any).seats_json.length : 0) ||
        null;
    }

    if (computedCap && computedCap > 0) {
      setValue(`showtimes.${index}.layout_capacity_snapshot`, computedCap, { shouldDirty: false });
      setValue(`showtimes.${index}.layout_seat_count_snapshot`, computedCap, { shouldDirty: false });
    }
  }, [templateDetail, index, setValue]);

  // Registered venues: if not registered partner, reset layout mode to none
  useEffect(() => {
    if (readOnly) return;
    if (!isRegisteredPartner) {
      if (layoutMode !== "none" && layoutMode !== "custom") {
        setValue(`showtimes.${index}.layout_mode`, "none", { shouldDirty: true });
      }
      setValue(`showtimes.${index}.venue_layout_template_id`, null, { shouldDirty: false });
    }
  }, [readOnly, isRegisteredPartner, layoutMode, index, setValue]);

  useEffect(() => {
    if (layoutMode !== "custom") return;
    const name = String(watch(`showtimes.${index}.custom_layout_name`) || "").trim();
    if (!name) {
      setValue(`showtimes.${index}.custom_layout_name`, "Custom event seating layout", {
        shouldDirty: false,
      });
    }
  }, [layoutMode, index, setValue, watch]);

  if (!isRegisteredPartner) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-600">
          Venue layouts appear only when you select a <strong>registered venue partner</strong>. New or
          auto-registered venues use ticket types only (no seat map).
        </div>
        <LayoutPreferenceRadios
          index={index}
          readOnly={readOnly}
          labelClass={labelClass}
          inputClass={inputClass}
          allowCustom
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
        <div>
          <p className={labelClass}>Venue layouts</p>
          <p className="text-xs text-slate-500 mb-2">
            These are the venue partner&apos;s published layouts. Select a layout to use it for this event, or choose below to request a custom layout.
          </p>
          {layoutsFetching && <p className="text-xs text-slate-500 mb-2">Loading venue layouts…</p>}
          {!layoutsFetching && liveLayouts.length === 0 ? (
            <p className="text-xs text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              This venue has no published seating layout yet.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2 mb-2">
              {liveLayouts.map((l) => {
                const active = previewLayoutId === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    disabled={readOnly}
                    onClick={() => {
                      setValue(`showtimes.${index}.venue_layout_template_id`, l.id, {
                        shouldDirty: true,
                      });
                      setValue(`showtimes.${index}.layout_mode`, "standard", {
                        shouldDirty: true,
                      });
                    }}
                    className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      active
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-800">{l.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {l.capacity ? `${Number(l.capacity).toLocaleString()} seats` : "Capacity not set"} · Live layout
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {previewLayout && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{previewLayout.name}</p>
              <p className="text-xs text-slate-600">
                Interactive preview — inspect the map and click any stand to zoom into seats.
              </p>
            </div>
            {showTemplateLoading ? (
              <p className="text-xs text-slate-600">Loading seating map…</p>
            ) : templateError ? (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                Could not load this seating map.
              </p>
            ) : (
              <VenueLayoutMapPreview
                seats={templateDetail?.seats_json}
                seatingConfig={
                  (templateDetail?.seating_config as Record<string, unknown> | null | undefined) ?? null
                }
                height={280}
                title={previewLayout.name}
              />
            )}
          </div>
        )}
      </div>

      <LayoutPreferenceRadios
        index={index}
        readOnly={readOnly}
        labelClass={labelClass}
        inputClass={inputClass}
        allowCustom
        seedTemplateId={previewLayoutId}
        hasLiveVenueLayout={liveLayouts.length > 0}
        venueLayoutName={previewLayout?.name}
        venueLayoutSeats={(() => {
          // Prefer tier-computed capacity for stadium layouts
          const td = templateDetail as any;
          const cfg =
            typeof td?.seating_config === "string"
              ? (() => { try { return JSON.parse(td.seating_config); } catch { return {}; } })()
              : td?.seating_config || {};
          if (Array.isArray(cfg?.blocks) && cfg.blocks.length > 0) {
            const fromTiers = cfg.blocks.reduce((total: number, b: any) => {
              if (Array.isArray(b.tiers) && b.tiers.length > 0) {
                return total + b.tiers.reduce((s: number, t: any) => {
                  const rCount = Math.max(1, (t.row_end || "A").charCodeAt(0) - (t.row_start || "A").charCodeAt(0) + 1);
                  return s + rCount * (Number(t.seats_per_row) || 0);
                }, 0);
              }
              return total + (Number(b.capacity) || 0);
            }, 0);
            if (fromTiers > 0) return fromTiers;
          }
          return (
            Number(td?.capacity) ||
            Number(td?.seat_count) ||
            (Array.isArray(td?.seats_json) ? td.seats_json.length : 0) ||
            Number(previewLayout?.capacity) ||
            0
          );
        })()}
      />
    </div>
  );
}

function LayoutPreferenceRadios({
  index,
  readOnly,
  labelClass,
  inputClass,
  allowCustom,
  seedTemplateId,
  hasLiveVenueLayout = false,
  venueLayoutName = "",
  venueLayoutSeats = 0,
}: {
  index: number;
  readOnly: boolean;
  labelClass: string;
  inputClass: string;
  allowCustom: boolean;
  seedTemplateId?: string | null;
  hasLiveVenueLayout?: boolean;
  venueLayoutName?: string;
  venueLayoutSeats?: number | string;
}) {
  const { watch, setValue, register, getValues } = useFormContext<EventFormValues>();
  const layoutMode = watch(`showtimes.${index}.layout_mode`) || "none";
  const preference = layoutMode;
  const ticketTypes = watch(`showtimes.0.ticket_types`) || watch(`showtimes.${index}.ticket_types`) || [];
  const ticketSeatTotal = useMemo(
    () =>
      (ticketTypes || []).reduce((sum, t) => sum + (Number(t?.total_count) || 0), 0),
    [ticketTypes]
  );

  useEffect(() => {
    if (readOnly || preference !== "custom") return;
    if (ticketSeatTotal > 0) {
      setValue(`showtimes.${index}.custom_layout_capacity`, ticketSeatTotal, {
        shouldDirty: true,
      });
    }
  }, [preference, ticketSeatTotal, index, readOnly, setValue]);

  const applyCustomMode = () => {
    setValue(`showtimes.${index}.layout_mode`, "custom", { shouldDirty: true });
    setValue(`showtimes.${index}.custom_layout_name`, "Custom event seating layout", {
      shouldDirty: true,
    });
    const existingSeed = getValues(`showtimes.${index}.venue_layout_template_id`);
    if (!existingSeed && seedTemplateId) {
      setValue(`showtimes.${index}.venue_layout_template_id`, seedTemplateId, {
        shouldDirty: true,
      });
    }
    const tickets =
      getValues(`showtimes.0.ticket_types`) || getValues(`showtimes.${index}.ticket_types`) || [];
    const total = tickets.reduce((sum, t) => sum + (Number(t?.total_count) || 0), 0);
    if (total > 0) {
      setValue(`showtimes.${index}.custom_layout_capacity`, total, { shouldDirty: true });
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div>
        <p className={labelClass}>Event seating layout</p>
        <p className="text-xs text-slate-500 mb-2">
          Choose whether to use the venue&apos;s published layout, request a custom layout, or continue without a seat map.
        </p>
      </div>
      <div className="space-y-2">
        {hasLiveVenueLayout && (
          <label
            className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
              layoutMode === "standard"
                ? "border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200"
                : "border-slate-200 bg-slate-50 hover:bg-slate-100/60"
            } ${readOnly ? "cursor-default" : ""}`}
          >
            <input
              type="radio"
              className="mt-1"
              disabled={readOnly}
              checked={layoutMode === "standard"}
              onChange={() => {
                setValue(`showtimes.${index}.layout_mode`, "standard", { shouldDirty: true });
                if (seedTemplateId) {
                  setValue(`showtimes.${index}.venue_layout_template_id`, seedTemplateId, { shouldDirty: true });
                }
              }}
            />
            <span>
              <span className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <span>Use venue layout: {venueLayoutName || "Published layout"}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Live
                </span>
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                Customers will book seats directly on this {venueLayoutSeats ? `${Number(venueLayoutSeats).toLocaleString()} seats ` : ""}layout.
              </p>
            </span>
          </label>
        )}

        {allowCustom ? (
          <label
            className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
              preference === "custom"
                ? "border-rose-300 bg-rose-50/50 ring-1 ring-rose-200"
                : "border-slate-200 bg-slate-50 hover:bg-slate-100/60"
            } ${readOnly ? "cursor-default" : ""}`}
          >
            <input
              type="radio"
              className="mt-1"
              disabled={readOnly}
              checked={preference === "custom"}
              onChange={applyCustomMode}
            />
            <span>
              <span className="text-sm font-semibold text-slate-800">Add customise event layout</span>
              <p className="text-xs text-slate-500 mt-0.5">
                Super Admin will customize from the registered venue map for this event only
                {ticketSeatTotal > 0 ? ` (up to ${ticketSeatTotal} seats from your ticket types)` : ""}.
                The venue&apos;s published layout is not changed. Review and approve before
                the contract is created.
              </p>
            </span>
          </label>
        ) : null}

        <label
          className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
            preference === "none"
              ? "border-rose-300 bg-rose-50/50 ring-1 ring-rose-200"
              : "border-slate-200 bg-slate-50 hover:bg-slate-100/60"
          } ${readOnly ? "cursor-default" : ""}`}
        >
          <input
            type="radio"
            className="mt-1"
            disabled={readOnly}
            checked={preference === "none"}
            onChange={() => {
              setValue(`showtimes.${index}.layout_mode`, "none", { shouldDirty: true });
              setValue(`showtimes.${index}.venue_layout_template_id`, null, { shouldDirty: true });
              setValue(`showtimes.${index}.custom_layout_notes`, "", { shouldDirty: true });
              setValue(`showtimes.${index}.custom_layout_capacity`, null, { shouldDirty: true });
            }}
          />
          <span>
            <span className="text-sm font-semibold text-slate-800">No need add layout</span>
            <p className="text-xs text-slate-500 mt-0.5">
              Customers book by ticket type only (no seat map for this event).
            </p>
          </span>
        </label>
      </div>

      {preference === "custom" && (
        <div className="space-y-3">
          {ticketSeatTotal > 0 && (
            <p className="text-xs text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              Seating capacity for Super Admin: <strong>{ticketSeatTotal}</strong> seats (from ticket
              types).
            </p>
          )}
          <div>
            <label className={labelClass}>
              Notes for Super Admin <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              disabled={readOnly}
              rows={3}
              className={`${inputClass} resize-y min-h-[72px]`}
              placeholder="e.g. VIP section near stage, standing GA at the back…"
              {...register(`showtimes.${index}.custom_layout_notes`)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function EventDocUploadsList({
  docs,
  documents,
  readOnly,
  uploading,
  uploadingId,
  onSelect,
  onSubmitPending,
  onRemove,
  emptyMessage,
}: {
  docs: EventDocumentMaster[];
  documents: EventDocumentUpload[];
  readOnly: boolean;
  uploading: boolean;
  uploadingId?: number | null;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>, documentTypeId: number) => void;
  onSubmitPending: (documentTypeId: number) => void;
  onRemove: (documentTypeId: number) => void;
  emptyMessage?: string;
}) {
  if (!docs.length) {
    return emptyMessage ? <p className="portal-muted text-sm">{emptyMessage}</p> : null;
  }
  return (
    <div className="space-y-3">
      {docs.map((doc) => {
        const entry = documents.find((d) => d.document_type_id === doc.id);
        const isPending = Boolean(entry?.pending_file);
        const hasFile = isPending || Boolean(entry?.url?.trim());
        const isUploading = uploadingId === doc.id || (uploading && isPending);
        const viewHref = entry?.pending_preview_url
          ? entry.pending_preview_url
          : entry?.url
            ? resolveMediaUrl(entry.url)
            : "";
        const fileLabel = entry?.pending_file_name || entry?.document_name || doc.name;
        return (
          <div key={doc.id} className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">{doc.name}</span>
              {doc.is_required && (
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                  Required
                </span>
              )}
            </div>
            {doc.description && (
              <p className="portal-muted text-xs leading-relaxed">{doc.description}</p>
            )}
            {hasFile ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <a
                    href={viewHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                    title="View document"
                    aria-label={`View ${doc.name}`}
                  >
                    <Eye size={18} />
                  </a>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-700 truncate" title={fileLabel}>
                      {fileLabel}
                    </p>
                    {isPending ? (
                      <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                        Selected — click Submit to upload
                      </p>
                    ) : (
                      <p className="text-[11px] text-emerald-700 font-medium mt-0.5">Uploaded</p>
                    )}
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onRemove(doc.id)}
                      disabled={isUploading}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                      title="Delete document"
                      aria-label={`Remove ${doc.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                {!readOnly && isPending && (
                  <button
                    type="button"
                    onClick={() => onSubmitPending(doc.id)}
                    disabled={isUploading}
                    className="w-full h-9 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {isUploading ? "Uploading…" : "Submit"}
                  </button>
                )}
              </div>
            ) : (
              !readOnly && (
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-sm portal-muted hover:border-rose-400 cursor-pointer">
                  <Upload size={16} /> Choose JPG, PNG, or PDF
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,.pdf,application/pdf"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => onSelect(e, doc.id)}
                  />
                </label>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

function EventTicketTypesFields({ readOnly }: { readOnly: boolean }) {
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
  } = useFormContext<EventFormValues>();
  const {
    fields: ticketFields,
    append,
    remove,
  } = useFieldArray({ control, name: "showtimes.0.ticket_types" });

  const tickets = watch("showtimes.0.ticket_types") || [];
  const showtimeCount = (watch("showtimes") || []).length;
  const venueBusinessId = watch("showtimes.0.venue_business_id");
  const venueLayoutId = watch("showtimes.0.venue_layout_template_id");

  const { data: ticketVenueLayout } = useGetOrganizerVenueLayoutQuery(
    { businessId: venueBusinessId!, templateId: venueLayoutId! },
    { skip: !venueBusinessId || !venueLayoutId }
  );

  useEffect(() => {
    if (showtimeCount <= 1) return;
    const source = (getValues("showtimes.0.ticket_types") || []).map((t) => ({ ...t }));
    for (let i = 1; i < showtimeCount; i++) {
      setValue(`showtimes.${i}.ticket_types`, source, { shouldDirty: false });
    }
  }, [tickets, showtimeCount, getValues, setValue]);

  const labelClass = "portal-label block text-sm font-semibold mb-1.5";
  const inputClass = "input-field w-full";

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-slate-800">Ticket types</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Add ticket types, price, seat count, and max tickets per order. These apply to all venues.
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            {ticketVenueLayout && (
              <button
                type="button"
                onClick={() => {
                  const generated = generateTicketTypesFromLayout(
                    ticketVenueLayout,
                    ticketVenueLayout.capacity
                  );
                  setValue("showtimes.0.ticket_types", generated, { shouldDirty: true });
                  const count = (getValues("showtimes") || []).length;
                  for (let i = 1; i < count; i++) {
                    setValue(`showtimes.${i}.ticket_types`, generated, { shouldDirty: false });
                  }
                  toast.success(
                    `Generated ${generated.length} ticket types matching layout (${ticketVenueLayout.capacity || "stadium"} seats)`
                  );
                }}
                className="text-xs text-amber-800 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <span>⚡ Auto-fill from venue layout</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                // Preserve schedule fields — nested field-array append can drop siblings
                const rows = [...(getValues("showtimes") || [])];
                const row0 = rows[0] ? { ...rows[0] } : defaultVenue();
                append(defaultTicketType());
                // Re-apply schedule after tick so append cannot drop date/time
                requestAnimationFrame(() => {
                  const latest = [...(getValues("showtimes") || [])];
                  if (!latest[0]) latest[0] = defaultVenue();
                  latest[0] = {
                    ...latest[0],
                    event_date: row0.event_date || latest[0].event_date || "",
                    start_time: normalizeTimeToHm(row0.start_time || latest[0].start_time || ""),
                    end_time: normalizeTimeToHm(row0.end_time || latest[0].end_time || ""),
                  };
                  setValue("showtimes", latest, { shouldDirty: true });
                });
              }}
              className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1 shrink-0 font-medium"
            >
              <Plus size={14} /> Add type
            </button>
          </div>
        )}
      </div>

      {ticketFields.length === 0 && (
        <p className="text-xs text-slate-500">No ticket type selected yet. Click Add type to create one.</p>
      )}
      {ticketFields.map((field, ti) => (
        <div
          key={field.id}
          className="grid sm:grid-cols-4 gap-3 items-start rounded-lg border border-slate-200 bg-white p-3"
        >
          <div>
            <label className={labelClass}>Type name</label>
            <input
              disabled={readOnly}
              className={inputClass}
              {...register(`showtimes.0.ticket_types.${ti}.ticket_type`)}
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
              {...register(`showtimes.0.ticket_types.${ti}.total_count`, { valueAsNumber: true })}
            />
          </div>
          <div>
            <label className={labelClass}>Price (ETB)</label>
            <input
              disabled={readOnly}
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              {...register(`showtimes.0.ticket_types.${ti}.price`, { valueAsNumber: true })}
            />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className={labelClass}>Max per order</label>
              <input
                disabled={readOnly}
                type="number"
                min={1}
                className={inputClass}
                {...register(`showtimes.0.ticket_types.${ti}.max_per_order`, {
                  valueAsNumber: true,
                })}
              />
            </div>
            {!readOnly && (
              <button
                type="button"
                onClick={() => remove(ti)}
                className="p-2.5 text-slate-400 hover:text-rose-600 self-end"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      ))}
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
  venueDocuments = [],
  documents = [],
  uploading = false,
  uploadingId = null,
  onDocumentSelect,
  onDocumentSubmitPending,
  onDocumentRemove,
}: {
  index: number;
  readOnly: boolean;
  canRemove: boolean;
  onRemove: () => void;
  cities: CityMaster[];
  hostingType?: "single" | "tour";
  venueDocuments?: EventDocumentMaster[];
  documents?: EventDocumentUpload[];
  uploading?: boolean;
  uploadingId?: number | null;
  onDocumentSelect?: (e: React.ChangeEvent<HTMLInputElement>, documentTypeId: number) => void;
  onDocumentSubmitPending?: (documentTypeId: number) => void;
  onDocumentRemove?: (documentTypeId: number) => void;
}) {
  const {
    register,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useFormContext<EventFormValues>();

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
  const layoutMode = watch(`showtimes.${index}.layout_mode`) || "none";
  const customLayoutCapacity = watch(`showtimes.${index}.custom_layout_capacity`);
  const layoutCapacitySnapshot = watch(`showtimes.${index}.layout_capacity_snapshot`);
  const layoutSeatCountSnapshot = watch(`showtimes.${index}.layout_seat_count_snapshot`);
  const ticketTypes = watch(`showtimes.${index}.ticket_types`) || [];
  const ticketCapacitySummary = useMemo(
    () =>
      getTicketCapacitySummary({
        venue_name: venueName,
        layout_mode: layoutMode,
        custom_layout_capacity: customLayoutCapacity,
        layout_capacity_snapshot: layoutCapacitySnapshot,
        layout_seat_count_snapshot: layoutSeatCountSnapshot,
        ticket_types: ticketTypes,
      }),
    [
      venueName,
      layoutMode,
      customLayoutCapacity,
      layoutCapacitySnapshot,
      layoutSeatCountSnapshot,
      ticketTypes,
    ]
  );
  const ticketValidationMessage = useMemo(
    () =>
      validateShowtimeTickets({
        venue_name: venueName,
        layout_mode: layoutMode,
        custom_layout_capacity: customLayoutCapacity,
        layout_capacity_snapshot: layoutCapacitySnapshot,
        layout_seat_count_snapshot: layoutSeatCountSnapshot,
        ticket_types: ticketTypes,
      }),
    [
      venueName,
      layoutMode,
      customLayoutCapacity,
      layoutCapacitySnapshot,
      layoutSeatCountSnapshot,
      ticketTypes,
    ]
  );
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
  const errorClass = "field-error";
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
            onUnregisteredVenue={(name) => {
              setValue(`showtimes.${index}.venue_name`, name, { shouldDirty: true, shouldValidate: true });
              setValue(`showtimes.${index}.venue_source`, "manual", { shouldDirty: true });
              setValue(`showtimes.${index}.venue_business_id`, null, { shouldDirty: true });
              // Keep address/city the user already entered — do not wipe on city filter refetch.
              setValue(`showtimes.${index}.venue_layout_template_id`, null, { shouldDirty: true });
              const proposal = getValues(`showtimes.${index}.venue_proposal`);
              if (!proposal) {
                setValue(
                  `showtimes.${index}.venue_proposal`,
                  {
                    contact_name: "",
                    contact_phone: "",
                    contact_email: "",
                    capacity: null,
                    facilities: [],
                    image_urls: [],
                    notes: "",
                  },
                  { shouldDirty: false }
                );
              }
              setAddingNewVenue(true);
            }}
            onVenueSelected={() => setAddingNewVenue(false)}
            onRegisteredMatches={() => {
              if (!venueBusinessId) setAddingNewVenue(false);
            }}
          />
        </div>

        {venueBusinessId && (
          <div className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 space-y-1">
            <p className="text-sm font-medium text-slate-800">{venueName}</p>
            <p className="text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Registered address: </span>
              {venueAddress.trim() || "No registered address on file"}
            </p>
            {(() => {
              const city = cities.find((c) => c.id === cityId);
              const cityLine = [city?.name, city?.state, city?.country].filter(Boolean).join(", ");
              return cityLine ? (
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">City: </span>
                  {cityLine}
                </p>
              ) : null;
            })()}
            <p className={`text-[11px] ${isVerifiedSelected ? "text-emerald-700" : "text-amber-700"}`}>
              {isVerifiedSelected
                ? "Verified partner venue selected — address is taken from venue registration."
                : "Venue in system — not platform-authorized"}
            </p>
          </div>
        )}

        {showManualVenueFields && (
          <>
            <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <p className="text-sm font-semibold text-amber-950">
                This venue is not registered in the system
              </p>
              <p className="text-xs text-amber-900 mt-1">
                Add venue-related information below to continue.
                {venueName.trim() ? ` Venue name: ${venueName.trim()}.` : ""}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Venue address <span className="text-rose-500">*</span>
              </label>
              <input
                disabled={readOnly}
                className={inputClass}
                {...register(`showtimes.${index}.venue_address`)}
                placeholder="Full street address"
              />
              {errors.showtimes?.[index]?.venue_address && (
                <p className={errorClass}>{errors.showtimes[index]?.venue_address?.message}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>
                Contact person name <span className="text-rose-500">*</span>
              </label>
              <input
                disabled={readOnly}
                className={inputClass}
                {...register(`showtimes.${index}.venue_proposal.contact_name`)}
                placeholder="Person to contact at this venue"
              />
              {errors.showtimes?.[index]?.venue_proposal?.contact_name && (
                <p className={errorClass}>
                  {errors.showtimes[index]?.venue_proposal?.contact_name?.message}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>
                Email <span className="text-rose-500">*</span>
              </label>
              <input
                disabled={readOnly}
                type="email"
                className={inputClass}
                {...register(`showtimes.${index}.venue_proposal.contact_email`)}
                placeholder="venue@example.com"
              />
              {errors.showtimes?.[index]?.venue_proposal?.contact_email && (
                <p className={errorClass}>
                  {errors.showtimes[index]?.venue_proposal?.contact_email?.message}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>
                Phone number <span className="text-rose-500">*</span>
              </label>
              <input
                disabled={readOnly}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                className={inputClass}
                placeholder="9–12 digits only"
                value={watch(`showtimes.${index}.venue_proposal.contact_phone`) || ""}
                onChange={(e) => {
                  setValue(
                    `showtimes.${index}.venue_proposal.contact_phone`,
                    e.target.value.replace(/\D/g, "").slice(0, 12),
                    { shouldDirty: true, shouldValidate: true }
                  );
                }}
              />
              <p className="text-xs text-slate-500 mt-1">
                Numbers only — 9 to 12 digits. Letters and special characters are not allowed.
              </p>
              {errors.showtimes?.[index]?.venue_proposal?.contact_phone && (
                <p className={errorClass}>
                  {errors.showtimes[index]?.venue_proposal?.contact_phone?.message}
                </p>
              )}
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

      {hostingType === "tour" ? (
        <>
          <div>
            <p className={labelClass}>Stop schedule</p>
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
          </div>

          {durationType === "ONE_DAY" ? (
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Date <span className="text-rose-500">*</span></label>
                <EventDateField
                  disabled={readOnly}
                  inputClass={inputClass}
                  value={eventDate}
                  onChange={(ymd) => {
                    const rows = [...(getValues("showtimes") || [])];
                    if (!rows[index]) return;
                    rows[index] = { ...rows[index], event_date: ymd };
                    setValue("showtimes", rows, { shouldDirty: true });
                  }}
                />
              </div>
              <div>
                <label className={labelClass}>Start time <span className="text-rose-500">*</span></label>
                <TimeHmFields
                  disabled={readOnly}
                  inputClass={inputClass}
                  value={startTime}
                  onChange={(hm) => {
                    const rows = [...(getValues("showtimes") || [])];
                    if (!rows[index]) return;
                    rows[index] = { ...rows[index], start_time: hm };
                    setValue("showtimes", rows, { shouldDirty: true });
                  }}
                />
                {startTime && eventDate && (
                  <p className="text-xs text-slate-600 mt-1">{formatTime12h(`${eventDate}T${normalizeTimeToHm(startTime)}`)}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>End time</label>
                <TimeHmFields
                  disabled={readOnly}
                  inputClass={inputClass}
                  value={endTime}
                  onChange={(hm) => {
                    const rows = [...(getValues("showtimes") || [])];
                    if (!rows[index]) return;
                    rows[index] = { ...rows[index], end_time: hm };
                    setValue("showtimes", rows, { shouldDirty: true });
                  }}
                />
                {endTime && eventDate && (
                  <p className="text-xs text-slate-600 mt-1">{formatTime12h(`${eventDate}T${normalizeTimeToHm(endTime)}`)}</p>
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
        </>
      ) : (
        <p className="text-xs text-slate-500 rounded-lg border border-slate-200 bg-white px-3 py-2">
          Event date, start time, and duration are set in the <strong>Event details</strong> step.
        </p>
      )}

      <div className="space-y-3 pt-2 border-t border-slate-200">
        <div>
          <p className="text-sm font-semibold text-slate-800">Ticket capacity</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Ticket types are set above on this Venue step. Total seats must fit within the layout capacity when a
            layout is selected.
          </p>
        </div>

        {ticketTypes.length === 0 ? (
          <p className="text-xs text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            No ticket types yet. Add them in the Ticket types section above.
          </p>
        ) : (
          <p className="text-xs text-slate-600">
            {(ticketTypes || []).length} ticket type(s)
            {(ticketTypes || [])
              .map((t) => ` · ${t.ticket_type || "Untitled"} (${t.total_count || 0} @ ${t.price ?? "—"})`)
              .join("")}
          </p>
        )}

        {(layoutMode === "standard" || layoutMode === "custom") && (
          <div
            className={`rounded-lg border px-3 py-2.5 text-xs ${
              ticketCapacitySummary.overCapacity
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : ticketCapacitySummary.layoutCapacity != null
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {layoutMode === "standard" && ticketCapacitySummary.layoutCapacity == null ? (
              <p>Select a published layout above to see seat capacity limits.</p>
            ) : layoutMode === "custom" && ticketCapacitySummary.layoutCapacity == null ? (
              <p>
                Custom layout requested — ticket totals are not limited by a seat-map capacity yet.
                Super Admin will build the layout after you submit.
              </p>
            ) : (
              <p>
                Layout capacity: <strong>{ticketCapacitySummary.layoutCapacity}</strong>
                {" · "}
                Tickets allocated: <strong>{ticketCapacitySummary.totalTickets}</strong>
                {ticketCapacitySummary.remaining != null ? (
                  <>
                    {" · "}
                    Remaining: <strong>{ticketCapacitySummary.remaining}</strong>
                  </>
                ) : null}
              </p>
            )}
            {ticketValidationMessage ? (
              <p className="mt-1 font-medium">{ticketValidationMessage}</p>
            ) : null}
          </div>
        )}
      </div>

      {index === 0 && onDocumentSelect && onDocumentSubmitPending && onDocumentRemove && (
        <div className="space-y-3 pt-2 border-t border-slate-200">
          <div>
            <p className="text-sm font-semibold text-slate-800">Venue documents</p>
            <p className="text-xs text-slate-500 mt-1">
              Choose a file, then click Submit on that field to upload. General event documents are on the Media step.
            </p>
          </div>
          {venueDocuments.length > 0 ? (
            <EventDocUploadsList
              docs={venueDocuments}
              documents={documents}
              readOnly={readOnly}
              uploading={uploading}
              uploadingId={uploadingId}
              onSelect={onDocumentSelect}
              onSubmitPending={onDocumentSubmitPending}
              onRemove={onDocumentRemove}
            />
          ) : (
            <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2">
              No venue document types configured for this category yet.
            </p>
          )}
        </div>
      )}
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
  const errorClass = "field-error";
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
                        className={`w-full text-left px-3 py-2 hover:bg-rose-50 flex items-center gap-3 ${
                          businessId === a.id ? "bg-rose-50" : ""
                        }`}
                      >
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-[#F7E9FF] shrink-0">
                          <SafeCoverImage
                            src={a.cover_image_url ? resolveMediaUrl(a.cover_image_url) : ""}
                            alt=""
                            className="h-full w-full object-cover"
                            fallbackClassName={ARTIST_IMAGE_FALLBACK_CLASS}
                            fallback={<ArtistImageFallback size={18} />}
                          />
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
            emptyClassName="flex flex-col items-center justify-center h-28 w-28 rounded-xl border border-dashed border-slate-300 hover:border-rose-400"
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
  /** LIVE events: only posters, gallery, and YouTube can be changed. */
  mediaOnlyEdit?: boolean;
  canSubmit?: boolean;
  onSaveDraft: (payload: EventFormPayload) => Promise<void>;
  onSubmitForApproval: (payload: EventFormPayload) => Promise<void>;
  saving?: boolean;
  submitting?: boolean;
}

export default function EventForm({
  event,
  readOnly = false,
  mediaOnlyEdit = false,
  canSubmit = !event || event.status === "DRAFT",
  onSaveDraft,
  onSubmitForApproval,
  saving = false,
  submitting = false,
}: EventFormProps) {
  const { data: eventCategoryMasters = [] } = useGetEventCategoriesQuery();
  const { data: cities = [] } = useGetCitiesQuery();
  const { data: promoPlans = [] } = useGetPublicMarketingPlansQuery({ module: "EVENTS" });
  const { data: supportContact } = useGetOrganizerSupportContactQuery(undefined, {
    skip: readOnly && !mediaOnlyEdit,
  });
  const supportEmail = supportContact?.email?.trim() || null;
  const supportPhone = supportContact?.phone?.trim() || "998877456";
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();
  const mediaLocked = readOnly && !mediaOnlyEdit;
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
  const [stepId, setStepId] = useState<EventStepperStepId>("details");
  const [visitedSteps, setVisitedSteps] = useState<EventStepperStepId[]>(() =>
    event ? getEventStepperSteps(event.category_slug).map((s) => s.id) : ["details"]
  );
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [layoutPickByRequest, setLayoutPickByRequest] = useState<Record<string, string>>({});
  const [layoutRejectId, setLayoutRejectId] = useState<string | null>(null);
  const [layoutRejectReason, setLayoutRejectReason] = useState("");
  const [layoutViewing, setLayoutViewing] = useState<{
    id: string;
    name: string;
    seats_json?: unknown[];
    seating_config?: Record<string, unknown> | null;
  } | null>(null);
  const [reviewLayoutRequest, { isLoading: reviewingLayout }] =
    useReviewOrganizerEventLayoutRequestMutation();
  const [pendingChangesSaved, setPendingChangesSaved] = useState(false);

  const pendingLayoutPicks = useMemo(
    () =>
      (event?.layout_requests || []).filter(
        (r) => String(r.status) === "PENDING_ORGANIZER_APPROVAL"
      ),
    [event?.layout_requests]
  );
  const waitingForAdminLayout = useMemo(
    () =>
      (event?.layout_requests || []).filter((r) =>
        ["SUBMITTED", "UNDER_REVIEW", "ORGANIZER_CHANGE_REQUESTED"].includes(String(r.status))
      ),
    [event?.layout_requests]
  );

  const categories = useMemo(
    () =>
      eventCategoryMasters.map((c) => ({
        id: c.category_type_id,
        name: c.name,
        slug: c.slug ?? undefined,
      })),
    [eventCategoryMasters]
  );

  const methods = useForm<EventFormValues>({
    defaultValues: eventToValues(event),
    // raw: true — yup cast/defaults must not wipe sibling fields (e.g. event_date) on trigger()
    resolver: yupResolver(eventDraftSchema, undefined, { raw: true }),
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
    formState: { errors, isDirty },
  } = methods;

  useEffect(() => {
    if (isDirty) setPendingChangesSaved(false);
  }, [isDirty]);

  const categoryTypeId = watch("category_type_id");
  const genres = watch("genres") || [];
  const languages = watch("languages") || [];
  const categoryMeta = (watch("category_meta") || {}) as EventCategoryMeta;
  const posterHorizontal = watch("poster_horizontal_url");
  const posterVertical = watch("poster_vertical_url");
  const galleryImages = watch("gallery_images") || [];
  const wantPromotion = watch("want_promotion");
  const promoPlanId = watch("promo_plan_id");
  const promoBannerUrl = watch("promo_banner_url");
  const selectedPromoPlan = useMemo(
    () => promoPlans.find((p) => String(p.id) === String(promoPlanId || "")),
    [promoPlans, promoPlanId]
  );
  const allowedTicketModes = watch("allowed_ticket_modes") || [];
  const aboutEvent = watch("about_event") || "";
  const durationMinutesTotal = Number(watch("duration_minutes") || 0);
  const watchedValues = watch();

  const categorySlug = useMemo(() => {
    if (!categoryTypeId) return event?.category_slug || "";
    return categories.find((c) => c.id === categoryTypeId)?.slug || "";
  }, [categories, categoryTypeId, event?.category_slug]);

  const steps = useMemo(() => getEventStepperSteps(categorySlug), [categorySlug]);
  const isSports = isSportsCategory(categorySlug);
  const sportMeta = getSportMeta(categoryMeta);
  const primarySportGenre = genres[0] || "";
  const sportExtraFields = useMemo(
    () => getSportExtraFields(primarySportGenre),
    [primarySportGenre]
  );

  const { data: masters, isLoading: mastersLoading } = useGetEventMastersQuery(categoryTypeId!, {
    skip: !categoryTypeId,
  });

  const eventDocuments = useMemo(
    () => filterDocumentsByAppliesTo(masters?.documents, "event"),
    [masters?.documents]
  );
  const venueDocuments = useMemo(
    () => filterDocumentsByAppliesTo(masters?.documents, "venue"),
    [masters?.documents]
  );
  const artistDocuments = useMemo(
    () => filterDocumentsByAppliesTo(masters?.documents, "artist"),
    [masters?.documents]
  );

  useEffect(() => {
    const allowed = new Set(steps.map((s) => s.id));
    if (stepId === "documents" && allowed.has("media")) {
      setStepId("media");
      return;
    }
    if (!allowed.has(stepId)) {
      setStepId("details");
    }
    setVisitedSteps((prev) => {
      const next = prev.filter((id) => allowed.has(id));
      if (!next.includes("details") && allowed.has("details")) next.push("details");
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
  }, [steps, stepId]);

  const completedStepIds = useMemo(() => {
    return getCompletedEventStepIds({
      hostingType,
      values: watchedValues,
      documents,
      requiredDocumentIds: eventDocuments.filter((d) => d.is_required).map((d) => d.id),
      genresConfigured: (masters?.genres?.length || 0) > 0,
      categorySlug,
    });
  }, [hostingType, watchedValues, documents, eventDocuments, masters?.genres, categorySlug]);

  const updateSportMeta = (patch: Partial<SportMeta>) => {
    const next: EventCategoryMeta = {
      ...categoryMeta,
      sport: {
        ...defaultSportMeta(),
        ...sportMeta,
        ...patch,
        extras: {
          ...(sportMeta.extras || {}),
          ...(patch.extras || {}),
        },
      },
    };
    setValue("category_meta", next, { shouldDirty: true });
  };

  const updateSportExtra = (key: string, value: string) => {
    updateSportMeta({
      extras: {
        ...(sportMeta.extras || {}),
        [key]: value,
      },
    });
  };

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

  const buildPayload = (
    values: EventFormValues,
    opts?: { forDraft?: boolean; documentsOverride?: EventDocumentUpload[] }
  ): EventFormPayload => {
    const draftMode = opts?.forDraft === true;
    const docsForPayload = opts?.documentsOverride ?? documents;
    const rawShowtimes = values.showtimes || [];
    const persistableShowtimes = draftMode
      ? rawShowtimes.filter((s) => isShowtimePersistable(s, values.duration_minutes))
      : rawShowtimes;
    const showtimes = persistableShowtimes.map((s, stopIndex) => {
      const range = showtimeToIso(
        hostingType === "single" ? { ...s, end_time: "" } : s,
        values.duration_minutes
      );
      const venueSource =
        s.venue_business_id && s.venue_source === "registered"
          ? "registered"
          : s.venue_business_id && s.venue_source === "auto_registered"
            ? "auto_registered"
            : "manual";
      const canUseStandardLayouts = venueSource === "registered" && Boolean(s.venue_business_id);
      const layoutMode =
        s.layout_mode === "custom"
          ? "custom"
          : canUseStandardLayouts && (s.layout_mode === "standard" || (Boolean(s.venue_layout_template_id) && s.layout_mode !== "none"))
            ? "standard"
            : "none";
      const originalIndex = rawShowtimes.indexOf(s);
      const stopOrderIndex = originalIndex >= 0 ? originalIndex : stopIndex;
      return {
        venue_name: s.venue_name.trim() || (draftMode ? "Venue TBD" : s.venue_name.trim()),
        venue_address: s.venue_address?.trim() || "",
        city_id: s.city_id ?? null,
        venue_source: venueSource as "manual" | "registered" | "auto_registered",
        venue_business_id: s.venue_business_id || null,
        venue_layout_template_id: s.venue_layout_template_id || null,
        layout_mode: layoutMode as "none" | "standard" | "custom",
        custom_layout_name:
          layoutMode === "custom"
            ? s.custom_layout_name?.trim() || "Custom event seating layout"
            : null,
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
        venue_proposal:
          venueSource === "registered"
            ? null
            : {
                contact_name: String(s.venue_proposal?.contact_name || "").trim(),
                contact_phone: String(s.venue_proposal?.contact_phone || "").trim(),
                contact_email: String(s.venue_proposal?.contact_email || "").trim(),
                capacity: s.venue_proposal?.capacity ?? null,
                facilities: Array.isArray(s.venue_proposal?.facilities)
                  ? s.venue_proposal.facilities
                  : [],
                image_urls: Array.isArray(s.venue_proposal?.image_urls)
                  ? s.venue_proposal.image_urls
                  : [],
                notes: String(s.venue_proposal?.notes || "").trim(),
              },
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
      documents: docsForPayload.filter((d) => d.document_type_id > 0 && d.url?.trim()),
      languages: values.languages || [],
      language: (values.languages || []).join(", "),
      about_event: values.about_event.trim(),
      age_group: values.age_group || "",
      duration_minutes:
        values.duration_minutes ??
        computeDurationMinutesFromShowtimes(values.showtimes, values.duration_minutes) ??
        null,
      terms_points: {
        selected: selectedTerms,
        custom: customTerms.map((t) => t.trim()).filter(Boolean),
      },
      allowed_ticket_modes: normalizeAllowedTicketModes(values.allowed_ticket_modes, {
        expandEmpty: false,
      }),
      category_meta: values.category_meta ?? {},
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
          auto_register_artist:
            isArtist && (source === "external" || (source === "auto_registered" && !a.artist_business_id)),
          sort_order: i,
        };
      }),
      showtimes,
      promotion_request:
        values.want_promotion && values.promo_plan_id && values.promo_title?.trim() && values.promo_start_date
          ? {
              plan_id: Number(values.promo_plan_id),
              title: values.promo_title.trim(),
              banner_image_url: values.promo_banner_url?.trim() || undefined,
              slider_accent_text: values.promo_slider_accent_text?.trim() || null,
              start_date: values.promo_start_date,
            }
          : null,
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
      return isSports
        ? "Select at least one sport type for this event."
        : "Select at least one genre for this category.";
    }
    if (isSports && !isSportMetaComplete(getValues("category_meta") as EventCategoryMeta)) {
      return "Home team and away team are required for sport events.";
    }
    const requiredDocs = eventDocuments.filter((d) => d.is_required);
    const eventDocsErr = validateRequiredDocuments(
      documents.filter((d) => d.document_type_id > 0),
      requiredDocs.map((d) => d.id),
      Object.fromEntries(requiredDocs.map((d) => [d.id, d.name]))
    );
    if (eventDocsErr) return eventDocsErr;

    const requiredVenueDocs = venueDocuments.filter((d) => d.is_required);
    const venueDocsErr = validateRequiredDocuments(
      documents.filter((d) => d.document_type_id > 0),
      requiredVenueDocs.map((d) => d.id),
      Object.fromEntries(requiredVenueDocs.map((d) => [d.id, d.name]))
    );
    if (venueDocsErr) return venueDocsErr;

    const requiredArtistDocs = artistDocuments.filter((d) => d.is_required);
    return validateRequiredDocuments(
      documents.filter((d) => d.document_type_id > 0),
      requiredArtistDocs.map((d) => d.id),
      Object.fromEntries(requiredArtistDocs.map((d) => [d.id, d.name]))
    );
  };

  const saveLockRef = useRef(false);

  const resolveDocumentsForSubmit = async (
    docs: EventDocumentUpload[]
  ): Promise<EventDocumentUpload[]> => {
    const out: EventDocumentUpload[] = [];
    for (const d of docs) {
      if (d.pending_file) {
        const formData = new FormData();
        formData.append("image", d.pending_file);
        const res = await uploadImage(formData).unwrap();
        const url = extractUploadUrl(res) || res.url;
        if (!url) throw new Error(`Failed to upload ${d.pending_file_name || "document"}`);
        if (d.pending_preview_url) {
          try {
            URL.revokeObjectURL(d.pending_preview_url);
          } catch {
            /* ignore */
          }
        }
        out.push({
          document_type_id: d.document_type_id,
          url,
          document_name: d.document_name,
        });
      } else if (d.url?.trim()) {
        out.push({
          document_type_id: d.document_type_id,
          url: d.url,
          document_name: d.document_name,
        });
      }
    }
    return out;
  };

  const runSaveDraft = async () => {
    if (saveLockRef.current || saving || submitting) return;
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
    saveLockRef.current = true;
    try {
      const resolvedDocs = await resolveDocumentsForSubmit(documents);
      setDocuments(resolvedDocs);
      const payload = buildPayload(values, { forDraft: true, documentsOverride: resolvedDocs });
      await onSaveDraft(payload);
      if (event?.status === "PENDING_APPROVAL") {
        reset(getValues());
        setPendingChangesSaved(true);
      }
    } catch (e) {
      toast.error(extractApiError(e, "Failed to save draft"));
    } finally {
      saveLockRef.current = false;
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
    if (values.want_promotion) {
      if (!values.promo_plan_id?.trim() || !values.promo_title?.trim() || !values.promo_start_date?.trim()) {
        toast.error("Complete the promotion fields in Media, or turn off Add promotion.");
        goToStep("media");
        return;
      }
      const eventDate = String(values.showtimes?.[0]?.event_date || "").trim();
      const promoStart = values.promo_start_date.trim();
      if (eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate) && promoStart > eventDate) {
        toast.error("Promotion start date cannot be after the event date.");
        goToStep("media");
        return;
      }
      if (values.promo_landing_slider && !values.promo_banner_url?.trim()) {
        toast.error("Banner image is required for the selected promotion plan.");
        goToStep("media");
        return;
      }
    }
    const masterErr = validateMasters(true);
    if (masterErr) {
      toast.error(masterErr);
      return;
    }
    try {
      const resolvedDocs = await resolveDocumentsForSubmit(documents);
      setDocuments(resolvedDocs);
      const payload = buildPayload(values, { documentsOverride: resolvedDocs });
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

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>, documentTypeId: number) => {
    if (!e.target.files?.length || readOnly) return;
    const file = e.target.files[0];
    const name = file.name.toLowerCase();
    const okType =
      file.type.startsWith("image/") ||
      file.type === "application/pdf" ||
      /\.(jpe?g|png|webp|gif|pdf)$/i.test(name);
    if (!okType) {
      toast.error("Only JPG, PNG, or PDF files are allowed.");
      e.target.value = "";
      return;
    }
    setDocuments((prev) => {
      const existing = prev.find((d) => d.document_type_id === documentTypeId);
      if (existing?.pending_preview_url) {
        try {
          URL.revokeObjectURL(existing.pending_preview_url);
        } catch {
          /* ignore */
        }
      }
      return [
        ...prev.filter((d) => d.document_type_id !== documentTypeId),
        {
          document_type_id: documentTypeId,
          url: "",
          pending_file: file,
          pending_file_name: file.name,
          pending_preview_url: URL.createObjectURL(file),
        },
      ];
    });
    e.target.value = "";
  };

  const [docUploadingId, setDocUploadingId] = useState<number | null>(null);

  const handleDocumentSubmitPending = async (documentTypeId: number) => {
    if (readOnly) return;
    const entry = documents.find((d) => d.document_type_id === documentTypeId);
    if (!entry?.pending_file) return;
    setDocUploadingId(documentTypeId);
    const formData = new FormData();
    formData.append("image", entry.pending_file);
    try {
      const res = await uploadImage(formData).unwrap();
      const url = extractUploadUrl(res) || res.url;
      if (!url) throw new Error("Upload failed");
      if (entry.pending_preview_url) {
        try {
          URL.revokeObjectURL(entry.pending_preview_url);
        } catch {
          /* ignore */
        }
      }
      setDocuments((prev) => [
        ...prev.filter((d) => d.document_type_id !== documentTypeId),
        {
          document_type_id: documentTypeId,
          url,
          document_name: entry.document_name,
        },
      ]);
      toast.success("Document uploaded");
    } catch (err) {
      toast.error(extractApiError(err, `Failed to upload ${entry.pending_file_name || "document"}`));
    } finally {
      setDocUploadingId(null);
    }
  };

  const removeDocument = (documentTypeId: number) => {
    setDocuments((prev) => {
      const existing = prev.find((d) => d.document_type_id === documentTypeId);
      if (existing?.pending_preview_url) {
        try {
          URL.revokeObjectURL(existing.pending_preview_url);
        } catch {
          /* ignore */
        }
      }
      return prev.filter((d) => d.document_type_id !== documentTypeId);
    });
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
          <div>
            <p className="font-medium">
              Submitted for Super Admin review. You can still edit details until it is approved.
            </p>
            <p className="mt-1 text-xs opacity-90">
              After editing (for example changing to a custom layout), open Preview and click{" "}
              <strong>Save changes</strong> so Super Admin can see the update.
            </p>
          </div>
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
          This event is {event.status === "LIVE" ? "live" : "approved"}.
          {event.status === "APPROVED"
            ? " It stays hidden until Super Admin publishes it after the contract is fully signed."
            : " You can only update posters, gallery, and YouTube — all other details stay locked."}
        </div>
      );
    }
    return null;
  };

  const labelClass = "portal-label block text-sm font-semibold mb-1.5";
  const errorClass = "field-error";
  const inputClass = "input-field w-full";

  const stepIndex = steps.findIndex((s) => s.id === stepId);
  const isFirstStep = stepIndex <= 0;
  const isLastStep = stepId === "review";

  const markVisited = (id: EventStepperStepId) => {
    setVisitedSteps((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  /** A later step is unlocked only when every previous step is complete. */
  const isStepUnlocked = (targetId: EventStepperStepId): boolean => {
    const targetIndex = steps.findIndex((s) => s.id === targetId);
    if (targetIndex <= 0) return true;
    if (targetIndex <= stepIndex) return true;
    for (let i = 0; i < targetIndex; i += 1) {
      const prevId = steps[i]?.id;
      if (!prevId) return false;
      if (!completedStepIds.includes(prevId)) return false;
    }
    return true;
  };

  const validateCurrentStep = async (): Promise<boolean> => {
    if (stepId === "details") {
      if (!hostingType) {
        toast.error("Choose Single Event or Tour to continue.");
        return false;
      }

      // Snapshot schedule before trigger — yup cast can clear nested showtimes fields
      const show0 = (getValues("showtimes") || [])[0];
      const eventDateBefore = String(show0?.event_date || getValues("showtimes.0.event_date") || "").trim();
      const startTimeNorm = normalizeTimeToHm(
        show0?.start_time || getValues("showtimes.0.start_time") || ""
      );

      if (hostingType === "single") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDateBefore)) {
          toast.error("Set the event date.");
          return false;
        }
        if (!startTimeNorm) {
          toast.error("Set the start time (hours and minutes).");
          return false;
        }
        // Persist normalized HH:mm (no seconds) onto showtimes[0]
        const rows = [...(getValues("showtimes") || [])];
        if (!rows[0]) rows[0] = defaultVenue();
        rows[0] = {
          ...rows[0],
          event_date: eventDateBefore,
          start_time: startTimeNorm,
          // Single events derive end from duration — drop stale end_time leftovers.
          end_time: "",
          ends_at: "",
          duration_type: "ONE_DAY",
        };
        setValue("showtimes", rows, { shouldDirty: true });

        const durationMins = Number(getValues("duration_minutes") || 0);
        if (!durationMins || durationMins < 1) {
          toast.error("Set event duration in minutes.");
          return false;
        }
      }

      const ok = await trigger([
        "name",
        "category_type_id",
        "genres",
        "languages",
        "age_group",
        "about_event",
        "allowed_ticket_modes",
      ]);

      // Restore schedule if resolver cast cleared it
      if (hostingType === "single" && eventDateBefore && startTimeNorm) {
        const rows = [...(getValues("showtimes") || [])];
        if (!rows[0]) rows[0] = defaultVenue();
        rows[0] = {
          ...rows[0],
          event_date: eventDateBefore,
          start_time: startTimeNorm,
          end_time: "",
          ends_at: "",
          duration_type: "ONE_DAY",
        };
        setValue("showtimes", rows, { shouldDirty: true });
      }

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
      if (!values.age_group?.trim()) {
        toast.error("Age group is required.");
        return false;
      }
      if (!values.about_event?.trim()) {
        toast.error("About event is required.");
        return false;
      }
      return true;
    }
    if (stepId === "sport") {
      const values = getValues();
      if (!(values.genres || []).length) {
        toast.error("Select at least one sport type.");
        return false;
      }
      if (!isSportMetaComplete(values.category_meta as EventCategoryMeta)) {
        toast.error("Home team and away team are required.");
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
      if (getValues("want_promotion")) {
        const planId = getValues("promo_plan_id")?.trim();
        const title = getValues("promo_title")?.trim();
        const start = getValues("promo_start_date")?.trim();
        const landing = Boolean(getValues("promo_landing_slider"));
        const banner = getValues("promo_banner_url")?.trim();
        if (!planId) {
          toast.error("Select a promotion plan, or turn off Add promotion.");
          return false;
        }
        if (!title) {
          toast.error("Enter a promotion title.");
          return false;
        }
        if (!start) {
          toast.error("Choose when the promotion should start.");
          return false;
        }
        const today = new Date();
        const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
          today.getDate()
        ).padStart(2, "0")}`;
        if (start < ymd) {
          toast.error("Promotion start date cannot be in the past.");
          return false;
        }
        const eventDate = String(getValues("showtimes.0.event_date") || "").trim();
        if (eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate) && start > eventDate) {
          toast.error("Promotion start date cannot be after the event date.");
          return false;
        }
        if (landing && !banner) {
          toast.error("Banner image is required for this promotion plan.");
          return false;
        }
      }
      const masterErr = validateMasters(true);
      if (masterErr) {
        toast.error(masterErr);
        return false;
      }
      return true;
    }
    if (stepId === "venue") {
      if (hostingType === "single") {
        const rows = [...(getValues("showtimes") || [])];
        const durationMins = Number(getValues("duration_minutes") || 0);
        const next = rows.map((s) => ({
          ...s,
          duration_type: "ONE_DAY" as const,
          end_time: "",
          ends_at: "",
        }));
        setValue("showtimes", next, { shouldDirty: true });
        if (!durationMins || durationMins < 1) {
          toast.error("Set event duration in Event details first.");
          return false;
        }
      }

      const ticketsBefore = getValues("showtimes.0.ticket_types") || [];
      if (!ticketsBefore.length) {
        toast.error("Add at least one ticket type.");
        return false;
      }
      for (const t of ticketsBefore) {
        if (!String(t.ticket_type || "").trim()) {
          toast.error("Each ticket type needs a name.");
          return false;
        }
        if (!Number(t.total_count) || Number(t.total_count) < 1) {
          toast.error("Each ticket type needs total seats of at least 1.");
          return false;
        }
        if (!Number.isFinite(Number(t.price)) || Number(t.price) < 0) {
          toast.error("Each ticket type needs a valid price.");
          return false;
        }
        if (!Number(t.max_per_order) || Number(t.max_per_order) < 1) {
          toast.error("Each ticket type needs a max per order of at least 1.");
          return false;
        }
      }

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
    return true;
  };

  const goToStep = async (id: EventStepperStepId) => {
    if (id === stepId) return;
    const targetIndex = steps.findIndex((s) => s.id === id);
    if (targetIndex < 0) return;

    // Moving forward requires current step validation + unlocked target.
    if (targetIndex > stepIndex) {
      if (!isStepUnlocked(id)) {
        const firstIncomplete = steps.find(
          (s, i) => i < targetIndex && !completedStepIds.includes(s.id)
        );
        toast.error(
          firstIncomplete
            ? `Complete "${firstIncomplete.label}" before continuing.`
            : "Please complete the required fields on the current step first."
        );
        return;
      }
      const ok = await validateCurrentStep();
      if (!ok) return;
    }

    markVisited(stepId);
    setStepId(id);
  };

  const goNext = async () => {
    const ok = await validateCurrentStep();
    if (!ok) return;
    markVisited(stepId);
    const next = steps[stepIndex + 1];
    if (next) setStepId(next.id);
  };

  const goBack = () => {
    const prev = steps[stepIndex - 1];
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
          steps={steps}
          allowJump
          isStepUnlocked={isStepUnlocked}
          onStepClick={(id) => {
            void goToStep(id);
          }}
        />

        {stepId === "details" && (
        <section className="org-card p-6 space-y-5">
          <div>
            <h3 className="portal-heading text-lg font-semibold">Event details</h3>
            <p className="portal-muted text-sm mt-1">
              Choose how this listing is structured, then fill in the basic event information.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-800">What would you like to host?</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                type="button"
                disabled={readOnly}
                onClick={() => {
                  setHostingType("single");
                  const rows = getValues("showtimes") || [];
                  // Single events are one venue only — drop extra stops.
                  for (let i = rows.length - 1; i >= 1; i -= 1) {
                    removeShowtime(i);
                  }
                  setValue(`showtimes.0.duration_type`, "ONE_DAY", { shouldDirty: true });
                  setValue(`showtimes.0.end_time`, "", { shouldDirty: true });
                }}
                className={`text-left rounded-2xl border p-5 transition-all ${
                  hostingType === "single"
                    ? "border-rose-500 bg-rose-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-rose-300"
                }`}
              >
                <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 inline-flex items-center justify-center mb-3">
                  <CalendarDays size={20} />
                </div>
                <p className="font-semibold text-slate-900">Single Event</p>
                <p className="text-sm text-slate-500 mt-1">
                  One concert, comedy show, sports match, or other event at a single venue.
                </p>
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => setHostingType("tour")}
                className={`text-left rounded-2xl border p-5 transition-all ${
                  hostingType === "tour"
                    ? "border-rose-500 bg-rose-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-rose-300"
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
          </div>

          <h3 className="portal-heading text-lg font-semibold pt-2 border-t border-slate-200">Basic details</h3>

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
                setValue("category_meta", {}, { shouldDirty: true });
                setDocuments([]);
              }}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.category_type_id && <p className={errorClass}>{errors.category_type_id.message}</p>}
            <p className="text-[11px] text-slate-500 mt-1">
              Categories are managed in Super Admin → Event Masters → Category Master. Genres and documents load
              for the category you pick.
            </p>
          </div>

          <p className="text-xs text-slate-500 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            Set event duration below. For single events, end time is calculated from start time + duration.
          </p>

          <div>
            <label className={labelClass}>Duration (minutes) <span className="text-rose-500">*</span></label>
            <input
              disabled={readOnly}
              type="number"
              min={1}
              className={inputClass}
              value={durationMinutesTotal > 0 ? durationMinutesTotal : ""}
              onChange={(e) => {
                const mins = Math.max(0, Number(e.target.value) || 0);
                setValue("duration_minutes", mins > 0 ? mins : null, { shouldDirty: true });
              }}
              placeholder="e.g. 120"
            />
          </div>

          {hostingType === "single" && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-800">Event schedule</p>
                <p className="text-xs text-slate-500 mt-1">
                  Date and start time. End time is calculated from the duration above.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Event date <span className="text-rose-500">*</span></label>
                  <EventDateField
                    disabled={readOnly}
                    inputClass={inputClass}
                    value={watch("showtimes.0.event_date") || ""}
                    onChange={(ymd) => {
                      const rows = [...(getValues("showtimes") || [])];
                      if (!rows[0]) rows[0] = defaultVenue();
                      rows[0] = {
                        ...rows[0],
                        event_date: ymd,
                        end_time: "",
                        ends_at: "",
                        duration_type: "ONE_DAY",
                      };
                      setValue("showtimes", rows, { shouldDirty: true });
                    }}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Type the date or use the calendar picker.</p>
                </div>
                <div>
                  <label className={labelClass}>Start time <span className="text-rose-500">*</span></label>
                  <TimeHmFields
                    disabled={readOnly}
                    inputClass={inputClass}
                    value={watch("showtimes.0.start_time")}
                    onChange={(hm) => {
                      const rows = [...(getValues("showtimes") || [])];
                      if (!rows[0]) rows[0] = defaultVenue();
                      rows[0] = {
                        ...rows[0],
                        start_time: hm,
                        end_time: "",
                        ends_at: "",
                        duration_type: "ONE_DAY",
                      };
                      setValue("showtimes", rows, { shouldDirty: true });
                    }}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Hours and minutes only (no seconds). 12-hour clock with AM/PM.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>
              {isSports ? "Sport type" : "Genres"}{" "}
              {masters?.genres?.length ? <span className="text-rose-500">*</span> : null}
            </label>
            {!categoryTypeId ? (
              <p className="portal-muted text-sm">
                Select a category to see available {isSports ? "sport types" : "genres"}.
              </p>
            ) : mastersLoading ? (
              <p className="portal-muted text-sm">Loading {isSports ? "sport types" : "genres"}...</p>
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
                        ? "bg-rose-500/20 text-rose-700 border-rose-500/40"
                        : "portal-muted border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-amber-700 text-sm">
                No {isSports ? "sport types" : "genres"} configured. Ask Super Admin to add them.
              </p>
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
                        ? "bg-rose-500/20 text-rose-700 border-rose-500/40"
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
                        ? "border-rose-500 bg-rose-500/10"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                          selected
                            ? "border-rose-600 bg-rose-600 text-white"
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
            <textarea
              disabled={readOnly}
              rows={4}
              className={`${inputClass} resize-y min-h-[100px]`}
              {...register("about_event")}
              placeholder="Describe the event..."
            />
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p
                className={`text-xs ${
                  countChars(aboutEvent) > MAX_ABOUT_EVENT_CHARS ? "text-rose-600 font-semibold" : "text-slate-500"
                }`}
              >
                {countChars(aboutEvent)} / {MAX_ABOUT_EVENT_CHARS} characters
              </p>
              {errors.about_event && <p className={errorClass}>{errors.about_event.message}</p>}
            </div>
          </div>
        </section>
        )}

        {stepId === "sport" && (
          <section className="org-card p-6 space-y-5">
            <div>
              <h3 className="portal-heading text-lg font-semibold">Sport details</h3>
              <p className="portal-muted text-sm mt-1">
                Teams, tournament, and format for this match. Extra fields adapt to the selected sport type.
              </p>
            </div>

            <div>
              <label className={labelClass}>
                Sport type <span className="text-rose-500">*</span>
              </label>
              {!categoryTypeId ? (
                <p className="portal-muted text-sm">Select a category in Event details first.</p>
              ) : mastersLoading ? (
                <p className="portal-muted text-sm">Loading sport types...</p>
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
                          ? "bg-rose-500/20 text-rose-700 border-rose-500/40"
                          : "portal-muted border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-amber-700 text-sm">No sport types configured. Ask Super Admin to add them.</p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  Home team <span className="text-rose-500">*</span>
                </label>
                <input
                  disabled={readOnly}
                  className={inputClass}
                  value={sportMeta.home_team || ""}
                  onChange={(e) => updateSportMeta({ home_team: e.target.value })}
                  placeholder="e.g. Mumbai City FC"
                />
              </div>
              <div>
                <label className={labelClass}>
                  Away team <span className="text-rose-500">*</span>
                </label>
                <input
                  disabled={readOnly}
                  className={inputClass}
                  value={sportMeta.away_team || ""}
                  onChange={(e) => updateSportMeta({ away_team: e.target.value })}
                  placeholder="e.g. Bengaluru FC"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Tournament / league</label>
              <input
                disabled={readOnly}
                className={inputClass}
                value={sportMeta.tournament_name || ""}
                onChange={(e) => updateSportMeta({ tournament_name: e.target.value })}
                placeholder="e.g. ISL 2026"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Match format</label>
                <select
                  disabled={readOnly}
                  className={inputClass}
                  value={sportMeta.match_format || ""}
                  onChange={(e) =>
                    updateSportMeta({
                      match_format: e.target.value as SportMeta["match_format"],
                    })
                  }
                >
                  <option value="">Select format</option>
                  {SPORT_MATCH_FORMATS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Gender category</label>
                <select
                  disabled={readOnly}
                  className={inputClass}
                  value={sportMeta.gender_category || ""}
                  onChange={(e) =>
                    updateSportMeta({
                      gender_category: e.target.value as SportMeta["gender_category"],
                    })
                  }
                >
                  <option value="">Select category</option>
                  {SPORT_GENDER_CATEGORIES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {sportExtraFields.length > 0 && (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  {primarySportGenre
                    ? `${primarySportGenre} specifics`
                    : "Sport-specific details"}
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {sportExtraFields.map((field) => (
                    <div key={field.key} className={sportExtraFields.length === 1 ? "sm:col-span-2" : ""}>
                      <label className={labelClass}>{field.label}</label>
                      <input
                        disabled={readOnly}
                        type={field.type === "number" ? "number" : "text"}
                        className={inputClass}
                        value={sportMeta.extras?.[field.key] || ""}
                        onChange={(e) => updateSportExtra(field.key, e.target.value)}
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {stepId === "media" && (
        <>
        {mediaOnlyEdit ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
            This event is live. You can update <strong>posters</strong>, <strong>gallery</strong>, and{" "}
            <strong>YouTube</strong> only. Venue, tickets, artists, documents, and other fields stay locked.
          </div>
        ) : null}
        <section className="org-card p-6 space-y-5">
          <h3 className="portal-heading text-lg font-semibold">Posters</h3>
          <p className="portal-muted text-xs">Drag a crop box on the photo, then save. You can edit or remove any image later.</p>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Horizontal poster <span className="text-rose-500">*</span></label>
              <CroppedImageField
                value={posterHorizontal}
                aspect={16 / 9}
                disabled={mediaLocked || uploading}
                previewClassName="w-full aspect-[16/9] rounded-xl border border-slate-200 overflow-hidden bg-slate-100"
                emptyClassName="flex flex-col items-center justify-center w-full aspect-[16/9] rounded-xl border border-dashed border-slate-300 hover:border-rose-400 bg-slate-50"
                onRemove={() => setValue("poster_horizontal_url", "", { shouldDirty: true })}
                onCroppedFile={(file) => uploadCropped(file, (url) => setValue("poster_horizontal_url", url, { shouldDirty: true }))}
                emptyContent={
                  <>
                    <ImagePlus className="text-slate-400 mb-2" size={28} />
                    <span className="text-xs portal-muted">Add landscape poster (16:9)</span>
                  </>
                }
              />
            </div>
            <div>
              <label className={labelClass}>Vertical poster</label>
              <CroppedImageField
                value={posterVertical}
                aspect={2 / 3}
                disabled={mediaLocked || uploading}
                previewClassName="w-[160px] sm:w-[180px] aspect-[2/3] rounded-xl border border-slate-200 overflow-hidden bg-slate-100"
                emptyClassName="flex flex-col items-center justify-center w-[160px] sm:w-[180px] aspect-[2/3] rounded-xl border border-dashed border-slate-300 hover:border-rose-400 bg-slate-50"
                onRemove={() => setValue("poster_vertical_url", "", { shouldDirty: true })}
                onCroppedFile={(file) => uploadCropped(file, (url) => setValue("poster_vertical_url", url, { shouldDirty: true }))}
                emptyContent={
                  <>
                    <ImagePlus className="text-slate-400 mb-2" size={28} />
                    <span className="text-xs portal-muted">Add portrait poster (2:3)</span>
                  </>
                }
              />
            </div>
          </div>
        </section>

        <section className="org-card p-6 space-y-4">
          <h3 className="portal-heading text-lg font-semibold">Gallery</h3>
          <p className="portal-muted text-sm">Photos customers will see on the event details page.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {galleryImages.map((url, i) => (
              <CroppedImageField
                key={`${url}-${i}`}
                value={url}
                aspect={4 / 3}
                disabled={mediaLocked || uploading}
                previewClassName="aspect-[4/3] rounded-xl w-full border border-slate-200 overflow-hidden bg-slate-100"
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
            {!mediaLocked && (
              <ImageCropPicker
                aspect={4 / 3}
                disabled={uploading}
                className="flex flex-col items-center justify-center aspect-[4/3] rounded-xl border border-dashed border-slate-300 hover:border-rose-400 bg-slate-50"
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

        <section className="org-card p-6 space-y-4">
          <div>
            <h3 className="portal-heading text-lg font-semibold">YouTube video</h3>
            <p className="portal-muted text-sm mt-1">
              Optional. This plays as the second slide on the customer event page. Paste a YouTube watch, share, or Shorts link.
            </p>
          </div>
          <input
            disabled={mediaLocked}
            className={inputClass}
            placeholder="https://www.youtube.com/watch?v=..."
            {...register("youtube_url")}
          />
          {errors.youtube_url && <p className={errorClass}>{errors.youtube_url.message}</p>}
        </section>

        <section className="org-card p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="portal-heading text-lg font-semibold flex items-center gap-2">
                <Megaphone size={18} className="text-primary shrink-0" />
                Promotion (optional)
              </h3>
              <p className="portal-muted text-sm mt-1">
                Request a visibility plan in a popup. Super Admin still reviews the banner before it goes live.
              </p>
            </div>
            {!readOnly ? (
              <button
                type="button"
                onClick={() => {
                  if (!getValues("promo_title")?.trim() && getValues("name")?.trim()) {
                    setValue("promo_title", getValues("name").trim(), { shouldDirty: true });
                  }
                  setPromoModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] shrink-0"
              >
                <Megaphone size={15} />
                {wantPromotion ? "Edit promotion" : "Request Promotion"}
              </button>
            ) : null}
          </div>

          {wantPromotion && promoPlanId ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="font-semibold text-slate-900 truncate">
                  {getValues("promo_title") ||
                    promoPlans.find((p) => String(p.id) === promoPlanId)?.name ||
                    "Promotion"}
                </p>
                <p className="text-xs text-slate-500">
                  {promoPlans.find((p) => String(p.id) === promoPlanId)?.name}
                  {getValues("promo_start_date")
                    ? ` · starts ${getValues("promo_start_date")}`
                    : ""}
                </p>
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() => {
                    setValue("want_promotion", false, { shouldDirty: true });
                    setValue("promo_plan_id", "", { shouldDirty: true });
                    setValue("promo_title", "", { shouldDirty: true });
                    setValue("promo_banner_url", "", { shouldDirty: true });
                    setValue("promo_slider_accent_text", "", { shouldDirty: true });
                    setValue("promo_start_date", "", { shouldDirty: true });
                    setValue("promo_landing_slider", false, { shouldDirty: true });
                  }}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No promotion added yet.</p>
          )}

          {promoModalOpen && typeof document !== "undefined"
            ? createPortal(
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="event-request-promotion-title"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) setPromoModalOpen(false);
                  }}
                >
                  <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3
                        id="event-request-promotion-title"
                        className="text-lg font-bold text-slate-900"
                      >
                        Request Promotion
                      </h3>
                      <button
                        type="button"
                        onClick={() => setPromoModalOpen(false)}
                        className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
                        aria-label="Close"
                      >
                        <X size={18} />
                      </button>
                    </div>

                    {!promoPlans.length ? (
                      <p className="text-sm text-amber-700">
                        No event promotion plans are available yet. Ask Super Admin to publish a plan.
                      </p>
                    ) : (
                      <>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-semibold text-slate-600 mb-0">
                              Plan <span className="text-rose-500">*</span>
                            </label>
                            <PlanInfoButton
                              title={selectedPromoPlan?.name || "Plan"}
                              description={selectedPromoPlan?.description}
                              details={
                                selectedPromoPlan
                                  ? {
                                      duration_days: selectedPromoPlan.duration_days,
                                      price: selectedPromoPlan.price != null ? Number(selectedPromoPlan.price) : null,
                                      listing_boost: selectedPromoPlan.listing_boost,
                                      landing_slider: selectedPromoPlan.landing_slider,
                                      category_rail: selectedPromoPlan.category_rail,
                                    }
                                  : null
                              }
                              autoOpenKey={promoPlanId || null}
                            />
                          </div>
                          <select
                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#e11d48] focus:ring-1 focus:ring-[#e11d48]/20"
                            value={promoPlanId || ""}
                            onChange={(e) => {
                              const id = e.target.value;
                              setValue("promo_plan_id", id, { shouldDirty: true });
                              const plan = promoPlans.find((p) => String(p.id) === id);
                              setValue("promo_landing_slider", Boolean(plan?.landing_slider), {
                                shouldDirty: true,
                              });
                            }}
                          >
                            <option value="">Select plan</option>
                            {promoPlans.map((p) => (
                              <option key={p.id} value={String(p.id)}>
                                {p.name} — {formatMoneyDisplay(p.price)} / {p.duration_days} days
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-600">
                            Promotion title <span className="text-rose-500">*</span>
                          </label>
                          <input
                            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#e11d48] focus:ring-1 focus:ring-[#e11d48]/20"
                            placeholder="Shown with your banner"
                            {...register("promo_title")}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-sm font-semibold text-slate-600">
                            Promotion start date <span className="text-rose-500">*</span>
                          </label>
                          <EventDateField
                            disabled={false}
                            inputClass="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#e11d48] focus:ring-1 focus:ring-[#e11d48]/20"
                            value={watch("promo_start_date") || ""}
                            onChange={(ymd) =>
                              setValue("promo_start_date", ymd, { shouldDirty: true, shouldValidate: true })
                            }
                          />
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            After Super Admin approval, the promotion becomes visible from this date for
                            the plan duration. Cannot be after the event date
                            {watch("showtimes.0.event_date")
                              ? ` (${formatDate(watch("showtimes.0.event_date"))})`
                              : ""}
                            .
                          </p>
                        </div>

                        {watch("promo_landing_slider") ? (
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-600">
                              Banner image <span className="text-rose-500">*</span>
                            </label>
                            <CroppedImageField
                              value={promoBannerUrl || ""}
                              aspect={16 / 9}
                              disabled={uploading}
                              previewClassName="w-full aspect-[16/9] rounded-xl border border-slate-200 overflow-hidden bg-slate-100"
                              emptyClassName="flex flex-col items-center justify-center w-full aspect-[16/9] rounded-xl border border-dashed border-slate-300 hover:border-rose-400 bg-slate-50"
                              onRemove={() => setValue("promo_banner_url", "", { shouldDirty: true })}
                              onCroppedFile={(file) =>
                                uploadCropped(file, (url) =>
                                  setValue("promo_banner_url", url, { shouldDirty: true })
                                )
                              }
                              emptyContent={
                                <>
                                  <ImagePlus className="text-slate-400 mb-2" size={28} />
                                  <span className="text-xs portal-muted">Add 16:9 promo banner</span>
                                </>
                              }
                            />

                            <div className="space-y-1.5 pt-1">
                              <label className="text-sm font-semibold text-slate-600">
                                Slider accent text{" "}
                                <span className="font-medium text-slate-400">(optional)</span>
                              </label>
                              <input
                                maxLength={40}
                                placeholder='e.g. "Feel The Beat"'
                                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#e11d48] focus:ring-1 focus:ring-[#e11d48]/20"
                                {...register("promo_slider_accent_text")}
                              />
                              <p className="text-[11px] text-slate-500 leading-relaxed">
                                Optional. If filled, shown on the right side of the home hero slider.
                                Leave blank to hide it (max 40 characters).
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-600">
                              Banner image (optional)
                            </label>
                            <CroppedImageField
                              value={promoBannerUrl || ""}
                              aspect={16 / 9}
                              disabled={uploading}
                              previewClassName="w-full aspect-[16/9] rounded-xl border border-slate-200 overflow-hidden bg-slate-100"
                              emptyClassName="flex flex-col items-center justify-center w-full aspect-[16/9] rounded-xl border border-dashed border-slate-300 hover:border-rose-400 bg-slate-50"
                              onRemove={() => setValue("promo_banner_url", "", { shouldDirty: true })}
                              onCroppedFile={(file) =>
                                uploadCropped(file, (url) =>
                                  setValue("promo_banner_url", url, { shouldDirty: true })
                                )
                              }
                              emptyContent={
                                <>
                                  <ImagePlus className="text-slate-400 mb-2" size={28} />
                                  <span className="text-xs portal-muted">Optional promo banner</span>
                                </>
                              }
                            />
                          </div>
                        )}

                        {selectedPromoPlan ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                            <p className="font-semibold text-sm text-[#e11d48]">Order summary</p>
                            <div className="flex justify-between text-sm text-slate-700">
                              <span>{selectedPromoPlan.name}</span>
                              <span className="font-bold">
                                {formatMoneyDisplay(selectedPromoPlan.price)}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                              <span>Duration</span>
                              <span>{selectedPromoPlan.duration_days} days from start date</span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Demo payment on event submit. After pay, Super Admin reviews the banner.
                            </p>
                          </div>
                        ) : null}
                      </>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setPromoModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!promoPlans.length}
                        onClick={() => {
                          const planId = getValues("promo_plan_id")?.trim();
                          const title = getValues("promo_title")?.trim();
                          const start = getValues("promo_start_date")?.trim();
                          const landing = Boolean(getValues("promo_landing_slider"));
                          const banner = getValues("promo_banner_url")?.trim();
                          if (!planId) {
                            toast.error("Select a promotion plan.");
                            return;
                          }
                          if (!title) {
                            toast.error("Enter a promotion title.");
                            return;
                          }
                          if (!start) {
                            toast.error("Choose when the promotion should start.");
                            return;
                          }
                          const today = new Date();
                          const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
                            today.getDate()
                          ).padStart(2, "0")}`;
                          if (start < ymd) {
                            toast.error("Promotion start date cannot be in the past.");
                            return;
                          }
                          const eventDate = String(getValues("showtimes.0.event_date") || "").trim();
                          if (eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate) && start > eventDate) {
                            toast.error("Promotion start date cannot be after the event date.");
                            return;
                          }
                          if (landing && !banner) {
                            toast.error("Banner image is required for this promotion plan.");
                            return;
                          }
                          setValue("want_promotion", true, { shouldDirty: true });
                          setPromoModalOpen(false);
                          toast.success("Promotion added. It will be saved when you save or submit the event.");
                        }}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#e11d48] text-white hover:bg-[#be123c] disabled:opacity-60"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )
            : null}
        </section>

        <section className="org-card p-6 space-y-4">
          <div>
            <h3 className="portal-heading text-lg font-semibold">Event-specific documents</h3>
            <p className="portal-muted text-sm mt-1">
              General event documents only. Venue and artist documents are uploaded in the Venue and Artist steps.
            </p>
          </div>
          {!categoryTypeId ? (
            <p className="portal-muted text-sm">Select a category to see the document checklist.</p>
          ) : mastersLoading ? (
            <p className="portal-muted text-sm">Loading document requirements...</p>
          ) : eventDocuments.length ? (
            <EventDocUploadsList
              docs={eventDocuments}
              documents={documents}
              readOnly={readOnly}
              uploading={uploading}
              uploadingId={docUploadingId}
              onSelect={handleDocumentSelect}
              onSubmitPending={(id) => void handleDocumentSubmitPending(id)}
              onRemove={removeDocument}
            />
          ) : (
            <p className="text-amber-700 text-sm">No general event document types configured yet.</p>
          )}
        </section>

        <section className="org-card p-6 space-y-4">
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
                          checked ? "border-rose-300 bg-rose-50" : "border-slate-200 bg-slate-50"
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
                        className="flex items-start gap-3 p-3 rounded-xl border border-rose-300 bg-rose-50"
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
                      className="px-3 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-500 inline-flex items-center gap-1"
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
        <section className="org-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="portal-heading text-lg font-semibold">
              {hostingType === "tour" ? "Tour stops & layouts" : "Venue"}{" "}
              <span className="text-rose-500 text-sm">*</span>
            </h3>
            {!readOnly && hostingType === "tour" && (
              <button
                type="button"
                onClick={() => {
                  const tickets = (getValues("showtimes.0.ticket_types") || []).map((t) => ({ ...t }));
                  appendShowtime({ ...defaultVenue(), ticket_types: tickets });
                }}
                className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1"
              >
                <Plus size={14} /> Add venue
              </button>
            )}
          </div>
          <p className="portal-muted text-xs">
            {hostingType === "tour"
              ? "Add ticket types once, then each tour city stop as a venue. Ticket types apply to every stop."
              : "Add ticket types, then this event’s single venue and layout details."}
          </p>

          <EventTicketTypesFields readOnly={readOnly} />

          {showtimeFields.map((field, i) => (
            <VenueBlock
              key={field.id}
              index={i}
              readOnly={readOnly}
              canRemove={hostingType === "tour" && showtimeFields.length > 1}
              onRemove={() => removeShowtime(i)}
              cities={cities}
              hostingType={hostingType}
              venueDocuments={venueDocuments}
              documents={documents}
              uploading={uploading}
              uploadingId={docUploadingId}
              onDocumentSelect={handleDocumentSelect}
              onDocumentSubmitPending={(id) => void handleDocumentSubmitPending(id)}
              onDocumentRemove={removeDocument}
            />
          ))}
          {errors.showtimes && typeof errors.showtimes.message === "string" && (
            <p className={errorClass}>{errors.showtimes.message}</p>
          )}
        </section>
        )}

        {stepId === "artists" && (
        <section className="org-card p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="portal-heading text-lg font-semibold">
                {isSports ? "Teams / players" : "Artist"}
              </h3>
              <p className="portal-muted text-xs mt-1">
                {isSports
                  ? "Optional. Add players, coaches, or officials. Search registered partners or add a new name."
                  : "Optional. Add artists, guests, or chief guests. Search registered partners or auto-register a new name."}
              </p>
            </div>
        {!readOnly && (
              <button
                type="button"
                onClick={() => appendArtist({ ...defaultArtist(), sort_order: artistFields.length })}
                className="text-xs text-rose-600 hover:text-rose-800 flex items-center gap-1"
              >
                <Plus size={14} /> {isSports ? "Add player" : "Add person"}
              </button>
            )}
          </div>

          {artistFields.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <p className="text-sm text-slate-600">
                {isSports
                  ? "No players added yet. You can continue without a roster."
                  : "No one added yet. You can continue without a lineup."}
              </p>
            </div>
          )}

          {artistFields.map((field, i) => (
            <ArtistBlock key={field.id} index={i} readOnly={readOnly} onRemove={() => removeArtist(i)} />
          ))}

          {artistDocuments.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div>
                <p className="text-sm font-semibold text-slate-800">Artist documents</p>
                <p className="text-xs text-slate-500 mt-1">
                  Upload artist-related documents here. General event documents are on the Media step.
                </p>
              </div>
              <EventDocUploadsList
                docs={artistDocuments}
                documents={documents}
                readOnly={readOnly}
                uploading={uploading}
                uploadingId={docUploadingId}
                onSelect={handleDocumentSelect}
                onSubmitPending={(id) => void handleDocumentSubmitPending(id)}
                onRemove={removeDocument}
              />
            </div>
          )}
        </section>
        )}

        {stepId === "review" && (
          <section className="space-y-6">
            <div className="org-card p-5 sm:p-6 space-y-2">
              <h3 className="portal-heading text-lg font-semibold">Preview & submit</h3>
              <p className="portal-muted text-sm">
                Check how customers will see your event on the Home page and on your Event page,
                then save a draft or submit for Super Admin approval.
              </p>
              {event?.status === "PENDING_APPROVAL" && !readOnly && !pendingChangesSaved ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-amber-900">
                    This event is waiting for Super Admin. If you changed venue, tickets, or switched
                    to a <strong>custom layout</strong>, save your changes so Super Admin can see them
                    in Event Layouts.
                  </p>
                  <button
                    type="button"
                    disabled={saving || submitting}
                    onClick={() => void runSaveDraft()}
                    className="btn-primary shrink-0 text-sm py-2 px-3.5 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              ) : null}
              {event?.status === "PENDING_APPROVAL" && !readOnly && pendingChangesSaved ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-3">
                  <p className="text-sm text-emerald-900 font-medium">
                    Changes sent to Super Admin. They can now see your custom layout request.
                  </p>
                </div>
              ) : null}
            </div>

            <EventFormCustomerPreview
              values={watch()}
              event={event}
              categoryName={categories.find((c) => c.id === categoryTypeId)?.name || null}
              cityLabel={cityName}
              termLines={[
                ...selectedTerms.map((t) => t.text).filter(Boolean),
                ...customTerms.map((t) => String(t || "").trim()).filter(Boolean),
              ]}
              promoPlan={selectedPromoPlan || null}
              onEditStep={(step) => goToStep(step)}
            />

            <div className="space-y-4">
              {waitingForAdminLayout.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-2 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Custom layout in progress
                  </p>
                  <p className="text-sm text-amber-900">
                    Super Admin is preparing your custom seating layout
                    {waitingForAdminLayout.map((r) => r.layout_name).filter(Boolean).length
                      ? ` (${waitingForAdminLayout.map((r) => r.layout_name).join(", ")})`
                      : ""}
                    . After they send it, review and approve it here on Preview. The contract is created
                    only after you approve.
                  </p>
                </div>
              )}

              {pendingLayoutPicks.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-4 sm:col-span-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                      Review event layout
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      Super Admin sent seating layout option(s). Preview each map, Approve the ones you
                      like, Reject others, then Go live on one — same flow as venue layout review.
                    </p>
                  </div>
                  {pendingLayoutPicks.map((req) => {
                    const options = req.proposed_templates || [];
                    return (
                      <div
                        key={req.id}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-3 space-y-3"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {req.layout_name}
                          {req.venue_name ? ` · ${req.venue_name}` : ""}
                        </p>
                        {options.length === 0 ? (
                          <p className="text-sm text-slate-500">No layout options attached yet.</p>
                        ) : (
                          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {options.map((opt, index) => {
                              const rejected = String(opt.status) === "REJECTED";
                              const shortlisted = Boolean(opt.venue_approved_at) && !rejected;
                              const live =
                                Boolean(opt.is_default) ||
                                (Boolean(opt.venue_live_requested_at) &&
                                  String(req.fulfilled_template_id || "") === opt.id);
                              return (
                                <article
                                  key={opt.id}
                                  className={`rounded-xl border overflow-hidden flex flex-col ${
                                    live
                                      ? "border-sky-300 ring-1 ring-sky-100"
                                      : shortlisted
                                        ? "border-emerald-300 ring-1 ring-emerald-100"
                                        : rejected
                                          ? "border-rose-200"
                                          : "border-slate-200"
                                  }`}
                                >
                                  <div className="p-2 bg-slate-50 border-b border-slate-100">
                                    <LayoutSeatPreview
                                      seats={opt.seats_json}
                                      config={opt.seating_config}
                                      heightClass="h-40"
                                    />
                                  </div>
                                  <div className="p-3 flex-1 flex flex-col gap-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-rose-600">
                                          Option {index + 1}
                                        </p>
                                        <p className="text-sm font-semibold text-slate-900 truncate">
                                          {opt.name}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                          {(() => {
                                            const cfg = opt.seating_config as any;
                                            if (cfg?.layout_mode === "stadium" && Array.isArray(cfg.blocks)) {
                                              const est = cfg.blocks.reduce(
                                                (acc: number, b: any) =>
                                                  acc +
                                                  (b.tiers || []).reduce((ta: number, t: any) => {
                                                    const s = String(t.row_start || "").toUpperCase().charCodeAt(0);
                                                    const e = String(t.row_end || "").toUpperCase().charCodeAt(0);
                                                    const r = isNaN(s) || isNaN(e) || e < s ? 0 : e - s + 1;
                                                    return ta + r * (Number(t.seats_per_row) || 0);
                                                  }, 0),
                                                0
                                              );
                                              if (est > 0) return `${est.toLocaleString()} seats (Stadium)`;
                                            }
                                            return `${opt.seat_count ?? opt.capacity ?? 0} seats`;
                                          })()}
                                        </p>
                                      </div>
                                      <span
                                        className={`shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-md border ${
                                          live
                                            ? "bg-sky-50 text-sky-700 border-sky-200"
                                            : shortlisted
                                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                              : rejected
                                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                                : "bg-amber-50 text-amber-700 border-amber-200"
                                        }`}
                                      >
                                        {live
                                          ? "Live"
                                          : shortlisted
                                            ? "Approved"
                                            : rejected
                                              ? "Rejected"
                                              : "Pending"}
                                      </span>
                                    </div>
                                    {rejected && opt.rejection_reason ? (
                                      <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2 py-1.5">
                                        {opt.rejection_reason}
                                      </p>
                                    ) : null}
                                    {!readOnly && (
                                      <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setLayoutViewing({
                                              id: opt.id,
                                              name: opt.name,
                                              seats_json: opt.seats_json,
                                              seating_config: opt.seating_config || null,
                                            })
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                        >
                                          <Eye size={13} /> View
                                        </button>
                                        {!rejected && !live ? (
                                          <>
                                            {!shortlisted ? (
                                              <button
                                                type="button"
                                                disabled={reviewingLayout}
                                                className="btn-primary text-xs py-1.5 px-2.5 disabled:opacity-50"
                                                onClick={async () => {
                                                  try {
                                                    if (options.length === 1) {
                                                      await reviewLayoutRequest({
                                                        id: req.id,
                                                        action: "go_live",
                                                        selected_template_id: opt.id,
                                                      }).unwrap();
                                                      toast.success(
                                                        "Layout is live — Super Admin can create the contract"
                                                      );
                                                    } else {
                                                      await reviewLayoutRequest({
                                                        id: req.id,
                                                        action: "approve_option",
                                                        selected_template_id: opt.id,
                                                      }).unwrap();
                                                      toast.success(
                                                        "Option approved. Approve more if you like, then Go live on one."
                                                      );
                                                    }
                                                  } catch (e) {
                                                    toast.error(extractApiError(e, "Approve failed"));
                                                  }
                                                }}
                                              >
                                                {options.length === 1 ? "Approve & go live" : "Approve"}
                                              </button>
                                            ) : (
                                              <button
                                                type="button"
                                                disabled={reviewingLayout}
                                                className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold disabled:opacity-50"
                                                onClick={async () => {
                                                  try {
                                                    await reviewLayoutRequest({
                                                      id: req.id,
                                                      action: "go_live",
                                                      selected_template_id: opt.id,
                                                    }).unwrap();
                                                    toast.success(
                                                      "Layout is live — Super Admin can create the contract"
                                                    );
                                                  } catch (e) {
                                                    toast.error(extractApiError(e, "Go live failed"));
                                                  }
                                                }}
                                              >
                                                Go live
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              disabled={reviewingLayout}
                                              className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-medium hover:bg-rose-50 disabled:opacity-50"
                                              onClick={() => {
                                                setLayoutRejectId(opt.id);
                                                setLayoutPickByRequest((prev) => ({
                                                  ...prev,
                                                  [req.id]: opt.id,
                                                }));
                                                setLayoutRejectReason("");
                                              }}
                                            >
                                              Reject
                                            </button>
                                          </>
                                        ) : null}
                                      </div>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        )}
                        {!readOnly && (
                          <div className="pt-2 border-t border-slate-100 space-y-2">
                            <label className="block text-xs font-semibold text-slate-600">
                              Request changes from Super Admin (optional notes required)
                            </label>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="text"
                                value={layoutPickByRequest[`notes-${req.id}`] || ""}
                                onChange={(e) =>
                                  setLayoutPickByRequest((prev) => ({
                                    ...prev,
                                    [`notes-${req.id}`]: e.target.value,
                                  }))
                                }
                                placeholder="What should Super Admin change?"
                                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                              <button
                                type="button"
                                disabled={reviewingLayout}
                                className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100 disabled:opacity-50"
                                onClick={async () => {
                                  const notes = String(
                                    layoutPickByRequest[`notes-${req.id}`] || ""
                                  ).trim();
                                  if (!notes) {
                                    toast.error("Add notes explaining the changes you need.");
                                    return;
                                  }
                                  try {
                                    await reviewLayoutRequest({
                                      id: req.id,
                                      action: "request_changes",
                                      notes,
                                    }).unwrap();
                                    toast.success("Change request sent to Super Admin");
                                  } catch (e) {
                                    toast.error(extractApiError(e, "Could not send change request"));
                                  }
                                }}
                              >
                                Request changes
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {layoutViewing && (
                <div
                  className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
                  onClick={() => setLayoutViewing(null)}
                >
                  <div
                    className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto p-4 space-y-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-slate-900">{layoutViewing.name}</h3>
                      <button
                        type="button"
                        onClick={() => setLayoutViewing(null)}
                        className="p-2 rounded-lg hover:bg-slate-100"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <LayoutSeatPreview
                      seats={layoutViewing.seats_json}
                      config={layoutViewing.seating_config}
                      heightClass="h-80"
                    />
                  </div>
                </div>
              )}

              {layoutRejectId && (
                <div
                  className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
                  onClick={() => setLayoutRejectId(null)}
                >
                  <div
                    className="bg-white rounded-2xl max-w-md w-full p-4 space-y-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="font-semibold text-slate-900">Reject layout option</h3>
                    <textarea
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Reason for rejection"
                      value={layoutRejectReason}
                      onChange={(e) => setLayoutRejectReason(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-sm"
                        onClick={() => setLayoutRejectId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={reviewingLayout}
                        className="px-3 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
                        onClick={async () => {
                          if (!layoutRejectReason.trim()) {
                            toast.error("Rejection reason is required");
                            return;
                          }
                          const req = pendingLayoutPicks.find((r) =>
                            (r.proposed_templates || []).some((t) => t.id === layoutRejectId)
                          );
                          if (!req) return;
                          try {
                            await reviewLayoutRequest({
                              id: req.id,
                              action: "reject_option",
                              selected_template_id: layoutRejectId,
                              notes: layoutRejectReason.trim(),
                            }).unwrap();
                            toast.success("Layout option rejected");
                            setLayoutRejectId(null);
                            setLayoutRejectReason("");
                          } catch (e) {
                            toast.error(extractApiError(e, "Reject failed"));
                          }
                        }}
                      >
                        Reject with reason
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents & T&amp;C</p>
                {(() => {
                  const uploaded = documents.filter(
                    (d) => Boolean(d.pending_file) || Boolean(d.url?.trim())
                  );
                  if (!uploaded.length) {
                    return <p className="text-sm text-slate-500">No documents selected yet</p>;
                  }
                  const masterById = new Map((masters?.documents || []).map((d) => [d.id, d]));
                  const isImageUrl = (url: string) =>
                    /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url) ||
                    /\/image\//i.test(url) ||
                    url.includes("cloudinary") ||
                    url.startsWith("data:image") ||
                    url.startsWith("blob:");
                  return (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {uploaded.map((doc, idx) => {
                        const master = masterById.get(doc.document_type_id);
                        const label =
                          doc.pending_file_name ||
                          doc.document_name ||
                          master?.name ||
                          `Document ${idx + 1}`;
                        const scope = master ? resolveDocumentAppliesTo(master) : "event";
                        const previewSrc = doc.pending_preview_url || (doc.url ? resolveMediaUrl(doc.url) : "");
                        return (
                          <div
                            key={`${doc.document_type_id}-${idx}`}
                            className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2"
                          >
                            {previewSrc && isImageUrl(previewSrc) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={previewSrc}
                                alt={label}
                                className="h-28 w-full rounded-md object-cover border border-slate-100"
                              />
                            ) : (
                              <a
                                href={previewSrc || "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-200 bg-slate-50 text-slate-500 hover:border-rose-300 hover:text-rose-700"
                              >
                                <FileText size={22} />
                                <span className="text-[11px]">
                                  {doc.pending_file ? "Selected file" : "Open file"}
                                </span>
                              </a>
                            )}
                            <div>
                              <p className="text-sm font-medium text-slate-800 truncate">{label}</p>
                              <p className="text-[11px] text-slate-500 capitalize">{scope} document</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <p className="text-sm text-slate-600">
                  T&amp;C points: {selectedTerms.length} master + {customTerms.length} custom
                </p>
                <button type="button" className="text-sm text-rose-700 font-medium" onClick={() => goToStep("media")}>
                  {mediaOnlyEdit ? "Edit posters, gallery & YouTube" : "Edit documents & media"}
                </button>
              </div>
            </div>
          </section>
        )}

        {(!readOnly || mediaOnlyEdit) && (
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
              {saving
                ? "Saving..."
                : mediaOnlyEdit
                  ? "Save media"
                  : event?.status === "PENDING_APPROVAL"
                    ? "Save changes"
                    : "Save draft"}
            </button>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                <HelpCircle size={14} className="shrink-0 text-rose-600" />
                Need help?
              </span>
              {supportEmail && (
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex items-center gap-1.5 text-rose-700 hover:underline"
                >
                  <Mail size={13} className="shrink-0" />
                  {supportEmail}
                </a>
              )}
              <a
                href={`tel:${supportPhone.replace(/\D/g, "")}`}
                className="inline-flex items-center gap-1.5 text-rose-700 hover:underline"
              >
                <Phone size={13} className="shrink-0" />
                {supportPhone}
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              {mediaOnlyEdit ? (
                <button
                  type="button"
                  disabled={saving || submitting}
                  onClick={() => void runSaveDraft()}
                  className="btn-primary disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save posters & media"}
                </button>
              ) : !isLastStep ? (
                <button
                  type="button"
                  onClick={() => void goNext()}
                  className="btn-primary px-5 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-1.5"
                >
                  Continue <ChevronRight size={16} />
                </button>
              ) : canSubmit ? (
                <button
                  type="button"
                  disabled={saving || submitting}
                  onClick={handleSubmit(runSubmit)}
                  className="btn-primary disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit for approval"}
                </button>
              ) : event?.status === "PENDING_APPROVAL" && !pendingChangesSaved ? (
                <button
                  type="button"
                  disabled={saving || submitting}
                  onClick={() => void runSaveDraft()}
                  className="btn-primary disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes for Super Admin"}
                </button>
              ) : event?.status === "PENDING_APPROVAL" && pendingChangesSaved ? (
                <span className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">
                  Changes sent to Super Admin
                </span>
              ) : null}
            </div>
          </div>
        )}

        {readOnly && !mediaOnlyEdit && (
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
                  const next = steps[stepIndex + 1];
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
