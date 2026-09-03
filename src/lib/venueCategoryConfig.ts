export type VenueFieldType = 'text' | 'number' | 'boolean' | 'select' | 'file';

export type VenueFieldDef = {
  key: string;
  label: string;
  type?: VenueFieldType;
  placeholder?: string;
  section?: string;
  options?: Array<{ id: string; label: string }>;
};

export type VenueMeta = {
  fields?: Record<string, string | number | boolean>;
  /** Geo captured at registration (country/state are for display; city_id lives on business). */
  registration?: {
    country_id?: number | null;
    state_id?: number | null;
    state_region?: string;
  };
};

export type VenueTypeSlug =
  | 'stadium'
  | 'auditorium'
  | 'concert-arena'
  | 'outdoor-venue'
  | 'conference-center'
  | 'exhibition-expo'
  | 'banquet-hall'
  | string;

const num = (key: string, label: string, section?: string): VenueFieldDef => ({
  key,
  label,
  type: 'number',
  section,
});

const txt = (key: string, label: string, section?: string, placeholder?: string): VenueFieldDef => ({
  key,
  label,
  type: 'text',
  section,
  placeholder,
});

const yesNo = (key: string, label: string, section?: string): VenueFieldDef => ({
  key,
  label,
  type: 'boolean',
  section,
});

const file = (key: string, label: string, section?: string): VenueFieldDef => ({
  key,
  label,
  type: 'file',
  section,
});

const accessExit = (section = 'Access & exits'): VenueFieldDef[] => [
  num('entrances', 'Number of Entrances', section),
  num('exits', 'Number of Exits', section),
  num('emergency_exits', 'Number of Emergency Exits', section),
];

const seatingGrid = (section = 'Seating layout'): VenueFieldDef[] => [
  num('sections', 'Number of Sections', section),
  num('rows', 'Number of Rows', section),
  num('seats_per_row', 'Seats Per Row', section),
  num('damaged_seats', 'Damaged / unavailable seats', 'Seating maintenance'),
];

const SEATING_ARRANGEMENT_OPTIONS = [
  { id: 'theatre', label: 'Theatre Style' },
  { id: 'classroom', label: 'Classroom Style' },
  { id: 'u-shape', label: 'U-Shape' },
  { id: 'boardroom', label: 'Boardroom' },
  { id: 'banquet', label: 'Banquet' },
  { id: 'custom', label: 'Custom' },
];

const STADIUM_FIELDS: VenueFieldDef[] = [
  num('total_capacity', 'Total Capacity', 'Capacity & dimensions'),
  num('stadium_length', 'Stadium Length (m)', 'Capacity & dimensions'),
  num('stadium_width', 'Stadium Width (m)', 'Capacity & dimensions'),
  num('stands', 'Number of Stands', 'Seating layout'),
  num('tiers', 'Number of Tiers', 'Seating layout'),
  ...seatingGrid('Seating layout'),
  num('vip_sections', 'VIP Sections', 'Seating zones'),
  num('vvip_sections', 'VVIP Sections', 'Seating zones'),
  num('general_sections', 'General Sections', 'Seating zones'),
  num('premium_sections', 'Premium Sections', 'Seating zones'),
  num('standing_capacity', 'Standing Area Capacity', 'Seating zones'),
  num('wheelchair_seats', 'Disabled/Wheelchair Seats', 'Seating zones'),
  yesNo('media_area', 'Media Area', 'Facility zones'),
  yesNo('hospitality_area', 'Hospitality Area', 'Facility zones'),
  yesNo('player_team_area', 'Player/Team Area', 'Facility zones'),
  num('gates', 'Number of Gates', 'Access & exits'),
  ...accessExit(),
  file('seating_plan', 'Existing Seating Plan / Blueprint', 'Documents'),
];

const AUDITORIUM_FIELDS: VenueFieldDef[] = [
  num('total_capacity', 'Total Capacity', 'Capacity & dimensions'),
  num('hall_length', 'Hall Length (m)', 'Capacity & dimensions'),
  num('hall_width', 'Hall Width (m)', 'Capacity & dimensions'),
  yesNo('stage_available', 'Stage Available', 'Stage'),
  num('stage_width', 'Stage Width (m)', 'Stage'),
  num('stage_depth', 'Stage Depth (m)', 'Stage'),
  ...seatingGrid('Seating layout'),
  yesNo('balcony_available', 'Balcony Available', 'Balcony'),
  num('balcony_capacity', 'Balcony Capacity', 'Balcony'),
  num('vip_seats', 'VIP Seats', 'Seat categories'),
  num('premium_seats', 'Premium Seats', 'Seat categories'),
  num('regular_seats', 'Regular Seats', 'Seat categories'),
  num('accessible_seats', 'Accessible Seats', 'Seat categories'),
  num('wheelchair_spaces', 'Wheelchair Spaces', 'Seat categories'),
  num('aisles', 'Number of Aisles', 'Access & exits'),
  ...accessExit(),
  file('seating_plan', 'Existing Seating Plan', 'Documents'),
];

