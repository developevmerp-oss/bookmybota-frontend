"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useGetMyGiftCardQuery } from "@/services/api";
import { formatMoney } from "@/lib/currencyFormat";
import CustomerAccountLayout from "@/components/Shared/CustomerAccountLayout";

export default function CustomerGiftCardDetailPage() {
  const params = useParams();
  const id = String(params?.id || "");
  const { data: card, isLoading, isError } = useGetMyGiftCardQuery(id, { skip: !id });

  return (
    <CustomerAccountLayout>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
        <Link
          href="/customer/gift-cards"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#6900AA] mb-5"
        >
          <ArrowLeft size={16} />
          My Gift Cards
        </Link>

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
            <Loader2 className="animate-spin" size={18} /> Loading…
          </div>
        ) : isError || !card ? (
          <p className="text-center text-rose-600 py-10">Gift card not found.</p>
        ) : (
          <>
            <div className="rounded-2xl bg-gradient-to-br from-[#6900AA] to-[#9B2DE3] text-white p-6 mb-6">
              <p className="text-sm text-white/80">{card.product_name}</p>
              <p className="text-3xl font-extrabold mt-1">
                {formatMoney(Number(card.current_balance), { compact: true })}
              </p>
              <p className="text-sm text-white/70 mt-1 font-mono">{card.code_masked}</p>
              <div className="flex flex-wrap gap-3 mt-4 text-xs text-white/80">
                <span className="px-2 py-1 rounded-md bg-white/15">{card.status}</span>
                {card.expires_at ? (
                  <span>Expires {new Date(card.expires_at).toLocaleDateString()}</span>
                ) : null}
              </div>
            </div>

            <dl className="grid sm:grid-cols-2 gap-4 text-sm mb-8">
              <div>
                <dt className="text-slate-500">Initial balance</dt>
                <dd className="font-semibold text-[#111111]">
                  {formatMoney(Number(card.initial_balance), { compact: true })}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Used</dt>
                <dd className="font-semibold text-[#111111]">
                  {formatMoney(Number(card.used_amount || 0), { compact: true })}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Purchase</dt>
                <dd className="font-semibold text-[#111111]">
                  {card.purchase_for === "SOMEONE_ELSE" ? "Gift for someone else" : "For myself"}
                </dd>
              </div>
              {card.recipient_name ? (
                <div>
                  <dt className="text-slate-500">Recipient</dt>
                  <dd className="font-semibold text-[#111111]">{card.recipient_name}</dd>
                </div>
              ) : null}
            </dl>

            <h3 className="text-sm font-bold text-[#111111] mb-3 uppercase tracking-wide">
              Transactions
            </h3>
            {!card.transactions?.length ? (
              <p className="text-sm text-slate-500">No transactions yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {card.transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm bg-white"
                  >
                    <div>
                      <p className="font-semibold text-[#111111]">{tx.transaction_type}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(tx.created_at).toLocaleString()}
                        {tx.notes ? ` · ${tx.notes}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#6900AA]">
                        {formatMoney(Number(tx.amount), { compact: true })}
                      </p>
                      <p className="text-xs text-slate-500">
                        Bal. {formatMoney(Number(tx.balance_after), { compact: true })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </CustomerAccountLayout>
  );
}
// comments 