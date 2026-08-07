"use client";

export default function OrganizerBookingsPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2">Event Bookings</h2>
      <p className="text-zinc-400 mb-8">
        Ticket bookings for your events will appear here once booking APIs are connected.
      </p>
      <div className="glass-panel rounded-2xl border border-white/5 p-10 text-center text-zinc-500">
        No bookings yet.
      </div>
    </div>
  );
}
