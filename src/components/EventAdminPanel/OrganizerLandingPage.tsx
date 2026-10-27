"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  CalendarDays,
  Guitar,
  Handshake,
  Mic2,
  PartyPopper,
  Rocket,
  Smartphone,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import PartnerListYourShowLanding from "@/components/Shared/PartnerListYourShowLanding";
import { homePathForRole, readSessionForRole } from "@/lib/authStorage";
import {
  PARTNER_CATEGORY_TYPES,
  type PartnerCategoryKey,
} from "@/data/partnerCategoryTypes";
import images from "@/Images";

type OrganizerCategory = Extract<PartnerCategoryKey, "concert" | "comedy" | "sports" | "music">;

const PAGE_CONTAINER = "bmb-section-container";

function imageSrc(imgData: string | { src: string }) {
  return typeof imgData === "string" ? imgData : imgData.src;
}

const FEATURE_SLIDES = [
  {
    id: "scan",
    title: "Ticket scanning made easy",
    description: "Experience the ease of managing entry at an event.",
    image: "https://assets-in.bmscdn.com/static/2021/06/des-sli-fiv.jpeg",
    bg: "#2F4858",
  },
  {
    id: "mticket",
    title: "Take advantage of our M-ticket feature",
    description: "Lets your audience skip the box office queue and head straight to the gate.",
    image: "https://assets-in.bmscdn.com/static/2021/06/des-sli-f.jpeg",
    bg: "#A15C38",
  },
  {
    id: "dashboard",
    title: "Introducing an event management tool",
    description: "Experience the ease of event creation and publishing.",
    image: "https://assets-in.bmscdn.com/static/2021/06/des-lap-sli-six.png",
    bg: "#6900AA",
  },
  {
    id: "artist",
    title: "Empower the artist within you",
    description: "List your own performances, gigs and more with Book My Bota.",
    image: "https://assets-in.bmscdn.com/static/2021/06/sli-o.jpeg",
    bg: "#2D6A4F",
  },
  {
    id: "workshop",
    title: "Conduct workshops and much more",
    description: "Share your skills with people around the world — from home!",
    image: "https://assets-in.bmscdn.com/static/2021/06/des-sli-th.jpeg",
    bg: "#1D4E89",
  },
];

const HERO_IMAGE = FEATURE_SLIDES[0].image;

type CategoryHeroCopy = {
  title: string;
  description: string;
  primaryCtaLabel: string;
  secondaryLoginLabel: string;
  image: string;
};

/** Dining-style split hero copy + image per list-your-show category. */
const CATEGORY_SPLIT_HERO: Record<OrganizerCategory, CategoryHeroCopy> = {
  concert: {
    title: "Bring your event to more people.",
    description:
      "List your events on BookMyBota, sell tickets, manage attendees and reach a wider audience with a seamless booking experience.",
    primaryCtaLabel: "List your event",
    secondaryLoginLabel: "Login your event",
    image: imageSrc(images.concertPartnerHero),
  },
  music: {
    title: "Take your music event to a bigger stage.",
    description:
      "List your concerts, live shows and music events on BookMyBota. Sell tickets, manage attendees and connect with more fans.",
    primaryCtaLabel: "List your music event",
    secondaryLoginLabel: "Login to manage",
    image: imageSrc(images.musicPartnerHero),
  },
  sports: {
    title: "Bring your sports event to more fans.",
    description:
      "List matches, tournaments and sports events on BookMyBota. Sell tickets, manage attendees and grow your audience.",
    primaryCtaLabel: "List your sports event",
    secondaryLoginLabel: "Login to manage",
    image: imageSrc(images.sportsPartnerHero),
  },
  comedy: {
    title: "Turn laughter into bigger audiences.",
    description:
      "List your stand-up comedy shows and live events on BookMyBota. Sell tickets, manage attendees and bring more comedy lovers together.",
    primaryCtaLabel: "List your comedy event",
    secondaryLoginLabel: "Login to manage",
    image: imageSrc(images.comedyPartnerHero),
  },
};

const HOST_CATEGORIES = [
  {
    label: "Performances",
    infoId: "organizer.host.performances",
    Icon: Guitar,
    iconSrc: "https://assets-in.bmscdn.com/static/2021/06/perf.png",
    blurb: "Music, Dance, Theatre & more",
  },
  {
    label: "Experiences",
    infoId: "organizer.host.experiences",
    Icon: PartyPopper,
    iconSrc: "https://assets-in.bmscdn.com/static/2021/06/experiencess.png",
    blurb: "Unique activities & immersive experiences",
  },
  {
    label: "Expositions",
    infoId: "organizer.host.expositions",
    Icon: BookOpen,
    iconSrc: "https://assets-in.bmscdn.com/static/2021/06/expositionss.png",
    blurb: "Art, Culture & Exhibitions",
  },
  {
    label: "Parties",
    infoId: "organizer.host.parties",
    Icon: Mic2,
    iconSrc: "https://assets-in.bmscdn.com/static/2021/06/partiess.png",
    blurb: "Private parties & social gatherings",
  },
  {
    label: "Sports",
    infoId: "organizer.host.sports",
    Icon: CalendarDays,
    iconSrc: "https://assets-in.bmscdn.com/static/2021/06/sport.png",
    blurb: "Matches, Tournaments & sports events",
  },
  {
    label: "Conferences",
    infoId: "organizer.host.conferences",
    Icon: Building2,
    iconSrc: "https://assets-in.bmscdn.com/static/2021/06/conferencess.png",
    blurb: "Business, Education & networking events",
  },
];

