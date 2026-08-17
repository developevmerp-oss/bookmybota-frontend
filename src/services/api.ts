/**
 * Central API Service — Single source of truth for all backend API calls.
 * Built with RTK Query. Add new endpoints here; never call fetch() directly in pages.
 *
 * Base URL: http://localhost:5000/api
 * To change the backend URL, update BASE_URL below only.
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { clearCredentials } from '@/features/auth/authSlice';
import { clearSessionForRole, type UserRole } from '@/lib/authStorage';

const BASE_URL = 'http://localhost:5000/api';

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface Business {
  id: string;
  name: string;
  address: string;
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
  live_event_count?: number;
  owner_id?: string;
  operating_hours?: Record<string, { open: string; close: string; closed: boolean }>;
  gallery_images?: string[];
  menu_images?: string[];
  dining_offers?: Array<{ type: string; title: string; validity: string }>;
  amenities?: string[];
  average_cost?: number;
  is_promoted?: boolean;
  collection_slugs?: string[];
  documents?: PartnerDocumentUpload[];
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
  module: 'dining' | 'event' | 'both';
  description?: string | null;
  is_required: boolean;
  accept?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface BusinessSettings {
  id: string;
  name?: string;
  address?: string;
  cuisine?: string;
  phone?: string;
  description?: string;
  cover_image_url?: string;
  grace_time_minutes?: number;
  online_allocation_percentage?: number;
  operating_hours?: Record<string, { open: string; close: string; closed: boolean }>;
  gallery_images?: string[];
  menu_images?: string[];
  dining_offers?: Array<{ type: string; title: string; validity: string }>;
  amenities?: string[];
  average_cost?: number;
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
    showtime_id?: string | null;
    venue_name?: string | null;
  }>;
  showtimes?: Array<{
    id: string;
    venue_name?: string;
    venue_address?: string;
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
    }>;
  }>;
  bookings?: Array<Record<string, unknown>>;
  rejection_reason?: string;
  genres?: string[];
  poster_horizontal_url?: string;
  poster_vertical_url?: string;
  gallery_images?: string[];
  documents?: EventDocumentUpload[] | string[];
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

export interface EventMastersResponse {
  genres: EventGenreMaster[];
  documents: EventDocumentMaster[];
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
  documents: EventDocumentUpload[];
  language: string;
  languages?: string[];
  about_event: string;
  age_group: string;
  duration_minutes: number | null;
  ticket_types: Array<{ ticket_type: string; total_count: number; price: number }>;
  showtimes: Array<{
    venue_name: string;
    venue_address: string;
    starts_at: string;
    ends_at: string;
    duration_type?: 'ONE_DAY' | 'MULTI_DAY';
    ticket_types?: Array<{ ticket_type: string; total_count: number; price: number }>;
  }>;
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
  next_showtime?: string;
  min_price?: number | string;
  status?: string;
  rating?: number | string;
  reviews_count?: number;
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
}

export interface AppliedPromoOffer {
  offer_id: string;
  title: string;
  promo_code: string;
  discount_type: 'PERCENT' | 'FLAT';
  discount_value: number;
  discount_amount: number;
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
  role: 'super_admin' | 'business_admin' | 'event_admin' | 'customer';
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
      const pathname = window.location.pathname;
      let tokenKey = 'token_customer';
      if (pathname.startsWith('/admin')) {
        tokenKey = 'token_super_admin';
      } else if (pathname.startsWith('/organizer')) {
        tokenKey = 'token_event_admin';
      } else if (pathname.startsWith('/business')) {
        tokenKey = 'token_business_admin';
      }
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
    const onManagedPanel =
      path.startsWith('/business') || path.startsWith('/organizer') || path.startsWith('/customer');
    const data = result.error.data as { code?: string } | undefined;
    if (onManagedPanel && data?.code === 'ACCOUNT_DISABLED') {
      const role = (
        path.startsWith('/organizer')
          ? 'event_admin'
          : path.startsWith('/business')
            ? 'business_admin'
            : 'customer'
      ) as UserRole;
      clearSessionForRole(role);
      api.dispatch(clearCredentials());
      window.location.replace('/login');
    }
  }
  return result;
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Businesses', 'Tables', 'Bookings', 'EventBookings', 'BusinessSettings', 'AdminStats', 'Analytics', 'Reviews', 'MarketingPlans', 'MarketingCampaigns', 'CustomerProfile', 'AdminEvents', 'AdminCommission', 'OrganizerEvents', 'OrganizerTicketStats', 'OrganizerBookings', 'PublicEvents', 'EventMasters', 'EventContracts', 'EventLayouts', 'EventReviews', 'EventOffers', 'OrganizerLedger', 'OrganizerLedgerCustomers', 'OrganizerPayouts', 'PartnerDocuments', 'AdminCustomers'],
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

    getMe: builder.query<{ id: string; role: string; business_id?: string; customer_id?: string; email?: string }, void>({
      query: () => '/auth/me',
      transformResponse: (res: { data: { id: string; role: string; business_id?: string; customer_id?: string; email?: string } }) =>
        res.data,
    }),

    registerCustomer: builder.mutation<
      { token: string; user: AuthUser; message?: string },
      {
        name: string;
        email: string;
        phone: string;
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
        partner_type?: 'dining' | 'event';
        documents?: PartnerDocumentUpload[];
        cover_image_url?: string;
      }
    >({
      query: (body) => ({
        url: '/auth/register-business',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Businesses'],
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
      }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/businesses/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Businesses'],
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

    softDeleteBusiness: builder.mutation<{ message?: string }, string>({
      query: (id) => ({
        url: `/admin/businesses/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Businesses', 'AdminStats'],
    }),

    getAdminCustomers: builder.query<AdminCustomer[], { q?: string } | void>({
      query: (params) => {
        const q = params?.q?.trim();
        return q ? `/admin/customers?q=${encodeURIComponent(q)}` : '/admin/customers';
      },
      transformResponse: (res: { data: AdminCustomer[] }) => res.data || [],
      providesTags: ['AdminCustomers'],
    }),

    getAdminCustomer: builder.query<AdminCustomer, string>({
      query: (id) => `/admin/customers/${id}`,
      transformResponse: (res: { data: AdminCustomer }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'AdminCustomers', id }],
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

    softDeleteAdminCustomer: builder.mutation<{ message?: string }, string>({
      query: (id) => ({
        url: `/admin/customers/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AdminCustomers'],
    }),

    // ── Businesses (Public) ───────────────────────────────────────────────────

    getBusinesses: builder.query<
      Business[],
      { collection?: string; mood?: string; module?: 'dining' | 'event' } | void
    >({
      query: (params) => {
        let url = '/businesses';
        if (params) {
          const searchParams = new URLSearchParams();
          if (params.collection) searchParams.append('collection', params.collection);
          if (params.mood) searchParams.append('mood', params.mood);
          if (params.module) searchParams.append('module', params.module);
          const queryString = searchParams.toString();
          if (queryString) url += `?${queryString}`;
        }
        return url;
      },
      transformResponse: (res: { data: Business[] }) => res.data || [],
      providesTags: ['Businesses'],
    }),

    getCollections: builder.query<Collection[], void>({
      query: () => '/businesses/collections',
      transformResponse: (res: { data: Collection[] }) => res.data || [],
    }),

    getMoods: builder.query<Mood[], void>({
      query: () => '/businesses/moods',
      transformResponse: (res: { data: Mood[] }) => res.data || [],
    }),

    getBusinessTypes: builder.query<BusinessType[], void>({
      query: () => '/businesses/types',
      transformResponse: (res: { data: BusinessType[] }) => res.data || [],
    }),

    getPartnerDocumentMasters: builder.query<
      PartnerDocumentMaster[],
      'dining' | 'event' | void
    >({
      query: (module) => {
        const qs = module ? `?module=${module}` : '';
        return `/businesses/partner-documents${qs}`;
      },
      transformResponse: (res: { data?: PartnerDocumentMaster[] }) => res?.data ?? [],
      providesTags: ['PartnerDocuments'],
    }),

    getAdminPartnerDocuments: builder.query<
      PartnerDocumentMaster[],
      { module?: 'dining' | 'event' | 'both' } | void
    >({
      query: (params) => {
        const qs = params?.module ? `?module=${params.module}` : '';
        return `/admin/partner-documents${qs}`;
      },
      transformResponse: (res: { data?: PartnerDocumentMaster[] }) => res?.data ?? [],
      providesTags: (result) =>
        result
          ? [
            ...result.map((d) => ({ type: 'PartnerDocuments' as const, id: d.id })),
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
        module?: 'dining' | 'event' | 'both';
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
      query: ({ bizId, body }) => ({
        url: `/businesses/${bizId}/settings`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { bizId }) => [{ type: 'BusinessSettings', id: bizId }],
    }),

    // ── Tables ────────────────────────────────────────────────────────────────

    getTables: builder.query<Table[], string>({
      query: (bizId) => `/businesses/${bizId}/tables`,
      transformResponse: (res: { data: Table[] }) => res.data || [],
      providesTags: (_result, _error, bizId) => [{ type: 'Tables', id: bizId }],
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

    getBusinessBookings: builder.query<Booking[], string>({
      query: (bizId) => `/bookings/${bizId}`,
      transformResponse: (res: { data: Booking[] }) => res.data || [],
      providesTags: (_result, _error, bizId) => [{ type: 'Bookings', id: bizId }],
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
      { message?: string; booking_id?: string; table_assigned?: string; qr_token?: string },
      {
        business_id: string;
        customer_name: string;
        customer_phone: string;
        booking_time: string;
        booking_source: 'ONLINE' | 'WALK_IN';
        guests: number;
        customer_id?: string;
        approx_arrival?: string;
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

    // ── Reviews ──────────────────────────────────────────────────────────────

    getReviews: builder.query<Review[], string>({
      query: (bizId) => `/reviews/${bizId}`,
      transformResponse: (res: { data: Review[] }) => res.data || [],
      providesTags: (_result, _error, bizId) => [{ type: 'Reviews', id: bizId }],
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

    getMarketingPlans: builder.query<any[], void>({
      query: () => '/admin/marketing-plans',
      transformResponse: (res: { data: any[] }) => res.data,
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

    getMarketingCampaigns: builder.query<any[], void>({
      query: () => '/admin/marketing-campaigns',
      transformResponse: (res: { data: any[] }) => res.data,
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

    getAdminEvents: builder.query<AdminEvent[], { status?: string } | void>({
      query: (params) => {
        let url = '/admin/events';
        if (params?.status) url += `?status=${encodeURIComponent(params.status)}`;
        return url;
      },
      transformResponse: (res: { data: AdminEvent[] }) => res.data || [],
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

    getEventContracts: builder.query<EventContract[], void>({
      query: () => '/admin/event-contracts',
      transformResponse: (res: { data: EventContract[] }) => res.data || [],
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
      { data: EventReview; newStats?: { rating: string; reviews_count: number } },
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

    getOrganizerEventReviews: builder.query<EventReview[], { event_id?: string } | void>({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.event_id) sp.set('event_id', params.event_id);
        const qs = sp.toString();
        return `/events/organizer/reviews${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data: EventReview[] }) => res.data || [],
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

    getOrganizerOffers: builder.query<EventOffer[], void>({
      query: () => '/events/organizer/offers',
      transformResponse: (res: { data: EventOffer[] }) => res.data || [],
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
      { eventId: string; promo_code: string; ticket_amount: number }
    >({
      query: ({ eventId, promo_code, ticket_amount }) => ({
        url: `/events/public/${eventId}/validate-promo`,
        method: 'POST',
        body: { promo_code, ticket_amount },
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

    getOrganizerPayouts: builder.query<OrganizerPayout[], { business_id?: string } | void>({
      query: (params) => {
        const qs = params?.business_id
          ? `?business_id=${encodeURIComponent(params.business_id)}`
          : '';
        return `/admin/organizer-payouts${qs}`;
      },
      transformResponse: (res: { data: OrganizerPayout[] }) => res.data,
      providesTags: ['OrganizerPayouts'],
    }),

    // ── Analytics ─────────────────────────────────────────────────────────────

    getAnalytics: builder.query<Analytics, string>({
      query: (bizId) => `/businesses/${bizId}/analytics`,
      transformResponse: (res: { data: Analytics }) => res.data,
      providesTags: (_result, _error, bizId) => [{ type: 'Analytics', id: bizId }],
    }),

    getBusinessCampaigns: builder.query<any[], string>({
      query: (bizId) => `/businesses/${bizId}/campaigns`,
      transformResponse: (res: { data: any[] }) => res.data,
      providesTags: (_result, _error, bizId) => [{ type: 'MarketingCampaigns', id: bizId }],
    }),

    // ── Organizer Events ──────────────────────────────────────────────────────

    getOrganizerEvents: builder.query<OrganizerEvent[], { q?: string; status?: string } | void>({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q) sp.append('q', params.q);
        if (params?.status) sp.append('status', params.status);
        const qs = sp.toString();
        return `/events/organizer${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data: OrganizerEvent[] }) => res.data || [],
      providesTags: ['OrganizerEvents'],
    }),

    getOrganizerEvent: builder.query<OrganizerEvent, string>({
      query: (id) => `/events/organizer/${id}`,
      transformResponse: (res: { data: OrganizerEvent }) => res.data,
      providesTags: (_r, _e, id) => [{ type: 'OrganizerEvents', id }],
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
      OrganizerEventBooking[],
      { event_id?: string; status?: string } | void
    >({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.event_id) sp.set('event_id', params.event_id);
        if (params?.status) sp.set('status', params.status);
        const qs = sp.toString();
        return `/events/organizer/bookings${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data: OrganizerEventBooking[] }) => res.data || [],
      providesTags: ['OrganizerBookings'],
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

    getPublicEvents: builder.query<PublicEvent[], { q?: string; category?: string; city?: string } | void>({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q) sp.append('q', params.q);
        if (params?.category) sp.append('category', params.category);
        if (params?.city) sp.append('city', params.city);
        const qs = sp.toString();
        return `/events/public${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data: PublicEvent[] }) => res.data || [],
      providesTags: ['PublicEvents'],
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
        /** When true, POST to organizer booking API (event_admin selling for a customer) */
        for_organizer?: boolean;
      }
    >({
      query: ({ for_organizer, ...body }) => ({
        url: for_organizer ? '/events/organizer/bookings' : '/events/bookings',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['EventBookings', 'PublicEvents', 'OrganizerTicketStats', 'OrganizerBookings', 'OrganizerEvents'],
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

    getAdminEventGenres: builder.query<EventGenreMaster[], { category_type_id?: number }>({
      query: (params = {}) => {
        const sp = new URLSearchParams();
        if (params.category_type_id) sp.set('category_type_id', String(params.category_type_id));
        const qs = sp.toString();
        return `/admin/event-genres${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data?: EventGenreMaster[] }) => res?.data ?? [],
      providesTags: (result) =>
        result
          ? [
            ...result.map((g) => ({ type: 'EventMasters' as const, id: `genre-${g.id}` })),
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

    getAdminEventDocuments: builder.query<
      EventDocumentMaster[],
      { category_type_id?: number | 'global' }
    >({
      query: (params = {}) => {
        const sp = new URLSearchParams();
        if (params.category_type_id !== undefined) {
          sp.set('category_type_id', String(params.category_type_id));
        }
        const qs = sp.toString();
        return `/admin/event-documents${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (res: { data?: EventDocumentMaster[] }) => res?.data ?? [],
      providesTags: (result) =>
        result
          ? [
            ...result.map((d) => ({ type: 'EventMasters' as const, id: `doc-${d.id}` })),
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

    // ── Upload ────────────────────────────────────────────────────────────────

    uploadImage: builder.mutation<{ url: string }, FormData>({
      query: (formData) => ({
        url: '/upload',
        method: 'POST',
        body: formData,
      }),
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
  useRegisterCustomerMutation,
  useRegisterBusinessMutation,
  useGetBusinessesQuery,
  useUpdateAdminBusinessMutation,
  useSetBusinessEnabledMutation,
  useSoftDeleteBusinessMutation,
  useGetAdminCustomersQuery,
  useGetAdminCustomerQuery,
  useUpdateAdminCustomerMutation,
  useSetAdminCustomerEnabledMutation,
  useSoftDeleteAdminCustomerMutation,
  useGetCollectionsQuery,
  useGetMoodsQuery,
  useGetBusinessTypesQuery,
  useGetPartnerDocumentMastersQuery,
  useGetAdminPartnerDocumentsQuery,
  useCreateAdminPartnerDocumentMutation,
  useUpdateAdminPartnerDocumentMutation,
  useDeleteAdminPartnerDocumentMutation,
  useGetBusinessPublicQuery,
  useGetBusinessSettingsQuery,
  useUpdateBusinessSettingsMutation,
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
  useGetEventLayoutQuery,
  useUpdateEventLayoutMutation,
  useGetOrganizerTicketStatsQuery,
  useGetOrganizerBookingsQuery,
  useCreateOrganizerEventMutation,
  useUpdateOrganizerEventMutation,
  useSubmitOrganizerEventMutation,
  useToggleOrganizerEventVisibilityMutation,
  useCloseOrganizerEventMutation,
  useGetPublicEventsQuery,
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
  useGetAdminEventDocumentsQuery,
  useCreateAdminEventDocumentMutation,
  useUpdateAdminEventDocumentMutation,
  useDeleteAdminEventDocumentMutation,
} = api;
