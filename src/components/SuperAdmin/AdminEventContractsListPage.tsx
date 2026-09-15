"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileSignature, Plus } from "lucide-react";
import { useGetEventContractsQuery } from "@/services/api";
import { contractStatusLabel } from "@/lib/contractPlaceholders";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { PAGE_SIZE } from "@/lib/pagination";

type Scope = "current" | "old";

export default function AdminEventContractsPage({ scope = "current" }: { scope?: Scope }) {
  const pathname = usePathname();
  const activeScope: Scope =
    scope === "old" || pathname?.includes("/event-contracts/history") ? "old" : "current";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data, isLoading, isFetching } = useGetEventContractsQuery({
    page,
    limit,
    scope: activeScope,
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const contracts = data?.items ?? [];

  if (isLoading) {
    return <AdminListShimmer rows={6} columns={5} showToolbar showTabs={false} />;
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/event-contracts"
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            activeScope === "current"
              ? "bg-rose-600 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
        >
          Current Contracts
        </Link>
        <Link
          href="/admin/event-contracts/history"
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
          placeholder="Search contract, event, organizer"
        />
        {activeScope === "current" ? (
          <Link
            href="/admin/event-contracts/create"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
          >
            <Plus size={18} /> Create contract
          </Link>
        ) : null}
      </div>

      {isFetching && !isLoading ? (
        <AdminListShimmer rows={limit > 10 ? 8 : 5} columns={5} showTabs={false} showToolbar={false} />
      ) : contracts.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/5 p-10 text-center text-zinc-500">
          {activeScope === "old" ? "No old contracts yet." : "No current contracts yet."}
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
                    <span className="admin-data-card-label">Event</span>
                    <div className="admin-data-card-value">{c.event_name}</div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Organizer</span>
                    <div className="admin-data-card-value">{c.organizer_name}</div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Version</span>
                    <div className="admin-data-card-value">v{c.version ?? 1}</div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Status</span>
                    <div className="admin-data-card-value">{contractStatusLabel(c.status)}</div>
                  </div>
                </div>
                <div className="admin-data-card-actions">
                  <Link
                    href={
                      activeScope === "old"
                        ? `/admin/event-contracts/view/${c.id}`
                        : `/admin/event-contracts/${c.event_id}`
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
                    <th className="px-6 py-4">Contract</th>
                    <th className="px-6 py-4">Event</th>
                    <th className="px-6 py-4">Organizer</th>
                    <th className="px-6 py-4">Version</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-white/5">
                      <td className="px-6 py-4 text-white font-medium">{c.contract_number}</td>
                      <td className="px-6 py-4 text-zinc-300">{c.event_name}</td>
                      <td className="px-6 py-4 text-zinc-400">{c.organizer_name}</td>
                      <td className="px-6 py-4 text-zinc-400">v{c.version ?? 1}</td>
                      <td className="px-6 py-4 text-zinc-300">{contractStatusLabel(c.status)}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={
                            activeScope === "old"
                              ? `/admin/event-contracts/view/${c.id}`
                              : `/admin/event-contracts/${c.event_id}`
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
