"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import PhoneInput from "@/components/Shared/PhoneInput";
import { extractApiError } from "@/lib/apiErrors";
import { useGetAdminCustomerQuery, useUpdateAdminCustomerMutation } from "@/services/api";
import {
  adminCustomerEditSchema,
  type AdminCustomerEditValues,
} from "@/lib/adminFormSchemas";

export default function AdminCustomerEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const { data: c, isLoading } = useGetAdminCustomerQuery(id, { skip: !id });
  const [updateCustomer, { isLoading: saving }] = useUpdateAdminCustomerMutation();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AdminCustomerEditValues>({
    resolver: yupResolver(adminCustomerEditSchema),
    defaultValues: { name: "", phone: "", email: "" },
    mode: "onSubmit",
  });

  const phone = watch("phone");

  useEffect(() => {
    if (!c) return;
    reset({
      name: c.name || "",
      phone: c.phone || "",
      email: c.user_email || c.email || "",
    });
  }, [c, reset]);

  const onValid = async (values: AdminCustomerEditValues) => {
    try {
      const res = await updateCustomer({
        id,
        name: values.name.trim(),
        phone: values.phone,
        email: values.email?.trim() || undefined,
      }).unwrap();
      toast.success(
        (res as { message?: string })?.message || "Customer updated"
      );
      router.push(`/admin/customers/${id}`);
    } catch (err) {
      toast.error(extractApiError(err, "Update failed"));
    }
  };

  if (isLoading) {
    return <div className="text-white p-10 text-center">Loading customer...</div>;
  }

  if (!c) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400 mb-4">Customer not found.</p>
        <Link href="/admin/customers" className="text-rose-500 hover:text-rose-400">
          Back to list
        </Link>
      </div>
    );
  }

  if (c.deleted_at) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-400 mb-4">This customer is archived. Unarchive them before editing.</p>
        <Link href={`/admin/customers/${id}`} className="text-rose-500 hover:text-rose-400">
          Back to details
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Link
        href={`/admin/customers/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 hover:text-white mb-6"
      >
        <ArrowLeft size={16} /> Back to details
      </Link>
      <h1 className="text-2xl font-bold text-white mb-2">Edit customer</h1>
      <p className="text-zinc-400 mb-8">Update name, phone, and email. Password is not changed here.</p>

      <form
        onSubmit={handleSubmit(onValid)}
        className="glass-panel rounded-2xl border border-white/10 p-6 md:p-8"
        noValidate
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
              Name
            </label>
            <input {...register("name")} className="input-field w-full" />
            {errors.name && (
              <p className="mt-1.5 text-xs text-rose-400 font-medium">{errors.name.message}</p>
            )}
          </div>
          <PhoneInput
            value={phone || ""}
            onChange={(v) => setValue("phone", v, { shouldValidate: true, shouldDirty: true })}
            variant="dark"
            label="Phone"
            required
            error={errors.phone?.message}
            showError={Boolean(errors.phone)}
            labelClassName="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2"
          />
          <div className="md:col-span-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
              Email
            </label>
            <input type="email" {...register("email")} className="input-field w-full" />
            {errors.email && (
              <p className="mt-1.5 text-xs text-rose-400 font-medium">{errors.email.message}</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-8">
          <Link
            href={`/admin/customers/${id}`}
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
