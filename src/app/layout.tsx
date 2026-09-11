"use client";
import { Manrope } from "next/font/google";
import { useEffect } from "react";
import "./globals.css";
import { usePathname } from "next/navigation";
import { StoreProvider } from "@/providers/StoreProvider";
import { Toaster } from "sonner";
import HomeHeader from "@/components/LandingPage/HomeHeader";
import PartnerAuthHeader from "@/components/Shared/PartnerAuthHeader";
import { isArtistAdminPath, isMovieAdminPath, isVenueAdminPath } from "@/lib/authStorage";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

function Footer() {
  return (
    <footer className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-sm">B</span>
              </div>
              <span className="text-xl font-black tracking-tight">Book My Bota</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              The smartest way to discover and book tables at the best restaurants, cafes, and bars near you.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-4 text-slate-300 uppercase tracking-wider">
              Company
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              {["About Us", "Blog", "Careers", "Press"].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-white transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-4 text-slate-300 uppercase tracking-wider">
              For Business
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              {["List Your Restaurant", "Business Dashboard", "Partner With Us", "Contact"].map(
                (item) => (
                  <li key={item}>
                    <a href="#" className="hover:text-white transition-colors">
                      {item}
                    </a>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-xs">© 2025 Book My Bota. All rights reserved.</p>
          <div className="flex items-center gap-6">
            {["Privacy Policy", "Terms of Service", "Cookie Policy"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
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
  /** Partner register pages use the minimal logo + Login bar (not customer HomeHeader). */
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
  /** Partner login/register are auth pages (footer hidden; no customer chrome). */
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

  /** Minimal logo + Login bar — not customer HomeHeader (search / category nav). */
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
    ((isArtistAdminPath(pathname || "") && !isArtistRegister && !isArtistLogin) && !isArtistRegister) ||
    ((isVenueAdminPath(pathname || "") && !isVenueRegister) && !isVenueRegister && !isVenueLogin) ||
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
  const hidePublicChromeForMovieBooking = isMovieBookFlow || isMovieConfirmationFlow;
  /** Full-viewport lock only for seat/review booking — confirmation must scroll so the full ticket shows */
  const isImmersiveBookingFlow = isEventBookingFlow || isMovieBookFlow;
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
    // Confirmation (and other pages) must scroll — clear any leftover lock from seat/review
    document.documentElement.classList.remove("overflow-hidden");
    document.body.classList.remove("overflow-hidden");
  }, [isImmersiveBookingFlow]);

  return (
    <html lang="en" className={isAdminOrBusiness ? "admin-theme" : "customer-theme"}>
      <body className={`${manrope.className} ${manrope.variable}`}>
        <StoreProvider>
          {showPartnerAuthHeader ? <PartnerAuthHeader /> : showPublicHeader ? <HomeHeader /> : null}
          <main className={isImmersiveBookingFlow ? "h-[100dvh] max-h-[100dvh] overflow-hidden" : undefined}>
            {children}
            {showLayoutFooter && <Footer />}
          </main>
          <Toaster position="top-center" richColors />
        </StoreProvider>
      </body>
    </html>
  );
}
