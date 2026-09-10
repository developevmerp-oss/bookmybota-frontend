"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  FaArchive,
  FaCalendarAlt,
  FaClock,
  FaFileAlt,
  FaPause,
  FaPencilAlt,
  FaPlay,
  FaPlus,
  FaSpinner,
  FaTag,
  FaTimes,
} from "react-icons/fa";
import { MdUnarchive } from "react-icons/md";
import { toast } from "sonner";
import {
  useGetBusinessSettingsQuery,
  useUpdateBusinessSettingsMutation,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import {
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
const labelClass = "block text-[11px] font-semibold text-slate-500 mb-1.5";
const inputClass =
  "w-full h-11 bg-white border border-slate-200 rounded-xl px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

function lightStatusBadgeClass(status: DiningOfferStatus): string {
  const colors: Record<DiningOfferStatus, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-100",
    SCHEDULED: "bg-sky-50 text-sky-700 border-sky-100",
    DRAFT: "bg-slate-50 text-slate-600 border-slate-200",
    PAUSED: "bg-amber-50 text-amber-700 border-amber-100",
    EXPIRED: "bg-rose-50 text-rose-600 border-rose-100",
    ARCHIVED: "bg-violet-50 text-violet-700 border-violet-100",
  };
  return colors[status] || colors.DRAFT;
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
      className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${lightStatusBadgeClass(status)}`}
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

  const statusCounts = useMemo(() => {
    const counts: Record<DiningOfferStatus | "TOTAL", number> = {
      TOTAL: offers.length,
      ACTIVE: 0,
      SCHEDULED: 0,
      DRAFT: 0,
      PAUSED: 0,
      EXPIRED: 0,
      ARCHIVED: 0,
    };
    for (const offer of offers) {
      const status = getEffectiveDiningOfferStatus(offer);
      counts[status] += 1;
    }
    return counts;
  }, [offers]);

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
    return <p className="text-slate-500 p-10 text-center">Loading restaurant account...</p>;
  }

  const stats = [
    {
      label: "Total Offers",
      value: statusCounts.TOTAL,
      icon: FaTag,
      iconWrap: "bg-rose-50 text-[#e11d48]",
    },
    {
      label: "Active",
      value: statusCounts.ACTIVE,
      icon: FaPlay,
      iconWrap: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Scheduled",
      value: statusCounts.SCHEDULED,
      icon: FaClock,
      iconWrap: "bg-sky-50 text-sky-600",
    },
    {
      label: "Draft",
      value: statusCounts.DRAFT,
      icon: FaFileAlt,
      iconWrap: "bg-violet-50 text-violet-600",
    },
    {
      label: "Paused",
      value: statusCounts.PAUSED,
      icon: FaPause,
      iconWrap: "bg-amber-50 text-amber-600",
    },
    {
      label: "Expired",
      value: statusCounts.EXPIRED,
      icon: FaCalendarAlt,
      iconWrap: "bg-rose-50 text-rose-500",
    },
  ];

  return (
    <div className="-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8 animate-fadeIn">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm min-h-[200px] sm:min-h-[230px]">
          <Image
            src="/images/dining-offers-banner.jpg"
            alt="Restaurant offers"
            fill
            className="object-cover object-right"
            sizes="100vw"
            priority
          />
          <div className="relative z-10 p-6 sm:p-8 max-w-xl">
            <span className="inline-flex w-fit items-center rounded-full bg-rose-50 text-[#e11d48] px-3 py-1 text-[10px] font-bold uppercase tracking-wider mb-3">
              Boost your bookings
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Restaurant Offers
            </h1>
            <p className="text-sm text-slate-500 mt-2 max-w-md leading-relaxed">
              Create promo codes for bookings and walk-in redemption at your restaurant.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm flex items-center gap-3"
              >
                <span
                  className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${stat.iconWrap}`}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">
                    {stat.label}
                  </p>
                  <p className="text-lg font-bold text-slate-900 tabular-nums leading-tight">
                    {stat.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Toolbar + table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex gap-1 flex-wrap overflow-x-auto">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
                    tab === t.key
                      ? "border-[#e11d48] text-[#e11d48]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
              <SearchInput
                value={q}
                onChange={setQ}
                placeholder="Search offers or codes..."
                className="w-full sm:w-56"
              />
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#f43f5e] to-[#e11d48] shadow-[0_8px_18px_rgba(225,29,72,0.28)] hover:from-[#e11d48] hover:to-[#be123c] transition-all whitespace-nowrap"
              >
                <FaPlus size={16} />
                Create Offer
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Offer
                  </th>
                  <th className="py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">
                    Discount
                  </th>
                  <th className="py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                    Schedule
                  </th>
                  <th className="py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="py-3 px-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 text-sm">
                      <FaSpinner className="animate-spin inline mr-2" size={18} />
                      Loading offers…
                    </td>
                  </tr>
                ) : filteredOffers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 text-sm font-medium">
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
                      <tr
                        key={offer.id}
                        className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <p className="text-sm font-semibold text-slate-900">{offer.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{offer.type}</p>
                          {offer.promo_code ? (
                            <p className="text-[11px] text-[#e11d48] font-mono mt-0.5">
                              {offer.promo_code}
                            </p>
                          ) : null}
                        </td>
                        <td className="py-3.5 px-4 hidden md:table-cell text-sm text-slate-700">
                          {formatDiningOfferDiscount(offer)}
                          {(offer.min_bill_amount ?? 0) > 0 && (
                            <span className="block text-[11px] text-slate-400 mt-0.5">
                              Min bill {offer.min_bill_amount} ETB
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 hidden lg:table-cell text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <FaCalendarAlt size={13} className="text-slate-400 shrink-0" />
                            {offer.start_at || offer.end_at ? (
                              <>
                                {offer.start_at ? formatDate(offer.start_at) : "—"} –{" "}
                                {offer.end_at ? formatDate(offer.end_at) : "—"}
                              </>
                            ) : (
                              "Always on"
                            )}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge offer={offer} />
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(offer)}
                              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                              title="Edit"
                            >
                              <FaPencilAlt size={14} />
                            </button>
                            {!isArchived && (
                              <button
                                type="button"
                                onClick={() => void handleTogglePause(offer)}
                                disabled={saving}
                                className="p-2 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-amber-50 disabled:opacity-50 transition-colors"
                                title={effective === "PAUSED" ? "Activate" : "Pause"}
                              >
                                {effective === "PAUSED" ? (
                                  <FaPlay size={14} />
                                ) : (
                                  <FaPause size={14} />
                                )}
                              </button>
                            )}
                            {isArchived ? (
                              <button
                                type="button"
                                onClick={() => void handleRestore(offer)}
                                disabled={saving}
                                className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-colors"
                                title="Restore to draft"
                              >
                                <MdUnarchive size={16} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPendingArchiveId(offer.id || null)}
                                className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                title="Archive"
                              >
                                <FaArchive size={14} />
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
        </div>
      </div>

      {formOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 overflow-y-auto bg-black/55 backdrop-blur-sm animate-fadeIn">
            <div className="absolute inset-0" onClick={() => setFormOpen(false)} aria-hidden />
            <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 my-8 shadow-2xl">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="absolute top-4 right-4 h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <FaTimes size={14} />
              </button>
              <h2 className="text-xl font-bold text-slate-900 mb-1 pr-8">
                {editingId ? "Edit Restaurant Offer" : "Create Restaurant Offer"}
              </h2>
              <p className="text-sm text-slate-500 mb-6">
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
                    <select className={inputClass} {...register("discount_type")}>
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
                      className={inputClass}
                      placeholder={discountType === "PERCENT" ? "e.g. 20" : "e.g. 200"}
                      {...register("discount_value")}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
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
                        className={inputClass}
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
                      className={inputClass}
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
                    className="h-11 px-5 rounded-full text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-11 px-5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-[#f43f5e] to-[#e11d48] shadow-[0_8px_18px_rgba(225,29,72,0.28)] hover:from-[#e11d48] hover:to-[#be123c] inline-flex items-center gap-2 disabled:opacity-60 transition-all"
                  >
                    {saving && <FaSpinner size={16} className="animate-spin" />}
                    {editingId ? "Save changes" : "Create offer"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
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
