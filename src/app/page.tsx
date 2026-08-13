"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/LandingPage/Navbar";
import HeroSection from "@/components/LandingPage/HeroSection";
import EventDiningCardsSection from "@/components/LandingPage/EventDiningCardsSection";
import PopularEventDiningSection from "@/components/LandingPage/PopularEventDiningSection";
import ExploreByLocationSection from "@/components/LandingPage/ExploreByLocationSection";
import SpecialOffersSection from "@/components/LandingPage/SpecialOffersSection";
import NewsletterSection from "@/components/LandingPage/NewsletterSection";
import Footer from "@/components/LandingPage/Footer";

export default function Home() {
  const [city, setCity] = useState("Addis Ababa");

  useEffect(() => {
    const stored = localStorage.getItem("selected_city");
    if (stored && stored !== "All Cities") setCity(stored);
  }, []);

  const handleCityChange = (next: string) => {
    setCity(next);
    localStorage.setItem("selected_city", next);
    window.dispatchEvent(new Event("selected_city_changed"));
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee]">
      <Navbar city={city} onCityChange={handleCityChange} />
      <HeroSection city={city} onCityChange={handleCityChange} />
      <EventDiningCardsSection />
      <PopularEventDiningSection city={city} />
      <ExploreByLocationSection onCityChange={handleCityChange} />
      <SpecialOffersSection />
      <NewsletterSection />
      <Footer />
    </div>
  );
}
