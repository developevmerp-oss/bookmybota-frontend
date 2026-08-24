"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Guitar,
  Handshake,
  Info,
  Mic2,
  Music2,
  Share2,
  Sparkles,
  Star,
  Ticket,
  Users,
  X,
} from "lucide-react";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";
import PartnerDirectorySection from "@/components/Shared/PartnerDirectorySection";
import Footer from "@/components/LandingPage/Footer";
import { homePathForRole, readSessionForRole } from "@/lib/authStorage";
import { useGetPublicRegisteredArtistsQuery } from "@/services/api";
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
    id: "spotlight",
    title: "Get discovered by event organizers",
    description:
      "Build a verified artist profile so organizers can find you, invite you, and book you for the right shows.",
    image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=900&q=80",
    tone: "from-[#2a1040] via-[#3d1860] to-[#1a0a28]",
  },
  {
    id: "profile",
    title: "Own your stage-ready profile",
    description:
      "Showcase your bio, photos, and performance style so fans and partners see you at your best.",
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=900&q=80",
    tone: "from-[#4a1a6b] via-[#6900AA] to-[#3a0f55]",
  },
  {
    id: "lineup",
    title: "Appear on event lineups citywide",
    description:
      "When organizers add you to an event, your name reaches Book My Bota audiences across the city.",
    image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=900&q=80",
    tone: "from-[#1e1433] via-[#2d1b4e] to-[#120a22]",
  },
  {
    id: "trust",
    title: "Build platform trust & credibility",
    description:
      "Verified partners stand out. Auto-listed artists can complete onboarding to become platform-authorized.",
    image: "https://images.unsplash.com/photo-1501386767018-ba696c028ced?w=900&q=80",
    tone: "from-[#3b1460] via-[#57008E] to-[#2a0d45]",
  },
];

const ARTIST_TYPES = [
  {
    label: "Singers & Vocalists",
    description: "Solo acts, playback artists, and live vocal performances.",
    Icon: Mic2,
  },
  {
    label: "Bands & Ensembles",
    description: "Bands, orchestras, and group stage acts.",
    Icon: Guitar,
  },
  {
    label: "DJs & Electronic",
    description: "Club nights, festivals, and electronic sets.",
    Icon: Music2,
  },
  {
    label: "Comedy & Spoken Word",
    description: "Stand-up, open mics, and storytelling nights.",
    Icon: Sparkles,
  },
  {
    label: "Dance & Performance",
    description: "Dance crews, cultural acts, and stage performers.",
    Icon: Users,
  },
  {
    label: "Special Acts",
    description: "Magicians, hosts, and unique entertainment acts.",
    Icon: Star,
  },
];

const SERVICES = [
  {
    label: "Artist profile hub",
    description: "Keep your public-facing details, photos, and bio in one place.",
    Icon: Mic2,
  },
  {
    label: "Organizer discovery",
    description: "Verified artists appear in organizer search when building lineups.",
    Icon: CalendarDays,
  },
  {
    label: "Event visibility",
    description: "Get featured on event pages that customers already browse and book.",
    Icon: Ticket,
  },
  {
    label: "Shareable presence",
    description: "A polished profile that partners and promoters can trust.",
    Icon: Share2,
  },
  {
    label: "Partner onboarding",
    description: "Complete documents and terms to become a platform-authorized artist.",
    Icon: Handshake,
  },
  {
    label: "Cross-city reach",
    description: "Connect with organizers hosting shows across Book My Bota cities.",
    Icon: Building2,
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

export default function ArtistLandingPage() {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const { data: registeredArtists = [], isLoading: artistsLoading } = useGetPublicRegisteredArtistsQuery();

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
    const session = readSessionForRole("artist_admin");
    if (session) {
      router.push(homePathForRole("artist_admin"));
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
                      For artists & performers
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
                        href="/artist/register"
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
              Who can join as an artist?
            </h2>
            <p className="mt-4 text-sm md:text-base text-[#5c5c5c] leading-relaxed max-w-3xl mx-auto">
              From solo singers to full bands and specialty acts — Book My Bota helps performers get
              in front of organizers who are building lineups every week.
            </p>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {ARTIST_TYPES.map(({ label, description, Icon }) => (
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
                href="/artist/register"
                className="inline-flex items-center justify-center h-12 px-10 rounded-xl text-white font-bold text-base shadow-[0_8px_24px_rgba(105,0,170,0.28)] transition-colors hover:bg-[#57008E]"
                style={{ backgroundColor: BRAND }}
              >
                Register as an artist
              </Link>
            </div>
            <p className="mt-4 text-xs text-[#888]">
              Complete account setup (details + documents). After Super Admin approval, sign in to
              manage your artist profile.
            </p>
          </div>
        </section>

        <PartnerDirectorySection
          title="Registered artists on Book My Bota"
          subtitle="Performers already onboarded and approved — the same artists organizers find when building event lineups."
          kind="artist"
          partners={registeredArtists}
          isLoading={artistsLoading}
          emptyMessage="No registered artists yet. After an artist completes registration and approval, they will appear here."
        />

        <section id="services" className="bg-[#faf7fc] py-16 md:py-20 scroll-mt-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: INK }}>
              What do we offer artists?
            </h2>
            <p className="mt-4 text-sm md:text-base text-[#5c5c5c] leading-relaxed max-w-3xl mx-auto">
              A simple partner portal focused on discovery, profile management, and trust — so you
              spend more time performing and less time chasing bookings.
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

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/artist/register"
                className="inline-flex items-center justify-center h-12 px-10 rounded-xl text-white font-bold text-base transition-colors hover:bg-[#57008E]"
                style={{ backgroundColor: BRAND }}
              >
                Register as an artist
              </Link>
              <button
                type="button"
                onClick={openLogin}
                className="inline-flex items-center justify-center h-12 px-8 rounded-xl border-2 border-[#6900AA] text-[#6900AA] font-bold text-base hover:bg-[#F7E9FF] transition-colors cursor-pointer"
              >
                Artist Login
              </button>
            </div>

            <p className="mt-8 text-xs text-[#888] flex flex-wrap items-center justify-center gap-2">
              Also partnering as
              <Link href="/venue" className="text-[#6900AA] font-semibold hover:underline">
                a venue
              </Link>
              <span>or</span>
              <Link href="/business" className="text-[#6900AA] font-semibold hover:underline">
                a restaurant
              </Link>
              ?
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
            aria-labelledby="artist-login-title"
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
              expectedRole="artist_admin"
              title="Artist Admin Login"
              titleId="artist-login-title"
              subtitle="Sign in to manage your artist profile"
              showCustomerLink={false}
              hint={
                <p className="text-[10px] text-slate-400">
                  New artist?{" "}
                  <Link href="/artist/register" className="text-[#6900AA] font-semibold">
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
