"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import Link from "next/link";
import { ArrowLeft, Building2, Loader2, MapPin, Send } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateVenueInquiryMutation,
  useGetCustomerProfileQuery,
  useGetPublicVenueQuery,
} from "@/services/api";
import { extractApiError, extractApiSuccessMessage } from "@/lib/apiErrors";
import {
  venueInquiryFormSchema,
  type VenueInquiryFormValues,
} from "@/lib/venueInquiryFormSchema";
import { sanitizePhoneInput } from "@/lib/validation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import ArtistMonthCalendar from "@/components/Shared/ArtistMonthCalendar";
import PhoneInput from "@/components/Shared/PhoneInput";
import { formatDate } from "@/lib/dateFormat";

const BRAND = "#6900AA";
const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";

export default function PublicVenueProfilePage({ venueId }: { venueId: string }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const { data: venue, isLoading, isError } = useGetPublicVenueQuery(venueId);
  const customerId = user?.role === "customer" ? user.customer_id || "" : "";
  const { data: customerProfile } = useGetCustomerProfileQuery(customerId, {
    skip: !customerId,
  });
  const [createInquiry, { isLoading: sending }] = useCreateVenueInquiryMutation();

  const freeDates = useMemo(
    () => (venue?.slots || []).map((s) => s.slot_date),
    [venue?.slots]
  );

  const form = useForm<VenueInquiryFormValues>({
    resolver: yupResolver(venueInquiryFormSchema),
    defaultValues: {
      event_date: "",
      event_time: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      event_type: "",
      guest_count: "",
      event_location: "",
      message: "",
    },
    mode: "onBlur",
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = form;

  const selectedDate = watch("event_date");

  useEffect(() => {
    if (!customerProfile) return;
    reset((prev) => ({
      ...prev,
      contact_name: customerProfile.name || prev.contact_name,
      contact_email: customerProfile.email || user?.email || prev.contact_email,
      contact_phone: customerProfile.phone || prev.contact_phone,
    }));
  }, [customerProfile, user?.email, reset]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const data = await createInquiry({
        venueId,
        event_date: values.event_date,
        event_time: values.event_time || undefined,
        contact_name: values.contact_name.trim(),
        contact_email: values.contact_email.trim(),
        contact_phone: sanitizePhoneInput(values.contact_phone),
        event_type: values.event_type?.trim() || undefined,
        guest_count: values.guest_count ? Number(values.guest_count) : undefined,
        event_location: values.event_location?.trim() || undefined,
        message: values.message?.trim() || undefined,
      }).unwrap();
      toast.success(
        extractApiSuccessMessage(
          { message: "Inquiry sent. Check your email for confirmation." },
          "Inquiry sent."
        )
      );
      setValue("message", "");
      setValue("event_date", "");
      void data;
    } catch (err) {
      toast.error(extractApiError(err, "Could not send inquiry"));
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-500">
        Loading venue…
      </div>
    );
  }

  if (isError || !venue) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-4">
        <p className="text-slate-700 font-semibold">Venue not found.</p>
        <Link href="/venues" className="text-violet-700 font-semibold underline">
          Back to venues
        </Link>
      </div>
    );
  }

  const place = [venue.city_name, venue.city_state].filter(Boolean).join(", ");

  return (
    <div className="min-h-screen bg-[#faf7fc]">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <Link
          href="/venues"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900"
        >
          <ArrowLeft size={16} /> All venues
        </Link>

        <div className="bg-white rounded-3xl border border-[#EFD7FF] overflow-hidden shadow-sm">
          <div className="grid md:grid-cols-[240px_1fr]">
            <div className="aspect-[3/4] md:aspect-auto md:min-h-[280px] bg-[#F7E9FF] relative">
              {venue.cover_image_url ? (
                <img
                  src={venue.cover_image_url}
                  alt={venue.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-violet-700">
                  <Building2 size={48} />
                </div>
              )}
            </div>
            <div className="p-6 md:p-8 space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: BRAND }}>
                {venue.type_name || "Registered venue"}
              </p>
              <h1 className="text-3xl font-black text-slate-900">{venue.name}</h1>
              {place ? (
                <p className="text-sm text-slate-500 flex items-center gap-1.5">
                  <MapPin size={14} style={{ color: BRAND }} /> {place}
                </p>
              ) : null}
              {venue.description ? (
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {venue.description}
                </p>
              ) : (
                <p className="text-sm text-slate-400">No description yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-800">Free dates</h2>
            <p className="text-sm text-slate-500">
              Green days are open. Select one to request a booking.
            </p>
            <ArtistMonthCalendar
              freeDates={freeDates}
              selectedDate={selectedDate || null}
              mode="pick"
              onSelectDate={(date) =>
                setValue("event_date", date, { shouldDirty: true, shouldValidate: true })
              }
            />
            {freeDates.length === 0 ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                This venue has not published free days yet. Check back later.
              </p>
            ) : null}
          </div>

          <form
            onSubmit={onSubmit}
            className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 h-fit"
            noValidate
          >
            <h2 className="text-lg font-bold text-slate-800">Send booking inquiry</h2>
            <p className="text-xs text-slate-500">
              The venue receives this request in their panel and by email.
            </p>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                Selected date
              </label>
              <input
                readOnly
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3 text-sm font-semibold"
                value={selectedDate ? formatDate(selectedDate) : "Pick a free day on the calendar"}
              />
              {errors.event_date && <p className={fieldErrorClass}>{errors.event_date.message}</p>}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                Preferred time (optional)
              </label>
              <input type="time" className="input-field" {...register("event_time")} />
              {errors.event_time && <p className={fieldErrorClass}>{errors.event_time.message}</p>}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                Your name
              </label>
              <input className="input-field" {...register("contact_name")} />
              {errors.contact_name && (
                <p className={fieldErrorClass}>{errors.contact_name.message}</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                Email
              </label>
              <input type="email" className="input-field" {...register("contact_email")} />
              {errors.contact_email && (
                <p className={fieldErrorClass}>{errors.contact_email.message}</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                Phone
              </label>
              <Controller
                name="contact_phone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    value={field.value || ""}
                    onChange={(v) => field.onChange(v)}
                    onValidChange={() => undefined}
                    required
                  />
                )}
              />
              {errors.contact_phone && (
                <p className={fieldErrorClass}>{errors.contact_phone.message}</p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                  Event type
                </label>
                <input
                  className="input-field"
                  placeholder="Wedding, corporate…"
                  {...register("event_type")}
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                  Guest count
                </label>
                <input
                  type="number"
                  min={1}
                  className="input-field"
                  placeholder="e.g. 150"
                  {...register("guest_count")}
                />
                {errors.guest_count && (
                  <p className={fieldErrorClass}>{errors.guest_count.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                Setup / notes
              </label>
              <input
                className="input-field"
                placeholder="Hall preference, seating style…"
                {...register("event_location")}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">
                Message
              </label>
              <textarea
                rows={3}
                className="input-field resize-none"
                placeholder="Tell the venue about your event…"
                {...register("message")}
              />
              {errors.message && <p className={fieldErrorClass}>{errors.message.message}</p>}
            </div>

            <button
              type="submit"
              disabled={sending || freeDates.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-xl text-white font-bold disabled:opacity-50"
              style={{ backgroundColor: BRAND }}
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Send inquiry
            </button>
            {!customerId ? (
              <p className="text-[11px] text-slate-400 text-center">
                You can send without logging in. Signing in prefills your details.
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
