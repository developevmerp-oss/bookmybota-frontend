"use client";

import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { parseYouTubeId, youtubeEmbedSrc, youtubeThumb } from "@/lib/youtube";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import "./EventMediaSlider.css";

type Props = {
  eventName: string;
  posterHorizontal?: string;
  gallery?: string[];
  youtubeUrl?: string | null;
};

export default function EventMediaSlider({
  eventName,
  posterHorizontal,
  gallery: _gallery = [],
  youtubeUrl,
}: Props) {
  const [active, setActive] = useState(0);
  const youtubeId = parseYouTubeId(youtubeUrl);
  const images = posterHorizontal ? [resolveMediaUrl(posterHorizontal)] : [];

  const slides: Array<{ type: "image"; src: string } | { type: "youtube"; id: string }> = [];
  if (images[0]) slides.push({ type: "image", src: images[0] });
  if (youtubeId) slides.push({ type: "youtube", id: youtubeId });
  images.slice(1).forEach((src) => slides.push({ type: "image", src }));

  if (slides.length === 0) {
    return (
      <div className="rounded-lg sm:rounded-xl bg-slate-100 aspect-[4/3] sm:aspect-[16/9] lg:aspect-[2/1] 2xl:aspect-[21/9]" />
    );
  }

  const showNav = slides.length > 1;

  return (
    <div className="event-media-swiper relative rounded-lg sm:rounded-xl overflow-hidden bg-black aspect-[4/3] sm:aspect-[16/9] lg:aspect-[2/1] 2xl:aspect-[21/9]">
      <Swiper
        modules={[Navigation, Pagination]}
        navigation={showNav}
        pagination={showNav ? { clickable: true } : false}
        onSlideChange={(swiper) => setActive(swiper.activeIndex)}
        className="!absolute inset-0 h-full w-full"
      >
        {slides.map((slide, index) => (
          <SwiperSlide key={`${slide.type}-${index}`}>
            {slide.type === "image" ? (
              <img src={slide.src} alt={eventName} className="h-full w-full object-cover" />
            ) : (
              <div className="relative h-full w-full bg-black">
                {active === index ? (
                  <iframe
                    title={`${eventName} video`}
                    src={youtubeEmbedSrc(slide.id, true)}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <img
                    src={youtubeThumb(slide.id)}
                    alt={`${eventName} video`}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            )}
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}
