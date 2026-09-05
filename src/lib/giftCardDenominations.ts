/** BookMyShow-style fixed gift card denominations (ETB). */
export const GIFT_CARD_DENOMINATIONS: readonly number[] = [
  100, 250, 500, 750, 1000, 1500, 2000, 2500, 5000,
] as const;

export function isAllowedGiftCardDenomination(value: number): boolean {
  const n = Math.round(Number(value) * 100) / 100;
  return (GIFT_CARD_DENOMINATIONS as readonly number[]).includes(n);
}

export function formatGiftCardProductName(denomination: number): string {
  const n = Math.round(Number(denomination));
  const label = n >= 1000 ? n.toLocaleString("en-US") : String(n);
  return `BookMyBota Gift Card ${label} ETB`;
}

/** Chip / label: "100 ETB", "1,000 ETB" */
export function formatGiftCardAmountLabel(denomination: number): string {
  const n = Math.round(Number(denomination));
  const label = n >= 1000 ? n.toLocaleString("en-US") : String(n);
  return `${label} ETB`;
}
