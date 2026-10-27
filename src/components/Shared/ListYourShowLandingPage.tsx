"use client";

import {
  BarChart3,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Tag,
  UserPlus,
} from "lucide-react";
import PartnerListYourShowLanding from "@/components/Shared/PartnerListYourShowLanding";
import ListYourShowHostTypesSection from "@/components/Shared/ListYourShowHostTypesSection";
import ListYourShowServicesSection from "@/components/Shared/ListYourShowServicesSection";
import images from "@/Images";

function imageSrc(img: string | { src: string }) {
  return typeof img === "string" ? img : img.src;
}

const PAGE_CONTAINER = "bmb-section-container";

const HERO_SLIDES = [
  {
    id: "scan",
    title: "Ticket scanning made easy",
    description: "Experience the ease of managing entry at an event.",
    image: "https://assets-in.bmscdn.com/static/2021/06/des-sli-fiv.jpeg",
    bg: "#2F4858",
    knowMoreHref: "#features",
  },
  {
    id: "mticket",
    title: "Take advantage of our M-ticket feature",
    description: "Lets your audience skip the box office queue and head straight to the gate.",
    image: "https://assets-in.bmscdn.com/static/2021/06/des-sli-f.jpeg",
    bg: "#A15C38",
    knowMoreHref: "#features",
  },
  {
    id: "dashboard",
    title: "Introducing an event management tool",
    description: "Experience the ease of event creation and publishing.",
    image: "https://assets-in.bmscdn.com/static/2021/06/des-lap-sli-six.png",
    bg: "#6900AA",
    knowMoreHref: "#features",
  },
  {
    id: "artist",
    title: "Empower the artist within you",
    description: "List your own performances, gigs and more with Book My Bota.",
    image: "https://assets-in.bmscdn.com/static/2021/06/sli-o.jpeg",
    bg: "#2D6A4F",
    knowMoreHref: "#features",
  },
  {
    id: "workshop",
    title: "Conduct workshops and much more",
    description: "Share your skills with people around the world — from home!",
    image: "https://assets-in.bmscdn.com/static/2021/06/des-sli-th.jpeg",
    bg: "#1D4E89",
    knowMoreHref: "#features",
  },
];

/* Legacy icon host cards — kept for reference / rollback
const HOST_CATEGORIES = [
  {
    label: "Dining",
    infoId: "list-your-show.host.dining",
    infoHref: "/business",
    Icon: UtensilsCrossed,
    iconSrc: imageSrc(images.hostDiningIcon),
  },
  {
    label: "Movie",
    infoId: "list-your-show.host.movie",
    infoHref: "/movie",
    Icon: Clapperboard,
    iconSrc: imageSrc(images.hostMovieIcon),
  },
  {
    label: "Concert",
    infoId: "list-your-show.host.concert",
    infoHref: "/list-your-show/concert",
    Icon: Mic2,
    iconSrc: imageSrc(images.hostConcertIcon),
  },
  {
    label: "Sports",
    infoId: "list-your-show.host.sports",
    infoHref: "/list-your-show/sports",
    Icon: Trophy,
    iconSrc: imageSrc(images.hostSportsIcon),
  },
  {
    label: "Comedy",
    infoId: "list-your-show.host.comedy",
    infoHref: "/list-your-show/comedy",
    Icon: Laugh,
    iconSrc: imageSrc(images.hostComedyIcon),
  },
  {
    label: "Artist",
    infoId: "list-your-show.host.artist",
    infoHref: "/artist",
    Icon: UserRound,
    iconSrc: imageSrc(images.hostArtistIcon),
  },
  {
    label: "Venue",
    infoId: "list-your-show.host.venue",
    infoHref: "/venue",
    Icon: Building2,
    iconSrc: imageSrc(images.hostVenueIcon),
  },
  {
    label: "Music",
    infoId: "list-your-show.host.music",
    infoHref: "/list-your-show/music",
    Icon: Music,
    iconSrc: imageSrc(images.hostMusicIcon),
  },
];
*/

