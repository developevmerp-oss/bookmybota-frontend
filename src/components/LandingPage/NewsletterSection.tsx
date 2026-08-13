"use client";

import { FormEvent, useState } from "react";
import { FaPaperPlane } from "react-icons/fa";
import { toast } from "sonner";

export default function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      toast.success("You're subscribed. We'll keep you posted.");
      setEmail("");
      setSubmitting(false);
    }, 400);
  };

  return (
    <section className="bg-[#f7f4ee]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-[#1B5E3B] rounded-t-[28px] px-6 sm:px-10 lg:px-12 py-8 sm:py-10 overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
            <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
              <div className="w-14 h-14 rounded-full bg-[#C9A227] flex items-center justify-center shrink-0">
                <FaPaperPlane size={20} className="text-white translate-x-[-1px]" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  Never Miss What&apos;s Happening
                </h2>
                <p className="text-white/90 text-sm mt-1 max-w-md">
                  Get the latest events, dining offers and experiences directly in your inbox.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex w-full lg:w-[440px] shrink-0 overflow-hidden rounded-lg shadow-sm"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="flex-1 min-w-0 bg-white px-4 py-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="bg-[#C9A227] hover:bg-[#b4911f] disabled:opacity-70 text-white font-semibold text-sm px-6 py-3.5 cursor-pointer transition-colors shrink-0"
              >
                {submitting ? "Subscribing..." : "Subscribe"}
              </button>
            </form>
          </div>

          <div
            className="pointer-events-none absolute right-4 sm:right-8 bottom-0 hidden sm:block"
            aria-hidden
          >
            <svg width="88" height="72" viewBox="0 0 88 72" fill="none">
              <path d="M62 48c8-10 18-8 22-2" stroke="#3d8b5c" strokeWidth="3" fill="none" />
              <ellipse cx="72" cy="38" rx="7" ry="12" fill="#2ea44f" transform="rotate(25 72 38)" />
              <ellipse cx="80" cy="42" rx="5" ry="10" fill="#1B5E3B" transform="rotate(40 80 42)" />
              <rect x="28" y="8" width="28" height="22" rx="2" fill="white" transform="rotate(-12 42 19)" />
              <rect x="34" y="12" width="26" height="20" rx="2" fill="#f4f4f4" transform="rotate(8 47 22)" />
              <path d="M8 28h52l-26 16L8 28z" fill="#E8B923" />
              <path d="M8 28v28h52V28L34 44 8 28z" fill="#C9A227" />
              <path d="M8 28l26 16 26-16v6L34 50 8 34v-6z" fill="#E8B923" />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
