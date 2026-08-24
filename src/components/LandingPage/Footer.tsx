"use client";

import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { FaFacebookF, FaInstagram } from "react-icons/fa";
import { useGetPublicEventFiltersQuery } from "@/services/api";

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "Home", href: "/" },
      { label: "About Us", href: "#about" },
      { label: "Contact Us", href: "#contact" },
      { label: "Help Centre", href: "/customer/help" },
    ],
  },
  {
    title: "Events",
    links: [
      { label: "Discover Events", href: "/events" },
      { label: "List your event", href: "/organizer" },
    ],
  },
  {
    title: "Dining",
    links: [
      { label: "Restaurants", href: "/dining" },
      { label: "List restaurant", href: "/business" },
    ],
  },
  {
    title: "Venues & Artists",
    links: [
      { label: "Partner your venue", href: "/venue" },
      { label: "Join as artist", href: "/artist" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/customer/help" },
      { label: "FAQs", href: "/customer/help" },
      { label: "My Bookings", href: "/customer/dashboard" },
      { label: "My Account", href: "/customer/profile" },
    ],
  },
];

export default function Footer() {
  const { data: filters } = useGetPublicEventFiltersQuery();
  const cities = filters?.cities || [];

  return (
    <footer id="contact" className="bg-[#111111] text-white">
      <div className="border-b border-white/10">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-5 lg:px-8 py-6 sm:py-8 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div>
            <p className="type-brand font-semibold">Partner with Book My Bota</p>
            <p className="type-body text-[#B0B0B0] mt-1">
              Events, dining, venues, and artists — grow with one platform.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/organizer"
              className="inline-flex items-center h-10 px-4 rounded-lg bg-[#6900AA] hover:bg-[#57008E] type-body font-medium text-white"
            >
              List your event
            </Link>
            <Link
              href="/business"
              className="inline-flex items-center h-10 px-4 rounded-lg border border-[#6900AA] type-body font-medium text-white hover:bg-white/5"
            >
              List restaurant
            </Link>
            <Link
              href="/venue"
              className="inline-flex items-center h-10 px-4 rounded-lg border border-[#6900AA] text-sm font-medium text-white hover:bg-white/5"
            >
              Partner venue
            </Link>
            <Link
              href="/artist"
              className="inline-flex items-center h-10 px-4 rounded-lg border border-[#6900AA] text-sm font-medium text-white hover:bg-white/5"
            >
              Join as artist
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 md:px-5 lg:px-8 pt-8 sm:pt-10 pb-8">
        <div className="flex flex-wrap gap-6 sm:gap-8">
          <div id="about" className="w-full lg:w-[calc((100%-5*2rem)/6)]">
            <p className="type-brand font-extrabold">
              <span className="text-white">Book My </span>
              <span className="text-[#6900AA]">Bota</span>
            </p>
            <p className="mt-3 type-body text-[#B0B0B0] leading-relaxed">
              Discover events and dining experiences near you.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="text-[#B0B0B0] hover:text-white"
                aria-label="Facebook"
              >
                <FaFacebookF size={16} />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="text-[#B0B0B0] hover:text-white"
                aria-label="Instagram"
              >
                <FaInstagram size={18} />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div
              key={col.title}
              className="w-[calc((100%-1.5rem)/2)] sm:w-[calc((100%-4rem)/3)] lg:w-[calc((100%-5*2rem)/6)]"
            >
              <h4 className="type-label font-semibold text-white mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="type-body text-[#B0B0B0] hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="w-[calc((100%-1.5rem)/2)] sm:w-[calc((100%-4rem)/3)] lg:w-[calc((100%-5*2rem)/6)]">
            <h4 className="type-label font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-3 type-body text-[#B0B0B0]">
              <li className="flex items-start gap-2.5">
                <Phone size={14} className="mt-0.5 shrink-0" />
                +251 9XX XXX XXX
              </li>
              <li className="flex items-start gap-2.5">
                <Mail size={14} className="mt-0.5 shrink-0" />
                info@bookmybota.com
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                Addis Ababa, Ethiopia
              </li>
            </ul>
          </div>
        </div>

        {cities.length > 0 && (
          <div className="mt-10 pt-8 border-t border-white/10">
            <h4 className="type-label font-semibold text-white mb-3">Cities</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {cities.map((city) => (
                <span key={city} className="type-body text-[#B0B0B0]">
                  <Link href={`/events?city=${encodeURIComponent(city)}`} className="hover:text-white">
                    {city} events
                  </Link>
                  <span className="mx-1.5 text-white/20">·</span>
                  <Link href={`/dining?city=${encodeURIComponent(city)}`} className="hover:text-white">
                    dining
                  </Link>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto w-full max-w-7xl px-4 md:px-5 lg:px-8 py-5 text-center type-legal text-[#B0B0B0]">
          © {new Date().getFullYear()} Book My Bota. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
