"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  CalendarDays,
  ChevronRight,
  Clock,
  Globe,
  Home,
  Hourglass,
  LayoutGrid,
  MapPin,
  Share2,
  Theater,
  Ticket,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import EventMediaSlider from "@/components/EventLandingPage/EventMediaSlider";
import EventGallerySection from "@/components/EventLandingPage/EventGallerySection";
import LayoutSeatPreview from "@/components/venue/LayoutSeatPreview";
import { formatMoney } from "@/lib/currencyFormat";
import { formatDate, formatTime12h } from "@/lib/dateFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { eventDateParts } from "@/components/LandingPage/homeUtils";
import type { EventFormValues } from "@/lib/eventFormSchema";
import { computeDurationMinutesFromShowtimes } from "@/lib/eventFormSchema";
import type { MarketingPlan, OrganizerEvent } from "@/services/api";
import { useGetEventLayoutQuery } from "@/services/api";

const BRAND = "#6900AA";

function formatDurationLong(minutes?: number | null) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hourPart = h ? `${h} hour${h === 1 ? "" : "s"}` : "";
  const minPart = m ? `${m} minute${m === 1 ? "" : "s"}` : "";
  return [hourPart, minPart].filter(Boolean).join(" ");
}

function MetaRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-2.5 sm:gap-3 py-2 sm:py-2.5">
      <span className="mt-0.5 w-5 shrink-0 text-[#9AA0A6] flex justify-center">{icon}</span>
      <div className="min-w-0 text-[0.9375rem] sm:text-[1rem] font-medium text-[#1A1A1A] leading-snug break-words">
        {children}
      </div>
    </div>
  );
}

export type EventFormCustomerPreviewProps = {
  values: EventFormValues;
  categoryName?: string | null;
  cityLabel?: (cityId: number | null | undefined) => string;
  termLines?: string[];
  promoPlan?: MarketingPlan | null;
  onEditStep?: (step: "details" | "venue" | "artists" | "media") => void;
  /** Existing event — used for booking layout preview (applied / proposed seats). */
  event?: OrganizerEvent | null;
};