/** Host cards use each partner page’s hero image (dining-types UI). */
const HOST_IMAGE_CARDS = [
  {
    label: "Dining",
    image: imageSrc(images.diningPartnerHero),
    href: "/list-your-show/dining",
  },
  {
    label: "Movie",
    image: imageSrc(images.moviePartnerHero),
    href: "/list-your-show/movie",
  },
  {
    label: "Concert",
    image: imageSrc(images.concertPartnerHero),
    href: "/list-your-show/concert",
  },
  {
    label: "Sports",
    image: imageSrc(images.sportsPartnerHero),
    href: "/list-your-show/sports",
  },
  {
    label: "Comedy",
    image: imageSrc(images.comedyPartnerHero),
    href: "/list-your-show/comedy",
  },
  {
    label: "Artist",
    image: imageSrc(images.artistPartnerHero),
    href: "/list-your-show/artist",
  },
  {
    label: "Venue",
    image: imageSrc(images.venuePartnerHero),
    href: "/list-your-show/venue",
  },
  {
    label: "Music",
    image: imageSrc(images.musicPartnerHero),
    href: "/list-your-show/music",
  },
];

const HOST_TITLE = "What can you host???";
const HOST_SUBTITLE =
  "As the purveyor of entertainment, Book My Bota enables your event with end to end solutions from the time you register to the completion of the event. Let's look at what you can host.";

/** Platform services shared by every partner type on Book My Bota. */
const COMMON_FEATURES = [
  {
    label: "Partner registration & onboarding",
    infoId: "list-your-show.feature.registration",
    Icon: UserPlus,
  },
  {
    label: "Online discovery & visibility",
    infoId: "list-your-show.feature.discovery",
    Icon: Megaphone,
  },
  {
    label: "Dedicated partner portal",
    infoId: "list-your-show.feature.dashboard",
    Icon: LayoutDashboard,
  },
  {
    label: "Secure partner login",
    infoId: "list-your-show.feature.login",
    Icon: ShieldCheck,
  },
  {
    label: "Offers & promotions",
    infoId: "list-your-show.feature.offers",
    Icon: Tag,
  },
  {
    label: "Reports & business insights",
    infoId: "list-your-show.feature.reports",
    Icon: BarChart3,
  },
];

const FEATURES_TITLE = "Common services for every partner";
const FEATURES_SUBTITLE =
  "Whether you list dining, events, movies, venues, or artists — every Book My Bota partner gets access to these core platform services.";
const FEATURES_FOOTNOTE =
  "Category-specific tools such as table management, ticket scanning, cinema showtimes, venue layouts, and artist booking are available after you register under the partner type that fits your business.";

export default function ListYourShowLandingPage() {
  return (
    <PartnerListYourShowLanding
      hostOnly
      layout="bms"
      hideBuiltInHeader
      pageContainerClassName={PAGE_CONTAINER}
      pageBackgroundClassName="bg-white"
      slides={HERO_SLIDES}
      registerHref="/organizer/register"
      loginHref="/login"
      primaryCtaLabel="List your business"
      secondaryLoginLabel="Login your business"
      // Legacy icon host grid commented — replaced by dining-types image cards
      // hostTitle={HOST_TITLE}
      // hostSubtitle={HOST_SUBTITLE}
      // hostTiles={HOST_CATEGORIES}
      hostSection={
        <ListYourShowHostTypesSection
          title={HOST_TITLE}
          subtitle={HOST_SUBTITLE}
          cards={HOST_IMAGE_CARDS}
          containerClassName={PAGE_CONTAINER}
        />
      }
      // Legacy features grid commented — replaced by dining services-style cards (+ subtitle)
      // featuresTitle={FEATURES_TITLE}
      // featuresSubtitle={FEATURES_SUBTITLE}
      // featuresTiles={COMMON_FEATURES}
      // featuresFootnote={FEATURES_FOOTNOTE}
      featuresSection={
        <ListYourShowServicesSection
          title={FEATURES_TITLE}
          subtitle={FEATURES_SUBTITLE}
          tiles={COMMON_FEATURES}
          footnote={FEATURES_FOOTNOTE}
          registerHref="/organizer/register"
          primaryCtaLabel="List your business"
          containerClassName={PAGE_CONTAINER}
        />
      }
      securityTitle="Sit back and watch your event come to life"
      securitySubtitle="Events may be all fun and games, but we take it seriously. We ensure our customer's security so that you don't have to."
    />
  );
}
