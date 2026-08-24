"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import PhoneInput from "@/components/Shared/PhoneInput";
import { extractApiError } from "@/lib/apiErrors";
import { useCreateAdminCustomerMutation } from "@/services/api";
import {
  adminCustomerFormSchema,
  type AdminCustomerFormValues,
} from "@/lib/adminFormSchemas";

export default function AdminCustomerNewPage() {
  const router = useRouter();
  const [createCustomer, { isLoading: saving }] = useCreateAdminCustomerMutation();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdminCustomerFormValues>({
    resolver: yupResolver(adminCustomerFormSchema),
    defaultValues: { name: "", phone: "", email: "" },
    mode: "onSubmit",
  });

  const phone = watch("phone");

  const onValid = async (values: AdminCustomerFormValues) => {
    try {
      const res = await createCustomer({
        name: values.name.trim(),
        phone: values.phone,
        email: values.email.trim(),
      }).unwrap();
      toast.success(res.message || "Customer created. Login credentials were emailed once.");
      router.push(res.data?.id ? `/admin/customers/${res.data.id}` : "/admin/customers");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to create customer"));
    }
  };

  return (
    <div className="w-full">
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
