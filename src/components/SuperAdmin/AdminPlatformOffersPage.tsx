"use client";

import { useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
  Tag,
  Trash2,
  Pause,
  Play,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import {
  useCreatePlatformOfferMutation,
  useDeletePlatformOfferMutation,
  useGetOfferEligibleEventsAdminQuery,
  useGetOfferEligibleRestaurantsAdminQuery,
  useGetOfferRedemptionsQuery,
  useGetPlatformOffersQuery,
  usePatchPlatformOfferStatusMutation,
  useUpdatePlatformOfferMutation,
  type PlatformOffer,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import Pagination from "@/components/Shared/Pagination";
import { PAGE_SIZE } from "@/lib/pagination";
import { formatDate } from "@/lib/dateFormat";
import { formatMoney, formatOfferDiscount } from "@/lib/currencyFormat";

type TabKey =
  | "ALL"
  | "ACTIVE"
  | "SCHEDULED"
  | "DRAFT"
  | "PAUSED"
  | "EXPIRED"
  | "EXHAUSTED"
  | "REDEMPTIONS";

const STATUS_TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "All Offers" },
  { key: "ACTIVE", label: "Active" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "DRAFT", label: "Draft" },
  { key: "PAUSED", label: "Paused" },
  { key: "EXPIRED", label: "Expired" },
  { key: "EXHAUSTED", label: "Exhausted" },
  { key: "REDEMPTIONS", label: "Redemptions" },
];

const EMPTY_FORM = {
  name: "",
  code: "",
  description: "",
  discount_type: "FLAT" as "PERCENT" | "FLAT",
  discount_value: "",
  max_discount: "",
  min_order_amount: "0",
  category: "EVENTS" as "ALL" | "EVENTS" | "DINING",
  apply_to: "ENTIRE_CATEGORY" as "ENTIRE_CATEGORY" | "SELECTED_ITEMS",
  customer_eligibility: "ALL" as "ALL" | "NEW" | "EXISTING",
  usage_limit: "",
  per_user_limit: "1",
  start_at: "",
  end_at: "",
  status: "DRAFT" as string,
  display_theme: "magenta",
  sort_order: "0",
  event_ids: [] as string[],
  restaurant_ids: [] as string[],
};

