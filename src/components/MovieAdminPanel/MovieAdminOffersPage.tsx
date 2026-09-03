"use client";

import Link from "next/link";
import { Loader2, Tag } from "lucide-react";
import { useGetActivePlatformOffersQuery } from "@/services/api";
import { formatOfferDiscount } from "@/lib/currencyFormat";

export default function MovieAdminOffersPage() {
  const { data: offers = [], isLoading } = useGetActivePlatformOffersQuery();

  const movieOffers = offers.filter(
    (offer) => offer.category === "MOVIES" || offer.category === "ALL"
  );

  return (
    <div className="w-full max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Tag size={20} className="text-fuchsia-400" />
          Movie Offers
        </h2>
        <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
          Platform movie offers shown on customer movie detail pages. To create or edit offers,
          use Super Admin →{" "}
          <Link href="/admin/platform-offers" className="text-fuchsia-600 hover:underline font-medium">
            Platform Offers
          </Link>{" "}
          and choose category <strong className="text-zinc-300 font-semibold">Movies only</strong>{" "}
          (or All categories).
        </p>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 p-5 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400 gap-2">
            <Loader2 className="animate-spin" size={22} />
            Loading offers…
          </div>
        ) : movieOffers.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-500 mb-4">
              <Tag size={26} />
            </div>
            <h3 className="text-lg font-bold portal-heading">No active movie offers</h3>
            <p className="text-sm portal-muted mt-2 max-w-md mx-auto">
              Ask your platform admin to create a Movies offer in Super Admin → Platform Offers.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {movieOffers.map((offer) => (
              <div
                key={offer.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 sm:px-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{offer.name}</p>
                    <p className="text-sm text-slate-600 mt-1">
                      Code:{" "}
                      <span className="font-mono font-medium text-slate-800">{offer.code}</span>
                    </p>
                    {offer.description && (
                      <p className="text-sm text-slate-500 mt-2 leading-relaxed">{offer.description}</p>
                    )}
                    {offer.min_order_amount > 0 && (
                      <p className="text-xs text-slate-500 mt-2">
                        Min. booking: {offer.min_order_amount} ETB
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-fuchsia-700">
                      {offer.discount_label ||
                        formatOfferDiscount(offer.discount_type, offer.discount_value)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wide font-semibold">
                      {offer.category}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
