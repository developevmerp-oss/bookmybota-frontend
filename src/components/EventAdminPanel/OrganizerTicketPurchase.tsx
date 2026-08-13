"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Ticket } from "lucide-react";
import EventCheckout from "@/components/EventLandingPage/EventCheckout";
import {
  useGetOrganizerEventQuery,
  useGetOrganizerEventsQuery,
  type OrganizerEvent,
} from "@/services/api";

type Props = {
  open: boolean;
  onClose: () => void;
  preselectedEventId?: string;
  onSuccess?: () => void;
};

export default function OrganizerTicketPurchase({
  open,
  onClose,
  preselectedEventId,
  onSuccess,
}: Props) {
  const [pickedEventId, setPickedEventId] = useState(preselectedEventId || "");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const { data: events = [] } = useGetOrganizerEventsQuery(undefined, { skip: !open });
  const liveEvents = useMemo(
    () => events.filter((e) => e.status === "LIVE"),
    [events]
  );

  const activeEventId = preselectedEventId || pickedEventId;
  const { data: eventDetail, isLoading } = useGetOrganizerEventQuery(activeEventId, {
    skip: !activeEventId || !checkoutOpen,
  });

  useEffect(() => {
    if (!open) {
      setPickedEventId(preselectedEventId || "");
      setCheckoutOpen(false);
      return;
    }
    if (preselectedEventId) {
      setCheckoutOpen(true);
    }
  }, [open, preselectedEventId]);

  const handleClose = () => {
    setCheckoutOpen(false);
    setPickedEventId(preselectedEventId || "");
    onClose();
  };

  const handlePickEvent = () => {
    if (!pickedEventId) return;
    setCheckoutOpen(true);
  };

  if (!open) return null;

  if (checkoutOpen && activeEventId) {
    if (isLoading || !eventDetail) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="bg-white rounded-2xl px-8 py-6 text-slate-600 text-sm">Loading event…</div>
        </div>
      );
    }
    return (
      <EventCheckout
        event={eventDetail as OrganizerEvent}
        open
        mode="organizer"
        onClose={handleClose}
        onOrganizerSuccess={() => {
          onSuccess?.();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Ticket size={20} className="text-violet-600" />
              Buy tickets for customer
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Same checkout steps as the public site — showtime, tickets, and customer contact.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X size={18} />
          </button>
        </div>

        {liveEvents.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">
            No live events available. An event must be live before you can sell tickets.
          </p>
        ) : (
          <>
            <label htmlFor="organizer-pick-event" className="portal-label text-xs font-bold uppercase tracking-wider mb-1.5 block">
              Select event
            </label>
            <select
              id="organizer-pick-event"
              value={pickedEventId}
              onChange={(e) => setPickedEventId(e.target.value)}
              className="portal-select mb-5"
            >
              <option value="">Choose a live event…</option>
              {liveEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!pickedEventId}
              onClick={handlePickEvent}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-500 text-white font-bold text-sm"
            >
              Continue to checkout
            </button>
          </>
        )}
      </div>
    </div>
  );
}
