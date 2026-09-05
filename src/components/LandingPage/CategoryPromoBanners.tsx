"use client";

import Link from "next/link";
import { useGetActiveMarketingPromotionsQuery } from "@/services/api";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { isPromotionHrefCurrentPage, promotionClickHref } from "@/lib/promotionCta";

type Category = "EVENTS" | "DINING" | "MOVIES" | "SPORTS";

const CATEGORY_LABEL: Record<Category, string> = {
  DINING: "Dining",
  EVENTS: "Events",
  MOVIES: "Movies",
  SPORTS: "Sports",
};

export default function CategoryPromoBanners({
  category,
  targetId,
  className = "",
}: {
  category: Category;
  targetId?: string;
  className?: string;
}) {
  const onDetailsPage = Boolean(targetId);
  const { data: promotions = [], isLoading } = useGetActiveMarketingPromotionsQuery({
    category,
    ...(targetId ? { target_id: targetId } : {}),
    surface: onDetailsPage ? "detail" : "rail",
  });

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
          const inner = (
            <div
              className={`${
                onDetailsPage
                  ? "w-[min(100%,520px)] sm:w-[420px] lg:w-[480px]"
                  : "w-[280px] sm:w-[340px]"
              } relative aspect-[21/9] rounded-2xl overflow-hidden bg-[#111] shrink-0 shadow-sm`}
            >
              {b.banner_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveMediaUrl(b.banner_image_url)}
                  alt={b.title || "Promotion"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#6900AA] to-[#9d00ff] flex items-center justify-center p-4">
                  <p className="text-white font-semibold text-center">{b.title}</p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <div className="absolute left-3 right-3 bottom-3">
                <p className="text-white text-sm font-semibold line-clamp-1">{b.title}</p>
              </div>
              <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-white/90 text-[#6900AA]">
                {ownListing ? "Promoted" : b.category === "ALL" ? category : b.category}
              </span>
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
