/**
 * Central API Service — Single source of truth for all backend API calls.
 * Built with RTK Query. Add new endpoints here; never call fetch() directly in pages.
 *
 * Locked behavior contract (do not change without an explicit product decision):
 * - Endpoints: URLs, methods, bodies, query params, transformResponse
 * - Cache: tagTypes / providesTags / invalidatesTags
 * - Auth tokens: role-scoped keys via authStorage (pathname → token key)
 * - 401 session errors (expired/invalid token, ACCOUNT_DISABLED): handleAuthSessionFailure in authSession
 * - SessionGuard: triggers GET /auth/me; logout on failure via authSession
 *
 * Base URL:
 * - Prefer NEXT_PUBLIC_API_BASE_URL when set
 * - Else development → http://localhost:5000/api
 * - Else production → https://bookmybota-backend.onrender.com/api
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { storageKeysForPath } from '@/lib/authStorage';
import {
  handleAuthSessionFailure,
  isAuthSessionError,
  isLoginAuthRequest,
  resolveRoleFromPath,
} from '@/lib/authSession';
import type { AppDispatch } from '@/lib/store';
import {
  unwrapPaginated,
  toListQuery,
  bizIdOf,
  pagedBizQuery,
  type PaginatedList,
  type PagedQuery,
  type PagedBizQuery,
} from '@/lib/pagination';

export type { PaginationMeta, PaginatedList, PagedQuery } from '@/lib/pagination';

const LOCAL_API_BASE_URL = 'http://localhost:5000/api';
const PRODUCTION_API_BASE_URL = 'https://bookmybota-backend.onrender.com/api';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === 'production' ? PRODUCTION_API_BASE_URL : LOCAL_API_BASE_URL);

if (
  process.env.NODE_ENV === 'production' &&
  /localhost|127\.0\.0\.1/i.test(BASE_URL)
) {
  console.warn(
    '[api] NEXT_PUBLIC_API_BASE_URL still points at localhost in production. Set a real API host before deploying.'
  );
}

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface Business {
  id: string;
  name: string;
  address: string;
  city_id?: number | null;
  city_name?: string | null;
  phone?: string;
  description?: string;
  type_id?: number;
  type_name?: string;
  parent_type_name?: string;
  module_key?: string;
  module_name?: string;
  admin_role?: string;
  admin_email?: string;
  cover_image_url?: string;
  subscription_plan?: string;
  cuisine?: string;
  rating?: string | number;
  reviews_count?: number;
  price_range?: string;
  is_open?: boolean;
  is_enabled?: boolean;
  credentials_sent_at?: string | null;
  deleted_at?: string | null;
  live_event_count?: number;
  upcoming_booking_count?: number;
  owner_id?: string;
  operating_hours?: Record<string, { open: string; close: string; closed: boolean }>;
  gallery_images?: string[];
  menu_images?: string[];
  dining_offers?: Array<{
    id?: string;
    type: string;
    title: string;
    validity: string;
    promo_code?: string;
    discount_type?: 'PERCENT' | 'FLAT';
    discount_value?: number;
    max_discount?: number | null;
    min_bill_amount?: number;
    is_active?: boolean;
    per_day_limit?: number | null;
    status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'SCHEDULED' | 'EXPIRED' | 'ARCHIVED';
    archived_at?: string | null;
    start_at?: string | null;
    end_at?: string | null;
  }>;
  amenities?: string[];
  average_cost?: number;
  is_promoted?: boolean;
  collection_slugs?: string[];
  collection_ids?: number[];
  collection_titles?: string[];
  documents?: PartnerDocumentUpload[];
  registration_terms_accepted_at?: string | null;
  registration_terms_version?: string | null;
  approval_status?: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approval_notes?: string | null;
  approved_at?: string | null;
}

export interface AdminCustomer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  user_email?: string | null;
  is_registered_user?: boolean;
  is_enabled?: boolean;
  created_at?: string;
  deleted_at?: string | null;
  dining_bookings_count?: number;
  event_bookings_count?: number;
  live_event_booking_count?: number;
  dining_bookings?: Array<{
    id: string;
    status: string;
    booking_time: string;
    guests?: number;
    booking_source?: string;
    venue_name?: string;
  }>;
  event_bookings?: Array<{
    id: string;
    status: string;
    created_at: string;
    ticket_qty?: number;
    grand_total?: number;
    event_name?: string;
    event_status?: string;
  }>;
}

export interface PartnerDocumentUpload {
  document_type_id: number;
  url: string;
  document_name?: string;
  uploaded_at?: string;
}

export interface PartnerDocumentMaster {
  id: number;
  name: string;
  slug: string;
  module: 'dining' | 'event' | 'venue' | 'artist' | 'both';
  description?: string | null;
  is_required: boolean;
  accept?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface PartnerOnboardingTerm {
  id: number;
  module: 'dining' | 'event' | 'venue' | 'artist' | 'both';
  text: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface BusinessSettings {
  id: string;
  name?: string;
  address?: string;
  city_id?: number | null;
  city_name?: string | null;
  cuisine?: string;
  phone?: string;
  description?: string;
  cover_image_url?: string;
  grace_time_minutes?: number;
  online_allocation_percentage?: number;
  operating_hours?: Record<string, { open: string; close: string; closed: boolean }>;
  gallery_images?: string[];
  menu_images?: string[];
  dining_offers?: Array<{
    id?: string;
    type: string;
    title: string;
    validity: string;
    promo_code?: string;
    discount_type?: 'PERCENT' | 'FLAT';
    discount_value?: number;
    max_discount?: number | null;
    min_bill_amount?: number;
    is_active?: boolean;
    per_day_limit?: number | null;
    status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'SCHEDULED' | 'EXPIRED' | 'ARCHIVED';
    archived_at?: string | null;
    start_at?: string | null;
    end_at?: string | null;
  }>;
  amenities?: string[];
  average_cost?: number;
  collection_ids?: number[];
}

export interface VenueLayoutRequest {
  id: string;
  business_id: string;
  hall_id?: string | null;
  hall_name?: string | null;
  hall_description?: string | null;
  hall_capacity?: number | null;
  hall_is_indoor?: boolean | null;
  venue_name?: string | null;
  venue_address?: string | null;
  layout_name: string;
  layout_type: string;
  capacity: number;
  spec_json?: Record<string, unknown>;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  review_comments?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  template_id?: string | null;
  template_status?: 'DRAFT' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED' | null;
  template_seating_config?: Record<string, unknown> | null;
  template_seats?: unknown[] | null;
  templates?: VenueLayoutTemplate[];
  template_count?: number;
  workflow_tab?: 'needs_action' | 'in_builder' | 'submitted' | 'published' | 'rejected';
  draft_count?: number;
  submitted_count?: number;
  approved_count?: number;
  rejected_count?: number;
  rejection_reason?: string | null;
}

export interface VenueLayoutTemplate {
  id: string;
  business_id?: string;
  request_id?: string | null;
  name: string;
  layout_type: string;
  capacity: number;
  status: 'DRAFT' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
  is_default?: boolean;
  seating_config?: Record<string, unknown> | null;
  seats_json?: unknown[];
  seat_count?: number;
  hall_name?: string | null;
  rejection_reason?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VenueLayoutRequest {
  id: string;
  business_id: string;
  hall_id?: string | null;
  hall_name?: string | null;
  hall_description?: string | null;
  hall_capacity?: number | null;
  hall_is_indoor?: boolean | null;
  venue_name?: string | null;
  venue_address?: string | null;
  layout_name: string;
  layout_type: string;
  capacity: number;
  spec_json?: Record<string, unknown>;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  review_comments?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  template_id?: string | null;
  template_status?: 'DRAFT' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED' | null;
  template_seating_config?: Record<string, unknown> | null;
  template_seats?: unknown[] | null;
  templates?: VenueLayoutTemplate[];
  template_count?: number;
  workflow_tab?: 'needs_action' | 'in_builder' | 'submitted' | 'published' | 'rejected';
  draft_count?: number;
  submitted_count?: number;
  approved_count?: number;
  rejected_count?: number;
  rejection_reason?: string | null;
}

export interface VenueLayoutTemplate {
  id: string;
  business_id?: string;
  request_id?: string | null;
  name: string;
  layout_type: string;
  capacity: number;
  status: 'DRAFT' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
  is_default?: boolean;
  seating_config?: Record<string, unknown> | null;
  seats_json?: unknown[];
  seat_count?: number;
  hall_name?: string | null;
  rejection_reason?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BusinessType {
  id: number;
  name: string;
  module_id?: number;
  module_key?: string;
  module_name?: string;
  parent_type_id?: number | null;
  parent_name?: string;
  slug?: string;
}

export interface BusinessListQuery extends PagedQuery {
  collection?: string;
  mood?: string;
  module?: 'dining' | 'event';
  q?: string;
  city?: string;
  categories?: string[];
  cuisines?: string[];
  min_rating?: number;
  offers_only?: boolean;
  pure_veg?: boolean;
  serves_alcohol?: boolean;
  max_cost?: number;
  sort?: 'relevance' | 'rating' | 'popular' | 'costAsc' | 'costDesc';
}

export interface AdminEvent {
  id: string;
  business_id: string;
  name: string;
  status: string;
  is_visible: boolean;
  convenience_fee_percent: number | string;
  commission_percent: number | string;
  organizer_name?: string;
  organizer_phone?: string;
  organizer_address?: string;
  organizer_email?: string;
  category_name?: string;
  category_type_id?: number | null;
  language?: string;
  about_event?: string;
  age_group?: string;
  duration_minutes?: number;
  /** Ticket delivery modes customers may choose for this event. */
  allowed_ticket_modes?: Array<'M_TICKET' | 'BOX_OFFICE' | 'PHYSICAL_DELIVERY'>;
  tickets_sold?: number;
  convenience_fee_earned?: number | string;
  commission_earned?: number | string;
  platform_earned?: number | string;
  created_at?: string;
  updated_at?: string;
  ticket_types?: Array<{
    id: string;
    ticket_type: string;
    total_count: number;
    available_count: number;
    price: number | string;
    max_per_order?: number | null;
    showtime_id?: string | null;
    venue_name?: string | null;
  }>;
  showtimes?: Array<{
    id: string;
    venue_name?: string;
    venue_address?: string;
    city_id?: number | null;
    city_name?: string | null;
    city_state?: string | null;
    city_country?: string | null;
    venue_business_id?: string | null;
    venue_business_name?: string | null;
    venue_layout_template_id?: string | null;
    venue_source?: 'manual' | 'registered' | 'auto_registered';
    venue_is_authorized?: boolean;
    venue_claim_status?: 'UNCLAIMED' | 'CLAIMED' | string;
    layout_mode?: 'none' | 'standard' | 'custom';
    custom_layout_name?: string | null;
    custom_layout_type?: string | null;
    custom_layout_capacity?: number | null;
    custom_layout_notes?: string | null;
    starts_at: string;
    ends_at?: string;
    duration_type?: 'ONE_DAY' | 'MULTI_DAY';
    latitude?: number | string | null;
    longitude?: number | string | null;
    ticket_types?: Array<{
      id?: string;
      ticket_type: string;
      total_count: number;
      available_count?: number;
      price: number | string;
      max_per_order?: number | null;
    }>;
  }>;
  bookings?: Array<Record<string, unknown>>;
  rejection_reason?: string;
  genres?: string[];
  poster_horizontal_url?: string;
  poster_vertical_url?: string;
  gallery_images?: string[];
  youtube_url?: string | null;
  documents?: EventDocumentUpload[] | string[];
  artists?: EventArtistItem[];
  layout_requests?: Array<{
    id: string;
    showtime_id?: string | null;
    layout_name: string;
    layout_type?: string;
    capacity?: number;
    notes?: string | null;
    status: string;
    venue_name?: string | null;
    organizer_change_notes?: string | null;
    reference_images?: string[];
    status_history?: Array<{ status?: string; at?: string; by?: string; note?: string | null }>;
  }>;
  hosting_type?: 'single' | 'tour';
  tour_id?: string | null;
  tour?: {
    id: string;
    name: string;
    description?: string | null;
    main_artist_name?: string | null;
    poster_url?: string | null;
    starts_on?: string | null;
    ends_on?: string | null;
    status?: string;
  } | null;
  terms_points?: {
    selected?: Array<{ id?: number; text?: string } | string>;
    custom?: string[];
  };
}

export interface EventDocumentUpload {
  document_type_id: number;
  url: string;
  document_name?: string;
}

export interface EventGenreMaster {
  id: number;
  category_type_id: number;
  name: string;
  slug?: string;
  is_active: boolean;
  sort_order: number;
  category_name?: string;
}

