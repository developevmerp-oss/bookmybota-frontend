"use client";

import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { FaFacebookF, FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa";
import images from "@/Images";

const CONTAINER = "bmb-section-container";

const logoOnDarkSrc =
  typeof images.logoOnDark === "string" ? images.logoOnDark : images.logoOnDark.src;

const PARTNER_CTAS: Array<{ label: string; href: string; primary?: boolean }> = [
  { label: "List your event", href: "/list-your-show/events", primary: true },
  { label: "List restaurant", href: "/list-your-show/dining" },
  { label: "Partner venue", href: "/list-your-show/venue" },
  { label: "Join as artist", href: "/list-your-show/artist" },
  { label: "List cinema", href: "/list-your-show/movie" },
];

const COLUMNS = [
  {
    title: "Movies",
    links: [
      { label: "Now Showing", href: "/movies" },
      { label: "Browse Cinemas", href: "/movies/cinemas" },
      { label: "Gift Cards", href: "/gift-cards" },
      { label: "List your cinema", href: "/list-your-show/movie" },
    ],
  },
  {
    title: "Events",
    links: [
      { label: "Discover Events", href: "/events" },
      { label: "Venues", href: "/venues" },
      { label: "Artists", href: "/artists" },
      { label: "List your event", href: "/list-your-show/events" },
    ],
  },
  {
    title: "Dining",
    links: [
      { label: "Restaurants", href: "/dining" },
      { label: "List restaurant", href: "/list-your-show/dining" },
    ],
  },
  {
    title: "Partners",
    links: [
      { label: "Partner your venue", href: "/list-your-show/venue" },
      { label: "Join as artist", href: "/list-your-show/artist" },
      { label: "List Your Show", href: "/list-your-show" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Centre", href: "/customer/help" },
      { label: "My Bookings", href: "/customer/dashboard" },
      { label: "My Gift Cards", href: "/customer/gift-cards" },
      { label: "My Account", href: "/customer/profile" },
      { label: "About Us", href: "/#about" },
      { label: "Contact Us", href: "/#contact" },
    ],
  },
] as const;

const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://facebook.com", Icon: FaFacebookF },
  { label: "Instagram", href: "https://instagram.com", Icon: FaInstagram },
  { label: "YouTube", href: "https://youtube.com", Icon: FaYoutube },
  { label: "TikTok", href: "https://tiktok.com", Icon: FaTiktok },
] as const;

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "Movies", href: "/movies" },
  { label: "Events", href: "/events" },
  { label: "Dining", href: "/dining" },
  { label: "Gift Cards", href: "/gift-cards" },
] as const;

export default function Footer() {
  return (
    <footer id="contact" className="bg-[#0B0B0B] text-white">
      {/* Partner CTA */}
      <div className="border-b border-white/10 bg-[#141414]">
        <div className={`${CONTAINER} py-7 sm:py-8`}>
          <div className="flex flex-col gap-5">
            <div className="max-w-2xl">
              <p className="text-lg sm:text-xl font-semibold tracking-tight text-white">
                Partner with Book My Bota
              </p>
              <p className="mt-1.5 text-sm text-[#A3A3A3] leading-relaxed">
                Movies, events, dining, venues, and artists — grow with one platform.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {PARTNER_CTAS.map((cta) => (
                <Link
                  key={cta.href}
                  href={cta.href}
                  className={
                    cta.primary
                      ? "inline-flex h-10 items-center justify-center rounded-full bg-[#6900AA] px-4 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(105,0,170,0.35)] transition-colors hover:bg-[#57008E]"
                      : "inline-flex h-10 items-center justify-center rounded-full border border-white/20 bg-transparent px-4 text-sm font-medium text-white transition-colors hover:border-[#6900AA] hover:bg-[#6900AA]/15"
                  }
                >
                  {cta.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className={`${CONTAINER} py-10 sm:py-12`}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Brand */}
          <div id="about" className="lg:col-span-4 xl:col-span-3">
            <Link href="/" className="inline-flex" aria-label="Book My Bota home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoOnDarkSrc}
                alt="Book My Bota"
                className="h-12 w-auto max-w-[220px] object-contain object-left"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#A3A3A3]">
              Book movies, events, and dining experiences across Ethiopia.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[#D4D4D4] transition-colors hover:border-[#6900AA]/50 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-2.5">
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#D4D4D4] transition-colors hover:border-[#6900AA]/60 hover:bg-[#6900AA]/20 hover:text-white"
                  aria-label={label}
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>

            <div className="mt-7 space-y-3 text-sm text-[#A3A3A3]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
                Contact
              </p>
              <a
                href="tel:+251900000000"
                className="flex items-center gap-2.5 transition-colors hover:text-white"
              >
                <Phone size={14} className="shrink-0 text-[#6900AA]" />
                +251 9XX XXX XXX
              </a>
              <a
                href="mailto:info@bookmybota.com"
                className="flex items-center gap-2.5 transition-colors hover:text-white"
              >
                <Mail size={14} className="shrink-0 text-[#6900AA]" />
                info@bookmybota.com
              </a>
              <p className="flex items-center gap-2.5">
                <MapPin size={14} className="shrink-0 text-[#6900AA]" />
                Addis Ababa, Ethiopia
              </p>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-5 lg:col-span-8 xl:col-span-9">
            {COLUMNS.map((col) => (
              <div key={col.title} className="min-w-0">
                <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                  {col.title}
                </h4>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={`${col.title}-${link.label}`}>
                      <Link
                        href={link.href}
                        className="text-sm text-[#A3A3A3] transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div
          className={`${CONTAINER} flex flex-col items-center justify-between gap-3 py-5 sm:flex-row`}
        >
          <p className="text-center text-xs text-[#737373] sm:text-left">
            © {new Date().getFullYear()} Book My Bota. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-[#737373]">
            <Link href="/customer/help" className="transition-colors hover:text-white">
              Help
            </Link>
            <span className="hidden text-white/20 sm:inline" aria-hidden>
              |
            </span>
            <Link href="/gift-cards" className="transition-colors hover:text-white">
              Gift Cards
            </Link>
            <span className="hidden text-white/20 sm:inline" aria-hidden>
              |
            </span>
            <Link href="/list-your-show" className="transition-colors hover:text-white">
              List Your Show
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
