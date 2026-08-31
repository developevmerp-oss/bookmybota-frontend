export type DiningOfferStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "SCHEDULED"
  | "EXPIRED"
  | "ARCHIVED";

export type DiningOffer = {
  id?: string;
  type: string;
  title: string;
  validity: string;
  promo_code?: string;
  discount_type?: "PERCENT" | "FLAT";
  discount_value?: number;
  max_discount?: number | null;
  min_bill_amount?: number;
  is_active?: boolean;
  per_day_limit?: number | null;
  status?: DiningOfferStatus;
  archived_at?: string | null;
  start_at?: string | null;
  end_at?: string | null;
};

export function createEmptyDiningOffer(): DiningOffer {
  return {
    id: crypto.randomUUID(),
    type: "Pre-Book Offer",
    title: "",
    validity: "",
    promo_code: "",
    discount_type: "PERCENT",
    discount_value: 10,
    max_discount: null,
    min_bill_amount: 0,
    is_active: false,
    per_day_limit: null,
    status: "DRAFT",
    archived_at: null,
    start_at: null,
    end_at: null,
  };
}

function parseStatus(raw: unknown, isActive: boolean): DiningOfferStatus {
  const s = String(raw || "").toUpperCase();
  if (
    s === "DRAFT" ||
    s === "ACTIVE" ||
    s === "PAUSED" ||
    s === "SCHEDULED" ||
    s === "EXPIRED" ||
    s === "ARCHIVED"
  ) {
    return s;
  }
  return isActive ? "ACTIVE" : "DRAFT";
}

export function getEffectiveDiningOfferStatus(
  offer: DiningOffer,
  now = new Date()
): DiningOfferStatus {
  if (offer.archived_at || offer.status === "ARCHIVED") return "ARCHIVED";

  const base =
    offer.status || (offer.is_active === false ? "PAUSED" : "ACTIVE");

  if (base === "DRAFT" || base === "PAUSED") {
    return base;
  }

  const todayStr = now.toISOString().slice(0, 10);

  if (offer.end_at && offer.end_at.slice(0, 10) < todayStr) return "EXPIRED";
  if (offer.start_at && offer.start_at.slice(0, 10) > todayStr) return "SCHEDULED";
  if (base === "ACTIVE") return "ACTIVE";
  return base;
}

export function isDiningOfferCustomerVisible(offer: DiningOffer): boolean {
  const status = getEffectiveDiningOfferStatus(offer);
  return status === "ACTIVE" || status === "SCHEDULED";
}

export function isDiningOfferRedeemable(offer: DiningOffer): boolean {
  return getEffectiveDiningOfferStatus(offer) === "ACTIVE";
}

export function normalizeDiningOffers(raw: unknown): DiningOffer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as DiningOffer;
      const title = String(o.title || "").trim();
      if (!title) return null;
      const isActive = o.is_active !== false;
      const status = parseStatus(o.status, isActive);
      return {
        id: o.id || crypto.randomUUID(),
        type: o.type || "Offer",
        title,
        validity: o.validity || "",
        promo_code: o.promo_code ? String(o.promo_code).trim().toUpperCase() : "",
        discount_type:
          o.discount_type === "FLAT" || o.discount_type === "PERCENT"
            ? o.discount_type
            : "PERCENT",
        discount_value: o.discount_value != null ? Number(o.discount_value) : undefined,
        max_discount: o.max_discount != null ? Number(o.max_discount) : null,
        min_bill_amount: o.min_bill_amount != null ? Number(o.min_bill_amount) : 0,
        is_active: status === "ACTIVE",
        per_day_limit: o.per_day_limit != null ? Number(o.per_day_limit) : null,
        status,
        archived_at: o.archived_at ? String(o.archived_at) : null,
        start_at: o.start_at ? String(o.start_at).slice(0, 10) : null,
        end_at: o.end_at ? String(o.end_at).slice(0, 10) : null,
      } as DiningOffer;
    })
    .filter(Boolean) as DiningOffer[];
}

export function primaryDiningOffer(raw: unknown): DiningOffer | null {
  const list = normalizeDiningOffers(raw).filter(isDiningOfferCustomerVisible);
  return list[0] ?? null;
}

