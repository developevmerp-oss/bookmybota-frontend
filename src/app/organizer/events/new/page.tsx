"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import EventForm from "@/components/EventAdminPanel/EventForm";
import {
  useCreateOrganizerEventMutation,
  useSubmitOrganizerEventMutation,
  type EventFormPayload,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";

export default function NewOrganizerEventPage() {
  const router = useRouter();
  const [createEvent, { isLoading: saving }] = useCreateOrganizerEventMutation();
  const [submitEvent, { isLoading: submitting }] = useSubmitOrganizerEventMutation();

  const handleSaveDraft = async (payload: EventFormPayload) => {
    try {
      await createEvent(payload).unwrap();
      toast.success("Event draft saved successfully");
      router.push("/organizer/events");
    } catch (e) {
      toast.error(extractApiError(e, "Failed to save draft"));
      throw e;
    }
  };

  const handleSubmit = async (payload: EventFormPayload) => {
    try {
      const created = await createEvent(payload).unwrap();
      await submitEvent({ id: created.id, body: payload }).unwrap();
      toast.success("Event submitted for Super Admin approval");
      router.push("/organizer/events");
    } catch (e) {
      toast.error(extractApiError(e, "Failed to submit event"));
      throw e;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/organizer/events" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
        <ArrowLeft size={16} /> Back to events
      </Link>
      <div>
        <h2 className="portal-heading text-2xl font-bold">Create event</h2>
        <p className="portal-muted mt-1">Fill in the details, upload posters and documents, then submit for review.</p>
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
