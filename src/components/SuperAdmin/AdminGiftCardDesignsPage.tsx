"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  Archive,
  ImagePlus,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCreateGiftCardDesignMutation,
  useDeleteGiftCardDesignMutation,
  useGetGiftCardDesignCategoriesQuery,
  useGetGiftCardDesignsQuery,
  usePatchGiftCardDesignStatusMutation,
  useUpdateGiftCardDesignMutation,
  useUploadImageMutation,
  type GiftCardDesign,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { extractUploadUrl } from "@/lib/mediaUrl";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import { DEFAULT_DESIGN_GRADIENT } from "@/lib/giftCardDesigns";
import GiftCardDesignFace from "@/components/GiftCards/GiftCardDesignFace";
import ImageCropPicker from "@/components/Shared/ImageCropPicker";
import {
  adminGiftCardDesignSchema,
  emptyAdminGiftCardDesignValues,
  type AdminGiftCardDesignValues,
} from "@/lib/giftCardFormSchemas";

type TabKey = "ALL" | "ACTIVE" | "DRAFT" | "PAUSED" | "ARCHIVED";

const STATUS_TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "DRAFT", label: "Draft" },
  { key: "PAUSED", label: "Paused" },
  { key: "ARCHIVED", label: "Archived" },
];

const fieldErrorClass = "mt-1.5 text-xs text-rose-400 font-medium";
const labelClass = "block text-xs font-semibold text-slate-500 uppercase mb-2";
const inputClass = "input-field";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

