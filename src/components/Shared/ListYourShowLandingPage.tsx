"use client";

import {
  Building2,
  Clapperboard,
  Laugh,
  Mic2,
  Music,
  Trophy,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";
import PartnerListYourShowLanding from "@/components/Shared/PartnerListYourShowLanding";

const HOST_CATEGORIES = [
  {
    label: "Dining",
    infoId: "list-your-show.host.dining",
    infoHref: "/business",
    Icon: UtensilsCrossed,
  },
  {
    label: "Concert",
    infoId: "list-your-show.host.concert",
    infoHref: "/organizer",
    Icon: Mic2,
  },
  {
    label: "Comedy",
    infoId: "list-your-show.host.comedy",
    infoHref: "/organizer",
    Icon: Laugh,
  },
  {
    label: "Music",
    infoId: "list-your-show.host.music",
    infoHref: "/organizer",
    Icon: Music,
  },
  {
    label: "Movie",
    infoId: "list-your-show.host.movie",
    infoHref: "/movie",
    Icon: Clapperboard,
  },
  {
    label: "Sports",
    infoId: "list-your-show.host.sports",
    infoHref: "/organizer",
    Icon: Trophy,
  },
  {
    label: "Artist",
    infoId: "list-your-show.host.artist",
    infoHref: "/artist",
    Icon: UserRound,
  },
  {
    label: "Venue",
    infoId: "list-your-show.host.venue",
    infoHref: "/venue",
    Icon: Building2,
  },
];

export default function ListYourShowLandingPage() {
  return (
    <PartnerListYourShowLanding
      hostOnly
      layout="bms"
      hideBuiltInHeader
      registerHref="/organizer/register"
      loginHref="/login"
      primaryCtaLabel="List your business"
      secondaryLoginLabel="Login your business"
      hostTitle="What can you host???"
      hostSubtitle="As the purveyor of entertainment, Book My Bota enables your event with end to end solutions from the time you register to the completion of the event. Let's look at what you can host."
      hostTiles={HOST_CATEGORIES}
    />
  );
}
