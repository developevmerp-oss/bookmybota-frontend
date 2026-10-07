"use client";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Stage, Layer, Rect, Text, Group, Circle, Line, Ellipse, Arc } from "react-konva";
import Konva from "konva";
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Users,
  AlertCircle,
  Loader2,
  Sparkles,
  Ticket,
  ChevronRight,
  Info,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/currencyFormat";
import {
  useGetPublicStadiumBlocksQuery,
  useGetStadiumBlockSeatsQuery,
} from "@/services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StadiumTier = {
  tier_id: string;
  name: string;
  ticket_type_id: string;
  total: number;
  available: number;
  color?: string | null;
  price?: number;
  seats_per_row?: number;
  row_seat_overrides?: Record<string, number>;
  row_gaps?: string[];
  excluded_seats?: string[];
};

export type StadiumBlock = {
  block_id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  shape?: "rectangle" | "pill" | "curved" | "oval" | "arc";
  stand_type?: "seated" | "standing";
  ticket_type_id?: string;
  seats_per_row?: number;
  row_seat_overrides?: Record<string, number>;
  row_gaps?: string[];
  excluded_seats?: string[];
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  sweepAngle?: number;
  stadiumCenterX?: number;
  stadiumCenterY?: number;
  total: number;
  available: number;
  booked: number;
  tiers: StadiumTier[];
  /** From stadium seating_config when API spreads block */
  price?: number;
};

export type TierSeat = {
  id: string;
  row_label: string;
  seat_label: string;
  coordinate_x: number;
  coordinate_y: number;
  status: string;
  ticket_type_id: string;
  section_name: string;
  tier_id?: string;
  price?: number;
};

function availabilityBadge(available: number, total: number) {
  if (total === 0) return null;
  const pct = available / total;
  if (pct === 0) return { label: "SOLD OUT", color: "#ef4444", bg: "#450a0a" };
  if (pct < 0.15) return { label: "ALMOST FULL", color: "#f97316", bg: "#431407" };
  if (pct < 0.4) return { label: "FILLING FAST", color: "#eab308", bg: "#422006" };
  return { label: `${available} AVAIL`, color: "#22c55e", bg: "#052e16" };
}

// ─── Main Stadium Layout Viewer (BookMyShow Flow) ────────────────────────────

