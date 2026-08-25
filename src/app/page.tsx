"use client";

import { useEffect, useState } from "react";
import PromoBannerCarousel from "@/components/LandingPage/PromoBannerCarousel";
import PopularDiningRail from "@/components/LandingPage/PopularDiningRail";
import TopArtistsRail from "@/components/LandingPage/TopArtistsRail";
import TopVenuesRail from "@/components/LandingPage/TopVenuesRail";
import RecommendedMoviesRail from "@/components/LandingPage/RecommendedMoviesRail";
import PopularEventsRail from "@/components/LandingPage/PopularEventsRail";
import SpecialOffersRail from "@/components/LandingPage/SpecialOffersRail";
import LiveCategoryTiles from "@/components/LandingPage/LiveCategoryTiles";
import EventsNearYouRail from "@/components/LandingPage/EventsNearYouRail";
import SportsStadiumBanner from "@/components/LandingPage/SportsStadiumBanner";
import PopularSportsEventsRail from "@/components/LandingPage/PopularSportsEventsRail";
import Footer from "@/components/LandingPage/Footer";

export default function Home() {
  const [city, setCity] = useState("");

  useEffect(() => {
    const syncCity = () => {
      const stored = localStorage.getItem("selected_city");
      setCity(stored && stored !== "All Cities" ? stored : "");
    };
    syncCity();
    window.addEventListener("selected_city_changed", syncCity);
    return () => window.removeEventListener("selected_city_changed", syncCity);
  }, []);

  return (
    <div className=" bg-white text-[#111111] overflow-x-hidden">
      {/* Hero + category tiles share one viewport below the sticky header (lg+) */}
      <div className="flex flex-col lg:h-[calc(100dvh-5.75rem)] xl:h-[calc(100dvh-6.75rem)]">
        <PromoBannerCarousel city={city} />
        <LiveCategoryTiles city={city} />
      </div>
      <PopularDiningRail city={city} />
      <TopArtistsRail />
      <TopVenuesRail />
      {/* <RecommendedMoviesRail /> */}
      <PopularEventsRail city={city} />
      <SpecialOffersRail />
      <EventsNearYouRail city={city} />
      {/* <SportsStadiumBanner /> */}
      <PopularSportsEventsRail />
      <Footer />
    </div>
  );
}
