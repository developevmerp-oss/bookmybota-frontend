"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarDays,
  Clock,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  User,
} from "lucide-react";
import { FaInstagram, FaYoutube } from "react-icons/fa";
import { toast } from "sonner";
import {
  api,
  useCreateArtistInquiryMutation,
  useGetCustomerProfileQuery,
  useGetPublicArtistQuery,
  useGetPublicEventsQuery,
  type PublicEvent,
} from "@/services/api";
import { extractApiError, extractApiSuccessMessage } from "@/lib/apiErrors";
import {
  artistInquiryFormSchema,
  type ArtistInquiryFormValues,
} from "@/lib/artistInquiryFormSchema";
import { sanitizePhoneInput } from "@/lib/validation";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import PhoneInput from "@/components/Shared/PhoneInput";
import PreferredTimeSelect from "@/components/Shared/PreferredTimeSelect";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import { normalizeArtistMetaClient } from "@/lib/artistMeta";
import AboutArtistModal from "@/components/ArtistAdminPanel/AboutArtistModal";
import ArtistStageSection from "@/components/ArtistAdminPanel/ArtistStageSection";
import SafeCoverImage, { ArtistImageFallback, ARTIST_IMAGE_FALLBACK_CLASS } from "@/components/Shared/SafeCoverImage";
import {
  isExternalArtistId,
  isRegisteredDirectoryArtist,
  lineupRowMatchesArtist,
  usePublicArtistsCatalog,
} from "@/lib/usePublicArtistsCatalog";
import PartnerLiveEventsSection, {
  PartnerAllEventsPanel,
} from "@/components/Shared/PartnerLiveEventsSection";
import PartnerPublicGallery from "@/components/Shared/PartnerPublicGallery";
import {
  isEventLiveFromDetail,
  isPublicEventLive,
  mergePartnerEventItems,
  type PartnerEventWithMeta,
} from "@/lib/partnerEventHistory";

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";
const inquiryInput =
  "w-full rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#6900AA]/20 focus:border-[#C4B5FD] focus:bg-white";
const EMPTY_EVENTS: PublicEvent[] = [];
const EMPTY_EVENT_ITEMS: PartnerEventWithMeta[] = [];

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

/** Platform-registered Book My Bota artists can receive booking inquiries. */
function isBookMyBotaRegisteredArtist(artist: {
  partner_source?: string | null;
  is_partner_authorized?: boolean | null;
}): boolean {
  return isRegisteredDirectoryArtist(artist);
}

