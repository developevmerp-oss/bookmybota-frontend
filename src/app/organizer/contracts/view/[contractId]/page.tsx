"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import EventContractDocument from "@/components/EventAdminPanel/EventContractDocument";
import { useGetOrganizerEventContractByIdQuery } from "@/services/api";
import { contractStatusLabel } from "@/lib/contractPlaceholders";

export default function OrganizerContractViewByIdPage() {
  const params = useParams();
  const contractId = String(params.contractId);
  const { data: contract, isLoading, isError } = useGetOrganizerEventContractByIdQuery(contractId);

  if (isLoading) {
    return <div className="p-10 text-center portal-muted">Loading contract…</div>;
  }

  if (isError || !contract) {
    return (
      <div className="p-10 text-center space-y-3">
        <p className="portal-muted">Contract not found.</p>
        <Link href="/organizer/contracts/history" className="text-rose-600 hover:underline">
          ← Old contracts
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href={
            contract.is_current
              ? `/organizer/events/${contract.event_id}/contract`
              : "/organizer/contracts/history"
          }
          className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-800 mb-3"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <h2 className="portal-heading text-2xl font-bold">{contract.event_name}</h2>
        <p className="portal-muted">
          {contractStatusLabel(contract.status)} · v{contract.version ?? 1}
          {contract.is_current ? " · Current" : " · Old"}
        </p>
      </div>
      <EventContractDocument contract={contract} />
    </div>
  );
}
