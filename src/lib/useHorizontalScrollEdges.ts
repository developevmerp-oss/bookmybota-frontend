import { useCallback, useEffect, useState, type RefObject } from "react";

export type HorizontalScrollEdges = {
  left: boolean;
  right: boolean;
};

/** Show left/right carousel arrows only when the scroller can move in that direction. */
export function useHorizontalScrollEdges(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[] = []
): HorizontalScrollEdges {
  const [edges, setEdges] = useState<HorizontalScrollEdges>({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setEdges({ left: false, right: false });
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    const canOverflow = maxScroll > 2;
    setEdges({
      left: canOverflow && el.scrollLeft > 2,
      right: canOverflow && el.scrollLeft < maxScroll - 2,
    });
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setEdges({ left: false, right: false });
      return;
    }

    const frame = requestAnimationFrame(update);
    const timer = window.setTimeout(update, 150);
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      el.removeEventListener("scroll", update);
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, ...deps]);

  return edges;
}
