"use client";

export type PartnerTypeCardItem = {
  label: string;
  image: string;
};

export type PartnerTypeCardsSectionProps = {
  title: string;
  types: PartnerTypeCardItem[];
  registerHref: string;
  containerClassName?: string;
  /** `heading` = centered black title on white (dining / movie style). */
  titleStyle?: "eyebrow" | "heading";
  /**
   * `stacked` = image on top, white footer (dining / venue).
   * `overlay` = full-bleed image with white label on bottom (movie types).
   */
  cardStyle?: "stacked" | "overlay";
};

const DEFAULT_CONTAINER = "container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0";

/**
 * Shared type-card grid for partner landings (inner pages).
 * Pass title + items + optional cardStyle. No arrow CTA — arrows stay on List Your Show only.
 */
export default function PartnerTypeCardsSection({
  title,
  types,
  registerHref: _registerHref,
  containerClassName = DEFAULT_CONTAINER,
  titleStyle = "heading",
  cardStyle = "stacked",
}: PartnerTypeCardsSectionProps) {
  const isOverlay = cardStyle === "overlay";
  const sectionClass =
    titleStyle === "heading"
      ? "bg-white py-12 md:py-16 border-t border-[#F0F0F0]"
      : "bg-[#F6F5F3] py-12 md:py-16 border-t border-[#EBEBEB]";
  const gridClass =
    types.length <= 2
      ? "mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 justify-items-start"
      : "mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5";
  const overlayCardClass =
    types.length === 1
      ? "group relative w-full max-w-[28rem] aspect-[16/10] sm:aspect-[5/3] overflow-hidden rounded-2xl bg-[#111]"
      : "group relative w-full aspect-[16/10] sm:aspect-[5/3] overflow-hidden rounded-2xl bg-[#111]";

  return (
    <section className={sectionClass}>
      <div className={containerClassName}>
        {titleStyle === "heading" ? (
          <h2 className="text-center text-[1.65rem] sm:text-[2rem] md:text-[2.25rem] font-bold tracking-tight text-black leading-tight">
            {title}
          </h2>
        ) : (
          <p className="text-[0.6875rem] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#6900AA]">
            {title}
          </p>
        )}
        <div className={gridClass}>
          {types.map((type) =>
            isOverlay ? (
              <article key={type.label} className={overlayCardClass}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={type.image}
                  alt={type.label}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
                  aria-hidden
                />
                <div className="absolute inset-x-0 bottom-0 px-4 py-4 sm:px-5 sm:py-5 text-center">
                  <h3 className="text-xl sm:text-2xl font-bold text-white leading-snug drop-shadow-sm">
                    {type.label}
                  </h3>
                </div>
              </article>
            ) : (
              <article
                key={type.label}
                className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-[#EDEDED] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow duration-300"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[#EEE]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={type.image}
                    alt={type.label}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="px-4 py-4 sm:px-5 sm:py-5 text-center">
                  <h3 className="text-[1.05rem] sm:text-[1.15rem] font-bold text-[#111] leading-snug">
                    {type.label}
                  </h3>
                </div>
              </article>
            )
          )}
        </div>
      </div>
    </section>
  );
}
