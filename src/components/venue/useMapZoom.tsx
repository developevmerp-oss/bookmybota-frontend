"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Minus, Plus } from "lucide-react";

/**
 * Zoom for a seat map that lives inside a scrolling box. Only the map zooms: the page header and footer stay put,
 * because pinch / ctrl+wheel on the box is handled here and kept away from the browser's own page zoom.
 * `zoom` is a multiplier (1 = fit to the box) that the map multiplies its own fit scale with.
 */
export function useMapZoom(boxRef: RefObject<HTMLElement | null>, { min = 1, max = 3 } = {}) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.touchAction = "pan-x pan-y"; // the browser keeps scrolling, but no longer zooms the whole page on pinch
    let startDist = 0;
    let startZoom = 1;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startZoom = zoomRef.current;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        setZoom(clamp(startZoom * (dist(e.touches) / startDist)));
      }
    };
    const onEnd = () => {
      startDist = 0;
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(clamp(zoomRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxRef, min, max]);

  const controls = (
    <div className="pointer-events-auto absolute bottom-3 right-3 z-10 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => clamp(z + 0.25))} className="flex size-9 cursor-pointer items-center justify-center text-slate-700 hover:bg-slate-100">
        <Plus className="size-4" />
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => clamp(z - 0.25))} className="flex size-9 cursor-pointer items-center justify-center border-t border-slate-200 text-slate-700 hover:bg-slate-100">
        <Minus className="size-4" />
      </button>
    </div>
  );
  return { zoom, setZoom, controls };
}
