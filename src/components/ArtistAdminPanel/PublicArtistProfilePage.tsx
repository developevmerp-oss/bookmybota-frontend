"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Briefcase, CalendarDays, Clock, Loader2, Mail, MapPin, MessageSquare, Mic2, Phone, User } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateArtistInquiryMutation,
  useGetCustomerProfileQuery,
  useGetPublicArtistQuery,
} from "@/services/api";
import { extractApiError, extractApiSuccessMessage } from "@/lib/apiErrors";
import {
  artistInquiryFormSchema,
  type ArtistInquiryFormValues,
} from "@/lib/artistInquiryFormSchema";
import { sanitizePhoneInput } from "@/lib/validation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import ArtistMonthCalendar from "@/components/Shared/ArtistMonthCalendar";
import PhoneInput from "@/components/Shared/PhoneInput";
import PreferredTimeSelect from "@/components/Shared/PreferredTimeSelect";
import { formatDate } from "@/lib/dateFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";

const BRAND = "#6900AA";
const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";
const inquiryInput =
  "w-full rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6900AA]/20 focus:border-[#C4B5FD] focus:bg-white";

function InquiryLabel({
  icon: Icon,
  children,
}: {
  icon: typeof CalendarDays;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <Icon size={13} strokeWidth={2} className="shrink-0 text-[#9CA3AF]" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">
        {children}
      </span>
    </div>
  );
}

