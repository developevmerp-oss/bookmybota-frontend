"use client";

import { useEffect, useState } from "react";
import PromoBannerCarousel from "@/components/LandingPage/PromoBannerCarousel";
import PopularDiningRail from "@/components/LandingPage/PopularDiningRail";
import BarSceneRail from "@/components/LandingPage/BarSceneRail";
import TopArtistsRail from "@/components/LandingPage/TopArtistsRail";
import RecommendedMoviesRail from "@/components/LandingPage/RecommendedMoviesRail";
import PopularEventsRail from "@/components/LandingPage/PopularEventsRail";
import SpecialOffersRail from "@/components/LandingPage/SpecialOffersRail";
import LiveCategoryTiles from "@/components/LandingPage/LiveCategoryTiles";
import PopularSportsEventsRail from "@/components/LandingPage/PopularSportsEventsRail";
import CityLocationEmptyState from "@/components/LandingPage/CityLocationEmptyState";
import { useHomeCatalog } from "@/components/LandingPage/useHomeCatalog";
import Footer from "@/components/LandingPage/Footer";

export default function Home() {
  const [city, setCity] = useState("");
  const catalog = useHomeCatalog(city);

  useEffect(() => {
    const syncCity = () => {
      const stored = localStorage.getItem("selected_city");
      setCity(stored && stored !== "All Cities" ? stored : "");
    };
    syncCity();
    window.addEventListener("selected_city_changed", syncCity);
    return () => window.removeEventListener("selected_city_changed", syncCity);
  }, []);

  const usingHomeFallback =
    Boolean(city.trim()) &&
    !catalog.isLoadingEvents &&
    !catalog.isLoadingDining &&
    ((catalog.cityEvents.length === 0 && catalog.fallbackEvents.length > 0) ||
      (catalog.cityDining.length === 0 && catalog.allDining.length > 0));

  return (
    <div className=" bg-white text-[#111111] overflow-x-hidden">
      {city.trim() ? (
        <div className="w-full container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0 pt-3 sm:pt-4">
          <CityLocationEmptyState city={city.trim()} forceShow={usingHomeFallback} />
        </div>
      ) : null}
      <div className="flex flex-col">
        <PromoBannerCarousel city={city} />
        <LiveCategoryTiles city={city} />
      </div>
      <PopularDiningRail city={city} />
      <BarSceneRail city={city} />
      <TopArtistsRail />
      <RecommendedMoviesRail />
      <PopularEventsRail city={city} />
      <SpecialOffersRail city={city} />
      <PopularSportsEventsRail city={city} />
      <Footer />
    </div>
  );
}