const CONCERT_ARENA_FIELDS: VenueFieldDef[] = [
  num('total_capacity', 'Total Capacity', 'Capacity & dimensions'),
  num('venue_length', 'Venue Length (m)', 'Capacity & dimensions'),
  num('venue_width', 'Venue Width (m)', 'Capacity & dimensions'),
  yesNo('stage_available', 'Stage Available', 'Stage'),
  num('stage_width', 'Stage Width (m)', 'Stage'),
  num('stage_depth', 'Stage Depth (m)', 'Stage'),
  txt('stage_position', 'Stage Position', 'Stage', 'e.g. End, Center'),
  num('seating_capacity', 'Seating Capacity', 'Capacity zones'),
  num('standing_capacity', 'Standing Capacity', 'Capacity zones'),
  num('vip_capacity', 'VIP Capacity', 'Capacity zones'),
  num('vvip_capacity', 'VVIP Capacity', 'Capacity zones'),
  num('fan_pit_capacity', 'Fan Pit Capacity', 'Capacity zones'),
  num('general_admission_capacity', 'General Admission Capacity', 'Capacity zones'),
  num('damaged_seats', 'Damaged / unavailable seats', 'Seating maintenance'),
  yesNo('premium_area', 'Premium Area', 'Facility zones'),
  yesNo('backstage_area', 'Backstage Area', 'Facility zones'),
  yesNo('media_area', 'Media Area', 'Facility zones'),
  yesNo('foh_area', 'FOH Area', 'Facility zones'),
  yesNo('security_area', 'Security Area', 'Facility zones'),
  ...accessExit(),
  file('layout_blueprint', 'Existing Layout / Blueprint', 'Documents'),
];

const OUTDOOR_FESTIVAL_FIELDS: VenueFieldDef[] = [
  num('total_area', 'Total Area (sq m)', 'Ground'),
  num('ground_length', 'Ground Length (m)', 'Ground'),
  num('ground_width', 'Ground Width (m)', 'Ground'),
  num('max_capacity', 'Maximum Capacity', 'Ground'),
  yesNo('stage_area', 'Stage Area', 'Stage'),
  num('stage_width', 'Stage Width (m)', 'Stage'),
  num('stage_depth', 'Stage Depth (m)', 'Stage'),
  yesNo('vip_zone', 'VIP Zone', 'Zones'),
  yesNo('vvip_zone', 'VVIP Zone', 'Zones'),
  yesNo('general_zone', 'General Zone', 'Zones'),
  yesNo('food_zone', 'Food Zone', 'Zones'),
  yesNo('vendor_zone', 'Vendor Zone', 'Zones'),
  yesNo('kids_zone', 'Kids Zone', 'Zones'),
  yesNo('gaming_zone', 'Gaming Zone', 'Zones'),
  yesNo('parking_zone', 'Parking Zone', 'Zones'),
  yesNo('medical_zone', 'Medical Zone', 'Zones'),
  yesNo('security_zone', 'Security Zone', 'Zones'),
  yesNo('media_zone', 'Media Zone', 'Zones'),
  ...accessExit(),
  file('site_plan', 'Existing Site Plan', 'Documents'),
];

const CONVENTION_FIELDS: VenueFieldDef[] = [
  num('total_capacity', 'Total Capacity', 'Halls & rooms'),
  num('damaged_seats', 'Damaged / unavailable seats', 'Seating maintenance'),
  num('halls', 'Number of Halls', 'Halls & rooms'),
  num('rooms', 'Number of Rooms', 'Halls & rooms'),
  num('hall_length', 'Hall Length (m)', 'Halls & rooms'),
  num('hall_width', 'Hall Width (m)', 'Halls & rooms'),
  num('hall_height', 'Hall Height (m)', 'Halls & rooms'),
  yesNo('stage', 'Stage', 'Areas'),
  yesNo('registration_area', 'Registration Area', 'Areas'),
  yesNo('vip_area', 'VIP Area', 'Areas'),
  yesNo('media_area', 'Media Area', 'Areas'),
  yesNo('exhibition_area', 'Exhibition Area', 'Areas'),
  yesNo('food_area', 'Food Area', 'Areas'),
  txt('table_type', 'Table Type', 'Seating arrangement'),
  num('table_capacity', 'Table Capacity', 'Seating arrangement'),
  {
    key: 'seating_arrangement',
    label: 'Seating Arrangement',
    type: 'select',
    section: 'Seating arrangement',
    options: SEATING_ARRANGEMENT_OPTIONS,
  },
  ...accessExit(),
  file('floor_plan', 'Existing Floor Plan', 'Documents'),
];

