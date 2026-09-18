"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import EventForm from "@/components/EventAdminPanel/EventForm";
import {
  useCreateOrganizerEventMutation,
  useUpdateOrganizerEventMutation,
  useSubmitOrganizerEventMutation,
  type EventFormPayload,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";

export default function NewOrganizerEventPage() {
  const router = useRouter();
  const [draftId, setDraftId] = useState<string | null>(null);
  const saveLockRef = useRef(false);
  const [createEvent, { isLoading: creating }] = useCreateOrganizerEventMutation();
  const [updateEvent, { isLoading: updating }] = useUpdateOrganizerEventMutation();
  const [submitEvent, { isLoading: submitting }] = useSubmitOrganizerEventMutation();
  const saving = creating || updating;

  const handleSaveDraft = async (payload: EventFormPayload) => {
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    try {
      if (draftId) {
        await updateEvent({ id: draftId, body: payload }).unwrap();
        toast.success(
          payload.promotion_request
            ? "Draft updated with promotion request."
            : "Draft updated."
        );
        return;
      }

      const created = await createEvent(payload).unwrap();
      setDraftId(created.id);
      toast.success(
        payload.promotion_request
          ? "Draft saved with promotion request. You can continue editing."
          : "Draft saved. You can continue editing."
      );
      // Switch to the edit URL so further saves update this same event.
      router.replace(`/organizer/events/${created.id}`);
    } catch (e) {
      toast.error(extractApiError(e, "Failed to save draft"));
      throw e;
    } finally {
      saveLockRef.current = false;
    }
  };

  const handleSubmit = async (payload: EventFormPayload) => {
    if (saveLockRef.current) return;
    saveLockRef.current = true;
    try {
      let id = draftId;
      if (id) {
        await updateEvent({ id, body: payload }).unwrap();
      } else {
        const created = await createEvent(payload).unwrap();
        id = created.id;
        setDraftId(id);
      }
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
    } finally {
      saveLockRef.current = false;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href="/organizer/events" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft size={16} /> Back to events
      </Link>
      <div>
        <h2 className="portal-heading text-2xl font-bold">Create event</h2>
        <p className="portal-muted mt-1">
          Guided steps: event details, venue, artist, media, then preview and submit.
        </p>
      </div>
      <EventForm
        canSubmit
        onSaveDraft={handleSaveDraft}
        onSubmitForApproval={handleSubmit}
        saving={saving}
        submitting={submitting}
      />
    </div>
  );
}
