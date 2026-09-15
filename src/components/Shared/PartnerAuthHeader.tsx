"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import images from "@/Images";
import { homePathForRole, readSessionForRole, type UserRole } from "@/lib/authStorage";

function logoSrc() {
  return typeof images.logo === "string" ? images.logo : images.logo.src;
}

/** Allowed partner login destinations for forgot/reset "Back to login". */
export const PARTNER_LOGIN_HREFS = [
  "/business/login",
  "/organizer/login",
  "/movie/login",
  "/venue/login",
  "/artist/login",
  "/admin/login",
] as const;

export function resolvePartnerLoginHref(from: string | null | undefined): string {
  const value = (from || "").trim();
  if ((PARTNER_LOGIN_HREFS as readonly string[]).includes(value)) return value;
  return "/business/login";
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
      title: "Dining Login",
      subtitle: "Sign in to manage your restaurant",
      registerHref: "/business/register",
      registerPrompt: "New dining partner?",
      loginHref: "/business/login",
    };
  }
  if (pathname?.startsWith("/organizer")) {
    return {
      role: "event_admin",
      title: "Event Login",
      subtitle: "Sign in to create and manage your events",
      registerHref: "/organizer/register",
      registerPrompt: "New organizer?",
      loginHref: "/organizer/login",
    };
  }
  if (pathname?.startsWith("/venue")) {
    return {
      role: "venue_admin",
      title: "Venue Login",
      subtitle: "Sign in to manage your venue",
      registerHref: "/venue/register",
      registerPrompt: "New venue partner?",
      loginHref: "/venue/login",
    };
  }
  if (pathname?.startsWith("/artist")) {
    return {
      role: "artist_admin",
      title: "Artist Login",
      subtitle: "Sign in to manage your artist profile",
      registerHref: "/artist/register",
      registerPrompt: "New artist?",
      loginHref: "/artist/login",
    };
  }
  if (pathname?.startsWith("/movie")) {
    return {
      role: "movie_admin",
      title: "Movie Login",
      subtitle: "Sign in to manage your cinema listings",
      registerHref: "/movie/register",
      registerPrompt: "New cinema partner?",
      loginHref: "/movie/login",
    };
  }
  return {
    role: "event_admin",
    title: "Event Login",
    subtitle: "Sign in to create and manage your events",
    registerHref: "/organizer/register",
    registerPrompt: "New organizer?",
    loginHref: "/organizer/login",
  };
}

/**
 * Minimal public partner auth header:
 * logo left + Login right — Login hidden on partner login pages (already on login).
 */
export default function PartnerAuthHeader({ loginHref }: { loginHref?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const config = partnerAuthConfigForPath(pathname);
  const fromParam = searchParams.get("from");
  const isPartnerLoginPage = (PARTNER_LOGIN_HREFS as readonly string[]).includes(pathname || "");
  const href =
    loginHref ||
    (pathname === "/forgot-password" || pathname === "/reset-password"
      ? resolvePartnerLoginHref(fromParam)
      : config.loginHref);

  const openLogin = () => {
    // On password pages, always return to the partner login (never customer /login).
    if (pathname === "/forgot-password" || pathname === "/reset-password") {
      router.push(href);
      return;
    }
    const session = readSessionForRole(config.role);
    if (session) {
      router.push(homePathForRole(config.role));
      return;
    }
    router.push(href);
  };

  return (
    <header className="sticky top-0 w-full z-50 bg-white border-b border-[#EBEBEB]">
      <div className="mx-auto w-full px-3 sm:px-4 md:px-5 lg:px-8">
        <div
          className={`flex items-center h-[64px] sm:h-[72px] ${
            isPartnerLoginPage ? "justify-start" : "justify-between"
          }`}
        >
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoSrc()}
              alt="Book My Bota"
              className="h-11 sm:h-14 w-auto object-contain object-left"
            />
          </Link>
          {!isPartnerLoginPage && (
            <button
              type="button"
              onClick={openLogin}
              className="inline-flex h-9 items-center px-5 rounded-md border border-[#D0D0D0] text-[#333] text-sm font-semibold hover:bg-[#FAFAFA] transition-colors cursor-pointer"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
