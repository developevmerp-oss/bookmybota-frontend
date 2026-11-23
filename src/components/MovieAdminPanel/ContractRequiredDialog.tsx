"use client";

import Link from "next/link";
import { FileSignature, X } from "lucide-react";

interface ContractRequiredDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Shown when a cinema tries to schedule a show before signing its contract. */
export default function ContractRequiredDialog({ open, onClose }: ContractRequiredDialogProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-required-title"
        className="relative w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl px-6 py-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          <X size={18} />
        </button>
        <div className="w-16 h-16 rounded-full bg-rose-50 text-[#e11d48] flex items-center justify-center mx-auto mb-4">
          <FileSignature size={30} />
        </div>
        <h2 id="contract-required-title" className="text-xl font-bold text-slate-900 mb-2">
          Create your contract first
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          You need to sign your cinema contract before you can schedule shows.
        </p>
        <Link
          href="/movie/contract"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#e11d48] hover:bg-[#be123c] text-white py-3 text-sm font-bold"
        >
          <FileSignature size={16} /> Create contract
        </Link>
      </div>
    </div>
  );
}
