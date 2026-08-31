"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  X,
  type LucideIcon,
} from "lucide-react";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";
import Footer from "@/components/LandingPage/Footer";
import { lockBodyScroll } from "@/lib/lockBodyScroll";
import images from "@/Images";
import type { UserRole } from "@/lib/authStorage";
import partnerInfoPopups from "@/data/partnerInfoPopups.json";

const BRAND = "#6900AA";

type InfoPopupData = {
  title: string;
  description: string;
};

const INFO_POPUPS = partnerInfoPopups as Record<string, InfoPopupData>;

export type PartnerSlide = {
  id: string;
  title: string;
  description: string;
  image: string;
  /** Solid slide panel color (BMS-style). Defaults to charcoal. */
  bg?: string;
  knowMoreHref?: string;
};

export type PartnerTile = {
  label: string;
  infoId: string;
  Icon: LucideIcon;
  iconSrc?: string;
  /** Short line under the title on host/service cards */
  blurb?: string;
  /** BMS host cards: i button navigates here instead of opening a popup */
  infoHref?: string;
};

export type PartnerTestimonial = {
  quote: string;
  name: string;
  role: string;
  photo?: string;
};

export type PartnerListYourShowLandingProps = {
  registerHref: string;
  primaryCtaLabel: string;
  hostTitle: string;
  hostSubtitle: string;
  hostTiles: PartnerTile[];
  /** When true, render only the host categories section. */
  hostOnly?: boolean;
  expectedRole?: Exclude<UserRole, "customer">;
  loginTitle?: string;
  loginSubtitle?: string;
  registerHint?: React.ReactNode;
  secondaryLoginLabel?: string;
  /** Fallback login link when no onOpenLogin handler (defaults from registerHref). */
  loginHref?: string;
  slides?: PartnerSlide[];
  hostEyebrow?: string;
  servicesTitle?: string;
  servicesSubtitle?: string;
  servicesTiles?: PartnerTile[];
  servicesEyebrow?: string;
  servicesBannerText?: string;
  servicesFootnote?: string;
  securityTitle?: string;
  securitySubtitle?: string;
  testimonials?: PartnerTestimonial[];
  crossLinks?: React.ReactNode;
  middleSlot?: React.ReactNode;
  /** When true, omit fixed logo/login bar (use site HomeHeader instead). */
  hideBuiltInHeader?: boolean;
  /** BookMyShow list-your-show style — slider + host + services only. */
  layout?: "default" | "bms";
  onOpenLogin?: () => void;
  loginOpen?: boolean;
  onCloseLogin?: () => void;
};

function logoSrc() {
  return typeof images.logo === "string" ? images.logo : images.logo.src;
}

type ActiveInfoPopup = {
  infoId: string;
  iconSrc?: string;
  Icon: LucideIcon;
};

function InfoPopupModal({
  active,
  ctaLabel,
  ctaHref,
  onClose,
}: {
  active: ActiveInfoPopup | null;
  ctaLabel: string;
  ctaHref: string;
  onClose: () => void;
}) {
  const data = active ? INFO_POPUPS[active.infoId] : null;
  const Icon = active?.Icon;

  useEffect(() => {
    if (!active || !data) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [active, data, onClose]);

  if (!active || !data || !Icon) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-info-popup-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[440px] rounded-2xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.2)] px-8 pt-10 pb-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full border border-[#222] flex items-center justify-center text-[#222] hover:bg-[#F5F5F5] cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X size={16} strokeWidth={2.25} />
        </button>

        <div className="flex flex-col items-center text-center">
          {active.iconSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={active.iconSrc}
              alt=""
              className="h-16 w-16 object-contain"
            />
          ) : (
            <Icon size={56} strokeWidth={1.35} className="text-[#222]" />
          )}

          <h3
            id="partner-info-popup-title"
            className="mt-5 text-[1.35rem] font-bold text-[#333] tracking-tight"
          >
            {data.title}
          </h3>

          <p className="mt-3 text-[15px] text-[#444] leading-relaxed max-w-[320px]">
            {data.description}
          </p>

          <Link
            href={ctaHref}
            onClick={onClose}
            className="mt-8 inline-flex h-12 w-full max-w-[280px] items-center justify-center rounded-lg text-white text-[15px] font-bold hover:opacity-90 transition-opacity"
            style={{ backgroundColor: BRAND }}
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}

