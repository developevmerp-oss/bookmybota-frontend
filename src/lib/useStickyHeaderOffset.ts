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

    const measure = () => {
      raf = 0;
      const header =
        (document.querySelector("[data-site-sticky-subheader]") as HTMLElement | null) ||
        (document.querySelector("header.sticky") as HTMLElement | null);
      const height = header?.getBoundingClientRect().height ?? 0;
      const next = Math.max(48, Math.round(height || fallback));
      setOffset((prev) => (prev === next ? prev : next));
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });

    const header =
      document.querySelector("[data-site-sticky-subheader]") ||
      document.querySelector("header.sticky");
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
