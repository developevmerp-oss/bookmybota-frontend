"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { 
  useGetMarketingPlansQuery, 
  useCreateMarketingPlanMutation,
  useDeleteMarketingPlanMutation,
  useGetMarketingCampaignsQuery,
  useAssignMarketingCampaignMutation,
  useGetBusinessesQuery
} from '@/services/api';
import { Plus, Trash2, Calendar, Target, Loader2, Store } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/dateFormat';
import { extractApiError } from '@/lib/apiErrors';
import {
  adminMarketingPlanSchema,
  adminMarketingCampaignSchema,
  type AdminMarketingPlanValues,
  type AdminMarketingCampaignValues,
} from '@/lib/adminFormSchemas';
import ConfirmDialog from '@/components/Shared/ConfirmDialog';
import SearchInput from '@/components/Shared/SearchInput';
import Pagination from '@/components/Shared/Pagination';
import { AdminListShimmer } from '@/components/Shared/Shimmer';
import { PAGE_SIZE } from '@/lib/pagination';

export default function AdminMarketingPage() {
  const [activeTab, setActiveTab] = useState<'plans' | 'campaigns'>('plans');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const listArg = {
    page,
    limit,
    ...(q.trim() ? { q: q.trim() } : {}),
  };
  const { data: plansData, isLoading: plansLoading, isFetching: plansFetching } = useGetMarketingPlansQuery(listArg);
  const { data: allPlansData } = useGetMarketingPlansQuery();
  const plans = plansData?.items ?? [];
  const planOptions = allPlansData?.items ?? [];
  const [createPlan, { isLoading: isCreating }] = useCreateMarketingPlanMutation();
  const [deletePlan] = useDeleteMarketingPlanMutation();

  const planForm = useForm<AdminMarketingPlanValues>({
    resolver: yupResolver(adminMarketingPlanSchema),
    defaultValues: { name: '', duration_days: 30, price: 0 },
    mode: 'onSubmit',
  });

  // Campaigns State
  const { data: campaignsData, isLoading: campaignsLoading, isFetching: campaignsFetching } = useGetMarketingCampaignsQuery(listArg);
  const campaigns = campaignsData?.items ?? [];
  const { data: businesses = [] } = useGetBusinessesQuery();
  const [assignCampaign, { isLoading: isAssigning }] = useAssignMarketingCampaignMutation();

  const campaignForm = useForm<AdminMarketingCampaignValues>({
    resolver: yupResolver(adminMarketingCampaignSchema),
    defaultValues: { businessId: '', plan_id: '' },
    mode: 'onSubmit',
  });

  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const onCreatePlan = async (values: AdminMarketingPlanValues) => {
    try {
      const created = await createPlan({ ...values, is_active: true }).unwrap();
      toast.success(
        (created as { message?: string }).message || 'Marketing plan created successfully'
      );
      planForm.reset({ name: '', duration_days: 30, price: 0 });
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed to create plan'));
    }
  };

  const handleDeletePlan = (id: number) => {
    setPendingDeleteId(id);
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
      const created = await assignCampaign({
        businessId: values.businessId,
        plan_id: parseInt(values.plan_id, 10),
        end_date: endDate.toISOString(),
      }).unwrap();
      toast.success(
        (created as { message?: string }).message || 'Campaign assigned successfully!'
      );
      campaignForm.reset({ businessId: '', plan_id: '' });
    } catch (err: unknown) {
      toast.error(extractApiError(err, 'Failed to assign campaign'));
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="admin-list-toolbar">
        <SearchInput
          value={q}
          onChange={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Search plans or campaigns"
        />
      </div>

      <div className="flex gap-2 border-b border-white/10 mb-6">
        <button
          onClick={() => {
            setActiveTab('plans');
            setPage(1);
          }}
          className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'plans' 
              ? 'border-rose-500 text-rose-500 bg-rose-500/5' 
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Marketing Plans
        </button>
        <button
          onClick={() => {
            setActiveTab('campaigns');
            setPage(1);
          }}
          className={`px-4 py-3 font-semibold text-sm transition-all border-b-2 ${
            activeTab === 'campaigns' 
              ? 'border-rose-500 text-rose-500 bg-rose-500/5' 
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          Active Campaigns
        </button>
      </div>

      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="glass-panel p-6 border border-white/5 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Plus size={18} className="text-rose-500" /> Create Plan
              </h3>
              <form onSubmit={planForm.handleSubmit(onCreatePlan)} noValidate className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Plan Name</label>
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
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Duration (Days)</label>
                  <input
                    type="number"
                    {...planForm.register('duration_days', { valueAsNumber: true })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-rose-500/50"
                  />
                  {planForm.formState.errors.duration_days && (
                    <p className="mt-1.5 text-xs text-rose-400 font-medium">
                      {planForm.formState.errors.duration_days.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    {...planForm.register('price', { valueAsNumber: true })}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-rose-500/50"
                  />
                  {planForm.formState.errors.price && (
                    <p className="mt-1.5 text-xs text-rose-400 font-medium">
                      {planForm.formState.errors.price.message}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
                >
                  {isCreating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                  Save Plan
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            {plansLoading ? (
              <AdminListShimmer rows={5} columns={4} showTabs={false} showToolbar={false} />
            ) : (
            <div className="glass-panel rounded-2xl border border-white/5 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/5">
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Plan Name</th>
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Duration</th>
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Price</th>
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {plans.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-zinc-500">No marketing plans found.</td></tr>
                  ) : (
                    plans.map((plan: any) => (
                      <tr key={plan.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <div className="font-semibold text-white">{plan.name}</div>
                        </td>
                        <td className="p-4 text-zinc-300 flex items-center gap-2">
                          <Calendar size={14} className="text-zinc-500" />
                          {plan.duration_days} Days
                        </td>
                        <td className="p-4 font-bold text-emerald-400">
                          ${Number(plan.price).toFixed(2)}
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleDeletePlan(plan.id)}
                            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
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
      )}

      {activeTab === 'campaigns' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="glass-panel p-6 border border-white/5 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Target size={18} className="text-rose-500" /> Assign Campaign
              </h3>
              <form onSubmit={campaignForm.handleSubmit(onAssignCampaign)} noValidate className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Select Business</label>
                  <select
                    {...campaignForm.register('businessId')}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-rose-500/50"
                  >
                    <option value="">-- Choose Business --</option>
                    {businesses.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  {campaignForm.formState.errors.businessId && (
                    <p className="mt-1.5 text-xs text-rose-400 font-medium">
                      {campaignForm.formState.errors.businessId.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Select Plan</label>
                  <select
                    {...campaignForm.register('plan_id')}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-rose-500/50"
                  >
                    <option value="">-- Choose Plan --</option>
                    {planOptions.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.duration_days} days)</option>
                    ))}
                  </select>
                  {campaignForm.formState.errors.plan_id && (
                    <p className="mt-1.5 text-xs text-rose-400 font-medium">
                      {campaignForm.formState.errors.plan_id.message}
                    </p>
                  )}
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
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Plan</th>
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Expires</th>
                    <th className="p-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {campaigns.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-zinc-500">No active campaigns.</td></tr>
                  ) : (
                    campaigns.map((camp: any) => {
                      const isExpired = new Date(camp.end_date) < new Date();
                      return (
                        <tr key={camp.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-white">{camp.business_name}</div>
                          </td>
                          <td className="p-4 text-zinc-300">
                            {camp.plan_name}
                          </td>
                          <td className="p-4 text-zinc-400">
                            {formatDate(camp.end_date)}
                          </td>
                          <td className="p-4">
                            {isExpired ? (
                              <span className="px-2 py-1 bg-zinc-500/20 text-zinc-400 rounded-md text-xs font-bold">EXPIRED</span>
                            ) : (
                              <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md text-xs font-bold">ACTIVE</span>
                            )}
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
      )}

      <ConfirmDialog
        open={pendingDeleteId != null}
        title="Delete plan?"
        body="Are you sure you want to delete this plan?"
        confirmLabel="Delete"
        danger
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setPendingDeleteId(null)}
        onConfirm={async () => {
          if (pendingDeleteId == null) return;
          setConfirmBusy(true);
          try {
            await deletePlan(pendingDeleteId).unwrap();
            toast.success('Plan deleted');
            setPendingDeleteId(null);
          } catch (err: unknown) {
            toast.error(extractApiError(err, 'Failed to delete plan. It might be in use.'));
          } finally {
            setConfirmBusy(false);
          }
        }}
      />
    </div>
  );
}
