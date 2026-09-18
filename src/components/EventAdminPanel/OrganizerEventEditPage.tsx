"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ticket } from "lucide-react";
import { toast } from "sonner";
import EventForm from "@/components/EventAdminPanel/EventForm";
import OrganizerTicketPurchase from "@/components/EventAdminPanel/OrganizerTicketPurchase";
import {
  useGetOrganizerEventQuery,
  useUpdateOrganizerEventMutation,
  useSubmitOrganizerEventMutation,
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

  const editable = event?.status === "DRAFT" || event?.status === "PENDING_APPROVAL";
  const mediaOnlyEdit = event?.status === "LIVE";
  const canSubmit = event?.status === "DRAFT";
  const canSellTickets = event?.status === "LIVE";

  const handleSaveDraft = async (payload: EventFormPayload) => {
    try {
      const result = await updateEvent({ id, body: payload }).unwrap();
      const pending = event?.status === "PENDING_APPROVAL";
      const live = event?.status === "LIVE";
      toast.success(
        live
          ? result.message || "Posters, gallery, and YouTube updated."
          : pending
            ? result.message ||
              "Changes saved. Super Admin can see your updates (including custom layout requests)."
            : payload.promotion_request
              ? "Draft saved with promotion request."
              : "Draft saved."
      );
    } catch (e) {
      toast.error(extractApiError(e, "Failed to save event"));
      throw e;
    }
  };

  const handleSubmit = async (payload: EventFormPayload) => {
    try {
      await submitEvent({ id, body: payload }).unwrap();
      toast.success(
        payload.promotion_request
          ? "Event and promotion submitted for Super Admin approval"
          : "Event submitted for Super Admin approval"
      );
      router.push("/organizer/events");
    } catch (e) {
      toast.error(extractApiError(e, "Failed to submit event"));
      throw e;
    }
  };

  if (isLoading) {
    return <div className="portal-muted p-10 text-center">Loading event...</div>;
  }

  if (!event) {
    return (
      <div className="text-center py-16">
        <p className="portal-muted mb-4">Event not found.</p>
        <Link href="/organizer/events" className="text-rose-600 hover:text-rose-800">
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link
        href="/organizer/events"
        className="inline-flex items-center gap-2 text-sm portal-muted hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to events
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="portal-heading text-2xl font-bold">{event.name}</h2>
          <p className="portal-muted mt-1">
            {event.category_name || "Uncategorized"} · {event.status.replace("_", " ")}
          </p>
        </div>
        {canSellTickets && (
          <button
            type="button"
            onClick={() => setPurchaseOpen(true)}
            className="btn-primary inline-flex items-center gap-2 text-sm"
          >
            <Ticket size={16} /> Buy tickets for customer
          </button>
        )}
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
        mediaOnlyEdit={mediaOnlyEdit}
        canSubmit={canSubmit}
        onSaveDraft={handleSaveDraft}
        onSubmitForApproval={handleSubmit}
        saving={saving}
        submitting={submitting}
      />
    </div>
  );
}
