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
    <section className="bg-[#f7f4ee] pb-14 sm:pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#1B5E3B] rounded-2xl px-6 sm:px-10 py-8 sm:py-10 flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-10">
          <div className="flex items-start sm:items-center gap-4 flex-1">
            <div className="w-14 h-14 rounded-full bg-[#C9A227] flex items-center justify-center shrink-0">
              <FaPaperPlane size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Never Miss What&apos;s Happening
              </h2>
              <p className="text-white/80 text-sm mt-1">
                Get the latest events, dining offers and city highlights in your inbox.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:min-w-[420px]"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="flex-1 bg-white rounded-xl px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#C9A227] hover:bg-[#b4911f] disabled:opacity-70 text-white font-semibold text-sm px-6 py-3 rounded-xl cursor-pointer transition-colors"
            >
              {submitting ? "Subscribing..." : "Subscribe"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
