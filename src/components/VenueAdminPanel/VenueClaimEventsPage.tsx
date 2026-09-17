"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { readSessionForRole } from "@/lib/authStorage";
import {
  useClaimVenueShowtimeMutation,
  useGetVenueClaimableShowtimesQuery,
} from "@/services/api";
import { formatDate, formatDateTime12h } from "@/lib/dateFormat";

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
      <div className="org-card p-4 sm:p-5">
        <h1 className="text-lg font-semibold text-foreground">Claim events</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Confirm events that organizers listed at your venue. Claims appear after the organizer submits the
          event for Super Admin approval.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : showtimes.length === 0 ? (
        <div className="org-card p-6 text-sm text-muted-foreground">
          No claimable events right now. When an organizer adds your venue and submits for approval, it will
          show here.
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {showtimes.map((s) => (
            <li key={s.showtime_id} className="org-card p-4 sm:p-5 flex flex-col gap-3 min-w-0">
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Event
                  </p>
                  <p className="font-semibold text-foreground">{s.event_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[s.category_name, s.event_status].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    Venue listed on this event
                  </p>
                  <p className="text-sm text-foreground font-medium">{s.venue_name || "—"}</p>
                  {s.linked_venue_name && s.linked_venue_name !== s.venue_name ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Linked partner: {s.linked_venue_name}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[s.city_name, s.venue_address].filter(Boolean).join(" · ") || "Location TBD"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Listing source:{" "}
                    {s.venue_source === "registered"
                      ? "Registered venue partner"
                      : s.venue_source === "auto_registered"
                        ? "Auto-registered from organizer"
                        : s.venue_source || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                    When
                  </p>
                  <p className="text-sm text-foreground">
                    {s.starts_at ? formatDateTime12h(s.starts_at) : formatDate(null)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Organizer who created this event:{" "}
                  <span className="text-foreground font-medium">{s.organizer_name || "—"}</span>
                </p>
              </div>
              <button
                type="button"
                disabled={claiming}
                onClick={() => onClaim(s.showtime_id)}
                className="btn-primary text-sm disabled:opacity-50 shrink-0 w-full"
              >
                Claim & confirm this venue stop
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
