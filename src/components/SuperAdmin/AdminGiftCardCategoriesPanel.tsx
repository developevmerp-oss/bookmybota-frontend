"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { Loader2, Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateGiftCardDesignCategoryMutation,
  useDeleteGiftCardDesignCategoryMutation,
  useGetGiftCardDesignCategoriesQuery,
  usePatchGiftCardDesignCategoryStatusMutation,
  useUpdateGiftCardDesignCategoryMutation,
  type GiftCardDesignCategory,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import {
  adminGiftCardCategorySchema,
  emptyAdminGiftCardCategoryValues,
  type AdminGiftCardCategoryValues,
} from "@/lib/giftCardFormSchemas";

const fieldErrorClass = "mt-1.5 text-xs text-rose-400 font-medium";
const labelClass = "block text-xs font-semibold text-slate-500 uppercase mb-2";
const inputClass = "input-field";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

function ActiveToggle({
  active,
  onToggle,
  disabled,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
        active
          ? "bg-green-500/30 border-green-500/50"
          : "bg-zinc-700/50 border-zinc-600"
      }`}
      title={active ? "Enabled — click to disable" : "Disabled — click to enable"}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          active ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function AdminGiftCardCategoriesPanel() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<GiftCardDesignCategory | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<GiftCardDesignCategory | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AdminGiftCardCategoryValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(adminGiftCardCategorySchema) as any,
    defaultValues: emptyAdminGiftCardCategoryValues(),
    mode: "onSubmit",
  });

  const { data, isLoading } = useGetGiftCardDesignCategoriesQuery({
    page,
    limit: PAGE_SIZE,
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const [createCategory, { isLoading: creating }] =
    useCreateGiftCardDesignCategoryMutation();
  const [updateCategory, { isLoading: updating }] =
    useUpdateGiftCardDesignCategoryMutation();
  const [patchStatus] = usePatchGiftCardDesignCategoryStatusMutation();
  const [deleteCategory] = useDeleteGiftCardDesignCategoryMutation();

  const items = data?.items ?? [];
  const meta = data?.meta;
  const saving = creating || updating;

  const startEdit = (row: GiftCardDesignCategory) => {
    setEditing(row);
    reset({
      name: row.name,
      description: row.description || "",
    });
  };

  const cancelEdit = () => {
    setEditing(null);
    reset(emptyAdminGiftCardCategoryValues());
  };

  const onValid = async (values: AdminGiftCardCategoryValues) => {
    const name = values.name.trim();
    const description = values.description?.trim() || "";
    try {
      if (editing) {
        const res = await updateCategory({
          id: editing.id,
          name,
          description,
          is_active: editing.is_active !== false,
        }).unwrap();
        toast.success(res.message || "Category updated");
        cancelEdit();
      } else {
        const res = await createCategory({
          name,
          description,
          is_active: true,
        }).unwrap();
        toast.success(res.message || "Category created");
        reset(emptyAdminGiftCardCategoryValues());
      }
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save category"));
    }
  };

  const confirmStatus = async () => {
    if (!pendingStatus) return;
    const next = pendingStatus.is_active === false;
    setConfirmBusy(true);
    try {
      const res = await patchStatus({ id: pendingStatus.id, is_active: next }).unwrap();
      toast.success(res.message || (next ? "Category enabled" : "Category disabled"));
      setPendingStatus(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update status"));
    } finally {
      setConfirmBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    setConfirmBusy(true);
    try {
      const res = await deleteCategory(pendingDeleteId).unwrap();
      toast.success(res.message || "Category deleted");
      setPendingDeleteId(null);
      if (editing?.id === pendingDeleteId) cancelEdit();
    } catch (err) {
      toast.error(extractApiError(err, "Failed to delete category"));
    } finally {
      setConfirmBusy(false);
    }
  };

  const statusPendingNext = pendingStatus
    ? pendingStatus.is_active === false
    : false;

  return (
    <section className="glass-panel rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 inline-flex items-center gap-2">
            <Tags size={18} className="text-rose-500" />
            Design categories
          </h2>
          <p className="mt-1 text-xs text-slate-500 max-w-xl">
            Master list for Add Design and customer filters on /gift-cards. Name is the label
            customers see; description is for admin reference.
          </p>
        </div>
        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search categories"
          className="sm:w-56"
        />
      </div>

      <form
        onSubmit={handleSubmit(onValid)}
        noValidate
        className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end rounded-xl border border-slate-200 bg-slate-50 p-3"
      >
        <div className="sm:col-span-4">
          <label className={labelClass}>
            Name <RequiredMark />
          </label>
          <input
            {...register("name")}
            className={inputClass}
            placeholder="Entertaining Gifts"
          />
          {errors.name && <p className={fieldErrorClass}>{errors.name.message}</p>}
        </div>
        <div className="sm:col-span-5">
          <label className={labelClass}>Description</label>
          <input
            {...register("description")}
            className={inputClass}
            placeholder="Short note for this category"
          />
          {errors.description && (
            <p className={fieldErrorClass}>{errors.description.message}</p>
          )}
        </div>
        <div className="sm:col-span-3 flex gap-2">
          {editing && (
            <button
              type="button"
              onClick={cancelEdit}
              className="h-11 flex-1 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-100"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="h-11 flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : editing ? (
              <Pencil size={16} />
            ) : (
              <Plus size={16} />
            )}
            {editing ? "Update" : "Add"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500 border-b border-white/10 bg-white/[0.03]">
              <th className="px-3 py-2.5 font-semibold">Name</th>
              <th className="px-3 py-2.5 font-semibold">Description</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-zinc-500">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Loading…
                  </span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-10 text-center text-zinc-500">
                  No categories yet. Add one above.
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const active = row.is_active !== false;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-white/5 last:border-0 hover:bg-white/[0.03] ${
                      !active ? "opacity-70" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 text-white font-medium">{row.name}</td>
                    <td className="px-3 py-2.5 text-slate-700 max-w-[280px] truncate">
                      {row.description?.trim() || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
                          active
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
                        }`}
                      >
                        {active ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <ActiveToggle
                          active={active}
                          onToggle={() => setPendingStatus(row)}
                        />
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(row.id)}
                          className="p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-white/5"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {meta && <Pagination meta={meta} onPageChange={setPage} />}

      <ConfirmDialog
        open={Boolean(pendingStatus)}
        title={statusPendingNext ? "Enable category?" : "Disable category?"}
        body={
          pendingStatus
            ? statusPendingNext
              ? `Enable "${pendingStatus.name}"? It will appear in Add Design and customer filters.`
              : `Disable "${pendingStatus.name}"? It will be hidden from Add Design and customer filters.`
            : ""
        }
        confirmLabel={statusPendingNext ? "Enable" : "Disable"}
        danger={!statusPendingNext}
        variant={statusPendingNext ? "success" : "warning"}
        busy={confirmBusy}
        onCancel={() => setPendingStatus(null)}
        onConfirm={() => void confirmStatus()}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Delete category?"
        body="Only unused categories can be deleted. If designs use this category, disable it instead."
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  );
}