export default function PublicArtistProfilePage({ artistId }: { artistId: string }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const { data: artist, isLoading, isError } = useGetPublicArtistQuery(artistId);
  const customerId = user?.role === "customer" ? user.customer_id || "" : "";
  const { data: customerProfile } = useGetCustomerProfileQuery(customerId, {
    skip: !customerId,
  });
  const [createInquiry, { isLoading: sending }] = useCreateArtistInquiryMutation();

  const freeDates = useMemo(
    () => (artist?.slots || []).map((s) => s.slot_date),
    [artist?.slots]
  );

  const form = useForm<ArtistInquiryFormValues>({
    resolver: yupResolver(artistInquiryFormSchema),
    defaultValues: {
      event_date: "",
      event_time: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      event_type: "",
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
        artistId,
        event_date: values.event_date,
        event_time: values.event_time || undefined,
        contact_name: values.contact_name.trim(),
        contact_email: values.contact_email.trim(),
        contact_phone: sanitizePhoneInput(values.contact_phone),
        event_type: values.event_type?.trim() || undefined,
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
        Loading artist…
      </div>
    );
  }

  if (isError || !artist) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-4">
        <p className="text-slate-700 font-semibold">Artist not found.</p>
        <Link href="/artists" className="text-violet-700 font-semibold underline">
          Back to artists
        </Link>
      </div>
    );
  }

  const place = [artist.city_name, artist.city_state].filter(Boolean).join(", ");
  const coverSrc = artist.cover_image_url ? resolveMediaUrl(artist.cover_image_url) : "";
  const metaParts = [artist.type_name || "Registered artist", place].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#faf7fc]">
      <header className="relative w-full overflow-hidden">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
          />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-[#EDE4F7]" />
        )}
        <div aria-hidden className="absolute inset-0 bg-white/78" />

        <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:py-8 md:py-10">
          <Link
            href="/artists"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B1B3A]/80 hover:text-[#6900AA]"
          >
            <ArrowLeft size={16} /> All artists
          </Link>

          <div className="mt-5 flex flex-col items-center gap-6 sm:gap-8 md:mt-7 md:flex-row md:items-center md:gap-10 lg:gap-12">
            <div className="relative h-56 w-44 shrink-0 overflow-hidden rounded-2xl bg-[#F3F4F6] shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:h-64 sm:w-48 md:h-72 md:w-52">
              {coverSrc ? (
                <img
                  src={coverSrc}
                  alt={artist.name}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-500">
                  <Mic2 size={48} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 text-center md:text-left">
              {metaParts.length > 0 ? (
                <p className="text-sm font-semibold text-[#1B1B3A]">
                  {metaParts.join(" | ")}
                </p>
              ) : null}
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#111111] sm:text-4xl md:text-5xl">
                {artist.name}
              </h1>
              {artist.description ? (
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#374151] sm:text-[15px] md:mx-0 mx-auto line-clamp-4 whitespace-pre-wrap">
                  {artist.description}
                </p>
              ) : (
                <p className="mt-3 text-sm text-[#9ca3af]">No bio yet.</p>
              )}
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("artist-inquiry")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-[#111111] px-7 text-sm font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
              >
                Send inquiry
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="grid lg:grid-cols-2 gap-6 items-start">
          <div className="h-fit space-y-3">
            <ArtistMonthCalendar
              variant="glass"
              title="Book calendar"
              subtitle="Highlighted days are open. Select one to request a booking."
              freeDates={freeDates}
              selectedDate={selectedDate || null}
              mode="pick"
              onSelectDate={(date) =>
                setValue("event_date", date, { shouldDirty: true, shouldValidate: true })
              }
            />
            {freeDates.length === 0 ? (
              <p className="text-sm text-amber-800 bg-amber-50/80 border border-amber-200 rounded-2xl px-3 py-2">
                This artist has not published free days yet. Check back later.
              </p>
            ) : null}
          </div>

          <form
            id="artist-inquiry"
            onSubmit={onSubmit}
            className="relative rounded-[1.5rem] border border-[#F0EAF7] bg-white p-5 sm:p-6 space-y-4 h-fit shadow-[0_10px_30px_rgba(105,0,170,0.07)] scroll-mt-28"
            noValidate
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <InquiryLabel icon={CalendarDays}>Selected date</InquiryLabel>
                <input
                  readOnly
                  className={`${inquiryInput} ${selectedDate ? "font-semibold text-[#1B1B3A]" : ""}`}
                  value={selectedDate ? formatDate(selectedDate) : "Pick a free day on the calendar"}
                />
                {errors.event_date && <p className={fieldErrorClass}>{errors.event_date.message}</p>}
              </div>

              <div>
                <InquiryLabel icon={Clock}>Preferred time (optional)</InquiryLabel>
                <Controller
                  name="event_time"
                  control={control}
                  render={({ field }) => (
                    <PreferredTimeSelect value={field.value || ""} onChange={field.onChange} />
                  )}
                />
                {errors.event_time && <p className={fieldErrorClass}>{errors.event_time.message}</p>}
              </div>

              <div>
                <InquiryLabel icon={User}>Your name</InquiryLabel>
                <input className={inquiryInput} {...register("contact_name")} />
                {errors.contact_name && (
                  <p className={fieldErrorClass}>{errors.contact_name.message}</p>
                )}
              </div>

              <div>
                <InquiryLabel icon={Mail}>Email</InquiryLabel>
                <input
                  type="email"
                  className={inquiryInput}
                  placeholder="you@email.com"
                  {...register("contact_email")}
                />
                {errors.contact_email && (
                  <p className={fieldErrorClass}>{errors.contact_email.message}</p>
                )}
              </div>

              <div>
                <InquiryLabel icon={Phone}>Phone</InquiryLabel>
                <Controller
                  name="contact_phone"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      value={field.value || ""}
                      onChange={(v) => field.onChange(v)}
                      onValidChange={() => undefined}
                      required
                      inputClassName={inquiryInput}
                    />
                  )}
                />
                {errors.contact_phone && (
                  <p className={fieldErrorClass}>{errors.contact_phone.message}</p>
                )}
              </div>

              <div>
                <InquiryLabel icon={Briefcase}>Event type</InquiryLabel>
                <input
                  className={inquiryInput}
                  placeholder="Wedding, corporate…"
                  {...register("event_type")}
                />
              </div>

              <div className="sm:col-span-2">
                <InquiryLabel icon={MapPin}>Location</InquiryLabel>
                <input
                  className={inquiryInput}
                  placeholder="Venue / city"
                  {...register("event_location")}
                />
              </div>

              <div className="sm:col-span-2">
                <InquiryLabel icon={MessageSquare}>Message</InquiryLabel>
                <textarea
                  rows={4}
                  className={`${inquiryInput} resize-none min-h-[96px]`}
                  placeholder="Tell the artist about your event…"
                  {...register("message")}
                />
                {errors.message && <p className={fieldErrorClass}>{errors.message.message}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={sending || freeDates.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-full px-5 text-white font-bold disabled:opacity-50 cursor-pointer shadow-[0_10px_24px_rgba(105,0,170,0.28)]"
              style={{ background: "linear-gradient(90deg, #8B5CF6 0%, #C026D3 55%, #E879F9 100%)" }}
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : null}
              Send inquiry
              {!sending ? <ArrowRight size={16} /> : null}
            </button>
            {!customerId ? (
              <p className="text-[11px] text-[#9CA3AF] text-center">
                You can send without logging in. Sign in to prefill your details.
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </div>
  );
}
