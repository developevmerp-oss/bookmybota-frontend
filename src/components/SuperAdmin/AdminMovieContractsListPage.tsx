"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import { useGetMovieContractsQuery } from "@/services/api";
import { movieContractStatusLabel } from "@/lib/movieContractPlaceholders";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { PAGE_SIZE } from "@/lib/pagination";

export default function AdminMovieContractsListPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data, isLoading, isFetching } = useGetMovieContractsQuery({
    page,
    limit,
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const contracts = data?.items ?? [];

  if (isLoading) {
    return <AdminListShimmer rows={6} columns={5} showToolbar showTabs={false} />;
  }

  return (
    <div className="w-full space-y-6">
      <div className="admin-list-toolbar">
        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search contract #, cinema name"
        />
        <Link
          href="/admin/movie-contracts/create"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus size={18} /> Create Cinema Contract
        </Link>
      </div>

      {isFetching && !isLoading ? (
        <AdminListShimmer rows={limit > 10 ? 8 : 5} columns={5} showTabs={false} showToolbar={false} />
      ) : contracts.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/5 p-10 text-center text-zinc-500">
          No movie cinema contracts found.
        </div>
      ) : (
        <>
          <div className="admin-card-grid">
            {contracts.map((c) => (
              <article key={c.id} className="admin-data-card">
                <div className="admin-data-card-header">
                  <p className="admin-data-card-title">{c.contract_number}</p>
                </div>
                <div className="admin-data-card-body">
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Cinema</span>
                    <div className="admin-data-card-value">{c.cinema_name}</div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Fee / Comm</span>
                    <div className="admin-data-card-value">
                      {c.convenience_fee_percent}% / {c.commission_percent}%
                    </div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Status</span>
                    <div className="admin-data-card-value">{movieContractStatusLabel(c.status)}</div>
                  </div>
                </div>
                <div className="admin-data-card-actions">
                  <Link
                    href={`/admin/movie-contracts/${c.business_id}`}
                    className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                  >
                    <FileSignature size={14} /> View / Sign
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="admin-table-desktop glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400">
                  <tr>
                    <th className="px-6 py-4">Contract #</th>
                    <th className="px-6 py-4">Cinema Partner</th>
                    <th className="px-6 py-4">Convenience Fee</th>
                    <th className="px-6 py-4">Commission</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-white font-mono font-medium">{c.contract_number}</td>
                      <td className="px-6 py-4 text-zinc-300 font-medium">{c.cinema_name}</td>
                      <td className="px-6 py-4 text-zinc-400">{c.convenience_fee_percent}%</td>
                      <td className="px-6 py-4 text-zinc-400">{c.commission_percent}%</td>
                      <td className="px-6 py-4 text-zinc-300">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            c.status === "ACTIVE"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                              : c.status === "REJECTED"
                              ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {movieContractStatusLabel(c.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/movie-contracts/${c.business_id}`}
                          className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 font-medium"
                        >
                          <FileSignature size={14} /> View / Sign
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <div className="admin-list-footer">
        <Pagination
          meta={
            data?.meta ?? {
              page,
              limit,
              total: 0,
              total_pages: 0,
              has_prev: false,
              has_next: false,
            }
          }
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
          disabled={isFetching}
        />
      </div>
    </div>
  );
}
