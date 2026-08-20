/**
 * Project currency — Ethiopian Birr (ETB).
 * Use these helpers for all money display in the UI.
 *
 * Display style: "30 ETB" / "1,250.00 ETB" (amount first, then code).
 */

export const CURRENCY_CODE = 'ETB';
export const CURRENCY_LOCALE = 'en-ET';
export const CURRENCY_SYMBOL = 'ETB';

type FormatMoneyOptions = {
  /** Decimal places (default 2; set 0 for whole amounts) */
  decimals?: number;
  /** Shorthand for decimals: 0 → e.g. "30 ETB" */
  compact?: boolean;
};

/**
 * Format an amount for display across the app.
 * @example formatMoney(30, { compact: true }) → "30 ETB"
 * @example formatMoney(1250.5) → "1,250.50 ETB"
 */
export function formatMoney(
  amount: number | string | undefined | null,
  options?: FormatMoneyOptions
): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) {
    const decimals = options?.compact ? 0 : (options?.decimals ?? 2);
    const zero = (0).toLocaleString(CURRENCY_LOCALE, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${zero} ${CURRENCY_SYMBOL}`;
  }
  const decimals = options?.compact ? 0 : (options?.decimals ?? 2);
  const formatted = n.toLocaleString(CURRENCY_LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${formatted} ${CURRENCY_SYMBOL}`;
}

/** @deprecated Use formatMoney — kept for gradual migration */
export const formatCurrency = formatMoney;

/** Dining budget tier labels (low → high) */
export const PRICE_TIERS = ['Br', 'Br Br', 'Br Br Br', 'Br Br Br Br'] as const;

/** Convert legacy ₹ tier strings stored in DB to Br tiers */
export function normalizePriceRange(range?: string | null): string {
  if (!range) return '';
  return range.replace(/₹/g, 'Br');
}

export function getCostForTwoFromRange(priceRange?: string | null): string {
  const tier = normalizePriceRange(priceRange);
  if (tier === 'Br') return `${formatMoney(250, { compact: true })} for two (approx.)`;
  if (tier === 'Br Br') return `${formatMoney(500, { compact: true })} for two (approx.)`;
  if (tier === 'Br Br Br') return `${formatMoney(1000, { compact: true })} for two (approx.)`;
  if (tier === 'Br Br Br Br') return `${formatMoney(2000, { compact: true })} for two (approx.)`;
  return `${formatMoney(450, { compact: true })} for two (approx.)`;
}

export function formatOfferDiscount(
  discountType: 'PERCENT' | 'FLAT' | string,
  discountValue: number | string
): string {
  if (discountType === 'PERCENT') return `${discountValue}% off`;
  return `${formatMoney(discountValue, { compact: true })} off`;
}
