"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Film, QrCode, Ticket } from "lucide-react";
import PartnerListYourShowLanding from "@/components/Shared/PartnerListYourShowLanding";
import { homePathForRole, readSessionForRole } from "@/lib/authStorage";
import { PARTNER_CATEGORY_TYPES } from "@/data/partnerCategoryTypes";
import images from "@/Images";

const PAGE_CONTAINER = "bmb-section-container";

function imageSrc(imgData: string | { src: string }) {
  return typeof imgData === "string" ? imgData : imgData.src;
}

const HERO_IMAGE = imageSrc(images.moviePartnerHero);

const SERVICES = [
  {
    label: "Movie listings",
    infoId: "movie.service.listings",
    Icon: Film,
  },
  {
    label: "Showtime scheduling",
    infoId: "movie.service.showtimes",
    Icon: CalendarDays,
  },
  {
    label: "Online ticket sales",
    infoId: "movie.service.tickets",
    Icon: Ticket,
  },
  {
    label: "QR gate scanning",
    infoId: "movie.service.scan",
    Icon: QrCode,
  },
];

export default function MovieLandingPage() {
  const router = useRouter();

  const openLogin = () => {
    const session = readSessionForRole("movie_admin");
    if (session) {
      router.push(homePathForRole("movie_admin"));
      return;
    }
    router.push("/movie/login");
  };

  return (
    <PartnerListYourShowLanding
      layout="bms"
      centeredPartnerHeader
      pageContainerClassName={PAGE_CONTAINER}
      pageBackgroundClassName="bg-white"
      headerLoginPrompt="Already a partner?"
      headerLoginVariant="dark"
      loginHref="/movie/login"
      expectedRole="movie_admin"
      loginTitle="Movie Login"
      loginSubtitle="Sign in to manage your cinema listings"
      registerHref="/movie/register"
      registerHint={
        <p className="text-[0.625rem] text-slate-400">
          New cinema partner?{" "}
          <Link href="/movie/register" className="text-[#6900AA] font-semibold">
            Register here
          </Link>
        </p>
      }
      primaryCtaLabel="List your theatre"
      secondaryLoginLabel="Login your theatre"
      heroVariant="split"
      heroEyebrow="FOR CINEMA & THEATRE PARTNERS"
      heroTitle="Bring your theatre to more movie lovers."
      heroDescription="List your cinema on BookMyBota, manage showtimes, sell tickets and reach more audiences with a seamless booking experience."
      heroImage={HERO_IMAGE}
      heroImageAlt="Cinema partner on Book My Bota"
      categoryTypesTitle={`${PARTNER_CATEGORY_TYPES.movie.title} Types`}
      categoryTypes={PARTNER_CATEGORY_TYPES.movie.types}
      categoryTypesVariant="cards"
      categoryTypesTitleStyle="heading"
      categoryTypesCardStyle="overlay"
      servicesTitle="What can you do in the portal?"
      servicesSubtitle="The movie admin panel follows the same onboarding and approval flow as event organizers — register, upload documents, wait for approval, then manage your cinema."
      servicesHideSubtitle
      servicesCardsVariant="bordered"
      servicesTiles={SERVICES}
      servicesFootnote="Movie listing, showtime, and booking tools will expand in this panel as the cinema module grows on Book My Bota."
      onOpenLogin={openLogin}
    />
  );
}
