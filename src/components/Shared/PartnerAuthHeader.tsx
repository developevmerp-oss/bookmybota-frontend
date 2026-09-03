"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import images from "@/Images";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";
import { lockBodyScroll } from "@/lib/lockBodyScroll";
import { homePathForRole, readSessionForRole, type UserRole } from "@/lib/authStorage";

function logoSrc() {
  return typeof images.logo === "string" ? images.logo : images.logo.src;
}

type PartnerLoginConfig = {
  role: Exclude<UserRole, "customer">;
  title: string;
  subtitle: string;
  registerHref: string;
  registerPrompt: string;
  loginHref: string;
};

/** Map public partner register/login routes to the matching partner login. */
export function partnerLoginHrefForPath(pathname: string | null): string {
  return partnerAuthConfigForPath(pathname).loginHref;
}

export function partnerAuthConfigForPath(pathname: string | null): PartnerLoginConfig {
  if (pathname?.startsWith("/business")) {
    return {
      role: "business_admin",
      title: "Dining Admin Login",
      subtitle: "Sign in to manage your restaurant",
      registerHref: "/business/register",
      registerPrompt: "New partner?",
      loginHref: "/business/login",
    };
  }
  if (pathname?.startsWith("/organizer")) {
    return {
      role: "event_admin",
      title: "Event Admin Login",
      subtitle: "Sign in to manage your events",
      registerHref: "/organizer/register",
      registerPrompt: "New organizer?",
      loginHref: "/organizer/login",
    };
  }
  if (pathname?.startsWith("/venue")) {
    return {
      role: "venue_admin",
      title: "Venue Admin Login",
      subtitle: "Sign in to manage your venue",
      registerHref: "/venue/register",
      registerPrompt: "New venue partner?",
      loginHref: "/venue/login",
    };
  }
  if (pathname?.startsWith("/artist")) {
    return {
      role: "artist_admin",
      title: "Artist Admin Login",
      subtitle: "Sign in to manage your artist profile",
      registerHref: "/artist/register",
      registerPrompt: "New artist?",
      loginHref: "/artist/login",
    };
  }
  if (pathname?.startsWith("/movie")) {
    return {
      role: "movie_admin",
      title: "Movie Admin Login",
      subtitle: "Sign in to manage your cinema listings",
      registerHref: "/movie/register",
      registerPrompt: "New cinema partner?",
      loginHref: "/movie/login",
    };
  }
  return {
    role: "event_admin",
    title: "Event Admin Login",
    subtitle: "Sign in to manage your events",
    registerHref: "/organizer/register",
    registerPrompt: "New organizer?",
    loginHref: "/login",
  };
}

/**
 * Minimal public partner auth header (List Your Show style):
 * logo left + Login right — Login opens the partner popup (does not navigate away).
 */
export default function PartnerAuthHeader({ loginHref }: { loginHref?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const config = partnerAuthConfigForPath(pathname);
  const href = loginHref || config.loginHref;
  const [loginOpen, setLoginOpen] = useState(false);
  const onRegisterPage = Boolean(pathname?.includes("/register"));

  const openLogin = () => {
    const session = readSessionForRole(config.role);
    if (session) {
      router.push(homePathForRole(config.role));
      return;
    }
    // Already on a dedicated login page — keep existing page form, no popup.
    if (pathname === href || pathname?.endsWith("/login")) {
      router.push(href);
      return;
    }
    // Password reset pages: use customer/site login (matches "Back to login" on the form).
    if (pathname === "/forgot-password" || pathname === "/reset-password") {
      router.push("/login");
      return;
    }
    setLoginOpen(true);
  };

  useEffect(() => {
    if (!loginOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLoginOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const unlock = lockBodyScroll();
    return () => {
      window.removeEventListener("keydown", onKey);
      unlock();
    };
  }, [loginOpen]);

  return (
    <>
      <header className="sticky top-0 w-full z-50 bg-white border-b border-[#EBEBEB]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center h-[72px]">
            <Link href="/" className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc()}
                alt="Book My Bota"
                className="h-12 sm:h-14 w-auto object-contain object-left"
              />
            </Link>
            <button
              type="button"
              onClick={openLogin}
              className="inline-flex h-9 items-center px-5 rounded-md border border-[#D0D0D0] text-[#333] text-sm font-semibold hover:bg-[#FAFAFA] transition-colors cursor-pointer"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      {loginOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
          data-scroll-lock-container
          onClick={() => setLoginOpen(false)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-auth-header-login-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLoginOpen(false)}
              className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
              aria-label="Close login"
            >
              <X size={18} />
            </button>
            <PartnerLoginForm
              variant="embedded"
              expectedRole={config.role}
              title={config.title}
              titleId="partner-auth-header-login-title"
              subtitle={config.subtitle}
              showCustomerLink={false}
              hint={
                onRegisterPage ? undefined : (
                  <p className="text-[10px] text-slate-400">
                    {config.registerPrompt}{" "}
                    <Link
                      href={config.registerHref}
                      className="text-[#6900AA] font-semibold"
                      onClick={() => setLoginOpen(false)}
                    >
                      Register here
                    </Link>
                  </p>
                )
              }
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