const HOST_ICON_TONES = [
  { bg: "bg-[#F3E8FF]", fg: "text-[#6900AA]" },
  { bg: "bg-[#FFEDD5]", fg: "text-[#C2410C]" },
  { bg: "bg-[#DBEAFE]", fg: "text-[#1D4ED8]" },
  { bg: "bg-[#FCE7F3]", fg: "text-[#BE185D]" },
  { bg: "bg-[#DCFCE7]", fg: "text-[#15803D]" },
  { bg: "bg-[#EDE9FE]", fg: "text-[#6D28D9]" },
];

const SERVICE_ICON_TONES = [
  { bg: "bg-[#F3E8FF]", fg: "text-[#6900AA]" },
  { bg: "bg-[#FFEDD5]", fg: "text-[#C2410C]" },
  { bg: "bg-[#FEE2E2]", fg: "text-[#DC2626]" },
  { bg: "bg-[#DCFCE7]", fg: "text-[#15803D]" },
  { bg: "bg-[#DBEAFE]", fg: "text-[#1D4ED8]" },
  { bg: "bg-[#EDE9FE]", fg: "text-[#6D28D9]" },
];

const BMS_CARD_HOVER =
  "transition-[box-shadow,border-color,background-color] duration-300 ease-out hover:shadow-[6px_6px_0_rgba(26,43,72,0.06),10px_10px_18px_rgba(26,43,72,0.14)]";

function BmsInfoLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={`Learn more about ${label}`}
      className="mt-4 inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 border-[#E57373] text-sm sm:text-base font-bold leading-none text-[#E57373] hover:bg-[#FFF5F5] transition-colors"
    >
      i
    </Link>
  );
}

function BmsInfoIcon() {
  return (
    <span
      className="mt-4 inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 border-[#E57373] text-sm sm:text-base font-bold leading-none text-[#E57373]"
      aria-hidden
    >
      i
    </span>
  );
}

function BmsActionButtons({
  registerHref,
  primaryCtaLabel,
  secondaryLoginLabel,
  onOpenLogin,
  loginHref,
}: {
  registerHref: string;
  primaryCtaLabel: string;
  secondaryLoginLabel?: string;
  onOpenLogin?: () => void;
  loginHref?: string;
}) {
  const resolvedLoginHref = loginHref ?? registerHref.replace(/\/register\/?$/, "/login");

  return (
    <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
      <Link
        href={registerHref}
        className="inline-flex items-center justify-center h-11 sm:h-12 min-w-[200px] px-8 rounded-[4px] text-white text-[15px] sm:text-base font-semibold hover:opacity-90 transition-opacity"
        style={{ backgroundColor: BRAND }}
      >
        {primaryCtaLabel}
      </Link>
      {secondaryLoginLabel ? (
        onOpenLogin ? (
          <button
            type="button"
            onClick={onOpenLogin}
            className="inline-flex items-center justify-center h-11 sm:h-12 min-w-[200px] px-8 rounded-[4px] border-2 text-[15px] sm:text-base font-semibold hover:bg-[#F7E9FF] transition-colors cursor-pointer"
            style={{ borderColor: BRAND, color: BRAND }}
          >
            {secondaryLoginLabel}
          </button>
        ) : (
          <Link
            href={resolvedLoginHref}
            className="inline-flex items-center justify-center h-11 sm:h-12 min-w-[200px] px-8 rounded-[4px] border-2 text-[15px] sm:text-base font-semibold hover:bg-[#F7E9FF] transition-colors"
            style={{ borderColor: BRAND, color: BRAND }}
          >
            {secondaryLoginLabel}
          </Link>
        )
      ) : null}
    </div>
  );
}

function BmsSectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center max-w-[820px] mx-auto">
      <h2 className="text-[1.65rem] sm:text-[2rem] md:text-[2.25rem] font-bold tracking-tight text-[#1A2B48] leading-tight">
        {title}
      </h2>
      <p className="mt-4 text-[14px] sm:text-[15px] text-[#555555] leading-relaxed">{subtitle}</p>
    </div>
  );
}

