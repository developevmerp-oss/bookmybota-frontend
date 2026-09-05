"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
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
  diningOfferStatusBadgeClass,
  formatDiningOfferDiscount,
  getEffectiveDiningOfferStatus,
  normalizeDiningOffers,
  validateDiningOffersForSave,
  type DiningOffer,
  type DiningOfferStatus,
} from "@/lib/diningOffers";
import {
  diningOfferFormSchema,
  emptyDiningOfferFormValues,
  type DiningOfferFormValues,
} from "@/lib/diningPartnerFormSchemas";
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

const fieldErrorClass = "mt-1.5 text-[11px] font-semibold text-rose-500";
const labelClass = "block text-xs font-semibold text-zinc-400 uppercase mb-2";
const inputClass = "w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

function offerToForm(offer: DiningOffer): DiningOfferFormValues {
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
  const [pendingArchiveId, setPendingArchiveId] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<DiningOfferFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(diningOfferFormSchema) as any,
    defaultValues: emptyDiningOfferFormValues(),
    mode: "onSubmit",
  });

  const discountType = watch("discount_type");

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
      const res = await updateSettings({
        bizId,
        body: { dining_offers: nextOffers },
      }).unwrap();
      setOffers(nextOffers);
      toast.success((res as { message?: string }).message || successMessage);
      return true;
    } catch (error) {
      toast.error(extractApiError(error, "Failed to save offers."));
      return false;
    }
  };

  const openCreate = () => {
    setEditingId(null);
    reset(emptyDiningOfferFormValues());
    setFormOpen(true);
  };

  const openEdit = (offer: DiningOffer) => {
    setEditingId(offer.id || null);
    reset(offerToForm(offer));
    setFormOpen(true);
  };

  const onSubmit = handleSubmit(async (values) => {
    const status = values.status;
    const nextOffer: DiningOffer = {
      id: editingId || crypto.randomUUID(),
      title: values.title.trim(),
      promo_code: values.promo_code.trim().toUpperCase(),
      type: values.type.trim() || "Offer",
      discount_type: values.discount_type,
      discount_value: Number(values.discount_value),
      max_discount:
        values.discount_type === "PERCENT" && values.max_discount
          ? Number(values.max_discount)
          : null,
      min_bill_amount: Number(values.min_bill_amount) || 0,
      per_day_limit: values.per_day_limit ? Number(values.per_day_limit) : null,
      validity: "",
      start_at: values.start_at || null,
      end_at: values.end_at || null,
      status,
      is_active: status === "ACTIVE",
      archived_at: status === "ARCHIVED" ? new Date().toISOString() : null,
    };

    const nextOffers = editingId
      ? offers.map((o) => (o.id === editingId ? { ...o, ...nextOffer, id: editingId } : o))
      : [...offers, nextOffer];

    const ok = await persistOffers(
      nextOffers,
      editingId ? "Offer updated." : "Offer created."
    );
    if (ok) setFormOpen(false);
  });

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

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Offer title <RequiredMark />
                  </label>
                  <input
                    className={inputClass}
                    placeholder="Lunch Special"
                    {...register("title")}
                  />
                  {errors.title && <p className={fieldErrorClass}>{errors.title.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>
                    Promo code <RequiredMark />
                  </label>
                  <input
                    className={`${inputClass} font-mono uppercase`}
                    placeholder="LUNCH20"
                    {...register("promo_code", {
                      setValueAs: (v) => String(v ?? "").toUpperCase(),
                    })}
                  />
                  {errors.promo_code && (
                    <p className={fieldErrorClass}>{errors.promo_code.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Offer type label</label>
                  <input
                    className={inputClass}
                    placeholder="Pre-Book Offer"
                    {...register("type")}
                  />
                  {errors.type && <p className={fieldErrorClass}>{errors.type.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select className={inputClass} {...register("status")}>
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PAUSED">Paused</option>
                  </select>
                  {errors.status && <p className={fieldErrorClass}>{errors.status.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass}>Discount type</label>
                  <select className={`${inputClass} px-3`} {...register("discount_type")}>
                    <option value="PERCENT">Percentage (%)</option>
                    <option value="FLAT">Flat (ETB)</option>
                  </select>
                  {errors.discount_type && (
                    <p className={fieldErrorClass}>{errors.discount_type.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>
                    Discount value <RequiredMark />
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={discountType === "PERCENT" ? "0.01" : "1"}
                    className={`${inputClass} px-3`}
                    placeholder={discountType === "PERCENT" ? "e.g. 20" : "e.g. 200"}
                    {...register("discount_value")}
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    {discountType === "PERCENT"
                      ? "Percent off the food bill"
                      : "Fixed ETB amount off the bill"}
                  </p>
                  {errors.discount_value && (
                    <p className={fieldErrorClass}>{errors.discount_value.message}</p>
                  )}
                </div>
                {discountType === "PERCENT" && (
                  <div>
                    <label className={labelClass}>Max discount (ETB)</label>
                    <input
                      type="number"
                      min="0"
                      className={`${inputClass} px-3`}
                      placeholder="Optional cap"
                      {...register("max_discount")}
                    />
                    {errors.max_discount && (
                      <p className={fieldErrorClass}>{errors.max_discount.message}</p>
                    )}
                  </div>
                )}
                <div>
                  <label className={labelClass}>Min bill (ETB)</label>
                  <input
                    type="number"
                    min="0"
                    className={`${inputClass} px-3`}
                    {...register("min_bill_amount")}
                  />
                  {errors.min_bill_amount && (
                    <p className={fieldErrorClass}>{errors.min_bill_amount.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Start date</label>
                  <input type="date" className={inputClass} {...register("start_at")} />
                  {errors.start_at && (
                    <p className={fieldErrorClass}>{errors.start_at.message}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>End date</label>
                  <input type="date" className={inputClass} {...register("end_at")} />
                  {errors.end_at && <p className={fieldErrorClass}>{errors.end_at.message}</p>}
                </div>
                <div>
                  <label className={labelClass}>Daily limit</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    className={inputClass}
                    {...register("per_day_limit")}
                  />
                  {errors.per_day_limit && (
                    <p className={fieldErrorClass}>{errors.per_day_limit.message}</p>
                  )}
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