export interface DiningCuisineMaster {
  id: number;
  name: string;
  slug?: string;
  image_url?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface CityMaster {
  id: number;
  name: string;
  slug?: string;
  state?: string | null;
  country?: string | null;
  icon_url?: string | null;
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface DiningMastersResponse {
  cuisines: DiningCuisineMaster[];
}

export interface EventDocumentMaster {
  id: number;
  name: string;
  description?: string;
  category_type_id?: number | null;
  is_required: boolean;
  importance_level: number;
  is_active: boolean;
  sort_order: number;
  category_name?: string;
}

export interface EventTermsMaster {
  id: number;
  text: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

export interface EventMastersResponse {
  genres: EventGenreMaster[];
  documents: EventDocumentMaster[];
  terms?: EventTermsMaster[];
}

export interface PublicEventFilters {
  languages: string[];
  cities: string[];
  organizers: string[];
  categories: Array<{ slug: string; name: string }>;
  date_presets: Array<{ id: string; label: string }>;
  price_bands: Array<{ id: string; label: string }>;
  more: Array<{ id: string; label: string }>;
}

export interface PublicEventsQuery {
  q?: string;
  category?: string;
  city?: string;
  language?: string;
  date_preset?: string;
  date_from?: string;
  date_to?: string;
  price?: string;
  more?: string;
  organizer?: string;
  sort?: string;
}

export interface EventContract {
  id: string;
  event_id: string;
  contract_number: string;
  body_html: string;
  terms_and_conditions?: string | null;
  status: 'PENDING_SIGNATURES' | 'ACTIVE' | 'REJECTED';
  convenience_fee_percent: number | string;
  commission_percent: number | string;
  dynamic_data?: Record<string, string | number> | null;
  admin_signed_at?: string | null;
  organizer_signed_at?: string | null;
  admin_signature_url?: string | null;
  organizer_signature_url?: string | null;
  rejection_reason?: string | null;
  event_name?: string;
  organizer_name?: string;
  created_at?: string;
}

export interface EligibleContractEvent {
  id: string;
  name: string;
  status: string;
  organizer_name?: string;
  category_name?: string;
  contract_id?: string;
  contract_status?: string;
}

export interface OfferEligibleEvent {
  id: string;
  name: string;
  status: string;
  starts_on?: string | null;
  ends_on?: string | null;
}

export interface ContractPrefill {
  event: AdminEvent & { organizer_name?: string; category_name?: string };
  showtimes: AdminEvent['showtimes'];
  ticket_types: AdminEvent['ticket_types'];
  existing_contract: EventContract | null;
  suggested: {
    contract_number: string;
    convenience_fee_percent: number;
    commission_percent: number;
    terms_and_conditions: string;
    body_html: string;
    dynamic_data: Record<string, string | number>;
  };
}

export interface OrganizerEvent extends AdminEvent {
  genres?: string[];
  poster_horizontal_url?: string;
  poster_vertical_url?: string;
  gallery_images?: string[];
  documents?: EventDocumentUpload[] | string[];
  rejection_reason?: string;
  terms_points?: { selected?: Array<{ id?: number; text?: string } | string>; custom?: string[] };
  contract?: EventContract | null;
  rating?: number | string;
  reviews_count?: number;
}

export interface EventFormPayload {
  name: string;
  category_type_id: number | null;
  genres: string[];
  poster_horizontal_url: string;
  poster_vertical_url: string;
  gallery_images?: string[];
  youtube_url?: string;
  documents: EventDocumentUpload[];
  language: string;
  languages?: string[];
  about_event: string;
  age_group: string;
  duration_minutes: number | null;
  hosting_type?: 'single' | 'tour';
  tour_id?: string | null;
  tour?: {
    id?: string | null;
    name?: string;
    description?: string | null;
    category_type_id?: number | null;
    main_artist_name?: string | null;
    poster_url?: string | null;
    starts_on?: string | null;
    ends_on?: string | null;
  } | null;
  terms_points?: {
    selected: Array<{ id: number; text: string }>;
    custom: string[];
  };
  /** Which delivery modes customers can choose at purchase. At least one required on submit. */
  allowed_ticket_modes?: Array<'M_TICKET' | 'BOX_OFFICE' | 'PHYSICAL_DELIVERY'>;
  ticket_types: Array<{ ticket_type: string; total_count: number; price: number; max_per_order?: number }>;
  artists?: Array<{
    artist_source: 'registered' | 'external' | 'auto_registered';
    artist_business_id?: string | null;
    name: string;
    role_title?: string | null;
    description?: string | null;
    image_url?: string | null;
    documents?: Array<{ document_type_id?: number; url: string; document_name?: string }>;
    auto_register_artist?: boolean;
    sort_order?: number;
  }>;
  showtimes: Array<{
    venue_name: string;
    venue_address: string;
    city_id?: number | null;
    location_id?: number | null;
    venue_business_id?: string | null;
    venue_layout_template_id?: string | null;
    venue_source?: 'manual' | 'registered' | 'auto_registered';
    venue_is_authorized?: boolean;
    venue_claim_status?: 'UNCLAIMED' | 'CLAIMED' | string;
    layout_mode?: 'none' | 'standard' | 'custom';
    custom_layout_name?: string | null;
    custom_layout_type?: string | null;
    custom_layout_capacity?: number | null;
    custom_layout_notes?: string | null;
    custom_layout_images?: string[];
    tour_stop_order?: number | null;
    venue_proposal?: {
      contact_name?: string;
      contact_phone?: string;
      contact_email?: string;
      capacity?: number | null;
      facilities?: string[];
      image_urls?: string[];
      notes?: string;
    } | null;
    starts_at: string;
    ends_at: string;
    duration_type?: 'ONE_DAY' | 'MULTI_DAY';
    ticket_types?: Array<{ ticket_type: string; total_count: number; price: number; max_per_order?: number }>;
  }>;
}

export interface OrganizerVenueSearchResult {
  id: string;
  name: string;
  address?: string | null;
  city_id?: number | null;
  cover_image_url?: string | null;
  phone?: string | null;
  approval_status?: string | null;
  partner_source?: string | null;
  is_partner_authorized?: boolean;
  documents?: unknown;
  description?: string | null;
  city_name?: string | null;
  city_state?: string | null;
  city_country?: string | null;
  published_layout_count?: number;
  default_layout_id?: string | null;
  default_layout_name?: string | null;
}

export interface OrganizerArtistSearchResult {
  id: string;
  name: string;
  description?: string | null;
  cover_image_url?: string | null;
  phone?: string | null;
  city_id?: number | null;
  partner_source?: string | null;
  is_partner_authorized?: boolean;
  city_name?: string | null;
  type_name?: string | null;
}

export interface OrganizerVenueLayoutOption {
  id: string;
  name: string;
  status: string;
  is_default: boolean;
  capacity: number;
  created_at?: string;
  updated_at?: string;
}

export interface AdminEventLayoutRequest {
  id: string;
  event_id: string;
  showtime_id?: string | null;
  organizer_business_id: string;
  venue_business_id?: string | null;
  venue_name?: string | null;
  layout_name: string;
  layout_type?: string;
  capacity?: number;
  notes?: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'FULFILLED' | 'REJECTED' | 'CANCELLED' | string;
  rejection_reason?: string | null;
  fulfilled_template_id?: string | null;
  submitted_at?: string | null;
  created_at?: string;
  updated_at?: string;
  event_name?: string;
  event_status?: string;
  organizer_name?: string;
  venue_partner_name?: string | null;
  showtime_venue_name?: string | null;
  showtime_starts_at?: string | null;
  showtime_layout_mode?: string | null;
  showtime_template_id?: string | null;
  fulfilled_template_name?: string | null;
  fulfilled_template_capacity?: number | null;
  fulfilled_template_status?: string | null;
  workflow_tab?: string;
  published_layouts?: OrganizerVenueLayoutOption[];
}

export interface EventArtistItem {
  id?: string;
  artist_source: 'registered' | 'external' | 'auto_registered';
  artist_business_id?: string | null;
  artist_business_name?: string | null;
  artist_business_image?: string | null;
  artist_is_authorized?: boolean;
  name: string;
  role_title?: string | null;
  description?: string | null;
  image_url?: string | null;
  sort_order?: number;
}

export interface PublicEvent {
  id: string;
  name: string;
  poster_horizontal_url?: string;
  poster_vertical_url?: string;
  language?: string;
  about_event?: string;
  gallery_images?: string[];
  age_group?: string;
  duration_minutes?: number;
  category_name?: string;
  category_slug?: string;
  organizer_name?: string;
  venue_name?: string;
  city_name?: string;
  next_showtime?: string;
  min_price?: number | string;
  status?: string;
  rating?: number | string;
  reviews_count?: number;
}

/** Approved onboarded venue / artist partners for partner landing pages. */
export interface PublicRegisteredPartner {
  id: string;
  name: string;
  address?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
  city_id?: number | null;
  city_name?: string | null;
  city_state?: string | null;
  type_name?: string | null;
  published_layout_count?: number | null;
}

export interface ArtistAvailabilitySlot {
  id: string;
  slot_date: string;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string | null;
  is_booked?: boolean;
  created_at?: string;
}

export interface PublicArtistProfile extends PublicRegisteredPartner {
  phone?: string | null;
  slots?: ArtistAvailabilitySlot[];
}

export interface ArtistBookingInquiry {
  id: string;
  artist_business_id: string;
  slot_id?: string | null;
  customer_id?: string | null;
  event_date: string;
  event_time?: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  event_type?: string | null;
  event_location?: string | null;
  message?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | string;
  artist_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type VenueAvailabilitySlot = ArtistAvailabilitySlot;

export interface PublicVenueProfile extends PublicRegisteredPartner {
  phone?: string | null;
  slots?: VenueAvailabilitySlot[];
}

export interface VenueBookingInquiry {
  id: string;
  venue_business_id: string;
  slot_id?: string | null;
  customer_id?: string | null;
  event_date: string;
  event_time?: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  event_type?: string | null;
  guest_count?: number | null;
  event_location?: string | null;
  message?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | string;
  venue_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EventTicketTypeStats {
  id: string;
  ticket_type: string;
  venue_name?: string | null;
  showtime_id?: string | null;
  price: number;
  total_count: number;
  available_count: number;
  sold: number;
  sold_from_bookings: number;
  confirmed_sold: number;
  cancelled_qty: number;
  remaining: number;
  revenue: number;
  fill_percent: number;
}

export interface EventTicketStatsSummary {
  total_capacity: number;
  total_remaining: number;
  total_sold: number;
  tickets_sold_bookings: number;
  bookings_count: number;
  cancelled_bookings: number;
  ticket_revenue: number;
  organizer_payout: number;
  fill_percent: number;
}

export interface OrganizerEventTicketStats {
  event_id: string;
  event_name: string;
  status: string;
  is_visible?: boolean;
  summary: EventTicketStatsSummary;
  ticket_types: EventTicketTypeStats[];
}

export interface OrganizerTicketStatsResponse {
  overall: EventTicketStatsSummary & { events_count: number };
  events: OrganizerEventTicketStats[];
}

export interface OrganizerEventBooking {
  id: string;
  event_id: string;
  showtime_id?: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  status: string;
  ticket_amount: number;
  grand_total: number;
  ticket_qty: number;
  organizer_payout?: number;
  qr_code?: string;
  booking_source?: string;
  created_at?: string;
  event_name?: string;
  venue_name?: string;
  starts_at?: string;
  items?: EventBookingItem[];
  ticket_mode?: string;
  checked_in_at?: string | null;
}

export interface EventBookingItem {
  id: string;
  ticket_type_id: string;
  ticket_type?: string;
  qty: number;
  unit_price: number | string;
}

export interface EventBooking {
  id: string;
  event_id: string;
  showtime_id?: string;
  customer_id?: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'USED' | 'REFUNDED' | string;
  ticket_amount: number | string;
  convenience_fee_percent?: number | string;
  convenience_fee_total?: number | string;
  grand_total: number | string;
  ticket_qty: number;
  qr_code?: string;
  qr_payload?: string;
  booking_source?: string;
  created_at?: string;
  updated_at?: string;
  event_name?: string;
  event_status?: string;
  poster_horizontal_url?: string;
  poster_vertical_url?: string;
  language?: string;
  category_name?: string;
  organizer_name?: string;
  venue_name?: string;
  venue_address?: string;
  starts_at?: string;
  ends_at?: string;
  items?: EventBookingItem[];
  promo_code?: string | null;
  discount_amount?: number | string;
  gift_card_id?: string | null;
  gift_card_amount?: number | string;
  ticket_mode?: string;
  delivery_address_line?: string | null;
  delivery_city?: string | null;
  delivery_notes?: string | null;
  checked_in_at?: string | null;
  checked_in_by?: string | null;
  already_checked_in?: boolean;
  can_check_in?: boolean;
  check_in_message?: string;
  just_checked_in?: boolean;
}

export interface AppliedPromoOffer {
  offer_id: string;
  title: string;
  promo_code: string;
  discount_type: 'PERCENT' | 'FLAT';
  discount_value: number;
  discount_amount: number;
  source?: 'platform' | 'organizer';
}

export interface PlatformOffer {
  id: string;
  name: string;
  code: string;
  description?: string;
  discount_type: 'PERCENT' | 'FLAT';
  discount_value: number;
  max_discount?: number | null;
  min_order_amount: number;
  category: 'ALL' | 'EVENTS' | 'DINING';
  apply_to: 'ENTIRE_CATEGORY' | 'SELECTED_ITEMS';
  customer_eligibility: 'ALL' | 'NEW' | 'EXISTING';
  usage_limit?: number | null;
  per_user_limit: number;
  start_at?: string | null;
  end_at?: string | null;
  status: string;
  effective_status?: string;
  display_theme?: string;
  sort_order?: number;
  redemption_count?: number;
  event_ids?: string[];
  restaurant_ids?: string[];
  discount_label?: string;
  scope_label?: string;
}

/** Platform offer eligible for a specific dining restaurant + customer */
export interface DiningEligiblePlatformOffer {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  discount_type: string;
  discount_value: number;
  max_discount?: number | null;
  min_order_amount: number;
  customer_eligibility: string;
  discount_label: string;
}

export interface GiftCardProduct {
  id: string;
  name: string;
  description?: string | null;
  denomination: number | string;
  selling_price: number | string;
  currency: string;
  applicable_category: 'ALL' | 'EVENTS' | 'SPORTS' | 'DINING';
  validity_days: number;
  allow_partial_usage: boolean;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | string;
  sort_order?: number;
  sold_count?: number;
  sold_value?: number | string;
  redeemed_value?: number | string;
  outstanding_balance?: number | string;
  created_at?: string;
  updated_at?: string;
}

export interface GiftCardMine {
  id: string;
  code_last4: string;
  code_masked: string;
  initial_balance: number | string;
  current_balance: number | string;
  currency: string;
  status: string;
  expires_at?: string | null;
  purchase_for: 'SELF' | 'SOMEONE_ELSE' | string;
  recipient_name?: string | null;
  recipient_email?: string | null;
  sender_name?: string | null;
  personal_message?: string | null;
  issued_at?: string | null;
  activated_at?: string | null;
  product_name?: string;
  applicable_category?: string;
  validity_days?: number;
  is_owner?: boolean;
  is_claimed_by_me?: boolean;
  used_amount?: number | string;
  transactions?: GiftCardTransaction[];
}

export interface GiftCardTransaction {
  id: string;
  transaction_type: string;
  amount: number | string;
  balance_before: number | string;
  balance_after: number | string;
  booking_type?: string | null;
  booking_id?: string | null;
  reference?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface GiftCardPurchaseResult {
  id: string;
  code: string;
  code_masked: string;
  code_last4: string;
  initial_balance: number;
  current_balance: number;
  currency: string;
  status: string;
  expires_at?: string | null;
  purchase_for: string;
  product_name: string;
  applicable_category?: string;
  recipient_name?: string | null;
  recipient_email?: string | null;
}

export interface GiftCardPurchaseBody {
  product_id: string;
  purchase_for: 'SELF' | 'SOMEONE_ELSE';
  recipient_name?: string;
  recipient_email?: string;
  sender_name?: string;
  personal_message?: string;
}

export interface GiftCardRedeemPreview {
  gift_card_id: string;
  code_last4: string;
  code_masked: string;
  current_balance: number;
  amount_applicable: number;
  balance_after: number;
  currency: string;
  applicable_category: string;
  product_name: string;
}

export interface MerchantGiftCardVerify {
  gift_card_id: string;
  code_last4: string;
  code_masked: string;
  current_balance: number;
  currency: string;
  status: string;
  expires_at?: string | null;
  applicable_category: string;
  product_name: string;
  customer_name?: string | null;
}

export interface MerchantGiftCardPreview extends MerchantGiftCardVerify {
  bill_amount: number;
  amount_applicable: number;
  customer_payable: number;
  balance_after: number;
}

export interface MerchantGiftCardRedeemResult extends MerchantGiftCardPreview {
  redemption_id: string;
  settlement_status: string;
}

export interface DiningGiftCardRedemptionRow {
  id: string;
  business_id: string;
  gift_card_id: string;
  code_last4: string;
  bill_amount: number | string;
  gift_card_amount: number | string;
  customer_payable: number | string;
  guest_name?: string | null;
  guest_phone?: string | null;
  redeemed_at?: string;
  settlement_status: string;
  settlement_amount?: number | string;
  settlement_notes?: string | null;
  settled_at?: string | null;
  settled_by?: string | null;
  settled_by_email?: string | null;
  product_name?: string;
  business_name?: string;
}

export interface DiningGiftCardSettlementSummary {
  pending_count: number;
  approved_count: number;
  paid_count: number;
  cancelled_count: number;
  pending_amount: number;
  approved_amount: number;
  paid_amount: number;
}

export interface OfferRedemption {
  id: string;
  offer_id: string;
  offer_name?: string;
  offer_code?: string;
  customer_id?: string | null;
  customer_name?: string | null;
  guest_phone?: string | null;
  booking_type: string;
  booking_id: string;
  promo_code: string;
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  category: string;
  redeemed_at: string;
}

export interface CommissionLedgerRow {
  event_id?: string;
  event_name?: string;
  business_id?: string;
  organizer_name?: string;
  booking_date?: string;
  convenience_fee_percent?: number | string;
  commission_percent?: number | string;
  bookings_count: number;
  tickets_sold: number;
  ticket_amount: number | string;
  convenience_fee_total: number | string;
  commission_total: number | string;
  platform_earned: number | string;
  organizer_payout: number | string;
  grand_total: number | string;
}

export interface CommissionLedger {
  group_by: string;
  rows: CommissionLedgerRow[];
  totals: {
    bookings_count: number;
    tickets_sold: number;
    ticket_amount: number | string;
    convenience_fee_total: number | string;
    commission_total: number | string;
    platform_earned: number | string;
    organizer_payout: number | string;
    grand_total: number | string;
  };
}

export interface Collection {
  id: number;
  title: string;
  subtitle?: string;
  image_url?: string;
  color_gradient?: string;
  slug: string;
  places_count?: number;
  is_active?: boolean;
}

export interface Mood {
  id: number;
  title: string;
  image_url: string;
  query_tag: string;
}

export interface ReviewReply {
  id: number;
  review_id: number;
  user_name: string;
  user_type: 'customer' | 'owner';
  text: string;
  created_at: string;
}

export interface Review {
  id: number;
  business_id: string;
  user_name: string;
  rating: number;
  text: string;
  created_at: string;
  replies?: ReviewReply[];
}

export interface EventReviewReply {
  id: number;
  review_id: number;
  user_name: string;
  user_type: string;
  text: string;
  created_at: string;
}

export interface EventReview {
  id: number;
  event_id: string;
  customer_id?: string | null;
  user_name: string;
  rating: number | string;
  text: string;
  created_at: string;
  event_name?: string;
  replies?: EventReviewReply[];
}

export interface EventOffer {
  id: string;
  event_id: string;
  business_id: string;
  title: string;
  description?: string | null;
  discount_type: 'PERCENT' | 'FLAT';
  discount_value: number | string;
  promo_code?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean;
  event_name?: string;
  event_status?: string;
  created_at?: string;
}

export interface OrganizerLedgerRow {
  event_id: string;
  event_name: string;
  event_status: string;
  bookings_count: number;
  tickets_sold: number;
  ticket_amount: number | string;
  commission_total: number | string;
  organizer_earned: number | string;
  paid_amount: number | string;
  pending_amount: number | string;
}

export interface OrganizerLedgerCustomerEntry {
  booking_id: string;
  event_id: string;
  event_name: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  customer_id?: string | null;
  ticket_qty: number;
  ticket_amount: number | string;
  discount_amount?: number | string;
  commission_total: number | string;
  organizer_earned: number | string;
  grand_total: number | string;
  promo_code?: string | null;
  status: string;
  booking_source?: string;
  created_at?: string;
}

export interface OrganizerLedger {
  summary: {
    bookings_count: number;
    tickets_sold: number;
    ticket_amount: number;
    discount_total?: number;
    commission_total: number;
    organizer_earned: number;
    customer_paid_total?: number;
    paid_amount: number;
    pending_amount: number;
    total_paid: number;
    admin_pending_payments: number;
    events_count: number;
  };
  rows: OrganizerLedgerRow[];
  recent_payouts: Array<{
    id: string;
    amount: number | string;
    status: string;
    payment_reference?: string;
    event_name?: string;
    paid_at?: string;
    created_at?: string;
  }>;
}

export interface OrganizerLedgerCustomersResponse {
  items: OrganizerLedgerCustomerEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_prev: boolean;
    has_next: boolean;
  };
}

export interface OrganizerPayout {
  id: string;
  business_id: string;
  event_id?: string | null;
  amount: number | string;
  status: 'PENDING' | 'PAID';
  payment_reference?: string | null;
  notes?: string | null;
  paid_at?: string | null;
  created_at?: string;
  organizer_name?: string;
  event_name?: string;
}

export interface Table {
  id: string;
  table_number: string;
  capacity: number;
  is_active: boolean;
}

export interface Booking {
  id: string;
  business_id?: string;
  business_name?: string;
  business_address?: string;
  business_cover_image?: string;
  business_phone?: string;
  customer_name?: string;
  customer_phone?: string;
  guest_name?: string;
  guest_phone?: string;
  guests?: number;
  booking_time: string;
  end_time?: string;
  booking_source: 'ONLINE' | 'WALK_IN';
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW' | 'ARRIVED';
  table_number?: string;
  created_at?: string;
  approx_arrival?: string;
  qr_token?: string;
  applied_offer?: {
    id?: string;
    offer_id?: string;
    source?: 'merchant' | 'platform' | string;
    type?: string;
    title?: string;
    validity?: string;
    promo_code?: string;
    discount_type?: string;
    discount_value?: number;
    max_discount?: number | null;
    min_bill_amount?: number;
  } | null;
  checked_out_at?: string | null;
  offer_redeemed_at?: string | null;
  offer_redeemed_by?: string | null;
  bill_amount?: number | string | null;
  offer_redemption_notes?: string | null;
  special_request?: string | null;
}

export interface DiningOfferRedemption {
  id: string;
  business_id: string;
  booking_id?: string | null;
  promo_code: string;
  offer_title: string;
  offer_snapshot?: Record<string, unknown>;
  redemption_source: 'booking' | 'walk_in';
  guest_name?: string | null;
  guest_phone?: string | null;
  bill_amount?: number | string | null;
  notes?: string | null;
  redeemed_at: string;
  redeemed_by_email?: string | null;
}

export interface DiningOfferRedemptionReport {
  items: DiningOfferRedemption[];
  meta?: import('@/lib/pagination').PaginationMeta;
  summary?: {
    total_redemptions: number;
    booking_redemptions: number;
    walk_in_redemptions: number;
    total_bill_amount: number | string;
  };
  by_offer?: Array<{
    promo_code: string;
    offer_title: string;
    redemption_count: number;
  }>;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  profile_image_url?: string;
  address?: string;
  city?: string;
  state?: string;
  is_registered_user?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AdminStats {
  total_bookings: number;
  active_users: number;
  active_businesses: number;
  platform_revenue: number;
}

export interface Analytics {
  total_bookings: number;
  sources: { booking_source: string; count: number }[];
  statuses: { status: string; count: number }[];
}

export interface AuthUser {
  id: string;
  email: string;
  role: 'super_admin' | 'business_admin' | 'event_admin' | 'venue_admin' | 'artist_admin' | 'customer';
  business_id?: string;
  customer_id?: string;
  name?: string;
  phone?: string;
}

// ─── RTK Query API ────────────────────────────────────────────────────────────

const rawBaseQuery = fetchBaseQuery({
    baseUrl: BASE_URL,
    prepareHeaders: (headers) => {
      if (typeof window !== 'undefined') {
      // Same rules as before: /admin|/organizer|/business|/customer → role token; else customer.
      const { tokenKey } = storageKeysForPath(window.location.pathname);
        const token = localStorage.getItem(tokenKey);
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }
      return headers;
    },
});

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  if (result.error && typeof window !== 'undefined') {
    const path = window.location.pathname;
    const url = typeof args === 'string' ? args : args.url;

    if (isLoginAuthRequest(url)) {
      return result;
    }

    const data = result.error.data as { code?: string; error?: string } | undefined;
    const status = result.error.status;

    if (isAuthSessionError(status, data, path)) {
      handleAuthSessionFailure(resolveRoleFromPath(path), api.dispatch as AppDispatch, data, path);
    }
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Businesses', 'Tables', 'Bookings', 'DiningOfferRedemptions', 'DiningGiftCardRedemptions', 'AdminDiningGiftCardSettlements', 'EventBookings', 'BusinessSettings', 'AdminStats', 'Analytics', 'Reviews', 'MarketingPlans', 'MarketingCampaigns', 'PlatformOffers', 'OfferRedemptions', 'PublicPlatformOffers', 'GiftCardProducts', 'PublicGiftCardProducts', 'MyGiftCards', 'DiningWishlist', 'CustomerProfile', 'AdminEvents', 'AdminCommission', 'OrganizerEvents', 'OrganizerTicketStats', 'OrganizerBookings', 'PublicEvents', 'EventMasters', 'DiningMasters', 'CityMasters', 'EventContracts', 'EventLayouts', 'EventLayoutRequests', 'EventReviews', 'EventOffers', 'OrganizerLedger', 'OrganizerLedgerCustomers', 'OrganizerPayouts', 'PartnerDocuments', 'AdminCustomers', 'EventInterests', 'VenueLayouts', 'ArtistSlots', 'ArtistInquiries', 'VenueSlots', 'VenueInquiries'],
  endpoints: (builder) => ({

    // ── Auth ──────────────────────────────────────────────────────────────────

    login: builder.mutation<
      { token: string; user: AuthUser; message?: string },
      { email: string; password: string }
    >({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),

    forgotPassword: builder.mutation<{ message?: string; email_hint?: string }, { email: string }>({
      query: (body) => ({
        url: '/auth/forgot-password',
        method: 'POST',
        body,
      }),
      invalidatesTags: [],
    }),

    resetPassword: builder.mutation<
      { message?: string },
      { token: string; new_password: string; confirm_password: string }
    >({
      query: (body) => ({
        url: '/auth/reset-password',
        method: 'POST',
        body,
      }),
      invalidatesTags: [],
    }),

    changePassword: builder.mutation<
      { message?: string },
      { current_password: string; new_password: string; confirm_password: string }
    >({
      query: (body) => ({
        url: '/auth/change-password',
        method: 'POST',
        body,
      }),
      invalidatesTags: [],
    }),

    getMe: builder.query<
      {
        id: string;
        role: string;
        business_id?: string;
        customer_id?: string;
        email?: string;
        name?: string | null;
        phone?: string | null;
      },
      void
    >({
      query: () => '/auth/me',
      transformResponse: (res: {
        data: {
          id: string;
          role: string;
          business_id?: string;
          customer_id?: string;
          email?: string;
          name?: string | null;
          phone?: string | null;
        };
      }) => res.data,
    }),

    updateMyProfile: builder.mutation<
      {
        message?: string;
        data: {
          id: string;
          email: string;
          role: string;
          business_id?: string;
          customer_id?: string;
          name?: string | null;
          phone?: string | null;
        };
      },
      { name: string; phone: string }
    >({
      query: (body) => ({
        url: '/auth/profile',
        method: 'PUT',
        body,
      }),
    }),

    registerCustomer: builder.mutation<
      { token: string; user: AuthUser; message?: string },
      {
        name: string;
        email: string;
        phone: string;
        verification_token: string;
        password?: string;
        auto_generate_password?: boolean;
      }
    >({
      query: (body) => ({
        url: '/auth/register-customer',
        method: 'POST',
        body,
      }),
    }),

    sendCustomerOtp: builder.mutation<
      { message?: string; expires_in?: number; demo_otp?: string },
      { phone: string }
    >({
      query: (body) => ({
        url: '/auth/customer/send-otp',
        method: 'POST',
        body,
      }),
    }),

    verifyCustomerOtp: builder.mutation<
      | {
          next: 'authenticated';
          token: string;
          user: AuthUser;
          message?: string;
        }
      | {
          next: 'register';
          verification_token: string;
          expires_in?: number;
          message?: string;
        },
      { phone: string; otp: string }
    >({
      query: (body) => ({
        url: '/auth/customer/verify-otp',
        method: 'POST',
        body,
      }),
    }),

    checkCustomerPhone: builder.mutation<
      { phone: string; registered: boolean; can_register: boolean },
      { phone: string }
    >({
      query: (body) => ({
        url: '/auth/customer/check-phone',
        method: 'POST',
        body,
      }),
    }),

    registerBusiness: builder.mutation<
      { success?: boolean; business_id?: string; role?: string; message?: string; is_enabled?: boolean },
      {
        business_name: string;
        address: string;
        phone: string;
        description: string;
        type_id?: number;
        admin_email: string;
        admin_password?: string;
        partner_type?: 'dining' | 'event' | 'venue' | 'artist';
        documents?: PartnerDocumentUpload[];
        cover_image_url?: string;
        collection_ids?: number[];
        registration_terms_accepted?: boolean;
        registration_terms_version?: string;
      }
    >({
      query: (body) => ({
        url: '/auth/register-business',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Businesses', 'DiningMasters'],
    }),

    updateAdminBusiness: builder.mutation<
      { message?: string; data?: Business },
      {
        id: string;
        name?: string;
        address?: string;
        phone?: string;
        description?: string;
        type_id?: number;
        admin_email?: string;
        admin_password?: string;
        documents?: PartnerDocumentUpload[];
        cover_image_url?: string;
        collection_ids?: number[];
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/businesses/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Businesses', 'DiningMasters'],
    }),

    setBusinessEnabled: builder.mutation<
      { message?: string; data?: Business },
      { id: string; is_enabled: boolean }
    >({
      query: ({ id, is_enabled }) => ({
        url: `/admin/businesses/${id}/status`,
        method: 'PATCH',
        body: { is_enabled },
      }),
      invalidatesTags: ['Businesses', 'AdminStats'],
    }),

    getAdminBusinesses: builder.query<
      PaginatedList<Business>,
      { module?: 'dining' | 'event' | 'venue' | 'artist'; tab?: 'active' | 'archived'; q?: string; page?: number; limit?: number } | void
    >({
      query: (params) =>
        `/admin/businesses${toListQuery({
          module: params?.module,
          tab: params?.tab === 'archived' ? 'archived' : 'active',
          q: params?.q,
          page: params?.page,
          limit: params?.limit,
        })}`,
      transformResponse: (res: { data: Business[] }) => unwrapPaginated(res),
      providesTags: ['Businesses'],
    }),

    getAdminBusiness: builder.query<Business, string>({
      query: (id) => `/admin/businesses/${id}`,
      transformResponse: (res: { data: Business }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'Businesses', id }],
    }),

    archiveBusiness: builder.mutation<{ message?: string }, string>({
      query: (id) => ({
        url: `/admin/businesses/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Businesses', 'AdminStats'],
    }),

    unarchiveBusiness: builder.mutation<{ message?: string }, string>({
      query: (id) => ({
        url: `/admin/businesses/${id}/unarchive`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Businesses', 'AdminStats'],
    }),

    getAdminCustomers: builder.query<
      PaginatedList<AdminCustomer>,
      { q?: string; tab?: 'active' | 'archived'; page?: number; limit?: number } | void
    >({
      query: (params) =>
        `/admin/customers${toListQuery({
          tab: params?.tab === 'archived' ? 'archived' : 'active',
          q: params?.q,
          page: params?.page,
          limit: params?.limit,
        })}`,
      transformResponse: (res: { data: AdminCustomer[] }) => unwrapPaginated(res),
      providesTags: ['AdminCustomers'],
    }),

    getAdminCustomer: builder.query<AdminCustomer, string>({
      query: (id) => `/admin/customers/${id}`,
      transformResponse: (res: { data: AdminCustomer }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'AdminCustomers', id }],
    }),

    createAdminCustomer: builder.mutation<
      { message?: string; data?: AdminCustomer },
      { name: string; phone: string; email: string }
    >({
      query: (body) => ({
        url: '/admin/customers',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminCustomers'],
    }),

    updateAdminCustomer: builder.mutation<
      { message?: string; data?: AdminCustomer },
      { id: string; name: string; phone?: string; email?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/customers/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['AdminCustomers'],
    }),

    setAdminCustomerEnabled: builder.mutation<
      { message?: string },
      { id: string; is_enabled: boolean }
    >({
      query: ({ id, is_enabled }) => ({
        url: `/admin/customers/${id}/status`,
        method: 'PATCH',
        body: { is_enabled },
      }),
      invalidatesTags: ['AdminCustomers'],
    }),

    archiveAdminCustomer: builder.mutation<{ message?: string }, string>({
      query: (id) => ({
        url: `/admin/customers/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AdminCustomers'],
    }),

    unarchiveAdminCustomer: builder.mutation<{ message?: string }, string>({
      query: (id) => ({
        url: `/admin/customers/${id}/unarchive`,
        method: 'PATCH',
      }),
      invalidatesTags: ['AdminCustomers'],
    }),

    // ── Businesses (Public) ───────────────────────────────────────────────────

    getBusinesses: builder.query<
      Business[],
      { collection?: string; mood?: string; module?: 'dining' | 'event' | 'venue'; city?: string } | void
    >({
      query: (params) => {
        let url = '/businesses';
        if (params) {
          const searchParams = new URLSearchParams();
          if (params.collection) searchParams.append('collection', params.collection);
          if (params.mood) searchParams.append('mood', params.mood);
          if (params.module) searchParams.append('module', params.module);
          if (params.city) searchParams.append('city', params.city);
          const queryString = searchParams.toString();
          if (queryString) url += `?${queryString}`;
        }
        return url;
      },
      transformResponse: (res: { data: Business[] }) => res.data || [],
      providesTags: ['Businesses'],
    }),

    getBusinessesPaged: builder.query<PaginatedList<Business>, BusinessListQuery | void>({
      query: (params) => {
        const listParams = {
          collection: params?.collection,
          mood: params?.mood,
          module: params?.module,
          q: params?.q,
          city: params?.city,
          categories: params?.categories?.length ? params.categories.join(',') : undefined,
          cuisines: params?.cuisines?.length ? params.cuisines.join(',') : undefined,
          min_rating: params?.min_rating,
          offers_only: params?.offers_only ? 'true' : undefined,
          pure_veg: params?.pure_veg ? 'true' : undefined,
          serves_alcohol: params?.serves_alcohol ? 'true' : undefined,
          max_cost: params?.max_cost,
          sort: params?.sort,
          page: params?.page,
          limit: params?.limit,
        };
        return `/businesses${toListQuery(listParams)}`;
      },
      transformResponse: (res: { data: Business[]; meta?: any }) => unwrapPaginated(res),
      providesTags: ['Businesses'],
    }),

    getCollections: builder.query<Collection[], void>({
      query: () => '/businesses/collections',
      transformResponse: (res: { data: Collection[] }) => res.data || [],
      providesTags: [{ type: 'DiningMasters', id: 'COLLECTION_PUBLIC' }],
    }),

    getMoods: builder.query<Mood[], void>({
      query: () => '/businesses/moods',
      transformResponse: (res: { data: Mood[] }) => res.data || [],
    }),

    getDiningCuisines: builder.query<DiningCuisineMaster[], void>({
      query: () => '/businesses/cuisines',
      transformResponse: (res: { data?: DiningCuisineMaster[] }) => res?.data ?? [],
      providesTags: [{ type: 'DiningMasters', id: 'PUBLIC_LIST' }],
    }),

    getCities: builder.query<CityMaster[], { q?: string; popular?: boolean } | void>({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q) sp.set('q', params.q);
        if (params?.popular) sp.set('popular', 'true');
        const qs = sp.toString();
        return `/cities${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data?: CityMaster[] }) => res?.data ?? [],
      providesTags: [{ type: 'CityMasters', id: 'PUBLIC_LIST' }],
    }),

    getBusinessTypes: builder.query<
      BusinessType[],
      'dining' | 'event' | 'venue' | 'artist' | 'cinema' | void
    >({
      query: (module) => {
        const qs = module ? `?module=${module}` : '';
        return `/businesses/types${qs}`;
      },
      transformResponse: (res: { data: BusinessType[] }) => res.data || [],
    }),

    getPartnerDocumentMasters: builder.query<
      PartnerDocumentMaster[],
      'dining' | 'event' | 'venue' | 'artist' | void
    >({
      query: (module) => {
        const qs = module ? `?module=${module}` : '';
        return `/businesses/partner-documents${qs}`;
      },
      transformResponse: (res: { data?: PartnerDocumentMaster[] }) => res?.data ?? [],
      providesTags: ['PartnerDocuments'],
    }),

    getPartnerOnboardingTerms: builder.query<
      PartnerOnboardingTerm[],
      'dining' | 'event' | 'venue' | 'artist' | void
    >({
      query: (module) => {
        const qs = module ? `?module=${module}` : '';
        return `/businesses/partner-onboarding-terms${qs}`;
      },
      transformResponse: (res: { data?: PartnerOnboardingTerm[] }) => res?.data ?? [],
      providesTags: ['PartnerDocuments'],
    }),

    getAdminPartnerDocuments: builder.query<
      PaginatedList<PartnerDocumentMaster>,
      { module?: 'dining' | 'event' | 'venue' | 'artist' | 'both'; q?: string; page?: number; limit?: number } | void
    >({
      query: (params) =>
        `/admin/partner-documents${toListQuery({
          module: params?.module,
          q: params?.q,
          page: params?.page,
          limit: params?.limit,
        })}`,
      transformResponse: (res: { data?: PartnerDocumentMaster[] }) => unwrapPaginated(res),
      providesTags: (result) =>
        result?.items
          ? [
            ...result.items.map((d) => ({ type: 'PartnerDocuments' as const, id: d.id })),
            { type: 'PartnerDocuments', id: 'LIST' },
            'PartnerDocuments',
          ]
          : [{ type: 'PartnerDocuments', id: 'LIST' }, 'PartnerDocuments'],
    }),

    createAdminPartnerDocument: builder.mutation<
      PartnerDocumentMaster,
      {
        name: string;
        description?: string;
        module?: 'dining' | 'event' | 'venue' | 'artist' | 'both';
        is_required?: boolean;
        is_active?: boolean;
        sort_order?: number;
      }
    >({
      query: (body) => ({
        url: '/admin/partner-documents',
        method: 'POST',
        body: { is_active: true, ...body },
      }),
      transformResponse: (res: { data?: PartnerDocumentMaster }) =>
        res?.data ?? ({} as PartnerDocumentMaster),
      invalidatesTags: [{ type: 'PartnerDocuments', id: 'LIST' }, 'PartnerDocuments'],
    }),

    updateAdminPartnerDocument: builder.mutation<
      PartnerDocumentMaster,
      { id: number; body: Partial<PartnerDocumentMaster> }
    >({
      query: ({ id, body }) => ({ url: `/admin/partner-documents/${id}`, method: 'PUT', body }),
      transformResponse: (res: { data?: PartnerDocumentMaster }) => {
        if (!res?.data) throw new Error('Update failed — empty response.');
        return res.data;
      },
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'PartnerDocuments', id },
        { type: 'PartnerDocuments', id: 'LIST' },
        'PartnerDocuments',
      ],
    }),

    deleteAdminPartnerDocument: builder.mutation<void, number>({
      query: (id) => ({ url: `/admin/partner-documents/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'PartnerDocuments', id: 'LIST' }, 'PartnerDocuments'],
    }),

    getAdminPartnerOnboardingTerms: builder.query<
      PartnerOnboardingTerm[],
      { module?: 'dining' | 'event' | 'venue' | 'artist' | 'both' } | void
    >({
      query: (params) => {
        const qs = params?.module ? `?module=${params.module}` : '';
        return `/admin/partner-onboarding-terms${qs}`;
      },
      transformResponse: (res: { data?: PartnerOnboardingTerm[] }) => res?.data ?? [],
      providesTags: ['PartnerDocuments'],
    }),

    createAdminPartnerOnboardingTerm: builder.mutation<
      PartnerOnboardingTerm,
      { module?: 'dining' | 'event' | 'venue' | 'artist' | 'both'; text: string; is_active?: boolean; sort_order?: number }
    >({
      query: (body) => ({ url: '/admin/partner-onboarding-terms', method: 'POST', body }),
      transformResponse: (res: { data?: PartnerOnboardingTerm }) => res?.data ?? ({} as PartnerOnboardingTerm),
      invalidatesTags: ['PartnerDocuments'],
    }),

    updateAdminPartnerOnboardingTerm: builder.mutation<
      PartnerOnboardingTerm,
      { id: number; body: Partial<PartnerOnboardingTerm> }
    >({
      query: ({ id, body }) => ({ url: `/admin/partner-onboarding-terms/${id}`, method: 'PUT', body }),
      transformResponse: (res: { data?: PartnerOnboardingTerm }) => {
        if (!res?.data) throw new Error('Update failed — empty response.');
        return res.data;
      },
      invalidatesTags: ['PartnerDocuments'],
    }),

    deleteAdminPartnerOnboardingTerm: builder.mutation<void, number>({
      query: (id) => ({ url: `/admin/partner-onboarding-terms/${id}`, method: 'DELETE' }),
      invalidatesTags: ['PartnerDocuments'],
    }),

    getBusinessPublic: builder.query<Business, string>({
      query: (id) => `/businesses/${id}/public`,
      transformResponse: (res: { data: Business }) => res.data,
    }),

    // ── Business Settings (Admin/Business Portal) ─────────────────────────────

    getBusinessSettings: builder.query<BusinessSettings, string>({
      query: (bizId) => `/businesses/${bizId}/settings`,
      transformResponse: (res: { data: BusinessSettings }) => res.data,
      providesTags: (_result, _error, bizId) => [{ type: 'BusinessSettings', id: bizId }],
    }),

    updateBusinessSettings: builder.mutation<
      { success: boolean },
      { bizId: string; body: Partial<BusinessSettings> }
    >({
      query: ({ bizId, body }) => {
        const payload: Record<string, unknown> = { ...body };
        // JSONB columns: node-pg serializes JS arrays as PG arrays (`{...}`), which is invalid JSON.
        if (Array.isArray(body.gallery_images)) {
          payload.gallery_images = JSON.stringify(body.gallery_images);
        }
        if (Array.isArray(body.menu_images)) {
          payload.menu_images = JSON.stringify(body.menu_images);
        }
        return {
          url: `/businesses/${bizId}/settings`,
          method: 'PUT',
          body: payload,
        };
      },
      invalidatesTags: (_result, _error, { bizId }) => [
        { type: 'BusinessSettings', id: bizId },
        'Businesses',
        'DiningMasters',
      ],
    }),

    getVenueLayoutRequests: builder.query<VenueLayoutRequest[], string>({
      query: (bizId) => `/businesses/${bizId}/venue-layout-requests`,
      transformResponse: (res: { data?: VenueLayoutRequest[] }) => res?.data ?? [],
      providesTags: (_result, _error, bizId) => [{ type: 'BusinessSettings', id: `${bizId}-venue-layouts` }],
    }),

    createVenueLayoutRequest: builder.mutation<
      VenueLayoutRequest,
      {
        bizId: string;
        request_id?: string;
        hall_name: string;
        hall_description?: string;
        hall_capacity?: number;
        is_indoor?: boolean;
        layout_name: string;
        layout_type: string;
        capacity: number;
        spec_json?: Record<string, unknown>;
        submit_now?: boolean;
      }
    >({
      query: ({ bizId, ...body }) => ({
        url: `/businesses/${bizId}/venue-layout-requests`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: VenueLayoutRequest }) => res.data,
      invalidatesTags: (_result, _error, arg) => [
        { type: 'BusinessSettings', id: `${arg?.bizId}-venue-layouts` },
        'VenueLayouts',
      ],
    }),

    getAdminVenueLayoutRequests: builder.query<
      VenueLayoutRequest[],
      { tab?: string; status?: string; business_id?: string } | void
    >({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params?.tab) searchParams.set('tab', params.tab);
        if (params?.status) searchParams.set('status', params.status);
        if (params?.business_id) searchParams.set('business_id', params.business_id);
        const qs = searchParams.toString();
        return `/admin/venue-layout-requests${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data?: VenueLayoutRequest[] }) => res?.data ?? [],
      providesTags: ['VenueLayouts'],
    }),

    getAdminVenueLayoutRequest: builder.query<VenueLayoutRequest, string>({
      query: (id) => `/admin/venue-layout-requests/${id}`,
      transformResponse: (res: { data: VenueLayoutRequest }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'VenueLayouts', id }],
    }),

    reviewAdminVenueLayoutRequest: builder.mutation<
      VenueLayoutRequest,
      { id: string; status: 'UNDER_REVIEW' | 'REJECTED'; review_comments?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/venue-layout-requests/${id}/review`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (res: { data: VenueLayoutRequest }) => res.data,
      invalidatesTags: ['VenueLayouts'],
    }),

    saveAdminVenueLayoutTemplate: builder.mutation<
      VenueLayoutTemplate,
      {
        id: string;
        seating_config: Record<string, unknown>;
        seats: unknown[];
        publish?: boolean;
        name?: string;
        template_id?: string;
        save_as_new?: boolean;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/venue-layout-requests/${id}/template`,
        method: 'PUT',
        body,
      }),
      transformResponse: (res: { data: VenueLayoutTemplate }) => res.data,
      invalidatesTags: ['VenueLayouts'],
    }),

    getAdminEventLayoutRequests: builder.query<
      AdminEventLayoutRequest[],
      { tab?: string; q?: string } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.tab) sp.set('tab', params.tab);
        if (params?.q?.trim()) sp.set('q', params.q.trim());
        const qs = sp.toString();
        return `/admin/event-layout-requests${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data?: AdminEventLayoutRequest[] }) => res?.data ?? [],
      providesTags: ['EventLayoutRequests'],
    }),

    getAdminEventLayoutRequest: builder.query<AdminEventLayoutRequest, string>({
      query: (id) => `/admin/event-layout-requests/${id}`,
      transformResponse: (res: { data: AdminEventLayoutRequest }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'EventLayoutRequests', id }],
    }),

    reviewAdminEventLayoutRequest: builder.mutation<
      AdminEventLayoutRequest,
      { id: string; status: 'UNDER_REVIEW' | 'REJECTED'; rejection_reason?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/event-layout-requests/${id}/review`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (res: { data: AdminEventLayoutRequest }) => res.data,
      invalidatesTags: ['EventLayoutRequests', 'OrganizerEvents', 'AdminEvents'],
    }),

    fulfillAdminEventLayoutRequest: builder.mutation<
      { data: AdminEventLayoutRequest; message?: string },
      {
        id: string;
        fulfilled_template_id?: string | null;
        apply_to_event?: boolean;
        notes?: string;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/event-layout-requests/${id}/fulfill`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EventLayoutRequests', 'EventLayouts', 'OrganizerEvents', 'AdminEvents'],
    }),

    reviewOrganizerEventLayoutRequest: builder.mutation<
      { data?: unknown },
      { id: string; action: 'approve' | 'request_changes'; notes?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/events/organizer/layout-requests/${id}/review`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['OrganizerEvents', 'EventLayoutRequests'],
    }),

    getGeoCountries: builder.query<Array<{ id: number; name: string; slug?: string }>, void>({
      query: () => `/geo/countries`,
      transformResponse: (res: { data?: Array<{ id: number; name: string; slug?: string }> }) =>
        res?.data ?? [],
    }),

    getGeoStates: builder.query<
      Array<{ id: number; country_id: number; name: string }>,
      { country_id?: number } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.country_id) sp.set('country_id', String(params.country_id));
        const qs = sp.toString();
        return `/geo/states${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: {
        data?: Array<{ id: number; country_id: number; name: string }>;
      }) => res?.data ?? [],
    }),

    getGeoLocations: builder.query<
      Array<{ id: number; city_id: number; name: string }>,
      { city_id: number }
    >({
      query: ({ city_id }) => `/geo/locations?city_id=${city_id}`,
      transformResponse: (res: { data?: Array<{ id: number; city_id: number; name: string }> }) =>
        res?.data ?? [],
    }),

    getAdminGeoCountries: builder.query<Array<{ id: number; name: string }>, void>({
      query: () => `/admin/geo/countries?limit=200`,
      transformResponse: (res: { data?: Array<{ id: number; name: string }> }) => res?.data ?? [],
    }),
    createAdminGeoCountry: builder.mutation<{ id: number; name: string }, { name: string }>({
      query: (body) => ({ url: `/admin/geo/countries`, method: 'POST', body }),
      transformResponse: (res: { data: { id: number; name: string } }) => res.data,
      invalidatesTags: ['CityMasters'],
    }),
    getAdminGeoStates: builder.query<
      Array<{ id: number; country_id: number; name: string }>,
      { country_id?: number } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.country_id) sp.set('country_id', String(params.country_id));
        const qs = sp.toString();
        return `/admin/geo/states${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: {
        data?: Array<{ id: number; country_id: number; name: string }>;
      }) => res?.data ?? [],
    }),
    createAdminGeoState: builder.mutation<
      { id: number; name: string },
      { country_id: number; name: string }
    >({
      query: (body) => ({ url: `/admin/geo/states`, method: 'POST', body }),
      transformResponse: (res: { data: { id: number; name: string } }) => res.data,
      invalidatesTags: ['CityMasters'],
    }),
    getAdminGeoLocations: builder.query<
      Array<{ id: number; city_id: number; name: string }>,
      { city_id?: number } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.city_id) sp.set('city_id', String(params.city_id));
        const qs = sp.toString();
        return `/admin/geo/locations${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: {
        data?: Array<{ id: number; city_id: number; name: string }>;
      }) => res?.data ?? [],
    }),
    createAdminGeoLocation: builder.mutation<
      { id: number; name: string },
      { city_id: number; name: string }
    >({
      query: (body) => ({ url: `/admin/geo/locations`, method: 'POST', body }),
      transformResponse: (res: { data: { id: number; name: string } }) => res.data,
      invalidatesTags: ['CityMasters'],
    }),

    getVenueLayoutTemplates: builder.query<VenueLayoutTemplate[], string>({
      query: (bizId) => `/businesses/${bizId}/venue-layout-templates`,
      transformResponse: (res: { data?: VenueLayoutTemplate[] }) => res?.data ?? [],
      providesTags: ['VenueLayouts'],
    }),

    getVenueLayoutTemplate: builder.query<VenueLayoutTemplate, { bizId: string; templateId: string }>({
      query: ({ bizId, templateId }) => `/businesses/${bizId}/venue-layout-templates/${templateId}`,
      transformResponse: (res: { data: VenueLayoutTemplate }) => res.data,
      providesTags: (_r, _e, arg) => [{ type: 'VenueLayouts', id: arg.templateId }],
    }),

    approveVenueLayoutTemplate: builder.mutation<VenueLayoutTemplate, { bizId: string; templateId: string }>({
      query: ({ bizId, templateId }) => ({
        url: `/businesses/${bizId}/venue-layout-templates/${templateId}/approve`,
        method: 'POST',
      }),
      transformResponse: (res: { data: VenueLayoutTemplate }) => res.data,
      invalidatesTags: ['VenueLayouts'],
    }),

    rejectVenueLayoutTemplate: builder.mutation<
      VenueLayoutTemplate,
      { bizId: string; templateId: string; reason: string }
    >({
      query: ({ bizId, templateId, reason }) => ({
        url: `/businesses/${bizId}/venue-layout-templates/${templateId}/reject`,
        method: 'POST',
        body: { reason },
      }),
      transformResponse: (res: { data: VenueLayoutTemplate }) => res.data,
      invalidatesTags: ['VenueLayouts'],
    }),

    getApprovedVenueLayout: builder.query<VenueLayoutTemplate | null, string>({
      query: (bizId) => `/businesses/${bizId}/approved-venue-layout`,
      transformResponse: (res: { data?: VenueLayoutTemplate | null }) => res?.data ?? null,
      providesTags: ['VenueLayouts'],
    }),

    // ── Tables ────────────────────────────────────────────────────────────────

    getTables: builder.query<PaginatedList<Table>, PagedBizQuery>({
      query: (arg) => `/businesses/${bizIdOf(arg)}/tables${pagedBizQuery(arg)}`,
      transformResponse: (res: { data: Table[] }) => unwrapPaginated(res),
      providesTags: (_result, _error, arg) => [{ type: 'Tables', id: bizIdOf(arg) }],
    }),

    addTable: builder.mutation<
      { success: boolean },
      { bizId: string; table_number: string; capacity: number }
    >({
      query: ({ bizId, ...body }) => ({
        url: `/businesses/${bizId}/tables`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { bizId }) => [{ type: 'Tables', id: bizId }],
    }),

    updateTable: builder.mutation<
      { success: boolean },
      { bizId: string; tableId: string; is_active: boolean }
    >({
      query: ({ bizId, tableId, ...body }) => ({
        url: `/businesses/${bizId}/tables/${tableId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { bizId }) => [{ type: 'Tables', id: bizId }],
    }),

    deleteTable: builder.mutation<{ success: boolean }, { bizId: string; tableId: string }>({
      query: ({ bizId, tableId }) => ({
        url: `/businesses/${bizId}/tables/${tableId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { bizId }) => [{ type: 'Tables', id: bizId }],
    }),

    // ── Bookings ──────────────────────────────────────────────────────────────

    getBusinessBookings: builder.query<PaginatedList<Booking>, PagedBizQuery>({
      query: (arg) => `/bookings/${bizIdOf(arg)}${pagedBizQuery(arg)}`,
      transformResponse: (res: { data: Booking[] }) => unwrapPaginated(res),
      providesTags: (_result, _error, arg) => [{ type: 'Bookings', id: bizIdOf(arg) }],
    }),

    getCustomerBookings: builder.query<Booking[], string>({
      query: (customerId) => `/bookings/customer/${customerId}`,
      transformResponse: (res: { data: Booking[] }) => res.data || [],
      providesTags: (_result, _error, customerId) => [{ type: 'Bookings', id: customerId }],
    }),

    checkAvailability: builder.query<
      { available: boolean },
      { business_id: string; date: string; guests: string }
    >({
      query: ({ business_id, date, guests }) =>
        `/bookings/availability?business_id=${business_id}&date=${date}&guests=${guests}`,
    }),

    createBooking: builder.mutation<
      {
        message?: string;
        booking_id?: string;
        table_assigned?: string;
        qr_token?: string;
        applied_offer?: Booking['applied_offer'];
        special_request?: string | null;
      },
      {
        business_id: string;
        customer_name: string;
        customer_phone: string;
        booking_time: string;
        booking_source: 'ONLINE' | 'WALK_IN';
        guests: number;
        customer_id?: string;
        approx_arrival?: string;
        special_request?: string | null;
        applied_offer?: {
          type?: string;
          title?: string;
          validity?: string;
          promo_code?: string;
          id?: string;
          offer_id?: string;
          source?: 'merchant' | 'platform' | string;
          discount_type?: string;
          discount_value?: number;
          max_discount?: number | null;
          min_bill_amount?: number;
        } | null;
      }
    >({
      query: (body) => ({
        url: '/bookings',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Bookings'],
    }),

    phoneLogin: builder.mutation<
      { token: string; user: AuthUser; message?: string },
      { phone: string; otp: string }
    >({
      query: (body) => ({
        url: '/auth/phone-login',
        method: 'POST',
        body,
      }),
    }),

    getCustomerProfile: builder.query<CustomerProfile, string>({
      query: (customerId) => `/auth/customer-profile/${customerId}`,
      transformResponse: (res: { data: CustomerProfile }) => res.data,
      providesTags: (_result, _error, customerId) => [{ type: 'CustomerProfile', id: customerId }],
    }),

    updateCustomerProfile: builder.mutation<
      { message: string; data: CustomerProfile },
      {
        customerId: string;
        name: string;
        phone?: string;
        email?: string;
        profile_image_url?: string;
        address?: string;
        city?: string;
        state?: string;
      }
    >({
      query: ({ customerId, ...body }) => ({
        url: `/auth/customer-profile/${customerId}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { customerId }) => [{ type: 'CustomerProfile', id: customerId }],
    }),

    cancelBooking: builder.mutation<{ success: boolean }, { id: string; refetchId?: string }>({
      query: ({ id }) => ({
        url: `/bookings/${id}/cancel`,
        method: 'PUT',
      }),
      invalidatesTags: ['Bookings'],
    }),

    getBookingById: builder.query<Booking, string>({
      query: (id) => `/bookings/detail/${id}`,
      transformResponse: (res: { data: Booking }) => res.data,
      providesTags: (_result, _error, id) => [{ type: 'Bookings', id }],
    }),

    scanDiningBookingQr: builder.mutation<{ data: Booking }, { qr_token: string }>({
      query: (body) => ({
        url: '/bookings/scan',
        method: 'POST',
        body,
      }),
    }),

    checkoutDiningBooking: builder.mutation<
      { message?: string; data: Booking },
      {
        id: string;
        offer_redeemed?: boolean;
        bill_amount?: number | null;
        promo_code?: string;
        offer_redemption_notes?: string;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/bookings/${id}/checkout`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Bookings', 'DiningOfferRedemptions', 'OfferRedemptions', 'PublicPlatformOffers'],
    }),

    validateMerchantPromoCode: builder.mutation<
      { discount_label?: string; promo_code?: string; title?: string; discount_type?: string; discount_value?: number },
      { promo_code: string; bill_amount?: number | null }
    >({
      query: (body) => ({
        url: '/bookings/validate-merchant-promo',
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: Record<string, unknown> }) => res.data as {
        discount_label?: string;
        promo_code?: string;
        title?: string;
      },
    }),

    redeemWalkInMerchantPromo: builder.mutation<
      { message?: string; data: Record<string, unknown> },
      {
        promo_code: string;
        bill_amount: number;
        guest_name?: string;
        guest_phone?: string;
        notes?: string;
      }
    >({
      query: (body) => ({
        url: '/bookings/redeem-walkin-promo',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['DiningOfferRedemptions'],
    }),

    getMerchantOfferRedemptions: builder.query<
      DiningOfferRedemptionReport,
      { q?: string; page?: number; limit?: number; from?: string; to?: string } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q) sp.set('q', params.q);
        if (params?.page) sp.set('page', String(params.page));
        if (params?.limit) sp.set('limit', String(params.limit));
        if (params?.from) sp.set('from', params.from);
        if (params?.to) sp.set('to', params.to);
        const qs = sp.toString();
        return `/bookings/merchant-offer-redemptions${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: {
        data?: DiningOfferRedemption[];
        meta?: import('@/lib/pagination').PaginationMeta;
        summary?: DiningOfferRedemptionReport['summary'];
        by_offer?: DiningOfferRedemptionReport['by_offer'];
      }) => ({
        items: res.data ?? [],
        meta: res.meta,
        summary: res.summary,
        by_offer: res.by_offer,
      }),
      providesTags: ['DiningOfferRedemptions'],
    }),

    // ── Reviews ──────────────────────────────────────────────────────────────

    getReviews: builder.query<PaginatedList<Review>, PagedBizQuery>({
      query: (arg) => `/reviews/${bizIdOf(arg)}${pagedBizQuery(arg)}`,
      transformResponse: (res: { data: Review[] }) => unwrapPaginated(res),
      providesTags: (_result, _error, arg) => [{ type: 'Reviews', id: bizIdOf(arg) }],
    }),

    createReview: builder.mutation<
      { message: string; data: Review; newStats: { rating: number; reviews_count: number } },
      { businessId: string; user_name: string; rating: number; text: string }
    >({
      query: ({ businessId, ...body }) => ({
        url: `/reviews/${businessId}`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { businessId }) => [
        { type: 'Reviews', id: businessId },
        { type: 'Businesses', id: businessId },
        { type: 'Businesses', id: 'ALL' }
      ],
    }),

    createReviewReply: builder.mutation<
      { message: string; data: ReviewReply },
      { reviewId: number; businessId: string; user_name: string; user_type: string; text: string }
    >({
      query: ({ reviewId, ...body }) => ({
        url: `/reviews/${reviewId}/reply`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { businessId }) => [
        { type: 'Reviews', id: businessId }
      ],
    }),

    // ── Admin ─────────────────────────────────────────────────────────────────

    getAdminStats: builder.query<AdminStats, void>({
      query: () => '/admin/stats',
      transformResponse: (res: { data: AdminStats }) => res.data,
      providesTags: ['AdminStats'],
    }),

    updateSubscription: builder.mutation<
      { success: boolean },
      { id: string; subscription_plan: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/businesses/${id}/subscription`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Businesses'],
    }),

    getMarketingPlans: builder.query<PaginatedList<any>, PagedQuery | void>({
      query: (params) => `/admin/marketing-plans${toListQuery({ q: params?.q, page: params?.page, limit: params?.limit })}`,
      transformResponse: (res: { data: any[] }) => unwrapPaginated(res),
      providesTags: ['MarketingPlans'],
    }),

    createMarketingPlan: builder.mutation<any, Partial<any>>({
      query: (body) => ({
        url: '/admin/marketing-plans',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['MarketingPlans'],
    }),

    updateMarketingPlan: builder.mutation<any, Partial<any> & { id: number }>({
      query: ({ id, ...body }) => ({
        url: `/admin/marketing-plans/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['MarketingPlans'],
    }),

    deleteMarketingPlan: builder.mutation<any, number>({
      query: (id) => ({
        url: `/admin/marketing-plans/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['MarketingPlans'],
    }),

    getPlatformOffers: builder.query<PaginatedList<PlatformOffer>, (PagedQuery & { status?: string }) | void>({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q) sp.set('q', params.q);
        if (params?.page) sp.set('page', String(params.page));
        if (params?.limit) sp.set('limit', String(params.limit));
        if (params?.status) sp.set('status', params.status);
        const qs = sp.toString();
        return `/admin/platform-offers${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data: PlatformOffer[] }) => unwrapPaginated(res),
      providesTags: ['PlatformOffers'],
    }),

    getPlatformOffer: builder.query<PlatformOffer, string>({
      query: (id) => `/admin/platform-offers/${id}`,
      transformResponse: (res: { data: PlatformOffer }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'PlatformOffers', id }],
    }),

    createPlatformOffer: builder.mutation<PlatformOffer, Partial<PlatformOffer> & { event_ids?: string[]; restaurant_ids?: string[] }>({
      query: (body) => ({
        url: '/admin/platform-offers',
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: PlatformOffer }) => res.data,
      invalidatesTags: ['PlatformOffers', 'PublicPlatformOffers'],
    }),

    updatePlatformOffer: builder.mutation<PlatformOffer, Partial<PlatformOffer> & { id: string; event_ids?: string[]; restaurant_ids?: string[] }>({
      query: ({ id, ...body }) => ({
        url: `/admin/platform-offers/${id}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (res: { data: PlatformOffer }) => res.data,
      invalidatesTags: ['PlatformOffers', 'PublicPlatformOffers'],
    }),

    patchPlatformOfferStatus: builder.mutation<PlatformOffer, { id: string; status: string }>({
      query: ({ id, status }) => ({
        url: `/admin/platform-offers/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      transformResponse: (res: { data: PlatformOffer }) => res.data,
      invalidatesTags: ['PlatformOffers', 'PublicPlatformOffers'],
    }),

    deletePlatformOffer: builder.mutation<{ message?: string }, string>({
      query: (id) => ({
        url: `/admin/platform-offers/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['PlatformOffers', 'PublicPlatformOffers'],
    }),

    getOfferRedemptions: builder.query<PaginatedList<OfferRedemption>, (PagedQuery & { offer_id?: string }) | void>({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q) sp.set('q', params.q);
        if (params?.page) sp.set('page', String(params.page));
        if (params?.limit) sp.set('limit', String(params.limit));
        if (params?.offer_id) sp.set('offer_id', params.offer_id);
        const qs = sp.toString();
        return `/admin/platform-offers/redemptions${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data: OfferRedemption[] }) => unwrapPaginated(res),
      providesTags: ['OfferRedemptions'],
    }),

    getOfferEligibleEventsAdmin: builder.query<Array<{ id: string; name: string; status: string }>, void>({
      query: () => '/admin/platform-offers/eligible-events',
      transformResponse: (res: { data: Array<{ id: string; name: string; status: string }> }) => res.data || [],
    }),

    getOfferEligibleRestaurantsAdmin: builder.query<Array<{ id: string; name: string }>, void>({
      query: () => '/admin/platform-offers/eligible-restaurants',
      transformResponse: (res: { data: Array<{ id: string; name: string }> }) => res.data || [],
    }),

    getActivePlatformOffers: builder.query<PlatformOffer[], void>({
      query: () => '/platform-offers/active',
      transformResponse: (res: { data: PlatformOffer[] }) => res.data || [],
      providesTags: ['PublicPlatformOffers'],
    }),

    getDiningEligiblePlatformOffers: builder.query<
      DiningEligiblePlatformOffer[],
      { restaurant_id: string; guest_phone?: string }
    >({
      query: ({ restaurant_id, guest_phone }) => {
        const sp = new URLSearchParams({ restaurant_id });
        if (guest_phone) sp.set('guest_phone', guest_phone);
        return `/platform-offers/dining-eligible?${sp.toString()}`;
      },
      transformResponse: (res: { data: DiningEligiblePlatformOffer[] }) => res.data || [],
      providesTags: ['PublicPlatformOffers'],
    }),

    validatePlatformPromoCode: builder.mutation<
      AppliedPromoOffer & { discount_label?: string; max_discount?: number | null; min_order_amount?: number },
      {
        event_id?: string;
        restaurant_id?: string;
        business_id?: string;
        promo_code?: string;
        offer_id?: string;
        ticket_amount?: number;
        bill_amount?: number;
        guest_phone?: string;
        skip_min_order?: boolean;
        booking_id?: string;
      }
    >({
      query: (body) => ({
        url: '/platform-offers/validate',
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: AppliedPromoOffer & { discount_label?: string } }) => res.data,
    }),

    getGiftCardProducts: builder.query<
      PaginatedList<GiftCardProduct>,
      (PagedQuery & { status?: string }) | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q) sp.set('q', params.q);
        if (params?.page) sp.set('page', String(params.page));
        if (params?.limit) sp.set('limit', String(params.limit));
        if (params?.status) sp.set('status', params.status);
        const qs = sp.toString();
        return `/admin/gift-card-products${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data: GiftCardProduct[] }) => unwrapPaginated(res),
      providesTags: ['GiftCardProducts'],
    }),

    createGiftCardProduct: builder.mutation<GiftCardProduct, Partial<GiftCardProduct>>({
      query: (body) => ({
        url: '/admin/gift-card-products',
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: GiftCardProduct }) => res.data,
      invalidatesTags: ['GiftCardProducts', 'PublicGiftCardProducts'],
    }),

    updateGiftCardProduct: builder.mutation<GiftCardProduct, Partial<GiftCardProduct> & { id: string }>({
      query: ({ id, ...body }) => ({
        url: `/admin/gift-card-products/${id}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (res: { data: GiftCardProduct }) => res.data,
      invalidatesTags: ['GiftCardProducts', 'PublicGiftCardProducts'],
    }),

    patchGiftCardProductStatus: builder.mutation<GiftCardProduct, { id: string; status: string }>({
      query: ({ id, status }) => ({
        url: `/admin/gift-card-products/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      transformResponse: (res: { data: GiftCardProduct }) => res.data,
      invalidatesTags: ['GiftCardProducts', 'PublicGiftCardProducts'],
    }),

    deleteGiftCardProduct: builder.mutation<{ message?: string }, string>({
      query: (id) => ({
        url: `/admin/gift-card-products/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['GiftCardProducts', 'PublicGiftCardProducts'],
    }),

    getPublicGiftCardProducts: builder.query<GiftCardProduct[], void>({
      query: () => '/gift-cards/products',
      transformResponse: (res: { data: GiftCardProduct[] }) => res.data || [],
      providesTags: ['PublicGiftCardProducts'],
    }),

    purchaseGiftCard: builder.mutation<
      { message?: string; data: GiftCardPurchaseResult },
      GiftCardPurchaseBody
    >({
      query: (body) => ({
        url: '/gift-cards/purchase',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['MyGiftCards', 'GiftCardProducts'],
    }),

    getMyGiftCards: builder.query<GiftCardMine[], void>({
      query: () => '/gift-cards/mine',
      transformResponse: (res: { data: GiftCardMine[] }) => res.data || [],
      providesTags: ['MyGiftCards'],
    }),

    getDiningWishlist: builder.query<(Business & { wishlisted_at?: string })[], void>({
      query: () => '/wishlist/dining',
      transformResponse: (res: { data: (Business & { wishlisted_at?: string })[] }) => res.data || [],
      providesTags: ['DiningWishlist'],
    }),

    getDiningWishlistIds: builder.query<string[], void>({
      query: () => '/wishlist/dining/ids',
      transformResponse: (res: { data: string[] }) => res.data || [],
      providesTags: ['DiningWishlist'],
    }),

    toggleDiningWishlist: builder.mutation<
      { message?: string; data: { business_id: string; wishlisted: boolean } },
      { business_id: string }
    >({
      query: (body) => ({
        url: '/wishlist/dining/toggle',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['DiningWishlist'],
    }),

    syncDiningWishlist: builder.mutation<
      { message?: string; data: { added: number } },
      { business_ids: string[] }
    >({
      query: (body) => ({
        url: '/wishlist/dining/sync',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['DiningWishlist'],
    }),

    getMyGiftCard: builder.query<GiftCardMine, string>({
      query: (id) => `/gift-cards/mine/${id}`,
      transformResponse: (res: { data: GiftCardMine }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'MyGiftCards', id }],
    }),

    claimGiftCard: builder.mutation<
      { message?: string; data: { id: string; code_last4: string; code_masked: string; current_balance: number } },
      { code: string }
    >({
      query: (body) => ({
        url: '/gift-cards/claim',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['MyGiftCards'],
    }),

    previewGiftCardRedeem: builder.mutation<
      GiftCardRedeemPreview,
      { gift_card_id?: string; code?: string; amount: number; category?: 'EVENTS' | 'SPORTS' | 'DINING' }
    >({
      query: (body) => ({
        url: '/gift-cards/preview-redeem',
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: GiftCardRedeemPreview }) => res.data,
    }),

    merchantVerifyGiftCard: builder.mutation<MerchantGiftCardVerify, { code: string }>({
      query: (body) => ({
        url: '/gift-cards/merchant/verify',
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: MerchantGiftCardVerify }) => res.data,
    }),

    merchantPreviewGiftCard: builder.mutation<
      MerchantGiftCardPreview,
      { code: string; bill_amount: number }
    >({
      query: (body) => ({
        url: '/gift-cards/merchant/preview',
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: MerchantGiftCardPreview }) => res.data,
    }),

    merchantRedeemGiftCard: builder.mutation<
      { message?: string; data: MerchantGiftCardRedeemResult },
      {
        code: string;
        bill_amount: number;
        booking_id?: string;
        guest_name?: string;
        guest_phone?: string;
      }
    >({
      query: (body) => ({
        url: '/gift-cards/merchant/redeem',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['DiningGiftCardRedemptions', 'AdminDiningGiftCardSettlements', 'MyGiftCards'],
    }),

    getMerchantGiftCardRedemptions: builder.query<
      { data: DiningGiftCardRedemptionRow[]; meta?: { total?: number } },
      { page?: number; limit?: number } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        sp.set('page', String(params?.page || 1));
        sp.set('limit', String(params?.limit || 10));
        return `/gift-cards/merchant/redemptions?${sp.toString()}`;
      },
      providesTags: ['DiningGiftCardRedemptions'],
    }),

    getAdminDiningGiftCardRedemptions: builder.query<
      {
        items: DiningGiftCardRedemptionRow[];
        meta: import('@/lib/pagination').PaginationMeta;
        summary: DiningGiftCardSettlementSummary;
      },
      {
        page?: number;
        limit?: number;
        q?: string;
        business_id?: string;
        status?: string;
        from?: string;
        to?: string;
      } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.page) sp.set('page', String(params.page));
        if (params?.limit) sp.set('limit', String(params.limit));
        if (params?.q) sp.set('q', params.q);
        if (params?.business_id) sp.set('business_id', params.business_id);
        if (params?.status) sp.set('status', params.status);
        if (params?.from) sp.set('from', params.from);
        if (params?.to) sp.set('to', params.to);
        const qs = sp.toString();
        return `/admin/dining-gift-card-redemptions${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: {
        data?: DiningGiftCardRedemptionRow[];
        meta?: import('@/lib/pagination').PaginationMeta;
        summary?: DiningGiftCardSettlementSummary;
      }) => ({
        items: res.data || [],
        meta: res.meta || {
          page: 1,
          limit: 20,
          total: 0,
          total_pages: 0,
          has_prev: false,
          has_next: false,
        },
        summary: res.summary || {
          pending_count: 0,
          approved_count: 0,
          paid_count: 0,
          cancelled_count: 0,
          pending_amount: 0,
          approved_amount: 0,
          paid_amount: 0,
        },
      }),
      providesTags: ['AdminDiningGiftCardSettlements'],
    }),

    patchAdminDiningGiftCardSettlement: builder.mutation<
      { message?: string; data: DiningGiftCardRedemptionRow },
      { id: string; settlement_status: string; settlement_notes?: string }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/dining-gift-card-redemptions/${id}/settlement`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['AdminDiningGiftCardSettlements', 'DiningGiftCardRedemptions'],
    }),

    getMarketingCampaigns: builder.query<PaginatedList<any>, PagedQuery | void>({
      query: (params) => `/admin/marketing-campaigns${toListQuery({ q: params?.q, page: params?.page, limit: params?.limit })}`,
      transformResponse: (res: { data: any[] }) => unwrapPaginated(res),
      providesTags: ['MarketingCampaigns'],
    }),

    assignMarketingCampaign: builder.mutation<any, { businessId: string; plan_id: number; end_date: string }>({
      query: ({ businessId, ...body }) => ({
        url: `/admin/businesses/${businessId}/marketing-campaigns`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['MarketingCampaigns', 'Businesses'],
    }),

    // ── Admin Events & Commission ─────────────────────────────────────────────

    getAdminEvents: builder.query<
      PaginatedList<AdminEvent>,
      { status?: string; q?: string; page?: number; limit?: number } | void
    >({
      query: (params) =>
        `/admin/events${toListQuery({
          status: params?.status,
          q: params?.q,
          page: params?.page,
          limit: params?.limit,
        })}`,
      transformResponse: (res: { data: AdminEvent[] }) => unwrapPaginated(res),
      providesTags: ['AdminEvents'],
    }),

    getAdminEventDetail: builder.query<AdminEvent, string>({
      query: (id) => `/admin/events/${id}`,
      transformResponse: (res: { data: AdminEvent }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'AdminEvents', id }],
    }),

    updateAdminEvent: builder.mutation<
      AdminEvent,
      {
        id: string;
        action?: 'approve' | 'reject' | 'go_live' | 'close';
        status?: string;
        is_visible?: boolean;
        convenience_fee_percent?: number;
        commission_percent?: number;
        rejection_reason?: string;
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/events/${id}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (res: { data: AdminEvent }) => res.data,
      invalidatesTags: ['AdminEvents', 'AdminCommission', 'PublicEvents', 'OrganizerEvents'],
    }),

    getCommissionLedger: builder.query<
      CommissionLedger,
      { from?: string; to?: string; group_by?: 'event' | 'business' | 'date' } | void
    >({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params?.from) searchParams.append('from', params.from);
        if (params?.to) searchParams.append('to', params.to);
        if (params?.group_by) searchParams.append('group_by', params.group_by);
        const qs = searchParams.toString();
        return `/admin/commission${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data: CommissionLedger }) => res.data,
      providesTags: ['AdminCommission'],
    }),

    getAdminEventBookings: builder.query<any[], { event_id?: string; business_id?: string } | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params?.event_id) searchParams.append('event_id', params.event_id);
        if (params?.business_id) searchParams.append('business_id', params.business_id);
        const qs = searchParams.toString();
        return `/admin/event-bookings${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data: any[] }) => res.data || [],
      providesTags: ['AdminEvents'],
    }),

    // ── Event Contracts ───────────────────────────────────────────────────────

    getEligibleContractEvents: builder.query<EligibleContractEvent[], void>({
      query: () => '/admin/event-contracts/eligible-events',
      transformResponse: (res: { data: EligibleContractEvent[] }) => res.data || [],
      providesTags: ['EventContracts'],
    }),

    getContractPrefill: builder.query<ContractPrefill, string>({
      query: (eventId) => `/admin/event-contracts/prefill/${eventId}`,
      transformResponse: (res: { data: ContractPrefill }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'EventContracts', id: `prefill-${id}` }],
    }),

    getEventContracts: builder.query<PaginatedList<EventContract>, PagedQuery | void>({
      query: (params) => `/admin/event-contracts${toListQuery({ q: params?.q, page: params?.page, limit: params?.limit })}`,
      transformResponse: (res: { data: EventContract[] }) => unwrapPaginated(res),
      providesTags: ['EventContracts'],
    }),

    getAdminEventContract: builder.query<EventContract, string>({
      query: (eventId) => `/admin/event-contracts/event/${eventId}`,
      transformResponse: (res: { data: EventContract }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'EventContracts', id }],
    }),

    createEventContract: builder.mutation<
      EventContract,
      {
        event_id: string;
        body_html: string;
        terms_and_conditions?: string;
        convenience_fee_percent?: number;
        commission_percent?: number;
        sign_as_admin?: boolean;
      }
    >({
      query: (body) => ({ url: '/admin/event-contracts', method: 'POST', body }),
      transformResponse: (res: { data: EventContract }) => res.data,
      invalidatesTags: ['EventContracts', 'AdminEvents', 'OrganizerEvents', 'PublicEvents'],
    }),

    requestAdminContractOtp: builder.mutation<
      { message?: string; email_hint?: string; expires_in_seconds?: number },
      string
    >({
      query: (eventId) => ({
        url: `/admin/event-contracts/event/${eventId}/request-otp-admin`,
        method: 'POST',
      }),
      invalidatesTags: [],
    }),

    signAdminEventContract: builder.mutation<
      EventContract,
      { eventId: string; signature_url: string; otp: string }
    >({
      query: ({ eventId, signature_url, otp }) => ({
        url: `/admin/event-contracts/event/${eventId}/sign-admin`,
        method: 'POST',
        body: { signature_url, otp },
      }),
      transformResponse: (res: { data: EventContract }) => res.data,
      invalidatesTags: ['EventContracts', 'AdminEvents', 'PublicEvents', 'OrganizerEvents'],
    }),

    getOrganizerEventContract: builder.query<EventContract, string>({
      query: (eventId) => `/events/organizer/${eventId}/contract`,
      transformResponse: (res: { data: EventContract }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'OrganizerEvents', id: `${id}-contract` }],
    }),

    requestOrganizerContractOtp: builder.mutation<
      { message?: string; email_hint?: string; expires_in_seconds?: number },
      string
    >({
      query: (eventId) => ({
        url: `/events/organizer/${eventId}/contract/request-otp`,
        method: 'POST',
      }),
      invalidatesTags: [],
    }),

    signOrganizerEventContract: builder.mutation<
      EventContract,
      { eventId: string; signature_url: string; otp: string }
    >({
      query: ({ eventId, signature_url, otp }) => ({
        url: `/events/organizer/${eventId}/contract/sign`,
        method: 'POST',
        body: { signature_url, otp },
      }),
      transformResponse: (res: { data: EventContract }) => res.data,
      invalidatesTags: ['OrganizerEvents', 'EventContracts', 'PublicEvents'],
    }),

    rejectOrganizerEventContract: builder.mutation<
      { message?: string },
      { eventId: string; rejection_reason?: string }
    >({
      query: ({ eventId, rejection_reason }) => ({
        url: `/events/organizer/${eventId}/contract/reject`,
        method: 'POST',
        body: { rejection_reason },
      }),
      invalidatesTags: ['OrganizerEvents', 'EventContracts'],
    }),

    // ── Event reviews ─────────────────────────────────────────────────────────

    getPublicEventReviews: builder.query<EventReview[], string>({
      query: (eventId) => `/events/public/${eventId}/reviews`,
      transformResponse: (res: { data: EventReview[] }) => res.data || [],
      providesTags: (_r, _e, id) => [{ type: 'EventReviews', id }],
    }),

    createEventReview: builder.mutation<
      { data: EventReview; newStats?: { rating: string; reviews_count: number }; message?: string },
      { eventId: string; user_name: string; rating: number; text: string }
    >({
      query: ({ eventId, ...body }) => ({
        url: `/events/public/${eventId}/reviews`,
        method: 'POST',
        body,
      }),
      invalidatesTags: (_r, _e, { eventId }) => [
        { type: 'EventReviews', id: eventId },
        'PublicEvents',
      ],
    }),

    getOrganizerEventReviews: builder.query<
      PaginatedList<EventReview>,
      { event_id?: string; q?: string; page?: number; limit?: number } | void
    >({
      query: (params) =>
        `/events/organizer/reviews${toListQuery({
          event_id: params?.event_id,
          q: params?.q,
          page: params?.page,
          limit: params?.limit,
        })}`,
      transformResponse: (res: { data: EventReview[] }) => unwrapPaginated(res),
      providesTags: ['EventReviews'],
    }),

    createEventReviewReply: builder.mutation<
      { data: EventReviewReply },
      { reviewId: number; user_name: string; text: string }
    >({
      query: ({ reviewId, ...body }) => ({
        url: `/events/organizer/reviews/${reviewId}/reply`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EventReviews'],
    }),

    // ── Event offers ──────────────────────────────────────────────────────────

    getOrganizerOffers: builder.query<PaginatedList<EventOffer>, PagedQuery | void>({
      query: (params) => `/events/organizer/offers${toListQuery({ q: params?.q, page: params?.page, limit: params?.limit })}`,
      transformResponse: (res: { data: EventOffer[] }) => unwrapPaginated(res),
      providesTags: ['EventOffers'],
    }),

    getOfferEligibleEvents: builder.query<
      OfferEligibleEvent[],
      void
    >({
      query: () => '/events/organizer/offers/eligible-events',
      transformResponse: (res: { data: OfferEligibleEvent[] }) =>
        res.data || [],
    }),

    getPublicEventOffers: builder.query<EventOffer[], string>({
      query: (eventId) => `/events/public/${eventId}/offers`,
      transformResponse: (res: { data: EventOffer[] }) => res.data || [],
    }),

    validateEventPromoCode: builder.mutation<
      AppliedPromoOffer,
      { eventId: string; promo_code: string; ticket_amount: number; guest_phone?: string }
    >({
      query: ({ eventId, promo_code, ticket_amount, guest_phone }) => ({
        url: `/events/public/${eventId}/validate-promo`,
        method: 'POST',
        body: { promo_code, ticket_amount, ...(guest_phone ? { guest_phone } : {}) },
      }),
      transformResponse: (res: { data: AppliedPromoOffer }) => res.data,
    }),

    createEventOffer: builder.mutation<
      EventOffer,
      {
        eventId: string;
        title: string;
        description?: string;
        discount_type: 'PERCENT' | 'FLAT';
        discount_value: number;
        promo_code?: string;
        valid_from?: string;
        valid_until?: string;
        is_active?: boolean;
      }
    >({
      query: ({ eventId, ...body }) => ({
        url: `/events/organizer/${eventId}/offers`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: EventOffer }) => res.data,
      invalidatesTags: ['EventOffers'],
    }),

    updateEventOffer: builder.mutation<
      EventOffer,
      {
        offerId: string;
        title: string;
        description?: string;
        discount_type: 'PERCENT' | 'FLAT';
        discount_value: number;
        promo_code?: string;
        valid_from?: string;
        valid_until?: string;
        is_active?: boolean;
      }
    >({
      query: ({ offerId, ...body }) => ({
        url: `/events/organizer/offers/${offerId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (res: { data: EventOffer }) => res.data,
      invalidatesTags: ['EventOffers'],
    }),

    deleteEventOffer: builder.mutation<{ message?: string }, string>({
      query: (offerId) => ({
        url: `/events/organizer/offers/${offerId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['EventOffers'],
    }),

    // ── Organizer ledger ──────────────────────────────────────────────────────

    getOrganizerLedger: builder.query<
      OrganizerLedger,
      {
        event_id?: string;
        q?: string;
        from?: string;
        to?: string;
      } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.event_id) sp.set('event_id', params.event_id);
        if (params?.q) sp.set('q', params.q);
        if (params?.from) sp.set('from', params.from);
        if (params?.to) sp.set('to', params.to);
        const qs = sp.toString();
        return `/events/organizer/ledger${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data: OrganizerLedger }) => res.data,
      providesTags: ['OrganizerLedger'],
    }),

    getOrganizerLedgerCustomers: builder.query<
      OrganizerLedgerCustomersResponse,
      {
        event_id?: string;
        q?: string;
        from?: string;
        to?: string;
        page: number;
      }
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        sp.set('page', String(params.page));
        if (params.event_id) sp.set('event_id', params.event_id);
        if (params.q) sp.set('q', params.q);
        if (params.from) sp.set('from', params.from);
        if (params.to) sp.set('to', params.to);
        return `/events/organizer/ledger/customers?${sp.toString()}`;
      },
      transformResponse: (res: { data: OrganizerLedgerCustomersResponse }) => res.data,
      providesTags: ['OrganizerLedgerCustomers'],
    }),

    createOrganizerPayout: builder.mutation<
      { data: OrganizerPayout },
      {
        business_id: string;
        event_id?: string;
        amount: number;
        status?: 'PENDING' | 'PAID';
        payment_reference?: string;
        notes?: string;
      }
    >({
      query: (body) => ({
        url: '/admin/organizer-payouts',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['OrganizerLedger', 'OrganizerLedgerCustomers', 'AdminCommission', 'OrganizerPayouts'],
    }),

    getOrganizerPayouts: builder.query<
      PaginatedList<OrganizerPayout>,
      { business_id?: string; q?: string; page?: number; limit?: number } | void
    >({
      query: (params) =>
        `/admin/organizer-payouts${toListQuery({
          business_id: params?.business_id,
          q: params?.q,
          page: params?.page,
          limit: params?.limit,
        })}`,
      transformResponse: (res: { data: OrganizerPayout[] }) => unwrapPaginated(res),
      providesTags: ['OrganizerPayouts'],
    }),

    // ── Analytics ─────────────────────────────────────────────────────────────

    getAnalytics: builder.query<Analytics, string>({
      query: (bizId) => `/businesses/${bizId}/analytics`,
      transformResponse: (res: { data: Analytics }) => res.data,
      providesTags: (_result, _error, bizId) => [{ type: 'Analytics', id: bizId }],
    }),

    getBusinessCampaigns: builder.query<PaginatedList<any>, PagedBizQuery>({
      query: (arg) => `/businesses/${bizIdOf(arg)}/campaigns${pagedBizQuery(arg)}`,
      transformResponse: (res: { data: any[] }) => unwrapPaginated(res),
      providesTags: (_result, _error, arg) => [{ type: 'MarketingCampaigns', id: bizIdOf(arg) }],
    }),

    // ── Organizer Events ──────────────────────────────────────────────────────

    getOrganizerEvents: builder.query<
      PaginatedList<OrganizerEvent>,
      { q?: string; status?: string; page?: number; limit?: number } | void
    >({
      query: (params) =>
        `/events/organizer${toListQuery({
          q: params?.q,
          status: params?.status,
          page: params?.page,
          limit: params?.limit,
        })}`,
      transformResponse: (res: { data: OrganizerEvent[] }) => unwrapPaginated(res),
      providesTags: ['OrganizerEvents'],
    }),

    getOrganizerEvent: builder.query<OrganizerEvent, string>({
      query: (id) => `/events/organizer/${id}`,
      transformResponse: (res: { data: OrganizerEvent }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'OrganizerEvents', id }],
    }),

    searchOrganizerVenues: builder.query<
      OrganizerVenueSearchResult[],
      { q?: string; city_id?: number | null } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q?.trim()) sp.set('q', params.q.trim());
        if (params?.city_id != null) sp.set('city_id', String(params.city_id));
        const qs = sp.toString();
        return `/events/organizer/venues/search${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data?: OrganizerVenueSearchResult[] }) => res?.data ?? [],
    }),

    getOrganizerVenueLayouts: builder.query<
      { venue: { id: string; name: string }; layouts: OrganizerVenueLayoutOption[] },
      string
    >({
      query: (businessId) => `/events/organizer/venues/${businessId}/layouts`,
      transformResponse: (res: {
        data: { venue: { id: string; name: string }; layouts: OrganizerVenueLayoutOption[] };
      }) => res.data,
    }),

    getOrganizerVenueLayout: builder.query<
      VenueLayoutTemplate,
      { businessId: string; templateId: string }
    >({
      query: ({ businessId, templateId }) =>
        `/events/organizer/venues/${businessId}/layouts/${templateId}`,
      transformResponse: (res: { data: VenueLayoutTemplate }) => res.data,
    }),

    searchOrganizerArtists: builder.query<OrganizerArtistSearchResult[], { q?: string } | void>({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q?.trim()) sp.set('q', params.q.trim());
        const qs = sp.toString();
        return `/events/organizer/artists/search${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data?: OrganizerArtistSearchResult[] }) => res?.data ?? [],
    }),

    autoRegisterOrganizerVenue: builder.mutation<
      OrganizerVenueSearchResult,
      {
        name: string;
        address?: string;
        city_id?: number | null;
        phone?: string;
        capacity?: number | null;
        contact_name?: string;
        contact_email?: string;
        notes?: string;
        facilities?: string[];
        image_urls?: string[];
      }
    >({
      query: (body) => ({
        url: `/events/organizer/venues/auto-register`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: OrganizerVenueSearchResult }) => res.data,
    }),

    autoRegisterOrganizerArtist: builder.mutation<
      OrganizerArtistSearchResult,
      { name: string; description?: string; image_url?: string; city_id?: number | null; phone?: string }
    >({
      query: (body) => ({
        url: `/events/organizer/artists/auto-register`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: OrganizerArtistSearchResult }) => res.data,
    }),

    getVenueClaimableShowtimes: builder.query<
      Array<{
        showtime_id: string;
        event_id: string;
        event_name: string;
        venue_name: string;
        starts_at: string;
        city_name?: string;
        organizer_name?: string;
      }>,
      string
    >({
      query: (businessId) => `/businesses/${businessId}/venue/claimable-showtimes`,
      transformResponse: (res: { data?: unknown[] }) => (res?.data ?? []) as Array<{
        showtime_id: string;
        event_id: string;
        event_name: string;
        venue_name: string;
        starts_at: string;
        city_name?: string;
        organizer_name?: string;
      }>,
    }),

    claimVenueShowtime: builder.mutation<
      { message?: string },
      { businessId: string; showtimeId: string }
    >({
      query: ({ businessId, showtimeId }) => ({
        url: `/businesses/${businessId}/venue/claim-showtime/${showtimeId}`,
        method: 'POST',
      }),
      transformResponse: (res: { message?: string }) => res,
    }),

    getEventLayout: builder.query<any, string>({
      query: (id) => `/events/organizer/${id}/layout`,
      providesTags: (_r, _e, id) => [{ type: 'EventLayouts', id }],
    }),

    updateEventLayout: builder.mutation<any, { eventId: string; seating_config: any; seats: any[] }>({
      query: ({ eventId, ...body }) => ({
        url: `/events/organizer/${eventId}/layout`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_r, _e, { eventId }) => [{ type: 'EventLayouts', id: eventId }],
    }),

    getOrganizerTicketStats: builder.query<
      OrganizerTicketStatsResponse,
      { event_id?: string } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.event_id) sp.set('event_id', params.event_id);
        const qs = sp.toString();
        return `/events/organizer/ticket-stats${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data: OrganizerTicketStatsResponse }) => res.data,
      providesTags: ['OrganizerTicketStats'],
    }),

    getOrganizerBookings: builder.query<
      PaginatedList<OrganizerEventBooking>,
      { event_id?: string; status?: string; q?: string; page?: number; limit?: number } | void
    >({
      query: (params) =>
        `/events/organizer/bookings${toListQuery({
          event_id: params?.event_id,
          status: params?.status,
          q: params?.q,
          page: params?.page,
          limit: params?.limit,
        })}`,
      transformResponse: (res: { data: OrganizerEventBooking[] }) => unwrapPaginated(res),
      providesTags: ['OrganizerBookings'],
    }),

    scanOrganizerEventBooking: builder.mutation<
      { data: EventBooking },
      { qr_token: string }
    >({
      query: (body) => ({
        url: '/events/organizer/bookings/scan',
        method: 'POST',
        body,
      }),
    }),

    checkInOrganizerEventBooking: builder.mutation<
      {
        message?: string;
        already_checked_in?: boolean;
        data: EventBooking & { just_checked_in?: boolean };
      },
      string
    >({
      query: (id) => ({
        url: `/events/organizer/bookings/${id}/check-in`,
        method: 'PUT',
      }),
      invalidatesTags: ['OrganizerBookings', 'OrganizerTicketStats'],
    }),

    createOrganizerEvent: builder.mutation<OrganizerEvent, EventFormPayload>({
      query: (body) => ({ url: '/events/organizer', method: 'POST', body }),
      transformResponse: (res: { data: OrganizerEvent }) => res.data,
      invalidatesTags: ['OrganizerEvents'],
    }),

    updateOrganizerEvent: builder.mutation<
      { data: OrganizerEvent; message?: string },
      { id: string; body: EventFormPayload }
    >({
      query: ({ id, body }) => ({ url: `/events/organizer/${id}`, method: 'PUT', body }),
      invalidatesTags: ['OrganizerEvents'],
    }),

    submitOrganizerEvent: builder.mutation<
      { data: OrganizerEvent; message?: string },
      { id: string; body: EventFormPayload }
    >({
      query: ({ id, body }) => ({ url: `/events/organizer/${id}/submit`, method: 'POST', body }),
      invalidatesTags: ['OrganizerEvents', 'AdminEvents', 'PublicEvents'],
    }),

    toggleOrganizerEventVisibility: builder.mutation<
      OrganizerEvent,
      { id: string; is_visible?: boolean }
    >({
      query: ({ id, is_visible }) => ({
        url: `/events/organizer/${id}/visibility`,
        method: 'PATCH',
        body: is_visible !== undefined ? { is_visible } : {},
      }),
      transformResponse: (res: { data: OrganizerEvent }) => res.data,
      invalidatesTags: ['OrganizerEvents', 'PublicEvents'],
    }),

    closeOrganizerEvent: builder.mutation<{ data: OrganizerEvent }, string>({
      query: (id) => ({ url: `/events/organizer/${id}/close`, method: 'POST' }),
      invalidatesTags: ['OrganizerEvents', 'PublicEvents'],
    }),

    getPublicEvents: builder.query<PublicEvent[], PublicEventsQuery | void>({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q) sp.append('q', params.q);
        if (params?.category) sp.append('category', params.category);
        if (params?.city) sp.append('city', params.city);
        if (params?.language) sp.append('language', params.language);
        if (params?.date_preset) sp.append('date_preset', params.date_preset);
        if (params?.date_from) sp.append('date_from', params.date_from);
        if (params?.date_to) sp.append('date_to', params.date_to);
        if (params?.price) sp.append('price', params.price);
        if (params?.more) sp.append('more', params.more);
        if (params?.organizer) sp.append('organizer', params.organizer);
        if (params?.sort) sp.append('sort', params.sort);
        const qs = sp.toString();
        return `/events/public${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data: PublicEvent[] }) => res.data || [],
      providesTags: ['PublicEvents'],
    }),

    getPublicEventFilters: builder.query<PublicEventFilters, void>({
      query: () => '/events/public/filters',
      transformResponse: (res: { data: PublicEventFilters }) => res.data,
      providesTags: ['PublicEvents'],
    }),

    getPublicRegisteredVenues: builder.query<
      PublicRegisteredPartner[],
      { q?: string; city?: string } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q) sp.append('q', params.q);
        if (params?.city) sp.append('city', params.city);
        const qs = sp.toString();
        return `/events/public/venues${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data?: PublicRegisteredPartner[] }) => res?.data ?? [],
      providesTags: ['Businesses'],
    }),

    getPublicRegisteredArtists: builder.query<
      PublicRegisteredPartner[],
      { q?: string; city?: string } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q) sp.append('q', params.q);
        if (params?.city) sp.append('city', params.city);
        const qs = sp.toString();
        return `/events/public/artists${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data?: PublicRegisteredPartner[] }) => res?.data ?? [],
      providesTags: ['Businesses'],
    }),

    getPublicArtist: builder.query<PublicArtistProfile, string>({
      query: (id) => `/artists/public/${id}`,
      transformResponse: (res: { data: PublicArtistProfile }) => res.data,
      providesTags: (_r, _e, id) => [
        { type: 'ArtistSlots', id },
        { type: 'Businesses', id },
      ],
    }),

    createArtistInquiry: builder.mutation<
      ArtistBookingInquiry,
      {
        artistId: string;
        event_date: string;
        event_time?: string;
        contact_name: string;
        contact_email: string;
        contact_phone: string;
        event_type?: string;
        event_location?: string;
        message?: string;
      }
    >({
      query: ({ artistId, ...body }) => ({
        url: `/artists/public/${artistId}/inquiries`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: ArtistBookingInquiry }) => res.data,
      invalidatesTags: ['ArtistInquiries', 'ArtistSlots'],
    }),

    getArtistMySlots: builder.query<ArtistAvailabilitySlot[], void>({
      query: () => `/artists/me/slots`,
      transformResponse: (res: { data?: ArtistAvailabilitySlot[] }) => res?.data ?? [],
      providesTags: ['ArtistSlots'],
    }),

    createArtistMySlots: builder.mutation<
      ArtistAvailabilitySlot[],
      { dates: string[]; start_time?: string; end_time?: string }
    >({
      query: (body) => ({ url: `/artists/me/slots`, method: 'POST', body }),
      transformResponse: (res: { data?: ArtistAvailabilitySlot[] }) => res?.data ?? [],
      invalidatesTags: ['ArtistSlots'],
    }),

    deleteArtistMySlot: builder.mutation<{ message?: string }, string>({
      query: (slotId) => ({ url: `/artists/me/slots/${slotId}`, method: 'DELETE' }),
      invalidatesTags: ['ArtistSlots'],
    }),

    getArtistMyInquiries: builder.query<ArtistBookingInquiry[], void>({
      query: () => `/artists/me/inquiries`,
      transformResponse: (res: { data?: ArtistBookingInquiry[] }) => res?.data ?? [],
      providesTags: ['ArtistInquiries'],
    }),

    updateArtistMyInquiry: builder.mutation<
      ArtistBookingInquiry,
      { inquiryId: string; status: 'ACCEPTED' | 'DECLINED'; artist_notes?: string }
    >({
      query: ({ inquiryId, ...body }) => ({
        url: `/artists/me/inquiries/${inquiryId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (res: { data: ArtistBookingInquiry }) => res.data,
      invalidatesTags: ['ArtistInquiries', 'ArtistSlots'],
    }),

    getPublicVenue: builder.query<PublicVenueProfile, string>({
      query: (id) => `/venues/public/${id}`,
      transformResponse: (res: { data: PublicVenueProfile }) => res.data,
      providesTags: (_r, _e, id) => [
        { type: 'VenueSlots', id },
        { type: 'Businesses', id },
      ],
    }),

    createVenueInquiry: builder.mutation<
      VenueBookingInquiry,
      {
        venueId: string;
        event_date: string;
        event_time?: string;
        contact_name: string;
        contact_email: string;
        contact_phone: string;
        event_type?: string;
        guest_count?: number;
        event_location?: string;
        message?: string;
      }
    >({
      query: ({ venueId, ...body }) => ({
        url: `/venues/public/${venueId}/inquiries`,
        method: 'POST',
        body,
      }),
      transformResponse: (res: { data: VenueBookingInquiry }) => res.data,
      invalidatesTags: ['VenueInquiries', 'VenueSlots'],
    }),

    getVenueMySlots: builder.query<VenueAvailabilitySlot[], void>({
      query: () => `/venues/me/slots`,
      transformResponse: (res: { data?: VenueAvailabilitySlot[] }) => res?.data ?? [],
      providesTags: ['VenueSlots'],
    }),

    createVenueMySlots: builder.mutation<
      VenueAvailabilitySlot[],
      { dates: string[]; start_time?: string; end_time?: string }
    >({
      query: (body) => ({ url: `/venues/me/slots`, method: 'POST', body }),
      transformResponse: (res: { data?: VenueAvailabilitySlot[] }) => res?.data ?? [],
      invalidatesTags: ['VenueSlots'],
    }),

    deleteVenueMySlot: builder.mutation<{ message?: string }, string>({
      query: (slotId) => ({ url: `/venues/me/slots/${slotId}`, method: 'DELETE' }),
      invalidatesTags: ['VenueSlots'],
    }),

    getVenueMyInquiries: builder.query<VenueBookingInquiry[], void>({
      query: () => `/venues/me/inquiries`,
      transformResponse: (res: { data?: VenueBookingInquiry[] }) => res?.data ?? [],
      providesTags: ['VenueInquiries'],
    }),

    updateVenueMyInquiry: builder.mutation<
      VenueBookingInquiry,
      { inquiryId: string; status: 'ACCEPTED' | 'DECLINED'; venue_notes?: string }
    >({
      query: ({ inquiryId, ...body }) => ({
        url: `/venues/me/inquiries/${inquiryId}`,
        method: 'PATCH',
        body,
      }),
      transformResponse: (res: { data: VenueBookingInquiry }) => res.data,
      invalidatesTags: ['VenueInquiries', 'VenueSlots'],
    }),

    getPublicEvent: builder.query<OrganizerEvent, string>({
      query: (id) => `/events/public/${id}`,
      transformResponse: (res: { data: OrganizerEvent }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'PublicEvents', id }],
    }),

    getPublicEventLayout: builder.query<any, string>({
      query: (id) => `/events/public/${id}/layout`,
      providesTags: (_r, _e, id) => [{ type: 'EventLayouts', id: `public-${id}` }],
    }),

    createEventBooking: builder.mutation<
      { message?: string; booking_id?: string; qr_code?: string; grand_total?: number; ticket_qty?: number },
      {
        event_id: string;
        showtime_id: string;
        items: Array<{ ticket_type_id: string; qty: number }>;
        guest_name: string;
        guest_phone: string;
        guest_email?: string;
        customer_id?: string;
        booking_source?: 'ONLINE' | 'WALK_IN' | 'CASH' | 'ORGANIZER';
        promo_code?: string;
        gift_card_id?: string;
        gift_card_code?: string;
        ticket_mode?: 'M_TICKET' | 'BOX_OFFICE' | 'PHYSICAL_DELIVERY';
        delivery_address_line?: string;
        delivery_city?: string;
        delivery_notes?: string;
        /** When true, POST to organizer booking API (event_admin selling for a customer) */
        for_organizer?: boolean;
      }
    >({
      query: ({ for_organizer, ...body }) => ({
        url: for_organizer ? '/events/organizer/bookings' : '/events/bookings',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EventBookings', 'PublicEvents', 'OrganizerTicketStats', 'OrganizerBookings', 'OrganizerEvents', 'MyGiftCards'],
    }),

    getCustomerEventBookings: builder.query<EventBooking[], string>({
      query: (customerId) => `/events/bookings/customer/${customerId}`,
      transformResponse: (res: { data: EventBooking[] }) => res.data || [],
      providesTags: (_result, _error, customerId) => [{ type: 'EventBookings', id: customerId }],
    }),

    getEventBookingById: builder.query<EventBooking, string>({
      query: (id) => `/events/bookings/detail/${id}`,
      transformResponse: (res: { data: EventBooking }) => res.data,
      providesTags: (_result, _error, id) => [{ type: 'EventBookings', id }],
    }),

    cancelEventBooking: builder.mutation<{ message?: string }, { id: string; customerId?: string }>({
      query: ({ id }) => ({
        url: `/events/bookings/${id}/cancel`,
        method: 'PUT',
      }),
      invalidatesTags: (_result, _error, { id, customerId }) => [
        { type: 'EventBookings', id },
        ...(customerId ? [{ type: 'EventBookings' as const, id: customerId }] : []),
        'EventBookings',
        'PublicEvents',
      ],
    }),

    getEventMasters: builder.query<EventMastersResponse, number>({
      query: (categoryTypeId) => `/events/masters?category_type_id=${categoryTypeId}`,
      transformResponse: (res: { data: EventMastersResponse }) => res.data,
      providesTags: ['EventMasters'],
    }),

    // ── Admin Event Masters ───────────────────────────────────────────────────

    getAdminEventGenres: builder.query<
      PaginatedList<EventGenreMaster>,
      { category_type_id?: number; q?: string; page?: number; limit?: number } | void
    >({
      query: (params) =>
        `/admin/event-genres${toListQuery({
          category_type_id: params?.category_type_id,
          q: params?.q,
          page: params?.page,
          limit: params?.limit,
        })}`,
      transformResponse: (res: { data?: EventGenreMaster[] }) => unwrapPaginated(res),
      providesTags: (result) =>
        result?.items
          ? [
            ...result.items.map((g) => ({ type: 'EventMasters' as const, id: `genre-${g.id}` })),
            { type: 'EventMasters', id: 'GENRE_LIST' },
          ]
          : [{ type: 'EventMasters', id: 'GENRE_LIST' }],
    }),

    createAdminEventGenre: builder.mutation<
      EventGenreMaster,
      { category_type_id: number; name: string; slug?: string; is_active?: boolean; sort_order?: number }
    >({
      query: (body) => ({
        url: '/admin/event-genres',
        method: 'POST',
        body: { is_active: true, ...body },
      }),
      transformResponse: (res: { data?: EventGenreMaster }) => res?.data ?? ({} as EventGenreMaster),
      invalidatesTags: [{ type: 'EventMasters', id: 'GENRE_LIST' }, 'EventMasters'],
    }),

    updateAdminEventGenre: builder.mutation<
      EventGenreMaster,
      { id: number; body: Partial<EventGenreMaster> }
    >({
      query: ({ id, body }) => ({ url: `/admin/event-genres/${id}`, method: 'PUT', body }),
      transformResponse: (res: { data?: EventGenreMaster }) => {
        if (!res?.data) throw new Error('Update failed — empty response.');
        return res.data;
      },
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'EventMasters', id: `genre-${id}` },
        { type: 'EventMasters', id: 'GENRE_LIST' },
      ],
    }),

    deleteAdminEventGenre: builder.mutation<void, number>({
      query: (id) => ({ url: `/admin/event-genres/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'EventMasters', id: 'GENRE_LIST' }, 'EventMasters'],
    }),

    // ── Admin Dining Masters ──────────────────────────────────────────────────

    getAdminDiningCuisines: builder.query<
      PaginatedList<DiningCuisineMaster>,
      { q?: string; page?: number; limit?: number } | void
    >({
      query: (params) =>
        `/admin/dining-cuisines${toListQuery({
          q: params?.q,
          page: params?.page,
          limit: params?.limit,
        })}`,
      transformResponse: (res: { data?: DiningCuisineMaster[] }) => unwrapPaginated(res),
      providesTags: (result) =>
        result?.items
          ? [
            ...result.items.map((c) => ({ type: 'DiningMasters' as const, id: `cuisine-${c.id}` })),
            { type: 'DiningMasters', id: 'CUISINE_LIST' },
          ]
          : [{ type: 'DiningMasters', id: 'CUISINE_LIST' }],
    }),

    createAdminDiningCuisine: builder.mutation<
      DiningCuisineMaster,
      { name: string; image_url: string; slug?: string; is_active?: boolean; sort_order?: number }
    >({
      query: (body) => ({
        url: '/admin/dining-cuisines',
        method: 'POST',
        body: { is_active: true, ...body },
      }),
      transformResponse: (res: { data?: DiningCuisineMaster }) =>
        res?.data ?? ({} as DiningCuisineMaster),
      invalidatesTags: [
        { type: 'DiningMasters', id: 'CUISINE_LIST' },
        { type: 'DiningMasters', id: 'PUBLIC_LIST' },
        'DiningMasters',
      ],
    }),

    updateAdminDiningCuisine: builder.mutation<
      DiningCuisineMaster,
      { id: number; body: Partial<DiningCuisineMaster> }
    >({
      query: ({ id, body }) => ({ url: `/admin/dining-cuisines/${id}`, method: 'PUT', body }),
      transformResponse: (res: { data?: DiningCuisineMaster }) => {
        if (!res?.data) throw new Error('Update failed — empty response.');
        return res.data;
      },
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'DiningMasters', id: `cuisine-${id}` },
        { type: 'DiningMasters', id: 'CUISINE_LIST' },
        { type: 'DiningMasters', id: 'PUBLIC_LIST' },
      ],
    }),

    deleteAdminDiningCuisine: builder.mutation<void, number>({
      query: (id) => ({ url: `/admin/dining-cuisines/${id}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'DiningMasters', id: 'CUISINE_LIST' },
        { type: 'DiningMasters', id: 'PUBLIC_LIST' },
        'DiningMasters',
      ],
    }),

    // ── Admin City Masters ────────────────────────────────────────────────────

    getAdminCities: builder.query<
      PaginatedList<CityMaster>,
      { q?: string; page?: number; limit?: number } | void
    >({
      query: (params) =>
        `/admin/cities${toListQuery({
          q: params?.q,
          page: params?.page,
          limit: params?.limit,
        })}`,
      transformResponse: (res: { data?: CityMaster[] }) => unwrapPaginated(res),
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map((c) => ({ type: 'CityMasters' as const, id: c.id })),
              { type: 'CityMasters', id: 'LIST' },
            ]
          : [{ type: 'CityMasters', id: 'LIST' }],
    }),

    createAdminCity: builder.mutation<
      CityMaster,
      {
        name: string;
        slug?: string;
        state?: string;
        country?: string;
        icon_url?: string;
        is_popular?: boolean;
        is_active?: boolean;
        sort_order?: number;
      }
    >({
      query: (body) => ({
        url: '/admin/cities',
        method: 'POST',
        body: { is_active: true, ...body },
      }),
      transformResponse: (res: { data?: CityMaster }) => res?.data ?? ({} as CityMaster),
      invalidatesTags: [
        { type: 'CityMasters', id: 'LIST' },
        { type: 'CityMasters', id: 'PUBLIC_LIST' },
        'CityMasters',
      ],
    }),

    updateAdminCity: builder.mutation<
      CityMaster,
      { id: number; body: Partial<CityMaster> }
    >({
      query: ({ id, body }) => ({ url: `/admin/cities/${id}`, method: 'PUT', body }),
      transformResponse: (res: { data?: CityMaster }) => {
        if (!res?.data) throw new Error('Update failed — empty response.');
        return res.data;
      },
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'CityMasters', id },
        { type: 'CityMasters', id: 'LIST' },
        { type: 'CityMasters', id: 'PUBLIC_LIST' },
      ],
    }),

    deleteAdminCity: builder.mutation<void, number>({
      query: (id) => ({ url: `/admin/cities/${id}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'CityMasters', id: 'LIST' },
        { type: 'CityMasters', id: 'PUBLIC_LIST' },
        'CityMasters',
      ],
    }),

    getAdminDiningCollections: builder.query<
      PaginatedList<Collection>,
      { q?: string; page?: number; limit?: number } | void
    >({
      query: (params) =>
        `/admin/dining-collections${toListQuery({
          q: params?.q,
          page: params?.page,
          limit: params?.limit,
        })}`,
      transformResponse: (res: { data?: Collection[] }) => unwrapPaginated(res),
      providesTags: (result) =>
        result?.items
          ? [
            ...result.items.map((c) => ({ type: 'DiningMasters' as const, id: `collection-${c.id}` })),
            { type: 'DiningMasters', id: 'COLLECTION_LIST' },
          ]
          : [{ type: 'DiningMasters', id: 'COLLECTION_LIST' }],
    }),

    createAdminDiningCollection: builder.mutation<
      Collection,
      { title: string; image_url: string; subtitle?: string; slug?: string; is_active?: boolean; color_gradient?: string }
    >({
      query: (body) => ({
        url: '/admin/dining-collections',
        method: 'POST',
        body: { is_active: true, ...body },
      }),
      transformResponse: (res: { data?: Collection }) => res?.data ?? ({} as Collection),
      invalidatesTags: [
        { type: 'DiningMasters', id: 'COLLECTION_LIST' },
        { type: 'DiningMasters', id: 'COLLECTION_PUBLIC' },
        'DiningMasters',
      ],
    }),

    updateAdminDiningCollection: builder.mutation<
      Collection,
      { id: number; body: Partial<Collection> }
    >({
      query: ({ id, body }) => ({ url: `/admin/dining-collections/${id}`, method: 'PUT', body }),
      transformResponse: (res: { data?: Collection }) => {
        if (!res?.data) throw new Error('Update failed — empty response.');
        return res.data;
      },
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'DiningMasters', id: `collection-${id}` },
        { type: 'DiningMasters', id: 'COLLECTION_LIST' },
        { type: 'DiningMasters', id: 'COLLECTION_PUBLIC' },
      ],
    }),

    deleteAdminDiningCollection: builder.mutation<void, number>({
      query: (id) => ({ url: `/admin/dining-collections/${id}`, method: 'DELETE' }),
      invalidatesTags: [
        { type: 'DiningMasters', id: 'COLLECTION_LIST' },
        { type: 'DiningMasters', id: 'COLLECTION_PUBLIC' },
        'DiningMasters',
      ],
    }),

    getAdminEventDocuments: builder.query<
      PaginatedList<EventDocumentMaster>,
      { category_type_id?: number | 'global'; q?: string; page?: number; limit?: number } | void
    >({
      query: (params) =>
        `/admin/event-documents${toListQuery({
          category_type_id: params?.category_type_id,
          q: params?.q,
          page: params?.page,
          limit: params?.limit,
        })}`,
      transformResponse: (res: { data?: EventDocumentMaster[] }) => unwrapPaginated(res),
      providesTags: (result) =>
        result?.items
          ? [
            ...result.items.map((d) => ({ type: 'EventMasters' as const, id: `doc-${d.id}` })),
            { type: 'EventMasters', id: 'DOC_LIST' },
          ]
          : [{ type: 'EventMasters', id: 'DOC_LIST' }],
    }),

    createAdminEventDocument: builder.mutation<
      EventDocumentMaster,
      {
        name: string;
        description?: string;
        category_type_id?: number | null;
        is_required?: boolean;
        importance_level?: number;
        is_active?: boolean;
        sort_order?: number;
      }
    >({
      query: (body) => ({
        url: '/admin/event-documents',
        method: 'POST',
        body: { is_active: true, ...body },
      }),
      transformResponse: (res: { data?: EventDocumentMaster }) => res?.data ?? ({} as EventDocumentMaster),
      invalidatesTags: [{ type: 'EventMasters', id: 'DOC_LIST' }, 'EventMasters'],
    }),

    updateAdminEventDocument: builder.mutation<
      EventDocumentMaster,
      { id: number; body: Partial<EventDocumentMaster> }
    >({
      query: ({ id, body }) => ({ url: `/admin/event-documents/${id}`, method: 'PUT', body }),
      transformResponse: (res: { data?: EventDocumentMaster }) => {
        if (!res?.data) throw new Error('Update failed — empty response.');
        return res.data;
      },
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'EventMasters', id: `doc-${id}` },
        { type: 'EventMasters', id: 'DOC_LIST' },
      ],
    }),

    deleteAdminEventDocument: builder.mutation<void, number>({
      query: (id) => ({ url: `/admin/event-documents/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'EventMasters', id: 'DOC_LIST' }, 'EventMasters'],
    }),

    getAdminEventTerms: builder.query<PaginatedList<EventTermsMaster>, PagedQuery | void>({
      query: (params) => `/admin/event-terms${toListQuery({ q: params?.q, page: params?.page, limit: params?.limit })}`,
      transformResponse: (res: { data?: EventTermsMaster[] }) => unwrapPaginated(res),
      providesTags: (result) =>
        result?.items
          ? [
              ...result.items.map((t) => ({ type: 'EventMasters' as const, id: `term-${t.id}` })),
              { type: 'EventMasters', id: 'TERM_LIST' },
            ]
          : [{ type: 'EventMasters', id: 'TERM_LIST' }],
    }),

    createAdminEventTerm: builder.mutation<EventTermsMaster, { text: string; is_active?: boolean; sort_order?: number }>({
      query: (body) => ({ url: '/admin/event-terms', method: 'POST', body: { is_active: true, ...body } }),
      transformResponse: (res: { data?: EventTermsMaster }) => res?.data ?? ({} as EventTermsMaster),
      invalidatesTags: [{ type: 'EventMasters', id: 'TERM_LIST' }, 'EventMasters'],
    }),

    updateAdminEventTerm: builder.mutation<
      EventTermsMaster,
      { id: number; body: Partial<EventTermsMaster> }
    >({
      query: ({ id, body }) => ({ url: `/admin/event-terms/${id}`, method: 'PUT', body }),
      transformResponse: (res: { data?: EventTermsMaster }) => {
        if (!res?.data) throw new Error('Update failed — empty response.');
        return res.data;
      },
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'EventMasters', id: `term-${id}` },
        { type: 'EventMasters', id: 'TERM_LIST' },
        'EventMasters',
      ],
    }),

    deleteAdminEventTerm: builder.mutation<void, number>({
      query: (id) => ({ url: `/admin/event-terms/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'EventMasters', id: 'TERM_LIST' }, 'EventMasters'],
    }),

    // ── Upload ────────────────────────────────────────────────────────────────

    uploadImage: builder.mutation<{ url: string }, FormData>({
      query: (formData) => ({
        url: '/upload',
        method: 'POST',
        body: formData,
      }),
      transformResponse: (res: { url?: string; data?: { url?: string } }) => {
        const url = res?.url || res?.data?.url || '';
        return { url };
      },
      invalidatesTags: [],
    }),
  }),
});

