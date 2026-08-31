"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { readSessionForRole } from "@/lib/authStorage";
import {
  useClaimVenueShowtimeMutation,
  useGetVenueClaimableShowtimesQuery,
} from "@/services/api";
import { formatDateTime12h } from "@/lib/dateFormat";

export default function VenueClaimEventsPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  useEffect(() => {
    const session = readSessionForRole("venue_admin");
    setBusinessId(session?.user?.business_id || null);
  }, []);

  const { data: showtimes = [], isLoading, refetch } = useGetVenueClaimableShowtimesQuery(businessId!, {
    skip: !businessId,
  });
  const [claim, { isLoading: claiming }] = useClaimVenueShowtimeMutation();

  const onClaim = async (showtimeId: string) => {
    if (!businessId) return;
    try {
      const res = await claim({ businessId, showtimeId }).unwrap();
      toast.success(res.message || "Event linked to your venue");
      refetch();
    } catch (e) {
      toast.error((e as { data?: { error?: string } })?.data?.error || "Claim failed");
    }
  };

  if (!businessId) {
    return <p className="text-zinc-400 p-6">Sign in as a venue partner to claim events.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Claim events at your venue</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Organizers may list your venue before you join the platform. Claim events to link them to your verified
          venue profile.
        </p>
      </div>

      {isLoading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : showtimes.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
          No claimable events right now.
        </div>
      ) : (
        <ul className="space-y-3">
          {showtimes.map((s) => (
            <li
              key={s.showtime_id}
              className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-wrap items-start justify-between gap-3"
            >
              <div>
                <p className="font-medium text-white">{s.event_name}</p>
                <p className="text-sm text-zinc-400">
                  {s.venue_name}
                  {s.city_name ? ` · ${s.city_name}` : ""}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  {formatDateTime12h(s.starts_at)} · Organizer: {s.organizer_name || "—"}
                </p>
              </div>
              <button
                type="button"
                disabled={claiming}
                onClick={() => onClaim(s.showtime_id)}
                className="rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Claim event
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
