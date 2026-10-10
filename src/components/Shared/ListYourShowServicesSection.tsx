"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ComponentType } from "react";
import { X, type LucideIcon, type LucideProps } from "lucide-react";
import partnerInfoPopups from "@/data/partnerInfoPopups.json";
import { lockBodyScroll } from "@/lib/lockBodyScroll";

type InfoPopupData = {
  title: string;
  description: string;
};

const INFO_POPUPS = partnerInfoPopups as Record<string, InfoPopupData>;
const DINING_I_COLOR = "#B59B2A";
const BRAND = "#6900AA";

export type ListYourShowServiceTile = {
  label: string;
  infoId: string;
  Icon: LucideIcon | ComponentType<LucideProps>;
};

type ListYourShowServicesSectionProps = {
  title: string;
  subtitle: string;
  tiles: ListYourShowServiceTile[];
  footnote?: string;
  registerHref: string;
  primaryCtaLabel: string;
  containerClassName?: string;
};

const DEFAULT_CONTAINER = "bmb-section-container";

type ActivePopup = {
  infoId: string;
  Icon: LucideIcon | ComponentType<LucideProps>;
};

/**
 * List Your Show common services — dining “What are the services we offer?” card UI + subtitle.
 */
export default function ListYourShowServicesSection({
  title,
  subtitle,
  tiles,
  footnote,
  registerHref,
  primaryCtaLabel,
  containerClassName = DEFAULT_CONTAINER,
}: ListYourShowServicesSectionProps) {
  const [active, setActive] = useState<ActivePopup | null>(null);

  const openInfo = useCallback((tile: ListYourShowServiceTile) => {
    setActive({ infoId: tile.infoId, Icon: tile.Icon });
  }, []);

  const closeInfo = useCallback(() => setActive(null), []);

  useEffect(() => {
    if (!active) return;
    const data = INFO_POPUPS[active.infoId];
    if (!data) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeInfo();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const unlock = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      unlock();
    };
  }, [active, closeInfo]);

  const popupData = active ? INFO_POPUPS[active.infoId] : null;
  const PopupIcon = active?.Icon;

  return (
    <>
      <section id="features" className="bg-white py-14 md:py-16 scroll-mt-24 border-t border-[#F0F0F0]">
        <div className={containerClassName}>
          <div className="text-center max-w-[820px] mx-auto">
            <h2 className="text-[1.65rem] sm:text-[2rem] lg:text-[2.25rem] font-bold tracking-tight text-[#1A2B48] leading-tight">
              {title}
            </h2>
            <p className="mt-4 text-[0.975rem] sm:text-[1rem] text-[#555555] leading-relaxed">
              {subtitle}
            </p>
          </div>

          <div className="mt-10 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 ">
            {tiles.map((tile) => {
              const { label, Icon, infoId } = tile;
              const description = INFO_POPUPS[infoId]?.description;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => openInfo(tile)}
                  className="flex flex-col items-center text-center rounded-xl border border-[#EDEDED] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-4 sm:px-9 py-10 sm:py-11 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] cursor-pointer min-h-[220px] sm:min-h-[240px] transition-shadow duration-300"
                >
                  <span className="inline-flex h-14 w-14 sm:h-16 sm:w-16 p-3 items-center justify-center rounded-full bg-white border border-[#EDEDED]">
                    <Icon size={45} strokeWidth={1.5} className="text-[#111]" />
                  </span>
                  <p className="mt-5 text-[0.9375rem] sm:text-[1.5rem] sm:text-lg font-semibold text-[#1A2B48] leading-snug">
                    {label}
                  </p>
                  {description ? (
                    <p className="mt-2 text-[0.75rem] sm:text-[0.8125rem] text-[#555555] leading-relaxed line-clamp-2 ">
                      {description}
                    </p>
                  ) : null}
                  <span
                    className="mt-4 inline-flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border-2 text-sm sm:text-base font-bold leading-none"
                    style={{ borderColor: DINING_I_COLOR, color: DINING_I_COLOR }}
                    aria-hidden
                  >
                    i
                  </span>
                </button>
              );
            })}
          </div>

          {footnote ? (
            <p className="mt-10 sm:mt-12 text-center text-[0.875rem] sm:text-[0.9375rem] text-[#555555] leading-relaxed max-w-[820px] mx-auto">
              {footnote}
            </p>
          ) : null}
        </div>
      </section>

      {active && popupData && PopupIcon ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 overflow-hidden"
          onClick={closeInfo}
          role="presentation"
          onWheel={(e) => e.preventDefault()}
          onTouchMove={(e) => e.preventDefault()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lys-services-popup-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[440px] rounded-2xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.2)] px-8 pt-10 pb-8"
          >
            <button
              type="button"
              onClick={closeInfo}
              className="absolute top-4 right-4 w-8 h-8 rounded-full border border-[#222] flex items-center justify-center text-[#222] hover:bg-[#F5F5F5] cursor-pointer transition-colors"
              aria-label="Close"
            >
              <X size={16} strokeWidth={2.25} />
            </button>

            <div className="flex flex-col items-center text-center">
              <PopupIcon size={56} strokeWidth={1.35} className="text-[#222]" />
              <h3
                id="lys-services-popup-title"
                className="mt-5 text-[1.35rem] font-bold text-[#333] tracking-tight"
              >
                {popupData.title}
              </h3>
              <p className="mt-3 text-[0.9375rem] text-[#444] leading-relaxed max-w-[320px]">
                {popupData.description}
              </p>
              <Link
                href={registerHref}
                onClick={closeInfo}
                className="mt-8 inline-flex h-12 w-full max-w-[280px] items-center justify-center rounded-lg text-white text-[0.9375rem] font-bold hover:opacity-90 transition-opacity"
                style={{ backgroundColor: BRAND }}
              >
                {primaryCtaLabel}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
