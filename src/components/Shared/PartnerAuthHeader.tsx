"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import images from "@/Images";

function logoSrc() {
  return typeof images.logo === "string" ? images.logo : images.logo.src;
}

/** Map public partner register routes to the matching partner login. */
export function partnerLoginHrefForPath(pathname: string | null): string {
  if (!pathname) return "/login";
  if (pathname.startsWith("/business")) return "/business/login";
  if (pathname.startsWith("/organizer")) return "/organizer/login";
  if (pathname.startsWith("/venue")) return "/venue/login";
  if (pathname.startsWith("/artist")) return "/artist/login";
  if (pathname.startsWith("/movie")) return "/movie/login";
  return "/login";
}

/**
 * Minimal public partner auth header (List Your Show style):
 * logo left + Login right — no search, city, or purple subnav.
 */
export default function PartnerAuthHeader({ loginHref }: { loginHref?: string }) {
  const pathname = usePathname();
  const href = loginHref || partnerLoginHrefForPath(pathname);

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
          <Link
            href={href}
            className="inline-flex h-9 items-center px-5 rounded-md border border-[#D0D0D0] text-[#333] text-sm font-semibold hover:bg-[#FAFAFA] transition-colors"
          >
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}
