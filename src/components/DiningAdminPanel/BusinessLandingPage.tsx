"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgePercent,
  BarChart3,
  CalendarCheck,
  Coffee,
  QrCode,
  Soup,
  Store,
  Tag,
  Ticket,
  Users,
  Utensils,
  Wine,
} from "lucide-react";
import PartnerListYourShowLanding from "@/components/Shared/PartnerListYourShowLanding";
import { homePathForRole, readSessionForRole } from "@/lib/authStorage";

const FEATURE_SLIDES = [
  {
    id: "tables",
    title: "Fill every table with ease",
    description: "List your restaurant on Book My Bota and let diners discover, book, and walk in ready to enjoy.",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&q=80",
    bg: "#45423E",
  },
  {
    id: "offers",
    title: "Run offers that actually convert",
    description: "Promote weekday specials, happy hours, and gift-card redemptions from one dining dashboard.",
    image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=900&q=80",
    bg: "#9A6848",
  },
  {
    id: "scan",
    title: "Scan & redeem in seconds",
    description: "Validate offers and gift cards at the door with a simple phone-based scan flow.",
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&q=80",
    bg: "#3E613D",
  },
  {
    id: "insights",
    title: "Understand what diners love",
    description: "Track bookings, redemptions, and reviews so you can grow what works.",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900&q=80",
    bg: "#536E7A",
  },
];

const HOST_CATEGORIES = [
  {
    label: "Fine Dining",
    infoId: "business.host.fine-dining",
    Icon: Wine,
  },
  {
    label: "Casual Dining",
    infoId: "business.host.casual-dining",
    Icon: Utensils,
  },
  {
    label: "Cafés & Bakeries",
    infoId: "business.host.cafes",
    Icon: Coffee,
  },
  {
    label: "Quick Service",
    infoId: "business.host.qsr",
    Icon: Soup,
  },
  {
    label: "Bars & Lounges",
    infoId: "business.host.bars",
    Icon: Store,
  },
  {
    label: "Multi-outlet Brands",
    infoId: "business.host.multi-outlet",
    Icon: Users,
  },
];

const SERVICES = [
  {
    label: "Online discovery & bookings",
    infoId: "business.service.discovery",
    Icon: CalendarCheck,
  },
  {
    label: "Offers & promotions",
    infoId: "business.service.offers",
    Icon: Tag,
  },
  {
    label: "Gift card acceptance",
    infoId: "business.service.gift-cards",
    Icon: Ticket,
  },
  {
    label: "QR scan at the venue",
    infoId: "business.service.qr",
    Icon: QrCode,
  },
  {
    label: "Reviews & reputation",
    infoId: "business.service.reviews",
    Icon: BadgePercent,
  },
  {
    label: "Reports & insights",
    infoId: "business.service.reports",
    Icon: BarChart3,
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Listing on Book My Bota brought a steady stream of new diners — especially on weeknights — without changing how we run the floor.",
    name: "Addis Kitchen",
    role: "Restaurant Partner",
  },
  {
    quote:
      "Offers and gift-card redemptions are finally simple. Guests arrive, we scan, and the dashboard tells us exactly what worked.",
    name: "Harbour Café Group",
    role: "Multi-outlet Partner",
  },
];

export default function BusinessLandingPage() {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);

  const openLogin = () => {
    const session = readSessionForRole("business_admin");
    if (session) {
      router.push(homePathForRole("business_admin"));
      return;
    }
    setLoginOpen(true);
  };

  return (
    <PartnerListYourShowLanding
      expectedRole="business_admin"
      loginTitle="Dining Admin Login"
      loginSubtitle="Sign in to manage your restaurant"
      registerHref="/business/register"
      registerHint={
        <p className="text-[10px] text-slate-400">
          New partner?{" "}
          <Link href="/business/register" className="text-[#6900AA] font-semibold">
            Register here
          </Link>
        </p>
      }
      primaryCtaLabel="List your restaurant"
      secondaryLoginLabel="Dining Login"
      slides={FEATURE_SLIDES}
      hostTitle="What can you host???"
      hostSubtitle="Book My Bota helps restaurants grow with end-to-end dining tools — from the moment you register to every cover you serve. Let's look at who can partner."
      hostTiles={HOST_CATEGORIES}
      servicesTitle="What are the services we offer?"
      servicesSubtitle="After collaborating with dining partners across the city, we're equipped to bring more guests through your door."
      servicesTiles={SERVICES}
      servicesFootnote="Apart from these must-haves, we also support promotions, gift-card settlements, and dedicated tools to manage tables, reviews, and guest experience."
      testimonials={TESTIMONIALS}
      securityTitle="Sit back and watch your restaurant grow"
      securitySubtitle="Hospitality is fun — operations shouldn't be stressful. We help keep bookings, offers, and guest data secure so you can focus on the floor."
      crossLinks={
        <p className="flex flex-wrap items-center justify-center gap-2">
          Also listing events?
          <Link href="/organizer" className="text-[#6900AA] font-semibold hover:underline">
            Partner as an organizer
          </Link>
        </p>
      }
      onOpenLogin={openLogin}
      loginOpen={loginOpen}
      onCloseLogin={() => setLoginOpen(false)}
    />
  );
}
