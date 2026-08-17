"use client";

import { useEffect, useState } from "react";
import HomeHeader from "@/components/LandingPage/HomeHeader";
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
    const stored = localStorage.getItem("selected_city");
    if (stored && stored !== "All Cities") setCity(stored);
  }, []);

  const handleCityChange = (next: string) => {
    setCity(next);
    if (next && next !== "All Cities") localStorage.setItem("selected_city", next);
    else localStorage.removeItem("selected_city");
    window.dispatchEvent(new Event("selected_city_changed"));
  };

  return (
    <div className="min-h-screen bg-white text-[#111111]">
      <HomeHeader city={city} onCityChange={handleCityChange} />
      <CategoryNavBar />
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
