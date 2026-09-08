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
    return <p className="text-muted-foreground p-6">Sign in as a venue partner to claim events.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="org-section-label mb-2">Event linking</p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Claim events at your venue
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Organizers may list your venue before you join the platform. Claim events to link them to your verified
          venue profile.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : showtimes.length === 0 ? (
        <div className="org-card p-6 text-sm text-muted-foreground">No claimable events right now.</div>
      ) : (
        <ul className="space-y-3">
          {showtimes.map((s) => (
            <li
              key={s.showtime_id}
              className="org-card p-4 flex flex-wrap items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{s.event_name}</p>
                <p className="text-sm text-muted-foreground">
                  {s.venue_name}
                  {s.city_name ? ` · ${s.city_name}` : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDateTime12h(s.starts_at)} · Organizer: {s.organizer_name || "—"}
                </p>
              </div>
              <button
                type="button"
                disabled={claiming}
                onClick={() => onClaim(s.showtime_id)}
                className="btn-primary text-sm disabled:opacity-50"
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