export default function StadiumLayoutViewer({
  eventId,
  ticketTypes,
  onSeatsSelected,
  initialSelectedSeats = [],
  maxSelectable = Number.MAX_SAFE_INTEGER,
  /** When true (checkout fullscreen), hide duplicate bottom CTA — parent footer owns Continue */
  hideBookingBar = false,
}: {
  eventId: string;
  ticketTypes: Array<{ id: string; name: string; price: number }>;
  onSeatsSelected: (seats: TierSeat[]) => void;
  initialSelectedSeats?: TierSeat[];
  maxSelectable?: number;
  hideBookingBar?: boolean;
}) {
  const { data, isLoading, isError } = useGetPublicStadiumBlocksQuery(eventId);

  // Selected block for zooming into seat layout
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeTierId, setActiveTierId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  // Tier picker: shown when a multi-tier block is clicked — user must pick a tier before seeing seats
  const [showTierPicker, setShowTierPicker] = useState<boolean>(false);
  const [standingQty, setStandingQty] = useState<number>(1);

  // Selected seats state
  const [selectedSeats, setSelectedSeats] = useState<TierSeat[]>(initialSelectedSeats);

  useEffect(() => {
    if (Array.isArray(initialSelectedSeats)) {
      setSelectedSeats(initialSelectedSeats);
    }
  }, [initialSelectedSeats]);

  // Hover states
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [hoveredSeat, setHoveredSeat] = useState<TierSeat | null>(null);

  // Canvas zoom & pan state
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [containerSize, setContainerSize] = useState({ width: 900, height: 560 });
  const [zoomScale, setZoomScale] = useState<number | null>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // Measure the actual map pane so the stadium fits the visible area (not a capped 65vh)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const w = el.clientWidth || 900;
      const h = el.clientHeight || 500;
      setContainerSize({
        width: w,
        height: Math.max(320, h),
      });
    };
    updateSize();
    const obs = new ResizeObserver(updateSize);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const canvasWidth = data?.canvas_width || 1600;
  const canvasHeight = data?.canvas_height || 1200;
  const pitchX = (data as any)?.ground?.x ?? canvasWidth * 0.22;
  const pitchY = (data as any)?.ground?.y ?? canvasHeight * 0.22;
  const pitchW = (data as any)?.ground?.width ?? canvasWidth * 0.56;
  const pitchH = (data as any)?.ground?.height ?? canvasHeight * 0.56;
  const pitchRot = (data as any)?.ground?.rotation ?? 0;

  // Fit full stadium into the map pane with comfortable padding on all sides
  const baseScale = useMemo(() => {
    const pad = 64;
    const availW = Math.max(120, containerSize.width - pad * 2);
    const availH = Math.max(120, containerSize.height - pad * 2);
    return Math.min(availW / canvasWidth, availH / canvasHeight);
  }, [containerSize, canvasWidth, canvasHeight]);

  const fitStagePos = useMemo(
    () => ({
      x: (containerSize.width - canvasWidth * baseScale) / 2,
      y: (containerSize.height - canvasHeight * baseScale) / 2,
    }),
    [containerSize, canvasWidth, canvasHeight, baseScale]
  );

  const selectedBlock = useMemo(() => {
    return data?.blocks.find((b) => b.block_id === selectedBlockId) || null;
  }, [data?.blocks, selectedBlockId]);

  const activeTier = useMemo(() => {
    if (!selectedBlock || !activeTierId) return null;
    return selectedBlock.tiers?.find((t) => t.tier_id === activeTierId) || null;
  }, [selectedBlock, activeTierId]);

  // Fetch all seats for the selected block
  const {
    data: blockSeatsData,
    isLoading: seatsLoading,
    isFetching: seatsFetching,
    isError: seatsError,
  } = useGetStadiumBlockSeatsQuery(
    { eventId, blockId: selectedBlockId || "" },
    { skip: !selectedBlockId }
  );

  const rawSeats = blockSeatsData?.seats || [];
  // Show loading from stand select until seat payload arrives (avoids empty map flash)
  const seatsPending =
    Boolean(selectedBlockId) &&
    !seatsError &&
    (seatsLoading || seatsFetching || !blockSeatsData);

  //  const formatPrice = useCallback((val: number) => formatMoney(val, { compact: true }), []);
  const formatPrice = useCallback(
    (val: number) => {
      const curr = (ticketTypes[0] as any)?.currency || "";
      return `${curr} ${val.toLocaleString()}`.trim();
    },
    [ticketTypes]
  );
  const ticketPriceById = useMemo(() => {
    const map = new Map<string, number>();
    for (const tt of ticketTypes) {
      const id = String(tt.id ?? "").trim();
      if (!id) continue;
      map.set(id, Number(tt.price) || 0);
    }
    return map;
  }, [ticketTypes]);

  const lookupTicketPrice = useCallback(
    (ticketTypeId: string | null | undefined) => {
      const id = String(ticketTypeId ?? "").trim();
      if (!id) return null;
      if (!ticketPriceById.has(id)) return null;
      const n = ticketPriceById.get(id)!;
      return n > 0 ? n : null;
    },
    [ticketPriceById]
  );

  // Same ticket price used when a seat is selected on the map
  const getTierPrice = useCallback(
    (tier: StadiumTier) => {
      const fromTicket = lookupTicketPrice(tier.ticket_type_id);
      if (fromTicket != null) return fromTicket;
      if (tier.price != null && !Number.isNaN(Number(tier.price))) {
        const n = Number(tier.price);
        if (n > 0) return n;
      }
      return null;
    },
    [lookupTicketPrice]
  );

  const standPriceAndLeftLabel = useCallback(
    (block: StadiumBlock, minPrice: number | null) => {
      const isSoldOut = block.available === 0 && block.total > 0;
      if (isSoldOut) return "Sold out";
      const left = `${block.available} left`;
      if (minPrice != null && minPrice > 0) {
        return `${formatPrice(minPrice)} · ${left}`;
      }
      return left;
    },
    [formatPrice]
  );

  const tierPriceAndLeftLabel = useCallback(
    (tier: StadiumTier, tierPrice: number | null) => {
      const isSoldOut = tier.available === 0 && tier.total > 0;
      if (isSoldOut) return "SOLD OUT";
      const left = `${tier.available} left`;
      if (tierPrice != null && tierPrice > 0) {
        return `${formatPrice(tierPrice)} · ${left}`;
      }
      return left;
    },
    [formatPrice]
  );

  // Map price to seats based on ticketTypes
  const blockSeats: TierSeat[] = useMemo(() => {
    return rawSeats.map((s) => {
      const fromTicket = lookupTicketPrice(s.ticket_type_id);
      return {
        ...s,
        price: fromTicket ?? 0,
      };
    });
  }, [rawSeats, lookupTicketPrice]);

  // Keep overview instantly fitted so the whole stadium is visible on first paint
  useEffect(() => {
    if (selectedBlockId) return;
    setZoomScale(baseScale);
    setStagePos(fitStagePos);
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: baseScale, y: baseScale });
    stage.position(fitStagePos);
    stage.batchDraw();
  }, [baseScale, fitStagePos, selectedBlockId]);

  const activeZoomScale = zoomScale ?? baseScale;
  const activeStagePos = zoomScale == null ? fitStagePos : stagePos;

  // Handle Block Click — BookMyShow block/tier selection with deep focus zoom
  const handleBlockClick = useCallback(
    (block: StadiumBlock, tierId?: string) => {
      if (block.available === 0 && block.total > 0) {
        toast.info(`${block.name} is completely sold out.`);
        return;
      }
      setSelectedBlockId(block.block_id);
      setSelectedRow(null);
      setHoveredSeat(null);

      let resolvedTierId = tierId;
      // If standing block → prepare standing pass selection
      if (block.stand_type === "standing") {
        setActiveTierId(null);
        setShowTierPicker(false);
        const existingForBlock = selectedSeats.filter(
          (s) =>
            s.section_name === block.name ||
            s.id.startsWith(`standing-${block.block_id}-`)
        );
        if (existingForBlock.length > 0) {
          setStandingQty(existingForBlock.length);
        } else {
          setStandingQty(
            Math.max(
              1,
              Math.min(
                maxSelectable < Number.MAX_SAFE_INTEGER ? maxSelectable : 1,
                block.available || 1
              )
            )
          );
        }
      } else {
        // Resolve specific tier: passed tierId -> category matched tier -> first available tier -> first tier
        if (!resolvedTierId && block.tiers && block.tiers.length > 0) {
          if (selectedCategoryFilter) {
            const matchingTier = block.tiers.find((t) => t.ticket_type_id === selectedCategoryFilter);
            if (matchingTier) resolvedTierId = matchingTier.tier_id;
          }
          if (!resolvedTierId) {
            const firstAvail = block.tiers.find((t) => t.available > 0) || block.tiers[0];
            resolvedTierId = firstAvail ? firstAvail.tier_id : undefined;
          }
        }
        setActiveTierId(resolvedTierId || null);
        setShowTierPicker(false);
      }

      if (!stageRef.current) return;

      // Calculate bounds of this block / tier so it fully zooms in to fill the screen
      let bounds: { centerX: number; centerY: number; width: number; height: number };

      if (block.shape === "arc") {
        const sCX = block.stadiumCenterX != null ? Number(block.stadiumCenterX) : canvasWidth / 2;
        const sCY = block.stadiumCenterY != null ? Number(block.stadiumCenterY) : canvasHeight / 2;
        const innerR = Number(block.innerRadius) || 260;
        const outerR = Number(block.outerRadius) || 335;
        const startA = Number(block.startAngle) || 0;
        const sweepA = Number(block.sweepAngle) || 45;
        const endA = startA + sweepA;
        const numTiers = Math.max(1, block.tiers?.length || 1);

        let tInR = innerR;
        let tOutR = outerR;
        if (resolvedTierId && numTiers > 1) {
          const tIdx = block.tiers.findIndex((t) => t.tier_id === resolvedTierId);
          if (tIdx >= 0) {
            const baseRadialSpan = (outerR - innerR) / numTiers;
            tInR = innerR + tIdx * baseRadialSpan;
            tOutR = tInR + baseRadialSpan;
          }
        }

        const xs: number[] = [];
        const ys: number[] = [];
        for (let a = startA; a <= endA; a += 1.5) {
          const rad = (a * Math.PI) / 180;
          const c = Math.cos(rad);
          const s = Math.sin(rad);
          xs.push(sCX + tInR * c, sCX + tOutR * c);
          ys.push(sCY + tInR * s, sCY + tOutR * s);
        }
        const endRad = (endA * Math.PI) / 180;
        xs.push(sCX + tInR * Math.cos(endRad), sCX + tOutR * Math.cos(endRad));
        ys.push(sCY + tInR * Math.sin(endRad), sCY + tOutR * Math.sin(endRad));

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        bounds = {
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2,
          width: Math.max(40, maxX - minX),
          height: Math.max(30, maxY - minY),
        };
      } else {
        const bx = Number(block.x) || 0;
        const by = Number(block.y) || 0;
        const bw = Number(block.width) || 120;
        const bh = Number(block.height) || 80;
        const rotDeg = Number(block.rotation) || 0;
        const rotRad = (rotDeg * Math.PI) / 180;
        const cosRot = Math.cos(rotRad);
        const sinRot = Math.sin(rotRad);
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        const numTiers = Math.max(1, block.tiers?.length || 1);

        let tierTop = 0;
        let tierH = bh;
        if (resolvedTierId && numTiers > 1) {
          const tIdx = block.tiers.findIndex((t) => t.tier_id === resolvedTierId);
          if (tIdx >= 0) {
            const baseTierH = bh / numTiers;
            tierTop = tIdx * baseTierH;
            tierH = baseTierH;
          }
        }

        const localY0 = tierTop - bh / 2;
        const localY1 = tierTop + tierH - bh / 2;
        const localX0 = -bw / 2;
        const localX1 = bw / 2;

        const corners = [
          { x: cx + localX0 * cosRot - localY0 * sinRot, y: cy + localX0 * sinRot + localY0 * cosRot },
          { x: cx + localX1 * cosRot - localY0 * sinRot, y: cy + localX1 * sinRot + localY0 * cosRot },
          { x: cx + localX1 * cosRot - localY1 * sinRot, y: cy + localX1 * sinRot + localY1 * cosRot },
          { x: cx + localX0 * cosRot - localY1 * sinRot, y: cy + localX0 * sinRot + localY1 * cosRot },
        ];
        const minX = Math.min(...corners.map((c) => c.x));
        const maxX = Math.max(...corners.map((c) => c.x));
        const minY = Math.min(...corners.map((c) => c.y));
        const maxY = Math.max(...corners.map((c) => c.y));

        bounds = {
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2,
          width: Math.max(40, maxX - minX),
          height: Math.max(30, maxY - minY),
        };
      }

      // Zoom so the block/tier fills the screen generously (92% width, 88% height)
      const scaleX = (containerSize.width * 0.92) / bounds.width;
      const scaleY = (containerSize.height * 0.88) / bounds.height;
      let targetScale = Math.min(scaleX, scaleY);
      targetScale = Math.max(2.8, Math.min(7.5, targetScale));

      const newX = containerSize.width / 2 - bounds.centerX * targetScale;
      const newY = containerSize.height / 2 - bounds.centerY * targetScale;
      setZoomScale(targetScale);
      setStagePos({ x: newX, y: newY });
      stageRef.current.to({
        x: newX,
        y: newY,
        scaleX: targetScale,
        scaleY: targetScale,
        duration: 0.45,
        easing: Konva.Easings.EaseInOut,
      });
    },
    [containerSize, canvasWidth, canvasHeight, selectedCategoryFilter, selectedSeats, maxSelectable]
  );

  // Select a tier from the picker → zoom straight into that tier's seats
  const handleTierSelect = useCallback(
    (tierId: string) => {
      if (selectedBlock) {
        handleBlockClick(selectedBlock, tierId);
      } else {
        setActiveTierId(tierId);
        setShowTierPicker(false);
        setSelectedRow(null);
      }
    },
    [selectedBlock, handleBlockClick]
  );

  // Zoom back out to full stadium overview
  const handleBackToStadium = useCallback(() => {
    setSelectedBlockId(null);
    setActiveTierId(null);
    setShowTierPicker(false);
    setSelectedRow(null);
    setHoveredSeat(null);
    setZoomScale(baseScale);
    setStagePos(fitStagePos);
    if (stageRef.current) {
      stageRef.current.to({
        x: fitStagePos.x,

        y: fitStagePos.y,
        scaleX: baseScale,

        scaleY: baseScale,
        duration: 0.35,
        easing: Konva.Easings.EaseInOut,
      });
    }
  }, [baseScale, fitStagePos]);

  // Cursor-centered mouse-wheel zoom (BookMyShow style)
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const direction = e.evt.deltaY < 0 ? 1 : -1;
    const factor = 1.15;
    const newScale = Math.max(0.2, Math.min(8.0, direction > 0 ? oldScale * factor : oldScale / factor));
    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
    setZoomScale(newScale);
    setStagePos(newPos);
  }, []);

  // Handle manual zoom buttons — works for block/tier when selected
  const handleZoomChange = (delta: number) => {
    const current = zoomScale ?? baseScale;
    const newScale = selectedBlockId
      ? Math.max(1.8, Math.min(8.0, current + delta))
      : Math.max(0.3, Math.min(5, current + delta));
    setZoomScale(newScale);
    if (stageRef.current) {
      stageRef.current.to({
        scaleX: newScale,
        scaleY: newScale,
        duration: 0.22,
      });
    }
  };

  const handleResetZoom = () => {
    if (selectedBlock) {
      handleBlockClick(selectedBlock, activeTierId || undefined);
    } else {
      const centerX = (containerSize.width - canvasWidth * baseScale) / 2;
      const centerY = (containerSize.height - canvasHeight * baseScale) / 2;
      setZoomScale(baseScale);
      setStagePos({ x: centerX, y: centerY });
      if (stageRef.current) {
        stageRef.current.to({
          x: centerX,
          y: centerY,
          scaleX: baseScale,
          scaleY: baseScale,
          duration: 0.35,
          easing: Konva.Easings.EaseInOut,
        });
      }
    }
  };

  const handleFitStadium = useCallback(() => {
    setZoomScale(baseScale);
    setStagePos(fitStagePos);
    if (stageRef.current) {
      stageRef.current.to({
        x: fitStagePos.x,
        y: fitStagePos.y,
        scaleX: baseScale,
        scaleY: baseScale,
        duration: 0.35,
        easing: Konva.Easings.EaseInOut,
      });
    }
  }, [baseScale, fitStagePos]);

  // Seat toggle selection
  const handleSeatClick = useCallback(
    (seat: TierSeat) => {
      if (seat.status !== "AVAILABLE") {
        toast.info("This seat is not available.");
        return;
      }

      const isAlreadySelected = selectedSeats.some((s) => s.id === seat.id);
      let next: TierSeat[];

      if (isAlreadySelected) {
        next = selectedSeats.filter((s) => s.id !== seat.id);
      } else {
        if (selectedSeats.length >= maxSelectable) {
          toast.warning(`You can select a maximum of ${maxSelectable} seat${maxSelectable === 1 ? "" : "s"}.`);
          return;
        }
        next = [...selectedSeats, seat];
      }

      setSelectedSeats(next);
      onSeatsSelected(next);
    },
    [selectedSeats, maxSelectable, onSeatsSelected]
  );

  // Price helper for a block
  const getBlockMinPrice = useCallback(
    (block: StadiumBlock) => {
      if (block.stand_type === "standing") {
        const targetId = block.ticket_type_id || block.tiers?.[0]?.ticket_type_id;
        const match = ticketTypes.find((tt) => tt.id === targetId);
        return match ? Number(match.price) : null;
      }
      const prices = block.tiers
        .map((t) => {
          const match = ticketTypes.find((tt) => tt.id === t.ticket_type_id);
          return match ? Number(match.price) : null;
        })
        .filter((p): p is number => p !== null);
      if (prices.length === 0) {
        if (block.ticket_type_id) {
          const match = ticketTypes.find((tt) => tt.id === block.ticket_type_id);
          return match ? Number(match.price) : null;
        }
        return null;
      }
      return Math.min(...prices);
    },
    [ticketTypes]
  );



  // Filtered blocks if category filter is active
  const filteredBlocks = useMemo(() => {
    if (!data?.blocks) return [];
    if (!selectedCategoryFilter) return data.blocks;
    return data.blocks.filter((b) =>
      b.ticket_type_id === selectedCategoryFilter ||
      b.tiers.some((t) => t.ticket_type_id === selectedCategoryFilter)
    );
  }, [data?.blocks, selectedCategoryFilter]);

  const totalPrice = selectedSeats.reduce((sum, s) => sum + (s.price || 0), 0);

  // ── Rendered Seats & Layout Calculation for In-Canvas Zoom Drill-down ──
  const renderedSeats = useMemo(() => {
    if (!selectedBlock || !blockSeats || blockSeats.length === 0) return [];

    // If an active tier is selected, ONLY render seats belonging to that tier!
    // If no active tier is selected, render all seats of the block.
    // If an active tier is selected, ONLY render seats belonging to that tier!
    // If no active tier is selected, render all seats of the block.
    const filtered = activeTierId
      ? blockSeats.filter((s) => s.tier_id === activeTierId)
      : blockSeats;

    if (filtered.length === 0) return [];

    const isArc = selectedBlock.shape === "arc";
    const sCX = selectedBlock.stadiumCenterX != null ? Number(selectedBlock.stadiumCenterX) : canvasWidth / 2;
    const sCY = selectedBlock.stadiumCenterY != null ? Number(selectedBlock.stadiumCenterY) : canvasHeight / 2;

    const innerR = Number(selectedBlock.innerRadius) || 260;
    const outerR = Number(selectedBlock.outerRadius) || 335;
    const startAngle = Number(selectedBlock.startAngle) || 0;
    const sweepAngle = Number(selectedBlock.sweepAngle) || 45;

    const bx = Number(selectedBlock.x) || 0;
    const by = Number(selectedBlock.y) || 0;
    const bw = Number(selectedBlock.width) || 120;
    const bh = Number(selectedBlock.height) || 80;
    const rotationDeg = Number(selectedBlock.rotation) || 0;
    const rotRad = (rotationDeg * Math.PI) / 180;
    const cosRot = Math.cos(rotRad);
    const sinRot = Math.sin(rotRad);
    const centerX = bx + bw / 2;
    const centerY = by + bh / 2;

    const numTiers = Math.max(1, selectedBlock.tiers?.length || 1);

    // Group seats by tier: tier_id -> Map<row_label, TierSeat[]>
    const tierGroups = new Map<string, Map<string, TierSeat[]>>();
    filtered.forEach((s) => {
      const tKey = s.tier_id || selectedBlock.tiers?.[0]?.tier_id || "default_tier";
      if (!tierGroups.has(tKey)) tierGroups.set(tKey, new Map());
      const rMap = tierGroups.get(tKey)!;
      const rKey = s.row_label || "A";
      if (!rMap.has(rKey)) rMap.set(rKey, []);
      rMap.get(rKey)!.push(s);
    });

    const results: Array<TierSeat & { posX: number; posY: number; rotation: number }> = [];

    tierGroups.forEach((rowMap, tKey) => {
      const foundIdx = selectedBlock.tiers?.findIndex((t) => t.tier_id === tKey) ?? -1;
      const tIdx = foundIdx >= 0 ? foundIdx : 0;
      const tierObj = selectedBlock.tiers?.[tIdx];

      // Natural sort rows: A, B, C, D...
      const sortedRows = Array.from(rowMap.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );
      const totalRows = Math.max(1, sortedRows.length);

      // Row gaps / walkway aisles between rows if configured
      const tierRowGaps = (selectedBlock as any).row_gaps || (tierObj as any)?.row_gaps || [];

      if (isArc) {
        const tierRadialSpan = (outerR - innerR) / numTiers;
        const tierInnerR = innerR + tIdx * tierRadialSpan;
        const tierOuterR = tierInnerR + tierRadialSpan;

        // Safe padding so seats never touch or bleed through borders
        const padR = Math.max(5, (tierOuterR - tierInnerR) * 0.08);
        const padA = Math.max(1.8, sweepAngle * 0.045);
        const usableInnerR = tierInnerR + padR;
        const usableOuterR = tierOuterR - padR;
        const usableRadialSpan = Math.max(8, usableOuterR - usableInnerR);
        const usableStartA = startAngle + padA;
        const usableSweepA = Math.max(2, sweepAngle - padA * 2);

        // Calculate weighted row positions respecting row_gaps (horizontal walkways)
        const gapWeight = 1.2;
        let totalExtraGaps = 0;
        sortedRows.forEach((rLabel, rIdx) => {
          if (rIdx < sortedRows.length - 1 && tierRowGaps.includes(rLabel)) {
            totalExtraGaps += gapWeight;
          }
        });
        const totalWeightedRows = totalRows + totalExtraGaps;

        let extraGapsBefore = 0;
        sortedRows.forEach((rKey, rowIdx) => {
          const rowFraction = (rowIdx + extraGapsBefore + 0.5) / Math.max(1, totalWeightedRows);
          if (tierRowGaps.includes(rKey)) {
            extraGapsBefore += gapWeight;
          }

          const seatsInRow = rowMap.get(rKey)!;
          // Sort seats by seat number
          seatsInRow.sort((a, b) => {
            const numA = parseInt(String(a.seat_label).replace(/\D/g, ""), 10);
            const numB = parseInt(String(b.seat_label).replace(/\D/g, ""), 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return (a.seat_label || "").localeCompare(b.seat_label || "", undefined, { numeric: true });
          });

          // Calculate columns PER ROW so wide rows don't compress standard rows
          let maxSeatInRow = 0;
          let minSeatInRow = Infinity;
          seatsInRow.forEach((s) => {
            const num = parseInt(String(s.seat_label).replace(/\D/g, ""), 10);
            if (!isNaN(num) && num > 0) {
              if (num > maxSeatInRow) maxSeatInRow = num;
              if (num < minSeatInRow) minSeatInRow = num;
            }
          });
          if (minSeatInRow === Infinity) minSeatInRow = 1;

          const rowOverrideCount =
            tierObj?.row_seat_overrides?.[rKey] || (selectedBlock as any)?.row_seat_overrides?.[rKey];
          const baseSeats = tierObj?.seats_per_row || selectedBlock.seats_per_row || 0;
          const totalRowSlots = Math.max(
            1,
            rowOverrideCount || 0,
            baseSeats,
            maxSeatInRow - minSeatInRow + 1,
            seatsInRow.length
          );

          seatsInRow.forEach((seat, seatIdx) => {
            const parsedNum = parseInt(String(seat.seat_label).replace(/\D/g, ""), 10);
            const slotIndex =
              !isNaN(parsedNum) && parsedNum >= minSeatInRow
                ? parsedNum - minSeatInRow
                : seatIdx;

            const colFraction = (slotIndex + 0.5) / totalRowSlots;
            const r = usableInnerR + rowFraction * usableRadialSpan;
            const angleDeg = usableStartA + colFraction * usableSweepA;
            const angleRad = (angleDeg * Math.PI) / 180;
            const posX = sCX + r * Math.cos(angleRad);
            const posY = sCY + r * Math.sin(angleRad);
            const rot = angleDeg + 90;

            results.push({ ...seat, posX, posY, rotation: rot });
          });
        });
      } else {
        // Rectangular stand divided into vertical tier slices
        const tierH = bh / numTiers;
        const tierY = tIdx * tierH;

        const padX = Math.max(10, bw * 0.08);
        const padY = Math.max(6, tierH * 0.08);
        const usableW = Math.max(20, bw - padX * 2);
        const usableH = Math.max(10, tierH - padY * 2);

        // Row gaps calculation for rectangle
        const gapWeight = 1.2;
        let totalExtraGaps = 0;
        sortedRows.forEach((rLabel, rIdx) => {
          if (rIdx < sortedRows.length - 1 && tierRowGaps.includes(rLabel)) {
            totalExtraGaps += gapWeight;
          }
        });
        const totalWeightedRows = totalRows + totalExtraGaps;

        let extraGapsBefore = 0;
        sortedRows.forEach((rKey, rowIdx) => {
          const rowFraction = (rowIdx + extraGapsBefore + 0.5) / Math.max(1, totalWeightedRows);
          if (tierRowGaps.includes(rKey)) {
            extraGapsBefore += gapWeight;
          }

          const seatsInRow = rowMap.get(rKey)!;
          seatsInRow.sort((a, b) => {
            const numA = parseInt(String(a.seat_label).replace(/\D/g, ""), 10);
            const numB = parseInt(String(b.seat_label).replace(/\D/g, ""), 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return (a.seat_label || "").localeCompare(b.seat_label || "", undefined, { numeric: true });
          });

          let maxSeatInRow = 0;
          let minSeatInRow = Infinity;
          seatsInRow.forEach((s) => {
            const num = parseInt(String(s.seat_label).replace(/\D/g, ""), 10);
            if (!isNaN(num) && num > 0) {
              if (num > maxSeatInRow) maxSeatInRow = num;
              if (num < minSeatInRow) minSeatInRow = num;
            }
          });
          if (minSeatInRow === Infinity) minSeatInRow = 1;

          const rowOverrideCount =
            tierObj?.row_seat_overrides?.[rKey] || (selectedBlock as any)?.row_seat_overrides?.[rKey];
          const baseSeats = tierObj?.seats_per_row || selectedBlock.seats_per_row || 0;
          const totalRowSlots = Math.max(
            1,
            rowOverrideCount || 0,
            baseSeats,
            maxSeatInRow - minSeatInRow + 1,
            seatsInRow.length
          );

          seatsInRow.forEach((seat, seatIdx) => {
            const parsedNum = parseInt(String(seat.seat_label).replace(/\D/g, ""), 10);
            const slotIndex =
              !isNaN(parsedNum) && parsedNum >= minSeatInRow
                ? parsedNum - minSeatInRow
                : seatIdx;

            const colFraction = (slotIndex + 0.5) / totalRowSlots;
            const localX = padX + colFraction * usableW;
            const localY = tierY + padY + rowFraction * usableH;

            const dx = localX - bw / 2;
            const dy = localY - bh / 2;
            const posX = centerX + dx * cosRot - dy * sinRot;
            const posY = centerY + dx * sinRot + dy * cosRot;

            results.push({ ...seat, posX, posY, rotation: rotationDeg });
          });
        });
      }
    });

    return results;
  }, [selectedBlock, blockSeats, activeTierId, canvasWidth, canvasHeight]);

  // Dynamic seat radius per row so dense rows (e.g. 40 seats in Row A) never shrink other rows
  const { rowSeatRadii, dynamicSeatRadius } = useMemo(() => {
    const map = new Map<string, number>();
    if (!selectedBlock || renderedSeats.length === 0) {
      return { rowSeatRadii: map, dynamicSeatRadius: 6.0 };
    }

    const rowMap = new Map<string, Array<{ posX: number; posY: number }>>();
    renderedSeats.forEach((s) => {
      const r = s.row_label || "A";
      if (!rowMap.has(r)) rowMap.set(r, []);
      rowMap.get(r)!.push({ posX: s.posX, posY: s.posY });
    });

    let overallMinDist = Infinity;
    rowMap.forEach((seats, rLabel) => {
      if (seats.length < 2) {
        map.set(rLabel, 6.5);
        return;
      }
      let minDist = Infinity;
      for (let i = 0; i < seats.length - 1; i++) {
        const d = Math.hypot(seats[i + 1].posX - seats[i].posX, seats[i + 1].posY - seats[i].posY);
        if (d > 2 && d < minDist) minDist = d;
      }
      if (minDist !== Infinity && minDist < overallMinDist) {
        overallMinDist = minDist;
      }
      // Guarantee comfortable 20% air margin between adjacent seats in this specific row
      const r = Math.max(3.8, Math.min(9.5, minDist * 0.40));
      map.set(rLabel, r);
    });

    const defaultRadius = overallMinDist !== Infinity ? Math.max(4.0, Math.min(8.5, overallMinDist * 0.38)) : 6.0;
    return { rowSeatRadii: map, dynamicSeatRadius: defaultRadius };
  }, [selectedBlock, renderedSeats]);

  // ── Compute Visual Walkways (Horizontal Row Walkways from backend/database only) ──
  const visualWalkways = useMemo(() => {
    if (!selectedBlock || renderedSeats.length === 0) return { rowWalkways: [] };

    const rowMap = new Map<string, typeof renderedSeats>();
    renderedSeats.forEach((s) => {
      const r = s.row_label || "A";
      if (!rowMap.has(r)) rowMap.set(r, []);
      rowMap.get(r)!.push(s);
    });

    const rowWalkways: Array<{
      id: string;
      rowBefore: string;
      rowAfter: string;
      pathPoints?: number[];
      arcProps?: {
        cx: number;
        cy: number;
        radius: number;
        startAngle: number;
        endAngle: number;
      };
      centerPos: { x: number; y: number };
      label: string;
    }> = [];

    const rawGaps: string[] =
      (selectedBlock as any).row_gaps ||
      (activeTierId ? (selectedBlock.tiers?.find((t) => t.tier_id === activeTierId) as any)?.row_gaps : null) ||
      [];

    const sortedRows = Array.from(rowMap.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );

    // Only show walkways that are explicitly configured in the backend/database
    const effectiveGaps = rawGaps.filter(
      (rLabel) => sortedRows.indexOf(rLabel) >= 0 && sortedRows.indexOf(rLabel) < sortedRows.length - 1
    );

    effectiveGaps.forEach((rLabel) => {
      const rIdx = sortedRows.indexOf(rLabel);
      if (rIdx >= 0 && rIdx < sortedRows.length - 1) {
        const nextLabel = sortedRows[rIdx + 1];
        const rowSeatsA = rowMap.get(rLabel)!;
        const rowSeatsB = rowMap.get(nextLabel)!;
        if (rowSeatsA.length > 0 && rowSeatsB.length > 0) {
          const midA = rowSeatsA[Math.floor(rowSeatsA.length / 2)];
          const midB = rowSeatsB[Math.floor(rowSeatsB.length / 2)];
          const centerPos = {
            x: (midA.posX + midB.posX) / 2,
            y: (midA.posY + midB.posY) / 2,
          };

          if (selectedBlock.shape === "arc") {
            const sCX = selectedBlock.stadiumCenterX != null ? Number(selectedBlock.stadiumCenterX) : canvasWidth / 2;
            const sCY = selectedBlock.stadiumCenterY != null ? Number(selectedBlock.stadiumCenterY) : canvasHeight / 2;
            const distA = Math.hypot(midA.posX - sCX, midA.posY - sCY);
            const distB = Math.hypot(midB.posX - sCX, midB.posY - sCY);
            const midR = (distA + distB) / 2;
            const startA = Number(selectedBlock.startAngle) || 0;
            const sweepA = Number(selectedBlock.sweepAngle) || 45;
            rowWalkways.push({
              id: `row-walkway-${rLabel}`,
              rowBefore: rLabel,
              rowAfter: nextLabel,
              arcProps: {
                cx: sCX,
                cy: sCY,
                radius: midR,
                startAngle: startA,
                endAngle: startA + sweepA,
              },
              centerPos,
              label: "WALKWAY",
            });
          } else {
            const firstA = rowSeatsA[0];
            const firstB = rowSeatsB[0];
            const lastA = rowSeatsA[rowSeatsA.length - 1];
            const lastB = rowSeatsB[rowSeatsB.length - 1];
            const p1 = { x: (firstA.posX + firstB.posX) / 2, y: (firstA.posY + firstB.posY) / 2 };
            const p2 = { x: (lastA.posX + lastB.posX) / 2, y: (lastA.posY + lastB.posY) / 2 };
            rowWalkways.push({
              id: `row-walkway-${rLabel}`,
              rowBefore: rLabel,
              rowAfter: nextLabel,
              pathPoints: [p1.x, p1.y, p2.x, p2.y],
              centerPos,
              label: "WALKWAY",
            });
          }
        }
      }
    });

    return { rowWalkways };
  }, [selectedBlock, renderedSeats, activeTierId, canvasWidth, canvasHeight]);

  // Row letter badges along both sides — strictly clamped radius so rows NEVER collide
  const rowMarkers = useMemo(() => {
    if (!selectedBlock || renderedSeats.length === 0) return [];
    const map = new Map<string, Array<{ posX: number; posY: number }>>();
    renderedSeats.forEach((s) => {
      const r = s.row_label || "A";
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push({ posX: s.posX, posY: s.posY });
    });

    const isArc = selectedBlock.shape === "arc";
    const sCX = selectedBlock.stadiumCenterX != null ? Number(selectedBlock.stadiumCenterX) : canvasWidth / 2;
    const sCY = selectedBlock.stadiumCenterY != null ? Number(selectedBlock.stadiumCenterY) : canvasHeight / 2;

    const markers: Array<{ label: string; x: number; y: number; radius: number }> = [];

    map.forEach((pts, rLabel) => {
      if (pts.length === 0) return;
      const rowR = rowSeatRadii.get(rLabel) || dynamicSeatRadius;

      if (isArc) {
        let firstSeat = pts[0];
        let lastSeat = pts[0];
        let minAngle = Infinity;
        let maxAngle = -Infinity;
        pts.forEach((p) => {
          let a = Math.atan2(p.posY - sCY, p.posX - sCX);
          if (a < 0) a += Math.PI * 2;
          if (a < minAngle) {
            minAngle = a;
            firstSeat = p;
          }
          if (a > maxAngle) {
            maxAngle = a;
            lastSeat = p;
          }
        });
        const r1 = Math.hypot(firstSeat.posX - sCX, firstSeat.posY - sCY);
        const a1 = Math.atan2(firstSeat.posY - sCY, firstSeat.posX - sCX);
        const angStep1 = (rowR * 2.8) / Math.max(r1, 1);
        markers.push({
          label: rLabel,
          x: sCX + r1 * Math.cos(a1 - angStep1),
          y: sCY + r1 * Math.sin(a1 - angStep1),
          radius: Math.max(4.5, Math.min(8.0, rowR * 1.1)),
        });

        if (pts.length > 3) {
          const r2 = Math.hypot(lastSeat.posX - sCX, lastSeat.posY - sCY);
          const a2 = Math.atan2(lastSeat.posY - sCY, lastSeat.posX - sCX);
          const angStep2 = (rowR * 2.8) / Math.max(r2, 1);
          markers.push({
            label: rLabel,
            x: sCX + r2 * Math.cos(a2 + angStep2),
            y: sCY + r2 * Math.sin(a2 + angStep2),
            radius: Math.max(4.5, Math.min(8.0, rowR * 1.1)),
          });
        }
      } else {
        const rotDeg = Number(selectedBlock.rotation) || 0;
        const rotRad = (rotDeg * Math.PI) / 180;
        const cosRot = Math.cos(rotRad);
        const sinRot = Math.sin(rotRad);
        let left = pts[0];
        let right = pts[0];
        let minProj = Infinity;
        let maxProj = -Infinity;
        pts.forEach((p) => {
          const proj = p.posX * cosRot + p.posY * sinRot;
          if (proj < minProj) {
            minProj = proj;
            left = p;
          }
          if (proj > maxProj) {
            maxProj = proj;
            right = p;
          }
        });
        markers.push({
          label: rLabel,
          x: left.posX - (rowR * 2.8) * cosRot,
          y: left.posY - (rowR * 2.8) * sinRot,
          radius: Math.max(4.5, Math.min(8.0, rowR * 1.1)),
        });

        if (pts.length > 3) {
          markers.push({
            label: rLabel,
            x: right.posX + (rowR * 2.8) * cosRot,
            y: right.posY + (rowR * 2.8) * sinRot,
            radius: Math.max(4.5, Math.min(8.0, rowR * 1.1)),
          });
        }
      }
    });

    return markers;
  }, [selectedBlock, renderedSeats, canvasWidth, canvasHeight, rowSeatRadii, dynamicSeatRadius]);

  // Available row labels in natural alphabetical/numeric order
  const availableRows = useMemo(() => {
    if (!renderedSeats || renderedSeats.length === 0) return [];
    const set = new Set<string>();
    renderedSeats.forEach((s) => {
      if (s.row_label) set.add(s.row_label);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [renderedSeats]);

  // Zoom directly into a specific row (e.g. A, B, C...)
  const zoomToRow = useCallback(
    (rowLabel: string | null) => {
      if (!stageRef.current || !selectedBlock) return;
      if (!rowLabel) {
        setSelectedRow(null);
        handleBlockClick(selectedBlock, activeTierId || undefined);
        return;
      }

      const rowSeats = renderedSeats.filter((s) => s.row_label === rowLabel);
      if (rowSeats.length === 0) return;

      setSelectedRow(rowLabel);

      const xs = rowSeats.map((s) => s.posX);
      const ys = rowSeats.map((s) => s.posY);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const width = Math.max(30, maxX - minX);
      const height = Math.max(20, maxY - minY);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      const scaleX = (containerSize.width * 0.82) / width;
      const scaleY = (containerSize.height * 0.44) / height;
      const targetScale = Math.max(2.8, Math.min(8.5, Math.min(scaleX, scaleY)));

      const newX = containerSize.width / 2 - centerX * targetScale;
      const newY = containerSize.height / 2 - centerY * targetScale;

      setZoomScale(targetScale);
      setStagePos({ x: newX, y: newY });
      stageRef.current.to({
        x: newX,
        y: newY,
        scaleX: targetScale,
        scaleY: targetScale,
        duration: 0.45,
        easing: Konva.Easings.EaseInOut,
      });
    },
    [renderedSeats, selectedBlock, containerSize, handleBlockClick, activeTierId]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full min-h-[320px] bg-[#F8FAFC] text-slate-700">
        <Loader2 className="w-9 h-9 text-[#6900AA] animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading stadium map…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full min-h-[320px] bg-[#F8FAFC] text-slate-700">
        <AlertCircle className="w-9 h-9 text-rose-500" />
        <p className="text-sm font-medium text-slate-500">Unable to load stadium layout.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#F8FAFC] text-slate-900 overflow-hidden relative select-none">
      {/* Compact chrome — keep map height maximized */}
      <div className="shrink-0 z-20 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 px-2.5 sm:px-3 py-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {selectedBlockId ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  onClick={handleBackToStadium}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#6900AA] hover:bg-[#7a00c6] text-white text-[11px] font-bold transition-all active:scale-95 shrink-0"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Stands</span>
                </button>
                {selectedBlock && (
                  <div className="flex items-center gap-1.5 text-[11px] min-w-0">
                    <span className="font-bold text-slate-800 truncate">{selectedBlock.name}</span>
                    {selectedBlock.tiers && selectedBlock.tiers.length > 1 ? (
                      <div className="flex items-center gap-1 ml-1 bg-slate-100 p-0.5 rounded-full border border-slate-200 shrink-0">
                        {selectedBlock.tiers.map((t) => {
                          const isTierActive = activeTierId === t.tier_id;
                          return (
                            <button
                              key={t.tier_id}
                              type="button"
                              onClick={() => handleTierSelect(t.tier_id)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${isTierActive
                                ? "bg-[#6900AA] text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                                }`}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    ) : activeTier ? (
                      <span className="text-[10px] font-extrabold text-[#6900AA] bg-[#F7E9FF] px-2 py-0.5 rounded-full border border-[#E3BCFF] shrink-0">
                        {activeTier.name}
                      </span>
                    ) : null}
                    {seatsPending && <Loader2 className="w-3 h-3 text-[#6900AA] animate-spin shrink-0" />}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#6900AA] bg-[#F7E9FF] px-1.5 py-0.5 rounded border border-[#E3BCFF] shrink-0">
                  Stadium
                </span>
                <h2 className="text-[0.8125rem] sm:text-[0.875rem] font-semibold text-gray-800 truncate">
                  {data.stadium_name || "Stadium Ground"}
                </h2>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* BMS Standard Legend */}
            <div className="hidden md:flex items-center gap-2.5 text-[10px] font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#16A34A]" />
                Available
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6900AA]" />
                Selected
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E2E8F0] border border-[#CBD5E1]" />
                Sold Out
              </span>
              {visualWalkways.rowWalkways.length > 0 && (
                <span className="flex items-center gap-1 text-purple-700">
                  <span className="w-3 h-0.5 border-b border-dashed border-purple-500" />
                  Walkway
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Row letters — single slim scroll strip */}
        {selectedBlock && availableRows.length > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 pb-1.5 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
            <span className="text-[11px] font-bold text-[#6900AA] shrink-0">Row</span>
            <button
              type="button"
              onClick={() => zoomToRow(null)}
              className={`h-7 px-2.5 rounded-md text-[11px] font-bold transition-all border shrink-0 ${selectedRow === null
                ? "bg-[#6900AA] text-white border-[#6900AA]"
                : "bg-white text-slate-600 border-slate-200 hover:border-[#6900AA]/40"
                }`}
            >
              All
            </button>
            {availableRows.map((r) => {
              const isSelected = selectedRow === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => zoomToRow(isSelected ? null : r)}
                  className={`h-7 min-w-7 px-1.5 rounded-md flex items-center justify-center text-[12px] font-extrabold transition-all border shrink-0 ${isSelected
                    ? "bg-[#6900AA] text-white border-[#6900AA]"
                    : "bg-white text-slate-700 border-slate-200 hover:border-[#6900AA]/50 hover:text-[#6900AA]"
                    }`}
                  title={`Focus row ${r}`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        )}

        {selectedBlock && selectedBlock.tiers.length > 1 && !showTierPicker && (
          <div className="flex items-center gap-1 px-2.5 sm:px-3 pb-1.5 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setActiveTierId(null)}
              className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border ${activeTierId === null
                ? "bg-[#6900AA] text-white border-[#6900AA]"
                : "bg-white text-slate-600 border-slate-200"
                }`}
            >
              All tiers
            </button>
            {selectedBlock.tiers.map((t, tIdx) => {
              const tierColor = t.color || (tIdx === 0 ? "#f59e0b" : "#10b981");
              return (
                <button
                  key={t.tier_id}
                  onClick={() => setActiveTierId(t.tier_id)}
                  className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 border ${activeTierId === t.tier_id
                    ? "bg-[#6900AA] text-white border-[#6900AA]"
                    : "bg-white text-slate-600 border-slate-200 hover:text-slate-900"
                    }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tierColor }} />
                  {t.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Stands list — vertical column on the left */}
        {!selectedBlockId && data.blocks.length > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 pb-2 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setSelectedCategoryFilter(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold border transition-all whitespace-nowrap ${selectedCategoryFilter === null
                ? "bg-[#6900AA] text-white border-[#6900AA] shadow-sm"
                : "bg-white text-slate-600 border-slate-200 hover:border-[#6900AA]/40 hover:text-slate-900"
                }`}
            >
              All stands
            </button>
            {data.blocks.map((block) => {
              const isSoldOut = block.available === 0 && block.total > 0;
              const minPrice = getBlockMinPrice(block);
              const isActive = selectedCategoryFilter != null && block.tiers.some((t) => t.ticket_type_id === selectedCategoryFilter);
              return (
                <button
                  key={block.block_id}
                  onClick={() => {
                    const matchingTier = selectedCategoryFilter
                      ? block.tiers.find((t) => t.ticket_type_id === selectedCategoryFilter)
                      : null;
                    setSelectedCategoryFilter(block.ticket_type_id ?? block.tiers[0]?.ticket_type_id ?? null);
                    if (!isSoldOut) handleBlockClick(block, matchingTier?.tier_id);
                  }}
                  disabled={isSoldOut}
                  title={isSoldOut ? `${block.name} — Sold Out` : `Open ${block.name}`}
                  className={`shrink-0 px-3 py-1.5 rounded-xl border transition-all text-left whitespace-nowrap ${isSoldOut
                    ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                    : isActive
                      ? "bg-[#F7E9FF] border-[#6900AA]/40 text-slate-900"
                      : "bg-white border-slate-200 text-slate-700 hover:border-[#6900AA]/40"
                    }`}
                >
                  <span className="block text-[12px] font-extrabold leading-tight truncate max-w-[160px]">
                    {block.stand_type === "standing" ? `🧍 ${block.name}` : block.name}
                  </span>
                  <span className="block text-[11px] text-[#6900AA] font-semibold leading-tight mt-0.5">
                    {isSoldOut ? "Sold out" : minPrice !== null ? `From ETB ${minPrice.toLocaleString()}` : `${block.available} ${block.stand_type === "standing" ? "passes" : "left"}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {selectedBlock && selectedBlock.tiers.length > 1 && !showTierPicker && (
          <div className="flex items-center gap-1 px-2.5 sm:px-3 pb-1.5 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setActiveTierId(null)}
              className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all border ${activeTierId === null
                ? "bg-[#6900AA] text-white border-[#6900AA]"
                : "bg-white text-slate-600 border-slate-200"
                }`}
            >
              All tiers
            </button>
            {selectedBlock.tiers.map((t, tIdx) => {
              const tierColor = t.color || (tIdx === 0 ? "#f59e0b" : "#10b981");
              return (
                <button
                  key={t.tier_id}
                  onClick={() => setActiveTierId(t.tier_id)}
                  className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 border ${activeTierId === t.tier_id
                    ? "bg-[#6900AA] text-white border-[#6900AA]"
                    : "bg-white text-slate-600 border-slate-200 hover:text-slate-900"
                    }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tierColor }} />
                  {t.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Interactive Konva Canvas (Zoomable Pitch + Stands + Seats) ── */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 w-full bg-[#EEF2F7] relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <Stage
          ref={stageRef}
          width={containerSize.width}
          height={containerSize.height}
          scaleX={activeZoomScale}
          scaleY={activeZoomScale}
          x={activeStagePos.x}
          y={activeStagePos.y}
          draggable
          onWheel={handleWheel}
          onDragEnd={(e) => {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }}
        >
          {/* 1. Background Turf Layer */}
          <Layer>
            {/* Outer concourse — light theme */}
            <Rect
              x={0}
              y={0}
              width={canvasWidth}
              height={canvasHeight}
              fill="#E8EEF5"
              perfectDrawEnabled={false}
            />

            {/* ── Ground / Pitch Section (Positioned, Sized & Rotated from Admin) ── */}
            <Group
              x={pitchX + pitchW / 2}
              y={pitchY + pitchH / 2}
              offsetX={pitchW / 2}
              offsetY={pitchH / 2}
              rotation={pitchRot}
              opacity={selectedBlockId ? 0.55 : 1}
              listening={!selectedBlockId}
            >
              {/* Running Track / Arena Surround */}
              <Rect
                x={-50}
                y={-50}
                width={pitchW + 100}
                height={pitchH + 100}
                fill={
                  (data as any)?.ground?.track_color ||
                  ((data as any)?.ground?.sport_type === "cricket"
                    ? "#052e16"
                    : (data as any)?.ground?.sport_type === "basketball"
                      ? "#0f172a"
                      : (data as any)?.ground?.sport_type === "tennis"
                        ? "#0c4a6e"
                        : (data as any)?.ground?.sport_type === "concert"
                          ? "#030712"
                          : "#7f1d1d")
                }
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1.5}
                cornerRadius={(data as any)?.ground?.sport_type === "cricket" ? (pitchW + 100) / 2 : 40}
                perfectDrawEnabled={false}
              />

              {/* ── Dynamic Sports Ground Pitch / Field ── */}
              {((data as any)?.ground?.sport_type === "cricket") ? (
                // 🏏 1. CRICKET GROUND OVAL
                <>
                  <Ellipse
                    x={pitchW / 2}
                    y={pitchH / 2}
                    radiusX={pitchW * 0.48}
                    radiusY={pitchH * 0.48}
                    fill={(data as any)?.ground?.turf_color || "#15803d"}
                    stroke="#ffffff"
                    strokeWidth={3}
                    perfectDrawEnabled={false}
                  />
                  <Circle
                    x={pitchW / 2}
                    y={pitchH / 2}
                    radius={pitchH * 0.28}
                    stroke="#ffffff"
                    strokeWidth={2}
                    dash={[8, 8]}
                    perfectDrawEnabled={false}
                  />
                  <Rect
                    x={pitchW / 2 - 25}
                    y={pitchH / 2 - 80}
                    width={50}
                    height={160}
                    fill="#ca8a04"
                    stroke="#a16207"
                    strokeWidth={2}
                    cornerRadius={4}
                    perfectDrawEnabled={false}
                  />
                  <Line
                    points={[pitchW / 2 - 25, pitchH / 2 - 60, pitchW / 2 + 25, pitchH / 2 - 60]}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                  <Line
                    points={[pitchW / 2 - 25, pitchH / 2 + 60, pitchW / 2 + 25, pitchH / 2 + 60]}
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                  <Circle x={pitchW / 2} y={pitchH / 2 - 68} radius={3} fill="#ffffff" />
                  <Circle x={pitchW / 2} y={pitchH / 2 + 68} radius={3} fill="#ffffff" />
                </>
              ) : ((data as any)?.ground?.sport_type === "basketball") ? (
                // 🏀 2. BASKETBALL ARENA COURT
                <>
                  <Rect
                    x={0}
                    y={0}
                    width={pitchW}
                    height={pitchH}
                    fill={(data as any)?.ground?.turf_color || "#b45309"}
                    stroke="#f59e0b"
                    strokeWidth={4}
                    cornerRadius={12}
                  />
                  {Array.from({ length: 12 }).map((_, i) => (
                    <Line
                      key={`bb-plank-${i}`}
                      points={[0, (i * pitchH) / 12, pitchW, (i * pitchH) / 12]}
                      stroke="rgba(0,0,0,0.08)"
                      strokeWidth={1}
                    />
                  ))}
                  <Line
                    points={[0, pitchH / 2, pitchW, pitchH / 2]}
                    stroke="#ffffff"
                    strokeWidth={3}
                  />
                  <Circle
                    x={pitchW / 2}
                    y={pitchH / 2}
                    radius={pitchH * 0.18}
                    stroke="#ffffff"
                    strokeWidth={3}
                  />
                  <Rect
                    x={pitchW * 0.35}
                    y={0}
                    width={pitchW * 0.3}
                    height={pitchH * 0.25}
                    fill="rgba(255,255,255,0.1)"
                    stroke="#ffffff"
                    strokeWidth={3}
                  />
                  <Circle
                    x={pitchW / 2}
                    y={pitchH * 0.25}
                    radius={pitchW * 0.12}
                    stroke="#ffffff"
                    strokeWidth={2}
                    dash={[6, 6]}
                  />
                  <Rect
                    x={pitchW * 0.35}
                    y={pitchH - pitchH * 0.25}
                    width={pitchW * 0.3}
                    height={pitchH * 0.25}
                    fill="rgba(255,255,255,0.1)"
                    stroke="#ffffff"
                    strokeWidth={3}
                  />
                  <Circle
                    x={pitchW / 2}
                    y={pitchH - pitchH * 0.25}
                    radius={pitchW * 0.12}
                    stroke="#ffffff"
                    strokeWidth={2}
                    dash={[6, 6]}
                  />
                  <Circle x={pitchW / 2} y={20} radius={10} stroke="#ea580c" strokeWidth={3} />
                  <Circle x={pitchW / 2} y={pitchH - 20} radius={10} stroke="#ea580c" strokeWidth={3} />
                </>
              ) : ((data as any)?.ground?.sport_type === "tennis") ? (
                // 🎾 3. TENNIS COURT
                <>
                  <Rect
                    x={0}
                    y={0}
                    width={pitchW}
                    height={pitchH}
                    fill={(data as any)?.ground?.turf_color || "#1d4ed8"}
                    stroke="#ffffff"
                    strokeWidth={4}
                    cornerRadius={8}
                  />
                  <Rect
                    x={45}
                    y={35}
                    width={pitchW - 90}
                    height={pitchH - 70}
                    stroke="#ffffff"
                    strokeWidth={3}
                  />
                  <Line points={[110, 35, 110, pitchH - 35]} stroke="#ffffff" strokeWidth={2.5} />
                  <Line points={[pitchW - 110, 35, pitchW - 110, pitchH - 35]} stroke="#ffffff" strokeWidth={2.5} />
                  <Line points={[110, pitchH * 0.28, pitchW - 110, pitchH * 0.28]} stroke="#ffffff" strokeWidth={2.5} />
                  <Line points={[110, pitchH * 0.72, pitchW - 110, pitchH * 0.72]} stroke="#ffffff" strokeWidth={2.5} />
                  <Line points={[pitchW / 2, pitchH * 0.28, pitchW / 2, pitchH * 0.72]} stroke="#ffffff" strokeWidth={2.5} />
                  <Line points={[30, pitchH / 2, pitchW - 30, pitchH / 2]} stroke="#ffffff" strokeWidth={5} />
                  <Circle x={30} y={pitchH / 2} radius={6} fill="#f59e0b" />
                  <Circle x={pitchW - 30} y={pitchH / 2} radius={6} fill="#f59e0b" />
                </>
              ) : ((data as any)?.ground?.sport_type === "concert") ? (
                // 🎤 4. CONCERT ARENA & STAGE
                <>
                  <Rect
                    x={0}
                    y={0}
                    width={pitchW}
                    height={pitchH}
                    fill={(data as any)?.ground?.turf_color || "#18181b"}
                    stroke="#7c3aed"
                    strokeWidth={3}
                    cornerRadius={16}
                  />
                  <Rect
                    x={pitchW * 0.2}
                    y={20}
                    width={pitchW * 0.6}
                    height={110}
                    fill="#6b21a8"
                    stroke="#c084fc"
                    strokeWidth={3}
                    cornerRadius={12}
                    shadowColor="#a855f7"
                    shadowBlur={20}
                  />
                  <Text
                    text="🎤 MAIN STAGE"
                    x={pitchW * 0.2}
                    y={55}
                    width={pitchW * 0.6}
                    align="center"
                    fontSize={20}
                    fontStyle="bold"
                    fill="#ffffff"
                  />
                  <Rect x={pitchW * 0.12} y={30} width={40} height={90} fill="#1e1b4b" stroke="#818cf8" strokeWidth={2} cornerRadius={6} />
                  <Rect x={pitchW * 0.88 - 40} y={30} width={40} height={90} fill="#1e1b4b" stroke="#818cf8" strokeWidth={2} cornerRadius={6} />
                  <Line
                    points={[pitchW * 0.15, 160, pitchW * 0.85, 160]}
                    stroke="#fbbf24"
                    strokeWidth={3}
                    dash={[10, 6]}
                  />
                  <Text
                    text="GOLDEN CIRCLE / VIP FAN PIT"
                    x={0}
                    y={170}
                    width={pitchW}
                    align="center"
                    fontSize={13}
                    fontStyle="bold"
                    fill="#fbbf24"
                  />
                  <Rect
                    x={pitchW / 2 - 70}
                    y={pitchH * 0.65}
                    width={140}
                    height={65}
                    fill="#09090b"
                    stroke="#64748b"
                    strokeWidth={2}
                    cornerRadius={8}
                  />
                  <Text
                    text="🎛️ FOH SOUND & LIGHTS"
                    x={pitchW / 2 - 70}
                    y={pitchH * 0.65 + 24}
                    width={140}
                    align="center"
                    fontSize={10}
                    fontStyle="bold"
                    fill="#94a3b8"
                  />
                </>
              ) : ((data as any)?.ground?.sport_type === "custom") ? (
                // 🔲 5. CUSTOM / MULTI-PURPOSE PITCH
                <>
                  <Rect
                    x={0}
                    y={0}
                    width={pitchW}
                    height={pitchH}
                    fill={(data as any)?.ground?.turf_color || "#334155"}
                    stroke="#ffffff"
                    strokeWidth={3}
                    cornerRadius={14}
                  />
                  <Line points={[0, pitchH / 2, pitchW, pitchH / 2]} stroke="#ffffff" strokeWidth={2} />
                  <Circle x={pitchW / 2} y={pitchH / 2} radius={pitchH * 0.2} stroke="#ffffff" strokeWidth={2} />
                </>
              ) : (
                // ⚽ 6. FOOTBALL / SOCCER PITCH (Default)
                <>
                  <Rect
                    x={0}
                    y={0}
                    width={pitchW}
                    height={pitchH}
                    fill={(data as any)?.ground?.turf_color || "#14532d"}
                    stroke="#22c55e"
                    strokeWidth={4}
                    cornerRadius={20}
                    shadowColor="#000000"
                    shadowBlur={30}
                    shadowOpacity={0.6}
                    perfectDrawEnabled={false}
                  />

                  {Array.from({ length: 8 }).map((_, idx) => {
                    const stripeH = pitchH / 8;
                    return (
                      <Rect
                        key={`stripe-${idx}`}
                        x={0}
                        y={idx * stripeH}
                        width={pitchW}
                        height={stripeH}
                        fill={idx % 2 === 0 ? "#15803d" : "#166534"}
                        opacity={0.35}
                        listening={false}
                        perfectDrawEnabled={false}
                      />
                    );
                  })}

                  <Rect
                    x={25}
                    y={25}
                    width={pitchW - 50}
                    height={pitchH - 50}
                    fill="transparent"
                    stroke="#ffffff"
                    strokeWidth={2}
                    opacity={0.7}
                    listening={false}
                    perfectDrawEnabled={false}
                  />

                  <Line
                    points={[25, pitchH / 2, pitchW - 25, pitchH / 2]}
                    stroke="#ffffff"
                    strokeWidth={2}
                    opacity={0.7}
                    listening={false}
                  />

                  <Circle
                    x={pitchW / 2}
                    y={pitchH / 2}
                    radius={pitchH * 0.16}
                    stroke="#ffffff"
                    strokeWidth={2}
                    opacity={0.7}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                  <Circle
                    x={pitchW / 2}
                    y={pitchH / 2}
                    radius={5}
                    fill="#ffffff"
                    opacity={0.9}
                    listening={false}
                    perfectDrawEnabled={false}
                  />

                  <Rect
                    x={pitchW * 0.3}
                    y={25}
                    width={pitchW * 0.4}
                    height={pitchH * 0.18}
                    stroke="#ffffff"
                    strokeWidth={2}
                    opacity={0.7}
                    listening={false}
                    perfectDrawEnabled={false}
                  />

                  <Rect
                    x={pitchW * 0.3}
                    y={pitchH - 25 - pitchH * 0.18}
                    width={pitchW * 0.4}
                    height={pitchH * 0.18}
                    stroke="#ffffff"
                    strokeWidth={2}
                    opacity={0.7}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                </>
              )}

              {/* Pitch Label */}
              <Text
                text={(data as any)?.ground?.pitch_label || data.pitch_label || "MAIN PITCH"}
                x={0}
                y={pitchH / 2 - 14}
                width={pitchW}
                align="center"
                fontSize={Math.max(16, Math.min(pitchW, pitchH) * 0.05)}
                fontStyle="bold"
                fill="#ffffff"
                opacity={0.85}
                shadowColor="#000000"
                shadowBlur={10}
                listening={false}
                perfectDrawEnabled={false}
              />
            </Group>

            {/* ── Custom Elements (Stage, Jumbotron Screen, Gates, Lounges) ── */}
            {Array.isArray((data as any)?.elements) &&
              (data as any).elements.map((el: any) => (
                <Group
                  key={el.id}
                  x={el.x + el.width / 2}
                  y={el.y + el.height / 2}
                  offsetX={el.width / 2}
                  offsetY={el.height / 2}
                  rotation={el.rotation || 0}
                >
                  <Rect
                    x={0}
                    y={0}
                    width={el.width}
                    height={el.height}
                    fill={el.color || "#475569"}
                    opacity={0.92}
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth={1.5}
                    cornerRadius={8}
                    shadowColor="#000000"
                    shadowBlur={8}
                  />
                  <Text
                    text={`${el.icon ? `${el.icon} ` : ""}${el.name.toUpperCase()}`}
                    x={4}
                    y={el.height / 2 - 7}
                    width={el.width - 8}
                    align="center"
                    fontSize={Math.max(11, Math.min(el.width, el.height) * 0.22)}
                    fontStyle="bold"
                    fill="#ffffff"
                    shadowColor="#000000"
                    shadowBlur={4}
                    listening={false}
                    wrap="none"
                    ellipsis={true}
                  />
                </Group>
              ))}
          </Layer>

          {/* 2. Stadium Stands Layer (Blocks) */}
          <Layer>
            {data.blocks.map((block) => {
              const isSelected = selectedBlockId === block.block_id;
              const isHovered = hoveredBlockId === block.block_id;
              const isSoldOut = block.available === 0 && block.total > 0;
              const minPrice = getBlockMinPrice(block);
              const isStanding = block.stand_type === "standing";

              const cx = block.x + block.width / 2;
              const cy = block.y + block.height / 2;

              // If a category filter is applied, dim non-matching blocks
              const isCategoryMatch =
                !selectedCategoryFilter ||
                (isStanding && block.ticket_type_id === selectedCategoryFilter) ||
                block.tiers.some((t) => t.ticket_type_id === selectedCategoryFilter);

              if (block.shape === "arc") {
                const sCenterX = block.stadiumCenterX ?? canvasWidth / 2;
                const sCenterY = block.stadiumCenterY ?? canvasHeight / 2;
                const innerR = block.innerRadius ?? 260;
                const outerR = block.outerRadius ?? 335;
                const startA = block.startAngle ?? 0;
                const sweepA = block.sweepAngle ?? 45;

                const midAngleDeg = startA + sweepA / 2;
                const midAngleRad = (midAngleDeg * Math.PI) / 180;
                const midRadius = (innerR + outerR) / 2;
                const labelX = sCenterX + Math.cos(midAngleRad) * midRadius;
                const labelY = sCenterY + Math.sin(midAngleRad) * midRadius;

                return (
                  <Group
                    key={block.block_id}
                    opacity={selectedBlockId ? (isSelected ? 1 : 0.5) : (isSoldOut ? 0.35 : isCategoryMatch ? 1 : 0.45)}
                    onMouseEnter={() => {
                      if (!isSoldOut) setHoveredBlockId(block.block_id);
                    }}
                    onMouseLeave={() => setHoveredBlockId(null)}
                    onClick={() => handleBlockClick(block, isSelected ? activeTierId || undefined : undefined)}
                    onTap={() => handleBlockClick(block, isSelected ? activeTierId || undefined : undefined)}
                  >
                    {block.tiers && block.tiers.length > 1 ? (
                      <>
                        {block.tiers.map((tier, tIdx) => {
                          const numTiers = block.tiers.length;
                          const radialSpan = (outerR - innerR) / numTiers;
                          const tierInR = innerR + tIdx * radialSpan;
                          const tierOutR = tierInR + radialSpan;
                          const tierColor = tier.color || (tIdx === 0 ? "#f59e0b" : "#10b981");
                          const isTierSoldOut = tier.available === 0 && tier.total > 0;
                          const midR = (tierInR + tierOutR) / 2;
                          const tierLabelX = sCenterX + Math.cos(midAngleRad) * midR;
                          const tierLabelY = sCenterY + Math.sin(midAngleRad) * midR;
                          const tierPrice = getTierPrice(tier);

                          return (
                            <Group
                              key={tier.tier_id || `arc-tier-${tIdx}`}
                              onClick={(e) => {
                                e.cancelBubble = true;
                                if (!isTierSoldOut) {
                                  handleBlockClick(block, tier.tier_id);
                                }
                              }}
                              onTap={(e) => {
                                e.cancelBubble = true;
                                if (!isTierSoldOut) {
                                  handleBlockClick(block, tier.tier_id);
                                }
                              }}
                            >
                              <Arc
                                x={sCenterX}
                                y={sCenterY}
                                innerRadius={tierInR}
                                outerRadius={tierOutR}
                                angle={sweepA}
                                rotation={startA}
                                fill={
                                  isSelected
                                    ? activeTierId === tier.tier_id
                                      ? "#FAF5FF"
                                      : "#F1F5F9"
                                    : isTierSoldOut
                                      ? "#94A3B8"
                                      : tierColor
                                }
                                opacity={
                                  isSelected
                                    ? activeTierId === tier.tier_id
                                      ? 0.96
                                      : 0.35
                                    : 0.95
                                }
                                stroke={
                                  isSelected
                                    ? activeTierId === tier.tier_id
                                      ? "#6900AA"
                                      : "#CBD5E1"
                                    : isHovered
                                      ? "#6900AA"
                                      : "rgba(15,23,42,0.18)"
                                }
                                strokeWidth={
                                  isSelected
                                    ? activeTierId === tier.tier_id
                                      ? 3
                                      : 1
                                    : isHovered
                                      ? 2.5
                                      : 1.25
                                }
                                shadowColor="#0f172a"
                                shadowBlur={isHovered || isSelected ? 10 : 4}
                                shadowOpacity={0.12}
                                perfectDrawEnabled={false}
                              />
                              {!isSelected && (
                                <Group x={tierLabelX} y={tierLabelY}>
                                  <Text
                                    text={tier.name.toUpperCase()}
                                    x={-70}
                                    y={-12}
                                    width={140}
                                    align="center"
                                    fontSize={11}
                                    fontStyle="bold"
                                    fill={isTierSoldOut ? "#94a3b8" : "#ffffff"}
                                    shadowColor="#000000"
                                    shadowBlur={5}
                                    shadowOpacity={0.55}
                                    listening={false}
                                    wrap="none"
                                    ellipsis={true}
                                  />
                                  <Text
                                    text={
                                      tierPriceAndLeftLabel(tier, tierPrice)
                                    }
                                    x={-70}
                                    y={2}
                                    width={140}
                                    align="center"
                                    fontSize={10}
                                    fontStyle="bold"
                                    fill={isTierSoldOut ? "#ef4444" : "#FEF08A"}
                                    shadowColor="#000000"
                                    shadowBlur={4}
                                    listening={false}
                                    wrap="none"
                                    ellipsis={true}
                                  />
                                </Group>
                              )}
                            </Group>
                          );
                        })}
                        {/* Stand Name Header Pill at Arc Centroid */}
                        {!isSelected && (
                          <Group x={labelX} y={labelY}>
                            <Rect
                              x={-72}
                              y={!isSoldOut ? -16 : -12}
                              width={144}
                              height={!isSoldOut ? 36 : 24}
                              cornerRadius={10}
                              fill="#FFFFFF"
                              stroke={isHovered ? "#6900AA" : "#CBD5E1"}
                              strokeWidth={1.25}
                              shadowColor="#0f172a"
                              shadowBlur={6}
                              shadowOpacity={0.16}
                            />
                            <Text
                              text={block.name.toUpperCase()}
                              x={-72}
                              y={!isSoldOut ? -10 : -6}
                              width={144}
                              align="center"
                              fontSize={12}
                              fontStyle="bold"
                              fill="#1F2937"
                              listening={false}
                              wrap="none"
                              ellipsis={true}
                            />
                            {!isSoldOut && (
                              <Text
                                text={standPriceAndLeftLabel(block, minPrice)}
                                x={-72}
                                y={6}
                                width={144}
                                align="center"
                                fontSize={10}
                                fontStyle="bold"
                                fill="#6900AA"
                                listening={false}
                                wrap="none"
                                ellipsis={true}
                              />
                            )}
                          </Group>
                        )}
                      </>
                    ) : (
                      <>
                        <Arc
                          x={sCenterX}
                          y={sCenterY}
                          innerRadius={innerR}
                          outerRadius={outerR}
                          angle={sweepA}
                          rotation={startA}
                          fill={
                            isSelected
                              ? isSoldOut
                                ? "#E2E8F0"
                                : "#F3E8FF"
                              : isSoldOut
                                ? "#94A3B8"
                                : block.color || "#2563eb"
                          }
                          opacity={isSelected ? 0.9 : 0.95}
                          stroke={
                            isSelected
                              ? "#6900AA"
                              : isHovered
                                ? "#6900AA"
                                : isSoldOut
                                  ? "#94A3B8"
                                  : "rgba(15,23,42,0.18)"
                          }
                          strokeWidth={isSelected ? 4 : isHovered ? 3 : 1.5}
                          shadowColor="#0f172a"
                          shadowBlur={isHovered || isSelected ? 12 : 5}
                          shadowOpacity={0.12}
                          perfectDrawEnabled={false}
                        />

                        {!isSelected && (
                          <Group x={labelX} y={labelY}>
                            <Rect
                              x={-80}
                              y={-20}
                              width={160}
                              height={!isSoldOut ? 42 : 26}
                              cornerRadius={10}
                              fill="#FFFFFF"
                              opacity={0.97}
                              stroke={isHovered ? "#6900AA" : "#CBD5E1"}
                              strokeWidth={1.25}
                              shadowColor="#0f172a"
                              shadowBlur={6}
                              shadowOpacity={0.16}
                            />
                            <Text
                              text={isStanding ? `🧍 ${block.name.toUpperCase()}` : block.name.toUpperCase()}
                              x={-80}
                              y={-12}
                              width={160}
                              align="center"
                              fontSize={12}
                              fontStyle="bold"
                              fill={isSoldOut ? "#64748B" : "#1F2937"}
                              listening={false}
                              wrap="none"
                              ellipsis={true}
                            />
                            {!isSoldOut && (
                              <Text
                                text={standPriceAndLeftLabel(block, minPrice)}
                                x={-80}
                                y={6}
                                width={160}
                                align="center"
                                fontSize={10}
                                fontStyle="bold"
                                fill="#6900AA"
                                listening={false}
                                wrap="none"
                                ellipsis={true}
                              />
                            )}
                            {isSoldOut && (
                              <Text
                                text="SOLD OUT"
                                x={-80}
                                y={6}
                                width={160}
                                align="center"
                                fontSize={10}
                                fontStyle="bold"
                                fill="#ef4444"
                                listening={false}
                              />
                            )}
                          </Group>
                        )}
                      </>
                    )}
                  </Group>
                );
              }

              return (
                <Group
                  key={block.block_id}
                  x={cx}
                  y={cy}
                  offsetX={block.width / 2}
                  offsetY={block.height / 2}
                  rotation={block.rotation || 0}
                  opacity={selectedBlockId ? (isSelected ? 1 : 0.5) : (isSoldOut ? 0.35 : isCategoryMatch ? 1 : 0.45)}
                  onMouseEnter={() => {
                    if (!isSoldOut) setHoveredBlockId(block.block_id);
                  }}
                  onMouseLeave={() => setHoveredBlockId(null)}
                  onClick={() => handleBlockClick(block, isSelected ? activeTierId || undefined : undefined)}
                  onTap={() => handleBlockClick(block, isSelected ? activeTierId || undefined : undefined)}
                >
                  {/* Stand Shadow & 3D bevel */}
                  <Rect
                    x={0}
                    y={4}
                    width={block.width}
                    height={block.height}
                    fill="#020617"
                    cornerRadius={12}
                    opacity={0.5}
                    perfectDrawEnabled={false}
                  />

                  {/* Stand Tile Body */}
                  {(block as any).shape === "oval" ? (
                    <Ellipse
                      x={block.width / 2}
                      y={block.height / 2}
                      radiusX={block.width / 2}
                      radiusY={block.height / 2}
                      fill={isSoldOut ? "#334155" : block.color || "#2563eb"}
                      stroke={
                        isSelected
                          ? "#f59e0b"
                          : isHovered
                            ? "#ffffff"
                            : isSoldOut
                              ? "#475569"
                              : "rgba(255,255,255,0.25)"
                      }
                      strokeWidth={isSelected ? 5 : isHovered ? 3.5 : 1.5}
                      shadowColor={isHovered ? "#ffffff" : "#000000"}
                      shadowBlur={isHovered ? 20 : 8}
                      shadowOpacity={isHovered ? 0.8 : 0.3}
                      perfectDrawEnabled={false}
                    />
                  ) : block.tiers && block.tiers.length > 1 ? (
                    // ── Multi-Tier Stand: render divided tier slices with their distinct colors ──
                    <>
                      {/* Stand container background with shadow and selection outline */}
                      <Rect
                        x={0}
                        y={0}
                        width={block.width}
                        height={block.height}
                        fill={isSelected ? "#F8FAFC" : "#F1F5F9"}
                        stroke={
                          isSelected
                            ? "#6900AA"
                            : isHovered
                              ? "#6900AA"
                              : isSoldOut
                                ? "#94A3B8"
                                : "rgba(15,23,42,0.18)"
                        }
                        strokeWidth={isSelected ? 4.5 : isHovered ? 3 : 1.5}
                        cornerRadius={14}
                        shadowColor={isHovered ? "#ffffff" : "#000000"}
                        shadowBlur={isHovered ? 20 : 8}
                        shadowOpacity={isHovered ? 0.8 : 0.3}
                        perfectDrawEnabled={false}
                      />

                      {block.tiers.map((tier, tIdx) => {
                        const numTiers = block.tiers.length;
                        const baseTierH = block.height / numTiers;
                        const tierY = tIdx * baseTierH;
                        const tierH = baseTierH;
                        const tierColor = tier.color || (tIdx === 0 ? "#f59e0b" : "#10b981");
                        const isTierSoldOut = tier.available === 0 && tier.total > 0;
                        const isFirst = tIdx === 0;
                        const isLast = tIdx === numTiers - 1;
                        const assignedPrice = getTierPrice(tier);

                        return (
                          <Group
                            key={tier.tier_id || `tier-slice-${tIdx}`}
                            onClick={(e) => {
                              e.cancelBubble = true;
                              if (!isTierSoldOut) {
                                handleBlockClick(block, tier.tier_id);
                              }
                            }}
                            onTap={(e) => {
                              e.cancelBubble = true;
                              if (!isTierSoldOut) {
                                handleBlockClick(block, tier.tier_id);
                              }
                            }}
                          >
                            <Rect
                              x={0}
                              y={tierY}
                              width={block.width}
                              height={tierH}
                              fill={
                                isSelected
                                  ? activeTierId === tier.tier_id
                                    ? "#FAF5FF"
                                    : "#F1F5F9"
                                  : isTierSoldOut
                                    ? "#94A3B8"
                                    : tierColor
                              }
                              opacity={
                                isSelected
                                  ? activeTierId === tier.tier_id
                                    ? 0.96
                                    : 0.35
                                  : 0.95
                              }
                              stroke={
                                isSelected && activeTierId === tier.tier_id
                                  ? "#6900AA"
                                  : undefined
                              }
                              strokeWidth={isSelected && activeTierId === tier.tier_id ? 2 : 0}
                              cornerRadius={
                                isFirst && isLast
                                  ? 14
                                  : isFirst
                                    ? [14, 14, 0, 0]
                                    : isLast
                                      ? [0, 0, 14, 14]
                                      : 0
                              }
                              perfectDrawEnabled={false}
                            />
                            {tIdx > 0 && !isSelected && (
                              <Line
                                points={[8, tierY, block.width - 8, tierY]}
                                stroke="rgba(255,255,255,0.45)"
                                strokeWidth={1.5}
                                dash={[5, 4]}
                                listening={false}
                                perfectDrawEnabled={false}
                              />
                            )}
                            {/* Tier Name & Seats / Price inside each tier slice when not zoomed in */}
                            {!isSelected && (
                              <>
                                <Text
                                  text={tier.name.toUpperCase()}
                                  x={6}
                                  y={tierY + Math.max(3, tierH * 0.15)}
                                  width={block.width - 12}
                                  align="center"
                                  fontSize={Math.max(12, Math.min(block.width * 0.06, tierH * 0.36))}
                                  fontStyle="bold"
                                  fill={isTierSoldOut ? "#94a3b8" : "#ffffff"}
                                  shadowColor="#000000"
                                  shadowBlur={5}
                                  shadowOpacity={0.55}
                                  listening={false}
                                  wrap="none"
                                  ellipsis={true}
                                  perfectDrawEnabled={false}
                                />
                                <Text
                                  text={tierPriceAndLeftLabel(tier, assignedPrice)}
                                  x={6}
                                  y={tierY + Math.max(18, tierH * 0.55)}
                                  width={block.width - 12}
                                  align="center"
                                  fontSize={Math.max(10, Math.min(block.width * 0.045, tierH * 0.28))}
                                  fontStyle="bold"
                                  fill={isTierSoldOut ? "#ef4444" : "#FEF08A"}
                                  shadowColor="#000000"
                                  shadowBlur={4}
                                  listening={false}
                                  wrap="none"
                                  ellipsis={true}
                                  perfectDrawEnabled={false}
                                />
                              </>
                            )}
                          </Group>
                        );
                      })}

                      {/* Stand Name Header Pill on top */}
                      {!isSelected && (
                        <Group x={block.width / 2} y={-10}>
                          <Rect
                            x={-Math.min(90, block.width * 0.48)}
                            y={-11}
                            width={Math.min(180, block.width * 0.96)}
                            height={22}
                            cornerRadius={11}
                            fill="#FFFFFF"
                            stroke={isHovered ? "#6900AA" : "#CBD5E1"}
                            strokeWidth={1.25}
                            shadowColor="#0f172a"
                            shadowBlur={5}
                            shadowOpacity={0.14}
                          />
                          <Text
                            text={block.name.toUpperCase()}
                            x={-Math.min(90, block.width * 0.48)}
                            y={-5}
                            width={Math.min(180, block.width * 0.96)}
                            align="center"
                            fontSize={12}
                            fontStyle="bold"
                            fill="#1F2937"
                            listening={false}
                            wrap="none"
                            ellipsis={true}
                          />
                        </Group>
                      )}
                    </>
                  ) : (
                    // ── Single-Tier Stand: standard Rect/Pill rendering ──
                    <>
                      <Rect
                        x={0}
                        y={0}
                        width={block.width}
                        height={block.height}
                        fill={
                          isSelected
                            ? isSoldOut
                              ? "#E2E8F0"
                              : "#F3E8FF"
                            : isSoldOut
                              ? "#94A3B8"
                              : block.color || "#2563eb"
                        }
                        opacity={isSelected ? 0.92 : 0.95}
                        stroke={
                          isSelected
                            ? "#6900AA"
                            : isHovered
                              ? "#6900AA"
                              : isSoldOut
                                ? "#94A3B8"
                                : "rgba(15,23,42,0.18)"
                        }
                        strokeWidth={isSelected ? 4 : isHovered ? 3 : 1.5}
                        cornerRadius={
                          (block as any).shape === "pill"
                            ? Math.min(block.width, block.height) / 2
                            : (block as any).shape === "curved"
                              ? [
                                Math.min(block.width, block.height) * 0.45,
                                Math.min(block.width, block.height) * 0.45,
                                12,
                                12,
                              ]
                              : 12
                        }
                        shadowColor="#0f172a"
                        shadowBlur={isHovered || isSelected ? 10 : 4}
                        shadowOpacity={0.12}
                        perfectDrawEnabled={false}
                      />

                      {/* Stand Name & Price Header - Hidden when zoomed in and selected */}
                      {!isSelected && (
                        <>
                          <Text
                            text={isStanding ? `🧍 ${block.name.toUpperCase()}` : block.name.toUpperCase()}
                            x={0}
                            y={Math.max(6, block.height * 0.12)}
                            width={block.width}
                            align="center"
                            fontSize={Math.max(15, Math.min(block.width, block.height) * 0.16)}
                            fontStyle="bold"
                            fill={isSoldOut ? "#94a3b8" : "#ffffff"}
                            shadowColor="#000000"
                            shadowBlur={6}
                            shadowOpacity={0.6}
                            listening={false}
                            wrap="none"
                            ellipsis={true}
                            perfectDrawEnabled={false}
                          />

                          {block.total > 0 && (
                            <Text
                              text={
                                isSoldOut
                                  ? "SOLD OUT"
                                  : isStanding
                                    ? minPrice !== null
                                      ? `ETB ${minPrice.toLocaleString()} · ${block.available} passes`
                                      : `${block.available} passes avail`
                                    : minPrice !== null
                                      ? `ETB ${minPrice.toLocaleString()} · ${block.available} seats`
                                      : `${block.available} seats avail`
                              }
                              x={0}
                              y={Math.max(28, block.height * 0.52)}
                              width={block.width}
                              align="center"
                              fontSize={Math.max(11, Math.min(block.width, block.height) * 0.11)}
                              fontStyle="bold"
                              fill={isSoldOut ? "#ef4444" : "#FEF08A"}
                              shadowColor="#000000"
                              shadowBlur={4}
                              listening={false}
                              perfectDrawEnabled={false}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Click to Zoom In / Pick Passes Hint on Hover */}
                  {isHovered && !selectedBlockId && !isSoldOut && (
                    <Text
                      text={isStanding ? "🧍 Click to Pick Passes" : "🔍 Click to Zoom In"}
                      x={0}
                      y={block.height - 20}
                      width={block.width}
                      align="center"
                      fontSize={11}
                      fontStyle="bold"
                      fill="#ffffff"
                      listening={false}
                      perfectDrawEnabled={false}
                    />
                  )}
                </Group>
              );
            })}
          </Layer>

          {/* 3. Interactive In-Canvas Seats Layer (Block/Tier Zoom Drill-down) */}
          {selectedBlock && selectedBlock.stand_type !== "standing" && renderedSeats.length > 0 && (
            <Layer>
              {/* Row Walkways (horizontal pathways between rows) */}
              {visualWalkways.rowWalkways.map((w) => (
                <Group key={w.id} listening={false}>
                  {w.pathPoints && (
                    <Line
                      points={w.pathPoints}
                      stroke="#A855F7"
                      strokeWidth={2}
                      dash={[6, 4]}
                      opacity={0.65}
                      listening={false}
                    />
                  )}
                  {w.arcProps && (
                    <Arc
                      x={w.arcProps.cx}
                      y={w.arcProps.cy}
                      innerRadius={w.arcProps.radius - 1}
                      outerRadius={w.arcProps.radius + 1}
                      angle={w.arcProps.endAngle - w.arcProps.startAngle}
                      rotation={w.arcProps.startAngle}
                      fill="#A855F7"
                      opacity={0.65}
                      listening={false}
                    />
                  )}
                  {/* Subtle Walkway pill badge */}
                  <Group x={w.centerPos.x} y={w.centerPos.y} listening={false}>
                    <Rect
                      x={-38}
                      y={-7}
                      width={76}
                      height={14}
                      cornerRadius={7}
                      fill="#FAF5FF"
                      stroke="#D8B4FE"
                      strokeWidth={1}
                      opacity={0.9}
                    />
                    <Text
                      text="WALKWAY"
                      x={-38}
                      y={-5}
                      width={76}
                      align="center"
                      fontSize={7.5}
                      fontStyle="bold"
                      fill="#7E22CE"
                      listening={false}
                    />
                  </Group>
                </Group>
              ))}

              {/* In-Canvas Ground / Pitch Orientation Indicator */}
              {(() => {
                const sportType = (data as any)?.ground?.sport_type || "football";
                let pitchText = "⚽ PITCH THIS WAY";
                if (sportType === "cricket") pitchText = "🏏 PITCH THIS WAY";
                else if (sportType === "concert") pitchText = "🎤 STAGE THIS WAY";
                else if (sportType === "basketball") pitchText = "🏀 COURT THIS WAY";

                if (selectedBlock.shape === "arc") {
                  const sCX = selectedBlock.stadiumCenterX != null ? Number(selectedBlock.stadiumCenterX) : canvasWidth / 2;
                  const sCY = selectedBlock.stadiumCenterY != null ? Number(selectedBlock.stadiumCenterY) : canvasHeight / 2;
                  const innerR = Number(selectedBlock.innerRadius) || 260;
                  const startA = Number(selectedBlock.startAngle) || 0;
                  const sweepA = Number(selectedBlock.sweepAngle) || 45;
                  const pitchIndicatorR = Math.max(20, innerR - 16);
                  const midAngleRad = ((startA + sweepA / 2) * Math.PI) / 180;
                  const labelX = sCX + pitchIndicatorR * Math.cos(midAngleRad);
                  const labelY = sCY + pitchIndicatorR * Math.sin(midAngleRad);
                  const rotDeg = startA + sweepA / 2 + 90;

                  return (
                    <Group listening={false}>
                      <Arc
                        x={sCX}
                        y={sCY}
                        innerRadius={pitchIndicatorR - 3}
                        outerRadius={pitchIndicatorR + 3}
                        angle={sweepA * 0.8}
                        rotation={startA + sweepA * 0.1}
                        fill="#10B981"
                        opacity={0.18}
                        stroke="#059669"
                        strokeWidth={1}
                        dash={[4, 4]}
                      />
                      <Group x={labelX} y={labelY} rotation={rotDeg}>
                        <Rect
                          x={-58}
                          y={-8.5}
                          width={116}
                          height={17}
                          cornerRadius={8.5}
                          fill="#ECFDF5"
                          stroke="#059669"
                          strokeWidth={1.2}
                          shadowColor="#0f172a"
                          shadowBlur={4}
                          shadowOpacity={0.15}
                        />
                        <Text
                          text={pitchText}
                          x={-58}
                          y={-4.5}
                          width={116}
                          align="center"
                          fontSize={8}
                          fontStyle="bold"
                          fill="#065F46"
                        />
                      </Group>
                    </Group>
                  );
                } else {
                  const bx = Number(selectedBlock.x) || 0;
                  const by = Number(selectedBlock.y) || 0;
                  const bw = Number(selectedBlock.width) || 120;
                  const bh = Number(selectedBlock.height) || 80;
                  const rotDeg = Number(selectedBlock.rotation) || 0;
                  const rotRad = (rotDeg * Math.PI) / 180;
                  const cx = bx + bw / 2;
                  const cy = by + bh / 2;
                  const topEdgeY = -bh / 2 - 14;
                  const posX = cx - topEdgeY * Math.sin(rotRad);
                  const posY = cy + topEdgeY * Math.cos(rotRad);

                  return (
                    <Group x={posX} y={posY} rotation={rotDeg} listening={false}>
                      <Rect
                        x={-58}
                        y={-8.5}
                        width={116}
                        height={17}
                        cornerRadius={8.5}
                        fill="#ECFDF5"
                        stroke="#059669"
                        strokeWidth={1.2}
                        shadowColor="#0f172a"
                        shadowBlur={4}
                        shadowOpacity={0.15}
                      />
                      <Text
                        text={pitchText}
                        x={-58}
                        y={-4.5}
                        width={116}
                        align="center"
                        fontSize={8}
                        fontStyle="bold"
                        fill="#065F46"
                      />
                    </Group>
                  );
                }
              })()}

              {/* Row letter badges along the side — clicking/tapping toggles row filter */}
              {rowMarkers.map((m) => {
                const isCurrentRow = selectedRow === m.label;
                const markerR = isCurrentRow ? m.radius * 1.15 : m.radius;
                return (
                  <Group
                    key={`row-marker-${m.label}`}
                    x={m.x}
                    y={m.y}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      setSelectedRow((prev) => (prev === m.label ? null : m.label));
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true;
                      setSelectedRow((prev) => (prev === m.label ? null : m.label));
                    }}
                    onMouseEnter={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container) container.style.cursor = "pointer";
                    }}
                    onMouseLeave={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container) container.style.cursor = "default";
                    }}
                  >
                    <Circle
                      radius={markerR}
                      fill={isCurrentRow ? "#6900AA" : "#FFFFFF"}
                      stroke={isCurrentRow ? "#FFFFFF" : "#6900AA"}
                      strokeWidth={1.3}
                      shadowColor="#0f172a"
                      shadowBlur={isCurrentRow ? 6 : 3}
                      shadowOpacity={0.25}
                    />
                    <Text
                      text={m.label}
                      x={-markerR}
                      y={-markerR}
                      width={markerR * 2}
                      height={markerR * 2}
                      align="center"
                      verticalAlign="middle"
                      fontSize={Math.max(6.5, markerR * 0.95)}
                      fontStyle="bold"
                      fill={isCurrentRow ? "#FFFFFF" : "#6900AA"}
                      listening={false}
                    />
                  </Group>
                );
              })}

              {/* Individual Interactive Seats */}
              {renderedSeats.map((seat) => {
                const isSelected = selectedSeats.some((s) => s.id === seat.id);
                const isAvail = seat.status === "AVAILABLE";
                const isHovered = hoveredSeat?.id === seat.id;
                const isInSelectedRow = selectedRow === null || seat.row_label === selectedRow;

                let seatFill = "#FFFFFF"; // Available clean white
                let strokeColor = "#16A34A"; // Crisp green border
                let strokeW = 1.1;
                let textColor = "#15803D"; // Crisp readable green number

                if (!isAvail) {
                  seatFill = "#E2E8F0"; // Booked soft slate
                  strokeColor = "#CBD5E1";
                  strokeW = 0.8;
                  textColor = "#94A3B8";
                } else if (isSelected) {
                  seatFill = "#6900AA"; // Selected brand purple
                  strokeColor = "#FFFFFF";
                  strokeW = 1.5;
                  textColor = "#FFFFFF";
                } else if (isHovered) {
                  seatFill = "#F3E8FF"; // Hover light purple
                  strokeColor = "#6900AA";
                  strokeW = 1.3;
                  textColor = "#6900AA";
                }

                const opacity = isInSelectedRow ? 1 : 0.28;
                const baseR = rowSeatRadii.get(seat.row_label) || dynamicSeatRadius;
                const seatR = isSelected || isHovered ? baseR * 1.15 : baseR;

                return (
                  <Group
                    key={seat.id}
                    x={seat.posX}
                    y={seat.posY}
                    opacity={opacity}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      handleSeatClick(seat);
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true;
                      handleSeatClick(seat);
                    }}
                    onMouseEnter={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container && isAvail) container.style.cursor = "pointer";
                      if (isAvail) setHoveredSeat(seat);
                    }}
                    onMouseLeave={(e) => {
                      const container = e.target.getStage()?.container();
                      if (container) container.style.cursor = "default";
                      if (hoveredSeat?.id === seat.id) setHoveredSeat(null);
                    }}
                  >
                    {isSelected && (
                      <Circle
                        radius={seatR + 2.4}
                        stroke="#6900AA"
                        strokeWidth={1.8}
                        shadowColor="#6900AA"
                        shadowBlur={6}
                        shadowOpacity={0.4}
                      />
                    )}

                    <Circle
                      radius={seatR}
                      fill={seatFill}
                      stroke={strokeColor}
                      strokeWidth={isSelected || isHovered ? strokeW + 0.3 : strokeW}
                      shadowColor="#0f172a"
                      shadowBlur={isSelected || isHovered ? 4 : 1}
                      shadowOpacity={0.15}
                      perfectDrawEnabled={false}
                    />

                    {(activeZoomScale > 1.8 || isHovered || isSelected) && (
                      <Text
                        text={seat.seat_label}
                        x={-seatR}
                        y={-seatR}
                        width={seatR * 2}
                        height={seatR * 2}
                        align="center"
                        verticalAlign="middle"
                        fontSize={Math.max(
                          4.5,
                          seat.seat_label.length > 2
                            ? seatR * 0.72
                            : seat.seat_label.length > 1
                              ? seatR * 0.88
                              : seatR * 1.05
                        )}
                        fontStyle="bold"
                        fill={textColor}
                        listening={false}
                        perfectDrawEnabled={false}
                      />
                    )}
                  </Group>
                );
              })}
            </Layer>
          )}
        </Stage>

        {/* ── Standing Pass Selector Overlay (shown when a standing block is clicked) ── */}
        {selectedBlock && selectedBlock.stand_type === "standing" && (
          <div
            className="absolute inset-0 z-30 flex flex-col bg-[#F8FAFC]/97 backdrop-blur-md"
            style={{ animation: "fadeIn 0.22s ease-out forwards" }}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0 shadow-sm">
              <button
                onClick={handleBackToStadium}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#6900AA] hover:bg-[#7a00c6] text-white text-xs font-bold transition-all active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Stadium Map</span>
              </button>
              <div className="flex flex-col items-center">
                <span className="text-sm font-extrabold text-slate-900">{selectedBlock.name}</span>
                <span className="text-[11px] text-purple-700 font-semibold mt-0.5">General Admission · Standing Area</span>
              </div>
              <div className="w-24" />
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8">
              <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl text-white shadow-md"
                    style={{ backgroundColor: selectedBlock.color || "#6900AA" }}
                  >
                    🧍
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900 truncate">
                        {selectedBlock.name}
                      </h3>
                      <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                        STANDING PASS
                      </span>
                    </div>
                    {(() => {
                      const matchedTicketId = selectedBlock.ticket_type_id || selectedBlock.tiers[0]?.ticket_type_id || "";
                      const tt = ticketTypes.find((t) => t.id === matchedTicketId);
                      const unitPrice = tt ? Number(tt.price) : 0;
                      return (
                        <p className="text-sm font-extrabold text-emerald-600 mt-0.5">
                          ETB {unitPrice.toLocaleString()}{" "}
                          <span className="text-xs text-slate-400 font-normal">/ pass</span>
                        </p>
                      );
                    })()}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Availability</span>
                    <span className="font-bold text-slate-800">
                      {selectedBlock.available > 0
                        ? `${selectedBlock.available.toLocaleString()} passes left`
                        : "Sold out"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Seating</span>
                    <span className="font-bold text-purple-700">General Admission (No reserved seats)</span>
                  </div>
                </div>

                {/* Quantity Selector */}
                {(() => {
                  const existingForBlock = selectedSeats.filter(
                    (s) =>
                      s.section_name === selectedBlock.name ||
                      s.id.startsWith(`standing-${selectedBlock.block_id}-`)
                  );
                  const existingForBlockCount = existingForBlock.length;

                  return (
                    <>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                            Select Number of Passes
                          </label>
                          {existingForBlockCount > 0 && (
                            <span className="text-[11px] font-bold text-[#6900AA] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                              {existingForBlockCount} currently selected
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-4 p-3 bg-slate-100 rounded-2xl border border-slate-200">
                          <button
                            type="button"
                            disabled={standingQty <= 0}
                            onClick={() => setStandingQty((q) => Math.max(0, q - 1))}
                            className="w-10 h-10 rounded-xl bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-extrabold text-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                            title={standingQty === 1 ? "Reduce to 0 to clear" : "Decrease passes"}
                          >
                            −
                          </button>
                          <div className="text-center">
                            <span
                              className={`text-xl font-extrabold font-mono ${standingQty === 0 ? "text-slate-400" : "text-slate-900"
                                }`}
                            >
                              {standingQty}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {standingQty === 0 ? "passes (clear)" : `pass${standingQty > 1 ? "es" : ""}`}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={
                              standingQty >=
                              Math.min(
                                maxSelectable < Number.MAX_SAFE_INTEGER ? maxSelectable : 10,
                                selectedBlock.available || 1
                              )
                            }
                            onClick={() =>
                              setStandingQty((q) =>
                                Math.min(
                                  maxSelectable < Number.MAX_SAFE_INTEGER ? maxSelectable : 10,
                                  selectedBlock.available || 1,
                                  q + 1
                                )
                              )
                            }
                            className="w-10 h-10 rounded-xl bg-white border border-slate-300 hover:border-slate-400 text-slate-800 font-extrabold text-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Action Buttons: Confirm or Clear */}
                      <div className="space-y-2.5 pt-1">
                        {standingQty === 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              const remaining = selectedSeats.filter(
                                (s) =>
                                  !(
                                    s.section_name === selectedBlock.name ||
                                    s.id.startsWith(`standing-${selectedBlock.block_id}-`)
                                  )
                              );
                              setSelectedSeats(remaining);
                              onSeatsSelected(remaining);
                              toast.info(`Cleared standing passes for ${selectedBlock.name}`);
                              handleBackToStadium();
                            }}
                            className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                          >
                            <span>Clear All Passes for {selectedBlock.name}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={selectedBlock.available === 0}
                            onClick={() => {
                              const matchedTicketId =
                                selectedBlock.ticket_type_id || selectedBlock.tiers[0]?.ticket_type_id || "";
                              const tt = ticketTypes.find((t) => t.id === matchedTicketId);
                              const unitPrice = tt ? Number(tt.price) : 0;

                              const otherSeats = selectedSeats.filter(
                                (s) =>
                                  !(
                                    s.section_name === selectedBlock.name ||
                                    s.id.startsWith(`standing-${selectedBlock.block_id}-`)
                                  )
                              );

                              const virtualSeats: TierSeat[] = Array.from(
                                { length: standingQty },
                                (_, idx) => ({
                                  id: `standing-${selectedBlock.block_id}-${Date.now()}-${idx + 1}`,
                                  row_label: "Standing",
                                  seat_label: `Pass #${idx + 1}`,
                                  coordinate_x: selectedBlock.x + selectedBlock.width / 2,
                                  coordinate_y: selectedBlock.y + selectedBlock.height / 2,
                                  status: "AVAILABLE",
                                  ticket_type_id: matchedTicketId,
                                  section_name: selectedBlock.name,
                                  price: unitPrice,
                                })
                              );

                              const combined = [...otherSeats, ...virtualSeats];
                              setSelectedSeats(combined);
                              onSeatsSelected(combined);
                              toast.success(
                                `${standingQty} Standing pass${standingQty > 1 ? "es" : ""} selected for ${selectedBlock.name}!`
                              );
                              handleBackToStadium();
                            }}
                            className="w-full py-3 px-4 rounded-xl bg-[#6900AA] hover:bg-[#57008E] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>Confirm {standingQty} Standing Pass{standingQty > 1 ? "es" : ""}</span>
                          </button>
                        )}

                        {/* Dedicated 1-Click Clear Button if tickets currently selected */}
                        {(existingForBlockCount > 0 || selectedSeats.length > 0) && (
                          <button
                            type="button"
                            onClick={() => {
                              const remaining = selectedSeats.filter(
                                (s) =>
                                  !(
                                    s.section_name === selectedBlock.name ||
                                    s.id.startsWith(`standing-${selectedBlock.block_id}-`)
                                  )
                              );
                              setSelectedSeats(remaining);
                              onSeatsSelected(remaining);
                              setStandingQty(0);
                              toast.info(
                                existingForBlockCount > 0
                                  ? `Cleared ${existingForBlockCount} passes for ${selectedBlock.name}`
                                  : "Cleared selected passes"
                              );
                              handleBackToStadium();
                            }}
                            className="w-full py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50/90 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                          >
                            <span>✕ Clear All Selected Passes ({existingForBlockCount > 0 ? existingForBlockCount : selectedSeats.length})</span>
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── Tier Picker Overlay (Level 2: shown when a multi-tier block is clicked) ── */}
        {selectedBlock && showTierPicker && (
          <div
            className="absolute inset-0 z-30 flex flex-col bg-[#F8FAFC]/97 backdrop-blur-md"
            style={{ animation: "fadeIn 0.22s ease-out forwards" }}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-slate-200 shrink-0">
              <button
                onClick={handleBackToStadium}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#6900AA] hover:bg-[#7a00c6] text-white text-xs font-bold transition-all active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Stadium</span>
              </button>
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-slate-900">{selectedBlock.name}</span>
                <span className="text-[11px] text-slate-500 mt-0.5">Select a tier to view seats</span>
              </div>
              <div className="w-24" />
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8">
              <div className="w-full max-w-2xl space-y-4">
                <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                  {selectedBlock.tiers.length} tier{selectedBlock.tiers.length !== 1 ? "s" : ""} available — pick one
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedBlock.tiers.map((tier) => {
                    const tt = ticketTypes.find((t) => t.id === tier.ticket_type_id);
                    const price = tt ? Number(tt.price) : null;
                    const pct = tier.total > 0 ? tier.available / tier.total : 0;
                    const isSoldOut = tier.available === 0 && tier.total > 0;
                    const badgeColor =
                      isSoldOut ? "text-red-600 bg-red-50 border-red-200"
                        : pct < 0.15 ? "text-orange-600 bg-orange-50 border-orange-200"
                          : pct < 0.4 ? "text-amber-700 bg-amber-50 border-amber-200"
                            : "text-emerald-700 bg-emerald-50 border-emerald-200";
                    const badgeLabel = isSoldOut ? "Sold Out"
                      : pct < 0.15 ? "Almost Full"
                        : pct < 0.4 ? "Filling Fast"
                          : `${tier.available} Available`;
                    return (
                      <button
                        key={tier.tier_id}
                        disabled={isSoldOut}
                        onClick={() => handleTierSelect(tier.tier_id)}
                        className={`group relative flex flex-col gap-3 text-left rounded-2xl border p-4 transition-all duration-200 ${isSoldOut
                          ? "border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed"
                          : "border-slate-200 bg-white hover:border-[#6900AA] hover:shadow-lg hover:shadow-[#6900AA]/10 active:scale-[0.98] cursor-pointer"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-12 rounded-md shrink-0 ring-1 ring-slate-200"
                            style={{ background: tier.color || (selectedBlock as any).color || "#3b82f6" }}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900 group-hover:text-[#6900AA] transition-colors">
                              {tier.name}
                            </span>
                            {price !== null && (
                              <span className="text-xs text-slate-500 mt-0.5">
                                ETB {price.toLocaleString()} / seat
                              </span>
                            )}
                          </div>
                          <span className={`ml-auto shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                            {badgeLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 pl-7">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {tier.total.toLocaleString()} seats
                          </span>
                          {tier.available > 0 && (
                            <span className="text-emerald-600 font-semibold">
                              {tier.available.toLocaleString()} left
                            </span>
                          )}
                        </div>

                        {!isSoldOut && (
                          <div className="flex items-center gap-1 text-xs font-semibold text-[#6900AA] pl-7 mt-0.5">
                            <span>View Seats</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}


        {hoveredSeat && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-white text-slate-800 px-4 py-2 rounded-xl border border-slate-200 shadow-xl flex items-center gap-3 pointer-events-none">
            <div className="w-2.5 h-2.5 rounded-full bg-[#6900AA] animate-pulse" />
            <div className="text-xs">
              <span className="font-bold text-[#6900AA]">{hoveredSeat.section_name}</span>
              <span className="text-slate-400 mx-1.5">·</span>
              <span>
                Row <strong className="text-slate-900">{hoveredSeat.row_label}</strong>, Seat{" "}
                <strong className="text-slate-900">{hoveredSeat.seat_label}</strong>
              </span>
              {hoveredSeat.price && hoveredSeat.price > 0 && (
                <>
                  <span className="text-slate-400 mx-1.5">·</span>
                  <span className="font-bold text-emerald-600">
                    ETB {hoveredSeat.price.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Floating Zoom Controls (+ / − / ⟲) */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex flex-col gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-xl">
          <button
            type="button"
            onClick={() => handleZoomChange(0.35)}
            className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-[#F7E9FF] hover:text-[#6900AA] text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer font-extrabold shadow-xs"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleZoomChange(-0.35)}
            className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-[#F7E9FF] hover:text-[#6900AA] text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer font-extrabold shadow-xs"
            title="Zoom Out (−)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-[#F7E9FF] hover:text-[#6900AA] text-slate-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs"
            title={selectedBlock ? "Fit Block / Tier (⟲)" : "Fit Stadium (⟲)"}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Row selection pills floating at top-left when zoomed into a seated block */}
        {selectedBlock && selectedBlock.stand_type !== "standing" && availableRows.length > 1 && (
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 max-w-[calc(100%-80px)] overflow-x-auto scrollbar-none flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-lg">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-1.5 shrink-0">
              Row:
            </span>
            <button
              type="button"
              onClick={() => zoomToRow(null)}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${selectedRow === null
                ? "bg-[#6900AA] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              All
            </button>
            {availableRows.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => zoomToRow(r === selectedRow ? null : r)}
                className={`w-6 h-6 rounded-lg text-[11px] font-bold transition-all shrink-0 flex items-center justify-center cursor-pointer ${selectedRow === r
                  ? "bg-[#6900AA] text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Seats fetch loading — map view until seat data arrives */}
        {seatsPending && !showTierPicker && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#EEF2F7]/90 backdrop-blur-[3px] pointer-events-none">
            <Loader2 className="w-10 h-10 text-[#6900AA] animate-spin" />
            <p className="text-sm font-semibold text-gray-800">Loading seats…</p>
          </div>
        )}

        {/* Overview hint — sits above the map bottom edge */}
        {!selectedBlockId && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 max-w-[min(92%,28rem)] bg-white text-slate-700 px-3.5 py-2 rounded-full border border-slate-200 shadow-lg text-[11px] sm:text-xs font-medium flex items-center gap-2 pointer-events-none">
            <Info className="w-3.5 h-3.5 text-[#6900AA] shrink-0" />
            <span>Tap a stand on the map to pick seats</span>
          </div>
        )}

        {/* Zoom controls — map bottom-right */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-0.5 bg-white/95 p-1 rounded-xl border border-slate-200 shadow-md">
          <button
            type="button"
            onClick={() => handleZoomChange(0.25)}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoomChange(-0.25)}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleFitStadium}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 cursor-pointer"
            title="Fit stadium"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {!hideBookingBar && (
        <div className="shrink-0 p-3 sm:p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 z-20">
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-[#F7E9FF] border border-[#E3BCFF] flex items-center justify-center shrink-0">
              <Ticket className="w-5 h-5 text-[#6900AA]" />
            </div>
            <div className="min-w-0">
              {selectedSeats.length === 0 ? (
                <div>
                  <p className="text-xs font-bold text-slate-800">No seats selected</p>
                  <p className="text-[11px] text-slate-500">
                    {maxSelectable < Number.MAX_SAFE_INTEGER
                      ? `Select exactly ${maxSelectable} seat${maxSelectable === 1 ? "" : "s"}`
                      : "Click available seats to select"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">
                      {selectedSeats.length} seat{selectedSeats.length !== 1 ? "s" : ""} selected
                    </span>
                    <span className="text-[11px] font-bold text-[#6900AA] bg-[#F7E9FF] px-2 py-0.5 rounded border border-[#E3BCFF]">
                      ETB {totalPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedSeats.map((s) => (
                      <span
                        key={s.id}
                        className="text-[10px] font-mono font-bold bg-slate-50 text-slate-700 border border-slate-200 px-2 py-0.5 rounded"
                      >
                        {s.row_label}{s.seat_label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
            {selectedSeats.length > 0 && (
              <button
                onClick={() => {
                  setSelectedSeats([]);
                  onSeatsSelected([]);
                }}
                className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              disabled={selectedSeats.length === 0}
              onClick={() => {
                onSeatsSelected(selectedSeats);
                toast.success(`${selectedSeats.length} seat(s) confirmed!`);
              }}
              className="w-full sm:w-auto btn-primary py-2.5 px-6 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              <span>
                {selectedSeats.length > 0
                  ? `Confirm ${selectedSeats.length} Seat${selectedSeats.length > 1 ? "s" : ""}`
                  : "Select Seats to Proceed"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}