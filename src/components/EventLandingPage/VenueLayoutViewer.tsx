"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Stage, Layer, Circle, Ellipse, Line, Text, Rect, Group, Image as KonvaImage } from "react-konva";
import useImage from "use-image";

type Seat = {
  id: string;
  internalId?: string;
  ticket_type_id: string;
  section_name: string;
  row_label: string;
  seat_label: string;
  coordinate_x: number;
  coordinate_y: number;
  status: string;
  /** BMS popular seat — orange outline when available (cinema mode) */
  is_bestseller?: boolean;
};

type Label = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  rotation?: number;
};

type ShapeType =
  | "rect"
  | "roundRect"
  | "circle"
  | "ellipse"
  | "diamond"
  | "triangle"
  | "stage"
  | "screen"
  | "zone";

type Shape = {
  id: string;
  type?: ShapeType | "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  text?: string;
  ticket_type_id?: string;
  rotation?: number;
  opacity?: number;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
};

export default function VenueLayoutViewer({
  layoutData,
  ticketTypes,
  onSeatsSelected,
  maxSelectable = Number.MAX_SAFE_INTEGER,
  initialSelectedSeats = [],
  cinemaMode = false,
  hideSidePanel = false,
  customLegend,
  mapTitle,
  mapDescription,
}: {
  layoutData: any;
  ticketTypes: any[];
  onSeatsSelected: (seats: Seat[]) => void;
  maxSelectable?: number;
  initialSelectedSeats?: any[];
  cinemaMode?: boolean;
  hideSidePanel?: boolean;
  customLegend?: Array<{ name: string; color: string; price?: number }>;
  mapTitle?: string;
  mapDescription?: string;
}) {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>(
    initialSelectedSeats.map((s: any) => s.id || s.seat_identifier || s.internalId)
  );
  const [activeBoxInfo, setActiveBoxInfo] = useState<Shape | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const scaleRef = useRef(scale);
  const userZoomedRef = useRef(false);
  const pendingScrollRef = useRef<{ scrollLeft: number; scrollTop: number } | null>(null);
  const pinchRef = useRef<{
    startDist: number;
    startScale: number;
  } | null>(null);
  const panRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    pointerId: number;
  } | null>(null);
  /** Active pointers for multi-touch pinch (Konva eats raw touch on canvas). */
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const mapReady = seats.length > 0;

  const config =
    layoutData?.data?.seating_config ||
    layoutData?.seating_config ||
    layoutData?.layout_template?.seating_config ||
    {};
  const canvasWidth = config?.canvasWidth || 3200;
  const canvasHeight = config?.canvasHeight || 2400;

  const backgroundImageUrl = config?.bgImageUrl || null;
  const [bgImage] = useImage(backgroundImageUrl || "");

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    if (pendingScrollRef.current && containerRef.current) {
      const { scrollLeft, scrollTop } = pendingScrollRef.current;
      containerRef.current.scrollLeft = Math.max(0, scrollLeft);
      containerRef.current.scrollTop = Math.max(0, scrollTop);
      pendingScrollRef.current = null;
    }
  }, [scale]);

  /** Zoom toward a screen point (photo-style) and keep that point under the finger/cursor. */
  const zoomToPoint = (nextScale: number, clientX: number, clientY: number) => {
    const container = containerRef.current;
    const stageEl = canvasWrapperRef.current;
    if (!container || !stageEl) return;

    const currentScale = scaleRef.current;
    const newScale = Math.min(Math.max(Number(nextScale.toFixed(3)), 0.15), 3.0);
    if (Math.abs(newScale - currentScale) < 0.001) return;

    const cRect = container.getBoundingClientRect();
    const sRect = stageEl.getBoundingClientRect();
    const fx = clientX - cRect.left;
    const fy = clientY - cRect.top;
    const contentX = (clientX - sRect.left) / currentScale;
    const contentY = (clientY - sRect.top) / currentScale;
    const stageOriginX = container.scrollLeft + (sRect.left - cRect.left);
    const stageOriginY = container.scrollTop + (sRect.top - cRect.top);

    pendingScrollRef.current = {
      scrollLeft: stageOriginX + contentX * newScale - fx,
      scrollTop: stageOriginY + contentY * newScale - fy,
    };
    userZoomedRef.current = true;
    scaleRef.current = newScale;
    setScale(newScale);
  };

  // Attach AFTER the map DOM exists. Early `seats.length === 0 → return null` meant
  // the old mount-only effect never bound listeners, so pinch/pan never worked.
  useEffect(() => {
    if (!mapReady) return;

    let cancelled = false;
    let detach: (() => void) | undefined;

    const bind = () => {
      if (cancelled) return;
      const container = containerRef.current;
      if (!container) {
        requestAnimationFrame(bind);
        return;
      }

      const pointerDist = (
        a: { x: number; y: number },
        b: { x: number; y: number }
      ) => Math.hypot(b.x - a.x, b.y - a.y);

      const beginPinchFromPointers = () => {
        const pts = [...pointersRef.current.values()];
        if (pts.length < 2) return;
        panRef.current = null;
        pinchRef.current = {
          startDist: Math.max(1, pointerDist(pts[0], pts[1])),
          startScale: scaleRef.current,
        };
      };

      const applyPinchFromPointers = () => {
        const pinch = pinchRef.current;
        const pts = [...pointersRef.current.values()];
        if (!pinch || pts.length < 2) return;
        const dist = Math.max(1, pointerDist(pts[0], pts[1]));
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        zoomToPoint(pinch.startScale * (dist / pinch.startDist), midX, midY);
      };

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        zoomToPoint(scaleRef.current * factor, e.clientX, e.clientY);
      };

      const capturePointer = (pointerId: number) => {
        try {
          container.setPointerCapture?.(pointerId);
        } catch {
          /* ignore */
        }
      };

      // Pointer-based pinch — works on Konva canvas (Konva uses Pointer Events)
      const onPointerDown = (e: PointerEvent) => {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        if (pointersRef.current.size >= 2) {
          // Capture both fingers so pinch isn't lost to Konva / browser
          for (const id of pointersRef.current.keys()) capturePointer(id);
          beginPinchFromPointers();
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        if (e.pointerType === "touch" || e.button === 0) {
          panRef.current = {
            active: true,
            moved: false,
            startX: e.clientX,
            startY: e.clientY,
            originLeft: container.scrollLeft,
            originTop: container.scrollTop,
            pointerId: e.pointerId,
          };
        }
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!pointersRef.current.has(e.pointerId) && pointersRef.current.size === 0) {
          return;
        }
        if (pointersRef.current.has(e.pointerId) || pointersRef.current.size > 0) {
          pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        if (pointersRef.current.size >= 2) {
          e.preventDefault();
          e.stopPropagation();
          if (!pinchRef.current) beginPinchFromPointers();
          applyPinchFromPointers();
          return;
        }

        const pan = panRef.current;
        if (!pan?.active || pan.pointerId !== e.pointerId) return;
        const dx = e.clientX - pan.startX;
        const dy = e.clientY - pan.startY;
        if (!pan.moved) {
          if (Math.hypot(dx, dy) < 8) return;
          pan.moved = true;
          capturePointer(e.pointerId);
          container.style.cursor = "grabbing";
        }
        e.preventDefault();
        container.scrollLeft = pan.originLeft - dx;
        container.scrollTop = pan.originTop - dy;
      };

      const onPointerUp = (e: PointerEvent) => {
        pointersRef.current.delete(e.pointerId);
        try {
          if (container.hasPointerCapture?.(e.pointerId)) {
            container.releasePointerCapture?.(e.pointerId);
          }
        } catch {
          /* ignore */
        }

        if (pointersRef.current.size < 2) {
          pinchRef.current = null;
        }
        if (pointersRef.current.size === 0) {
          container.style.cursor = "";
          panRef.current = null;
        } else if (panRef.current?.pointerId === e.pointerId) {
          panRef.current = null;
        }
      };

      // Also listen on document during gestures so we don't lose the 2nd finger
      // when Konva / browser retargets events.
      const onDocPointerMove = (e: PointerEvent) => {
        if (!pointersRef.current.has(e.pointerId) && pointersRef.current.size === 0) {
          return;
        }
        onPointerMove(e);
      };
      const onDocPointerUp = (e: PointerEvent) => onPointerUp(e);

      container.addEventListener("wheel", handleWheel, { passive: false });
      container.addEventListener("pointerdown", onPointerDown, { capture: true });
      container.addEventListener("pointermove", onPointerMove, { capture: true });
      container.addEventListener("pointerup", onPointerUp, { capture: true });
      container.addEventListener("pointercancel", onPointerUp, { capture: true });
      document.addEventListener("pointermove", onDocPointerMove, { capture: true });
      document.addEventListener("pointerup", onDocPointerUp, { capture: true });
      document.addEventListener("pointercancel", onDocPointerUp, { capture: true });

      detach = () => {
        container.removeEventListener("wheel", handleWheel);
        container.removeEventListener("pointerdown", onPointerDown, true);
        container.removeEventListener("pointermove", onPointerMove, true);
        container.removeEventListener("pointerup", onPointerUp, true);
        container.removeEventListener("pointercancel", onPointerUp, true);
        document.removeEventListener("pointermove", onDocPointerMove, true);
        document.removeEventListener("pointerup", onDocPointerUp, true);
        document.removeEventListener("pointercancel", onDocPointerUp, true);
        pointersRef.current.clear();
        pinchRef.current = null;
        panRef.current = null;
      };
    };

    const raf = requestAnimationFrame(bind);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      detach?.();
    };
  }, [mapReady]);

  useEffect(() => {
    const rawSeats =
      layoutData?.data?.seats ||
      layoutData?.seats ||
      layoutData?.layout_template?.seats_json ||
      [];
    const rawConfig =
      layoutData?.data?.seating_config ||
      layoutData?.seating_config ||
      layoutData?.layout_template?.seating_config ||
      {};

    if (Array.isArray(rawSeats) && rawSeats.length > 0) {
      const mapped = rawSeats.map((s: any) => ({
        ...s,
        id: s.id || s.internalId || `${s.row_label || ""}${s.seat_label || ""}`,
        coordinate_x: Number(s.coordinate_x),
        coordinate_y: Number(s.coordinate_y),
        is_bestseller: Boolean(s.is_bestseller ?? s.isBestseller ?? s.bestseller),
      }));
      // Prefer booked/held when collapsing duplicate physical seats
      const rank = (status: unknown) => {
        const st = String(status || "").toUpperCase();
        if (st === "BOOKED" || st === "SOLD") return 3;
        if (st === "HELD" || st === "LOCKED" || st === "RESERVED") return 2;
        if (st === "AVAILABLE") return 1;
        return 0;
      };
      const byPhysical = new Map<string, (typeof mapped)[number]>();
      for (const seat of mapped) {
        const key = [
          String(seat.section_name || "").trim().toUpperCase(),
          String(seat.row_label || "").trim().toUpperCase(),
          String(seat.seat_label || "").trim().toUpperCase(),
        ].join("|");
        const physical = key === "||" ? String(seat.id) : key;
        const prev = byPhysical.get(physical);
        if (!prev || rank(seat.status) > rank(prev.status)) {
          byPhysical.set(physical, seat);
        }
      }
      setSeats(Array.from(byPhysical.values()));
    }
    if (rawConfig?.labels && Array.isArray(rawConfig.labels)) {
      setLabels(rawConfig.labels);
    }
    if (rawConfig?.shapes && Array.isArray(rawConfig.shapes)) {
      setShapes(rawConfig.shapes);
    }
  }, [layoutData]);

  useEffect(() => {
    if (initialSelectedSeats) {
      const incomingIds = Array.from(
        new Set(
          initialSelectedSeats
            .map((s: any) => String(s.id || s.seat_identifier || s.internalId || ""))
            .filter(Boolean)
        )
      );
      setSelectedSeatIds(incomingIds);
    }
  }, [initialSelectedSeats]);

  const boundingBox = useMemo(() => {
    // Seat circles are r=12; include them so edge seats aren't clipped when fitting.
    const SEAT_R = 14;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const s of seats) {
      if (s.coordinate_x - SEAT_R < minX) minX = s.coordinate_x - SEAT_R;
      if (s.coordinate_x + SEAT_R > maxX) maxX = s.coordinate_x + SEAT_R;
      if (s.coordinate_y - SEAT_R < minY) minY = s.coordinate_y - SEAT_R;
      if (s.coordinate_y + SEAT_R > maxY) maxY = s.coordinate_y + SEAT_R;
    }
    for (const sh of shapes) {
      const rot = ((Number(sh.rotation) || 0) * Math.PI) / 180;
      const cx = sh.x + sh.width / 2;
      const cy = sh.y + sh.height / 2;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      for (const [lx, ly] of [
        [-sh.width / 2, -sh.height / 2],
        [sh.width / 2, -sh.height / 2],
        [sh.width / 2, sh.height / 2],
        [-sh.width / 2, sh.height / 2],
      ] as const) {
        const px = cx + lx * cos - ly * sin;
        const py = cy + lx * sin + ly * cos;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
    for (const lb of labels) {
      const font = Number(lb.fontSize) || 16;
      const lines = String(lb.text || "").split("\n");
      const textW = Math.max(1, ...lines.map((l) => l.length)) * font * 0.62;
      const textH = Math.max(1, lines.length) * font * 1.2;
      const rot = ((Number(lb.rotation) || 0) * Math.PI) / 180;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      // Labels are drawn from (x,y) as top-left of first line
      for (const [lx, ly] of [
        [0, 0],
        [textW, 0],
        [textW, textH],
        [0, textH],
      ] as const) {
        const px = lb.x + lx * cos - ly * sin;
        const py = lb.y + lx * sin + ly * cos;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
    }
    if (!isFinite(minX) || !isFinite(maxX) || maxX <= minX) {
      return { minX: 0, maxX: canvasWidth, minY: 0, maxY: canvasHeight, contentW: canvasWidth, contentH: canvasHeight };
    }
    const padX = 80;
    const padY = 80;
    return {
      minX: minX - padX,
      minY: minY - padY,
      maxX: maxX + padX,
      maxY: maxY + padY,
      contentW: maxX - minX + padX * 2,
      contentH: maxY - minY + padY * 2,
    };
  }, [seats, shapes, labels, canvasWidth, canvasHeight]);

  /**
   * Fit the entire venue (seats + stage + labels) inside the map pane.
   * Leaves comfortable margin so edge seats aren't clipped by header/footer chrome.
   */
  const getPreferredScale = () => {
    const el = containerRef.current;
    if (!el) return null;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    if (vw < 40 || vh < 40) return null;

    // Inner wrapper uses p-3 / sm:p-5 — subtract so fit doesn't overflow into scroll clip.
    const innerPad = vw >= 640 ? 20 : 12;
    const availW = Math.max(40, vw - innerPad * 2);
    const availH = Math.max(40, vh - innerPad * 2);

    const contentW = Math.max(boundingBox.contentW, 1);
    const contentH = Math.max(boundingBox.contentH, 1);
    // ~10% breathing room (matches the “full layout visible” framing)
    const marginX = Math.max(20, Math.round(availW * 0.1));
    const marginY = Math.max(20, Math.round(availH * 0.1));
    const widthScale = (availW - marginX * 2) / contentW;
    const heightScale = (availH - marginY * 2) / contentH;
    const preferred = Math.min(widthScale, heightScale);
    return Math.round(Math.min(Math.max(preferred, 0.05), 3) * 1000) / 1000;
  };

  const centerMapScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
    el.scrollTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2);
  };

  const applyFitScale = () => {
    if (userZoomedRef.current) return false;
    const preferred = getPreferredScale();
    if (preferred == null) return false;
    if (Math.abs(preferred - scaleRef.current) > 0.001) {
      scaleRef.current = preferred;
      setScale(preferred);
    }
    requestAnimationFrame(centerMapScroll);
    return true;
  };

  // Re-fit whenever seats/bounds change or the map pane resizes (footer/header settle).
  useEffect(() => {
    userZoomedRef.current = false;
    let attempts = 0;
    let raf = 0;
    let cancelled = false;

    const tryFit = () => {
      if (cancelled) return;
      attempts += 1;
      if (!applyFitScale()) {
        if (attempts < 36) raf = requestAnimationFrame(tryFit);
      }
    };

    raf = requestAnimationFrame(tryFit);

    const el = containerRef.current;
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && el) {
      ro = new ResizeObserver(() => {
        if (cancelled) return;
        applyFitScale();
      });
      ro.observe(el);
    }

    const onResize = () => applyFitScale();
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit when layout bounds change
  }, [boundingBox.contentW, boundingBox.contentH, mapReady]);

  const handleSeatClick = (seat: Seat) => {
    if (String(seat.status || "").toUpperCase() !== "AVAILABLE") return;

    const isSelected = selectedSeatIds.includes(seat.id);
    let newSelection: string[] = [];
    if (isSelected) {
      newSelection = selectedSeatIds.filter((id) => id !== seat.id);
    } else if (selectedSeatIds.length >= maxSelectable) {
      // BMS: qty already filled — start a fresh pick from the tapped seat
      // (parent auto-expands contiguous neighbors via onSeatsSelected).
      newSelection = [seat.id];
    } else {
      newSelection = [...selectedSeatIds, seat.id];
    }

    setSelectedSeatIds(newSelection);
    const selectedSeats = seats.filter((s) => newSelection.includes(s.id));
    onSeatsSelected(selectedSeats);
  };

  const handleShapeClick = (shape: Shape) => {
    // If it's a Diamond VIP Box
    if (shape.text?.includes("DIAMOND") || shape.text?.includes("BOX")) {
      setActiveBoxInfo(shape);
    }

    if (!shape.ticket_type_id) return;
    if (selectedSeatIds.length >= maxSelectable) return;
    
    const dummyId = `zone-${shape.id}-${Date.now()}`;
    const dummySeat: Seat = {
      id: dummyId,
      ticket_type_id: shape.ticket_type_id,
      section_name: shape.text || "VIP Zone",
      row_label: "VIP",
      seat_label: "Ticket",
      coordinate_x: 0,
      coordinate_y: 0,
      status: "AVAILABLE",
    };

    const newSeats = [...seats, dummySeat];
    const newIds = [...selectedSeatIds, dummyId];
    setSeats(newSeats);
    setSelectedSeatIds(newIds);
    const selectedObjects = newSeats.filter((s) => newIds.includes(s.id));
    onSeatsSelected(selectedObjects);
  };

  const handleToggleZoomOnSection = (seat: Seat) => {
    userZoomedRef.current = true;
    const fitScale = getPreferredScale() ?? 0.4;
    if (scale > fitScale * 1.15) {
      scaleRef.current = fitScale;
      setScale(fitScale);
      requestAnimationFrame(centerMapScroll);
    } else {
      const targetScale = Math.min(1.2, Math.max(fitScale * 2, 0.95));
      scaleRef.current = targetScale;
      setScale(targetScale);
      const sectionSeats = seats.filter(s => (s.section_name === seat.section_name && s.section_name) || s.id === seat.id);
      const avgX = sectionSeats.length ? sectionSeats.reduce((acc, s) => acc + s.coordinate_x, 0) / sectionSeats.length : seat.coordinate_x;
      const avgY = sectionSeats.length ? sectionSeats.reduce((acc, s) => acc + s.coordinate_y, 0) / sectionSeats.length : seat.coordinate_y;

      setTimeout(() => {
        if (containerRef.current) {
          const container = containerRef.current;
          const scrollLeft = avgX * targetScale - container.clientWidth / 2;
          const scrollTop = avgY * targetScale - container.clientHeight / 2;
          container.scrollTo({
            left: Math.max(0, scrollLeft),
            top: Math.max(0, scrollTop),
            behavior: "smooth",
          });
        }
      }, 50);
    }
  };

  const handleToggleZoomOnShape = (shape: Shape) => {
    userZoomedRef.current = true;
    const fitScale = getPreferredScale() ?? 0.4;
    if (scale > fitScale * 1.15) {
      scaleRef.current = fitScale;
      setScale(fitScale);
      requestAnimationFrame(centerMapScroll);
    } else {
      const targetScale = Math.min(1.2, Math.max(fitScale * 2, 0.95));
      scaleRef.current = targetScale;
      setScale(targetScale);
      const centerX = shape.x + shape.width / 2;
      const centerY = shape.y + shape.height / 2;

      setTimeout(() => {
        if (containerRef.current) {
          const container = containerRef.current;
          const scrollLeft = centerX * targetScale - container.clientWidth / 2;
          const scrollTop = centerY * targetScale - container.clientHeight / 2;
          container.scrollTo({
            left: Math.max(0, scrollLeft),
            top: Math.max(0, scrollTop),
            behavior: "smooth",
          });
        }
      }, 50);
    }
  };

  // Color Palette per Tier matching reference layout image
  const getSeatColorBySection = (sectionName: string): string => {
    const name = (sectionName || "").toLowerCase();
    if (name.includes("platinum")) return "#06b6d4"; // Cyan
    if (name.includes("gold")) return "#a855f7";     // Purple
    if (name.includes("dress")) return "#ec4899";    // Pink
    if (name.includes("upper balcony")) return "#8b5cf6";    // Violet
    if (name.includes("recliner")) return "#0284c7"; // Sky Blue
    if (name.includes("prime")) return "#3b82f6";    // Blue
    if (name.includes("classic")) return "#6366f1";  // Indigo
    if (name.includes("vip") || name.includes("premium")) return "#f59e0b"; // Amber/Yellow
    if (name.includes("category 1") || name.includes("cat 1")) return "#dc2626"; // Red
    if (name.includes("category 2") || name.includes("cat 2") || name.includes("east stand")) return "#2563eb"; // Blue
    if (name.includes("category 3") || name.includes("cat 3") || name.includes("west stand")) return "#22c55e"; // Green
    if (name.includes("away")) return "#9333ea"; // Purple
    if (name.includes("south")) return "#f97316"; // Orange
    return "#3b82f6";                                // Blue default
  };

  if (seats.length === 0) return null;

  const shellClass = hideSidePanel
    ? "flex flex-col h-full w-full bg-[#F8FAFC] text-slate-900 overflow-hidden"
    : cinemaMode
    ? "flex flex-col md:flex-row h-full w-full bg-white text-slate-900 rounded-2xl overflow-hidden shadow-sm border border-slate-200"
    : "flex flex-col md:flex-row h-full w-full bg-slate-900 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800";
  const canvasClass = hideSidePanel
    ? "flex-1 min-h-0 overflow-auto relative bg-[#EEF2F7] cursor-grab active:cursor-grabbing select-none [-webkit-overflow-scrolling:touch]"
    : cinemaMode
    ? "flex-1 min-h-0 overflow-auto relative bg-[#F5F5F7] cursor-grab active:cursor-grabbing select-none [-webkit-overflow-scrolling:touch]"
    : "flex-1 min-h-0 overflow-auto relative bg-slate-950 cursor-grab active:cursor-grabbing select-none [-webkit-overflow-scrolling:touch]";
  const sidePanelClass = cinemaMode
    ? "w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-slate-200 p-5 flex flex-col justify-between shrink-0"
    : "w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-5 flex flex-col justify-between shrink-0";

  const mapW = boundingBox.contentW * scale;
  const mapH = boundingBox.contentH * scale;

  return (
    <div className={shellClass}>
      {/* Scroll shell: movie-style — no flex-center (that blocks left/right pan) */}
      <div
        ref={containerRef}
        className={canvasClass}
        style={{ touchAction: "none" }}
      >
        <div className="min-h-full min-w-full w-max flex items-center justify-center p-3 sm:p-5">
          <div
            ref={canvasWrapperRef}
            style={{ width: Math.max(mapW, 1), height: Math.max(mapH, 1) }}
            className="relative shrink-0"
          >
          <Stage
            width={mapW}
            height={mapH}
            onDblClick={(e) => {
              if (e.target === e.target.getStage()) {
                userZoomedRef.current = true;
                const fitScale = getPreferredScale() ?? 0.4;
                setScale((s) => {
                  const next =
                    s > fitScale * 1.15
                      ? fitScale
                      : Math.min(1.2, Math.max(fitScale * 2, 0.95));
                  scaleRef.current = next;
                  return next;
                });
                requestAnimationFrame(centerMapScroll);
              }
            }}
          >
            <Layer
              scaleX={scale}
              scaleY={scale}
              x={-boundingBox.minX * scale}
              y={-boundingBox.minY * scale}
            >
              {bgImage && (
                <KonvaImage
                  image={bgImage}
                  x={boundingBox.minX}
                  y={boundingBox.minY}
                  width={boundingBox.contentW}
                  height={boundingBox.contentH}
                  listening={false}
                />
              )}
              {/* Shapes / VIP Boxes / Stage */}
              {shapes.map((shape, sIdx) => {
                const shapeType = (shape.type || "rect") as ShapeType;
                const isBox = shape.text?.includes("DIAMOND") || shape.text?.includes("BOX");
                const opacity = shape.opacity ?? 1;
                const fill = bgImage
                  ? "rgba(255, 255, 255, 0.01)"
                  : (isBox ? "#475569" : shape.fill || "#334155");
                const stroke =
                  shape.stroke ||
                  (isBox
                    ? "#e2e8f0"
                    : bgImage
                      ? "rgba(255, 255, 255, 0.2)"
                      : "rgba(255,255,255,0.25)");
                const strokeWidth = shape.strokeWidth ?? (isBox ? 2 : 1.5);
                const common = {
                  fill,
                  stroke,
                  strokeWidth,
                  opacity,
                  perfectDrawEnabled: false as const,
                  shadowForStrokeEnabled: false as const,
                  onMouseEnter: (e: any) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = "pointer";
                  },
                  onMouseLeave: (e: any) => {
                    const container = e.target.getStage()?.container();
                    if (container) container.style.cursor = "default";
                  },
                  onClick: () => handleShapeClick(shape),
                  onTap: () => handleShapeClick(shape),
                };

                const visual = (() => {
                  switch (shapeType) {
                    case "circle":
                    case "ellipse":
                      return (
                        <Ellipse
                          x={shape.width / 2}
                          y={shape.height / 2}
                          radiusX={shape.width / 2}
                          radiusY={shape.height / 2}
                          {...common}
                        />
                      );
                    case "diamond":
                      return (
                        <Line
                          points={[
                            shape.width / 2, 0,
                            shape.width, shape.height / 2,
                            shape.width / 2, shape.height,
                            0, shape.height / 2,
                          ]}
                          closed
                          {...common}
                        />
                      );
                    case "triangle":
                      return (
                        <Line
                          points={[
                            shape.width / 2, 0,
                            shape.width, shape.height,
                            0, shape.height,
                          ]}
                          closed
                          {...common}
                        />
                      );
                    case "roundRect":
                    case "zone":
                      return (
                        <Rect
                          x={0}
                          y={0}
                          width={shape.width}
                          height={shape.height}
                          cornerRadius={shape.cornerRadius ?? 16}
                          {...common}
                        />
                      );
                    default:
                      return (
                        <Rect
                          x={0}
                          y={0}
                          width={shape.width}
                          height={shape.height}
                          cornerRadius={
                            shape.cornerRadius ??
                            (isBox ? 8 : shape.width > 500 && shape.height > 500 ? 300 : 3)
                          }
                          {...common}
                        />
                      );
                  }
                })();

                return (
                  <Group
                    key={shape.id || `shape-${shape.text || ''}-${sIdx}`}
                    x={shape.x + shape.width / 2}
                    y={shape.y + shape.height / 2}
                    offsetX={shape.width / 2}
                    offsetY={shape.height / 2}
                    rotation={shape.rotation || 0}
                    onDblClick={() => handleToggleZoomOnShape(shape)}
                    onDblTap={() => handleToggleZoomOnShape(shape)}
                  >
                    {visual}
                    {shape.text && !bgImage && (
                      <Text
                        text={shape.text}
                        x={0}
                        y={0}
                        width={shape.width}
                        height={shape.height}
                        align="center"
                        verticalAlign="middle"
                        fontSize={
                          shape.text.includes("STAND") ? 16
                          : shape.text.includes("PITCH") ? 15
                          : shape.text.includes("GATE") || shape.text.includes("TEAM") || shape.text.includes("PLAYER") || shape.text.includes("REFEREE") ? 11
                          : 13
                        }
                        fontStyle="bold"
                        fill={
                          shape.fill === "#f8fafc" || shape.fill === "#ffffff" || shape.fill === "#fbbf24" || shape.fill === "#94a3b8"
                            ? "#1e293b"
                            : "#ffffff"
                        }
                        listening={false}
                        wrap="word"
                        perfectDrawEnabled={false}
                      />
                    )}
                  </Group>
                );
              })}

              {/* Seats */}
              {seats.map((seat, sIdx) => {
                const isSelected = selectedSeatIds.includes(seat.id);
                const isAvailable =
                  String(seat.status || "").toUpperCase() === "AVAILABLE";
                const categoryColor = getSeatColorBySection(seat.section_name);
                
                let fill = cinemaMode ? "#ffffff" : "#334155"; // Unavailable / booked
                let stroke = cinemaMode ? "#94a3b8" : "#475569";
                let strokeWidth = 1;
                let opacity = cinemaMode ? 1 : 0.4;
                let labelFill = cinemaMode ? "#94a3b8" : "#ffffff";
                let labelText = seat.seat_label;

                if (isSelected) {
                  fill = cinemaMode ? "#8B5CF6" : "#f43f5e";
                  stroke = cinemaMode ? "#6D28D9" : "#ffffff";
                  strokeWidth = 2;
                  opacity = 1;
                  labelFill = "#ffffff";
                  labelText = seat.seat_label;
                } else if (isAvailable) {
                  fill = cinemaMode ? "#ffffff" : categoryColor;
                  stroke = cinemaMode
                    ? seat.is_bestseller
                      ? "#EAB308"
                      : "#22C55E"
                    : "#ffffff";
                  opacity = 1;
                  labelFill = cinemaMode ? "#111111" : "#ffffff";
                  labelText = seat.seat_label;
                } else if (cinemaMode) {
                  fill = "#E5E7EB";
                  stroke = "#E5E7EB";
                  labelText = "×";
                  labelFill = "#ffffff";
                }

                return (
                  <Group
                    key={seat.internalId || `${seat.section_name || ''}-${seat.row_label || ''}-${seat.seat_label || ''}-${seat.id || ''}-${sIdx}`}
                    x={seat.coordinate_x}
                    y={seat.coordinate_y}
                    opacity={opacity}
                    onMouseEnter={(e) => {
                      if (isAvailable) {
                        const container = e.target.getStage()?.container();
                        if (container) container.style.cursor = "pointer";
                      }
                    }}
                    onMouseLeave={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container) container.style.cursor = "default";
                    }}
                    onDblClick={() => handleToggleZoomOnSection(seat)}
                    onDblTap={() => handleToggleZoomOnSection(seat)}
                    onClick={() => handleSeatClick(seat)}
                    onTap={() => handleSeatClick(seat)}
                  >
                    <Circle
                      radius={12}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
                    />
                    <Text 
                      x={-12}
                      y={-5}
                      width={24}
                      text={labelText}
                      fontSize={10}
                      fontStyle="bold"
                      fill={labelFill}
                      align="center"
                      verticalAlign="middle"
                      listening={false}
                      perfectDrawEnabled={false}
                    />
                  </Group>
                );
              })}

              {/* Row letters on both sides of each row (cinema halls) */}
              {cinemaMode
                ? (() => {
                    const rows = new Map<string, { label: string; minX: number; maxX: number; sumY: number; n: number }>();
                    seats.forEach((s) => {
                      const label = String(s.row_label || "").trim();
                      if (!label || label.toUpperCase() === "VIP") return;
                      const y = Number(s.coordinate_y) || 0;
                      const x = Number(s.coordinate_x) || 0;
                      const key = `${label}|${Math.round(y / 8)}`;
                      const cur = rows.get(key) || { label, minX: x, maxX: x, sumY: 0, n: 0 };
                      cur.minX = Math.min(cur.minX, x);
                      cur.maxX = Math.max(cur.maxX, x);
                      cur.sumY += y;
                      cur.n += 1;
                      rows.set(key, cur);
                    });
                    return Array.from(rows.entries()).flatMap(([key, r]) => {
                      const y = r.sumY / r.n - 6;
                      return [
                        <Text key={`rl-${key}`} text={r.label} x={r.minX - 62} y={y - 3} width={34} align="center" fontSize={18} fontStyle="bold" fill="#475569" listening={false} />,
                        <Text key={`rr-${key}`} text={r.label} x={r.maxX + 28} y={y - 3} width={34} align="center" fontSize={18} fontStyle="bold" fill="#475569" listening={false} />,
                      ];
                    });
                  })()
                : null}

              {/* Text Labels */}
              {labels.map((label, lIdx) => (
                <Text
                  key={label.id || `label-${label.text || ''}-${lIdx}`}
                  text={label.text}
                  x={label.x}
                  y={label.y}
                  rotation={label.rotation || 0}
                  fontSize={label.fontSize || 16}
                  fontStyle="bold"
                  align={(label.text || "").includes("\n") ? "center" : "left"}
                  lineHeight={1.15}
                  fill={cinemaMode ? "#334155" : "#f1f5f9"}
                />
              ))}
            </Layer>
          </Stage>
          </div>
        </div>
      </div>

      {/* Side Info Panel for Diamond Boxes or Cinema Overview */}
      {!hideSidePanel && (
        <div className={sidePanelClass}>
          <div>
            {cinemaMode ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-[#F84464] animate-pulse" />
                  <h3 className="text-sm font-bold tracking-wider text-slate-900 uppercase">
                    {mapTitle || "Cinema Hall Map"}
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  {mapDescription ||
                    `Live layout configured for this screen. Pick up to ${maxSelectable} seats directly on the map.`}
                </p>

                <div className="space-y-2 pt-3 border-t border-slate-200 text-xs">
                  <p className="text-slate-700 font-semibold mb-2">Seat Tiers & Pricing:</p>
                  {(customLegend && customLegend.length > 0 ? customLegend : [
                    { name: "Recliner", color: "#0284c7" },
                    { name: "Prime", color: "#3b82f6" },
                    { name: "Classic Plus", color: "#6366f1" },
                  ]).map((tier) => (
                    <div key={tier.name} className="flex items-center justify-between py-1 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: tier.color }} />
                        <span className="text-slate-800 font-medium">{tier.name}</span>
                      </div>
                      {tier.price != null && (
                        <span className="font-mono text-slate-500 font-bold">{tier.price} ETB</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-3 space-y-1.5 text-[11px] text-slate-500">
                  <p className="flex items-center gap-1.5">
                    <span className="text-[#F84464] font-bold">•</span> Pinch or scroll to zoom (like a photo)
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="text-[#F84464] font-bold">•</span> Double-tap a section to zoom in
                  </p>
                  <p className="flex items-center gap-1.5">
                    <span className="text-[#F84464] font-bold">•</span> Drag to pan across the map
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                  <h3 className="text-sm font-bold tracking-wider text-amber-400 uppercase">
                    For Each Diamond Box
                  </h3>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-300 leading-relaxed border-t border-slate-800 pt-4">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Select 1 seat / ticket to view Diamond Box availability
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Accommodates 5 people
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Exclusive access to your personal diamond lounge
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    An ensuite, private powder room
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Personalised service
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Specially curated food & beverages menu
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Complimentary high-speed Wi-Fi
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    Personalised reminders at show start and intermission
                  </li>
                </ul>

                {activeBoxInfo && (
                  <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <p className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                      Selected: {activeBoxInfo.text}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Luxury Private Box • 5 Guests Capacity
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          {cinemaMode ? (
            <div className="border-t border-slate-200 pt-4 mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-white border border-[#22C55E]" /> Available</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#E5E7EB]" /> Sold</div>
              {seats.some(
                (s) =>
                  s.is_bestseller &&
                  String(s.status || "").toUpperCase() === "AVAILABLE"
              ) ? (
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-white border border-[#EAB308]" /> Bestseller</div>
              ) : null}
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[linear-gradient(135deg,#A78BFA_0%,#8B5CF6_38%,#6D28D9_72%,#4C1D95_100%)]" /> Selected</div>
            </div>
          ) : (
            <div className="border-t border-slate-800 pt-4 mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-cyan-500" /> Platinum</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-500" /> Gold</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-pink-500" /> Dress Circle</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-500" /> Lower Balcony</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-violet-500" /> Upper Balcony</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-500" /> Selected</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

