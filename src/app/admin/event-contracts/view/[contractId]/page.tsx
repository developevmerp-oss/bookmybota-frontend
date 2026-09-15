"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import EventContractDocument from "@/components/EventAdminPanel/EventContractDocument";
import { useGetAdminEventContractByIdQuery } from "@/services/api";
import { contractStatusLabel } from "@/lib/contractPlaceholders";

export default function AdminEventContractViewByIdPage() {
  const params = useParams();
  const contractId = String(params.contractId);
  const { data: contract, isLoading, isError } = useGetAdminEventContractByIdQuery(contractId);

  if (isLoading) {
    return <div className="p-10 text-center text-zinc-500">Loading contract…</div>;
  }

  if (isError || !contract) {
    return (
      <div className="p-10 text-center">
        <p className="text-zinc-500">Contract not found.</p>
        <Link href="/admin/event-contracts/history" className="text-rose-400 mt-2 inline-block">
          ← Old contracts
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href={contract.is_current ? `/admin/event-contracts/${contract.event_id}` : "/admin/event-contracts/history"}
          className="inline-flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 mb-3"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <h2 className="text-2xl font-bold text-white">{contract.event_name}</h2>
        <p className="text-zinc-400">
          {contractStatusLabel(contract.status)} · v{contract.version ?? 1}
          {contract.is_current ? " · Current" : " · Old"}
        </p>
      </div>
      <EventContractDocument contract={contract} />
    </div>
  );
}
