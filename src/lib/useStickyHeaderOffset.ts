"use client";

import { useEffect, useState } from "react";

const DEFAULT_FALLBACK = 64;

/**
 * Live height of the sticky site subheader (category bar, optionally with logo + profile).
 * Re-measures on scroll/resize so listing filter bars can stick flush underneath.
 */
export function useStickyHeaderOffset(fallback = DEFAULT_FALLBACK): number {
  const [offset, setOffset] = useState(fallback);

  useEffect(() => {
    let raf = 0;

    const resolveHeader = () => {
      const isMobileTablet =
        typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
      if (isMobileTablet) {
        return (
          (document.querySelector("[data-site-mobile-sticky-header]") as HTMLElement | null) ||
          (document.querySelector("[data-site-sticky-subheader]") as HTMLElement | null)
        );
      }
      return (
        (document.querySelector("[data-site-sticky-subheader]") as HTMLElement | null) ||
        (document.querySelector("header.sticky") as HTMLElement | null)
      );
    };

    const measure = () => {
      raf = 0;
      const isMobileTablet =
        typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
      const header = resolveHeader();
      // Hidden chrome (display:none) → 0 so BMS category page headers can stick flush.
      if (header instanceof HTMLElement) {
        const style = window.getComputedStyle(header);
        if (style.display === "none" || style.visibility === "hidden") {
          setOffset((prev) => (prev === 0 ? prev : 0));
          return;
        }
        const height = Math.round(header.getBoundingClientRect().height);
        const next = height > 0 ? height : isMobileTablet ? 0 : Math.max(48, fallback);
        setOffset((prev) => (prev === next ? prev : next));
        return;
      }
      const next = isMobileTablet ? 0 : Math.max(48, fallback);
      setOffset((prev) => (prev === next ? prev : next));
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });

    const header = resolveHeader();
    const ro =
      header && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(schedule)
        : null;
    if (header && ro) ro.observe(header);

    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
      ro?.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [fallback]);

  return offset;
}
