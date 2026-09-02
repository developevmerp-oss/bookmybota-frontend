"use client";
import { useState, use, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  MapPin, Phone, CheckCircle, Calendar, Users, Clock,
  Star, Share2, Compass, MessageSquare, Image as ImageIcon,
  BookOpen, AlertCircle, Sparkles, Copy, ChevronRight, Loader2,
  ChevronLeft, X, Navigation, User,
  Send, ShieldCheck, ArrowRight, Check, ChevronDown, Tag, CheckCheck,
  Sun, Moon, Sunrise
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { formatMoney, getCostForTwoFromRange } from '@/lib/currencyFormat';
import { resolveMediaUrl } from '@/lib/mediaUrl';
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
  useSendCustomerOtpMutation,
  useVerifyCustomerOtpMutation,
  useRegisterCustomerMutation,
  useGetReviewsQuery,
  useCreateReviewMutation,
  useCreateReviewReplyMutation,
  useGetBusinessesQuery,
  useGetCollectionsQuery,
  useGetDiningEligiblePlatformOffersQuery,
  type DiningEligiblePlatformOffer,
} from '@/services/api';
import { useAppSelector, useAppDispatch } from '@/lib/hooks';
import { loadFromStorage, setCredentials } from '@/features/auth/authSlice';
import { readSessionForRole } from '@/lib/authStorage';
import CustomerAuthModal from '@/components/Shared/CustomerAuthModal';
import { getPhoneValidationError, isValidPhone, sanitizePhoneInput } from '@/lib/validation';
import GuestTableAnimation from './GuestTableAnimation';
import DiningBookingPolicyModal, {
  type DiningBookingPolicySection,
} from './DiningBookingPolicyModal';
import {
  confirmBookingSchema,
  type ConfirmBookingValues,
} from '@/lib/loginFormSchema';

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
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {visibleUrls.slice(0, 3).map((url, idx) => {
        const showMoreOverlay = visibleUrls.length > 3 && idx === 2;
        return (
          <div
            key={url}
            onClick={() => onOpen(showMoreOverlay ? 0 : idx, visibleUrls)}
            className="relative rounded-xl overflow-hidden h-40 bg-slate-100 border border-slate-100 hover:shadow-md transition-shadow cursor-pointer group"
          >
            <img
              src={url}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
  for (let i = 0; i < 6; i++) {
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

const generateTimeSlots = (
  selectedDateIndex: number,
  operatingHours?: Record<string, { open: string; close: string; closed: boolean }>,
  selectedDate?: Date
) => {
  const slots: string[] = [];
  const now = new Date();

  let targetDate = selectedDate;
  if (!targetDate) {
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + selectedDateIndex);
  }

  // Determine weekday rules
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = days[targetDate.getDay()];
  const dayRules = operatingHours ? operatingHours[dayOfWeek] : null;

  // If closed on this day, no slots available
  if (dayRules && dayRules.closed) {
    return [];
  }

  // Get start/end bounds (defaulting to 08:00 - 23:30 if not defined)
  let openTime = "08:00";
  let closeTime = "23:30";
  if (dayRules && dayRules.open && dayRules.close) {
    openTime = dayRules.open;
    closeTime = dayRules.close;
  }

  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);

  const openVal = openH * 60 + openM;
  const closeVal = closeH * 60 + closeM;

  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h.toString().padStart(2, '0');
      const min = m.toString().padStart(2, '0');
      const slot = `${hour}:${min}`;

      const currentVal = h * 60 + m;

      // Check operating hours bounds (including overnight logic)
      let isValidSlot = false;
      if (closeVal >= openVal) {
        isValidSlot = currentVal >= openVal && currentVal <= closeVal;
      } else {
        // Cross-midnight overnight hours
        isValidSlot = currentVal >= openVal || currentVal <= closeVal;
      }

      if (!isValidSlot) continue;

      if (selectedDateIndex === 0) {
        // Only show future slots for today (add 30min buffer)
        const slotDate = new Date();
        slotDate.setHours(h, m, 0, 0);
        const bufferNow = new Date(now.getTime() + 30 * 60 * 1000);
        if (slotDate <= bufferNow) continue;
      }
      slots.push(slot);
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
        <div
          key={star}
          className="relative cursor-pointer"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const isHalf = x < rect.width / 2;
            onChange(isHalf ? star - 0.5 : star);
          }}
        >
          <Star
            size={24}
            strokeWidth={1.5}
            className={`${value >= star ? "fill-emerald-500 text-emerald-500" : "text-slate-300 fill-slate-100"} transition-colors`}
          />
          {value === star - 0.5 && (
            <div className="absolute top-0 left-0 overflow-hidden w-[50%] h-full pointer-events-none">
              <Star size={24} strokeWidth={1.5} className="fill-emerald-500 text-emerald-500" />
            </div>
          )}
        </div>
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
  const { data: profile, isLoading } = useGetBusinessPublicQuery(resolvedParams.id);
  const [createBooking] = useCreateBookingMutation();
  const { data: reviewsData } = useGetReviewsQuery(resolvedParams.id, { skip: !resolvedParams.id });
  const reviews = reviewsData?.items ?? [];
  const [createReview] = useCreateReviewMutation();
  const [createReviewReply] = useCreateReviewReplyMutation();

  // Similar restaurants query logic
  const { data: collections = [] } = useGetCollectionsQuery();
  const firstCollectionSlug = profile?.collection_slugs?.[0];
  const { data: similarBusinesses = [] } = useGetBusinessesQuery(
    { collection: firstCollectionSlug },
    { skip: !firstCollectionSlug }
  );

  const matchedCollection = collections.find((c) => c.slug === firstCollectionSlug);
  const similarRestaurants = similarBusinesses.filter((b) => b.id !== resolvedParams.id);

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
    };
    syncCustomerAuth();
    window.addEventListener('auth_changed', syncCustomerAuth);
    return () => window.removeEventListener('auth_changed', syncCustomerAuth);
  }, [dispatch]);

  // Scroll to top on restaurant change/mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [resolvedParams.id]);

  // Sticky section tabs (Overview / Menu / Photos / Reviews) — scroll-spy like District
  const [activeTab, setActiveTab] = useState<string>("Overview");
  const [tabsStuck, setTabsStuck] = useState(false);
  const [siteHeaderHeight, setSiteHeaderHeight] = useState(0);
  const [sidebarStickyTop, setSidebarStickyTop] = useState(140);
  const tabsSentinelRef = useRef<HTMLDivElement>(null);
  const scrollSpyPausedRef = useRef(false);

  useEffect(() => {
    const measureHeader = () => {
      const header = document.querySelector("header");
      setSiteHeaderHeight(header?.getBoundingClientRect().height ?? 0);
    };
    measureHeader();
    window.addEventListener("resize", measureHeader);
    return () => window.removeEventListener("resize", measureHeader);
  }, []);

  useEffect(() => {
    const sentinel = tabsSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const topInset = siteHeaderHeight > 0 ? siteHeaderHeight : 120;
    const observer = new IntersectionObserver(
      ([entry]) => setTabsStuck(!entry.isIntersecting),
      { rootMargin: `-${topInset}px 0px 0px 0px`, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [siteHeaderHeight]);

  const getDetailStickyOffset = useCallback(() => {
    const tabsEl = document.getElementById("restaurant-tabs");
    if (tabsEl) {
      const headerTop = parseFloat(getComputedStyle(tabsEl).top) || 0;
      return headerTop + tabsEl.offsetHeight + 8;
    }
    if (typeof window === "undefined") return 140;
    if (siteHeaderHeight > 0) {
      const tabsEl = document.getElementById("restaurant-tabs");
      return siteHeaderHeight + (tabsEl?.offsetHeight ?? 52) + 8;
    }
    if (window.matchMedia("(min-width: 1280px)").matches) return 148;
    if (window.matchMedia("(min-width: 1024px)").matches) return 140;
    if (window.matchMedia("(min-width: 768px)").matches) return 132;
    return 124;
  }, [siteHeaderHeight]);

  useEffect(() => {
    const updateSidebarTop = () => setSidebarStickyTop(getDetailStickyOffset());
    updateSidebarTop();
    window.addEventListener("resize", updateSidebarTop);
    const tabsEl = document.getElementById("restaurant-tabs");
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateSidebarTop) : null;
    if (tabsEl) ro?.observe(tabsEl);
    return () => {
      window.removeEventListener("resize", updateSidebarTop);
      ro?.disconnect();
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

  // Highlight sticky tab from scroll position (About → Menu → Photos → Reviews)
  useEffect(() => {
    if (activeTab === "Book a Table") return;

    const syncActiveTabFromScroll = () => {
      if (scrollSpyPausedRef.current) return;
      const offset = getDetailStickyOffset();
      let currentId: string = DETAIL_SECTION_TABS[0].id;
      for (const tab of DETAIL_SECTION_TABS) {
        const el = document.getElementById(tab.sectionId);
        if (!el) continue;
        // Last section whose top has crossed under the sticky tabs line wins
        if (el.getBoundingClientRect().top - offset <= 0) {
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
  const [selectedPlatformOffer, setSelectedPlatformOffer] = useState<DiningEligiblePlatformOffer | null>(null);
  const [noOfferSelected, setNoOfferSelected] = useState(false);
  const allDiningOffers = normalizeDiningOffers(profile?.dining_offers);
  const visibleOffers = allDiningOffers.filter(isDiningOfferCustomerVisible);
  const bookableOffers = allDiningOffers.filter(isDiningOfferRedeemable);
  const { data: platformOffers = [], refetch: refetchPlatformOffers } = useGetDiningEligiblePlatformOffersQuery(
    {
      restaurant_id: resolvedParams.id,
      ...(authUser?.role === 'customer' && authUser.phone
        ? { guest_phone: authUser.phone }
        : {}),
    },
    { skip: !resolvedParams.id, refetchOnMountOrArgChange: true }
  );
  const hasAnyBookableOffer = bookableOffers.length > 0 || platformOffers.length > 0;
  const appliedOffer = noOfferSelected
    ? null
    : selectedPlatformOffer
      ? {
          source: 'platform' as const,
          id: selectedPlatformOffer.id,
          offer_id: selectedPlatformOffer.id,
          type: 'BookMyBota Offer',
          title: selectedPlatformOffer.name,
          validity: '',
          promo_code: selectedPlatformOffer.code,
          discount_type: selectedPlatformOffer.discount_type,
          discount_value: selectedPlatformOffer.discount_value,
          max_discount: selectedPlatformOffer.max_discount ?? null,
          min_bill_amount: selectedPlatformOffer.min_order_amount,
        }
      : selectedOffer
        ? snapshotDiningOffer(bookableOffers, selectedOffer)
        : null;
  const widgetOfferLabel = bookingWidgetOfferLabel(profile?.dining_offers);
  const offerChipLabel =
    visibleOffers.length > 0 || platformOffers.length > 0
      ? `${visibleOffers.length + platformOffers.length} offer${visibleOffers.length + platformOffers.length > 1 ? "s" : ""}`
      : "";
  const [offersSectionOpen, setOffersSectionOpen] = useState(true);
  const [availabilityStatus, setAvailabilityStatus] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    if (authUser?.role === 'customer') {
      void refetchPlatformOffers();
    }
  }, [authUser?.customer_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hasAnyBookableOffer) {
      setSelectedOffer(null);
      setSelectedPlatformOffer(null);
      setNoOfferSelected(true);
      return;
    }
    // Drop platform selection if no longer eligible after login
    if (selectedPlatformOffer && !platformOffers.some((o) => o.id === selectedPlatformOffer.id)) {
      setSelectedPlatformOffer(null);
      if (bookableOffers.length > 0) {
        setSelectedOffer(bookableOffers[0]);
        setNoOfferSelected(false);
      } else if (platformOffers.length > 0) {
        setSelectedPlatformOffer(platformOffers[0]);
        setNoOfferSelected(false);
      } else {
        setNoOfferSelected(true);
      }
      return;
    }
    if (!noOfferSelected && !selectedOffer && !selectedPlatformOffer) {
      if (platformOffers.length > 0) {
        setSelectedPlatformOffer(platformOffers[0]);
        setSelectedOffer(null);
        setNoOfferSelected(false);
      } else if (bookableOffers.length > 0) {
        setSelectedOffer(bookableOffers[0]);
        setSelectedPlatformOffer(null);
        setNoOfferSelected(false);
      }
    }
  }, [profile?.dining_offers, platformOffers]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drawer & Auth states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerStep, setDrawerStep] = useState(1); // 1: Selections, 2: Login/OTP/Register, 3: Summary, 4: Success
  // Radio-style meal accordion — only one section open at a time
  const [activeMealSection, setActiveMealSection] = useState<'breakfast' | 'lunch' | 'dinner' | null>('lunch');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [bookingPolicyOpen, setBookingPolicyOpen] = useState(false);
  const [bookingPolicyFocus, setBookingPolicyFocus] = useState<DiningBookingPolicySection>("terms");
  const [bookingDropdownOpen, setBookingDropdownOpen] = useState<'date' | 'guests' | 'meal' | null>(null);
  const bookingFiltersRef = useRef<HTMLDivElement>(null);

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
    if (activeTab === "Book a Table" && drawerStep === 3 && selectedTime && resolvedParams.id) {
      checkAvailability();
    }
  }, [activeTab, drawerStep, selectedTime, guests]);

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

  const photos = profile
    ? (uploadedPhotos.length > 0 ? uploadedPhotos : getPhotosForVenue(profile.type_name, profile.cover_image_url))
    : [];
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
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, lightboxItems.length]);

  const bookingDates = getBookingDates();

  // Find if selected day is closed
  const isSelectedDayClosed = (() => {
    if (!profile) return false;
    const targetDate = bookingDates[selectedDateIndex];
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = days[targetDate.getDay()];
    const dayRules = profile.operating_hours ? profile.operating_hours[dayOfWeek] : null;
    return dayRules?.closed === true;
  })();

  const timeSlots = generateTimeSlots(selectedDateIndex, profile?.operating_hours, bookingDates[selectedDateIndex]);

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

  // Reviews Local State
  const [newReviewText, setNewReviewText] = useState("");
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewUser, setNewReviewUser] = useState("");

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
      const res = await fetch(
        `http://localhost:5000/api/bookings/availability?business_id=${resolvedParams.id}&date=${bookingDateTime}&guests=${guests}`
      );
      const data = await res.json();
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
        business_id: resolvedParams.id,
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

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewUser.trim() || !newReviewText.trim()) return;
    try {
      await createReview({
        businessId: resolvedParams.id,
        user_name: newReviewUser,
        rating: newReviewRating,
        text: newReviewText
      }).unwrap();
      setNewReviewUser("");
      setNewReviewText("");
      setNewReviewRating(5);
      toast.success("Review submitted successfully!");
    } catch (err) {
      console.error("Failed to submit review", err);
      toast.error("Error submitting review.");
    }
  };

  const [replyingToReviewId, setReplyingToReviewId] = useState<number | null>(null);
  const [replyUser, setReplyUser] = useState("");
  const [replyText, setReplyText] = useState("");

  const handleAddReply = async (e: React.FormEvent, reviewId: number) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    try {
      const isOwner = authUser?.business_id === resolvedParams.id;
      await createReviewReply({
        reviewId,
        businessId: resolvedParams.id,
        user_name: isOwner ? (profile?.name || "Business Owner") : (replyUser || "Customer"),
        user_type: isOwner ? "owner" : "customer",
        text: replyText
      }).unwrap();
      setReplyText("");
      setReplyUser("");
      setReplyingToReviewId(null);
      toast.success("Reply added successfully!");
    } catch (err) {
      console.error("Failed to submit reply", err);
      toast.error("Error submitting reply.");
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
    scrollToTabPanelStart();
  };

  const closeBookingPanel = () => {
    setActiveTab("Overview");
    setIsDrawerOpen(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400">
        <div className="text-center">
          <Loader2 size={36} className="animate-spin text-rose-600 mx-auto mb-3" />
          <p className="text-sm font-semibold">Loading venue details...</p>
        </div>
      </div>
    );
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
  const ratingValue = Number(profile.rating || 4.5).toFixed(1);
  const reviewsCount = profile.reviews_count || 120;

  // Calculate dynamic timing details based on database operating hours
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const todayDayName = daysOfWeek[new Date().getDay()];
  const todayRules = profile?.operating_hours?.[todayDayName];

  let todayOpen = "08:00";
  let todayClose = "23:30";
  let isClosedToday = false;

  if (todayRules) {
    if (todayRules.closed) {
      isClosedToday = true;
    } else {
      todayOpen = todayRules.open || "08:00";
      todayClose = todayRules.close || "23:30";
    }
  } else {
    // Fallback: Fri-Sun: 8:00 AM - 1:00 AM, Mon-Thu: 8:00 AM - 11:30 PM
    if (['friday', 'saturday', 'sunday'].includes(todayDayName)) {
      todayOpen = "08:00";
      todayClose = "01:00";
    } else {
      todayOpen = "08:00";
      todayClose = "23:30";
    }
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
  const timingText = isClosedToday
    ? "Closed Today"
    : `${todayOpenFormatted} - ${todayCloseFormatted} (Today)`;
  const cuisines = profile.cuisine || "Continental, Italian, Fast Food";
  const cuisineList = cuisines
    .replace(/·/g, ",")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

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

  return (
    <div className="min-h-screen bg-white text-slate-700">

      {/* ── 1. Breadcrumbs ── */}
      <div className="bg-white border-b border-slate-100 py-3">
        <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
          <Link href="/" className="hover:text-rose-600 transition-colors">Home</Link>
          <ChevronRight size={10} />
          <Link href="/" className="hover:text-rose-600 transition-colors">{country}</Link>
          <ChevronRight size={10} />
          <Link href={`/?city=${encodeURIComponent(city)}`} className="hover:text-rose-600 transition-colors">{city}</Link>
          <ChevronRight size={10} />
          <Link href={`/?filter=${encodeURIComponent(profile.type_name || 'Restaurant')}`} className="hover:text-rose-600 transition-colors">{profile.type_name || 'Restaurants'}</Link>
          <ChevronRight size={10} />
          <span className="text-slate-600">{profile.name}</span>
        </div>
      </div>

      <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 py-2">
        {/* ── Restaurant header (Zomato: details + actions) ── */}
        <div className="bg-white pt-2 mb-3">
          {/* Row 1: title left · rating right */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl sm:text-4xl lg:text-[2.5rem] font-semibold text-slate-900 tracking-tight leading-tight">
                {profile.name}
              </h1>
              <p className="text-slate-600 text-lg sm:text-xl lg:text-base mt-1 font-medium">{cuisines}</p>
              <p className="text-slate-500 text-base sm:text-lg lg:text-sm mt-1 flex items-center gap-1.5">
                <MapPin size={13} className="text-[#6900AA] shrink-0" />
                <span>{profile.address || 'Address hidden'}</span>
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-emerald-600 text-white rounded-md px-3 py-2 flex items-center gap-1.5 shadow-sm">
                <span className="font-bold text-lg leading-none">{ratingValue}</span>
                <Star size={15} className="fill-white" />
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm lg:text-xs font-bold text-slate-800 uppercase tracking-wide">Dine-out rating</p>
                <p className="text-slate-500 text-sm lg:text-xs font-medium">{reviewsCount} Reviews</p>
              </div>
            </div>
          </div>

          {/* Row 2: open-time left · Direction / Share / Reviews / Book a Table right (same line) */}
          <div className="mt-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base sm:text-lg lg:text-sm text-slate-500 min-w-0">
                {isOpenNow ? (
                  <span className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5 text-emerald-600 font-semibold text-xs">
                    Open now
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-slate-200 px-2.5 py-0.5 text-rose-600 font-semibold text-xs">
                    Closed
                  </span>
                )}
                <span>{timingText}</span>
                <span>·</span>
                <span>{costText}</span>
                {profile.phone && (
                  <>
                    <span>·</span>
                    <a href={`tel:${profile.phone}`} className="text-[#6900AA] hover:underline inline-flex items-center gap-1">
                      <Phone size={12} />
                      {profile.phone}
                    </a>
                  </>
                )}
              </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 lg:justify-end">
            <button
                type="button"
              onClick={() => {
                if (profile.address) {
                  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}`, '_blank', 'noopener,noreferrer');
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-slate-700 text-sm font-semibold border border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <Compass size={14} className="text-[#6900AA]" />
              {copied ? "Copied!" : "Direction"}
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-slate-700 text-sm font-semibold border border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <Share2 size={14} className="text-[#6900AA]" />
              Share
            </button>
            <button
                type="button"
                onClick={() => scrollToDetailSection("section-reviews", "Reviews")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-slate-700 text-sm font-semibold border border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <MessageSquare size={14} className="text-[#6900AA]" />
              Reviews
            </button>
            <button
                type="button"
              onClick={() => handleQuickBook()}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border transition-all cursor-pointer ${
                activeTab === "Book a Table"
                  ? "border-[#6900AA] text-[#6900AA] bg-[#f7e9ff]"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Calendar size={14} className="text-[#6900AA]" />
              Book a Table
            </button>
          </div>
          </div>
        </div>

        {/* ── Image Collage ── */}
        <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[260px] md:h-[380px] rounded-2xl overflow-hidden shadow-sm border border-slate-100 mb-0 bg-slate-100">
          {photos.slice(0, 5).map((photoUrl, idx) => {
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
                <img
                  src={photoUrl}
                  alt={`gallery item ${idx}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
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
          })}
        </div>


      </div>

        {/* ── Sticky tabs (stick under site header once you scroll to them) ── */}
        <div ref={tabsSentinelRef} className="h-0 mt-6" aria-hidden />
        <div
          id="restaurant-tabs"
          className={`sticky z-40 bg-white border-b border-slate-200 ${
            tabsStuck ? "shadow-[0_4px_12px_rgba(15,23,42,0.08)]" : ""
          }`}
          style={{ top: siteHeaderHeight > 0 ? siteHeaderHeight : 124 }}
        >
          <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0">
          <div className="flex gap-6 overflow-x-auto scrollbar-hide">
            {DETAIL_SECTION_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => scrollToDetailSection(tab.sectionId, tab.id)}
                className={`py-3.5 text-base sm:text-lg lg:text-sm font-semibold tracking-wide border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? "border-[#6900AA] text-[#6900AA] font-bold"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {tab.id}
              </button>
            ))}
          </div>
          </div>
        </div>

        {/* ── Page Body ── */}
        <div className="container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 pb-12 sm:pb-16">
        {(() => {
          const hideBookingSidebar =
            activeTab === "Book a Table" && (drawerStep === 3 || drawerStep === 4);
          return (
        <div className={`grid grid-cols-1 gap-10 items-start pt-8 ${hideBookingSidebar ? '' : 'lg:grid-cols-3'}`}>

          {/* Main Column */}
          <div
            id="tab-panel-start"
            className={`${hideBookingSidebar ? 'col-span-full' : 'lg:col-span-2'} space-y-8 scroll-mt-[7.5rem] md:scroll-mt-[8rem] lg:scroll-mt-[9rem] xl:scroll-mt-[9.25rem]`}
          >

            {/* Single-page Overview with scroll-spy sections (District-style) */}
            {activeTab !== "Book a Table" && (
              <div className="space-y-8">

                {/* Overview first — About the Venue (+ offers if any) */}
                <div id="section-overview" className="scroll-mt-[7.5rem] md:scroll-mt-[8rem] lg:scroll-mt-[9rem] xl:scroll-mt-[9.25rem] space-y-8">
                  {/* About Venue & Average Cost */}
                  <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
                    <h3 className="text-2xl sm:text-3xl lg:text-xl font-bold text-zinc-800 mb-3">About the Venue</h3>
                    <p className="text-slate-500 text-base sm:text-lg lg:text-sm leading-relaxed whitespace-pre-wrap">
                      {profile.description || 'This venue has not provided a description yet. Enjoy a curated dining experience with premium seats, lovely ambiance, and delicious gourmet specialties.'}
                    </p>

                    <h4 className="text-lg sm:text-xl lg:text-base font-bold text-zinc-800 mt-6 mb-1">Average Cost</h4>
                    <p className="text-base sm:text-lg lg:text-sm text-slate-600 font-medium">{costText}</p>
                    <p className="text-base  lg:text-sm text-slate-400 mt-1">Exclusive of applicable taxes and charges, if any</p>

                    {profile.amenities && profile.amenities.length > 0 && (
                      <>
                        <h4 className="text-lg sm:text-xl lg:text-base font-bold text-zinc-800 mt-6 mb-3">More Info</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
                          {profile.amenities.map((info: string) => (
                            <div key={info} className="flex items-center gap-2 text-base sm:text-lg lg:text-sm text-slate-600">
                              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                                <Check size={10} strokeWidth={3} />
                              </span>
                              <span>{info}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </section>

                  {visibleOffers.length > 0 && (
                <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
                  <h3 className="text-2xl sm:text-3xl lg:text-xl font-bold text-zinc-800">Dining Offers</h3>
                  {visibleOffers.length > 1 && (
                    <p className="text-base sm:text-lg lg:text-sm text-zinc-500 mt-0.5 mb-4">Tap on any offer to know more</p>
                  )}
                  {visibleOffers.length <= 1 && <div className="mb-4" />}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
                  )}
                </div>

                {/* Menu — bordered card, cuisine pills, stack preview → lightbox */}
                <section
                  id="section-menu"
                  className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 scroll-mt-[7.5rem] md:scroll-mt-[8rem] lg:scroll-mt-[9rem] xl:scroll-mt-[9.25rem]"
                >
                  <div className="flex items-center justify-between gap-3 mb-4">
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

                  <h4 className="text-sm font-semibold text-[#9a7b2f] mb-2.5">Cuisines</h4>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {cuisineList.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#e8d9a8] text-[#9a7b2f] text-sm font-medium"
                      >
                        <span className="text-[0.625rem] leading-none" aria-hidden>✦</span>
                        {c}
                        <span className="text-[0.625rem] leading-none" aria-hidden>✦</span>
                      </span>
                    ))}
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
                  className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm scroll-mt-[7.5rem] md:scroll-mt-[8rem] lg:scroll-mt-[9rem] xl:scroll-mt-[9.25rem]"
                >
                  <h3 className="text-xl sm:text-2xl lg:text-lg font-bold text-slate-800 mb-5">Photos Gallery</h3>
                  <VenuePhotosGallery
                    urls={venueGalleryPhotos}
                    onOpen={(index, items) => openLightbox(index, items)}
                  />
              </section>

                {/* Reviews — same UI as before, shown in Overview scroll */}
                <div
                  id="section-reviews"
                  className="space-y-6 scroll-mt-[7.5rem] md:scroll-mt-[8rem] lg:scroll-mt-[9rem] xl:scroll-mt-[9.25rem]"
                >
                {/* Write Review Form */}
                <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="text-lg sm:text-xl lg:text-base font-bold text-slate-800 mb-4">Write a Review</h3>
                  <form onSubmit={handleAddReview} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-base sm:text-lg lg:text-sm font-medium text-slate-400 mb-1">Your Name</label>
                        <input
                          type="text"
                          required
                          value={newReviewUser}
                          onChange={(e) => setNewReviewUser(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm sm:text-base lg:text-xs focus:outline-none focus:border-rose-500"
                          placeholder="E.g., Priya R."
                        />
                      </div>
                      <div>
                        <label className="block text-base lg:text-xs font-medium text-slate-400 mb-2">Rating</label>
                        <div className="h-9 flex items-center">
                          <StarRatingInput value={newReviewRating} onChange={setNewReviewRating} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-base lg:text-xs font-medium text-slate-400 mb-1">Comment</label>
                      <textarea
                        required
                        rows={3}
                        value={newReviewText}
                        onChange={(e) => setNewReviewText(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm lg:text-xs focus:outline-none focus:border-rose-500"
                        placeholder="Write details about food, staff, service..."
                      />
                    </div>
                    <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-4 py-2 text-base lg:text-xs font-bold transition-all shadow-sm">
                      Submit Review
                    </button>
                  </form>
                </section>

                {/* Review Feed */}
                <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-5 divide-y divide-slate-100">
                  <h3 className="text-lg sm:text-xl lg:text-base font-bold text-slate-800 mb-2">User Reviews</h3>
                  {reviews.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No reviews yet. Be the first to leave one!</p>}
                  {reviews.map((rev: any, idx: number) => (
                    <div key={rev.id} className={`${idx > 0 ? "pt-5" : ""} flex gap-3`}>
                      <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-200">
                        {(rev.user_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-baselg:text-xs font-bold text-slate-800">{rev.user_name}</p>
                          <p className="text-[1rem] sm:text-[0.625rem] text-slate-400 font-medium">
                            {new Date(rev.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="flex items-center gap-0.5 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-md text-sm sm:text-base lg:text-[0.625rem] text-emerald-600 font-bold">
                            <span>{rev.rating}</span>
                            <Star size={8} className="fill-emerald-600" />
                          </div>
                        </div>
                        <p className="text-base lg:text-xs text-slate-600 mt-2 leading-relaxed">
                          {rev.text}
                        </p>

                        {/* Render Nested Replies */}
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

                        {/* Reply Form Toggle */}
                        <div className="mt-3">
                          {replyingToReviewId === rev.id ? (
                            <form onSubmit={(e) => handleAddReply(e, rev.id)} className="bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2">
                              <div className="flex items-center gap-2 mb-2">
                                <input
                                  type="text"
                                  required
                                  value={replyUser}
                                  onChange={(e) => setReplyUser(e.target.value)}
                                  placeholder="Your Name"
                                  className="text-base lg:text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-rose-500 w-1/3"
                                />
                              </div>
                              <textarea
                                required
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write your reply..."
                                className="w-full text-base lg:text-xs border border-slate-200 rounded p-2 outline-none focus:border-rose-500 min-h-[60px]"
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => setReplyingToReviewId(null)}
                                  className="text-base lg:text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  className="text-base lg:text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg"
                                >
                                  Post Reply
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              onClick={() => {
                                setReplyingToReviewId(rev.id);
                                setReplyText("");
                                setReplyUser("");
                              }}
                              className="text-base lg:text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors"
                            >
                              Reply to review
                            </button>
                          )}
                        </div>
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

          {/* Right Sidebar Column — hidden on confirm/success for full-width booking flow */}
          {!hideBookingSidebar && (
          <div
            ref={bookingWidgetRef}
            className="lg:col-span-1 space-y-6 lg:sticky z-30 self-start"
            style={{ top: sidebarStickyTop }}
          >

              {/* Book a Table step 1: animation only on the right */}
              {activeTab === "Book a Table" && drawerStep === 1 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm">
                  <GuestTableAnimation count={Number(guests)} />
                </div>
              ) : (
                <>
              {/* Table Reservation Widget — District-style card */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden p-4">
                <div className="flex items-start gap-2.5 sm:gap-4">
                  {/* <img
                    src="/images/dining/offer-percent-3d.png"
                    alt=""
                    className="w-11 h-11 sm:w-12 sm:h-10 -rotate-10 object-contain shrink-0"
                    aria-hidden
                  /> */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-wide uppercase leading-tight">
                      Table reservation
                    </h3>
                  {widgetOfferLabel ? (
                      <p className="mt-1 text-sm text-slate-800 font-semibold leading-snug flex flex-wrap items-center gap-x-0.5">
                        {widgetOfferLabel.split(/(\d+%?\s*off|\d+\s*ETB\s*off)/i).map((part, idx) =>
                          /\d/i.test(part) && /off/i.test(part) ? (
                            <span key={idx} className="text-[#6900AA] font-bold">{part}</span>
                          ) : (
                            <span key={idx}>{part}</span>
                          )
                        )}
                        <ChevronRight size={15} className="inline shrink-0 text-slate-800 ml-0.5" />
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-600 font-medium leading-snug">
                        Reserve a table at this venue
                      </p>
                    )}
                  </div>
                  <img
                    src="/images/dining/tag-removebg-preview.png"
                    alt=""
                    className="w-12 h-12 sm:w-14 sm:h-12 object-contain shrink-0"
                    aria-hidden
                  />
                </div>

                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6900AA] pointer-events-none z-[1]" />
                      <select
                        value={selectedDateIndex}
                        onChange={(e) => handleDateSelect(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-full pl-9 pr-8 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#6900AA]/40 appearance-none cursor-pointer"
                      >
                        {bookingDates.map((d, idx) => {
                          let label = "";
                          if (idx === 0) label = "Today";
                          else if (idx === 1) label = "Tomorrow";
                          else label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                          return (
                            <option key={idx} value={idx}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>

                    <div className="relative">
                      <Users size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6900AA] pointer-events-none z-[1]" />
                      <select
                        value={guests}
                        onChange={(e) => { setGuests(e.target.value); setAvailabilityStatus(null); }}
                        className="w-full bg-white border border-slate-200 rounded-full pl-9 pr-8 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:border-[#6900AA]/40 appearance-none cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <option key={num} value={num}>
                            {num} {num === 1 ? 'guest' : 'guests'}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleQuickBook()}
                    className="w-full rounded-full border border-[#6900AA] bg-[#efd7ff] text-[#6900AA] py-2.5 px-4 text-sm sm:text-base font-bold transition-all cursor-pointer flex items-center justify-center gap-1 hover:bg-[#efd7ff]"
                  >
                    Book a table
                    <ChevronRight size={16} className="shrink-0" />
                  </button>
                </div>
              </div>

              {/* Direction card (replaces Call Venue / Timing) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm">
                <h3 className="text-xl sm:text-2xl lg:text-lg font-bold text-zinc-800 mb-2">Direction</h3>
                <p className="text-base sm:text-lg lg:text-sm text-zinc-500 leading-relaxed mb-4">
                  {profile.address || "Address hidden"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-base lg:text-xs font-semibold text-zinc-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Copy size={14} className="text-zinc-500" />
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (profile.address) {
                        window.open(
                          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}`,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-base lg:text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Navigation size={14} />
                    Direction
                  </button>
                </div>
              </div>
                </>
              )}

            </div>
          )}

          </div>
          );
        })()}

          {/* Similar Restaurants Horizontal Shelf */}
          {similarRestaurants.length > 0 && (
            <div className="mt-12 pt-10 border-t border-slate-200 animate-fadeIn">
              <div className="flex items-center justify-between mb-6">
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
                  const rating = Number(restaurant.rating || 4.2).toFixed(1);
                  const cuisine = restaurant.cuisine || "Italian, Chinese, Continental";
                  const coverImg = restaurant.cover_image_url || "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
                  const locality = restaurant.address ? restaurant.address.split(",")[0].trim() : "";
                  const priceForTwo = restaurant.average_cost
                    ? `${formatMoney(restaurant.average_cost, { compact: true })} for two`
                    : `${formatMoney(1200, { compact: true })} for two`;

                  return (
                    <Link
                      key={restaurant.id}
                      href={`/restaurant/${restaurant.id}`}
                      className="group block bg-white hover:shadow-lg rounded-2xl p-3 border border-slate-100 hover:border-slate-200 transition-all duration-300 w-[280px] shrink-0 snap-start"
                    >
                      <div className="relative h-44 rounded-xl overflow-hidden bg-slate-100 mb-3">
                        <img
                          src={coverImg}
                          alt={restaurant.name}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80";
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                      </div>

                      <div className="px-1 pb-1">
                        <h4 className="font-extrabold text-slate-800 text-base leading-tight truncate group-hover:text-rose-600 transition-colors">
                          {restaurant.name}
                        </h4>

                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="bg-emerald-700 text-white text-[0.625rem] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <span>{rating}</span>
                            <span className="text-[0.5rem]">★</span>
                          </span>
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
          <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between py-6 px-4 select-none animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-center max-w-7xl mx-auto w-full text-white">
              <span className="text-sm font-semibold tracking-wider text-slate-300 font-mono">
                {currentPhotoIdx + 1} of {lightboxItems.length}
              </span>
              <button
                onClick={closeLightbox}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white cursor-pointer"
                aria-label="Close gallery"
              >
                <X size={24} />
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex items-center container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 justify-between w-full gap-2 sm:gap-4 my-4 relative">
              {/* Left Button */}
              {lightboxItems.length > 1 ? (
                <button
                  onClick={prevPhoto}
                  className="p-2 sm:p-3 bg-white/5 hover:bg-white/15 active:scale-95 text-white rounded-full transition-all cursor-pointer backdrop-blur-sm shadow-lg border border-white/10 shrink-0"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={24} />
                </button>
              ) : (
                <div className="w-10 sm:w-12 shrink-0" />
              )}

              {/* Current Image Container */}
              <div className="flex-1 h-full flex items-center justify-center overflow-auto px-1 sm:px-2">
                <img
                  src={lightboxItems[currentPhotoIdx]}
                  alt={`Gallery image ${currentPhotoIdx + 1}`}
                  className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl transition-all duration-300 select-none bg-white"
                />
              </div>

              {/* Right Button */}
              {lightboxItems.length > 1 ? (
                <button
                  onClick={nextPhoto}
                  className="p-2 sm:p-3 bg-white/5 hover:bg-white/15 active:scale-95 text-white rounded-full transition-all cursor-pointer backdrop-blur-sm shadow-lg border border-white/10 shrink-0"
                  aria-label="Next image"
                >
                  <ChevronRight size={24} />
                </button>
              ) : (
                <div className="w-10 sm:w-12 shrink-0" />
              )}
            </div>

            {/* Thumbnails Row */}
            {lightboxItems.length > 1 && (
              <div className="max-w-4xl mx-auto w-full overflow-x-auto py-2 flex justify-center gap-2.5 px-4 scrollbar-hide">
                {lightboxItems.map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPhotoIdx(idx)}
                    className={`w-16 h-12 rounded-lg overflow-hidden shrink-0 transition-all border-2 cursor-pointer ${currentPhotoIdx === idx
                      ? 'border-rose-500 scale-105 opacity-100 shadow-md'
                      : 'border-transparent opacity-50 hover:opacity-80'
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

            {/* Panel Content */}
            <div className={`${drawerStep === 3 ? 'p-4 sm:p-6 bg-white' : drawerStep === 1 ? 'pt-1 pb-2 bg-white' : 'p-5 bg-white'}`}>
              {drawerStep === 1 && (() => {
                const mealsConfig = (profile.operating_hours as any)?.meals || {
                  breakfast: { open: '08:00', close: '11:00', active: true },
                  lunch: { open: '11:30', close: '16:00', active: true },
                  dinner: { open: '17:00', close: '23:00', active: true }
                };

                const isToday = selectedDateIndex === 0;
                const breakfastSlots = mealsConfig.breakfast?.active
                  ? generateSlotsForMeal(mealsConfig.breakfast.open, mealsConfig.breakfast.close, isToday)
                  : [];
                const lunchSlots = mealsConfig.lunch?.active
                  ? generateSlotsForMeal(mealsConfig.lunch.open, mealsConfig.lunch.close, isToday)
                  : [];
                const dinnerSlots = mealsConfig.dinner?.active
                  ? generateSlotsForMeal(mealsConfig.dinner.open, mealsConfig.dinner.close, isToday)
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
                    <h4 className="text-xl font-semibold text-slate-900 tracking-tight">
                      Select your booking details
                    </h4>

                    <div className="space-y-5 bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
                    {/* Number of guest(s) — chip row */}
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-3">Number of guest(s)</p>
                      <div className="flex flex-wrap gap-2.5">
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

                    {/* When are you visiting? — horizontal day strip */}
                    <div>
                      <p className="text-sm font-semibold text-slate-800 mb-3">When are you visiting?</p>
                      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
                        {bookingDates.map((d, idx) => {
                          const labels = formatDateLabel(d, idx);
                          const selected = selectedDateIndex === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleDateSelect(idx)}
                              className={`min-w-[72px] sm:min-w-[78px] shrink-0 rounded-xl px-2.5 py-2.5 text-center transition-all cursor-pointer ${
                                    selected
                                  ? 'border border-[#6900AA] bg-[#f7e9ff]'
                                  : 'border border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <p className={`text-sm font-semibold leading-tight ${selected ? 'text-[#6900AA]' : 'text-slate-700'}`}>
                                {labels.top}
                              </p>
                              <p className={`text-[0.8rem] font-medium mt-0.5 leading-tight ${selected ? 'text-[#6900AA]' : 'text-slate-500'}`}>
                                {labels.bottom}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Meal period accordions + time slots */}
                    <div className="space-y-3 pt-1">
                      <p className="text-sm font-semibold text-slate-800">
                        Select the time of day to see the offers
                      </p>

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
                              )}
                            </div>

                    {/* Choose an offer — merchant + BookMyBota platform offers */}
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
                            {platformOffers.map((offer, idx) => {
                              const isActive =
                                !noOfferSelected && selectedPlatformOffer?.id === offer.id;
                              return (
                                <button
                                  key={`platform-${offer.id}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPlatformOffer(offer);
                                    setSelectedOffer(null);
                                    setNoOfferSelected(false);
                                  }}
                                  className={`relative w-[220px] sm:w-[240px] text-left rounded-xl border bg-white px-4 py-3.5 pt-4 transition-all cursor-pointer overflow-visible ${
                                    isActive
                                      ? "border-[#6900AA] shadow-sm"
                                      : "border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  <span className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-[#6900AA] flex items-center justify-center text-white text-[0.55rem] font-bold shadow-sm leading-none px-0.5 text-center">
                                    BMB
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
                                  <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-[#6900AA] pl-8 pr-5">
                                    BookMyBota
                                    {offer.customer_eligibility === 'NEW' ? ' · New customers' : ''}
                                  </p>
                                  <p className="text-base font-bold text-slate-900 mt-0.5 pl-8 pr-5 leading-snug">
                                    {offer.name}
                                  </p>
                                  <p className="text-xs font-medium text-[#2563EB] mt-1 pl-8 pr-5">
                                    {offer.discount_label}
                                    {offer.code ? ` · ${offer.code}` : ''}
                                  </p>
                                  {offer.min_order_amount > 0 && (
                                    <p className="text-[0.625rem] text-slate-400 mt-1 pl-8 pr-5">
                                      Min bill {offer.min_order_amount} ETB at restaurant
                                    </p>
                                  )}
                                </button>
                              );
                            })}

                            {bookableOffers.map((offer, idx) => {
                              const isActive =
                                !noOfferSelected &&
                                !selectedPlatformOffer &&
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
                                    setSelectedPlatformOffer(null);
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
                                setSelectedPlatformOffer(null);
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
                            className="w-full max-w-sm sm:max-w-md py-3.5 rounded-xl bg-primary hover:bg-[#57008E] text-white text-sm font-bold transition-colors cursor-pointer shadow-sm"
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
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] gap-5 lg:gap-6 items-start">
                    {/* Left — booking confirmed (Zomato-style) */}
                    <div className="min-w-0">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5">
                      <div className="flex items-center justify-center gap-2 mb-1.5">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 shrink-0">
                          <Check size={16} strokeWidth={2.75} className="text-emerald-700" />
                        </span>
                        <p className="m-0 text-base sm:text-lg font-bold text-emerald-600 tracking-tight leading-none">
                          Success
                        </p>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight mb-1.5">Booking confirmed</h3>
                      <p className="text-sm text-zinc-500 font-medium leading-relaxed mb-4">
                        <strong className="text-zinc-800">{profile.name}</strong> has confirmed your booking. Have a great meal!
                      </p>

                      {appliedOffer?.title && (
                        <div className="rounded-lg bg-[#eef5ff] text-[#2563eb] text-xs font-semibold px-3 py-2.5 mb-4">
                          Show this QR at the restaurant to avail {appliedOffer.title}.
                      </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 py-4 border-y border-dashed border-zinc-200">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Calendar size={18} className="text-zinc-500 shrink-0 mt-0.5" strokeWidth={1.75} />
                          <p className="text-sm font-semibold text-zinc-900 leading-snug">
                            {selectedDateIndex === 0 ? 'Today' : selectedDateIndex === 1 ? 'Tomorrow' : bookingDates[selectedDateIndex].toLocaleDateString('en-IN', { weekday: 'short' })}{' '}
                            {bookingDates[selectedDateIndex].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{' '}
                            at {formatSlotLabel(selectedTime)}
                          </p>
                      </div>
                        <div className="flex items-start gap-2.5 min-w-0">
                          <Users size={18} className="text-zinc-500 shrink-0 mt-0.5" strokeWidth={1.75} />
                          <p className="text-sm font-semibold text-zinc-900">
                            {guests} {Number(guests) === 1 ? 'guest' : 'guests'}
                          </p>
                      </div>
                        <div className="flex items-start gap-2.5 min-w-0">
                          <MapPin size={18} className="text-zinc-500 shrink-0 mt-0.5" strokeWidth={1.75} />
                          <p className="text-sm font-semibold text-zinc-900 leading-snug">
                            {profile.name}{city ? `, ${city}` : ''}
                          </p>
                      </div>
                        {appliedOffer?.title ? (
                          <div className="flex items-start gap-2.5 min-w-0">
                            <Tag size={18} className="text-[#2563eb] shrink-0 mt-0.5" strokeWidth={1.75} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-zinc-900 leading-snug">{appliedOffer.title}</p>
                              {appliedOffer.validity && (
                                <p className="text-xs text-zinc-500 mt-0.5">{appliedOffer.validity}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2.5 min-w-0">
                            <Clock size={18} className="text-zinc-500 shrink-0 mt-0.5" strokeWidth={1.75} />
                            <div className="min-w-0">
                              <p className="text-xs text-zinc-400 font-medium">Arrival</p>
                              <p className="text-sm font-semibold text-zinc-900">{arrivalTime}</p>
                            </div>
                          </div>
                        )}
                    </div>

                      {lastBookingId && (
                        <div className="mt-4 flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-zinc-400 font-medium mb-0.5">Booking ID</p>
                            <p className="text-xs sm:text-sm font-bold text-zinc-900 break-all leading-relaxed">{lastBookingId}</p>
                          </div>
                          <button
                            type="button"
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
                            className="mt-4 shrink-0 text-zinc-400 hover:text-primary cursor-pointer"
                            aria-label="Copy booking ID"
                          >
                            {bookingIdCopied ? <CheckCheck size={16} /> : <Copy size={16} />}
                          </button>
                        </div>
                      )}

                      {lastBookingId && (
                        <button
                          type="button"
                          onClick={() => {
                            closeBookingPanel();
                            router.push(`/customer/bookings/${lastBookingId}`);
                          }}
                          className="mt-5 inline-flex items-center justify-center px-4 py-2 rounded-lg border border-primary bg-white text-primary text-sm font-semibold hover:bg-primary/5 transition-colors cursor-pointer w-fit"
                        >
                          View booking details
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={closeBookingPanel}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#6900AA] transition-colors cursor-pointer"
                    >
                      <ChevronLeft size={18} />
                      Back
                    </button>
                    </div>

                    {/* Right — venue card + check-in QR */}
                    <div className="space-y-4">
                      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
                        <div className="h-40 sm:h-44 bg-zinc-100 overflow-hidden">
                          <img
                            src={photos[0] || profile.cover_image_url || 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80'}
                            alt={profile.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=500&q=80';
                            }}
                          />
                        </div>
                        <div className="p-4">
                          <p className="text-base font-bold text-zinc-900 leading-snug">{profile.name}</p>
                          {(city || profile.address) && (
                            <p className="text-xs text-zinc-500 mt-0.5">{city || profile.address}</p>
                          )}
                          <div className="mt-3">
                            <p className="text-xs text-zinc-400 font-medium">Phone</p>
                            <a
                              href={`tel:${profile.phone || ''}`}
                              className="text-sm font-semibold text-zinc-800 hover:text-primary transition-colors"
                            >
                              {profile.phone || 'Not available'}
                            </a>
                          </div>
                          <div className="mt-4 pt-3 border-t border-dashed border-zinc-200 grid grid-cols-2 gap-2">
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
                              className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-zinc-200 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                            >
                              <Navigation size={14} />
                              Directions
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!profile.phone) {
                                  toast.error('Phone not available');
                                  return;
                                }
                                try {
                                  await navigator.clipboard.writeText(profile.phone);
                                  toast.success('Phone number copied');
                                } catch {
                                  toast.error('Could not copy number');
                                }
                              }}
                              className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-zinc-200 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                            >
                              <Copy size={14} />
                              Copy number
                      </button>
                    </div>
                  </div>
                      </div>

                      <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col items-center text-center">
                        <p className="text-base font-bold text-zinc-900">Check-in QR</p>
                        <p className="text-xs text-zinc-400 mt-0.5 mb-3 leading-snug">
                          Show this QR at the restaurant to claim your offer
                        </p>
                        {lastQrToken ? (
                          <div className="w-[168px] h-[168px] rounded-2xl border border-primary/20 bg-white p-2">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(lastQrToken)}`}
                              alt="Booking check-in QR code"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-[168px] h-[168px] rounded-2xl border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-400 text-xs font-medium px-4">
                            QR will appear once available for this booking.
                          </div>
                        )}
                        {selectedTime && (() => {
                          const [h, m] = selectedTime.split(':').map(Number);
                          if (Number.isNaN(h) || Number.isNaN(m)) return null;
                          const fmt = (totalMins: number) => {
                            const norm = ((totalMins % 1440) + 1440) % 1440;
                            const hh = Math.floor(norm / 60);
                            const mm = norm % 60;
                            return formatSlotLabel(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
                          };
                          const base = h * 60 + m;
                          return (
                            <div className="mt-3 w-full rounded-xl bg-primary/5 px-3 py-2.5 flex items-center gap-2.5 text-left">
                              <Clock size={16} className="text-primary shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs text-zinc-500 leading-tight">Check-in window</p>
                                <p className="text-xs font-bold text-zinc-900">{fmt(base - 30)} - {fmt(base + 15)}</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                </div>
              )}

            {/* Step 1 footer — Zomato-like proceed bar */}
            {drawerStep === 1 && (
              <div className="mt-8">
                <label className="flex items-start gap-2.5 cursor-pointer select-none mb-4">
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
                  className={`w-full py-3.5 rounded-md text-base font-semibold transition-all flex items-center justify-center ${selectedTime && acceptedTerms
                    ? 'bg-[#6900AA] hover:bg-[#57008E] text-white cursor-pointer'
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

        <DiningBookingPolicyModal
          open={bookingPolicyOpen}
          focusSection={bookingPolicyFocus}
          onClose={() => setBookingPolicyOpen(false)}
        />
      </div>
      );
}