const EXHIBITION_FIELDS: VenueFieldDef[] = [
  num('hall_length', 'Hall Length (m)', 'Hall dimensions'),
  num('hall_width', 'Hall Width (m)', 'Hall dimensions'),
  num('total_area', 'Total Area (sq m)', 'Hall dimensions'),
  num('max_capacity', 'Maximum Capacity', 'Hall dimensions'),
  num('booths', 'Number of Booths', 'Booths'),
  txt('booth_type', 'Booth Type', 'Booths'),
  txt('standard_booth_size', 'Standard Booth Size', 'Booths', 'e.g. 3m x 3m'),
  txt('premium_booth_size', 'Premium Booth Size', 'Booths'),
  txt('corner_booth_size', 'Corner Booth Size', 'Booths'),
  yesNo('registration_area', 'Registration Area', 'Areas'),
  yesNo('stage_area', 'Stage Area', 'Areas'),
  yesNo('food_area', 'Food Area', 'Areas'),
  yesNo('storage_area', 'Storage Area', 'Areas'),
  yesNo('vip_area', 'VIP Area', 'Areas'),
  yesNo('media_area', 'Media Area', 'Areas'),
  ...accessExit(),
  file('floor_plan', 'Existing Floor Plan', 'Documents'),
];

const BANQUET_FIELDS: VenueFieldDef[] = [
  num('total_capacity', 'Total Capacity', 'Hall'),
  num('damaged_seats', 'Damaged / unavailable seats', 'Seating maintenance'),
  num('hall_length', 'Hall Length (m)', 'Hall'),
  num('hall_width', 'Hall Width (m)', 'Hall'),
  {
    key: 'seating_arrangement',
    label: 'Seating Arrangement',
    type: 'select',
    section: 'Seating arrangement',
    options: SEATING_ARRANGEMENT_OPTIONS,
  },
  num('table_capacity', 'Table Capacity', 'Seating arrangement'),
  ...accessExit(),
  file('floor_plan', 'Existing Floor Plan', 'Documents'),
];

const VENUE_FIELDS_BY_SLUG: Record<string, VenueFieldDef[]> = {
  stadium: STADIUM_FIELDS,
  auditorium: AUDITORIUM_FIELDS,
  'concert-arena': CONCERT_ARENA_FIELDS,
  'outdoor-venue': OUTDOOR_FESTIVAL_FIELDS,
  'conference-center': CONVENTION_FIELDS,
  'exhibition-expo': EXHIBITION_FIELDS,
  'banquet-hall': BANQUET_FIELDS,
};

export const VENUE_TYPE_LABELS: Record<string, string> = {
  stadium: 'Stadium',
  auditorium: 'Auditorium',
  'outdoor-venue': 'Ground',
  'banquet-hall': 'Banquet Hall',
};

/** Canonical venue subtypes shown in registration (excludes legacy duplicates). */
export const CANONICAL_VENUE_TYPE_SLUGS = new Set([
  'stadium',
  'auditorium',
  'outdoor-venue',
  'banquet-hall',
]);

export function getVenueTypeFields(slug?: string | null): VenueFieldDef[] {
  const key = String(slug || '').toLowerCase();
  return VENUE_FIELDS_BY_SLUG[key] ? [...VENUE_FIELDS_BY_SLUG[key]] : [];
}

export function hasVenueSpecificFields(slug?: string | null): boolean {
  return getVenueTypeFields(slug).length > 0;
}

export function defaultVenueMeta(): VenueMeta {
  return { fields: {}, registration: {} };
}

export function getVenueMetaFields(meta?: VenueMeta | null): Record<string, string | number | boolean> {
  if (!meta?.fields || typeof meta.fields !== 'object') return {};
  return { ...meta.fields };
}

export function groupVenueFieldsBySection(fields: VenueFieldDef[]): Array<{ section: string; fields: VenueFieldDef[] }> {
  const map = new Map<string, VenueFieldDef[]>();
  for (const field of fields) {
    const section = field.section || 'Details';
    const list = map.get(section) || [];
    list.push(field);
    map.set(section, list);
  }
  return Array.from(map.entries()).map(([section, sectionFields]) => ({
    section,
    fields: sectionFields,
  }));
}

export function formatVenueFieldValue(field: VenueFieldDef, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (field.type === 'boolean') return value === true || value === 'true' ? 'Yes' : 'No';
  if (field.type === 'select' && field.options) {
    const match = field.options.find((o) => o.id === String(value));
    return match?.label || String(value);
  }
  if (field.type === 'file') return value ? 'Uploaded' : '—';
  return String(value);
}

/** Seats marked damaged/unavailable — subtract from layout sellable capacity. */
export function getVenueDamagedSeatCount(meta?: VenueMeta | null): number {
  const n = Number(getVenueMetaFields(meta).damaged_seats);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function getVenueSellableCapacity(totalCapacity: number, meta?: VenueMeta | null): number {
  return Math.max(0, totalCapacity - getVenueDamagedSeatCount(meta));
}
