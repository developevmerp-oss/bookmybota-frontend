import {
  getVenueDamagedSeatCount,
  getVenueMetaFields,
  getVenueSellableCapacity,
  type VenueMeta,
} from './venueCategoryConfig';
import type { BusinessSettings } from '@/services/api';
import { normalizeUploadPath } from '@/lib/mediaUrl';

export type LayoutZoneRow = { name: string; capacity: string };

export type LayoutRequestFormDefaults = {
  hallName: string;
  hallDescription: string;
  hallCapacity: string;
  layoutName: string;
  layoutType: string;
  capacity: string;
  zones: LayoutZoneRow[];
  notes: string;
  isIndoor: boolean;
  referenceImages: string[];
  sellableCapacity: number | null;
  grossCapacity: number | null;
  profileComplete: boolean;
};

const SEAT_CATEGORY_ZONES: Array<{ keys: string[]; label: string }> = [
  { keys: ['vvip_capacity', 'vvip_sections'], label: 'VVIP' },
  { keys: ['vip_capacity', 'vip_seats', 'vip_sections'], label: 'VIP' },
  { keys: ['premium_seats', 'premium_sections'], label: 'Premium' },
  { keys: ['regular_seats', 'general_sections'], label: 'Regular' },
  { keys: ['seating_capacity'], label: 'Seating' },
  { keys: ['standing_capacity', 'standing_area_capacity'], label: 'Standing' },
  { keys: ['fan_pit_capacity'], label: 'Fan Pit' },
  { keys: ['general_admission_capacity'], label: 'General Admission' },
  { keys: ['accessible_seats', 'wheelchair_seats', 'wheelchair_spaces'], label: 'Accessible' },
];

const PROFILE_DOC_KEYS = ['seating_plan', 'floor_plan', 'layout_blueprint', 'site_plan'] as const;

