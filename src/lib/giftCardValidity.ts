/** Default gift card validity (mirrors backend). Superadmin can override via API. */
export const DEFAULT_GIFT_CARD_VALIDITY_DAYS = 365;

export const GIFT_CARD_VALIDITY_OPTIONS: readonly number[] = [90, 180, 365, 730] as const;

export function formatGiftCardValidityLabel(days: number): string {
  const d = Math.round(Number(days) || DEFAULT_GIFT_CARD_VALIDITY_DAYS);
  if (d === 90) return "3 months (90 days)";
  if (d === 180) return "6 months (180 days)";
  if (d === 365) return "12 months (365 days)";
  if (d === 730) return "24 months (730 days)";
  return `${d} days`;
}
