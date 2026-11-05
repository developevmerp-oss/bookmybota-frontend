"use client";

import { useEffect, useState } from "react";

/**
 * Mobile sticky CTAs sit at the viewport bottom, then stay glued just above the
 * site footer as it enters. They only hide once the footer has scrolled far up
 * the screen (dining Book a table parity).
 *
 * `enabled` should flip true after page content (and its `<footer>`) has mounted —
 * event pages render Footer inside the page after loading, not in the root layout.
 */
export function useStickyCtaAboveFooter(enabled = true): {
  stickyCtaBottom: number;
  stickyCtaHidden: boolean;
} {
  const [stickyCtaBottom, setStickyCtaBottom] = useState(0);
  const [stickyCtaHidden, setStickyCtaHidden] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setStickyCtaBottom(0);
      setStickyCtaHidden(false);
      return;
    }

    let footer: Element | null = null;
    let observer: IntersectionObserver | null = null;
    let pollId = 0;
    let cancelled = false;

    const update = () => {
      if (!footer) return;
      const rect = footer.getBoundingClientRect();
      const vh = window.innerHeight;
      const overlap = Math.max(0, Math.ceil(vh - rect.top));
      const hide = rect.top < vh * 0.4 && rect.bottom > 0;
      setStickyCtaBottom((prev) => (prev === overlap ? prev : overlap));
      setStickyCtaHidden((prev) => (prev === hide ? prev : hide));
    };

    const detach = () => {
      observer?.disconnect();
      observer = null;
      document.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };

    const attach = (el: Element) => {
      footer = el;
      detach();
      update();
      observer = new IntersectionObserver(update, {
        threshold: [0, 0.01, 0.1, 0.25, 0.5, 0.75, 1],
      });
      observer.observe(el);
      document.addEventListener("scroll", update, { passive: true, capture: true });
      window.addEventListener("resize", update);
    };

    const tryFind = () => {
      if (cancelled) return;
      const el = document.querySelector("footer");
      if (el) {
        attach(el);
        return;
      }
      pollId = window.setTimeout(tryFind, 80);
    };

    tryFind();

    return () => {
      cancelled = true;
      if (pollId) window.clearTimeout(pollId);
      detach();
    };
  }, [enabled]);

  return { stickyCtaBottom, stickyCtaHidden };
}
