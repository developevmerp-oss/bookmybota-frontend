"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  ArrowLeft,
  Download,
  Film,
  Link2,
  Loader2,
  Phone,
  Share2,
  AlertCircle,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCreateMovieReviewMutation,
  useGetMovieBookingQuery,
  useGetPublicMovieReviewsQuery,
} from "@/services/api";
import { extractApiError, extractApiSuccessMessage } from "@/lib/apiErrors";
import { readSessionForRole } from "@/lib/authStorage";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { formatMoney } from "@/lib/currencyFormat";
import { formatTime12h } from "@/lib/dateFormat";
import { buildMovieTicketPdf, downloadPdfBlob } from "@/lib/movieTicketPdf";
import { ConfirmationPageUI1Shimmer } from "@/components/Shared/Shimmer";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import {
  movieReviewFormSchema,
  type MovieReviewFormValues,
} from "@/lib/movieReviewFormSchema";
import images from "@/Images";

interface ConfirmationPageUI1Props {
  bookingId: string;
}

const PAGE_BG = "#F2F2F2";
const PAGE_MAX = "mx-auto w-full max-w-[72rem] px-4 sm:px-6 lg:px-10";
const CUT_SIZE = 24; // px diameter — half hangs off the ticket edge

const HIDE_SCROLLBAR =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

const logoSrc = typeof images.logo === "string" ? images.logo : images.logo.src;

function formatRatingOutOf5(value: number) {
  return `${Number(value || 0).toFixed(1)}/5`;
}

function showMetaLine(startsAt?: string): string {
  if (!startsAt) return "";
  try {
    const raw = String(startsAt).replace(" ", "T");
    const d = new Date(raw.includes("T") ? raw : `${raw}T00:00:00`);
    if (Number.isNaN(d.getTime())) return formatTime12h(startsAt);
    const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
    const day = d.toLocaleDateString("en-GB", { day: "2-digit" });
    const month = d.toLocaleDateString("en-GB", { month: "short" });
    return `${weekday}, ${day} ${month} | ${formatTime12h(startsAt)}`;
  } catch {
    return formatTime12h(startsAt);
  }
}

function seatListLabel(
  seats: Array<{ seat_identifier: string; tier_name?: string }> | undefined
): string {
  if (!seats?.length) return "—";
  return seats
    .map((s) => {
      const id = s.seat_identifier;
      if (s.tier_name && !id.toLowerCase().includes(s.tier_name.toLowerCase())) {
        return `${s.tier_name} ${id}`;
      }
      return id;
    })
    .join(", ");
}

function openCustomerLogin() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("open_customer_login"));
  }
}

/** Same half-star click input used on movie detail reviews. */
function StarRatingInput({
  value,
  onChange,
  size = 22,
  showValue = true,
}: {
  value: number;
  onChange: (val: number) => void;
  size?: number;
  showValue?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <div
          key={star}
          className="relative cursor-pointer"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            onChange(x < rect.width / 2 ? star - 0.5 : star);
          }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            onChange(x < rect.width / 2 ? star - 0.5 : star);
          }}
        >
          <Star
            size={size}
            strokeWidth={1.5}
            className={
              value >= star ? "fill-amber-400 text-amber-400" : "text-slate-300 fill-slate-100"
            }
          />
          {value === star - 0.5 && (
            <div className="absolute top-0 left-0 overflow-hidden w-[50%] h-full pointer-events-none">
              <Star size={size} strokeWidth={1.5} className="fill-amber-400 text-amber-400" />
            </div>
          )}
        </div>
      ))}
      {showValue ? (
        <span className="ml-2 text-sm font-bold text-slate-600">
          {formatRatingOutOf5(value)}
        </span>
      ) : null}
    </div>
  );
}