export default function EventFormCustomerPreview({
  values,
  categoryName,
  cityLabel,
  termLines = [],
  promoPlan = null,
  onEditStep,
  event = null,
}: EventFormCustomerPreviewProps) {
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [previewScreen, setPreviewScreen] = useState<"home" | "event" | "booking">("home");
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const resolvedTermLines = useMemo(() => {
    const fromProps = (termLines || []).map((t) => String(t || "").trim()).filter(Boolean);
    if (fromProps.length > 0) return fromProps;
    const tp = event?.terms_points;
    if (!tp) return [];
    return [
      ...(tp.selected || [])
        .map((t) => (typeof t === "string" ? t : String(t?.text || "")).trim())
        .filter(Boolean),
      ...(tp.custom || []).map((t) => String(t).trim()).filter(Boolean),
    ];
  }, [termLines, event?.terms_points]);

  const eventId = event?.id || "";
  const { data: appliedLayout } = useGetEventLayoutQuery(eventId, { skip: !eventId });

  const layoutRequests = event?.layout_requests || [];
  const fulfilledRequest = layoutRequests.find((r) => String(r.status) === "FULFILLED");
  const pendingPickRequest = layoutRequests.find(
    (r) => String(r.status) === "PENDING_ORGANIZER_APPROVAL"
  );
  const waitingRequest = layoutRequests.find((r) =>
    ["SUBMITTED", "UNDER_REVIEW", "ORGANIZER_CHANGE_REQUESTED", "DRAFT"].includes(String(r.status))
  );

  const fulfilledTemplate =
    fulfilledRequest?.proposed_templates?.find(
      (t) => String(t.id) === String(fulfilledRequest.fulfilled_template_id || "")
    ) ||
    fulfilledRequest?.proposed_templates?.[0] ||
    null;

  const pendingTemplate =
    pendingPickRequest?.proposed_templates?.find(
      (t) => String(t.id) === String(pendingPickRequest.fulfilled_template_id || "")
    ) ||
    pendingPickRequest?.proposed_templates?.[0] ||
    null;

  const appliedSeats = Array.isArray(appliedLayout?.data?.seats) ? appliedLayout.data.seats : [];
  const appliedConfig =
    (appliedLayout?.data?.seating_config as Record<string, unknown> | null | undefined) || null;

  const formLayoutMode = values.showtimes?.[0]?.layout_mode || "none";
  const wantsCustom =
    formLayoutMode === "custom" ||
    Boolean(waitingRequest || pendingPickRequest || fulfilledRequest);

  const bookingPreview = (() => {
    if (appliedSeats.length > 0) {
      return {
        kind: "map" as const,
        title: fulfilledRequest
          ? "Custom seating layout (live for customers after Go live)"
          : "Customer seating map",
        subtitle: "This is the seat map customers use when they book.",
        seats: appliedSeats,
        config: appliedConfig,
        status: "ready" as const,
      };
    }
    if (
      fulfilledTemplate &&
      Array.isArray(fulfilledTemplate.seats_json) &&
      fulfilledTemplate.seats_json.length > 0
    ) {
      return {
        kind: "map" as const,
        title: fulfilledTemplate.name || fulfilledRequest?.layout_name || "Custom seating layout",
        subtitle: "Organizer-approved custom map — customers see this when booking.",
        seats: fulfilledTemplate.seats_json,
        config: (fulfilledTemplate.seating_config as Record<string, unknown> | null) || null,
        status: "ready" as const,
      };
    }
    if (
      pendingTemplate &&
      Array.isArray(pendingTemplate.seats_json) &&
      pendingTemplate.seats_json.length > 0
    ) {
      return {
        kind: "map" as const,
        title: pendingTemplate.name || pendingPickRequest?.layout_name || "Custom seating layout",
        subtitle: "Approve & Go live below to make this map available to customers.",
        seats: pendingTemplate.seats_json,
        config: (pendingTemplate.seating_config as Record<string, unknown> | null) || null,
        status: "pending" as const,
      };
    }
    if (wantsCustom || waitingRequest) {
      return {
        kind: "waiting" as const,
        title: "Custom seating layout in progress",
        subtitle:
          "Customers will not see a seat map until Super Admin sends options and you approve them with Go live. Until then they book by ticket type only.",
      };
    }
    return {
      kind: "default" as const,
      title: "Default customer booking (no seat map)",
      subtitle:
        "No seating layout is attached. Customers pick ticket types and quantities — same as the default booking flow.",
    };
  })();

  useEffect(() => {
    if (!termsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTermsOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [termsOpen]);

  const genres = useMemo(
    () => (Array.isArray(values.genres) ? values.genres.map(String).filter(Boolean) : []),
    [values.genres]
  );
  const languages = useMemo(
    () => (Array.isArray(values.languages) ? values.languages.map(String).filter(Boolean) : []),
    [values.languages]
  );
  const showtimes = values.showtimes || [];
  const firstShow = showtimes[0];
  const lastShow = showtimes[showtimes.length - 1];

  const ticketTypesDisplay = useMemo(() => {
    const map = new Map<
      string,
      { key: string; ticket_type: string; price: number; max_per_order: number }
    >();
    for (const show of showtimes) {
      for (const t of show.ticket_types || []) {
        const name = String(t.ticket_type || "").trim() || "Ticket";
        const price = Number(t.price) || 0;
        const maxPer = Math.max(1, Number(t.max_per_order) || 10);
        const key = `${name.toLowerCase()}|${price}|${maxPer}`;
        if (!map.has(key)) {
          map.set(key, { key, ticket_type: name, price, max_per_order: maxPer });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.price - b.price);
  }, [showtimes]);

  const minPrice = ticketTypesDisplay.length
    ? Math.min(...ticketTypesDisplay.map((t) => t.price))
    : null;

  const durationMinutes =
    Number(values.duration_minutes) ||
    computeDurationMinutesFromShowtimes(showtimes, values.duration_minutes) ||
    null;
  const durationLabel = formatDurationLong(durationMinutes);

  const dateLabel = (() => {
    if (!firstShow?.event_date) return "";
    const first = formatDate(firstShow.event_date);
    if (!lastShow?.event_date || showtimes.length <= 1) return first;
    const last = formatDate(lastShow.event_date);
    return first && last && first !== last ? `${first} - ${last}` : first;
  })();

  const timeLabel =
    firstShow?.event_date && firstShow?.start_time
      ? formatTime12h(`${firstShow.event_date}T${firstShow.start_time}`)
      : "";

  const venueName = firstShow?.venue_name?.trim() || "";
  const venueAddress = firstShow?.venue_address?.trim() || "";
  const city =
    cityLabel && firstShow?.city_id != null ? cityLabel(firstShow.city_id) : "";
  const venueLabel = [venueName, venueAddress || city].filter(Boolean).join(": ");

  const artists = (values.artists || [])
    .map((a) => ({
      name: String(a.name || "").trim() || "Artist",
      role: String(a.role_title || "").trim() || undefined,
      image_url: a.image_url || undefined,
      unauthorized:
        a.artist_source === "auto_registered" || a.artist_source === "external",
    }))
    .filter((a) => a.name);

  const aboutText = String(values.about_event || "").trim();
  const ABOUT_PREVIEW_LEN = 160;
  const aboutLong = aboutText.length > ABOUT_PREVIEW_LEN;
  const displayAbout =
    aboutExpanded || !aboutLong
      ? aboutText
      : `${aboutText.slice(0, ABOUT_PREVIEW_LEN).replace(/\s+\S*$/, "").trim()}â€¦`;

  const categoryBadges = [categoryName, ...genres].filter(
    (v, i, arr) => Boolean(v) && arr.indexOf(v) === i
  ) as string[];

  const gallery = (values.gallery_images || [])
    .map((u) => resolveMediaUrl(String(u || "")))
    .filter(Boolean);
  const posterHorizontal = values.poster_horizontal_url
    ? resolveMediaUrl(values.poster_horizontal_url)
    : undefined;
  const posterVertical = values.poster_vertical_url
    ? resolveMediaUrl(values.poster_vertical_url)
    : undefined;

  const uniqueVenues = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of showtimes) {
      const name = String(s.venue_name || "").trim();
      if (!name) continue;
      const addr = String(s.venue_address || "").trim();
      const key = `${name}|${addr}`;
      if (!map.has(key)) map.set(key, name);
    }
    return [...map.values()];
  }, [showtimes]);

  const wantPromotion = Boolean(values.want_promotion && values.promo_plan_id);
  const promoTitle =
    String(values.promo_title || "").trim() ||
    promoPlan?.name ||
    "Featured event";
  const promoBanner = values.promo_banner_url
    ? resolveMediaUrl(values.promo_banner_url)
    : "";
  const showLandingSlider = wantPromotion && Boolean(promoPlan?.landing_slider);
  const showCategoryRail = wantPromotion && Boolean(promoPlan?.category_rail);
  const showDetailBanner =
    wantPromotion && (showCategoryRail || showLandingSlider || Boolean(promoBanner));

  const showIso =
    firstShow?.event_date && firstShow?.start_time
      ? `${firstShow.event_date}T${firstShow.start_time}`
      : firstShow?.event_date
        ? `${firstShow.event_date}T12:00:00`
        : undefined;
  const dateBadge = eventDateParts(showIso);
  const placeLine = [venueName, city].filter(Boolean).join(city && venueName ? ": " : "") || undefined;
  const weekdayLabel = showIso
    ? new Date(showIso).toLocaleDateString("en-US", { weekday: "long" })
    : "";
  const homeDateLabel = showIso ? formatDate(showIso) : "";

  const homePosterCard = (
    <div className="snap-start shrink-0 w-[180px] sm:w-[200px] md:w-[220px] bg-white border border-[#EAEAEA] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(17,17,17,0.06)]">
      <div className="relative aspect-[2/3] overflow-hidden bg-[#F3F4F6]">
        {posterVertical || posterHorizontal ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={posterVertical || posterHorizontal}
            alt={values.name || "Event"}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300">
            <Calendar size={28} strokeWidth={1.5} />
          </div>
        )}
        {dateBadge ? (
          <div className="absolute top-2.5 left-2.5 z-10 min-w-[3.15rem] rounded-xl bg-white shadow-[0_4px_14px_rgba(17,17,17,0.18)] overflow-hidden text-center leading-none">
            <div className="bg-[#6900AA] px-2 py-1 text-[0.625rem] font-bold tracking-wider text-white">
              {dateBadge.month}
            </div>
            <div className="px-2 pt-1.5 pb-1.5">
              <div className="text-[1.125rem] font-extrabold text-[#111827]">{dateBadge.day}</div>
              <div className="mt-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[#6b7280]">
                {dateBadge.weekday}
              </div>
            </div>
          </div>
        ) : null}
        {wantPromotion ? (
          <span className="absolute top-2 right-2 z-[2] rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6900AA] shadow-sm">
            Promoted
          </span>
        ) : null}
      </div>
      <div className="px-3 pt-3 pb-3.5 flex flex-col gap-0.5">
        <h3 className="font-bold text-[#111827] text-sm sm:text-[0.9375rem] leading-snug line-clamp-2">
          {values.name?.trim() || "Untitled event"}
        </h3>
        {placeLine ? (
          <p className="text-xs text-[#6b7280] leading-snug line-clamp-2">{placeLine}</p>
        ) : null}
        {categoryName ? (
          <p className="mt-0.5 text-[11px] text-[#6900AA]/80 font-medium line-clamp-1">{categoryName}</p>
        ) : null}
      </div>
    </div>
  );

  const bookingCard = (
    <div className="bg-white rounded-xl border border-[#E8E8E8] shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="px-3.5 sm:px-5 pt-3.5 sm:pt-4 pb-2">
        {dateLabel ? (
          <MetaRow icon={<Calendar size={18} strokeWidth={1.7} />}>{dateLabel}</MetaRow>
        ) : null}
        {timeLabel ? (
          <MetaRow icon={<Clock size={18} strokeWidth={1.7} />}>{timeLabel}</MetaRow>
        ) : null}
        {durationLabel ? (
          <MetaRow icon={<Hourglass size={18} strokeWidth={1.7} />}>{durationLabel}</MetaRow>
        ) : null}
        {values.age_group ? (
          <MetaRow icon={<Users size={18} strokeWidth={1.7} />}>
            Age Limit - {values.age_group}
          </MetaRow>
        ) : null}
        {languages.length > 0 ? (
          <MetaRow icon={<Globe size={18} strokeWidth={1.7} />}>{languages.join(", ")}</MetaRow>
        ) : null}
        {genres.length > 0 ? (
          <MetaRow icon={<Theater size={18} strokeWidth={1.7} />}>{genres.join(", ")}</MetaRow>
        ) : null}
        {venueLabel ? (
          <MetaRow icon={<MapPin size={18} strokeWidth={1.7} />}>
            <span>{venueLabel}</span>
            {uniqueVenues.length > 1 ? (
              <span className="block mt-1.5 text-[0.9375rem] font-semibold" style={{ color: BRAND }}>
                View {uniqueVenues.length - 1} other venue
                {uniqueVenues.length - 1 === 1 ? "" : "s"}
              </span>
            ) : null}
          </MetaRow>
        ) : null}
      </div>
      <div className="border-t border-[#EEE] px-3.5 sm:px-5 py-3.5 sm:py-4 flex items-center gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          {minPrice != null && Number.isFinite(minPrice) ? (
            <p className="text-[1rem] sm:text-[1.0625rem] font-extrabold text-[#1A1A1A] leading-tight">
              {formatMoney(minPrice, { compact: true })} onwards
            </p>
          ) : (
            <p className="text-sm text-slate-500">Add tickets to show pricing</p>
          )}
        </div>
        <button
          type="button"
          disabled
          className="shrink-0 min-w-[7.5rem] sm:min-w-[8.75rem] px-4 sm:px-5 py-2.5 sm:py-3 rounded-[0.5rem] font-bold text-[0.9375rem] sm:text-[1rem] text-white opacity-90 cursor-default"
          style={{ backgroundColor: BRAND }}
        >
          Book Now
        </button>
      </div>
    </div>
  );

  const promoBannerCard = (
    <div className="w-[min(100%,520px)] sm:w-[420px] lg:w-[480px] relative aspect-[21/9] rounded-2xl overflow-hidden bg-[#111] shrink-0 shadow-sm">
      {promoBanner ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={promoBanner} alt={promoTitle} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#6900AA] to-[#9d00ff] flex items-center justify-center p-4">
          <p className="text-white font-semibold text-center">{promoTitle}</p>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      <div className="absolute left-3 right-3 bottom-3">
        <p className="text-white text-sm font-semibold line-clamp-1">{promoTitle}</p>
      </div>
      <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-white/90 text-[#6900AA]">
        Promoted
      </span>
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100 bg-slate-50 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-extrabold text-[#1A1A1A]">
              Customer view preview
            </h3>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Switch between the two customer screens below. This is what normal visitors will see
              after your event goes live — not the admin form.
            </p>
          </div>
          {onEditStep ? (
            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <button type="button" className="text-rose-700 hover:underline" onClick={() => onEditStep("details")}>
                Edit details
              </button>
              <button type="button" className="text-rose-700 hover:underline" onClick={() => onEditStep("venue")}>
                Edit venue
              </button>
              <button type="button" className="text-rose-700 hover:underline" onClick={() => onEditStep("artists")}>
                Edit artists
              </button>
              <button type="button" className="text-rose-700 hover:underline" onClick={() => onEditStep("media")}>
                Edit media
              </button>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 rounded-2xl bg-white border border-slate-200">
          <button
            type="button"
            onClick={() => setPreviewScreen("home")}
            className={`flex items-start gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${
              previewScreen === "home"
                ? "bg-[#6900AA] text-white shadow-sm"
                : "bg-transparent text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                previewScreen === "home" ? "bg-white/15" : "bg-[#F7E9FF] text-[#6900AA]"
              }`}
            >
              <Home size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wide opacity-80">
                Screen 1
              </span>
              <span className="block text-sm font-bold">Home page</span>
              <span
                className={`block text-xs mt-0.5 leading-snug ${
                  previewScreen === "home" ? "text-white/85" : "text-slate-500"
                }`}
              >
                First thing customers see when they open BookMyBota
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewScreen("event")}
            className={`flex items-start gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${
              previewScreen === "event"
                ? "bg-[#6900AA] text-white shadow-sm"
                : "bg-transparent text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                previewScreen === "event" ? "bg-white/15" : "bg-[#F7E9FF] text-[#6900AA]"
              }`}
            >
              <Ticket size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wide opacity-80">
                Screen 2
              </span>
              <span className="block text-sm font-bold">Your event page</span>
              <span
                className={`block text-xs mt-0.5 leading-snug ${
                  previewScreen === "event" ? "text-white/85" : "text-slate-500"
                }`}
              >
                Full page after a customer taps your event
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewScreen("booking")}
            className={`flex items-start gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${
              previewScreen === "booking"
                ? "bg-[#6900AA] text-white shadow-sm"
                : "bg-transparent text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                previewScreen === "booking" ? "bg-white/15" : "bg-[#F7E9FF] text-[#6900AA]"
              }`}
            >
              <LayoutGrid size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wide opacity-80">
                Screen 3
              </span>
              <span className="block text-sm font-bold">Customer booking layout</span>
              <span
                className={`block text-xs mt-0.5 leading-snug ${
                  previewScreen === "booking" ? "text-white/85" : "text-slate-500"
                }`}
              >
                Seat map customers use after Book Now
              </span>
            </span>
          </button>
        </div>
      </div>

      <div className="bg-[#F3F4F6] px-3 sm:px-5 lg:px-6 py-4 sm:py-5">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-slate-200 bg-slate-100">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
            </div>
            <div className="min-w-0 flex-1 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-[11px] sm:text-xs text-slate-500 truncate font-medium">
              {previewScreen === "home"
                ? "bookmybota.com  ·  Home"
                : previewScreen === "booking"
                  ? `bookmybota.com/events/…/book  ·  ${values.name?.trim() || "Your event"}`
                  : `bookmybota.com/events/…  ·  ${values.name?.trim() || "Your event"}`}
            </div>
          </div>

          <div className="bg-white px-3 sm:px-5 lg:px-6 py-4 sm:py-5">
            {previewScreen === "home" ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-[#E9D5FF] bg-[#FBF6FF] px-3.5 py-3">
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    You are previewing the Home page
                  </p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Customers land here first. Below you can see where your event appears on that
                    page
                    {wantPromotion && promoPlan
                      ? ` with your “${promoPlan.name}” promotion.`
                      : "."}
                  </p>
                  {wantPromotion && promoPlan && onEditStep ? (
                    <button
                      type="button"
                      className="mt-2 text-sm text-rose-700 font-medium"
                      onClick={() => onEditStep("media")}
                    >
                      Change promotion plan
                    </button>
                  ) : null}
                </div>

                {showLandingSlider ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6900AA] text-white text-[11px] font-bold">
                        A
                      </span>
                      <div>
                        <p className="text-sm font-bold text-[#1A1A1A]">Big banner at the top</p>
                        <p className="text-xs text-slate-500">
                          Shows in the main sliding banner when customers open the home page
                        </p>
                      </div>
                    </div>
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-[21/9] sm:aspect-[2.8/1] ring-2 ring-[#6900AA]/25">
                      {promoBanner ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={promoBanner}
                          alt={promoTitle}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : posterHorizontal ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={posterHorizontal}
                          alt={promoTitle}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-[#6900AA] to-[#3b0764]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent" />
                      <div className="absolute left-4 sm:left-7 top-1/2 -translate-y-1/2 right-4 max-w-md">
                        <span className="w-fit mb-2 inline-flex text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full bg-[#6900AA] text-white">
                          Events
                        </span>
                        <h2 className="text-white text-xl sm:text-2xl md:text-3xl font-extrabold leading-tight line-clamp-2 drop-shadow">
                          {promoTitle || values.name?.trim() || "Untitled event"}
                        </h2>
                        {(homeDateLabel || placeLine) && (
                          <div className="mt-3 flex flex-wrap items-center gap-4 text-white">
                            {homeDateLabel ? (
                              <div className="flex items-start gap-2 min-w-0">
                                <CalendarDays className="mt-0.5 shrink-0 text-white/80" size={16} />
                                <div className="min-w-0 leading-tight">
                                  <p className="text-[12px] sm:text-sm font-semibold">{homeDateLabel}</p>
                                  {weekdayLabel ? (
                                    <p className="text-[10px] sm:text-xs text-white/65">{weekdayLabel}</p>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                            {placeLine ? (
                              <div className="flex items-start gap-2 min-w-0">
                                <MapPin className="mt-0.5 shrink-0 text-white/80" size={16} />
                                <div className="min-w-0 leading-tight">
                                  <p className="text-[12px] sm:text-sm font-semibold truncate">
                                    {city || venueName}
                                  </p>
                                  {venueName && city ? (
                                    <p className="text-[10px] sm:text-xs text-white/65 truncate">
                                      {venueName}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                        <span className="mt-4 inline-flex items-center rounded-md bg-white px-3.5 py-2 text-xs font-bold text-[#6900AA]">
                          Book now
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6900AA] text-white text-[11px] font-bold">
                      {showLandingSlider ? "B" : "A"}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#1A1A1A]">Your card in Popular Events</p>
                      <p className="text-xs text-slate-500">
                        Customers scroll this row on the home page and tap your poster to open the
                        event
                        {wantPromotion ? " · Promoted badge is visible on your card" : ""}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[#EEE] bg-[#FAFAFA] p-3 sm:p-4 ring-2 ring-[#6900AA]/15">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h3 className="text-lg sm:text-xl font-extrabold text-[#1A1A1A]">
                        Popular Events
                      </h3>
                      <span className="inline-flex items-center h-9 px-3.5 rounded-full bg-[#F7E9FF] text-[#6900AA] text-sm font-semibold shrink-0">
                        See All
                      </span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {homePosterCard}
                      <div
                        className="snap-start shrink-0 w-[180px] sm:w-[200px] md:w-[220px] rounded-2xl border border-dashed border-slate-200 bg-white/70 flex items-center justify-center text-xs text-slate-400 px-4 text-center"
                        aria-hidden
                      >
                        Other events next to yours
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-600">
                    Next: see the full page customers open after they tap your event.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPreviewScreen("event")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#6900AA] text-white text-sm font-semibold px-3.5 py-2"
                  >
                    View your event page
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : previewScreen === "booking" ? (
              <div className="space-y-4">
                <div
                  className={`rounded-xl border px-3.5 py-3 ${
                    bookingPreview.kind === "map" && bookingPreview.status === "ready"
                      ? "border-emerald-200 bg-emerald-50/70"
                      : bookingPreview.kind === "map" && bookingPreview.status === "pending"
                        ? "border-amber-200 bg-amber-50/70"
                        : bookingPreview.kind === "waiting"
                          ? "border-amber-200 bg-amber-50/70"
                          : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold text-[#1A1A1A]">{bookingPreview.title}</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {bookingPreview.subtitle}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden bg-[#F3F4F6]">
                  <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {values.name?.trim() || "Your event"}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {[venueName, timeLabel].filter(Boolean).join(" · ") || "Customer booking"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-[#6900AA]">
                      Select seats
                    </span>
                  </div>

                  {bookingPreview.kind === "map" ? (
                    <div className="p-3 sm:p-4">
                      <LayoutSeatPreview
                        seats={bookingPreview.seats}
                        config={bookingPreview.config}
                        heightClass="h-64 sm:h-80"
                      />
                      {ticketTypesDisplay.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {ticketTypesDisplay.map((t) => (
                            <span
                              key={t.key}
                              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                            >
                              {t.ticket_type}
                              <span className="text-slate-500">
                                {formatMoney(t.price, { compact: true })}
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="p-5 sm:p-8 space-y-4">
                      <p className="text-sm text-slate-600 max-w-lg">
                        {bookingPreview.kind === "waiting"
                          ? "Default booking until your custom map is approved: customers choose ticket type and quantity only."
                          : "Customers book without picking seats on a map."}
                      </p>
                      {ticketTypesDisplay.length > 0 ? (
                        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden max-w-md">
                          {ticketTypesDisplay.map((t) => (
                            <li
                              key={t.key}
                              className="flex items-center justify-between gap-3 px-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{t.ticket_type}</p>
                                <p className="text-xs text-slate-500">Max {t.max_per_order} per order</p>
                              </div>
                              <p className="text-sm font-bold text-slate-900">
                                {formatMoney(t.price, { compact: true })}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-amber-800 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                          Add ticket types on the Venue step to preview booking options.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-white">
                    <p className="text-xs text-slate-500">0 seats · 0 ETB</p>
                    <span className="inline-flex rounded-xl bg-[#6900AA]/40 text-white text-sm font-semibold px-4 py-2">
                      Continue
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-600">Check your event page again?</p>
                  <button
                    type="button"
                    onClick={() => setPreviewScreen("event")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold px-3.5 py-2"
                  >
                    <Ticket size={15} />
                    Back to event page
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#E9D5FF] bg-[#FBF6FF] px-3.5 py-3">
                  <p className="text-sm font-semibold text-[#1A1A1A]">
                    You are previewing your Event page
                  </p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    This is the full event page — posters, tickets, artists, gallery, and terms —
                    just like customers see before they book.
                  </p>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <h1 className="min-w-0 text-[1.5rem] sm:text-[1.875rem] font-extrabold text-[#1A1A1A] leading-tight tracking-tight break-words">
                    {values.name?.trim() || "Untitled event"}
                    {wantPromotion ? (
                      <span className="ml-2 align-middle inline-flex items-center rounded-full bg-[#6900AA]/10 text-[#6900AA] border border-[#6900AA]/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                        Promoted
                      </span>
                    ) : null}
                  </h1>
                  <span className="mt-1 shrink-0 h-9 w-9 rounded-full border border-slate-200 text-slate-400 flex items-center justify-center">
                    <Share2 size={16} />
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5 lg:gap-6">
                  <div className="min-w-0">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6900AA] text-white text-[11px] font-bold">
                        1
                      </span>
                      <p className="text-xs text-slate-500">
                        Poster / video at the top of your event page
                      </p>
                    </div>
                    <EventMediaSlider
                      eventName={values.name || "Event"}
                      posterHorizontal={posterHorizontal}
                      youtubeUrl={values.youtube_url}
                    />

                    {showDetailBanner ? (
                      <section className="mt-4">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#6900AA] text-white text-[11px] font-bold">
                            2
                          </span>
                          <p className="text-xs text-slate-500">
                            Promotion banner on your event page
                          </p>
                        </div>
                        <div className="flex gap-3 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden pb-1">
                          {promoBannerCard}
                        </div>
                      </section>
                    ) : null}

                    <div className="mt-3 sm:mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
                        {categoryBadges.map((badge) => (
                          <span
                            key={badge}
                            className="inline-flex items-center rounded-full bg-[#1B365D] text-white text-[0.8125rem] sm:text-[0.9375rem] font-semibold px-3 py-1.5"
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 sm:ml-auto shrink-0">
                        <button
                          type="button"
                          disabled
                          className="rounded-lg border px-3.5 py-2 text-[0.9375rem] font-semibold opacity-80 cursor-default"
                          style={{
                            color: BRAND,
                            borderColor: BRAND,
                            backgroundColor: "transparent",
                          }}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <ThumbsUp size={15} /> I&apos;m Interested
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="lg:hidden mt-4">
                      <p className="mb-2 text-xs text-slate-500">Booking box (date, venue, price)</p>
                      {bookingCard}
                    </div>

                    {aboutText ? (
                      <section className="mt-6 sm:mt-8">
                        <h2 className="text-[1.125rem] sm:text-[1.25rem] font-bold text-[#1A1A1A] mb-2.5">
                          About The Event
                        </h2>
                        <p className="text-[0.9375rem] sm:text-[1rem] leading-7 text-[#5A5A5A] whitespace-pre-wrap">
                          {displayAbout}
                          {aboutLong ? (
                            <>
                              {" "}
                              <button
                                type="button"
                                onClick={() => setAboutExpanded((v) => !v)}
                                className="font-semibold hover:underline"
                                style={{ color: BRAND }}
                              >
                                {aboutExpanded ? "Read Less" : "Read More"}
                              </button>
                            </>
                          ) : null}
                        </p>
                      </section>
                    ) : null}

                    {ticketTypesDisplay.length > 0 ? (
                      <section className="mt-6 sm:mt-8">
                        <h2 className="text-[1.125rem] sm:text-[1.25rem] font-bold text-[#1A1A1A] mb-2.5">
                          Tickets
                        </h2>
                        <ul className="divide-y divide-[#EEE] rounded-xl border border-[#E8E8E8] overflow-hidden">
                          {ticketTypesDisplay.map((t) => (
                            <li
                              key={t.key}
                              className="flex items-start justify-between gap-3 px-3.5 sm:px-4 py-3 bg-white"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold text-[#1A1A1A] text-[0.9375rem] sm:text-[1rem]">
                                  {t.ticket_type}
                                </p>
                                <p className="mt-0.5 text-[0.8125rem] text-[#6B6B6B]">
                                  Max {t.max_per_order} per order
                                </p>
                              </div>
                              <p className="shrink-0 font-extrabold text-[#1A1A1A] text-[0.9375rem] sm:text-[1rem]">
                                {formatMoney(t.price, { compact: true })}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}

                    {artists.length > 0 ? (
                      <section className="mt-6 sm:mt-8">
                        <h2 className="text-[1.125rem] sm:text-[1.25rem] font-bold text-[#1A1A1A] mb-2.5">
                          Artists
                        </h2>
                        <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {artists.map((artist, i) => (
                            <div
                              key={`${artist.name}-${i}`}
                              className="w-[120px] sm:w-[140px] shrink-0 text-left"
                            >
                              <div className="relative h-[148px] sm:h-[172px] rounded-xl overflow-hidden bg-slate-200">
                                {artist.image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={resolveMediaUrl(artist.image_url)}
                                    alt={artist.name}
                                    className="absolute inset-0 w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center text-[1.25rem] font-extrabold text-white bg-[#1B365D]">
                                    {artist.name.slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <p className="mt-1.5 font-bold text-[#1A1A1A] text-[0.9375rem] leading-snug">
                                {artist.name}
                              </p>
                              {artist.role ? (
                                <p className="mt-0.5 text-[0.8125rem] text-[#8A8A8A]">{artist.role}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {gallery.length > 0 ? (
                      <div className="mt-6 sm:mt-8">
                        <EventGallerySection eventName={values.name || "Event"} images={gallery} />
                      </div>
                    ) : null}

                    {resolvedTermLines.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setTermsOpen(true)}
                        className="mt-3 sm:mt-4 flex w-full items-center justify-between py-3.5 sm:py-4 border-t border-slate-200 cursor-pointer text-left"
                      >
                        <span className="text-[1.125rem] sm:text-[1.25rem] font-bold text-[#1A1A1A]">
                          Terms &amp; Conditions
                        </span>
                        <ChevronRight size={18} className="text-slate-400 shrink-0" />
                      </button>
                    ) : (
                      <p className="mt-4 text-xs text-slate-500 border-t border-slate-100 pt-3">
                        Tip: add Terms &amp; Conditions in Media — customers open them in a popup
                        from this same row.
                      </p>
                    )}
                  </div>

                  <aside className="hidden lg:block">
                    <p className="mb-2 text-xs text-slate-500">Booking box on the right side</p>
                    {bookingCard}
                  </aside>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-600">
                    Next: see the seat map customers use after they tap Book Now.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPreviewScreen("booking")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#6900AA] text-white text-sm font-semibold px-3.5 py-2"
                  >
                    <LayoutGrid size={15} />
                    View booking layout
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {portalReady &&
        termsOpen &&
        resolvedTermLines.length > 0 &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/55"
            onClick={() => setTermsOpen(false)}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="preview-event-terms-title"
              className="relative w-full sm:max-w-[560px] max-h-[90vh] sm:max-h-[85vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 px-5 sm:px-8 pt-5 sm:pt-7 pb-2">
                <h2
                  id="preview-event-terms-title"
                  className="text-[1.375rem] sm:text-[1.625rem] lg:text-[1.875rem] font-extrabold text-[#333] leading-tight pr-8"
                >
                  Terms &amp; Conditions
                </h2>
                <button
                  type="button"
                  aria-label="Close terms"
                  onClick={() => setTermsOpen(false)}
                  className="absolute top-4 right-4 sm:top-6 sm:right-6 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8E8E8] text-[#555] hover:bg-[#ddd] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto px-5 sm:px-8 pb-6 sm:pb-8 pt-3 max-h-[calc(90vh-5rem)] sm:max-h-[calc(85vh-5.5rem)] space-y-1.5">
                {resolvedTermLines.map((line, i) => (
                  <p
                    key={`${i}-${line.slice(0, 24)}`}
                    className="text-[1rem] sm:text-[1.0625rem] lg:text-[1.125rem] leading-7 sm:leading-[1.7] text-[#4A4A4A]"
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
