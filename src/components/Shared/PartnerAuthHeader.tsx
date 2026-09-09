"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import images from "@/Images";
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
 * logo left + Login right — navigates to the partner login page.
 */
export default function PartnerAuthHeader({ loginHref }: { loginHref?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const config = partnerAuthConfigForPath(pathname);
  const href = loginHref || config.loginHref;

  const openLogin = () => {
    const session = readSessionForRole(config.role);
    if (session) {
      router.push(homePathForRole(config.role));
      return;
    }
    if (pathname === "/forgot-password" || pathname === "/reset-password") {
      router.push("/login");
      return;
    }
    router.push(href);
  };

  return (
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
  );
}
