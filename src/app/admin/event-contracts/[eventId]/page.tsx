"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import EventContractDocument from "@/components/EventContractDocument";
import {
  useGetAdminEventContractQuery,
  useSignAdminEventContractMutation,
} from "@/services/api";
import { contractStatusLabel } from "@/lib/contractPlaceholders";
import { extractApiError } from "@/lib/apiErrors";

export default function AdminEventContractDetailPage() {
  const params = useParams();
  const eventId = String(params.eventId);

  const { data: contract, isLoading, isError } = useGetAdminEventContractQuery(eventId);
  const [signAdmin, { isLoading: signing }] = useSignAdminEventContractMutation();

  const handleSign = async () => {
    try {
      await signAdmin(eventId).unwrap();
      toast.success("Signed as Super Admin.");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to sign"));
    }
  };

  if (isLoading) {
    return <div className="p-10 text-center text-zinc-500">Loading contract…</div>;
  }

  if (isError || !contract) {
    return (
      <div className="p-10 text-center">
        <p className="text-zinc-500">Contract not found.</p>
        <Link href="/admin/event-contracts/create" className="text-rose-400 mt-2 inline-block">
          Create contract →
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/event-contracts"
          className="inline-flex items-center gap-1 text-sm text-rose-400 hover:text-rose-300 mb-3"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <h2 className="text-2xl font-bold text-white">{contract.event_name}</h2>
        <p className="text-zinc-400">{contractStatusLabel(contract.status)}</p>
      </div>

      <EventContractDocument contract={contract} />

      {!contract.admin_signed_at && contract.status === "PENDING_SIGNATURES" && (
        <button
          type="button"
          disabled={signing}
          onClick={handleSign}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {signing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
          Sign as Super Admin
        </button>
      )}
    </div>
  );
}
