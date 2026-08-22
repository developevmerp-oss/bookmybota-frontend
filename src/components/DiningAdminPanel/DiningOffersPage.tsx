"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  BadgePercent,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetBusinessSettingsQuery,
  useUpdateBusinessSettingsMutation,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import {
  createEmptyDiningOffer,
  diningOfferStatusBadgeClass,
  formatDiningOfferDiscount,
  getEffectiveDiningOfferStatus,
  normalizeDiningOffers,
  validateDiningOffersForSave,
  type DiningOffer,
  type DiningOfferStatus,
} from "@/lib/diningOffers";
import { extractApiError } from "@/lib/apiErrors";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SearchInput from "@/components/Shared/SearchInput";
import { formatDate } from "@/lib/dateFormat";

type TabKey = "ALL" | DiningOfferStatus;

const STATUS_TABS: { key: TabKey; label: string }[] = [
  { key: "ALL", label: "All Offers" },
  { key: "ACTIVE", label: "Active" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "DRAFT", label: "Draft" },
  { key: "PAUSED", label: "Paused" },
  { key: "EXPIRED", label: "Expired" },
  { key: "ARCHIVED", label: "Archived" },
];

const EMPTY_FORM = {
  title: "",
  promo_code: "",
  type: "Pre-Book Offer",
  discount_type: "PERCENT" as "PERCENT" | "FLAT",
  discount_value: "10",
  max_discount: "",
  min_bill_amount: "0",
  per_day_limit: "",
  start_at: "",
  end_at: "",
  status: "DRAFT" as DiningOfferStatus,
};

function offerToForm(offer: DiningOffer) {
  const discountType: "PERCENT" | "FLAT" = offer.discount_type === "FLAT" ? "FLAT" : "PERCENT";
  return {
    title: offer.title || "",
    promo_code: offer.promo_code || "",
    type: offer.type || "Pre-Book Offer",
    discount_type: discountType,
    discount_value: offer.discount_value != null ? String(offer.discount_value) : "",
    max_discount: offer.max_discount != null ? String(offer.max_discount) : "",
    min_bill_amount: String(offer.min_bill_amount ?? 0),
    per_day_limit: offer.per_day_limit != null ? String(offer.per_day_limit) : "",
    start_at: offer.start_at || "",
    end_at: offer.end_at || "",
    status: (offer.status || "DRAFT") as DiningOfferStatus,
  };
}

