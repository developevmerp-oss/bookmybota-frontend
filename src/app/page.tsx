"use client";

import { Suspense, useEffect, useState } from "react";
import CategoryNavBar from "@/components/LandingPage/CategoryNavBar";
import PromoBannerCarousel from "@/components/LandingPage/PromoBannerCarousel";
import PopularDiningRail from "@/components/LandingPage/PopularDiningRail";
import PopularEventsRail from "@/components/LandingPage/PopularEventsRail";
import LiveCategoryTiles from "@/components/LandingPage/LiveCategoryTiles";
import RecommendedEventsRail from "@/components/LandingPage/RecommendedEventsRail";
import EventsNearYouRail from "@/components/LandingPage/EventsNearYouRail";
import MusicEventsRail from "@/components/LandingPage/MusicEventsRail";
import ComedyEventsRail from "@/components/LandingPage/ComedyEventsRail";
import OutdoorEventsRail from "@/components/LandingPage/OutdoorEventsRail";
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
    <div className="min-h-screen bg-white text-[#111111]">
      <Suspense fallback={<div className="sticky top-16 z-40 h-11 bg-[#1F1F1F]" />}>
        <CategoryNavBar />
      </Suspense>
      <PromoBannerCarousel city={city} />
      <PopularDiningRail city={city} />
      <PopularEventsRail city={city} />
      <LiveCategoryTiles city={city} />
      <RecommendedEventsRail city={city} />
      <EventsNearYouRail city={city} />
      <MusicEventsRail city={city} />
      <ComedyEventsRail city={city} />
      <OutdoorEventsRail city={city} />
      <Footer />
    </div>
  );
}
