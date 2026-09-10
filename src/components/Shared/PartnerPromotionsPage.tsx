"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import {
  Calendar,
  ImagePlus,
  CreditCard,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetBusinessCampaignsQuery,
  useGetOrganizerEventsQuery,
  useGetPublicMarketingPlansQuery,
  useGetPublicMoviesQuery,
  useRequestMarketingCampaignMutation,
  useResubmitMarketingCampaignMutation,
  useUploadImageMutation,
  type MarketingCampaign,
} from "@/services/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { loadFromStorage } from "@/features/auth/authSlice";
import { extractApiError } from "@/lib/apiErrors";
import { extractUploadUrl, resolveMediaUrl } from "@/lib/mediaUrl";
import { formatDate } from "@/lib/dateFormat";
import { formatMoneyDisplay } from "@/lib/currencyFormat";
import Pagination from "@/components/Shared/Pagination";
import { CroppedImageField } from "@/components/Shared/ImageCropPicker";
import { PAGE_SIZE } from "@/lib/pagination";
import { defaultPartnerCtaUrl } from "@/lib/promotionCta";
import { promotionTargetLabel } from "@/lib/promotionTargetLabel";
import {
  emptyPartnerPromotionsFormValues,
  partnerPromotionsFormSchema,
  type PartnerPromotionsFormValues,
} from "@/lib/partnerPromotionsFormSchema";

type PartnerModule = "DINING" | "EVENTS" | "MOVIES";

type PartnerPromotionsPageProps = {
  module: PartnerModule;
  title?: string;
  description?: string;
};

const fieldErrorClass = "mt-1.5 text-xs text-rose-500 font-medium";
const diningInputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#e11d48] focus:ring-1 focus:ring-[#e11d48]/20 transition-all";

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

function statusBadge(status?: string, dining = false) {
  const s = (status || "PENDING").toUpperCase();
  const colors: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800",
    ACTIVE: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-rose-100 text-rose-800",
    PAUSED: "bg-sky-100 text-sky-800",
    EXPIRED: "bg-slate-200 text-slate-600",
    CANCELLED: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`inline-flex ${
        dining ? "px-2.5 py-1 rounded-full" : "px-2 py-0.5 rounded-md"
      } text-[10px] font-bold uppercase ${colors[s] || colors.PENDING}`}
    >
      {s}
    </span>
  );
}

function paymentBadge(status?: string, dining = false) {
  const s = (status || "UNPAID").toUpperCase();
  const colors: Record<string, string> = {
    PAID: dining ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800",
    ADMIN_WAIVED: "bg-violet-100 text-violet-800",
    UNPAID: "bg-amber-100 text-amber-800",
    PENDING_VERIFICATION: "bg-amber-100 text-amber-800",
    REFUNDED: "bg-slate-100 text-slate-600",
    FAILED: "bg-rose-100 text-rose-800",
  };
  const label =
    s === "ADMIN_WAIVED" ? "Waived" : s === "PENDING_VERIFICATION" ? "Pending" : s.charAt(0) + s.slice(1).toLowerCase();
  return (
    <span
      className={`inline-flex ${
        dining ? "px-2.5 py-1 rounded-full" : "px-2 py-0.5 rounded-md"
      } text-[10px] font-bold uppercase ${colors[s] || colors.UNPAID}`}
    >
      {label}
    </span>
  );
}

