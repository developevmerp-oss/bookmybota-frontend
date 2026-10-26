import type { MarketingCampaign, PublicEvent } from "@/services/api";
import { hasCityFilter } from "@/components/LandingPage/homeUtils";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import type { EventCategoryKey } from "@/lib/eventCategories";

export type ListingPromoCategory = "DINING" | "MOVIES" | "EVENTS" | "SPORTS";

/**
 * Which plan placement feeds the top slider:
 * listing = module listing page (/dining, /events, /movies) · category = event category page.
 * The main home hero uses the separate "slider" surface (PromoBannerCarousel).
 */
export type ListingPromoPlacement = "listing" | "category";

/** Same city gating as landing PromoBannerCarousel. */
export function listingPromoQueryArgs(
  category: ListingPromoCategory,
  city: string,
  placement: ListingPromoPlacement = "listing"
): { category: ListingPromoCategory; surface: ListingPromoPlacement; city?: string } {
  const hasCity = hasCityFilter(city);
  return {
    category,
    surface: placement,
    ...(hasCity ? { city } : {}),
  };
}

/** Landing-style: only campaigns that already have a banner creative. */
export function campaignsWithBanner(campaigns: MarketingCampaign[]): MarketingCampaign[] {
  return campaigns.filter((c) => Boolean(resolveMediaUrl(c.banner_image_url || "")?.trim()));
}

/**
 * Listing promo priority (landing-aligned):
 * 1. Paid campaigns for this page placement that have banners
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

type EventCategoryMatcher = (
  event: PublicEvent,
  key: EventCategoryKey,
  categories: Array<{ slug: string; name: string }>
) => boolean;

/**
 * On concert/comedy/music/sports browse pages, keep only campaigns linked to a
 * matching event. Unscoped campaigns (no target_id) stay on the general Events page.
 */
export function filterCampaignsForEventCategory(
  campaigns: MarketingCampaign[],
  opts: {
    categoryKey: EventCategoryKey | null;
    eventsById: Map<string, PublicEvent>;
    categories: Array<{ slug: string; name: string }>;
    matches: EventCategoryMatcher;
  }
): MarketingCampaign[] {
  const { categoryKey, eventsById, categories, matches } = opts;
  if (!categoryKey) return campaigns;

  return campaigns.filter((campaign) => {
    const tid = String(campaign.target_id || "").trim();
    if (!tid) return false;
    const event = eventsById.get(tid);
    if (!event) return false;
    return matches(event, categoryKey, categories);
  });
}