function numField(fields: Record<string, string | number | boolean>, key: string): number {
  const n = Number(fields[key]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function mapVenueTypeToLayoutType(slug?: string | null): string {
  const key = String(slug || '').toLowerCase();
  if (key === 'auditorium') return 'theater';
  if (key === 'banquet-hall') return 'banquet';
  if (key === 'conference-center') return 'conference';
  if (key === 'concert-arena' || key === 'outdoor-venue') return 'standing';
  if (key === 'stadium' || key === 'exhibition-expo') return 'mixed';
  return 'theater';
}

export function computeVenueGrossCapacity(fields: Record<string, string | number | boolean>): number {
  const explicit =
    numField(fields, 'total_capacity') ||
    numField(fields, 'max_capacity') ||
    numField(fields, 'seating_capacity');
  if (explicit > 0) {
    const balcony =
      (fields.balcony_available === true || fields.balcony_available === 'true')
        ? numField(fields, 'balcony_capacity')
        : 0;
    return explicit + balcony;
  }

  const grid =
    numField(fields, 'sections') * numField(fields, 'rows') * numField(fields, 'seats_per_row');
  if (grid > 0) {
    const balcony =
      (fields.balcony_available === true || fields.balcony_available === 'true')
        ? numField(fields, 'balcony_capacity')
        : 0;
    return grid + balcony;
  }

  let zoneSum = 0;
  for (const zone of SEAT_CATEGORY_ZONES) {
    for (const key of zone.keys) zoneSum += numField(fields, key);
  }
  if (numField(fields, 'balcony_capacity') > 0) zoneSum += numField(fields, 'balcony_capacity');
  return zoneSum;
}

export function computeVenueSellableCapacityFromFields(
  fields: Record<string, string | number | boolean>
): number {
  const gross = computeVenueGrossCapacity(fields);
  if (gross <= 0) return 0;
  const meta: VenueMeta = { fields };
  return getVenueSellableCapacity(gross, meta);
}

export function buildZonesFromVenueMeta(
  fields: Record<string, string | number | boolean>
): LayoutZoneRow[] {
  const zones: LayoutZoneRow[] = [];

  for (const zone of SEAT_CATEGORY_ZONES) {
    for (const key of zone.keys) {
      const count = numField(fields, key);
      if (count > 0) {
        zones.push({ name: zone.label, capacity: String(count) });
        break;
      }
    }
  }

  if (fields.balcony_available === true || fields.balcony_available === 'true') {
    const balcony = numField(fields, 'balcony_capacity');
    if (balcony > 0) zones.push({ name: 'Balcony', capacity: String(balcony) });
  }

  if (zones.length === 0) {
    const sections = numField(fields, 'sections');
    const rows = numField(fields, 'rows');
    const seatsPerRow = numField(fields, 'seats_per_row');
    if (sections > 0 && rows > 0 && seatsPerRow > 0) {
      const perSection = rows * seatsPerRow;
      for (let i = 1; i <= sections; i += 1) {
        zones.push({ name: `Section ${i}`, capacity: String(perSection) });
      }
    }
  }

  if (zones.length === 0) {
    const sellable = computeVenueSellableCapacityFromFields(fields);
    if (sellable > 0) zones.push({ name: 'General', capacity: String(sellable) });
  }

  return zones.length ? zones : [{ name: '', capacity: '' }];
}

export function buildLayoutNotesFromVenueMeta(
  fields: Record<string, string | number | boolean>,
  venueTypeName?: string | null
): string {
  const lines: string[] = [];
  if (venueTypeName?.trim()) lines.push(`Venue type: ${venueTypeName.trim()}`);

  const stageW = numField(fields, 'stage_width');
  const stageD = numField(fields, 'stage_depth');
  if (fields.stage_available === true || fields.stage_available === 'true' || stageW || stageD) {
    lines.push(
      `Stage: ${stageW || '—'}m × ${stageD || '—'}m` +
        (fields.stage_position ? ` (${fields.stage_position})` : '')
    );
  }

  const sections = numField(fields, 'sections');
  const rows = numField(fields, 'rows');
  const seatsPerRow = numField(fields, 'seats_per_row');
  if (sections || rows || seatsPerRow) {
    lines.push(`Seating grid: ${sections || '—'} sections · ${rows || '—'} rows · ${seatsPerRow || '—'} seats/row`);
  }

  const damaged = getVenueDamagedSeatCount({ fields });
  if (damaged > 0) lines.push(`Damaged / unavailable seats: ${damaged}`);

  const aisles = numField(fields, 'aisles');
  if (aisles > 0) lines.push(`Aisles: ${aisles}`);

  const entrances = numField(fields, 'entrances');
  const exits = numField(fields, 'exits');
  if (entrances || exits) lines.push(`Access: ${entrances || 0} entrances · ${exits || 0} exits`);

  return lines.join('\n');
}

export function getReferenceImagesFromVenueMeta(
  fields: Record<string, string | number | boolean>
): string[] {
  const urls: string[] = [];
  for (const key of PROFILE_DOC_KEYS) {
    const value = fields[key];
    if (typeof value === 'string' && value.trim()) urls.push(normalizeUploadPath(value.trim()));
  }
  return [...new Set(urls)];
}

export function isVenueProfileReadyForLayout(meta?: VenueMeta | null): boolean {
  const fields = getVenueMetaFields(meta);
  return computeVenueGrossCapacity(fields) > 0;
}

export function buildLayoutRequestDefaults(settings?: BusinessSettings | null): LayoutRequestFormDefaults {
  const meta =
    settings?.venue_meta && typeof settings.venue_meta === 'object'
      ? (settings.venue_meta as VenueMeta)
      : { fields: {} };
  const fields = getVenueMetaFields(meta);
  const gross = computeVenueGrossCapacity(fields);
  const sellable = computeVenueSellableCapacityFromFields(fields);
  const venueName = settings?.name?.trim() || 'Main Hall';
  const layoutType = mapVenueTypeToLayoutType(settings?.venue_type_slug);

  return {
    hallName: venueName,
    hallDescription: settings?.address?.trim() || '',
    hallCapacity: gross > 0 ? String(gross) : '300',
    layoutName: `${venueName} seating layout`,
    layoutType,
    capacity: sellable > 0 ? String(sellable) : gross > 0 ? String(sellable || gross) : '300',
    zones: buildZonesFromVenueMeta(fields),
    notes: buildLayoutNotesFromVenueMeta(fields, settings?.venue_type_name),
    isIndoor: settings?.venue_type_slug !== 'outdoor-venue',
    referenceImages: getReferenceImagesFromVenueMeta(fields),
    sellableCapacity: sellable > 0 ? sellable : null,
    grossCapacity: gross > 0 ? gross : null,
    profileComplete: isVenueProfileReadyForLayout(meta),
  };
}

export function buildVenueMetaSnapshot(
  settings?: BusinessSettings | null
): Record<string, unknown> {
  const meta =
    settings?.venue_meta && typeof settings.venue_meta === 'object'
      ? (settings.venue_meta as VenueMeta)
      : { fields: {} };
  const fields = getVenueMetaFields(meta);
  return {
    fields,
    venue_type_slug: settings?.venue_type_slug || null,
    venue_type_name: settings?.venue_type_name || null,
    gross_capacity: computeVenueGrossCapacity(fields) || null,
    sellable_capacity: computeVenueSellableCapacityFromFields(fields) || null,
    damaged_seats: getVenueDamagedSeatCount(meta),
  };
}
