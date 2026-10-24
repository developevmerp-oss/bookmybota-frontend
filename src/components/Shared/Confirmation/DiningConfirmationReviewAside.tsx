"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateReviewMutation,
  useGetReviewsQuery,
} from "@/services/api";
import { extractApiError, extractApiSuccessMessage } from "@/lib/apiErrors";
import { readSessionForRole } from "@/lib/authStorage";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import {
  diningReviewFormSchema,
  emptyDiningReviewFormValues,
  type DiningReviewFormValues,
} from "@/lib/diningReviewFormSchema";

function formatRatingOutOf5(value: number) {
  return `${Number(value || 0).toFixed(1)}/5`;
}

function openCustomerLogin() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("open_customer_login"));
  }
}

/** Half-star click input — same interaction as movie confirmation reviews. */
function StarRatingInput({
  value,
  onChange,
  size = 22,
}: {
  value: number;
  onChange: (val: number) => void;
  size?: number;
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
      <span className="ml-2 text-sm font-bold text-slate-600">
        {formatRatingOutOf5(value)}
      </span>
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

function ReviewModal({
  open,
  onClose,
  children,
  footer,
}: {
  open: boolean;
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
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[26rem] max-h-[min(92vh,44rem)] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="relative shrink-0 flex items-center justify-center border-b border-[#EDEDED] px-5 py-3.5">
          <h2 className="text-[1rem] font-semibold text-[#222]">How was your visit?</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 text-[#666] hover:bg-slate-100 rounded-full cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="shrink-0 border-t border-[#EDEDED] px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

/**
 * Dining confirmation rating card + modal — existing createReview / getReviews logic.
 */
export default function DiningConfirmationReviewAside({
  businessId,
  restaurantName,
}: {
  businessId: string;
  restaurantName?: string;
}) {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const authToken = useAppSelector((s) => s.auth.token);
  const [ratingOpen, setRatingOpen] = useState(false);
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
  const loggedInCustomerId = customerSession?.user?.id
    ? String(customerSession.user.id)
    : null;
  const loggedInName = String(customerSession?.user?.name || "").trim();
  const isLoggedIn = Boolean(
    customerSession?.token && customerSession?.user?.role === "customer"
  );

  const { data: reviewsData } = useGetReviewsQuery(businessId, {
    skip: !businessId,
  });
  const eligibility = reviewsData?.eligibility;
  const myReview = useMemo(() => {
    const items = reviewsData?.items ?? [];
    if (!items.length) return null;
    if (loggedInCustomerId) {
      const matchById = items.find(
        (r) => r.customer_id != null && String(r.customer_id) === loggedInCustomerId
      );
      if (matchById) return matchById;
    }
    const name = loggedInName.toLowerCase();
    if (!name) return null;
    return (
      items.find((r) => String(r.user_name || "").trim().toLowerCase() === name) || null
    );
  }, [reviewsData?.items, loggedInCustomerId, loggedInName]);

  const [createReview, { isLoading: submitting }] = useCreateReviewMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<DiningReviewFormValues>({
    resolver: yupResolver(diningReviewFormSchema),
    defaultValues: {
      ...emptyDiningReviewFormValues(),
      user_name: loggedInName || "",
    },
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

  const alreadyReviewed = Boolean(eligibility?.already_reviewed || myReview);
  const canReview = Boolean(eligibility?.can_review) && isLoggedIn && !alreadyReviewed;
  const previewRating = myReview ? Number(myReview.rating) || 0 : 0;

  const openRatingModal = () => {
    if (!isLoggedIn) {
      openCustomerLogin();
      toast.info("Log in to rate this place after your visit on BookMyBota.");
      return;
    }
    if (alreadyReviewed) {
      toast.info("Thanks — you have already reviewed this place.");
      return;
    }
    if (eligibility && !eligibility.has_booking) {
      toast.info("Book a table here on BookMyBota to leave a review.");
      return;
    }
    if (eligibility && !eligibility.visit_ended) {
      toast.info("You can review this place after your visit ends.");
      return;
    }
    if (!canReview && eligibility) {
      toast.info("Review is not available for this booking yet.");
      return;
    }
    reset({
      user_name: loggedInName || "",
      rating: 5,
      text: "",
    });
    setRatingOpen(true);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!businessId) return;
    if (!isLoggedIn) {
      openCustomerLogin();
      toast.info("Please log in to submit a review.");
      return;
    }
    try {
      const res = await createReview({
        businessId,
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

  return (
    <>
      <button
        type="button"
        onClick={openRatingModal}
        className="w-full rounded-2xl border border-[#E8E8E8] bg-white p-6 text-left shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)] transition-shadow cursor-pointer"
      >
        <div className="flex justify-center">
          <StarRatingDisplay value={previewRating || 0} size={28} />
        </div>
        <p className="mt-7 text-[1.15rem] font-bold text-[#111] leading-snug">
          What did you think of {restaurantName ? "the restaurant" : "your visit"}?
        </p>
        <p className="mt-2 text-[0.875rem] text-[#777] leading-relaxed">
          {alreadyReviewed
            ? "Thanks — you have already reviewed this place."
            : !isLoggedIn
              ? "Log in to rate this place after your visit on BookMyBota."
              : eligibility && !eligibility.has_booking
                ? "Book a table here on BookMyBota to leave a review."
                : eligibility && !eligibility.visit_ended
                  ? "You can review this place after your visit ends."
                  : "Rate and review so that it helps others."}
        </p>
      </button>

      <ReviewModal
        open={ratingOpen}
        onClose={() => setRatingOpen(false)}
        footer={
          <button
            type="submit"
            form="dining-confirmation-review-form"
            disabled={submitting}
            className="w-full h-12 rounded-lg bg-[#111] text-white text-[0.9375rem] font-bold transition hover:bg-[#333] disabled:bg-[#BDBDBD] disabled:cursor-not-allowed cursor-pointer inline-flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            Submit review
          </button>
        }
      >
        <form
          id="dining-confirmation-review-form"
          onSubmit={onSubmit}
          noValidate
          className="px-6 py-6 space-y-4"
        >
          <p className="text-[0.95rem] font-semibold text-[#222]">
            How would you rate {restaurantName || "this place"}?
          </p>
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
              placeholder="Share what you liked about the food, staff, service..."
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
            They help others decide where to dine next.
          </p>
        </form>
      </ReviewModal>
    </>
  );
}
