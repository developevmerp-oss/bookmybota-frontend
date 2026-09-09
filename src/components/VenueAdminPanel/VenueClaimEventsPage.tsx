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
    <div className="w-full max-w-[1600px] mx-auto space-y-4">
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : showtimes.length === 0 ? (
        <div className="org-card p-6 text-sm text-muted-foreground">No claimable events right now.</div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {showtimes.map((s) => (
            <li
              key={s.showtime_id}
              className="org-card p-4 sm:p-5 flex flex-col gap-3 min-w-0"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{s.event_name}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
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
                className="btn-primary text-sm disabled:opacity-50 shrink-0 w-full"
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
