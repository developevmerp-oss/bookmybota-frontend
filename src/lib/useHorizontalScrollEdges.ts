import { useCallback, useEffect, useState, type RefObject } from "react";

/** Scroll distance per button click — must match page/dot math. */
export const RAIL_PAGE_FACTOR = 0.8;

export function getRailPageWidth(el: HTMLElement): number {
  return Math.max(1, Math.min(el.clientWidth * RAIL_PAGE_FACTOR, 640));
}

/** One button click — same width used for active-dot math. */
export function scrollRailBy(el: HTMLElement, dir: -1 | 1): void {
  el.scrollBy({ left: dir * getRailPageWidth(el), behavior: "smooth" });
}

export type HorizontalScrollEdges = {
  left: boolean;
  right: boolean;
  /** 0 at start → 1 at end */
  progress: number;
  /** Number of swipe pages (dots) from overflow amount. */
  pageCount: number;
  /** Active page index for dots (0-based). */
  activePage: number;
};

function emptyEdges(): HorizontalScrollEdges {
  return { left: false, right: false, progress: 0, pageCount: 0, activePage: 0 };
}

function computeEdges(el: HTMLElement): HorizontalScrollEdges {
  const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
  const canOverflow = maxScroll > 4;
  if (!canOverflow) return emptyEdges();

  const pageWidth = getRailPageWidth(el);
  // Dot count = how many button clicks from start to end (inclusive of start)
  const pageCount = Math.max(2, Math.floor(maxScroll / pageWidth) + 1);

  // Slightly tolerant so padding / scroll-snap never leaves a stale “can go left” at start
  const atStart = el.scrollLeft <= 12;
  const atEnd = el.scrollLeft >= maxScroll - 12;
  const progress = Math.min(1, Math.max(0, el.scrollLeft / maxScroll));

  let activePage: number;
  if (atStart) {
    activePage = 0;
  } else if (atEnd) {
    activePage = pageCount - 1;
  } else {
    activePage = Math.min(
      pageCount - 1,
      Math.max(0, Math.round(el.scrollLeft / pageWidth))
    );
  }

  return {
    left: !atStart,
    right: !atEnd,
    progress,
    pageCount,
    activePage,
  };
}

/** Show left/right carousel arrows only when the scroller can move in that direction. */
export function useHorizontalScrollEdges(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[] = []
): HorizontalScrollEdges {
  const [edges, setEdges] = useState<HorizontalScrollEdges>(emptyEdges);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setEdges(emptyEdges());
      return;
    }
    setEdges(computeEdges(el));
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setEdges(emptyEdges());
      return;
    }

    const frame = requestAnimationFrame(update);
    // Images / adaptive widths settle after first paint
    const t1 = window.setTimeout(update, 50);
    const t2 = window.setTimeout(update, 300);
    const t3 = window.setTimeout(update, 800);
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    for (const child of Array.from(el.children)) {
      ro?.observe(child);
    }
    window.addEventListener("resize", update);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      el.removeEventListener("scroll", update);
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, ...deps]);

  return edges;
}
