"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ContractRichTextEditor from "@/components/ContractRichTextEditor";
import EventContractDocument from "@/components/EventContractDocument";
import {
  useCreateEventContractMutation,
  useGetContractPrefillQuery,
  useGetEligibleContractEventsQuery,
  type EventContract,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { htmlWithMergedValues } from "@/lib/contractPlaceholdersShared";

export default function CreateEventContractPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get("eventId") ?? "";

  const { data: eligible = [], isLoading: loadingEligible } = useGetEligibleContractEventsQuery();
  const [eventId, setEventId] = useState(initialEventId);
  const { data: prefill, isLoading: loadingPrefill } = useGetContractPrefillQuery(eventId, {
    skip: !eventId,
  });

  const [convenienceFee, setConvenienceFee] = useState("0");
  const [commission, setCommission] = useState("0");
  const [terms, setTerms] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [previewContract, setPreviewContract] = useState<EventContract | null>(null);

  const [createContract, { isLoading: creating }] = useCreateEventContractMutation();

  useEffect(() => {
    if (initialEventId) setEventId(initialEventId);
  }, [initialEventId]);

  useEffect(() => {
    if (!prefill?.suggested) return;
    setConvenienceFee(String(prefill.suggested.convenience_fee_percent ?? 0));
    setCommission(String(prefill.suggested.commission_percent ?? 0));
    setTerms(prefill.suggested.terms_and_conditions ?? "");
    setBodyHtml(prefill.suggested.body_html ?? "");
  }, [prefill?.suggested?.contract_number, prefill?.event?.id]);

  const dynamicPreview = useMemo(() => {
    if (!prefill?.suggested) return {};
    return {
      ...prefill.suggested.dynamic_data,
      convenienceFeePercent: Number(convenienceFee) || 0,
      commissionPercent: Number(commission) || 0,
    };
  }, [prefill, convenienceFee, commission]);

  const handleCreate = async () => {
    if (!eventId || !bodyHtml.trim()) {
      toast.error("Select an event and enter contract content.");
      return;
    }
    try {
      await createContract({
        event_id: eventId,
        body_html: bodyHtml,
        terms_and_conditions: terms,
        convenience_fee_percent: Number(convenienceFee) || 0,
        commission_percent: Number(commission) || 0,
        sign_as_admin: true,
      }).unwrap();
      toast.success("Contract created and signed. Organizer must sign before the event goes public.");
      router.push(`/admin/event-contracts/${eventId}`);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to create contract"));
    }
  };

  const showLivePreview = () => {
    if (!prefill?.suggested || !bodyHtml.trim()) return;
    setPreviewContract({
      id: "preview",
      event_id: eventId,
      contract_number: prefill.suggested.contract_number,
      body_html: bodyHtml,
      terms_and_conditions: terms,
      status: "PENDING_SIGNATURES",
      convenience_fee_percent: Number(convenienceFee) || 0,
      commission_percent: Number(commission) || 0,
      dynamic_data: dynamicPreview,
      event_name: prefill.event.name,
      organizer_name: prefill.event.organizer_name,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/event-contracts"
          className="inline-flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 mb-3"
        >
          <ArrowLeft size={16} /> Back to contracts
        </Link>
        <h2 className="text-2xl font-bold text-white">Create Event Contract</h2>
        <p className="text-zinc-400 mt-1">
          Select a pending event, review auto-filled details, compose the contract with dynamic fields,
          then sign as Super Admin. The event goes public only after the organizer also signs.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-5">
          <h3 className="text-lg font-semibold text-white">Event & commercial terms</h3>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Select event *</label>
            <select
              className="input-field w-full"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              disabled={loadingEligible}
            >
              <option value="">Select pending event…</option>
              {eligible.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} — {ev.organizer_name} ({ev.status.replace("_", " ")})
                </option>
              ))}
            </select>
          </div>

          {loadingPrefill && eventId && (
            <p className="text-sm text-zinc-500 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading event details…
            </p>
          )}

          {prefill && (
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {[
                ["Organizer", prefill.event.organizer_name],
                ["Category", prefill.event.category_name],
                ["Language", prefill.event.language],
                ["Age group", prefill.event.age_group],
                ["Duration", prefill.event.duration_minutes ? `${prefill.event.duration_minutes} min` : "—"],
                ["Contract #", prefill.suggested.contract_number],
              ].map(([label, val]) => (
                <div key={label} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                  <p className="text-xs text-zinc-500">{label}</p>
                  <p className="text-zinc-200 font-medium truncate">{val || "—"}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Convenience fee (%)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="input-field w-full"
                value={convenienceFee}
                onChange={(e) => setConvenienceFee(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Commission (%)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                className="input-field w-full"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Terms & Conditions</label>
            <textarea
              rows={3}
              className="input-field w-full"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Optional summary terms…"
            />
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-white/10 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Contract details (rich text)</h3>
          <p className="text-xs text-zinc-500">
            Use <strong className="text-zinc-400">+ Insert Dynamic Field</strong> to add placeholders.
            They appear as labeled chips in the editor — not raw HTML tags.
          </p>
          <ContractRichTextEditor value={bodyHtml} onChange={setBodyHtml} minHeight="320px" />
        </div>
      </div>

      {bodyHtml && (
        <div className="glass-panel rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Live preview (merged values)</h3>
            <button
              type="button"
              onClick={showLivePreview}
              className="text-sm text-emerald-400 hover:text-emerald-300"
            >
              Refresh preview
            </button>
          </div>
          {previewContract ? (
            <EventContractDocument contract={previewContract} showSignatures={false} />
          ) : (
            <div
              className="contract-document-body rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-800"
              dangerouslySetInnerHTML={{
                __html: htmlWithMergedValues(bodyHtml, dynamicPreview),
              }}
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 justify-end">
        <Link
          href="/admin/events"
          className="px-5 py-2.5 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5"
        >
          Cancel
        </Link>
        <button
          type="button"
          disabled={creating || !eventId}
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
          Create contract & sign
        </button>
      </div>
    </div>
  );
}
