"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import type {
  Business,
  MarketingCampaign,
  Movie,
  PublicEvent,
} from "@/services/api";
import { useGetActiveMarketingPromotionsQuery } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { restaurantHref } from "@/lib/businessPublicPath";
import { formatDateCustomer } from "@/lib/dateFormat";
import { promotionClickHref } from "@/lib/promotionCta";
import { eventLandscape, eventPortrait, hasCityFilter } from "./homeUtils";
import {
  campaignsWithBanner,
  listingPromoQueryArgs,
  type ListingPromoCategory,
} from "@/lib/listingPromoLogic";
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

export type ListingPromoSlide = {
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
  accent?: string;
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

function shortAbout(about?: string | null, excludeName?: string) {
  const raw = normalizePhrase(about);
  if (!raw) return undefined;
  const name = normalizePhrase(excludeName).toLowerCase();
  if (name && raw.toLowerCase() === name) return undefined;
  if (name && raw.toLowerCase().startsWith(name) && raw.length - name.length < 8) return undefined;
  if (isInternalPlanLabel(raw)) return undefined;
  return raw.length > 56 ? `${raw.slice(0, 53).trim()}…` : raw;
}

function accentFromPromo(raw?: string | null) {
  const text = (raw || "").replace(/\s+/g, " ").trim();
  if (!text || isInternalPlanLabel(text)) return undefined;
  return text;
}

export function eventToListingSlide(event: PublicEvent, city: string): ListingPromoSlide {
  const when = formatSlideDate(event.next_showtime);
  const { title, year } = splitTitleYear(event.name, event.next_showtime);
  const cityLabel = event.city_name?.trim() || (hasCityFilter(city) ? city : "");
  const placeLabel = event.venue_name?.trim() || "";

  return {
    id: `event-${event.id}`,
    title,
    year,
    tagline:
      shortAbout(event.about_event, event.name) ||
      (event.category_name ? `${event.category_name} • Live near you` : undefined),
    image: eventLandscape(event) || eventPortrait(event),
    href: `/events/${event.id}`,
    badge: categoryBadge(event.category_slug || event.category_name, "EVENT"),
    dateLabel: when?.dateLabel,
    weekdayLabel: when?.weekdayLabel,
    cityLabel: cityLabel || placeLabel || undefined,
    placeLabel: cityLabel ? placeLabel || undefined : undefined,
    designed: false,
    cta: "Book Tickets",
  };
}

export function movieToListingSlide(movie: Movie): ListingPromoSlide {
  const when = formatSlideDate(movie.release_date || undefined);
  const { title, year } = splitTitleYear(movie.title, movie.release_date || undefined);
  const genre = movie.genres?.[0];

  return {
    id: `movie-${movie.id}`,
    title,
    year,
    tagline:
      shortAbout(movie.description, movie.title) ||
      (genre ? `${genre} • Now on screen` : undefined),
    image: resolveMediaUrl(movie.banner_url || movie.poster_url || ""),
    href: `/movies/${movie.slug || movie.id}`,
    badge: "MOVIE",
    dateLabel: when?.dateLabel,
    weekdayLabel: when?.weekdayLabel,
    designed: false,
    cta: "Book Now",
  };
}

export function diningToListingSlide(place: Business, city: string): ListingPromoSlide {
  const cityLabel = place.city_name?.trim() || (hasCityFilter(city) ? city : "");
  return {
    id: `dining-${place.id}`,
    title: place.name,
    tagline: shortAbout(place.description, place.name) || "Reserve your table",
    image:
      resolveMediaUrl(place.cover_image_url || "") ||
      (place.gallery_images?.[0] ? resolveMediaUrl(place.gallery_images[0]) : "") ||
      "",
    href: `/restaurant/${place.id}`,
    badge: "DINING",
    cityLabel: cityLabel || undefined,
    placeLabel: place.address?.split(",")[0]?.trim() || undefined,
    designed: false,
    cta: "Reserve Now",
  };
}

function campaignToListingSlide(
  promo: MarketingCampaign,
  ctx: {
    city: string;
    eventsById: Map<string, PublicEvent>;
    moviesById: Map<string, Movie>;
    diningById: Map<string, Business>;
  }
): ListingPromoSlide | null {
  const banner = resolveMediaUrl(promo.banner_image_url || "");
  if (!banner) return null;

  const targetType = String(promo.target_type || "").toUpperCase();
  const targetId = promo.target_id ? String(promo.target_id) : "";
  const linkedEvent =
    targetType === "EVENT" && targetId ? ctx.eventsById.get(targetId) : undefined;
  const linkedMovie =
    targetType === "MOVIE" && targetId ? ctx.moviesById.get(targetId) : undefined;
  const linkedDining =
    targetType === "RESTAURANT" || targetType === "BUSINESS"
      ? ctx.diningById.get(targetId) || ctx.diningById.get(String(promo.business_id || ""))
      : undefined;

  let base: ListingPromoSlide | null = null;
  if (linkedEvent) base = eventToListingSlide(linkedEvent, ctx.city);
  else if (linkedMovie) base = movieToListingSlide(linkedMovie);
  else if (linkedDining) base = diningToListingSlide(linkedDining, ctx.city);

  const rawPromoTitle = normalizePhrase(promo.title);
  const promoTitle =
    rawPromoTitle && !isInternalPlanLabel(rawPromoTitle)
      ? rawPromoTitle
      : base?.title || "Featured";
  const { title: splitTitle, year: splitYear } = splitTitleYear(
    promoTitle,
    linkedEvent?.next_showtime || linkedMovie?.release_date || undefined
  );
  const title =
    base && (!rawPromoTitle || isInternalPlanLabel(rawPromoTitle)) ? base.title : splitTitle;

  return {
    id: `promo-${promo.id}`,
    title,
    year: base?.year || splitYear,
    tagline:
      shortAbout(base?.tagline, title) ||
      shortAbout(
        linkedEvent?.about_event || linkedMovie?.description || linkedDining?.description || null,
        title
      ),
    image: banner || base?.image || "",
    href:
      promotionClickHref(promo) ||
      (linkedDining ? restaurantHref(linkedDining) : "") ||
      categoryFallbackHref(promo.category),
    badge: categoryBadge(promo.category || base?.badge, base?.badge || "EVENT"),
    dateLabel: base?.dateLabel,
    weekdayLabel: base?.weekdayLabel,
    cityLabel: base?.cityLabel,
    placeLabel: base?.placeLabel,
    accent: accentFromPromo(promo.slider_accent_text),
    designed: true,
    cta: ctaFor(promo.category, promo.target_type),
  };
}

function taglineVisible(slide: ListingPromoSlide) {
  if (!slide.tagline?.trim()) return false;
  const t = slide.tagline.trim().toLowerCase().replace(/\s+/g, " ");
  const title = slide.title.trim().toLowerCase();
  const withYear = `${title} ${slide.year || ""}`.trim().toLowerCase();
  if (t === title || t === withYear) return false;
  if (withYear.includes(t) && t.length <= withYear.length) return false;
  if (t.includes(title) && Math.abs(t.length - withYear.length) < 8) return false;
  return true;
}

function SlideCard({
  slide,
  plainImage = false,
}: {
  slide: ListingPromoSlide;
  /** Customer dining home: banner image only (no scrim / details / accent). */
  plainImage?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(slide.image) && !failed;

  if (plainImage) {
    return (
      <div className="absolute inset-0">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.image}
            alt=""
            aria-hidden
            className="promo-slide-photo h-full w-full object-cover"
            draggable={false}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="h-full w-full promo-slide-fallback" aria-hidden />
        )}
      </div>
    );
  }

  const hasMeta = Boolean(slide.dateLabel || slide.cityLabel);
  const showTagline = taglineVisible(slide);
  const showAccent = Boolean(slide.accent?.trim());
  const isDesignedPoster = Boolean(slide.designed && showImage);

  return (
    <>
      <div className="absolute inset-0">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
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

type ListingPromoSliderProps = {
  category: ListingPromoCategory;
  city: string;
  /** City-scoped is_promoted entities as landing-style slides when no paid campaigns. */
  fallbackSlides?: ListingPromoSlide[];
  eventsById?: Map<string, PublicEvent>;
  moviesById?: Map<string, Movie>;
  diningById?: Map<string, Business>;
  /** Optional post-fetch filter (e.g. concert/comedy/music/sports browse). */
  filterCampaign?: (campaign: MarketingCampaign) => boolean;
  className?: string;
};

/**
 * Category listing promo slider — same marketing + city rules and banner UI as landing
 * PromoBannerCarousel, scoped by category.
 */
export default function ListingPromoSlider({
  category,
  city,
  fallbackSlides = [],
  eventsById,
  moviesById,
  diningById,
  filterCampaign,
  className = "",
}: ListingPromoSliderProps) {
  const hasCity = hasCityFilter(city);
  const queryArgs = useMemo(() => listingPromoQueryArgs(category, city), [category, city]);
  const { data: promotions = [], isLoading } = useGetActiveMarketingPromotionsQuery(queryArgs);

  const slides = useMemo(() => {
    const linkCtx = {
      city,
      eventsById: eventsById || new Map(),
      moviesById: moviesById || new Map(),
      diningById: diningById || new Map(),
    };

    const dedupeByImage = (list: ListingPromoSlide[]) => {
      const seen = new Set<string>();
      return list.filter((s) => {
        const key = (s.image || "").trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const scoped = filterCampaign
      ? campaignsWithBanner(promotions).filter(filterCampaign)
      : campaignsWithBanner(promotions);

    const fromCampaigns = dedupeByImage(
      scoped
        .slice(0, 10)
        .map((p) => campaignToListingSlide(p, linkCtx))
        .filter((s): s is ListingPromoSlide => Boolean(s?.image?.trim() && s?.title?.trim()))
    );
    if (fromCampaigns.length > 0) return fromCampaigns;
    return dedupeByImage(
      fallbackSlides
        .filter((s) => Boolean(s.image?.trim()) && Boolean(s.title?.trim()))
        .slice(0, 8)
    );
  }, [promotions, fallbackSlides, city, eventsById, moviesById, diningById, filterCampaign]);

  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const swiperRef = useRef<SwiperType | null>(null);
  const [activeDot, setActiveDot] = useState(0);

  const { renderSlides, originalCount, startIndex, useWrapTrack } = useMemo(
    () => preparePromoLoopSlides(slides),
    [slides]
  );
  const multi = originalCount > 1;
  const { pauseAutoplay, resumeAutoplay } = usePromoWrapAutoplay(
    swiperRef,
    multi && !isLoading,
    originalCount,
    useWrapTrack
  );

  if (isLoading) {
    return <PromoBannerShimmer />;
  }

  if (slides.length === 0) return null;

  const { edgeBounds } = promoBannerMode(originalCount, useWrapTrack);

  return (
    <section
      className={`promo-banner-swiper w-full bg-white pt-5 sm:pt-6 lg:pt-7 pb-5 sm:pb-6 lg:pb-7 ${
        multi ? "is-multi" : "is-single"
      } ${className}`}
    >
      <div
        className={`relative w-full promo-banner-frame ${multi ? "" : "promo-banner-single-wrap"}`}
        onMouseEnter={pauseAutoplay}
        onMouseLeave={resumeAutoplay}
      >
        <Swiper
          key={`listing-promo-${category}-${hasCity ? city : "all"}-${slides.map((s) => s.id).join("-")}-wrap`}
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
                className="promo-banner-card group relative flex h-full w-full overflow-hidden rounded-2xl sm:rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-[#6900AA] focus-visible:ring-offset-2"
              >
                {/* Same as Dining listing: banner creative only (no title/CTA overlay). */}
                <SlideCard slide={slide} plainImage />
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

/** Hook: whether paid slider campaigns exist for this category + city (for parent hero gating). */
export function useListingPromoCampaigns(category: ListingPromoCategory, city: string) {
  const queryArgs = useMemo(() => listingPromoQueryArgs(category, city), [category, city]);
  const { data: promotions = [], isLoading } = useGetActiveMarketingPromotionsQuery(queryArgs);
  const campaigns = useMemo(() => campaignsWithBanner(promotions), [promotions]);
  return { campaigns, isLoading, hasCampaigns: campaigns.length > 0 };
}