function StarRatingDisplay({ value, size = 22 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-1 pointer-events-none" aria-hidden>
      {[1, 2, 3, 4, 5].map((star) => (
        <div key={star} className="relative">
          <Star
            size={size}
            strokeWidth={1.5}
            className={
              value >= star ? "fill-amber-400 text-amber-400" : "text-slate-300 fill-slate-100"
            }
          />
          {value === star - 0.5 && (
            <div className="absolute top-0 left-0 overflow-hidden w-[50%] h-full">
              <Star size={size} strokeWidth={1.5} className="fill-amber-400 text-amber-400" />
            </div>
          )}
        </div>
      ))}
      {value > 0 ? (
        <span className="ml-2 text-sm font-bold text-slate-600">
          {formatRatingOutOf5(value)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * True scalloped ticket edge via CSS mask (transparent holes — not painted circles).
 * Base fill + destination-out circles so the dimmed overlay shows through naturally.
 */
function ticketNotchMask(corners: {
  topLeft?: boolean;
  topRight?: boolean;
  bottomLeft?: boolean;
  bottomRight?: boolean;
}): CSSProperties {
  const r = CUT_SIZE / 2;
  const holes: string[] = [];
  if (corners.topLeft) {
    holes.push(`radial-gradient(circle ${r}px at 0 0, #000 ${r}px, transparent ${r}px)`);
  }
  if (corners.topRight) {
    holes.push(`radial-gradient(circle ${r}px at 100% 0, #000 ${r}px, transparent ${r}px)`);
  }
  if (corners.bottomLeft) {
    holes.push(`radial-gradient(circle ${r}px at 0 100%, #000 ${r}px, transparent ${r}px)`);
  }
  if (corners.bottomRight) {
    holes.push(`radial-gradient(circle ${r}px at 100% 100%, #000 ${r}px, transparent ${r}px)`);
  }
  if (!holes.length) return {};
  const image = [`linear-gradient(#000, #000)`, ...holes].join(", ");
  return {
    WebkitMaskImage: image,
    maskImage: image,
    WebkitMaskComposite: holes.map(() => "destination-out").join(", "),
    maskComposite: holes.map(() => "exclude").join(", "),
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
  };
}

/** Page ticket: soft notches matching gray page bg (no dotted line). */
function TicketCut({ fill = PAGE_BG }: { fill?: string }) {
  return (
    <div className="relative z-30 h-0 pointer-events-none select-none" aria-hidden>
      <span
        className="absolute top-0 left-0 rounded-full"
        style={{
          width: CUT_SIZE,
          height: CUT_SIZE,
          backgroundColor: fill,
          transform: "translate(-50%, -50%)",
        }}
      />
      <span
        className="absolute top-0 right-0 rounded-full"
        style={{
          width: CUT_SIZE,
          height: CUT_SIZE,
          backgroundColor: fill,
          transform: "translate(50%, -50%)",
        }}
      />
    </div>
  );
}

/** Hairline inside a masked band — inset past notch radius so it never crosses the cut. */
function TicketBandEdgeLine({ edge }: { edge: "top" | "bottom" }) {
  const inset = CUT_SIZE + 2;
  return (
    <div className="pointer-events-none" aria-hidden>
      <div
        className={`border-[#E8E8E8] ${edge === "top" ? "border-t" : "border-b"}`}
        style={{ marginLeft: inset, marginRight: inset }}
      />
    </div>
  );
}

function ModalShell({
  open,
  title,
  onClose,
  children,
  footer,
  maxWidthClass = "max-w-[26rem]",
  overlayClass = "bg-black/50",
  hideHeader = false,
  panelClass = "",
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
  overlayClass?: string;
  hideHeader?: boolean;
  panelClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 print:hidden">
      {/* Translucent scrim so page + ticket cuts show through (not solid black). */}
      <button
        type="button"
        className={`absolute inset-0 cursor-pointer ${overlayClass}`}
        style={
          hideHeader
            ? { backgroundColor: "rgba(0, 0, 0, 0.45)" }
            : undefined
        }
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${maxWidthClass} max-h-[min(92vh,52rem)] flex flex-col animate-[confirmHeaderIn_0.28s_ease-out] ${
          hideHeader
            ? /* side padding + no x-clip so punch halves sit in the gutter */
              `overflow-y-auto ${HIDE_SCROLLBAR} ${panelClass}`
            : "rounded-2xl bg-white shadow-2xl overflow-hidden"
        }`}
      >
        {!hideHeader && title ? (
          <div className="relative shrink-0 flex items-center justify-center border-b border-[#EDEDED] px-5 py-3.5">
            <h2 className="text-[1rem] font-semibold text-[#222]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 text-[#666] hover:bg-slate-100 rounded-full cursor-pointer"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        ) : null}
        <div className={hideHeader ? "" : `min-h-0 flex-1 overflow-y-auto ${HIDE_SCROLLBAR}`}>
          {children}
        </div>
        {footer ? <div className="shrink-0 border-t border-[#EDEDED] px-6 py-4">{footer}</div> : null}
      </div>
      <style>{`
        @keyframes confirmHeaderIn {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

/**
 * Confirmation UI v1 — BMS-style ticket (+ optional rating aside for movies).
 * Used via CONFIRMATION_UI_VERSION / comment-switch in module confirmation pages.
 */
export default function ConfirmationPageUI1({
  bookingId,
}: ConfirmationPageUI1Props) {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const authToken = useAppSelector((s) => s.auth.token);

  const { data: booking, isLoading, isError } = useGetMovieBookingQuery(bookingId);
  const movieId = booking?.movie_id || "";

  const { data: reviewsData } = useGetPublicMovieReviewsQuery(movieId, {
    skip: !movieId,
  });
  const reviewMeta = reviewsData?.meta;
  const myReview = useMemo(() => {
    const name = String(authUser?.name || "").trim().toLowerCase();
    if (!name || !reviewsData?.items?.length) return null;
    return (
      reviewsData.items.find(
        (r) => String(r.user_name || "").trim().toLowerCase() === name
      ) || null
    );
  }, [reviewsData?.items, authUser?.name]);

  const [createReview, { isLoading: submittingReview }] = useCreateMovieReviewMutation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const prevLoggedInNameRef = useRef("");

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    const onAuth = () => dispatch(loadFromStorage());
    window.addEventListener("auth_changed", onAuth);
    return () => window.removeEventListener("auth_changed", onAuth);
  }, [dispatch]);

  const customerSession =
    authUser?.role === "customer" && authToken
      ? { user: authUser, token: authToken }
      : readSessionForRole("customer");
  const loggedInName = String(customerSession?.user?.name || "").trim();
  const isLoggedIn = Boolean(
    customerSession?.token && customerSession?.user?.role === "customer"
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<MovieReviewFormValues>({
    resolver: yupResolver(movieReviewFormSchema),
    defaultValues: { user_name: loggedInName, rating: 5, text: "" },
    mode: "onBlur",
  });

  useEffect(() => {
    if (!loggedInName) {
      prevLoggedInNameRef.current = "";
      return;
    }
    const current = (getValues("user_name") || "").trim();
    if (!current || current === prevLoggedInNameRef.current) {
      setValue("user_name", loggedInName, { shouldValidate: true, shouldDirty: false });
    }
    prevLoggedInNameRef.current = loggedInName;
  }, [loggedInName, setValue, getValues]);

  const whenLine = useMemo(
    () => showMetaLine(booking?.showtime_starts_at),
    [booking?.showtime_starts_at]
  );

  const qrValue = booking?.qr_code_token || booking?.booking_code || bookingId;
  const poster =
    resolveMediaUrl(booking?.movie_poster) ||
    resolveMediaUrl(booking?.cinema_image) ||
    "";
  const formatMeta = [booking?.showtime_language, booking?.showtime_format]
    .filter(Boolean)
    .join(", ");
  const cinemaLine = [booking?.cinema_name, booking?.cinema_address]
    .filter(Boolean)
    .join(", ");
  const seatsLabel = seatListLabel(booking?.seats);
  const hasOffer =
    Number(booking?.discount_amount) > 0 || Boolean(booking?.promo_code?.trim());
  const ticketCount = booking?.ticket_qty ?? 0;
  const bookingCode =
    booking?.booking_code || booking?.id.slice(0, 8).toUpperCase() || "";

  const alreadyReviewed = Boolean(reviewMeta?.already_reviewed || myReview);
  const canReview = Boolean(reviewMeta?.can_review) && isLoggedIn && !alreadyReviewed;
  const previewRating = myReview ? Number(myReview.rating) || 0 : 0;

  const handleCopyTicketLink = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ticket link copied to clipboard!");
      setShareOpen(false);
    } catch {
      toast.error("Could not copy the link. Please try again.");
    }
  };

  const handleDownloadPdf = async () => {
    if (!booking) return;
    setDownloading(true);
    try {
      const blob = await buildMovieTicketPdf(booking);
      downloadPdfBlob(blob, `BookMyBota-Movie-${bookingCode}.pdf`);
      toast.success("Ticket PDF downloaded");
    } catch {
      toast.error("Could not prepare the ticket PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const openRatingModal = () => {
    if (!isLoggedIn) {
      openCustomerLogin();
      toast.info("Please log in to submit a review.");
      return;
    }
    if (alreadyReviewed) {
      toast.info("You have already reviewed this movie.");
      return;
    }
    if (reviewMeta && !reviewMeta.has_booking) {
      toast.info("Book tickets for this movie on BookMyBota to leave a review.");
      return;
    }
    if (reviewMeta && !reviewMeta.show_ended) {
      toast.info("You can review this movie after your show ends.");
      return;
    }
    if (!canReview && reviewMeta) {
      toast.info("Review is not available for this booking yet.");
      return;
    }
    reset({ user_name: loggedInName || "", rating: 5, text: "" });
    setRatingOpen(true);
  };

  const onSubmitReview = handleSubmit(async (values) => {
    if (!movieId) return;
    if (!isLoggedIn) {
      openCustomerLogin();
      toast.info("Please log in to submit a review.");
      return;
    }
    try {
      const res = await createReview({
        movieId,
        user_name: values.user_name.trim(),
        rating: values.rating,
        text: values.text.trim(),
      }).unwrap();
      toast.success(extractApiSuccessMessage(res, "Thank you for your review!"));
      reset({
        user_name: loggedInName || values.user_name.trim(),
        rating: 5,
        text: "",
      });
      setRatingOpen(false);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to submit review. Please try again."));
    }
  });

  if (isLoading) {
    return <ConfirmationPageUI1Shimmer showAside />;
  }

  if (isError || !booking) {
    return (
      <div className="min-h-screen bg-white text-slate-800 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="size-12 text-rose-500" />
        <h2 className="text-xl font-bold text-slate-900">Booking Not Found</h2>
        <p className="text-sm text-slate-500 max-w-md">
          We couldn&apos;t retrieve the details for this booking ID.
        </p>
        <Link
          href="/movies"
          className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold"
        >
          Explore Movies
        </Link>
      </div>
    );
  }

  const movieHeader = (
    <div className="relative flex gap-3.5 px-4 pt-5 pb-4 pr-10 sm:px-5">
      <div className="relative shrink-0 w-[4.75rem] overflow-hidden rounded-md bg-[#F3F3F3]">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={poster}
            alt={booking.movie_title || "Movie"}
            className="block h-full w-full object-cover aspect-[2/3]"
          />
        ) : (
          <div className="flex aspect-[2/3] items-center justify-center text-slate-400">
            <Film size={24} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[1.05rem] sm:text-[1.125rem] font-bold text-[#111] leading-snug">
          {booking.movie_title}
        </h3>
        {formatMeta ? (
          <p className="mt-1.5 text-[0.75rem] md:text-[0.8125rem] text-[#757575]">
            {formatMeta}
          </p>
        ) : null}
        {whenLine ? (
          <p className="mt-1 text-[0.75rem] md:text-[0.8125rem] text-[#757575]">
            {whenLine}
          </p>
        ) : null}
        {cinemaLine ? (
          <p className="mt-1 text-[0.75rem] md:text-[0.8125rem] text-[#757575] leading-snug">
            {cinemaLine}
          </p>
        ) : null}
        {hasOffer ? (
          <p className="mt-2 inline-flex rounded bg-[#111] px-2 py-0.5 text-[0.625rem] font-semibold text-white">
            {booking.promo_code
              ? `Offer: ${booking.promo_code}`
              : `Offer · −${formatMoney(Number(booking.discount_amount) || 0)}`}
          </p>
        ) : null}
      </div>
      <span
        className="pointer-events-none absolute right-2.5 top-[52%] text-[0.625rem] font-medium tracking-[0.14em] text-[#B8B8B8]"
        style={{
          writingMode: "vertical-rl",
          transform: "translateY(-50%) rotate(180deg)",
        }}
        aria-hidden
      >
        M-Ticket
      </span>
    </div>
  );

  return (
    <div
      className="min-h-screen w-full overflow-x-hidden pb-12 print:bg-white"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className={`${PAGE_MAX} pt-5 sm:pt-8 print:pt-4`}>
        <div className="mb-5 sm:mb-6 flex items-center gap-2.5 sm:gap-3">
          <Link
            href="/customer/dashboard"
            className="inline-flex h-9 w-9 items-center justify-center text-[#111] hover:opacity-70 cursor-pointer print:hidden"
            aria-label="Back"
          >
            <ArrowLeft size={22} strokeWidth={2} />
          </Link>
          <h1 className="text-[1.25rem] sm:text-[1.375rem] font-bold text-[#111]">Your Ticket</h1>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center text-[#333] hover:opacity-70 cursor-pointer print:hidden"
            aria-label="Share ticket"
          >
            <Share2 size={18} />
          </button>
        </div>

        <div className="mb-3 flex max-w-[28rem] xl:max-w-[30rem] items-center gap-2.5 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2.5 text-[0.75rem] md:text-[0.875rem] text-[#444] print:hidden">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white border border-[#E8E8E8]"
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#111" strokeWidth="1.75">
              <rect x="7" y="2" width="10" height="20" rx="2" />
              <path d="M10 18h4" />
            </svg>
          </span>
          <p className="leading-snug">
            Ticket shared on the contact details provided, have it handy on your phone while
            entering the venue.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start gap-5 lg:gap-8">
          <div className="min-w-0 w-full lg:max-w-[28rem] xl:max-w-[30rem]">
            <div className="relative overflow-visible rounded-2xl border border-[#E8E8E8] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <div className="relative flex gap-3.5 sm:gap-4 px-4 pt-4 pb-5 sm:px-5 sm:pt-5 sm:pb-6 pr-9 sm:pr-11">
                <div className="relative shrink-0 w-[5rem] sm:w-[5.75rem] overflow-hidden rounded-md bg-[#F3F3F3]">
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={poster}
                      alt={booking.movie_title || "Movie"}
                      className="block h-full w-full object-cover aspect-[2/3]"
                    />
                  ) : (
                    <div className="flex aspect-[2/3] items-center justify-center text-slate-400">
                      <Film size={28} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.05rem] sm:text-[1.25rem] font-bold text-[#111] leading-snug">
                    {booking.movie_title}
                  </h2>
                  {formatMeta ? (
                    <p className="mt-2 text-[0.8125rem] md:text-[0.875rem] text-[#777]">
                      {formatMeta}
                    </p>
                  ) : null}
                  {whenLine ? (
                    <p className="mt-1 text-[0.8125rem] md:text-[0.875rem] text-[#777]">
                      {whenLine}
                    </p>
                  ) : null}
                  {cinemaLine ? (
                    <p className="mt-1 text-[0.8125rem] md:text-[0.875rem] text-[#777] leading-snug">
                      {cinemaLine}
                    </p>
                  ) : null}
                  {hasOffer ? (
                    <p className="mt-2.5 inline-flex items-center rounded bg-[#111] px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
                      {booking.promo_code
                        ? `Offer: ${booking.promo_code}`
                        : `Offer · −${formatMoney(Number(booking.discount_amount) || 0)}`}
                    </p>
                  ) : null}
                </div>

                <span
                  className="pointer-events-none absolute right-3 sm:right-4 top-[55%] text-[0.6875rem] md:text-[0.75rem] font-medium tracking-[0.12em] text-[#B0B0B0]"
                  style={{
                    writingMode: "vertical-rl",
                    transform: "translateY(-50%) rotate(180deg)",
                  }}
                  aria-hidden
                >
                  M-Ticket
                </span>
              </div>

              <div
                className="relative z-20 print:hidden"
                style={{
                  paddingLeft: CUT_SIZE,
                  paddingRight: CUT_SIZE,
                  marginBottom: -(CUT_SIZE / 2),
                }}
              >
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  className="relative z-20 w-full rounded-full bg-[#F0F0F0] hover:bg-[#E4E4E4] px-4 py-[0.65rem] text-center text-[0.8125rem] md:text-[0.875rem] font-medium text-[#333] cursor-pointer transition-colors"
                >
                  Tap for support, details &amp; more actions
                </button>
              </div>
              <TicketCut fill={PAGE_BG} />

              <div className="px-4 sm:px-5 pt-6 pb-0">
                <div className="flex items-start gap-4 sm:gap-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=4&data=${encodeURIComponent(
                      qrValue
                    )}`}
                    alt={`QR ${bookingCode}`}
                    className="h-[7.25rem] w-[7.25rem] sm:h-[8rem] sm:w-[8rem] shrink-0 bg-white"
                  />
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[0.75rem] md:text-[0.8125rem] text-[#888]">
                      {ticketCount} Ticket{ticketCount === 1 ? "" : "(s)"}
                    </p>
                    <p className="mt-1 text-[1.2rem] sm:text-[1.35rem] font-bold text-[#111] uppercase leading-tight">
                      {booking.screen_name || "Screen"}
                    </p>
                    <p className="mt-1.5 text-[0.8125rem] md:text-[0.875rem] text-[#555] break-words leading-snug">
                      {seatsLabel}
                    </p>
                    <p className="mt-3 text-[0.8125rem] md:text-[0.875rem] font-bold text-[#111] tracking-wide">
                      BOOKING ID: {bookingCode}
                    </p>
                  </div>
                </div>

                <div className="mt-5 -mx-4 sm:-mx-5 bg-[#F5F5F5] px-4 sm:px-5 py-2.5 text-center text-[0.6875rem] md:text-[0.8125rem] text-[#777] leading-snug">
                  Cancellation unavailable : cut-off time of 20 minutes before showtime has passed
                </div>

                <div className="flex items-center justify-between gap-3 py-4 text-[0.9375rem] text-[#111]">
                  <span className="font-medium">Total Amount</span>
                  <span className="font-bold tabular-nums">
                    {formatMoney(Number(booking.grand_total) || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[22rem] xl:w-[24rem] shrink-0 print:hidden">
            <button
              type="button"
              onClick={openRatingModal}
              className="w-full rounded-2xl border border-[#E8E8E8] bg-white p-6 text-left shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)] transition-shadow cursor-pointer"
            >
              <div className="flex justify-center">
                <StarRatingDisplay value={previewRating || 0} size={28} />
              </div>
              <p className="mt-7 text-[1.15rem] font-bold text-[#111] leading-snug">
                What did you think of the movie?
              </p>
              <p className="mt-2 text-[0.875rem] text-[#777] leading-relaxed">
                {alreadyReviewed
                  ? `Thanks — you rated this ${formatRatingOutOf5(previewRating)}.`
                  : !isLoggedIn
                    ? "Log in to rate and review this movie."
                    : reviewMeta && !reviewMeta.show_ended
                      ? "You can review after your show ends."
                      : "Rate and review the movie so that it helps others."}
              </p>
            </button>

            <div className="mt-8 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt="Book My Bota"
                className="h-12 lg:h-14 w-auto object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Share — Copy Link only */}
      <ModalShell
        open={shareOpen}
        title="Share"
        onClose={() => setShareOpen(false)}
        maxWidthClass="max-w-[22rem] sm:max-w-[24rem]"
        overlayClass="bg-black/50"
      >
        <button
          type="button"
          onClick={() => void handleCopyTicketLink()}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left text-[0.9375rem] text-[#111] hover:bg-[#FAFAFA] cursor-pointer transition-colors"
        >
          <span>Copy Link</span>
          <Link2 size={20} strokeWidth={1.75} className="shrink-0 text-[#555]" />
        </button>
      </ModalShell>

      {/* Rating — same 5-star half-click + form schema as movie reviews */}
      <ModalShell
        open={ratingOpen}
        title="How was the movie?"
        onClose={() => setRatingOpen(false)}
        footer={
          <button
            type="submit"
            form="movie-confirmation-review-form"
            disabled={submittingReview}
            className="w-full h-12 rounded-lg bg-[#111] text-white text-[0.9375rem] font-bold transition hover:bg-[#333] disabled:bg-[#BDBDBD] disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center gap-2"
          >
            {submittingReview ? <Loader2 size={16} className="animate-spin" /> : null}
            Submit review
          </button>
        }
      >
        <form
          id="movie-confirmation-review-form"
          onSubmit={onSubmitReview}
          noValidate
          className="px-6 py-6 space-y-4"
        >
          <p className="text-[0.95rem] font-semibold text-[#222]">How would you rate the movie?</p>
          <div>
            <Controller
              name="rating"
              control={control}
              render={({ field }) => (
                <StarRatingInput
                  value={Number(field.value) || 5}
                  onChange={field.onChange}
                  size={28}
                />
              )}
            />
            {errors.rating ? (
              <p className="mt-1 text-xs font-semibold text-red-600">{errors.rating.message}</p>
            ) : null}
          </div>
          <div>
            <input
              {...register("user_name")}
              placeholder="Your name"
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 ${
                errors.user_name
                  ? "border-red-400 focus:ring-red-200"
                  : "border-slate-200 focus:border-[#111] focus:ring-[#111]/15"
              }`}
            />
            {errors.user_name ? (
              <p className="mt-1 text-xs font-semibold text-red-600">{errors.user_name.message}</p>
            ) : null}
          </div>
          <div>
            <textarea
              {...register("text")}
              placeholder="Share what you liked about the film..."
              rows={4}
              className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 resize-y focus:outline-none focus:ring-2 ${
                errors.text
                  ? "border-red-400 focus:ring-red-200"
                  : "border-slate-200 focus:border-[#111] focus:ring-[#111]/15"
              }`}
            />
            {errors.text ? (
              <p className="mt-1 text-xs font-semibold text-red-600">{errors.text.message}</p>
            ) : null}
          </div>
          <p
            className="pt-2 text-center text-[1.25rem] text-[#222]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }}
          >
            Your ratings matter!
          </p>
          <p className="text-center text-[0.8125rem] text-[#888]">
            They help others decide what to watch next.
          </p>
        </form>
      </ModalShell>

      {/* Details popup — natural scalloped cuts (mask holes, not black circles) */}
      <ModalShell
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        hideHeader
        maxWidthClass="max-w-[28rem] sm:max-w-[30rem]"
        overlayClass=""
        panelClass="px-4 sm:px-5"
      >
        {/* No filter on masked ticket — keeps notch holes truly transparent over the scrim */}
        <div className="relative">
          {/* Top band — bottom edge scalloped */}
          <div
            className="relative bg-white rounded-t-2xl shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
            style={ticketNotchMask({ bottomLeft: true, bottomRight: true })}
          >
            {movieHeader}
            <div
              className="relative z-20 pb-3"
              style={{ paddingLeft: CUT_SIZE, paddingRight: CUT_SIZE }}
            >
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="relative z-20 w-full rounded-full bg-[#F0F0F0] hover:bg-[#E8E8E8] px-4 py-[0.6rem] text-center text-[0.8125rem] font-medium text-[#333] cursor-pointer"
              >
                Tap to hide details
              </button>
            </div>
            <TicketBandEdgeLine edge="bottom" />
          </div>

          {/* Middle band — scalloped top + bottom */}
          <div
            className="relative bg-white shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
            style={ticketNotchMask({
              topLeft: true,
              topRight: true,
              bottomLeft: true,
              bottomRight: true,
            })}
          >
            <div className="px-6 sm:px-7 pt-7 pb-0 text-center">
              <p className="text-[0.75rem] md:text-[0.8125rem] text-[#888]">
                {ticketCount} Ticket{ticketCount === 1 ? "" : "(s)"}
              </p>
              <p className="mt-1.5 text-[1.4rem] font-bold text-[#111] uppercase tracking-wide">
                {booking.screen_name || "Screen"}
              </p>
              <p className="mt-1.5 text-[0.8125rem] md:text-[0.875rem] text-[#555] break-words leading-snug">
                {seatsLabel}
              </p>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(
                  qrValue
                )}`}
                alt={`QR ${bookingCode}`}
                className="mx-auto mt-5 h-[12rem] w-[12rem] sm:h-[13rem] sm:w-[13rem] bg-white"
              />

              <p className="mt-4 text-[0.8125rem] font-bold text-[#111] tracking-wide">
                BOOKING ID: {bookingCode}
              </p>

              <div className="mt-5 -mx-6 sm:-mx-7 bg-[#F5F5F5] px-4 py-2.5 text-[0.6875rem] md:text-[0.8125rem] text-[#757575] leading-snug">
                Cancellation unavailable : cut-off time of 20 minutes before showtime has passed
              </div>

              <Link
                href="/customer/help"
                className="mt-5 mb-6 inline-flex flex-col items-center gap-1.5 text-[#333] hover:opacity-80"
              >
                <Phone size={22} strokeWidth={1.6} />
                <span className="text-[0.8125rem] font-medium">Contact support</span>
              </Link>
            </div>
            <TicketBandEdgeLine edge="bottom" />
          </div>

          {/* Bottom band — top edge scalloped */}
          <div
            className="relative bg-white rounded-b-2xl shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
            style={ticketNotchMask({ topLeft: true, topRight: true })}
          >
            <div className="px-6 sm:px-7 pt-5 pb-6 text-left">
              <div className="space-y-2.5 text-[0.8125rem] text-[#666]">
                <div className="flex justify-between gap-3 text-[0.9375rem] font-bold text-[#111]">
                  <span>Total Amount</span>
                  <span className="tabular-nums">
                    {formatMoney(Number(booking.grand_total) || 0)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Net Ticket(s) Price</span>
                  <span className="tabular-nums">
                    {formatMoney(Number(booking.ticket_amount) || 0)}
                  </span>
                </div>
                {Number(booking.beverage_total) > 0 ? (
                  <div className="flex justify-between gap-3">
                    <span>Snacks &amp; beverages</span>
                    <span className="tabular-nums">
                      {formatMoney(Number(booking.beverage_total) || 0)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3">
                  <span>Convenience fee</span>
                  <span className="tabular-nums">
                    {formatMoney(Number(booking.convenience_fee_total) || 0)}
                  </span>
                </div>
                {Number(booking.discount_amount) > 0 ? (
                  <div className="flex justify-between gap-3 text-[#111]">
                    <span>
                      Discount
                      {booking.promo_code ? ` (${booking.promo_code})` : ""}
                    </span>
                    <span className="tabular-nums">
                      − {formatMoney(Number(booking.discount_amount) || 0)}
                    </span>
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => void handleDownloadPdf()}
                disabled={downloading}
                className="mt-5 inline-flex w-full items-center justify-center gap-1.5 h-11 rounded-lg bg-[#111] text-white text-[0.875rem] font-semibold hover:bg-[#333] disabled:opacity-60 cursor-pointer"
              >
                {downloading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Download size={15} />
                )}
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </ModalShell>
    </div>
  );
}
