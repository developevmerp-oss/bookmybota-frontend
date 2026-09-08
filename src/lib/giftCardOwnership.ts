/**
 * Wallet vs sent-gift classification for customer gift cards.
 * - Wallet: cards the logged-in customer can spend (claimed, or legacy SELF).
 * - Sent: gifts this customer bought for someone else (tracking only).
 */

export type GiftCardOwnershipLike = {
  purchase_for?: string | null;
  is_owner?: boolean;
  is_claimed_by_me?: boolean;
  is_spendable?: boolean;
  claimed_by_customer_id?: string | null;
};

export function isGiftCardSpendable(card: GiftCardOwnershipLike): boolean {
  if (typeof card.is_spendable === "boolean") return card.is_spendable;
  if (card.is_claimed_by_me) return true;
  const purchaseFor = String(card.purchase_for || "").toUpperCase();
  if (purchaseFor !== "SOMEONE_ELSE" && card.is_owner) return true;
  return false;
}

/** Usable / claimed cards in "My wallet". */
export function isGiftCardInWallet(card: GiftCardOwnershipLike): boolean {
  return isGiftCardSpendable(card);
}

/**
 * Gifts this customer purchased for someone else and has not claimed themselves.
 * Includes unclaimed and claimed-by-recipient cards (purchase history).
 */
export function isGiftCardSentGift(card: GiftCardOwnershipLike): boolean {
  const purchaseFor = String(card.purchase_for || "").toUpperCase();
  if (purchaseFor !== "SOMEONE_ELSE") return false;
  if (!card.is_owner) return false;
  if (card.is_claimed_by_me) return false;
  return true;
}

export type SentGiftClaimState = "awaiting_claim" | "claimed_by_recipient" | "unknown";

export function getSentGiftClaimState(
  card: GiftCardOwnershipLike & { is_claimed?: boolean }
): SentGiftClaimState {
  if (!isGiftCardSentGift(card)) return "unknown";
  if (card.is_claimed || card.claimed_by_customer_id) return "claimed_by_recipient";
  return "awaiting_claim";
}
