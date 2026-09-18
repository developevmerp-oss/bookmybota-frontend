import { VENUE_TYPE_LABELS } from './venueCategoryConfig';

export type ContactPersonLike = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export function parseContactPerson(description?: string | null): string {
  if (!description) return '';
  const match = description.match(/Contact persons?:\s*(.+)/i);
  return match?.[1]?.trim() || '';
}

/** Prefer JSON contact_persons; fall back to legacy description parsing. */
export function resolveContactPersons(biz?: {
  contact_persons?: ContactPersonLike[] | null;
  description?: string | null;
  admin_email?: string | null;
  phone?: string | null;
} | null): Array<{ name: string; email: string; phone: string }> {
  const rows = Array.isArray(biz?.contact_persons) ? biz!.contact_persons! : [];
  const normalized = rows
    .map((c) => ({
      name: String(c?.name || '').trim(),
      email: String(c?.email || '').trim(),
      phone: String(c?.phone || '').trim(),
    }))
    .filter((c) => c.name || c.email || c.phone);
  if (normalized.length > 0) return normalized;

  const legacyName = parseContactPerson(biz?.description);
  if (legacyName || biz?.admin_email || biz?.phone) {
    return [
      {
        name: legacyName,
        email: String(biz?.admin_email || '').trim(),
        phone: String(biz?.phone || '').trim(),
      },
    ];
  }
  return [];
}

export function venueTypeDisplayName(slug?: string | null, fallbackName?: string | null): string {
  const key = String(slug || '').toLowerCase();
  return VENUE_TYPE_LABELS[key] || fallbackName || slug || 'Venue';
}