// Export auto-generated hooks
export const {
  useLoginMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useGetMeQuery,
  useUpdateMyProfileMutation,
  useRegisterCustomerMutation,
  useSendCustomerOtpMutation,
  useVerifyCustomerOtpMutation,
  useCheckCustomerPhoneMutation,
  useRegisterBusinessMutation,
  useGetBusinessesQuery,
  useGetBusinessesPagedQuery,
  useGetAdminBusinessesQuery,
  useGetAdminBusinessQuery,
  useUpdateAdminBusinessMutation,
  useSetBusinessEnabledMutation,
  useArchiveBusinessMutation,
  useUnarchiveBusinessMutation,
  useGetAdminCustomersQuery,
  useGetAdminCustomerQuery,
  useCreateAdminCustomerMutation,
  useUpdateAdminCustomerMutation,
  useSetAdminCustomerEnabledMutation,
  useArchiveAdminCustomerMutation,
  useUnarchiveAdminCustomerMutation,
  useGetCollectionsQuery,
  useGetMoodsQuery,
  useGetDiningCuisinesQuery,
  useGetBusinessTypesQuery,
  useGetPartnerDocumentMastersQuery,
  useGetPartnerOnboardingTermsQuery,
  useGetAdminPartnerDocumentsQuery,
  useCreateAdminPartnerDocumentMutation,
  useUpdateAdminPartnerDocumentMutation,
  useDeleteAdminPartnerDocumentMutation,
  useGetAdminPartnerOnboardingTermsQuery,
  useCreateAdminPartnerOnboardingTermMutation,
  useUpdateAdminPartnerOnboardingTermMutation,
  useDeleteAdminPartnerOnboardingTermMutation,
  useGetBusinessPublicQuery,
  useGetBusinessSettingsQuery,
  useUpdateBusinessSettingsMutation,
  useGetVenueLayoutRequestsQuery,
  useCreateVenueLayoutRequestMutation,
  useGetAdminVenueLayoutRequestsQuery,
  useGetAdminVenueLayoutRequestQuery,
  useReviewAdminVenueLayoutRequestMutation,
  useSaveAdminVenueLayoutTemplateMutation,
  useGetAdminEventLayoutRequestsQuery,
  useGetAdminEventLayoutRequestQuery,
  useReviewAdminEventLayoutRequestMutation,
  useFulfillAdminEventLayoutRequestMutation,
  useReviewOrganizerEventLayoutRequestMutation,
  useGetGeoCountriesQuery,
  useGetGeoStatesQuery,
  useGetGeoLocationsQuery,
  useGetAdminGeoCountriesQuery,
  useCreateAdminGeoCountryMutation,
  useGetAdminGeoStatesQuery,
  useCreateAdminGeoStateMutation,
  useGetAdminGeoLocationsQuery,
  useCreateAdminGeoLocationMutation,
  useGetVenueLayoutTemplatesQuery,
  useGetVenueLayoutTemplateQuery,
  useApproveVenueLayoutTemplateMutation,
  useRejectVenueLayoutTemplateMutation,
  useGetApprovedVenueLayoutQuery,
  useGetTablesQuery,
  useAddTableMutation,
  useUpdateTableMutation,
  useDeleteTableMutation,
  useGetBusinessBookingsQuery,
  useGetCustomerBookingsQuery,
  useGetBookingByIdQuery,
  useCheckAvailabilityQuery,
  useCreateBookingMutation,
  usePhoneLoginMutation,
  useGetCustomerProfileQuery,
  useUpdateCustomerProfileMutation,
  useCancelBookingMutation,
  useScanDiningBookingQrMutation,
  useCheckoutDiningBookingMutation,
  useValidateMerchantPromoCodeMutation,
  useRedeemWalkInMerchantPromoMutation,
  useGetMerchantOfferRedemptionsQuery,
  useGetAdminStatsQuery,
  useUpdateSubscriptionMutation,
  useGetAnalyticsQuery,
  useUploadImageMutation,
  useGetReviewsQuery,
  useCreateReviewMutation,
  useCreateReviewReplyMutation,
  useGetMarketingPlansQuery,
  useCreateMarketingPlanMutation,
  useUpdateMarketingPlanMutation,
  useDeleteMarketingPlanMutation,
  useGetPlatformOffersQuery,
  useGetPlatformOfferQuery,
  useCreatePlatformOfferMutation,
  useUpdatePlatformOfferMutation,
  usePatchPlatformOfferStatusMutation,
  useDeletePlatformOfferMutation,
  useGetOfferRedemptionsQuery,
  useGetOfferEligibleEventsAdminQuery,
  useGetOfferEligibleRestaurantsAdminQuery,
  useGetActivePlatformOffersQuery,
  useGetDiningEligiblePlatformOffersQuery,
  useValidatePlatformPromoCodeMutation,
  useGetGiftCardProductsQuery,
  useCreateGiftCardProductMutation,
  useUpdateGiftCardProductMutation,
  usePatchGiftCardProductStatusMutation,
  useDeleteGiftCardProductMutation,
  useGetPublicGiftCardProductsQuery,
  usePurchaseGiftCardMutation,
  useGetMyGiftCardsQuery,
  useGetMyGiftCardQuery,
  useGetDiningWishlistQuery,
  useGetDiningWishlistIdsQuery,
  useToggleDiningWishlistMutation,
  useSyncDiningWishlistMutation,
  useClaimGiftCardMutation,
  usePreviewGiftCardRedeemMutation,
  useMerchantVerifyGiftCardMutation,
  useMerchantPreviewGiftCardMutation,
  useMerchantRedeemGiftCardMutation,
  useGetMerchantGiftCardRedemptionsQuery,
  useGetAdminDiningGiftCardRedemptionsQuery,
  usePatchAdminDiningGiftCardSettlementMutation,
  useGetMarketingCampaignsQuery,
  useAssignMarketingCampaignMutation,
  useGetBusinessCampaignsQuery,
  useGetAdminEventsQuery,
  useGetAdminEventDetailQuery,
  useUpdateAdminEventMutation,
  useGetCommissionLedgerQuery,
  useGetAdminEventBookingsQuery,
  useGetEligibleContractEventsQuery,
  useGetContractPrefillQuery,
  useGetEventContractsQuery,
  useGetAdminEventContractQuery,
  useCreateEventContractMutation,
  useRequestAdminContractOtpMutation,
  useSignAdminEventContractMutation,
  useGetOrganizerEventContractQuery,
  useRequestOrganizerContractOtpMutation,
  useSignOrganizerEventContractMutation,
  useRejectOrganizerEventContractMutation,
  useGetPublicEventReviewsQuery,
  useCreateEventReviewMutation,
  useGetOrganizerEventReviewsQuery,
  useCreateEventReviewReplyMutation,
  useGetOrganizerOffersQuery,
  useGetOfferEligibleEventsQuery,
  useGetPublicEventOffersQuery,
  useValidateEventPromoCodeMutation,
  useCreateEventOfferMutation,
  useUpdateEventOfferMutation,
  useDeleteEventOfferMutation,
  useGetOrganizerLedgerQuery,
  useGetOrganizerLedgerCustomersQuery,
  useCreateOrganizerPayoutMutation,
  useGetOrganizerPayoutsQuery,
  useGetOrganizerEventsQuery,
  useGetOrganizerEventQuery,
  useSearchOrganizerVenuesQuery,
  useAutoRegisterOrganizerVenueMutation,
  useAutoRegisterOrganizerArtistMutation,
  useGetVenueClaimableShowtimesQuery,
  useClaimVenueShowtimeMutation,
  useGetOrganizerVenueLayoutsQuery,
  useGetOrganizerVenueLayoutQuery,
  useSearchOrganizerArtistsQuery,
  useGetEventLayoutQuery,
  useUpdateEventLayoutMutation,
  useGetOrganizerTicketStatsQuery,
  useGetOrganizerBookingsQuery,
  useScanOrganizerEventBookingMutation,
  useCheckInOrganizerEventBookingMutation,
  useCreateOrganizerEventMutation,
  useUpdateOrganizerEventMutation,
  useSubmitOrganizerEventMutation,
  useToggleOrganizerEventVisibilityMutation,
  useCloseOrganizerEventMutation,
  useGetPublicEventsQuery,
  useGetPublicEventFiltersQuery,
  useGetPublicRegisteredVenuesQuery,
  useGetPublicRegisteredArtistsQuery,
  useGetPublicArtistQuery,
  useCreateArtistInquiryMutation,
  useGetArtistMySlotsQuery,
  useCreateArtistMySlotsMutation,
  useDeleteArtistMySlotMutation,
  useGetArtistMyInquiriesQuery,
  useUpdateArtistMyInquiryMutation,
  useGetPublicVenueQuery,
  useCreateVenueInquiryMutation,
  useGetVenueMySlotsQuery,
  useCreateVenueMySlotsMutation,
  useDeleteVenueMySlotMutation,
  useGetVenueMyInquiriesQuery,
  useUpdateVenueMyInquiryMutation,
  useGetPublicEventQuery,
  useGetPublicEventLayoutQuery,
  useCreateEventBookingMutation,
  useGetCustomerEventBookingsQuery,
  useGetEventBookingByIdQuery,
  useCancelEventBookingMutation,
  useGetEventMastersQuery,
  useGetAdminEventGenresQuery,
  useCreateAdminEventGenreMutation,
  useUpdateAdminEventGenreMutation,
  useDeleteAdminEventGenreMutation,
  useGetAdminDiningCuisinesQuery,
  useCreateAdminDiningCuisineMutation,
  useUpdateAdminDiningCuisineMutation,
  useDeleteAdminDiningCuisineMutation,
  useGetCitiesQuery,
  useGetAdminCitiesQuery,
  useCreateAdminCityMutation,
  useUpdateAdminCityMutation,
  useDeleteAdminCityMutation,
  useGetAdminDiningCollectionsQuery,
  useCreateAdminDiningCollectionMutation,
  useUpdateAdminDiningCollectionMutation,
  useDeleteAdminDiningCollectionMutation,
  useGetAdminEventDocumentsQuery,
  useCreateAdminEventDocumentMutation,
  useUpdateAdminEventDocumentMutation,
  useDeleteAdminEventDocumentMutation,
  useGetAdminEventTermsQuery,
  useCreateAdminEventTermMutation,
  useUpdateAdminEventTermMutation,
  useDeleteAdminEventTermMutation,
} = api;

