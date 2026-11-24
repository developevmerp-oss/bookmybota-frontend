"use client";

import { useEffect, useState } from "react";

/**
 * Mobile sticky CTAs sit at the viewport bottom, then stay glued just above the
 * site footer as it enters. They only hide once the footer has scrolled far up
 * the screen (dining Book a table parity).
 *
 * Detail pages hide the footer on mobile (`hidden md:block`) — a display:none
 * footer must be ignored, otherwise getBoundingClientRect() is 0 and the CTA
 * is pushed off-screen with bottom ≈ 100vh.
 *
 * `enabled` should flip true after page content (and its `<footer>`) has mounted —
 * event pages render Footer inside the page after loading, not in the root layout.
 */
function isFooterVisuallyPresent(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.height > 0 || rect.width > 0;
}

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

    const mobileNavHeight = () => {
      if (typeof window === "undefined") return 0;
      if (!window.matchMedia("(max-width: 1023px)").matches) return 0;
      const nav = document.querySelector("[data-mobile-bottom-nav]");
      if (!(nav instanceof HTMLElement)) return 0;
      const style = getComputedStyle(nav);
      if (style.display === "none" || style.visibility === "hidden") return 0;
      return Math.ceil(nav.getBoundingClientRect().height);
    };

    const clearCtaOffset = () => {
      const navH = mobileNavHeight();
      setStickyCtaBottom((prev) => (prev === navH ? prev : navH));
      setStickyCtaHidden((prev) => (prev === false ? prev : false));
    };

    const update = () => {
      const navH = mobileNavHeight();
      if (!footer) {
        setStickyCtaBottom((prev) => (prev === navH ? prev : navH));
        setStickyCtaHidden((prev) => (prev === false ? prev : false));
        return;
      }
      // Mobile-hidden footer (detail pages) — keep CTA above bottom tab bar
      if (!isFooterVisuallyPresent(footer)) {
        clearCtaOffset();
        return;
      }
      const rect = footer.getBoundingClientRect();
      const vh = window.innerHeight;
      const overlap = Math.max(0, Math.ceil(vh - rect.top));
      const nextBottom = Math.max(overlap, navH);
      const hide = rect.top < vh * 0.4 && rect.bottom > 0;
      setStickyCtaBottom((prev) => (prev === nextBottom ? prev : nextBottom));
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
      // No footer in DOM — CTA stays at bottom
      clearCtaOffset();
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
