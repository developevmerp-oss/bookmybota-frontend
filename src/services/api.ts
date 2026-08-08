/**
 * Central API Service — Single source of truth for all backend API calls.
 * Built with RTK Query. Add new endpoints here; never call fetch() directly in pages.
 *
 * Base URL: http://localhost:5000/api
 * To change the backend URL, update BASE_URL below only.
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

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
  owner_id?: string;
  operating_hours?: Record<string, { open: string; close: string; closed: boolean }>;
  gallery_images?: string[];
  menu_images?: string[];
  dining_offers?: Array<{ type: string; title: string; validity: string }>;
  amenities?: string[];
  average_cost?: number;
  is_promoted?: boolean;
  collection_slugs?: string[];
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
  }>;
  showtimes?: Array<{
    id: string;
    venue_name?: string;
    venue_address?: string;
    starts_at: string;
    ends_at?: string;
  }>;
  bookings?: Array<Record<string, unknown>>;
  rejection_reason?: string;
  genres?: string[];
  poster_horizontal_url?: string;
  poster_vertical_url?: string;
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

export interface OrganizerEvent extends AdminEvent {
  genres?: string[];
  poster_horizontal_url?: string;
  poster_vertical_url?: string;
  documents?: EventDocumentUpload[] | string[];
  rejection_reason?: string;
}

export interface EventFormPayload {
  name: string;
  category_type_id: number | null;
  genres: string[];
  poster_horizontal_url: string;
  poster_vertical_url: string;
  documents: EventDocumentUpload[];
  language: string;
  about_event: string;
  age_group: string;
  duration_minutes: number | null;
  ticket_types: Array<{ ticket_type: string; total_count: number; price: number }>;
  showtimes: Array<{
    venue_name: string;
    venue_address: string;
    starts_at: string;
    ends_at: string;
  }>;
}

export interface PublicEvent {
  id: string;
  name: string;
  poster_horizontal_url?: string;
  poster_vertical_url?: string;
  language?: string;
  about_event?: string;
  age_group?: string;
  duration_minutes?: number;
  category_name?: string;
  category_slug?: string;
  organizer_name?: string;
  next_showtime?: string;
  min_price?: number | string;
  status?: string;
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

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
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
  }),
  tagTypes: ['Businesses', 'Tables', 'Bookings', 'BusinessSettings', 'AdminStats', 'Analytics', 'Reviews', 'MarketingPlans', 'MarketingCampaigns', 'CustomerProfile', 'AdminEvents', 'AdminCommission', 'OrganizerEvents', 'PublicEvents', 'EventMasters'],
  endpoints: (builder) => ({

    // ── Auth ──────────────────────────────────────────────────────────────────

    login: builder.mutation<{ token: string; user: AuthUser }, { email: string; password: string }>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),

    registerCustomer: builder.mutation<
      { token: string; user: AuthUser },
      { name: string; email: string; phone: string; password: string }
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
        admin_password: string;
        partner_type?: 'dining' | 'event';
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
      { token: string; user: AuthUser },
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

    getPublicEvents: builder.query<PublicEvent[], { q?: string; category?: string } | void>({
      query: (params) => {
        const sp = new URLSearchParams();
        if (params?.q) sp.append('q', params.q);
        if (params?.category) sp.append('category', params.category);
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
  useRegisterCustomerMutation,
  useRegisterBusinessMutation,
  useGetBusinessesQuery,
  useUpdateAdminBusinessMutation,
  useSetBusinessEnabledMutation,
  useSoftDeleteBusinessMutation,
  useGetCollectionsQuery,
  useGetMoodsQuery,
  useGetBusinessTypesQuery,
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
  useGetOrganizerEventsQuery,
  useGetOrganizerEventQuery,
  useCreateOrganizerEventMutation,
  useUpdateOrganizerEventMutation,
  useSubmitOrganizerEventMutation,
  useToggleOrganizerEventVisibilityMutation,
  useCloseOrganizerEventMutation,
  useGetPublicEventsQuery,
  useGetPublicEventQuery,
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
