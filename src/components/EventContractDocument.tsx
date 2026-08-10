"use client";

import { mergeContractHtml, type EventContractRecord } from "@/lib/contractPlaceholders";

interface EventContractDocumentProps {
  contract: EventContractRecord;
  showSignatures?: boolean;
}

export default function EventContractDocument({
  contract,
  showSignatures = true,
}: EventContractDocumentProps) {
  const mergedHtml = mergeContractHtml(contract);

  return (
    <div className="contract-document rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap justify-between gap-2 mb-4 pb-4 border-b border-slate-100">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Contract</p>
          <p className="font-semibold text-slate-900">{contract.contract_number}</p>
        </div>
        {contract.event_name && (
          <div className="text-right">
            <p className="text-xs text-slate-500">Event</p>
            <p className="font-medium text-slate-800">{contract.event_name}</p>
          </div>
        )}
      </div>

      {contract.terms_and_conditions && (
        <div className="mb-4 p-3 rounded-lg bg-slate-50 text-sm text-slate-700">
          <p className="font-medium text-slate-900 mb-1">Terms & Conditions</p>
          <p className="whitespace-pre-wrap">{contract.terms_and_conditions}</p>
        </div>
      )}

      <div
        className="contract-document-body prose prose-sm max-w-none text-slate-800"
        dangerouslySetInnerHTML={{ __html: mergedHtml }}
      />

      {showSignatures && (
        <div className="mt-8 pt-4 border-t border-slate-100 grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-slate-700">Super Admin</p>
            <p className={contract.admin_signed_at ? "text-green-700" : "text-amber-700"}>
              {contract.admin_signed_at
                ? `Signed ${new Date(contract.admin_signed_at).toLocaleString()}`
                : "Awaiting signature"}
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-700">Event Organizer</p>
            <p className={contract.organizer_signed_at ? "text-green-700" : "text-amber-700"}>
              {contract.organizer_signed_at
                ? `Signed ${new Date(contract.organizer_signed_at).toLocaleString()}`
                : "Awaiting signature"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
