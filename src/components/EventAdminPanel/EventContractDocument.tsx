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
    <article className="contract-document overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
      {/* Accent bar + document title — EVM-style clean header */}
      <div className="h-1 w-full bg-[#6900AA]" aria-hidden />
      <div className="border-b border-slate-200 bg-slate-50 px-6 sm:px-8 py-3.5">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          Your Contract / Agreement
        </h3>
      </div>

      <div className="px-6 sm:px-10 py-7 sm:py-9">
        <div className="flex flex-wrap justify-between gap-4 mb-8 pb-6 border-b border-slate-100">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">
              Contract
            </p>
            <p className="text-base sm:text-lg font-bold text-slate-900">
              {contract.contract_number}
            </p>
          </div>
          {contract.event_name && (
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">
                Event
              </p>
              <p className="text-base sm:text-lg font-bold text-slate-900">
                {contract.event_name}
              </p>
            </div>
          )}
        </div>

        {contract.terms_and_conditions && (
          <section className="mb-8">
            <h4 className="text-sm font-bold text-slate-900 mb-2">Terms &amp; Conditions</h4>
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3.5 text-[15px] leading-relaxed text-slate-700 whitespace-pre-wrap">
              {contract.terms_and_conditions}
            </div>
          </section>
        )}

        <div
          className="contract-document-body max-w-none text-[15px] sm:text-base leading-[1.8] text-slate-800 space-y-5
            [&_p]:m-0 [&_p]:leading-[1.8]
            [&_strong]:text-slate-900 [&_strong]:font-bold
            [&_ul]:list-none [&_ul]:p-0 [&_ul]:m-0 [&_ul]:space-y-0
            [&_li]:m-0"
          dangerouslySetInnerHTML={{ __html: mergedHtml }}
        />

        {showSignatures && (
          <div className="mt-10 pt-8 border-t border-slate-200 grid sm:grid-cols-2 gap-8 sm:gap-10">
            <SignatureBlock
              partyLabel="For BookMyBota (Platform):"
              title="Super Admin"
              signedAt={contract.admin_signed_at}
              signatureUrl={contract.admin_signature_url}
            />
            <SignatureBlock
              partyLabel="For Event Organizer:"
              title="Event Organizer"
              organizerName={contract.organizer_name}
              signedAt={contract.organizer_signed_at}
              signatureUrl={contract.organizer_signature_url}
            />
          </div>
        )}
      </div>
    </article>
  );
}

function SignatureBlock({
  partyLabel,
  title,
  organizerName,
  signedAt,
  signatureUrl,
}: {
  partyLabel: string;
  title: string;
  organizerName?: string | null;
  signedAt?: string | null;
  signatureUrl?: string | null;
}) {
  const dateLabel = signedAt
    ? new Date(signedAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-slate-900 mb-3">{partyLabel}</p>
      {signatureUrl ? (
        <div className="mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signatureUrl}
            alt={`${title} signature`}
            className="max-h-20 w-auto max-w-full object-contain object-left"
          />
        </div>
      ) : (
        <p className="mb-3 text-sm text-slate-400">Signature not yet provided</p>
      )}
      <div className="space-y-0.5 text-sm text-slate-600">
        <p className="font-bold text-slate-900">{organizerName || title}</p>
        <p className="text-slate-500">{title}</p>
        {dateLabel ? (
          <p className="font-bold text-slate-900 pt-1">Date: {dateLabel}</p>
        ) : (
          <p className="font-medium text-slate-500 pt-1">Awaiting signature + OTP</p>
        )}
        {signedAt && (
          <p className="text-xs text-slate-400">
            Signed {new Date(signedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
