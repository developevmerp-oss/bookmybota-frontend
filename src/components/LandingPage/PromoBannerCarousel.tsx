"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import type { Business, MarketingCampaign, Movie, PublicEvent } from "@/services/api";
import {
  useGetActiveMarketingPromotionsQuery,
  useGetPublicMoviesQuery,
} from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { restaurantHref } from "@/lib/businessPublicPath";
import { formatDateCustomer, getVenueDateTimeParts } from "@/lib/dateFormat";
import { promotionClickHref } from "@/lib/promotionCta";
import { useHomeCatalog } from "./useHomeCatalog";
import {
  eventLandscape,
  eventPortrait,
  eventsWithImage,
  hasCityFilter,
  preferCityOrAll,
} from "./homeUtils";
import { PromoBannerShimmer } from "@/components/Shared/Shimmer";
import { promoBannerDotIndex, promoBannerMode, preparePromoLoopSlides } from "./promoBannerLoop";
import {
  promoNormalizeWrap,
  promoSlideNext,
  promoSlidePrev,
  promoSlideToDot,
  usePromoWrapAutoplay,
} from "./promoBannerNav";
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
    const y = getVenueDateTimeParts(iso)?.y;
    if (y) return { title: name, year: String(y) };
  }
  return { title: name, year: undefined };
}

function formatSlideDate(iso?: string) {
  const parts = getVenueDateTimeParts(iso);
  if (!parts) return null;
  return {
    dateLabel: formatDateCustomer(iso),
    weekdayLabel: parts.weekdayLong,
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
    href: restaurantHref(place),
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
  const { linkedEvent, linkedMovie, linkedDining } = resolvePromoLinks(promo, ctx);
  const href =
    promotionClickHref(promo) ||
    (linkedDining ? restaurantHref(linkedDining) : "") ||
    categoryFallbackHref(promo.category);

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

  // Frame aspect matches partner admin crop (3:1 / 1920×640).
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#111]">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={slide.image}
          alt=""
          aria-hidden
          className="promo-slide-photo h-full w-full object-cover object-center"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="h-full w-full promo-slide-fallback" aria-hidden />
      )}
    </div>
  );
}

export default function PromoBannerCarousel({ city }: PromoBannerCarouselProps) {
  const {
    events,
    fallbackEvents,
    cityEvents,
    dining,
  } = useHomeCatalog(city);
  const hasCity = hasCityFilter(city);
  const { data: cityMoviesData } = useGetPublicMoviesQuery({
    limit: 50,
    ...(hasCity ? { city } : {}),
  });
  const { data: allMoviesData } = useGetPublicMoviesQuery({ limit: 50 }, { skip: !hasCity });
  const movieItems = preferCityOrAll(
    cityMoviesData?.items ?? [],
    allMoviesData?.items ?? [],
    hasCity
  );
  const { data: promotions = [], isLoading: loadingPromos, isFetching: fetchingPromos } =
    useGetActiveMarketingPromotionsQuery({
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

    const dedupeByImage = (list: Slide[]) => {
      const seen = new Set<string>();
      return list.filter((s) => {
        const key = (s.image || "").trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    // Only paid landing-slider campaigns. Events are not used as filler slides.
    if (promotions.length === 0) return [];
    return dedupeByImage(
      promotions
        .slice(0, 10)
        .map((p) => promoToSlide(p, linkCtx))
        .filter((s) => Boolean(s.image?.trim()) && Boolean(s.title?.trim()))
    );
  }, [promotions, city, eventsById, moviesById, diningById]);

  const loading = loadingPromos || fetchingPromos;

  const { renderSlides, originalCount, startIndex, useWrapTrack } = useMemo(
    () => preparePromoLoopSlides(slides),
    [slides]
  );
  const multi = originalCount > 1;
  const { pauseAutoplay, resumeAutoplay } = usePromoWrapAutoplay(
    swiperRef,
    multi && !loading,
    originalCount,
    useWrapTrack
  );

  if (loading) {
    return <PromoBannerShimmer />;
  }

  if (slides.length === 0) return null;

  const { edgeBounds } = promoBannerMode(originalCount, useWrapTrack);

  return (
    <section
      className={`promo-banner-swiper w-full bg-white pt-2 sm:pt-2.5 lg:pt-3 pb-5 sm:pb-6 lg:pb-7 ${
        multi ? "is-multi" : "is-single"
      }`}
    >
      <div
        className={`relative w-full promo-banner-frame ${multi ? "" : "promo-banner-single-wrap"}`}
        onMouseEnter={pauseAutoplay}
        onMouseLeave={resumeAutoplay}
      >
        <Swiper
          key={`promo-dyn-${slides.map((s) => s.id).join("-")}-wrap`}
          className="promo-banner-peek w-full"
          loop={false}
          initialSlide={startIndex}
          speed={600}
          centeredSlides={multi}
          centeredSlidesBounds={edgeBounds}
          grabCursor={multi}
          allowTouchMove={multi}
          slidesPerView={multi ? "auto" : 1}
          spaceBetween={multi ? 8 : 0}
          watchSlidesProgress={multi}
          breakpoints={
            multi
              ? {
                  640: { spaceBetween: 10 },
                  768: { spaceBetween: 12 },
                  1024: { spaceBetween: 14 },
                  1280: { spaceBetween: 16 },
                }
              : undefined
          }
          onSwiper={(swiper) => {
            swiperRef.current = swiper;
            requestAnimationFrame(() => {
              swiper.update();
              if (useWrapTrack) swiper.slideTo(startIndex, 0, false);
              setActiveDot(0);
            });
          }}
          onSlideChange={(swiper) => {
            if (!multi || originalCount <= 0) return;
            setActiveDot(promoBannerDotIndex(swiper.activeIndex, originalCount));
          }}
          onSlideChangeTransitionEnd={(swiper) => {
            if (useWrapTrack) promoNormalizeWrap(swiper, originalCount);
          }}
        >
          {renderSlides.map((slide) => (
            <SwiperSlide key={slide.id} className="promo-banner-slide">
              <Link
                href={slide.href}
                aria-label={`${slide.title}${slide.year ? ` ${slide.year}` : ""}`}
                className="promo-banner-card group relative block h-full w-full overflow-hidden rounded-xl sm:rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#6900AA] focus-visible:ring-offset-2"
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
              onClick={(e) => {
                e.preventDefault();
                promoSlidePrev(swiperRef.current, originalCount, useWrapTrack);
              }}
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
            </button>
            <button
              ref={nextRef}
              type="button"
              aria-label="Next banner"
              className="promo-nav-btn promo-nav-next"
              onClick={(e) => {
                e.preventDefault();
                promoSlideNext(swiperRef.current, originalCount, useWrapTrack);
              }}
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} />
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
                    promoSlideToDot(swiperRef.current, index, originalCount, useWrapTrack);
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
