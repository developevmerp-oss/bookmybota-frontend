"use client";

/** Dot index from active index (unique banners only). */
export function promoBannerDotIndex(index: number, originalCount: number): number {
  if (originalCount <= 0) return 0;
  return ((index % originalCount) + originalCount) % originalCount;
}

/**
 * Peek layout — no Swiper `loop` (avoids “not enough slides” with slidesPerView auto).
 * Continuous BMS cycle uses a duplicated track + silent mid-track reset.
 */
export function promoBannerMode(
  originalCount: number,
  useWrapTrack = false
): {
  multi: boolean;
  edgeBounds: boolean;
} {
  const multi = originalCount > 1;
  return {
    multi,
    // Wrap track starts mid-set so both peeks exist; don't pin edges then.
    edgeBounds: multi && !useWrapTrack && originalCount < 3,
  };
}

/** Three copies: prev set | middle (start) | next set */
const PROMO_COPIES = 3;

/**
 * Long track of repeated banners. Start on the middle copy so next/prev
 * always have room to move, then silently snap back into the middle band.
 */
export function preparePromoLoopSlides<T extends { id: string }>(
  slides: T[]
): {
  renderSlides: T[];
  originalCount: number;
  startIndex: number;
  useWrapTrack: boolean;
} {
  const originalCount = slides.length;
  if (originalCount <= 1) {
    return {
      renderSlides: slides,
      originalCount,
      startIndex: 0,
      useWrapTrack: false,
    };
  }

  const renderSlides: T[] = [];
  for (let copy = 0; copy < PROMO_COPIES; copy++) {
    for (const s of slides) {
      renderSlides.push(copy === 0 ? s : { ...s, id: `${s.id}__c${copy}` });
    }
  }

  return {
    renderSlides,
    originalCount,
    startIndex: originalCount,
    useWrapTrack: true,
  };
}
