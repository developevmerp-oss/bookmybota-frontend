"use client";

import Link from "next/link";
import { FilePlus2, FileSignature, Pencil } from "lucide-react";
import { useGetAdminMovieContractHistoryQuery, type MovieContract } from "@/services/api";
import { movieContractStatusLabel } from "@/lib/movieContractPlaceholders";
import { formatDateTime12h } from "@/lib/dateFormat";

const TONE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING_SIGNATURES: "bg-amber-50 text-amber-700 border-amber-200",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200",
  SUPERSEDED: "bg-slate-100 text-slate-600 border-slate-200",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

/** A cinema contract: the current one with create / edit, and every earlier version. */
export default function PartnerContractTab({ businessId }: { businessId: string }) {
  const { data, isLoading } = useGetAdminMovieContractHistoryQuery(businessId);
  const all: MovieContract[] = [...(data?.contracts || [])].sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );
  const current = all.find((c) => c.is_current) || all.find((c) => c.status !== "SUPERSEDED") || null;
  const previous = all.filter((c) => c.id !== current?.id);

  if (isLoading) return <p className="py-10 text-center text-sm text-slate-500">Loading contract…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <FileSignature size={16} className="text-rose-600" /> Contract
        </p>
        {!current ? (
          <Link href={`/admin/movie-contracts/create?businessId=${businessId}`} className="btn-primary !py-2 !px-3 text-sm inline-flex items-center gap-1.5">
            <FilePlus2 size={15} /> Create contract
          </Link>
        ) : (
          <Link
            href={`/admin/movie-contracts/create?businessId=${businessId}&mode=revise`}
            className="btn-primary !py-2 !px-3 text-sm inline-flex items-center gap-1.5"
          >
            <Pencil size={15} /> Edit contract
          </Link>
        )}
      </div>

      {current ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-extrabold text-slate-900">{current.contract_number}</p>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                Current · v{current.version ?? 1}
              </span>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE[current.status] || ""}`}>
                {movieContractStatusLabel(current.status)}
              </span>
            </div>
            <Link href={`/admin/movie-contracts/view/${current.id}`} className="btn-secondary !py-1.5 !px-3 text-xs">
              View contract
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Row label="Commission" value={`${Number(current.commission_percent)}%`} />
            <Row label="Convenience fee" value={`${Number(current.convenience_fee_percent)}%`} />
            <Row label="Beverage commission" value={`${Number(current.beverage_commission_percent ?? 0)}%`} />
            <Row label="Admin signed" value={current.admin_signed_at ? formatDateTime12h(current.admin_signed_at) : "Not yet"} />
            <Row label="Cinema signed" value={current.cinema_signed_at ? formatDateTime12h(current.cinema_signed_at) : "Not yet"} />
          </div>
          {current.status === "PENDING_SIGNATURES" ? (
            <Link href={`/admin/movie-contracts/${businessId}`} className="inline-block text-xs font-semibold text-rose-600 hover:underline">
              Open signing page
            </Link>
          ) : null}
          {current.rejection_reason ? <p className="text-xs text-rose-600">Rejected: {current.rejection_reason}</p> : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">
          This cinema has no contract yet. Create one so shows can be scheduled.
        </div>
      )}

      {previous.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <p className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-900">Previous contracts</p>
          <div className="divide-y divide-slate-100">
            {previous.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">
                    {c.contract_number} <span className="text-xs font-normal text-slate-500">v{c.version ?? 1}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.created_at ? formatDateTime12h(c.created_at) : ""} · commission {Number(c.commission_percent)}% · fee {Number(c.convenience_fee_percent)}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE[c.status] || ""}`}>
                    {movieContractStatusLabel(c.status)}
                  </span>
                  <Link href={`/admin/movie-contracts/view/${c.id}`} className="btn-secondary !py-1 !px-2.5 text-xs">
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
