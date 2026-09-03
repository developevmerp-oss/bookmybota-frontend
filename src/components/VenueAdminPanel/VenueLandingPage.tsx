"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  Handshake,
  LayoutGrid,
  MapPin,
  ShieldCheck,
  Sofa,
  Ticket,
  Users,
} from "lucide-react";
import PartnerListYourShowLanding from "@/components/Shared/PartnerListYourShowLanding";
import PartnerDirectorySection from "@/components/Shared/PartnerDirectorySection";
import { homePathForRole, readSessionForRole } from "@/lib/authStorage";
import { PARTNER_VENUE_TYPE_CARDS } from "@/data/partnerVenueTypeCards";
import { useGetPublicRegisteredVenuesQuery } from "@/services/api";

const FEATURE_SLIDES = [
  {
    id: "claim",
    title: "Claim events happening at your venue",
    description:
      "When organizers list your space, claim those showtimes and stay in the loop on what is running at your property.",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&q=80",
    bg: "#2F4858",
  },
  {
    id: "layouts",
    title: "Publish seating layouts once, reuse often",
    description:
      "Share theater, banquet, or mixed layouts so organizers can pick a published plan for every show.",
    image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=900&q=80",
    bg: "#A15C38",
  },
  {
    id: "requests",
    title: "Handle custom layout requests",
    description:
      "Review organizer seating requests, fulfill them with your plans, and keep the floor plan process smooth.",
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&q=80",
    bg: "#2D6A4F",
  },
  {
    id: "trust",
    title: "Become a verified venue partner",
    description:
      "Authorized venues stand out in organizer search and appear as platform-trusted spaces to customers.",
    image: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=900&q=80",
    bg: "#1D4E89",
  },
];

const HERO_IMAGE = FEATURE_SLIDES[0].image;

const VENUE_TYPES = [
  {
    label: "Auditoriums & Halls",
    infoId: "venue.host.auditoriums",
    Icon: Building2,
    blurb: "Theatres, halls & seated venues",
  },
  {
    label: "Banquet & Wedding Spaces",
    infoId: "venue.host.banquet",
    Icon: Sofa,
    blurb: "Celebrations & private functions",
  },
  {
    label: "Outdoor & Amphitheaters",
    infoId: "venue.host.outdoor",
    Icon: MapPin,
    blurb: "Open-air stages & lawn venues",
  },
  {
    label: "Clubs & Nightvenues",
    infoId: "venue.host.clubs",
    Icon: Users,
    blurb: "Nightlife & late-evening spaces",
  },
  {
    label: "Conference Centers",
    infoId: "venue.host.conference",
    Icon: LayoutGrid,
    blurb: "Meetings, summits & corporate",
  },
  {
    label: "Unique Spaces",
    infoId: "venue.host.unique",
    Icon: ShieldCheck,
    blurb: "One-of-a-kind hosting spaces",
  },
];

const SERVICES = [
  {
    label: "Claim event showtimes",
    infoId: "venue.service.claim",
    Icon: Ticket,
    blurb: "Claim organizer showtimes running at your property.",
  },
  {
    label: "Published seating layouts",
    infoId: "venue.service.layouts",
    Icon: LayoutGrid,
    blurb: "Publish layouts organizers can reuse for every show.",
  },
  {
    label: "Layout request workflow",
    infoId: "venue.service.requests",
    Icon: ClipboardList,
    blurb: "Review and fulfill custom seating requests smoothly.",
  },
  {
    label: "Organizer discovery",
    infoId: "venue.service.discovery",
    Icon: Building2,
    blurb: "Get found by organizers searching trusted venues.",
  },
  {
    label: "Partner onboarding",
    infoId: "venue.service.onboarding",
    Icon: Handshake,
    blurb: "Complete verification and go live as a partner.",
  },
  {
    label: "Citywide visibility",
    infoId: "venue.service.visibility",
    Icon: MapPin,
    blurb: "Stand out to partners and audiences across the city.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Claiming showtimes and publishing layouts in one place saved our ops team hours every week — organizers always know what's available.",
    name: "Grand Hall Venues",
    role: "Venue Partner",
  },
  {
    quote:
      "Being a verified Book My Bota venue put us in front of organizers searching for trusted spaces across the city.",
    name: "Skyline Amphitheatre",
    role: "Outdoor Venue Partner",
  },
];

export default function VenueLandingPage() {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
  const { data: registeredVenues = [], isLoading: venuesLoading } = useGetPublicRegisteredVenuesQuery();

  const openLogin = () => {
    const session = readSessionForRole("venue_admin");
    if (session) {
      router.push(homePathForRole("venue_admin"));
      return;
    }
    setLoginOpen(true);
  };

  return (
    <PartnerListYourShowLanding
      layout="bms"
      centeredPartnerHeader
      loginHref="/venue/login"
      expectedRole="venue_admin"
      loginTitle="Venue Admin Login"
      loginSubtitle="Sign in to manage layouts and claim events"
      registerHref="/venue/register"
      registerHint={
        <p className="text-[10px] text-slate-400">
          New venue?{" "}
          <Link href="/venue/register" className="text-[#6900AA] font-semibold">
            Register here
          </Link>
        </p>
      }
      primaryCtaLabel="List your business"
      secondaryLoginLabel="Login your business"
      heroImage={HERO_IMAGE}
      heroImageAlt="Venue partner on Book My Bota"
      imageCards={PARTNER_VENUE_TYPE_CARDS}
      servicesTitle="What are the services we offer?"
      servicesSubtitle="Tools built for venue operators — claim shows at your property, publish layouts, and stay connected to organizers using Book My Bota."
      servicesTiles={SERVICES}
      servicesFootnote="Complete account setup (details + documents). After Super Admin approval, sign in to manage layouts and claim events."
      testimonials={TESTIMONIALS}
      middleSlot={
        <PartnerDirectorySection
          title="Registered venues on Book My Bota"
          subtitle="Browse free dates and send a booking inquiry — the same partners organizers discover when creating events."
          kind="venue"
          partners={registeredVenues}
          isLoading={venuesLoading}
          emptyMessage="No registered venues yet. After Super Admin onboards a venue partner, it will appear here."
        />
      }
      crossLinks={
        <p className="flex flex-wrap items-center justify-center gap-2">
          Also partnering as
          <Link href="/artist" className="text-[#6900AA] font-semibold hover:underline">
            an artist
          </Link>
          <span>or</span>
          <Link href="/business" className="text-[#6900AA] font-semibold hover:underline">
            a restaurant
          </Link>
          ?
        </p>
      }
      onOpenLogin={openLogin}
      loginOpen={loginOpen}
      onCloseLogin={() => setLoginOpen(false)}
    />
  );
}
