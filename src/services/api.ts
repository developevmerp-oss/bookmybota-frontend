/**
 * Central API Service — Single source of truth for all backend API calls.
 * Built with RTK Query. Add new endpoints here; never call fetch() directly in pages.
 *
 * Base URL: http://localhost:5000/api
 * To change the backend URL, update BASE_URL below only.
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface Business {
  id: string;
  name: string;
  address: string;
  phone?: string;
  description?: string;
  type_name?: string;
  cover_image_url?: string;
  subscription_plan?: string;
  cuisine?: string;
  rating?: string | number;
  reviews_count?: number;
  price_range?: string;
  is_open?: boolean;
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
  business_name?: string;
  business_address?: string;
  customer_name: string;
  customer_phone: string;
  booking_time: string;
  booking_source: 'ONLINE' | 'WALK_IN';
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  table_number?: string;
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
  role: 'super_admin' | 'business_admin' | 'customer';
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
  tagTypes: ['Businesses', 'Tables', 'Bookings', 'BusinessSettings', 'AdminStats', 'Analytics', 'Reviews', 'MarketingPlans', 'MarketingCampaigns'],
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
      { success: boolean },
      {
        business_name: string;
        address: string;
        phone: string;
        description: string;
        type_id: number;
        admin_email: string;
        admin_password: string;
      }
    >({
      query: (body) => ({
        url: '/auth/register-business',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Businesses'],
    }),

    // ── Businesses (Public) ───────────────────────────────────────────────────

    getBusinesses: builder.query<Business[], { collection?: string; mood?: string } | void>({
      query: (params) => {
        let url = '/businesses';
        if (params) {
          const searchParams = new URLSearchParams();
          if (params.collection) searchParams.append('collection', params.collection);
          if (params.mood) searchParams.append('mood', params.mood);
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
      { success: boolean },
      {
        business_id: string;
        customer_name: string;
        customer_phone: string;
        booking_time: string;
        booking_source: 'ONLINE' | 'WALK_IN';
        guests: number;
        customer_id?: string;
      }
    >({
      query: (body) => ({
        url: '/bookings',
        method: 'POST',
        body,
      }),
      invalidatesTags: (_result, _error, { business_id }) => [{ type: 'Bookings', id: business_id }],
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

    cancelBooking: builder.mutation<{ success: boolean }, { id: string; refetchId?: string }>({
      query: ({ id }) => ({
        url: `/bookings/${id}/cancel`,
        method: 'PUT',
      }),
      invalidatesTags: ['Bookings'],
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
  useCheckAvailabilityQuery,
  useCreateBookingMutation,
  usePhoneLoginMutation,
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
} = api;
