"use client";
import { useState } from 'react';
import { Building2, CheckCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useGetBusinessesQuery, useGetBusinessTypesQuery, useRegisterBusinessMutation } from '@/services/api';

export default function BusinessesPage() {
  const { data: businesses = [], isLoading } = useGetBusinessesQuery();
  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const [registerBusiness, { isLoading: isOnboarding }] = useRegisterBusinessMutation();

  const [showModal, setShowModal] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [typeId, setTypeId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [onboardStatus, setOnboardStatus] = useState<string | null>(null);

  const handleOnboard = async () => {
    setOnboardStatus('loading');
    try {
      await registerBusiness({
        business_name: businessName,
        address,
        phone,
        description,
        type_id: parseInt(typeId || businessTypes[0]?.id?.toString() || '1'),
        admin_email: adminEmail,
        admin_password: adminPassword,
      }).unwrap();
      setOnboardStatus('success');
      toast.success('Business registered successfully!');
      setTimeout(() => {
        setShowModal(false);
        setOnboardStatus(null);
        setBusinessName(''); setAddress(''); setPhone('');
        setDescription(''); setAdminEmail(''); setAdminPassword('');
      }, 2000);
    } catch {
      setOnboardStatus('error');
      toast.error('Failed to register business');
    }
  };

  if (isLoading) return <div className="text-white p-10 text-center">Loading Businesses...</div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Registered Businesses</h2>
          <p className="text-zinc-400">Manage all venues on the platform.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Building2 size={18} /> Onboard New Venue
        </button>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400 text-sm">
            <tr>
              <th className="px-6 py-4 font-medium">Business Name</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Location</th>
              <th className="px-6 py-4 font-medium">Phone</th>
              <th className="px-6 py-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {businesses.map((biz) => (
              <tr key={biz.id} className="hover:bg-white/5 transition-colors cursor-pointer">
                <td className="px-6 py-4 font-medium text-white">{biz.name}</td>
                <td className="px-6 py-4 text-zinc-400">{biz.type_name || 'Unspecified'}</td>
                <td className="px-6 py-4 text-zinc-400">{biz.address}</td>
                <td className="px-6 py-4 text-zinc-400">{biz.phone || 'N/A'}</td>
                <td className="px-6 py-4"><span className="flex items-center gap-1 text-green-400 text-sm"><CheckCircle size={14} /> Active</span></td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-zinc-500">No businesses found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-white/10 relative shadow-2xl my-8">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">✕</button>
            <h2 className="text-2xl font-bold mb-2 text-white">Onboard Venue</h2>
            <p className="text-zinc-400 mb-6">Create a new business profile and generate their login credentials.</p>

            {onboardStatus === 'success' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} /></div>
                <h3 className="text-xl font-bold text-white mb-2">Venue Onboarded!</h3>
                <p className="text-zinc-400 mb-6">They can now log in using the credentials you created.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Venue Type</label>
                  <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 appearance-none">
                    {businessTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-zinc-400 mb-2">Business Name</label><input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="input-field" placeholder="E.g., The Sapphire Room" /></div>
                <div><label className="block text-sm font-medium text-zinc-400 mb-2">Business Address</label><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="input-field" placeholder="Downtown Italian" /></div>
                <div><label className="block text-sm font-medium text-zinc-400 mb-2">Phone Number</label><input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" placeholder="+1 (555) 123-4567" /></div>
                <div><label className="block text-sm font-medium text-zinc-400 mb-2">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 transition-all" placeholder="Brief description..." rows={3} /></div>
                <hr className="border-white/10 my-4" />
                <h3 className="text-lg font-medium text-white mb-2">Admin Credentials</h3>
                <div><label className="block text-sm font-medium text-zinc-400 mb-2">Admin Login Email</label><input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="input-field" placeholder="admin@sapphire.com" /></div>
                <div><label className="block text-sm font-medium text-zinc-400 mb-2">Temporary Password</label><input type="text" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="input-field" placeholder="Auto-generate or type..." /></div>
              </div>
            )}

            {onboardStatus !== 'success' && (
              <div className="mt-6 pt-4 border-t border-white/5">
                <button onClick={handleOnboard} disabled={!businessName || !adminEmail || !adminPassword || isOnboarding} className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2">
                  <Plus size={18} /> {isOnboarding ? 'Creating...' : 'Create Business'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
