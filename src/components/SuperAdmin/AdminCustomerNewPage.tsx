"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import PhoneInput from "@/components/Shared/PhoneInput";
import { extractApiError } from "@/lib/apiErrors";
import { useCreateAdminCustomerMutation } from "@/services/api";

export default function AdminCustomerNewPage() {
  const router = useRouter();
  const [createCustomer, { isLoading: saving }] = useCreateAdminCustomerMutation();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!phone.trim()) {
      toast.error("Phone is required.");
      return;
    }
    if (!email.trim()) {
      toast.error("Email is required for login.");
      return;
    }
    try {
      const res = await createCustomer({
        name: name.trim(),
        phone,
        email: email.trim(),
      }).unwrap();
      toast.success(res.message || "Customer created. Login credentials were emailed once.");
      router.push(res.data?.id ? `/admin/customers/${res.data.id}` : "/admin/customers");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to create customer"));
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <Link
        href="/admin/customers"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-white mb-6"
      >
        <ArrowLeft size={16} /> Back to customers
      </Link>
      <h1 className="text-2xl font-bold text-white mb-2">Add customer</h1>
      <p className="text-zinc-400 mb-8">
        Name, phone, and email are required. A login is created and a one-time password is emailed. Unarchive later
        does not send a new email.
      </p>

      <form onSubmit={onSubmit} className="glass-panel rounded-2xl border border-white/10 p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field w-full"
              required
            />
          </div>
          <PhoneInput
            value={phone}
            onChange={setPhone}
            variant="dark"
            label="Phone"
            required
            labelClassName="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2"
          />
          <div className="md:col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field w-full"
              required
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-8">
          <Link
            href="/admin/customers"
            className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/10"
          >
            Cancel
          </Link>
          <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
