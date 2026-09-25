import { restaurantHref } from "@/lib/businessPublicPath";

type PromotionLink = {
  cta_url?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  business_id?: string | null;
  /** Optional SEO slug when linking to a dining/business page */
  business_slug?: string | null;
  category?: string | null;
};

/** Customer destination when they tap a promotion banner. */
export function promotionClickHref(promo: PromotionLink): string {
  const explicit = String(promo.cta_url || "").trim();
  if (explicit) {
    if (/^https?:\/\//i.test(explicit) || explicit.startsWith("/")) return explicit;
    return `/${explicit}`;
  }
  const tType = String(promo.target_type || "").toUpperCase();
  const targetId = promo.target_id ? String(promo.target_id) : "";
  const businessId = promo.business_id ? String(promo.business_id) : "";
  const businessSlug = promo.business_slug ? String(promo.business_slug) : "";
  if (tType === "EVENT" && targetId) return `/events/${targetId}`;
  if (tType === "MOVIE" && targetId) return `/movies/${targetId}`;
  if ((tType === "RESTAURANT" || tType === "BUSINESS") && (targetId || businessId || businessSlug)) {
    return restaurantHref({ id: targetId || businessId, slug: businessSlug || null });
  }
  const cat = String(promo.category || "").toUpperCase();
  if (cat === "DINING" && (businessId || businessSlug)) {
    return restaurantHref({ id: businessId, slug: businessSlug || null });
  }
  if (cat === "EVENTS") return targetId ? `/events/${targetId}` : "/events";
  if (cat === "MOVIES") return targetId ? `/movies/${targetId}` : "/movies";
  return businessId || businessSlug
    ? restaurantHref({ id: businessId, slug: businessSlug || null })
    : "/";
}

export function isPromotionHrefCurrentPage(
  href: string,
  category: string,
  targetId?: string
): boolean {
  if (!href || href === "#" || !targetId) return false;
  const path = href.split("?")[0];
  if (category === "DINING") {
    return path === `/restaurant/${targetId}` || path.startsWith("/restaurant/");
  }
  if (category === "EVENTS") return path === `/events/${targetId}`;
  if (category === "MOVIES") return path === `/movies/${targetId}` || path.startsWith("/movies/");
  return false;
}

export function defaultPartnerCtaUrl(
  module: "DINING" | "EVENTS" | "MOVIES",
  bizId: string,
  targetId?: string,
  bizSlug?: string | null
) {
  if (module === "DINING" && (bizId || bizSlug)) {
    return restaurantHref({ id: bizId, slug: bizSlug || null });
  }
  if (module === "EVENTS" && targetId) return `/events/${targetId}`;
  if (module === "MOVIES" && targetId) return `/movies/${targetId}`;
  return "";
}
