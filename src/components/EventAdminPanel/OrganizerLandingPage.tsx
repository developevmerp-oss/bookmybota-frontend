"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Calculator,
  CalendarDays,
  Guitar,
  Handshake,
  Info,
  Mic2,
  PartyPopper,
  QrCode,
  Rocket,
  Smartphone,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";
import Footer from "@/components/LandingPage/Footer";
import { homePathForRole, readSessionForRole } from "@/lib/authStorage";
import images from "@/Images";

const BRAND = "#6900AA";
const BRAND_SOFT = "#F7E9FF";
const BRAND_SOFT_2 = "#EFD7FF";
const INK = "#111111";

function logoSrc() {
  return typeof images.logo === "string" ? images.logo : images.logo.src;
}

const FEATURE_SLIDES = [
  {
    id: "scan",
    title: "Ticket scanning made easy",
    description: "Experience the ease of managing entry at an event with QR check-in on any phone.",
    image:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&q=80",
    tone: "from-[#2a1040] via-[#3d1860] to-[#1a0a28]",
  },
  {
    id: "mticket",
    title: "Take advantage of our M-ticket feature",
    description: "Let your audience skip the box office queue and head straight to the gate.",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&q=80",
    tone: "from-[#4a1a6b] via-[#6900AA] to-[#3a0f55]",
  },
  {
    id: "dashboard",
    title: "Run every show from one dashboard",
    description: "Create events, manage bookings, track sales, and publish with confidence.",
    image:
      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&q=80",
    tone: "from-[#1e1433] via-[#2d1b4e] to-[#120a22]",
  },
  {
    id: "insights",
    title: "Reports & business insights",
    description: "See what’s selling, who’s buying, and how your event is performing in real time.",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80",
    tone: "from-[#3b1460] via-[#57008E] to-[#2a0d45]",
  },
  {
    id: "support",
    title: "On-ground support when you need it",
    description: "From gate entry to audience experience, we’re equipped to bring your vision to life.",
    image:
      "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=900&q=80",
    tone: "from-[#241038] via-[#4c1d75] to-[#1a0b2a]",
  },
];

const HOST_CATEGORIES = [
  {
    label: "Performances",
    description: "Concerts, live music, theatre, comedy, and stage shows.",
    Icon: Guitar,
  },
  {
    label: "Experiences",
    description: "Workshops, festivals, immersive nights, and pop-up experiences.",
    Icon: PartyPopper,
  },
  {
    label: "Expositions",
    description: "Exhibitions, art shows, fairs, and cultural showcases.",
    Icon: BookOpen,
  },
  {
    label: "Parties",
    description: "Club nights, private parties, and celebration events.",
    Icon: Mic2,
  },
  {
    label: "Sports",
    description: "Tournaments, matches, fitness meets, and sporting spectacles.",
    Icon: CalendarDays,
  },
  {
    label: "Conferences",
    description: "Talks, summits, corporate meets, and community gatherings.",
    Icon: Building2,
  },
];

const SERVICES = [
  {
    label: "Online Sales & Marketing",
    description: "Reach Book My Bota audiences with listings, discovery, and promotions.",
    Icon: Rocket,
  },
  {
    label: "Pricing",
    description: "Flexible ticket tiers, offers, and custom pricing for every show.",
    Icon: Calculator,
  },
  {
    label: "Food & beverages, stalls and the works!",
    description: "Coordinate F&B, stalls, and add-ons alongside your ticket sales.",
    Icon: Truck,
  },
  {
    label: "On ground support & gate entry management",
    description: "Smooth check-in with scanning tools and operational support.",
    Icon: Handshake,
  },
  {
    label: "Reports & business insights",
    description: "Track sales, attendance signals, and performance in one place.",
    Icon: BarChart3,
  },
  {
    label: "POS, RFID, Turnstiles & more...",
    description: "Modern entry tech so guests move from ticket to seat faster.",
    Icon: Smartphone,
  },
];

function InfoHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex justify-center">
      <button
        type="button"
        aria-label="More info"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="mt-4 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#6900AA] text-[#6900AA] hover:bg-[#F7E9FF] transition-colors cursor-pointer"
      >
        <Info size={14} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 z-20 w-56 rounded-xl bg-[#111111] text-white text-xs leading-relaxed px-3 py-2 shadow-lg">
          {text}
        </div>
      )}
    </div>
  );
}

