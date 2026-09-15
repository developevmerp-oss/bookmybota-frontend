"use client";

import { useState } from "react";
import Link from "next/link";
import { FileSignature } from "lucide-react";
import { useGetOrganizerEventContractsQuery } from "@/services/api";
import { contractStatusLabel } from "@/lib/contractPlaceholders";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";

type Scope = "current" | "old";

export default function OrganizerContractsListPage({ scope = "current" }: { scope?: Scope }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data, isLoading, isFetching } = useGetOrganizerEventContractsQuery({
    page,
    limit,
    scope,
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const contracts = data?.items ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="portal-heading text-2xl font-bold">
          {scope === "old" ? "Old Contracts" : "Current Contract"}
        </h2>
        <p className="portal-muted mt-1">
          {scope === "old"
            ? "Previous versions superseded when Super Admin edited a contract."
            : "Your active and pending platform contracts. Sign any that still need your authorization."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/organizer/contracts"
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            scope === "current"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Current Contract
        </Link>
        <Link
          href="/organizer/contracts/history"
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            scope === "old"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Old Contracts
        </Link>
      </div>

      <SearchInput
        value={q}
        onChange={(value) => {
          setQ(value);
          setPage(1);
        }}
        placeholder="Search contract or event"
      />

      {isLoading ? (
        <p className="portal-muted text-center py-10">Loading…</p>
      ) : contracts.length === 0 ? (
        <div className="org-card p-10 text-center portal-muted">
          {scope === "old" ? "No old contracts yet." : "No current contracts yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <article
              key={c.id}
              className="org-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="portal-heading font-semibold truncate">{c.event_name}</p>
                <p className="text-sm portal-muted">
                  {c.contract_number} · v{c.version ?? 1} · {contractStatusLabel(c.status)}
                </p>
              </div>
              <Link
                href={
                  scope === "old"
                    ? `/organizer/contracts/view/${c.id}`
                    : `/organizer/events/${c.event_id}/contract`
                }
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
              >
                <FileSignature size={14} />
                {scope === "old"
                  ? "View"
                  : c.status === "PENDING_SIGNATURES" && !c.organizer_signed_at
                    ? "Sign →"
                    : "View"}
              </Link>
            </article>
          ))}
        </div>
      )}

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
  );
}
