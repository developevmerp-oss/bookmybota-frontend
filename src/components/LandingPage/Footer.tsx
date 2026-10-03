"use client";

import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { FaFacebookF, FaInstagram } from "react-icons/fa";

const CONTAINER = "container mx-auto px-5 sm:px-10 lg:px-10 2xl:px-0";

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
      { label: "List your cinema", href: "/movie" },
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
  return (
    <footer id="contact" className="bg-[#111111] text-white">
      <div className="border-b border-white/10">
        <div
          className={`${CONTAINER} py-6 sm:py-8 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8 justify-between`}
        >
          <div className="min-w-0 shrink">
            <p className="type-brand font-semibold">Partner with Book My Bota</p>
            <p className="type-body text-[#B0B0B0] mt-1">
              Events, dining, venues, and artists — grow with one platform.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 sm:gap-3">
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
            <Link
              href="/movie"
              className="inline-flex items-center h-10 px-4 rounded-lg border border-[#6900AA] text-sm font-medium text-white hover:bg-white/5"
            >
              List cinema
            </Link>
          </div>
        </div>
      </div>

      <div className={`${CONTAINER} pt-8 sm:pt-10 pb-8`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-8">
          <div id="about" className="col-span-2 sm:col-span-3 lg:col-span-1">
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

            <h4 className="type-label font-semibold text-white mt-6 mb-3">Contact</h4>
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

          {COLUMNS.map((col) => (
            <div key={col.title}>
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
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className={`${CONTAINER} py-5 text-center type-legal text-[#B0B0B0]`}>
          © {new Date().getFullYear()} Book My Bota. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
