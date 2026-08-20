export type DiningOffer = {
  type?: string;
  title?: string;
  validity?: string;
};

export function normalizeDiningOffers(raw: unknown): DiningOffer[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is DiningOffer => {
    if (!item || typeof item !== "object") return false;
    const title = String((item as DiningOffer).title || "").trim();
    return title.length > 0;
  });
}

export function primaryDiningOffer(raw: unknown): DiningOffer | null {
  return normalizeDiningOffers(raw)[0] ?? null;
}

export function listingOfferLabel(raw: unknown): string | null {
  const offer = primaryDiningOffer(raw);
  const title = offer?.title?.trim();
  return title || null;
}

export function bookingWidgetOfferLabel(raw: unknown): string | null {
  const offers = normalizeDiningOffers(raw);
  if (offers.length === 0) return null;
  const first = String(offers[0].title).trim();
  const extra = offers.length - 1;
  if (extra <= 0) return first;
  return `${first} + ${extra} more offer${extra > 1 ? "s" : ""}`;
}

export function snapshotDiningOffer(
  raw: unknown,
  requested?: DiningOffer | null
): DiningOffer | null {
  const list = normalizeDiningOffers(raw);
  if (list.length === 0) return null;
  if (requested?.title) {
    const match = list.find(
      (offer) =>
        offer.title === requested.title &&
        (!requested.type || offer.type === requested.type)
    );
    if (match) {
      return {
        type: match.type || "Offer",
        title: String(match.title).trim(),
        validity: match.validity || "",
      };
    }
  }
  const first = list[0];
  return {
    type: first.type || "Offer",
    title: String(first.title).trim(),
    validity: first.validity || "",
  };
}