function NonRegisteredArtistView({
  name,
  typeName,
  about,
  coverSrc,
  eventItems,
}: {
  name: string;
  typeName?: string | null;
  about?: string | null;
  coverSrc: string;
  eventItems: PartnerEventWithMeta[];
}) {
  const aboutText = about?.trim() || "";
  const [showAllEvents, setShowAllEvents] = useState(false);

  return (
    <div className="min-h-screen bg-white">
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

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:py-8 md:py-10">
          <Link
            href="/artists"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B1B3A]/80 hover:text-[#6900AA]"
          >
            <ArrowLeft size={16} /> All artists
          </Link>

          <div className="mt-5 flex flex-col items-center gap-6 sm:gap-8 md:mt-7 md:flex-row md:items-start md:gap-8 lg:gap-10">
            <div className="relative h-56 w-56 shrink-0 overflow-hidden rounded-2xl bg-[#F7E9FF] shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:h-64 sm:w-64 md:h-72 md:w-72 lg:h-100 lg:w-100">
              <SafeCoverImage
                src={coverSrc}
                alt={name}
                className="h-full w-full object-cover object-top"
                fallbackClassName={ARTIST_IMAGE_FALLBACK_CLASS}
                fallback={<ArtistImageFallback size={48} />}
              />
            </div>

            <div className="min-w-0 flex-1 text-center md:text-left">
              {typeName ? (
                <p className="text-sm font-semibold text-[#1B1B3A]">{typeName}</p>
              ) : null}
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#111111] sm:text-4xl md:text-5xl">
                {name}
              </h1>
              {aboutText ? (
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#374151] sm:text-[15px] whitespace-pre-wrap md:mx-0 mx-auto">
                  {aboutText}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 py-8 sm:py-10">
        {eventItems.length > 0 ? (
          showAllEvents ? (
            <PartnerAllEventsPanel
              items={eventItems}
              onBack={() => setShowAllEvents(false)}
            />
          ) : (
            <PartnerLiveEventsSection
              items={eventItems}
              coverSrc={coverSrc}
              onSeeMore={() => setShowAllEvents(true)}
            />
          )
        ) : (
          <p className="text-sm text-[#6B6B6B]">No events for this artist right now.</p>
        )}
      </div>
    </div>
  );
}

export default function PublicArtistProfilePage({ artistId }: { artistId: string }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const skipPublicArtist = isExternalArtistId(artistId);
  const { data: artist, isLoading, isError } = useGetPublicArtistQuery(artistId, {
    skip: skipPublicArtist,
  });
  const { eventProfiles, isLoading: catalogLoading } = usePublicArtistsCatalog();
  const eventProfile = eventProfiles[artistId] || null;
  const { data: publicEventsData } = useGetPublicEventsQuery();
  const publicEvents = publicEventsData ?? EMPTY_EVENTS;
  const customerId = user?.role === "customer" ? user.customer_id || "" : "";
  const { data: customerProfile } = useGetCustomerProfileQuery(customerId, {
    skip: !customerId,
  });
  const [createInquiry, { isLoading: sending }] = useCreateArtistInquiryMutation();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [bioOverflows, setBioOverflows] = useState(false);
  const [lineupEvents, setLineupEvents] = useState<PartnerEventWithMeta[]>(EMPTY_EVENT_ITEMS);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const bioRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setShowAllEvents(false);
  }, [artistId]);

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
    reset,
    formState: { errors },
  } = form;

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
    const el = bioRef.current;
    if (!el) {
      setBioOverflows(false);
      return;
    }
    const update = () => setBioOverflows(el.scrollHeight > el.clientHeight + 1);
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [artist?.description]);

  const publicEventsKey = useMemo(
    () => publicEvents.map((event) => event.id).join("|"),
    [publicEvents]
  );

  useEffect(() => {
    const events = publicEventsData ?? EMPTY_EVENTS;
    const artistName = artist?.name || eventProfile?.name || "";
    if (!artistId) {
      setLineupEvents(EMPTY_EVENT_ITEMS);
      return;
    }
    if (events.length === 0) {
      setLineupEvents(mergePartnerEventItems("artist", artistId, EMPTY_EVENT_ITEMS));
      return;
    }

    let cancelled = false;
    (async () => {
      const matched: PartnerEventWithMeta[] = [];
      const chunkSize = 8;
      for (let i = 0; i < events.length; i += chunkSize) {
        if (cancelled) return;
        const chunk = events.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (event) => {
            try {
              const detail = await dispatch(
                api.endpoints.getPublicEvent.initiate(event.id, { forceRefetch: false })
              ).unwrap();
              const onLineup = (detail.artists || []).some((row) =>
                lineupRowMatchesArtist(artistId, artistName, row)
              );
              if (onLineup) {
                matched.push({
                  event,
                  live: isEventLiveFromDetail(detail, event),
                });
              }
            } catch {
              // skip events that fail to load
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
      setLineupEvents(
        mergePartnerEventItems(
          "artist",
          artistId,
          matched.length ? matched : EMPTY_EVENT_ITEMS
        )
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [artistId, artist?.name, eventProfile?.name, dispatch, publicEventsData, publicEventsKey]);

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
      reset({
        event_date: "",
        event_time: "",
        contact_name: "",
        contact_email: "",
        contact_phone: "",
        event_type: "",
        event_location: "",
        message: "",
      });
      void data;
    } catch (err) {
      toast.error(extractApiError(err, "Could not send inquiry"));
    }
  });

  if ((!skipPublicArtist && isLoading) || (catalogLoading && !artist && !eventProfile)) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-500">
        Loading artist…
      </div>
    );
  }

  const canInquire = Boolean(artist && isBookMyBotaRegisteredArtist(artist));

  // Non-registered / event-only artists: image, name, type, about, live events only
  if (!canInquire) {
    const name = eventProfile?.name || artist?.name || "";
    if (!name) {
      return (
        <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-4">
          <p className="text-slate-700 font-semibold">Artist not found.</p>
          <Link href="/artists" className="text-violet-700 font-semibold underline">
            Back to artists
          </Link>
        </div>
      );
    }
    const coverSrc = resolveMediaUrl(
      eventProfile?.cover_image_url || artist?.cover_image_url || ""
    );
    const typeName =
      eventProfile?.type_name ||
      eventProfile?.role_title ||
      artist?.type_name ||
      "Artist";
    const about = eventProfile?.description || artist?.description || "";
    const eventsFromProfile: PartnerEventWithMeta[] = (eventProfile?.events || []).map(
      (event) => ({ event, live: isPublicEventLive(event) })
    );
    const eventsFromArtist: PartnerEventWithMeta[] = (artist?.events || []).map((event) => ({
      event,
      live: isPublicEventLive(event),
    }));
    const eventItems = mergePartnerEventItems(
      "artist",
      artistId,
      lineupEvents.length > 0
        ? lineupEvents
        : eventsFromProfile.length > 0
          ? eventsFromProfile
          : eventsFromArtist
    );

    return (
      <NonRegisteredArtistView
        name={name}
        typeName={typeName}
        about={about}
        coverSrc={coverSrc}
        eventItems={eventItems}
      />
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
  const artistMeta = normalizeArtistMetaClient(artist.artist_meta);
  const spotlightVideos = artistMeta.spotlight_videos || [];
  const audioClips = artistMeta.audio_clips || [];
  const social = artistMeta.social || {};
  const instagramUrl = social.instagram_url?.trim() || "";
  const youtubeUrl = social.youtube_url?.trim() || "";
  const galleryImages = (Array.isArray(artist.gallery_images) ? artist.gallery_images : []).filter(
    (u): u is string => typeof u === "string" && !!u.trim()
  );
  const instagramFollowers = social.instagram_followers;
  const youtubeFollowers = social.youtube_followers;
  const artistEventItems: PartnerEventWithMeta[] = mergePartnerEventItems(
    "artist",
    artistId,
    lineupEvents.length > 0
      ? lineupEvents
      : eventProfile?.events?.length
        ? eventProfile.events.map((event) => ({
            event,
            live: isPublicEventLive(event),
          }))
        : (artist.events || []).map((event) => ({
            event,
            live: isPublicEventLive(event),
          }))
  );
  const hasMedia = spotlightVideos.length > 0 || audioClips.length > 0;
  const showStage = hasMedia;
  const showGallery = galleryImages.length > 0;
  const showHeaderSeeMore = Boolean(artist.description?.trim()) && bioOverflows;
  const showLeftColumn = showStage || artistEventItems.length > 0 || showGallery;

  return (
    <div className="min-h-screen bg-white">
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

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:py-8 md:py-10">
          <Link
            href="/artists"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1B1B3A]/80 hover:text-[#6900AA]"
          >
            <ArrowLeft size={16} /> All artists
          </Link>

          <div className="mt-5 flex flex-col items-center gap-6 sm:gap-8 md:mt-7 md:flex-row md:items-start md:gap-8 lg:gap-10">
            <div className="relative h-56 w-56 shrink-0 overflow-hidden rounded-2xl bg-[#F7E9FF] shadow-[0_16px_40px_rgba(0,0,0,0.18)] sm:h-64 sm:w-64 md:h-72 md:w-72 lg:h-100 lg:w-100">
              <SafeCoverImage
                src={coverSrc}
                alt={artist.name}
                className="h-full w-full object-cover object-top"
                fallbackClassName={ARTIST_IMAGE_FALLBACK_CLASS}
                fallback={<ArtistImageFallback size={48} />}
              />
            </div>

            <div className="min-w-0 flex-1 text-center md:text-left">
              {metaParts.length > 0 ? (
                <p className="text-sm font-semibold text-[#1B1B3A]">
                  {canInquire
                    ? metaParts.join(" | ")
                    : [artist.type_name, place].filter(Boolean).join(" | ") ||
                      artist.type_name ||
                      "Artist"}
                </p>
              ) : null}
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#111111] sm:text-4xl md:text-5xl">
                {artist.name}
              </h1>
              {artist.description?.trim() ? (
                <div className="mt-3 min-w-0 max-w-xl md:mx-0 mx-auto">
                  <p
                    ref={bioRef}
                    className="text-sm leading-relaxed text-[#374151] sm:text-[15px] line-clamp-4 whitespace-pre-wrap"
                  >
                    {artist.description}
                  </p>
                  {showHeaderSeeMore ? (
                    <button
                      type="button"
                      onClick={() => setAboutOpen(true)}
                      className="mt-1.5 inline-flex items-center text-sm font-bold text-[#111111] cursor-pointer hover:underline"
                    >
                      See more
                    </button>
                  ) : null}
                </div>
              ) : canInquire ? (
                <p className="mt-3 text-sm text-[#9ca3af]">No bio yet.</p>
              ) : null}
              {canInquire ? (
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
              ) : null}

              {canInquire && (instagramUrl || youtubeUrl) ? (
                <div className="mt-5 flex flex-wrap items-center justify-center md:justify-start gap-3">
                  {instagramUrl ? (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open Instagram profile"
                      title="Instagram"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#E1306C] shadow-sm hover:border-[#E1306C]/40 hover:bg-[#FFF5F8] transition-colors"
                    >
                      <FaInstagram size={22} />
                    </a>
                  ) : null}
                  {youtubeUrl ? (
                    <a
                      href={youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open YouTube channel"
                      title="YouTube"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#FF0000] shadow-sm hover:border-[#FF0000]/40 hover:bg-[#FFF5F5] transition-colors"
                    >
                      <FaYoutube size={22} />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

    
        <div className="bg-white container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 py-8 sm:py-10">
          {showAllEvents && artistEventItems.length > 0 ? (
            <PartnerAllEventsPanel
              items={artistEventItems}
              onBack={() => setShowAllEvents(false)}
            />
          ) : (
          <div className="flex flex-col items-stretch gap-8 lg:flex-row lg:items-start lg:gap-10">
            {showLeftColumn ? (
              <div className="min-w-0 flex-1 space-y-8 sm:space-y-10">
                {showStage ? (
                  <ArtistStageSection
                    name={artist.name}
                    typeName={artist.type_name}
                    coverSrc={coverSrc}
                    audioClips={audioClips}
                    spotlightVideos={spotlightVideos}
                    onAboutClick={() => setAboutOpen(true)}
                  />
                ) : null}

                {artistEventItems.length > 0 ? (
                  <PartnerLiveEventsSection
                    items={artistEventItems}
                    coverSrc={coverSrc}
                    onSeeMore={() => setShowAllEvents(true)}
                  />
                ) : null}

                {showGallery ? (
                  <PartnerPublicGallery
                    images={galleryImages}
                    label={`${artist.name} gallery`}
                  />
                ) : null}
              </div>
            ) : null}

            {canInquire ? (
            <aside className="w-full shrink-0 lg:w-[24.5rem]">
              <form
                id="artist-inquiry"
                onSubmit={onSubmit}
                className="relative w-full rounded-[1.5rem] border border-[#F0EAF7] bg-white p-5 sm:p-6 space-y-4 shadow-[0_10px_30px_rgba(105,0,170,0.07)] scroll-mt-28 lg:sticky lg:top-24"
                noValidate
              >
              <div>
                <h2 className="text-lg font-bold text-[#111111]">Send inquiry</h2>
                <p className="text-sm text-[#8b8794] mt-1">
                  Share your event details and this artist will get back to you.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                <div>
                  <InquiryLabel icon={CalendarDays}>Event date</InquiryLabel>
                  <input
                    type="date"
                    min={todayYmd()}
                    className={inquiryInput}
                    {...register("event_date")}
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

                <div className="sm:col-span-2 lg:col-span-1">
                  <InquiryLabel icon={MapPin}>Location</InquiryLabel>
                  <input
                    className={inquiryInput}
                    placeholder="Venue / city"
                    {...register("event_location")}
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-1">
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
                disabled={sending}
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
          </aside>
            ) : null}
        </div>
          )}
        </div>
     
      <AboutArtistModal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        name={artist.name}
        typeName={artist.type_name}
        coverSrc={coverSrc}
        description={artist.description}
        instagramUrl={instagramUrl}
        youtubeUrl={youtubeUrl}
        instagramFollowers={instagramFollowers}
        youtubeFollowers={youtubeFollowers}
        audioClips={audioClips}
        spotlightVideos={spotlightVideos}
      />
    </div>
  );
}