function statusBadge(status?: string) {
  const s = (status || "DRAFT").toUpperCase();
  const colors: Record<string, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    SCHEDULED: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    DRAFT: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    PAUSED: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    EXPIRED: "bg-zinc-500/15 text-zinc-500 border-zinc-500/30",
    EXHAUSTED: "bg-rose-500/15 text-rose-400 border-rose-500/30",
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

function offerToForm(o: PlatformOffer) {
  return {
    name: o.name || "",
    code: o.code || "",
    description: o.description || "",
    discount_type: o.discount_type,
    discount_value: String(o.discount_value ?? ""),
    max_discount: o.max_discount != null ? String(o.max_discount) : "",
    min_order_amount: String(o.min_order_amount ?? 0),
    category: o.category,
    apply_to: o.apply_to,
    customer_eligibility: o.customer_eligibility,
    usage_limit: o.usage_limit != null ? String(o.usage_limit) : "",
    per_user_limit: String(o.per_user_limit ?? 1),
    start_at: o.start_at ? o.start_at.slice(0, 10) : "",
    end_at: o.end_at ? o.end_at.slice(0, 10) : "",
    status: o.status || "DRAFT",
    display_theme: o.display_theme || "magenta",
    sort_order: String(o.sort_order ?? 0),
    event_ids: o.event_ids || [],
    restaurant_ids: o.restaurant_ids || [],
  };
}

export default function AdminPlatformOffersPage() {
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
    ...(tab !== "ALL" && tab !== "REDEMPTIONS" ? { status: tab } : {}),
  };

  const { data: offersData, isLoading } = useGetPlatformOffersQuery(listArg, {
    skip: tab === "REDEMPTIONS",
  });
  const { data: redemptionsData, isLoading: redemptionsLoading } =
    useGetOfferRedemptionsQuery(
      { page, limit: PAGE_SIZE, ...(q.trim() ? { q: q.trim() } : {}) },
      { skip: tab !== "REDEMPTIONS" }
    );

  const { data: eligibleEvents = [] } = useGetOfferEligibleEventsAdminQuery(undefined, {
    skip: !formOpen,
  });
  const { data: eligibleRestaurants = [] } =
    useGetOfferEligibleRestaurantsAdminQuery(undefined, { skip: !formOpen });

  const [createOffer, { isLoading: creating }] = useCreatePlatformOfferMutation();
  const [updateOffer, { isLoading: updating }] = useUpdatePlatformOfferMutation();
  const [patchStatus] = usePatchPlatformOfferStatusMutation();
  const [deleteOffer] = useDeletePlatformOfferMutation();

  const offers = offersData?.items ?? [];
  const redemptions = redemptionsData?.items ?? [];
  const listMeta = tab === "REDEMPTIONS" ? redemptionsData?.meta : offersData?.meta;

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  };

  const openEdit = (offer: PlatformOffer) => {
    setEditingId(offer.id);
    setForm(offerToForm(offer));
    setFormOpen(true);
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    code: form.code.trim().toUpperCase(),
    description: form.description.trim(),
    discount_type: form.discount_type,
    discount_value: Number(form.discount_value),
    max_discount: form.max_discount ? Number(form.max_discount) : null,
    min_order_amount: Number(form.min_order_amount) || 0,
    category: form.category,
    apply_to: form.apply_to,
    customer_eligibility: form.customer_eligibility,
    usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
    per_user_limit: Number(form.per_user_limit) || 1,
    start_at: form.start_at || null,
    end_at: form.end_at || null,
    status: form.status,
    display_theme: form.display_theme,
    sort_order: Number(form.sort_order) || 0,
    event_ids: form.event_ids,
    restaurant_ids: form.restaurant_ids,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    try {
      if (editingId) {
        await updateOffer({ id: editingId, ...payload }).unwrap();
        toast.success("Platform offer updated.");
      } else {
        await createOffer(payload).unwrap();
        toast.success("Platform offer created.");
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to save offer."));
    }
  };

  const handleTogglePause = async (offer: PlatformOffer) => {
    const next =
      offer.effective_status === "PAUSED" || offer.status === "PAUSED"
        ? "ACTIVE"
        : "PAUSED";
    try {
      await patchStatus({ id: offer.id, status: next }).unwrap();
      toast.success(next === "PAUSED" ? "Offer paused." : "Offer activated.");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update status."));
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    setConfirmBusy(true);
    try {
      await deleteOffer(pendingDeleteId).unwrap();
      toast.success("Offer deleted.");
      setPendingDeleteId(null);
    } catch (err) {
      toast.error(extractApiError(err, "Failed to delete offer."));
    } finally {
      setConfirmBusy(false);
    }
  };

  const toggleId = (field: "event_ids" | "restaurant_ids", id: string) => {
    setForm((prev) => {
      const list = prev[field];
      return {
        ...prev,
        [field]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
      };
    });
  };

  const showEventPicker =
    form.apply_to === "SELECTED_ITEMS" &&
    (form.category === "EVENTS" || form.category === "ALL");
  const showRestaurantPicker =
    form.apply_to === "SELECTED_ITEMS" &&
    (form.category === "DINING" || form.category === "ALL");

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span className="bg-rose-500/20 text-rose-500 p-2 rounded-xl">
              <Tag size={28} />
            </span>
            Platform Offers
          </h1>
          <p className="text-zinc-400 mt-2">
            BookMyBota-funded promo codes for Events & Dining (Sports coming soon)
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder="Search offers or codes"
          />
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all whitespace-nowrap"
          >
            <Plus size={18} />
            Create Offer
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

      {tab !== "REDEMPTIONS" && (
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Offer</th>
                <th className="p-4 text-xs font-bold text-zinc-400 uppercase hidden md:table-cell">
                  Discount
                </th>
                <th className="p-4 text-xs font-bold text-zinc-400 uppercase hidden lg:table-cell">
                  Category
                </th>
                <th className="p-4 text-xs font-bold text-zinc-400 uppercase hidden lg:table-cell">
                  Used
                </th>
                <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Status</th>
                <th className="p-4 text-xs font-bold text-zinc-400 uppercase text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-400">
                    <Loader2 className="animate-spin inline mr-2" size={18} />
                    Loading offers…
                  </td>
                </tr>
              ) : offers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">
                    No platform offers yet. Create your first offer (e.g. WELCOME200).
                  </td>
                </tr>
              ) : (
                offers.map((offer) => (
                  <tr key={offer.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4">
                      <p className="font-semibold text-white">{offer.name}</p>
                      <p className="text-xs text-rose-400 font-mono mt-0.5">{offer.code}</p>
                      <p className="text-xs text-zinc-500 mt-1 hidden sm:block">
                        {formatDate(offer.start_at)} – {formatDate(offer.end_at)}
                      </p>
                    </td>
                    <td className="p-4 hidden md:table-cell text-sm text-zinc-300">
                      {formatOfferDiscount(offer.discount_type, offer.discount_value)}
                      {offer.min_order_amount > 0 && (
                        <span className="block text-xs text-zinc-500 mt-0.5">
                          Min {formatMoney(offer.min_order_amount, { compact: true })}
                        </span>
                      )}
                    </td>
                    <td className="p-4 hidden lg:table-cell text-sm text-zinc-400">
                      {offer.category}
                      {offer.customer_eligibility !== "ALL" && (
                        <span className="block text-xs text-zinc-500">
                          {offer.customer_eligibility} customers
                        </span>
                      )}
                    </td>
                    <td className="p-4 hidden lg:table-cell text-sm text-zinc-300">
                      {offer.redemption_count ?? 0}
                      {offer.usage_limit != null ? ` / ${offer.usage_limit}` : ""}
                    </td>
                    <td className="p-4">{statusBadge(offer.effective_status || offer.status)}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(offer)}
                          className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePause(offer)}
                          className="p-2 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-white/5"
                          title="Pause / Activate"
                        >
                          {offer.effective_status === "PAUSED" || offer.status === "PAUSED" ? (
                            <Play size={16} />
                          ) : (
                            <Pause size={16} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(offer.id)}
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
      )}

      {tab === "REDEMPTIONS" && (
        <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/5">
                <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Code</th>
                <th className="p-4 text-xs font-bold text-zinc-400 uppercase hidden md:table-cell">
                  Customer
                </th>
                <th className="p-4 text-xs font-bold text-zinc-400 uppercase hidden lg:table-cell">
                  Amounts
                </th>
                <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {redemptionsLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-zinc-400">
                    <Loader2 className="animate-spin inline mr-2" size={18} />
                    Loading redemptions…
                  </td>
                </tr>
              ) : redemptions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-zinc-500">
                    <Receipt className="inline mr-2 opacity-50" size={18} />
                    No redemptions recorded yet.
                  </td>
                </tr>
              ) : (
                redemptions.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4">
                      <p className="font-mono text-rose-400 text-sm">{r.promo_code}</p>
                      <p className="text-xs text-zinc-500">{r.offer_name}</p>
                    </td>
                    <td className="p-4 hidden md:table-cell text-sm text-zinc-300">
                      {r.customer_name || r.guest_phone || "Guest"}
                    </td>
                    <td className="p-4 hidden lg:table-cell text-sm text-zinc-400">
                      {formatMoney(r.original_amount, { compact: true })} →{" "}
                      <span className="text-emerald-400">
                        -{formatMoney(r.discount_amount, { compact: true })}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-zinc-500">{formatDate(r.redeemed_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {listMeta && <Pagination meta={listMeta} onPageChange={setPage} />}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl glass-panel border border-white/10 rounded-2xl p-6 my-8">
            <h2 className="text-xl font-bold text-white mb-1">
              {editingId ? "Edit Platform Offer" : "Create Platform Offer"}
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              Funded by BookMyBota — applies at event checkout (dining when payments are enabled).
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Offer Name
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                    placeholder="Welcome Offer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Offer Code
                  </label>
                  <input
                    required
                    value={form.code}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value.toUpperCase() })
                    }
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono"
                    placeholder="WELCOME200"
                  />
                </div>
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
                  placeholder="Get 200 ETB off your first event booking"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Type
                  </label>
                  <select
                    value={form.discount_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        discount_type: e.target.value as "PERCENT" | "FLAT",
                      })
                    }
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  >
                    <option value="FLAT">Flat</option>
                    <option value="PERCENT">Percent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Value
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>
                {form.discount_type === "PERCENT" && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                      Max Discount
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.max_discount}
                      onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Min Booking
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.min_order_amount}
                    onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        category: e.target.value as "ALL" | "EVENTS" | "DINING",
                      })
                    }
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  >
                    <option value="ALL">All (Events + Dining)</option>
                    <option value="EVENTS">Events only</option>
                    <option value="DINING">Dining only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Apply To
                  </label>
                  <select
                    value={form.apply_to}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        apply_to: e.target.value as "ENTIRE_CATEGORY" | "SELECTED_ITEMS",
                      })
                    }
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  >
                    <option value="ENTIRE_CATEGORY">Entire category</option>
                    <option value="SELECTED_ITEMS">Selected items</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Customers
                  </label>
                  <select
                    value={form.customer_eligibility}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        customer_eligibility: e.target.value as "ALL" | "NEW" | "EXISTING",
                      })
                    }
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  >
                    <option value="ALL">All customers</option>
                    <option value="NEW">New customers only</option>
                    <option value="EXISTING">Existing customers only</option>
                  </select>
                </div>
              </div>

              {showEventPicker && (
                <div className="border border-white/10 rounded-xl p-4 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Select Events
                  </p>
                  {eligibleEvents.length === 0 ? (
                    <p className="text-sm text-zinc-500">No eligible events.</p>
                  ) : (
                    eligibleEvents.map((ev) => (
                      <label
                        key={ev.id}
                        className="flex items-center gap-2 py-1 text-sm text-zinc-300 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={form.event_ids.includes(ev.id)}
                          onChange={() => toggleId("event_ids", ev.id)}
                        />
                        {ev.name}
                      </label>
                    ))
                  )}
                </div>
              )}

              {showRestaurantPicker && (
                <div className="border border-white/10 rounded-xl p-4 max-h-40 overflow-y-auto">
                  <p className="text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Select Restaurants (for future dining checkout)
                  </p>
                  {eligibleRestaurants.map((r) => (
                    <label
                      key={r.id}
                      className="flex items-center gap-2 py-1 text-sm text-zinc-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.restaurant_ids.includes(r.id)}
                        onChange={() => toggleId("restaurant_ids", r.id)}
                      />
                      {r.name}
                    </label>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Total Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.usage_limit}
                    onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Per Customer
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.per_user_limit}
                    onChange={(e) => setForm({ ...form, per_user_limit: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={form.start_at}
                    onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={form.end_at}
                    onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="PAUSED">Paused</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Card Theme
                  </label>
                  <select
                    value={form.display_theme}
                    onChange={(e) => setForm({ ...form, display_theme: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  >
                    <option value="magenta">Magenta</option>
                    <option value="violet">Violet</option>
                    <option value="ocean">Ocean</option>
                    <option value="sunset">Sunset</option>
                    <option value="emerald">Emerald</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || updating}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center justify-center gap-2"
                >
                  {(creating || updating) && <Loader2 className="animate-spin" size={18} />}
                  {editingId ? "Save Changes" : "Create Offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId != null}
        title="Delete platform offer?"
        body="This cannot be undone. Redemption history for this offer will also be removed."
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
