"use client";

import { useState } from "react";
import {
  Archive,
  CreditCard,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCreateGiftCardProductMutation,
  useDeleteGiftCardProductMutation,
  useGetGiftCardProductsQuery,
  usePatchGiftCardProductStatusMutation,
  useUpdateGiftCardProductMutation,
  type GiftCardProduct,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import { formatMoney } from "@/lib/currencyFormat";

type TabKey = "ALL" | "ACTIVE" | "DRAFT" | "PAUSED" | "ARCHIVED";

const STATUS_TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "DRAFT", label: "Draft" },
  { key: "PAUSED", label: "Paused" },
  { key: "ARCHIVED", label: "Archived" },
];

const EMPTY_FORM = {
  name: "",
  description: "Give the gift of Events, Sports & Dining",
  denomination: "1000",
  selling_price: "1000",
  applicable_category: "ALL" as GiftCardProduct["applicable_category"],
  validity_days: "365",
  allow_partial_usage: true,
  status: "DRAFT" as string,
  sort_order: "0",
};

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

function productToForm(p: GiftCardProduct) {
  return {
    name: p.name || "",
    description: p.description || "",
    denomination: String(p.denomination ?? ""),
    selling_price: String(p.selling_price ?? p.denomination ?? ""),
    applicable_category: p.applicable_category || "ALL",
    validity_days: String(p.validity_days ?? 365),
    allow_partial_usage: p.allow_partial_usage !== false,
    status: p.status || "DRAFT",
    sort_order: String(p.sort_order ?? 0),
  };
}

