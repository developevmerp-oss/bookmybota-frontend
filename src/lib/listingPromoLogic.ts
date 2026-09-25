import type { MarketingCampaign } from "@/services/api";
import { hasCityFilter } from "@/components/LandingPage/homeUtils";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export type ListingPromoCategory = "DINING" | "MOVIES" | "EVENTS";

/** Same city gating as landing PromoBannerCarousel / CategoryPromoBanners. */
export function listingPromoQueryArgs(
  category: ListingPromoCategory,
  city: string
): { category: ListingPromoCategory; surface: "slider"; city?: string } {
  const hasCity = hasCityFilter(city);
  return {
    category,
    surface: "slider",
    ...(hasCity ? { city } : {}),
  };
}

/** Landing-style: only campaigns that already have a banner creative. */
export function campaignsWithBanner(campaigns: MarketingCampaign[]): MarketingCampaign[] {
  return campaigns.filter((c) => Boolean(resolveMediaUrl(c.banner_image_url || "")?.trim()));
}

/**
 * Listing promo priority (landing-aligned):
 * 1. Paid slider campaigns with banners
 * 2. Caller-supplied promoted-entity slides
 * 3. Empty → hide slider
 */
export function selectListingPromoSlides<T>(opts: {
  campaigns: MarketingCampaign[];
  mapCampaign: (campaign: MarketingCampaign) => T | null;
  promotedFallback: T[];
  max?: number;
}): T[] {
  const max = opts.max ?? 8;
  const fromCampaigns = campaignsWithBanner(opts.campaigns)
    .slice(0, max)
    .map(opts.mapCampaign)
    .filter((s): s is T => s != null);
  if (fromCampaigns.length > 0) return fromCampaigns;
  return opts.promotedFallback.slice(0, max);
}

/** Duplicate slides so peek carousels can loop (same as landing). */
export function duplicateSlidesForPeek<T extends { id: string }>(slides: T[], minNeeded = 6): T[] {
  if (slides.length <= 1) return slides;
  if (slides.length >= minNeeded) return slides;
  const out: T[] = [];
  let copy = 0;
  while (out.length < minNeeded) {
    for (const s of slides) {
      out.push(copy === 0 ? s : { ...s, id: `${s.id}__c${copy}` });
      if (out.length >= minNeeded) break;
    }
    copy += 1;
  }
  return out;
}