const SERVICES = [
  {
    label: "Online Sales & Marketing",
    infoId: "organizer.service.online-sales",
    Icon: Rocket,
    iconSrc: "https://assets-in.bmscdn.com/static/2021/06/online-saless.png",
    blurb: "Reach audiences and sell tickets online with powerful discovery tools.",
  },
  {
    label: "Pricing",
    infoId: "organizer.service.pricing",
    Icon: Calculator,
    iconSrc: "https://assets-in.bmscdn.com/static/2021/06/pricings.png",
    blurb: "Flexible ticket tiers and offers so you stay in control of revenue.",
  },
  {
    label: "Food & beverages, stalls and the works!",
    infoId: "organizer.service.fnb",
    Icon: Truck,
    iconSrc: "https://assets-in.bmscdn.com/static/2021/06/food.png",
    blurb: "Coordinate F&B, stalls and add-ons alongside ticket sales.",
  },
  {
    label: "On ground support & gate entry management",
    infoId: "organizer.service.on-ground",
    Icon: Handshake,
    iconSrc: "https://assets-in.bmscdn.com/static/2021/06/on-ground-support.png",
    blurb: "Smooth check-in and gate management on event day.",
  },
  {
    label: "Reports & business insights",
    infoId: "organizer.service.reports",
    Icon: BarChart3,
    iconSrc: "https://assets-in.bmscdn.com/static/2021/06/report.png",
    blurb: "Track sales and performance with clear business reports.",
  },
  {
    label: "POS, RFID, Turnstiles & more...",
    infoId: "organizer.service.pos",
    Icon: Smartphone,
    iconSrc: "https://assets-in.bmscdn.com/static/2021/06/rfids.png",
    blurb: "POS, RFID, turnstiles and more for faster, safer entry.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Book My Bota has helped art lovers book their seats for favourite shows in a seamless manner. On-ground support on event day further ensures smooth ticket-related formalities.",
    name: "City Arts Centre",
    role: "Performing Arts Partner",
  },
  {
    quote:
      "Listing and promoting our plays on Book My Bota opened the doors of theatre to a wider audience — bringing the joy of live performance to more people every week.",
    name: "StageWorks Collective",
    role: "Theatre Partner",
  },
  {
    quote:
      "It has never felt like a client–vendor relationship. Both brands have been equal partners, bringing incredible synergies to every project we run together.",
    name: "Live Events Network",
    role: "Festival Organizer",
  },
];

export default function OrganizerLandingPage({
  category,
}: {
  category?: OrganizerCategory;
} = {}) {
  const router = useRouter();
  const categoryConfig = category ? PARTNER_CATEGORY_TYPES[category] : null;
  const splitHero = category ? CATEGORY_SPLIT_HERO[category] : null;

  const openLogin = () => {
    const session = readSessionForRole("event_admin");
    if (session) {
      router.push(homePathForRole("event_admin"));
      return;
    }
    router.push("/organizer/login");
  };

  return (
    <PartnerListYourShowLanding
      layout="bms"
      centeredPartnerHeader
      pageContainerClassName={PAGE_CONTAINER}
      pageBackgroundClassName="bg-white"
      headerLoginPrompt="Already a partner?"
      headerLoginVariant="dark"
      loginHref="/organizer/login"
      expectedRole="event_admin"
      loginTitle="Event Login"
      loginSubtitle="Sign in to create and manage your events"
      registerHref="/organizer/register"
      registerHint={
        <p className="text-[0.625rem] text-slate-400">
          New organizer?{" "}
          <Link href="/organizer/register" className="text-[#6900AA] font-semibold">
            Register here
          </Link>
        </p>
      }
      primaryCtaLabel={splitHero?.primaryCtaLabel ?? "List your business"}
      secondaryLoginLabel={splitHero?.secondaryLoginLabel ?? "Login your business"}
      heroVariant={splitHero ? "split" : "banner"}
      heroTitle={splitHero?.title}
      heroDescription={splitHero?.description}
      heroImage={splitHero?.image ?? HERO_IMAGE}
      heroImageAlt={
        categoryConfig
          ? `${categoryConfig.title} partner on Book My Bota`
          : "Event organizer partner on Book My Bota"
      }
      categoryTypesTitle={categoryConfig ? `${categoryConfig.title} Types` : undefined}
      categoryTypes={categoryConfig?.types}
      categoryTypesVariant={categoryConfig ? "cards" : "round"}
      categoryTypesTitleStyle="heading"
      categoryTypesCardStyle="overlay"
      servicesTitle="What are the services we offer?"
      servicesSubtitle="After successful collaborations with the best event organisers over the past decade and a half, we're well equipped to bring your vision to life."
      servicesHideSubtitle
      servicesCardsVariant="bordered"
      servicesTiles={SERVICES}
      servicesFootnote="Apart from these must haves for any event, we also support a host of other services like SEO for your event, custom pricing for your tickets and this and also this."
      testimonials={TESTIMONIALS}
      crossLinks={
        <p className="flex flex-wrap items-center justify-center gap-2">
          Already partnered for dining?
          <Link
            href="/list-your-show/dining"
            className="text-[#6900AA] font-semibold hover:underline inline-flex items-center gap-1"
          >
            <UtensilsCrossed size={12} /> Partner with Us
          </Link>
        </p>
      }
      onOpenLogin={openLogin}
    />
  );
}
