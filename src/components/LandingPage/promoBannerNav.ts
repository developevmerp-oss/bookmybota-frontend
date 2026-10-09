"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Swiper as SwiperType } from "swiper";

/**
 * After a move, if we drift into the first/last copy, jump by ±originalCount
 * with no animation so the track feels infinite (BMS) without Swiper loop.
 */
export function promoNormalizeWrap(
  swiper: SwiperType,
  originalCount: number
) {
  if (!swiper || swiper.destroyed || originalCount <= 1) return;
  const i = swiper.activeIndex;
  if (i < originalCount) {
    swiper.slideTo(i + originalCount, 0, false);
  } else if (i >= originalCount * 2) {
    swiper.slideTo(i - originalCount, 0, false);
  }
}

/** Forward next — continuous through duplicated track. */
export function promoSlideNext(
  swiper: SwiperType | null | undefined,
  originalCount: number,
  useWrapTrack: boolean
) {
  if (!swiper || swiper.destroyed || swiper.animating) return;
  if (!useWrapTrack || originalCount <= 1) {
    const n = Math.max(swiper.slides?.length ?? 0, 1);
    swiper.slideTo((swiper.activeIndex + 1) % n);
    return;
  }
  swiper.slideNext();
}

/** Backward prev — continuous through duplicated track. */
export function promoSlidePrev(
  swiper: SwiperType | null | undefined,
  originalCount: number,
  useWrapTrack: boolean
) {
  if (!swiper || swiper.destroyed || swiper.animating) return;
  if (!useWrapTrack || originalCount <= 1) {
    const n = Math.max(swiper.slides?.length ?? 0, 1);
    swiper.slideTo((swiper.activeIndex - 1 + n) % n);
    return;
  }
  swiper.slidePrev();
}

export function promoSlideToDot(
  swiper: SwiperType | null | undefined,
  index: number,
  originalCount: number,
  useWrapTrack: boolean
) {
  if (!swiper || swiper.destroyed || originalCount <= 0) return;
  const target = useWrapTrack ? originalCount + (index % originalCount) : index;
  swiper.slideTo(target);
}

/** Auto-advance with the same continuous next. */
export function usePromoWrapAutoplay(
  swiperRef: RefObject<SwiperType | null>,
  enabled: boolean,
  originalCount: number,
  useWrapTrack: boolean,
  delayMs = 5000
) {
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!enabled || originalCount <= 1) return;

    const tick = () => {
      if (pausedRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const s = swiperRef.current;
      if (!s || s.destroyed || s.animating) return;
      promoSlideNext(s, originalCount, useWrapTrack);
    };

    const id = window.setInterval(tick, delayMs);
    return () => window.clearInterval(id);
  }, [enabled, originalCount, useWrapTrack, delayMs, swiperRef]);

  return {
    pauseAutoplay: () => {
      pausedRef.current = true;
    },
    resumeAutoplay: () => {
      pausedRef.current = false;
    },
  };
}