export function listingOfferLabel(raw: unknown): string | null {
  const offer = primaryDiningOffer(raw);
  const title = offer?.title?.trim();
  return title || null;
}

export function bookingWidgetOfferLabel(raw: unknown): string | null {
  const offers = normalizeDiningOffers(raw).filter(isDiningOfferCustomerVisible);
  if (offers.length === 0) return null;
  const first = String(offers[0].title).trim();
  const extra = offers.length - 1;
  if (extra <= 0) return first;
  return `${first} + ${extra} more offer${extra > 1 ? "s" : ""}`;
}

export function formatDiningOfferDiscount(offer: DiningOffer): string {
  if (offer.discount_type === "FLAT" && offer.discount_value != null) {
    return `${offer.discount_value} ETB off`;
  }
  if (offer.discount_type === "PERCENT" && offer.discount_value != null) {
    const max =
      offer.max_discount != null && offer.max_discount > 0
        ? ` (max ${offer.max_discount} ETB)`
        : "";
    return `${offer.discount_value}% off${max}`;
  }
  return offer.title || "Offer";
}

export function calculateDiningOfferDiscountAmount(
  billAmount: number,
  offer: {
    discount_type?: string;
    discount_value?: number;
    max_discount?: number | null;
  }
): number {
  const gross = Math.round((Number(billAmount) || 0) * 100) / 100;
  if (gross <= 0) return 0;

  const discountType = offer.discount_type || "PERCENT";
  const discountValue = Number(offer.discount_value) || 0;
  let discount = 0;

  if (discountType === "FLAT") {
    discount = Math.min(discountValue, gross);
  } else {
    discount = Math.min(gross, (gross * discountValue) / 100);
    const maxDiscount =
      offer.max_discount != null ? Number(offer.max_discount) : null;
    if (maxDiscount != null && maxDiscount > 0) {
      discount = Math.min(discount, maxDiscount);
    }
  }

  return Math.round(discount * 100) / 100;
}

export function businessHasCustomerVisibleOffer(raw: unknown): boolean {
  return normalizeDiningOffers(raw).some(isDiningOfferCustomerVisible);
}

export function snapshotDiningOffer(
  raw: unknown,
  requested?: DiningOffer | null
): DiningOffer | null {
  if (requested === null || requested === undefined) return null;

  const list = normalizeDiningOffers(raw).filter(isDiningOfferRedeemable);
  if (list.length === 0) return null;

  let match: DiningOffer | undefined;
  if (requested.id) match = list.find((o) => o.id === requested.id);
  if (!match && requested.promo_code) {
    const code = requested.promo_code.trim().toUpperCase();
    match = list.find((o) => o.promo_code === code);
  }
  if (!match && requested.title) {
    match = list.find(
      (o) => o.title === requested.title && (!requested.type || o.type === requested.type)
    );
  }
  if (!match) return null;

  return {
    id: match.id,
    type: match.type || "Offer",
    title: String(match.title).trim(),
    validity: match.validity || "",
    promo_code: match.promo_code,
    discount_type: match.discount_type,
    discount_value: match.discount_value,
    max_discount: match.max_discount,
    min_bill_amount: match.min_bill_amount,
    is_active: match.is_active,
    status: match.status,
  };
}

export function validateDiningOffersForSave(offers: DiningOffer[]): string | null {
  const codes = new Set<string>();
  for (const o of offers) {
    if (!o.title?.trim()) return "Each offer needs a title.";
    const code = o.promo_code?.trim().toUpperCase();
    if (code) {
      if (codes.has(code)) return `Duplicate promo code: ${code}`;
      codes.add(code);
    }
    if (o.discount_value == null || !Number.isFinite(Number(o.discount_value))) {
      return `"${o.title}" needs a discount value.`;
    }
    if (Number(o.discount_value) < 0) return `"${o.title}" discount value cannot be negative.`;
    if (o.discount_type === "PERCENT" && Number(o.discount_value) > 100) {
      return "Percent discount cannot exceed 100.";
    }
  }
  return null;
}

export function diningOfferStatusBadgeClass(status: DiningOfferStatus): string {
  const colors: Record<DiningOfferStatus, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    SCHEDULED: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    DRAFT: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    PAUSED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    EXPIRED: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30",
    ARCHIVED: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  };
  return colors[status] || colors.DRAFT;
}
