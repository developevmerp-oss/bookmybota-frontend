"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Ticket } from "lucide-react";
import { toast } from "sonner";
import EventForm from "@/components/EventAdminPanel/EventForm";
import OrganizerTicketPurchase from "@/components/EventAdminPanel/OrganizerTicketPurchase";
import {
  useGetOrganizerEventQuery,
  useUpdateOrganizerEventMutation,
  useSubmitOrganizerEventMutation,
  useToggleOrganizerEventVisibilityMutation,
  type EventFormPayload,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";

export default function EditOrganizerEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const { data: event, isLoading } = useGetOrganizerEventQuery(id);
  const [updateEvent, { isLoading: saving }] = useUpdateOrganizerEventMutation();
  const [submitEvent, { isLoading: submitting }] = useSubmitOrganizerEventMutation();
  const [toggleVisibility, { isLoading: toggling }] = useToggleOrganizerEventVisibilityMutation();

  const editable = event?.status === "DRAFT" || event?.status === "PENDING_APPROVAL";
  const canSubmit = event?.status === "DRAFT";
  const canToggleVisibility = event?.status === "APPROVED" || event?.status === "LIVE";
  const canSellTickets = event?.status === "LIVE";

  const handleSaveDraft = async (payload: EventFormPayload) => {
    try {
      await updateEvent({ id, body: payload }).unwrap();
      toast.success("Draft saved. You can continue editing anytime from My Events.");
      router.push("/organizer/events");
    } catch (e) {
      toast.error(extractApiError(e, "Failed to save event"));
      throw e;
    }
  };

  const handleSubmit = async (payload: EventFormPayload) => {
    try {
      await submitEvent({ id, body: payload }).unwrap();
      toast.success("Event submitted for Super Admin approval");
      router.push("/organizer/events");
    } catch (e) {
      toast.error(extractApiError(e, "Failed to submit event"));
      throw e;
    }
  };

  const handleVisibility = async () => {
    try {
      await toggleVisibility({ id }).unwrap();
      toast.success(event?.is_visible ? "Event hidden from customers" : "Event visible to customers");
    } catch (e) {
      toast.error(extractApiError(e, "Failed to update visibility"));
    }
  };

  if (isLoading) {
    return <div className="portal-muted p-10 text-center">Loading event...</div>;
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <p className="portal-muted mb-4">Event not found.</p>
        <Link href="/organizer/events" className="text-violet-600 hover:text-violet-800">Back to events</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href="/organizer/events" className="inline-flex items-center gap-2 text-sm portal-muted hover:text-slate-900">
        <ArrowLeft size={16} /> Back to events
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="portal-heading text-2xl font-bold">{event.name}</h2>
          <p className="portal-muted mt-1">
            {event.category_name || "Uncategorized"} · {event.status.replace("_", " ")}
          </p>
        </div>
        {canToggleVisibility && (
          <button
            disabled={toggling}
            onClick={handleVisibility}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {event.is_visible ? <EyeOff size={16} /> : <Eye size={16} />}
            {event.is_visible ? "Hide from customers" : "Show to customers"}
          </button>
        )}
        {canSellTickets && (
          <button
            type="button"
            onClick={() => setPurchaseOpen(true)}
            className="btn-primary inline-flex items-center gap-2 text-sm"
          >
            <Ticket size={16} /> Buy tickets for customer
          </button>
        )}
        <Link
          href={`/organizer/events/${event.id}/layout`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
        >
          Seating Layout
        </Link>
      </div>

      <OrganizerTicketPurchase
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        preselectedEventId={event.id}
        onSuccess={() => setPurchaseOpen(false)}
      />

      <EventForm
        event={event}
        readOnly={!editable}
        canSubmit={canSubmit}
        onSaveDraft={handleSaveDraft}
        onSubmitForApproval={handleSubmit}
        saving={saving}
        submitting={submitting}
      />
    </div>
  );
}
