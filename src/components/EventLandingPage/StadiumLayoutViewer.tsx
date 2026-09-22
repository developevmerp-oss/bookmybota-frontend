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
}: {
  eventId: string;
  ticketTypes: Array<{ id: string; name: string; price: number }>;
  onSeatsSelected: (seats: TierSeat[]) => void;
  initialSelectedSeats?: TierSeat[];
  maxSelectable?: number;
}) {
  const { data, isLoading, isError } = useGetPublicStadiumBlocksQuery(eventId);

  // Selected block for zooming into seat layout
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [activeTierId, setActiveTierId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"canvas" | "grid">("canvas");
  // Tier picker: shown when a multi-tier block is clicked — user must pick a tier before seeing seats
  const [showTierPicker, setShowTierPicker] = useState<boolean>(false);

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
  const [zoomScale, setZoomScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  // Measure container dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setContainerSize({
        width: el.clientWidth || 900,
        height: Math.max(500, Math.min(680, window.innerHeight * 0.65)),
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

  // Base fit scale to fit stadium canvas into container
  const baseScale = useMemo(() => {
    return Math.min(
      (containerSize.width - 40) / canvasWidth,
      (containerSize.height - 40) / canvasHeight,
      1
    );
  }, [containerSize, canvasWidth, canvasHeight]);

  const selectedBlock = useMemo(() => {
    return data?.blocks.find((b) => b.block_id === selectedBlockId) || null;
  }, [data?.blocks, selectedBlockId]);

  // Fetch all seats for the selected block
  const { data: blockSeatsData, isLoading: seatsLoading } = useGetStadiumBlockSeatsQuery(
    { eventId, blockId: selectedBlockId || "" },
    { skip: !selectedBlockId }
  );

  const rawSeats = blockSeatsData?.seats || [];

  // Map price to seats based on ticketTypes
  const blockSeats: TierSeat[] = useMemo(() => {
    return rawSeats.map((s) => {
      const tt = ticketTypes.find((t) => t.id === s.ticket_type_id);
      return {
        ...s,
        price: tt ? Number(tt.price) : 0,
      };
    });
  }, [rawSeats, ticketTypes]);

  // Initial centering of the full stadium
  useEffect(() => {
    if (!selectedBlockId) {
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
  }, [baseScale, canvasWidth, canvasHeight, containerSize, selectedBlockId]);

  // Handle Block Click — BookMyShow smooth zoom into block + show seats on canvas
  const handleBlockClick = useCallback(
    (block: StadiumBlock) => {
      if (block.available === 0 && block.total > 0) {
        toast.info(`${block.name} is completely sold out.`);
        return;
      }
      setSelectedBlockId(block.block_id);
      setSelectedRow(null);
      setHoveredSeat(null);

      // If block has multiple tiers → show tier picker first (dynamic for any sport)
      if (block.tiers.length > 1) {
        setActiveTierId(null);
        setShowTierPicker(true);
      } else {
        // Single tier or no tier → go straight to seats
        setActiveTierId(block.tiers[0]?.tier_id || null);
        setShowTierPicker(false);
      }

      if (!stageRef.current) return;

      let bounds: { centerX: number; centerY: number; width: number; height: number };

      if (block.shape === "arc") {
        const sCX = block.stadiumCenterX != null ? Number(block.stadiumCenterX) : canvasWidth / 2;
        const sCY = block.stadiumCenterY != null ? Number(block.stadiumCenterY) : canvasHeight / 2;
        const innerR = Number(block.innerRadius) || 260;
        const outerR = Number(block.outerRadius) || 335;
        const startA = Number(block.startAngle) || 0;
        const sweepA = Number(block.sweepAngle) || 45;
        const endA = startA + sweepA;

        // Sample points along the entire arc to get exact bounding box
        const xs: number[] = [];
        const ys: number[] = [];
        for (let a = startA; a <= endA; a += 2) {
          const rad = (a * Math.PI) / 180;
          const c = Math.cos(rad);
          const s = Math.sin(rad);
          xs.push(sCX + innerR * c, sCX + outerR * c);
          ys.push(sCY + innerR * s, sCY + outerR * s);
        }
        const endRad = (endA * Math.PI) / 180;
        xs.push(sCX + innerR * Math.cos(endRad), sCX + outerR * Math.cos(endRad));
        ys.push(sCY + innerR * Math.sin(endRad), sCY + outerR * Math.sin(endRad));

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        bounds = {
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2,
          width: Math.max(60, maxX - minX),
          height: Math.max(60, maxY - minY),
        };
      } else {
        bounds = {
          centerX: (Number(block.x) || 0) + (Number(block.width) || 120) / 2,
          centerY: (Number(block.y) || 0) + (Number(block.height) || 80) / 2,
          width: Number(block.width) || 120,
          height: Number(block.height) || 80,
        };
      }

      // Fill ~88% width and ~82% height of the container so the block is fully zoomed in!
      const scaleX = (containerSize.width * 0.88) / bounds.width;
      const scaleY = (containerSize.height * 0.82) / bounds.height;
      const targetScale = Math.max(1.8, Math.min(6.0, Math.min(scaleX, scaleY)));

      const newX = containerSize.width / 2 - bounds.centerX * targetScale;
      const newY = containerSize.height / 2 - bounds.centerY * targetScale;
      setZoomScale(targetScale);
      setStagePos({ x: newX, y: newY });
      stageRef.current.to({
        x: newX,
        y: newY,
        scaleX: targetScale,
        scaleY: targetScale,
        duration: 0.48,
        easing: Konva.Easings.EaseInOut,
      });
    },
    [containerSize, canvasWidth, canvasHeight]
  );

  // Select a tier from the picker → zoom into that tier's seats
  const handleTierSelect = useCallback(
    (tierId: string) => {
      setActiveTierId(tierId);
      setShowTierPicker(false);
      setSelectedRow(null);
    },
    []
  );

  // Zoom back out to full stadium overview
  const handleBackToStadium = useCallback(() => {
    setSelectedBlockId(null);
    setActiveTierId(null);
    setShowTierPicker(false);
    setSelectedRow(null);
    setHoveredSeat(null);
    const cx = (containerSize.width - canvasWidth * baseScale) / 2;
    const cy = (containerSize.height - canvasHeight * baseScale) / 2;
    setZoomScale(baseScale);
    setStagePos({ x: cx, y: cy });
    if (stageRef.current) {
      stageRef.current.to({
        x: cx, y: cy,
        scaleX: baseScale, scaleY: baseScale,
        duration: 0.42,
        easing: Konva.Easings.EaseInOut,
      });
    }
  }, [baseScale, canvasWidth, canvasHeight, containerSize]);

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

  // Handle manual zoom buttons
  const handleZoomChange = (delta: number) => {
    const newScale = Math.max(0.3, Math.min(5, zoomScale + delta));
    setZoomScale(newScale);
    if (stageRef.current) {
      stageRef.current.to({
        scaleX: newScale,
        scaleY: newScale,
        duration: 0.25,
      });
    }
  };

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
      const prices = block.tiers
        .map((t) => {
          const match = ticketTypes.find((tt) => tt.id === t.ticket_type_id);
          return match ? Number(match.price) : null;
        })
        .filter((p): p is number => p !== null);
      if (prices.length === 0) return null;
      return Math.min(...prices);
    },
    [ticketTypes]
  );

  const formatPrice = useCallback(
    (val: number) => {
      const curr = (ticketTypes[0] as any)?.currency || "";
      return `${curr} ${val.toLocaleString()}`.trim();
    },
    [ticketTypes]
  );

  // Filtered blocks if category filter is active
  const filteredBlocks = useMemo(() => {
    if (!data?.blocks) return [];
    if (!selectedCategoryFilter) return data.blocks;
    return data.blocks.filter((b) =>
      b.tiers.some((t) => t.ticket_type_id === selectedCategoryFilter)
    );
  }, [data?.blocks, selectedCategoryFilter]);

  const totalPrice = selectedSeats.reduce((sum, s) => sum + (s.price || 0), 0);

  // ── Rendered Seats & Geometry Calculation for In-Canvas Interactive Layer ──
  //
  // NOTE: Stored coordinate_x / coordinate_y in the DB are generated for flat grid-view panels
  // and do not match stadium canvas geometry. For the Konva canvas, we ALWAYS dynamically
  // calculate seat positions directly from the block's physical dimensions, shape, rotation,
  // and tier structure, guaranteeing 100% boundary safety and zero overlapping.
  const renderedSeats = useMemo(() => {
    if (!selectedBlock || !blockSeats || blockSeats.length === 0) return [];

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
      // Find tier index in selectedBlock.tiers
      const foundIdx = selectedBlock.tiers?.findIndex((t) => t.tier_id === tKey) ?? -1;
      const tIdx = foundIdx >= 0 ? foundIdx : 0;

      // Natural sort rows within this tier: A, B, C...
      const sortedRows = Array.from(rowMap.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );
      const totalRows = Math.max(1, sortedRows.length);

      if (isArc) {
        // Divide radial space between tiers if block has multiple tiers
        const tierRadialSpan = (outerR - innerR) / numTiers;
        const tierInnerR = innerR + tIdx * tierRadialSpan;
        const tierOuterR = tierInnerR + tierRadialSpan;

        // Safe padding so seats never touch or bleed through borders
        const padR = Math.max(6, (tierOuterR - tierInnerR) * 0.08);
        const padA = Math.max(1.5, sweepAngle * 0.04);
        const usableInnerR = tierInnerR + padR;
        const usableOuterR = tierOuterR - padR;
        const usableRadialSpan = Math.max(8, usableOuterR - usableInnerR);
        const usableStartA = startAngle + padA;
        const usableSweepA = Math.max(2, sweepAngle - padA * 2);

        sortedRows.forEach((rKey, rowIdx) => {
          const seatsInRow = rowMap.get(rKey)!;
          seatsInRow.sort((a, b) => {
            const numA = Number(a.seat_label);
            const numB = Number(b.seat_label);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return (a.seat_label || "").localeCompare(b.seat_label || "", undefined, { numeric: true });
          });
          const totalSeatsInRow = Math.max(1, seatsInRow.length);

          seatsInRow.forEach((seat, seatIdx) => {
            const r = usableInnerR + ((rowIdx + 0.5) / totalRows) * usableRadialSpan;
            const angleDeg = usableStartA + ((seatIdx + 0.5) / totalSeatsInRow) * usableSweepA;
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

        const padX = Math.max(12, bw * 0.08);
        const padY = Math.max(8, tierH * 0.08);
        const usableW = Math.max(20, bw - padX * 2);
        const usableH = Math.max(10, tierH - padY * 2);

        sortedRows.forEach((rKey, rowIdx) => {
          const seatsInRow = rowMap.get(rKey)!;
          seatsInRow.sort((a, b) => {
            const numA = Number(a.seat_label);
            const numB = Number(b.seat_label);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return (a.seat_label || "").localeCompare(b.seat_label || "", undefined, { numeric: true });
          });
          const totalSeatsInRow = Math.max(1, seatsInRow.length);

          seatsInRow.forEach((seat, seatIdx) => {
            const localX = padX + ((seatIdx + 0.5) / totalSeatsInRow) * usableW;
            const localY = tierY + padY + ((rowIdx + 0.5) / totalRows) * usableH;

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

  // Dynamically calculate seat radius to fit the block's row and seat density with clean spacing
  const dynamicSeatRadius = useMemo(() => {
    if (!selectedBlock || renderedSeats.length === 0) return 3.6;
    const innerR = Number(selectedBlock.innerRadius) || 260;
    const outerR = Number(selectedBlock.outerRadius) || 335;
    const sweepA = Number(selectedBlock.sweepAngle) || 45;
    const numTiers = Math.max(1, selectedBlock.tiers?.length || 1);

    const rowCounts = new Map<string, number>();
    renderedSeats.forEach((s) => {
      const r = s.row_label || "A";
      rowCounts.set(r, (rowCounts.get(r) || 0) + 1);
    });
    const totalRows = Math.max(1, rowCounts.size);
    const maxSeatsInRow = Math.max(1, ...Array.from(rowCounts.values()));

    if (selectedBlock.shape === "arc") {
      const tierRadialSpan = (outerR - innerR) / numTiers;
      const radialSpan = Math.max(10, tierRadialSpan * 0.80);
      const radialGap = radialSpan / Math.max(1, totalRows / (activeTierId ? 1 : numTiers));
      const usableSweepRad = (sweepA * 0.90 * Math.PI) / 180;
      const minAngularGap = (innerR * usableSweepRad) / maxSeatsInRow;
      return Math.max(2.2, Math.min(4.2, Math.min(radialGap, minAngularGap) * 0.32));
    } else {
      const bw = Number(selectedBlock.width) || 120;
      const bh = Number(selectedBlock.height) || 80;
      const tierH = bh / numTiers;
      const usableW = Math.max(20, bw * 0.84);
      const usableTierH = Math.max(10, tierH * 0.84);
      const xGap = usableW / maxSeatsInRow;
      const yGap = usableTierH / Math.max(1, totalRows / (activeTierId ? 1 : numTiers));
      return Math.max(2.2, Math.min(4.2, Math.min(xGap, yGap) * 0.32));
    }
  }, [selectedBlock, renderedSeats, activeTierId]);

  // Row Label Markers placed in the aisles (left and right of the stand)
  const rowLabelMarkers = useMemo(() => {
    if (!selectedBlock || renderedSeats.length === 0) return [];
    const rows = new Map<string, Array<{ posX: number; posY: number }>>();
    renderedSeats.forEach((s) => {
      const rKey = s.row_label || "A";
      if (!rows.has(rKey)) rows.set(rKey, []);
      rows.get(rKey)!.push({ posX: s.posX, posY: s.posY });
    });

    const markers: Array<{ key: string; label: string; x: number; y: number }> = [];
    const isArc = selectedBlock.shape === "arc";
    const rotDeg = Number(selectedBlock.rotation) || 0;
    const rotRad = (rotDeg * Math.PI) / 180;
    const cosRot = Math.cos(rotRad);
    const sinRot = Math.sin(rotRad);

    rows.forEach((pts, rLabel) => {
      if (pts.length > 0) {
        const first = pts[0];
        const last = pts[pts.length - 1];

        if (isArc) {
          const sCX = selectedBlock.stadiumCenterX != null ? Number(selectedBlock.stadiumCenterX) : canvasWidth / 2;
          const sCY = selectedBlock.stadiumCenterY != null ? Number(selectedBlock.stadiumCenterY) : canvasHeight / 2;
          const r = Math.hypot(first.posX - sCX, first.posY - sCY);

          const a1 = Math.atan2(first.posY - sCY, first.posX - sCX);
          const a2 = Math.atan2(last.posY - sCY, last.posX - sCX);
          // 3.0 degrees offset into the aisles so it never overlaps Seat 1 or Seat 25
          const offset = 3.0 * (Math.PI / 180);

          markers.push({
            key: `start-${rLabel}`,
            label: rLabel,
            x: sCX + r * Math.cos(a1 - offset),
            y: sCY + r * Math.sin(a1 - offset),
          });
          if (pts.length > 3) {
            markers.push({
              key: `end-${rLabel}`,
              label: rLabel,
              x: sCX + r * Math.cos(a2 + offset),
              y: sCY + r * Math.sin(a2 + offset),
            });
          }
        } else {
          // Offset along the row axis (cosRot, sinRot)
          const offsetDist = Math.max(14, dynamicSeatRadius * 2.8);
          markers.push({
            key: `start-${rLabel}`,
            label: rLabel,
            x: first.posX - offsetDist * cosRot,
            y: first.posY - offsetDist * sinRot,
          });
          if (pts.length > 3) {
            markers.push({
              key: `end-${rLabel}`,
              label: rLabel,
              x: last.posX + offsetDist * cosRot,
              y: last.posY + offsetDist * sinRot,
            });
          }
        }
      }
    });
    return markers;
  }, [selectedBlock, renderedSeats, canvasWidth, canvasHeight, dynamicSeatRadius]);

  // Available row labels in natural alphabetical/numeric order
  const availableRows = useMemo(() => {
    if (!renderedSeats || renderedSeats.length === 0) return [];
    const set = new Set<string>();
    renderedSeats.forEach((s) => {
      if (s.row_label) set.add(s.row_label);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [renderedSeats]);

  // Zoom directly into a specific row (e.g. A, B, C, D, E, F, G...)
  const zoomToRow = useCallback(
    (rowLabel: string | null) => {
      if (!stageRef.current || !selectedBlock) return;
      if (!rowLabel) {
        setSelectedRow(null);
        handleBlockClick(selectedBlock);
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

      // Generous zoom into the specific row so tickets are large, spaced, and legible
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
    [renderedSeats, selectedBlock, containerSize, handleBlockClick]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 bg-slate-950 text-white rounded-2xl min-h-[500px]">
        <Loader2 className="w-9 h-9 text-emerald-400 animate-spin" />
        <p className="text-sm font-medium text-slate-300">Loading interactive stadium layout…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 bg-slate-950 text-white rounded-2xl min-h-[500px]">
        <AlertCircle className="w-9 h-9 text-rose-400" />
        <p className="text-sm font-medium text-slate-300">Unable to load stadium layout.</p>
      </div>
    );
  }

  // Optional Grid View Panel
  const renderBlockSeatPanel = () => {
    if (!selectedBlock) return null;
    const relevantSeats = activeTierId
      ? blockSeats.filter((s) => s.tier_id === activeTierId)
      : blockSeats;

    const seatsByRow = new Map<string, TierSeat[]>();
    relevantSeats.forEach((s) => {
      const key = `${s.tier_id || "default"}__${s.row_label}`;
      if (!seatsByRow.has(key)) seatsByRow.set(key, []);
      seatsByRow.get(key)!.push(s);
    });
    const sortedRowKeys = Array.from(seatsByRow.keys()).sort();
    const maxSeatsInRow = Math.max(1, ...Array.from(seatsByRow.values()).map((r) => r.length));

    return (
      <div
        className="absolute inset-0 z-30 flex flex-col bg-slate-950/95 backdrop-blur-md"
        style={{
          animation: "slideInFromRight 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        }}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <button
            onClick={() => setViewMode("canvas")}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all active:scale-95 border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Stadium Zoom</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">{selectedBlock.name}</span>
            <span className="text-[11px] text-slate-400">· Seat Grid</span>
          </div>
          <div className="w-16" />
        </div>

        {/* Scrollable Seats Grid */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col items-center gap-3">
          {seatsLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs font-medium">Loading block seats…</p>
            </div>
          ) : sortedRowKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
              <Info className="w-8 h-8 text-slate-500" />
              <p className="text-xs font-medium">No seat layout configured for this stand.</p>
            </div>
          ) : (
            sortedRowKeys.map((rowKey) => {
              const rowSeats = seatsByRow.get(rowKey) || [];
              const rowLabel = rowSeats[0]?.row_label || rowKey;
              return (
                <div key={rowKey} className="flex items-center gap-1 sm:gap-1.5">
                  <span className="w-6 text-center text-[10px] font-bold text-slate-500 shrink-0">{rowLabel}</span>
                  {rowSeats.map((seat) => {
                    const isSelected = selectedSeats.some((s) => s.id === seat.id);
                    const isAvail = seat.status === "AVAILABLE";
                    return (
                      <button
                        key={seat.id}
                        title={`Row ${seat.row_label}, Seat ${seat.seat_label}${seat.price ? ` · ETB ${seat.price}` : ""}`}
                        disabled={!isAvail && !isSelected}
                        onClick={() => handleSeatClick(seat)}
                        className={`relative flex items-center justify-center rounded-sm text-[9px] sm:text-[10px] font-bold transition-all duration-150 focus:outline-none
                          ${ maxSeatsInRow > 40 ? "w-4 h-4 sm:w-5 sm:h-5" : maxSeatsInRow > 25 ? "w-5 h-5 sm:w-6 sm:h-6" : "w-6 h-6 sm:w-7 sm:h-7" }
                          ${
                            isSelected
                              ? "bg-rose-500 text-white shadow-lg shadow-rose-500/40 scale-110 ring-2 ring-white/60"
                              : !isAvail
                              ? "bg-slate-700/50 text-slate-600 cursor-not-allowed"
                              : "bg-[#1e293b] text-slate-300 border border-[#38bdf8]/50 hover:bg-sky-600 hover:text-white hover:scale-110 cursor-pointer"
                          }`}
                      >
                        {seat.seat_label}
                      </button>
                    );
                  })}
                  <span className="w-6 text-center text-[10px] font-bold text-slate-500 shrink-0">{rowLabel}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800 relative select-none">
      {/* ── Top Header & Navigation Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 z-20">
        <div className="flex items-center gap-3">
          {selectedBlockId ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleBackToStadium}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20 transition-all active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Stadium</span>
              </button>
              {/* Show Back to Tiers when in seat view and block has multiple tiers */}
              {selectedBlock && selectedBlock.tiers.length > 1 && !showTierPicker && activeTierId && (
                <button
                  onClick={() => {
                    setShowTierPicker(true);
                    setActiveTierId(null);
                    setSelectedRow(null);
                    setViewMode("canvas");
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/40 transition-all active:scale-95"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Tiers</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Sports Stadium
              </span>
              <h2 className="text-sm font-bold text-white hidden sm:inline">{data.stadium_name || "Stadium Ground"}</h2>
            </div>
          )}
          {selectedBlock && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 hidden sm:inline">/</span>
              <span className="font-bold text-amber-400">{selectedBlock.name}</span>
              {seatsLoading && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />}
            </div>
          )}
        </div>

        {/* View Mode Toggle when inside a block */}
        {selectedBlock && (
          <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode("canvas")}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === "canvas"
                  ? "bg-emerald-500 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Stand Zoom</span>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === "grid"
                  ? "bg-amber-400 text-slate-950 shadow-md font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Seat Grid</span>
            </button>
          </div>
        )}

        {/* Tier Selector when inside a block */}
        {selectedBlock && selectedBlock.tiers.length > 1 && (
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTierId(null)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                activeTierId === null ? "bg-amber-400 text-slate-950 shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              All Tiers
            </button>
            {selectedBlock.tiers.map((t, tIdx) => {
              const tierColor = t.color || (tIdx === 0 ? "#f59e0b" : "#10b981");
              return (
                <button
                  key={t.tier_id}
                  onClick={() => setActiveTierId(t.tier_id)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                    activeTierId === t.tier_id ? "bg-amber-400 text-slate-950 shadow" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: tierColor }}
                  />
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Stand / Block Selector Bar (Overview mode only) — BookMyShow style ── */}
        {!selectedBlockId && data.blocks.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {/* All Stands pill */}
            <button
              onClick={() => setSelectedCategoryFilter(null)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all whitespace-nowrap ${
                selectedCategoryFilter === null
                  ? "bg-white text-slate-950 border-white shadow"
                  : "bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700"
              }`}
            >
              All Stands
            </button>

            <div className="h-3.5 w-px bg-slate-700 shrink-0" />

            {data.blocks.map((block) => {
              const isSoldOut = block.available === 0 && block.total > 0;
              const minPrice = getBlockMinPrice(block);
              const isCatMatch = !selectedCategoryFilter || block.tiers.some((t) => t.ticket_type_id === selectedCategoryFilter);
              return (
                <button
                  key={block.block_id}
                  onClick={() => {
                    // 1. If it's the active filter → zoom directly into that block on the canvas
                    setSelectedCategoryFilter(block.tiers[0]?.ticket_type_id ?? null);
                    if (!isSoldOut) handleBlockClick(block);
                  }}
                  disabled={isSoldOut}
                  title={isSoldOut ? `${block.name} — Sold Out` : `Click to zoom into ${block.name}`}
                  className={`shrink-0 flex flex-col items-start px-2.5 py-1.5 rounded-lg border transition-all text-left whitespace-nowrap ${
                    isSoldOut
                      ? "bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                      : !isCatMatch
                      ? "bg-slate-900/40 border-slate-800 text-slate-500 opacity-40 hover:opacity-70"
                      : "bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700 hover:border-amber-500 hover:text-white active:scale-95 cursor-pointer"
                  }`}
                >
                  <span className="text-[10px] font-extrabold leading-tight text-amber-400 truncate max-w-[120px]">{block.name}</span>
                  <span className="text-[9px] text-slate-400 leading-tight">
                    {isSoldOut ? "SOLD OUT" : minPrice !== null ? `ETB ${minPrice.toLocaleString()}` : `${block.available} avail`}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          <button onClick={() => handleZoomChange(0.25)} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800" title="Zoom In"><ZoomIn className="w-3.5 h-3.5" /></button>
          <button onClick={() => handleZoomChange(-0.25)} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800" title="Zoom Out"><ZoomOut className="w-3.5 h-3.5" /></button>
          <button onClick={() => {
            const centerX = (containerSize.width - canvasWidth * baseScale) / 2;
            const centerY = (containerSize.height - canvasHeight * baseScale) / 2;
            setZoomScale(baseScale);
            setStagePos({ x: centerX, y: centerY });
            if (stageRef.current) stageRef.current.to({ x: centerX, y: centerY, scaleX: baseScale, scaleY: baseScale, duration: 0.35, easing: Konva.Easings.EaseInOut });
          }} className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800" title="Reset View"><RotateCcw className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* ── Quick Row-Level Zoom Bar ("abcdefg") when zoomed into a stand ── */}
      {selectedBlock && viewMode === "canvas" && availableRows.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-950/95 border-b border-slate-800/80 backdrop-blur-md overflow-x-auto no-scrollbar z-20 shadow-inner">
          <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-400 shrink-0 mr-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Row Zoom:</span>
          </div>

          <button
            onClick={() => zoomToRow(null)}
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all shrink-0 ${
              selectedRow === null
                ? "bg-amber-400 text-slate-950 shadow-sm"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:bg-slate-800"
            }`}
          >
            All Rows
          </button>

          <div className="h-3.5 w-px bg-slate-800 shrink-0 mx-0.5" />

          {availableRows.map((r) => {
            const isSelected = selectedRow === r;
            return (
              <button
                key={r}
                onClick={() => zoomToRow(isSelected ? null : r)}
                className={`min-w-6 h-6 px-1.5 rounded-md flex items-center justify-center text-xs font-extrabold transition-all shrink-0 ${
                  isSelected
                    ? "bg-amber-400 text-slate-950 shadow-md scale-105 border border-amber-300"
                    : "bg-slate-900/90 text-slate-300 hover:text-amber-300 hover:bg-slate-800 border border-slate-800"
                }`}
                title={`Zoom directly into Row ${r}`}
              >
                {r}
              </button>
            );
          })}

          {selectedRow && (
            <button
              onClick={() => zoomToRow(null)}
              className="text-[10px] text-slate-400 hover:text-amber-300 ml-2 underline underline-offset-2 shrink-0 font-medium"
            >
              Reset to block
            </button>
          )}
        </div>
      )}

      {/* ── Interactive Konva Canvas (Zoomable Pitch + Stands + Seats) ── */}
      <div
        ref={containerRef}
        className="flex-1 w-full bg-[#070e0a] relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <Stage
          ref={stageRef}
          width={containerSize.width}
          height={containerSize.height}
          draggable
          onWheel={handleWheel}
          onDragEnd={(e) => {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }}
        >
          {/* 1. Background Turf Layer */}
          <Layer>
            {/* Outer Concourse Track */}
            <Rect
              x={0}
              y={0}
              width={canvasWidth}
              height={canvasHeight}
              fill="#06120b"
              perfectDrawEnabled={false}
            />

            {/* ── Ground / Pitch Section (Positioned, Sized & Rotated from Admin) ── */}
            <Group
              x={pitchX + pitchW / 2}
              y={pitchY + pitchH / 2}
              offsetX={pitchW / 2}
              offsetY={pitchH / 2}
              rotation={pitchRot}
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

              const cx = block.x + block.width / 2;
              const cy = block.y + block.height / 2;

              // If a category filter is applied, dim non-matching blocks
              const isCategoryMatch =
                !selectedCategoryFilter ||
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
                    opacity={selectedBlockId ? (isSelected ? 1 : 0.18) : (isSoldOut ? 0.35 : isCategoryMatch ? 1 : 0.25)}
                    onMouseEnter={() => {
                      if (!isSoldOut) setHoveredBlockId(block.block_id);
                    }}
                    onMouseLeave={() => setHoveredBlockId(null)}
                    onClick={() => handleBlockClick(block)}
                    onTap={() => handleBlockClick(block)}
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
                          const assigned = ticketTypes.find((tt) => tt.id === tier.ticket_type_id);

                          return (
                            <Group key={tier.tier_id || `arc-tier-${tIdx}`}>
                              <Arc
                                x={sCenterX}
                                y={sCenterY}
                                innerRadius={tierInR}
                                outerRadius={tierOutR}
                                angle={sweepA}
                                rotation={startA}
                                fill={isTierSoldOut ? "#334155" : tierColor}
                                opacity={
                                  isSelected
                                    ? activeTierId
                                      ? activeTierId === tier.tier_id
                                        ? 0.38
                                        : 0.12
                                      : 0.25
                                    : 0.95
                                }
                                stroke={
                                  isSelected
                                    ? activeTierId === tier.tier_id
                                      ? "#f59e0b"
                                      : "rgba(255,255,255,0.2)"
                                    : isHovered
                                    ? "#ffffff"
                                    : "rgba(255,255,255,0.3)"
                                }
                                strokeWidth={
                                  isSelected
                                    ? activeTierId === tier.tier_id
                                      ? 3
                                      : 1
                                    : isHovered
                                    ? 2.5
                                    : 1
                                }
                                shadowColor={isHovered ? "#ffffff" : "#000000"}
                                shadowBlur={isHovered ? 16 : 4}
                                shadowOpacity={isHovered ? 0.7 : 0.3}
                                perfectDrawEnabled={false}
                              />
                              {!isSelected && (
                                <Group x={tierLabelX} y={tierLabelY}>
                                  <Text
                                    text={tier.name.toUpperCase()}
                                    x={-60}
                                    y={-10}
                                    width={120}
                                    align="center"
                                    fontSize={9}
                                    fontStyle="bold"
                                    fill={isTierSoldOut ? "#94a3b8" : "#ffffff"}
                                    shadowColor="#000000"
                                    shadowBlur={3}
                                    listening={false}
                                    wrap="none"
                                    ellipsis={true}
                                  />
                                  <Text
                                    text={
                                      isTierSoldOut
                                        ? "SOLD OUT"
                                        : assigned?.price !== undefined
                                        ? `${formatPrice(assigned.price)} · ${tier.available} left`
                                        : `${tier.available} seats`
                                    }
                                    x={-60}
                                    y={2}
                                    width={120}
                                    align="center"
                                    fontSize={8}
                                    fontStyle="bold"
                                    fill={isTierSoldOut ? "#ef4444" : "#fde047"}
                                    shadowColor="#000000"
                                    shadowBlur={3}
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
                              x={-55}
                              y={-10}
                              width={110}
                              height={20}
                              cornerRadius={10}
                              fill="#090d16"
                              stroke={isHovered ? "#f59e0b" : "rgba(255,255,255,0.5)"}
                              strokeWidth={1}
                              shadowColor="#000000"
                              shadowBlur={4}
                            />
                            <Text
                              text={block.name.toUpperCase()}
                              x={-55}
                              y={-5}
                              width={110}
                              align="center"
                              fontSize={9.5}
                              fontStyle="bold"
                              fill="#ffffff"
                              listening={false}
                              wrap="none"
                              ellipsis={true}
                            />
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
                          fill={isSoldOut ? "#334155" : block.color || "#2563eb"}
                          stroke={
                            isSelected
                              ? "#f59e0b"
                              : isHovered
                              ? "#ffffff"
                              : isSoldOut
                              ? "#475569"
                              : "rgba(255,255,255,0.3)"
                          }
                          strokeWidth={isSelected ? 5 : isHovered ? 3.5 : 1.5}
                          shadowColor={isHovered ? "#ffffff" : "#000000"}
                          shadowBlur={isHovered ? 24 : 8}
                          shadowOpacity={isHovered ? 0.85 : 0.4}
                          perfectDrawEnabled={false}
                        />

                        {/* Centroid Price Pill & Stand Name - Hidden when zoomed into selected stand to display seats cleanly */}
                        {!isSelected && (
                          <Group x={labelX} y={labelY}>
                            {/* Stand Name Label */}
                            <Text
                              text={block.name.toUpperCase()}
                              x={-75}
                              y={-18}
                              width={150}
                              align="center"
                              fontSize={10}
                              fontStyle="bold"
                              fill={isSoldOut ? "#94a3b8" : "#ffffff"}
                              shadowColor="#000000"
                              shadowBlur={4}
                              listening={false}
                              wrap="none"
                              ellipsis={true}
                            />
                            {/* Price Badge Pill */}
                            {minPrice !== null && !isSoldOut && (
                              <Group y={0}>
                                <Rect
                                  x={-36}
                                  y={0}
                                  width={72}
                                  height={18}
                                  cornerRadius={9}
                                  fill="#0f172a"
                                  opacity={0.92}
                                  stroke={isHovered ? "#f59e0b" : "rgba(255,255,255,0.4)"}
                                  strokeWidth={1}
                                  shadowColor="#000000"
                                  shadowBlur={4}
                                />
                                <Text
                                  text={formatPrice(minPrice)}
                                  x={-36}
                                  y={3}
                                  width={72}
                                  align="center"
                                  fontSize={10}
                                  fontStyle="bold"
                                  fill="#fbbf24"
                                  listening={false}
                                />
                              </Group>
                            )}
                            {isSoldOut && (
                              <Text
                                text="SOLD OUT"
                                x={-40}
                                y={2}
                                width={80}
                                align="center"
                                fontSize={9}
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
                  opacity={selectedBlockId ? (isSelected ? 1 : 0.18) : (isSoldOut ? 0.35 : isCategoryMatch ? 1 : 0.25)}
                  onMouseEnter={() => {
                    if (!isSoldOut) setHoveredBlockId(block.block_id);
                  }}
                  onMouseLeave={() => setHoveredBlockId(null)}
                  onClick={() => handleBlockClick(block)}
                  onTap={() => handleBlockClick(block)}
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
                        fill="#0f172a"
                        stroke={
                          isSelected
                            ? "#f59e0b"
                            : isHovered
                            ? "#ffffff"
                            : isSoldOut
                            ? "#475569"
                            : "rgba(255,255,255,0.3)"
                        }
                        strokeWidth={isSelected ? 4.5 : isHovered ? 3 : 1.5}
                        cornerRadius={14}
                        shadowColor={isHovered ? "#ffffff" : "#000000"}
                        shadowBlur={isHovered ? 20 : 8}
                        shadowOpacity={isHovered ? 0.8 : 0.3}
                        perfectDrawEnabled={false}
                      />

                      {/* Render each tier as its own slice */}
                      {block.tiers.map((tier, tIdx) => {
                        const numTiers = block.tiers.length;
                        const tierH = block.height / numTiers;
                        const tierY = tIdx * tierH;
                        const tierColor = tier.color || (tIdx === 0 ? "#f59e0b" : "#10b981");
                        const isTierSoldOut = tier.available === 0 && tier.total > 0;
                        const isFirst = tIdx === 0;
                        const isLast = tIdx === numTiers - 1;
                        const assigned = ticketTypes.find((tt) => tt.id === tier.ticket_type_id);

                        return (
                          <Group key={tier.tier_id || `tier-slice-${tIdx}`}>
                            <Rect
                              x={0}
                              y={tierY}
                              width={block.width}
                              height={tierH}
                              fill={isTierSoldOut ? "#334155" : tierColor}
                              opacity={
                                isSelected
                                  ? activeTierId
                                    ? activeTierId === tier.tier_id
                                      ? 0.38
                                      : 0.12
                                    : 0.25
                                  : 0.92
                              }
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
                                  fontSize={Math.max(10, Math.min(block.width * 0.05, tierH * 0.32))}
                                  fontStyle="bold"
                                  fill={isTierSoldOut ? "#94a3b8" : "#ffffff"}
                                  shadowColor="#000000"
                                  shadowBlur={4}
                                  listening={false}
                                  wrap="none"
                                  ellipsis={true}
                                  perfectDrawEnabled={false}
                                />
                                <Text
                                  text={
                                    isTierSoldOut
                                      ? "SOLD OUT"
                                      : assigned?.price !== undefined
                                      ? `${formatPrice(assigned.price)} · ${tier.available} left`
                                      : `${tier.available} seats avail`
                                  }
                                  x={6}
                                  y={tierY + Math.max(16, tierH * 0.55)}
                                  width={block.width - 12}
                                  align="center"
                                  fontSize={Math.max(9, Math.min(block.width * 0.038, tierH * 0.24))}
                                  fontStyle="bold"
                                  fill={isTierSoldOut ? "#ef4444" : "#fde047"}
                                  shadowColor="#000000"
                                  shadowBlur={3}
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
                        <Group x={block.width / 2} y={-8}>
                          <Rect
                            x={-Math.min(75, block.width * 0.45)}
                            y={-9}
                            width={Math.min(150, block.width * 0.9)}
                            height={18}
                            cornerRadius={9}
                            fill="#090d16"
                            stroke={isHovered ? "#f59e0b" : "rgba(255,255,255,0.5)"}
                            strokeWidth={1}
                            shadowColor="#000000"
                            shadowBlur={4}
                          />
                          <Text
                            text={block.name.toUpperCase()}
                            x={-Math.min(75, block.width * 0.45)}
                            y={-5}
                            width={Math.min(150, block.width * 0.9)}
                            align="center"
                            fontSize={9.5}
                            fontStyle="bold"
                            fill="#ffffff"
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
                        shadowColor={isHovered ? "#ffffff" : "#000000"}
                        shadowBlur={isHovered ? 20 : 8}
                        shadowOpacity={isHovered ? 0.8 : 0.3}
                        perfectDrawEnabled={false}
                      />

                      {/* Stand Name & Price Header - Hidden when zoomed in and selected */}
                      {!isSelected && (
                        <>
                          <Text
                            text={block.name.toUpperCase()}
                            x={0}
                            y={Math.max(6, block.height * 0.12)}
                            width={block.width}
                            align="center"
                            fontSize={Math.max(13, Math.min(block.width, block.height) * 0.14)}
                            fontStyle="bold"
                            fill={isSoldOut ? "#94a3b8" : "#ffffff"}
                            shadowColor="#000000"
                            shadowBlur={4}
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
                                  : minPrice !== null
                                  ? `ETB ${minPrice.toLocaleString()} · ${block.available} seats`
                                  : `${block.available} seats avail`
                              }
                              x={0}
                              y={Math.max(26, block.height * 0.52)}
                              width={block.width}
                              align="center"
                              fontSize={Math.max(10, Math.min(block.width, block.height) * 0.1)}
                              fontStyle="bold"
                              fill={isSoldOut ? "#ef4444" : "#fde047"}
                              shadowColor="#000000"
                              shadowBlur={3}
                              listening={false}
                              perfectDrawEnabled={false}
                            />
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Click to Zoom In Hint on Hover */}
                  {isHovered && !selectedBlockId && !isSoldOut && (
                    <Text
                      text="🔍 Click to Zoom In"
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

          {/* 3. Interactive In-Canvas Seats Layer (BookMyShow Block Drill-down) */}
          {selectedBlock && renderedSeats.length > 0 && viewMode === "canvas" && (
            <Layer>
              {/* Row Markers along the sides in the aisles (Clickable to zoom into that row) */}
              {rowLabelMarkers.map((m) => {
                const isCurrentRow = selectedRow === m.label;
                const markerR = Math.max(6.5, dynamicSeatRadius * 1.6);
                return (
                  <Group
                    key={m.key}
                    x={m.x}
                    y={m.y}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      zoomToRow(isCurrentRow ? null : m.label);
                    }}
                    onTap={(e) => {
                      e.cancelBubble = true;
                      zoomToRow(isCurrentRow ? null : m.label);
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
                      radius={isCurrentRow ? markerR * 1.25 : markerR}
                      fill={isCurrentRow ? "#f59e0b" : "#0f172a"}
                      stroke={isCurrentRow ? "#ffffff" : "#f59e0b"}
                      strokeWidth={isCurrentRow ? 1.8 : 1.2}
                      shadowColor={isCurrentRow ? "#f59e0b" : "#000000"}
                      shadowBlur={isCurrentRow ? 8 : 4}
                    />
                    <Text
                      text={m.label}
                      x={-markerR}
                      y={-markerR}
                      width={markerR * 2}
                      height={markerR * 2}
                      align="center"
                      verticalAlign="middle"
                      fontSize={Math.max(6.5, dynamicSeatRadius * 1.35)}
                      fontStyle="bold"
                      fill={isCurrentRow ? "#0f172a" : "#fbbf24"}
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
                const isInSelectedRow = selectedRow !== null && seat.row_label === selectedRow;

                let seatFill = "#10b981"; // Available emerald
                if (!isAvail) seatFill = "#334155"; // Booked slate
                if (isSelected) seatFill = "#f43f5e"; // Selected rose
                else if (isHovered) seatFill = "#38bdf8"; // Hover sky

                // Dim non-selected rows slightly when a specific row is zoomed in
                const opacity = selectedRow === null || isInSelectedRow ? 1 : 0.42;

                const seatR = isSelected || isHovered ? dynamicSeatRadius * 1.10 : dynamicSeatRadius;

                return (
                  <Group
                    key={seat.id}
                    x={seat.posX}
                    y={seat.posY}
                    rotation={0} /* Always 0 so ticket numbers are upright and legible */
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
                    {/* Glowing outer circle when selected */}
                    {isSelected && (
                      <Circle
                        radius={seatR + 1.4}
                        stroke="#ffffff"
                        strokeWidth={1.2}
                        shadowColor="#f43f5e"
                        shadowBlur={6}
                        shadowOpacity={0.9}
                      />
                    )}

                    {/* Seat Circle Body */}
                    <Circle
                      radius={seatR}
                      fill={seatFill}
                      stroke={
                        isSelected
                          ? "#ffffff"
                          : isHovered
                          ? "#ffffff"
                          : !isAvail
                          ? "#1e293b"
                          : "rgba(255,255,255,0.45)"
                      }
                      strokeWidth={isSelected || isHovered ? 1.2 : 0.75}
                      shadowColor="#000000"
                      shadowBlur={isSelected || isHovered ? 4 : 1}
                      shadowOpacity={0.3}
                      perfectDrawEnabled={false}
                    />

                    {/* Seat Number (Upright, mathematically centered horizontally & vertically) */}
                    {(zoomScale > 1.35 || isHovered || isSelected || selectedRow !== null) && (
                      <Text
                        text={seat.seat_label}
                        x={-seatR}
                        y={-seatR}
                        width={seatR * 2}
                        height={seatR * 2}
                        align="center"
                        verticalAlign="middle"
                        fontSize={Math.max(
                          2.4,
                          seat.seat_label.length > 2
                            ? seatR * 0.72
                            : seat.seat_label.length > 1
                            ? seatR * 0.88
                            : seatR * 1.05
                        )}
                        fontStyle="bold"
                        fill={!isAvail ? "#64748b" : "#ffffff"}
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

        {/* ── Tier Picker Overlay (Level 2: shown when a multi-tier block is clicked) ── */}
        {selectedBlock && showTierPicker && (
          <div
            className="absolute inset-0 z-30 flex flex-col bg-slate-950/97 backdrop-blur-md"
            style={{ animation: "fadeIn 0.22s ease-out forwards" }}
          >
            {/* Tier Picker Header */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
              <button
                onClick={handleBackToStadium}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all active:scale-95 border border-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>← Stadium</span>
              </button>
              <div className="flex flex-col items-center">
                <span className="text-sm font-bold text-white">{selectedBlock.name}</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Select a tier to view seats</span>
              </div>
              <div className="w-24" />
            </div>

            {/* Tier Cards Grid */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8">
              <div className="w-full max-w-2xl space-y-4">
                <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2">
                  {selectedBlock.tiers.length} tier{selectedBlock.tiers.length !== 1 ? "s" : ""} available — pick one to view seats
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedBlock.tiers.map((tier) => {
                    const tt = ticketTypes.find((t) => t.id === tier.ticket_type_id);
                    const price = tt ? Number(tt.price) : null;
                    const pct = tier.total > 0 ? tier.available / tier.total : 0;
                    const isSoldOut = tier.available === 0 && tier.total > 0;
                    const badgeColor =
                      isSoldOut ? "text-red-400 bg-red-900/30 border-red-700"
                        : pct < 0.15 ? "text-orange-400 bg-orange-900/30 border-orange-700"
                        : pct < 0.4 ? "text-yellow-400 bg-yellow-900/30 border-yellow-700"
                        : "text-emerald-400 bg-emerald-900/30 border-emerald-700";
                    const badgeLabel = isSoldOut ? "Sold Out"
                      : pct < 0.15 ? "Almost Full"
                      : pct < 0.4 ? "Filling Fast"
                      : `${tier.available} Available`;
                    return (
                      <button
                        key={tier.tier_id}
                        disabled={isSoldOut}
                        onClick={() => handleTierSelect(tier.tier_id)}
                        className={`group relative flex flex-col gap-3 text-left rounded-2xl border p-4 transition-all duration-200 ${
                          isSoldOut
                            ? "border-slate-800 bg-slate-900/50 opacity-50 cursor-not-allowed"
                            : "border-slate-700 bg-slate-900 hover:border-amber-400 hover:bg-slate-800/80 hover:shadow-xl hover:shadow-amber-500/10 active:scale-[0.98] cursor-pointer"
                        }`}
                      >
                        {/* Tier color swatch + name */}
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-12 rounded-md shrink-0 ring-1 ring-white/10"
                            style={{ background: tier.color || (selectedBlock as any).color || "#3b82f6" }}
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors">
                              {tier.name}
                            </span>
                            {price !== null && (
                              <span className="text-xs text-slate-400 mt-0.5">
                                ETB {price.toLocaleString()} / seat
                              </span>
                            )}
                          </div>
                          {/* Availability badge */}
                          <span className={`ml-auto shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                            {badgeLabel}
                          </span>
                        </div>

                        {/* Seat stats */}
                        <div className="flex items-center gap-4 text-xs text-slate-400 pl-7">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {tier.total.toLocaleString()} seats
                          </span>
                          {tier.available > 0 && (
                            <span className="text-emerald-400 font-semibold">
                              {tier.available.toLocaleString()} left
                            </span>
                          )}
                        </div>

                        {/* View Seats CTA */}
                        {!isSoldOut && (
                          <div className="flex items-center gap-1 text-xs font-semibold text-amber-400 group-hover:text-amber-300 pl-7 mt-0.5 transition-colors">
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

        {/* ── 4. Optional Grid View Overlay (Toggled via "Seat Grid" Button) ── */}
        {selectedBlock && viewMode === "grid" && renderBlockSeatPanel()}

        {/* Hover Seat Popover / Tooltip */}
        {hoveredSeat && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 text-white px-4 py-2 rounded-xl border border-slate-700 shadow-2xl flex items-center gap-3 backdrop-blur-md pointer-events-none animate-in fade-in duration-150">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="text-xs">
              <span className="font-bold text-amber-400">{hoveredSeat.section_name}</span>
              <span className="text-slate-400 mx-1.5">·</span>
              <span>
                Row <strong className="text-white">{hoveredSeat.row_label}</strong>, Seat{" "}
                <strong className="text-white">{hoveredSeat.seat_label}</strong>
              </span>
              {hoveredSeat.price && hoveredSeat.price > 0 && (
                <>
                  <span className="text-slate-400 mx-1.5">·</span>
                  <span className="font-bold text-emerald-400">
                    ETB {hoveredSeat.price.toLocaleString()}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Stand Drill-down Prompt when in Overview */}
        {!selectedBlockId && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-slate-900/90 text-white px-4 py-2 rounded-full border border-slate-700 shadow-xl text-xs font-medium flex items-center gap-2 pointer-events-none backdrop-blur-md">
            <span className="text-emerald-400 font-bold">💡 Tip:</span>
            <span>Click on any stand/block to open its seat layout and pick your seats</span>
          </div>
        )}
      </div>

      {/* ── BookMyShow Sticky Bottom Booking Bar ── */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
            <Ticket className="w-5 h-5 text-rose-400" />
          </div>

          <div className="min-w-0">
            {selectedSeats.length === 0 ? (
              <div>
                <p className="text-xs font-bold text-slate-300">No seats selected</p>
                <p className="text-[11px] text-slate-500">
                  {maxSelectable < Number.MAX_SAFE_INTEGER
                    ? `Please select up to ${maxSelectable} seat${maxSelectable === 1 ? "" : "s"}`
                    : "Click available seats to select"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white">
                    {selectedSeats.length} seat{selectedSeats.length !== 1 ? "s" : ""} selected
                  </span>
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    ETB {totalPrice.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedSeats.map((s) => (
                    <span
                      key={s.id}
                      className="text-[10px] font-mono font-bold bg-slate-800 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded"
                    >
                      {s.row_label}{s.seat_label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
          {selectedSeats.length > 0 && (
            <button
              onClick={() => {
                setSelectedSeats([]);
                onSeatsSelected([]);
              }}
              className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
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
            className="w-full sm:w-auto btn-primary py-2.5 px-6 text-sm font-bold shadow-xl shadow-rose-500/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-all"
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
    </div>
  );
}