function statusBadge(status?: string) {
  const s = (status || "DRAFT").toUpperCase();
  const colors: Record<string, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    DRAFT: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    PAUSED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    ARCHIVED: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
        colors[s] || colors.DRAFT
      }`}
    >
      {s}
    </span>
  );
}

function designToForm(d: GiftCardDesign): AdminGiftCardDesignValues {
  return {
    title: d.title || "",
    category: d.category || "",
    image_url: d.image_url || "",
    color_gradient: d.color_gradient || DEFAULT_DESIGN_GRADIENT,
    caption_color: d.caption_color || "#FFFFFF",
    text_color: d.text_color || "#FFFFFF",
    status: d.status === "ACTIVE" || d.status === "PAUSED" ? d.status : "DRAFT",
  };
}

export default function AdminGiftCardDesignsPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSortOrder, setEditingSortOrder] = useState(0);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdminGiftCardDesignValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(adminGiftCardDesignSchema) as any,
    defaultValues: emptyAdminGiftCardDesignValues(),
    mode: "onSubmit",
  });

  const titleWatch = watch("title");
  const imageUrlWatch = watch("image_url");
  const gradientWatch = watch("color_gradient");
  const captionWatch = watch("caption_color");
  const textColorWatch = watch("text_color");
  const categoryWatch = watch("category");

  const listArg = {
    page,
    limit: PAGE_SIZE,
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(tab !== "ALL" ? { status: tab } : {}),
  };

  const { data, isLoading } = useGetGiftCardDesignsQuery(listArg);
  const { data: categoriesData } = useGetGiftCardDesignCategoriesQuery({
    page: 1,
    limit: 100,
  });
  const [createDesign, { isLoading: creating }] = useCreateGiftCardDesignMutation();
  const [updateDesign, { isLoading: updating }] = useUpdateGiftCardDesignMutation();
  const [patchStatus] = usePatchGiftCardDesignStatusMutation();
  const [deleteDesign] = useDeleteGiftCardDesignMutation();
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();

  const designs = data?.items ?? [];
  const meta = data?.meta;
  const allCategories = categoriesData?.items ?? [];
  const activeCategories = allCategories.filter((c) => c.is_active !== false);
  const categoryNameByCode = Object.fromEntries(
    allCategories.map((c) => [c.code, c.name])
  );
  const defaultCategoryCode = activeCategories[0]?.code || "";

  const openCreate = () => {
    setEditingId(null);
    setEditingSortOrder(0);
    reset(emptyAdminGiftCardDesignValues(defaultCategoryCode));
    setFormOpen(true);
  };

  const openEdit = (d: GiftCardDesign) => {
    setEditingId(d.id);
    setEditingSortOrder(d.sort_order ?? 0);
    reset(designToForm(d));
    setFormOpen(true);
  };

  const handleUpload = async (file: File) => {
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await uploadImage(fd).unwrap();
      const url = extractUploadUrl(res) || res.url;
      if (!url) {
        toast.error("Upload succeeded but no URL returned");
        return;
      }
      setValue("image_url", url, { shouldValidate: true, shouldDirty: true });
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to upload image"));
    }
  };

  const onValid = async (values: AdminGiftCardDesignValues) => {
    const payload = {
      title: values.title.trim(),
      category: values.category,
      image_url: values.image_url.trim() || null,
      color_gradient: values.color_gradient.trim() || null,
      caption_color: values.caption_color.trim() || "#FFFFFF",
      text_color: values.text_color.trim() || "#FFFFFF",
      status: values.status,
      sort_order: editingId ? editingSortOrder : 0,
    };
    try {
      if (editingId) {
        const res = await updateDesign({ id: editingId, ...payload }).unwrap();
        toast.success(res.message || "Design updated");
      } else {
        const res = await createDesign(payload).unwrap();
        toast.success(res.message || "Design created");
      }
      setFormOpen(false);
      reset(emptyAdminGiftCardDesignValues(defaultCategoryCode));
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save design"));
    }
  };

  const handleTogglePause = async (d: GiftCardDesign) => {
    const next = d.status === "PAUSED" ? "ACTIVE" : "PAUSED";
    try {
      const res = await patchStatus({ id: d.id, status: next }).unwrap();
      toast.success(
        res.message || (next === "PAUSED" ? "Design paused" : "Design activated")
      );
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update status"));
    }
  };

  const handleArchive = async (d: GiftCardDesign) => {
    try {
      const res = await patchStatus({ id: d.id, status: "ARCHIVED" }).unwrap();
      toast.success(res.message || "Design archived");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to archive"));
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    setConfirmBusy(true);
    try {
      const res = await deleteDesign(pendingDeleteId).unwrap();
      toast.success(res.message || "Design deleted");
      setPendingDeleteId(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to delete"));
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className={embedded ? "space-y-6" : "w-full space-y-6"}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        {embedded ? (
          <p className="text-sm text-zinc-400">
            Upload artwork, set title &amp; category, then set Active so it appears for customers.
          </p>
        ) : null}
        <div className={`flex flex-col sm:flex-row gap-3 w-full sm:w-auto ${embedded ? "" : "sm:ml-auto"}`}>
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search designs"
          />
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all whitespace-nowrap"
          >
            <Plus size={18} />
            Add Design
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap border-b border-white/10 pb-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-all border-b-2 ${
              tab === t.key
                ? "border-rose-500 text-rose-500 bg-rose-500/5"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-16 text-zinc-400 gap-2">
            <Loader2 className="animate-spin" size={18} /> Loading designs…
          </div>
        ) : designs.length === 0 ? (
          <div className="col-span-full text-center py-16 text-zinc-500">
            No designs yet. Add one to show on the customer gift cards page.
          </div>
        ) : (
          designs.map((d) => (
            <article
              key={d.id}
              className="rounded-2xl border border-white/10 overflow-hidden bg-white/5"
            >
              <GiftCardDesignFace
                design={d}
                className="aspect-[16/10] w-full rounded-none"
              />
              <div className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-400 truncate">
                    {categoryNameByCode[d.category] || d.category || "—"}
                  </p>
                  <div className="mt-1">{statusBadge(d.status)}</div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(d)}
                    className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  {d.status !== "ARCHIVED" && (
                    <button
                      type="button"
                      onClick={() => void handleTogglePause(d)}
                      className="p-2 text-zinc-400 hover:text-amber-300 rounded-lg hover:bg-white/5"
                      title={d.status === "PAUSED" ? "Activate" : "Pause"}
                    >
                      {d.status === "PAUSED" ? <Play size={15} /> : <Pause size={15} />}
                    </button>
                  )}
                  {d.status !== "ARCHIVED" && (
                    <button
                      type="button"
                      onClick={() => void handleArchive(d)}
                      className="p-2 text-zinc-400 hover:text-rose-300 rounded-lg hover:bg-white/5"
                      title="Archive"
                    >
                      <Archive size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(d.id)}
                    className="p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-white/5"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {meta && <Pagination meta={meta} onPageChange={setPage} />}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl glass-panel border border-white/10 rounded-2xl p-6 my-8">
            <h2 className="text-xl font-bold text-white mb-1">
              {editingId ? "Edit Design" : "Add Design"}
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              Customers see ACTIVE designs on /gift-cards. Upload a full card image for best results.
            </p>

            <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-4">
              <div>
                <label className={labelClass}>
                  Title <RequiredMark />
                </label>
                <input
                  {...register("title")}
                  className={inputClass}
                  placeholder="Best Bestie!"
                />
                {errors.title && <p className={fieldErrorClass}>{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Category <RequiredMark />
                  </label>
                  <select {...register("category")} className={`${inputClass} px-3`}>
                    {activeCategories.length === 0 ? (
                      <option value="">Add a category first</option>
                    ) : (
                      activeCategories.map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.name}
                        </option>
                      ))
                    )}
                    {editingId &&
                      categoryWatch &&
                      !activeCategories.some((c) => c.code === categoryWatch) && (
                        <option value={categoryWatch}>
                          {categoryNameByCode[categoryWatch] || categoryWatch} (inactive)
                        </option>
                      )}
                  </select>
                  {errors.category && (
                    <p className={fieldErrorClass}>{errors.category.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>
                    Status <RequiredMark />
                  </label>
                  <select {...register("status")} className={`${inputClass} px-3`}>
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PAUSED">Paused</option>
                  </select>
                  {errors.status && <p className={fieldErrorClass}>{errors.status.message}</p>}
                </div>
              </div>

              <div>
                <label className={labelClass}>Customer preview</label>
                <div className="flex flex-col gap-3">
                  <GiftCardDesignFace
                    design={{
                      title: titleWatch?.trim() || "Design title",
                      image_url: imageUrlWatch || null,
                      color_gradient: gradientWatch || DEFAULT_DESIGN_GRADIENT,
                      caption_color: captionWatch || "#FFFFFF",
                      text_color: textColorWatch || "#FFFFFF",
                    }}
                    size="preview"
                    className="aspect-[16/10] w-full border border-white/10"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Same face customers see on /gift-cards. Prefer a full-bleed card image.
                  </p>
                  <ImageCropPicker
                    aspect={16 / 10}
                    disabled={uploading}
                    className="inline-flex items-center justify-center gap-2 cursor-pointer bg-white border border-slate-200 hover:border-rose-400 text-slate-800 font-semibold py-2.5 px-4 rounded-xl"
                    onCroppedFile={(file) => void handleUpload(file)}
                  >
                    {uploading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ImagePlus size={16} />
                    )}
                    {uploading ? "Uploading…" : "Upload & crop image"}
                  </ImageCropPicker>
                  {errors.image_url && (
                    <p className={fieldErrorClass}>{errors.image_url.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Text color <RequiredMark />
                  </label>
                  <Controller
                    name="text_color"
                    control={control}
                    render={({ field }) => (
                      <input
                        type="color"
                        value={field.value || "#FFFFFF"}
                        onChange={field.onChange}
                        className="w-full h-10 bg-zinc-900/50 border border-white/10 rounded-xl px-1"
                      />
                    )}
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    BookMyBota / gift CARD
                  </p>
                  {errors.text_color && (
                    <p className={fieldErrorClass}>{errors.text_color.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>
                    Caption color <RequiredMark />
                  </label>
                  <Controller
                    name="caption_color"
                    control={control}
                    render={({ field }) => (
                      <input
                        type="color"
                        value={field.value || "#FFFFFF"}
                        onChange={field.onChange}
                        className="w-full h-10 bg-zinc-900/50 border border-white/10 rounded-xl px-1"
                      />
                    )}
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Tagline + design title
                  </p>
                  {errors.caption_color && (
                    <p className={fieldErrorClass}>{errors.caption_color.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    reset(emptyAdminGiftCardDesignValues());
                  }}
                  className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || updating || uploading}
                  className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {(creating || updating) && <Loader2 size={16} className="animate-spin" />}
                  {editingId ? "Save changes" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Delete gift card design?"
        body="Only designs never used on issued cards can be deleted. Prefer Archive otherwise."
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
