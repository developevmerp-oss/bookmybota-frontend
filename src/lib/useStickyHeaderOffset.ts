"use client";

import { useEffect, useState } from "react";

const DEFAULT_FALLBACK = 112;

/**
 * Live height of the sticky site header (search + category subnav).
 * Re-measures when the header compacts/expands on scroll so listing
 * filter bars can stick flush underneath without a gap.
 */
export function useStickyHeaderOffset(fallback = DEFAULT_FALLBACK): number {
  const [offset, setOffset] = useState(fallback);

  useEffect(() => {
    let raf = 0;

    const measure = () => {
      raf = 0;
      const header = document.querySelector("header.sticky") as HTMLElement | null;
      const height = header?.getBoundingClientRect().height ?? 0;
      const next = Math.max(64, Math.round(height || fallback));
      setOffset((prev) => (prev === next ? prev : next));
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("resize", schedule, { passive: true });
    // Header/subnav compact via max-height on scroll — keep sticky top in sync.
    window.addEventListener("scroll", schedule, { passive: true });

    const header = document.querySelector("header.sticky");
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
