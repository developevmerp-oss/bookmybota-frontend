"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChefHat, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import {
  useGetAdminDiningCuisinesQuery,
  useCreateAdminDiningCuisineMutation,
  useUpdateAdminDiningCuisineMutation,
  useDeleteAdminDiningCuisineMutation,
  useUploadImageMutation,
  type DiningCuisineMaster,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import { PAGE_SIZE } from "@/lib/pagination";

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
      title={active ? "Active — visible to dining partners" : "Inactive — hidden from dining partners"}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          active ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function AdminDiningMastersPage() {
  const [tab, setTab] = useState<"cuisines">("cuisines");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [newCuisine, setNewCuisine] = useState({ name: "", image_url: "" });
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    body: string;
    run: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const cuisineQueryArg = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(q.trim() ? { q: q.trim() } : {}),
    }),
    [q, page]
  );

  const {
    data: cuisinesData,
    isLoading: cuisinesLoading,
    isFetching: cuisinesFetching,
    isError: cuisinesError,
    error: cuisinesErrorData,
    refetch: refetchCuisines,
  } = useGetAdminDiningCuisinesQuery(cuisineQueryArg);
  const cuisines = cuisinesData?.items ?? [];

  const [createCuisine, { isLoading: creatingCuisine }] = useCreateAdminDiningCuisineMutation();
  const [updateCuisine] = useUpdateAdminDiningCuisineMutation();
  const [deleteCuisine] = useDeleteAdminDiningCuisineMutation();
  const [uploadImage, { isLoading: uploadingImage }] = useUploadImageMutation();

  const handleUploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await uploadImage(formData).unwrap();
      if (res.url) setNewCuisine((p) => ({ ...p, image_url: res.url }));
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to upload cuisine image"));
    }
  };

  const handleCreateCuisine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCuisine.name.trim()) {
      toast.error("Cuisine name is required");
      return;
    }
    if (!newCuisine.image_url.trim()) {
      toast.error("Cuisine image is required");
      return;
    }
    try {
      const created = await createCuisine({
        name: newCuisine.name.trim(),
        image_url: newCuisine.image_url.trim(),
        is_active: true,
      }).unwrap();
      toast.success(`Cuisine "${created.name}" added successfully`);
      setNewCuisine({ name: "", image_url: "" });
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to add cuisine"));
    }
  };

  const toggleCuisineActive = async (cuisine: DiningCuisineMaster) => {
    const next = !cuisine.is_active;
    try {
      await updateCuisine({
        id: cuisine.id,
        body: { is_active: next },
      }).unwrap();
      toast.success(
        next
          ? `"${cuisine.name}" is now active — dining partners can see it`
          : `"${cuisine.name}" is inactive — hidden from dining partners`
      );
    } catch (err: unknown) {
      toast.error(extractApiError(err, "Failed to update cuisine status"));
    }
  };

  const cuisineListLoading = cuisinesLoading && cuisines.length === 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <span className="bg-rose-500/20 text-rose-500 p-2 rounded-xl">
            <UtensilsCrossed size={28} />
          </span>
          Dining Masters
        </h1>
        <p className="text-zinc-400 mt-2">
          Manage dining catalogs used by partners and the public dining pages. Only{" "}
          <strong className="text-green-400/90">active</strong> items appear in dining forms and cuisine cards.
        </p>
        <div className="mt-4">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search this list"
          />
        </div>
      </div>

      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => {
            setTab("cuisines");
            setPage(1);
          }}
          className={`px-4 py-3 font-semibold text-sm border-b-2 transition-all flex items-center gap-2 ${
            tab === "cuisines"
              ? "border-rose-500 text-rose-400"
              : "border-transparent text-zinc-400 hover:text-white"
          }`}
        >
          <ChefHat size={16} /> Cuisines Master
        </button>
      </div>

      {tab === "cuisines" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="glass-panel p-6 border border-white/5 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus size={18} className="text-rose-500" /> Add cuisine
            </h3>
            <form onSubmit={handleCreateCuisine} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Cuisine name</label>
                <input
                  value={newCuisine.name}
                  onChange={(e) => setNewCuisine((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Indian"
                  className="input-field w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Cuisine image</label>
                <CroppedImageField
                  value={newCuisine.image_url}
                  aspect={1}
                  previewClassName="w-full h-40 rounded-xl border border-white/10"
                  emptyClassName="flex flex-col items-center justify-center w-full h-40 border-2 border-zinc-700 border-dashed rounded-xl bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
                  emptyLabel="Add cuisine image"
                  onRemove={() => setNewCuisine((p) => ({ ...p, image_url: "" }))}
                  onCroppedFile={handleUploadImage}
                />
              </div>
              <p className="text-xs text-zinc-500">New cuisines are active by default.</p>
              <button
                type="submit"
                disabled={creatingCuisine || uploadingImage}
                className="btn-primary w-full disabled:opacity-50"
              >
                {creatingCuisine ? "Adding..." : "Add cuisine"}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 glass-panel border border-white/5 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex justify-between items-center">
              <span className="text-sm text-zinc-400">All cuisines</span>
              <span className="text-xs text-zinc-500">
                {cuisines.length} cuisine{cuisines.length !== 1 ? "s" : ""}
                {cuisinesFetching && !cuisineListLoading ? " · refreshing…" : ""}
              </span>
            </div>

            {cuisineListLoading ? (
              <div className="p-8 text-center text-zinc-500">Loading cuisines...</div>
            ) : cuisinesError ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-rose-400">{extractApiError(cuisinesErrorData, "Failed to load cuisines")}</p>
                <button onClick={() => refetchCuisines()} className="text-sm text-zinc-400 hover:text-white underline">
                  Retry
                </button>
              </div>
            ) : cuisines.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">No cuisines yet. Add one using the form.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900/50 text-zinc-400 border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3">Image</th>
                    <th className="px-4 py-3">Cuisine</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cuisines.map((c) => (
                    <tr
                      key={c.id}
                      className={`text-zinc-300 ${!c.is_active ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-3">
                        {c.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.image_url}
                            alt={c.name}
                            className="w-12 h-12 rounded-full object-cover border border-white/10"
                          />
                        ) : (
                          <span className="inline-flex w-12 h-12 rounded-full bg-zinc-800 items-center justify-center text-zinc-500">
                            <ChefHat size={16} />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ActiveToggle active={c.is_active} onToggle={() => toggleCuisineActive(c)} />
                          <span className={`text-xs ${c.is_active ? "text-green-400" : "text-zinc-500"}`}>
                            {c.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() =>
                            setPendingConfirm({
                              title: "Delete cuisine?",
                              body: `Delete cuisine "${c.name}"?`,
                              run: async () => {
                                await deleteCuisine(c.id).unwrap();
                                toast.success(`Cuisine "${c.name}" deleted`);
                              },
                            })
                          }
                          className="text-zinc-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {cuisinesData?.meta && <Pagination meta={cuisinesData.meta} onPageChange={setPage} />}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title || ""}
        body={pendingConfirm?.body || ""}
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setPendingConfirm(null)}
        onConfirm={async () => {
          if (!pendingConfirm) return;
          setConfirmBusy(true);
          try {
            await pendingConfirm.run();
            setPendingConfirm(null);
          } catch (err: unknown) {
            toast.error(extractApiError(err, "Delete failed"));
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}
