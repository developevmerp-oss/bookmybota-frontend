"use client";

import { useEffect, useState } from "react";
import PromoBannerCarousel from "@/components/LandingPage/PromoBannerCarousel";
import PopularDiningRail from "@/components/LandingPage/PopularDiningRail";
import FeaturedDiningRail from "@/components/LandingPage/FeaturedDiningRail";
import OverlayDiningRail from "@/components/LandingPage/OverlayDiningRail";
import EditorialDiningRail from "@/components/LandingPage/EditorialDiningRail";
import BarSceneRail from "@/components/LandingPage/BarSceneRail";
import FeaturedBarRail from "@/components/LandingPage/FeaturedBarRail";
import OverlayBarRail from "@/components/LandingPage/OverlayBarRail";
import EditorialBarRail from "@/components/LandingPage/EditorialBarRail";
import TopArtistsRail from "@/components/LandingPage/TopArtistsRail";
import RecommendedMoviesRail from "@/components/LandingPage/RecommendedMoviesRail";
import FeaturedMoviesRail from "@/components/LandingPage/FeaturedMoviesRail";
import CompactMoviesRail from "@/components/LandingPage/CompactMoviesRail";
import NotifyMoviesRail from "@/components/LandingPage/NotifyMoviesRail";
import PopularEventsRail from "@/components/LandingPage/PopularEventsRail";
import FeaturedPopularEventsRail from "@/components/LandingPage/FeaturedPopularEventsRail";
import OverlayPopularEventsRail from "@/components/LandingPage/OverlayPopularEventsRail";
import EditorialPopularEventsRail from "@/components/LandingPage/EditorialPopularEventsRail";
import SpecialOffersRail from "@/components/LandingPage/SpecialOffersRail";
import LiveCategoryTiles from "@/components/LandingPage/LiveCategoryTiles";
import PopularSportsEventsRail from "@/components/LandingPage/PopularSportsEventsRail";
import FeaturedSportsEventsRail from "@/components/LandingPage/FeaturedSportsEventsRail";
import OverlaySportsEventsRail from "@/components/LandingPage/OverlaySportsEventsRail";
import EditorialSportsEventsRail from "@/components/LandingPage/EditorialSportsEventsRail";
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
      <div className="flex flex-col">
        <PromoBannerCarousel city={city} />
        <LiveCategoryTiles city={city} />
      </div>
      <PopularDiningRail city={city} />
      <FeaturedDiningRail city={city} />
      <OverlayDiningRail city={city} />
      <EditorialDiningRail city={city} />
      <BarSceneRail city={city} />
      <FeaturedBarRail city={city} />
      <OverlayBarRail city={city} />
      <EditorialBarRail city={city} />
      <TopArtistsRail />
      <RecommendedMoviesRail />
      <FeaturedMoviesRail />
      <CompactMoviesRail />
      <NotifyMoviesRail />
      <PopularEventsRail city={city} />
      <FeaturedPopularEventsRail city={city} />
      <OverlayPopularEventsRail city={city} />
      <EditorialPopularEventsRail city={city} />
      <SpecialOffersRail city={city} />
      <PopularSportsEventsRail city={city} />
      <FeaturedSportsEventsRail city={city} />
      <OverlaySportsEventsRail city={city} />
      <EditorialSportsEventsRail city={city} />
      <Footer />
    </div>
  );
}
