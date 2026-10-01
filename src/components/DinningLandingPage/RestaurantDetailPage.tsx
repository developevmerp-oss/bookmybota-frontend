"use client";
import { useState, use, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  MapPin, Phone, CheckCircle, Calendar, Users, Clock,
  Star, Share2, Compass, MessageSquare, Image as ImageIcon,
  BookOpen, AlertCircle, Sparkles, Copy, ChevronRight, Loader2,
  ChevronLeft, X, Navigation, User,
  Send, ShieldCheck, ArrowRight, Check, ChevronDown, Tag, CheckCheck,
  Sun, Moon, Sunrise, FileText, BadgeCheck, Utensils, Upload, PartyPopper,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { formatMoney, getCostForTwoFromRange } from '@/lib/currencyFormat';
import { formatDateCustomer } from '@/lib/dateFormat';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import { restaurantHref } from '@/lib/businessPublicPath';
import SafeCoverImage, { DiningImageFallback } from '@/components/Shared/SafeCoverImage';
import DiningWishlistButton from '@/components/DinningLandingPage/DiningWishlistButton';
import AboutVenueModal from '@/components/DinningLandingPage/AboutVenueModal';
import {
  bookingWidgetOfferLabel,
  businessHasCustomerVisibleOffer,
  formatDiningOfferDiscount,
  getEffectiveDiningOfferStatus,
  isDiningOfferCustomerVisible,
  isDiningOfferRedeemable,
  normalizeDiningOffers,
  snapshotDiningOffer,
  type DiningOffer,
} from '@/lib/diningOffers';
import { useRouter } from 'next/navigation';
import {
  useGetBusinessPublicQuery,
  useCreateBookingMutation,
  useLazyCheckAvailabilityQuery,
  useSendCustomerOtpMutation,
  useVerifyCustomerOtpMutation,
  useRegisterCustomerMutation,
  useGetReviewsQuery,
  useCreateReviewMutation,
  useGetBusinessesQuery,
  useGetCollectionsQuery,
  useGetBusinessOperatingDatesQuery,
  type BusinessOperatingDate,
  type DiningMealsConfig,
} from '@/services/api';
import { useAppSelector, useAppDispatch } from '@/lib/hooks';
import { loadFromStorage, setCredentials } from '@/features/auth/authSlice';
import { readSessionForRole } from '@/lib/authStorage';
import CustomerAuthModal from '@/components/Shared/CustomerAuthModal';
import { useSelectedCity } from '@/lib/useSelectedCity';
import { RestaurantDetailShimmer } from '@/components/Shared/Shimmer';
import { getPhoneValidationError, isValidPhone, sanitizePhoneInput } from '@/lib/validation';
import GuestTableAnimation from './GuestTableAnimation';
import BookingSuccessCheckAnimation from './BookingSuccessCheckAnimation';
import DiningBookingPolicyModal, {
  type DiningBookingPolicySection,
} from './DiningBookingPolicyModal';
import {
  confirmBookingSchema,
  type ConfirmBookingValues,
} from '@/lib/loginFormSchema';
import {
  diningReviewFormSchema,
  emptyDiningReviewFormValues,
  type DiningReviewFormValues,
} from '@/lib/diningReviewFormSchema';
import { extractApiError } from '@/lib/apiErrors';

function FacilityDiamondIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 10 10"
      width="10"
      height="10"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <circle cx="5" cy="1.2" r="1.15" />
      <circle cx="1.2" cy="5" r="1.15" />
      <circle cx="5" cy="5" r="1.15" />
      <circle cx="8.8" cy="5" r="1.15" />
      <circle cx="5" cy="8.8" r="1.15" />
    </svg>
  );
}

/** Same customer session the header Login button uses (token + user in localStorage). */
function readCustomerSessionFromStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const token =
      localStorage.getItem('token_customer') ||
      localStorage.getItem('token_customer');
    const raw =
      localStorage.getItem('user_customer') ||
      localStorage.getItem('user_customer');
    if (!token || !raw) return null;
    const user = JSON.parse(raw);
    if (!user || typeof user !== 'object') return null;
    return {
      token,
      user: { ...user, role: user.role || 'customer' },
    };
  } catch {
    return null;
  }
}

// ─── Helpers & Fallback Datasets ──────────────────────────────────────────────

const getPhotosForVenue = (typeName?: string, coverUrl?: string) => {
  const defaults = {
    Cafe: [
      coverUrl || "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&q=80",
      "https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=600&q=80",
      "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&q=80",
      "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600&q=80",
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&q=80"
    ],
    Bar: [
      coverUrl || "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=80",
      "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600&q=80",
      "https://images.unsplash.com/photo-1528826722302-d60844362f23?w=600&q=80",
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=80",
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&q=80"
    ],
    Restaurant: [
      coverUrl || "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=600&q=80",
      "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=600&q=80",
      "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=600&q=80",
      "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=600&q=80",
      "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=80"
    ]
  };
  const key = (typeName && typeName.toLowerCase().includes("cafe")) ? "Cafe" :
    (typeName && (typeName.toLowerCase().includes("bar") || typeName.toLowerCase().includes("pub"))) ? "Bar" :
      "Restaurant";
  return defaults[key];
};

const getMenuForVenue = (typeName?: string) => {
  const defaults = {
    Cafe: [
      "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=600&q=80",
      "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=600&q=80"
    ],
    Bar: [
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&q=80",
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600&q=80"
    ],
    Restaurant: [
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&q=80",
      "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600&q=80"
    ]
  };
  const key = (typeName && typeName.toLowerCase().includes("cafe")) ? "Cafe" :
    (typeName && (typeName.toLowerCase().includes("bar") || typeName.toLowerCase().includes("pub"))) ? "Bar" :
      "Restaurant";
  return defaults[key];
};

const isValidImageUrl = (url: unknown): url is string => {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "0" || trimmed === "null" || trimmed === "undefined") return false;
  return true;
};

const resolveValidMediaUrls = (urls: (string | null | undefined)[]) =>
  [...new Set(
    urls
      .filter(isValidImageUrl)
      .map((url) => resolveMediaUrl(url.trim()))
      .filter((url) => url.length > 0)
  )];

