"use client";

import Link from "next/link";
import { FaFacebookF, FaInstagram, FaEnvelope, FaMapMarkerAlt, FaPhoneAlt, FaTelegramPlane } from "react-icons/fa";

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "Home", href: "/" },
      { label: "Events", href: "/events" },
      { label: "Dining", href: "/dining" },
      { label: "Collections", href: "/collections" },
    ],
  },
  {
    title: "Events",
    links: [
      { label: "Upcoming Events", href: "/events" },
      { label: "Music", href: "/events" },
      { label: "Organizer Portal", href: "/organizer" },
      { label: "List an Event", href: "/register" },
    ],
  },
  {
    title: "Dining",
    links: [
      { label: "Restaurants", href: "/dining" },
      { label: "Cafes & Bars", href: "/dining" },
      { label: "Partner with Us", href: "/business" },
      { label: "Business Dashboard", href: "/business" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/customer/help" },
      { label: "My Bookings", href: "/customer/dashboard" },
      { label: "Login", href: "/login" },
      { label: "Register", href: "/register" },
    ],
  },
];

export default function Footer() {
  return (
    <footer id="contact" className="bg-[#0d1f17] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          <div className="col-span-2">
            <div id="about">
              <p className="text-xl font-extrabold text-white">Book My Bota</p>
              <p className="text-xs font-semibold tracking-wide text-[#C9A227] mt-0.5">
                Events &amp; Dining
              </p>
              <p className="mt-4 text-sm text-white/70 leading-relaxed max-w-xs">
                Discover and book the best events, restaurants, cafes and bars across Ethiopia —
                all in one place.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-5">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-[#1877F2] flex items-center justify-center hover:opacity-90"
                aria-label="Facebook"
              >
                <FaFacebookF size={16} />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center hover:opacity-90"
                aria-label="Instagram"
              >
                <FaInstagram size={16} />
              </a>
              <a
                href="https://www.tiktok.com"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-black border border-white/20 flex items-center justify-center text-xs font-bold hover:opacity-90"
                aria-label="TikTok"
              >
                TT
              </a>
              <a
                href="https://t.me"
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-[#229ED9] flex items-center justify-center hover:opacity-90"
                aria-label="Telegram"
              >
                <FaTelegramPlane size={15} />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white/90 mb-4">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/60 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="text-sm font-semibold text-white/90 mb-4">Contact</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-2">
                <FaPhoneAlt size={15} className="mt-0.5 shrink-0 text-[#C9A227]" />
                +251 11 123 4567
              </li>
              <li className="flex items-start gap-2">
                <FaEnvelope size={15} className="mt-0.5 shrink-0 text-[#C9A227]" />
                hello@bookmybota.com
              </li>
              <li className="flex items-start gap-2">
                <FaMapMarkerAlt size={15} className="mt-0.5 shrink-0 text-[#C9A227]" />
                Bole, Addis Ababa, Ethiopia
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="max-w-7xl mx-auto px-4 py-5 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Book My Bota. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
