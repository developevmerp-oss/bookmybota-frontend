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
 * Default: hides trailing .00 (e.g. "2,000 ETB") but keeps cents when present ("129.99 ETB").
 * @example formatMoney(30, { compact: true }) → "30 ETB"
 * @example formatMoney(1250) → "1,250 ETB"
 * @example formatMoney(1250.5) → "1,250.5 ETB"
 * @example formatMoney(1250.5, { decimals: 2 }) → "1,250.50 ETB"
 */
export function formatMoney(
  amount: number | string | undefined | null,
  options?: FormatMoneyOptions
): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) {
    return `0 ${CURRENCY_SYMBOL}`;
  }

  if (options?.compact) {
    const formatted = Math.round(n).toLocaleString(CURRENCY_LOCALE);
    return `${formatted} ${CURRENCY_SYMBOL}`;
  }

  if (options?.decimals != null) {
    const formatted = n.toLocaleString(CURRENCY_LOCALE, {
      minimumFractionDigits: options.decimals,
      maximumFractionDigits: options.decimals,
    });
    return `${formatted} ${CURRENCY_SYMBOL}`;
  }

  // Project default: hide .00, show fractional cents when present
  return formatMoneyDisplay(amount);
}

/**
 * Format money — hides .00 decimals but keeps cents when present.
 * @example formatMoneyDisplay(2000) → "2,000 ETB"
 * @example formatMoneyDisplay(129.99) → "129.99 ETB"
 */
export function formatMoneyDisplay(
  amount: number | string | undefined | null
): string {
  return `${formatWholeNumber(amount)} ${CURRENCY_SYMBOL}`;
}

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
  if (discountType === 'PERCENT') return `${formatWholeNumber(discountValue)}% off`;
  return `${formatMoney(discountValue, { compact: true })} off`;
}

/** Whole numbers without trailing .00 — e.g. 20, 200, 1,250.5 */
export function formatWholeNumber(amount: number | string | undefined | null): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n - Math.round(n)) < 1e-9) {
    return Math.round(n).toLocaleString(CURRENCY_LOCALE);
  }
  return n.toLocaleString(CURRENCY_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