export default function PartnerPromotionsPage({
  module,
  title = "Marketing Promotions",
  description = "Pay for a visibility plan, then Super Admin reviews your banner. Once approved, your promotion runs until the plan duration ends.",
}: PartnerPromotionsPageProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const bizId = user?.business_id?.toString() || "";

  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null);
  const [ctaTouched, setCtaTouched] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PartnerPromotionsFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(partnerPromotionsFormSchema) as any,
    defaultValues: emptyPartnerPromotionsFormValues(module),
    mode: "onSubmit",
  });

  const planId = watch("plan_id");
  const bannerUrl = watch("banner_image_url");
  const targetId = watch("target_id");
  const landingSlider = watch("landing_slider");
  const allowsItemTarget = watch("allows_item_target");

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    if (!modalOpen || ctaTouched || !bizId) return;
    const next = defaultPartnerCtaUrl(module, bizId, targetId);
    if (next) setValue("cta_url", next);
  }, [modalOpen, module, bizId, targetId, ctaTouched, setValue]);

  const { data: campaignsData, isLoading } = useGetBusinessCampaignsQuery(
    { bizId, page, limit: PAGE_SIZE },
    { skip: !bizId }
  );
  const { data: plans = [] } = useGetPublicMarketingPlansQuery({ module }, { skip: !bizId });
  const { data: organizerEventsData } = useGetOrganizerEventsQuery(
    { page: 1, limit: 100 },
    { skip: !bizId || module !== "EVENTS" }
  );
  const { data: moviesData } = useGetPublicMoviesQuery(
    { page: 1, limit: 100 },
    { skip: !bizId || module !== "MOVIES" }
  );

  const [requestCampaign, { isLoading: submitting }] = useRequestMarketingCampaignMutation();
  const [resubmitCampaign, { isLoading: resubmitting }] = useResubmitMarketingCampaignMutation();
  const [uploadImage, { isLoading: uploading }] = useUploadImageMutation();

  const campaigns = campaignsData?.items ?? [];
  const saving = submitting || resubmitting;
  const selectedPlan = useMemo(() => {
    const fromList = plans.find((p) => String(p.id) === planId);
    if (fromList) return fromList;
    if (editingCampaign && String(editingCampaign.plan_id) === planId) {
      return {
        id: editingCampaign.plan_id,
        name: editingCampaign.plan_name || "Current plan",
        duration_days: editingCampaign.duration_days || 0,
        price: Number(editingCampaign.amount ?? editingCampaign.price ?? 0),
        listing_boost: Boolean(editingCampaign.listing_boost),
        landing_slider: Boolean(editingCampaign.landing_slider),
        category_rail: Boolean(editingCampaign.category_rail),
        allows_item_target: Boolean(editingCampaign.allows_item_target),
      };
    }
    return undefined;
  }, [plans, planId, editingCampaign]);

  useEffect(() => {
    if (!selectedPlan) {
      setValue("landing_slider", false);
      setValue("allows_item_target", false);
      return;
    }
    setValue("landing_slider", Boolean(selectedPlan.landing_slider));
    setValue("allows_item_target", Boolean(selectedPlan.allows_item_target));
  }, [selectedPlan, setValue]);

  const targetOptions = useMemo(() => {
    if (module === "EVENTS") {
      return (organizerEventsData?.items || []).map((e) => ({
        id: e.id,
        label: e.name,
      }));
    }
    if (module === "MOVIES") {
      return (moviesData?.items || []).map((m) => ({
        id: m.id,
        label: m.title,
      }));
    }
    return [];
  }, [module, organizerEventsData?.items, moviesData?.items]);

  const movieTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of moviesData?.items || []) {
      if (m.id) map.set(String(m.id), m.title);
      if (m.slug) map.set(String(m.slug), m.title);
    }
    return map;
  }, [moviesData?.items]);

  const eventNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of organizerEventsData?.items || []) {
      if (e.id) map.set(String(e.id), e.name);
    }
    return map;
  }, [organizerEventsData?.items]);

  const targetLookups = useMemo(
    () => ({ movieTitleById, eventNameById }),
    [movieTitleById, eventNameById]
  );

  if (!bizId) return null;

  const resetForm = () => {
    setEditingCampaign(null);
    setCtaTouched(false);
    reset(emptyPartnerPromotionsFormValues(module));
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (camp: MarketingCampaign) => {
    const nextTarget =
      camp.target_type ||
      (module === "DINING" ? "RESTAURANT" : module === "EVENTS" ? "EVENT" : "MOVIE");
    setEditingCampaign(camp);
    setCtaTouched(Boolean(camp.cta_url?.trim()));
    reset({
      plan_id: String(camp.plan_id),
      title: camp.title || camp.plan_name || "",
      banner_image_url: camp.banner_image_url || "",
      cta_url: camp.cta_url || defaultPartnerCtaUrl(module, bizId, camp.target_id || "") || "",
      target_type: nextTarget as PartnerPromotionsFormValues["target_type"],
      target_id: camp.target_id || "",
      landing_slider: Boolean(camp.landing_slider),
      allows_item_target: Boolean(camp.allows_item_target),
    });
    setModalOpen(true);
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await uploadImage(fd).unwrap();
      const url = extractUploadUrl(res);
      if (!url) throw new Error("Upload failed");
      setValue("banner_image_url", url, { shouldValidate: true, shouldDirty: true });
      toast.success((res as { message?: string })?.message || "Banner uploaded");
    } catch (err) {
      toast.error(extractApiError(err, "Failed to upload banner"));
    }
  };

  const onValid = async (values: PartnerPromotionsFormValues) => {
    const payload = {
      title: values.title.trim(),
      banner_image_url: values.banner_image_url || undefined,
      cta_url:
        values.cta_url.trim() ||
        defaultPartnerCtaUrl(module, bizId, values.target_id) ||
        undefined,
      target_type:
        module === "DINING" && values.target_type === "BUSINESS" ? "RESTAURANT" : values.target_type,
      target_id: values.target_id || (module === "DINING" ? bizId : undefined),
    };

    try {
      if (editingCampaign) {
        const res = await resubmitCampaign({
          bizId,
          campaignId: editingCampaign.id,
          ...payload,
        }).unwrap();
        toast.success(
          (res as { message?: string })?.message || "Resubmitted. Waiting for Super Admin review."
        );
      } else {
        const res = await requestCampaign({
          bizId,
          plan_id: Number(values.plan_id),
          category: module,
          ...payload,
        }).unwrap();
        toast.success(
          (res as { message?: string })?.message || "Payment successful. Request sent for admin approval."
        );
      }
      setModalOpen(false);
      resetForm();
    } catch (err) {
      toast.error(extractApiError(err, editingCampaign ? "Failed to resubmit" : "Failed to submit request"));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400">
        <Loader2 className="animate-spin w-8 h-8 mr-2" /> Loading promotions...
      </div>
    );
  }

  const isDining = module === "DINING";
  const inputClass = isDining ? diningInputClass : "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const formFields = (
    <>
      {editingCampaign?.admin_note ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          <p className="font-semibold mb-0.5">Rejected — fix the items below and send again.</p>
          <p>Reason: {editingCampaign.admin_note}</p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className={`font-semibold text-slate-600 ${isDining ? "text-sm" : "text-xs"}`}>
          Plan <RequiredMark />
        </label>
        {editingCampaign ? (
          <div className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            {editingCampaign.plan_name || selectedPlan?.name} — already paid, plan cannot be changed
          </div>
        ) : (
          <select {...register("plan_id")} className={inputClass}>
            <option value="">Select plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatMoneyDisplay(p.price)} / {p.duration_days} days
              </option>
            ))}
          </select>
        )}
        {errors.plan_id && <p className={fieldErrorClass}>{errors.plan_id.message}</p>}
      </div>

      {selectedPlan && !isDining ? (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-1">
          <p>Listing boost: {selectedPlan.listing_boost ? "Yes" : "No"}</p>
          <p>Landing slider: {selectedPlan.landing_slider ? "Yes" : "No"}</p>
          <p>Category rail: {selectedPlan.category_rail ? "Yes" : "No"}</p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className={`font-semibold text-slate-600 ${isDining ? "text-sm" : "text-xs"}`}>
          Promotion title <RequiredMark />
        </label>
        <input
          {...register("title")}
          placeholder={isDining ? "Enter promotion title" : undefined}
          className={inputClass}
        />
        {errors.title && <p className={fieldErrorClass}>{errors.title.message}</p>}
      </div>

      {landingSlider ? (
        <div className="space-y-2">
          <span className={`font-semibold text-slate-600 ${isDining ? "text-sm" : "text-xs"}`}>
            Banner image <RequiredMark />
          </span>
          <CroppedImageField
            value={bannerUrl || ""}
            aspect={21 / 9}
            disabled={uploading}
            previewClassName="w-full aspect-[21/9] object-cover rounded-xl border border-slate-200 overflow-hidden"
            emptyClassName="flex flex-col items-center justify-center w-full aspect-[21/9] rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:border-rose-400 text-slate-400"
            emptyLabel="Upload & crop banner"
            emptyContent={
              <>
                <ImagePlus size={28} className="mb-2" />
                <span className={`font-semibold text-slate-600 ${isDining ? "text-sm" : "text-xs"}`}>
                  Upload & crop banner
                </span>
              </>
            }
            onRemove={() => setValue("banner_image_url", "", { shouldValidate: true, shouldDirty: true })}
            onCroppedFile={(file) => void onUpload(file)}
          />
          {errors.banner_image_url && (
            <p className={fieldErrorClass}>{errors.banner_image_url.message}</p>
          )}
        </div>
      ) : null}

      {module !== "DINING" && allowsItemTarget ? (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-600">
            Promote specific {module === "EVENTS" ? "event" : "movie"} <RequiredMark />
          </label>
          <select {...register("target_id")} className={inputClass}>
            <option value="">Select...</option>
            {targetOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
          {errors.target_id && <p className={fieldErrorClass}>{errors.target_id.message}</p>}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label className={`font-semibold text-slate-600 ${isDining ? "text-sm" : "text-xs"}`}>CTA URL</label>
        <input
          {...register("cta_url", {
            onChange: () => setCtaTouched(true),
          })}
          placeholder={
            defaultPartnerCtaUrl(module, bizId, targetId) ||
            (module === "EVENTS"
              ? "/events/..."
              : module === "MOVIES"
                ? "/movies/..."
                : `/restaurant/${bizId}`)
          }
          className={inputClass}
        />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          This is where customers go when they tap your banner on the home slider.
          Leave it as the details page (restaurant / event / movie) so the banner opens your listing.
        </p>
      </div>

      {selectedPlan ? (
        <div
          className={`rounded-xl border p-4 space-y-3 ${
            isDining
              ? "border-rose-100 bg-rose-50/50"
              : "border-[#6900AA]/20 bg-[#F7E9FF]/60"
          }`}
        >
          <div
            className={`flex items-center gap-2 font-semibold text-sm ${
              isDining ? "text-[#e11d48]" : "text-[#6900AA]"
            }`}
          >
            <CreditCard size={16} />
            {editingCampaign ? "Already paid" : "Order summary"}
          </div>
          <div className="flex justify-between text-sm text-slate-700">
            <span>{selectedPlan.name}</span>
            <span className="font-bold">{formatMoneyDisplay(selectedPlan.price)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Duration</span>
            <span>{selectedPlan.duration_days} days after approval</span>
          </div>
          {editingCampaign ? (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              No extra charge. Your updated banner goes back to Super Admin for review.
              The promotion starts only after approval.
            </p>
          ) : (
            <>
              <div
                className={`border-t pt-2 flex justify-between text-sm font-bold text-slate-900 ${
                  isDining ? "border-rose-100" : "border-[#6900AA]/10"
                }`}
              >
                <span>Total</span>
                <span>{formatMoneyDisplay(selectedPlan.price)}</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Demo payment — no real charge. After pay, your request goes to Super Admin for banner approval.
                Promotion auto-expires when the plan duration ends.
              </p>
            </>
          )}
        </div>
      ) : null}
    </>
  );

  const formActions = (
    <div className={`flex justify-end gap-2 ${isDining ? "pt-1" : "pt-2"}`}>
      <button
        type="button"
        onClick={closeModal}
        className={`px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 ${
          isDining ? "shadow-sm" : ""
        }`}
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={saving || uploading || !selectedPlan}
        className={`px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60 ${
          isDining
            ? "bg-[#e11d48] text-white-keep hover:bg-[#be123c] shadow-md shadow-rose-200/60"
            : "btn-primary"
        }`}
      >
        {(saving || uploading) && <Loader2 size={14} className="animate-spin" />}
        {editingCampaign ? (
          <>
            <Pencil size={14} />
            Resubmit for review
          </>
        ) : (
          <>
            <CreditCard size={14} />
            Pay & Submit
          </>
        )}
      </button>
    </div>
  );

  const diningModal =
    modalOpen && isDining
      ? createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
            <form
              onSubmit={handleSubmit(onValid)}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col sm:flex-row"
              noValidate
            >
              <aside className="sm:w-[240px] shrink-0 bg-gradient-to-b from-sky-50 via-blue-50/80 to-white p-6 flex flex-col items-center justify-center text-center border-b sm:border-b-0 sm:border-r border-sky-100 min-h-[220px] sm:min-h-0">
                <div className="h-24 w-24 rounded-full bg-white shadow-lg shadow-sky-200/50 ring-4 ring-sky-100 flex items-center justify-center mb-5">
                  <Megaphone size={40} className="text-sky-600" />
                </div>
                <h4 className="text-lg font-extrabold text-slate-900">Get more visibility</h4>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed max-w-[11rem]">
                  Your restaurant will appear on the landing slider and dining listings.
                </p>
              </aside>

              <div className="flex-1 min-w-0 p-5 sm:p-6 overflow-y-auto space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900">
                      {editingCampaign ? "Fix & resubmit promotion" : "Request Promotion"}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Fill in the details below to request a promotion.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                {formFields}
                {formActions}
              </div>
            </form>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className={
        isDining
          ? "-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8 animate-fadeIn"
          : "max-w-7xl mx-auto space-y-8"
      }
    >
      <div className={isDining ? "max-w-7xl mx-auto space-y-8" : "contents"}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2 className={`font-bold text-slate-800 ${isDining ? "text-2xl sm:text-3xl font-extrabold text-slate-900" : "text-2xl"}`}>
              {title}
            </h2>
            <p className="text-slate-500 mt-1">{description}</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className={
              isDining
                ? "inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#e11d48] text-white-keep text-sm font-semibold hover:bg-[#be123c] shadow-md shadow-rose-200/70 cursor-pointer shrink-0"
                : "inline-flex items-center gap-2 btn-primary px-4 py-2.5 rounded-xl text-sm font-semibold"
            }
          >
            <Plus size={16} /> Buy Promotion
          </button>
        </div>

        {campaigns.length === 0 ? (
          <div
            className={`rounded-2xl p-10 text-center ${
              isDining ? "bg-slate-50 border border-slate-200" : "bg-slate-50 border border-slate-200"
            }`}
          >
            <Megaphone className={`mx-auto mb-3 ${isDining ? "text-[#e11d48]" : "text-slate-400"}`} size={32} />
            <h3 className="text-lg font-bold text-slate-700 mb-2">No promotion requests yet</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Choose a marketing plan and submit a banner request. Once approved, it appears on the customer landing slider and listings.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((camp: MarketingCampaign) => {
              const targetLabel = promotionTargetLabel(camp, targetLookups);
              const showTargetName =
                (String(camp.target_type || "").toUpperCase() === "MOVIE" ||
                  String(camp.target_type || "").toUpperCase() === "EVENT") &&
                Boolean(camp.target_id)
                  ? targetLabel
                  : "";
              const headerLabel = showTargetName || "Listing boost only";
              const cardTitle = camp.title || camp.plan_name || "Promotion";
              const dateLine =
                camp.status === "ACTIVE" && camp.start_date
                  ? `${formatDate(camp.start_date)} → ${formatDate(camp.end_date)}`
                  : camp.status === "EXPIRED"
                    ? `Ended ${formatDate(camp.end_date)}`
                    : camp.end_date
                      ? `Runs ${camp.duration_days ?? "—"} days after approval`
                      : null;

              if (isDining) {
                return (
                  <div
                    key={camp.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    {camp.banner_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveMediaUrl(camp.banner_image_url)}
                        alt={cardTitle}
                        className="w-full aspect-[16/9] object-cover"
                      />
                    ) : (
                      <div className="relative w-full aspect-[16/10] bg-gradient-to-br from-sky-100 via-blue-50 to-indigo-50 flex flex-col items-center justify-center px-4 overflow-hidden">
                        <div
                          className="pointer-events-none absolute inset-0 opacity-40"
                          style={{
                            backgroundImage:
                              "radial-gradient(circle at 20% 30%, rgba(14,165,233,0.14), transparent 45%), radial-gradient(circle at 80% 70%, rgba(99,102,241,0.12), transparent 40%)",
                          }}
                        />
                        <div className="relative h-14 w-14 rounded-full bg-white border-2 border-sky-300 shadow-[0_0_0_6px_rgba(186,230,253,0.55)] flex items-center justify-center mb-3">
                          <Megaphone size={24} className="text-sky-600" />
                        </div>
                        <p className="relative text-sm font-medium text-slate-700 text-center">{headerLabel}</p>
                      </div>
                    )}

                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(camp.status, true)}
                        {paymentBadge(camp.payment_status, true)}
                        {camp.status === "PENDING" && camp.reviewed_at ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-sky-100 text-sky-800">
                            Resubmitted
                          </span>
                        ) : null}
                        <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                          {camp.category || module}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-[15px] leading-snug">{cardTitle}</h4>
                        {camp.plan_name ? (
                          <p className="text-xs text-slate-500 mt-0.5">{camp.plan_name}</p>
                        ) : null}
                      </div>

                      {(camp.amount != null || camp.payment_reference) && (
                        <div className="text-xs text-slate-600 space-y-0.5 rounded-xl bg-slate-50 border border-slate-100 px-3 py-2.5">
                          {camp.amount != null ? (
                            <p>
                              Paid: <span className="font-semibold">{formatMoneyDisplay(camp.amount)}</span>
                            </p>
                          ) : null}
                          {camp.payment_reference ? (
                            <p className="text-slate-500 truncate">Ref: {camp.payment_reference}</p>
                          ) : null}
                        </div>
                      )}

                      {camp.admin_note &&
                      (camp.status === "REJECTED" || (camp.status === "PENDING" && camp.reviewed_at)) ? (
                        <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-2 py-1">
                          Admin: {camp.admin_note}
                        </p>
                      ) : null}

                      {camp.status === "PENDING" ? (
                        <p className="text-[11px] text-amber-700">
                          {camp.reviewed_at
                            ? "Resubmitted — waiting for Super Admin review"
                            : "Waiting for Super Admin review"}
                        </p>
                      ) : camp.status === "REJECTED" ? (
                        <p className="text-[11px] text-rose-600">
                          Rejected — fix the creative and resubmit. Payment is kept.
                        </p>
                      ) : dateLine ? (
                        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Calendar size={13} className="shrink-0 text-slate-400" />
                          {dateLine}
                        </p>
                      ) : null}

                      {camp.status === "REJECTED" ? (
                        <button
                          type="button"
                          onClick={() => openEdit(camp)}
                          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#e11d48] text-white-keep px-3 py-1.5 text-xs font-semibold hover:bg-[#be123c]"
                        >
                          <Pencil size={12} /> Fix & resubmit
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              }

              return (
                <div key={camp.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  {camp.banner_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveMediaUrl(camp.banner_image_url)}
                      alt={camp.title || camp.plan_name || "Promotion"}
                      className="w-full aspect-[21/9] object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-[21/9] bg-slate-100 flex items-center justify-center px-4 text-center text-slate-600 text-sm font-semibold">
                      {showTargetName || "Listing boost only"}
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {statusBadge(camp.status)}
                      {paymentBadge(camp.payment_status)}
                      {camp.status === "PENDING" && camp.reviewed_at ? (
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-sky-100 text-sky-800">
                          Resubmitted
                        </span>
                      ) : null}
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {camp.category || module}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800">{camp.title || camp.plan_name}</h4>
                    {showTargetName ? (
                      <p className="text-xs font-medium text-[#6900AA]">{showTargetName}</p>
                    ) : null}
                    <p className="text-xs text-slate-500">{camp.plan_name}</p>
                    {(camp.amount != null || camp.payment_reference) && (
                      <div className="text-xs text-slate-600 space-y-0.5 rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-2">
                        {camp.amount != null ? (
                          <p>
                            Paid: <span className="font-semibold">{formatMoneyDisplay(camp.amount)}</span>
                          </p>
                        ) : null}
                        {camp.payment_reference ? (
                          <p className="text-slate-500 truncate">Ref: {camp.payment_reference}</p>
                        ) : null}
                      </div>
                    )}
                    {camp.admin_note && (camp.status === "REJECTED" || (camp.status === "PENDING" && camp.reviewed_at)) ? (
                      <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-2 py-1">Admin: {camp.admin_note}</p>
                    ) : null}
                    {camp.status === "PENDING" ? (
                      <p className="text-[11px] text-amber-700">
                        {camp.reviewed_at
                          ? "Resubmitted — waiting for Super Admin review"
                          : "Waiting for Super Admin review"}
                      </p>
                    ) : camp.status === "REJECTED" ? (
                      <p className="text-[11px] text-rose-600">Rejected — fix the creative and resubmit. Payment is kept.</p>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        {camp.status === "ACTIVE" && camp.start_date
                          ? `${formatDate(camp.start_date)} → ${formatDate(camp.end_date)}`
                          : camp.status === "EXPIRED"
                            ? `Ended ${formatDate(camp.end_date)}`
                            : camp.end_date
                              ? `Runs ${camp.duration_days ?? "—"} days after approval`
                              : "—"}
                      </p>
                    )}
                    {camp.status === "REJECTED" ? (
                      <button
                        type="button"
                        onClick={() => openEdit(camp)}
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#6900AA] text-white px-3 py-1.5 text-xs font-semibold hover:bg-[#5a0092]"
                      >
                        <Pencil size={12} /> Fix & resubmit
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {campaignsData?.meta && <Pagination meta={campaignsData.meta} onPageChange={setPage} />}

        {diningModal}

        {modalOpen && !isDining && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <form
              onSubmit={handleSubmit(onValid)}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4"
              noValidate
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingCampaign ? "Fix & resubmit promotion" : "Request Promotion"}
                </h3>
                <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700">
                  <X size={18} />
                </button>
              </div>
              {formFields}
              {formActions}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
