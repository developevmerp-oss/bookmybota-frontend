/** Customer filter categories for gift card designs (API uses ENTERTAINING | LOVE). */

export type GiftCardDesignCategoryFilter = "all" | "ENTERTAINING" | "LOVE";

export const GIFT_CARD_DESIGN_CATEGORIES: {
  key: GiftCardDesignCategoryFilter;
  label: string;
}[] = [
  { key: "all", label: "All" },
  { key: "ENTERTAINING", label: "Entertaining Gifts" },
  { key: "LOVE", label: "Made with Love" },
];

export const DEFAULT_DESIGN_GRADIENT =
  "from-[#8B5CF6] via-[#A78BFA] to-[#DDD6FE]";
