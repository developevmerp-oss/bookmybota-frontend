"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import "swiper/css/pagination";
import { useHomeCatalog } from "./useHomeCatalog";
import { eventLandscape } from "./homeUtils";
import "./PromoBannerCarousel.css";

type PromoBannerCarouselProps = {
  city: string;
};

export default function PromoBannerCarousel({ city }: PromoBannerCarouselProps) {
  const { bannerEvents, isLoadingEvents, isLoadingFallback } = useHomeCatalog(city);
  const slides = bannerEvents.slice(0, 5);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  if (isLoadingEvents || (slides.length === 0 && isLoadingFallback)) {
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
              <div className="h-full w-full">
                <Link
                  href={`/events/${slide.id}`}
                  className="block h-full w-full overflow-hidden bg-[#111111]"
                >
                  <img
                    src={eventLandscape(slide)}
                    alt={slide.name}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </Link>
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
