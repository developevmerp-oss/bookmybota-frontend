"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ClipboardList,
  Handshake,
  Info,
  LayoutGrid,
  MapPin,
  ShieldCheck,
  Sofa,
  Ticket,
  Users,
  X,
} from "lucide-react";
import PartnerLoginForm from "@/components/Shared/PartnerLoginForm";
import PartnerDirectorySection from "@/components/Shared/PartnerDirectorySection";
import Footer from "@/components/LandingPage/Footer";
import { homePathForRole, readSessionForRole } from "@/lib/authStorage";
import { useGetPublicRegisteredVenuesQuery } from "@/services/api";
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
    id: "claim",
    title: "Claim events happening at your venue",
    description:
      "When organizers list your space, claim those showtimes and stay in the loop on what is running at your property.",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=900&q=80",
    tone: "from-[#2a1040] via-[#3d1860] to-[#1a0a28]",
  },
  {
    id: "layouts",
    title: "Publish seating layouts once, reuse often",
    description:
      "Share theater, banquet, or mixed layouts so organizers can pick a published plan for every show.",
    image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=900&q=80",
    tone: "from-[#4a1a6b] via-[#6900AA] to-[#3a0f55]",
  },
  {
    id: "requests",
    title: "Handle custom layout requests",
    description:
      "Review organizer seating requests, fulfill them with your plans, and keep the floor plan process smooth.",
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=900&q=80",
    tone: "from-[#1e1433] via-[#2d1b4e] to-[#120a22]",
  },
  {
    id: "trust",
    title: "Become a verified venue partner",
    description:
      "Authorized venues stand out in organizer search and appear as platform-trusted spaces to customers.",
    image: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=900&q=80",
    tone: "from-[#3b1460] via-[#57008E] to-[#2a0d45]",
  },
];

const VENUE_TYPES = [
  {
    label: "Auditoriums & Halls",
    description: "Theaters, cultural halls, and large seated venues.",
    Icon: Building2,
  },
  {
    label: "Banquet & Wedding Spaces",
    description: "Banquet halls and celebration venues for private events.",
    Icon: Sofa,
  },
  {
    label: "Outdoor & Amphitheaters",
    description: "Open grounds, amphitheaters, and festival sites.",
    Icon: MapPin,
  },
  {
    label: "Clubs & Nightvenues",
    description: "Clubs, lounges, and nightlife spaces hosting live acts.",
    Icon: Users,
  },
  {
    label: "Conference Centers",
    description: "Meeting halls and multi-purpose corporate spaces.",
    Icon: LayoutGrid,
  },
  {
    label: "Unique Spaces",
    description: "Galleries, rooftops, cafés, and specialty event spaces.",
    Icon: ShieldCheck,
  },
];

const SERVICES = [
  {
    label: "Claim event showtimes",
    description: "See unclaimed events listed at your venue and claim them as the venue partner.",
    Icon: Ticket,
  },
  {
    label: "Published seating layouts",
    description: "Upload theater, banquet, or custom layouts organizers can select.",
    Icon: LayoutGrid,
  },
  {
    label: "Layout request workflow",
    description: "Fulfill custom seating requests from organizers in one place.",
    Icon: ClipboardList,
  },
  {
    label: "Organizer discovery",
    description: "Verified partners show up when organizers search for registered venues.",
    Icon: Building2,
  },
  {
    label: "Partner onboarding",
    description: "Complete docs and approval to become platform-authorized.",
    Icon: Handshake,
  },
  {
    label: "Citywide visibility",
    description: "Connect your space to events customers already browse on Book My Bota.",
    Icon: MapPin,
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

export default function VenueLandingPage() {
  const router = useRouter();
  const [loginOpen, setLoginOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const { data: registeredVenues = [], isLoading: venuesLoading } = useGetPublicRegisteredVenuesQuery();

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
    const session = readSessionForRole("venue_admin");
    if (session) {
      router.push(homePathForRole("venue_admin"));
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
                      For venue partners
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
                        href="/venue/register"
                        className="inline-flex items-center justify-center h-11 px-5 rounded-lg bg-white text-[#6900AA] font-bold text-sm hover:bg-[#F7E9FF] transition-colors"
                      >
                        Register your venue
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
              What venues can partner?
            </h2>
            <p className="mt-4 text-sm md:text-base text-[#5c5c5c] leading-relaxed max-w-3xl mx-auto">
              From auditoriums to banquet halls and outdoor grounds — list your space so organizers
              can book shows where your guests already gather.
            </p>

            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {VENUE_TYPES.map(({ label, description, Icon }) => (
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
                href="/venue/register"
                className="inline-flex items-center justify-center h-12 px-10 rounded-xl text-white font-bold text-base shadow-[0_8px_24px_rgba(105,0,170,0.28)] transition-colors hover:bg-[#57008E]"
                style={{ backgroundColor: BRAND }}
              >
                Register your venue
              </Link>
            </div>
            <p className="mt-4 text-xs text-[#888]">
              Complete account setup (details + documents). After Super Admin approval, sign in to
              manage layouts and claim events.
            </p>
          </div>
        </section>

        <PartnerDirectorySection
          title="Registered venues on Book My Bota"
          subtitle="Spaces already onboarded and approved — the same partners organizers discover when creating events."
          kind="venue"
          partners={registeredVenues}
          isLoading={venuesLoading}
          emptyMessage="No registered venues yet. After Super Admin onboards a venue partner, it will appear here."
        />

        <section id="services" className="bg-[#faf7fc] py-16 md:py-20 scroll-mt-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight" style={{ color: INK }}>
              What are the services we offer?
            </h2>
            <p className="mt-4 text-sm md:text-base text-[#5c5c5c] leading-relaxed max-w-3xl mx-auto">
              Tools built for venue operators — claim shows at your property, publish layouts, and
              stay connected to organizers using Book My Bota.
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
                href="/venue/register"
                className="inline-flex items-center justify-center h-12 px-10 rounded-xl text-white font-bold text-base transition-colors hover:bg-[#57008E]"
                style={{ backgroundColor: BRAND }}
              >
                Register your venue
              </Link>
              <button
                type="button"
                onClick={openLogin}
                className="inline-flex items-center justify-center h-12 px-8 rounded-xl border-2 border-[#6900AA] text-[#6900AA] font-bold text-base hover:bg-[#F7E9FF] transition-colors cursor-pointer"
              >
                Venue Login
              </button>
            </div>

            <p className="mt-8 text-xs text-[#888] flex flex-wrap items-center justify-center gap-2">
              Also partnering as
              <Link href="/artist" className="text-[#6900AA] font-semibold hover:underline">
                an artist
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
            aria-labelledby="venue-login-title"
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
              expectedRole="venue_admin"
              title="Venue Admin Login"
              titleId="venue-login-title"
              subtitle="Sign in to manage layouts and claim events"
              showCustomerLink={false}
              hint={
                <p className="text-[10px] text-slate-400">
                  New venue?{" "}
                  <Link href="/venue/register" className="text-[#6900AA] font-semibold">
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
