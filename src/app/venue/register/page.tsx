"use client";

import Footer from "@/components/LandingPage/Footer";
import OrganizerAccountSetupForm from "@/components/EventAdminPanel/OrganizerAccountSetupForm";

export default function VenueRegisterPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] font-sans text-[#111111] overflow-x-hidden">
      <div className="w-full flex justify-center px-4 pt-10 pb-16">
        <OrganizerAccountSetupForm backHref="/venue" module="venue" />
      </div>
      <Footer />
    </div>
  );
}
