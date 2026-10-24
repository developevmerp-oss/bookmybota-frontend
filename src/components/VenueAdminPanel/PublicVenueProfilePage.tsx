"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Briefcase, Building2, CalendarDays, Clock, Loader2, Mail, MapPin, MessageSquare, Phone, User, Users } from "lucide-react";
import { toast } from "sonner";
import {
  api,
  useCreateVenueInquiryMutation,
  useGetCustomerProfileQuery,
  useGetPublicEventsQuery,
  useGetPublicVenueQuery,
  type PublicEvent,
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
import PartnerInquiryModal from "@/components/Shared/PartnerInquiryModal";
import PhoneInput from "@/components/Shared/PhoneInput";
import PreferredTimeSelect from "@/components/Shared/PreferredTimeSelect";
import PartnerLiveEventsSection, {
  PartnerAllEventsPanel,
} from "@/components/Shared/PartnerLiveEventsSection";
import PartnerPublicGallery from "@/components/Shared/PartnerPublicGallery";
import {
  PartnerEventsSectionShimmer,
  VenueDetailShimmer,
} from "@/components/Shared/Shimmer";
import {
  isEventLiveFromDetail,
  mergePartnerEventItems,
  type PartnerEventWithMeta,
} from "@/lib/partnerEventHistory";
import { formatDateCustomer } from "@/lib/dateFormat";
import { resolveMediaUrl } from "@/lib/mediaUrl";

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";
const inquiryInput =
  "w-full rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6900AA]/20 focus:border-[#C4B5FD] focus:bg-white";
const VENUE_IMAGE_FALLBACK_CLASS =
  "flex h-full w-full items-center justify-center bg-[#F7E9FF] text-[#6900AA]";
const EMPTY_EVENTS: PublicEvent[] = [];
const EMPTY_EVENT_ITEMS: PartnerEventWithMeta[] = [];

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

export default function PublicVenueProfilePage({ venueId }: { venueId: string }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const { data: venue, isLoading, isError } = useGetPublicVenueQuery(venueId);
  const { data: publicEventsData } = useGetPublicEventsQuery();
  const publicEvents = publicEventsData ?? EMPTY_EVENTS;
  const customerId = user?.role === "customer" ? user.customer_id || "" : "";
  const { data: customerProfile } = useGetCustomerProfileQuery(customerId, {
    skip: !customerId,
  });
  const [createInquiry, { isLoading: sending }] = useCreateVenueInquiryMutation();
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [aboutOverflows, setAboutOverflows] = useState(false);
  const [venueEvents, setVenueEvents] = useState<PartnerEventWithMeta[]>(EMPTY_EVENT_ITEMS);
  const [eventsReady, setEventsReady] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const aboutTextRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setShowAllEvents(false);
    setEventsReady(false);
    setInquiryOpen(false);
  }, [venueId]);

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

  useEffect(() => {
    setAboutExpanded(false);
  }, [venue?.description]);

  useEffect(() => {
    if (!venue?.description?.trim() || aboutExpanded) return;

    let cancelled = false;
    const measure = () => {
      const el = aboutTextRef.current;
      if (!el || cancelled) return;
      const styles = window.getComputedStyle(el);
      const parsedLh = parseFloat(styles.lineHeight);
      const fontSize = parseFloat(styles.fontSize) || 14;
      const lineHeight = Number.isFinite(parsedLh) ? parsedLh : fontSize * 1.5;
      const maxCollapsedHeight = lineHeight * 5;
      const overflows =
        el.scrollHeight > el.clientHeight + 1 || el.scrollHeight > maxCollapsedHeight + 2;
      setAboutOverflows(overflows);
    };

    const raf1 = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(measure);
    });
    window.addEventListener("resize", measure);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf1);
      window.removeEventListener("resize", measure);
    };
  }, [venue?.description, aboutExpanded]);

  const publicEventsKey = useMemo(
    () => publicEvents.map((event) => event.id).join("|"),
    [publicEvents]
  );

  useEffect(() => {
    const events = publicEventsData ?? EMPTY_EVENTS;
    if (!venueId) {
      setVenueEvents(EMPTY_EVENT_ITEMS);
      setEventsReady(true);
      return;
    }
    // Wait for venue profile so we can match UUID id (URL may be a slug)
    if (!venue?.id && !venue?.name) {
      setEventsReady(false);
      return;
    }

    const partnerKey = String(venue?.id || venueId).trim();
    const idCandidates = new Set(
      [venue?.id, venue?.slug, venueId]
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    );

    const normVenueLabel = (value?: string | null) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    /** "Addis Ababa Stadium: Bole" ↔ "Addis Ababa Stadium" */
    const venueLabelsMatch = (a?: string | null, b?: string | null) => {
      const left = normVenueLabel(a);
      const right = normVenueLabel(b);
      if (!left || !right) return false;
      if (left === right) return true;
      const leftCore = left.split(":")[0].trim();
      const rightCore = right.split(":")[0].trim();
      if (leftCore && rightCore && leftCore === rightCore) return true;
      if (leftCore.length >= 4 && rightCore.length >= 4) {
        if (leftCore.includes(rightCore) || rightCore.includes(leftCore)) return true;
      }
      return false;
    };

    const venueName = String(venue?.name || "").trim();

    const showtimeAtThisVenue = (row: {
      venue_business_id?: string | null;
      venue_name?: string | null;
      venue_business_name?: string | null;
    }) => {
      const bid = String(row.venue_business_id || "").trim();
      if (bid && idCandidates.has(bid)) return true;
      if (venueLabelsMatch(venueName, row.venue_name)) return true;
      if (venueLabelsMatch(venueName, row.venue_business_name)) return true;
      return false;
    };

    if (publicEventsData === undefined) {
      setEventsReady(false);
      return;
    }

    if (events.length === 0) {
      setVenueEvents(mergePartnerEventItems("venue", partnerKey, EMPTY_EVENT_ITEMS));
      setEventsReady(true);
      return;
    }

    let cancelled = false;
    setEventsReady(false);
    (async () => {
      const matched: PartnerEventWithMeta[] = [];
      const chunkSize = 8;
      for (let i = 0; i < events.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = events.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (event) => {
            // Fast path: public list already has venue_name
            const listNameHit = venueLabelsMatch(venueName, event.venue_name);

            try {
              const detail = await dispatch(
                api.endpoints.getPublicEvent.initiate(event.id, { forceRefetch: false })
              ).unwrap();
              const showtimes = detail.showtimes || [];
              const atVenue =
                showtimes.some((row) => showtimeAtThisVenue(row)) || listNameHit;
              if (atVenue) {
                matched.push({
                  event,
                  live: isEventLiveFromDetail(detail, event),
                });
              }
            } catch {
              // Detail can 404 for ended events; still keep list-name matches as past
              if (listNameHit) {
                matched.push({
                  event,
                  live: false,
                });
              }
            }
          })
        );
      }
      if (cancelled) return;
      matched.sort((a, b) => {
        const ta = a.event.next_showtime
          ? Date.parse(a.event.next_showtime)
          : Number.POSITIVE_INFINITY;
        const tb = b.event.next_showtime
          ? Date.parse(b.event.next_showtime)
          : Number.POSITIVE_INFINITY;
        return ta - tb;
      });
      setVenueEvents(
        mergePartnerEventItems(
          "venue",
          partnerKey,
          matched.length ? matched : EMPTY_EVENT_ITEMS
        )
      );
      setEventsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [venueId, venue?.id, venue?.slug, venue?.name, dispatch, publicEventsData, publicEventsKey]);

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
      reset({
        event_date: "",
        event_time: "",
        contact_name: "",
        contact_email: "",
        contact_phone: "",
        event_type: "",
        guest_count: "",
        event_location: "",
        message: "",
      });
      void data;
      setInquiryOpen(false);
    } catch (err) {
      toast.error(extractApiError(err, "Could not send inquiry"));
    }
  });

  const openInquiry = () => {
    if (!selectedDate) {
      toast.error("Select an open day on the calendar first.");
      document.getElementById("venue-availability")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      return;
    }
    setInquiryOpen(true);
  };

  const closeInquiry = () => {
    setInquiryOpen(false);
    reset({
      event_date: "",
      event_time: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      event_type: "",
      guest_count: "",
      event_location: "",
      message: "",
    });
  };

  if (isLoading) {
    return <VenueDetailShimmer />;
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
  const coverSrc = venue.cover_image_url ? resolveMediaUrl(venue.cover_image_url) : "";
  const typeLabel = (venue.type_name || "Registered venue").trim();
  const aboutText = venue.description?.trim() || "";
  const aboutLikelyLong =
    aboutText.length > 280 || aboutText.split(/\n/).filter(Boolean).length > 5;
  const showAboutToggle = Boolean(aboutText) && (aboutOverflows || aboutLikelyLong);
  const galleryImages = (Array.isArray(venue.gallery_images) ? venue.gallery_images : []).filter(
    (u): u is string => typeof u === "string" && !!u.trim()
  );

  if (showAllEvents && venueEvents.length > 0) {
    return (
      <div className="min-h-screen bg-white overflow-x-hidden">
        <div className="bg-white bmb-section-container py-6 sm:py-8 md:py-10">
          <PartnerAllEventsPanel
            items={venueEvents}
            onBack={() => setShowAllEvents(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="bmb-section-container pt-5 sm:pt-6">
        <Link
          href="/venues"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B1B3A]/80 hover:text-[#6900AA]"
        >
          <ArrowLeft size={16} /> All venues
        </Link>
      </div>

      <header className="bmb-section-container pt-4 pb-2 sm:pt-5 sm:pb-3">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl min-h-[220px] sm:min-h-[280px] md:min-h-[320px] lg:min-h-[360px]">
          {coverSrc ? (
            <img
              src={coverSrc}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div aria-hidden className={`absolute inset-0 ${VENUE_IMAGE_FALLBACK_CLASS}`}>
              <Building2 size={56} strokeWidth={1.4} />
            </div>
          )}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(15,15,20,0.78) 0%, rgba(15,15,20,0.55) 42%, rgba(15,15,20,0.28) 72%, rgba(15,15,20,0.18) 100%)",
            }}
          />

          <div className="relative z-10 flex h-full min-h-[220px] sm:min-h-[280px] md:min-h-[320px] lg:min-h-[360px] flex-col justify-end p-5 sm:p-7 md:p-8 lg:p-10">
            <div className="max-w-2xl">
              {typeLabel ? (
                <span className="inline-flex items-center rounded-full bg-[#6900AA]/85 px-3 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                  {typeLabel}
                </span>
              ) : null}
              <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl lg:text-[2.75rem]">
                {venue.name}
              </h1>
              {place ? (
                <p className="mt-2.5 flex items-center gap-1.5 text-sm font-semibold text-white/95 sm:text-base">
                  <MapPin size={15} className="shrink-0 text-[#C4B5FD]" />
                  <span className="min-w-0 break-words">{place}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white bmb-section-container py-6 sm:py-8 md:py-10">
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:gap-10">
          <div className="min-w-0 w-full flex-1 space-y-8 sm:space-y-10">
              {aboutText ? (
                <section id="venue-about" className="scroll-mt-24 sm:scroll-mt-28">
                  <h2 className="text-xl font-bold tracking-tight text-[#111111] sm:text-2xl">
                    About venue
                  </h2>
                  <div className="mt-3 min-w-0">
                    <p
                      ref={aboutTextRef}
                      className={`text-sm leading-relaxed text-[#4B5563] font-medium whitespace-pre-wrap sm:text-[15px] ${
                        aboutExpanded ? "" : "line-clamp-5"
                      }`}
                    >
                      {aboutText}
                    </p>
                    {showAboutToggle || aboutExpanded ? (
                      <button
                        type="button"
                        onClick={() => setAboutExpanded((v) => !v)}
                        className="mt-2 inline-flex items-center text-sm font-bold text-[#6900AA] cursor-pointer hover:underline"
                      >
                        {aboutExpanded ? "See less" : "See more"}
                      </button>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {!eventsReady ? (
                <PartnerEventsSectionShimmer count={3} />
              ) : venueEvents.length > 0 ? (
                <PartnerLiveEventsSection
                  items={venueEvents}
                  coverSrc={coverSrc}
                  onSeeMore={() => {
                    setShowAllEvents(true);
                    if (typeof window !== "undefined") {
                      window.scrollTo({ top: 0, behavior: "auto" });
                    }
                  }}
                />
              ) : null}

              {galleryImages.length > 0 ? (
                <PartnerPublicGallery
                  images={galleryImages}
                  label={`${venue.name} gallery`}
                  dense
                />
              ) : null}
          </div>

          <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-[22.5rem] xl:w-[24rem]">
              <section id="venue-availability" className="w-full scroll-mt-24">
                <h2 className="text-xl font-bold tracking-tight text-[#111111] sm:text-2xl">
                  Booking Availability
                </h2>
                <p className="mt-1 text-sm text-[#6B6B6B]">
                  Green days are open. Pick a date, then send your inquiry.
                </p>
                <div className="mt-4">
                  <ArtistMonthCalendar
                    freeDates={freeDates}
                    selectedDate={selectedDate || null}
                    mode="pick"
                    variant="booking"
                    onSelectDate={(date) =>
                      setValue("event_date", date, { shouldDirty: true, shouldValidate: true })
                    }
                  />
                </div>
                {errors.event_date && !inquiryOpen ? (
                  <p className={fieldErrorClass}>{errors.event_date.message}</p>
                ) : null}
                {freeDates.length === 0 ? (
                  <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    This venue has not published free days yet. Check back later.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={openInquiry}
                    disabled={!selectedDate}
                    className="mt-4 hidden lg:inline-flex h-11 items-center justify-center rounded-xl bg-[#111111] px-6 text-sm font-bold text-white transition-colors hover:bg-black cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Send inquiry
                  </button>
                )}
              </section>
          </aside>
        </div>
      </div>

      <PartnerInquiryModal
        open={inquiryOpen}
        onClose={closeInquiry}
        title="Send booking inquiry"
        subtitle="The venue receives this request in their panel and by email."
      >
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <InquiryLabel icon={CalendarDays}>Date</InquiryLabel>
              <input
                readOnly
                className={`${inquiryInput} bg-[#F4F5F7]`}
                value={selectedDate ? formatDateCustomer(selectedDate) : ""}
              />
              {errors.event_date && <p className={fieldErrorClass}>{errors.event_date.message}</p>}
            </div>
            <div>
              <InquiryLabel icon={Clock}>Time</InquiryLabel>
              <Controller
                name="event_time"
                control={control}
                render={({ field }) => (
                  <PreferredTimeSelect value={field.value || ""} onChange={field.onChange} />
                )}
              />
              {errors.event_time && <p className={fieldErrorClass}>{errors.event_time.message}</p>}
            </div>
          </div>

          <div>
            <InquiryLabel icon={User}>Your name</InquiryLabel>
            <input className={inquiryInput} placeholder="Full name" {...register("contact_name")} />
            {errors.contact_name && (
              <p className={fieldErrorClass}>{errors.contact_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <InquiryLabel icon={Briefcase}>Event type</InquiryLabel>
              <input
                className={inquiryInput}
                placeholder="Wedding"
                {...register("event_type")}
              />
            </div>
            <div>
              <InquiryLabel icon={Users}>Guests</InquiryLabel>
              <input
                type="number"
                min={1}
                className={inquiryInput}
                placeholder="150"
                {...register("guest_count")}
              />
              {errors.guest_count && (
                <p className={fieldErrorClass}>{errors.guest_count.message}</p>
              )}
            </div>
          </div>

          <div>
            <InquiryLabel icon={MapPin}>Notes</InquiryLabel>
            <input
              className={inquiryInput}
              placeholder="Hall preference, seating style…"
              {...register("event_location")}
            />
          </div>

          <div>
            <InquiryLabel icon={MessageSquare}>Message</InquiryLabel>
            <textarea
              rows={3}
              className={`${inquiryInput} resize-none`}
              placeholder="Tell the venue about your event…"
              {...register("message")}
            />
            {errors.message && <p className={fieldErrorClass}>{errors.message.message}</p>}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            {!customerId ? (
              <p className="text-[11px] leading-snug text-[#9CA3AF]">
                You can send without logging in.
              </p>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={sending || freeDates.length === 0}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#111111] px-5 text-sm font-bold text-white transition-colors cursor-pointer hover:bg-black disabled:opacity-50"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : null}
              Send inquiry
              {!sending ? <ArrowRight size={16} /> : null}
            </button>
          </div>
        </form>
      </PartnerInquiryModal>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-slate-200 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={openInquiry}
          disabled={freeDates.length === 0}
          className="w-full rounded-xl bg-[#111111] text-white py-3.5 text-base font-bold cursor-pointer hover:bg-black disabled:opacity-40"
        >
          Send inquiry
        </button>
      </div>
    </div>
  );
}
