"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Swiper as SwiperType } from "swiper";

/**
 * After a move, if we drift into the first/last copy, jump by ±originalCount
 * with no animation so the track feels infinite (BMS) without Swiper loop.
 * Keeps the same logical slide — never forces index 0 / “first”.
 */
export function promoNormalizeWrap(swiper: SwiperType, originalCount: number) {
  if (!swiper || swiper.destroyed || originalCount <= 1) return;

  let guard = 0;
  while (guard++ < 8) {
    const i = swiper.activeIndex;
    if (i < originalCount) {
      swiper.slideTo(i + originalCount, 0, false);
      continue;
    }
    if (i >= originalCount * 2) {
      swiper.slideTo(i - originalCount, 0, false);
      continue;
    }
    break;
  }
}

/** Mobile-safe: run wrap after Swiper finishes settling from touch or buttons. */
export function promoScheduleNormalize(
  swiper: SwiperType | null | undefined,
  originalCount: number
) {
  if (!swiper || swiper.destroyed || originalCount <= 1) return;
  requestAnimationFrame(() => {
    if (swiper.destroyed) return;
    promoNormalizeWrap(swiper, originalCount);
    requestAnimationFrame(() => {
      if (swiper.destroyed) return;
      promoNormalizeWrap(swiper, originalCount);
    });
  });
}

/**
 * Shared next — used by arrow buttons AND finger swipe.
 * Always continuous through the duplicated track (never % jump to 0).
 */
export function promoSlideNext(
  swiper: SwiperType | null | undefined,
  originalCount: number,
  useWrapTrack: boolean
) {
  if (!swiper || swiper.destroyed) return;
  if (swiper.animating) return;

  if (!useWrapTrack || originalCount <= 1) {
    const n = Math.max(swiper.slides?.length ?? 0, 1);
    if (n <= 1) return;
    const next = swiper.activeIndex + 1;
    swiper.slideTo(next >= n ? 0 : next);
    return;
  }

  // Stay in the middle band so both directions always have room.
  promoNormalizeWrap(swiper, originalCount);
  swiper.slideNext();
}

/**
 * Shared prev — used by arrow buttons AND finger swipe.
 */
export function promoSlidePrev(
  swiper: SwiperType | null | undefined,
  originalCount: number,
  useWrapTrack: boolean
) {
  if (!swiper || swiper.destroyed) return;
  if (swiper.animating) return;

  if (!useWrapTrack || originalCount <= 1) {
    const n = Math.max(swiper.slides?.length ?? 0, 1);
    if (n <= 1) return;
    const prev = swiper.activeIndex - 1;
    swiper.slideTo(prev < 0 ? n - 1 : prev);
    return;
  }

  promoNormalizeWrap(swiper, originalCount);
  swiper.slidePrev();
}

export function promoSlideToDot(
  swiper: SwiperType | null | undefined,
  index: number,
  originalCount: number,
  useWrapTrack: boolean
) {
  if (!swiper || swiper.destroyed || originalCount <= 0) return;
  const target = useWrapTrack
    ? originalCount + (((index % originalCount) + originalCount) % originalCount)
    : index;
  swiper.slideTo(target);
}

/**
 * Finger swipe uses the exact same promoSlideNext / promoSlidePrev as the arrows.
 * Native Swiper free-drag is off so we never hit a physical track end and “snap to first”.
 */
export function usePromoSwipeNav(
  frameRef: RefObject<HTMLElement | null>,
  swiperRef: RefObject<SwiperType | null>,
  enabled: boolean,
  originalCount: number,
  useWrapTrack: boolean,
  onSwipeStart?: () => void,
  onSwipeEnd?: () => void
) {
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);
  const locked = useRef<"h" | "v" | null>(null);
  const suppressClick = useRef(false);
  /** Queue one step if user swipes while animation is running. */
  const pendingDir = useRef<-1 | 1 | 0>(0);

  useEffect(() => {
    if (!enabled || originalCount <= 1) return;
    const el = frameRef.current;
    if (!el) return;

    const applyDir = (dir: -1 | 1) => {
      const s = swiperRef.current;
      if (!s || s.destroyed) return;
      if (s.animating) {
        pendingDir.current = dir;
        return;
      }
      pendingDir.current = 0;
      if (dir < 0) promoSlideNext(s, originalCount, useWrapTrack);
      else promoSlidePrev(s, originalCount, useWrapTrack);
    };

    const flushPending = () => {
      const dir = pendingDir.current;
      if (!dir) return;
      pendingDir.current = 0;
      applyDir(dir);
    };

    const onStart = (clientX: number, clientY: number) => {
      startX.current = clientX;
      startY.current = clientY;
      tracking.current = true;
      locked.current = null;
      suppressClick.current = false;
      onSwipeStart?.();
    };

    const onMove = (clientX: number, clientY: number, e: Event) => {
      if (!tracking.current) return;
      const dx = clientX - startX.current;
      const dy = clientY - startY.current;
      if (!locked.current) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        locked.current = Math.abs(dx) >= Math.abs(dy) ? "h" : "v";
      }
      if (locked.current === "h") e.preventDefault();
    };

    const onEnd = (clientX: number) => {
      if (!tracking.current) return;
      tracking.current = false;
      const dx = clientX - startX.current;
      const wasHorizontal = locked.current === "h";
      locked.current = null;
      onSwipeEnd?.();
      if (!wasHorizontal || Math.abs(dx) < 36) return;
      suppressClick.current = true;
      // Same API as the arrow buttons.
      applyDir(dx < 0 ? -1 : 1);
    };

    const onClickCapture = (e: MouseEvent) => {
      if (!suppressClick.current) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
    };

    const isControlTarget = (target: EventTarget | null) => {
      const node = target as HTMLElement | null;
      if (!node?.closest) return false;
      return Boolean(node.closest("button, [role='tab'], .promo-nav-btn, .promo-banner-dot"));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (isControlTarget(e.target)) return;
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      onMove(e.touches[0].clientX, e.touches[0].clientY, e);
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (t) onEnd(t.clientX);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (e.button !== 0) return;
      if (isControlTarget(e.target)) return;
      onStart(e.clientX, e.clientY);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (!tracking.current) return;
      onMove(e.clientX, e.clientY, e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      onEnd(e.clientX);
    };

    // After each slide animation, flush a queued swipe (continuous finger swipes).
    const onTransitionEnd = () => {
      const s = swiperRef.current;
      if (s && !s.destroyed && useWrapTrack) {
        promoNormalizeWrap(s, originalCount);
      }
      flushPending();
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("click", onClickCapture, true);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    // Swiper may mount after this effect — bind when available.
    let bound: SwiperType | null = null;
    const bindTimer = window.setInterval(() => {
      const s = swiperRef.current;
      if (!s || s.destroyed || s === bound) return;
      if (bound) bound.off("slideChangeTransitionEnd", onTransitionEnd);
      s.on("slideChangeTransitionEnd", onTransitionEnd);
      bound = s;
    }, 100);

    return () => {
      window.clearInterval(bindTimer);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      bound?.off("slideChangeTransitionEnd", onTransitionEnd);
      swiperRef.current?.off("slideChangeTransitionEnd", onTransitionEnd);
    };
  }, [
    enabled,
    originalCount,
    useWrapTrack,
    frameRef,
    swiperRef,
    onSwipeStart,
    onSwipeEnd,
  ]);
}

/** Auto-advance with the same continuous next as buttons / swipe. */
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
