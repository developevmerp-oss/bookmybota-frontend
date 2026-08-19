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
        <div className="mt-8 pt-4 border-t border-slate-100 grid sm:grid-cols-2 gap-6 text-sm">
          <SignatureBlock
            title="Super Admin"
            signedAt={contract.admin_signed_at}
            signatureUrl={contract.admin_signature_url}
          />
          <SignatureBlock
            title="Event Organizer"
            signedAt={contract.organizer_signed_at}
            signatureUrl={contract.organizer_signature_url}
          />
        </div>
      )}
    </div>
  );
}

function SignatureBlock({
  title,
  signedAt,
  signatureUrl,
}: {
  title: string;
  signedAt?: string | null;
  signatureUrl?: string | null;
}) {
  return (
    <div>
      <p className="font-medium text-slate-700 mb-2">{title}</p>
      {signatureUrl ? (
        <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-3 min-h-[80px] flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signatureUrl}
            alt={`${title} signature`}
            className="max-h-20 max-w-full object-contain"
          />
        </div>
      ) : (
        <div className="mb-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-400">
          Signature not yet provided
        </div>
      )}
      <p className={signedAt ? "text-green-700" : "text-amber-700"}>
        {signedAt ? `Signed ${new Date(signedAt).toLocaleString()}` : "Awaiting signature + OTP"}
      </p>
    </div>
  );
}
