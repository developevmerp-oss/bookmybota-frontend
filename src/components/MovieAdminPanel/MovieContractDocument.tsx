"use client";

import { mergeMovieContractHtml, type MovieContractRecord } from "@/lib/movieContractPlaceholders";

interface MovieContractDocumentProps {
  contract: MovieContractRecord;
  showSignatures?: boolean;
}

export default function MovieContractDocument({
  contract,
  showSignatures = true,
}: MovieContractDocumentProps) {
  const mergedHtml = mergeMovieContractHtml(contract);

  return (
    <article className="contract-document overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
      {/* Accent bar + document title */}
      <div className="h-1.5 w-full bg-gradient-to-r from-fuchsia-600 to-purple-600" aria-hidden />
      <div className="border-b border-slate-200 bg-slate-50 px-6 sm:px-8 py-4">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          Cinema Platform Agreement
        </h3>
      </div>

      <div className="px-6 sm:px-10 py-7 sm:py-9">
        <div className="flex flex-wrap justify-between gap-4 mb-8 pb-6 border-b border-slate-100">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">
              Contract Number
            </p>
            <p className="text-base sm:text-lg font-bold text-slate-900 font-mono">
              {contract.contract_number}
            </p>
          </div>
          {contract.cinema_name && (
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1">
                Cinema Partner
              </p>
              <p className="text-base sm:text-lg font-bold text-slate-900">
                {contract.cinema_name}
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
              partyLabel="For Cinema Partner:"
              title="Cinema Representative"
              cinemaName={contract.cinema_name}
              signedAt={contract.cinema_signed_at}
              signatureUrl={contract.cinema_signature_url}
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
  cinemaName,
  signedAt,
  signatureUrl,
}: {
  partyLabel: string;
  title: string;
  cinemaName?: string | null;
  signedAt?: string | null;
  signatureUrl?: string | null;
}) {
  return (
    <div className="rounded-lg border border-slate-200/90 bg-slate-50/60 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
        {partyLabel}
      </p>
      <p className="text-sm font-semibold text-slate-900 mb-3">{cinemaName || title}</p>
      {signatureUrl ? (
        <div className="my-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={signatureUrl}
            alt="Signature"
            className="h-16 max-w-[200px] object-contain border border-slate-200 rounded bg-white p-1"
          />
        </div>
      ) : (
        <div className="my-2 h-16 border border-dashed border-slate-300 rounded flex items-center justify-center text-xs text-slate-400">
          Not signed yet
        </div>
      )}
      <p className="text-[11px] text-slate-500 mt-2">
        {signedAt ? (
          <>
            Signed on{" "}
            <span className="font-medium text-slate-700">
              {new Date(signedAt).toLocaleString()}
            </span>
          </>
        ) : (
          "Pending signature"
        )}
      </p>
    </div>
  );
}