function BmsHostCardsGrid({
  tiles,
  onOpenInfo,
}: {
  tiles: PartnerTile[];
  onOpenInfo?: (tile: PartnerTile) => void;
}) {
  const mdCols = tiles.length > 6 ? "md:grid-cols-4" : "md:grid-cols-3";
  const maxWidth = tiles.length > 6 ? "max-w-[1100px]" : "max-w-[1000px]";

  return (
    <div className={`mt-10 sm:mt-12 grid grid-cols-2 ${mdCols} gap-4 sm:gap-6 ${maxWidth} mx-auto`}>
      {tiles.map((tile) => {
        const { label, Icon, iconSrc, infoHref } = tile;
        return (
          <div
            key={label}
            className={`flex flex-col items-center text-center rounded-md border border-[#D6EAF5] bg-[#EBF5FB] px-4 py-10 sm:py-12 ${BMS_CARD_HOVER}`}
          >
            <span className="inline-flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center">
              {iconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconSrc} alt="" className="h-16 w-16 sm:h-20 sm:w-20 object-contain" />
              ) : (
                <>
                  <Icon size={56} strokeWidth={1.25} className="text-[#111] sm:hidden" />
                  <Icon size={64} strokeWidth={1.25} className="text-[#111] hidden sm:block" />
                </>
              )}
            </span>
            <p className="mt-5 text-base sm:text-lg font-bold text-[#1A2B48] leading-snug">{label}</p>
            {infoHref ? (
              <BmsInfoLink href={infoHref} label={label} />
            ) : onOpenInfo ? (
              <button
                type="button"
                onClick={() => onOpenInfo(tile)}
                aria-label={`Learn more about ${label}`}
                className="mt-4 inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 border-[#E57373] text-sm sm:text-base font-bold leading-none text-[#E57373] hover:bg-[#FFF5F5] transition-colors cursor-pointer"
              >
                i
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function BmsServiceCardsGrid({
  tiles,
  onOpenInfo,
}: {
  tiles: PartnerTile[];
  onOpenInfo: (tile: PartnerTile) => void;
}) {
  return (
    <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-[1000px] mx-auto">
      {tiles.map((tile) => {
        const { label, Icon, iconSrc } = tile;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onOpenInfo(tile)}
            className={`flex flex-col items-center text-center rounded-md border border-[#E8E0E0] bg-[#FDF5F5] px-4 py-10 sm:py-11 hover:bg-[#FCF0F0] cursor-pointer min-h-[220px] sm:min-h-[240px] ${BMS_CARD_HOVER}`}
          >
            <span className="inline-flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center">
              {iconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconSrc} alt="" className="h-16 w-16 sm:h-20 sm:w-20 object-contain" />
              ) : (
                <>
                  <Icon size={48} strokeWidth={1.25} className="text-[#111] sm:hidden" />
                  <Icon size={56} strokeWidth={1.25} className="text-[#111] hidden sm:block" />
                </>
              )}
            </span>
            <p className="mt-5 text-[15px] sm:text-base md:text-lg font-bold text-[#1A2B48] leading-snug max-w-[260px]">
              {label}
            </p>
            <BmsInfoIcon />
          </button>
        );
      })}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center max-w-3xl mx-auto">
      <p className="text-[11px] sm:text-xs font-bold tracking-[0.18em] uppercase text-[#6900AA]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-[1.75rem] sm:text-[2.15rem] md:text-[2.45rem] font-bold tracking-tight text-[#1a1a2e] leading-tight">
        {title}
      </h2>
      <span className="mt-3 mx-auto block h-[3px] w-12 rounded-full bg-[#6900AA]" aria-hidden />
      <p className="mt-4 text-[14px] sm:text-[15px] text-[#6B7280] leading-relaxed">{subtitle}</p>
    </div>
  );
}

function HostCardsGrid({
  tiles,
  onOpenInfo,
}: {
  tiles: PartnerTile[];
  onOpenInfo: (tile: PartnerTile) => void;
}) {
  return (
    <div className="mt-10 sm:mt-12 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      {tiles.map((tile, i) => {
        const tone = HOST_ICON_TONES[i % HOST_ICON_TONES.length];
        const { label, Icon, iconSrc, blurb } = tile;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onOpenInfo(tile)}
            className="group flex flex-col items-center text-center rounded-2xl border border-[#E8E8EE] bg-white px-3 py-6 sm:px-4 sm:py-7 shadow-[0_1px_2px_rgba(17,17,17,0.04)] hover:shadow-[0_10px_28px_rgba(17,17,17,0.08)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 cursor-pointer"
          >
            <span
              className={`inline-flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full ${tone.bg}`}
            >
              {iconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconSrc} alt="" className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
              ) : (
                <Icon size={28} strokeWidth={1.5} className={tone.fg} />
              )}
            </span>
            <p className="mt-4 text-[14px] sm:text-[15px] font-bold text-[#1a1a2e] leading-snug">
              {label}
            </p>
            {blurb ? (
              <p className="mt-1.5 text-[12px] sm:text-[13px] text-[#6B7280] leading-snug line-clamp-3">
                {blurb}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function ServiceCardsGrid({
  tiles,
  onOpenInfo,
}: {
  tiles: PartnerTile[];
  onOpenInfo: (tile: PartnerTile) => void;
}) {
  return (
    <div className="mt-10 sm:mt-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
      {tiles.map((tile, i) => {
        const tone = SERVICE_ICON_TONES[i % SERVICE_ICON_TONES.length];
        const { label, Icon, iconSrc, blurb } = tile;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onOpenInfo(tile)}
            className="group flex items-center gap-3.5 sm:gap-4 rounded-2xl border border-[#E8E8EE] bg-white px-4 py-4 sm:px-5 sm:py-5 text-left shadow-[0_1px_2px_rgba(17,17,17,0.04)] hover:shadow-[0_10px_28px_rgba(17,17,17,0.08)] hover:-translate-y-0.5 transition-[box-shadow,transform] duration-300 cursor-pointer"
          >
            <span
              className={`shrink-0 inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl ${tone.bg}`}
            >
              {iconSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconSrc} alt="" className="h-7 w-7 sm:h-8 sm:w-8 object-contain" />
              ) : (
                <Icon size={24} strokeWidth={1.5} className={tone.fg} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] sm:text-[15px] font-bold text-[#1a1a2e] leading-snug">
                {label}
              </span>
              {blurb ? (
                <span className="mt-1 block text-[12px] sm:text-[13px] text-[#6B7280] leading-snug line-clamp-2">
                  {blurb}
                </span>
              ) : null}
            </span>
            <ChevronRight
              size={18}
              className="shrink-0 text-[#9CA3AF] group-hover:text-[#6900AA] transition-colors"
            />
          </button>
        );
      })}
    </div>
  );
}

export default function PartnerListYourShowLanding({
  expectedRole = "event_admin",
  loginTitle = "",
  loginSubtitle = "",
  registerHref,
  registerHint,
  primaryCtaLabel,
  secondaryLoginLabel = "",
  loginHref,
  slides = [],
  hostTitle,
  hostSubtitle,
  hostTiles,
  hostEyebrow = "Explore possibilities",
  servicesTitle = "",
  servicesSubtitle = "",
  servicesTiles = [],
  servicesEyebrow = "We've got you covered",
  servicesBannerText = "From planning to performance, we make every event a success.",
  servicesFootnote,
  securityTitle = "Sit back and watch your event come to life",
  securitySubtitle = "Events may be all fun and games, but we take it seriously. We ensure our customer's security so that you don't have to.",
  testimonials = [],
  crossLinks,
  middleSlot,
  hideBuiltInHeader = false,
  layout = "default",
  hostOnly = false,
  onOpenLogin,
  loginOpen = false,
  onCloseLogin = () => {},
}: PartnerListYourShowLandingProps) {
  const n = slides.length;
  /** Middle copy of tripled track — starts on first real slide */
  const [index, setIndex] = useState(n);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const [infoPopup, setInfoPopup] = useState<ActiveInfoPopup | null>(null);
  const [narrow, setNarrow] = useState(false);
  const jumpingRef = useRef(false);

  const extendedSlides = useMemo(() => {
    if (n === 0) return [];
    return [...slides, ...slides, ...slides];
  }, [slides, n]);

  const realSlide = n > 0 ? ((index % n) + n) % n : 0;

  const openInfo = useCallback((tile: PartnerTile) => {
    setInfoPopup({
      infoId: tile.infoId,
      iconSrc: tile.iconSrc,
      Icon: tile.Icon,
    });
  }, []);

  useEffect(() => {
    if (!loginOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseLogin();
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [loginOpen, onCloseLogin]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /** Keep index on middle copy after mount / slides change */
  useEffect(() => {
    if (n <= 0) return;
    setAnimate(false);
    setIndex(n);
    const t = window.setTimeout(() => setAnimate(true), 40);
    return () => window.clearTimeout(t);
  }, [n]);

  useEffect(() => {
    if (n <= 1 || paused) return;
    const id = window.setInterval(() => {
      setAnimate(true);
      setIndex((i) => i + 1);
    }, 4500);
    return () => window.clearInterval(id);
  }, [n, paused, index]);

  const goPrev = useCallback(() => {
    if (n <= 1) return;
    setAnimate(true);
    setIndex((i) => i - 1);
  }, [n]);

  const goNext = useCallback(() => {
    if (n <= 1) return;
    setAnimate(true);
    setIndex((i) => i + 1);
  }, [n]);

  const goToReal = useCallback(
    (real: number) => {
      if (n <= 0) return;
      setAnimate(true);
      setIndex(n + real);
    },
    [n]
  );

  const onTrackTransitionEnd = useCallback(() => {
    if (n <= 0 || jumpingRef.current) return;
    if (index >= n * 2) {
      jumpingRef.current = true;
      setAnimate(false);
      setIndex(index - n);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimate(true);
          jumpingRef.current = false;
        });
      });
    } else if (index < n) {
      jumpingRef.current = true;
      setAnimate(false);
      setIndex(index + n);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimate(true);
          jumpingRef.current = false;
        });
      });
    }
  }, [index, n]);

  const isBms = layout === "bms";
  /** Center card slightly narrower so side peeks show more (BMS-style) */
  const slideW = narrow ? 40 : 53;
  const gapPx = narrow ? 10 : 14;

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col font-sans text-[#222] overflow-x-hidden">
      {!hideBuiltInHeader ? (
        <header className="fixed top-0 w-full z-50 bg-white border-b border-[#EBEBEB]">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
            <div className="flex justify-between items-center h-[72px]">
              <Link href="/" className="flex items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoSrc()}
                  alt="Book My Bota"
                  className="h-12 sm:h-14 w-auto object-contain object-left"
                />
              </Link>
              <button
                type="button"
                onClick={onOpenLogin}
                className="h-9 px-5 rounded-md border border-[#D0D0D0] text-[#333] text-sm font-semibold hover:bg-[#FAFAFA] transition-colors cursor-pointer"
              >
                Login
              </button>
            </div>
          </div>
        </header>
      ) : null}

      <div className={`${hideBuiltInHeader ? "" : "pt-[72px]"} flex-1`}>
        {!hostOnly ? (
        <section
          className="bg-white pt-3 sm:pt-4 pb-3 w-full overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="relative w-full max-w-none">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous"
              className="absolute left-2 sm:left-4 md:left-5 top-1/2 -translate-y-1/2 z-20 h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-black/45 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next"
              className="absolute right-2 sm:right-4 md:right-5 top-1/2 -translate-y-1/2 z-20 h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-black/45 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <ChevronRight size={22} strokeWidth={2.25} />
            </button>

            <div className="relative w-full overflow-hidden">
              <div
                className={`flex will-change-transform ${
                  animate ? "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" : ""
                }`}
                style={{
                  gap: `${gapPx}px`,
                  transform: `translateX(calc((100% - ${slideW}%) / 2 - ${index} * (${slideW}% + ${gapPx}px)))`,
                }}
                onTransitionEnd={(e) => {
                  if (e.target !== e.currentTarget) return;
                  onTrackTransitionEnd();
                }}
              >
                {extendedSlides.map((s, i) => {
                  const bg = s.bg || "#6900AA";
                  const isActive = i === index;
                  return (
                    <article
                      key={`${s.id}-${i}`}
                      className={`relative shrink-0 rounded-md overflow-hidden ${
                        isActive ? "opacity-100" : "opacity-85"
                      }`}
                      style={{
                        width: `${slideW}%`,
                        backgroundColor: bg,
                        minHeight: narrow ? 210 : 310,
                      }}
                    >
                      <div className="flex flex-col sm:flex-row h-full min-h-[210px] sm:min-h-[280px] md:min-h-[310px] pb-8">
                        <div className="flex-1 px-5 py-5 sm:px-8 sm:py-7 md:px-10 md:py-8 flex flex-col justify-center z-10">
                          <h1 className="text-[1.3rem] sm:text-[1.7rem] md:text-[2rem] font-bold text-white leading-tight tracking-tight max-w-md">
                            {s.title}
                          </h1>
                          <p className="mt-2 sm:mt-2.5 text-[13px] sm:text-[14px] md:text-[15px] text-white/90 leading-relaxed max-w-md">
                            {s.description}
                          </p>
                          <div className="mt-4 sm:mt-5 flex flex-wrap items-center gap-3 sm:gap-4">
                            <a
                              href={s.knowMoreHref || "#services"}
                              className="text-sm font-semibold text-white hover:underline underline-offset-4"
                            >
                              Know More
                            </a>
                            <Link
                              href={registerHref}
                              className="inline-flex items-center justify-center h-9 sm:h-10 px-4 sm:px-5 rounded-[4px] bg-white text-sm font-bold hover:bg-white/95 transition-colors"
                              style={{ color: BRAND }}
                            >
                              Contact us today
                            </Link>
                          </div>
                        </div>
                        <div className="relative w-full sm:w-[44%] md:w-[46%] h-[155px] sm:h-auto sm:min-h-[280px] md:min-h-[310px] p-3 sm:p-3.5 md:p-4 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.image}
                            alt=""
                            className="w-full h-full max-h-[200px] sm:max-h-[250px] md:max-h-[275px] object-cover rounded-[4px]"
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="pointer-events-none absolute inset-x-0 bottom-3 sm:bottom-4 z-10 flex items-center justify-center">
                <div className="pointer-events-auto flex items-center justify-center gap-2">
                  {slides.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Go to slide ${i + 1}`}
                      onClick={() => goToReal(i)}
                      className={`rounded-full transition-all cursor-pointer ${
                        i === realSlide
                          ? "h-2 w-2 sm:h-2.5 sm:w-2.5 bg-white"
                          : "h-1.5 w-1.5 sm:h-2 sm:w-2 bg-white/45 hover:bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        ) : null}

        {/* What can you host */}
        <section className="bg-white py-14 md:py-16">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6">
            {isBms ? (
              <BmsSectionHeading title={hostTitle} subtitle={hostSubtitle} />
            ) : (
              <SectionHeading eyebrow={hostEyebrow} title={hostTitle} subtitle={hostSubtitle} />
            )}
            {isBms ? (
              <BmsHostCardsGrid tiles={hostTiles} onOpenInfo={openInfo} />
            ) : (
              <HostCardsGrid tiles={hostTiles} onOpenInfo={openInfo} />
            )}
            {isBms ? (
              <BmsActionButtons
                registerHref={registerHref}
                primaryCtaLabel={primaryCtaLabel}
                secondaryLoginLabel={secondaryLoginLabel}
                onOpenLogin={onOpenLogin}
                loginHref={loginHref}
              />
            ) : (
            <div className="mt-10 sm:mt-12 flex justify-center">
              <Link
                href={registerHref}
                className="inline-flex items-center justify-center gap-2 h-11 sm:h-12 px-7 sm:px-8 rounded-xl border-2 text-[14px] sm:text-[15px] font-bold hover:bg-[#F7E9FF] transition-colors"
                style={{ borderColor: BRAND, color: BRAND }}
              >
                {primaryCtaLabel}
                <ArrowUpRight size={18} strokeWidth={2.25} />
              </Link>
            </div>
            )}
          </div>
        </section>

        {!hostOnly ? (
          <>
        {!isBms ? middleSlot : null}

        {/* Services */}
        <section id="services" className={isBms ? "bg-white py-14 md:py-16 scroll-mt-24" : "bg-[#F7F4FB] py-14 md:py-16 scroll-mt-24"}>
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6">
            {isBms ? (
              <BmsSectionHeading title={servicesTitle} subtitle={servicesSubtitle} />
            ) : (
              <SectionHeading
                eyebrow={servicesEyebrow}
                title={servicesTitle}
                subtitle={servicesSubtitle}
              />
            )}
            {isBms ? (
              <BmsServiceCardsGrid tiles={servicesTiles} onOpenInfo={openInfo} />
            ) : (
              <ServiceCardsGrid tiles={servicesTiles} onOpenInfo={openInfo} />
            )}

            {!isBms ? (
              <>
                <div className="mt-10 sm:mt-12 rounded-2xl border border-[#E8E0F2] bg-white px-5 py-5 sm:px-7 sm:py-6 flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-6 shadow-[0_2px_12px_rgba(105,0,170,0.04)]">
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    <span className="shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#F3E8FF] text-[#6900AA]">
                      <CalendarCheck size={22} strokeWidth={1.75} />
                    </span>
                    <p className="text-[14px] sm:text-[15px] font-semibold text-[#1a1a2e] leading-snug">
                      {servicesBannerText}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                    <Link
                      href={registerHref}
                      className="inline-flex items-center justify-center h-11 px-6 rounded-xl text-white text-[14px] font-bold hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: BRAND }}
                    >
                      {primaryCtaLabel}
                    </Link>
                    <button
                      type="button"
                      onClick={onOpenLogin}
                      className="inline-flex items-center justify-center h-11 px-6 rounded-xl border-2 text-[14px] font-bold hover:bg-[#F7E9FF] transition-colors cursor-pointer"
                      style={{ borderColor: BRAND, color: BRAND }}
                    >
                      {secondaryLoginLabel}
                    </button>
                  </div>
                </div>

                {servicesFootnote ? (
                  <p className="mt-8 text-center text-[13px] sm:text-[14px] text-[#6B7280] leading-relaxed max-w-3xl mx-auto">
                    {servicesFootnote}
                  </p>
                ) : null}
                {crossLinks ? (
                  <div className="mt-6 text-center text-[13px] text-[#888]">{crossLinks}</div>
                ) : null}
              </>
            ) : (
              <>
                {isBms ? (
                  <BmsActionButtons
                    registerHref={registerHref}
                    primaryCtaLabel={primaryCtaLabel}
                    secondaryLoginLabel={secondaryLoginLabel}
                    onOpenLogin={onOpenLogin}
                    loginHref={loginHref}
                  />
                ) : null}
                {servicesFootnote ? (
                  <p className="mt-10 sm:mt-12 text-center text-[14px] sm:text-[15px] text-[#555555] leading-relaxed max-w-[820px] mx-auto">
                    {servicesFootnote}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </section>
          </>
        ) : null}
      </div>

      {!hostOnly ? <Footer /> : null}

      {!hostOnly ? (
      <InfoPopupModal
        active={infoPopup}
        ctaLabel={primaryCtaLabel}
        ctaHref={registerHref}
        onClose={() => setInfoPopup(null)}
      />
      ) : null}

      {!hostOnly && loginOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
          onClick={onCloseLogin}
          role="presentation"
        >
          <div
            className="relative w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-lys-login-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onCloseLogin}
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              aria-label="Close login"
            >
              <X size={18} />
            </button>
            <PartnerLoginForm
              variant="embedded"
              expectedRole={expectedRole}
              title={loginTitle}
              titleId="partner-lys-login-title"
              subtitle={loginSubtitle}
              showCustomerLink={false}
              hint={registerHint}
            />
          </div>
        </div>
      )}
    </div>
  );
}
