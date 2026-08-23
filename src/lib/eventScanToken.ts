/** Value encoded inside customer-facing ticket QR images (short, scannable). */
export function eventBookingQrValue(booking: {
  id: string;
  qr_code?: string | null;
  qr_payload?: string | null;
}): string {
  const code = booking.qr_code?.trim();
  if (code) return code;

  const payload = booking.qr_payload?.trim();
  if (payload?.startsWith("{")) {
    try {
      const parsed = JSON.parse(payload) as { code?: string; booking_id?: string };
      if (parsed.code?.trim()) return parsed.code.trim();
      if (parsed.booking_id?.trim()) return parsed.booking_id.trim();
    } catch {
      /* fall through */
    }
  }

  return booking.id;
}

/** Normalize raw camera / manual scan input before API lookup. */
export function normalizeEventScanInput(raw: string): string {
  return expandEventScanTokens(raw)[0] || raw.trim();
}

export function expandEventScanTokens(raw: unknown): string[] {
  const primary = String(raw || "").trim();
  if (!primary) return [];

  const tokens = new Set<string>([primary]);

  const evbMatch = primary.match(/EVB-[A-F0-9]{8,32}/i);
  if (evbMatch) tokens.add(evbMatch[0].toUpperCase());

  const bmbMatch = primary.match(/BMB-[A-F0-9]{8}-[A-F0-9]{4}/i);
  if (bmbMatch) tokens.add(bmbMatch[0].toUpperCase());

  const uuidMatch = primary.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  if (uuidMatch) tokens.add(uuidMatch[0].toLowerCase());

  if (primary.startsWith("{")) {
    try {
      const parsed = JSON.parse(primary) as { code?: string; booking_id?: string };
      if (parsed.code?.trim()) tokens.add(parsed.code.trim().toUpperCase());
      if (parsed.booking_id?.trim()) tokens.add(parsed.booking_id.trim().toLowerCase());
    } catch {
      /* ignore */
    }
  }

  if (/https?:\/\//i.test(primary) || primary.includes("confirmation?id=")) {
    try {
      const url = new URL(primary);
      const id = url.searchParams.get("id")?.trim();
      if (id) tokens.add(id.toLowerCase());
    } catch {
      const idParam = primary.match(/[?&]id=([0-9a-f-]{36})/i);
      if (idParam?.[1]) tokens.add(idParam[1].toLowerCase());
    }
  }

  return [...tokens]
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      if (t.toUpperCase().startsWith("EVB-")) return t.toUpperCase();
      if (t.toUpperCase().startsWith("BMB-")) return t.toUpperCase();
      return t;
    });
}

/** BMB-8E0AE344-BA5B → id prefix 8e0ae344ba5b */
export function bmbDisplayCodeToIdPrefix(code: string): string | null {
  const m = String(code || "")
    .trim()
    .toUpperCase()
    .match(/^BMB-([A-F0-9]{8})-([A-F0-9]{4})$/);
  if (!m) return null;
  return `${m[1]}${m[2]}`.toLowerCase();
}

/** True when guest was already checked in (status USED or timestamp set). */
export function isEventBookingCheckedIn(booking: {
  status?: string | null;
  checked_in_at?: string | null;
  already_checked_in?: boolean;
  just_checked_in?: boolean;
}): boolean {
  if (booking.just_checked_in) return false;
  if (booking.already_checked_in) return true;
  const status = String(booking.status || "").trim().toUpperCase();
  return status === "USED" || Boolean(booking.checked_in_at);
}
