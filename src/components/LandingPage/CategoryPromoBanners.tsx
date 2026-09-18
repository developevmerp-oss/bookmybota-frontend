"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGetActiveMarketingPromotionsQuery } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { isPromotionHrefCurrentPage, promotionClickHref } from "@/lib/promotionCta";
import { hasCityFilter } from "@/components/LandingPage/homeUtils";

type Category = "EVENTS" | "DINING" | "MOVIES" | "SPORTS";

const CATEGORY_LABEL: Record<Category, string> = {
  DINING: "Dining",
  EVENTS: "Events",
  MOVIES: "Movies",
  SPORTS: "Sports",
};

function PromoBannerMedia({
  src,
  title,
}: {
  src?: string | null;
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = (src || "").trim() ? resolveMediaUrl(src!.trim()) : "";

  if (!url || failed) {
    return (
      <div
        className="w-full h-full bg-gradient-to-br from-[#6900AA] to-[#9d00ff]"
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={title || "Promotion"}
      className="w-full h-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export default function CategoryPromoBanners({
  category,
  targetId,
  city: cityProp,
  className = "",
}: {
  category: Category;
  targetId?: string;
  /** Optional city override; otherwise uses header selected city. */
  city?: string;
  className?: string;
}) {
  const [city, setCity] = useState(cityProp || "");

  useEffect(() => {
    if (cityProp !== undefined) {
      setCity(cityProp);
      return;
    }
    const applyCity = () => {
      const stored = localStorage.getItem("selected_city") || "";
      setCity(stored && stored !== "All Cities" ? stored : "");
    };
    applyCity();
    window.addEventListener("selected_city_changed", applyCity);
    window.addEventListener("storage", applyCity);
    return () => {
      window.removeEventListener("selected_city_changed", applyCity);
      window.removeEventListener("storage", applyCity);
    };
  }, [cityProp]);

  const onDetailsPage = Boolean(targetId);
  const hasCity = hasCityFilter(city);
  const { data: promotions = [], isLoading } = useGetActiveMarketingPromotionsQuery({
    category,
    ...(targetId ? { target_id: targetId } : {}),
    surface: onDetailsPage ? "detail" : "rail",
    ...(hasCity ? { city } : {}),
  });

  // Hide the whole promotions rail when nothing matches this location
  if (isLoading || promotions.length === 0) return null;

  return (
    <section className={`w-full ${className}`}>
      {onDetailsPage ? (
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
          {CATEGORY_LABEL[category]} promotions
        </p>
      ) : null}
      <div className="flex gap-3 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden pb-1">
        {promotions.map((b) => {
          const href = promotionClickHref(b);
          const samePage = isPromotionHrefCurrentPage(href, category, targetId);
          const ownListing =
            Boolean(targetId) &&
            (String(b.target_id || "") === String(targetId) ||
              String(b.business_id || "") === String(targetId));
          const title = b.title || "Promotion";
          const inner = (
            <div
              className={`${
                onDetailsPage
                  ? "w-[min(100%,520px)] sm:w-[420px] lg:w-[480px]"
                  : "w-[280px] sm:w-[340px]"
              } relative aspect-[21/9] rounded-2xl overflow-hidden bg-[#111] shrink-0 shadow-sm`}
            >
              <PromoBannerMedia src={b.banner_image_url} title={title} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <div className="absolute left-3 right-3 bottom-3">
                <p className="text-white text-sm font-semibold line-clamp-1">{title}</p>
              </div>
              {ownListing ? (
                <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-white/90 text-[#6900AA]">
                  Promoted
                </span>
              ) : null}
            </div>
          );

          if (samePage || href === "#") {
            return (
              <div key={b.id} className="shrink-0">
                {inner}
              </div>
            );
          }

          return (
            <Link key={b.id} href={href} className="shrink-0">
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
