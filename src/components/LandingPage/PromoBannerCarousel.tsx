"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import type { Business, MarketingCampaign, Movie, PublicEvent } from "@/services/api";
import {
  useGetActiveMarketingPromotionsQuery,
  useGetPublicMoviesQuery,
} from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { formatDateCustomer } from "@/lib/dateFormat";
import { promotionClickHref } from "@/lib/promotionCta";
import { useHomeCatalog } from "./useHomeCatalog";
import {
  eventLandscape,
  eventPortrait,
  eventsWithImage,
  hasCityFilter,
  preferCityOrAll,
} from "./homeUtils";
import "./PromoBannerCarousel.css";

type PromoBannerCarouselProps = {
  city: string;
};

type Slide = {
  id: string;
  title: string;
  year?: string;
  tagline?: string;
  image: string;
  href: string;
  badge: string;
  dateLabel?: string;
  weekdayLabel?: string;
  cityLabel?: string;
  placeLabel?: string;
  /** Right-side script — always from promotion / linked entity data */
  accent?: string;
  /** True when slide uses a designed promo banner creative */
  designed?: boolean;
  cta: string;
};

function categoryBadge(category?: string, fallback = "EVENT") {
  const key = (category || "").toUpperCase();
  if (!key || key === "ALL" || key === "EVENTS") return fallback;
  if (key === "MOVIES") return "MOVIE";
  return key;
}

function ctaFor(category?: string, targetType?: string) {
  const key = (category || targetType || "").toUpperCase();
  if (key === "DINING" || key === "RESTAURANT" || key === "BUSINESS") return "Reserve Now";
  if (key === "MOVIES" || key === "MOVIE") return "Book Now";
  return "Book Tickets";
}

function splitTitleYear(name: string, iso?: string) {
  const match = name.match(/^(.*?)[\s,:-]*((?:19|20)\d{2})\s*$/);
  if (match) return { title: match[1].trim() || name, year: match[2] };
  if (iso) {
    const y = new Date(iso).getFullYear();
    if (!Number.isNaN(y)) return { title: name, year: String(y) };
  }
  return { title: name, year: undefined };
}

function formatSlideDate(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    dateLabel: formatDateCustomer(d),
    weekdayLabel: d.toLocaleDateString("en-US", { weekday: "long" }),
  };
}

function normalizePhrase(value?: string | null) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function shortAbout(about?: string | null, excludeName?: string) {
  const raw = normalizePhrase(about);
  if (!raw) return undefined;
  const name = normalizePhrase(excludeName).toLowerCase();
  if (name && raw.toLowerCase() === name) return undefined;
  if (name && raw.toLowerCase().startsWith(name) && raw.length - name.length < 8) return undefined;
  // Never surface internal marketing-plan labels as customer copy
  if (isInternalPlanLabel(raw)) return undefined;
  return raw.length > 56 ? `${raw.slice(0, 53).trim()}…` : raw;
}

/** Plan / product labels that must not appear on the public hero. */
function isInternalPlanLabel(value?: string | null) {
  const t = normalizePhrase(value).toLowerCase();
  if (!t) return false;
  return (
    /^(list|listing)\s+promotion/.test(t) ||
    /^landing\s+slider/.test(t) ||
    /^category\s+rail/.test(t) ||
    /^top\s+search\s+priority/.test(t) ||
    t === "promotion" ||
    t === "featured"
  );
}

/**
 * Right-side script text — only from partner-entered slider_accent_text.
 * Never invents fallback copy when the field is empty.
 */
function accentFromPromo(raw?: string | null) {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  if (!text || isInternalPlanLabel(text)) return undefined;
  return text;
}

function taglineVisible(slide: Slide) {
  if (!slide.tagline?.trim()) return false;
  const t = slide.tagline.trim().toLowerCase().replace(/\s+/g, " ");
  const title = slide.title.trim().toLowerCase();
  const withYear = `${title} ${slide.year || ""}`.trim().toLowerCase();
  if (t === title || t === withYear) return false;
  if (withYear.includes(t) && t.length <= withYear.length) return false;
  if (t.includes(title) && Math.abs(t.length - withYear.length) < 8) return false;
  return true;
}

