"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Quote,
  ShieldCheck,
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
};

export type PartnerTestimonial = {
  quote: string;
  name: string;
  role: string;
  photo?: string;
};

export type PartnerListYourShowLandingProps = {
  expectedRole: Exclude<UserRole, "customer">;
  loginTitle: string;
  loginSubtitle: string;
  registerHref: string;
  registerHint?: React.ReactNode;
  primaryCtaLabel: string;
  secondaryLoginLabel: string;
  slides: PartnerSlide[];
  hostTitle: string;
  hostSubtitle: string;
  hostTiles: PartnerTile[];
  servicesTitle: string;
  servicesSubtitle: string;
  servicesTiles: PartnerTile[];
  servicesFootnote?: string;
  securityTitle?: string;
  securitySubtitle?: string;
  testimonials?: PartnerTestimonial[];
  crossLinks?: React.ReactNode;
  middleSlot?: React.ReactNode;
  onOpenLogin: () => void;
  loginOpen: boolean;
  onCloseLogin: () => void;
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

function TileGrid({
  tiles,
  tone,
  onOpenInfo,
}: {
  tiles: PartnerTile[];
  tone: "host" | "service";
  onOpenInfo: (tile: PartnerTile) => void;
}) {
  const bg = tone === "host" ? "bg-[#006eff2b]" : "bg-[#F7E9FF]";
  return (
    <div className="mt-12 flex flex-wrap justify-center gap-5 md:gap-6">
      {tiles.map((tile) => {
        const { label, Icon, iconSrc } = tile;
        return (
          <div
            key={label}
            className={`group w-full sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-3rem)/3)] ${bg} rounded-md px-6 py-12 flex flex-col items-center text-center min-h-[220px] transition-[box-shadow,transform] duration-300 ease-out shadow-none hover:shadow-[8px_10px_24px_rgba(17,17,17,0.18)] hover:-translate-y-1`}
          >
            {iconSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconSrc} alt="" className="h-14 w-14 object-contain" />
            ) : (
              <Icon size={48} strokeWidth={1.35} className="text-[#222]" />
            )}
            <p className="mt-6 text-[17px] font-bold text-[#222] leading-snug px-2">{label}</p>
            <button
              type="button"
              aria-label={`More info about ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                onOpenInfo(tile);
              }}
              className="mt-5 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#E11D48] transition-colors cursor-pointer"
            >
              <Info size={28} strokeWidth={1.5} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function PartnerListYourShowLanding({
  expectedRole,
  loginTitle,
  loginSubtitle,
  registerHref,
  registerHint,
  primaryCtaLabel,
  secondaryLoginLabel,
  slides,
  hostTitle,
  hostSubtitle,
  hostTiles,
  servicesTitle,
  servicesSubtitle,
  servicesTiles,
  servicesFootnote,
  securityTitle = "Sit back and watch your event come to life",
  securitySubtitle = "Events may be all fun and games, but we take it seriously. We ensure our customer's security so that you don't have to.",
  testimonials = [],
  crossLinks,
  middleSlot,
  onOpenLogin,
  loginOpen,
  onCloseLogin,
}: PartnerListYourShowLandingProps) {
  const [slide, setSlide] = useState(0);
  const [testimonial, setTestimonial] = useState(0);
  const [infoPopup, setInfoPopup] = useState<ActiveInfoPopup | null>(null);

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
    if (slides.length <= 1) return;
    const id = window.setInterval(() => {
      setSlide((s) => (s + 1) % slides.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, [slides.length, slide]);

  useEffect(() => {
    if (testimonials.length <= 1) return;
    const id = window.setInterval(() => {
      setTestimonial((s) => (s + 1) % testimonials.length);
    }, 7000);
    return () => window.clearInterval(id);
  }, [testimonials.length]);

  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const goPrev = useCallback(() => {
    setSlide((s) => (s - 1 + slides.length) % slides.length);
  }, [slides.length]);

  const goNext = useCallback(() => {
    setSlide((s) => (s + 1) % slides.length);
  }, [slides.length]);

  const activeQuote = testimonials[testimonial];
  const slideW = narrow ? 88 : 72;
  const gapPx = narrow ? 10 : 16;

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col font-sans text-[#222] overflow-x-hidden">
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

      <div className="pt-[72px] flex-1">
        {/* Hero carousel — BookMyShow list-your-show center-mode (full width) */}
        <section className="bg-white pt-3 sm:pt-4 pb-2 sm:pb-3 w-full">
          <div className="relative w-full">
            <button
              type="button"
              onClick={goPrev}
              aria-label="Previous"
              className="absolute left-2 sm:left-4 md:left-6 top-1/2 -translate-y-1/2 z-20 h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-black/45 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <ChevronLeft size={22} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next"
              className="absolute right-2 sm:right-4 md:right-6 top-1/2 -translate-y-1/2 z-20 h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-black/45 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <ChevronRight size={22} strokeWidth={2.25} />
            </button>

            <div className="relative overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
                style={{
                  gap: `${gapPx}px`,
                  transform: `translateX(calc((100% - ${slideW}%) / 2 - ${slide} * (${slideW}% + ${gapPx}px)))`,
                }}
              >
                {slides.map((s, i) => {
                  const bg = s.bg || "#45423E";
                  const isActive = i === slide;
                  return (
                    <article
                      key={s.id}
                      className={`relative shrink-0 rounded-md overflow-hidden transition-[opacity,transform] duration-500 ${
                        isActive ? "opacity-100 scale-100" : "opacity-80 scale-[0.985]"
                      }`}
                      style={{
                        width: `${slideW}%`,
                        backgroundColor: bg,
                        minHeight: narrow ? 240 : 360,
                      }}
                    >
                      <div className="flex flex-col sm:flex-row h-full min-h-[240px] sm:min-h-[320px] md:min-h-[360px] pb-9">
                        <div className="flex-1 px-5 py-6 sm:px-8 sm:py-8 md:px-11 md:py-10 flex flex-col justify-center z-10">
                          <h1 className="text-[1.4rem] sm:text-[1.85rem] md:text-[2.2rem] font-bold text-white leading-tight tracking-tight max-w-md">
                            {s.title}
                          </h1>
                          <p className="mt-2.5 sm:mt-3 text-[13px] sm:text-[15px] md:text-[16px] text-white/90 leading-relaxed max-w-md">
                            {s.description}
                          </p>
                          <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-3 sm:gap-4">
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
                        <div className="relative w-full sm:w-[44%] md:w-[46%] h-[180px] sm:h-auto sm:min-h-[320px] md:min-h-[360px] p-3 sm:p-4 md:p-5 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={s.image}
                            alt=""
                            className="w-full h-full max-h-[240px] sm:max-h-[290px] md:max-h-[320px] object-cover rounded-[4px]"
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
                      onClick={() => setSlide(i)}
                      className={`rounded-full transition-all cursor-pointer ${
                        i === slide
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

        {/* What can you host */}
        <section className="bg-white py-14 md:py-16">
          <div className="max-w-[1000px] mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-[1.75rem] md:text-[2.15rem] font-bold tracking-tight text-[#222]">
              {hostTitle}
            </h2>
            <p className="mt-4 text-[14px] md:text-[15px] text-[#666] leading-relaxed max-w-3xl mx-auto">
              {hostSubtitle}
            </p>
            <TileGrid tiles={hostTiles} tone="host" onOpenInfo={openInfo} />
            <div className="mt-12">
              <Link
                href={registerHref}
                className="inline-flex items-center justify-center h-12 px-12 rounded-md text-white font-bold text-[15px] hover:opacity-90 transition-opacity"
                style={{ backgroundColor: BRAND }}
              >
                {primaryCtaLabel}
              </Link>
            </div>
          </div>
        </section>

        {middleSlot}

        {/* Services */}
        <section id="services" className="bg-white py-14 md:py-16 scroll-mt-24 border-t border-[#F0F0F0]">
          <div className="max-w-[1000px] mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-[1.75rem] md:text-[2.15rem] font-bold tracking-tight text-[#222]">
              {servicesTitle}
            </h2>
            <p className="mt-4 text-[14px] md:text-[15px] text-[#666] leading-relaxed max-w-3xl mx-auto">
              {servicesSubtitle}
            </p>
            <TileGrid tiles={servicesTiles} tone="service" onOpenInfo={openInfo} />
            {servicesFootnote ? (
              <p className="mt-12 text-[14px] text-[#666] leading-relaxed max-w-3xl mx-auto">
                {servicesFootnote}
              </p>
            ) : null}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={registerHref}
                className="inline-flex items-center justify-center h-12 px-12 rounded-md text-white font-bold text-[15px] hover:opacity-90 transition-opacity"
                style={{ backgroundColor: BRAND }}
              >
                {primaryCtaLabel}
              </Link>
              <button
                type="button"
                onClick={onOpenLogin}
                className="inline-flex items-center justify-center h-12 px-10 rounded-md border-2 font-bold text-[15px] hover:bg-[#F7E9FF] transition-colors cursor-pointer"
                style={{ borderColor: BRAND, color: BRAND }}
              >
                {secondaryLoginLabel}
              </button>
            </div>
            {crossLinks ? <div className="mt-8 text-[13px] text-[#888]">{crossLinks}</div> : null}
          </div>
        </section>
      </div>

      <Footer />

      <InfoPopupModal
        active={infoPopup}
        ctaLabel={primaryCtaLabel}
        ctaHref={registerHref}
        onClose={() => setInfoPopup(null)}
      />

      {loginOpen && (
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
