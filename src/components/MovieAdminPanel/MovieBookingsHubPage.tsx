"use client";

import { useState } from "react";
import { ListChecks, Ticket } from "lucide-react";
import MovieBookTicketsBrowser from "./MovieBookTicketsBrowser";
import MoviePartnerBookingsPage from "./MoviePartnerBookingsPage";

/** Bookings: book tickets for a show (default), and the list of every booking made. */
export default function MovieBookingsHubPage() {
  const [tab, setTab] = useState<"book" | "all">("book");
  const tabBtn = (id: "book" | "all", label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 -mb-px cursor-pointer ${
        tab === id ? "border-[#e11d48] text-[#e11d48]" : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {icon} {label}
    </button>
  );
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Bookings</h2>
        <p className="text-sm text-slate-500 mt-0.5">Pick a show to book seats for a customer, or review every booking made so far.</p>
      </div>
      <div className="flex border-b border-slate-200">
        {tabBtn("book", "Book tickets", <Ticket size={15} />)}
        {tabBtn("all", "All bookings", <ListChecks size={15} />)}
      </div>
      {tab === "book" ? <MovieBookTicketsBrowser /> : <MoviePartnerBookingsPage />}
    </div>
  );
}