function eventToSlide(event: PublicEvent, city: string): Slide {
  const when = formatSlideDate(event.next_showtime);
  const { title, year } = splitTitleYear(event.name, event.next_showtime);
  const cityLabel = event.city_name?.trim() || (city && city !== "All Cities" ? city : "");
  const placeLabel = event.venue_name?.trim() || "";

  return {
    id: `event-${event.id}`,
    title,
    year,
    tagline: shortAbout(event.about_event, event.name) ||
      (event.category_name ? `${event.category_name} • Live near you` : undefined),
    image: eventLandscape(event) || eventPortrait(event),
    href: `/events/${event.id}`,
    badge: categoryBadge(event.category_slug || event.category_name, "EVENT"),
    dateLabel: when?.dateLabel,
    weekdayLabel: when?.weekdayLabel,
    cityLabel: cityLabel || placeLabel || undefined,
    placeLabel: cityLabel ? placeLabel || undefined : undefined,
    accent: undefined,
    designed: false,
    cta: "Book Tickets",
  };
}

function movieToSlide(movie: Movie): Slide {
  const when = formatSlideDate(movie.release_date || undefined);
  const { title, year } = splitTitleYear(movie.title, movie.release_date || undefined);
  const genre = movie.genres?.[0];

  return {
    id: `movie-${movie.id}`,
    title,
    year,
    tagline: shortAbout(movie.description, movie.title) ||
      (genre ? `${genre} • Now on screen` : undefined),
    image: resolveMediaUrl(movie.banner_url || movie.poster_url || ""),
    href: `/movies/${movie.id}`,
    badge: "MOVIE",
    dateLabel: when?.dateLabel,
    weekdayLabel: when?.weekdayLabel,
    accent: undefined,
    designed: false,
    cta: "Book Now",
  };
}

function diningToSlide(place: Business, city: string): Slide {
  const cityLabel =
    place.city_name?.trim() || (city && city !== "All Cities" ? city : "");
  const title = place.name;

  return {
    id: `dining-${place.id}`,
    title,
    tagline: shortAbout(place.description, place.name) || "Reserve your table",
    image: resolveMediaUrl(place.cover_image_url || ""),
    href: `/restaurant/${place.id}`,
    badge: "DINING",
    cityLabel: cityLabel || undefined,
    placeLabel: place.address?.split(",")[0]?.trim() || undefined,
    accent: undefined,
    designed: false,
    cta: "Reserve Now",
  };
}

function resolvePromoLinks(
  promo: MarketingCampaign,
  ctx: {
    eventsById: Map<string, PublicEvent>;
    moviesById: Map<string, Movie>;
    diningById: Map<string, Business>;
  }
) {
  const targetType = String(promo.target_type || "").toUpperCase();
  const targetId = promo.target_id ? String(promo.target_id) : "";
  const linkedEvent =
    targetType === "EVENT" && targetId ? ctx.eventsById.get(targetId) : undefined;
  const linkedMovie =
    targetType === "MOVIE" && targetId ? ctx.moviesById.get(targetId) : undefined;
  const linkedDining =
    (targetType === "RESTAURANT" || targetType === "BUSINESS") && targetId
      ? ctx.diningById.get(targetId) || ctx.diningById.get(String(promo.business_id || ""))
      : targetType === "" && promo.category?.toUpperCase() === "DINING"
        ? ctx.diningById.get(String(promo.business_id || ""))
        : undefined;
  return { linkedEvent, linkedMovie, linkedDining, targetType, targetId };
}

function promoToSlide(
  promo: MarketingCampaign,
  ctx: {
    city: string;
    eventsById: Map<string, PublicEvent>;
    moviesById: Map<string, Movie>;
    diningById: Map<string, Business>;
  }
): Slide {
  const banner = resolveMediaUrl(promo.banner_image_url || "");
  const designed = Boolean(banner);
  const href = promotionClickHref(promo) || categoryFallbackHref(promo.category);
  const { linkedEvent, linkedMovie, linkedDining } = resolvePromoLinks(promo, ctx);

  // Base from linked entity when available
  let base: Slide | null = null;
  if (linkedEvent) base = eventToSlide(linkedEvent, ctx.city);
  else if (linkedMovie) base = movieToSlide(linkedMovie);
  else if (linkedDining) base = diningToSlide(linkedDining, ctx.city);

  // Prefer a real campaign title; never use marketing plan name as the hero title.
  const rawPromoTitle = normalizePhrase(promo.title);
  const promoTitle =
    rawPromoTitle && !isInternalPlanLabel(rawPromoTitle)
      ? rawPromoTitle
      : base?.title || "Featured";
  const { title: splitTitle, year: splitYear } = splitTitleYear(
    promoTitle,
    linkedEvent?.next_showtime || linkedMovie?.release_date || undefined
  );

  // Prefer linked event/movie/dining title when promo title is missing or is a plan label
  const title =
    base && (!rawPromoTitle || isInternalPlanLabel(rawPromoTitle))
      ? base.title
      : splitTitle;
  const year = base?.year || splitYear;

  const accent = accentFromPromo(promo.slider_accent_text);

  return {
    id: `promo-${promo.id}`,
    title,
    year,
    // Customer-facing tagline only — never marketing plan_name ("List promotion", etc.)
    tagline:
      shortAbout(base?.tagline, title) ||
      shortAbout(
        linkedEvent?.about_event ||
          linkedMovie?.description ||
          linkedDining?.description ||
          null,
        title
      ) ||
      (linkedEvent?.category_name
        ? `${linkedEvent.category_name} • Live near you`
        : undefined),
    // Slider API requires banner — always prefer the promotion creative
    image: banner || base?.image || "",
    href,
    badge: categoryBadge(promo.category || base?.badge, base?.badge || "EVENT"),
    dateLabel: base?.dateLabel,
    weekdayLabel: base?.weekdayLabel,
    cityLabel: base?.cityLabel,
    placeLabel: base?.placeLabel,
    // Partner-entered accent text from promotion purchase
    accent,
    designed,
    cta: ctaFor(promo.category, promo.target_type),
  };
}