export default function AdminGiftCardsPage() {
  const [tab, setTab] = useState<TabKey>("ALL");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const listArg = {
    page,
    limit: PAGE_SIZE,
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(tab !== "ALL" ? { status: tab } : {}),
  };

  const { data, isLoading } = useGetGiftCardProductsQuery(listArg);
  const [createProduct, { isLoading: creating }] = useCreateGiftCardProductMutation();
  const [updateProduct, { isLoading: updating }] = useUpdateGiftCardProductMutation();
  const [patchStatus] = usePatchGiftCardProductStatusMutation();
  const [deleteProduct] = useDeleteGiftCardProductMutation();

  const products = data?.items ?? [];
  const meta = data?.meta;

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  };

  const openEdit = (product: GiftCardProduct) => {
    setEditingId(product.id);
    setForm(productToForm(product));
    setFormOpen(true);
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim(),
    denomination: Number(form.denomination),
    selling_price: Number(form.selling_price || form.denomination),
    applicable_category: form.applicable_category,
    validity_days: Number(form.validity_days),
    allow_partial_usage: form.allow_partial_usage,
    status: form.status,
    sort_order: Number(form.sort_order) || 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    try {
      if (editingId) {
        await updateProduct({ id: editingId, ...payload }).unwrap();
        toast.success("Gift card product updated.");
      } else {
        await createProduct(payload).unwrap();
        toast.success("Gift card product created.");
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save gift card."));
    }
  };

  const handleTogglePause = async (product: GiftCardProduct) => {
    const next = product.status === "PAUSED" ? "ACTIVE" : "PAUSED";
    try {
      await patchStatus({ id: product.id, status: next }).unwrap();
      toast.success(next === "PAUSED" ? "Product paused." : "Product activated.");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update status."));
    }
  };

  const handleArchive = async (product: GiftCardProduct) => {
    try {
      await patchStatus({ id: product.id, status: "ARCHIVED" }).unwrap();
      toast.success("Product archived.");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to archive."));
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    setConfirmBusy(true);
    try {
      await deleteProduct(pendingDeleteId).unwrap();
      toast.success("Gift card product deleted.");
      setPendingDeleteId(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to delete."));
    } finally {
      setConfirmBusy(false);
    }
  };

  const syncPriceFromDenomination = (value: string) => {
    setForm((prev) => ({
      ...prev,
      denomination: value,
      selling_price: value,
    }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span className="bg-rose-500/20 text-rose-500 p-2 rounded-xl">
              <CreditCard size={28} />
            </span>
            Gift Cards
          </h1>
          <p className="text-zinc-400 mt-2">
            BookMyBota gift card denominations (ETB). Customers buy these; unique cards are issued after payment.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search gift cards"
          />
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all whitespace-nowrap"
          >
            <Plus size={18} />
            Create Gift Card
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

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-white/5">
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Name</th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Value</th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase hidden md:table-cell">Sold</th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase hidden lg:table-cell">
                Redeemed
              </th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase hidden lg:table-cell">
                Outstanding
              </th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Status</th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-400">
                  <Loader2 className="animate-spin inline mr-2" size={18} />
                  Loading gift cards…
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-500">
                  No gift card products yet. Create denominations like 500 / 1,000 ETB.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4">
                    <p className="font-semibold text-white">{product.name}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {product.applicable_category} · {product.validity_days} days
                    </p>
                  </td>
                  <td className="p-4 text-sm text-zinc-200">
                    {formatMoney(product.denomination, { compact: true })}
                  </td>
                  <td className="p-4 hidden md:table-cell text-sm text-zinc-300">
                    {product.sold_count ?? 0}
                    <span className="block text-xs text-zinc-500">
                      {formatMoney(product.sold_value || 0, { compact: true })}
                    </span>
                  </td>
                  <td className="p-4 hidden lg:table-cell text-sm text-zinc-300">
                    {formatMoney(product.redeemed_value || 0, { compact: true })}
                  </td>
                  <td className="p-4 hidden lg:table-cell text-sm text-zinc-300">
                    {formatMoney(product.outstanding_balance || 0, { compact: true })}
                  </td>
                  <td className="p-4">{statusBadge(product.status)}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(product)}
                        className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      {product.status !== "ARCHIVED" && (
                        <button
                          type="button"
                          onClick={() => void handleTogglePause(product)}
                          className="p-2 text-zinc-400 hover:text-amber-300 rounded-lg hover:bg-white/5"
                          title={product.status === "PAUSED" ? "Activate" : "Pause"}
                        >
                          {product.status === "PAUSED" ? <Play size={16} /> : <Pause size={16} />}
                        </button>
                      )}
                      {product.status !== "ARCHIVED" && (
                        <button
                          type="button"
                          onClick={() => void handleArchive(product)}
                          className="p-2 text-zinc-400 hover:text-rose-300 rounded-lg hover:bg-white/5"
                          title="Archive"
                        >
                          <Archive size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(product.id)}
                        className="p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-white/5"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {meta && <Pagination meta={meta} onPageChange={setPage} />}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl glass-panel border border-white/10 rounded-2xl p-6 my-8">
            <h2 className="text-xl font-bold text-white mb-1">
              {editingId ? "Edit Gift Card" : "Create Gift Card"}
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              Denomination products only — unique cards are issued when a customer purchases.
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                  Gift card name *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  placeholder="BookMyBota Gift Card 1,000 ETB"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Gift card value (ETB) *
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.denomination}
                    onChange={(e) => syncPriceFromDenomination(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Selling price (ETB) *
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={form.selling_price}
                    onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">MVP: keep equal to value.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Applicable on
                  </label>
                  <select
                    value={form.applicable_category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        applicable_category: e.target
                          .value as GiftCardProduct["applicable_category"],
                      })
                    }
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  >
                    <option value="ALL">All BookMyBota</option>
                    <option value="EVENTS">Events</option>
                    <option value="SPORTS">Sports</option>
                    <option value="DINING">Dining</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Validity (days)
                  </label>
                  <select
                    value={form.validity_days}
                    onChange={(e) => setForm({ ...form, validity_days: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  >
                    <option value="90">3 Months (90)</option>
                    <option value="180">6 Months (180)</option>
                    <option value="365">12 Months (365)</option>
                    <option value="730">24 Months (730)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PAUSED">Paused</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.allow_partial_usage}
                  onChange={(e) => setForm({ ...form, allow_partial_usage: e.target.checked })}
                  className="rounded border-white/20"
                />
                Allow partial usage across multiple bookings
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="btn-secondary rounded-xl px-4 py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || updating}
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
        title="Delete gift card product?"
        body="Only products with no issued cards can be deleted. Prefer Archive if cards were already sold."
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
