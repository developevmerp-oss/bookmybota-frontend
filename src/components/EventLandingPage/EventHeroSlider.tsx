"use client";

import { useRef } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import "swiper/css";
import "swiper/css/pagination";
import "./EventHeroSlider.css";

type HeroSlide = {
  src: string;
  alt: string;
};

export default function EventHeroSlider({ slides }: { slides: HeroSlide[] }) {
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  return (
    <section className="event-hero-swiper relative w-full h-[180px] sm:h-[260px] md:h-[320px] lg:h-[400px] xl:h-[440px] overflow-hidden">
      <Swiper
        modules={[Autoplay, Navigation, Pagination]}
        loop
        speed={700}
        slidesPerView={1}
        spaceBetween={0}
        autoplay={{
          delay: 4000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        pagination={{ clickable: true }}
        navigation={{
          prevEl: prevRef.current,
          nextEl: nextRef.current,
        }}
        onBeforeInit={(swiper: SwiperType) => {
          const nav = swiper.params.navigation;
          if (nav && typeof nav !== "boolean") {
            nav.prevEl = prevRef.current;
            nav.nextEl = nextRef.current;
          }
        }}
        onSwiper={(swiper) => {
          setTimeout(() => {
            const nav = swiper.params.navigation;
            if (!nav || typeof nav === "boolean") return;
            nav.prevEl = prevRef.current;
            nav.nextEl = nextRef.current;
            const navigationApi = swiper.navigation;
            if (!navigationApi) return;
            navigationApi.destroy?.();
            navigationApi.init?.();
            navigationApi.update?.();
          });
        }}
        className="h-full w-full"
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide.src}>
            <img
              src={slide.src}
              alt={slide.alt}
              className="h-full w-full object-cover object-center"
            />
          </SwiperSlide>
        ))}
      </Swiper>
      <button
        ref={prevRef}
        type="button"
        aria-label="Previous slide"
        className="absolute left-2 sm:left-4 top-1/2 z-10 flex h-8 w-8 sm:h-10 sm:w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm cursor-pointer hover:bg-white"
      >
        <FaChevronLeft size={14} className="relative -left-[1px]" />
      </button>
      <button
        ref={nextRef}
        type="button"
        aria-label="Next slide"
        className="absolute right-2 sm:right-4 top-1/2 z-10 flex h-8 w-8 sm:h-10 sm:w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-sm cursor-pointer hover:bg-white"
      >
        <FaChevronRight size={14} className="relative left-[1px]" />
      </button>
    </section>
  );
}
