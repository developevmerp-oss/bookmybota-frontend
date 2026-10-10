"use client";

import { Suspense, useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { StoreProvider } from "@/providers/StoreProvider";
import { Toaster } from "sonner";
import HomeHeader from "@/components/LandingPage/HomeHeader";
import Footer from "@/components/LandingPage/Footer";
import PartnerAuthHeader from "@/components/Shared/PartnerAuthHeader";
import NetworkStatusOverlay from "@/components/Shared/NetworkStatusOverlay";
import { isArtistAdminPath, isMovieAdminPath, isVenueAdminPath } from "@/lib/authStorage";

export default function RootLayoutClient({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  const isOrganizerRegister = pathname === "/organizer/register";
  const isVenueRegister = pathname === "/venue/register";
  const isArtistRegister = pathname === "/artist/register";
  const isBusinessRegister = pathname === "/business/register";
  const isMovieRegister = pathname === "/movie/register";
  const isPartnerRegisterPage =
    isOrganizerRegister ||
    isVenueRegister ||
    isArtistRegister ||
    isBusinessRegister ||
    isMovieRegister;
  const isVenueLogin = pathname === "/venue/login";
  const isArtistLogin = pathname === "/artist/login";
  const isMovieLogin = pathname === "/movie/login";
  const isBusinessLogin = pathname === "/business/login";
  const isOrganizerLogin = pathname === "/organizer/login";
  const isAdminLogin = pathname === "/admin/login";
  const isPartnerPublicAuth =
    isOrganizerRegister ||
    isVenueRegister ||
    isArtistRegister ||
    isMovieRegister ||
    isVenueLogin ||
    isArtistLogin ||
    isMovieLogin ||
    isOrganizerLogin ||
    isAdminLogin ||
    isBusinessLogin;

  const isPasswordAuthPage =
    pathname === "/forgot-password" || pathname === "/reset-password";
  const isPartnerLoginPage =
    isBusinessLogin ||
    isOrganizerLogin ||
    isVenueLogin ||
    isArtistLogin ||
    isMovieLogin ||
    isAdminLogin;
  const isPartnerMinimalHeaderPage =
    isPartnerRegisterPage || isPasswordAuthPage || isPartnerLoginPage;

  const isAdminOrBusiness =
    (Boolean(pathname?.startsWith("/admin")) && !isAdminLogin) ||
    (Boolean(pathname?.startsWith("/business")) && !isBusinessRegister && !isBusinessLogin) ||
    (isArtistAdminPath(pathname || "") && !isArtistRegister && !isArtistLogin) ||
    (isVenueAdminPath(pathname || "") && !isVenueRegister && !isVenueLogin) ||
    (isMovieAdminPath(pathname || "") && !isMovieRegister && !isMovieLogin) ||
    (Boolean(pathname?.startsWith("/organizer")) && !isOrganizerRegister && !isOrganizerLogin);

  const isLandingPage = pathname === "/";
  const isEventsPublicPage = pathname === "/events" || Boolean(pathname?.startsWith("/events/"));
  const isOrganizerMarketingPage = isOrganizerRegister;
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/admin/login" ||
    pathname === "/business/login" ||
    pathname === "/organizer/login" ||
    pathname === "/movie/login" ||
    pathname === "/venue/login" ||
    pathname === "/artist/login" ||
    isPartnerRegisterPage ||
    isPartnerPublicAuth;
  const isEventBookingFlow = Boolean(pathname?.match(/^\/events\/[^/]+\/book\/?$/));
  const isMovieBookFlow = Boolean(pathname?.match(/^\/movies\/book(\/|$)/));
  const isMovieConfirmationFlow = Boolean(
    pathname?.match(/^\/movies\/booking-confirmation(\/|$)/)
  );
  const isPaymentSuccessFlow = Boolean(
    pathname?.match(/^\/booking\/payment-success(\/|$)/)
  );
  const hidePublicChromeForMovieBooking =
    isMovieBookFlow || isMovieConfirmationFlow || isPaymentSuccessFlow;
  const isImmersiveBookingFlow =
    isEventBookingFlow || isMovieBookFlow || isPaymentSuccessFlow;
  const isListYourShowLanding = pathname === "/list-your-show";
  const isListYourShowSubpage = Boolean(pathname?.startsWith("/list-your-show/"));
  const isListYourShowPage = isListYourShowLanding || isListYourShowSubpage;
  const showPublicHeader =
    !isAdminOrBusiness &&
    !isImmersiveBookingFlow &&
    !hidePublicChromeForMovieBooking &&
    !isListYourShowSubpage &&
    !isPartnerMinimalHeaderPage;
  const showPartnerAuthHeader = isPartnerMinimalHeaderPage;
  const showLayoutFooter =
    showPublicHeader &&
    !isLandingPage &&
    !isAuthPage &&
    !isEventsPublicPage &&
    !isOrganizerMarketingPage &&
    !isListYourShowPage &&
    !hidePublicChromeForMovieBooking;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("admin-theme", isAdminOrBusiness);
    root.classList.toggle("customer-theme", !isAdminOrBusiness);
  }, [isAdminOrBusiness]);

  // Before paint so HomeHeader compact sticky chrome doesn't flash from prior scroll.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    if (isImmersiveBookingFlow) {
      document.documentElement.classList.add("overflow-hidden");
      document.body.classList.add("overflow-hidden");
      return () => {
        document.documentElement.classList.remove("overflow-hidden");
        document.body.classList.remove("overflow-hidden");
      };
    }
    document.documentElement.classList.remove("overflow-hidden");
    document.body.classList.remove("overflow-hidden");
  }, [isImmersiveBookingFlow]);

  return (
    <StoreProvider>
      {showPartnerAuthHeader ? (
        <Suspense fallback={<div className="h-[64px] sm:h-[72px] border-b border-[#EBEBEB] bg-white" />}>
          <PartnerAuthHeader />
        </Suspense>
      ) : showPublicHeader ? (
        <HomeHeader />
      ) : null}
      <main className={isImmersiveBookingFlow ? "h-[100dvh] max-h-[100dvh] overflow-hidden" : undefined}>
        {children}
        {showLayoutFooter && <Footer />}
      </main>
      <Toaster position="top-center" richColors />
      <NetworkStatusOverlay />
    </StoreProvider>
  );
}