export default function OrganizerLandingPage() {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (!loginOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLoginOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [loginOpen]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSlide((s) => (s + 1) % FEATURE_SLIDES.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, []);

  const openLogin = () => {
    const session = readSessionForRole("event_admin");
    if (session) {
      router.push(homePathForRole("event_admin"));
      return;
    }
    setLoginOpen(true);
  };

  const goPrev = useCallback(() => {
    setSlide((s) => (s - 1 + FEATURE_SLIDES.length) % FEATURE_SLIDES.length);
  }, []);

  const goNext = useCallback(() => {
    setSlide((s) => (s + 1) % FEATURE_SLIDES.length);
  }, []);

  const active = FEATURE_SLIDES[slide];

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans text-[#111111] overflow-x-hidden">
      <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center min-h-20 py-2">
            <Link href="/" className="flex items-center gap-2 group">
              <img
                src={logoSrc()}
                alt="Book My Bota"
                className="h-15 xl:h-20 pt-2 w-auto object-contain object-left group-hover:opacity-90 transition-opacity"
              />
            </Link>
            <button
              type="button"
              onClick={openLogin}
              className="px-5 py-2 rounded-full border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 hover:text-slate-900 transition-all text-sm cursor-pointer"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      <div className="pt-28">
        <section className="relative bg-[#0f0a16] overflow-hidden">
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top,_rgba(105,0,170,0.45),_transparent_55%)]" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
            <div className="flex items-center gap-3 md:gap-5">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous feature"
                className="shrink-0 hidden sm:flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/15 cursor-pointer transition-colors"
              >
                <ArrowLeft size={20} />
              </button>

              <div
                className={`relative flex-1 min-h-[320px] md:min-h-[360px] rounded-2xl overflow-hidden bg-gradient-to-br ${active.tone} shadow-[0_20px_60px_rgba(0,0,0,0.45)] transition-all duration-500`}
              >
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-35"
                  style={{ backgroundImage: `url(${active.image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/45 to-transparent" />
                <div className="relative z-10 h-full flex flex-col md:flex-row items-stretch">
                  <div className="flex-1 p-8 md:p-12 flex flex-col justify-center max-w-xl">
                    <p className="text-[#E3BCFF] text-xs font-semibold uppercase tracking-[0.2em] mb-3">
                      For event organizers
                    </p>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight tracking-tight">
                      {active.title}
                    </h1>
                    <p className="mt-4 text-white/80 text-sm md:text-base leading-relaxed">
                      {active.description}
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <a
                        href="#services"
                        className="text-sm font-semibold text-white underline underline-offset-4 decoration-white/40 hover:decoration-white"
                      >
                        Know More
                      </a>
                      <Link
                        href="/organizer/register"
                        className="inline-flex items-center justify-center h-11 px-5 rounded-lg bg-white text-[#6900AA] font-bold text-sm hover:bg-[#F7E9FF] transition-colors"
                      >
                        Contact us today
                      </Link>
                    </div>
                  </div>
                  <div className="hidden md:block w-[42%] relative">
                    <div
                      className="absolute inset-4 rounded-xl bg-cover bg-center shadow-2xl border border-white/10"
                      style={{ backgroundImage: `url(${active.image})` }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={goNext}
                aria-label="Next feature"
                className="shrink-0 hidden sm:flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/15 cursor-pointer transition-colors"
              >
                <ArrowRight size={20} />
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2">
              {FEATURE_SLIDES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setSlide(i)}
                  className={`h-2.5 rounded-full transition-all cursor-pointer ${
                    i === slide ? "w-7 bg-white" : "w-2.5 bg-white/35 hover:bg-white/55"
                  }`}
                />
              ))}
            </div>

            <div className="mt-8 flex justify-center sm:hidden gap-3">
              <button
                type="button"
                onClick={goPrev}
                className="h-10 w-10 rounded-full bg-white/10 text-white border border-white/15 cursor-pointer"
                aria-label="Previous"
              >
                <ArrowLeft size={18} className="mx-auto" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="h-10 w-10 rounded-full bg-white/10 text-white border border-white/15 cursor-pointer"
                aria-label="Next"
              >
                <ArrowRight size={18} className="mx-auto" />
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: INK }}>
              What can you host???
            </h2>
            <p className="mt-4 text-sm md:text-base text-[#5c5c5c] leading-relaxed max-w-3xl mx-auto">
              As the home for entertainment in your city, Book My Bota enables your event with
              end-to-end solutions from the time you register to the completion of the event. Let’s
              look at what you can host.
            </p>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {HOST_CATEGORIES.map(({ label, description, Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[#E3BCFF] px-6 py-10 flex flex-col items-center"
                  style={{ backgroundColor: BRAND_SOFT }}
                >
                  <Icon size={40} strokeWidth={1.5} className="text-[#111111]" />
                  <p className="mt-5 text-lg font-bold text-[#111111]">{label}</p>
                  <InfoHint text={description} />
                </div>
              ))}
            </div>

            <div className="mt-12">
              <Link
                href="/organizer/register"
                className="inline-flex items-center justify-center h-12 px-10 rounded-xl bg-[#6900AA] hover:bg-[#57008E] text-white font-bold text-base shadow-[0_8px_24px_rgba(105,0,170,0.28)] transition-colors"
                style={{ backgroundColor: BRAND }}
              >
                List your event
              </Link>
            </div>
          </div>
        </section>

        <section id="services" className="bg-[#faf7fc] py-16 md:py-20 scroll-mt-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: INK }}>
              What are the services we offer?
            </h2>
            <p className="mt-4 text-sm md:text-base text-[#5c5c5c] leading-relaxed max-w-3xl mx-auto">
              After collaborating with event organisers across dining nights, concerts, and
              conferences, we’re well equipped to bring your vision to life.
            </p>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {SERVICES.map(({ label, description, Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[#EFD7FF] px-6 py-10 flex flex-col items-center shadow-[0_8px_24px_rgba(105,0,170,0.06)]"
                  style={{ backgroundColor: BRAND_SOFT_2 }}
                >
                  <Icon size={40} strokeWidth={1.5} className="text-[#111111]" />
                  <p className="mt-5 text-base font-bold text-[#111111] leading-snug">{label}</p>
                  <InfoHint text={description} />
                </div>
              ))}
            </div>

            <p className="mt-12 text-sm md:text-base text-[#444] leading-relaxed max-w-3xl mx-auto">
              Apart from these must-haves for any event, we also support a host of other services
              like SEO for your event, custom pricing for your tickets, and dedicated organizer
              tools to manage bookings and guest experience.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/organizer/register"
                className="inline-flex items-center justify-center h-12 px-10 rounded-xl text-white font-bold text-base transition-colors hover:bg-[#57008E]"
                style={{ backgroundColor: BRAND }}
              >
                List your event
              </Link>
              <button
                type="button"
                onClick={openLogin}
                className="inline-flex items-center justify-center h-12 px-8 rounded-xl border-2 border-[#6900AA] text-[#6900AA] font-bold text-base hover:bg-[#F7E9FF] transition-colors cursor-pointer"
              >
                Organizer Login
              </button>
            </div>

            <p className="mt-8 text-xs text-[#888] flex items-center justify-center gap-2">
              <QrCode size={14} className="text-[#6900AA]" />
              Already partnered for dining?
              <Link
                href="/business"
                className="text-[#6900AA] font-semibold hover:underline inline-flex items-center gap-1"
              >
                <UtensilsCrossed size={12} /> Partner with Us
              </Link>
            </p>
          </div>
        </section>
      </div>

      <Footer />

      {loginOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
          onClick={() => setLoginOpen(false)}
          role="presentation"
        >
          <div
            className="relative w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="organizer-login-title"
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
              expectedRole="event_admin"
              title="Event Admin Login"
              titleId="organizer-login-title"
              subtitle="Sign in to manage your events"
              showCustomerLink={false}
              hint={
                <p className="text-[10px] text-slate-400">
                  New organizer?{" "}
                  <Link href="/organizer/register" className="text-[#6900AA] font-semibold">
                    Register here
                  </Link>
                </p>
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
