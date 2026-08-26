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
import { useGetPublicRegisteredVenuesQuery } from "@/services/api";

const FEATURE_SLIDES = [
  {
    id: "claim",
    title: "Claim events happening at your venue",
    description:
      "When organizers list your space, claim those showtimes and stay in the loop on what is running at your property.",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&q=80",
    bg: "#45423E",
  },
  {
    id: "layouts",
    title: "Publish seating layouts once, reuse often",
    description:
      "Share theater, banquet, or mixed layouts so organizers can pick a published plan for every show.",
    image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=900&q=80",
    bg: "#9A6848",
  },
  {
    id: "requests",
    title: "Handle custom layout requests",
    description:
      "Review organizer seating requests, fulfill them with your plans, and keep the floor plan process smooth.",
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&q=80",
    bg: "#3E613D",
  },
  {
    id: "trust",
    title: "Become a verified venue partner",
    description:
      "Authorized venues stand out in organizer search and appear as platform-trusted spaces to customers.",
    image: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=900&q=80",
    bg: "#536E7A",
  },
];

const VENUE_TYPES = [
  {
    label: "Auditoriums & Halls",
    infoId: "venue.host.auditoriums",
    Icon: Building2,
  },
  {
    label: "Banquet & Wedding Spaces",
    infoId: "venue.host.banquet",
    Icon: Sofa,
  },
  {
    label: "Outdoor & Amphitheaters",
    infoId: "venue.host.outdoor",
    Icon: MapPin,
  },
  {
    label: "Clubs & Nightvenues",
    infoId: "venue.host.clubs",
    Icon: Users,
  },
  {
    label: "Conference Centers",
    infoId: "venue.host.conference",
    Icon: LayoutGrid,
  },
  {
    label: "Unique Spaces",
    infoId: "venue.host.unique",
    Icon: ShieldCheck,
  },
];

const SERVICES = [
  {
    label: "Claim event showtimes",
    infoId: "venue.service.claim",
    Icon: Ticket,
  },
  {
    label: "Published seating layouts",
    infoId: "venue.service.layouts",
    Icon: LayoutGrid,
  },
  {
    label: "Layout request workflow",
    infoId: "venue.service.requests",
    Icon: ClipboardList,
  },
  {
    label: "Organizer discovery",
    infoId: "venue.service.discovery",
    Icon: Building2,
  },
  {
    label: "Partner onboarding",
    infoId: "venue.service.onboarding",
    Icon: Handshake,
  },
  {
    label: "Citywide visibility",
    infoId: "venue.service.visibility",
    Icon: MapPin,
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
      primaryCtaLabel="List your venue"
      secondaryLoginLabel="Venue Login"
      slides={FEATURE_SLIDES}
      hostTitle="What can you host???"
      hostSubtitle="From auditoriums to banquet halls and outdoor grounds — list your space so organizers can book shows where your guests already gather."
      hostTiles={VENUE_TYPES}
      servicesTitle="What are the services we offer?"
      servicesSubtitle="Tools built for venue operators — claim shows at your property, publish layouts, and stay connected to organizers using Book My Bota."
      servicesTiles={SERVICES}
      servicesFootnote="Complete account setup (details + documents). After Super Admin approval, sign in to manage layouts and claim events."
      testimonials={TESTIMONIALS}
      securityTitle="Sit back and watch your venue come to life"
      securitySubtitle="Hosting events is exciting — paperwork shouldn't be. We keep partner data and guest bookings secure so you can focus on the floor."
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