/** Injected so HMR can re-register with overrideExisting against the same api instance. */
export const eventInterestApi = api.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getEventInterestCount: builder.query<
      { event_id: string; interest_count: number },
      string
    >({
      query: (eventId) => `/events/public/${eventId}/interest-count`,
      transformResponse: (res: {
        data?: { event_id: string; interest_count?: number };
      }) => ({
        event_id: res?.data?.event_id || '',
        interest_count: Number(res?.data?.interest_count) || 0,
      }),
      providesTags: (_result, _error, eventId) => [
        { type: 'EventInterests', id: `count:${eventId}` },
      ],
    }),

    getEventInterest: builder.query<
      { event_id: string; interested: boolean; interest_count: number },
      { eventId: string; customerId: string }
    >({
      query: ({ eventId }) => `/events/public/${eventId}/interest`,
      transformResponse: (res: {
        data?: { event_id: string; interested: boolean; interest_count?: number };
      }) => ({
        event_id: res?.data?.event_id || '',
        interested: Boolean(res?.data?.interested),
        interest_count: Number(res?.data?.interest_count) || 0,
      }),
      // Cache per customer so switching accounts never reuses another user's interest.
      providesTags: (_result, _error, arg) => [
        { type: 'EventInterests', id: `${arg.customerId}:${arg.eventId}` },
        { type: 'EventInterests', id: arg.customerId },
        { type: 'EventInterests', id: `count:${arg.eventId}` },
      ],
    }),

    toggleEventInterest: builder.mutation<
      {
        event_id: string;
        interested: boolean;
        interest_count: number;
        message?: string;
      },
      { eventId: string; customerId: string; interested?: boolean }
    >({
      query: ({ eventId, interested }) => ({
        url: `/events/public/${eventId}/interest`,
        method: 'POST',
        body: typeof interested === 'boolean' ? { interested } : {},
      }),
      transformResponse: (res: {
        data?: {
          event_id: string;
          interested: boolean;
          interest_count?: number;
        };
        message?: string;
      }) => ({
        event_id: res?.data?.event_id || '',
        interested: Boolean(res?.data?.interested),
        interest_count: Number(res?.data?.interest_count) || 0,
        message: res?.message,
      }),
      invalidatesTags: (_result, _error, arg) => [
        { type: 'EventInterests', id: `${arg.customerId}:${arg.eventId}` },
        { type: 'EventInterests', id: arg.customerId },
        { type: 'EventInterests', id: `count:${arg.eventId}` },
      ],
    }),
  }),
});

export const {
  useGetEventInterestQuery,
  useGetEventInterestCountQuery,
  useToggleEventInterestMutation,
} = eventInterestApi;
