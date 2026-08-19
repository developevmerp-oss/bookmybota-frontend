"use client";
import { Inter } from "next/font/google";
import { useEffect } from "react";
import "./globals.css";
import { usePathname } from "next/navigation";
import { StoreProvider } from "@/providers/StoreProvider";
import { Toaster } from "sonner";
import HomeHeader from "@/components/LandingPage/HomeHeader";

const inter = Inter({ subsets: ["latin"] });

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
  const isAdminOrBusiness =
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/business") ||
    pathname?.startsWith("/organizer") ||
    pathname?.startsWith("/venue");
  const isLandingPage = pathname === "/";
  const isEventsPublicPage = pathname === "/events" || Boolean(pathname?.startsWith("/events/"));
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";
  const showPublicHeader = !isAdminOrBusiness;
  const showLayoutFooter =
    showPublicHeader && !isLandingPage && !isAuthPage && !isEventsPublicPage;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <html lang="en" className={isAdminOrBusiness ? "admin-theme" : "customer-theme"}>
      <body className={inter.className}>
        <StoreProvider>
          {showPublicHeader && <HomeHeader />}
          <main>
            {children}
            {showLayoutFooter && <Footer />}
          </main>
          <Toaster position="top-center" richColors />
        </StoreProvider>
      </body>
    </html>
  );
}
