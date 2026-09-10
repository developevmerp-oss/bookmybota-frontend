"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  CalendarDays,
  FileText,
  Images,
  LayoutDashboard,
  Loader2,
  Tags,
} from "lucide-react";
import { toast } from "sonner";
import AdminGiftCardCategoriesPanel from "@/components/SuperAdmin/AdminGiftCardCategoriesPanel";
import AdminGiftCardContentPanel from "@/components/SuperAdmin/AdminGiftCardContentPanel";
import AdminGiftCardDesignsPage from "@/components/SuperAdmin/AdminGiftCardDesignsPage";
import {
  AdminSegmentedTabs,
  AdminStatCard,
  adminFinancePageClass,
} from "@/components/SuperAdmin/AdminFinanceChrome";
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

type HubTab = "overview" | "categories" | "content" | "designs";

/**
 * Superadmin Gift Cards hub — stats, validity, categories, content, designs.
 */
export default function AdminGiftCardsPage() {
  const [tab, setTab] = useState<HubTab>("overview");
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
    <div className={adminFinancePageClass}>
      <AdminSegmentedTabs
        tabs={[
          { key: "overview", label: "Overview", icon: LayoutDashboard },
          { key: "categories", label: "Categories", icon: Tags },
          { key: "content", label: "FAQ & Terms", icon: FileText },
          { key: "designs", label: "Designs", icon: Images },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <AdminStatCard
              label="Cards issued"
              value={statsLoading ? "…" : String(stats?.issued_count ?? 0)}
              hint={stats ? formatMoney(stats.issued_value) : "—"}
            />
            <AdminStatCard
              label="Outstanding balance"
              value={
                statsLoading
                  ? "…"
                  : formatMoney(stats?.outstanding_balance ?? 0)
              }
              hint={`${stats?.active_cards ?? 0} active cards`}
              accent="text-emerald-600"
            />
            <AdminStatCard
              label="Redeemed"
              value={
                statsLoading
                  ? "…"
                  : formatMoney(stats?.redeemed_value ?? 0)
              }
              hint="All redemptions"
              accent="text-emerald-600"
            />
            <AdminStatCard
              label="Active designs"
              value={statsLoading ? "…" : String(stats?.active_designs ?? 0)}
              hint={`${stats?.total_designs ?? 0} total (excl. archived)`}
              accent="text-sky-300"
            />
          </div>

          <form
            onSubmit={handleSubmit(onSaveValidity)}
            noValidate
            className="glass-panel rounded-2xl border border-white/5 p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1 min-w-0 space-y-3">
                <p className="text-sm font-bold text-white inline-flex items-center gap-2">
                  <CalendarDays size={16} className="text-rose-400" />
                  Expiry for new gift cards <span className="text-rose-500">*</span>
                </p>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
                  Expiry = delivery calendar date + validity days, valid through the end of that day.
                  Example: deliver on 09-08-2026 with 365 days → valid through 09-08-2027. Already
                  issued cards keep their original expiry.
                </p>
                <Controller
                  name="validity_days"
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-2">
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
                                : "bg-white border-slate-200 text-slate-700 hover:border-rose-300"
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
                  <p className="text-xs text-rose-400 font-medium">{errors.validity_days.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={settingsLoading || savingValidity || !isDirty}
                className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2 shrink-0 self-start sm:self-end"
              >
                {savingValidity && <Loader2 size={16} className="animate-spin" />}
                Save validity
              </button>
            </div>
          </form>

          <div className="grid sm:grid-cols-3 gap-3">
            {(
              [
                {
                  key: "categories" as const,
                  title: "Categories",
                  body: "Browse filters customers see on the gift card store.",
                },
                {
                  key: "content" as const,
                  title: "FAQ & Terms",
                  body: "Legal and help copy shown at purchase and claim.",
                },
                {
                  key: "designs" as const,
                  title: "Designs",
                  body: "Artwork cards customers pick before choosing an amount.",
                },
              ] as const
            ).map((card) => (
              <button
                key={card.key}
                type="button"
                onClick={() => setTab(card.key)}
                className="glass-panel rounded-2xl border border-white/5 p-4 text-left hover:border-rose-500/30 hover:bg-white/[0.03] transition-colors"
              >
                <p className="text-sm font-bold text-white">{card.title}</p>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{card.body}</p>
                <p className="text-xs font-semibold text-rose-400 mt-3">Open →</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "categories" && <AdminGiftCardCategoriesPanel />}
      {tab === "content" && <AdminGiftCardContentPanel />}
      {tab === "designs" && <AdminGiftCardDesignsPage embedded />}
    </div>
  );
}
