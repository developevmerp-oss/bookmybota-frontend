"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSignature, Plus } from "lucide-react";
import { useGetMovieContractsQuery } from "@/services/api";
import { movieContractStatusLabel } from "@/lib/movieContractPlaceholders";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { PAGE_SIZE } from "@/lib/pagination";

type Scope = "current" | "pending" | "old";

function resolveScope(pathname: string | null, scope?: Scope): Scope {
  if (scope === "pending" || pathname?.includes("/movie-contracts/pending")) return "pending";
  if (scope === "old" || pathname?.includes("/movie-contracts/history")) return "old";
  return "current";
}

function emptyMessage(scope: Scope) {
  if (scope === "pending") return "No pending movie contracts.";
  if (scope === "old") return "No old movie contracts yet.";
  return "No current movie contracts yet.";
}

export default function AdminMovieContractsListPage({ scope }: { scope?: Scope }) {
  const pathname = usePathname();
  const activeScope = resolveScope(pathname, scope);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const queryArg = useMemo(
    () => ({
      page,
      limit,
      scope: activeScope,
      ...(q.trim() ? { q: q.trim() } : {}),
    }),
    [page, limit, activeScope, q]
  );

  const { data, isLoading, isFetching, isError, error } = useGetMovieContractsQuery(queryArg, {
    refetchOnFocus: false,
    refetchOnReconnect: false,
  });
  const contracts = data?.items ?? [];

  if (isLoading) {
    return <AdminListShimmer rows={6} columns={5} showToolbar showTabs={false} />;
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/movie-contracts"
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeScope === "current"
              ? "bg-rose-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          Current Contracts
        </Link>
        <Link
          href="/admin/movie-contracts/pending"
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeScope === "pending"
              ? "bg-rose-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          Pending Contract
        </Link>
        <Link
          href="/admin/movie-contracts/history"
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeScope === "old"
              ? "bg-rose-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          Old Contracts
        </Link>
      </div>

      <div className="admin-list-toolbar">
        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search contract #, cinema name"
        />
        {activeScope === "current" || activeScope === "pending" ? (
          <Link
            href="/admin/movie-contracts/create"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus size={18} /> Create Cinema Contract
          </Link>
        ) : null}
      </div>

      {isError ? (
        <div className="glass-panel rounded-2xl border border-rose-500/30 p-6 text-center text-rose-300 text-sm">
          {(error as { data?: { error?: string } })?.data?.error ||
            "Could not load contracts. Restart the backend and try again."}
        </div>
      ) : contracts.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/5 p-10 text-center text-zinc-500">
          {emptyMessage(activeScope)}
        </div>
      ) : (
        <>
          {isFetching ? (
            <p className="text-xs text-zinc-500">Refreshing…</p>
          ) : null}
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
                    <span className="admin-data-card-label">Version</span>
                    <div className="admin-data-card-value">
                      v{c.version ?? 1}
                      {c.is_current === false ? " · edited" : ""}
                    </div>
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
                    href={
                      activeScope === "old" || c.is_current === false
                        ? `/admin/movie-contracts/view/${c.id}`
                        : `/admin/movie-contracts/${c.business_id}`
                    }
                    className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                  >
                    <FileSignature size={14} /> View
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
                    <th className="px-6 py-4">Version</th>
                    <th className="px-6 py-4">Convenience Fee</th>
                    <th className="px-6 py-4">Commission</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-white/5">
                      <td className="px-6 py-4 text-white font-medium">{c.contract_number}</td>
                      <td className="px-6 py-4 text-zinc-300">{c.cinema_name}</td>
                      <td className="px-6 py-4 text-zinc-400">
                        v{c.version ?? 1}
                        {c.is_current === false ? (
                          <span className="ml-1 text-xs text-amber-400">edited</span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-zinc-400">{c.convenience_fee_percent}%</td>
                      <td className="px-6 py-4 text-zinc-400">{c.commission_percent}%</td>
                      <td className="px-6 py-4 text-zinc-300">
                        {movieContractStatusLabel(c.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={
                            activeScope === "old" || c.is_current === false
                              ? `/admin/movie-contracts/view/${c.id}`
                              : `/admin/movie-contracts/${c.business_id}`
                          }
                          className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                        >
                          <FileSignature size={14} /> View
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
