"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  AlertCircle,
  Loader2,
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
import { formatTime12h, getVenueDateTimeParts } from "@/lib/dateFormat";
import { buildMovieTicketPdf, downloadPdfBlob } from "@/lib/movieTicketPdf";
import { ConfirmationPageUI1Shimmer } from "@/components/Shared/Shimmer";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import {
  movieReviewFormSchema,
  type MovieReviewFormValues,
} from "@/lib/movieReviewFormSchema";
import ConfirmationPageUI1Shell from "./ConfirmationPageUI1Shell";

interface ConfirmationPageUI1Props {
  bookingId: string;
}

function formatRatingOutOf5(value: number) {
  return `${Number(value || 0).toFixed(1)}/5`;
}

function showMetaLine(startsAt?: string): string {
  if (!startsAt) return "";
  const parts = getVenueDateTimeParts(startsAt);
  if (!parts) return formatTime12h(startsAt);
  const month = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 12)).toLocaleDateString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  const day = String(parts.d).padStart(2, "0");
  return `${parts.weekdayLong.slice(0, 3)}, ${day} ${month} | ${formatTime12h(startsAt)}`;
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

function StarRatingDisplay({ value, size = 28 }: { value: number; size?: number }) {
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

function ReviewModalShell({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 print:hidden">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[26rem] max-h-[min(92vh,52rem)] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        {title ? (
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
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="shrink-0 border-t border-[#EDEDED] px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

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
  const [ratingOpen, setRatingOpen] = useState(false);
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
  const previewRating = myReview ? Number(myReview.rating) || 0 : 0;  // Determine if the show has completed according to panel/backend logic
  const isShowEnded = useMemo(() => {
    if (reviewMeta?.show_ended) return true;
    const startsAt = booking?.showtime_starts_at;
    if (!startsAt) return false;
    try {
      const raw = String(startsAt).replace(" ", "T");
      const startTime = new Date(raw.includes("T") ? raw : `${raw}T00:00:00`).getTime();
      if (Number.isNaN(startTime)) return false;
      const endsAt = booking?.showtime_ends_at;
      if (endsAt) {
        const rawEnd = String(endsAt).replace(" ", "T");
        const endTime = new Date(rawEnd.includes("T") ? rawEnd : `${rawEnd}T00:00:00`).getTime();
        if (!Number.isNaN(endTime)) return Date.now() >= endTime;
      }
      // Fallback 2 hours duration
      return Date.now() >= startTime + 2 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }, [
    reviewMeta?.show_ended,
    booking?.showtime_starts_at,
    booking?.showtime_ends_at,
  ]);

  const canShowReview = isShowEnded && !alreadyReviewed;

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

  const amountRows = useMemo(() => {
    if (!booking) return [];
    const rows = [
      {
        label: "Net Ticket(s) Price",
        value: formatMoney(Number(booking.ticket_amount) || 0),
      },
    ];
    if (Number(booking.beverage_total) > 0) {
      rows.push({
        label: "Snacks & beverages",
        value: formatMoney(Number(booking.beverage_total) || 0),
      });
    }
    if (Number(booking.convenience_fee_total) > 0) {
      rows.push({
        label: "Convenience fee",
        value: formatMoney(Number(booking.convenience_fee_total) || 0),
      });
    }
    if (Number(booking.discount_amount) > 0) {
      rows.push({
        label: `Discount${booking.promo_code ? ` (${booking.promo_code})` : ""}`,
        value: `− ${formatMoney(Number(booking.discount_amount) || 0)}`,
      });
    }
    return rows;
  }, [booking]);

  if (isLoading) {
    return <ConfirmationPageUI1Shimmer showAside={false} />;
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

  const movieReviewAside = (
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
            : "Rate and review the movie so that it helps others."}
      </p>
    </button>
  );

  return (
    <>
      <ConfirmationPageUI1Shell
        showAside={canShowReview}
        aside={canShowReview ? movieReviewAside : undefined}
        backHref="/customer/dashboard"
        pageTitle="Your Ticket"
        title={booking.movie_title || "Movie"}
        posterUrl={poster}
        formatMeta={formatMeta}
        whenLine={whenLine}
        venueLine={cinemaLine}
        offerLabel={
          hasOffer
            ? booking.promo_code
              ? `Offer: ${booking.promo_code}`
              : `Offer · −${formatMoney(Number(booking.discount_amount) || 0)}`
            : undefined
        }
        ticketCountLabel={`${ticketCount} Ticket${ticketCount === 1 ? "" : "(s)"}`}
        primaryLabel={booking.screen_name || "Screen"}
        secondaryLabel={seatsLabel}
        bookingCode={bookingCode}
        qrValue={qrValue}
        totalFormatted={formatMoney(Number(booking.grand_total) || 0)}
        totalNote={
          Number(booking.convenience_fee_total || 0) > 0
            ? `Includes ${formatMoney(Number(booking.convenience_fee_total))} convenience fee & VAT`
            : undefined
        }
        amountRows={amountRows}
        cancellationNote="Cancellation unavailable : cut-off time of 20 minutes before showtime has passed"
        supportHref="/customer/help"
        mTicketLabel="M-Ticket"
        onDownloadPdf={handleDownloadPdf}
        downloading={downloading}
        exploreHref="/movies"
        showQr={true}
        directDetails={true}
      />

      {/* Rating modal */}
      <ReviewModalShell
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
      </ReviewModalShell>
    </>
  );
}
