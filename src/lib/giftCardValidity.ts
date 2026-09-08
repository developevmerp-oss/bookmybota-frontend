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

/** BookMyShow-style short phrase used in gift emails / mail preview. */
export function formatGiftCardValidityPhrase(days: number): string {
  const d = Math.round(Number(days) || DEFAULT_GIFT_CARD_VALIDITY_DAYS);
  if (d === 90) return "three months";
  if (d === 180) return "six months";
  if (d === 365) return "twelve months";
  if (d === 730) return "twenty-four months";
  return `${d} days`;
}

/**
 * Last valid calendar day = delivery UTC date + validity days (end of that day).
 * BookMyShow-aligned: validity starts from delivery, not payment.
 * Example: deliver 09-08-2026 + 365 days → 09-08-2027.
 */
export function computeGiftCardExpiryDate(
  deliveryAt: Date,
  validityDays: number
): Date {
  const days = Math.max(1, Math.round(Number(validityDays) || DEFAULT_GIFT_CARD_VALIDITY_DAYS));
  const y = deliveryAt.getUTCFullYear();
  const m = deliveryAt.getUTCMonth();
  const d = deliveryAt.getUTCDate();
  return new Date(Date.UTC(y, m, d + days, 23, 59, 59, 999));
}

/** Display expiry as MM-DD-YYYY using UTC calendar day (matches stored expires_at). */
export function formatGiftCardExpiryDate(
  expiresAt: string | Date | null | undefined
): string {
  if (!expiresAt) return "—";
  const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  if (Number.isNaN(d.getTime())) return "—";
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}-${dd}-${yyyy}`;
}