function SlideCard({ slide }: { slide: Slide }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(slide.image) && !failed;
  const hasMeta = Boolean(slide.dateLabel || slide.cityLabel);
  const showTagline = taglineVisible(slide);
  const showAccent = Boolean(slide.accent?.trim());
  const isDesignedPoster = Boolean(slide.designed && showImage);

  return (
    <>
      <div className="absolute inset-0">
        {showImage ? (
          <img
            src={slide.image}
            alt=""
            aria-hidden
            className={`promo-slide-photo h-full w-full object-cover ${
              isDesignedPoster ? "promo-slide-photo--designed" : ""
            }`}
            draggable={false}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="h-full w-full promo-slide-fallback" aria-hidden />
        )}
        <div
          className={`pointer-events-none absolute inset-0 ${
            isDesignedPoster
              ? "promo-slide-scrim-designed"
              : showImage
                ? "promo-slide-scrim-poster"
                : "promo-slide-scrim"
          }`}
        />
      </div>

      {showAccent ? (
        <div className="promo-accent-wrap pointer-events-none absolute z-[3] hidden sm:block" aria-hidden>
          <span className="promo-accent-glow" />
          <span className="promo-accent-script">{slide.accent}</span>
        </div>
      ) : null}

      <div
        className={`relative z-[2] flex h-full flex-col justify-center pl-5 pr-2 sm:pl-7 sm:pr-4 md:pl-9 md:pr-6 pb-6 sm:pb-8 ${
          isDesignedPoster
            ? "max-w-[52%] sm:max-w-[46%] md:max-w-[42%]"
            : "max-w-[58%] sm:max-w-[52%] md:max-w-[48%] lg:max-w-[46%]"
        }`}
      >
        <span className="w-fit mb-2 sm:mb-2.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full bg-[#6900AA] text-white shadow-sm">
          {slide.badge}
        </span>

        <h2 className="text-white text-xl sm:text-2xl md:text-3xl lg:text-[2rem] font-extrabold leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] line-clamp-2">
          {slide.title}
          {slide.year ? (
            <>
              {" "}
              <span className="promo-year-gradient">{slide.year}</span>
            </>
          ) : null}
        </h2>

        {showTagline ? (
          <p className="mt-1 sm:mt-1.5 text-white/75 text-[11px] sm:text-sm font-medium line-clamp-1">
            {slide.tagline}
          </p>
        ) : null}

        {hasMeta ? (
          <div className="mt-3 sm:mt-4 flex items-center gap-3 sm:gap-4 text-white">
            {slide.dateLabel ? (
              <div className="flex items-start gap-2 min-w-0">
                <CalendarDays className="mt-0.5 shrink-0 text-white/80" size={16} strokeWidth={2} />
                <div className="min-w-0 leading-tight">
                  <p className="text-[12px] sm:text-sm font-semibold truncate">{slide.dateLabel}</p>
                  {slide.weekdayLabel ? (
                    <p className="text-[10px] sm:text-xs text-white/65">{slide.weekdayLabel}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {slide.dateLabel && slide.cityLabel ? (
              <span className="hidden sm:block w-px h-8 bg-white/30 shrink-0" aria-hidden />
            ) : null}

            {slide.cityLabel ? (
              <div className="hidden sm:flex items-start gap-2 min-w-0">
                <MapPin className="mt-0.5 shrink-0 text-white/80" size={16} strokeWidth={2} />
                <div className="min-w-0 leading-tight">
                  <p className="text-[12px] sm:text-sm font-semibold truncate">{slide.cityLabel}</p>
                  {slide.placeLabel ? (
                    <p className="text-[10px] sm:text-xs text-white/65 truncate">{slide.placeLabel}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <span className="promo-cta-btn mt-3.5 sm:mt-5 inline-flex w-fit items-center gap-1.5 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 text-[12px] sm:text-sm font-bold text-white shadow-[0_8px_20px_rgba(236,72,153,0.35)] transition-transform duration-200 group-hover:scale-[1.03]">
          {slide.cta}
          <ArrowRight size={15} strokeWidth={2.5} />
        </span>
      </div>
    </>
  );
}

export default function PromoBannerCarousel({ city }: PromoBannerCarouselProps) {
  const {
    events,
    fallbackEvents,
    cityEvents,
    dining,
    isLoadingEvents,
    isLoadingFallback,
  } = useHomeCatalog(city);
  const hasCity = hasCityFilter(city);
  const { data: cityMoviesData, isLoading: loadingCityMovies } = useGetPublicMoviesQuery({
    limit: 50,
    ...(hasCity ? { city } : {}),
  });
  const { data: allMoviesData, isLoading: loadingAllMovies } = useGetPublicMoviesQuery(
    { limit: 50 },
    { skip: !hasCity }
  );
  const movieItems = preferCityOrAll(
    cityMoviesData?.items ?? [],
    allMoviesData?.items ?? [],
    hasCity
  );
  const loadingMovies =
    loadingCityMovies || (hasCity && (cityMoviesData?.items?.length ?? 0) === 0 && loadingAllMovies);
  const { data: promotions = [], isLoading: loadingPromos } = useGetActiveMarketingPromotionsQuery({
    surface: "slider",
    ...(hasCity ? { city } : {}),
  });
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const swiperRef = useRef<SwiperType | null>(null);
  const [activeDot, setActiveDot] = useState(0);

  /** Location-strict event banners: city only when selected; all when no city. Never fall back. */
  const locationBannerEvents = useMemo(() => {
    if (hasCity) return eventsWithImage(cityEvents);
    return eventsWithImage(fallbackEvents.length ? fallbackEvents : events);
  }, [hasCity, cityEvents, fallbackEvents, events]);

  const eventsById = useMemo(() => {
    const map = new Map<string, PublicEvent>();
    for (const list of [locationBannerEvents, cityEvents, events, fallbackEvents]) {
      for (const e of list) map.set(String(e.id), e);
    }
    return map;
  }, [locationBannerEvents, cityEvents, events, fallbackEvents]);

  const moviesById = useMemo(() => {
    const map = new Map<string, Movie>();
    for (const m of movieItems) map.set(String(m.id), m);
    return map;
  }, [movieItems]);

  const diningById = useMemo(() => {
    const map = new Map<string, Business>();
    for (const d of dining) map.set(String(d.id), d);
    return map;
  }, [dining]);

  const slides = useMemo<Slide[]>(() => {
    const linkCtx = { city, eventsById, moviesById, diningById };

    // Priority 1: location-scoped landing-slider promotions (API filters by city)
    if (promotions.length > 0) {
      const fromPromos = promotions
        .slice(0, 10)
        .map((p) => promoToSlide(p, linkCtx))
        .filter((s) => Boolean(s.image?.trim()) && Boolean(s.title?.trim()));
      if (fromPromos.length > 0) return fromPromos;
    }

    // Priority 2: location-scoped events only — hide section if none for this city
    return locationBannerEvents
      .slice(0, 8)
      .map((event) => eventToSlide(event, city))
      .filter((s) => Boolean(s.image?.trim()) && Boolean(s.title?.trim()));
  }, [promotions, locationBannerEvents, city, eventsById, moviesById, diningById]);

  // Peek gutters need neighboring cards. With only 2–3 slides Swiper can't fill
  // left/right peeks, so duplicate until we have enough for a seamless loop.
  const displaySlides = useMemo(() => {
    if (slides.length <= 1) return slides;
    const minNeeded = 6;
    if (slides.length >= minNeeded) return slides;
    const out: Slide[] = [];
    let copy = 0;
    while (out.length < minNeeded) {
      for (const s of slides) {
        out.push(copy === 0 ? s : { ...s, id: `${s.id}__c${copy}` });
        if (out.length >= minNeeded) break;
      }
      copy += 1;
    }
    return out;
  }, [slides]);

  const loading =
    loadingPromos ||
    (promotions.length === 0 &&
      (isLoadingEvents || loadingMovies || (hasCity && slides.length === 0 && isLoadingFallback)));

  if (loading) {
    return (
      <section className="promo-banner-swiper is-single w-full bg-[#F5F5F5] pt-3 sm:pt-4 pb-3 sm:pb-4">
        <div className="promo-banner-single-wrap">
          <div className="promo-banner-frame rounded-2xl sm:rounded-3xl overflow-hidden promo-slide-skeleton" />
        </div>
      </section>
    );
  }

  if (slides.length === 0) return null;

  const multi = slides.length > 1;
  const originalCount = slides.length;

  return (
    <section
      className={`promo-banner-swiper w-full bg-[#F5F5F5] pt-3 sm:pt-4 pb-3 sm:pb-4 ${
        multi ? "is-multi" : "is-single"
      }`}
    >
      <div className={`relative w-full ${multi ? "" : "promo-banner-single-wrap"}`}>
        <Swiper
          key={`promo-dyn-${slides.map((s) => s.id).join("-")}-${displaySlides.length}`}
          modules={[Autoplay, Navigation]}
          className="promo-banner-peek w-full"
          loop={multi}
          loopAdditionalSlides={multi ? 2 : 0}
          speed={600}
          centeredSlides={multi}
          centeredSlidesBounds={!multi}
          grabCursor={multi}
          allowTouchMove={multi}
          slidesPerView={multi ? "auto" : 1}
          spaceBetween={multi ? 14 : 0}
          watchSlidesProgress={multi}
          breakpoints={
            multi
              ? {
                  640: { spaceBetween: 16 },
                  768: { spaceBetween: 18 },
                  1024: { spaceBetween: 20 },
                }
              : undefined
          }
          autoplay={
            multi
              ? {
                  delay: 5000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                  stopOnLastSlide: false,
                  waitForTransition: true,
                }
              : false
          }
          navigation={
            multi
              ? {
                  prevEl: prevRef.current,
                  nextEl: nextRef.current,
                }
              : false
          }
          onBeforeInit={(swiper: SwiperType) => {
            if (!multi) return;
            const nav = swiper.params?.navigation;
            if (nav && typeof nav !== "boolean") {
              nav.prevEl = prevRef.current;
              nav.nextEl = nextRef.current;
            }
          }}
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
            if (!multi) return;
            setTimeout(() => {
              const nav = swiper.params?.navigation;
              if (!nav || typeof nav === "boolean") return;
              nav.prevEl = prevRef.current;
              nav.nextEl = nextRef.current;
              swiper.navigation?.destroy?.();
              swiper.navigation?.init?.();
              swiper.navigation?.update?.();
            });
          }}
          onSlideChange={(swiper) => {
            if (!multi || originalCount <= 0) return;
            const real = ((swiper.realIndex % originalCount) + originalCount) % originalCount;
            setActiveDot(real);
          }}
        >
          {displaySlides.map((slide) => (
            <SwiperSlide key={slide.id} className="promo-banner-slide">
              <Link
                href={slide.href}
                aria-label={`${slide.title}${slide.year ? ` ${slide.year}` : ""}`}
                className="promo-banner-card group relative flex h-full w-full overflow-hidden rounded-2xl sm:rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-[#6900AA] focus-visible:ring-offset-2"
              >
                <SlideCard slide={slide} />
              </Link>
            </SwiperSlide>
          ))}
        </Swiper>

        {multi ? (
          <>
            <button
              ref={prevRef}
              type="button"
              aria-label="Previous banner"
              className="promo-nav-btn promo-nav-prev"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.25} />
            </button>
            <button
              ref={nextRef}
              type="button"
              aria-label="Next banner"
              className="promo-nav-btn promo-nav-next"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.25} />
            </button>
            <div className="promo-banner-dots" role="tablist" aria-label="Banner slides">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-label={`Show ${slide.title}`}
                  aria-selected={index === activeDot}
                  className={`promo-banner-dot ${index === activeDot ? "is-active" : ""}`}
                  onClick={() => {
                    const swiper = swiperRef.current;
                    if (!swiper) return;
                    // Jump to the matching slide in the first copy set
                    swiper.slideToLoop(index);
                    setActiveDot(index);
                  }}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function categoryFallbackHref(category?: string) {
  switch ((category || "").toUpperCase()) {
    case "DINING":
      return "/dining";
    case "MOVIES":
      return "/movies";
    case "SPORTS":
      return "/events?q=sports";
    case "EVENTS":
      return "/events";
    default:
      return "/";
  }
}
