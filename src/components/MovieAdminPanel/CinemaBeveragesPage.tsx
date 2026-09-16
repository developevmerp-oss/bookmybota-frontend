"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Plus,
  Search,
  UtensilsCrossed,
  Coffee,
  Sparkles,
  Package,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  Tag,
  DollarSign,
  Layers,
  Flame,
} from "lucide-react";
import { useAppSelector } from "@/lib/hooks";
import {
  useGetCinemaBeveragesQuery,
  useCreateCinemaBeverageMutation,
  useUpdateCinemaBeverageMutation,
  useToggleCinemaBeverageAvailabilityMutation,
  useDeleteCinemaBeverageMutation,
  useUploadImageMutation,
  type CinemaBeverage,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";

const CATEGORIES = [
  { value: "ALL", label: "All Items", icon: Layers },
  { value: "POPCORN", label: "Popcorn", icon: Sparkles },
  { value: "BEVERAGE", label: "Beverages", icon: Coffee },
  { value: "COMBO", label: "Combos", icon: Flame },
  { value: "SNACKS", label: "Snacks", icon: UtensilsCrossed },
];

interface FormDataState {
  id?: string;
  name: string;
  category: string;
  price: string;
  description: string;
  image_url: string;
  is_available: boolean;
  sort_order: number;
}

const emptyForm: FormDataState = {
  name: "",
  category: "POPCORN",
  price: "",
  description: "",
  image_url: "",
  is_available: true,
  sort_order: 0,
};

export default function CinemaBeveragesPage() {
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";

  const { data: beverages = [], isLoading, refetch } = useGetCinemaBeveragesQuery(bizId, {
    skip: !bizId,
  });

  const [createBeverage, { isLoading: isCreating }] = useCreateCinemaBeverageMutation();
  const [updateBeverage, { isLoading: isUpdating }] = useUpdateCinemaBeverageMutation();
  const [toggleAvailability] = useToggleCinemaBeverageAvailabilityMutation();
  const [deleteBeverage, { isLoading: isDeleting }] = useDeleteCinemaBeverageMutation();
  const [uploadImage, { isLoading: isUploading }] = useUploadImageMutation();

  const [activeCategory, setActiveCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CinemaBeverage | null>(null);
  const [formData, setFormData] = useState<FormDataState>(emptyForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtered beverages
  const filteredBeverages = useMemo(() => {
    return beverages.filter((item) => {
      const matchCat =
        activeCategory === "ALL" ||
        item.category?.toUpperCase() === activeCategory.toUpperCase();
      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description &&
          item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [beverages, activeCategory, searchQuery]);

  // Quick statistics
  const stats = useMemo(() => {
    const total = beverages.length;
    const popcorn = beverages.filter((b) => b.category?.toUpperCase() === "POPCORN").length;
    const drinks = beverages.filter((b) => b.category?.toUpperCase() === "BEVERAGE").length;
    const combos = beverages.filter((b) => b.category?.toUpperCase() === "COMBO").length;
    const outOfStock = beverages.filter((b) => !b.is_available).length;
    return { total, popcorn, drinks, combos, outOfStock };
  }, [beverages]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: CinemaBeverage) => {
    setEditingItem(item);
    setFormData({
      id: item.id,
      name: item.name,
      category: item.category || "POPCORN",
      price: String(item.price),
      description: item.description || "",
      image_url: item.image_url || "",
      is_available: item.is_available,
      sort_order: item.sort_order || 0,
    });
    setIsModalOpen(true);
  };

  const handleToggle = async (item: CinemaBeverage) => {
    try {
      await toggleAvailability({
        bizId,
        beverageId: item.id,
        is_available: !item.is_available,
      }).unwrap();
      toast.success(
        item.is_available
          ? `"${item.name}" marked as sold out`
          : `"${item.name}" is now available in stock`
      );
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update item availability"));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteBeverage({ bizId, beverageId: id }).unwrap();
      toast.success(`"${name}" deleted successfully`);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to delete item"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    const numPrice = parseFloat(formData.price);
    if (isNaN(numPrice) || numPrice < 0) {
      toast.error("Please enter a valid price (greater than or equal to 0)");
      return;
    }

    try {
      if (editingItem) {
        await updateBeverage({
          bizId,
          beverageId: editingItem.id,
          name: formData.name.trim(),
          category: formData.category,
          price: numPrice,
          description: formData.description.trim() || undefined,
          image_url: formData.image_url.trim() || undefined,
          is_available: formData.is_available,
          sort_order: Number(formData.sort_order) || 0,
        }).unwrap();
        toast.success(`"${formData.name}" updated successfully`);
      } else {
        await createBeverage({
          bizId,
          name: formData.name.trim(),
          category: formData.category,
          price: numPrice,
          description: formData.description.trim() || undefined,
          image_url: formData.image_url.trim() || undefined,
          is_available: formData.is_available,
          sort_order: Number(formData.sort_order) || 0,
        }).unwrap();
        toast.success(`"${formData.name}" added to menu`);
      }
      setIsModalOpen(false);
      setFormData(emptyForm);
      setEditingItem(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save beverage item"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500 mb-3" />
        <p className="text-sm">Loading cinema snack catalog...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-fuchsia-400 text-sm font-semibold tracking-wide uppercase mb-1">
            <UtensilsCrossed size={16} />
            <span>Concessions & Bar</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Beverages & Snacks Catalog
          </h1>
          <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
            Configure appetizing snacks, popcorn, beverages, and combo deals offered at your cinema.
            Moviegoers will be able to add these items directly to their movie ticket bookings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white text-sm font-semibold shadow-lg shadow-fuchsia-600/20 transition-all active:scale-95"
          >
            <Plus size={18} />
            <span>Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Menu</span>
            <Package size={16} className="text-fuchsia-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-xs text-zinc-500 mt-1">Catalog items</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Popcorn</span>
            <Sparkles size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.popcorn}</div>
          <div className="text-xs text-zinc-500 mt-1">Classic & gourmet tubs</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Beverages</span>
            <Coffee size={16} className="text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.drinks}</div>
          <div className="text-xs text-zinc-500 mt-1">Soft drinks & juices</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Combos</span>
            <Flame size={16} className="text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.combos}</div>
          <div className="text-xs text-zinc-500 mt-1">Popcorn + drink bundles</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/5 flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Sold Out</span>
            <XCircle size={16} className="text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">{stats.outOfStock}</div>
          <div className="text-xs text-zinc-500 mt-1">Temporarily unavailable</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 glass-panel p-3 rounded-2xl border border-white/5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/30"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={14} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-fuchsia-500 transition-colors"
          />
        </div>
      </div>

      {/* Items Grid */}
      {filteredBeverages.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-white/5 p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 mb-4">
            <UtensilsCrossed size={28} />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">No items found</h3>
          <p className="text-zinc-400 text-sm max-w-sm mb-6">
            {searchQuery
              ? `No menu items match "${searchQuery}". Try adjusting your search or category filter.`
              : "You haven't added any snacks or beverages in this category yet."}
          </p>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all"
          >
            <Plus size={16} />
            <span>Add First Item</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredBeverages.map((item) => (
            <div
              key={item.id}
              className={`group glass-panel rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden ${
                item.is_available
                  ? "border-white/10 hover:border-fuchsia-500/40 hover:shadow-xl hover:shadow-fuchsia-500/10"
                  : "border-white/5 opacity-60 hover:opacity-100"
              }`}
            >
              {/* Image thumbnail */}
              <div className="relative w-full aspect-[4/3] bg-zinc-900 overflow-hidden shrink-0">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-950/60">
                    <UtensilsCrossed size={32} />
                    <span className="text-[10px] uppercase font-bold tracking-wider mt-1 text-zinc-600">
                      No Photo
                    </span>
                  </div>
                )}

                {/* Category badge */}
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">
                    {item.category}
                  </span>
                </div>

                {/* In Stock Badge */}
                <div className="absolute top-3 right-3">
                  <button
                    onClick={() => handleToggle(item)}
                    title={item.is_available ? "Click to mark Sold Out" : "Click to mark In Stock"}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-md transition-all ${
                      item.is_available
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.is_available ? "bg-emerald-400" : "bg-rose-400"
                      }`}
                    />
                    <span>{item.is_available ? "In Stock" : "Sold Out"}</span>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-bold text-white text-base leading-tight group-hover:text-fuchsia-300 transition-colors line-clamp-1">
                      {item.name}
                    </h3>
                  </div>
                  {item.description ? (
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-600 mt-1 italic">No description provided</p>
                  )}
                </div>

                {/* Pricing and Action row */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 block">
                      Price
                    </span>
                    <span className="text-base font-extrabold text-white">
                      {Number(item.price).toLocaleString()} <span className="text-xs font-medium text-fuchsia-400">ETB</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-fuchsia-500/20 hover:text-fuchsia-300 text-zinc-400 transition-colors"
                      title="Edit Item"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      disabled={deletingId === item.id}
                      className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-zinc-400 transition-colors disabled:opacity-50"
                      title="Delete Item"
                    >
                      {deletingId === item.id ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Trash2 size={15} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="glass-panel bg-zinc-950/95 border border-white/10 rounded-2xl w-full max-w-xl p-6 sm:p-8 space-y-6 relative my-8 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {editingItem ? "Edit Menu Item" : "Add New Menu Item"}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {editingItem
                    ? "Update item details, price, or photo"
                    : "Add cinema beverage, popcorn tub, or snack combo"}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Photo Upload */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                  Item Photo (Optional)
                </label>
                <CroppedImageField
                  value={formData.image_url}
                  aspect={4 / 3}
                  disabled={isUploading}
                  previewClassName="w-full h-44 rounded-xl border border-white/10 object-cover"
                  emptyClassName="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-white/15 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] hover:border-fuchsia-500/50 transition-colors text-zinc-400 text-xs cursor-pointer"
                  emptyLabel="Click or drag photo to upload"
                  onRemove={() => setFormData((prev) => ({ ...prev, image_url: "" }))}
                  onCroppedFile={async (file) => {
                    const fd = new FormData();
                    fd.append("image", file);
                    try {
                      const res = await uploadImage(fd).unwrap();
                      if (res.url) {
                        setFormData((prev) => ({ ...prev, image_url: res.url }));
                        toast.success("Photo uploaded successfully");
                      }
                    } catch (err) {
                      toast.error(extractApiError(err, "Failed to upload photo"));
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Item Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Item Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Caramel Butter Popcorn (Large)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-fuchsia-500 transition-colors"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Category <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500 transition-colors"
                  >
                    <option value="POPCORN">Popcorn</option>
                    <option value="BEVERAGE">Beverages</option>
                    <option value="COMBO">Combos</option>
                    <option value="SNACKS">Snacks</option>
                  </select>
                </div>

                {/* Price */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Price (ETB) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="e.g. 150"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-fuchsia-500 transition-colors"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Description / Portion Details
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Freshly popped golden kernels tossed with warm melted butter."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-fuchsia-500 transition-colors resize-none"
                />
              </div>

              {/* In-stock toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div>
                  <span className="text-sm font-semibold text-white block">Available in Stock</span>
                  <span className="text-xs text-zinc-400">
                    If toggled off, moviegoers will see this item marked as Sold Out.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_available: !formData.is_available })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formData.is_available ? "bg-emerald-500" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formData.is_available ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || isUpdating}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white text-xs font-semibold shadow-lg shadow-fuchsia-600/20 transition-all disabled:opacity-50"
                >
                  {(isCreating || isUpdating) && <Loader2 size={14} className="animate-spin" />}
                  <span>{editingItem ? "Save Changes" : "Create Item"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
