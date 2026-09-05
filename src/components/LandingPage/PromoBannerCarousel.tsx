"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/pagination";
import { useGetActiveMarketingPromotionsQuery } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { promotionClickHref } from "@/lib/promotionCta";
import { useHomeCatalog } from "./useHomeCatalog";
import { eventLandscape } from "./homeUtils";
import "./PromoBannerCarousel.css";

type PromoBannerCarouselProps = {
  city: string;
};

type Slide = {
  id: string;
  title: string;
  image: string;
  href: string;
  badge?: string;
};

export default function PromoBannerCarousel({ city }: PromoBannerCarouselProps) {
  const { bannerEvents, isLoadingEvents, isLoadingFallback } = useHomeCatalog(city);
  const { data: promotions = [], isLoading: loadingPromos } = useGetActiveMarketingPromotionsQuery({
    surface: "slider",
  });
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const slides = useMemo<Slide[]>(() => {
    if (promotions.length > 0) {
      return promotions.slice(0, 10).map((p) => ({
        id: String(p.id),
        title: p.title || p.plan_name || "Promotion",
        image: resolveMediaUrl(p.banner_image_url || ""),
        href: promotionClickHref(p) || categoryFallbackHref(p.category),
        badge: p.category && p.category !== "ALL" ? p.category : undefined,
      }));
    }

    return bannerEvents.slice(0, 5).map((event) => ({
      id: event.id,
      title: event.name,
      image: eventLandscape(event),
      href: `/events/${event.id}`,
      badge: "EVENTS",
    }));
  }, [promotions, bannerEvents]);

  const loading =
    loadingPromos || (promotions.length === 0 && (isLoadingEvents || (slides.length === 0 && isLoadingFallback)));

  if (loading) {
    return (
      <section className="bg-white w-full">
        <div className="relative h-[200px] sm:h-[270px] md:h-[320px] lg:h-[380px] xl:h-[420px] w-full">
          <div className="h-full w-full bg-[#F7F7F7]" />
        </div>
      </section>
    );
  }

  if (slides.length === 0) return null;

  const multi = slides.length > 1;

  return (
    <section className="promo-banner-swiper bg-white w-full overflow-hidden">
      <div className="relative h-[200px] sm:h-[270px] md:h-[320px] lg:h-[380px] xl:h-[420px] w-full">
        <Swiper
          key={`promo-auto-${slides.map((s) => s.id).join("-")}`}
          modules={[Autoplay, Navigation, Pagination]}
          className="h-full w-full"
          loop={multi}
          speed={700}
          grabCursor
          allowTouchMove
          slidesPerView={1}
          spaceBetween={0}
          autoplay={
            multi
              ? {
                  delay: 4000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                  stopOnLastSlide: false,
                  waitForTransition: true,
                }
              : false
          }
          pagination={multi ? { clickable: true } : false}
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
        >
          {slides.map((slide) => (
            <SwiperSlide key={slide.id} className="h-full">
              <div className="h-full w-full relative">
                <Link href={slide.href} className="block h-full w-full overflow-hidden bg-[#111111]">
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </Link>
                {slide.badge ? (
                  <span className="pointer-events-none absolute top-3 left-3 z-[1] text-[10px] sm:text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-md bg-white/95 text-[#6900AA] shadow-sm">
                    {slide.badge}
                  </span>
                ) : null}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {multi && (
          <>
            <button
              ref={prevRef}
              type="button"
              aria-label="Previous banner"
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/90 text-[#333] shadow flex items-center justify-center cursor-pointer hover:bg-white"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              ref={nextRef}
              type="button"
              aria-label="Next banner"
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/90 text-[#333] shadow flex items-center justify-center cursor-pointer hover:bg-white"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
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
