"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { readSessionForRole } from "@/lib/authStorage";
import {
  useClaimArtistEventMutation,
  useGetArtistClaimableEventsQuery,
} from "@/services/api";
import { formatDateTime12h } from "@/lib/dateFormat";

export default function ArtistClaimEventsPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  useEffect(() => {
    const session = readSessionForRole("artist_admin");
    setBusinessId(session?.user?.business_id || null);
  }, []);

  const { data: events = [], isLoading, refetch } = useGetArtistClaimableEventsQuery(businessId!, {
    skip: !businessId,
  });
  const [claim, { isLoading: claiming }] = useClaimArtistEventMutation();

  const onClaim = async (eventArtistId: string) => {
    if (!businessId) return;
    try {
      const res = await claim({ businessId, eventArtistId }).unwrap();
      toast.success(res.message || "Event linked to your artist profile");
      refetch();
    } catch (e) {
      toast.error((e as { data?: { error?: string } })?.data?.error || "Claim failed");
    }
  };

  if (!businessId) {
    return <p className="text-muted-foreground p-6">Sign in as an artist partner to claim events.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="org-section-label mb-2">Event linking</p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Claim events featuring you
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Organizers may list you on events before you join the platform. Claim them to link to your verified
          artist profile.
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : events.length === 0 ? (
        <div className="org-card p-6 text-sm text-muted-foreground">No claimable events right now.</div>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <li
              key={e.event_artist_id}
              className="org-card p-4 flex flex-wrap items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{e.event_name}</p>
                <p className="text-sm text-muted-foreground">
                  {e.artist_name}
                  {e.role_title ? ` · ${e.role_title}` : ""}
                  {e.city_name ? ` · ${e.city_name}` : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {e.starts_at ? formatDateTime12h(e.starts_at) : "Date TBD"} · Organizer:{" "}
                  {e.organizer_name || "—"}
                </p>
              </div>
              <button
                type="button"
                disabled={claiming}
                onClick={() => onClaim(e.event_artist_id)}
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
