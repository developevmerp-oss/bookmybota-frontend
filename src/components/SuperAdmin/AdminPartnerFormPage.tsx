"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import PartnerOnboardForm from "@/components/DiningAdminPanel/PartnerOnboardForm";
import { useGetAdminBusinessQuery } from "@/services/api";

interface AdminPartnerFormPageProps {
  module: "dining" | "event";
  mode: "create" | "edit";
}

export default function AdminPartnerFormPage({ module, mode }: AdminPartnerFormPageProps) {
  const params = useParams();
  const id = String(params.id ?? "");
  const isDining = module === "dining";
  const listHref = `/admin/businesses/${module}`;
  const detailHref = id ? `${listHref}/${id}` : listHref;
  const { data: biz, isLoading } = useGetAdminBusinessQuery(id, {
    skip: mode !== "edit" || !id,
  });

  if (mode === "create") {
    return (
      <div className="max-w-5xl mx-auto">
        <PartnerOnboardForm
          partnerType={module}
          variant="dark"
          mode="create"
          backHref={listHref}
          title={isDining ? "Onboard Dining Partner" : "Onboard Event Organizer"}
          subtitle={
            isDining
              ? "Select parent category and venue type. A temporary password is auto-generated and emailed to the admin."
              : "Select the Event parent — venue type stays disabled. A temporary password is auto-generated and emailed to the organizer."
          }
          successDetail="Partner onboarded. Login details are emailed after the account is enabled. Redirecting…"
        />
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-white p-10 text-center">Loading partner...</div>;
  }

  if (!biz) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400 mb-4">Partner not found.</p>
        <Link href={listHref} className="text-rose-500 hover:text-rose-400">
          Back to list
        </Link>
      </div>
    );
  }

  if (biz.deleted_at) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400 mb-4">This partner is archived. Unarchive them before editing.</p>
        <Link href={detailHref} className="text-rose-500 hover:text-rose-400">
          Back to details
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PartnerOnboardForm
        partnerType={module}
        variant="dark"
        mode="edit"
        editingBusiness={biz}
        backHref={detailHref}
        title={isDining ? "Edit Dining Partner" : "Edit Event Organizer"}
        subtitle="Update partner details. Login email cannot be changed from this page."
      />
    </div>
  );
}
