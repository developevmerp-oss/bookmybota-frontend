"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  Mail,
  MapPin,
  Pencil,
  Phone,
  XCircle,
} from "lucide-react";
import PartnerDocumentsFields from "@/components/PartnerDocumentsFields";
import { useGetBusinessesQuery, type PartnerDocumentUpload } from "@/services/api";

interface AdminPartnerDetailPageProps {
  module: "dining" | "event";
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
      <p className="text-white text-sm leading-relaxed">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

export default function AdminPartnerDetailPage({ module }: AdminPartnerDetailPageProps) {
  const params = useParams();
  const id = String(params.id ?? "");
  const isDining = module === "dining";
  const listHref = `/admin/businesses/${module}`;
  const { data: businesses = [], isLoading } = useGetBusinessesQuery({ module });
  const biz = businesses.find((b) => String(b.id) === id);

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

  const documents: PartnerDocumentUpload[] = Array.isArray(biz.documents)
    ? biz.documents.filter((d) => d.document_type_id > 0 && d.url)
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href={listHref}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-white"
      >
        <ArrowLeft size={16} /> Back to {isDining ? "dining businesses" : "event organizers"}
      </Link>

      {biz.cover_image_url && (
        <div className="rounded-2xl overflow-hidden border border-white/10 h-52 bg-zinc-900">
          <img
            src={biz.cover_image_url}
            alt={biz.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="glass-panel rounded-2xl border border-white/10 p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {biz.is_enabled ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <CheckCircle size={12} /> Enabled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border bg-amber-500/10 text-amber-400 border-amber-500/20">
                  <XCircle size={12} /> Disabled
                </span>
              )}
              {isDining ? (
                biz.type_name && (
                  <span className="px-2 py-1 rounded-md text-xs font-semibold bg-white/5 text-zinc-300 border border-white/10">
                    {biz.type_name}
                  </span>
                )
              ) : (
                <span className="px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border bg-violet-500/10 text-violet-400 border-violet-500/20">
                  Event
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{biz.name}</h1>
            {biz.address && (
              <p className="text-zinc-400 mt-2 flex items-center gap-1.5 text-sm">
                <MapPin size={14} className="shrink-0" /> {biz.address}
              </p>
            )}
          </div>
          <Link
            href={`${listHref}/${biz.id}/edit`}
            className="btn-primary inline-flex items-center justify-center gap-2 shrink-0"
          >
            <Pencil size={16} /> Edit partner
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isDining && <Field label="Parent category" value={biz.parent_type_name} />}
          <Field label={isDining ? "Venue type" : "Module"} value={isDining ? biz.type_name : "Event"} />
          <Field label={isDining ? "Business name" : "Organizer name"} value={biz.name} />
          <Field label="Address" value={biz.address} />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Phone</p>
            <p className="text-white text-sm flex items-center gap-1.5">
              <Phone size={14} className="text-zinc-500 shrink-0" />
              {biz.phone?.trim() || "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">Admin email</p>
            <p className="text-white text-sm flex items-center gap-1.5">
              <Mail size={14} className="text-zinc-500 shrink-0" />
              {biz.admin_email?.trim() || "—"}
            </p>
            {biz.admin_role && (
              <p className="text-xs text-zinc-500 mt-1">{biz.admin_role}</p>
            )}
          </div>
          {isDining && <Field label="Cuisine" value={biz.cuisine} />}
          <div className="md:col-span-2">
            <Field label="Description" value={biz.description} />
          </div>
        </div>
      </div>

      <PartnerDocumentsFields
        module={module}
        value={documents}
        onChange={() => {}}
        variant="dark"
        editable={false}
      />
    </div>
  );
}
