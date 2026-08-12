"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export default function CustomerChangePasswordPage() {
  return (
    <div className="min-h-screen bg-background pt-10 pb-16">
      <div className="max-w-lg mx-auto px-4">
        <Link
          href="/customer/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft size={16} /> Back to settings
        </Link>
        <div className="glass-panel rounded-2xl border border-border p-6">
          <ChangePasswordForm variant="light" />
        </div>
      </div>
    </div>
  );
}
