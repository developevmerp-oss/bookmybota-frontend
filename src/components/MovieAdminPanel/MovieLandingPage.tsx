"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clapperboard,
  Film,
  Popcorn,
  QrCode,
  Ticket,
  Users,
} from "lucide-react";
import PartnerListYourShowLanding from "@/components/Shared/PartnerListYourShowLanding";
import { homePathForRole, readSessionForRole } from "@/lib/authStorage";

const FEATURE_SLIDES = [
  {
    id: "listings",
    title: "List movies and showtimes in one place",
    description: "Publish screenings, manage schedules, and keep your cinema catalogue up to date.",
    image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=900&q=80",
    bg: "#1F2937",
  },
  {
    id: "tickets",
    title: "Sell tickets online with ease",
    description: "Offer M-Tickets, box office pickup, and delivery options for your audience.",
    image: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=900&q=80",
    bg: "#7C3AED",
  },
  {
    id: "scan",
    title: "Scan tickets at the gate",
    description: "Validate bookings quickly with QR scanning on show day.",
    image: "https://images.unsplash.com/photo-1536440136618-849c177e76a1?w=900&q=80",
    bg: "#0F766E",
  },
  {
    id: "insights",
    title: "Track bookings and occupancy",
    description: "See how your shows perform and manage your cinema operations from one dashboard.",
    image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=900&q=80",
    bg: "#B45309",
  },
];

const CINEMA_TYPES = [
  { label: "Multiplex", infoId: "movie.host.multiplex", Icon: Film },
  { label: "Single Screen", infoId: "movie.host.single", Icon: Clapperboard },
  { label: "Drive-in", infoId: "movie.host.drivein", Icon: Popcorn },
  { label: "Independent Cinema", infoId: "movie.host.independent", Icon: Users },
];

const SERVICES = [
  { label: "Movie listings", infoId: "movie.service.listings", Icon: Film },
  { label: "Showtime scheduling", infoId: "movie.service.showtimes", Icon: CalendarDays },
  { label: "Online ticket sales", infoId: "movie.service.tickets", Icon: Ticket },
  { label: "QR gate scanning", infoId: "movie.service.scan", Icon: QrCode },
];

export default function MovieLandingPage() {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);

  const openLogin = () => {
    const session = readSessionForRole("movie_admin");
    if (session) {
      router.push(homePathForRole("movie_admin"));
      return;
    }
    setLoginOpen(true);
  };

  return (
    <PartnerListYourShowLanding
      layout="bms"
      expectedRole="movie_admin"
      loginTitle="Movie Admin Login"
      loginSubtitle="Sign in to manage your cinema listings"
      registerHref="/movie/register"
      registerHint={
        <p className="text-[10px] text-slate-400">
          New cinema partner?{" "}
          <Link href="/movie/register" className="text-[#6900AA] font-semibold">
            Register here
          </Link>
        </p>
      }
      primaryCtaLabel="List your business"
      secondaryLoginLabel="Login your business"
      slides={FEATURE_SLIDES}
      hostTitle="What can you list?"
      hostSubtitle="From multiplex chains to independent screens, Book My Bota helps cinema partners onboard, get approved, and manage movie listings from one portal."
      hostTiles={CINEMA_TYPES}
      servicesTitle="What can you do in the portal?"
      servicesSubtitle="The movie admin panel follows the same onboarding and approval flow as event organizers — register, upload documents, wait for approval, then manage your cinema."
      servicesTiles={SERVICES}
      servicesFootnote="Movie listing, showtime, and booking tools will expand in this panel as the cinema module grows on Book My Bota."
      securityTitle="Secure partner onboarding"
      securitySubtitle="Your account stays disabled until Super Admin verifies your documents — the same trusted flow used for event organizers."
      loginOpen={loginOpen}
      onOpenLogin={openLogin}
      onCloseLogin={() => setLoginOpen(false)}
    />
  );
}
