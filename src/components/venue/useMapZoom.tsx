"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Pinch, ctrl+wheel, double-tap/click zoom and click-and-drag panning for a seat map
 * that lives inside a scrolling box. Only the map zooms/pans: page header and footer stay put.
 * `zoom` is a multiplier (1 = default fit to the box) supporting both zoom in and zoom out.
 */
export function useMapZoom(boxRef: RefObject<HTMLElement | null>, { min = 0.35, max = 3 } = {}) {
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 1000) / 1000));

  const resetZoom = () => {
    setZoom(1);
    const el = boxRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
        el.scrollTop = 0;
      });
    }
  };

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.touchAction = "pan-x pan-y";
    el.style.cursor = "grab";

    let startDist = 0;
    let startZoom = 1;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let startMidX = 0;
    let startMidY = 0;

    // Click-and-drag (slide) panning state for mouse / trackpad
    let isDragging = false;
    let dragMoved = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragScrollLeft = 0;
    let dragScrollTop = 0;

    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
    });

    const applyZoomAroundPoint = (
      nextZoom: number,
      clientX: number,
      clientY: number,
      baseZoom: number,
      baseScrollLeft: number,
      baseScrollTop: number
    ) => {
      const rect = el.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      const offsetY = clientY - rect.top;
      const ratio = nextZoom / baseZoom;
      setZoom(nextZoom);
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, (baseScrollLeft + offsetX) * ratio - offsetX);
        el.scrollTop = Math.max(0, (baseScrollTop + offsetY) * ratio - offsetY);
      });
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startZoom = zoomRef.current;
        startScrollLeft = el.scrollLeft;
        startScrollTop = el.scrollTop;
        const m = mid(e.touches);
        startMidX = m.x;
        startMidY = m.y;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && startDist > 0) {
        e.preventDefault();
        const nextZoom = clamp(startZoom * (dist(e.touches) / startDist));
        applyZoomAroundPoint(nextZoom, startMidX, startMidY, startZoom, startScrollLeft, startScrollTop);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        startDist = 0;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragScrollLeft = el.scrollLeft;
      dragScrollTop = el.scrollTop;
      el.style.cursor = "grabbing";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragMoved = true;
      }
      if (dragMoved) {
        el.scrollLeft = dragScrollLeft - dx;
        el.scrollTop = dragScrollTop - dy;
      }
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      el.style.cursor = "grab";
    };

    const onClickCapture = (e: MouseEvent) => {
      if (dragMoved) {
        e.preventDefault();
        e.stopPropagation();
        dragMoved = false;
      }
    };

    const onDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("button")) return;
      const prev = zoomRef.current;
      const nextZoom = prev > 1.15 ? 1 : clamp(prev * 1.6);
      applyZoomAroundPoint(nextZoom, e.clientX, e.clientY, prev, el.scrollLeft, el.scrollTop);
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const prev = zoomRef.current;
      const nextZoom = clamp(prev * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
      if (nextZoom !== prev) {
        applyZoomAroundPoint(nextZoom, e.clientX, e.clientY, prev, el.scrollLeft, el.scrollTop);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("dblclick", onDblClick);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("dblclick", onDblClick);
      el.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxRef, min, max]);

  return { zoom, setZoom, resetZoom, controls: null };
}
