"use client";
import { useState, use, useRef, useEffect } from 'react';
import {
  MapPin, Phone, CheckCircle, Calendar, Users, Clock,
  Star, Share2, Compass, MessageSquare, Image as ImageIcon,
  BookOpen, AlertCircle, Sparkles, Copy, ChevronRight, Loader2,
  ChevronLeft, X, Sun, Moon
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useGetBusinessPublicQuery,
  useCreateBookingMutation,
  usePhoneLoginMutation,
  useRegisterCustomerMutation,
  useGetReviewsQuery,
  useCreateReviewMutation,
  useCreateReviewReplyMutation,
  useGetBusinessesQuery,
  useGetCollectionsQuery
} from '@/services/api';
import { useAppSelector, useAppDispatch } from '@/lib/hooks';
import { loadFromStorage, setCredentials } from '@/features/auth/authSlice';
import { getPhoneValidationError, isValidPhone, sanitizePhoneInput } from '@/lib/validation';

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

const getCostForTwo = (priceRange?: string) => {
  if (priceRange === "₹") return "₹250 for two (approx.)";
  if (priceRange === "₹₹") return "₹500 for two (approx.)";
  if (priceRange === "₹₹₹") return "₹1000 for two (approx.)";
  if (priceRange === "₹₹₹₹") return "₹2000 for two (approx.)";
  return "₹450 for two (approx.)";
};

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function RestaurantPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { data: profile, isLoading } = useGetBusinessPublicQuery(resolvedParams.id);
  const [createBooking] = useCreateBookingMutation();
  const { data: reviews = [] } = useGetReviewsQuery(resolvedParams.id, { skip: !resolvedParams.id });
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
  useEffect(() => { dispatch(loadFromStorage()); }, [dispatch]);

  // Scroll to top on restaurant change/mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [resolvedParams.id]);

  // Active Tab: Overview, Menu, Photos, Reviews
  const [activeTab, setActiveTab] = useState("Overview");

  // Booking Form State — date/time now driven by pill selectors
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedTime, setSelectedTime] = useState('');
  const [guests, setGuests] = useState('2');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [arrivalTime, setArrivalTime] = useState('On time');
  const [lastBookingId, setLastBookingId] = useState<string | null>(null);
  const [availabilityStatus, setAvailabilityStatus] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Drawer & Auth states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerStep, setDrawerStep] = useState(1); // 1: Selections, 2: Login/OTP/Register, 3: Summary, 4: Success
  // Radio-style meal accordion — only one section open at a time
  const [activeMealSection, setActiveMealSection] = useState<'breakfast' | 'lunch' | 'dinner' | null>('lunch');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loginStep, setLoginStep] = useState(1); // 1: Enter phone, 2: Enter OTP
  const [loginPhone, setLoginPhone] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [phoneLogin, { isLoading: isPhoneLoggingIn }] = usePhoneLoginMutation();
  const [registerCustomer, { isLoading: isRegistering }] = useRegisterCustomerMutation();

  // Pre-fill Name & Phone when authUser changes
  useEffect(() => {
    if (authUser && authUser.role === 'customer') {
      setName(authUser.name || '');
      setPhone(authUser.phone || '');
    }
  }, [authUser]);

  // Handle phone login submission
  const handlePhoneLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (loginStep === 1) {
      const phoneErr = getPhoneValidationError(loginPhone);
      if (phoneErr) {
        setLoginError(phoneErr);
        return;
      }
      setLoginStep(2);
      setLoginOtp('');
    } else {
      if (loginOtp !== '123456') {
        setLoginError('Invalid OTP. For demo purposes, please use 123456.');
        return;
      }
      try {
        const data = await phoneLogin({ phone: loginPhone, otp: loginOtp }).unwrap();
        dispatch(setCredentials({ user: data.user, token: data.token }));
        // Notify the header to update immediately (no page refresh needed)
        window.dispatchEvent(new Event('auth_changed'));
        setName(data.user.name || '');
        setPhone(data.user.phone || loginPhone);
        setDrawerStep(3);
      } catch (err: any) {
        setLoginError(err?.data?.error || 'Login failed. Please try again.');
      }
    }
  };

  // Handle customer registration submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!regName || !regEmail || !regPhone) {
      setLoginError('All fields are required.');
      return;
    }
    const phoneErr = getPhoneValidationError(regPhone);
    if (phoneErr) {
      setLoginError(phoneErr);
      return;
    }
    try {
      const data = await registerCustomer({
        name: regName,
        email: regEmail,
        phone: regPhone,
        password: 'OtpDefaultPassword123'
      }).unwrap();
      dispatch(setCredentials({ user: data.user, token: data.token }));
      // Notify the header to update immediately (no page refresh needed)
      window.dispatchEvent(new Event('auth_changed'));
      setName(regName);
      setPhone(regPhone);
      setDrawerStep(3);
    } catch (err: any) {
      setLoginError(err?.data?.error || 'Registration failed. Please try again.');
    }
  };

  // Automatically check availability on Summary step
  useEffect(() => {
    if (isDrawerOpen && drawerStep === 3 && selectedTime && resolvedParams.id) {
      checkAvailability();
    }
  }, [isDrawerOpen, drawerStep, selectedTime, guests]);

  // Lightbox / Image Zoom & Slider state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);

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

  const openLightbox = (index: number) => {
    setCurrentPhotoIdx(index);
    setIsLightboxOpen(true);
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
  };

  const nextPhoto = () => {
    setCurrentPhotoIdx((prev) => (prev + 1) % (photos.length || 1));
  };

  const prevPhoto = () => {
    setCurrentPhotoIdx((prev) => (prev - 1 + (photos.length || 1)) % (photos.length || 1));
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
  }, [isLightboxOpen, photos.length]);

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

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (availabilityStatus !== 'available') return;
    const phoneErr = getPhoneValidationError(phone);
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

      const result = await createBooking({
        business_id: resolvedParams.id,
        customer_name: name,
        customer_phone: phone,
        booking_time: bookingDateTime,
        booking_source: 'ONLINE',
        guests: Number(guests),
        approx_arrival: arrivalTime,
        ...(customerIdPayload ? { customer_id: customerIdPayload } : {}),
      }).unwrap();
      setBookingSuccess(true);
      setDrawerStep(4);
      if (result.booking_id) {
        setLastBookingId(result.booking_id);
      }
      toast.success('Booking confirmed!');
    } catch {
      toast.error('Booking failed. Please try again.');
    }
  };

  const handleResetBooking = () => {
    setBookingSuccess(false);
    setAvailabilityStatus(null);
    setSelectedTime('');
    setName('');
    setPhone('');
    setArrivalTime('On time');
    setLastBookingId(null);
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

  const handleQuickBook = () => {
    setIsDrawerOpen(true);
    setDrawerStep(1);
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


  const menus = profile
    ? (profile.menu_images && profile.menu_images.length > 0 ? profile.menu_images : getMenuForVenue(profile.type_name))
    : [];
  const costText = profile?.average_cost ? `₹${profile.average_cost} for two (approx.)` : getCostForTwo(profile?.price_range);
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
    <div className="min-h-screen bg-slate-50 text-slate-700">

      {/* ── 1. Breadcrumbs ── */}
      <div className="bg-white border-b border-slate-100 py-3">
        <div className="max-w-7xl mx-auto px-4 text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
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

      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* ── 2. Image Collage Section (Zomato-Style) ── */}
        <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[260px] md:h-[380px] rounded-2xl overflow-hidden shadow-sm border border-slate-100 mb-6 bg-slate-100">
          {photos.slice(0, 5).map((photoUrl, idx) => {
            const total = Math.min(photos.length, 5);
            const isLastVisible = idx === total - 1;

            // Calculate dynamic layout classes to fill the grid beautifully
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

                {/* Mobile View Gallery Badge (only on first image) */}
                {idx === 0 && (
                  <div className="absolute bottom-3 right-3 md:hidden bg-black/60 backdrop-blur-[2px] text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 z-10 shadow-md">
                    <ImageIcon size={14} className="text-white" />
                    <span>View Gallery</span>
                    <span className="text-[10px] text-white/70">({photos.length})</span>
                  </div>
                )}

                {/* Desktop View Gallery Badge (only if 1 photo total) */}
                {total === 1 && idx === 0 && (
                  <div className="hidden md:flex absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm text-slate-900 font-semibold px-4 py-2 rounded-xl items-center gap-2 shadow-lg hover:bg-white transition-colors z-20">
                    <ImageIcon size={18} />
                    <span>View Gallery ({photos.length})</span>
                  </div>
                )}

                {/* Desktop View Gallery Overlay for last image */}
                {total > 1 && isLastVisible && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white transition-opacity group-hover:bg-black/75">
                    <ImageIcon size={22} className="mb-1" />
                    <span className="font-bold text-sm tracking-wide">View Gallery</span>
                    <span className="text-[10px] text-white/70">{photos.length > 5 ? '5+' : photos.length} Photos</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── 3. Venue Title Header ── */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">{profile.name}</h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">{cuisines}</p>
            <p className="text-slate-400 text-xs mt-1 flex items-center gap-1">
              <MapPin size={12} className="text-rose-500" />
              {profile.address || 'Address hidden'}
            </p>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              {isOpenNow ? (
                <span className="text-emerald-600 font-bold">Open now</span>
              ) : (
                <span className="text-rose-600 font-bold">Closed</span>
              )}
              <span>·</span>
              <span>{timingText}</span>
            </p>
          </div>

          {/* Rating Block (Dine-out Ratings Only) */}
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 text-white rounded-xl px-3 py-2 flex items-center gap-1.5 shadow-sm">
              <span className="font-extrabold text-lg leading-none">{ratingValue}</span>
              <Star size={16} className="fill-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Dine-out Rating</p>
              <p className="text-slate-400 text-[11px] font-medium">{reviewsCount} Reviews</p>
            </div>
          </div>
        </div>

        {/* ── 4. Action Buttons Bar ── */}
        <div className="flex flex-wrap gap-2.5 mb-8 pb-5 border-b border-slate-200">
          <button
            onClick={() => {
              if (profile.address) {
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}`, '_blank', 'noopener,noreferrer');
              }
            }}
            className="text-xs bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg border border-rose-100 font-bold hover:bg-rose-100 transition-all flex items-center gap-1 cursor-pointer"
          >
            <Compass size={13} className="text-rose-500" />
            {copied ? "Copied!" : "Direction"}
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: profile.name, url: window.location.href });
              } else {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Link copied to clipboard!");
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-all cursor-pointer"
          >
            <Share2 size={13} className="text-rose-500" />
            Share
          </button>
          <button
            onClick={() => setActiveTab("Reviews")}
            className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-all cursor-pointer"
          >
            <MessageSquare size={13} className="text-rose-500" />
            Reviews
          </button>
          <button
            onClick={handleQuickBook}
            className="flex items-center gap-1.5 px-4.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-200 transition-all cursor-pointer"
          >
            <Calendar size={13} />
            Book a Table
          </button>
        </div>

        {/* ── 5. Navigation Tabs ── */}
        <div className="bg-white border-b border-slate-200 sticky top-[72px] z-30 mb-8 -mx-4 px-4">
          <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto scrollbar-hide">
            {["Overview", "Menu", "Photos", "Reviews"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3.5 text-sm font-semibold tracking-wide border-b-2 transition-all whitespace-nowrap cursor-pointer ${activeTab === tab
                  ? "border-rose-600 text-rose-600 font-bold"
                  : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* ── 6. Page Body ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">

          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">

            {/* Overview Tab Content */}
            {activeTab === "Overview" && (
              <div className="space-y-8">

                {/* Dining Offers */}
                {profile.dining_offers && profile.dining_offers.length > 0 && (
                  <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-1.5">
                      <Sparkles size={16} className="text-rose-500" /> Dining Offers
                    </h3>
                    <div className="w-full space-y-3">
                      {profile.dining_offers.map((offer: any, idx: number) => (
                        <div key={idx} className="p-5 rounded-2xl border border-dashed border-rose-200 bg-gradient-to-r from-rose-50/70 to-rose-50/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all hover:bg-rose-50/80">
                          <div className="space-y-1.5">
                            <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-100/80 px-2.5 py-0.5 rounded-full">
                              {offer.type || 'Offer'}
                            </span>
                            <p className="text-base font-extrabold text-slate-800">{offer.title}</p>
                            <p className="text-xs text-slate-400 font-medium">{offer.validity}</p>
                          </div>
                          <button
                            onClick={handleQuickBook}
                            className="self-start sm:self-center shrink-0 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-rose-200"
                          >
                            Book table to unlock
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* About Venue */}
                <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-3">About the Venue</h3>
                  <p className="text-slate-500 text-sm leading-relaxed whitespace-pre-wrap">
                    {profile.description || 'This venue has not provided a description yet. Enjoy a curated dining experience with premium seats, lovely ambiance, and delicious gourmet specialties.'}
                  </p>
                </section>

                {/* Cuisines */}
                <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-3">Cuisines</h3>
                  <div className="flex flex-wrap gap-2">
                    {cuisines.split(/·|,/).map((c) => (
                      <span key={c} className="bg-slate-50 text-slate-600 rounded-xl px-3 py-1.5 text-xs font-semibold border border-slate-100">
                        {c.trim()}
                      </span>
                    ))}
                  </div>
                </section>

                {/* Average Cost */}
                <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-2">Average Cost</h3>
                  <p className="text-sm text-slate-600 font-medium">{costText}</p>
                  <p className="text-xs text-slate-400 mt-1.5">Exclusive of applicable taxes and charges, if any.</p>
                </section>

                {/* More Info checklist */}
                {profile.amenities && profile.amenities.length > 0 && (
                  <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-base font-bold text-slate-800 mb-4">Venue Amenities</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {profile.amenities.map((info: string) => (
                        <div key={info} className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                          <span>{info}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* OpenStreetMap Address Block */}
                <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-4">Direction & Contact</h3>
                  <div className="flex flex-col md:flex-row gap-5 items-stretch">
                    <div className="flex-1 bg-slate-50 rounded-xl p-4 flex flex-col justify-between border border-slate-100">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Address</p>
                        <p className="text-xs text-slate-600 font-semibold leading-relaxed">{profile.address || 'Address hidden'}</p>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button onClick={handleCopyAddress} className="text-xs bg-white text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 font-bold hover:bg-slate-50 transition-all flex items-center gap-1">
                          <Copy size={11} /> {copied ? "Copied" : "Copy"}
                        </button>
                        <button
                          onClick={() => {
                            if (profile.address) {
                              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}`, '_blank', 'noopener,noreferrer');
                            }
                          }}
                          className="text-xs bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg border border-rose-100 font-bold hover:bg-rose-100 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Compass size={11} /> Get Directions
                        </button>
                      </div>
                    </div>
                    <div className="w-full md:w-64 h-44 bg-slate-200 rounded-xl relative overflow-hidden border border-slate-200 shrink-0">
                      {profile.address ? (
                        <iframe
                          title={`Map of ${profile.name}`}
                          className="absolute inset-0 w-full h-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(profile.address)}&z=15&output=embed`}
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
                          Map unavailable
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* Menu Tab Content */}
            {activeTab === "Menu" && (
              <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-5">Menu Card</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {menus.map((menuUrl, idx) => (
                    <div key={idx} className="rounded-xl overflow-hidden border border-slate-200 group cursor-zoom-in">
                      <div className="h-[240px] overflow-hidden bg-slate-100">
                        <img src={menuUrl} alt={`Menu Page ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                      </div>
                      <div className="p-3 border-t border-slate-200 bg-slate-50">
                        <p className="text-xs font-bold text-slate-700">Menu Page {idx + 1}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Photos Tab Content */}
            {activeTab === "Photos" && (
              <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-5">Photos Gallery</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((url, idx) => (
                    <div
                      key={idx}
                      onClick={() => openLightbox(idx)}
                      className="rounded-xl overflow-hidden h-40 bg-slate-100 border border-slate-100 hover:shadow-md transition-shadow cursor-pointer"
                    >
                      <img src={url} alt={`gallery item ${idx}`} className="w-full h-full object-cover hover:scale-103 transition-transform duration-300" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews Tab Content */}
            {activeTab === "Reviews" && (
              <div className="space-y-6">

                {/* Write Review Form */}
                <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="text-base font-bold text-slate-800 mb-4">Write a Review</h3>
                  <form onSubmit={handleAddReview} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Your Name</label>
                        <input
                          type="text"
                          required
                          value={newReviewUser}
                          onChange={(e) => setNewReviewUser(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-500"
                          placeholder="E.g., Priya R."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-2">Rating</label>
                        <div className="h-9 flex items-center">
                          <StarRatingInput value={newReviewRating} onChange={setNewReviewRating} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Comment</label>
                      <textarea
                        required
                        rows={3}
                        value={newReviewText}
                        onChange={(e) => setNewReviewText(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-500"
                        placeholder="Write details about food, staff, service..."
                      />
                    </div>
                    <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-sm">
                      Submit Review
                    </button>
                  </form>
                </section>

                {/* Review Feed */}
                <section className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-5 divide-y divide-slate-100">
                  <h3 className="text-base font-bold text-slate-800 mb-2">User Reviews</h3>
                  {reviews.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No reviews yet. Be the first to leave one!</p>}
                  {reviews.map((rev: any, idx: number) => (
                    <div key={rev.id} className={`${idx > 0 ? "pt-5" : ""} flex gap-3`}>
                      <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-200">
                        {(rev.user_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-800">{rev.user_name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {new Date(rev.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="flex items-center gap-0.5 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-md text-[10px] text-emerald-600 font-bold">
                            <span>{rev.rating}</span>
                            <Star size={8} className="fill-emerald-600" />
                          </div>
                        </div>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          {rev.text}
                        </p>

                        {/* Render Nested Replies */}
                        {rev.replies && rev.replies.length > 0 && (
                          <div className="mt-3 space-y-2 pl-4 border-l-2 border-slate-100">
                            {rev.replies.map((reply: any) => (
                              <div key={reply.id} className={`p-3 rounded-xl text-xs ${reply.user_type === 'owner' ? 'bg-rose-50 border border-rose-100' : 'bg-slate-50 border border-slate-100'}`}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`font-bold ${reply.user_type === 'owner' ? 'text-rose-700' : 'text-slate-700'}`}>
                                    {reply.user_name} {reply.user_type === 'owner' && <span className="ml-1 text-[9px] bg-rose-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">Owner</span>}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
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
                                  className="text-xs border border-slate-200 rounded px-2 py-1 outline-none focus:border-rose-500 w-1/3"
                                />
                              </div>
                              <textarea
                                required
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write your reply..."
                                className="w-full text-xs border border-slate-200 rounded p-2 outline-none focus:border-rose-500 min-h-[60px]"
                              />
                              <div className="flex justify-end gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => setReplyingToReviewId(null)}
                                  className="text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg"
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
                              className="text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors"
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
            )}

                  {/* Book a Table Tab Content */}
                  {activeTab === "Book a Table" && (
                    <section className="bg-white p-6 md:p-8 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="mb-6">
                        <h3 className="text-xl font-bold text-slate-800">Reserve Your Table</h3>
                        <p className="text-xs text-slate-400 mt-1">Ensure you have a seat confirmed with no booking fee.</p>
                      </div>

                      {bookingSuccess ? (
                        <div className="text-center py-12 bg-emerald-50/50 rounded-2xl border border-dashed border-emerald-200 max-w-xl mx-auto">
                          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle size={32} />
                          </div>
                          <h3 className="text-xl font-bold text-slate-800 mb-1">Booking Confirmed!</h3>
                          <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">Your table at {profile.name} is successfully reserved. See you soon!</p>
                          <button
                            type="button"
                            onClick={handleResetBooking}
                            className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-md shadow-rose-200 cursor-pointer"
                          >
                            Book Another Table
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={handleBook} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                          {/* Left Column: Date & Time Selectors */}
                          <div className="lg:col-span-7 space-y-6">
                            {/* Date Pill Row */}
                            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5">
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Calendar size={13} className="text-rose-500" /> Select Date</label>
                              <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide">
                                {bookingDates.map((d, idx) => {
                                  const lbl = formatDateLabel(d, idx);
                                  const active = selectedDateIndex === idx;
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => handleDateSelect(idx)}
                                      className={`flex-shrink-0 flex flex-col items-center px-4.5 py-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${active
                                        ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/10'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-rose-400 hover:bg-rose-50/30'
                                        }`}
                                    >
                                      <span className="text-[11px] leading-tight font-extrabold">{lbl.top}</span>
                                      <span className={`text-[10px] mt-0.5 ${active ? 'text-rose-100' : 'text-slate-400'}`}>{lbl.bottom}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Time Slot Grid */}
                            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5">
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Clock size={13} className="text-rose-500" /> Select Time</label>
                              {isSelectedDayClosed ? (
                                <div className="text-center py-8 bg-white border border-slate-200 rounded-xl">
                                  <p className="text-xs text-rose-500 font-bold">Closed on this day</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Please select another date above.</p>
                                </div>
                              ) : timeSlots.length === 0 ? (
                                <div className="text-center py-8 bg-white border border-slate-200 rounded-xl">
                                  <p className="text-xs text-slate-400 font-medium">No slots available for this date.</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">Please select another date above.</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-2">
                                  {timeSlots.map((slot) => (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={() => handleTimeSelect(slot)}
                                      className={`py-2.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${selectedTime === slot
                                        ? 'bg-rose-600 border-rose-600 text-white shadow-sm shadow-rose-600/10'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-rose-400 hover:bg-rose-50/30'
                                        }`}
                                    >
                                      {formatSlotLabel(slot)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Column: Reservation Form Summary */}
                          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                            <h4 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-3 flex items-center gap-1.5">
                              <Users size={16} className="text-rose-500" /> Reservation Details
                            </h4>

                            {/* Guests selection */}
                            <div className="space-y-2">
                              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Party Size</label>
                              <div className="relative">
                                <Users size={14} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                                <select
                                  value={guests}
                                  onChange={(e) => { setGuests(e.target.value); setAvailabilityStatus(null); }}
                                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-8 py-3 text-xs focus:outline-none focus:border-rose-500 appearance-none font-bold text-slate-750 cursor-pointer"
                                >
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                    <option key={num} value={num}>
                                      {num} {num === 1 ? 'Guest' : 'Guests'}
                                    </option>
                                  ))}
                                </select>
                                <div className="absolute right-3.5 top-4 pointer-events-none text-slate-400">
                                  <ChevronRight size={14} className="rotate-90" />
                                </div>
                              </div>
                            </div>

                            {selectedTime && (
                              <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl space-y-1">
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Selected Session</p>
                                <p className="text-xs text-rose-600 font-extrabold flex items-center gap-1">
                                  <Calendar size={12} />
                                  {bookingDates[selectedDateIndex].toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  <span className="text-slate-300 font-normal">|</span>
                                  <Clock size={12} />
                                  {formatSlotLabel(selectedTime)}
                                </p>
                              </div>
                            )}

                            {availabilityStatus === null && (
                              <button
                                type="button"
                                onClick={checkAvailability}
                                className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl w-full py-3.5 text-xs font-bold transition-all shadow-sm cursor-pointer"
                              >
                                Check Availability
                              </button>
                            )}

                            {availabilityStatus === 'loading' && (
                              <div className="flex justify-center items-center gap-2 py-3.5">
                                <Loader2 size={16} className="animate-spin text-rose-600" />
                                <span className="text-slate-400 text-xs font-semibold">Checking seats...</span>
                              </div>
                            )}

                            {availabilityStatus === 'unavailable' && (
                              <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs text-center font-bold">
                                Sorry, no tables available for this time.
                              </div>
                            )}

                            {availabilityStatus === 'available' && (
                              <div className="space-y-4 pt-2">
                                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs flex items-center justify-center gap-1.5 font-bold">
                                  <CheckCircle size={14} className="text-emerald-600" /> Seats Available! Complete form to book.
                                </div>
                                <div className="space-y-1.5">
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                                  <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-rose-500 text-slate-800 font-semibold"
                                    placeholder="John Doe"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
                                  <input
                                    type="tel"
                                    required
                                    value={phone}
                                    onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                                    inputMode="numeric"
                                    maxLength={12}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:border-rose-500 text-slate-800 font-semibold"
                                    placeholder="+91 99000-00000"
                                  />
                                </div>
                                <button
                                  type="submit"
                                  className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl w-full py-3.5 text-xs font-bold shadow-md shadow-rose-600/10 hover-lift transition-all cursor-pointer"
                                >
                                  Confirm Booking
                                </button>
                              </div>
                            )}
                          </div>
                        </form>
                      )}
                    </section>
                  )}
              </div>

          {/* Right Sidebar Column */}
            <div ref={bookingWidgetRef} className="lg:col-span-1 space-y-6 lg:sticky lg:top-24">

              {/* Table Reservation Widget */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">

                {/* Lavender / Pale blue/indigo Header */}
                <div className="bg-indigo-50/60 p-4 border-b border-indigo-100/50">
                  <h3 className="text-sm font-bold text-slate-800 tracking-wide uppercase">Table reservation</h3>
                  <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold mt-1">
                    <span className="inline-flex items-center justify-center w-4.5 h-4.5 rounded-full bg-indigo-600 text-white text-[10px] font-black shrink-0 shadow-sm">%</span>
                    <span>Flat 10% OFF + 2 more offers</span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Select Row */}
                  <div className="grid grid-cols-2 gap-2">

                    {/* Date Dropdown */}
                    <div className="relative">
                      <select
                        value={selectedDateIndex}
                        onChange={(e) => handleDateSelect(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-7 py-2 text-xs text-slate-750 focus:outline-none appearance-none font-semibold cursor-pointer"
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
                      <ChevronRight size={12} className="absolute right-2 top-2.5 text-slate-400 rotate-90 pointer-events-none" />
                    </div>

                    {/* Guest Dropdown */}
                    <div className="relative">
                      <select
                        value={guests}
                        onChange={(e) => { setGuests(e.target.value); setAvailabilityStatus(null); }}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-7 py-2 text-xs text-slate-750 focus:outline-none appearance-none font-semibold cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <option key={num} value={num}>
                            {num} {num === 1 ? 'guest' : 'guests'}
                          </option>
                        ))}
                      </select>
                      <ChevronRight size={12} className="absolute right-2 top-2.5 text-slate-400 rotate-90 pointer-events-none" />
                    </div>

                  </div>

                  {/* Red button: Book a table */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsDrawerOpen(true);
                      setDrawerStep(1);
                    }}
                    className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl w-full py-2.5 text-xs font-bold transition-all shadow-md shadow-rose-200 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Book a table
                  </button>
                </div>

              </div>

              {/* Quick Contact / Timing Info Box */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Call Venue</p>
                  <a href={`tel:${profile.phone || '9737315326'}`} className="text-sm font-bold text-slate-700 hover:text-rose-600 transition-colors flex items-center gap-1">
                    <Phone size={14} className="text-rose-500" />
                    {profile.phone || '+91 97373 15326'}
                  </a>
                </div>
                <hr className="border-slate-100" />
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Timing Details</p>
                  <div className="space-y-1.5 text-xs font-semibold">
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                      const dayName = day.charAt(0).toUpperCase() + day.slice(1, 3);
                      const rules = profile.operating_hours?.[day];
                      let timeStr = "";

                      if (rules) {
                        if (rules.closed) {
                          timeStr = "Closed";
                        } else {
                          const openFormatted = formatSlotLabel(rules.open || "08:00");
                          const closeFormatted = formatSlotLabel(rules.close || "23:30");
                          timeStr = `${openFormatted} - ${closeFormatted}`;
                        }
                      } else {
                        // Fallback
                        if (['friday', 'saturday', 'sunday'].includes(day)) {
                          timeStr = "8:00 AM - 1:00 AM";
                        } else {
                          timeStr = "8:00 AM - 11:30 PM";
                        }
                      }

                      const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                      const isToday = todayName === day;

                      return (
                        <p key={day} className={`flex justify-between ${isToday ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                          <span>{dayName}:</span>
                          <span className={isToday ? 'text-rose-600' : 'text-slate-605'}>{timeStr}</span>
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Similar Restaurants Horizontal Shelf */}
          {similarRestaurants.length > 0 && (
            <div className="mt-12 pt-10 border-t border-slate-200 animate-fadeIn">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">
                    {(() => {
                      const rawType = profile?.type_name || "Restaurant";
                      const plural = rawType.toLowerCase().endsWith('s') ? rawType : `${rawType}s`;
                      return `Similar ${plural}`;
                    })()}
                  </h3>
                  <p className="text-slate-500 text-xs mt-1 font-semibold">
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
                  const priceForTwo = restaurant.average_cost ? `₹${restaurant.average_cost} for two` : "₹1200 for two";

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
                        <h4 className="font-extrabold text-slate-800 text-[16px] leading-tight truncate group-hover:text-rose-600 transition-colors">
                          {restaurant.name}
                        </h4>

                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="bg-emerald-700 text-white text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <span>{rating}</span>
                            <span className="text-[8px]">★</span>
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold tracking-wider uppercase">DINING</span>
                        </div>

                        <div className="flex justify-between items-center gap-2 mt-2.5 text-xs text-slate-500 font-medium">
                          <span className="truncate flex-1">{cuisine}</span>
                          <span className="shrink-0 text-slate-700 font-semibold">{priceForTwo}</span>
                        </div>

                        <div className="text-[11px] text-slate-400 mt-1 font-medium">
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
        {isLightboxOpen && (
          <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between py-6 px-4 select-none animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-center max-w-7xl mx-auto w-full text-white">
              <span className="text-sm font-semibold tracking-wider text-slate-300 font-mono">
                {currentPhotoIdx + 1} / {photos.length}
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
            <div className="flex-1 flex items-center justify-between max-w-7xl mx-auto w-full gap-4 my-4 relative">
              {/* Left Button */}
              <button
                onClick={prevPhoto}
                className="p-3 bg-white/5 hover:bg-white/15 active:scale-95 text-white rounded-full transition-all cursor-pointer backdrop-blur-sm shadow-lg border border-white/10"
                aria-label="Previous image"
              >
                <ChevronLeft size={24} />
              </button>

              {/* Current Image Container */}
              <div className="flex-1 h-full flex items-center justify-center overflow-hidden px-2">
                <img
                  src={photos[currentPhotoIdx]}
                  alt={`Gallery image ${currentPhotoIdx + 1}`}
                  className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl transition-all duration-300 select-none pointer-events-none"
                />
              </div>

              {/* Right Button */}
              <button
                onClick={nextPhoto}
                className="p-3 bg-white/5 hover:bg-white/15 active:scale-95 text-white rounded-full transition-all cursor-pointer backdrop-blur-sm shadow-lg border border-white/10"
                aria-label="Next image"
              >
                <ChevronRight size={24} />
              </button>
            </div>

            {/* Thumbnails Row */}
            <div className="max-w-4xl mx-auto w-full overflow-x-auto py-2 flex justify-center gap-2.5 px-4 scrollbar-hide">
              {photos.map((url, idx) => (
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

          </div>
        )}

        {/* ── 8. Right-side sliding Book a Table Drawer ── */}
        <div
          className={`fixed inset-0 z-50 overflow-hidden transition-all duration-300 ${isDrawerOpen ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
        >
          {/* Backdrop overlay */}
          <div
            onClick={() => setIsDrawerOpen(false)}
            className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100' : 'opacity-0'
              }`}
          />

          {/* Drawer Panel */}
          <div
            className={`absolute inset-y-0 right-0 w-full sm:w-[520px] md:w-[580px] lg:w-[620px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out transform ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
              }`}
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 shrink-0 bg-white">
              <button
                onClick={() => {
                  if (drawerStep > 1 && drawerStep !== 4) {
                    setDrawerStep(prev => prev - 1);
                  } else {
                    setIsDrawerOpen(false);
                  }
                }}
                className="p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer text-slate-500"
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <h3 className="text-base font-extrabold text-slate-800">
                  {drawerStep === 1 && 'Book Table'}
                  {drawerStep === 2 && (isRegisterMode ? 'Create Account' : loginStep === 2 ? 'Verify OTP' : 'Verify Mobile Number')}
                  {drawerStep === 3 && 'Confirm Booking'}
                  {drawerStep === 4 && 'Booking Confirmed'}
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold">{profile.name}{profile.address ? `, ${profile.address.split(',')[0]}` : ''}</p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="ml-auto p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
              {drawerStep === 1 && (() => {
                const mealsConfig = (profile.operating_hours as any)?.meals || {
                  breakfast: { open: '08:00', close: '11:00', active: true },
                  lunch: { open: '11:30', close: '16:00', active: true },
                  dinner: { open: '17:00', close: '23:00', active: true }
                };

                const isToday = selectedDateIndex === 0;
                // Generate slots per meal period directly from that period's own time window
                // so breakfast/lunch/dinner slots are NOT limited by the restaurant's daily open/close.
                const breakfastSlots = mealsConfig.breakfast?.active
                  ? generateSlotsForMeal(mealsConfig.breakfast.open, mealsConfig.breakfast.close, isToday)
                  : [];
                const lunchSlots = mealsConfig.lunch?.active
                  ? generateSlotsForMeal(mealsConfig.lunch.open, mealsConfig.lunch.close, isToday)
                  : [];
                const dinnerSlots = mealsConfig.dinner?.active
                  ? generateSlotsForMeal(mealsConfig.dinner.open, mealsConfig.dinner.close, isToday)
                  : [];

                return (
                  <div className="space-y-6">
                    {/* 1. Guests selection */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 mb-3 tracking-tight">Number of guest(s)</h4>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                          const active = Number(guests) === num;
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setGuests(num.toString())}
                              className={`w-10 h-10 shrink-0 rounded-full border text-sm font-extrabold flex items-center justify-center transition-all cursor-pointer ${active
                                ? 'border-orange-500 bg-orange-50 text-orange-600 font-black shadow-sm ring-1 ring-orange-400'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                            >
                              {num}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Date selection */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 mb-3 tracking-tight">When are you visiting?</h4>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {bookingDates.map((d, idx) => {
                          const lbl = formatDateLabel(d, idx);
                          const active = selectedDateIndex === idx;

                          const day = d.getDay();
                          const promoText = (day === 5 || day === 6 || day === 0) ? '15% off' : '20% off';

                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleDateSelect(idx)}
                              className={`shrink-0 flex flex-col items-center py-2.5 px-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer min-w-[68px] ${active
                                ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-400'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                }`}
                            >
                              <span className={`text-[9px] uppercase font-bold tracking-wider ${active ? 'text-orange-500' : 'text-slate-400'}`}>
                                {lbl.top}
                              </span>
                              <span className="text-sm font-extrabold mt-0.5">{lbl.bottom}</span>
                              <span className="inline-block mt-1.5 text-[8px] font-black uppercase bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md">
                                {promoText}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. Time selection */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-slate-800 tracking-tight">Select the time of day to see the offers</h4>

                      {isSelectedDayClosed ? (
                        <div className="text-center py-8 bg-white border border-slate-200 rounded-2xl">
                          <p className="text-xs text-rose-500 font-bold">Closed on this day</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Please select another date above.</p>
                        </div>
                      ) : (breakfastSlots.length === 0 && lunchSlots.length === 0 && dinnerSlots.length === 0 && !mealsConfig.breakfast?.active && !mealsConfig.lunch?.active && !mealsConfig.dinner?.active) ? (
                        <div className="text-center py-8 bg-white border border-slate-200 rounded-2xl">
                          <p className="text-xs text-slate-400 font-medium">No slots available for this date.</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Please select another date above.</p>
                        </div>
                      ) : (
                        <>
                          {/* Breakfast Accordion — hidden on Today if all breakfast slots have passed */}
                          {mealsConfig.breakfast?.active && (!isToday || breakfastSlots.length > 0) && (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => setActiveMealSection(prev => prev === 'breakfast' ? null : 'breakfast')}
                                className={`w-full flex items-center justify-between p-3 border rounded-2xl text-left cursor-pointer transition-all ${activeMealSection === 'breakfast' ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200 hover:bg-slate-50/50'
                                  }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-xl ${activeMealSection === 'breakfast' ? 'bg-rose-500/15 text-rose-600' : 'bg-rose-500/10 text-rose-500'}`}>
                                    <Clock size={18} />
                                  </div>
                                  <div>
                                    <span className="text-sm font-extrabold text-slate-800">Breakfast</span>
                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                      {formatSlotLabel(mealsConfig.breakfast.open)} – {formatSlotLabel(mealsConfig.breakfast.close)}
                                    </p>
                                  </div>
                                </div>
                                <ChevronRight size={16} className={`text-slate-400 transition-transform duration-200 ${activeMealSection === 'breakfast' ? 'rotate-90' : ''}`} />
                              </button>
                              {activeMealSection === 'breakfast' && (
                                <div className="grid grid-cols-3 gap-2 pt-1">
                                  {breakfastSlots.map((slot) => {
                                    const isSelected = selectedTime === slot;
                                    const day = bookingDates[selectedDateIndex].getDay();
                                    const promoText = (day === 5 || day === 6 || day === 0) ? '15% off' : '20% off';
                                    return (
                                      <button
                                        key={slot}
                                        type="button"
                                        onClick={() => handleTimeSelect(slot)}
                                        className={`py-3 px-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${isSelected
                                          ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-400'
                                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                          }`}
                                      >
                                        <span className="text-[11px] font-extrabold">{formatSlotLabel(slot)}</span>
                                        <span className="text-[8px] font-black text-emerald-600 mt-0.5 uppercase tracking-wide">{promoText}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Lunch Accordion — hidden on Today if all lunch slots have passed */}
                          {mealsConfig.lunch?.active && (!isToday || lunchSlots.length > 0) && (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => setActiveMealSection(prev => prev === 'lunch' ? null : 'lunch')}
                                className={`w-full flex items-center justify-between p-3 border rounded-2xl text-left cursor-pointer transition-all ${activeMealSection === 'lunch' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200 hover:bg-slate-50/50'
                                  }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-xl ${activeMealSection === 'lunch' ? 'bg-amber-500/15 text-amber-600' : 'bg-amber-500/10 text-amber-500'}`}>
                                    <Sun size={18} />
                                  </div>
                                  <div>
                                    <span className="text-sm font-extrabold text-slate-800">Lunch</span>
                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                      {formatSlotLabel(mealsConfig.lunch.open)} – {formatSlotLabel(mealsConfig.lunch.close)}
                                    </p>
                                  </div>
                                </div>
                                <ChevronRight size={16} className={`text-slate-400 transition-transform duration-200 ${activeMealSection === 'lunch' ? 'rotate-90' : ''}`} />
                              </button>
                              {activeMealSection === 'lunch' && (
                                <div className="grid grid-cols-3 gap-2 pt-1">
                                  {lunchSlots.map((slot) => {
                                    const isSelected = selectedTime === slot;
                                    const day = bookingDates[selectedDateIndex].getDay();
                                    const promoText = (day === 5 || day === 6 || day === 0) ? '15% off' : '20% off';
                                    return (
                                      <button
                                        key={slot}
                                        type="button"
                                        onClick={() => handleTimeSelect(slot)}
                                        className={`py-3 px-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${isSelected
                                          ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-400'
                                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                          }`}
                                      >
                                        <span className="text-[11px] font-extrabold">{formatSlotLabel(slot)}</span>
                                        <span className="text-[8px] font-black text-emerald-600 mt-0.5 uppercase tracking-wide">{promoText}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Dinner Accordion — hidden on Today if all dinner slots have passed */}
                          {mealsConfig.dinner?.active && (!isToday || dinnerSlots.length > 0) && (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => setActiveMealSection(prev => prev === 'dinner' ? null : 'dinner')}
                                className={`w-full flex items-center justify-between p-3 border rounded-2xl text-left cursor-pointer transition-all ${activeMealSection === 'dinner' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50/50'
                                  }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-xl ${activeMealSection === 'dinner' ? 'bg-indigo-500/15 text-indigo-600' : 'bg-indigo-500/10 text-indigo-500'}`}>
                                    <Moon size={18} />
                                  </div>
                                  <div>
                                    <span className="text-sm font-extrabold text-slate-800">Dinner</span>
                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                      {formatSlotLabel(mealsConfig.dinner.open)} – {formatSlotLabel(mealsConfig.dinner.close)}
                                    </p>
                                  </div>
                                </div>
                                <ChevronRight size={16} className={`text-slate-400 transition-transform duration-200 ${activeMealSection === 'dinner' ? 'rotate-90' : ''}`} />
                              </button>
                              {activeMealSection === 'dinner' && (
                                <div className="grid grid-cols-3 gap-2 pt-1">
                                  {dinnerSlots.map((slot) => {
                                    const isSelected = selectedTime === slot;
                                    const day = bookingDates[selectedDateIndex].getDay();
                                    const promoText = (day === 5 || day === 6 || day === 0) ? '15% off' : '20% off';
                                    return (
                                      <button
                                        key={slot}
                                        type="button"
                                        onClick={() => handleTimeSelect(slot)}
                                        className={`py-3 px-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${isSelected
                                          ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-400'
                                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                          }`}
                                      >
                                        <span className="text-[11px] font-extrabold">{formatSlotLabel(slot)}</span>
                                        <span className="text-[8px] font-black text-emerald-600 mt-0.5 uppercase tracking-wide">{promoText}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                  </div>
                );
              })()}

              {drawerStep === 2 && (
                <div className="space-y-6">
                  {!isRegisterMode ? (
                    // PHONE LOGIN FORM
                    <div>
                      <h4 className="text-lg font-black text-slate-800 mb-1 tracking-tight">Login</h4>
                      <p className="text-xs text-slate-400 mb-6 font-semibold">Verify to secure your booking slot instantly.</p>

                      {loginError && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold p-3.5 rounded-2xl text-center mb-5">
                          {loginError}
                        </div>
                      )}

                      <form onSubmit={handlePhoneLoginSubmit} className="space-y-5">
                        {loginStep === 1 ? (
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Phone Number</label>
                            <div className="relative">
                              <span className="absolute left-4 top-3.5 text-slate-400 font-bold text-xs">+91</span>
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
                              disabled={isPhoneLoggingIn}
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
                              <span className="font-medium text-slate-500">OTP has been sent to +91 {loginPhone}. Use static code <strong>123456</strong>.</span>
                            </div>

                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Enter OTP</label>
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
                              disabled={isPhoneLoggingIn}
                              className="w-full bg-rose-600 hover:bg-rose-700 text-white rounded-2xl py-3.5 text-xs font-bold transition-all shadow-md shadow-rose-200 cursor-pointer mt-6 flex justify-center items-center gap-1.5"
                            >
                              {isPhoneLoggingIn ? <Loader2 size={14} className="animate-spin" /> : null}
                              Verify & Log In
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

                      <p className="mt-8 text-center text-xs text-slate-400 font-semibold">
                        New to Book My Bota?{' '}
                        <button
                          type="button"
                          onClick={() => { setIsRegisterMode(true); setLoginError(null); }}
                          className="text-rose-600 font-extrabold hover:underline cursor-pointer"
                        >
                          Create an account
                        </button>
                      </p>
                    </div>
                  ) : (
                    // REGISTRATION FORM
                    <div>
                      <h4 className="text-lg font-black text-slate-800 mb-1 tracking-tight">Create Account</h4>
                      <p className="text-xs text-slate-400 mb-6 font-semibold">Register in seconds to complete your booking.</p>

                      {loginError && (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold p-3.5 rounded-2xl text-center mb-5">
                          {loginError}
                        </div>
                      )}

                      <form onSubmit={handleRegisterSubmit} className="space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Full Name</label>
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
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Email Address</label>
                          <input
                            type="email"
                            required
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-rose-500 text-slate-800 font-semibold"
                            placeholder="john@example.com"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Phone Number</label>
                          <div className="relative">
                            <span className="absolute left-4 top-3 text-slate-400 font-bold text-xs">+91</span>
                            <input
                              type="tel"
                              required
                              value={regPhone}
                              onChange={(e) => setRegPhone(sanitizePhoneInput(e.target.value))}
                              inputMode="numeric"
                              maxLength={12}
                              className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-xs focus:outline-none focus:border-rose-500 text-slate-800 font-semibold"
                              placeholder="99000-00000"
                            />
                          </div>
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
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => { setIsRegisterMode(false); setLoginError(null); }}
                          className="text-rose-600 font-extrabold hover:underline cursor-pointer"
                        >
                          Log in
                        </button>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {drawerStep === 3 && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-black text-slate-850 mb-1 tracking-tight">Confirm Booking</h4>
                    <p className="text-xs text-slate-400 mb-6 font-semibold">Check details and complete your reservation.</p>
                  </div>

                  {/* Booking Summary Box */}
                  <div className="bg-white border border-slate-205 rounded-2xl p-4 shadow-sm space-y-3">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-rose-500" /> Summary
                    </h5>
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Date</span>
                        <p className="text-xs font-extrabold text-slate-800">
                          {bookingDates[selectedDateIndex].toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Time</span>
                        <p className="text-xs font-extrabold text-slate-800">{formatSlotLabel(selectedTime)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Party Size</span>
                        <p className="text-xs font-extrabold text-slate-800">{guests} {Number(guests) === 1 ? 'Guest' : 'Guests'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Arrival</span>
                        <p className="text-xs font-extrabold text-slate-800">{arrivalTime}</p>
                      </div>
                    </div>
                  </div>

                  {availabilityStatus === 'loading' && (
                    <div className="flex flex-col items-center justify-center gap-2.5 py-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
                      <Loader2 size={24} className="animate-spin text-rose-600" />
                      <span className="text-slate-400 text-xs font-bold">Verifying seat availability...</span>
                    </div>
                  )}

                  {availabilityStatus === 'unavailable' && (
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-center space-y-3">
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

                  {availabilityStatus === 'available' && (
                    <form onSubmit={handleBook} className="space-y-4">
                      <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-750 text-xs flex items-center justify-center gap-2 font-bold shadow-sm">
                        <CheckCircle size={15} className="text-emerald-650 shrink-0" />
                        <span>Seats available! Complete details below.</span>
                      </div>

                      <div className="space-y-4 pt-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Full Name</label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-rose-500 text-slate-800 font-semibold"
                            placeholder="John Doe"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Phone Number</label>
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                            inputMode="numeric"
                            maxLength={12}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-rose-500 text-slate-800 font-semibold"
                            placeholder="+91 99000-00000"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Approx. Arrival</label>
                          <select
                            value={arrivalTime}
                            onChange={(e) => setArrivalTime(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-rose-500 text-slate-800 font-semibold"
                          >
                            <option value="On time">On time</option>
                            <option value="15 min early">15 min early</option>
                            <option value="10 min late">Up to 10 min late</option>
                            <option value="15 min late">Up to 15 min late</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          className="bg-rose-600 hover:bg-rose-700 text-white rounded-2xl w-full py-3.5 text-xs font-bold shadow-md shadow-rose-600/10 hover-lift transition-all cursor-pointer mt-2"
                        >
                          Confirm Booking
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {drawerStep === 4 && (
                <div className="text-center py-12 px-2 space-y-6">
                  <div className="w-16 h-16 bg-emerald-500/15 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                    <CheckCircle size={32} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 mb-1.5">Booking Confirmed!</h3>
                    <p className="text-slate-500 text-xs leading-relaxed max-w-xs mx-auto font-medium">
                      Your table at <strong>{profile.name}</strong> is successfully reserved. See you soon!
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 text-left max-w-sm mx-auto space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">Guests:</span>
                      <span className="text-slate-800 font-bold">{guests} {Number(guests) === 1 ? 'Guest' : 'Guests'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">Date:</span>
                      <span className="text-slate-800 font-bold">
                        {bookingDates[selectedDateIndex].toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">Time:</span>
                      <span className="text-slate-800 font-bold">{formatSlotLabel(selectedTime)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-semibold">Arrival:</span>
                      <span className="text-slate-800 font-bold">{arrivalTime}</span>
                    </div>
                  </div>

                  <div className="pt-6 max-w-xs mx-auto space-y-3">
                    {lastBookingId && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsDrawerOpen(false);
                          const params = new URLSearchParams({ id: lastBookingId });
                          if (arrivalTime) params.set('arrival', arrivalTime);
                          router.push(`/customer/bookings/confirmation?${params.toString()}`);
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white rounded-2xl px-6 py-3 text-xs font-bold transition-all shadow-md w-full cursor-pointer"
                      >
                        View Confirmation
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        handleResetBooking();
                      }}
                      className="bg-slate-800 hover:bg-slate-900 text-white rounded-2xl px-6 py-3 text-xs font-bold transition-all shadow-md w-full cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer - Sticky (Step 1 only) */}
            {drawerStep === 1 && (
              <div className="border-t border-slate-100 bg-white shrink-0 shadow-lg">
                {/* Terms & Conditions — always visible just above the button */}
                <div className="px-4 pt-4">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        id="termsAcceptFooter"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="sr-only"
                      />
                      {/* Custom checkbox visual — no onClick here; the <label> wrapper
                        handles the toggle via the hidden <input onChange>.
                        Having both causes a double-toggle (net effect = no change). */}
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${acceptedTerms ? 'bg-rose-600 border-rose-600' : 'bg-white border-slate-300 hover:border-rose-400'
                          }`}
                      >
                        {acceptedTerms && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      I agree to the{' '}
                      <a href="#" className="text-rose-600 font-bold hover:underline" onClick={e => e.preventDefault()}>Terms &amp; Conditions</a>
                      {' '}and{' '}
                      <a href="#" className="text-rose-600 font-bold hover:underline" onClick={e => e.preventDefault()}>Cancellation Policy</a>
                    </span>
                  </label>
                </div>

                {/* Proceed button */}
                <div className="px-4 pt-3 pb-4">
                  {selectedTime && !acceptedTerms && (
                    <p className="text-center text-[10px] text-amber-500 font-semibold mb-2">
                      Please accept the Terms &amp; Conditions to proceed
                    </p>
                  )}
                  {!selectedTime && (
                    <p className="text-center text-[10px] text-slate-400 font-semibold mb-2">
                      Select a time slot to continue
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={!selectedTime || !acceptedTerms}
                    onClick={() => {
                      if (!authUser) {
                        setDrawerStep(2);
                        setLoginStep(1);
                        setLoginError(null);
                      } else {
                        setDrawerStep(3);
                        setName(authUser.name || '');
                        setPhone(authUser.phone || '');
                      }
                    }}
                    className={`w-full py-3.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md ${selectedTime && acceptedTerms
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-200 cursor-pointer'
                      : 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed'
                      }`}
                  >
                    Proceed
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      );
}
