"use client";

import { useState } from "react";
import { useGetAdminBusinessesQuery, useUpdateSubscriptionMutation } from "@/services/api";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { AdminListShimmer } from "@/components/Shared/Shimmer";
import { PAGE_SIZE } from "@/lib/pagination";

export default function BillingPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data, isLoading, isFetching } = useGetAdminBusinessesQuery({
    tab: "active",
    page,
    limit,
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const businesses = data?.items ?? [];
  const [updateSubscription] = useUpdateSubscriptionMutation();

  const handleSubscriptionUpdate = async (id: string, newPlan: string) => {
    try {
      await updateSubscription({ id, subscription_plan: newPlan }).unwrap();
    } catch (err) {
      console.error(err);
    }
  };

  const planBadge = (plan?: string) => (
    <span
      className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
        plan === "PRO"
          ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
          : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
      }`}
    >
      {plan || "FREE"}
    </span>
  );

  const actions = (biz: (typeof businesses)[number]) =>
    biz.subscription_plan === "PRO" ? (
      <button
        onClick={() => handleSubscriptionUpdate(biz.id, "FREE")}
        className="text-zinc-400 hover:text-white text-sm font-medium px-3 py-1 rounded-md border border-zinc-500/30 hover:bg-zinc-500/10 transition-colors"
      >
        Downgrade to Free
      </button>
    ) : (
      <button
        onClick={() => handleSubscriptionUpdate(biz.id, "PRO")}
        className="text-rose-500 hover:text-rose-400 text-sm font-medium px-3 py-1 rounded-md border border-rose-500/30 hover:bg-rose-500/10 transition-colors"
      >
        Upgrade to Pro
      </button>
    );

  if (isLoading) {
    return <AdminListShimmer rows={6} columns={4} showToolbar showTabs={false} />;
  }

  return (
    <div className="w-full">
      <div className="admin-list-toolbar">
        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search business, address, email"
        />
      </div>

      {isFetching && !isLoading ? (
        <AdminListShimmer rows={limit > 10 ? 8 : 5} columns={4} showTabs={false} showToolbar={false} />
      ) : businesses.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/5 text-center py-10 text-zinc-500">
          No businesses found.
        </div>
      ) : (
        <>
          <div className="admin-card-grid">
            {businesses.map((biz) => (
              <article key={biz.id} className="admin-data-card">
                <div className="admin-data-card-header">
                  <p className="admin-data-card-title">{biz.name}</p>
                </div>
                <div className="admin-data-card-body">
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Type</span>
                    <div className="admin-data-card-value">{biz.type_name || "Unspecified"}</div>
                  </div>
                  <div className="admin-data-card-row">
                    <span className="admin-data-card-label">Current Plan</span>
                    <div className="admin-data-card-value">{planBadge(biz.subscription_plan)}</div>
                  </div>
                </div>
                <div className="admin-data-card-actions">{actions(biz)}</div>
              </article>
            ))}
          </div>

          <div className="admin-table-desktop glass-panel rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400 text-sm">
                  <tr>
                    <th className="px-6 py-4 font-medium">Business Name</th>
                    <th className="px-6 py-4 font-medium">Type</th>
                    <th className="px-6 py-4 font-medium">Current Plan</th>
                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {businesses.map((biz) => (
                    <tr key={biz.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{biz.name}</td>
                      <td className="px-6 py-4 text-zinc-400">{biz.type_name || "Unspecified"}</td>
                      <td className="px-6 py-4">{planBadge(biz.subscription_plan)}</td>
                      <td className="px-6 py-4 text-right space-x-2">{actions(biz)}</td>
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