function MediaEmptyState({
  icon: Icon,
  message,
}: {
  icon: typeof ImageIcon;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-[#f7e9ff] flex items-center justify-center mb-3">
        <Icon size={24} className="text-[#6900AA]" strokeWidth={1.75} />
      </div>
      <p className="text-sm text-slate-500 font-medium">{message}</p>
    </div>
  );
}

function VenuePhotosGallery({
  urls,
  onOpen,
}: {
  urls: string[];
  onOpen: (index: number, items: string[]) => void;
}) {
  const [visibleUrls, setVisibleUrls] = useState(urls);

  useEffect(() => {
    setVisibleUrls(urls);
  }, [urls]);

  const markBroken = (badUrl: string) => {
    setVisibleUrls((prev) => prev.filter((url) => url !== badUrl));
  };

  if (visibleUrls.length === 0) {
    return (
      <MediaEmptyState
        icon={ImageIcon}
        message="No photos available at the moment."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
      {visibleUrls.slice(0, 3).map((url, idx) => {
        const showMoreOverlay = visibleUrls.length > 3 && idx === 2;
        return (
          <div
            key={url}
            onClick={() => onOpen(showMoreOverlay ? 0 : idx, visibleUrls)}
            className="relative aspect-[3/4] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <img
              src={url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={() => markBroken(url)}
            />
            {showMoreOverlay && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white transition-opacity group-hover:bg-black/75">
                <ImageIcon size={22} className="mb-1" />
                <span className="font-bold text-sm tracking-wide">View all photos</span>
                <span className="text-[0.625rem] text-white/70">{visibleUrls.length} Photos</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VenueMenuGallery({
  urls,
  onOpen,
}: {
  urls: string[];
  onOpen: (index: number, items: string[]) => void;
}) {
  const [visibleUrls, setVisibleUrls] = useState(urls);

  useEffect(() => {
    setVisibleUrls(urls);
  }, [urls]);

  const markBroken = (badUrl: string) => {
    setVisibleUrls((prev) => prev.filter((url) => url !== badUrl));
  };

  if (visibleUrls.length === 0) {
    return (
      <MediaEmptyState
        icon={BookOpen}
        message="No menu available at the moment."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {visibleUrls.slice(0, 3).map((menuUrl, idx) => {
        const showMoreOverlay = visibleUrls.length > 3 && idx === 2;
        return (
          <button
            key={menuUrl}
            type="button"
            onClick={() => onOpen(showMoreOverlay ? 0 : idx, visibleUrls)}
            className="w-full h-full flex flex-col text-left cursor-pointer group"
          >
            <div className="relative w-full pt-3 px-2 flex-1">
              <div className="absolute top-0 left-4 right-4 h-3 rounded-t-md border border-slate-200 bg-slate-50" aria-hidden />
              <div className="absolute top-1.5 left-2.5 right-2.5 h-3 rounded-t-md border border-slate-200 bg-slate-100" aria-hidden />
              <div className="relative w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-[3/4] shadow-sm">
                <img
                  src={menuUrl}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  onError={() => markBroken(menuUrl)}
                />
                {showMoreOverlay && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white transition-opacity group-hover:bg-black/75">
                    <BookOpen size={22} className="mb-1" />
                    <span className="font-bold text-sm tracking-wide">View all menus</span>
                    <span className="text-[0.625rem] text-white/70">{visibleUrls.length} pages</span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-2.5 min-h-[2.5rem]">
              {!showMoreOverlay && (
                <>
                  <p className="text-sm font-bold text-zinc-800">Menu</p>
                  <p className="text-sm lg:text-xs text-zinc-500">
                    {idx + 1} of {visibleUrls.length} {visibleUrls.length === 1 ? "page" : "pages"}
                  </p>
                </>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Date & Time Slot Helpers ─────────────────────────────────────────────────

const getBookingDates = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const formatDateLabel = (date: Date, idx: number) => {
  if (idx === 0) return { top: 'Today', bottom: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) };
  if (idx === 1) return { top: 'Tomorrow', bottom: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) };
  return { top: date.toLocaleDateString('en-IN', { weekday: 'short' }), bottom: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) };
};

function toLocalDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const generateTimeSlotsFromDay = (
  selectedDateIndex: number,
  day: BusinessOperatingDate | null | undefined,
  selectedDate?: Date
) => {
  const slots: string[] = [];
  const now = new Date();

  let targetDate = selectedDate;
  if (!targetDate) {
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + selectedDateIndex);
  }

  if (!day || !day.is_open || !day.open_time || !day.close_time) {
    return [];
  }

  const openTime = day.open_time.slice(0, 5);
  const closeTime = day.close_time.slice(0, 5);
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const openVal = openH * 60 + openM;
  const closeVal = closeH * 60 + closeM;

  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const slotVal = h * 60 + m;
      let inWindow = false;
      if (closeVal >= openVal) {
        inWindow = slotVal >= openVal && slotVal <= closeVal;
      } else {
        inWindow = slotVal >= openVal || slotVal <= closeVal;
      }
      if (!inWindow) continue;
      if (selectedDateIndex === 0) {
        const slotDate = new Date(targetDate);
        slotDate.setHours(h, m, 0, 0);
        const bufferNow = new Date(now.getTime() + 30 * 60 * 1000);
        if (slotDate <= bufferNow) continue;
      }
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
};

const formatSlotLabel = (slot: string) => {
  const [h, m] = slot.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
};

const isSlotInPeriod = (slot: string, openTime: string, closeTime: string) => {
  const [sh, sm] = openTime.split(':').map(Number);
  const [eh, em] = closeTime.split(':').map(Number);
  const [h, m] = slot.split(':').map(Number);
  const openVal = sh * 60 + sm;
  const closeVal = eh * 60 + em;
  const slotVal = h * 60 + m;

  if (closeVal >= openVal) {
    return slotVal >= openVal && slotVal <= closeVal;
  } else {
    // Overnight bounds
    return slotVal >= openVal || slotVal <= closeVal;
  }
};

// Generates slots directly from a meal period's own open/close window.
// This is independent of the restaurant's daily operating bounds so that
// e.g. breakfast (07:00–10:30) shows even when the venue opens at 11:00.
const generateSlotsForMeal = (
  mealOpen: string,
  mealClose: string,
  isToday: boolean
): string[] => {
  const slots: string[] = [];
  const now = new Date();
  const [openH, openM] = mealOpen.split(':').map(Number);
  const [closeH, closeM] = mealClose.split(':').map(Number);
  const openVal = openH * 60 + openM;
  const closeVal = closeH * 60 + closeM;

  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const slotVal = h * 60 + m;
      let inWindow = false;
      if (closeVal >= openVal) {
        inWindow = slotVal >= openVal && slotVal <= closeVal;
      } else {
        inWindow = slotVal >= openVal || slotVal <= closeVal;
      }
      if (!inWindow) continue;
      if (isToday) {
        const slotDate = new Date();
        slotDate.setHours(h, m, 0, 0);
        const bufferNow = new Date(now.getTime() + 30 * 60 * 1000);
        if (slotDate <= bufferNow) continue;
      }
      const hour = h.toString().padStart(2, '0');
      const min = m.toString().padStart(2, '0');
      slots.push(`${hour}:${min}`);
    }
  }
  return slots;
};

interface Review {
  id: number;
  user: string;
  rating: number;
  date: string;
  text: string;
}

const DEFAULT_REVIEWS: Review[] = [
  { id: 1, user: "Rohan Mehta", rating: 5, date: "Yesterday", text: "Amazing ambiance and very cooperative staff. The table was ready on time. Food is absolutely delicious!" },
  { id: 2, user: "Aarav Shah", rating: 4, date: "3 days ago", text: "Great experience. Loved the presentation of the continental dishes. Booking through Book My Bota was seamless and saved us from waiting in line." },
  { id: 3, user: "Priya Patel", rating: 4.5, date: "1 week ago", text: "Lovely cozy place. Recommended for family dinner. The service is prompt." }
];

function SuccessCheckDraw() {
  return (
    <svg
      viewBox="0 0 52 52"
      className="success-check-draw h-[1em] w-[1em] shrink-0"
      aria-hidden
    >
      <circle className="success-check-circle" cx="26" cy="26" r="24" fill="none" />
      <path className="success-check-mark" fill="none" d="M14.5 27.2l7.4 7.4 15.6-16.2" />
    </svg>
  );
}

const StarRatingInput = ({ value, onChange }: { value: number, onChange: (val: number) => void }) => {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="relative cursor-pointer p-0 border-0 bg-transparent"
          onClick={() => onChange(star)}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
        >
          <Star
            size={24}
            strokeWidth={1.5}
            className={`${value >= star ? "fill-emerald-500 text-emerald-500" : "text-slate-300 fill-slate-100"} transition-colors`}
          />
        </button>
      ))}
      <span className="ml-2 text-xs font-bold text-slate-500 w-12">{value}</span>
    </div>
  );
};

/** Sticky tabs that scroll to sections on the Overview page. */
const DETAIL_SECTION_TABS = [
  { id: "Overview", sectionId: "section-overview" },
  { id: "Menu", sectionId: "section-menu" },
  { id: "Photos", sectionId: "section-photos" },
  { id: "Reviews", sectionId: "section-reviews" },
  // { id: "Book a Table", sectionId: "" },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const selectedCity = useSelectedCity();
  const { data: profile, isLoading } = useGetBusinessPublicQuery(resolvedParams.id);
  /** Prefer UUID once public profile loads — slug URLs must not be sent as business_id FKs. */
  const bizId = profile?.id || resolvedParams.id;
  const bookingDates = useMemo(() => getBookingDates(), []);
  const opDateRange = useMemo(() => {
    if (!bookingDates.length) return { from: '', to: '' };
    return {
      from: toLocalDateKey(bookingDates[0]),
      to: toLocalDateKey(bookingDates[bookingDates.length - 1]),
    };
  }, [bookingDates]);
  const { data: operatingDates = [] } = useGetBusinessOperatingDatesQuery(
    { bizId, from: opDateRange.from, to: opDateRange.to },
    { skip: !bizId || !opDateRange.from || !profile?.id }
  );
  const operatingByDate = useMemo(() => {
    const map = new Map<string, BusinessOperatingDate>();
    for (const row of operatingDates) {
      const key = String(row.op_date || '').slice(0, 10);
      if (key) map.set(key, row);
    }
    return map;
  }, [operatingDates]);
  const [createBooking] = useCreateBookingMutation();
  const [checkAvailabilityQuery] = useLazyCheckAvailabilityQuery();
  const {
    data: reviewsData,
    refetch: refetchReviews,
    isUninitialized: reviewsUninitialized,
  } = useGetReviewsQuery(bizId, { skip: !bizId || !profile?.id });
  const reviews = reviewsData?.items ?? [];
  const reviewEligibility = reviewsData?.eligibility;
  const [createReview, { isLoading: submittingReview }] = useCreateReviewMutation();
  // Similar restaurants query logic
  const { data: collections = [] } = useGetCollectionsQuery();
  const firstCollectionSlug = profile?.collection_slugs?.[0];
  const { data: similarBusinesses = [] } = useGetBusinessesQuery(
    { module: "dining", collection: firstCollectionSlug },
    { skip: !firstCollectionSlug }
  );

  const matchedCollection = collections.find((c) => c.slug === firstCollectionSlug);
  const similarRestaurants = similarBusinesses.filter((b) => b.id !== bizId && b.slug !== resolvedParams.id);

  const similarScrollerRef = useRef<HTMLDivElement>(null);

  const scrollSimilar = (direction: 'left' | 'right') => {
    if (similarScrollerRef.current) {
      const scrollAmount = 304; // w-[280px] + gap-6 (24px)
      similarScrollerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Load current auth user from localStorage — for customer_id linking only
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((state) => state.auth.user);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  useEffect(() => {
    const syncCustomerAuth = () => {
      dispatch(loadFromStorage());
      const session = readSessionForRole('customer');
      if (session) {
        dispatch(setCredentials({ user: session.user, token: session.token }));
      }
      // Skip until reviews query has started (profile UUID resolved).
      if (!reviewsUninitialized) {
        void refetchReviews();
      }
    };
    syncCustomerAuth();
    window.addEventListener('auth_changed', syncCustomerAuth);
    return () => window.removeEventListener('auth_changed', syncCustomerAuth);
  }, [dispatch, reviewsUninitialized, refetchReviews]);

  // Scroll to top on restaurant change/mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [resolvedParams.id]);

  // Sticky section tabs (Overview / Menu / Photos / Reviews) — District-like staged sticky nav
  const [activeTab, setActiveTab] = useState<string>("Overview");
  const [drawerStep, setDrawerStep] = useState(1); // 1: Selections, 2: Login/OTP/Register, 3: Summary, 4: Success
  const [siteHeaderHeight, setSiteHeaderHeight] = useState(0);
  const [sidebarStickyTop, setSidebarStickyTop] = useState(140);
  const [titlePast, setTitlePast] = useState(false);
  const [heroPast, setHeroPast] = useState(false);
  const [restaurantStickyHeight, setRestaurantStickyHeight] = useState(0);
  const titleSentinelRef = useRef<HTMLDivElement>(null);
  const heroEndSentinelRef = useRef<HTMLDivElement>(null);
  const restaurantStickyRef = useRef<HTMLDivElement>(null);
  const scrollSpyPausedRef = useRef(false);

  const hideSiteNav = titlePast;
  const showRestaurantSticky = titlePast;
  const isBookTableFlow = activeTab === "Book a Table";
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const [isLgViewport, setIsLgViewport] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false
  );
  const [mobileTabsHeight, setMobileTabsHeight] = useState(0);
  const mobileTabsRef = useRef<HTMLDivElement>(null);
  const showMobileSectionTabs = isMobileViewport && heroPast && !isBookTableFlow;
  /** Desktop book steps 1–3: section tabs + Book a Table (selected). */
  const showDesktopBookTabsInline =
    isBookTableFlow && isLgViewport && drawerStep >= 1 && drawerStep <= 3;
  const showSectionTabs = showRestaurantSticky && heroPast && !isBookTableFlow;
  const restaurantStickyVisible = !isBookTableFlow && showRestaurantSticky;

  useEffect(() => {
    const measureHeader = () => {
      const header = document.querySelector("header");
      setSiteHeaderHeight(header?.getBoundingClientRect().height ?? 0);
    };
    measureHeader();
    window.addEventListener("resize", measureHeader);
    return () => window.removeEventListener("resize", measureHeader);
  }, [isBookTableFlow, isLgViewport, isMobileViewport]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mqMobile = window.matchMedia("(max-width: 767px)");
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      setIsMobileViewport(mqMobile.matches);
      setIsLgViewport(mqLg.matches);
    };
    sync();
    mqMobile.addEventListener("change", sync);
    mqLg.addEventListener("change", sync);
    return () => {
      mqMobile.removeEventListener("change", sync);
      mqLg.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    // Mobile: always hide site chrome. Tablet book: immersive. Desktop book: keep main + sub header.
    const hideChrome =
      isMobileViewport ||
      (isBookTableFlow && !isLgViewport) ||
      (!isBookTableFlow && (hideSiteNav || showRestaurantSticky));
    document.body.dataset.diningDetailNav = hideChrome ? "1" : "0";
    if (isBookTableFlow && !isLgViewport) {
      document.body.dataset.diningBookImmersive = "1";
    } else {
      delete document.body.dataset.diningBookImmersive;
    }
    return () => {
      delete document.body.dataset.diningDetailNav;
      delete document.body.dataset.diningBookImmersive;
    };
  }, [isBookTableFlow, isMobileViewport, isLgViewport, hideSiteNav, showRestaurantSticky]);

  useEffect(() => {
    const el = mobileTabsRef.current;
    if (!el || !showMobileSectionTabs) {
      setMobileTabsHeight(0);
      return;
    }
    const update = () => setMobileTabsHeight(el.offsetHeight || 0);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showMobileSectionTabs, activeTab]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    const observers: IntersectionObserver[] = [];

    const watch = (
      el: HTMLElement | null,
      onChange: (past: boolean) => void,
      rootMargin = "0px 0px 0px 0px"
    ) => {
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => onChange(!entry.isIntersecting && entry.boundingClientRect.top < 0),
        { rootMargin, threshold: 0 }
      );
      observer.observe(el);
      observers.push(observer);
    };

    watch(titleSentinelRef.current, setTitlePast, "-1px 0px 0px 0px");
    watch(heroEndSentinelRef.current, setHeroPast, "-1px 0px 0px 0px");

    return () => observers.forEach((o) => o.disconnect());
  }, [resolvedParams.id, profile?.id]);

  useEffect(() => {
    const el = restaurantStickyRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      setRestaurantStickyHeight(restaurantStickyVisible ? 72 : 0);
      return;
    }
    const update = () => setRestaurantStickyHeight(el.offsetHeight || 0);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [restaurantStickyVisible, showSectionTabs]);

  const getDetailStickyOffset = useCallback(() => {
    if (typeof window === "undefined") return 140;
    if (isMobileViewport) {
      if (showMobileSectionTabs) {
        return (mobileTabsHeight || 48) + 8;
      }
      return 8;
    }
    if (restaurantStickyVisible) {
      const sticky = document.getElementById("dining-restaurant-sticky");
      const h = sticky?.offsetHeight || restaurantStickyHeight || 72;
      return h + 8;
    }
    if (siteHeaderHeight > 0) return siteHeaderHeight + 8;
    if (window.matchMedia("(min-width: 1280px)").matches) return 148;
    if (window.matchMedia("(min-width: 1024px)").matches) return 140;
    if (window.matchMedia("(min-width: 768px)").matches) return 132;
    return 124;
  }, [
    siteHeaderHeight,
    restaurantStickyVisible,
    restaurantStickyHeight,
    isMobileViewport,
    showMobileSectionTabs,
    mobileTabsHeight,
  ]);

  useEffect(() => {
    const updateSidebarTop = () => setSidebarStickyTop(getDetailStickyOffset());
    updateSidebarTop();
    window.addEventListener("resize", updateSidebarTop);
    return () => {
      window.removeEventListener("resize", updateSidebarTop);
    };
  }, [getDetailStickyOffset]);

  const scrollToDetailSection = useCallback((sectionId: string, tabId: string) => {
    scrollSpyPausedRef.current = true;
    setActiveTab(tabId);

    const performScroll = () => {
      const el = document.getElementById(sectionId);
      if (!el) return false;
      const offset = getDetailStickyOffset();
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      return true;
    };

    const tryScroll = (attempt = 0) => {
      if (performScroll()) {
        window.setTimeout(() => {
          scrollSpyPausedRef.current = false;
        }, 900);
        return;
      }
      if (attempt < 12) {
        window.setTimeout(() => tryScroll(attempt + 1), 50);
      } else {
        scrollSpyPausedRef.current = false;
      }
    };

    requestAnimationFrame(() => tryScroll());
  }, [getDetailStickyOffset]);

  const scrollToTabPanelStart = useCallback(() => {
    const performScroll = () => {
      const el = document.getElementById("tab-panel-start");
      if (!el) return false;
      const offset = getDetailStickyOffset();
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      return true;
    };

    const tryScroll = (attempt = 0) => {
      if (performScroll()) return;
      if (attempt < 12) {
        window.setTimeout(() => tryScroll(attempt + 1), 50);
      }
    };

    requestAnimationFrame(() => tryScroll());
  }, [getDetailStickyOffset]);

  // Highlight sticky tab from scroll position (Overview → Menu → Photos → Reviews)
  useEffect(() => {
    if (activeTab === "Book a Table") return;

    const syncActiveTabFromScroll = () => {
      if (scrollSpyPausedRef.current) return;
      const offset = getDetailStickyOffset();
      const lastTab = DETAIL_SECTION_TABS[DETAIL_SECTION_TABS.length - 1];
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 160;

      // Last section often can't fully cross the sticky line — select it near page end
      if (nearBottom) {
        setActiveTab((prev) => (prev === lastTab.id ? prev : lastTab.id));
        return;
      }

      let currentId: string = DETAIL_SECTION_TABS[0].id;
      for (const tab of DETAIL_SECTION_TABS) {
        const el = document.getElementById(tab.sectionId);
        if (!el) continue;
        // Activate when section reaches just under the sticky bar
        if (el.getBoundingClientRect().top - offset <= 24) {
          currentId = tab.id;
        }
      }
      setActiveTab((prev) => (prev === currentId ? prev : currentId));
    };

    syncActiveTabFromScroll();
    window.addEventListener("scroll", syncActiveTabFromScroll, { passive: true });
    window.addEventListener("resize", syncActiveTabFromScroll);
    return () => {
      window.removeEventListener("scroll", syncActiveTabFromScroll);
      window.removeEventListener("resize", syncActiveTabFromScroll);
    };
  }, [activeTab === "Book a Table", resolvedParams.id, getDetailStickyOffset]); // eslint-disable-line react-hooks/exhaustive-deps

  // Booking Form State — date/time now driven by pill selectors
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedTime, setSelectedTime] = useState('');
  const [guests, setGuests] = useState('2');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [arrivalTime, setArrivalTime] = useState('On time');
  const [arrivalDropdownOpen, setArrivalDropdownOpen] = useState(false);
  const arrivalFieldRef = useRef<HTMLDivElement>(null);
  const [specialRequestOpen, setSpecialRequestOpen] = useState(false);
  const [specialRequest, setSpecialRequest] = useState('');
  const [lastBookingId, setLastBookingId] = useState<string | null>(null);
  const [lastQrToken, setLastQrToken] = useState<string | null>(null);
  const [bookingIdCopied, setBookingIdCopied] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<DiningOffer | null>(null);
  const [noOfferSelected, setNoOfferSelected] = useState(false);
  const allDiningOffers = normalizeDiningOffers(profile?.dining_offers);
  const visibleOffers = allDiningOffers.filter(isDiningOfferCustomerVisible);
  const bookableOffers = allDiningOffers.filter(isDiningOfferRedeemable);
  // Same as events/cinema: detail + booking show partner offers only.
  // Super Admin platform offers appear on the landing Special Offers rail
  // and can still apply at restaurant QR checkout.
  const hasAnyBookableOffer = bookableOffers.length > 0;
  const appliedOffer = noOfferSelected
    ? null
    : selectedOffer
      ? snapshotDiningOffer(bookableOffers, selectedOffer)
      : null;
  const widgetOfferLabel = bookingWidgetOfferLabel(profile?.dining_offers);
  const offerChipLabel =
    visibleOffers.length > 0
      ? `${visibleOffers.length} offer${visibleOffers.length > 1 ? "s" : ""}`
      : "";
  const [offersSectionOpen, setOffersSectionOpen] = useState(true);
  const [availabilityStatus, setAvailabilityStatus] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [venueInfoModal, setVenueInfoModal] = useState<"about" | "location" | "phone" | "hours" | null>(null);
  const [aboutDescOverflows, setAboutDescOverflows] = useState(false);
  const aboutDescRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = aboutDescRef.current;
    if (!el) {
      setAboutDescOverflows(false);
      return;
    }
    const update = () => setAboutDescOverflows(el.scrollHeight > el.clientHeight + 1);
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [profile?.description, profile?.id]);

  useEffect(() => {
    if (!hasAnyBookableOffer) {
      setSelectedOffer(null);
      setNoOfferSelected(true);
      return;
    }
    if (!noOfferSelected && !selectedOffer) {
      setSelectedOffer(bookableOffers[0]);
      setNoOfferSelected(false);
    } else if (
      selectedOffer &&
      !bookableOffers.some(
        (o) =>
          (selectedOffer.id && o.id === selectedOffer.id) ||
          (o.title === selectedOffer.title && o.promo_code === selectedOffer.promo_code)
      )
    ) {
      setSelectedOffer(bookableOffers[0] || null);
      setNoOfferSelected(!bookableOffers[0]);
    }
  }, [profile?.dining_offers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drawer & Auth states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  // Radio-style meal accordion — only one section open at a time
  const [activeMealSection, setActiveMealSection] = useState<'breakfast' | 'lunch' | 'dinner' | null>('lunch');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [bookingPolicyOpen, setBookingPolicyOpen] = useState(false);
  const [bookingPolicyFocus, setBookingPolicyFocus] = useState<DiningBookingPolicySection>("terms");
  const [bookingDropdownOpen, setBookingDropdownOpen] = useState<'date' | 'guests' | 'meal' | null>(null);
  const bookingFiltersRef = useRef<HTMLDivElement>(null);
  const [reserveWidgetDropdown, setReserveWidgetDropdown] = useState<"date" | "guests" | null>(null);
  const reserveWidgetRef = useRef<HTMLDivElement>(null);

  const [loginStep, setLoginStep] = useState(1); // 1: phone, 2: OTP, 3: register profile
  const [loginPhone, setLoginPhone] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const pendingProceedAfterAuth = useRef(false);

  const getLoggedInCustomer = () => {
    if (authUser?.role === 'customer') return authUser;
    return readSessionForRole('customer')?.user ?? null;
  };

  const proceedToBooking = () => {
    dispatch(loadFromStorage());
    const session = readSessionForRole('customer');
    const customer = session?.user || (authUser?.role === 'customer' ? authUser : null);
    if (!customer) {
      pendingProceedAfterAuth.current = true;
      setAuthModalOpen(true);
      return;
    }
    if (session) {
      dispatch(setCredentials({ user: session.user, token: session.token }));
    }
    setDrawerStep(3);
    setName(customer.name || '');
    setPhone(customer.phone || '');
  };

  const [sendCustomerOtp, { isLoading: isSendingOtp }] = useSendCustomerOtpMutation();
  const [verifyCustomerOtp, { isLoading: isVerifyingOtp }] = useVerifyCustomerOtpMutation();
  const [registerCustomer, { isLoading: isRegistering }] = useRegisterCustomerMutation();

  const {
    control,
    handleSubmit: handleConfirmSubmit,
    setValue: setConfirmValue,
    setFocus: setConfirmFocus,
    reset: resetConfirmForm,
    formState: { errors: confirmErrors },
  } = useForm<ConfirmBookingValues>({
    resolver: yupResolver(confirmBookingSchema),
    defaultValues: { name: '', phone: '', arrivalTime: 'On time' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: true,
  });

  const {
    register: registerReview,
    control: reviewControl,
    handleSubmit: handleReviewSubmit,
    reset: resetReviewForm,
    setValue: setReviewValue,
    getValues: getReviewValues,
    formState: { errors: reviewErrors },
  } = useForm<DiningReviewFormValues>({
    resolver: yupResolver(diningReviewFormSchema) as any,
    defaultValues: emptyDiningReviewFormValues(),
    mode: 'onSubmit',
  });

  const authToken = useAppSelector((state) => state.auth.token);
  const customerSession =
    authUser?.role === 'customer' && authToken
      ? { user: authUser, token: authToken }
      : readSessionForRole('customer');
  const loggedInReviewName = String(customerSession?.user?.name || '').trim();
  const isCustomerLoggedIn = Boolean(
    customerSession?.token && customerSession?.user?.role === 'customer'
  );
  const canWriteReview = Boolean(reviewEligibility?.can_review);

  const prevReviewNameRef = useRef('');
  useEffect(() => {
    if (!loggedInReviewName) {
      prevReviewNameRef.current = '';
      return;
    }
    const current = (getReviewValues('user_name') || '').trim();
    if (!current || current === prevReviewNameRef.current) {
      setReviewValue('user_name', loggedInReviewName, { shouldValidate: true, shouldDirty: false });
    }
    prevReviewNameRef.current = loggedInReviewName;
  }, [loggedInReviewName, setReviewValue, getReviewValues]);

  // Pre-fill Name & Phone when authUser changes
  useEffect(() => {
    if (authUser && authUser.role === 'customer') {
      setName(authUser.name || '');
      setPhone(authUser.phone || '');
      if (pendingProceedAfterAuth.current) {
        pendingProceedAfterAuth.current = false;
        setDrawerStep(3);
      }
    }
  }, [authUser]);

  useEffect(() => {
    if (drawerStep !== 2) return;
    const customer = getLoggedInCustomer();
    if (customer) {
      setDrawerStep(3);
      setName(customer.name || '');
      setPhone(customer.phone || '');
      return;
    }
    pendingProceedAfterAuth.current = true;
    setAuthModalOpen(true);
    setDrawerStep(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerStep, authUser]);

  useEffect(() => {
    if (drawerStep !== 3) return;
    resetConfirmForm({ name, phone, arrivalTime });
    // Sync once when opening confirm step so typing is not reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerStep]);

  useEffect(() => {
    if (!arrivalDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (arrivalFieldRef.current && !arrivalFieldRef.current.contains(e.target as Node)) {
        setArrivalDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [arrivalDropdownOpen]);

  useEffect(() => {
    if (!bookingDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (bookingFiltersRef.current && !bookingFiltersRef.current.contains(e.target as Node)) {
        setBookingDropdownOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [bookingDropdownOpen]);

  useEffect(() => {
    if (!reserveWidgetDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (reserveWidgetRef.current && !reserveWidgetRef.current.contains(e.target as Node)) {
        setReserveWidgetDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReserveWidgetDropdown(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [reserveWidgetDropdown]);

  const handlePhoneLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (loginStep === 1) {
      const phoneErr = getPhoneValidationError(loginPhone);
      if (phoneErr) {
        setLoginError(phoneErr);
        return;
      }
      try {
        await sendCustomerOtp({ phone: sanitizePhoneInput(loginPhone) }).unwrap();
        setLoginStep(2);
        setLoginOtp('');
        setIsRegisterMode(false);
      } catch (err: unknown) {
        const msg = (err as { data?: { error?: string } })?.data?.error;
        setLoginError(msg || 'Could not send OTP. Please try again.');
      }
      return;
    }

    try {
      const data = await verifyCustomerOtp({
        phone: sanitizePhoneInput(loginPhone),
        otp: loginOtp,
      }).unwrap();

      if (data.next === 'authenticated') {
        dispatch(setCredentials({ user: data.user, token: data.token }));
        window.dispatchEvent(new Event('auth_changed'));
        setName(data.user.name || '');
        setPhone(data.user.phone || loginPhone);
        setDrawerStep(3);
        return;
      }

      setVerificationToken(data.verification_token);
      setRegName('');
      setRegEmail('');
      setLoginStep(3);
      setIsRegisterMode(true);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error;
      setLoginError(msg || 'OTP verification failed.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!regName || !regEmail) {
      setLoginError('Name and email are required.');
      return;
    }
    if (!verificationToken) {
      setLoginError('Phone verification expired. Please verify OTP again.');
      setLoginStep(2);
      return;
    }
    try {
      const cleanPhone = sanitizePhoneInput(loginPhone);
      const data = await registerCustomer({
        name: regName,
        email: regEmail,
        phone: cleanPhone,
        verification_token: verificationToken,
        auto_generate_password: true,
      }).unwrap();
      dispatch(setCredentials({ user: data.user, token: data.token }));
      window.dispatchEvent(new Event('auth_changed'));
      setName(regName);
      setPhone(cleanPhone);
      setDrawerStep(3);
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error;
      setLoginError(msg || 'Registration failed. Please try again.');
    }
  };

  // Automatically check availability on Summary step (Book a Table tab)
  useEffect(() => {
    if (activeTab === "Book a Table" && drawerStep === 3 && selectedTime && bizId) {
      checkAvailability();
    }
  }, [activeTab, drawerStep, selectedTime, guests, bizId]);

  // Mount target for inline Book a Table booking UI
  const [bookTableSlot, setBookTableSlot] = useState<HTMLDivElement | null>(null);

  // Lightbox / Image Zoom & Slider state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);
  const [lightboxItems, setLightboxItems] = useState<string[]>([]);

  const uploadedPhotos = [];
  if (profile?.cover_image_url) {
    uploadedPhotos.push(profile.cover_image_url);
  }
  if (profile?.gallery_images && profile.gallery_images.length > 0) {
    // avoid duplicates if cover_image_url is somehow in gallery_images
    const uniqueGallery = profile.gallery_images.filter(img => img !== profile.cover_image_url);
    uploadedPhotos.push(...uniqueGallery);
  }

  const photos = profile ? resolveValidMediaUrls(uploadedPhotos) : [];
  const venueGalleryPhotos = resolveValidMediaUrls(uploadedPhotos);

  const openLightbox = (index: number, items?: string[]) => {
    const list = items && items.length > 0 ? items : photos;
    setLightboxItems(list);
    setCurrentPhotoIdx(index);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
  };

  const nextPhoto = () => {
    setCurrentPhotoIdx((prev) => (prev + 1) % (lightboxItems.length || 1));
  };

  const prevPhoto = () => {
    setCurrentPhotoIdx((prev) => (prev - 1 + (lightboxItems.length || 1)) % (lightboxItems.length || 1));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLightboxOpen) return;
      if (e.key === 'ArrowRight') nextPhoto();
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handleKeyDown);
    if (isLightboxOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = prevOverflow;
      };
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, lightboxItems.length]);

  // Find if selected day is closed (calendar date row is source of truth)
  const selectedOpDay = operatingByDate.get(toLocalDateKey(bookingDates[selectedDateIndex]));
  const isSelectedDayClosed = !selectedOpDay || selectedOpDay.is_open === false;

  const timeSlots = generateTimeSlotsFromDay(
    selectedDateIndex,
    selectedOpDay,
    bookingDates[selectedDateIndex]
  );

  const handleDateSelect = (idx: number) => {
    setSelectedDateIndex(idx);
    setSelectedTime('');
    setAvailabilityStatus(null);
  };

  const handleTimeSelect = (slot: string) => {
    setSelectedTime(slot);
    setAvailabilityStatus(null);
  };

  const getBookingISO = () => {
    const d = bookingDates[selectedDateIndex];
    const [h, m] = selectedTime.split(':').map(Number);
    const dt = new Date(d);
    dt.setHours(h, m, 0, 0);
    return dt.toISOString();
  };

  // Reviews use RHF (see reviewForm above)
  const bookingWidgetRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const checkAvailability = async () => {
    if (!selectedTime) {
      toast.error("Please select a time slot first.");
      return;
    }
    if (!guests) return;
    setAvailabilityStatus('loading');
    try {
      const bookingDateTime = getBookingISO();
      const data = await checkAvailabilityQuery({
        business_id: bizId,
        date: bookingDateTime,
        guests: String(guests),
      }).unwrap();
      setAvailabilityStatus(data.available === true ? 'available' : 'unavailable');
    } catch {
      setAvailabilityStatus('error');
    }
  };

  const submitBooking = async (customerName: string, customerPhone: string, approxArrival: string) => {
    if (availabilityStatus !== 'available') return;
    if (!authUser || authUser.role !== 'customer' || !authUser.customer_id) {
      toast.error('Please sign in to complete your booking.');
      pendingProceedAfterAuth.current = true;
      setAuthModalOpen(true);
      return;
    }
    const phoneErr = getPhoneValidationError(customerPhone);
    if (phoneErr) {
      toast.error(phoneErr);
      return;
    }
    try {
      const bookingDateTime = getBookingISO();

      // Only pass customer_id if the current user is a registered customer.
      // Prevent business_admin / super_admin sessions from polluting the booking's customer link.
      const customerIdPayload: string | undefined =
        authUser?.role === 'customer' && authUser.customer_id
          ? authUser.customer_id
          : undefined;

      // No bookable offers → book without an offer (do not treat as a failed selection).
      const wantsOffer = hasAnyBookableOffer && !noOfferSelected;
      if (wantsOffer && !appliedOffer) {
        toast.error('Selected offer is no longer available. Choose another or book without an offer.');
        return;
      }

      const result = await createBooking({
        business_id: bizId,
        customer_name: customerName,
        customer_phone: customerPhone,
        booking_time: bookingDateTime,
        booking_source: 'ONLINE',
        guests: Number(guests),
        approx_arrival: approxArrival,
        special_request: specialRequest.trim() ? specialRequest.trim().slice(0, 500) : null,
        applied_offer: wantsOffer && appliedOffer ? appliedOffer : null,
        customer_id: customerIdPayload,
      }).unwrap();
      setBookingSuccess(true);
      setDrawerStep(4);
      if (result.booking_id) {
        setLastBookingId(result.booking_id);
      }
      setLastQrToken(result.qr_token || result.booking_id || null);
      toast.success('Booking confirmed!');
    } catch {
      toast.error('Booking failed. Please try again.');
    }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitBooking(name, phone, arrivalTime);
  };

  const onConfirmBooking = async (data: ConfirmBookingValues) => {
    setName(data.name);
    setPhone(data.phone);
    setArrivalTime(data.arrivalTime);
    await submitBooking(data.name, data.phone, data.arrivalTime);
  };

  const handleResetBooking = () => {
    setBookingSuccess(false);
    setAvailabilityStatus(null);
    setSelectedTime('');
    setName('');
    setPhone('');
    setArrivalTime('On time');
    resetConfirmForm({ name: '', phone: '', arrivalTime: 'On time' });
    setSpecialRequestOpen(false);
    setSpecialRequest('');
    setLastBookingId(null);
    setLastQrToken(null);
    setBookingIdCopied(false);
    setDrawerStep(1);
  };

  const onAddReview = async (values: DiningReviewFormValues) => {
    if (!isCustomerLoggedIn) {
      setAuthModalOpen(true);
      toast.info('Please log in to submit a review.');
      return;
    }
    try {
      const res = await createReview({
        businessId: bizId,
        user_name: values.user_name.trim(),
        rating: values.rating,
        text: values.text.trim(),
      }).unwrap();
      resetReviewForm({
        user_name: loggedInReviewName || values.user_name.trim(),
        rating: 5,
        text: '',
      });
      toast.success(res.message || 'Review submitted successfully!');
      void refetchReviews();
    } catch (err) {
      toast.error(extractApiError(err, 'Error submitting review.'));
    }
  };

  const handleCopyAddress = () => {
    if (!profile) return;
    navigator.clipboard.writeText(profile.address || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickBook = (offer?: DiningOffer) => {
    if (offer && isDiningOfferRedeemable(offer)) {
      setSelectedOffer(offer);
      setNoOfferSelected(false);
    } else if (offer) {
      setSelectedOffer(null);
      setNoOfferSelected(true);
      toast.info("This offer is coming soon and cannot be attached to a booking yet.");
    }
    setDrawerStep(1);
    setActiveTab("Book a Table");
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      scrollToTabPanelStart();
    }
  };

  const closeBookingPanel = () => {
    setActiveTab("Overview");
    setIsDrawerOpen(false);
  };

  if (isLoading) {
    return <RestaurantDetailShimmer />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <div className="text-center p-8 bg-white rounded-3xl border border-slate-100 shadow-md">
          <AlertCircle size={40} className="text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-800">Venue Not Found</h2>
          <p className="text-sm mt-1 mb-4">The requested business profile does not exist.</p>
          <Link href="/" className="bg-rose-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-rose-700 transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }


  const venueMenuImages = resolveValidMediaUrls(profile.menu_images ?? []);
  const costText = profile?.average_cost
    ? `${formatMoney(profile.average_cost, { compact: true })} for two (approx.)`
    : getCostForTwoFromRange(profile?.price_range);
  const reviewsCount = Number(profile.reviews_count) || 0;
  const parsedProfileRating = Number(profile.rating);
  const hasProfileRating =
    reviewsCount > 0 && Number.isFinite(parsedProfileRating) && parsedProfileRating > 0;
  const ratingValue = hasProfileRating ? parsedProfileRating.toFixed(1) : null;

  // Calculate dynamic timing details based on calendar operating dates
  const todayOp = operatingByDate.get(toLocalDateKey(new Date()));

  let todayOpen = "08:00";
  let todayClose = "23:30";
  let isClosedToday = !todayOp || todayOp.is_open === false;

  if (todayOp?.is_open) {
    todayOpen = (todayOp.open_time || "08:00").slice(0, 5);
    todayClose = (todayOp.close_time || "23:30").slice(0, 5);
  }

  // Calculate if currently open
  const now = new Date();
  const formatTime24 = (d: Date) => {
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };
  const currentFormatted = formatTime24(now);

  let isOpenNow = false;
  if (!isClosedToday) {
    if (todayClose > todayOpen) {
      isOpenNow = currentFormatted >= todayOpen && currentFormatted <= todayClose;
    } else {
      // Handles overnight hours, e.g. open at 18:00 and close at 02:00
      isOpenNow = currentFormatted >= todayOpen || currentFormatted <= todayClose;
    }
  }

  const todayOpenFormatted = formatSlotLabel(todayOpen);
  const todayCloseFormatted = formatSlotLabel(todayClose);
  const openStatusLabel = isOpenNow ? "Open now" : "Closed";
  const openStatusDetail = isClosedToday
    ? null
    : isOpenNow
      ? `Closes at ${todayCloseFormatted}`
      : `Opens at ${todayOpenFormatted}`;
  const phoneDisplay = profile.phone?.trim() || "";

  const WEEKDAY_ROWS = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ] as const;
  const todayWeekdayKey = WEEKDAY_ROWS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1].key;
  const hoursByWeekdayKey = (() => {
    const map = new Map<string, { open: string; close: string; closed: boolean }>();
    for (const [dateKey, row] of operatingByDate.entries()) {
      const d = new Date(`${dateKey}T12:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      const weekdayKey = WEEKDAY_ROWS[d.getDay() === 0 ? 6 : d.getDay() - 1].key;
      if (map.has(weekdayKey)) continue;
      map.set(weekdayKey, {
        closed: row.is_open === false,
        open: (row.open_time || "").slice(0, 5),
        close: (row.close_time || "").slice(0, 5),
      });
    }
    return map;
  })();
  const openingHourRows = WEEKDAY_ROWS.map(({ key, label }) => {
    const weekly = profile.operating_hours?.[key];
    const fromCalendar = hoursByWeekdayKey.get(key);
    const dayHours =
      weekly && (weekly.closed || (weekly.open && weekly.close))
        ? {
            closed: !!weekly.closed,
            open: (weekly.open || "").slice(0, 5),
            close: (weekly.close || "").slice(0, 5),
          }
        : fromCalendar;
    let hoursLabel = "Hours not set";
    if (dayHours?.closed) {
      hoursLabel = "Closed";
    } else if (dayHours?.open && dayHours?.close) {
      hoursLabel = `${formatSlotLabel(dayHours.open)} - ${formatSlotLabel(dayHours.close)}`;
    } else if (!isClosedToday && key === todayWeekdayKey) {
      hoursLabel = `${todayOpenFormatted} - ${todayCloseFormatted}`;
    }
    return {
      day: label,
      hours: hoursLabel,
      isToday: key === todayWeekdayKey,
    };
  });
  const cuisines = profile.cuisine || "Continental, Italian, Fast Food";
  const cuisineList = cuisines
    .replace(/·/g, ",")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const aboutDescription =
    profile.description?.trim() ||
    "This venue has not provided a description yet. Enjoy a curated dining experience with premium seats, lovely ambiance, and delicious gourmet specialties.";
  const aboutCostDisplay = profile?.average_cost
    ? `${formatMoney(profile.average_cost, { compact: true })} for two`
    : costText?.replace(/\s*\(approx\.\)\s*$/i, "") || costText;
  const infoCostText = aboutCostDisplay;
  const cuisineDisplay = cuisineList.join(", ");

  // Dynamic city & country parsing helper
  const parseAddressLocation = (address?: string) => {
    const defaultLoc = { city: "Addis Ababa", country: "Ethiopia" };
    if (!address) return defaultLoc;
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      return {
        city: parts[parts.length - 2],
        country: parts[parts.length - 1]
      };
    } else if (parts.length === 2) {
      return {
        city: parts[0],
        country: parts[1]
      };
    }
    return {
      city: address,
      country: "Ethiopia"
    };
  };
  const { city, country } = parseAddressLocation(profile.address);
  const hideBookingSidebar =
    activeTab === "Book a Table" && (drawerStep === 3 || drawerStep === 4);
  const isBookingSuccess = isBookTableFlow && drawerStep === 4;
  const galleryStickyTop =
    isBookTableFlow && isLgViewport
      ? (siteHeaderHeight > 0 ? siteHeaderHeight : 72) + 20
      : (showRestaurantSticky
          ? Math.max(restaurantStickyHeight, 64)
          : siteHeaderHeight > 0
            ? siteHeaderHeight
            : 72) + 12;
  const stickyThumb =
    photos[0] || resolveMediaUrl(profile.cover_image_url) || "";
  const stickyMetaLine = [infoCostText, profile.address?.trim()]
    .filter(Boolean)
    .join(" | ");

  return (
    <div className="min-h-screen bg-white text-slate-700">

      {/* ── 1. Breadcrumbs (keep on success; hide on immersive mobile/tablet book) ── */}
      <div
        className={`bg-white pt-9 ${
          isBookingSuccess
            ? "hidden md:block"
            : isBookTableFlow
              ? "hidden lg:block"
              : "hidden md:block"
        }`}
      >
        <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 text-sm font-semibold text-slate-600 flex items-center gap-1.5  tracking-wider">
          <Link href="/" className="hover:text-rose-600 transition-colors">
            Home
          </Link>
          <ChevronRight size={10} />
          <Link href="/dining" className="hover:text-rose-600 transition-colors">
            Dining
          </Link>
          <ChevronRight size={10} />
          <span className="text-slate-800 truncate max-w-[14rem] sm:max-w-none">{profile.name}</span>
        </div>
      </div>

      <div
        className={`container mx-auto lg:px-10 2xl:px-0 pb-24 md:pb-16 ${
          isBookTableFlow
            ? "max-lg:px-0 max-lg:pt-0 max-lg:pb-0 px-5 sm:px-10 py-5 lg:pt-4"
            : "max-md:px-0 max-md:pt-0 px-5 sm:px-10 py-5"
        }`}
      >
        {/* ── Header: title + icon actions + rating (hidden on booking success) ── */}
        <div
          className={`bg-white pt-2 mb-4 ${
            isBookingSuccess
              ? "hidden"
              : isBookTableFlow
                ? "hidden lg:block"
                : "hidden md:block"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl sm:text-4xl lg:text-[2rem] font-semibold text-slate-900 tracking-wide leading-tight">
                {profile.name}
              </h1>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 self-start">
              <DiningWishlistButton
                businessId={String(profile.id)}
                tone="neutral"
                className="relative w-9 h-9 rounded-full bg-transparent flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-70 shadow-none border-0"
              />
              <button
                type="button"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: profile.name, url: window.location.href });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied to clipboard!");
                  }
                }}
                className="w-9 h-9 rounded-full bg-transparent flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Share"
              >
                <Send size={17} className="text-[#292929]" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied to clipboard!");
                }}
                className="w-9 h-9 rounded-full bg-transparent flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Copy link"
              >
                <Upload size={17} className="text-[#292929]" strokeWidth={2.5} />
              </button>

              {ratingValue ? (
                <div className="flex items-center gap-1.5 pl-2 sm:pl-3">
                  <Star size={18} className="fill-[#F5C518] text-[#F5C518] shrink-0" />
                  <span className="font-bold text-slate-900 text-base sm:text-lg leading-none">
                    {ratingValue}
                  </span>
                  <span className="text-slate-500 text-sm font-medium leading-none">
                    ({reviewsCount})
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center bg-slate-100 text-slate-600 rounded-md px-2.5 py-1 text-[0.75rem] font-bold ml-1">
                  New
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Gallery + sticky table reservation ── */}
        <div
          className={`grid items-start gap-x-5 gap-y-2 sm:gap-x-6 lg:gap-x-7 2xl:gap-x-12 ${
            hideBookingSidebar
              ? ""
              : isBookTableFlow
                ? "lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]"
                : "md:grid-cols-[minmax(0,1fr)_280px] lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]"
          }`}
        >
          <div
            className={`min-w-0 order-1 ${
              isBookingSuccess ? "hidden" : isBookTableFlow ? "max-lg:hidden" : ""
            }`}
          >
            <div ref={titleSentinelRef} className="h-px w-full" aria-hidden />
            {/* Mobile full-bleed hero — taller, edge-to-edge, no top gap */}
            <div className="md:hidden relative w-full h-[62vw] min-h-[280px] max-h-[440px] overflow-hidden bg-[#F3F4F6]">
              {photos[0] ? (
                <button
                  type="button"
                  className="absolute inset-0 w-full h-full cursor-pointer"
                  onClick={() => openLightbox(0)}
                  aria-label="View gallery"
                >
                  <SafeCoverImage
                    src={photos[0]}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                    fallbackClassName="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300"
                    fallback={<DiningImageFallback size={36} />}
                  />
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <Utensils size={40} strokeWidth={1.5} />
                </div>
              )}
              <button
                type="button"
                onClick={() => router.back()}
                className="absolute top-3 left-3 z-20 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center cursor-pointer"
                aria-label="Go back"
              >
                <ChevronLeft size={20} className="text-slate-900" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: profile.name, url: window.location.href });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success("Link copied to clipboard!");
                  }
                }}
                className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center cursor-pointer"
                aria-label="Share"
              >
                <Upload size={16} className="text-slate-900" strokeWidth={2.25} />
              </button>
              {photos.length > 0 ? (
                <button
                  type="button"
                  onClick={() => openLightbox(0)}
                  className="absolute bottom-3 right-3 z-20 bg-black/65 text-white text-xs font-semibold px-2.5 py-1 rounded-md cursor-pointer"
                  aria-label={`View gallery, ${photos.length} photos`}
                >
                  1 / {photos.length}
                </button>
              ) : null}
            </div>

            {/* Tablet/desktop mosaic gallery */}
            <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 h-[260px] md:h-[380px] rounded-2xl overflow-hidden shadow-sm border border-slate-100 mb-0 bg-[#F3F4F6]">
              {photos.length === 0 ? (
                <div className="col-span-4 row-span-2 flex items-center justify-center text-slate-300">
                  <Utensils size={40} strokeWidth={1.5} />
                </div>
              ) : (
              photos.slice(0, 5).map((photoUrl, idx) => {
                const total = Math.min(photos.length, 5);
                const isLastVisible = idx === total - 1;

                let itemClass = "relative overflow-hidden cursor-pointer group";

                if (total === 1) {
                  itemClass += " col-span-4 row-span-2";
                } else if (total === 2) {
                  if (idx === 0) itemClass += " col-span-4 md:col-span-2 row-span-2";
                  else itemClass += " hidden md:block col-span-2 row-span-2";
                } else if (total === 3) {
                  if (idx === 0) itemClass += " col-span-4 md:col-span-2 row-span-2";
                  else itemClass += " hidden md:block col-span-2 row-span-1";
                } else if (total === 4) {
                  if (idx === 0) itemClass += " col-span-4 md:col-span-2 row-span-2";
                  else if (idx === 1) itemClass += " hidden md:block col-span-2 row-span-1";
                  else itemClass += " hidden md:block col-span-1 row-span-1";
                } else {
                  if (idx === 0) itemClass += " col-span-4 md:col-span-2 row-span-2";
                  else itemClass += " hidden md:block col-span-1 row-span-1";
                }

                return (
                  <div
                    key={idx}
                    onClick={() => openLightbox(isLastVisible ? 0 : idx)}
                    className={itemClass}
                  >
                    <SafeCoverImage
                      src={photoUrl}
                      alt={`gallery item ${idx}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      fallbackClassName="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300"
                      fallback={<DiningImageFallback size={28} />}
                    />

                    {idx === 0 && (
                      <div className="absolute bottom-3 right-3 md:hidden bg-black/60 backdrop-blur-[2px] text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 z-10 shadow-md">
                        <ImageIcon size={14} className="text-white" />
                        <span>View Gallery</span>
                        <span className="text-[0.625rem] text-white/70">({photos.length})</span>
                      </div>
                    )}

                    {total === 1 && idx === 0 && (
                      <div className="hidden md:flex absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm text-slate-900 font-semibold px-4 py-2 rounded-xl items-center gap-2 shadow-lg hover:bg-white transition-colors z-20">
                        <ImageIcon size={18} />
                        <span>View Gallery ({photos.length})</span>
                      </div>
                    )}

                    {total > 1 && isLastVisible && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white transition-opacity group-hover:bg-black/75">
                        <ImageIcon size={22} className="mb-1" />
                        <span className="font-bold text-sm tracking-wide">View Gallery</span>
                        <span className="text-[0.625rem] text-white/70">{photos.length > 5 ? '5+' : photos.length} Photos</span>
                      </div>
                    )}
                  </div>
                );
              })
              )}
            </div>

            {/* Status bar under gallery — tablet/desktop row */}
            <div className="relative mt-3 space-y-2 px-0.5 hidden md:block">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm min-w-0 text-slate-600">
                {infoCostText ? (
                  <>
                    <span className="font-medium text-wide text-slate-600">{infoCostText}</span>
                    <span className="text-slate-600 select-none" aria-hidden>
                      |
                    </span>
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={() => setVenueInfoModal("hours")}
                  className="inline-flex items-center gap-1.5 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                  aria-label="Show opening hours"
                >
                  <span
                    className={`font-semibold shrink-0 ${
                      isOpenNow ? "text-emerald-600" : "text-[#C2410C]"
                    }`}
                  >
                    {openStatusLabel}
                  </span>
                  {openStatusDetail ? (
                    <>
                      <span
                        className={`shrink-0 ${isOpenNow ? "text-emerald-600" : "text-[#C2410C]"}`}
                        aria-hidden
                      >
                        •
                      </span>
                      <span className="font-medium  text-wide text-slate-600 truncate">
                        {openStatusDetail}
                      </span>
                    </>
                  ) : null}
                  <ChevronDown
                    size={15}
                    className="text-slate-700 shrink-0"
                    strokeWidth={2.25}
                  />
                </button>

                {phoneDisplay ? (
                  <>
                    <span className="text-slate-600 select-none" aria-hidden>
                      |
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium  text-wide text-slate-600">
                      <Phone size={15} className="text-black shrink-0" strokeWidth={2.25} />
                      {phoneDisplay}
                    </span>
                  </>
                ) : null}
              </div>

              {profile.address?.trim() ? (
                <div className="flex items-start gap-1.5 text-sm  text-wide text-slate-600">
                  <MapPin
                    size={15}
                    className="text-black shrink-0 mt-0.5"
                    strokeWidth={2.25}
                  />
                  <span className="font-medium leading-snug">{profile.address.trim()}</span>
                </div>
              ) : null}
            </div>

            {/* Mobile District-style meta under gallery */}
            <div className="md:hidden mt-4 space-y-3 px-5">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-[1.65rem] font-semibold text-slate-900 tracking-tight leading-tight min-w-0">
                  {profile.name}
                </h1>
                {ratingValue ? (
                  <div className="inline-flex items-center gap-1 shrink-0 rounded-md bg-emerald-600 text-white px-2 py-1 text-sm font-bold">
                    {ratingValue} <Star size={12} className="fill-white text-white" />
                  </div>
                ) : (
                  <div className="inline-flex items-center bg-slate-100 text-slate-600 rounded-md px-2.5 py-1 text-[0.75rem] font-bold shrink-0">
                    New
                  </div>
                )}
              </div>

              {profile.address?.trim() ? (
                <p className="text-sm text-slate-500 leading-snug">{profile.address.trim()}</p>
              ) : null}

              {infoCostText ? (
                <p className="text-sm font-medium text-slate-700">{infoCostText}</p>
              ) : null}

              <button
                type="button"
                onClick={() => setVenueInfoModal("hours")}
                className="inline-flex items-center gap-1.5 cursor-pointer text-sm"
                aria-label="Show opening hours"
              >
                <span className={`font-semibold ${isOpenNow ? "text-emerald-600" : "text-[#C2410C]"}`}>
                  {openStatusLabel}
                </span>
                {openStatusDetail ? (
                  <>
                    <span className={isOpenNow ? "text-emerald-600" : "text-[#C2410C]"} aria-hidden>•</span>
                    <span className="font-medium text-slate-600">{openStatusDetail}</span>
                  </>
                ) : null}
                <ChevronDown size={15} className="text-slate-700" strokeWidth={2.25} />
              </button>

              <div className="flex flex-wrap gap-2.5 pt-1">
                {profile.address?.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      window.open(
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address || "")}`,
                        "_blank",
                        "noopener,noreferrer"
                      );
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 cursor-pointer hover:bg-slate-50"
                  >
                    <Navigation size={15} strokeWidth={2.25} />
                    Directions
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: profile.name, url: window.location.href });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success("Link copied to clipboard!");
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 cursor-pointer hover:bg-slate-50"
                >
                  <Upload size={15} strokeWidth={2.25} />
                  Share
                </button>
                {phoneDisplay ? (
                  <a
                    href={`tel:${phoneDisplay}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <Phone size={15} strokeWidth={2.25} />
                    Call
                  </a>
                ) : null}
              </div>
            </div>

            <div ref={heroEndSentinelRef} className="h-px w-full" aria-hidden />
          </div>

          {!hideBookingSidebar ? (
            <aside
              ref={bookingWidgetRef}
              className={`w-full order-2 md:row-span-2 md:sticky lg:sticky z-30 self-start ${
                isBookTableFlow ? "hidden lg:block lg:mt-3" : "hidden md:block"
              }`}
              style={{ top: galleryStickyTop }}
            >
              {activeTab === "Book a Table" && drawerStep === 1 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                  <GuestTableAnimation count={Number(guests)} />
                </div>
              ) : (
                <div
                  ref={reserveWidgetRef}
                  className="bg-white rounded-2xl border border-slate-200 shadow-[0_8px_30px_rgba(15,23,42,0.06)] overflow-visible p-4 sm:p-5"
                >
                  <h3 className="text-xl sm:text-[1.3rem] font-semibold text-slate-900 tracking-tight leading-tight">
                    Book a table
                  </h3>

                  <div className="mt-4 space-y-3.5">
                    {/* {visibleOffers[0] ? (
                      <div className="rounded-xl border border-[#6900AA]/20 bg-[#f7e9ff] px-3 py-2.5 flex items-start gap-2.5">
                        <PartyPopper size={16} className="text-[#6900AA] shrink-0 mt-0.5" strokeWidth={2.25} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#6900AA] leading-snug">
                            {formatDiningOfferDiscount(visibleOffers[0])}
                            {visibleOffers.length > 1
                              ? ` · +${visibleOffers.length - 1} more offer${visibleOffers.length > 2 ? "s" : ""}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    ) : null} */}

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1.5">
                        Date
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setReserveWidgetDropdown((prev) => (prev === "date" ? null : "date"))
                          }
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-9 py-2.5 text-sm font-semibold text-[#292929] text-left focus:outline-none focus:border-slate-300 cursor-pointer"
                          aria-haspopup="listbox"
                          aria-expanded={reserveWidgetDropdown === "date"}
                        >
                          {(() => {
                            const d = bookingDates[selectedDateIndex];
                            const datePart = d.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            });
                            if (selectedDateIndex === 0) return `Today, ${datePart}`;
                            if (selectedDateIndex === 1) return `Tomorrow, ${datePart}`;
                            return `${d.toLocaleDateString("en-US", { weekday: "short" })}, ${datePart}`;
                          })()}
                        </button>
                        <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#292929] pointer-events-none z-[1]" strokeWidth={2.5} />
                        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#292929] pointer-events-none" strokeWidth={2.5} />

                        {reserveWidgetDropdown === "date" ? (
                          <ul
                            role="listbox"
                            className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-56 overflow-y-auto border border-slate-500 bg-white shadow-md"
                          >
                            {bookingDates.map((d, idx) => {
                              const datePart = d.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              });
                              let label = datePart;
                              if (idx === 0) label = `Today, ${datePart}`;
                              else if (idx === 1) label = `Tomorrow, ${datePart}`;
                              else label = `${d.toLocaleDateString("en-US", { weekday: "short" })}, ${datePart}`;
                              const selected = selectedDateIndex === idx;
                              return (
                                <li key={idx} role="option" aria-selected={selected}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleDateSelect(idx);
                                      setReserveWidgetDropdown(null);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm font-medium cursor-pointer ${
                                      selected
                                        ? "bg-[#2563EB] text-white"
                                        : "bg-white text-[#292929] hover:bg-slate-50"
                                    }`}
                                  >
                                    {label}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-1.5">
                        Guests
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setReserveWidgetDropdown((prev) => (prev === "guests" ? null : "guests"))
                          }
                          className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-9 py-2.5 text-sm font-semibold text-[#292929] text-left focus:outline-none focus:border-slate-300 cursor-pointer"
                          aria-haspopup="listbox"
                          aria-expanded={reserveWidgetDropdown === "guests"}
                        >
                          {Number(guests)} {Number(guests) === 1 ? "Guest" : "Guests"}
                        </button>
                        <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#292929] pointer-events-none z-[1]" strokeWidth={2.5} />
                        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#292929] pointer-events-none" strokeWidth={2.5} />

                        {reserveWidgetDropdown === "guests" ? (
                          <ul
                            role="listbox"
                            className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-56 overflow-y-auto border border-slate-500 bg-white shadow-md"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                              const selected = Number(guests) === num;
                              return (
                                <li key={num} role="option" aria-selected={selected}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setGuests(String(num));
                                      setAvailabilityStatus(null);
                                      setReserveWidgetDropdown(null);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm font-medium cursor-pointer ${
                                      selected
                                        ? "bg-[#2563EB] text-white"
                                        : "bg-white text-[#292929] hover:bg-slate-50"
                                    }`}
                                  >
                                    {num} {num === 1 ? "Guest" : "Guests"}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickBook()}
                      className="w-full rounded-xl bg-[#111111] text-white py-3 px-4 text-sm sm:text-[1rem] font-bold transition-colors cursor-pointer hover:bg-black"
                    >
                      Book a Table
                    </button>
                  </div>
                </div>
              )}
            </aside>
          ) : null}

          <div className="min-w-0 order-3">
            <div
              id="tab-panel-start"
              className={`space-y-4 pt-4 scroll-mt-[7.5rem] md:scroll-mt-[8rem] lg:scroll-mt-[9rem] xl:scroll-mt-[9.25rem] ${
                isBookTableFlow ? "" : "max-md:px-5"
              }`}
            >

            {/* Single-page Overview with scroll-spy sections (District-style) */}
            {activeTab !== "Book a Table" && (
              <div className="space-y-4">

                {/* Overview — Dining Offers + About (Overview tab highlights for both) */}
                <div id="section-overview" className="scroll-mt-[7.5rem] md:scroll-mt-[8rem] lg:scroll-mt-[9rem] xl:scroll-mt-[9.25rem] space-y-4 pb-5">
                  {visibleOffers.length > 0 ? (
                    <section className="bg-white p-0 sm:p-0">
                      <h3 className="text-2xl sm:text-3xl lg:text-xl font-bold text-zinc-800">
                        Dining Offers
                      </h3>
                      {visibleOffers.length > 1 && (
                        <p className="hidden md:block text-base sm:text-lg lg:text-sm text-zinc-500 mt-0.5 mb-3">
                          Tap on any offer to know more
                        </p>
                      )}
                      {visibleOffers.length <= 1 && <div className="hidden md:block mb-3" />}
                      {/* Mobile — same blue dining-offer cards as desktop */}
                      <div className="md:hidden mt-3 space-y-3">
                        {visibleOffers.map((offer, idx) => {
                          const scheduled = getEffectiveDiningOfferStatus(offer) === "SCHEDULED";
                          return (
                            <button
                              key={`m-offer-${offer.id || offer.title}-${idx}`}
                              type="button"
                              onClick={() => handleQuickBook(offer)}
                              className="relative overflow-hidden w-full rounded-xl text-left cursor-pointer min-h-[120px] p-3.5 bg-[#2563eb] text-white shadow-sm"
                            >
                              {scheduled && (
                                <span className="absolute top-3 right-3 text-[0.625rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/20 text-white">
                                  Coming soon
                                </span>
                              )}
                              <p className="text-[0.625rem] font-extrabold uppercase tracking-wider text-white/85">
                                {offer.type || "Offer"}
                              </p>
                              <p className="font-extrabold mt-1.5 leading-snug text-xl text-white">
                                {offer.title}
                              </p>
                              <p className="mt-2 leading-snug font-semibold text-sm text-white/90">
                                {formatDiningOfferDiscount(offer)}
                                {offer.promo_code ? ` · Code ${offer.promo_code}` : ""}
                              </p>
                              <span
                                className="pointer-events-none absolute font-black leading-none select-none -bottom-3 -right-1 text-7xl text-white/15"
                                aria-hidden
                              >
                                %
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {/* Tablet/desktop — existing card grid (unchanged) */}
                      <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-0">
                        {visibleOffers.map((offer, idx) => {
                          const isFeatured = idx === 0;
                          const scheduled = getEffectiveDiningOfferStatus(offer) === "SCHEDULED";
                          return (
                            <button
                              key={`${offer.id || offer.title}-${idx}`}
                              type="button"
                              onClick={() => handleQuickBook(offer)}
                              className={`relative overflow-hidden rounded-xl text-left transition-all cursor-pointer h-full min-h-[120px] p-3.5 sm:p-4 ${
                                isFeatured
                                  ? "bg-[#2563eb] text-white hover:bg-[#1d4ed8] shadow-sm"
                                  : "bg-white text-zinc-900 border border-[#d7e6ff] hover:border-[#93c5fd]"
                              }`}
                            >
                              {scheduled && (
                                <span className="absolute top-3 right-3 text-[0.625rem] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/20 text-white">
                                  Coming soon
                                </span>
                              )}
                              <p
                                className={`text-[1rem] lg:text-[0.625rem] font-extrabold uppercase tracking-wider ${
                                  isFeatured ? "text-white/85" : "text-[#2563eb]"
                                }`}
                              >
                                {offer.type || "Offer"}
                              </p>
                              <p
                                className={`font-extrabold mt-1.5 leading-snug text-xl sm:text-xl lg:text-base ${
                                  isFeatured ? "text-white" : "text-zinc-900"
                                }`}
                              >
                                {offer.title}
                              </p>
                              <p
                                className={`mt-2 leading-snug font-semibold text-[1rem] lg:text-xs ${
                                  isFeatured ? "text-white/90" : "text-[#2563eb]"
                                }`}
                              >
                                {formatDiningOfferDiscount(offer)}
                                {offer.promo_code ? ` · Code ${offer.promo_code}` : ""}
                              </p>
                              <span
                                className={`pointer-events-none absolute font-black leading-none select-none -bottom-3 -right-1 text-7xl ${
                                  isFeatured ? "text-white/15" : "text-[#2563eb]/10"
                                }`}
                                aria-hidden
                              >
                                %
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {/* About Venue — Cost + Cuisines */}
                  <section className="bg-white p-0 sm:py-7">
                    <h3 className="text-2xl sm:text-3xl lg:text-xl font-bold text-zinc-800 mb-2">
                      About the restaurant
                    </h3>
                    <div className="min-w-0">
                      <p
                        ref={aboutDescRef}
                        className="text-slate-500 text-base sm:text-lg lg:text-sm leading-relaxed whitespace-pre-wrap line-clamp-2"
                      >
                        {aboutDescription}
                      </p>
                      {aboutDescOverflows ? (
                        <button
                          type="button"
                          onClick={() => setVenueInfoModal("about")}
                          className="mt-1.5 inline-flex items-center text-sm font-bold text-[#111111] cursor-pointer hover:underline"
                        >
                          See more
                        </button>
                      ) : null}
                    </div>

                    {aboutCostDisplay ? (
                      <div className="mt-5">
                        <h4 className="text-base sm:text-lg lg:text-base font-bold text-zinc-800">Cost</h4>
                        <p className="mt-1 text-base sm:text-lg lg:text-sm text-slate-500">{aboutCostDisplay}</p>
                      </div>
                    ) : null}

                    {cuisineDisplay ? (
                      <div className="mt-5">
                        <h4 className="text-base sm:text-lg lg:text-base font-bold text-zinc-800">Cuisines</h4>
                        <p className="mt-1 text-base sm:text-lg lg:text-sm text-slate-500">{cuisineDisplay}</p>
                      </div>
                    ) : null}

                    {profile.amenities && profile.amenities.length > 0 && (
                      <>
                        <h4 className="text-lg sm:text-xl lg:text-base font-bold text-zinc-800 mt-5 mb-3">
                          Available Facilities
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 space-y-2 ">
                          {profile.amenities.map((info: string) => (
                            <div
                              key={info}
                              className="flex items-center gap-2 text-base sm:text-lg lg:text-sm text-slate-600"
                            >
                              <FacilityDiamondIcon className="text-[#292929] shrink-0" />
                              <span>{info}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </section>
                </div>

                {/* Menu — stack preview → lightbox */}
                <section
                  id="section-menu"
                  className="bg-white p-0 sm:p-0 scroll-mt-[7.5rem] md:scroll-mt-[8rem] lg:scroll-mt-[9rem] xl:scroll-mt-[9.25rem] py-7"
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="text-2xl sm:text-3xl lg:text-xl font-bold text-zinc-800">Menu</h3>
                    {venueMenuImages.length > 0 && (
                      <button
                        type="button"
                        onClick={() => openLightbox(0, venueMenuImages)}
                        className="inline-flex items-center gap-0.5 text-sm font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        See all menus <ChevronRight size={16} />
                      </button>
                    )}
                  </div>

                  {venueMenuImages.length > 0 ? (
                    <VenueMenuGallery
                      urls={venueMenuImages}
                      onOpen={(index, items) => openLightbox(index, items)}
                    />
                  ) : (
                    <MediaEmptyState
                      icon={BookOpen}
                      message="No menu available at the moment."
                    />
                  )}
                </section>

                {/* Photos Gallery — max 3; 3rd gets “View all photos” overlay when more exist */}
                <section
                  id="section-photos"
                  className="bg-white  scroll-mt-[7.5rem] md:scroll-mt-[8rem] lg:scroll-mt-[9rem] xl:scroll-mt-[9.25rem] py-7"
                >
                  <h3 className="text-xl sm:text-2xl lg:text-lg font-bold text-slate-800 mb-3">Photos Gallery</h3>
                  <VenuePhotosGallery
                    urls={venueGalleryPhotos}
                    onOpen={(index, items) => openLightbox(index, items)}
                  />
              </section>

                {/* Reviews — same UI as before, shown in Overview scroll */}
                <div
                  id="section-reviews"
                  className="space-y-4 scroll-mt-[7.5rem] md:scroll-mt-[8rem] lg:scroll-mt-[9rem] xl:scroll-mt-[9.25rem] py-7"
                >
                {/* Write Review Form — gated like movies: login + booking + visit ended */}
                <section className="bg-white  py-7">
                  <h3 className="text-lg sm:text-xl lg:text-base font-bold text-slate-800 mb-3">Write a Review</h3>
                  {!isCustomerLoggedIn ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-slate-600">
                        Log in to rate this place after your visit on BookMyBota.
                      </p>
                      <button
                        type="button"
                        onClick={() => setAuthModalOpen(true)}
                        className="rounded-xl px-4 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer"
                      >
                        Log in to review
                      </button>
                    </div>
                  ) : reviewEligibility?.already_reviewed ? (
                    <p className="text-sm text-slate-600">
                      Thanks — you have already reviewed this place.
                    </p>
                  ) : !reviewEligibility?.has_booking ? (
                    <p className="text-sm text-slate-600">
                      Book a table here on BookMyBota to leave a review.
                    </p>
                  ) : !reviewEligibility?.visit_ended ? (
                    <p className="text-sm text-slate-600">
                      You can review this place after your visit ends.
                    </p>
                  ) : canWriteReview ? (
                  <form onSubmit={handleReviewSubmit(onAddReview)} className="space-y-4" noValidate>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-base sm:text-lg lg:text-sm font-medium text-slate-400 mb-1">
                          Your Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          {...registerReview("user_name")}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm sm:text-base lg:text-xs focus:outline-none focus:border-rose-500"
                          placeholder="E.g., Priya R."
                        />
                        {reviewErrors.user_name && (
                          <p className="mt-1.5 text-xs font-medium text-rose-500">{reviewErrors.user_name.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-base lg:text-xs font-medium text-slate-400 mb-2">
                          Rating <span className="text-rose-500">*</span>
                        </label>
                        <div className="h-9 flex items-center">
                          <Controller
                            name="rating"
                            control={reviewControl}
                            render={({ field }) => (
                              <StarRatingInput value={field.value} onChange={field.onChange} />
                            )}
                          />
                        </div>
                        {reviewErrors.rating && (
                          <p className="mt-1.5 text-xs font-medium text-rose-500">{reviewErrors.rating.message}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-base lg:text-xs font-medium text-slate-400 mb-1">
                        Comment <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={3}
                        {...registerReview("text")}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm lg:text-xs focus:outline-none focus:border-rose-500"
                        placeholder="Write details about food, staff, service..."
                      />
                      {reviewErrors.text && (
                        <p className="mt-1.5 text-xs font-medium text-rose-500">{reviewErrors.text.message}</p>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-4 py-2 text-base lg:text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                    >
                      {submittingReview && <Loader2 size={14} className="animate-spin" />}
                      Submit Review
                    </button>
                  </form>
                  ) : null}
                </section>

                {/* Review Feed */}
                <section className="bg-white p-0 sm:p-0 space-y-4 divide-y divide-slate-100">
                  <h3 className="text-lg sm:text-xl lg:text-base font-bold text-slate-800 mb-2">User Reviews</h3>
                  {reviews.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No reviews yet. Be the first to leave one after your visit!</p>}
                  {reviews.map((rev: any, idx: number) => (
                    <div key={rev.id} className={`${idx > 0 ? "pt-4" : ""} flex gap-3`}>
                      <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-200">
                        {(rev.user_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-baselg:text-xs font-bold text-slate-800">{rev.user_name}</p>
                          <p className="text-[1rem] sm:text-[0.625rem] text-slate-400 font-medium">
                            {formatDateCustomer(rev.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="flex items-center gap-0.5 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-md text-sm sm:text-base lg:text-[0.625rem] text-emerald-600 font-bold">
                            <span>{rev.rating}</span>
                            <Star size={8} className="fill-emerald-600" />
                          </div>
                          {rev.booked_on_platform ? (
                            <span className="text-[0.625rem] sm:text-xs text-slate-400 font-medium">
                              Booked on BookMyBota
                            </span>
                          ) : null}
                        </div>
                        <p className="text-base lg:text-xs text-slate-600 mt-2 leading-relaxed">
                          {rev.text}
                        </p>

                        {rev.replies && rev.replies.length > 0 && (
                          <div className="mt-3 space-y-2 pl-4 border-l-2 border-slate-100">
                            {rev.replies.map((reply: any) => (
                              <div key={reply.id} className={`p-3 rounded-xl text-base lg:text-xs ${reply.user_type === 'owner' ? 'bg-rose-50 border border-rose-100' : 'bg-slate-50 border border-slate-100'}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`font-bold ${reply.user_type === 'owner' ? 'text-rose-700' : 'text-slate-700'}`}>
                                    {reply.user_name} {reply.user_type === 'owner' && <span className="ml-1 text-[1rem] lg:text-[0.5625rem] bg-rose-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">Owner</span>}
                                  </span>
                                  <span className="text-[1rem] lg:text-[0.625rem] text-slate-400">
                                    {new Date(reply.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                                <p className={reply.user_type === 'owner' ? 'text-rose-900/80' : 'text-slate-600'}>
                                  {reply.text}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </section>
                </div>
              </div>
            )}

                  {/* Book a Table Tab Content — booking flow portals into this slot */}
                  {activeTab === "Book a Table" && (
                    <div
                      ref={setBookTableSlot}
                      className="bg-white min-h-[360px]"
                    />
                  )}
            </div>
          </div>
        </div>

          {/* Similar Restaurants Horizontal Shelf */}
          {similarRestaurants.length > 0 && (
            <div className={`mt-8 pt-6 border-t border-slate-200 animate-fadeIn ${isBookTableFlow ? "hidden" : ""}`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl sm:text-3xl lg:text-xl font-extrabold text-slate-800 tracking-tight">
                    {(() => {
                      const rawType = profile?.type_name || "Restaurant";
                      const plural = rawType.toLowerCase().endsWith('s') ? rawType : `${rawType}s`;
                      return `Similar ${plural}`;
                    })()}
                  </h3>
                  <p className="text-slate-500 text-sm sm:text-base lg:text-xs mt-1 font-semibold">
                    Handpicked recommendations you might also like
                  </p>
                </div>
                
                {/* Prev / Next navigation arrow buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => scrollSimilar('left')}
                    className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => scrollSimilar('right')}
                    className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    aria-label="Scroll right"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              <div 
                ref={similarScrollerRef}
                className="flex gap-6 overflow-x-auto pb-6 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide snap-x scroll-smooth"
              >
                {similarRestaurants.map((restaurant) => {
                  const reviewsCount = Number(restaurant.reviews_count) || 0;
                  const parsedRating = Number(restaurant.rating);
                  const hasRating =
                    reviewsCount > 0 && Number.isFinite(parsedRating) && parsedRating > 0;
                  const rating = hasRating ? parsedRating.toFixed(1) : null;
                  const cuisine = restaurant.cuisine || "Italian, Chinese, Continental";
                  const coverImg = resolveMediaUrl(restaurant.cover_image_url) || "";
                  const locality = restaurant.address ? restaurant.address.split(",")[0].trim() : "";
                  const priceForTwo = restaurant.average_cost
                    ? `${formatMoney(restaurant.average_cost, { compact: true })} for two`
                    : `${formatMoney(1200, { compact: true })} for two`;

                  return (
                    <Link
                      key={restaurant.id}
                      href={restaurantHref(restaurant)}
                      className="group block bg-white hover:shadow-lg rounded-2xl p-3 border border-slate-100 hover:border-slate-200 transition-all duration-300 w-[280px] shrink-0 snap-start"
                    >
                      <div className="relative mb-3">
                        <div className="relative h-44 rounded-xl overflow-hidden bg-[#F3F4F6]">
                          <SafeCoverImage
                            src={coverImg}
                            alt={restaurant.name}
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                            fallbackClassName="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-slate-300"
                            fallback={<DiningImageFallback size={28} />}
                          />
                          {coverImg ? (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                          ) : null}
                        </div>
                        <DiningWishlistButton
                          businessId={restaurant.id}
                          className="absolute top-3 right-3 z-[3] w-9 h-9 rounded-full bg-white border border-[#6900AA]/30 shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-70"
                        />
                      </div>

                      <div className="px-1 pb-1">
                        <h4 className="font-extrabold text-slate-800 text-base leading-tight truncate group-hover:text-rose-600 transition-colors">
                          {restaurant.name}
                        </h4>

                        <div className="flex items-center gap-1.5 mt-1.5">
                          {rating ? (
                            <span className="bg-emerald-700 text-white text-[0.625rem] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <span>{rating}</span>
                              <span className="text-[0.5rem]">★</span>
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 text-[0.625rem] font-black px-1.5 py-0.5 rounded">
                              New
                            </span>
                          )}
                          <span className="text-[0.5625rem] text-slate-400 font-bold tracking-wider uppercase">DINING</span>
                        </div>

                        <div className="flex justify-between items-center gap-2 mt-2.5 text-xs text-slate-500 font-medium">
                          <span className="truncate flex-1">{cuisine}</span>
                          <span className="shrink-0 text-slate-700 font-semibold">{priceForTwo}</span>
                        </div>

                        <div className="text-xs text-slate-400 mt-1 font-medium">
                          {locality}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── 7. Lightbox / Image Slider Modal ── */}
        {isLightboxOpen && lightboxItems.length > 0 && (
          <div className="fixed inset-0 z-[110] bg-black flex flex-col select-none animate-fadeIn">
            {/* Close — top right on all breakpoints (menu / gallery) */}
            <button
              type="button"
              onClick={closeLightbox}
              className="absolute top-3 right-3 sm:top-5 sm:right-5 z-20 w-10 h-10 rounded-full bg-white/15 border border-white/25 flex items-center justify-center cursor-pointer hover:bg-white/25 active:scale-95"
              aria-label="Close gallery"
            >
              <X size={22} className="text-white" strokeWidth={2.25} />
            </button>

            {/* Image stage */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-0 px-0 sm:px-10 relative">
              {lightboxItems.length > 1 ? (
                <button
                  type="button"
                  onClick={prevPhoto}
                  className="hidden sm:flex absolute left-4 z-10 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full cursor-pointer"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={22} />
                </button>
              ) : null}

              <div className="w-full flex-1 flex items-center justify-center overflow-hidden">
                <img
                  key={lightboxItems[currentPhotoIdx] + "-" + currentPhotoIdx}
                  src={lightboxItems[currentPhotoIdx]}
                  alt={`Gallery image ${currentPhotoIdx + 1}`}
                  className="max-h-[78vh] w-full sm:w-auto sm:max-w-[min(920px,90vw)] object-contain select-none animate-diningLightboxSlideUp"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (lightboxItems.length > 1) nextPhoto();
                  }}
                />
              </div>

              {lightboxItems.length > 1 ? (
                <button
                  type="button"
                  onClick={nextPhoto}
                  className="hidden sm:flex absolute right-4 z-10 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full cursor-pointer"
                  aria-label="Next image"
                >
                  <ChevronRight size={22} />
                </button>
              ) : null}

              <p className="shrink-0 text-white text-sm font-semibold tracking-wide py-4">
                {currentPhotoIdx + 1} / {lightboxItems.length}
              </p>
            </div>

            {/* Thumbnails — tablet/desktop only */}
            {lightboxItems.length > 1 && (
              <div className="hidden md:flex max-w-4xl mx-auto w-full overflow-x-auto py-3 justify-center gap-2.5 px-4 scrollbar-hide">
                {lightboxItems.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentPhotoIdx(idx)}
                    className={`w-16 h-12 rounded-lg overflow-hidden shrink-0 transition-all border-2 cursor-pointer ${
                      currentPhotoIdx === idx
                        ? "border-white scale-105 opacity-100"
                        : "border-transparent opacity-50 hover:opacity-80"
                    }`}
                  >
                    <img src={url} alt={`thumb ${idx}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 8. Book a Table flow (inline in Book a Table tab via portal) ── */}
        {activeTab === "Book a Table" && bookTableSlot && createPortal(
          <div className="w-full bg-white flex flex-col pb-12 sm:pb-16">

            {/* Immersive book header (mobile + tablet; hidden on success) */}
            {!isBookingSuccess ? (
            <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-100 px-4 sm:px-5 py-3 flex items-start gap-2.5">
              <button
                type="button"
                onClick={closeBookingPanel}
                className="mt-0.5 w-9 h-9 -ml-1 rounded-full flex items-center justify-center cursor-pointer hover:bg-slate-50 shrink-0"
                aria-label="Back to restaurant"
              >
                <ChevronLeft size={22} className="text-slate-900" strokeWidth={2.25} />
              </button>
              <div className="min-w-0 pt-0.5">
                <h4 className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
                  Book a table
                </h4>
                <p className="text-sm text-slate-500 font-medium truncate mt-0.5">{profile.name}</p>
              </div>
            </div>
            ) : null}

            {/* Desktop booking steps: Overview / Menu / Photos / Reviews / Book a Table */}
            {showDesktopBookTabsInline ? (
              <div className="hidden lg:block border-b border-slate-200 mb-4">
                <div className="flex gap-6 overflow-x-auto scrollbar-hide">
                  {DETAIL_SECTION_TABS.map((tab) => (
                    <button
                      key={`book-flow-tab-${tab.id}`}
                      type="button"
                      onClick={() => scrollToDetailSection(tab.sectionId, tab.id)}
                      className="py-2.5 text-sm font-semibold tracking-wide border-b-2 border-transparent text-slate-400 hover:text-slate-900 transition-all whitespace-nowrap cursor-pointer"
                    >
                      {tab.id}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="py-2.5 text-sm font-bold tracking-wide border-b-2 border-slate-900 text-slate-900 whitespace-nowrap cursor-default"
                    aria-current="page"
                  >
                    Book a Table
                  </button>
                </div>
              </div>
            ) : null}

            {/* Panel Content */}
            <div className={`${drawerStep === 4 ? '' : drawerStep === 3 ? 'p-4 sm:p-6 bg-white lg:pt-0' : drawerStep === 1 ? 'pt-1 pb-2 bg-white px-4 sm:px-5 lg:px-0' : 'p-5 bg-white'}`}>
              {drawerStep === 1 && (() => {
                const mealsConfig: DiningMealsConfig = selectedOpDay?.meals || {
                  breakfast: { open: '08:00', close: '11:00', active: true },
                  lunch: { open: '11:30', close: '16:00', active: true },
                  dinner: { open: '17:00', close: '23:00', active: true }
                };

                const dayOpenHm = (selectedOpDay?.open_time || '00:00').slice(0, 5);
                const dayCloseHm = (selectedOpDay?.close_time || '23:59').slice(0, 5);
                const clipMeal = (open: string, close: string) => {
                  if (!dayCloseHm || dayCloseHm <= dayOpenHm) return { open, close };
                  const toM = (t: string) => {
                    const [h, m] = t.split(':').map(Number);
                    return h * 60 + m;
                  };
                  const fromM = (n: number) =>
                    `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
                  const lo = toM(dayOpenHm);
                  const hi = toM(dayCloseHm);
                  const a = Math.max(lo, toM(open));
                  const b = Math.min(hi, toM(close));
                  if (a >= b) return null;
                  return { open: fromM(a), close: fromM(b) };
                };

                const isToday = selectedDateIndex === 0;
                const dayClosed = isSelectedDayClosed;
                const breakfastWindow = mealsConfig.breakfast?.active
                  ? clipMeal(mealsConfig.breakfast.open, mealsConfig.breakfast.close)
                  : null;
                const lunchWindow = mealsConfig.lunch?.active
                  ? clipMeal(mealsConfig.lunch.open, mealsConfig.lunch.close)
                  : null;
                const dinnerWindow = mealsConfig.dinner?.active
                  ? clipMeal(mealsConfig.dinner.open, mealsConfig.dinner.close)
                  : null;
                const breakfastSlots =
                  !dayClosed && breakfastWindow
                  ? generateSlotsForMeal(breakfastWindow.open, breakfastWindow.close, isToday)
                  : [];
                const lunchSlots =
                  !dayClosed && lunchWindow
                  ? generateSlotsForMeal(lunchWindow.open, lunchWindow.close, isToday)
                  : [];
                const dinnerSlots =
                  !dayClosed && dinnerWindow
                  ? generateSlotsForMeal(dinnerWindow.open, dinnerWindow.close, isToday)
                  : [];

                const mealOptions = (
                  [
                    { id: 'breakfast' as const, label: 'Breakfast', slots: breakfastSlots, active: !!mealsConfig.breakfast?.active && (!isToday || breakfastSlots.length > 0) },
                    { id: 'lunch' as const, label: 'Lunch', slots: lunchSlots, active: !!mealsConfig.lunch?.active && (!isToday || lunchSlots.length > 0) },
                    { id: 'dinner' as const, label: 'Dinner', slots: dinnerSlots, active: !!mealsConfig.dinner?.active && (!isToday || dinnerSlots.length > 0) },
                  ]
                ).filter((m) => m.active);

                const mealIcon = (id: 'breakfast' | 'lunch' | 'dinner') => {
                  if (id === 'breakfast') return <Sunrise size={18} className="text-amber-500 shrink-0" />;
                  if (id === 'lunch') return <Sun size={18} className="text-amber-500 shrink-0" />;
                  return <Moon size={18} className="text-slate-500 shrink-0" />;
                };

                const mealRangeLabel = (id: 'breakfast' | 'lunch' | 'dinner') => {
                  const cfg = mealsConfig[id];
                  if (!cfg?.open || !cfg?.close) return '';
                  return `${formatSlotLabel(cfg.open)} to ${formatSlotLabel(cfg.close)}`;
                };

                // Keep accordion open on a valid meal; null means all collapsed
                const openMealId =
                  activeMealSection === null
                    ? null
                    : mealOptions.find((m) => m.id === activeMealSection)?.id ||
                      mealOptions[0]?.id ||
                      null;

                return (
                  <div className="space-y-5">
                    {/* Desktop book intro (mobile/tablet use immersive header above) */}
                    <h4 className="hidden lg:block text-xl font-semibold text-slate-900 tracking-tight">
                      Select your booking details
                    </h4>

                    <div className="space-y-5 bg-white rounded-none border-0 px-0 md:rounded-xl md:border md:border-slate-200 md:p-5 p-0">
                    {/* Guests — dropdown on mobile, chips on tablet/desktop */}
                    <div>
                      <p className="md:hidden text-sm text-slate-500 mb-2">Select number of guests</p>
                      <p className="hidden md:block text-sm font-semibold text-slate-800 mb-3">Number of guest(s)</p>

                      <div className="md:hidden relative">
                        <button
                          type="button"
                          onClick={() =>
                            setReserveWidgetDropdown((prev) => (prev === "guests" ? null : "guests"))
                          }
                          className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-3 text-sm font-semibold text-[#292929] text-left cursor-pointer"
                          aria-haspopup="listbox"
                          aria-expanded={reserveWidgetDropdown === "guests"}
                        >
                          {Number(guests)} {Number(guests) === 1 ? "guest" : "guests"}
                        </button>
                        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                        {reserveWidgetDropdown === "guests" ? (
                          <ul
                            role="listbox"
                            className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-56 overflow-y-auto border border-slate-300 bg-white shadow-md rounded-xl"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                              const selected = Number(guests) === num;
                              return (
                                <li key={num} role="option" aria-selected={selected}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setGuests(String(num));
                                      setAvailabilityStatus(null);
                                      setReserveWidgetDropdown(null);
                                    }}
                                    className={`w-full text-left px-4 py-2.5 text-sm font-medium cursor-pointer ${
                                      selected ? "bg-slate-900 text-white" : "bg-white text-slate-800 hover:bg-slate-50"
                                    }`}
                                  >
                                    {num} {num === 1 ? "guest" : "guests"}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </div>

                      <div className="hidden md:flex flex-wrap gap-2.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                              const selected = Number(guests) === num;
                          return (
                            <button
                              key={num}
                              type="button"
                                  onClick={() => {
                                    setGuests(num.toString());
                                    setAvailabilityStatus(null);
                                  }}
                              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl text-sm font-semibold transition-all cursor-pointer flex items-center justify-center ${
                                    selected
                                  ? 'border border-[#6900AA] text-[#6900AA] bg-[#f7e9ff]'
                                  : 'border border-slate-200 text-slate-700 bg-white hover:border-slate-300'
                                  }`}
                                >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dates */}
                    <div>
                      <p className="md:hidden text-base font-bold text-slate-900 mb-3">Select day and time</p>
                      <p className="hidden md:block text-sm font-semibold text-slate-800 mb-3">When are you visiting?</p>
                      <div className="flex gap-0 md:gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin items-stretch">
                        <div className="md:hidden shrink-0 flex items-center pr-2 mr-1 border-r border-slate-200">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 [writing-mode:vertical-rl] rotate-180">
                            {bookingDates[selectedDateIndex]?.toLocaleDateString("en-US", { month: "short" })}
                          </span>
                        </div>
                        {bookingDates.map((d, idx) => {
                          const labels = formatDateLabel(d, idx);
                          const selected = selectedDateIndex === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleDateSelect(idx)}
                              className={`min-w-[64px] sm:min-w-[72px] md:min-w-[78px] shrink-0 rounded-xl px-2.5 py-2.5 text-center transition-all cursor-pointer ${
                                    selected
                                  ? 'md:border md:border-[#6900AA] md:bg-[#f7e9ff] bg-slate-900 text-white border-transparent'
                                  : 'md:border md:border-slate-200 md:bg-white md:hover:border-slate-300 border-transparent bg-transparent'
                              }`}
                            >
                              <p className={`text-sm font-semibold leading-tight ${selected ? 'md:text-[#6900AA] text-white' : 'text-slate-700'}`}>
                                {labels.top}
                              </p>
                              <p className={`text-[0.8rem] font-medium mt-0.5 leading-tight ${selected ? 'md:text-[#6900AA] text-white/80' : 'text-slate-500'}`}>
                                {labels.bottom}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Meal period accordions + time slots */}
                    <div className="space-y-3 pt-1">
                      <p className="hidden md:block text-sm font-semibold text-slate-800">
                        Select the time of day to see the offers
                      </p>

                      {/* Mobile meal chips */}
                      {!isSelectedDayClosed && mealOptions.length > 0 ? (
                        <div className="md:hidden flex flex-wrap gap-2 mb-1">
                          {mealOptions.map((meal) => {
                            const selected = openMealId === meal.id;
                            return (
                              <button
                                key={`chip-${meal.id}`}
                                type="button"
                                onClick={() => {
                                  setActiveMealSection(meal.id);
                                  setSelectedTime('');
                                  setAvailabilityStatus(null);
                                }}
                                className={`rounded-full px-4 py-2 text-sm font-semibold border cursor-pointer ${
                                  selected
                                    ? "bg-slate-100 border-slate-300 text-slate-900"
                                    : "bg-white border-slate-200 text-slate-700"
                                }`}
                              >
                                {meal.label}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}

                      {isSelectedDayClosed ? (
                        <div className="text-center py-8 bg-white border border-slate-200 rounded-2xl">
                          <p className="text-xs text-rose-500 font-bold">Closed on this day</p>
                          <p className="text-[0.625rem] text-slate-400 mt-0.5">Please select another date above.</p>
                        </div>
                      ) : mealOptions.length === 0 ? (
                        <div className="text-center py-8 bg-white border border-slate-200 rounded-2xl">
                          <p className="text-xs text-slate-400 font-medium">No slots available for this selection.</p>
                          <p className="text-[0.625rem] text-slate-400 mt-0.5">Try another date or meal time.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Mobile: show slots for active meal only as flat grid */}
                          {openMealId ? (
                            <div className="md:hidden">
                              {(() => {
                                const meal = mealOptions.find((m) => m.id === openMealId);
                                if (!meal) return null;
                                if (meal.slots.length === 0) {
                                  return (
                                    <p className="text-xs text-slate-400 font-medium py-3 text-center">
                                      No slots available in this period.
                                    </p>
                                  );
                                }
                                return (
                                  <div className="grid grid-cols-2 gap-2.5">
                                    {meal.slots.map((slot) => {
                                      const isSelected = selectedTime === slot;
                                      const promoText = offerChipLabel;
                                      return (
                                        <button
                                          key={slot}
                                          type="button"
                                          onClick={() => {
                                            setActiveMealSection(meal.id);
                                            handleTimeSelect(slot);
                                          }}
                                          className={`min-h-[56px] px-2 py-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                                            isSelected
                                              ? "border-slate-900 bg-slate-900 text-white"
                                              : "border-slate-200 bg-white text-slate-800"
                                          }`}
                                        >
                                          <span className="text-sm font-bold leading-none">
                                            {formatSlotLabel(slot)}
                                          </span>
                                          {promoText ? (
                                            <span className={`text-[0.65rem] font-bold mt-1.5 leading-none ${isSelected ? "text-white/80" : "text-[#6900AA]"}`}>
                                              {promoText}
                                            </span>
                                          ) : null}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          ) : null}

                          <div className="hidden md:block space-y-3">
                          {mealOptions.map((meal) => {
                            const isOpen = openMealId === meal.id;
                            const cfg = mealsConfig[meal.id];
                            return (
                              <div
                                key={meal.id}
                                className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isOpen) {
                                      setActiveMealSection(null);
                                    } else {
                                      setActiveMealSection(meal.id);
                                      setSelectedTime('');
                                      setAvailabilityStatus(null);
                                    }
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer hover:bg-slate-50/80 transition-colors"
                                >
                                  {mealIcon(meal.id)}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800">{meal.label}</p>
                                    {cfg?.open && cfg?.close && (
                                      <p className="text-xs text-slate-500 mt-0.5">
                                        {mealRangeLabel(meal.id)}
                                      </p>
                                    )}
                                  </div>
                                  <ChevronDown
                                    size={18}
                                    className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                  />
                                </button>

                                {isOpen && (
                                  <div className="px-4 pb-4">
                                    {meal.slots.length === 0 ? (
                                      <p className="text-xs text-slate-400 font-medium py-3 text-center">
                                        No slots available in this period.
                                      </p>
                                    ) : (
                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                        {meal.slots.map((slot) => {
                                    const isSelected = selectedTime === slot;
                            const promoText = offerChipLabel;
                                    return (
                                      <button
                                        key={slot}
                                        type="button"
                                              onClick={() => {
                                                setActiveMealSection(meal.id);
                                                handleTimeSelect(slot);
                                              }}
                                              className={`min-h-[52px] px-2 py-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                                  isSelected
                                                  ? 'border border-[#6900AA] bg-[#f7e9ff] text-slate-900'
                                                  : 'border border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                                }`}
                              >
                                <span className="text-sm font-semibold leading-none">
                                  {formatSlotLabel(slot)}
                                </span>
                                {promoText ? (
                                                <span className="text-[0.625rem] font-bold text-[#2563EB] mt-1.5 leading-none">
                                    {promoText}
                                  </span>
                                ) : null}
                                      </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                                    );
                                  })}
                          </div>
                                </div>
                              )}
                            </div>

                    {/* Choose an offer — restaurant partner offers only (platform on Special Offers / checkout) */}
                    {hasAnyBookableOffer && (
                      <div className="space-y-3 pt-2">
                              <button
                                type="button"
                          onClick={() => setOffersSectionOpen((v) => !v)}
                          className="w-full flex items-center gap-3 cursor-pointer"
                        >
                          <h4 className="text-base font-semibold text-slate-900 shrink-0">
                            Choose an offer
                          </h4>
                          <div className="h-px flex-1 bg-slate-200" />
                          <ChevronDown
                            size={16}
                            className={`text-slate-400 shrink-0 transition-transform ${offersSectionOpen ? "rotate-180" : ""}`}
                          />
                              </button>

                        {offersSectionOpen && (
                          <div className="flex flex-wrap gap-3 pt-3 pl-2">
                            {bookableOffers.map((offer, idx) => {
                              const isActive =
                                !noOfferSelected &&
                                ((selectedOffer?.id && selectedOffer.id === offer.id) ||
                                  (selectedOffer?.title === offer.title && selectedOffer?.promo_code === offer.promo_code));
                              const badgeColors = [
                                "#2563EB",
                                "#6900AA",
                                "#059669",
                                "#D97706",
                              ];
                              const badgeBg = badgeColors[idx % badgeColors.length];
                                    return (
                                      <button
                                  key={`${offer.id || offer.title}-${idx}`}
                                        type="button"
                                  onClick={() => {
                                    setSelectedOffer(offer);
                                    setNoOfferSelected(false);
                                  }}
                                  className={`relative w-[220px] sm:w-[240px] text-left rounded-xl border bg-white px-4 py-3.5 pt-4 transition-all cursor-pointer overflow-visible ${
                                    isActive
                                      ? "border-[#6900AA] shadow-sm"
                                      : "border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  <span
                                    className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                                    style={{ backgroundColor: badgeBg }}
                                  >
                                    %
                                  </span>
                                  <span
                                    className={`absolute top-3 right-3 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                      isActive ? "border-[#6900AA]" : "border-slate-300"
                                    }`}
                                  >
                                    {isActive && (
                                      <span className="w-2 h-2 rounded-full bg-[#6900AA]" />
                                    )}
                                  </span>
                                  <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-slate-400 pl-8 pr-5">
                                    {(offer.type || "Offer").toString()}
                                  </p>
                                  <p className="text-base font-bold text-slate-900 mt-0.5 pl-8 pr-5 leading-snug">
                                    {offer.title}
                                  </p>
                                  <p className="text-xs font-medium text-[#2563EB] mt-1 pl-8 pr-5">
                                    {formatDiningOfferDiscount(offer)}
                                    {offer.promo_code ? ` · ${offer.promo_code}` : ""}
                                  </p>
                                      </button>
                                    );
                                  })}

                              <button
                                type="button"
                              onClick={() => {
                                setSelectedOffer(null);
                                setNoOfferSelected(true);
                              }}
                              className={`relative w-[220px] sm:w-[240px] text-left rounded-xl border bg-white px-4 py-3.5 pt-4 transition-all cursor-pointer overflow-visible ${
                                noOfferSelected
                                  ? "border-[#6900AA] shadow-sm"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <span className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-[#6900AA] flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                ✓
                              </span>
                              <span
                                className={`absolute top-3 right-3 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  noOfferSelected ? "border-[#6900AA]" : "border-slate-300"
                                }`}
                              >
                                {noOfferSelected && (
                                  <span className="w-2 h-2 rounded-full bg-[#6900AA]" />
                                )}
                              </span>
                              <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-slate-400 pl-8 pr-5">
                                No offer
                              </p>
                              <p className="text-base font-bold text-slate-900 mt-0.5 pl-8 pr-5 leading-snug">
                                Regular table reservation
                              </p>
                              <p className="text-xs font-medium text-[#2563EB] mt-1 pl-8 pr-5">
                                Book without applying a dining offer
                              </p>
                                      </button>
                                </div>
                              )}
                            </div>
                      )}
                  </div>
                  </div>
                );
              })()}

              {drawerStep === 2 && (
                <div className="space-y-6 max-w-sm sm:max-w-md bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
                  {loginStep !== 3 ? (
                    // Unified phone + OTP login
                    <div>
                      <h4 className="text-lg font-black text-slate-800 mb-1 tracking-tight">Sign in to book</h4>
                      <p className="text-xs text-slate-400 mb-6 font-semibold">Verify your mobile number to continue.</p>

                      {loginError && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold p-3.5 rounded-2xl text-center mb-5">
                          {loginError}
                        </div>
                      )}

                      <form onSubmit={handlePhoneLoginSubmit} className="space-y-5">
                        {loginStep === 1 ? (
                          <div>
                            <label className="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Phone Number</label>
                            <div className="relative">
                              <span className="absolute left-4 top-3.5 text-slate-400 font-bold text-xs">+251</span>
                              <input
                                type="tel"
                                required
                                value={loginPhone}
                                onChange={(e) => setLoginPhone(sanitizePhoneInput(e.target.value))}
                                inputMode="numeric"
                                maxLength={12}
                                className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-xs focus:outline-none focus:border-rose-500 text-slate-800 font-semibold"
                                placeholder="99000-00000"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={isSendingOtp}
                              className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-2xl py-3.5 text-xs font-bold transition-all shadow-md shadow-rose-200 cursor-pointer mt-6 flex justify-center items-center gap-1.5"
                            >
                              Send OTP
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-700 font-bold mb-5 flex flex-col gap-1">
                              <span className="flex items-center gap-1.5">
                                <Sparkles size={14} className="text-indigo-600" />
                                <span>Demo Assistant</span>
                              </span>
                              <span className="font-medium text-slate-500">OTP sent to +251 {loginPhone}. Demo code <strong>123456</strong>.</span>
                            </div>

                            <label className="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Enter OTP</label>
                            <input
                              type="text"
                              required
                              maxLength={6}
                              value={loginOtp}
                              onChange={(e) => setLoginOtp(e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3.5 text-center text-sm tracking-widest font-extrabold focus:outline-none focus:border-rose-500 text-slate-850"
                              placeholder="••••••"
                            />
                            <button
                              type="submit"
                              disabled={isVerifyingOtp}
                              className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-2xl py-3.5 text-xs font-bold transition-all shadow-md shadow-rose-200 cursor-pointer mt-6 flex justify-center items-center gap-1.5"
                            >
                              {isVerifyingOtp ? <Loader2 size={14} className="animate-spin" /> : null}
                              Verify & Continue
                            </button>
                            <button
                              type="button"
                              onClick={() => { setLoginStep(1); setLoginError(null); }}
                              className="w-full text-center text-xs text-rose-500 font-bold hover:underline mt-4 cursor-pointer"
                            >
                              Change phone number
                            </button>
                          </div>
                        )}
                      </form>
                    </div>
                  ) : (
                    // REGISTRATION FORM
                    <div>
                      <h4 className="text-lg font-black text-slate-800 mb-1 tracking-tight">Create Account</h4>
                      <p className="text-xs text-slate-400 mb-6 font-semibold">
                        Phone verified: <span className="font-bold text-slate-600">+251 {loginPhone}</span>
                      </p>

                      {loginError && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold p-3.5 rounded-2xl text-center mb-5">
                          {loginError}
                        </div>
                      )}

                      <form onSubmit={handleRegisterSubmit} className="space-y-4">
                        <div>
                          <label className="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Full Name</label>
                          <input
                            type="text"
                            required
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-rose-500 text-slate-800 font-semibold"
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Email Address</label>
                          <input
                            type="email"
                            required
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-rose-500 text-slate-800 font-semibold"
                            placeholder="john@example.com"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isRegistering}
                          className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-2xl py-3.5 text-xs font-bold transition-all shadow-md shadow-rose-200 cursor-pointer mt-6 flex justify-center items-center gap-1.5"
                        >
                          {isRegistering ? <Loader2 size={14} className="animate-spin" /> : null}
                          Register & Log In
                        </button>
                      </form>

                      <p className="mt-8 text-center text-xs text-slate-400 font-semibold">
                        <button
                          type="button"
                          onClick={() => { setLoginStep(2); setLoginError(null); }}
                          className="text-rose-600 font-extrabold hover:underline cursor-pointer"
                        >
                          Back to OTP
                        </button>
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setDrawerStep(1)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#6900AA] transition-colors cursor-pointer mt-4"
                  >
                    <ChevronLeft size={18} />
                    Back
                  </button>
                </div>
              )}

              {drawerStep === 3 && (
                <div className="space-y-5">
                  {availabilityStatus === 'loading' && (
                    <div className="flex items-center gap-2.5 bg-amber-50 text-amber-700 px-4 py-3 rounded-xl text-sm font-semibold border border-amber-100">
                      <Loader2 size={16} className="animate-spin shrink-0" /> Checking seat availability…
                  </div>
                  )}
                  {availabilityStatus === 'unavailable' && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-center space-y-3 max-w-xl mx-auto">
                      <p className="text-xs text-rose-600 font-bold">Sorry, no tables are available for this slot.</p>
                      <button
                        type="button"
                        onClick={() => setDrawerStep(1)}
                        className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer"
                      >
                        Choose another time
                      </button>
                    </div>
                  )}
                  {availabilityStatus === 'error' && (
                    <div className="flex items-center gap-2.5 bg-orange-50 text-orange-600 px-4 py-3 rounded-xl text-sm font-semibold border border-orange-100">
                      <AlertCircle size={16} className="shrink-0" /> Could not check availability. Please try again.
                    </div>
                  )}

                  {availabilityStatus === 'available' && (
                    <form
                      onSubmit={handleConfirmSubmit(onConfirmBooking, (formErrors) => {
                        if (formErrors.name) setConfirmFocus('name');
                        else if (formErrors.phone) setConfirmFocus('phone');
                        else if (formErrors.arrivalTime) {
                          arrivalFieldRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      })}
                      noValidate
                      className="space-y-5"
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] gap-5 lg:gap-6 items-start">
                        {/* Left — review booking details */}
                        <div>
                          <h3 className="text-base font-bold text-zinc-900 mb-3">Review booking details</h3>
                          <div className="rounded-xl border border-zinc-200 bg-white px-4 py-1">
                            <div className="flex items-start gap-3 py-3.5 border-b border-zinc-100">
                              <Calendar size={18} className="text-zinc-500 shrink-0 mt-0.5" strokeWidth={1.75} />
                              <p className="text-sm font-semibold text-zinc-900 leading-snug">
                                {selectedDateIndex === 0 ? 'Today' : selectedDateIndex === 1 ? 'Tomorrow' : bookingDates[selectedDateIndex].toLocaleDateString('en-IN', { weekday: 'short' })}{' '}
                                {bookingDates[selectedDateIndex].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{' '}
                                at {formatSlotLabel(selectedTime)}
                        </p>
                      </div>
                            <div className="flex items-start gap-3 py-3.5 border-b border-zinc-100">
                              <Users size={18} className="text-zinc-500 shrink-0 mt-0.5" strokeWidth={1.75} />
                              <p className="text-sm font-semibold text-zinc-900">
                                {guests} {Number(guests) === 1 ? 'guest' : 'guests'}
                              </p>
                      </div>
                            <div className="flex items-start gap-3 py-3.5 border-b border-zinc-100">
                              <MapPin size={18} className="text-zinc-500 shrink-0 mt-0.5" strokeWidth={1.75} />
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-zinc-900 leading-snug">{profile.name}</p>
                                {(profile.address || city) && (
                                  <p className="text-xs text-zinc-500 mt-0.5 leading-snug">
                                    {city || profile.address}
                                  </p>
                                )}
                      </div>
                      </div>
                            {appliedOffer && (
                              <div className="flex items-start gap-3 py-3.5">
                                <Tag size={18} className="text-[#2563eb] shrink-0 mt-0.5" strokeWidth={1.75} />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-zinc-900 leading-snug">
                                    {appliedOffer.type ? `${appliedOffer.type}` : 'Offer applied'}
                                    {appliedOffer.title ? ` · ${appliedOffer.title}` : ''}
                                  </p>
                                  {appliedOffer.validity && (
                                    <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{appliedOffer.validity}</p>
                                  )}
                    </div>
                  </div>
                            )}
                            {!appliedOffer && noOfferSelected && (
                              <div className="flex items-start gap-3 py-3.5">
                                <Tag size={18} className="text-zinc-400 shrink-0 mt-0.5" strokeWidth={1.75} />
                                <p className="text-sm font-semibold text-zinc-600">No offer selected</p>
                    </div>
                  )}
                          </div>
                          <div className="mt-3">
                            {!specialRequestOpen ? (
                      <button
                        type="button"
                                onClick={() => setSpecialRequestOpen(true)}
                                className="text-sm font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
                              >
                                + Add special request
                              </button>
                            ) : (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <label htmlFor="special-request" className="text-sm font-semibold text-zinc-900">
                                    Special request
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSpecialRequestOpen(false);
                                      setSpecialRequest('');
                                    }}
                                    className="text-xs font-semibold text-zinc-400 hover:text-zinc-600 cursor-pointer"
                                  >
                                    Remove
                      </button>
                                </div>
                                <textarea
                                  id="special-request"
                                  value={specialRequest}
                                  onChange={(e) => setSpecialRequest(e.target.value)}
                                  rows={3}
                                  maxLength={500}
                                  placeholder="e.g. Window seat, birthday celebration, high chair…"
                                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10 resize-y min-h-[84px]"
                                />
                                {specialRequest.trim().length > 0 && (
                                  <p className="text-[0.625rem] text-zinc-400 text-right">
                                    {specialRequest.trim().length}/500
                                  </p>
                                )}
                    </div>
                  )}
                          </div>
                          <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
                            The restaurant will try to allot the seats for the selected preference but availability of preferred seating is subject to restaurant discretion and no refunds/cancellations are possible.
                          </p>
                      </div>

                        {/* Right — editable guest form */}
                        <div>
                          <h3 className="text-base font-bold text-zinc-900 mb-3">Your details</h3>
                          <div className="rounded-xl bg-zinc-50 p-3.5 space-y-3">
                            <div>
                              <label className={`rounded-none border-b border-zinc-200 px-3 py-2 flex items-center gap-2.5 cursor-text transition-colors ${confirmErrors.name ? 'border-red-400' : 'border-zinc-200'} focus-within:border-[#6900AA]`}>
                                <User size={16} className="text-primary shrink-0" />
                                <Controller
                                  name="name"
                                  control={control}
                                  render={({ field }) => (
                          <input
                                      {...field}
                            type="text"
                                      autoComplete="name"
                                      aria-label="Full Name"
                                      aria-invalid={!!confirmErrors.name}
                                      className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 placeholder:font-medium cursor-text"
                                      placeholder="Your Name"
                                      onChange={(e) => {
                                        const cleaned = e.target.value.replace(/[^\p{L}\s']/gu, '');
                                        field.onChange(cleaned);
                                        setName(cleaned);
                                      }}
                                    />
                                  )}
                                />
                              </label>
                              {confirmErrors.name && (
                                <p className="text-red-500 text-xs font-semibold mt-1.5 px-0.5">{confirmErrors.name.message}</p>
                              )}
                        </div>

                        <div>
                              <label className={`rounded-none border-b border-zinc-200 px-3 py-2 flex items-center gap-2.5 cursor-text transition-colors ${confirmErrors.phone ? 'border-red-400' : 'border-zinc-200'} focus-within:border-[#6900AA]`}>
                                <Phone size={16} className="text-primary shrink-0" />
                                <Controller
                                  name="phone"
                                  control={control}
                                  render={({ field }) => (
                          <input
                                      {...field}
                            type="tel"
                            inputMode="numeric"
                            maxLength={12}
                                      autoComplete="tel"
                                      aria-label="Phone Number"
                                      aria-invalid={!!confirmErrors.phone}
                                      className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 placeholder:font-medium tracking-wide cursor-text"
                                      placeholder="Phone Number"
                                      onChange={(e) => {
                                        const cleaned = sanitizePhoneInput(e.target.value);
                                        field.onChange(cleaned);
                                        setPhone(cleaned);
                                      }}
                                    />
                                  )}
                                />
                              </label>
                              {confirmErrors.phone && (
                                <p className="text-red-500 text-xs font-semibold mt-1.5 px-0.5">{confirmErrors.phone.message}</p>
                              )}
                        </div>

                            <div ref={arrivalFieldRef} className="relative">
                              <div className={`rounded-none border-b border-zinc-200 px-3 py-2 flex items-center gap-2.5 transition-colors ${confirmErrors.arrivalTime ? 'border-red-400' : 'border-zinc-200'} focus-within:border-[#6900AA]`}>
                                <Clock size={16} className="text-primary shrink-0" />
                                <button
                                  type="button"
                                  aria-label="Approx. Arrival"
                                  aria-expanded={arrivalDropdownOpen}
                                  onClick={() => setArrivalDropdownOpen((open) => !open)}
                                  className="flex-1 min-w-0 flex items-center justify-between gap-2 bg-transparent p-0 text-left cursor-pointer"
                                >
                                  <span className="text-sm font-semibold text-zinc-900 truncate">
                                    {arrivalTime === '10 min late' ? 'Up to 10 min late' : arrivalTime === '15 min late' ? 'Up to 15 min late' : arrivalTime}
                                  </span>
                                  <ChevronDown
                                    size={16}
                                    className={`shrink-0 text-zinc-500 transition-transform duration-200 ${arrivalDropdownOpen ? 'rotate-180' : ''}`}
                                  />
                                </button>
                        </div>

                              {arrivalDropdownOpen && (
                                <ul
                                  role="listbox"
                                  aria-label="Approx. Arrival"
                                  className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-zinc-200 rounded-xl shadow-[0_8px_24px_rgba(15,23,42,0.12)] p-1.5"
                                >
                                  {[
                                    { value: 'On time', label: 'On time' },
                                    { value: '15 min early', label: '15 min early' },
                                    { value: '10 min late', label: 'Up to 10 min late' },
                                    { value: '15 min late', label: 'Up to 15 min late' },
                                  ].map((opt) => {
                                    const selected = arrivalTime === opt.value;
                                    return (
                                      <li key={opt.value} role="option" aria-selected={selected}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setArrivalTime(opt.value);
                                            setConfirmValue('arrivalTime', opt.value, { shouldValidate: true, shouldDirty: true });
                                            setArrivalDropdownOpen(false);
                                          }}
                                          className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                                            selected
                                              ? 'bg-primary text-white font-semibold'
                                              : 'text-zinc-700 font-medium hover:bg-primary/5'
                                          }`}
                                        >
                                          {opt.label}
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                              {confirmErrors.arrivalTime && (
                                <p className="text-red-500 text-xs font-semibold mt-1.5 px-0.5">{confirmErrors.arrivalTime.message}</p>
                              )}
                            </div>

                            <p className="text-xs text-primary font-medium leading-snug pt-0.5">
                              Confirm your name and phone so the restaurant can reach you.
                            </p>
                          </div>
                        </div>
                      </div>

                        <div className="flex flex-col items-start gap-3">
                          <button
                            type="submit"
                            className="w-full max-w-sm sm:max-w-md py-3.5 rounded-xl bg-[#111111] hover:bg-black text-white text-sm font-bold transition-colors cursor-pointer shadow-sm"
                          >
                            Confirm Booking
                          </button>
                          <button
                            type="button"
                            onClick={() => setDrawerStep(1)}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#6900AA] transition-colors cursor-pointer"
                          >
                            <ChevronLeft size={18} />
                            Back
                          </button>
                        </div>
                    </form>
                  )}
                </div>
              )}

              {drawerStep === 4 && (
                <div className="w-full max-w-[960px] mx-auto lg:mt-2 px-4 sm:px-0">
                  <div
                    className="rounded-[22px] bg-white px-5 py-5 sm:px-8 sm:py-7"
                    style={{
                      border: 'none',
                      boxShadow:
                        '0 4px 6px rgba(80,40,120,0.04), 0 18px 48px rgba(80,40,120,0.12), 0 32px 64px rgba(40,20,80,0.06)',
                    }}
                  >
                    {/* Header: success + booking id */}
                    <div className="flex items-start justify-between gap-3 mb-6">
                      <div className="flex items-start gap-3 min-w-0">
                        <BookingSuccessCheckAnimation
                          playKey={lastBookingId || `success-${drawerStep}`}
                        />
                        <div className="min-w-0 pt-0.5">
                          <h3 className="text-[22px] sm:text-[24px] font-bold text-[#1f9d55] tracking-wide leading-none">
                            Table Booked Successfully!
                          </h3>
                          <p className="text-[13px] sm:text-sm text-[#8a8a98] font-medium mt-1.5 leading-snug">
                            Your table is confirmed. We look forward to serving you!
                          </p>
                        </div>
                      </div>

                      {lastBookingId && (
                        <button
                          type="button"
                          title={lastBookingId}
                          aria-label="Copy booking ID"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(lastBookingId);
                              setBookingIdCopied(true);
                              toast.success('Booking ID copied');
                              setTimeout(() => setBookingIdCopied(false), 1600);
                            } catch {
                              toast.error('Could not copy Booking ID');
                            }
                          }}
                          className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#f1e9ff] px-3 py-2 hover:bg-[#e8dcff] transition-colors cursor-pointer"
                        >
                          <Calendar size={15} className="text-[#6900AA] shrink-0" strokeWidth={2} />
                          <span className="text-left leading-tight">
                            <span className="block text-[10px] font-semibold text-[#6900AA]/80">Booking ID</span>
                            <span className="block text-[12px] font-bold text-[#2b1848]">
                              {bookingIdCopied
                                ? 'Copied!'
                                : `#${lastBookingId.replace(/-/g, '').slice(0, 8).toUpperCase()}`}
                            </span>
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Row: photo | details | QR — fixed sizes so layout never blows up */}
                    <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start">
                      <div
                        className="relative shrink-0 rounded-2xl overflow-hidden bg-zinc-100 mx-auto lg:mx-0"
                        style={{ width: 200, height: 200 }}
                      >
                        <SafeCoverImage
                          src={
                            photos[0] ||
                            resolveMediaUrl(profile.cover_image_url) ||
                            ''
                          }
                          alt={profile.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          fallbackClassName="absolute inset-0 flex items-center justify-center bg-[#F3F4F6] text-slate-300"
                          fallback={<DiningImageFallback size={32} />}
                        />
                        <span className="absolute bottom-2.5 left-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-full bg-black/80 text-white text-[10px] font-semibold px-2.5 py-1">
                          {profile.name}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0 w-full">
                        <span className="inline-flex items-center rounded-md bg-[#f1e9ff] text-[#6900AA] text-[11px] font-bold px-2 py-0.5">
                          {profile.type_name || 'Restaurant'}
                        </span>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-[20px] sm:text-[22px] font-bold text-[#1a1a1a] tracking-tight leading-tight">
                            {profile.name}
                          </h4>
                        
                        </div>
                        <p className="text-[13px] text-[#8a8a98] font-medium mt-0.5">
                          {cuisineList.length > 0 ? cuisineList.join(' • ') : cuisines}
                        </p>

                        <div className="mt-4 space-y-2.5">
                          <div className="flex items-start gap-2.5">
                            <MapPin size={16} className="text-[#6900AA] shrink-0 mt-0.5" strokeWidth={1.75} />
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-[#2b2b35] leading-snug">
                                {profile.address || [city, country].filter(Boolean).join(', ')}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  if (profile.address) {
                                    window.open(
                                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}`,
                                      '_blank',
                                      'noopener,noreferrer'
                                    );
                                  } else {
                                    toast.error('Address not available');
                                  }
                                }}
                                className="mt-0.5 text-[13px] font-semibold text-[#6900AA] hover:underline cursor-pointer"
                              >
                                Get Direction →
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <Clock size={16} className="text-[#6900AA] shrink-0" strokeWidth={1.75} />
                            <p className="text-[13px] text-[#2b2b35]">
                              <span className="font-semibold text-[#8a8a98]">Table Time </span>
                              <span className="font-bold">
                                {formatSlotLabel(selectedTime)}
                                {' • '}
                                {formatDateCustomer(bookingDates[selectedDateIndex])}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <Users size={16} className="text-[#6900AA] shrink-0" strokeWidth={1.75} />
                            <p className="text-[13px] text-[#2b2b35]">
                              <span className="font-semibold text-[#8a8a98]">For </span>
                              <span className="font-bold">
                                {guests} {Number(guests) === 1 ? 'Person' : 'People'}
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <Clock size={16} className="text-[#6900AA] shrink-0" strokeWidth={1.75} />
                            <p className="text-[13px] text-[#2b2b35]">
                              <span className="font-semibold text-[#8a8a98]">Arrival </span>
                              <span className="font-bold">{arrivalTime}</span>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 mx-auto lg:mx-0 text-center" style={{ width: 168 }}>
                        <div className="rounded-2xl bg-[#f1e9ff] p-3">
                          {lastQrToken ? (
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(lastQrToken)}`}
                              alt="Booking check-in QR code"
                              width={142}
                              height={142}
                              className="w-[142px] h-[142px] mx-auto rounded-lg bg-white object-contain p-1"
                            />
                          ) : (
                            <div className="w-[142px] h-[142px] mx-auto rounded-lg bg-white/80 flex items-center justify-center text-[#9a9aa8] text-[11px] font-medium px-2">
                              QR will appear once available for this booking.
                            </div>
                          )}
                        </div>
                        <p className="mt-2.5 text-[13px] font-bold text-[#2b2b35] leading-tight">Scan this QR code</p>
                        <p className="text-[11px] text-[#9a9aa8] font-medium">at the restaurant</p>
                      </div>
                    </div>

                    {/* Offer 3D card — no border, elevated shadow */}
                    {appliedOffer?.title && (
                      <div
                        className="mt-6 rounded-[20px] overflow-hidden flex items-stretch"
                        style={{
                          border: 'none',
                          background:
                            'linear-gradient(105deg, #f4edff 0%, #ebe0ff 42%, #e0d0ff 100%)',
                          boxShadow:
                            '0 8px 24px rgba(105,0,170,0.14), 0 2px 6px rgba(80,40,120,0.08)',
                        }}
                      >
                        <div className="flex-1 min-w-0 px-4 py-4 sm:px-6 sm:py-5 flex flex-col justify-center">
                          <div className="flex items-center gap-1.5 text-[#6900AA] mb-1.5">
                            <Tag size={15} strokeWidth={2.25} />
                            <span className="text-[12px] font-bold">Special Offer</span>
                          </div>
                          <p className="text-[17px] sm:text-[19px] font-bold text-[#1a1a1a] leading-snug">
                            {appliedOffer.title}
                          </p>
                          <span className="mt-2.5 inline-flex w-fit items-center rounded-full bg-white/90 text-[#6900AA] text-[10px] font-bold px-2.5 py-1 shadow-sm">
                            Provided by BookMyBota
                          </span>
                          <p className="mt-2.5 text-[11px] text-[#8a8a98] font-medium">
                            {appliedOffer.validity || 'Valid only for this booking • T&C apply'}
                          </p>
                        </div>
                        <div
                          className="relative shrink-0 flex items-center justify-center self-stretch pr-2 sm:pr-4 pl-1 py-2"
                          style={{ width: 190, minHeight: 132 }}
                        >
                          <span className="absolute top-3 right-4 h-1.5 w-1.5 rotate-45 bg-[#6900AA]/55 rounded-[1px]" />
                          <span className="absolute top-7 right-2 h-1 w-1 rotate-45 bg-[#6900AA]/40 rounded-[1px]" />
                          <span className="absolute bottom-4 right-6 h-1 w-1 rotate-45 bg-[#6900AA]/35 rounded-[1px]" />
                          {/* Offer food — natural cutout, no circle mask */}
                          <img
                            src="/images/booking-offer-food.png"
                            alt=""
                            width={168}
                            height={140}
                            className="relative z-[1] w-[150px] h-auto sm:w-[168px] object-contain drop-shadow-[0_10px_18px_rgba(60,20,100,0.28)]"
                            style={{ border: 'none', borderRadius: 0 }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/booking-offer-food.jpg';
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Actions — same destinations as before */}
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-5">
                      <button
                        type="button"
                        disabled={!lastBookingId}
                        onClick={() => {
                          if (!lastBookingId) return;
                          closeBookingPanel();
                          router.push(`/customer/bookings/${lastBookingId}`);
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 max-w-xs rounded-xl bg-[#111111] hover:bg-black disabled:opacity-50 text-white text-[14px] font-bold px-4 py-3.5 transition-colors cursor-pointer"
                      >
                        <FileText size={16} strokeWidth={2} />
                        View Booking Details
                        <ArrowRight size={16} strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeBookingPanel();
                          router.push('/dining');
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 max-w-xs rounded-xl border-[1.5px] border-[#111111] bg-white text-[#111111] text-[14px] font-bold px-4 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Compass size={16} strokeWidth={2} />
                        Explore More Restaurants
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 text-center space-y-1">
                   
                    <p className="text-[13px] text-[#9a9aa8] font-medium">
                      Thank you for choosing <span className="text-[#6900AA] font-bold">BookMyBota</span>
                    </p>
                  </div>
                </div>
              )}

            {/* Step 1 footer — Zomato-like proceed bar */}
            {drawerStep === 1 && (
              <div className="mt-8 md:mt-8 max-md:sticky max-md:bottom-0 max-md:z-40 max-md:-mx-5 max-md:px-5 max-md:pt-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-md:bg-white max-md:border-t max-md:border-slate-200">
                <div className="md:hidden mb-3 rounded-xl bg-slate-100 px-3.5 py-3">
                  <p className="text-sm font-bold text-slate-900 mb-1">Terms &amp; Conditions</p>
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${acceptedTerms ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-300'}`}
                      >
                        {acceptedTerms && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-500 font-medium leading-relaxed">
                      I agree to the{' '}
                      <button
                        type="button"
                        className="text-slate-900 font-semibold underline cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setBookingPolicyFocus("terms");
                          setBookingPolicyOpen(true);
                        }}
                      >
                        Terms &amp; Conditions
                      </button>
                      {' '}and{' '}
                      <button
                        type="button"
                        className="text-slate-900 font-semibold underline cursor-pointer"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setBookingPolicyFocus("cancellation");
                          setBookingPolicyOpen(true);
                        }}
                      >
                        Cancellation Policy
                      </button>
                    </span>
                  </label>
                </div>

                <label className="hidden md:flex items-start gap-2.5 cursor-pointer select-none mb-4">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        id="termsAcceptFooter"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer ${acceptedTerms ? 'bg-[#6900AA] border-[#6900AA]' : 'bg-white border-slate-300 hover:border-slate-400'
                          }`}
                      >
                        {acceptedTerms && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  <span className="text-xs text-slate-500 font-medium leading-relaxed">
                      I agree to the{' '}
                    <button
                      type="button"
                      className="text-[#6900AA] font-semibold hover:underline cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setBookingPolicyFocus("terms");
                        setBookingPolicyOpen(true);
                      }}
                    >
                      Terms &amp; Conditions
                    </button>
                      {' '}and{' '}
                    <button
                      type="button"
                      className="text-[#6900AA] font-semibold hover:underline cursor-pointer"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setBookingPolicyFocus("cancellation");
                        setBookingPolicyOpen(true);
                      }}
                    >
                      Cancellation Policy
                    </button>
                    </span>
                  </label>

                  <button
                    type="button"
                    disabled={!selectedTime || !acceptedTerms}
                    onClick={proceedToBooking}
                  className={`w-full md:max-w-sm lg:max-w-md md:self-start px-6 sm:px-8 py-3.5 rounded-xl text-base font-semibold transition-all flex items-center justify-center ${selectedTime && acceptedTerms
                    ? 'bg-[#111111] hover:bg-black text-white cursor-pointer'
                    : 'bg-[#cfcfcf] text-white cursor-not-allowed'
                    }`}
                >
                  Proceed to book
                  </button>
              </div>
            )}
            </div>
          </div>
        , bookTableSlot)}

        {/* Mobile sticky Book a table CTA (overview) */}
        {!hideBookingSidebar && activeTab !== "Book a Table" && !isLightboxOpen ? (
          <div className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-slate-200 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => handleQuickBook()}
              className="w-full rounded-xl border border-slate-900 bg-white text-slate-900 py-3.5 text-base font-bold cursor-pointer hover:bg-slate-50"
            >
              Book a table
            </button>
          </div>
        ) : null}

        <CustomerAuthModal
          open={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={() => {
            dispatch(loadFromStorage());
            setAuthModalOpen(false);
            if (pendingProceedAfterAuth.current) {
              pendingProceedAfterAuth.current = false;
              const customer = readSessionForRole('customer')?.user;
              setDrawerStep(3);
              setName(customer?.name || '');
              setPhone(customer?.phone || '');
            }
          }}
        />

        {typeof document !== "undefined" &&
          createPortal(
            <div
              id="dining-restaurant-sticky"
              ref={restaurantStickyRef}
              className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-300 ease-out ${
                isBookTableFlow ? "hidden" : "hidden md:block"
              } ${
                restaurantStickyVisible && !isLightboxOpen
                  ? "translate-y-0 opacity-100"
                  : "-translate-y-full opacity-0 pointer-events-none"
              }`}
              aria-hidden={!restaurantStickyVisible || isLightboxOpen}
            >
              <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_4px_18px_rgba(15,23,42,0.06)]">
                <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 py-1.5">
                  <div className="flex items-center gap-3 py-1.5 min-w-0">
                    <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                      {stickyThumb ? (
                        <SafeCoverImage
                          src={stickyThumb}
                          alt={profile.name}
                          className="h-full w-full object-cover"
                          fallbackClassName="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300"
                          fallback={<DiningImageFallback size={18} />}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <Utensils size={18} strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm sm:text-base font-bold text-slate-900 truncate leading-tight">
                        {profile.name}
                      </p>
                      {stickyMetaLine ? (
                        <p className="mt-0.5 text-xs sm:text-sm text-slate-500 truncate leading-snug">
                          {stickyMetaLine}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div
                    id="restaurant-tabs"
                    className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-out ${
                      showSectionTabs
                        ? "max-h-16 opacity-100"
                        : "max-h-0 opacity-0 pointer-events-none"
                    }`}
                  >
                    <div className="flex gap-6 overflow-x-auto scrollbar-hide pt-0.5 pb-0.5">
                      {DETAIL_SECTION_TABS.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => scrollToDetailSection(tab.sectionId, tab.id)}
                          className={`py-2.5 text-sm sm:text-base lg:text-sm font-semibold tracking-wide border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === tab.id
                              ? "border-slate-900 text-slate-900 font-bold"
                              : "border-transparent text-slate-400 hover:text-slate-900"
                          }`}
                        >
                          {tab.id}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}

        {/* Mobile section tab bar (District-style; replaces restaurant sticky on mobile) */}
        {typeof document !== "undefined" &&
          createPortal(
            <div
              ref={mobileTabsRef}
              id="dining-mobile-section-tabs"
              className={`md:hidden fixed top-0 left-0 right-0 z-[60] bg-white border-b border-slate-200 transition-all duration-300 ease-out ${
                showMobileSectionTabs && !isLightboxOpen
                  ? "translate-y-0 opacity-100"
                  : "-translate-y-full opacity-0 pointer-events-none"
              }`}
              aria-hidden={!showMobileSectionTabs || isLightboxOpen}
            >
              <div className="px-5 flex gap-5 overflow-x-auto scrollbar-hide">
                {DETAIL_SECTION_TABS.map((tab) => (
                  <button
                    key={`mobile-tab-${tab.id}`}
                    type="button"
                    onClick={() => scrollToDetailSection(tab.sectionId, tab.id)}
                    className={`py-3 text-sm font-semibold tracking-wide border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                      activeTab === tab.id
                        ? "border-slate-900 text-slate-900 font-bold"
                        : "border-transparent text-slate-400"
                    }`}
                  >
                    {tab.id}
                  </button>
                ))}
              </div>
            </div>,
            document.body
          )}

        <DiningBookingPolicyModal
          open={bookingPolicyOpen}
          focusSection={bookingPolicyFocus}
          onClose={() => setBookingPolicyOpen(false)}
        />

        <AboutVenueModal
          open={venueInfoModal != null}
          mode={venueInfoModal || "about"}
          onClose={() => setVenueInfoModal(null)}
          name={profile.name}
          coverSrc={photos[0] || resolveMediaUrl(profile.cover_image_url) || ""}
          description={aboutDescription}
          address={profile.address}
          phone={profile.phone}
          openingHours={openingHourRows}
        />
      </div>
      );
}
