"use client";
import { useGetBusinessesQuery, useUpdateSubscriptionMutation } from '@/services/api';

export default function BillingPage() {
  const { data: businesses = [], isLoading } = useGetBusinessesQuery();
  const [updateSubscription] = useUpdateSubscriptionMutation();

  const handleSubscriptionUpdate = async (id: string, newPlan: string) => {
    try {
      await updateSubscription({ id, subscription_plan: newPlan }).unwrap();
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) return <div className="text-white p-10 text-center">Loading Billing Panel...</div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Subscription & Billing</h2>
          <p className="text-zinc-400">Manage billing plans and feature access for venues.</p>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400 text-sm">
            <tr>
              <th className="px-6 py-4 font-medium">Business Name</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Current Plan</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {businesses.map((biz) => (
              <tr key={biz.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-medium text-white">{biz.name}</td>
                <td className="px-6 py-4 text-zinc-400">{biz.type_name || 'Unspecified'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${biz.subscription_plan === 'PRO' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    {biz.subscription_plan || 'FREE'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  {biz.subscription_plan === 'PRO' ? (
                    <button onClick={() => handleSubscriptionUpdate(biz.id, 'FREE')} className="text-zinc-400 hover:text-white text-sm font-medium px-3 py-1 rounded-md border border-zinc-500/30 hover:bg-zinc-500/10 transition-colors">Downgrade to Free</button>
                  ) : (
                    <button onClick={() => handleSubscriptionUpdate(biz.id, 'PRO')} className="text-rose-500 hover:text-rose-400 text-sm font-medium px-3 py-1 rounded-md border border-rose-500/30 hover:bg-rose-500/10 transition-colors">Upgrade to Pro</button>
                  )}
                </td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr><td colSpan={4} className="text-center py-10 text-zinc-500">No businesses found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
