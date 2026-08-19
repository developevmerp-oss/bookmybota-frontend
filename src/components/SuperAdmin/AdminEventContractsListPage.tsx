"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import { useGetEventContractsQuery } from "@/services/api";
import { contractStatusLabel } from "@/lib/contractPlaceholders";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";

export default function AdminEventContractsPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetEventContractsQuery({
    page,
    limit: PAGE_SIZE,
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const contracts = data?.items ?? [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Event Contracts</h2>
          <p className="text-zinc-400 mt-1">
            Dynamic contracts between platform and event organizers. Events go public only after both signatures.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search contract, event, organizer"
          />
          <Link
            href="/admin/event-contracts/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
          >
            <Plus size={18} /> Create contract
          </Link>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-zinc-500">Loading…</div>
        ) : contracts.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">No contracts yet.</div>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400">
                <tr>
                  <th className="px-6 py-4">Contract</th>
                  <th className="px-6 py-4">Event</th>
                  <th className="px-6 py-4">Organizer</th>
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
                    <td className="px-6 py-4 text-zinc-300">{contractStatusLabel(c.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/event-contracts/${c.event_id}`}
                        className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                      >
                        <FileSignature size={14} /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data?.meta && <Pagination meta={data.meta} onPageChange={setPage} />}
          </>
        )}
      </div>
    </div>
  );
}
