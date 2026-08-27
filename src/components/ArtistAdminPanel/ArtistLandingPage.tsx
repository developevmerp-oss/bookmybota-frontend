"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  Guitar,
  Handshake,
  Mic2,
  Music2,
  Share2,
  Sparkles,
  Star,
  Ticket,
  Users,
} from "lucide-react";
import PartnerListYourShowLanding from "@/components/Shared/PartnerListYourShowLanding";
import PartnerDirectorySection from "@/components/Shared/PartnerDirectorySection";
import { homePathForRole, readSessionForRole } from "@/lib/authStorage";
import { useGetPublicRegisteredArtistsQuery } from "@/services/api";

const FEATURE_SLIDES = [
  {
    id: "spotlight",
    title: "Empower the artist within you",
    description:
      "List your own performances, gigs and more with Book My Bota — and get discovered by organizers.",
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=900&q=80",
    bg: "#2D6A4F",
  },
  {
    id: "profile",
    title: "Own your stage-ready profile",
    description:
      "Showcase your bio, photos, and performance style so fans and partners see you at your best.",
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&q=80",
    bg: "#A15C38",
  },
  {
    id: "lineup",
    title: "Appear on event lineups citywide",
    description:
      "When organizers add you to an event, your name reaches Book My Bota audiences across the city.",
    image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=900&q=80",
    bg: "#2F4858",
  },
  {
    id: "trust",
    title: "Build platform trust & credibility",
    description:
      "Verified partners stand out. Complete onboarding to become a platform-authorized artist.",
    image: "https://images.unsplash.com/photo-1501386767018-ba696c028ced?w=900&q=80",
    bg: "#1D4E89",
  },
];

const ARTIST_TYPES = [
  {
    label: "Singers & Vocalists",
    infoId: "artist.host.singers",
    Icon: Mic2,
    blurb: "Solo artists & vocal performers",
  },
  {
    label: "Bands & Ensembles",
    infoId: "artist.host.bands",
    Icon: Guitar,
    blurb: "Live bands & group acts",
  },
  {
    label: "DJs & Electronic",
    infoId: "artist.host.djs",
    Icon: Music2,
    blurb: "Club sets & electronic nights",
  },
  {
    label: "Comedy & Spoken Word",
    infoId: "artist.host.comedy",
    Icon: Sparkles,
    blurb: "Stand-up, poetry & open mics",
  },
  {
    label: "Dance & Performance",
    infoId: "artist.host.dance",
    Icon: Users,
    blurb: "Dance crews & stage acts",
  },
  {
    label: "Special Acts",
    infoId: "artist.host.special",
    Icon: Star,
    blurb: "Unique & specialty performers",
  },
];

const SERVICES = [
  {
    label: "Artist profile hub",
    infoId: "artist.service.profile",
    Icon: Mic2,
    blurb: "Showcase bio, photos and your performance style.",
  },
  {
    label: "Organizer discovery",
    infoId: "artist.service.discovery",
    Icon: CalendarDays,
    blurb: "Get found by organizers booking live talent.",
  },
  {
    label: "Event visibility",
    infoId: "artist.service.visibility",
    Icon: Ticket,
    blurb: "Appear on lineups seen by citywide audiences.",
  },
  {
    label: "Shareable presence",
    infoId: "artist.service.shareable",
    Icon: Share2,
    blurb: "Share a polished profile with partners and fans.",
  },
  {
    label: "Partner onboarding",
    infoId: "artist.service.onboarding",
    Icon: Handshake,
    blurb: "Complete verification and become an authorized artist.",
  },
  {
    label: "Cross-city reach",
    infoId: "artist.service.reach",
    Icon: Building2,
    blurb: "Grow bookings beyond your home city.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Getting discovered by organizers through Book My Bota meant more bookings and less time chasing gigs on social media.",
    name: "Liya M.",
    role: "Vocalist & Live Performer",
  },
  {
    quote:
      "Our band profile looks professional, availability is clear, and inquiries come in from real event partners.",
    name: "Horizon Collective",
    role: "Band Partner",
  },
];

export default function ArtistLandingPage() {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
  const { data: registeredArtists = [], isLoading: artistsLoading } =
    useGetPublicRegisteredArtistsQuery();

  const openLogin = () => {
    const session = readSessionForRole("artist_admin");
    if (session) {
      router.push(homePathForRole("artist_admin"));
      return;
    }
    setLoginOpen(true);
  };

  return (
    <PartnerListYourShowLanding
      expectedRole="artist_admin"
      loginTitle="Artist Admin Login"
      loginSubtitle="Sign in to manage your artist profile"
      registerHref="/artist/register"
      registerHint={
        <p className="text-[10px] text-slate-400">
          New artist?{" "}
          <Link href="/artist/register" className="text-[#6900AA] font-semibold">
            Register here
          </Link>
        </p>
      }
      primaryCtaLabel="List your show"
      secondaryLoginLabel="Artist Login"
      slides={FEATURE_SLIDES}
      hostTitle="What can you host???"
      hostSubtitle="From solo singers to full bands and specialty acts — Book My Bota helps performers get in front of organizers who are building lineups every week."
      hostTiles={ARTIST_TYPES}
      servicesTitle="What are the services we offer?"
      servicesSubtitle="A simple partner portal focused on discovery, profile management, and trust — so you spend more time performing and less time chasing bookings."
      servicesTiles={SERVICES}
      servicesFootnote="Complete account setup (details + documents). After Super Admin approval, sign in to manage your artist profile, free dates, and booking inquiries."
      testimonials={TESTIMONIALS}
      securityTitle="Sit back and watch your career come to life"
      securitySubtitle="Performing is the fun part. We keep your partner profile and booking inquiries secure so you can focus on the stage."
      middleSlot={
        <PartnerDirectorySection
          title="Registered artists on Book My Bota"
          subtitle="Performers already onboarded and approved — open a profile to see free dates and send a booking inquiry."
          kind="artist"
          partners={registeredArtists}
          isLoading={artistsLoading}
          emptyMessage="No registered artists yet. After an artist completes registration and approval, they will appear here."
        />
      }
      crossLinks={
        <p className="flex flex-wrap items-center justify-center gap-2">
          Also partnering as
          <Link href="/venue" className="text-[#6900AA] font-semibold hover:underline">
            a venue
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
