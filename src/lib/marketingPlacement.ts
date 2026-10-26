/**
 * Marketing plan placement — which customer pages a paid promotion appears on.
 * Mirrors backend `utils/marketingPlacement.ts`; the legacy flags stay in sync with it.
 */
export type MarketingPlacement =
  | "HOME_SLIDER"
  | "LISTING"
  | "CATEGORY"
  | "ALL_PAGES"
  | "LISTING_CATEGORY";

export type PlacementFlagsLike = {
  placement?: string | null;
  listing_boost?: boolean | null;
  landing_slider?: boolean | null;
  category_rail?: boolean | null;
};

export type PlacementOption = {
  value: MarketingPlacement;
  /** Full benefit name (plan form, info popover). */
  label: string;
  /** Where it shows, in plain words. */
  pages: string;
  /** Compact chip text (tables, cards). */
  short: string;
  /** Category pages exist for Events only. */
  needsCategoryPages: boolean;
};

export const PLACEMENT_OPTIONS: PlacementOption[] = [
  {
    value: "HOME_SLIDER",
    label: "Landing hero slider",
    pages: "Main home page banner slider",
    short: "Home slider",
    needsCategoryPages: false,
  },
  {
    value: "LISTING",
    label: "Listing boost + PROMOTED badge",
    pages: "Shown first with a PROMOTED badge on its listing page (Dining / Events / Movies)",
    short: "Listing boost",
    needsCategoryPages: false,
  },
  {
    value: "CATEGORY",
    label: "Category slider",
    pages: "Banner slider + PROMOTED badge on its category page only (Concert, Comedy, Music, Sports)",
    short: "Category slider",
    needsCategoryPages: true,
  },
  {
    value: "ALL_PAGES",
    label: "All three pages",
    pages: "Home page slider + listing page boost + category page slider",
    short: "All pages",
    needsCategoryPages: false,
  },
  {
    value: "LISTING_CATEGORY",
    label: "Listing + category",
    pages: "Listing page boost + category page slider",
    short: "Listing + category",
    needsCategoryPages: true,
  },
];

const FLAGS: Record<
  MarketingPlacement,
  { landing_slider: boolean; listing_boost: boolean; category_rail: boolean }
> = {
  HOME_SLIDER: { landing_slider: true, listing_boost: false, category_rail: false },
  LISTING: { landing_slider: false, listing_boost: true, category_rail: false },
  CATEGORY: { landing_slider: false, listing_boost: false, category_rail: true },
  ALL_PAGES: { landing_slider: true, listing_boost: true, category_rail: true },
  LISTING_CATEGORY: { landing_slider: false, listing_boost: true, category_rail: true },
};

export function placementFlags(placement: MarketingPlacement) {
  return FLAGS[placement];
}

/** Placement of a plan / campaign row (falls back to legacy flags for old payloads). */
export function placementOf(plan: PlacementFlagsLike | null | undefined): MarketingPlacement {
  const raw = String(plan?.placement || "").toUpperCase();
  if (raw in FLAGS) return raw as MarketingPlacement;
  const home = Boolean(plan?.landing_slider);
  const listing = plan?.listing_boost !== false;
  const category = Boolean(plan?.category_rail);
  if (home) return listing || category ? "ALL_PAGES" : "HOME_SLIDER";
  if (listing && category) return "LISTING_CATEGORY";
  if (category) return "CATEGORY";
  return "LISTING";
}

export function placementOption(plan: PlacementFlagsLike | null | undefined): PlacementOption {
  const value = placementOf(plan);
  return PLACEMENT_OPTIONS.find((o) => o.value === value) ?? PLACEMENT_OPTIONS[1];
}

/** Home hero and category slider placements need a 3:1 banner creative. */
export function placementNeedsBanner(plan: PlacementFlagsLike | null | undefined): boolean {
  const flags = FLAGS[placementOf(plan)];
  return flags.landing_slider || flags.category_rail;
}

/** CATEGORY / LISTING_CATEGORY need a module that has category pages (Events or All). */
export function placementAllowedForModule(placement: MarketingPlacement, module?: string | null) {
  const option = PLACEMENT_OPTIONS.find((o) => o.value === placement);
  if (!option?.needsCategoryPages) return true;
  const m = String(module || "ALL").toUpperCase();
  return m === "ALL" || m === "EVENTS";
}
