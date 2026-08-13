"use client";

import Link from "next/link";
import {
  FaEnvelope,
  FaFacebookF,
  FaInstagram,
  FaMapMarkerAlt,
  FaPhoneAlt,
  FaTelegramPlane,
} from "react-icons/fa";
import { FaTiktok } from "react-icons/fa6";

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "Home", href: "/" },
      { label: "About Us", href: "#about" },
      { label: "Contact Us", href: "#contact" },
      { label: "Careers", href: "#contact" },
      { label: "Blog", href: "/" },
    ],
  },
  {
    title: "Events",
    links: [
      { label: "Discover Events", href: "/events" },
      { label: "Categories", href: "/events" },
      { label: "Venues", href: "/events" },
      { label: "Organizers", href: "/organizer" },
      { label: "Event Guide", href: "/events" },
    ],
  },
  {
    title: "Dining",
    links: [
      { label: "Restaurants", href: "/dining" },
      { label: "Cafés", href: "/dining" },
      { label: "Bars", href: "/dining" },
      { label: "Offers", href: "/dining" },
      { label: "Dining Guide", href: "/dining" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", href: "/customer/help" },
      { label: "FAQs", href: "/customer/help" },
      { label: "Terms & Conditions", href: "/customer/help" },
      { label: "Privacy Policy", href: "/customer/help" },
      { label: "Contact Support", href: "#contact" },
    ],
  },
];

export default function Footer() {
  return (
    <footer id="contact" className="bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-6">
          <div id="about" className="col-span-2 sm:col-span-3 lg:col-span-1">
            <p className="text-xl font-extrabold leading-tight">
              <span className="text-[#2ea44f]">Book My </span>
              <span className="text-[#C9A227]">Bota</span>
            </p>
            <p className="text-xs font-medium text-white mt-1">Events &amp; Dining</p>
            <p className="mt-4 text-sm text-white/80 leading-relaxed">
              Your ultimate platform to discover amazing events and dining experiences across
              Ethiopia.
            </p>
            <div className="flex items-center gap-2.5 mt-5">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-[#1877F2] flex items-center justify-center hover:opacity-90"
                aria-label="Facebook"
              >
                <FaFacebookF size={14} />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] flex items-center justify-center hover:opacity-90"
                aria-label="Instagram"
              >
                <FaInstagram size={14} />
              </a>
              <a
                href="https://www.tiktok.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-zinc-900 border border-white/20 flex items-center justify-center hover:opacity-90"
                aria-label="TikTok"
              >
                <FaTiktok size={13} />
              </a>
              <a
                href="https://t.me"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-full bg-[#229ED9] flex items-center justify-center hover:opacity-90"
                aria-label="Telegram"
              >
                <FaTelegramPlane size={14} />
              </a>
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-bold text-white mb-4">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/80 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="text-sm font-bold text-white mb-4">Contact</h4>
            <ul className="space-y-3 text-sm text-white/80">
              <li className="flex items-start gap-2.5">
                <FaPhoneAlt size={13} className="mt-0.5 shrink-0 text-white" />
                +251 9XX XXX XXX
              </li>
              <li className="flex items-start gap-2.5">
                <FaEnvelope size={13} className="mt-0.5 shrink-0 text-white" />
                info@bookmybota.com
              </li>
              <li className="flex items-start gap-2.5">
                <FaMapMarkerAlt size={13} className="mt-0.5 shrink-0 text-white" />
                Addis Ababa, Ethiopia
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
