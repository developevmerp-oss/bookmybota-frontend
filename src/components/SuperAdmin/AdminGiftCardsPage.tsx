"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { CalendarDays, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AdminGiftCardDesignsPage from "@/components/SuperAdmin/AdminGiftCardDesignsPage";
import {
  useGetGiftCardSettingsQuery,
  useGetGiftCardStatsQuery,
  usePatchGiftCardSettingsMutation,
} from "@/services/api";
import { extractApiError } from "@/lib/apiErrors";
import { formatMoney } from "@/lib/currencyFormat";
import {
  DEFAULT_GIFT_CARD_VALIDITY_DAYS,
  GIFT_CARD_VALIDITY_OPTIONS,
  formatGiftCardValidityLabel,
} from "@/lib/giftCardValidity";
import {
  adminGiftCardValiditySchema,
  type AdminGiftCardValidityValues,
} from "@/lib/giftCardFormSchemas";

/**
 * Superadmin Gift Cards hub — stats, validity, designs.
 */
export default function AdminGiftCardsPage() {
  const { data: stats, isLoading: statsLoading } = useGetGiftCardStatsQuery();
  const { data: settings, isLoading: settingsLoading } = useGetGiftCardSettingsQuery();
  const [patchSettings, { isLoading: savingValidity }] = usePatchGiftCardSettingsMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<AdminGiftCardValidityValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(adminGiftCardValiditySchema) as any,
    defaultValues: { validity_days: DEFAULT_GIFT_CARD_VALIDITY_DAYS },
    mode: "onSubmit",
  });

  useEffect(() => {
    if (settings?.validity_days) {
      reset({ validity_days: settings.validity_days });
    }
  }, [settings?.validity_days, reset]);

  const tiles = [
    {
      label: "Cards issued",
      value: statsLoading ? "…" : String(stats?.issued_count ?? 0),
      sub: stats ? formatMoney(stats.issued_value, { compact: true }) : "—",
    },
    {
      label: "Outstanding balance",
      value: statsLoading
        ? "…"
        : formatMoney(stats?.outstanding_balance ?? 0, { compact: true }),
      sub: `${stats?.active_cards ?? 0} active cards`,
    },
    {
      label: "Redeemed",
      value: statsLoading
        ? "…"
        : formatMoney(stats?.redeemed_value ?? 0, { compact: true }),
      sub: "All redemptions",
    },
    {
      label: "Active designs",
      value: statsLoading ? "…" : String(stats?.active_designs ?? 0),
      sub: `${stats?.total_designs ?? 0} total (excl. archived)`,
    },
  ];

  const onSaveValidity = async (values: AdminGiftCardValidityValues) => {
    try {
      const res = await patchSettings({ validity_days: values.validity_days }).unwrap();
      toast.success(res.message || "Validity updated");
      reset({ validity_days: res.data?.validity_days ?? values.validity_days });
    } catch (err) {
      toast.error(extractApiError(err, "Failed to update validity"));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <span className="bg-rose-500/20 text-rose-500 p-2 rounded-xl">
            <CreditCard size={28} />
          </span>
          Gift Cards
        </h1>
        <p className="text-zinc-400 mt-2 max-w-2xl">
          Manage designs (customer picker), validity for new purchases, and issue/redeem stats.
          Dining payouts are under Gift Card Settlements.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{t.label}</p>
            <p className="mt-1.5 text-xl sm:text-2xl font-extrabold text-white tabular-nums flex items-center gap-2">
              {statsLoading && <Loader2 size={16} className="animate-spin text-zinc-500" />}
              {t.value}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{t.sub}</p>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit(onSaveValidity)}
        noValidate
        className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end gap-4"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white inline-flex items-center gap-2">
            <CalendarDays size={16} className="text-rose-400" />
            Expiry for new gift cards <span className="text-rose-500">*</span>
          </p>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
            Decided at purchase time: expiry = purchase date + validity. Already issued cards keep
            their original expiry. Default is 365 days (12 months).
          </p>
          <Controller
            name="validity_days"
            control={control}
            render={({ field }) => (
              <div className="mt-3 flex flex-wrap gap-2">
                {GIFT_CARD_VALIDITY_OPTIONS.map((d) => {
                  const selected = Number(field.value) === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={settingsLoading || savingValidity}
                      onClick={() => field.onChange(d)}
                      className={`h-9 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-colors ${
                        selected
                          ? "bg-rose-600 border-rose-500 text-white"
                          : "bg-zinc-900/50 border-white/10 text-zinc-300 hover:border-rose-500/40"
                      }`}
                    >
                      {formatGiftCardValidityLabel(d)}
                    </button>
                  );
                })}
              </div>
            )}
          />
          {errors.validity_days && (
            <p className="mt-1.5 text-xs text-rose-400 font-medium">
              {errors.validity_days.message}
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={settingsLoading || savingValidity || !isDirty}
          className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 shrink-0"
        >
          {savingValidity && <Loader2 size={16} className="animate-spin" />}
          Save validity
        </button>
      </form>

      <AdminGiftCardDesignsPage embedded />
    </div>
  );
}
