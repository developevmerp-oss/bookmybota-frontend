import { VENUE_TYPE_LABELS } from './venueCategoryConfig';

export function parseContactPerson(description?: string | null): string {
  if (!description) return '';
  const match = description.match(/Contact person:\s*(.+)/i);
  return match?.[1]?.trim() || '';
}

export function venueTypeDisplayName(slug?: string | null, fallbackName?: string | null): string {
  const key = String(slug || '').toLowerCase();
  return VENUE_TYPE_LABELS[key] || fallbackName || slug || 'Venue';
}
