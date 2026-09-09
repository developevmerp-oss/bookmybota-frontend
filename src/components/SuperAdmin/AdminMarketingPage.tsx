"use client";

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  useGetMarketingPlansQuery,
  useCreateMarketingPlanMutation,
  useUpdateMarketingPlanMutation,
  useGetMarketingCampaignsQuery,
  useGetMarketingPaymentSummaryQuery,
  useAssignMarketingCampaignMutation,
  usePatchMarketingCampaignStatusMutation,
  useGetBusinessesQuery,
  useGetAdminMoviesQuery,
  useGetPublicEventsQuery,
  type MarketingCampaign,
  type MarketingPlan,
  type MarketingPaymentSummary,
} from '@/services/api';
import { promotionTargetLabel } from '@/lib/promotionTargetLabel';
import {
  Plus,
  Calendar,
  Target,
  Loader2,
  Store,
  Check,
  X,
  Pause,
  Pencil,
  Archive,
  Undo2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/dateFormat';
import { formatMoneyDisplay } from '@/lib/currencyFormat';
import { extractApiError } from '@/lib/apiErrors';
import { resolveMediaUrl } from '@/lib/mediaUrl';
import {
  adminMarketingPlanSchema,
  adminMarketingCampaignSchema,
  adminMarketingRejectSchema,
  type AdminMarketingPlanValues,
  type AdminMarketingCampaignValues,
  type AdminMarketingRejectValues,
} from '@/lib/adminFormSchemas';
import ConfirmDialog from '@/components/Shared/ConfirmDialog';
import SearchInput from '@/components/Shared/SearchInput';
import Pagination from '@/components/Shared/Pagination';
import { AdminListShimmer } from '@/components/Shared/Shimmer';
import { PAGE_SIZE } from '@/lib/pagination';

type Tab = 'plans' | 'requests' | 'active' | 'payments';
type PlanFilter = 'all' | 'active' | 'archived';
type PaymentFilter = 'ALL' | 'PAID' | 'ADMIN_WAIVED' | 'UNPAID' | 'REFUNDED';
type RequestFilter = 'all' | 'pending' | 'approved' | 'rejected';
type PlanConfirmAction = 'enable' | 'disable' | 'archive' | 'unarchive';

type PlanConfirmState = {
  action: PlanConfirmAction;
  plan: MarketingPlan;
};

const PLAN_FORM_DEFAULTS: AdminMarketingPlanValues = {
  name: '',
  duration_days: 30,
  price: 0,
  module: 'ALL',
  listing_boost: true,
  landing_slider: false,
  category_rail: false,
  allows_item_target: false,
  max_targets: 1,
};

function isPaymentCleared(status?: string | null) {
  const s = (status || '').toUpperCase();
  return s === 'PAID' || s === 'ADMIN_WAIVED';
}

function paymentStatusBadge(status?: string | null) {
  const s = (status || 'UNPAID').toUpperCase();
  const colors: Record<string, string> = {
    PAID: 'bg-emerald-500/20 text-emerald-300',
    ADMIN_WAIVED: 'bg-violet-500/20 text-violet-300',
    UNPAID: 'bg-amber-500/20 text-amber-300',
    PENDING_VERIFICATION: 'bg-amber-500/20 text-amber-300',
    REFUNDED: 'bg-zinc-500/20 text-zinc-400',
    FAILED: 'bg-rose-500/20 text-rose-300',
  };
  const label =
    s === 'ADMIN_WAIVED' ? 'Free (admin)' : s === 'PENDING_VERIFICATION' ? 'Pending verify' : s;
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${colors[s] || colors.UNPAID}`}>
      {label}
    </span>
  );
}

function campaignStatusBadge(status?: string) {
  const s = (status || 'PENDING').toUpperCase();
  const colors: Record<string, string> = {
    PENDING: 'bg-amber-500/20 text-amber-300',
    ACTIVE: 'bg-emerald-500/20 text-emerald-300',
    REJECTED: 'bg-rose-500/20 text-rose-300',
    PAUSED: 'bg-sky-500/20 text-sky-300',
    EXPIRED: 'bg-zinc-500/20 text-zinc-400',
    CANCELLED: 'bg-zinc-500/20 text-zinc-400',
  };
  return (
    <span className={`px-2 py-1 rounded-md text-xs font-bold ${colors[s] || colors.PENDING}`}>
      {s}
    </span>
  );
}

function promotionScopeLabel(
  camp: MarketingCampaign,
  lookups?: {
    movieTitleById?: Map<string, string> | Record<string, string>;
    eventNameById?: Map<string, string> | Record<string, string>;
  }
) {
  return promotionTargetLabel(camp, lookups);
}

function isPlanArchived(plan: MarketingPlan) {
  return Boolean(plan.archived_at);
}

function planStatusNode(plan: MarketingPlan) {
  if (isPlanArchived(plan)) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-300 border border-slate-500/30">
        <Archive size={11} /> Archived
      </span>
    );
  }
  if (plan.is_active !== false) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400 border border-emerald-500/30">
        <CheckCircle size={11} /> Enabled
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300 border border-amber-500/30">
      <XCircle size={11} /> Disabled
    </span>
  );
}

function planToFormValues(plan: MarketingPlan): AdminMarketingPlanValues {
  return {
    name: plan.name,
    duration_days: plan.duration_days,
    price: Number(plan.price),
    module: (plan.module || 'ALL') as AdminMarketingPlanValues['module'],
    listing_boost: plan.listing_boost !== false,
    landing_slider: Boolean(plan.landing_slider),
    category_rail: Boolean(plan.category_rail),
    allows_item_target: Boolean(plan.allows_item_target),
    max_targets: plan.max_targets ?? 1,
  };
}

function planPayload(
  values: AdminMarketingPlanValues,
  plan: Pick<MarketingPlan, 'is_active' | 'archived_at'>
) {
  return {
    ...values,
    is_active: plan.is_active !== false,
    archived_at: plan.archived_at ?? null,
  };
}

function resolveCampaignPaymentStatus(camp: MarketingCampaign): string {
  const raw = (camp.payment_status || '').toUpperCase();
  if (raw) return raw;
  const status = (camp.status || '').toUpperCase();
  if (status === 'ACTIVE') return 'PAID';
  return 'UNPAID';
}

function campaignLedgerAmount(camp: MarketingCampaign): number {
  return Number(camp.amount ?? camp.price ?? 0);
}

function normalizePaymentSummary(raw?: MarketingPaymentSummary | null): MarketingPaymentSummary | null {
  if (!raw) return null;
  return {
    total_entries: Number(raw.total_entries ?? 0),
    paid_count: Number(raw.paid_count ?? 0),
    waived_count: Number(raw.waived_count ?? 0),
    unpaid_count: Number(raw.unpaid_count ?? 0),
    refunded_count: Number(raw.refunded_count ?? 0),
    total_collected: Number(raw.total_collected ?? 0),
    total_waived: Number(raw.total_waived ?? 0),
    pending_requests: Number(raw.pending_requests ?? 0),
    approved_requests: Number(raw.approved_requests ?? 0),
    rejected_requests: Number(raw.rejected_requests ?? 0),
  };
}

function buildPaymentSummaryFromCampaigns(campaigns: MarketingCampaign[]): MarketingPaymentSummary {
  let total_collected = 0;
  let total_waived = 0;
  let paid_count = 0;
  let waived_count = 0;
  let unpaid_count = 0;
  let refunded_count = 0;
  let pending_requests = 0;
  let approved_requests = 0;
  let rejected_requests = 0;

  for (const camp of campaigns) {
    const paymentStatus = resolveCampaignPaymentStatus(camp);
    const amount = campaignLedgerAmount(camp);
    const status = (camp.status || '').toUpperCase();
    const isPartnerRequest = Boolean(camp.requested_by);

    if (paymentStatus === 'PAID') {
      paid_count += 1;
      total_collected += amount;
    } else if (paymentStatus === 'ADMIN_WAIVED') {
      waived_count += 1;
      total_waived += amount;
    } else if (paymentStatus === 'REFUNDED') {
      refunded_count += 1;
    } else if (paymentStatus === 'UNPAID' && !['ACTIVE', 'EXPIRED'].includes(status)) {
      unpaid_count += 1;
    }

    if (isPartnerRequest && status === 'PENDING') pending_requests += 1;
    if (isPartnerRequest && ['ACTIVE', 'PAUSED', 'EXPIRED'].includes(status)) approved_requests += 1;
    if (status === 'REJECTED') rejected_requests += 1;
  }

  return {
    total_entries: campaigns.length,
    paid_count,
    waived_count,
    unpaid_count,
    refunded_count,
    total_collected,
    total_waived,
    pending_requests,
    approved_requests,
    rejected_requests,
  };
}

export default function AdminMarketingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [requestFilter, setRequestFilter] = useState<RequestFilter>('all');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [editingPlan, setEditingPlan] = useState<MarketingPlan | null>(null);
  const [planConfirm, setPlanConfirm] = useState<PlanConfirmState | null>(null);
  const [planConfirmBusy, setPlanConfirmBusy] = useState(false);

  const activeListArg = {
    page,
    limit,
    ...(q.trim() ? { q: q.trim() } : {}),
    status: 'ACTIVE',
    business_scope: true,
  };

  const requestsListArg = {
    page,
    limit,
    partner_requests: true,
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(requestFilter === 'pending' ? { status: 'PENDING' } : {}),
    ...(requestFilter === 'approved' ? { status: 'ACTIVE,PAUSED,EXPIRED' } : {}),
    ...(requestFilter === 'rejected' ? { status: 'REJECTED' } : {}),
  };

  const paymentsListArg = {
    page,
    limit,
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(paymentFilter !== 'ALL' ? { payment_status: paymentFilter } : {}),
  };

  const paymentStatsListArg = {
    page: 1,
    limit: 500,
  };

  const plansListArg = {
    page,
    limit,
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(planFilter !== 'all' ? { status: planFilter } : {}),
  };

  const { data: plansData, isLoading: plansLoading, isFetching: plansFetching } = useGetMarketingPlansQuery(
    plansListArg,
    { skip: activeTab !== 'plans' }
  );
  const { data: allPlansData } = useGetMarketingPlansQuery({ page: 1, limit: 200, status: 'active' });
  const plans = plansData?.items ?? [];
  const planOptions = (allPlansData?.items ?? []).filter(
    (p) => p.is_active !== false && !isPlanArchived(p)
  );

  const [createPlan, { isLoading: isCreating }] = useCreateMarketingPlanMutation();
  const [updatePlan, { isLoading: isUpdating }] = useUpdateMarketingPlanMutation();

  const planForm = useForm<AdminMarketingPlanValues>({
    resolver: yupResolver(adminMarketingPlanSchema),
    defaultValues: PLAN_FORM_DEFAULTS,
    mode: 'onSubmit',
  });

  const { data: campaignsData, isLoading: campaignsLoading, isFetching: campaignsFetching } =
    useGetMarketingCampaignsQuery(activeListArg, { skip: activeTab !== 'active' });

  const { data: requestsData, isLoading: requestsLoading, isFetching: requestsFetching } =
    useGetMarketingCampaignsQuery(requestsListArg, { skip: activeTab !== 'requests' });

  const { data: paymentsData, isLoading: paymentsLoading, isFetching: paymentsFetching, refetch: refetchPayments } =
    useGetMarketingCampaignsQuery(paymentsListArg, { skip: activeTab !== 'payments' });

  const { data: paymentStatsData, refetch: refetchPaymentStats } = useGetMarketingCampaignsQuery(
    paymentStatsListArg,
    { skip: activeTab !== 'payments' }
  );

  const { data: paymentSummaryRaw, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } =
    useGetMarketingPaymentSummaryQuery(undefined, {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
    });

  useEffect(() => {
    if (activeTab !== 'payments') return;
    void refetchSummary();
    void refetchPaymentStats();
    void refetchPayments();
  }, [activeTab, refetchSummary, refetchPaymentStats, refetchPayments]);

  const paymentSummary = useMemo(() => {
    const fromApi = normalizePaymentSummary(paymentSummaryRaw);
    if (fromApi && fromApi.total_entries > 0) return fromApi;
    const allItems = paymentStatsData?.items ?? [];
    if (allItems.length > 0) return buildPaymentSummaryFromCampaigns(allItems);
    return (
      fromApi ?? {
        total_entries: 0,
        paid_count: 0,
        waived_count: 0,
        unpaid_count: 0,
        refunded_count: 0,
        total_collected: 0,
        total_waived: 0,
        pending_requests: 0,
        approved_requests: 0,
        rejected_requests: 0,
      }
    );
  }, [paymentSummaryRaw, paymentStatsData?.items]);

  const campaigns = campaignsData?.items ?? [];
  const requests = requestsData?.items ?? [];
  const paymentEntries = paymentsData?.items ?? [];
  const { data: businesses = [] } = useGetBusinessesQuery();
  const { data: adminMoviesData } = useGetAdminMoviesQuery({ page: 1, limit: 200 });
  const { data: publicEvents = [] } = useGetPublicEventsQuery();

  const targetLookups = useMemo(() => {
    const movieTitleById = new Map<string, string>();
    for (const m of adminMoviesData?.items || []) {
      if (m.id) movieTitleById.set(String(m.id), m.title);
      if (m.slug) movieTitleById.set(String(m.slug), m.title);
    }
    const eventNameById = new Map<string, string>();
    for (const e of publicEvents || []) {
      if (e.id) eventNameById.set(String(e.id), e.name || String(e.id));
    }
    return { movieTitleById, eventNameById };
  }, [adminMoviesData?.items, publicEvents]);

  const [assignCampaign, { isLoading: isAssigning }] = useAssignMarketingCampaignMutation();
  const [patchStatus, { isLoading: patching }] = usePatchMarketingCampaignStatusMutation();

  const campaignForm = useForm<AdminMarketingCampaignValues>({
    resolver: yupResolver(adminMarketingCampaignSchema),
    defaultValues: { businessId: '', plan_id: '' },
    mode: 'onSubmit',
  });

  const rejectForm = useForm<AdminMarketingRejectValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(adminMarketingRejectSchema) as any,
    defaultValues: { admin_note: '' },
    mode: 'onSubmit',
  });

  const resetPlanForm = () => {
    setEditingPlan(null);
    planForm.reset(PLAN_FORM_DEFAULTS);
  };

  const openEditPlan = (plan: MarketingPlan) => {
    setEditingPlan(plan);
    planForm.reset(planToFormValues(plan));
  };

  const onSavePlan = async (values: AdminMarketingPlanValues) => {
    try {
      if (editingPlan) {
        const res = await updatePlan({
          id: editingPlan.id,
          ...planPayload(values, editingPlan),
        }).unwrap();
        toast.success(
          (res as { message?: string }).message || 'Marketing plan updated'
        );
      } else {
        const res = await createPlan({ ...values, is_active: true }).unwrap();
        toast.success(
          (res as { message?: string }).message || 'Marketing plan created'
        );
      }
      resetPlanForm();
    } catch (err: unknown) {
      toast.error(extractApiError(err, editingPlan ? 'Failed to update plan' : 'Failed to create plan'));
    }
  };

  const planConfirmCopy = (() => {
    if (!planConfirm) {
      return { title: '', body: '', confirmLabel: '', danger: false, variant: 'warning' as const };
    }
    const name = planConfirm.plan.name;
    switch (planConfirm.action) {
      case 'enable':
        return {
          title: 'Enable plan?',
          body: `Enable "${name}"? Partners can request this plan again.`,
          confirmLabel: 'Enable',
          danger: false,
          variant: 'success' as const,
        };
      case 'disable':
        return {
          title: 'Disable plan?',
          body: `Disable "${name}"? It stays visible in admin but partners cannot select it until you enable it again.`,
          confirmLabel: 'Disable',
          danger: false,
          variant: 'warning' as const,
        };
      case 'archive':
        return {
          title: 'Archive plan?',
          body: `Archive "${name}"? It moves to the Archived list and is hidden from partners. You can unarchive it later.`,
          confirmLabel: 'Archive',
          danger: true,
          variant: 'danger' as const,
        };
      case 'unarchive':
        return {
          title: 'Unarchive plan?',
          body: `Unarchive "${name}"? It returns to the active plans list. Enable it separately if partners should request it.`,
          confirmLabel: 'Unarchive',
          danger: false,
          variant: 'success' as const,
        };
      default:
        return { title: '', body: '', confirmLabel: '', danger: false, variant: 'warning' as const };
    }
  })();

  const runPlanConfirm = async () => {
    if (!planConfirm) return;
    setPlanConfirmBusy(true);
    const { plan, action } = planConfirm;
    const values = planToFormValues(plan);
    try {
      if (action === 'enable') {
        await updatePlan({
          id: plan.id,
          ...planPayload(values, { ...plan, is_active: true }),
        }).unwrap();
        toast.success(`"${plan.name}" enabled`);
      } else if (action === 'disable') {
        await updatePlan({
          id: plan.id,
          ...planPayload(values, { ...plan, is_active: false }),
        }).unwrap();
        toast.success(`"${plan.name}" disabled`);
      } else if (action === 'archive') {
        await updatePlan({
          id: plan.id,
          ...planPayload(values, plan),
          archived_at: new Date().toISOString(),
        }).unwrap();
        toast.success(`"${plan.name}" archived`);
        if (editingPlan?.id === plan.id) resetPlanForm();
      } else if (action === 'unarchive') {
        await updatePlan({
          id: plan.id,
          ...planPayload(values, plan),
          archived_at: null,
        }).unwrap();
        toast.success(`"${plan.name}" unarchived`);
      }
      setPlanConfirm(null);
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed to update plan'));
    } finally {
      setPlanConfirmBusy(false);
    }
  };

  const onAssignCampaign = async (values: AdminMarketingCampaignValues) => {
    const selectedPlan = planOptions.find((p) => p.id.toString() === values.plan_id);
    if (!selectedPlan) {
      toast.error('Selected plan was not found');
      return;
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() + selectedPlan.duration_days);

    try {
      const business = businesses.find((b) => b.id === values.businessId);
      const created = await assignCampaign({
        businessId: values.businessId,
        plan_id: parseInt(values.plan_id, 10),
        end_date: endDate.toISOString(),
        title: business ? `${business.name} — ${selectedPlan.name}` : selectedPlan.name,
        category: 'ALL',
        target_type: 'BUSINESS',
      }).unwrap();
      toast.success(
        (created as { message?: string }).message || 'Campaign assigned successfully!'
      );
      campaignForm.reset({ businessId: '', plan_id: '' });
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed to assign campaign'));
    }
  };

  const handleApprove = async (camp: MarketingCampaign) => {
    if (!isPaymentCleared(camp.payment_status)) {
      toast.error('Payment must be completed before approving this promotion.');
      return;
    }
    try {
      await patchStatus({ id: camp.id, status: 'ACTIVE' }).unwrap();
      setRequestFilter('approved');
      toast.success('Promotion approved and live');
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to approve'));
    }
  };

  const openReject = (id: number) => {
    setRejectId(id);
    rejectForm.reset({ admin_note: '' });
  };

  const handleReject = async (values: AdminMarketingRejectValues) => {
    if (rejectId == null) return;
    try {
      const res = await patchStatus({
        id: rejectId,
        status: 'REJECTED',
        admin_note: values.admin_note?.trim() || undefined,
      }).unwrap();
      setRequestFilter('rejected');
      toast.success((res as { message?: string }).message || 'Request rejected');
      setRejectId(null);
      rejectForm.reset({ admin_note: '' });
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to reject'));
    }
  };

  const handlePause = async (camp: MarketingCampaign) => {
    try {
      await patchStatus({ id: camp.id, status: 'PAUSED' }).unwrap();
      toast.success('Campaign paused');
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to pause campaign'));
    }
  };

  const isSavingPlan = isCreating || isUpdating;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between border-b border-white/10 pb-0">
        <div className="flex gap-1 sm:gap-2 overflow-x-auto">
          {(['plans', 'requests', 'active', 'payments'] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
              className={`px-3 sm:px-4 py-3 font-semibold text-sm transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab
                  ? 'border-rose-500 text-rose-500 bg-rose-500/5'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              {tab === 'plans'
                ? 'Marketing Plans'
                : tab === 'requests'
                  ? 'Requests'
                  : tab === 'active'
                    ? 'Active Campaigns'
                    : 'Payment Ledger'}
            </button>
          ))}
        </div>
        <div className="w-full lg:w-80 shrink-0 pb-3 lg:pb-2">
          <SearchInput
            value={q}
            onChange={(value) => {
              setQ(value);
              setPage(1);
            }}
            placeholder={
              activeTab === 'plans'
                ? 'Search plans…'
                : activeTab === 'requests'
                  ? 'Search requests…'
                  : activeTab === 'payments'
                    ? 'Search payments…'
                    : 'Search campaigns…'
            }
          />
        </div>
      </div>

      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'all', label: 'All plans' },
                { key: 'active', label: 'Active' },
                { key: 'archived', label: 'Archived' },
              ] as { key: PlanFilter; label: string }[]
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setPlanFilter(item.key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  planFilter === item.key
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    : 'bg-white/5 text-zinc-400 border border-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <div className="glass-panel p-6 border border-white/5 rounded-2xl">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {editingPlan ? (
                      <>
                        <Pencil size={18} className="text-rose-500" /> Edit Plan
                      </>
                    ) : (
                      <>
                        <Plus size={18} className="text-rose-500" /> Create Plan
                      </>
                    )}
                  </h3>
                  {editingPlan ? (
                    <button
                      type="button"
                      onClick={resetPlanForm}
                      className="text-xs font-semibold text-zinc-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
                {editingPlan ? (
                  <p className="text-xs text-zinc-500 mb-4">
                    Editing <span className="text-zinc-300">{editingPlan.name}</span>
                    {' · '}
                    {planStatusNode(editingPlan)}
                  </p>
                ) : null}
                <form onSubmit={planForm.handleSubmit(onSavePlan)} noValidate className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Plan Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      {...planForm.register('name')}
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-rose-500/50"
                      placeholder="e.g. 1 Month Priority"
                    />
                    {planForm.formState.errors.name && (
                      <p className="mt-1.5 text-xs text-rose-400 font-medium">
                        {planForm.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Module</label>
                    <select
                      {...planForm.register('module')}
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-rose-500/50"
                    >
                      <option value="ALL">All categories</option>
                      <option value="DINING">Dining</option>
                      <option value="EVENTS">Events</option>
                      <option value="MOVIES">Movies</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Duration (Days) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      {...planForm.register('duration_days', { valueAsNumber: true })}
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-rose-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Price (ETB) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      {...planForm.register('price', { valueAsNumber: true })}
                      className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-rose-500/50"
                    />
                  </div>
                  <div className="space-y-2 rounded-xl border border-white/10 p-3">
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Benefits</p>
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      <input type="checkbox" {...planForm.register('listing_boost')} className="rounded" />
                      Listing boost + PROMOTED badge
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      <input type="checkbox" {...planForm.register('landing_slider')} className="rounded" />
                      Landing hero slider
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      <input type="checkbox" {...planForm.register('category_rail')} className="rounded" />
                      Category detail rail
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-300">
                      <input type="checkbox" {...planForm.register('allows_item_target')} className="rounded" />
                      Allow specific movie/event target
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingPlan}
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    {isSavingPlan ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : editingPlan ? (
                      <Pencil size={18} />
                    ) : (
                      <Plus size={18} />
                    )}
                    {editingPlan ? 'Update Plan' : 'Save Plan'}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              {plansLoading ? (
                <AdminListShimmer rows={5} columns={5} showTabs={false} showToolbar={false} />
              ) : (
                <div className="glass-panel rounded-2xl border border-white/5 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/5">
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Plan</th>
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Module</th>
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Benefits</th>
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Price</th>
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                        <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {plans.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-zinc-500">
                            No marketing plans found.
                          </td>
                        </tr>
                      ) : (
                        plans.map((plan) => {
                          const archived = isPlanArchived(plan);
                          const enabled = plan.is_active !== false;
                          return (
                            <tr
                              key={plan.id}
                              className={`hover:bg-white/[0.02] transition-colors ${archived || !enabled ? 'opacity-80' : ''}`}
                            >
                              <td className="p-4">
                                <div className="font-semibold text-white">{plan.name}</div>
                                <div className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                                  <Calendar size={12} /> {plan.duration_days} days
                                </div>
                              </td>
                              <td className="p-4 text-zinc-300 text-sm">{plan.module || 'ALL'}</td>
                              <td className="p-4">
                                <div className="flex flex-wrap gap-1">
                                  {plan.listing_boost !== false && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Boost</span>
                                  )}
                                  {plan.landing_slider && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">Slider</span>
                                  )}
                                  {plan.category_rail && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400">Rail</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 font-bold text-emerald-400">{formatMoneyDisplay(plan.price)}</td>
                              <td className="p-4">{planStatusNode(plan)}</td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {!archived && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => openEditPlan(plan)}
                                        className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5"
                                        title="Edit plan"
                                      >
                                        <Pencil size={16} />
                                      </button>
                                      <button
                                        type="button"
                                        role="switch"
                                        aria-checked={enabled}
                                        aria-label={enabled ? 'Disable plan' : 'Enable plan'}
                                        onClick={() =>
                                          setPlanConfirm({
                                            action: enabled ? 'disable' : 'enable',
                                            plan,
                                          })
                                        }
                                        disabled={planConfirmBusy}
                                        title={enabled ? 'Disable' : 'Enable'}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-rose-500/40 disabled:opacity-50 disabled:cursor-not-allowed ${
                                          enabled ? 'bg-emerald-500' : 'bg-zinc-500'
                                        }`}
                                      >
                                        <span
                                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                            enabled ? 'translate-x-5' : 'translate-x-0'
                                          }`}
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPlanConfirm({ action: 'archive', plan })}
                                        disabled={planConfirmBusy}
                                        className="p-2 text-zinc-400 hover:text-rose-300 rounded-lg hover:bg-white/5"
                                        title="Archive plan"
                                      >
                                        <Archive size={16} />
                                      </button>
                                    </>
                                  )}
                                  {archived && (
                                    <button
                                      type="button"
                                      onClick={() => setPlanConfirm({ action: 'unarchive', plan })}
                                      disabled={planConfirmBusy}
                                      className="p-2 text-zinc-400 hover:text-emerald-300 rounded-lg hover:bg-white/5"
                                      title="Unarchive plan"
                                    >
                                      <Undo2 size={16} />
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
                  <div className="admin-list-footer">
                    <Pagination
                      meta={
                        plansData?.meta ?? {
                          page,
                          limit,
                          total: 0,
                          total_pages: 0,
                          has_prev: false,
                          has_next: false,
                        }
                      }
                      onPageChange={setPage}
                      onLimitChange={(next) => {
                        setLimit(next);
                        setPage(1);
                      }}
                      disabled={plansFetching}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'all', label: 'All requests' },
                { key: 'pending', label: 'Pending' },
                { key: 'approved', label: 'Approved' },
                { key: 'rejected', label: 'Rejected' },
              ] as { key: RequestFilter; label: string }[]
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setRequestFilter(item.key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  requestFilter === item.key
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    : 'bg-white/5 text-zinc-400 border border-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="glass-panel rounded-2xl border border-white/5 overflow-x-auto">
          {requestsLoading ? (
            <AdminListShimmer rows={5} columns={6} showTabs={false} showToolbar={false} />
          ) : requests.length === 0 ? (
            <p className="p-8 text-center text-zinc-500">No promotion requests found.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/5">
                  <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Business</th>
                  <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Promotion</th>
                  <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Plan</th>
                  <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Amount</th>
                  <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Payment</th>
                  <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Status</th>
                  <th className="p-4 text-xs font-bold text-zinc-400 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {requests.map((camp: MarketingCampaign) => {
                  const isPending = (camp.status || '').toUpperCase() === 'PENDING';
                  const isRejected = (camp.status || '').toUpperCase() === 'REJECTED';
                  const isResubmitted = isPending && Boolean(camp.reviewed_at);
                  const canApprove = isPending && isPaymentCleared(camp.payment_status);
                  return (
                  <tr key={camp.id} className="hover:bg-white/[0.02]">
                    <td className="p-4">
                      <div className="font-bold text-white">{camp.business_name}</div>
                      <div className="text-xs text-zinc-500">{camp.category}</div>
                    </td>
                    <td className="p-4">
                      {camp.banner_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveMediaUrl(camp.banner_image_url)}
                          alt={camp.title || ''}
                          className="w-32 aspect-[21/9] object-cover rounded-lg border border-white/10 mb-2"
                        />
                      ) : null}
                      <div className="text-white font-medium">{camp.title || '—'}</div>
                      <div className="text-[10px] text-sky-400/90 mt-0.5">{promotionScopeLabel(camp, targetLookups)}</div>
                    </td>
                    <td className="p-4 text-zinc-300">{camp.plan_name}</td>
                    <td className="p-4 text-emerald-400 font-semibold text-sm">
                      {formatMoneyDisplay(camp.amount ?? camp.price)}
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        {paymentStatusBadge(camp.payment_status)}
                        {camp.payment_reference ? (
                          <p className="text-[10px] text-zinc-500 truncate max-w-[120px]" title={camp.payment_reference}>
                            {camp.payment_reference}
                          </p>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {campaignStatusBadge(camp.status)}
                        {isResubmitted ? (
                          <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-sky-500/20 text-sky-300">
                            Resubmitted
                          </span>
                        ) : null}
                      </div>
                      {camp.admin_note && (isRejected || isResubmitted) ? (
                        <p className="text-[10px] text-rose-400 mt-1 max-w-[140px]">
                          {isResubmitted ? 'Previous: ' : ''}
                          {camp.admin_note}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-4 text-right">
                      {isPending ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={patching || !canApprove}
                            onClick={() => void handleApprove(camp)}
                            title={canApprove ? 'Approve promotion' : 'Payment required before approval'}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-white text-xs font-bold ${
                              canApprove
                                ? 'bg-emerald-600 hover:bg-emerald-500'
                                : 'bg-zinc-600 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            type="button"
                            disabled={patching}
                            onClick={() => openReject(camp.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold"
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500">
                          {camp.status === 'ACTIVE'
                            ? 'Live on site'
                            : isRejected
                              ? 'Waiting for business to fix'
                              : camp.status}
                        </span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {requestsData?.meta && (
            <div className="admin-list-footer">
              <Pagination
                meta={requestsData.meta}
                onPageChange={setPage}
                onLimitChange={(next) => {
                  setLimit(next);
                  setPage(1);
                }}
                disabled={requestsFetching}
              />
            </div>
          )}
        </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="space-y-6">
          {summaryError ? (
            <div className="glass-panel rounded-2xl border border-rose-500/30 p-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-rose-300">Could not load payment summary. Restart the backend if migrations were recently added.</p>
              <button
                type="button"
                onClick={() => void refetchSummary()}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-semibold hover:bg-rose-500/30"
              >
                Retry
              </button>
            </div>
          ) : null}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-panel rounded-2xl border border-white/5 p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Total collected</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {summaryLoading && !paymentSummaryRaw ? '…' : formatMoneyDisplay(paymentSummary.total_collected)}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">{paymentSummary.paid_count} paid entries</div>
            </div>
            <div className="glass-panel rounded-2xl border border-white/5 p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Free promotions (admin)</div>
              <div className="text-2xl font-bold text-violet-400 mt-1">
                {summaryLoading && !paymentSummaryRaw ? '…' : formatMoneyDisplay(paymentSummary.total_waived)}
              </div>
              <div className="text-[10px] text-zinc-500 mt-1">
                {paymentSummary.waived_count} given free — not partner-paid
              </div>
            </div>
            <div className="glass-panel rounded-2xl border border-white/5 p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Unpaid</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">{paymentSummary.unpaid_count}</div>
              <div className="text-[10px] text-zinc-500 mt-1">Awaiting payment</div>
            </div>
            <div className="glass-panel rounded-2xl border border-white/5 p-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">All entries</div>
              <div className="text-2xl font-bold text-white mt-1">{paymentSummary.total_entries}</div>
              <div className="text-[10px] text-zinc-500 mt-1">
                {paymentSummary.pending_requests} pending · {paymentSummary.approved_requests} approved ·{' '}
                {paymentSummary.rejected_requests} rejected
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'ALL', label: 'All' },
                { key: 'PAID', label: 'Paid' },
                { key: 'ADMIN_WAIVED', label: 'Free (admin)' },
                { key: 'UNPAID', label: 'Unpaid' },
                { key: 'REFUNDED', label: 'Refunded' },
              ] as { key: PaymentFilter; label: string }[]
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setPaymentFilter(item.key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  paymentFilter === item.key
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    : 'bg-white/5 text-zinc-400 border border-white/10 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {paymentsLoading ? (
            <AdminListShimmer rows={6} columns={7} showTabs={false} showToolbar={false} />
          ) : (
            <div className="glass-panel rounded-2xl border border-white/5 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/5">
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Date</th>
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Business</th>
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Plan</th>
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Amount</th>
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Payment</th>
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Reference</th>
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase">Campaign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paymentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-zinc-500">
                        No payment entries found.
                      </td>
                    </tr>
                  ) : (
                    paymentEntries.map((entry: MarketingCampaign) => (
                      <tr key={entry.id} className="hover:bg-white/[0.02]">
                        <td className="p-4 text-zinc-400 text-sm whitespace-nowrap">
                          {formatDate(entry.paid_at || entry.created_at || entry.start_date)}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-white">{entry.business_name}</div>
                          <div className="text-xs text-zinc-500">{entry.category}</div>
                        </td>
                        <td className="p-4 text-zinc-300 text-sm">{entry.plan_name}</td>
                        <td className="p-4 font-bold text-emerald-400">
                          {formatMoneyDisplay(entry.amount ?? entry.price)}
                        </td>
                        <td className="p-4">{paymentStatusBadge(entry.payment_status)}</td>
                        <td className="p-4 text-xs text-zinc-500 font-mono max-w-[140px] truncate" title={entry.payment_reference || ''}>
                          {entry.payment_reference || '—'}
                        </td>
                        <td className="p-4">
                          {campaignStatusBadge(entry.status)}
                          <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[120px]" title={entry.title || ''}>
                            {entry.title || '—'}
                          </p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {paymentsData?.meta && (
                <div className="admin-list-footer">
                  <Pagination
                    meta={paymentsData.meta}
                    onPageChange={setPage}
                    onLimitChange={(next) => {
                      setLimit(next);
                      setPage(1);
                    }}
                    disabled={paymentsFetching}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'active' && (
        <div className="space-y-4">
          <div className="glass-panel rounded-2xl border border-white/5 p-4 text-sm text-zinc-400">
            <p className="text-white font-semibold mb-1">Business-wide promotions only</p>
            <p>
              Use this tab to boost a <strong className="text-zinc-300">whole business</strong> (restaurant, event organizer, cinema).
              Partners promote a <strong className="text-zinc-300">single event or movie</strong> from their own portal — you review those under{' '}
              <strong className="text-zinc-300">Requests</strong>.
            </p>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="glass-panel p-6 border border-white/5 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <Target size={18} className="text-rose-500" /> Assign business campaign
              </h3>
              <p className="text-xs text-zinc-500 mb-4">
                Free promotion for the entire business listing — not one event or movie.
              </p>
              <form onSubmit={campaignForm.handleSubmit(onAssignCampaign)} noValidate className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Select Business <span className="text-rose-500">*</span>
                  </label>
                  <select
                    {...campaignForm.register('businessId')}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-rose-500/50"
                  >
                    <option value="">-- Choose Business --</option>
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Select Plan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    {...campaignForm.register('plan_id')}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-rose-500/50"
                  >
                    <option value="">-- Choose Plan --</option>
                    {planOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.duration_days} days)</option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
                >
                  {isAssigning ? <Loader2 className="animate-spin" size={18} /> : <Store size={18} />}
                  Activate Campaign
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            {campaignsLoading ? (
              <AdminListShimmer rows={5} columns={4} showTabs={false} showToolbar={false} />
            ) : (
              <div className="glass-panel rounded-2xl border border-white/5 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/5">
                      <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Business</th>
                      <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Promotion</th>
                      <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Expires</th>
                      <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                      <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {campaigns.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No active campaigns.</td></tr>
                    ) : (
                      campaigns.map((camp: MarketingCampaign) => (
                        <tr key={camp.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-white">{camp.business_name}</div>
                            <div className="text-xs text-zinc-500">{camp.plan_name}</div>
                          </td>
                        <td className="p-4 text-zinc-300">
                          {camp.title || camp.plan_name}
                          <div className="text-xs text-zinc-500">{camp.category}</div>
                          <div className="text-[10px] text-sky-400/90 mt-0.5">{promotionScopeLabel(camp, targetLookups)}</div>
                          <div className="text-xs text-emerald-400/80 mt-0.5">
                            {formatMoneyDisplay(camp.amount ?? camp.price)}
                          </div>
                        </td>
                        <td className="p-4 text-zinc-400">
                          {formatDate(camp.end_date)}
                          {camp.status === 'EXPIRED' ? (
                            <span className="block text-[10px] text-zinc-500 mt-0.5">Auto-expired</span>
                          ) : null}
                        </td>
                          <td className="p-4">{campaignStatusBadge(camp.status)}</td>
                          <td className="p-4 text-right">
                            <button
                              type="button"
                              disabled={patching}
                              onClick={() => void handlePause(camp)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-white/10 text-zinc-300 hover:text-white text-xs"
                            >
                              <Pause size={12} /> Pause
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className="admin-list-footer">
                  <Pagination
                    meta={
                      campaignsData?.meta ?? {
                        page,
                        limit,
                        total: 0,
                        total_pages: 0,
                        has_prev: false,
                        has_next: false,
                      }
                    }
                    onPageChange={setPage}
                    onLimitChange={(next) => {
                      setLimit(next);
                      setPage(1);
                    }}
                    disabled={campaignsFetching}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      <ConfirmDialog
        open={planConfirm != null}
        title={planConfirmCopy.title}
        body={planConfirmCopy.body}
        confirmLabel={planConfirmCopy.confirmLabel}
        danger={planConfirmCopy.danger}
        variant={planConfirmCopy.variant}
        busy={planConfirmBusy}
        onCancel={() => !planConfirmBusy && setPlanConfirm(null)}
        onConfirm={() => void runPlanConfirm()}
      />

      {rejectId != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <form
            onSubmit={rejectForm.handleSubmit(handleReject)}
            className="glass-panel border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4"
          >
            <h3 className="text-lg font-bold text-white">Reject request</h3>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase mb-2">
                Note to partner
              </label>
              <textarea
                {...rejectForm.register('admin_note')}
                placeholder="Optional note to partner"
                className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white min-h-[100px]"
              />
              {rejectForm.formState.errors.admin_note && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium">
                  {rejectForm.formState.errors.admin_note.message}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectId(null);
                  rejectForm.reset({ admin_note: '' });
                }}
                className="px-4 py-2 rounded-xl border border-white/10 text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={patching}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold"
              >
                Reject
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