function StatusBadge({ offer }: { offer: DiningOffer }) {
  const status = getEffectiveDiningOfferStatus(offer);
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${diningOfferStatusBadgeClass(status)}`}
    >
      {status}
    </span>
  );
}

export default function DiningOffersPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id ?? "";

  const [tab, setTab] = useState<TabKey>("ALL");
  const [q, setQ] = useState("");
  const [offers, setOffers] = useState<DiningOffer[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const { data: settings, isLoading } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const [updateSettings, { isLoading: saving }] = useUpdateBusinessSettingsMutation();

  useEffect(() => {
    if (settings?.dining_offers) {
      setOffers(normalizeDiningOffers(settings.dining_offers));
    }
  }, [settings?.dining_offers]);

  const filteredOffers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return offers.filter((offer) => {
      const effective = getEffectiveDiningOfferStatus(offer);
      if (tab !== "ALL" && effective !== tab) return false;
      if (!needle) return true;
      return (
        offer.title.toLowerCase().includes(needle) ||
        (offer.promo_code || "").toLowerCase().includes(needle)
      );
    });
  }, [offers, q, tab]);

  const persistOffers = async (nextOffers: DiningOffer[], successMessage: string) => {
    const err = validateDiningOffersForSave(nextOffers);
    if (err) {
      toast.error(err);
      return false;
    }
    try {
      await updateSettings({
        bizId,
        body: { dining_offers: nextOffers },
      }).unwrap();
      setOffers(nextOffers);
      toast.success(successMessage);
      return true;
    } catch (error) {
      toast.error(extractApiError(error, "Failed to save offers."));
      return false;
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  };

  const openEdit = (offer: DiningOffer) => {
    setEditingId(offer.id || null);
    setForm(offerToForm(offer));
    setFormOpen(true);
  };

  const buildOfferFromForm = (): DiningOffer => {
    const status = form.status;
    return {
      id: editingId || crypto.randomUUID(),
      title: form.title.trim(),
      promo_code: form.promo_code.trim().toUpperCase(),
      type: form.type.trim() || "Offer",
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_discount:
        form.discount_type === "PERCENT" && form.max_discount
          ? Number(form.max_discount)
          : null,
      min_bill_amount: Number(form.min_bill_amount) || 0,
      per_day_limit: form.per_day_limit ? Number(form.per_day_limit) : null,
      validity: "",
      start_at: form.start_at || null,
      end_at: form.end_at || null,
      status,
      is_active: status === "ACTIVE",
      archived_at: status === "ARCHIVED" ? new Date().toISOString() : null,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Offer title is required.");
      return;
    }
    if (!form.promo_code.trim()) {
      toast.error("Promo code is required.");
      return;
    }
    if (!form.discount_value.trim() || Number(form.discount_value) < 0) {
      toast.error("Enter a valid discount value.");
      return;
    }
    if (form.discount_type === "PERCENT" && Number(form.discount_value) > 100) {
      toast.error("Percentage discount cannot exceed 100.");
      return;
    }

    const nextOffer = buildOfferFromForm();
    const nextOffers = editingId
      ? offers.map((o) => (o.id === editingId ? { ...o, ...nextOffer, id: editingId } : o))
      : [...offers, nextOffer];

    const ok = await persistOffers(
      nextOffers,
      editingId ? "Offer updated." : "Offer created."
    );
    if (ok) setFormOpen(false);
  };

  const handleTogglePause = async (offer: DiningOffer) => {
    const effective = getEffectiveDiningOfferStatus(offer);
    const nextStatus: DiningOfferStatus =
      effective === "PAUSED" || offer.status === "PAUSED" ? "ACTIVE" : "PAUSED";
    const nextOffers = offers.map((o) =>
      o.id === offer.id
        ? {
            ...o,
            status: nextStatus,
            is_active: nextStatus === "ACTIVE",
          }
        : o
    );
    await persistOffers(
      nextOffers,
      nextStatus === "PAUSED" ? "Offer paused." : "Offer activated."
    );
  };

  const handleArchive = async () => {
    if (!pendingArchiveId) return;
    setConfirmBusy(true);
    const nextOffers = offers.map((o) =>
      o.id === pendingArchiveId
        ? {
            ...o,
            status: "ARCHIVED" as DiningOfferStatus,
            archived_at: new Date().toISOString(),
            is_active: false,
          }
        : o
    );
    const ok = await persistOffers(nextOffers, "Offer archived.");
    setConfirmBusy(false);
    if (ok) setPendingArchiveId(null);
  };

  const handleRestore = async (offer: DiningOffer) => {
    const nextOffers = offers.map((o) =>
      o.id === offer.id
        ? {
            ...o,
            status: "DRAFT" as DiningOfferStatus,
            archived_at: null,
            is_active: false,
          }
        : o
    );
    await persistOffers(nextOffers, "Offer restored to draft.");
  };

  if (!user?.business_id) {
    return <p className="text-zinc-400 p-10 text-center">Loading restaurant account...</p>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span className="bg-rose-500/20 text-rose-500 p-2 rounded-xl">
              <BadgePercent size={28} />
            </span>
            Restaurant Offers
          </h1>
          <p className="text-zinc-400 mt-2">
            Create promo codes for bookings and walk-in redemption at your restaurant.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <SearchInput
            value={q}
            onChange={setQ}
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
            onClick={() => setTab(t.key)}
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
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Offer</th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase hidden md:table-cell">
                Discount
              </th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase hidden lg:table-cell">
                Schedule
              </th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Status</th>
              <th className="p-4 text-xs font-bold text-zinc-400 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-zinc-400">
                  <Loader2 className="animate-spin inline mr-2" size={18} />
                  Loading offers…
                </td>
              </tr>
            ) : filteredOffers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-zinc-500">
                  {offers.length === 0
                    ? "No offers yet. Create your first promo code (e.g. LUNCH20)."
                    : "No offers match this filter."}
                </td>
              </tr>
            ) : (
              filteredOffers.map((offer) => {
                const effective = getEffectiveDiningOfferStatus(offer);
                const isArchived = effective === "ARCHIVED";
                return (
                  <tr key={offer.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4">
                      <p className="font-semibold text-white">{offer.title}</p>
                      <p className="text-xs text-rose-400 font-mono mt-0.5">
                        {offer.promo_code || "—"}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">{offer.type}</p>
                    </td>
                    <td className="p-4 hidden md:table-cell text-sm text-zinc-300">
                      {formatDiningOfferDiscount(offer)}
                      {(offer.min_bill_amount ?? 0) > 0 && (
                        <span className="block text-xs text-zinc-500 mt-0.5">
                          Min bill {offer.min_bill_amount} ETB
                        </span>
                      )}
                    </td>
                    <td className="p-4 hidden lg:table-cell text-xs text-zinc-400">
                      {offer.start_at || offer.end_at ? (
                        <>
                          {offer.start_at ? formatDate(offer.start_at) : "—"} –{" "}
                          {offer.end_at ? formatDate(offer.end_at) : "—"}
                        </>
                      ) : (
                        "Always on"
                      )}
                    </td>
                    <td className="p-4">
                      <StatusBadge offer={offer} />
                    </td>
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
                        {!isArchived && (
                          <button
                            type="button"
                            onClick={() => void handleTogglePause(offer)}
                            disabled={saving}
                            className="p-2 text-zinc-400 hover:text-amber-300 rounded-lg hover:bg-white/5 disabled:opacity-50"
                            title={effective === "PAUSED" ? "Activate" : "Pause"}
                          >
                            {effective === "PAUSED" ? <Play size={16} /> : <Pause size={16} />}
                          </button>
                        )}
                        {isArchived ? (
                          <button
                            type="button"
                            onClick={() => void handleRestore(offer)}
                            disabled={saving}
                            className="p-2 text-zinc-400 hover:text-emerald-400 rounded-lg hover:bg-white/5 disabled:opacity-50"
                            title="Restore to draft"
                          >
                            <ArchiveRestore size={16} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingArchiveId(offer.id || null)}
                            className="p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-white/5"
                            title="Archive"
                          >
                            <Archive size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl glass-panel border border-white/10 rounded-2xl p-6 my-8">
            <h2 className="text-xl font-bold text-white mb-1">
              {editingId ? "Edit Restaurant Offer" : "Create Restaurant Offer"}
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              Guests can pick this offer when booking. Staff redeem it via Scan QR or walk-in promo.
            </p>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Offer title *
                  </label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                    placeholder="Lunch Special"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Promo code *
                  </label>
                  <input
                    required
                    value={form.promo_code}
                    onChange={(e) =>
                      setForm({ ...form, promo_code: e.target.value.toUpperCase() })
                    }
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono"
                    placeholder="LUNCH20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Offer type label
                  </label>
                  <input
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                    placeholder="Pre-Book Offer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as DiningOfferStatus })
                    }
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PAUSED">Paused</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Discount type
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
                    <option value="PERCENT">Percentage (%)</option>
                    <option value="FLAT">Flat (ETB)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Discount value *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step={form.discount_type === "PERCENT" ? "0.01" : "1"}
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                    placeholder={form.discount_type === "PERCENT" ? "e.g. 20" : "e.g. 200"}
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {form.discount_type === "PERCENT"
                      ? "Percent off the food bill"
                      : "Fixed ETB amount off the bill"}
                  </p>
                </div>
                {form.discount_type === "PERCENT" && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                      Max discount (ETB)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.max_discount}
                      onChange={(e) => setForm({ ...form, max_discount: e.target.value })}
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                      placeholder="Optional cap"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Min bill (ETB)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.min_bill_amount}
                    onChange={(e) => setForm({ ...form, min_bill_amount: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={form.start_at}
                    onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    End date
                  </label>
                  <input
                    type="date"
                    value={form.end_at}
                    onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                    Daily limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.per_day_limit}
                    onChange={(e) => setForm({ ...form, per_day_limit: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white"
                  />
                </div>
              </div>

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
                  disabled={saving}
                  className="btn-primary rounded-xl px-4 py-2.5 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingId ? "Save changes" : "Create offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingArchiveId)}
        title="Archive offer?"
        body="Archived offers are hidden from customers and cannot be redeemed. You can restore them later from the Archived tab."
        confirmLabel="Archive"
        danger
        busy={confirmBusy}
        onConfirm={() => void handleArchive()}
        onCancel={() => setPendingArchiveId(null)}
      />
    </div>
  );
}
