"use client";
import { useEffect, useState } from 'react';
import { Megaphone, Calendar, Target, Loader2, Store } from 'lucide-react';
import { useGetBusinessCampaignsQuery } from '@/services/api';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { loadFromStorage } from '@/features/auth/authSlice';

export default function BusinessPromotionsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  
  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  const bizId = user?.business_id?.toString() || '';

  const { data: campaigns = [], isLoading } = useGetBusinessCampaignsQuery(bizId, { skip: !bizId });

  if (!bizId) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400">
        <Loader2 className="animate-spin w-8 h-8 mr-2" /> Loading Promotions...
      </div>
    );
  }

  const activeCampaigns = campaigns.filter(c => new Date(c.end_date) >= new Date() && c.status === 'ACTIVE');
  const pastCampaigns = campaigns.filter(c => new Date(c.end_date) < new Date() || c.status !== 'ACTIVE');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Marketing Promotions</h2>
        <p className="text-slate-500">View your active and past marketing campaigns assigned by the platform admin.</p>
      </div>

      {activeCampaigns.length === 0 && pastCampaigns.length === 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-10 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
            <Megaphone size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">No Marketing Campaigns</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Your venue currently doesn't have any promotional plans active. Contact the platform administrator if you wish to promote your business.
          </p>
        </div>
      )}

      {activeCampaigns.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            Currently Active
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeCampaigns.map((camp: any) => (
              <div key={camp.id} className="bg-white border border-rose-200 rounded-2xl overflow-hidden shadow-sm relative group hover:shadow-md transition-shadow">
                <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg z-10 shadow-sm flex items-center gap-1">
                  PROMOTED
                </div>
                <div className="p-5 border-b border-rose-100/50 bg-rose-50/30">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg mb-1">{camp.plan_name}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                        <Target size={14} className="text-rose-500" /> Premium Visibility
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-5 bg-white space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Duration</span>
                    <span className="font-bold text-slate-700">{camp.duration_days} Days</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Expires On</span>
                    <span className="font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                      {new Date(camp.end_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pastCampaigns.length > 0 && (
        <div className="space-y-4 pt-6 mt-6 border-t border-slate-100">
          <h3 className="text-lg font-bold text-slate-700">Past Campaigns</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pastCampaigns.map((camp: any) => (
              <div key={camp.id} className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm opacity-75">
                <div className="p-5 border-b border-slate-100">
                  <h3 className="font-bold text-slate-700 text-lg mb-1">{camp.plan_name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                    Status: {camp.status === 'CANCELLED' ? 'Cancelled' : 'Expired'}
                  </p>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Duration</span>
                    <span className="font-medium text-slate-600">{camp.duration_days} Days</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Ended On</span>
                    <span className="font-medium text-slate-600">
                      {new Date(camp.end_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
