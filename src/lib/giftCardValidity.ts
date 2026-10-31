import {
  formatDateCustomer,
  formatTime12h,
  formatDateTimeCustomer,
} from "@/lib/dateFormat";

/** Default gift card validity (mirrors backend). Superadmin can override via API. */
export const DEFAULT_GIFT_CARD_VALIDITY_DAYS = 365;

export const GIFT_CARD_VALIDITY_OPTIONS: readonly number[] = [90, 180, 365, 730] as const;

export function formatGiftCardValidityLabel(days: number): string {
  const d = Math.round(Number(days) || DEFAULT_GIFT_CARD_VALIDITY_DAYS);
  if (d === 90) return "3 Months (90 Days)";
  if (d === 180) return "6 Months (180 Days)";
  if (d === 365) return "12 Months (365 Days)";
  if (d === 730) return "24 Months (730 Days)";
  return `${d} Days`;
}

/** Short phrase used in gift emails / mail preview. */
export function formatGiftCardValidityPhrase(days: number): string {
  const d = Math.round(Number(days) || DEFAULT_GIFT_CARD_VALIDITY_DAYS);
  if (d === 90) return "three months";
  if (d === 180) return "six months";
  if (d === 365) return "twelve months";
  if (d === 730) return "twenty-four months";
  return `${d} days`;
}

/**
 * Last valid calendar day in Ethiopia (Africa/Addis_Ababa, UTC+3).
 * Day ends at 23:59:59.999 in Ethiopia, which corresponds to 20:59:59.999 UTC in the database.
 *
 * Example: start 30-10-2026 + 365 days -> valid through 29-10-2027 (11:59 PM in Ethiopia).
 */
export function computeGiftCardExpiryDate(
  deliveryAt: Date,
  validityDays: number
): Date {
  const days = Math.max(1, Math.round(Number(validityDays) || DEFAULT_GIFT_CARD_VALIDITY_DAYS));
  const y = deliveryAt.getUTCFullYear();
  const m = deliveryAt.getUTCMonth();
  const d = deliveryAt.getUTCDate();
  // 23:59:59.999 in Ethiopia (Africa/Addis_Ababa, UTC+3) is 20:59:59.999 UTC
  return new Date(Date.UTC(y, m, d + days - 1, 20, 59, 59, 999));
}

/** Display expiry date in Ethiopia timezone ("29 October 2027"). */
export function formatGiftCardExpiryDate(
  expiresAt: string | Date | null | undefined
): string {
  return formatDateCustomer(expiresAt);
}

/** Display expiry time dynamically in Ethiopia timezone ("11:59 PM"). */
export function formatGiftCardExpiryTime(
  expiresAt: string | Date | null | undefined
): string {
  return formatTime12h(expiresAt);
}

/** Display full expiry date & time dynamically in Ethiopia timezone ("29 October 2027, 11:59 PM"). */
export function formatGiftCardExpiryDateTime(
  expiresAt: string | Date | null | undefined
): string {
  return formatDateTimeCustomer(expiresAt);
}
